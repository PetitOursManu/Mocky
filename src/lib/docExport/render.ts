import { openDocumentFrame, type DocumentFrame } from '../capture'
import type { Capability } from '../capabilities/types'
import { DOC_ATTR, FIELD_ATTR, PAGE_ATTR, docFrameHeight, type PageFormat } from '../pageFormats'
import { parseCssColor } from './lines'
import { makeTiltTest, orderPages, snapshotPage } from './measure'
import { rasterizeNative } from './nativeRaster'
import {
  INK_PROPS,
  JPEG_QUALITY,
  PAINT_PROPS,
  PIN_ATTR,
  PIN_PSEUDOS,
  clipTextInk,
  hideCss,
  needsColorNormalising,
  pseudoPinCss,
  rasterScale,
  replaceColorFunctions,
  rgbaFromBytes,
  type PinPseudo,
  type PseudoPin,
  type RasterPurpose,
} from './raster'
import { classifyNativeFailure, raceAbort } from './svgRaster'
import type { PageSnapshot, RenderedPage } from './types'

/**
 * A document screen, rendered offscreen and read back one page at a time.
 *
 * For each page: MEASURE it with its text in place (measure.ts), take the ink
 * out that the export will put back in its own form (raster.ts's `hideCss`),
 * RASTERISE it, encode it, and let the canvas go before the next page — a
 * ten-page A4 at 250 dpi is 60 MP of canvas, which no browser should be asked
 * to hold at once.
 *
 * Two rasterisers. The browser's own engine, through an SVG foreignObject
 * image (nativeRaster.ts), draws what the page really is; html2canvas, the
 * frame's own copy, is the fallback for a page the first could not draw or a
 * browser that will not let it be read back (Safari). Each carries its own
 * workarounds, and only the fallback needs html2canvas's.
 */

/** Something the export could not do perfectly, said rather than hidden (Q1's rule, here). */
export type RenderNotice =
  /** The screen has no page boxes: the whole document was exported as one page. */
  | { code: 'noPages' }
  /** Content taller than the page, clipped on paper. 1-based page numbers. */
  | { code: 'overflow'; pages: number[] }
  /** The text of these pages could not be measured: exported as pictures only. */
  | { code: 'measure'; pages: number[] }
  /** .pptx only: rotated or scaled text on these pages stayed in the picture, not editable. */
  | { code: 'tilted'; pages: number[] }
  /** Drawn by the fallback renderer: blurs, masks and some effects may be missing. */
  | { code: 'fallback'; pages: number[] }
  /** A picture, a font or a stylesheet could not be put into these pages' pictures. */
  | { code: 'assets'; pages: number[] }
  /** Neither renderer could draw these pages: blank backgrounds, text and fields kept. */
  | { code: 'raster'; pages: number[] }

export interface RenderResult {
  pages: RenderedPage[]
  notices: RenderNotice[]
}

export interface RenderOptions {
  purpose: RasterPurpose
  signal?: AbortSignal
  /** Called before each page is rasterised, 1-based. */
  onPage?: (page: number, total: number) => void
}

const HIDE_MODE = { pdf: 'fields', pptx: 'text', png: 'none' } as const

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** A promise, or nothing after `ms` — a font that never loads must not hold an export forever. */
function within<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([p.catch(() => undefined), sleep(ms).then(() => undefined)])
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

/**
 * Wait until what the page shows is what a picture will show: the web fonts
 * (a flyer's headline set in the fallback face would be measured in it too),
 * and every <img> decoded (html2canvas draws an undecoded one as nothing). Both
 * bounded — a missing font or a broken image degrades the export, never stops it.
 */
async function settle(frame: DocumentFrame): Promise<void> {
  const fonts = (frame.doc as Document & { fonts?: FontFaceSet }).fonts
  if (fonts?.ready) await within(fonts.ready, 4000)
  const imgs = Array.from(frame.doc.images)
  await within(
    Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined)))),
    6000,
  )
}

