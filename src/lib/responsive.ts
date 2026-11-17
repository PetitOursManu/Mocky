import { PRESETS } from './presets'

/**
 * "Comparer les tailles": one screen shown at a phone's, a tablet's and a
 * desktop's width at once, what runs past the edge at each MEASURED, and one
 * correction for all three, measured again before it is kept.
 *
 * A generated screen is designed at one width — the frame it was made in — and
 * nobody sees it at the other two until a client opens it on their phone. The
 * model writes `w-[720px]` or a four-column grid with no breakpoint, and the
 * canvas, at 1440, shows nothing wrong. So the screen is rendered at the three
 * widths (the composer's own presets, `PRESETS`) and each frame measures itself:
 * the measurement has to run IN the frame that draws it, because the outlines
 * that show where the problem is are drawn there too (`pickMarks`), with the
 * same `cssPath` the measurement named the element by.
 *
 * Not the fit (lib/docExport/fit.ts): a document's page is fixed and its
 * content is spent vertically; here the page's WIDTH is the variable and the
 * answer is a breakpoint. Same discipline, though: the model is told numbers,
 * and its answer is rendered and measured again before it replaces anything.
 */

export type ResponsiveViewId = 'mobile' | 'tablet' | 'desktop'

export interface ResponsiveView {
  id: ResponsiveViewId
  w: number
  h: number
}

function preset(id: ResponsiveViewId): ResponsiveView {
  const p = PRESETS.find((x) => x.id === id)
  return { id, w: p?.w ?? 0, h: p?.h ?? 0 }
}

/** Narrowest first: the order the columns are drawn in and the model reads. */
export const RESPONSIVE_VIEWS: readonly ResponsiveView[] = [preset('mobile'), preset('tablet'), preset('desktop')]

export type OverflowKind =
  /** Content cut by the edge of the viewport: a reader sees half a word, or scrolls sideways to find it. */
  | 'outside'
  /** Content cut by the edge of a box of its own that hides what overflows. */
  | 'clipped'
  /** Something with no content of its own that makes the whole page scroll sideways. */
  | 'scroll'

export interface OverflowItem {
  /** `cssPath` in the frame: what `pickMarks` outlines. */
  selector: string
  tag: string
  kind: OverflowKind
  /** By how much, in the viewport's own CSS pixels. */
  px: number
  text: string
  cls: string
}

export interface ViewOverflow {
  /** How far the page scrolls sideways; 0 when it does not. */
  page: number
  items: OverflowItem[]
}

export type ResponsiveReport = Record<ResponsiveViewId, ViewOverflow>

/** Differences under this are rounding, not a correction that landed or failed. */
export const RESPONSIVE_NOISE_PX = 4
/** Per view: past a dozen, the list stops helping a person or a model. */
export const MAX_OVERFLOW_ITEMS = 12

/*
 * The measurement, run INSIDE the preview frame.
 *
 * It is shipped as its own source: Preview's frame script inlines
 * `measureOverflowIn.toString()`. So it must stay self-contained — no import,
 * no module constant, nothing but its parameters and the DOM — and it must not
 * contain a backtick, the frame script being a template literal. The tests
 * check both, and run it on a real layout in a browser.
 *
 * What it counts, and why each exclusion is there:
 * - CONTENT cut by an edge: a run of text, a picture, a control. Its extent is
 *   its own text nodes' (a Range), so a paragraph whose box fits but whose long
 *   word does not is caught, and a child's text is charged to the child.
 * - The edge is the viewport, narrowed by every ancestor that hides its
 *   overflow. One that SCROLLS (overflow-x auto/scroll) is a carousel and its
 *   content is meant to be beyond it: not counted.
 * - Only content cut PARTLY. A ticker's next item or a closed drawer lies
 *   wholly past an edge on purpose; half a word never is.
 * - Never a run that already ends in an ellipsis or a line clamp: that cut was
 *   designed. Never a box under 4 px: that is `sr-only`.
 * - The page's own sideways scroll, separately, with the outermost boxes that
 *   cause it — a decoration that bleeds has no content and still makes a phone
 *   scroll, unless <html> or <body> hides it.
 */
