import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Babel from '@babel/standalone'
import { DocumentSource, DOCUMENT_EXPORTS, DOC_BACKDROP } from './Document'
import {
  DOC_ATTR,
  DOC_PAGES_MESSAGE,
  FIELD_ATTR,
  FIELD_TYPE_ATTR,
  PAGE_ATTR,
  PAGE_FORMATS,
  PAGE_GAP_PX,
  getPageFormat,
} from '../../pageFormats'
import { CAPABILITIES } from '../registry'
import { capabilitiesFor, capabilitiesUsedBy, resolveCapabilities } from '../select'
import { buildPrelude } from '../prelude'

/**
 * The page kit, held to the contract in `pageFormats.ts` that the exports read.
 *
 * The kit is a string evaluated inside a sandboxed frame, so it is exercised
 * here the way the other packs are: its source is run against a stand-in
 * React that records what it renders, and its measuring functions against a
 * hand-made tree of nodes. What a real browser adds — layout — is what the
 * visual check after the merge is for.
 */

type El = { type: unknown; props: Record<string, unknown>; children: unknown[] }

function loadKit(opts: { ctx?: unknown; win?: Record<string, unknown>; doc?: Record<string, unknown> } = {}) {
  const effects: Array<() => void | (() => void)> = []
  const React = {
    createContext: (d: unknown) => ({ Provider: 'Provider', d }),
    createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): El => ({
      type,
      props: props || {},
      children,
    }),
    useContext: () => opts.ctx ?? null,
    useRef: (v: unknown) => ({ current: v }),
    useEffect: (fn: () => void | (() => void)) => {
      effects.push(fn)
    },
    useId: () => ':r7:',
    Children: {
      map: (c: unknown, fn: (x: unknown) => unknown) => (Array.isArray(c) ? c : c == null ? [] : [c]).map(fn),
    },
    cloneElement: (el: El, extra: Record<string, unknown>) => ({ ...el, props: { ...el.props, ...extra } }),
  }
  const win = opts.win ?? {}
  const doc = opts.doc ?? {}
  const kit = new Function(
    'React',
    'window',
    'document',
    `${DocumentSource}\nreturn { Doc: Doc, Page: Page, Field: Field, mockyDocMeasure: mockyDocMeasure }`,
  )(React, win, doc) as {
    Doc: (p: Record<string, unknown>) => El
    Page: (p: Record<string, unknown>) => El
    Field: (p: Record<string, unknown>) => El
    mockyDocMeasure: (root: unknown) => { count: number; overflow: number[] }
  }
  return { kit, effects, React }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('the page kit source', () => {
  it('compiles on its own and with a document that uses it', () => {
    expect(() => Babel.transform(DocumentSource, { presets: [['react', { runtime: 'classic' }]] })).not.toThrow()
    const cap = CAPABILITIES.find((c) => c.id === 'document')!
    const screen = `function App(){ return <Doc format="a4"><Page className="bg-white p-10"><h1>Fête</h1><Field name="email" type="email" /></Page></Doc> }`
    const combined = buildPrelude(resolveCapabilities(['icons', cap.id])) + '\n' + screen
    expect(() => Babel.transform(combined, { presets: [['react', { runtime: 'classic' }]] })).not.toThrow()
  })

  it('defines every name it exports', () => {
    for (const name of DOCUMENT_EXPORTS) expect(DocumentSource).toMatch(new RegExp(`\\bvar ${name} = function`))
  })

  it('spells the contract from pageFormats.ts, not by hand', () => {
    expect(DocumentSource).toContain(`var MOCKY_DOC_ATTR = ${JSON.stringify(DOC_ATTR)}`)
    expect(DocumentSource).toContain(`var MOCKY_PAGE_ATTR = ${JSON.stringify(PAGE_ATTR)}`)
    expect(DocumentSource).toContain(`var MOCKY_FIELD_ATTR = ${JSON.stringify(FIELD_ATTR)}`)
    expect(DocumentSource).toContain(`var MOCKY_FIELD_TYPE_ATTR = ${JSON.stringify(FIELD_TYPE_ATTR)}`)
    expect(DocumentSource).toContain(`var MOCKY_DOC_MESSAGE = ${JSON.stringify(DOC_PAGES_MESSAGE)}`)
    expect(DocumentSource).toContain(`var MOCKY_DOC_GAP = ${PAGE_GAP_PX}`)
    // And nowhere else as a literal: a second spelling is a second contract.
    const body = DocumentSource.split('\n').filter((l) => !/^var MOCKY_/.test(l)).join('\n')
    for (const attr of [DOC_ATTR, PAGE_ATTR, FIELD_ATTR, FIELD_TYPE_ATTR]) expect(body).not.toContain(attr)
  })

  it('computes no colour html2canvas cannot read', () => {
    expect(DocumentSource).not.toMatch(/color-mix|oklch|oklab|lab\(|lch\(/)
  })
})

describe('<Page>', () => {
  it('is exactly its Doc’s format, whatever it was given', () => {
    for (const f of PAGE_FORMATS) {
      const { kit } = loadKit({ ctx: { id: f.id, f: { w: f.w, h: f.h, size: f.cssSize } } })
      const el = kit.Page({ className: 'bg-red-500', style: { width: 10, height: 10, color: 'red' }, __mockyIndex: 2 })
      const style = el.props.style as Record<string, unknown>
      expect(style.width).toBe(`${f.w}px`)
      expect(style.height).toBe(`${f.h}px`)
      expect(style.overflow).toBe('hidden')
      expect(style.position).toBe('relative')
      expect(style.printColorAdjust).toBe('exact')
      // What it was given that is not the size survives.
      expect(style.color).toBe('red')
      expect(el.props.className).toBe('bg-red-500')
      expect(el.props[PAGE_ATTR]).toBe('2')
      expect(el.props.__mockyIndex).toBeUndefined()
    }
  })

  it('falls back to the default format outside a Doc rather than to no size', () => {
    const { kit } = loadKit()
    const style = kit.Page({}).props.style as Record<string, unknown>
    expect(style.width).toBe(`${getPageFormat('a4').w}px`)
    expect(style.height).toBe(`${getPageFormat('a4').h}px`)
  })
})

describe('<Doc>', () => {
  it('marks the root, stacks the pages at the canvas gap and numbers them in order', () => {
    const { kit } = loadKit()
    const pageA = { type: kit.Page, props: {}, children: [] }
    const pageB = { type: kit.Page, props: {}, children: [] }
    const tree = kit.Doc({ format: 'letter-landscape', children: [pageA, null, pageB] })
    expect((tree.props.value as { id: string }).id).toBe('letter-landscape')
    const root = tree.children[0] as El
    expect(root.props[DOC_ATTR]).toBe('letter-landscape')
    const style = root.props.style as Record<string, unknown>
    expect(style.width).toBe(`${getPageFormat('letter-landscape').w}px`)
    expect(style.gap).toBe(`${PAGE_GAP_PX}px`)
    expect(style.background).toBe(DOC_BACKDROP)
    const [css, pages] = root.children as [El, El[]]
    expect(css.type).toBe('style')
    expect(String(css.children[0])).toContain('@page{size:letter landscape')
    expect(String(css.children[0])).toContain('@media print')
    expect(pages.filter(Boolean).map((p) => (p as El).props.__mockyIndex)).toEqual([0, 1])
  })

  it('reports the format it laid out, so the canvas can follow the code', () => {
    vi.useFakeTimers()
    const post = vi.fn()
    const { kit, effects } = loadKit({ win: { __mockyPost: post }, doc: {} })
    const root = kit.Doc({ format: 'a4-landscape', children: [] }).children[0] as El
    ;(root.props.ref as { current: unknown }).current = {
      querySelectorAll: () => [page(0, [])],
      addEventListener: () => {},
      removeEventListener: () => {},
    }
    effects[0]()
    vi.advanceTimersByTime(100)
    expect(post).toHaveBeenLastCalledWith(DOC_PAGES_MESSAGE, { count: 1, overflow: [], format: 'a4-landscape' })
  })

  it('reads an unknown format as the default one', () => {
    const { kit } = loadKit()
    const root = kit.Doc({ format: 'tabloid', children: [] }).children[0] as El
    expect(root.props[DOC_ATTR]).toBe('a4')
  })

  it('posts the page count once laid out, again later, and only when it changed', () => {
    vi.useFakeTimers()
    const post = vi.fn()
    const { kit, effects } = loadKit({ win: { __mockyPost: post }, doc: {} })
    const tree = kit.Doc({ format: 'a4', children: [] })
    const root = tree.children[0] as El
    let pages = [page(0, [])]
    const fakeRoot = {
      querySelectorAll: () => pages,
      addEventListener: () => {},
      removeEventListener: () => {},
    }
    ;(root.props.ref as { current: unknown }).current = fakeRoot
    const cleanup = effects[0]()
    vi.advanceTimersByTime(100)
    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenLastCalledWith(DOC_PAGES_MESSAGE, { count: 1, overflow: [], format: 'a4' })
    // Tailwind's runtime writes its CSS a task after mount: a later
    // measurement that sees more is what makes the frame right.
    pages = [page(0, []), page(1, [])]
    vi.advanceTimersByTime(4000)
    expect(post).toHaveBeenCalledTimes(2)
    expect(post).toHaveBeenLastCalledWith(DOC_PAGES_MESSAGE, { count: 2, overflow: [], format: 'a4' })
    if (typeof cleanup === 'function') cleanup()
  })

  it('says nothing, and breaks nothing, where there is no one to tell (the capture shell)', () => {
    vi.useFakeTimers()
    const { kit, effects } = loadKit({ win: {}, doc: {} })
    const root = kit.Doc({ format: 'a4', children: [] }).children[0] as El
    ;(root.props.ref as { current: unknown }).current = {
      querySelectorAll: () => [page(0, [])],
      addEventListener: () => {},
      removeEventListener: () => {},
    }
    effects[0]()
    expect(() => vi.advanceTimersByTime(4000)).not.toThrow()
  })
})

describe('<Field>', () => {
  const control = (el: El): El => (el.type === 'label' ? (el.children.find((c) => c && (c as El).type !== 'span') as El) : el)

  it('renders the right control for every type, marked for the PDF export', () => {
    const { kit } = loadKit()
    const cases: Array<[string, string, string | undefined]> = [
      ['text', 'input', 'text'],
      ['email', 'input', 'email'],
      ['date', 'input', 'date'],
      ['number', 'input', 'number'],
      ['multiline', 'textarea', undefined],
      ['checkbox', 'input', 'checkbox'],
      ['select', 'select', undefined],
    ]
    for (const [type, tag, inputType] of cases) {
      const el = control(kit.Field({ name: `f-${type}`, type, label: 'Libellé', options: ['A', 'B'] }))
      expect(el.type, type).toBe(tag)
      expect(el.props.type, type).toBe(inputType)
      expect(el.props[FIELD_ATTR], type).toBe(`f-${type}`)
      expect(el.props[FIELD_TYPE_ATTR], type).toBe(type)
      expect(el.props.name, type).toBe(`f-${type}`)
    }
  })

  it('reads an unknown type as text', () => {
    const { kit } = loadKit()
    const el = kit.Field({ name: 'x', type: 'signature' })
    expect(el.props[FIELD_TYPE_ATTR]).toBe('text')
  })

  it('keeps the model’s name, minus the dot a PDF form reads as a hierarchy', () => {
    const { kit } = loadKit()
    expect(kit.Field({ name: 'contact.email' }).props[FIELD_ATTR]).toBe('contact-email')
    expect(kit.Field({ name: 'firstName' }).props[FIELD_ATTR]).toBe('firstName')
  })

  it('names itself from its label, then from a stable id, when the model gave no name', () => {
    const { kit } = loadKit()
    expect(control(kit.Field({ label: 'Prénom & nom' })).props[FIELD_ATTR]).toBe('prenom-nom')
    expect(kit.Field({}).props[FIELD_ATTR]).toBe('field-r7')
  })

  it('has a neutral look that a className replaces rather than fights', () => {
    const { kit } = loadKit()
    const plain = kit.Field({ name: 'a' })
    expect(String(plain.props.className)).toMatch(/border/)
    expect(kit.Field({ name: 'a', className: 'bg-transparent border-b-2' }).props.className).toBe('bg-transparent border-b-2')
  })

  it('always has an accessible name', () => {
    const { kit } = loadKit()
    expect(kit.Field({ name: 'code' }).props['aria-label']).toBe('code')
    expect(kit.Field({ name: 'code', placeholder: 'Code promo' }).props['aria-label']).toBe('Code promo')
    // A visible label wraps the control, which names it.
    expect(kit.Field({ name: 'code', label: 'Code' }).type).toBe('label')
  })

  it('lists its options, with the placeholder first', () => {
    const { kit } = loadKit()
    const sel = kit.Field({ name: 's', type: 'select', placeholder: 'Choisir…', options: ['Samedi', { value: 'sun', label: 'Dimanche' }] })
    const opts = sel.children[0] as El[]
    expect(opts.map((o) => [o.props.value, o.children[0]])).toEqual([
      ['', 'Choisir…'],
      ['Samedi', 'Samedi'],
      ['sun', 'Dimanche'],
    ])
  })
})

// ---- measurement against a hand-made tree ---------------------------------------

type Rect = { top: number; left: number; bottom: number; right: number; width: number; height: number }
const rect = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
})