/**
 * Every picture loads now. The frame sits 99,999 px off to the left, so a
 * `loading="lazy"` image — what a model writes on every photograph below the
 * fold — is never "near the viewport" and never loads: page 2's photo was a
 * blank box in every export. Before the first settle, so settle waits for them.
 */
function loadEverything(doc: Document) {
  doc.querySelectorAll('img').forEach((img) => {
    if (img.getAttribute('loading') !== 'eager') img.setAttribute('loading', 'eager')
  })
}

async function encode(canvas: HTMLCanvasElement, type: 'image/jpeg' | 'image/png'): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, JPEG_QUALITY))
  // A canvas past the browser's size limit encodes to null rather than throwing.
  if (!blob) throw new Error('encode failed')
  return new Uint8Array(await blob.arrayBuffer())
}

function release(canvas: HTMLCanvasElement | null) {
  if (!canvas) return
  // Hand the pixels back now rather than whenever the collector runs.
  canvas.width = 0
  canvas.height = 0
}

type Html2Canvas = (el: Element, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Runs every undo in reverse order — the order the changes were stacked in. */
function undoAll(undo: Array<() => void>): () => void {
  return () => {
    for (let i = undo.length - 1; i >= 0; i--) undo[i]()
  }
}

let pinSeq = 0

/** Adds one id to an element's `PIN_ATTR` list; the undo puts the list back as it was. */
function tagPin(el: Element): { id: number; undo: () => void } {
  const id = ++pinSeq
  const was = el.getAttribute(PIN_ATTR)
  el.setAttribute(PIN_ATTR, was ? `${was} ${id}` : String(id))
  return { id, undo: () => (was === null ? el.removeAttribute(PIN_ATTR) : el.setAttribute(PIN_ATTR, was)) }
}

function addSheet(doc: Document, css: string): () => void {
  if (!css) return () => {}
  const style = doc.createElement('style')
  style.textContent = css
  doc.head.appendChild(style)
  return () => style.remove()
}

const clipsText = (cs: CSSStyleDeclaration) =>
  /\btext\b/.test(`${cs.getPropertyValue('background-clip')} ${cs.getPropertyValue('-webkit-background-clip')}`)

/** Sets inline, `!important`, and returns what puts the previous inline value back. */
function pinInline(st: CSSStyleDeclaration, prop: string, value: string): () => void {
  const inline = st.getPropertyValue(prop)
  const prio = st.getPropertyPriority(prop)
  st.setProperty(prop, value, 'important')
  return () => (inline ? st.setProperty(prop, inline, prio) : st.removeProperty(prop))
}

/**
 * Text painted with `background-clip: text`, per element:
 *
 * - `flatten` — solid ink, the gradient's first stop (raster.ts's `clipTextInk`
 *   says why). For MEASURING, so the .pptx gets a visible run in that colour
 *   rather than a transparent one, and for html2canvas, which cannot clip a
 *   background to glyphs.
 * - `erase`   — no ink at all: the .pptx pass, where the run comes back as a text
 *   box. The gradient is a BACKGROUND, so the hide rules' transparent `color`
 *   left it standing: the slide carried the headline twice, baked into the
 *   picture and editable on top of it.
 * - `keep`    — the native renderer draws the real gradient.
 */
function treatClippedText(win: Window, root: Element, how: (el: Element) => 'flatten' | 'erase' | 'keep'): () => void {
  const undo: Array<() => void> = []
  for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
    const st = (el as HTMLElement).style
    if (!st) continue
    const cs = win.getComputedStyle(el)
    if (!clipsText(cs)) continue
    const mode = how(el)
    if (mode === 'keep') continue
    let ink = 'transparent'
    if (mode === 'flatten') {
      const parent = el.parentElement ? win.getComputedStyle(el.parentElement).color : ''
      const c = clipTextInk(cs.backgroundImage, parseCssColor(parent))
      ink = `rgb(${c.r}, ${c.g}, ${c.b})`
    }
    undo.push(
      pinInline(st, 'background-image', 'none'),
      pinInline(st, 'background-color', 'transparent'),
      pinInline(st, 'background-clip', 'border-box'),
      pinInline(st, '-webkit-background-clip', 'border-box'),
      pinInline(st, 'color', ink),
      pinInline(st, '-webkit-text-fill-color', ink),
    )
  }
  return undoAll(undo)
}