export function measureOverflowIn(doc: Document, win: Window, pathOf: (el: Element) => string): ViewOverflow {
  const de = doc.documentElement
  const body = doc.body
  const vw = de.clientWidth || win.innerWidth || 0
  const root = doc.getElementById('root') || body
  const MEDIA = { IMG: 1, VIDEO: 1, CANVAS: 1, svg: 1, SVG: 1, INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1, IFRAME: 1, PICTURE: 1 } as Record<string, number>
  const styleOf = (el: Element) => win.getComputedStyle(el)
  const clipsX = (el: Element) => {
    const o = styleOf(el).overflowX
    return o === 'hidden' || o === 'clip'
  }
  const scrollsX = (el: Element) => {
    const o = styleOf(el).overflowX
    return o === 'auto' || o === 'scroll'
  }
  // The ancestors whose overflow applies to `el`: an absolutely positioned box
  // escapes every hiding ancestor below its containing block, a fixed one all
  // of them — so a blob in a section that is not `relative` still makes the
  // page scroll, whatever the section hides.
  const boxesOver = (el: Element) => {
    const out: Element[] = []
    let mode = styleOf(el).position
    for (let a = el.parentElement; a && a !== body && a !== de; a = a.parentElement) {
      if (mode === 'fixed') break
      const ap = styleOf(a).position
      if (mode === 'absolute' && ap === 'static') continue
      out.push(a)
      mode = ap === 'absolute' || ap === 'fixed' ? ap : 'static'
    }
    return out
  }
  const short = (s: string, n: number) => {
    const t = (s || '').replace(/\s+/g, ' ').trim()
    return t.length > n ? t.slice(0, n - 1) + '…' : t
  }
  const classOf = (el: Element) => {
    const c = el.getAttribute('class') || ''
    return short(c, 200)
  }
  const found: OverflowItem[] = []
  const cut: Element[] = []
  const all = root.querySelectorAll('*')
  for (let i = 0; i < all.length; i++) {
    const el = all[i]
    const tag = el.tagName
    // Inside an <svg>, the drawing is the svg's business: a path past the
    // viewBox is clipped by the svg itself.
    if (tag.toLowerCase() !== 'svg' && el.closest('svg')) continue
    let covered = false
    for (let k = 0; k < cut.length; k++) if (cut[k].contains(el)) { covered = true; break }
    if (covered) continue
    const cs = styleOf(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue
    if (cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none')) continue
    const box = el.getBoundingClientRect()
    if (box.width < 1 || box.height < 1) continue

    let left = Infinity
    let right = -Infinity
    if (MEDIA[tag]) {
      left = box.left
      right = box.right
    } else {
      for (let n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType !== 3 || !(n.nodeValue || '').trim()) continue
        const range = doc.createRange()
        range.selectNodeContents(n)
        const rects = range.getClientRects()
        for (let q = 0; q < rects.length; q++) {
          if (rects[q].width < 0.5) continue
          if (rects[q].left < left) left = rects[q].left
          if (rects[q].right > right) right = rects[q].right
        }
      }
    }
    if (right < left) continue

    // The visible band: the viewport, narrowed by every ancestor that hides.
    let lo = 0
    let hi = vw
    let by: 'outside' | 'clipped' = 'outside'
    let scrolled = false
    let tiny = false
    const over0 = boxesOver(el)
    for (let k = 0; k < over0.length; k++) {
      const a = over0[k]
      if (scrollsX(a)) { scrolled = true; break }
      if (!clipsX(a)) continue
      const r = a.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) { tiny = true; break }
      if (r.left > lo) { lo = r.left; by = 'clipped' }
      if (r.right < hi) { hi = r.right; by = 'clipped' }
    }
    if (scrolled || tiny || hi - lo < 4) continue
    const over = Math.max(right - hi, lo - left)
    if (over <= 1) continue
    // Wholly beyond the band: placed there on purpose.
    if (left >= hi - 1 || right <= lo + 1) continue
    const text = MEDIA[tag] ? el.getAttribute('alt') || el.getAttribute('aria-label') || (el as HTMLElement).innerText || '' : el.textContent || ''
    found.push({ selector: pathOf(el), tag: tag.toLowerCase(), kind: by, px: Math.round(over), text: short(text, 80), cls: classOf(el) })
    cut.push(el)
  }

  const page = Math.max(0, Math.round(Math.max(de.scrollWidth, body ? body.scrollWidth : 0) - vw))
  const pageHides = clipsX(de) || (body ? clipsX(body) : false)
  if (page > 1 && !pageHides) {
    // The outermost boxes past the right edge, with no hiding ancestor between
    // them and the page: those are what makes it scroll.
    const wide: Element[] = []
    for (let i = 0; i < all.length && wide.length < 4; i++) {
      const el = all[i]
      if (el.tagName.toLowerCase() !== 'svg' && el.closest('svg')) continue
      let inside = false
      for (let k = 0; k < wide.length; k++) if (wide[k].contains(el)) { inside = true; break }
      if (inside) continue
      const box = el.getBoundingClientRect()
      if (box.width < 1 || box.height < 1 || box.right <= vw + 1) continue
      let held = false
      const over1 = boxesOver(el)
      for (let k = 0; k < over1.length; k++) {
        if (clipsX(over1[k]) || scrollsX(over1[k])) { held = true; break }
      }
      if (held) continue
      // Already named for its content: the page scroll is part of the same fix.
      let named = false
      for (let k = 0; k < cut.length; k++) if (cut[k] === el || el.contains(cut[k]) || cut[k].contains(el)) { named = true; break }
      wide.push(el)
      if (named) continue
      found.push({ selector: pathOf(el), tag: el.tagName.toLowerCase(), kind: 'scroll', px: Math.round(box.right - vw), text: short(el.textContent || '', 80), cls: classOf(el) })
    }
  }

  found.sort((a, b) => b.px - a.px)
  return { page: pageHides ? 0 : page, items: found.slice(0, 12) }
}

