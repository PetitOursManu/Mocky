import { openDocumentFrame, type DocumentFrame } from '../capture'
import type { Capability } from '../capabilities/types'
import { DOC_ATTR, FIELD_ATTR, PAGE_ATTR, docFrameHeight, type PageFormat } from '../pageFormats'
import { parseCssColor } from './lines'
import { makeTiltTest, orderPages, snapshotPage } from './measure'
import { INK_PROPS, JPEG_QUALITY, PAINT_PROPS, clipTextInk, hideCss, rasterScale, type RasterPurpose } from './raster'
import type { PageSnapshot, RenderedPage } from './types'

/**
 * A document screen, rendered offscreen and read back one page at a time.
 *
 * For each page: MEASURE it with its text in place (measure.ts), take the ink
 * out that the export will put back in its own form (raster.ts's `hideCss`),
 * RASTERISE it with the frame's own html2canvas, encode it, and let the canvas
 * go before the next page — a ten-page A4 at 250 dpi is 60 MP of canvas, which
 * no browser should be asked to hold at once.
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

async function encode(canvas: HTMLCanvasElement, type: 'image/jpeg' | 'image/png'): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, JPEG_QUALITY))
  // A canvas past the browser's size limit encodes to null rather than throwing.
  if (!blob) throw new Error('encode failed')
  return new Uint8Array(await blob.arrayBuffer())
}

type Html2Canvas = (el: Element, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Text painted with `background-clip: text` becomes solid ink — the gradient's
 * first stop (raster.ts's `clipTextInk` says why). Done once, before anything is
 * measured, so the .pptx gets a VISIBLE run in that colour instead of dropping a
 * transparent one, and the three exports agree. The frame is thrown away after
 * the export, so nothing is restored.
 */
function flattenClippedText(win: Window, root: Element) {
  for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
    const cs = win.getComputedStyle(el)
    const clip = `${cs.getPropertyValue('background-clip')} ${cs.getPropertyValue('-webkit-background-clip')}`
    if (!/\btext\b/.test(clip)) continue
    const parent = el.parentElement ? win.getComputedStyle(el.parentElement).color : ''
    const c = clipTextInk(cs.backgroundImage, parseCssColor(parent))
    const ink = `rgb(${c.r}, ${c.g}, ${c.b})`
    const st = (el as HTMLElement).style
    if (!st) continue
    st.setProperty('background-image', 'none', 'important')
    st.setProperty('background-color', 'transparent', 'important')
    st.setProperty('background-clip', 'border-box', 'important')
    st.setProperty('-webkit-background-clip', 'border-box', 'important')
    st.setProperty('color', ink, 'important')
    st.setProperty('-webkit-text-fill-color', ink, 'important')
  }
}

/**
 * Put the hide rules in and pin back what they took by accident: the paint
 * that follows `color` (`PAINT_PROPS`) everywhere, and the ink itself where it
 * must stay (`keepInk`). Returns the undo, for the `finally` that must run
 * whatever html2canvas did.
 */
function applyHide(win: Window, doc: Document, page: Element, css: string, keepInk: (el: Element) => boolean): () => void {
  const els = [page, ...Array.from(page.querySelectorAll('*'))]
  const propsOf = (el: Element): readonly string[] => (keepInk(el) ? [...PAINT_PROPS, ...INK_PROPS] : PAINT_PROPS)
  const before = els.map((el) => {
    const cs = win.getComputedStyle(el)
    return propsOf(el).map((p) => cs.getPropertyValue(p))
  })
  const style = doc.createElement('style')
  style.textContent = css
  doc.head.appendChild(style)
  const undo: Array<() => void> = [() => style.remove()]
  els.forEach((el, i) => {
    const st = (el as HTMLElement).style
    if (!st) return
    const cs = win.getComputedStyle(el)
    propsOf(el).forEach((p, k) => {
      const was = before[i][k]
      if (!was || cs.getPropertyValue(p) === was) return
      const inline = st.getPropertyValue(p)
      const prio = st.getPropertyPriority(p)
      st.setProperty(p, was, 'important')
      undo.push(() => (inline ? st.setProperty(p, inline, prio) : st.removeProperty(p)))
    })
  })
  return () => {
    for (let i = undo.length - 1; i >= 0; i--) undo[i]()
  }
}