const PSEUDO_PROPS = [...INK_PROPS, ...PAINT_PROPS] as const

function pseudoDraws(win: Window, el: Element, pseudo: PinPseudo): boolean {
  if (pseudo === '::marker') {
    const cs = win.getComputedStyle(el)
    return cs.display === 'list-item' && (cs.listStyleType !== 'none' || cs.listStyleImage !== 'none')
  }
  const content = win.getComputedStyle(el, pseudo).content
  return !!content && content !== 'none' && content !== 'normal'
}

/**
 * Put the hide rules in and pin back what they took by accident: the paint
 * that follows `color` (`PAINT_PROPS`) everywhere, and the ink itself where it
 * must stay (`keepInk`). In the .pptx pass (`textMode`) also: the gradient of
 * clipped text (`treatClippedText`'s `erase`), and the ink of pseudo-elements —
 * bullets, arrows, quotation marks — which no text box brings back
 * (`pseudoPinCss`). Returns the undo, for the `finally` that must run whatever
 * the rasteriser did.
 */
function applyHide(
  win: Window,
  doc: Document,
  page: Element,
  css: string,
  keepInk: (el: Element) => boolean,
  textMode: boolean,
): () => void {
  const els = [page, ...Array.from(page.querySelectorAll('*'))]
  const propsOf = (el: Element): readonly string[] => (keepInk(el) ? [...PAINT_PROPS, ...INK_PROPS] : PAINT_PROPS)
  const before = els.map((el) => {
    const cs = win.getComputedStyle(el)
    return propsOf(el).map((p) => cs.getPropertyValue(p))
  })
  const pseudoBefore: Array<{ el: Element; pseudo: PinPseudo; values: string[] }> = []
  if (textMode) {
    for (const el of els) {
      if (keepInk(el)) continue // its pinned ink is what its pseudo-elements inherit
      for (const pseudo of PIN_PSEUDOS) {
        if (!pseudoDraws(win, el, pseudo)) continue
        const ps = win.getComputedStyle(el, pseudo)
        pseudoBefore.push({ el, pseudo, values: PSEUDO_PROPS.map((p) => ps.getPropertyValue(p)) })
      }
    }
  }
  const undo: Array<() => void> = [addSheet(doc, css)]
  els.forEach((el, i) => {
    const st = (el as HTMLElement).style
    if (!st) return
    const cs = win.getComputedStyle(el)
    propsOf(el).forEach((p, k) => {
      const was = before[i][k]
      if (!was || cs.getPropertyValue(p) === was) return
      undo.push(pinInline(st, p, was))
    })
  })
  if (textMode) {
    undo.push(treatClippedText(win, page, (el) => (keepInk(el) ? 'keep' : 'erase')))
    const pins: PseudoPin[] = []
    for (const { el, pseudo, values } of pseudoBefore) {
      const ps = win.getComputedStyle(el, pseudo)
      const props = PSEUDO_PROPS.map((p, k) => [p, values[k]] as const).filter(([p, was]) => was && ps.getPropertyValue(p) !== was)
      if (!props.length) continue
      const tag = tagPin(el)
      undo.push(tag.undo)
      if (pseudo === '::marker') {
        // `::marker` accepts `color` and not `-webkit-text-fill-color`, which it
        // inherits — transparent, from the hide rule — so a pinned colour alone
        // drew nothing (checked in Edge). The item's own fill follows its colour
        // instead: still transparent for its text, the pinned colour for its
        // bullet, since `currentcolor` inherits as the keyword.
        const st = (el as HTMLElement).style
        if (st) undo.push(pinInline(st, '-webkit-text-fill-color', 'currentcolor'))
        pins.push({ id: tag.id, pseudo, props: props.filter(([p]) => p === 'color') })
      } else pins.push({ id: tag.id, pseudo, props })
    }
    undo.push(addSheet(doc, pseudoPinCss(pins)))
  }
  return undoAll(undo)
}

