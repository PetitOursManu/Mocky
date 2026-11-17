import { describe, expect, it } from 'vitest'
import {
  RESPONSIVE_VIEWS,
  measureOverflowIn,
  readViewOverflow,
  reportClear,
  responsiveFindings,
  responsiveVerdict,
  type ResponsiveReport,
  type ViewOverflow,
} from './responsive'

/*
 * A DOM just big enough for the measurement: boxes are given, not laid out.
 * The function is run from its own SOURCE, the way the preview frame runs it,
 * so a reference to anything outside it fails here rather than in a frame.
 */
type Box = { left: number; right: number; top?: number; height?: number }
interface FakeEl {
  tagName: string
  id?: string
  style: Record<string, string>
  box: Box
  text?: Box & { value: string }
  attrs?: Record<string, string>
  children: FakeEl[]
  parentElement: FakeEl | null
  nodeType: 1
}

function el(tagName: string, box: Box, opts: Partial<Pick<FakeEl, 'style' | 'text' | 'attrs' | 'id'>> = {}, children: FakeEl[] = []): FakeEl {
  const e: FakeEl = { tagName, box, style: opts.style ?? {}, text: opts.text, attrs: opts.attrs, id: opts.id, children, parentElement: null, nodeType: 1 }
  for (const c of children) c.parentElement = e
  return e
}

function dom(vw: number, root: FakeEl, page: { scrollWidth: number; style?: Record<string, string> } = { scrollWidth: vw }) {
  const body = el('BODY', { left: 0, right: vw }, { style: page.style ?? {} }, [root])
  const html = el('HTML', { left: 0, right: vw }, {}, [body])
  const descendants = (e: FakeEl): FakeEl[] => e.children.flatMap((c) => [c, ...descendants(c)])
  const contains = (a: FakeEl, b: FakeEl): boolean => a === b || a.children.some((c) => contains(c, b))
  const cache = new Map<FakeEl, unknown>()
  function wrapCached(e: FakeEl): unknown {
    if (!cache.has(e)) cache.set(e, wrap(e))
    return cache.get(e)
  }
  const wrap = (e: FakeEl): unknown => {
    const node = {
      tagName: e.tagName,
      id: e.id ?? '',
      __fake: e,
      get parentElement() {
        return e.parentElement ? wrapCached(e.parentElement) : null
      },
      get firstChild() {
        return e.text ? { nodeType: 3, nodeValue: e.text.value, nextSibling: null, __text: e.text } : null
      },
      get textContent() {
        return [e.text?.value ?? '', ...descendants(e).map((d) => d.text?.value ?? '')].join(' ')
      },
      closest: (sel: string) => (sel === 'svg' && e.tagName === 'svg' ? node : null),
      contains: (other: { __fake: FakeEl }) => contains(e, other.__fake),
      getAttribute: (k: string) => e.attrs?.[k] ?? null,
      getBoundingClientRect: () => ({ left: e.box.left, right: e.box.right, width: e.box.right - e.box.left, height: e.box.height ?? 20, top: e.box.top ?? 0 }),
      querySelectorAll: () => descendants(e).map(wrapCached),
      scrollWidth: e === body ? page.scrollWidth : 0,
    }
    return node
  }
  const doc = {
    documentElement: { clientWidth: vw, scrollWidth: page.scrollWidth, __fake: html },
    body: wrapCached(body),
    getElementById: (id: string) => (id === 'root' ? wrapCached(root) : null),
    createRange: () => {
      let rects: Box[] = []
      return {
        selectNodeContents: (n: { __text: Box }) => (rects = [n.__text]),
        getClientRects: () => rects.map((r) => ({ left: r.left, right: r.right, width: r.right - r.left })),
      }
    },
  }
  const styleFor = (e: { __fake: FakeEl }) => {
    const s = e.__fake.style
    return { display: 'block', visibility: 'visible', opacity: '1', position: 'static', overflowX: 'visible', textOverflow: 'clip', webkitLineClamp: 'none', ...s }
  }
  const win = { innerWidth: vw, getComputedStyle: styleFor }
  // `doc.documentElement` and `doc.body` are compared by identity with parents.
  ;(doc.documentElement as Record<string, unknown>).tagName = 'HTML'
  return { doc, win, html, body }
}

const run = (vw: number, root: FakeEl, page?: { scrollWidth: number; style?: Record<string, string> }): ViewOverflow => {
  const source = measureOverflowIn.toString()
  const fn = new Function(`return (${source})`)() as typeof measureOverflowIn
  const { doc, win } = dom(vw, root, page)
  let n = 0
  return fn(doc as unknown as Document, win as unknown as Window, () => `#e${n++}`)
}

