import { describe, expect, it } from 'vitest'
import { FIELD_ATTR, FIELD_TYPE_ATTR, PAGE_ATTR } from '../pageFormats'
import { safeLinkHref } from './files'
import { snapshotPage } from './measure'

/**
 * A DOM small enough to write by hand — there is none in this test environment.
 *
 * Each text node is laid out on one line from its own origin at a fixed advance
 * per character, which is all a Range needs to answer `getClientRects`. The
 * selectors are the few the walk uses: tag names, `[attr]` and `a[href]`.
 */
type Css = Record<string, string>
const BASE_CSS: Css = {
  display: 'block',
  visibility: 'visible',
  opacity: '1',
  color: 'rgb(17, 24, 39)',
  fontSize: '16px',
  fontWeight: '400',
  fontStyle: 'normal',
  fontFamily: 'Inter, sans-serif',
  letterSpacing: 'normal',
  textTransform: 'none',
  textDecorationLine: 'none',
  textAlign: 'start',
  direction: 'ltr',
  lineHeight: 'normal',
  paddingLeft: '0px',
}

class FakeText {
  parentElement: FakeEl | null = null
  constructor(public data: string, public x: number, public y: number, public adv = 10, public h = 20) {}
}

class FakeEl {
  parentElement: FakeEl | null = null
  children: (FakeEl | FakeText)[] = []
  ownerDocument: any
  value?: string
  checked?: boolean
  options?: { text: string; value?: string; selected: boolean }[]
  href?: string
  constructor(
    public tagName: string,
    public attrs: Record<string, string> = {},
    public css: Css = {},
    public rect = { left: 0, top: 0, width: 0, height: 0 },
  ) {}
  add(...kids: (FakeEl | FakeText)[]) {
    for (const k of kids) {
      k.parentElement = this
      this.children.push(k)
    }
    return this
  }
  getAttribute(n: string) {
    return n in this.attrs ? this.attrs[n] : null
  }
  getBoundingClientRect() {
    return this.rect
  }
  getClientRects() {
    return [this.rect]
  }
  get textContent(): string {
    return this.children.map((c) => (c instanceof FakeText ? c.data : c.textContent)).join('')
  }
  matches(sel: string): boolean {
    return sel.split(',').some((s) => {
      s = s.trim()
      const m = /^([a-z]*)(?:\[([\w-]+)\])?$/.exec(s)
      if (!m) return false
      return (!m[1] || this.tagName.toLowerCase() === m[1]) && (!m[2] || m[2] in this.attrs)
    })
  }
  closest(sel: string): FakeEl | null {
    for (let e: FakeEl | null = this; e; e = e.parentElement) if (e.matches(sel)) return e
    return null
  }
  descendants(): FakeEl[] {
    return this.children.flatMap((c) => (c instanceof FakeEl ? [c, ...c.descendants()] : []))
  }
  querySelectorAll(sel: string) {
    return this.descendants().filter((e) => e.matches(sel))
  }
  querySelector(sel: string) {
    return this.querySelectorAll(sel)[0] ?? null
  }
}

function texts(el: FakeEl): FakeText[] {
  return el.children.flatMap((c) => (c instanceof FakeText ? [c] : texts(c)))
}

function mount(page: FakeEl) {
  const doc = {
    createTreeWalker: (root: FakeEl) => {
      const list = texts(root)
      let i = 0
      return { nextNode: () => list[i++] ?? null }
    },
    createRange: () => {
      let node: FakeText
      let a = 0
      let b = 0
      return {
        setStart: (n: FakeText, i: number) => {
          node = n
          a = i
        },
        setEnd: (_: FakeText, j: number) => {
          b = j
        },
        getClientRects: () => [{ left: node.x + a * node.adv, top: node.y, width: (b - a) * node.adv, height: node.h }],
      }
    },
  }
  for (const e of [page, ...page.descendants()]) e.ownerDocument = doc
  const win = { getComputedStyle: (e: FakeEl) => ({ ...BASE_CSS, ...e.css }) }
  return snapshotPage(win as any, page as any, 0, 794, 1123)
}