/**
 * The PDF pass: a checkbox that starts checked is drawn UNCHECKED in the
 * picture. Both renderers paint the tick in its own ink, so no colour rule
 * takes it out, and the real PDF checkbox laid on top owns the state — with the
 * tick baked in, unticking it in a reader left the box looking ticked forever.
 */
function uncheckFields(page: Element): () => void {
  const undo: Array<() => void> = []
  page.querySelectorAll(`[${FIELD_ATTR}]`).forEach((field) => {
    const boxes = [field, ...Array.from(field.querySelectorAll('input'))].filter(
      (el) => el.tagName === 'INPUT' && /^(checkbox|radio)$/i.test(el.getAttribute('type') || ''),
    ) as HTMLInputElement[]
    for (const box of boxes) {
      if (!box.checked) continue
      box.checked = false
      undo.push(() => (box.checked = true))
    }
  })
  return () => undo.forEach((f) => f())
}

/** Every property a colour can hide in, for the normaliser. */
const COLOR_PROPS = [
  'color',
  'background-color',
  'background-image',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'text-emphasis-color',
  'column-rule-color',
  'caret-color',
  'accent-color',
  'fill',
  'stroke',
  'stop-color',
  'flood-color',
  'lighting-color',
  'box-shadow',
  'text-shadow',
  '-webkit-text-fill-color',
  '-webkit-text-stroke-color',
] as const

/** Any CSS colour, as the sRGB bytes a 1 × 1 canvas paints it in. Unreadable → transparent. */
function makeColorResolver(): (fn: string) => string {
  const memo = new Map<string, string>()
  const c = document.createElement('canvas')
  c.width = c.height = 1
  const ctx = c.getContext('2d', { willReadFrequently: true })
  return (fn) => {
    const hit = memo.get(fn)
    if (hit) return hit
    let out = 'rgba(0, 0, 0, 0)'
    if (ctx) {
      ctx.clearRect(0, 0, 1, 1)
      // An unparsable value leaves fillStyle as it was: transparent.
      ctx.fillStyle = 'rgba(0, 0, 0, 0)'
      ctx.fillStyle = fn
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      out = rgbaFromBytes(d[0], d[1], d[2], d[3])
    }
    memo.set(fn, out)
    return out
  }
}

/**
 * html2canvas throws on a colour it cannot parse (raster.ts's
 * `needsColorNormalising`), and one throw lost the page. Every such computed
 * value is resolved through a canvas and pinned — inline on elements, by rule
 * on their pseudo-elements — so an `oklch()` degrades to its sRGB neighbour
 * instead. The fallback path only: the native one reads what the browser wrote.
 */
function normalizeColors(win: Window, doc: Document, page: Element): () => void {
  const resolve = makeColorResolver()
  const undo: Array<() => void> = []
  const pins: PseudoPin[] = []
  const fix = (cs: CSSStyleDeclaration) =>
    COLOR_PROPS.map((p) => [p, cs.getPropertyValue(p)] as const)
      .filter(([, v]) => needsColorNormalising(v))
      .map(([p, v]) => [p, replaceColorFunctions(v, resolve)] as const)
  for (const el of [page, ...Array.from(page.querySelectorAll('*'))]) {
    const st = (el as HTMLElement).style
    if (st) for (const [p, v] of fix(win.getComputedStyle(el))) undo.push(pinInline(st, p, v))
    for (const pseudo of ['::before', '::after'] as const) {
      if (!pseudoDraws(win, el, pseudo)) continue
      const props = fix(win.getComputedStyle(el, pseudo))
      if (!props.length) continue
      const tag = tagPin(el)
      undo.push(tag.undo)
      pins.push({ id: tag.id, pseudo, props })
    }
  }
  undo.push(addSheet(doc, pseudoPinCss(pins)))
  return undoAll(undo)
}

