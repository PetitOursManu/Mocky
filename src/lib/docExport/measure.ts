import { FIELD_ATTR, FIELD_TYPE_ATTR, PAGE_ATTR, isFieldType, type FieldType } from '../pageFormats'
import {
  alignOf,
  applyTextTransform,
  groupBlocks,
  groupLines,
  parseCssColor,
  splitAcrossRects,
} from './lines'
import type { BlockInfo, FieldBox, LinkBox, PageSnapshot, Rect, Word } from './types'

/**
 * The DOM walk: what the browser drew on one page, as numbers.
 *
 * Runs in the PARENT, on the capture frame's document (same-origin — see
 * capture.ts), which is why nothing here uses `instanceof`: an element from
 * another realm is never an instance of this realm's `HTMLInputElement`, so a
 * type test by class answers false for every field on the page. Tag names and
 * attributes answer the same in every realm.
 *
 * It reports and decides nothing: one rect per word, in document order, with
 * the style it was drawn in. Grouping into lines and blocks is `lines.ts`'s job,
 * where a test can reach it.
 */

/** Text in these is either not drawn as text, or drawn by something else (a field, an SVG). */
const SKIP_TEXT_IN = `script,style,noscript,template,textarea,select,option,svg,[${FIELD_ATTR}]`

const CONTROL = 'input,textarea,select'

function rel(r: DOMRectReadOnly, origin: { x: number; y: number }): Rect {
  return { x: r.left - origin.x, y: r.top - origin.y, w: r.width, h: r.height }
}

/** A box is ON the page when its centre is: a word clipped by the page's edge is not printed. */
function onPage(r: Rect, width: number, height: number): boolean {
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  return r.w > 0 && r.h > 0 && cx >= 0 && cy >= 0 && cx <= width && cy <= height
}

function px(v: string | null | undefined): number {
  const n = parseFloat(v || '')
  return Number.isFinite(n) ? n : 0
}

function inferFieldType(el: Element, control: Element | null): FieldType {
  const declared = el.getAttribute(FIELD_TYPE_ATTR)
  if (isFieldType(declared)) return declared
  const tag = control?.tagName
  if (tag === 'TEXTAREA') return 'multiline'
  if (tag === 'SELECT') return 'select'
  if (tag === 'INPUT') {
    const t = (control!.getAttribute('type') || 'text').toLowerCase()
    if (t === 'checkbox' || t === 'radio') return 'checkbox'
    if (t === 'date' || t === 'email' || t === 'number') return t
  }
  return 'text'
}

/**
 * Does this computed transform do more than MOVE the element?
 *
 * A rotated or scaled run cannot become a text box: Range rects are the
 * axis-aligned bounds AFTER the transform while `font-size` is the size BEFORE
 * it, so a flyer's `-rotate-6` sticker came back as a straight box of the wrong
 * size over a background its glyphs had been erased from. A pure translation —
 * Tailwind's `transform` utilities compute to `matrix(1, 0, 0, 1, x, y)`, and
 * `-translate-x-1/2` centring is everywhere — leaves the glyphs as they were,
 * so it must not count, or every centred badge would stay a picture.
 * `rotate` and `scale` are the individual properties Tailwind v4 writes.
 */
export function transformTilts(transform?: string | null, rotate?: string | null, scale?: string | null): boolean {
  const none = (v?: string | null) => !v || v === 'none'
  if (!none(rotate) && !/^0(deg|rad|turn|grad)?$/.test(rotate!.trim())) return true
  if (!none(scale) && scale!.trim().split(/\s+/).some((v) => Math.abs(parseFloat(v) - (v.endsWith('%') ? 100 : 1)) > 1e-3)) return true
  if (none(transform)) return false
  const m = /^matrix(3d)?\(([^)]*)\)$/.exec(transform!.trim())
  if (!m) return true // a transform we cannot read is not assumed harmless
  const v = m[2].split(',').map((s) => parseFloat(s))
  if (v.some((n) => !Number.isFinite(n))) return true
  // Everything but the translation must be the identity.
  const identity = m[1] ? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, null, null, null, 1] : [1, 0, 0, 1, null, null]
  return identity.some((want, i) => want !== null && Math.abs(v[i] - want) > 1e-3)
}

/**
 * Text set vertically (`writing-mode: vertical-rl`, a spine label, a sideways
 * date on a flyer's edge) is tilted as far as a text box is concerned: its
 * Range rects are tall and narrow, a slide would set it horizontally across the
 * page, and the ink erased under it would leave a hole where the design had a
 * line. So it stays in the picture, like a rotation.
 */
export function writingModeTilts(writingMode?: string | null): boolean {
  const v = (writingMode || '').trim()
  return !!v && v !== 'horizontal-tb' && v !== 'lr' && v !== 'lr-tb' && v !== 'rl' && v !== 'rl-tb'
}

