import type { PageFormat } from '../pageFormats'
import { DEFAULT_PAGE_FORMAT, getPageFormat } from '../pageFormats'
import type { Screen } from '../project'
import { planDecomposition } from './decompose'
import { FRAME_ATTR, backgroundUrl } from './frames'
import { capsForScreen } from './index'
import { parseCssColor } from './lines'
import { makeClipper, makeTiltTest, snapshotPage } from './measure'
import { SLIDES_SCALE } from './raster'
import { externalPictures, openSettledDocument } from './render'
import type { Rect } from './types'

/**
 * "Contrôler avant d'exporter": the document opened the way the export reads
 * it (`openSettledDocument`, the same frame `measureFit` measures) and asked
 * the questions a print shop or a Canva import asks of the FILE, before there
 * is one.
 *
 * The audit (SEO / accessibility) reads the code; the export notices arrive
 * after the file is made, one sentence per problem it met. Neither says that a
 * photo printed at A3 has 90 dpi, that a phone number sits 1 mm from the cut,
 * that the background stops at the trim of a PDF that has no bleed, or that a
 * badge will reach Canva as a picture. Those are facts of the rendered page, so
 * they are measured on it, and nothing is asked of a model.
 *
 * The walk only READS: it collects plain numbers per page (`PageFacts`) and
 * `preflightChecks` turns them into the report. That split is the whole test
 * strategy — this environment has no DOM, and every threshold lives on the
 * pure side, where a test can reach it.
 *
 * What it does NOT do, said in the report rather than implied: it does not
 * decode a QR code (no decoder here, and `BarcodeDetector` is absent from the
 * desktop browsers that matter), so a QR is checked for its printed size and
 * for being a real picture rather than the placeholder box the generation
 * prompt asks for.
 */

/** CSS pixels per millimetre: a CSS pixel is 1/96 in. */
export const PX_PER_MM = 96 / 25.4

/** The safe zone inside the trim of a printed page: nothing that must be read closer than this. */
export const SAFE_MM = 3

/**
 * The bands of a story that Instagram covers with its own interface (the
 * progress bar and the account at the top, the reply field at the bottom), in
 * the format's own pixels — 250 of 1920, the figure the platform publishes.
 */
export const STORY_BAND_PX = 250

/** A printed QR code smaller than this is a gamble for a phone camera at arm's length. */
export const QR_MIN_MM = 20

/** On a screen, a QR code narrower than this share of the page's short side. */
export const QR_MIN_SCREEN_SHARE = 0.12

/** Smaller than this on both sides, a picture is an icon or a dot: its resolution is nobody's concern. */
export const PICTURE_MIN_PX = 16

/**
 * Picture pixels per CSS pixel: what a photo needs (`good`) and the point under
 * which it is visibly soft (`floor`), by the kind of page.
 *
 * Paper: 150 dpi is the floor every print shop quotes, 220 what reads sharp at
 * reading distance (the PDF is drawn at 500, so the page never limits it). A
 * post: the PNG IS the post at 1× (`rasterScale`), so a picture with fewer
 * pixels than its box is enlarged, and under three quarters it shows. A slide:
 * projected at 1.5× (`SLIDES_SCALE`).
 */
export function pictureNeeds(kind: PageFormat['kind']): { good: number; floor: number } {
  if (kind === 'print') return { good: 220 / 96, floor: 150 / 96 }
  if (kind === 'slides') return { good: SLIDES_SCALE, floor: 1 }
  return { good: 1, floor: 0.75 }
}

export type PictureFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'

/**
 * Picture pixels per CSS pixel where the picture is drawn, on its worse axis.
 *
 * `cover` is the case that matters: the picture is scaled until it fills the
 * box on BOTH axes, so its density is set by the axis it is stretched most on —
 * a 1200 × 800 photo covering a square 800-px box has 1 pixel per CSS pixel,
 * not 1.5. `fill` distorts, and is as soft as its worse axis. Null when either
 * size is unknown.
 */
export function pictureDensity(natural: { w: number; h: number }, box: { w: number; h: number }, fit: PictureFit): number | null {
  if (!(natural.w > 0 && natural.h > 0 && box.w > 0 && box.h > 0)) return null
  const sx = box.w / natural.w
  const sy = box.h / natural.h
  const scale =
    fit === 'contain' ? Math.min(sx, sy) : fit === 'none' ? 1 : fit === 'scale-down' ? Math.min(1, sx, sy) : Math.max(sx, sy)
  return 1 / scale
}