/** A white page, for the one that neither renderer could draw: its text and fields still travel. */
async function blankImage(w: number, h: number, type: 'image/jpeg' | 'image/png'): Promise<{ image: Uint8Array; w: number; h: number }> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w))
  canvas.height = Math.max(1, Math.round(h))
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  try {
    return { image: await encode(canvas, type), w: canvas.width, h: canvas.height }
  } finally {
    release(canvas)
  }
}

export async function renderDocument(
  code: string,
  caps: Capability[],
  format: PageFormat,
  opts: RenderOptions,
): Promise<RenderResult> {
  const { purpose, signal } = opts
  const frame = await openDocumentFrame(code, caps, format.w, format.h, signal)
  // Cancel means NOW: the frame — and the model's code running in it — goes the
  // moment the person asks, not when the page being rasterised finishes.
  // Everything awaited below races the same signal.
  const onAbort = () => frame.dispose()
  signal?.addEventListener('abort', onAbort, { once: true })
  const notices: RenderNotice[] = []
  try {
    throwIfAborted(signal)
    loadEverything(frame.doc)
    await raceAbort(settle(frame), signal)

    let pages = orderPages(Array.from(frame.doc.querySelectorAll(`[${PAGE_ATTR}]`)))
    if (pages.length === 0) {
      // A document written without the kit's <Page>: one page, the root, cut
      // at the format's size. A PDF of the first page beats no PDF at all.
      const root = frame.doc.querySelector(`[${DOC_ATTR}]`) ?? frame.doc.getElementById('root')?.firstElementChild ?? frame.doc.body
      // Tagged as a page for the rest of the export, because every hide rule is
      // scoped to one: untagged, the .pptx background kept all its text UNDER
      // the text boxes, and the PDF kept "Votre nom" under its fillable field.
      root.setAttribute(PAGE_ATTR, '0')
      pages = [root]
      notices.push({ code: 'noPages' })
    }

    // The frame was mounted one page tall; the pages below it must be laid out
    // at the height the canvas gives them, or a `min-h-screen` inside a page
    // would measure against the wrong viewport.
    frame.resize(Math.max(docFrameHeight(format, pages.length), frame.doc.documentElement.scrollHeight))
    await raceAbort(sleep(150), signal)
    loadEverything(frame.doc)
    await raceAbort(settle(frame), signal)
    throwIfAborted(signal)

    const h2c = (frame.win as Window & { html2canvas?: Html2Canvas }).html2canvas
    const scale = rasterScale(format, purpose)
    const hideMode = HIDE_MODE[purpose]
    const hide = hideCss(hideMode)
    const textMode = hideMode === 'text'
    const type = purpose === 'png' ? 'image/png' : 'image/jpeg'
    const unmeasured: number[] = []
    const overflow: number[] = []
    const tiltedPages: number[] = []
    const fellBack: number[] = []
    const incomplete: number[] = []
    const blank: number[] = []
    const out: RenderedPage[] = []
    let native = typeof XMLSerializer === 'function' && typeof Image === 'function'

    for (let i = 0; i < pages.length; i++) {
      throwIfAborted(signal)
      opts.onPage?.(i + 1, pages.length)
      const el = pages[i]
      const tilted = makeTiltTest(frame.win, el)

      let snapshot: PageSnapshot
      // Measured with clipped text flattened to its ink — after the last
      // settle, since Tailwind's runtime writes a class's CSS a task after
      // mount and a `bg-clip-text` it has not written yet reads as plain.
      const unflatten = treatClippedText(frame.win, el, () => 'flatten')
      try {
        snapshot = snapshotPage(frame.win, el, i, format.w, format.h, tilted)
        if (snapshot.overflow) overflow.push(i + 1)
        if (snapshot.tilted) tiltedPages.push(i + 1)
      } catch (err) {
        console.warn('mocky: document page could not be measured —', err)
        unmeasured.push(i + 1)
        snapshot = { index: i, width: format.w, height: format.h, lines: [], blocks: [], fields: [], links: [] }
      } finally {
        unflatten()
      }

      // Only the .pptx hides every glyph, so only there does tilted text need
      // its ink back; an SVG needs it in any mode that hides something.
      const keepInk =
        purpose === 'pptx'
          ? (e: Element) => e.namespaceURI === SVG_NS || tilted(e)
          : (e: Element) => e.namespaceURI === SVG_NS
      const prepare = (): (() => void) => {
        const undo: Array<() => void> = []
        if (hide) undo.push(applyHide(frame.win, frame.doc, el, hide, keepInk, textMode))
        if (purpose === 'pdf') undo.push(uncheckFields(el))
        return undoAll(undo)
      }

      let rendered: { image: Uint8Array; w: number; h: number } | null = null

      // ── the browser's own engine ─────────────────────────────────────────
      if (native) {
        const restore = prepare()
        let canvas: HTMLCanvasElement | null = null
        try {
          const res = await rasterizeNative(frame.win, el, { width: format.w, height: format.h, scale, signal })
          canvas = res.canvas
          // Inside the try: Safari's refusal to read the canvas back is a
          // SecurityError thrown HERE, not when drawing.
          rendered = { image: await raceAbort(encode(canvas, type), signal), w: canvas.width, h: canvas.height }
          // Only once the native picture is the one kept: a page that falls
          // back is drawn by html2canvas from the live DOM, pictures included,
          // and reporting it as incomplete as well contradicted the other notice.
          if (res.missing > 0) incomplete.push(i + 1)
        } catch (err) {
          const verdict = classifyNativeFailure(err, !!signal?.aborted)
          if (verdict === 'abort') throw err
          if (verdict === 'tainted') native = false
          console.warn('mocky: native page raster failed, using html2canvas —', err)
        } finally {
          restore()
          release(canvas)
        }
      }

      // ── html2canvas, the fallback ────────────────────────────────────────
      if (!rendered) {
        fellBack.push(i + 1)
        const undo: Array<() => void> = []
        let canvas: HTMLCanvasElement | null = null
        try {
          if (typeof h2c !== 'function') throw new Error('html2canvas missing')
          // html2canvas's own workarounds, and only here: clipped text as solid
          // ink (erased in the .pptx pass, where it is a text box), and every
          // colour it would throw on resolved first.
          undo.push(treatClippedText(frame.win, el, (e) => (textMode && !keepInk(e) ? 'erase' : 'flatten')))
          undo.push(prepare())
          undo.push(normalizeColors(frame.win, frame.doc, el))
          canvas = await raceAbort(
            h2c(el, { scale, width: format.w, height: format.h, backgroundColor: '#ffffff', logging: false, useCORS: true }),
            signal,
          )
          throwIfAborted(signal)
          rendered = { image: await raceAbort(encode(canvas, type), signal), w: canvas.width, h: canvas.height }
        } catch (err) {
          if (signal?.aborted || (err as { name?: string } | null)?.name === 'AbortError') throw err
          console.warn('mocky: page could not be rasterised —', err)
        } finally {
          undoAll(undo)()
          release(canvas)
        }
      }

      if (!rendered) {
        blank.push(i + 1)
        rendered = await blankImage(format.w * scale, format.h * scale, type)
      }
      out.push({ snapshot, image: rendered.image, pixelWidth: rendered.w, pixelHeight: rendered.h })
    }
    if (overflow.length) notices.push({ code: 'overflow', pages: overflow })
    if (unmeasured.length) notices.push({ code: 'measure', pages: unmeasured })
    if (purpose === 'pptx' && tiltedPages.length) notices.push({ code: 'tilted', pages: tiltedPages })
    const drawnByFallback = fellBack.filter((p) => !blank.includes(p))
    if (drawnByFallback.length) notices.push({ code: 'fallback', pages: drawnByFallback })
    if (incomplete.length) notices.push({ code: 'assets', pages: incomplete })
    if (blank.length) notices.push({ code: 'raster', pages: blank })
    return { pages: out, notices }
  } finally {
    signal?.removeEventListener('abort', onAbort)
    frame.dispose()
  }
}