/**
 * The PDF pass: a checkbox that starts checked is drawn UNCHECKED in the
 * picture. html2canvas paints the tick in its own ink, so no colour rule takes
 * it out, and the real PDF checkbox laid on top owns the state — with the tick
 * baked in, unticking it in a reader left the box looking ticked forever.
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

export async function renderDocument(
  code: string,
  caps: Capability[],
  format: PageFormat,
  opts: RenderOptions,
): Promise<RenderResult> {
  const { purpose, signal } = opts
  const frame = await openDocumentFrame(code, caps, format.w, format.h, signal)
  const notices: RenderNotice[] = []
  try {
    await settle(frame)
    throwIfAborted(signal)

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
    await sleep(150)
    await settle(frame)
    throwIfAborted(signal)
    // After the last settle: Tailwind's runtime writes a class's CSS a task
    // after mount, and a `bg-clip-text` it has not written yet reads as plain.
    flattenClippedText(frame.win, frame.doc.body)

    const h2c = (frame.win as Window & { html2canvas?: Html2Canvas }).html2canvas
    if (typeof h2c !== 'function') throw new Error('html2canvas missing')
    const scale = rasterScale(format, purpose)
    const hide = hideCss(HIDE_MODE[purpose])
    const type = purpose === 'png' ? 'image/png' : 'image/jpeg'
    const unmeasured: number[] = []
    const overflow: number[] = []
    const tiltedPages: number[] = []
    const out: RenderedPage[] = []

    for (let i = 0; i < pages.length; i++) {
      throwIfAborted(signal)
      opts.onPage?.(i + 1, pages.length)
      const el = pages[i]
      const tilted = makeTiltTest(frame.win, el)

      let snapshot: PageSnapshot
      try {
        snapshot = snapshotPage(frame.win, el, i, format.w, format.h, tilted)
        if (snapshot.overflow) overflow.push(i + 1)
        if (snapshot.tilted) tiltedPages.push(i + 1)
      } catch (err) {
        console.warn('mocky: document page could not be measured —', err)
        unmeasured.push(i + 1)
        snapshot = { index: i, width: format.w, height: format.h, lines: [], blocks: [], fields: [], links: [] }
      }

      // Only the .pptx hides every glyph, so only there does tilted text need
      // its ink back; an SVG needs it in any mode that hides something.
      const keepInk =
        purpose === 'pptx'
          ? (e: Element) => e.namespaceURI === SVG_NS || tilted(e)
          : (e: Element) => e.namespaceURI === SVG_NS
      const restore: Array<() => void> = []
      let canvas: HTMLCanvasElement | null = null
      try {
        if (hide) restore.push(applyHide(frame.win, frame.doc, el, hide, keepInk))
        if (purpose === 'pdf') restore.push(uncheckFields(el))
        canvas = await h2c(el, {
          scale,
          width: format.w,
          height: format.h,
          backgroundColor: '#ffffff',
          logging: false,
          useCORS: true,
        })
        throwIfAborted(signal)
        const image = await encode(canvas, type)
        out.push({ snapshot, image, pixelWidth: canvas.width, pixelHeight: canvas.height })
      } finally {
        for (let k = restore.length - 1; k >= 0; k--) restore[k]()
        if (canvas) {
          // Hand the pixels back now rather than whenever the collector runs.
          canvas.width = 0
          canvas.height = 0
        }
      }
    }
    if (overflow.length) notices.push({ code: 'overflow', pages: overflow })
    if (unmeasured.length) notices.push({ code: 'measure', pages: unmeasured })
    if (purpose === 'pptx' && tiltedPages.length) notices.push({ code: 'tilted', pages: tiltedPages })
    return { pages: out, notices }
  } finally {
    frame.dispose()
  }
}