interface FakeNode {
  nodeType: number
  tagName?: string
  nodeValue?: string
  rect: Rect
  attrs: Record<string, string>
  parent: FakeNode | null
  childNodes: FakeNode[]
}

function node(tag: string, r: Rect, kids: FakeNode[] = [], attrs: Record<string, string> = {}): FakeNode {
  const n: FakeNode = { nodeType: 1, tagName: tag, rect: r, attrs: { ...attrs }, parent: null, childNodes: kids }
  for (const k of kids) k.parent = n
  return decorate(n)
}
const text = (value: string, r: Rect): FakeNode => ({ nodeType: 3, nodeValue: value, rect: r, attrs: {}, parent: null, childNodes: [] })

function descendants(n: FakeNode): FakeNode[] {
  return n.childNodes.filter((c) => c.nodeType === 1).flatMap((c) => [c, ...descendants(c)])
}

function decorate(n: FakeNode) {
  return Object.assign(n, {
    getBoundingClientRect: () => n.rect,
    getAttribute: (k: string) => (k in n.attrs ? n.attrs[k] : null),
    setAttribute: (k: string, v: string) => {
      n.attrs[k] = v
    },
    hasAttribute: (k: string) => k in n.attrs,
    querySelectorAll: (sel: string) =>
      sel === '*'
        ? descendants(n)
        : descendants(n).filter((d) => [PAGE_ATTR, FIELD_ATTR].some((a) => sel === `[${a}]` && a in d.attrs)),
    closest: (sel: string) => {
      expect(sel).toBe('svg,[aria-hidden="true"]')
      for (let p: FakeNode | null = n; p; p = p.parent) {
        if (p.tagName === 'svg' || p.attrs['aria-hidden'] === 'true') return p
      }
      return null
    },
  })
}