const KINDS: readonly OverflowKind[] = ['outside', 'clipped', 'scroll']

/** What a frame posted, as data: the frame runs code a model wrote. */
export function readViewOverflow(raw: unknown): ViewOverflow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { page?: unknown; items?: unknown }
  const page = typeof r.page === 'number' && Number.isFinite(r.page) ? Math.max(0, Math.round(r.page)) : 0
  if (!Array.isArray(r.items)) return null
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '')
  const items: OverflowItem[] = []
  for (const it of r.items.slice(0, MAX_OVERFLOW_ITEMS)) {
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const kind = KINDS.find((k) => k === o.kind)
    const selector = str(o.selector, 600)
    if (!kind || !selector || typeof o.px !== 'number' || !Number.isFinite(o.px)) continue
    items.push({ selector, tag: str(o.tag, 24), kind, px: Math.max(0, Math.round(o.px)), text: str(o.text, 80), cls: str(o.cls, 200) })
  }
  return { page, items }
}

/** One view's worst crossing, whichever way it crosses. */
export function viewExcessPx(v: ViewOverflow): number {
  return Math.max(v.page, ...v.items.map((i) => i.px), 0)
}

export function viewClear(v: ViewOverflow): boolean {
  return v.items.length === 0 && v.page <= 1
}

export function reportClear(r: ResponsiveReport): boolean {
  return RESPONSIVE_VIEWS.every((v) => viewClear(r[v.id]))
}

/** One number for the three: each view's items and sideways scroll, summed. */
export function totalOverflowPx(r: ResponsiveReport): number {
  return RESPONSIVE_VIEWS.reduce((sum, v) => sum + r[v.id].page + r[v.id].items.reduce((s, i) => s + i.px, 0), 0)
}

export type ResponsiveVerdict =
  /** Nothing crosses at any width any more. */
  | 'fits'
  /** Still something, but less, and at no width that was clear. Worth keeping. */
  | 'closer'
  /** No better — or worse somewhere. The original stays. */
  | 'rejected'

/**
 * Is the rewrite worth writing back? A width that was clear and is not any
 * more is a rejection however much the others improved: the phone was fixed by
 * breaking the desktop, which is the one outcome nobody would accept unseen.
 */
export function responsiveVerdict(before: ResponsiveReport, after: ResponsiveReport): ResponsiveVerdict {
  if (RESPONSIVE_VIEWS.some((v) => viewClear(before[v.id]) && !viewClear(after[v.id]))) return 'rejected'
  if (reportClear(after)) return 'fits'
  return totalOverflowPx(after) < totalOverflowPx(before) - RESPONSIVE_NOISE_PX ? 'closer' : 'rejected'
}

const VIEW_WORDS: Record<ResponsiveViewId, string> = { mobile: 'PHONE', tablet: 'TABLET', desktop: 'DESKTOP' }
const KIND_WORDS: Record<OverflowKind, string> = {
  outside: 'runs past the edge of the viewport',
  clipped: 'is cut by the edge of a box that hides its overflow',
  scroll: 'makes the page scroll sideways',
}

/**
 * The measurement, as the model will read it. The classes and the text are how
 * it finds the element in the source; a selector means nothing there, since it
 * counts rendered positions that `.map()` and conditionals shift.
 */
export function responsiveFindings(r: ResponsiveReport): string {
  const lines: string[] = []
  for (const v of RESPONSIVE_VIEWS) {
    const o = r[v.id]
    if (viewClear(o)) {
      lines.push(`${VIEW_WORDS[v.id]} (${v.w} px wide): nothing overflows. Keep it that way.`, '')
      continue
    }
    lines.push(`${VIEW_WORDS[v.id]} (${v.w} px wide):`)
    if (o.page > 1) lines.push(`- The page is ${o.page} px wider than the viewport and scrolls sideways.`)
    for (const it of o.items) {
      const what = [`<${it.tag}>`, it.cls ? `class="${it.cls}"` : '', it.text ? `"${it.text}"` : ''].filter(Boolean).join(' ')
      lines.push(`- ${what} ${KIND_WORDS[it.kind]} by ${it.px} px.`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

/** How many distinct problems a view shows: its items, or the bare scroll when nothing is named. */
export function overflowCount(v: ViewOverflow): number {
  return v.items.length || (v.page > 1 ? 1 : 0)
}