/**
 * `el` is drawn under a rotation or a scale — its own, or an ancestor's up to
 * the page. Memoised, because the walk asks it of every text node and the
 * raster pass of every element. Shared by both, so what is left out of the text
 * boxes is exactly what is kept in the picture.
 */
export function makeTiltTest(win: Window, page: Element): (el: Element | null) => boolean {
  const memo = new Map<Element, boolean>()
  const test = (el: Element | null): boolean => {
    if (!el) return false
    const hit = memo.get(el)
    if (hit !== undefined) return hit
    const cs = win.getComputedStyle(el) as CSSStyleDeclaration & { rotate?: string; scale?: string }
    const v =
      transformTilts(cs.transform, cs.rotate, cs.scale) ||
      writingModeTilts(cs.writingMode) ||
      (el !== page && test(el.parentElement))
    memo.set(el, v)
    return v
  }
  return test
}

/**
 * The region an element's content is clipped to, in page px — `null` for no
 * clip at all. One axis may be unbounded (`overflow-x: hidden` alone).
 */
export type Clip = Rect | null

const UNBOUNDED = 1e7

/**
 * What one element's own style clips its content to, as flags: per axis for
 * `overflow`, and everything for the two ways a stylesheet hides a thing while
 * keeping it for a screen reader — `clip: rect(0 0 0 0)` (Tailwind 3's
 * `sr-only`) and `clip-path: inset(50%)` (Tailwind 4's).
 */
export function clipsByStyle(cs: {
  overflowX?: string | null
  overflowY?: string | null
  clip?: string | null
  clipPath?: string | null
  position?: string | null
}): { x: boolean; y: boolean; empty: boolean } {
  const clips = (v?: string | null) => !!v && v !== 'visible'
  const clip = (cs.clip || '').replace(/\s+/g, '')
  // `clip` only applies to an absolutely positioned box.
  const zeroRect = /^(absolute|fixed)$/.test(cs.position || '') && /^rect\((0(px)?,?){4}\)$/.test(clip)
  const inset = /^inset\((50%|[5-9]\d(\.\d+)?%|100%)/.test((cs.clipPath || '').trim())
  return { x: clips(cs.overflowX), y: clips(cs.overflowY), empty: zeroRect || inset }
}

/** The overlap of two clips; `null` is "no clip", so it gives way to the other. */
export function intersectClip(a: Clip, b: Clip): Clip {
  if (!a) return b
  if (!b) return a
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) }
}

/** The share of `r`'s area inside `clip`, 0–1. */
export function visibleFraction(r: Rect, clip: Clip): number {
  if (!clip) return 1
  if (!(r.w > 0 && r.h > 0)) return 0
  const i = intersectClip(r, clip)!
  return (i.w * i.h) / (r.w * r.h)
}

/**
 * A word must be at least this much visible to be exported as text. Half, so a
 * `truncate`d line keeps the words a reader sees and loses the ones hidden
 * past the ellipsis, and so a `sr-only` label — a 1 px box with a word laid
 * out beyond it — is never a text box in a slide that nobody could see in the
 * design.
 */
export const MIN_VISIBLE_FRACTION = 0.5

/** Mirrors the kit's `MOCKY_DOC_TOLERANCE`: sub-pixel rounding is not overflow. */
const OVERFLOW_TOLERANCE = 2

/**
 * The pages in reading order: by the index the kit wrote on each (`PAGE_ATTR`),
 * document order breaking ties and standing in for a missing index.
 */
export function orderPages<T extends { getAttribute(name: string): string | null }>(els: readonly T[]): T[] {
  return els
    .map((el, i) => {
      const n = parseInt(el.getAttribute(PAGE_ATTR) ?? '', 10)
      return { el, key: Number.isFinite(n) ? n : i, i }
    })
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .map((x) => x.el)
}