/** `object-fit`, or a `background-size` read as one. Null for a size this check does not model. */
export function fitOf(value: string | null | undefined, background = false): PictureFit | null {
  const v = (value || '').trim()
  if (v === 'cover' || v === 'contain') return v
  if (!background) return v === 'none' || v === 'scale-down' ? v : 'fill'
  return v === '' || v === 'auto' || v === 'auto auto' ? 'none' : null
}

/** Does a name, an alt or an address speak of a QR code? */
export function namesQr(s: string | null | undefined): boolean {
  return /(^|[^a-z0-9])qr(?:[\s_-]?code)?([^a-z0-9]|$)|qrcode/i.test(s || '')
}

export type Edge = 'top' | 'right' | 'bottom' | 'left'
const EDGES: Edge[] = ['top', 'right', 'bottom', 'left']

/** The page edges a painted box reaches (after its clip), within half a pixel. */
export function edgesReached(r: Rect, width: number, height: number): Edge[] {
  const x0 = Math.max(0, r.x)
  const y0 = Math.max(0, r.y)
  const x1 = Math.min(width, r.x + r.w)
  const y1 = Math.min(height, r.y + r.h)
  if (x1 - x0 <= 0 || y1 - y0 <= 0) return []
  const out: Edge[] = []
  if (y0 <= 0.5) out.push('top')
  if (x1 >= width - 0.5) out.push('right')
  if (y1 >= height - 0.5) out.push('bottom')
  if (x0 <= 0.5) out.push('left')
  return out
}

/** The zone a line must stay out of, in page px, or null where the format has none. */
export function unsafeBands(format: Pick<PageFormat, 'id' | 'kind' | 'h'>): { top: number; right: number; bottom: number; left: number } | null {
  if (format.kind === 'print') {
    const m = SAFE_MM * PX_PER_MM
    return { top: m, right: m, bottom: m, left: m }
  }
  if (format.id === 'social-story') {
    const b = (STORY_BAND_PX * format.h) / 1920
    return { top: b, right: 0, bottom: b, left: 0 }
  }
  return null
}

/** Is a line of text (already ON the page) inside an unsafe band? */
export function inUnsafeBand(r: Rect, width: number, height: number, bands: NonNullable<ReturnType<typeof unsafeBands>>): boolean {
  return (
    (bands.top > 0 && r.y < bands.top) ||
    (bands.left > 0 && r.x < bands.left) ||
    (bands.right > 0 && r.x + r.w > width - bands.right) ||
    (bands.bottom > 0 && r.y + r.h > height - bands.bottom)
  )
}

/** A few words of a text, for a report line. */
export function snippet(text: string, max = 40): string {
  const s = text.replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

// ── what one page says, as numbers ──────────────────────────────────────────

export interface PictureFact {
  /** Its alt text, or empty: the report names it by its place instead. */
  label: string
  /** 1-based, among the measured pictures of its page. */
  nth: number
  density: number
}

export interface QrFact {
  label: string
  /** The short side as drawn, in page px. */
  side: number
}

export interface PageFacts {
  /** 1-based. */
  page: number
  pictures: PictureFact[]
  /** Hosts of pictures loaded from another site: absent from every file. */
  external: string[]
  /** Lines of text inside the safe zone (or a story's covered bands). */
  nearEdge: string[]
  /** Edges a coloured background or a picture runs to. */
  edges: Edge[]
  /** Text past the page's edge — the export's own overflow. */
  overflow: string[]
  /** Text cut by its own box: hidden past an `overflow-hidden`, an ellipsis, a line clamp. */
  clipped: string[]
  qrCodes: QrFact[]
  /** Boxes labelled "QR" with no picture in them: the generation's placeholder. */
  qrPlaceholders: number
  /** Pieces the .pptx for Canva carries as pictures because no native shape draws them. Null: not measured. */
  flattened: number | null
  /** Words drawn rotated or scaled: kept in the picture, not editable, in both .pptx. */
  tilted: number
}

// ── the report ──────────────────────────────────────────────────────────────

export type CheckId = 'pictures' | 'margins' | 'bleed' | 'text' | 'qr' | 'canva'
export const CHECK_IDS: CheckId[] = ['pictures', 'margins', 'bleed', 'text', 'qr', 'canva']

export type NoteCode =
  | 'lowRes'
  | 'softRes'
  | 'external'
  | 'nearEdge'
  | 'storyBands'
  | 'bleed'
  | 'overflow'
  | 'clipped'
  | 'qrPlaceholder'
  | 'qrSmall'
  | 'qrOk'
  | 'flattened'
  | 'tilted'

export interface PreflightNote {
  code: NoteCode
  level: 'info' | 'warn'
  pages: number[]
  /** What the note is about, already worded: words of the text, a picture and its resolution, a host. */
  items: string[]
  /** A count, where the note is one (pieces, placeholders). */
  n?: number
}

export interface CheckResult {
  id: CheckId
  /** `na`: the check means nothing for this format (bleed on a post). */
  status: 'ok' | 'info' | 'warn' | 'na'
  notes: PreflightNote[]
}

export interface PreflightReport {
  /** The code the report was made from: a report about another version of the screen is stale. */
  code: string
  pages: number
  checks: CheckResult[]
}

const MAX_ITEMS = 6

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)]
}