const PAGE_H = 1123
function page(i: number, kids: FakeNode[], attrValue = String(i)) {
  return node('SECTION', rect(0, i * (PAGE_H + PAGE_GAP_PX), 794, PAGE_H), kids, { [PAGE_ATTR]: attrValue })
}
const fakeDocument = {
  createRange: () => {
    let target: FakeNode | null = null
    return {
      selectNodeContents: (n: FakeNode) => {
        target = n
      },
      getBoundingClientRect: () => target!.rect,
    }
  },
}

describe('mockyDocMeasure', () => {
  const measure = () => loadKit({ doc: fakeDocument }).kit.mockyDocMeasure

  it('counts the pages and renumbers them in the order they are laid out', () => {
    const pages = [page(0, [], '0'), page(1, [], '0'), page(2, [], '7')]
    const root = node('DIV', rect(0, 0, 794, 3 * PAGE_H), pages)
    expect(measure()(root)).toEqual({ count: 3, overflow: [] })
    expect(pages.map((p) => p.attrs[PAGE_ATTR])).toEqual(['0', '1', '2'])
  })

  it('reports a page whose WORDS run past its bottom edge', () => {
    const y = PAGE_H + PAGE_GAP_PX
    const para = node('P', rect(40, y + 1000, 700, 200), [text('Un paragraphe trop long', rect(40, y + 1000, 700, 200))])
    const root = node('DIV', rect(0, 0, 794, 2 * PAGE_H), [page(0, []), page(1, [para])])
    expect(measure()(root)).toEqual({ count: 2, overflow: [1] })
  })

  it('does not count a shape that bleeds off the edge on purpose', () => {
    const blob = node('DIV', rect(600, -80, 400, 400), [], {})
    const art = node('svg', rect(-100, 900, 400, 400), [node('text', rect(-90, 1000, 200, 40), [text('2026', rect(-90, 1000, 200, 40))])])
    const hidden = node('DIV', rect(500, 1000, 600, 300), [text('SOLDES', rect(500, 1000, 600, 300))], { 'aria-hidden': 'true' })
    const root = node('DIV', rect(0, 0, 794, PAGE_H), [page(0, [blob, art, hidden])])
    expect(measure()(root).overflow).toEqual([])
  })

  it('measures the glyphs, not a box that bleeds around them', () => {
    // A sticker whose box runs off the right edge while its word sits inside.
    const sticker = node('DIV', rect(640, 40, 260, 120), [text('-30 %', rect(680, 70, 90, 40))])
    const root = node('DIV', rect(0, 0, 794, PAGE_H), [page(0, [sticker])])
    expect(measure()(root).overflow).toEqual([])
  })

  it('reports a field cut by the page edge', () => {
    const field = node('INPUT', rect(40, 1100, 300, 44), [], { [FIELD_ATTR]: 'email' })
    const root = node('DIV', rect(0, 0, 794, PAGE_H), [page(0, [field])])
    expect(measure()(root).overflow).toEqual([0])
  })

  it('makes field names unique, in the order they are laid out, as a PDF form requires', () => {
    // A recto-verso with a coupon on each side: two 'nom', two 'email', and a
    // model-written 'nom-2' further down that a rename must not land on.
    const f = (name: string, y: number) => node('INPUT', rect(40, y, 300, 40), [], { [FIELD_ATTR]: name, name })
    const fields = [f('nom', 100), f('email', 200), f('nom', 1300), f('email', 1400), f('nom-2', 1500)]
    const root = node('DIV', rect(0, 0, 794, 2 * PAGE_H), [page(0, fields.slice(0, 2)), page(1, fields.slice(2))])
    measure()(root)
    expect(fields.map((x) => x.attrs[FIELD_ATTR])).toEqual(['nom', 'email', 'nom-3', 'email-2', 'nom-2'])
    expect(fields.map((x) => x.attrs.name)).toEqual(['nom', 'email', 'nom-3', 'email-2', 'nom-2'])
    // Stable: a second measurement renames nothing.
    measure()(root)
    expect(fields.map((x) => x.attrs[FIELD_ATTR])).toEqual(['nom', 'email', 'nom-3', 'email-2', 'nom-2'])
  })

  it('tolerates the sub-pixel rounding of a line sitting on the edge', () => {
    const line = node('P', rect(40, 1100, 300, 24.5), [text('Mentions légales', rect(40, 1100, 300, 24.5))])
    const root = node('DIV', rect(0, 0, 794, PAGE_H), [page(0, [line])])
    expect(measure()(root).overflow).toEqual([])
  })
})

describe('the document capability', () => {
  it('is never inferred from a screen that defines its own Field or Page', () => {
    // The most common form component a model writes, on a screen that is not a
    // document: loading the kit there would redeclare it and crash the screen.
    const code = 'const Field = ({ label }) => <label>{label}<input /></label>\nconst Page = () => <main><Field label="Nom" /></main>'
    expect(capabilitiesUsedBy(code)).not.toContain('document')
    expect(capabilitiesFor(['icons'], code)).not.toContain('document')
  })

  it('is kept on a document through capabilitiesFor', () => {
    expect(capabilitiesFor(['icons', 'document'], '<Doc format="a4"><Page /></Doc>')).toContain('document')
  })

  it('has no keyword that could make an app screen a document', () => {
    const cap = CAPABILITIES.find((c) => c.id === 'document')!
    expect(cap.triggers.keywords).toEqual([])
    expect(cap.triggers.intents).toEqual([])
    expect(cap.forcedOnly).toBe(true)
  })
})