const pageEl = () => new FakeEl('DIV', { [PAGE_ATTR]: '0' }, {}, { left: 100, top: 50, width: 794, height: 1123 })

describe('snapshotPage', () => {
  it('measures words relative to the page box and groups them into lines', () => {
    const h1 = new FakeEl('H1', {}, { fontSize: '40px', fontWeight: '800', textAlign: 'center' }).add(new FakeText('Fête  de la musique', 200, 150))
    const page = pageEl().add(h1)
    const snap = mount(page)
    expect(snap.lines).toHaveLength(1)
    expect(snap.lines[0].text).toBe('Fête de la musique')
    expect(snap.lines[0].rect.x).toBe(100) // 200 − the page's 100
    expect(snap.lines[0].rect.y).toBe(100)
    expect(snap.blocks[0].align).toBe('center')
    expect(snap.lines[0].runs[0].style.fontWeight).toBe(800)
  })

  it('does not add a space between inline runs the source wrote together', () => {
    const p = new FakeEl('P')
    const b = new FakeEl('B', {}, { display: 'inline', fontWeight: '700' }).add(new FakeText('World', 250, 150))
    p.add(new FakeText('Hello', 200, 150), b)
    const snap = mount(pageEl().add(p))
    expect(snap.lines[0].text).toBe('HelloWorld')
    expect(snap.lines[0].runs.map((r) => r.text)).toEqual(['Hello', 'World'])
  })

  it('shows the text as the page does: transformed, underlined through a link, faded by an ancestor', () => {
    const faded = new FakeEl('DIV', {}, { opacity: '0.5' })
    const a = new FakeEl('A', { href: 'https://example.org' }, { display: 'inline', textDecorationLine: 'underline' })
    a.href = 'https://example.org/'
    a.rect = { left: 200, top: 150, width: 60, height: 20 }
    const span = new FakeEl('SPAN', {}, { display: 'inline', textTransform: 'uppercase' }).add(new FakeText('réservez', 200, 150))
    a.add(span)
    faded.add(a)
    const snap = mount(pageEl().add(faded))
    expect(snap.lines[0].text).toBe('RÉSERVEZ')
    expect(snap.lines[0].runs[0].style.underline).toBe(true)
    expect(snap.lines[0].runs[0].style.color.a).toBeCloseTo(0.5)
    expect(snap.links).toEqual([{ href: 'https://example.org', rect: { x: 100, y: 100, w: 60, h: 20 } }])
  })

  it('keeps a link as AUTHORED: `#` and `/x` never become a link to the server Mocky runs on', () => {
    // A srcdoc frame inherits Mocky's base URL, so `.href` resolves both.
    const hash = new FakeEl('A', { href: '#' }, { display: 'inline' }, { left: 200, top: 150, width: 60, height: 20 })
    hash.href = 'http://192.168.1.20:8787/#'
    const rel = new FakeEl('A', { href: '/contact' }, { display: 'inline' }, { left: 200, top: 200, width: 60, height: 20 })
    rel.href = 'http://192.168.1.20:8787/contact'
    const snap = mount(pageEl().add(hash, rel))
    expect(snap.links.map((l) => l.href)).toEqual(['#', '/contact'])
    expect(snap.links.map((l) => safeLinkHref(l.href))).toEqual([null, null])
  })

  it('reports overflow as the kit does: glyphs and fields, never a shape that bleeds', () => {
    const blob = new FakeEl('DIV', {}, {}, { left: 700, top: -100, width: 400, height: 400 })
    expect(mount(pageEl().add(blob)).overflow).toBe(false)
    const deco = new FakeEl('DIV', { 'aria-hidden': 'true' }).add(new FakeText('2026', 850, 150))
    expect(mount(pageEl().add(deco)).overflow).toBe(false)
    // 750 → 860 on a 794-px page: past the edge, and not printed either.
    const long = new FakeEl('P').add(new FakeText('débordement', 850, 150))
    const snap = mount(pageEl().add(long))
    expect(snap.overflow).toBe(true)
    expect(snap.lines).toEqual([])
    const field = new FakeEl('DIV', { [FIELD_ATTR]: 'nom' }, {}, { left: 100, top: 1150, width: 300, height: 40 })
    expect(mount(pageEl().add(field)).overflow).toBe(true)
  })

  it('says how far past which edge, and what — the numbers a fit is asked for in', () => {
    // The page sits at (100, 50): 'débordement' runs 750 → 860 on a 794-px page,
    // the field 1100 → 1140 on a 1123-px one.
    const long = new FakeEl('P').add(new FakeText('débordement', 850, 150))
    const field = new FakeEl('DIV', { [FIELD_ATTR]: 'nom' }, {}, { left: 100, top: 1150, width: 300, height: 40 })
    const snap = mount(pageEl().add(long, field))
    expect(snap.excess).toEqual({ top: 0, right: 66, bottom: 17, left: 0 })
    expect(snap.outside).toEqual([{ text: 'débordement' }, { text: 'nom', field: true }])
    // Nothing crosses: nothing to say, and no zeros pretending to be a measurement.
    const inside = mount(pageEl().add(new FakeEl('P').add(new FakeText('dedans', 100, 150))))
    expect(inside.overflow).toBe(false)
    expect(inside.excess).toBeUndefined()
    expect(inside.outside).toBeUndefined()
  })

  it('never counts a shape or decorative text in the excess', () => {
    const blob = new FakeEl('DIV', {}, {}, { left: 700, top: 1000, width: 400, height: 400 })
    const deco = new FakeEl('DIV', { 'aria-hidden': 'true' }).add(new FakeText('2026', 100, 1200))
    const late = new FakeEl('P').add(new FakeText('fin', 100, 1160))
    const snap = mount(pageEl().add(blob, deco, late))
    expect(snap.excess).toEqual({ top: 0, right: 0, bottom: 7, left: 0 })
    expect(snap.outside).toEqual([{ text: 'fin' }])
  })

  it('leaves rotated or scaled text in the picture, and counts it', () => {
    const sticker = new FakeEl('DIV', {}, { transform: 'matrix(0.994522, -0.104528, 0.104528, 0.994522, 0, 0)' })
    sticker.add(new FakeEl('SPAN', {}, { display: 'inline' }).add(new FakeText('Gratuit', 200, 150)))
    const centred = new FakeEl('P', {}, { transform: 'matrix(1, 0, 0, 1, -40, 0)' }).add(new FakeText('Centré', 200, 300))
    const snap = mount(pageEl().add(sticker, centred))
    expect(snap.lines.map((l) => l.text)).toEqual(['Centré'])
    expect(snap.tilted).toBe(1)
  })

  it('leaves out hidden text, text clipped off the page, and the text inside fields', () => {
    const hidden = new FakeEl('P', {}, { visibility: 'hidden' }).add(new FakeText('caché', 200, 150))
    const off = new FakeEl('P').add(new FakeText('dehors', 200, 5000))
    const box = new FakeEl('DIV', { [FIELD_ATTR]: 'nom', [FIELD_TYPE_ATTR]: 'text' }, {}, { left: 150, top: 700, width: 300, height: 40 }).add(
      new FakeText('Votre nom', 160, 710),
    )
    const snap = mount(pageEl().add(hidden, off, box))
    expect(snap.lines).toEqual([])
    expect(snap.fields).toHaveLength(1)
    expect(snap.fields[0]).toMatchObject({ name: 'nom', type: 'text', placeholder: 'Votre nom', rect: { x: 50, y: 650, w: 300, h: 40 } })
  })

  it('leaves out visually hidden text: sr-only, and words past an overflow-hidden edge', () => {
    const srOnly = new FakeEl(
      'SPAN',
      {},
      { display: 'inline', position: 'absolute', overflowX: 'hidden', overflowY: 'hidden', clip: 'rect(0px, 0px, 0px, 0px)' },
      { left: 200, top: 150, width: 1, height: 1 },
    ).add(new FakeText('Menu', 200, 150))
    // A 100 px card: "Visible" (70 px) is in, "coupé" (at 280) is past its edge.
    const card = new FakeEl('DIV', {}, { overflowX: 'hidden', overflowY: 'hidden' }, { left: 200, top: 300, width: 100, height: 40 }).add(
      new FakeText('Visible', 200, 300),
      new FakeEl('SPAN', {}, { display: 'inline' }).add(new FakeText('coupé', 280, 300)),
    )
    // An absolute badge escapes a STATIC overflow-hidden wrapper: its containing
    // block is further up, and that is how the browser draws it.
    const wrap = new FakeEl('DIV', {}, { position: 'static', overflowX: 'hidden', overflowY: 'hidden' }, { left: 200, top: 500, width: 20, height: 20 }).add(
      new FakeEl('SPAN', {}, { position: 'absolute' }).add(new FakeText('Nouveau', 200, 500)),
    )
    const snap = mount(pageEl().add(srOnly, card, wrap))
    expect(snap.lines.map((l) => l.text)).toEqual(['Visible', 'Nouveau'])
  })

  it('leaves vertical text in the picture, like a rotation', () => {
    const spine = new FakeEl('DIV', {}, { writingMode: 'vertical-rl' }).add(new FakeText('Édition 2026', 200, 150))
    const snap = mount(pageEl().add(spine))
    expect(snap.lines).toEqual([])
    expect(snap.tilted).toBe(2)
  })

  it('reads a real control inside a field: its type, value, options', () => {
    const wrap = new FakeEl('LABEL', { [FIELD_ATTR]: 'créneau' }, {}, { left: 100, top: 50, width: 200, height: 30 })
    const select = new FakeEl('SELECT', {}, { paddingLeft: '8px' })
    select.options = [
      { text: 'Matin', selected: false },
      { text: 'Soir', selected: true },
    ]
    wrap.add(select)
    const check = new FakeEl('INPUT', { [FIELD_ATTR]: 'ok', type: 'checkbox' }, {}, { left: 100, top: 100, width: 16, height: 16 })
    check.checked = true
    const area = new FakeEl('TEXTAREA', { [FIELD_ATTR]: 'msg', placeholder: 'Votre message' }, {}, { left: 100, top: 200, width: 300, height: 100 })
    area.value = ''
    const snap = mount(pageEl().add(wrap, check, area))
    expect(snap.fields.map((f) => [f.name, f.type])).toEqual([
      ['créneau', 'select'],
      ['ok', 'checkbox'],
      ['msg', 'multiline'],
    ])
    expect(snap.fields[0]).toMatchObject({ options: ['Matin', 'Soir'], value: 'Soir', paddingLeft: 8 })
    expect(snap.fields[1].checked).toBe(true)
    expect(snap.fields[2].placeholder).toBe('Votre message')
  })

  it('reads the kit\'s empty-valued first option as a placeholder, not an answer', () => {
    const select = new FakeEl('SELECT', { [FIELD_ATTR]: 'taille' }, {}, { left: 100, top: 50, width: 200, height: 30 })
    select.options = [
      { text: 'Choisissez…', value: '', selected: true },
      { text: 'S', value: 'S', selected: false },
      { text: 'M', value: 'M', selected: false },
    ]
    const snap = mount(pageEl().add(select))
    expect(snap.fields[0]).toMatchObject({ type: 'select', options: ['S', 'M'], value: '', placeholder: 'Choisissez…' })
  })
})