function note(code: NoteCode, level: PreflightNote['level'], facts: PageFacts[], pick: (f: PageFacts) => string[], n?: number): PreflightNote | null {
  const hit = facts.filter((f) => pick(f).length > 0)
  if (!hit.length) return null
  return {
    code,
    level,
    pages: hit.map((f) => f.page),
    items: uniq(hit.flatMap(pick)).slice(0, MAX_ITEMS),
    ...(n !== undefined ? { n } : {}),
  }
}

function result(id: CheckId, notes: (PreflightNote | null)[], na = false): CheckResult {
  const kept = notes.filter((x): x is PreflightNote => !!x)
  if (na) return { id, status: 'na', notes: [] }
  const status = kept.some((x) => x.level === 'warn') ? 'warn' : kept.some((x) => x.level === 'info') ? 'info' : 'ok'
  return { id, status, notes: kept }
}

/**
 * The measured pages, judged. Every threshold is here: the walk below only
 * reports what the page IS.
 *
 * `unnamed(nth)` words a picture with no alt text ("image 2"), in the
 * interface's language.
 */
export function preflightChecks(
  facts: PageFacts[],
  format: Pick<PageFormat, 'id' | 'kind' | 'w' | 'h'>,
  unnamed: (nth: number) => string = (n) => `#${n}`,
): CheckResult[] {
  const print = format.kind === 'print'
  const needs = pictureNeeds(format.kind)
  const named = (p: PictureFact) => p.label || unnamed(p.nth)
  // Print speaks dpi, the unit a print shop asks in; a screen speaks the share
  // of the pixels the file needs, because "72 dpi" means nothing for a post.
  const worded = (p: PictureFact) =>
    print ? `${named(p)} (${Math.round(p.density * 96)} dpi)` : `${named(p)} (${Math.round((p.density / needs.good) * 100)} %)`

  const pictures = result('pictures', [
    note('lowRes', 'warn', facts, (f) => f.pictures.filter((p) => p.density < needs.floor).map(worded)),
    note('softRes', 'info', facts, (f) => f.pictures.filter((p) => p.density >= needs.floor && p.density < needs.good).map(worded)),
    note('external', 'warn', facts, (f) => f.external),
  ])

  const bands = unsafeBands(format)
  const margins = result('margins', [note(print ? 'nearEdge' : 'storyBands', 'warn', facts, (f) => f.nearEdge)], !bands)

  // Information, not a fault: a design that runs to the edge is a design. What
  // the person needs is to know the PDF stops at the trim, before the printer
  // asks — or before a white hairline comes back from the guillotine.
  const bleed = result('bleed', [note('bleed', 'info', facts, (f) => f.edges)], !print)

  const text = result('text', [note('overflow', 'warn', facts, (f) => f.overflow), note('clipped', 'warn', facts, (f) => f.clipped)])

  const qrMin = print ? QR_MIN_MM * PX_PER_MM : QR_MIN_SCREEN_SHARE * Math.min(format.w, format.h)
  const qrWord = (q: QrFact) => (print ? `${q.label} (${(q.side / PX_PER_MM).toFixed(0)} mm)` : `${q.label} (${Math.round(q.side)} px)`)
  const placeholders = facts.reduce((s, f) => s + f.qrPlaceholders, 0)
  const anyQr = placeholders > 0 || facts.some((f) => f.qrCodes.length > 0)
  const qr = result(
    'qr',
    [
      note('qrPlaceholder', 'warn', facts, (f) => (f.qrPlaceholders ? [String(f.page)] : []), placeholders),
      note('qrSmall', 'warn', facts, (f) => f.qrCodes.filter((q) => q.side < qrMin).map(qrWord)),
      note('qrOk', 'info', facts, (f) => f.qrCodes.filter((q) => q.side >= qrMin).map(qrWord)),
    ],
    !anyQr,
  )

  const measured = facts.filter((f) => f.flattened !== null)
  const pieces = measured.reduce((s, f) => s + (f.flattened ?? 0), 0)
  const canva = result(
    'canva',
    [
      note('flattened', 'info', measured, (f) => (f.flattened ? [String(f.page)] : []), pieces),
      note('tilted', 'warn', facts, (f) => (f.tilted ? [String(f.page)] : []), facts.reduce((s, f) => s + f.tilted, 0)),
    ],
    measured.length === 0 && !facts.some((f) => f.tilted),
  )

  // A QR placeholder's note lists pages, not items: the count says it all.
  for (const c of [qr, canva]) for (const x of c.notes) if (x.code !== 'qrSmall' && x.code !== 'qrOk') x.items = []

  return [pictures, margins, bleed, text, qr, canva]
}