describe('measureOverflowIn', () => {
  it('is shippable into the frame: one function, no backtick', () => {
    const source = measureOverflowIn.toString()
    expect(source).not.toContain('`')
    expect(() => new Function(`return (${source})`)()).not.toThrow()
  })

  it('names text past the viewport and text cut by a box that hides, by how much', () => {
    const title = el('H1', { left: 16, right: 470 }, { text: { left: 16, right: 450, value: 'Un titre bien trop long' }, attrs: { class: 'text-7xl' } })
    const card = el('P', { left: 20, right: 300 }, { text: { left: 20, right: 350, value: 'Texte coupé' } })
    const box = el('DIV', { left: 10, right: 310 }, { style: { overflowX: 'hidden' } }, [card])
    const root = el('DIV', { left: 0, right: 390 }, { id: 'root' }, [title, box])
    const out = run(390, root)
    expect(out.page).toBe(0)
    expect(out.items).toEqual([
      expect.objectContaining({ tag: 'h1', kind: 'outside', px: 60, cls: 'text-7xl', text: 'Un titre bien trop long' }),
      expect.objectContaining({ tag: 'p', kind: 'clipped', px: 40 }),
    ])
  })

  it('leaves a carousel, a ticker item wholly past the edge, an ellipsis and sr-only alone', () => {
    const slide = el('P', { left: 300, right: 700 }, { text: { left: 300, right: 700, value: 'Diapo' } })
    const carousel = el('DIV', { left: 0, right: 390 }, { style: { overflowX: 'auto' } }, [slide])
    const next = el('SPAN', { left: 400, right: 500 }, { text: { left: 400, right: 500, value: 'Suivant' } })
    const ticker = el('DIV', { left: 0, right: 390 }, { style: { overflowX: 'hidden' } }, [next])
    const ell = el('P', { left: 0, right: 390 }, { style: { textOverflow: 'ellipsis' }, text: { left: 0, right: 600, value: 'Long' } })
    const sr = el('SPAN', { left: 0, right: 1 }, { text: { left: 0, right: 80, value: 'Menu' } })
    const srBox = el('DIV', { left: 0, right: 1 }, { style: { overflowX: 'hidden' } }, [sr])
    const root = el('DIV', { left: 0, right: 390 }, { id: 'root' }, [carousel, ticker, ell, srBox])
    expect(run(390, root).items).toEqual([])
  })

  it('names the box that makes the page scroll sideways, unless the page hides it', () => {
    const blob = el('DIV', { left: 200, right: 490 })
    const root = el('DIV', { left: 0, right: 390 }, { id: 'root' }, [blob])
    const out = run(390, root, { scrollWidth: 490 })
    expect(out.page).toBe(100)
    expect(out.items).toEqual([expect.objectContaining({ kind: 'scroll', px: 100, tag: 'div' })])
    const hidden = run(390, root, { scrollWidth: 490, style: { overflowX: 'hidden' } })
    expect(hidden).toEqual({ page: 0, items: [] })
    // In a section that hides but is not its containing block, a blob escapes.
    const loose = el('DIV', { left: 200, right: 490 }, { style: { position: 'absolute' } })
    const section = el('SECTION', { left: 0, right: 390 }, { style: { overflowX: 'hidden' } }, [loose])
    const escaped = run(390, el('DIV', { left: 0, right: 390 }, { id: 'root' }, [section]), { scrollWidth: 490 })
    expect(escaped.items).toEqual([expect.objectContaining({ kind: 'scroll', px: 100 })])
    const relative = el('SECTION', { left: 0, right: 390 }, { style: { overflowX: 'hidden', position: 'relative' } }, [
      el('DIV', { left: 200, right: 490 }, { style: { position: 'absolute' } }),
    ])
    expect(run(390, el('DIV', { left: 0, right: 390 }, { id: 'root' }, [relative]), { scrollWidth: 490 }).items).toEqual([])
  })
})

const clear = (): ViewOverflow => ({ page: 0, items: [] })
const over = (px: number, page = 0): ViewOverflow => ({ page, items: [{ selector: 'body > div', tag: 'div', kind: 'outside', px, text: 'Titre', cls: 'w-[720px]' }] })
const report = (mobile: ViewOverflow, tablet: ViewOverflow = clear(), desktop: ViewOverflow = clear()): ResponsiveReport => ({ mobile, tablet, desktop })

describe('responsiveVerdict', () => {
  it('keeps what fits, keeps what is closer, refuses what is no better or breaks a clear width', () => {
    expect(responsiveVerdict(report(over(330)), report(clear()))).toBe('fits')
    expect(responsiveVerdict(report(over(330), over(10)), report(over(20)))).toBe('closer')
    expect(responsiveVerdict(report(over(330)), report(over(328)))).toBe('rejected')
    expect(responsiveVerdict(report(over(330)), report(clear(), clear(), over(5)))).toBe('rejected')
  })
})

describe('readViewOverflow and the findings', () => {
  it('reads only the shape it expects from a frame', () => {
    expect(readViewOverflow(null)).toBeNull()
    expect(readViewOverflow({ page: 3, items: 'x' })).toBeNull()
    const read = readViewOverflow({ page: 12.4, items: [{ selector: 'body > h1', kind: 'outside', px: 40, tag: 'h1', text: 'x'.repeat(200) }, { selector: 'a', kind: 'weird', px: 1 }] })
    expect(read).toEqual({ page: 12, items: [expect.objectContaining({ selector: 'body > h1', px: 40, cls: '' })] })
    expect(read!.items[0].text).toHaveLength(80)
  })

  it('tells the model each width, in pixels, with the classes and the text to find the element by', () => {
    const r = report(over(330, 330), clear(), clear())
    expect(reportClear(r)).toBe(false)
    const text = responsiveFindings(r)
    expect(text).toContain(`PHONE (${RESPONSIVE_VIEWS[0].w} px wide):`)
    expect(text).toContain('- The page is 330 px wider than the viewport and scrolls sideways.')
    expect(text).toContain('- <div> class="w-[720px]" "Titre" runs past the edge of the viewport by 330 px.')
    expect(text).toContain('DESKTOP (1440 px wide): nothing overflows. Keep it that way.')
  })
})