export function snapshotPage(
  win: Window,
  page: Element,
  index: number,
  width: number,
  height: number,
  tilted: (el: Element | null) => boolean = makeTiltTest(win, page),
): PageSnapshot {
  const doc = page.ownerDocument
  const box = page.getBoundingClientRect()
  const origin = { x: box.left, y: box.top }
  const styleOf = (el: Element) => win.getComputedStyle(el)

  // ── overflow, by the page kit's definition ───────────────────────────────
  // Only glyphs and fields count. A flyer's blobs and stripes are MEANT to
  // bleed off the edge and the page clips them, so `scrollHeight` — which
  // counts every absolutely placed shape — warned "cut off" on nearly every
  // flyer while the canvas, reading the kit's own report, said nothing.
  let overflow = false
  const crosses = (r: Rect) =>
    r.w > 0 &&
    r.h > 0 &&
    (r.x < -OVERFLOW_TOLERANCE ||
      r.y < -OVERFLOW_TOLERANCE ||
      r.x + r.w > width + OVERFLOW_TOLERANCE ||
      r.y + r.h > height + OVERFLOW_TOLERANCE)
  const decorative = new Map<Element, boolean>()
  const isDecorative = (el: Element | null): boolean => {
    if (!el || el === page) return false
    const hit = decorative.get(el)
    if (hit !== undefined) return hit
    const v = el.getAttribute('aria-hidden') === 'true' || isDecorative(el.parentElement)
    decorative.set(el, v)
    return v
  }
  let tiltedWords = 0

  // ── effective opacity, element by element up to the page ────────────────
  const opacity = new Map<Element, number>()
  const opacityOf = (el: Element | null): number => {
    if (!el || el === page.parentElement) return 1
    const hit = opacity.get(el)
    if (hit !== undefined) return hit
    const o = parseFloat(styleOf(el).opacity)
    const own = Number.isFinite(o) ? o : 1
    const v = own * (el === page ? 1 : opacityOf(el.parentElement))
    opacity.set(el, v)
    return v
  }

  // ── what each element's content is clipped to ───────────────────────────
  // Visually hidden text (`sr-only`, a word past an `overflow-hidden` edge) is
  // still in the DOM and still has rects; exported, it became a text box in a
  // slide and a searchable line in a PDF that the design never showed. The
  // clip follows the CONTAINING BLOCK for a positioned box: an absolute badge
  // inside a static `overflow-hidden` wrapper escapes it, exactly as it is drawn.
  const innerClip = new Map<Element, Clip>()
  const containingBlock = (el: Element): Element | null => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (p === page) return p
      const cs = styleOf(p)
      if (cs.position !== 'static' || (cs.transform && cs.transform !== 'none')) return p
    }
    return null
  }
  const outerOf = (el: Element): Clip => {
    const pos = styleOf(el).position
    if (pos === 'fixed') return null
    const from = pos === 'absolute' ? containingBlock(el) : el.parentElement
    return from ? contentClip(from) : null
  }
  const contentClip = (el: Element): Clip => {
    // The page's own edge is `onPage`'s business: a word half off the paper is
    // judged by its centre, as before. Every element asked about is inside the
    // page: a host, its parents, or a containing block, which stops at the page.
    if (el === page) return null
    const hit = innerClip.get(el)
    if (hit !== undefined) return hit
    const cs = styleOf(el)
    const flags = clipsByStyle(cs)
    let own: Clip = null
    if (flags.empty) own = { x: 0, y: 0, w: 0, h: 0 }
    else if (flags.x || flags.y) {
      const r = rel(el.getBoundingClientRect(), origin)
      own = {
        x: flags.x ? r.x : -UNBOUNDED,
        y: flags.y ? r.y : -UNBOUNDED,
        w: flags.x ? r.w : 2 * UNBOUNDED,
        h: flags.y ? r.h : 2 * UNBOUNDED,
      }
    }
    const v = intersectClip(outerOf(el), own)
    innerClip.set(el, v)
    return v
  }

  // ── the block each run of text is laid out in ────────────────────────────
  const blockIndex = new Map<Element, number>()
  const infos: BlockInfo[] = []
  const blockOf = (host: Element): { block: number; underline: boolean } => {
    let el: Element | null = host
    let underline = false
    while (el) {
      const cs = styleOf(el)
      // text-decoration is not inherited but is PAINTED on descendants: a link
      // with `underline` around a <span> draws the span's text underlined.
      if ((cs.textDecorationLine || cs.textDecoration || '').includes('underline')) underline = true
      const d = cs.display
      if (el === page || (!d.startsWith('inline') && d !== 'contents')) break
      el = el.parentElement
    }
    const blockEl = el ?? page
    let i = blockIndex.get(blockEl)
    if (i === undefined) {
      const cs = styleOf(blockEl)
      i = infos.length
      infos.push({
        align: alignOf(cs.textAlign, cs.direction),
        lineHeight: cs.lineHeight === 'normal' ? null : px(cs.lineHeight) || null,
      })
      blockIndex.set(blockEl, i)
    }
    return { block: i, underline }
  }

  // ── words ─────────────────────────────────────────────────────────────────
  const words: Word[] = []
  const walker = doc.createTreeWalker(page, 4 /* NodeFilter.SHOW_TEXT */)
  const range = doc.createRange()
  let spaceBefore = false
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const host = node.parentElement
    const data = node.data
    if (!host || !data) continue
    if (!/\S/.test(data)) {
      spaceBefore = true
      continue
    }
    if (host.closest(SKIP_TEXT_IN)) continue
    const cs = styleOf(host)
    if (cs.visibility !== 'visible' || cs.display === 'none') continue
    const alpha = opacityOf(host)
    if (alpha <= 0.01) continue
    const { block, underline } = blockOf(host)
    const color = parseCssColor(cs.color)
    const style = {
      fontSize: px(cs.fontSize) || 16,
      fontWeight: parseInt(cs.fontWeight, 10) || (cs.fontWeight === 'bold' ? 700 : 400),
      italic: cs.fontStyle !== 'normal',
      underline,
      color: { ...color, a: color.a * alpha },
      fontFamily: cs.fontFamily,
      letterSpacing: cs.letterSpacing === 'normal' ? 0 : px(cs.letterSpacing),
    }
    const re = /\S+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(data))) {
      const space = m.index > 0 ? /\s/.test(data[m.index - 1]) : spaceBefore
      range.setStart(node, m.index)
      range.setEnd(node, m.index + m[0].length)
      const clip = contentClip(host)
      const rects = Array.from(range.getClientRects())
        .map((r) => rel(r, origin))
        .filter((r) => visibleFraction(r, clip) >= MIN_VISIBLE_FRACTION)
      if (rects.length === 0) continue
      if (!overflow && !isDecorative(host) && rects.some(crosses)) overflow = true
      // Left in the picture (render.ts keeps its ink): a box could only draw it straight.
      if (tilted(host)) {
        tiltedWords++
        continue
      }
      const text = applyTextTransform(m[0], cs.textTransform)
      splitAcrossRects(text, rects).forEach((piece, k) => {
        if (!onPage(piece.rect, width, height)) return
        words.push({ text: piece.text, rect: piece.rect, space: k === 0 ? space : false, block, style })
      })
    }
    spaceBefore = /\s$/.test(data)
  }
  range.detach?.()

  // ── fields ────────────────────────────────────────────────────────────────
  const fields: FieldBox[] = []
  page.querySelectorAll(`[${FIELD_ATTR}]`).forEach((el) => {
    const rect = rel(el.getBoundingClientRect(), origin)
    if (crosses(rect)) overflow = true
    if (!onPage(rect, width, height)) return
    const control = el.matches(CONTROL) ? el : el.querySelector(CONTROL)
    const type = inferFieldType(el, control)
    const c = control as
      | (Element & { value?: string; checked?: boolean; options?: ArrayLike<{ text: string; value?: string; selected: boolean }> })
      | null
    const cs = styleOf(control ?? el)
    // An option whose value is EMPTY is a prompt, not an answer — the kit's
    // `<Field type="select" placeholder>` writes one and selects it. Listed as a
    // choice, the PDF offered "Choisissez…" as an answer, pre-selected it, and a
    // form sent back untouched carried it as the value.
    const all = c?.options ? Array.from(c.options) : []
    const prompt = all.find((o) => o.value === '')
    const choices = all.filter((o) => o !== prompt)
    const options = choices.map((o) => o.text.trim()).filter(Boolean)
    const selected = choices.find((o) => o.selected)?.text.trim() ?? ''
    const value = type === 'select' ? selected : type === 'checkbox' ? '' : c && typeof c.value === 'string' ? c.value : ''
    const placeholder =
      (prompt ? prompt.text.trim() : '') ||
      control?.getAttribute('placeholder') ||
      el.getAttribute('placeholder') ||
      (control ? '' : (el.textContent || '').replace(/\s+/g, ' ').trim())
    fields.push({
      name: el.getAttribute(FIELD_ATTR) || '',
      type,
      rect,
      value,
      placeholder,
      checked: !!c?.checked,
      options,
      fontSize: px(cs.fontSize) || 16,
      color: parseCssColor(cs.color),
      align: alignOf(cs.textAlign, cs.direction),
      paddingLeft: px(cs.paddingLeft),
    })
  })

  // ── links ─────────────────────────────────────────────────────────────────
  const links: LinkBox[] = []
  page.querySelectorAll('a[href]').forEach((a) => {
    // The AUTHORED value, never the `.href` property: a srcdoc frame inherits
    // Mocky's own base URL, so `href="#"` — what a generated call to action
    // almost always carries — resolved to `http://<this server>/…#` and became a
    // clickable link to a private address in a document meant to be shared. And
    // inside an SVG `.href` is an object, which made the whole PDF throw.
    const href = a.getAttribute('href') || ''
    for (const r of Array.from(a.getClientRects())) {
      const rect = rel(r, origin)
      if (onPage(rect, width, height)) links.push({ href, rect })
    }
  })

  const lines = groupLines(words)
  return { index, width, height, lines, blocks: groupBlocks(lines, infos), fields, links, overflow, tilted: tiltedWords }
}