// ── the walk ────────────────────────────────────────────────────────────────

const SKIP_TEXT_IN = 'script,style,noscript,template,textarea,select,option,svg'
const PAINTERS = 'img,svg,video,canvas,picture'

const rel = (r: DOMRectReadOnly, o: { x: number; y: number }): Rect => ({ x: r.left - o.x, y: r.top - o.y, w: r.width, h: r.height })

/** Is a colour paint, rather than paper? Transparent and near-white are paper. */
function paints(color: string): boolean {
  if (!/^\s*(#|rgba?\()/i.test(color)) return /^\s*(oklch|oklab|lab|lch|hsl|color)\(/i.test(color)
  const c = parseCssColor(color)
  return c.a > 0.05 && !(c.r >= 245 && c.g >= 245 && c.b >= 245)
}

function isVector(src: string): boolean {
  return /^data:image\/svg/i.test(src) || /\.svg(?:[?#]|$)/i.test(src)
}

/** The natural size of a CSS background picture, decoded in the frame's own window (already in its cache). */
async function naturalSize(win: Window, url: string): Promise<{ w: number; h: number } | null> {
  try {
    const Img = (win as unknown as { Image: typeof Image }).Image
    const im = new Img()
    im.src = url
    await Promise.race([im.decode(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))])
    return im.naturalWidth > 0 ? { w: im.naturalWidth, h: im.naturalHeight } : null
  } catch {
    return null
  }
}

/** A 24 × 24 icon (the generated screens' `Icon` set) is a drawing of a QR code, never one. */
function isIcon(el: Element): boolean {
  return el.tagName.toLowerCase() === 'svg' && (el.getAttribute('viewBox') || '').trim() === '0 0 24 24'
}

/** The words past the edge; an overflow with none named (a field) still counts, as an ellipsis. */
function overflowWords(outside: { text: string }[]): string[] {
  const words = outside.map((o) => snippet(o.text || '')).filter(Boolean)
  return words.length ? words : ['…']
}

export async function inspectPage(win: Window, page: Element, index: number, format: PageFormat): Promise<PageFacts> {
  const W = format.w
  const H = format.h
  const box = page.getBoundingClientRect()
  const origin = { x: box.left, y: box.top }
  const styleOf = (el: Element) => win.getComputedStyle(el)
  const tilt = makeTiltTest(win, page)
  const snap = snapshotPage(win, page, index, W, H, tilt)
  const { contentClip, outerOf } = makeClipper(win, page, origin)
  const visible = (el: Element) => {
    const cs = styleOf(el)
    return cs.display !== 'none' && cs.visibility === 'visible' && parseFloat(cs.opacity || '1') > 0.01
  }
  const labelOf = (el: Element) =>
    snippet(el.getAttribute('alt') || el.getAttribute('aria-label') || el.getAttribute('title') || '', 32)

  // ── pictures ──
  const pictures: PictureFact[] = []
  const qrCodes: QrFact[] = []
  let nth = 0
  for (const el of Array.from(page.querySelectorAll('img'))) {
    const img = el as HTMLImageElement
    if (!visible(img)) continue
    const r = rel(img.getBoundingClientRect(), origin)
    if (r.w < PICTURE_MIN_PX && r.h < PICTURE_MIN_PX) continue
    const src = img.currentSrc || img.getAttribute('src') || ''
    const label = labelOf(img)
    if (namesQr(label) || namesQr(src.replace(/^.*\//, ''))) qrCodes.push({ label: label || 'QR', side: Math.min(r.w, r.h) })
    if (isVector(src) || !img.complete || !img.naturalWidth) continue
    const fit = fitOf(styleOf(img).objectFit)
    const density = fit ? pictureDensity({ w: img.naturalWidth, h: img.naturalHeight }, r, fit) : null
    if (density !== null) pictures.push({ label, nth: ++nth, density })
  }
  for (const el of Array.from(page.querySelectorAll('*'))) {
    const cs = styleOf(el)
    const url = backgroundUrl(cs.backgroundImage)
    if (!url || isVector(url) || !visible(el)) continue
    const r = rel(el.getBoundingClientRect(), origin)
    if (r.w < PICTURE_MIN_PX && r.h < PICTURE_MIN_PX) continue
    const fit = fitOf(cs.backgroundSize, true)
    const natural = fit ? await naturalSize(win, url) : null
    const density = natural && fit ? pictureDensity(natural, r, fit) : null
    if (density !== null) pictures.push({ label: labelOf(el), nth: ++nth, density })
  }
  for (const el of Array.from(page.querySelectorAll('svg,canvas'))) {
    if (el.parentElement?.closest('svg') || isIcon(el) || !visible(el)) continue
    const label = labelOf(el)
    if (!namesQr(label) && !namesQr(el.getAttribute('class'))) continue
    const r = rel(el.getBoundingClientRect(), origin)
    qrCodes.push({ label: label || 'QR', side: Math.min(r.w, r.h) })
  }

  // ── QR placeholders: a square box saying "QR" with no picture in it ──
  const candidates: Element[] = []
  for (const el of Array.from(page.querySelectorAll('div,span,figure,p,section,aside'))) {
    const text = (el.textContent || '').trim()
    if (!text || text.length > 60 || !namesQr(text) || !visible(el)) continue
    const r = el.getBoundingClientRect()
    const ratio = r.width / Math.max(1, r.height)
    if (Math.min(r.width, r.height) < 24 || ratio < 0.75 || ratio > 1.34) continue
    const real = Array.from(el.querySelectorAll(`img,canvas,svg,[${FRAME_ATTR}]`)).some((x) => !isIcon(x) && !x.parentElement?.closest('svg'))
    if (!real) candidates.push(el)
  }
  const qrPlaceholders = candidates.filter((el) => !candidates.some((o) => o !== el && el.contains(o))).length

  // ── text inside the safe zone ──
  const bands = unsafeBands(format)
  const crossesPage = (r: Rect) => r.x < -1 || r.y < -1 || r.x + r.w > W + 1 || r.y + r.h > H + 1
  const nearEdge = bands ? snap.lines.filter((l) => !crossesPage(l.rect) && inUnsafeBand(l.rect, W, H, bands)).map((l) => snippet(l.text)) : []

  // ── what runs to the edge (paper only: a post has no guillotine) ──
  const edges = new Set<Edge>()
  if (format.kind === 'print') {
    const pageCs = styleOf(page)
    if (paints(pageCs.backgroundColor) || backgroundUrl(pageCs.backgroundImage)) EDGES.forEach((e) => edges.add(e))
    for (const el of Array.from(page.querySelectorAll('*'))) {
      if (edges.size === 4) break
      if (el.parentElement?.closest('svg')) continue
      const cs = styleOf(el)
      const drawn = el.matches(PAINTERS) || paints(cs.backgroundColor) || /gradient|url\(/.test(cs.backgroundImage || '')
      if (!drawn || !visible(el)) continue
      let r = rel(el.getBoundingClientRect(), origin)
      const clip = outerOf(el)
      if (clip) {
        const x0 = Math.max(r.x, clip.x)
        const y0 = Math.max(r.y, clip.y)
        r = { x: x0, y: y0, w: Math.min(r.x + r.w, clip.x + clip.w) - x0, h: Math.min(r.y + r.h, clip.y + clip.h) - y0 }
      }
      edgesReached(r, W, H).forEach((e) => edges.add(e))
    }
  }

  // ── text its own box cuts ──
  const clippedHosts = new Set<Element>()
  const doc = page.ownerDocument
  const walker = doc.createTreeWalker(page, 4 /* SHOW_TEXT */)
  const range = doc.createRange()
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const host = node.parentElement
    if (!host || !/\S/.test(node.data) || clippedHosts.has(host)) continue
    if (host.closest(SKIP_TEXT_IN) || host.closest('[aria-hidden="true"]') || !visible(host)) continue
    const clip = contentClip(host)
    // No clip, or the empty one `sr-only` uses on purpose.
    if (!clip || clip.w <= 1 || clip.h <= 1) continue
    range.selectNodeContents(node)
    const cut = Array.from(range.getClientRects()).some((cr) => {
      const r = rel(cr, origin)
      return r.w > 0 && r.h > 0 && (r.x < clip.x - 1.5 || r.y < clip.y - 1.5 || r.x + r.w > clip.x + clip.w + 1.5 || r.y + r.h > clip.y + clip.h + 1.5)
    })
    if (cut) clippedHosts.add(host)
  }
  for (const el of Array.from(page.querySelectorAll<HTMLElement>('*'))) {
    if (clippedHosts.has(el) || !el.textContent?.trim() || !visible(el)) continue
    const cs = styleOf(el)
    const clamp = cs.getPropertyValue('-webkit-line-clamp')
    if ((cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) || (clamp && clamp !== 'none' && el.scrollHeight > el.clientHeight + 1)) clippedHosts.add(el)
  }
  // A host inside another one that was cut says the same thing twice.
  const clipped = [...clippedHosts]
    .filter((el) => ![...clippedHosts].some((o) => o !== el && o.contains(el)))
    .map((el) => snippet(el.textContent || ''))

  // ── what Canva receives as a picture ──
  let flattened: number | null = null
  try {
    const plan = planDecomposition(win, page, { tilted: tilt, frameRoots: Array.from(page.querySelectorAll(`[${FRAME_ATTR}]`)), skip: new Set() })
    flattened = plan.jobs.filter((j, i) => j.role === 'decor' && i !== plan.pageJob).length
  } catch (err) {
    console.warn('mocky: preflight could not plan the Canva file —', err)
  }

  return {
    page: index + 1,
    pictures,
    external: uniq(externalPictures(page)),
    nearEdge: uniq(nearEdge),
    edges: EDGES.filter((e) => edges.has(e)),
    overflow: snap.overflow ? overflowWords(snap.outside ?? []) : [],
    clipped,
    qrCodes,
    qrPlaceholders,
    flattened,
    tilted: snap.tilted ?? 0,
  }
}

export interface PreflightOptions {
  signal?: AbortSignal
  onProgress?: (page: number, total: number) => void
  unnamed?: (nth: number) => string
}

/** Render the document as the export does, and check it. Seconds, no model, no file. */
export async function runPreflight(screen: Pick<Screen, 'code' | 'page' | 'caps' | 'prompt'>, opts: PreflightOptions = {}): Promise<PreflightReport> {
  const format = getPageFormat(screen.page ?? DEFAULT_PAGE_FORMAT)
  const { frame, pages, close } = await openSettledDocument(screen.code, capsForScreen(screen), format, opts.signal)
  try {
    const facts: PageFacts[] = []
    for (let i = 0; i < pages.length; i++) {
      if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      opts.onProgress?.(i + 1, pages.length)
      facts.push(await inspectPage(frame.win, pages[i], i, format))
    }
    return { code: screen.code, pages: pages.length, checks: preflightChecks(facts, format, opts.unnamed) }
  } finally {
    close()
  }
}
