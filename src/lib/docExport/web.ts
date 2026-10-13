import type { Screen } from '../project'
import type { PageFormat, PageFormatId } from '../pageFormats'
import { renderDocument, type RenderNotice } from './render'
import { capsForScreen, type ExportOptions, type ExportResult } from './index'
import { MIME, fileBaseName } from './files'
import type { PageSnapshot, Rect, TextBlock } from './types'

/**
 * An ORDINARY screen — a page of a site or an app — as a picture or a deck.
 *
 * Documents had PNG and PowerPoint from the start, because a document IS pages.
 * A web screen is one long page laid out for a viewport, and what people asked
 * for was the same two files of it: the whole page as an image, to send or to
 * put in a mock-up, and slides, to present it. Both go through the document
 * pipeline (render.ts), in its `web` mode: the frame is laid out at the
 * screen's own height as its viewport, whatever was sized on the viewport is
 * held at that size, and the page is then rendered whole — text measured, so
 * the slides carry real, editable text like a document's.
 *
 * The deck cuts the page into slides of the presentation's shape (16:9 for a
 * wide screen, 9:16 for a phone), and a cut never goes through a block of
 * text when it can move up to the block's top instead: a headline cut in half
 * across two slides is the defect a viewer reads as broken.
 */

export type WebExportKind = 'png' | 'pptx'

/** The viewport a web screen is laid out at: its own frame, as the canvas shows it. */
function viewportOf(screen: Pick<Screen, 'w' | 'h'>): { w: number; h: number } {
  const w = screen.w > 0 ? Math.round(screen.w) : 1440
  const h = screen.h > 0 ? Math.round(screen.h) : 900
  return { w, h }
}

/** The page "format" handed to the renderer: the viewport, in the document vocabulary. */
export function webFormat(screen: Pick<Screen, 'w' | 'h'>): PageFormat {
  const { w, h } = viewportOf(screen)
  // `slides` sets the raster scale (1.5×): sharp on a screen, and a tall page
  // stays inside the raster budget. The id is only a label nothing reads here.
  return { id: 'slides' as PageFormatId, w, h, widthPt: w * 0.75, heightPt: h * 0.75, cssSize: `${w}px ${h}px`, kind: 'slides' }
}

/** The slide a page of this width is cut into: 16:9 when wide, 9:16 for a phone. */
export function slideSize(width: number): { w: number; h: number } {
  return width >= 768 ? { w: width, h: Math.round((width * 9) / 16) } : { w: width, h: Math.round((width * 16) / 9) }
}

/**
 * Where each slide starts and which text blocks it carries.
 *
 * A slide shows `[start, start + slideH]` of the page. The next one starts at
 * the bottom edge — or, when text blocks cross that edge, at the top of the
 * highest of them, so they appear whole on the next slide rather than cut on
 * both. A block may then show on two slides; never in half on either. The cut
 * moves up only while the slide keeps at least 40% of its height, so a page of
 * one endless paragraph still advances.
 */
export function planSlides(blocks: readonly Pick<TextBlock, 'rect'>[], pageH: number, slideH: number): { start: number; blocks: number[] }[] {
  const out: { start: number; blocks: number[] }[] = []
  let start = 0
  const H = Math.max(1, pageH)
  while (start < H - 1 && out.length < 200) {
    const end = start + slideH
    let next = end
    if (end < H) {
      const crossing = blocks.filter((b) => b.rect.y < end && b.rect.y + b.rect.h > end && b.rect.h <= slideH)
      const top = crossing.length ? Math.min(...crossing.map((b) => b.rect.y)) : end
      if (top > start + slideH * 0.4) next = top
    }
    const mine = blocks
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => (b.rect.y >= start && b.rect.y + b.rect.h <= end) || (b.rect.y >= start && b.rect.y < next))
      .map(({ i }) => i)
    out.push({ start, blocks: mine })
    if (next >= H) break
    start = next
  }
  return out
}

const shift = (r: Rect, dy: number): Rect => ({ ...r, y: r.y - dy })

/** One slide's snapshot: its blocks, their lines and the links in its band, moved up to the slide's origin. */
export function sliceSnapshot(snap: PageSnapshot, start: number, slideH: number, blockIdx: number[], index: number): PageSnapshot {
  const blocks = blockIdx.map((i) => snap.blocks[i]).map((b) => ({ ...b, rect: shift(b.rect, start), lines: b.lines.map((l) => ({ ...l, rect: shift(l.rect, start) })) }))
  const inBand = (r: Rect) => r.y >= start && r.y + r.h <= start + slideH
  return {
    index,
    width: snap.width,
    height: slideH,
    blocks,
    lines: blocks.flatMap((b) => b.lines),
    fields: [],
    links: snap.links.filter((l) => inBand(l.rect)).map((l) => ({ ...l, rect: shift(l.rect, start) })),
  }
}

/** Cut a band out of the page picture, as a JPEG the size of a slide (the last one padded with the page's own ground). */
async function cropBand(image: Uint8Array, mime: string, pageW: number, pageH: number, start: number, slideH: number): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(new Blob([image as BlobPart], { type: mime }))
  try {
    const scale = bitmap.width / pageW
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = Math.max(1, Math.round(slideH * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2D context')
    const sy = Math.round(start * scale)
    const sh = Math.min(canvas.height, bitmap.height - sy)
    // The page's last row of pixels stands in for whatever lies past its end.
    ctx.drawImage(bitmap, 0, bitmap.height - 1, bitmap.width, 1, 0, 0, canvas.width, canvas.height)
    if (sh > 0) ctx.drawImage(bitmap, 0, sy, bitmap.width, sh, 0, 0, bitmap.width, sh)
    void pageH
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) throw new Error('could not encode a slide')
    const out = new Uint8Array(await blob.arrayBuffer())
    canvas.width = canvas.height = 0
    return out
  } finally {
    bitmap.close()
  }
}

export async function exportWebScreen(screen: Screen, kind: WebExportKind, opts: ExportOptions = {}): Promise<ExportResult> {
  const format = webFormat(screen)
  const base = fileBaseName(screen.name)
  opts.onProgress?.({ phase: 'render' })
  const { pages, notices } = await renderDocument(screen.code, capsForScreen(screen), format, {
    purpose: kind,
    web: true,
    signal: opts.signal,
  })
  if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const page = pages[0]
  if (!page) throw new Error('nothing was rendered')
  const kept: RenderNotice[] = notices.filter((n) => n.code !== 'noPages' && n.code !== 'overflow')
  opts.onProgress?.({ phase: 'build' })
  if (kind === 'png') {
    return { blob: new Blob([page.image as BlobPart], { type: MIME.png }), filename: `${base}.png`, pages: 1, notices: kept }
  }
  const pageH = page.snapshot.height
  const slide = slideSize(format.w)
  const plan = planSlides(page.snapshot.blocks, pageH, slide.h)
  const slides = []
  for (let i = 0; i < plan.length; i++) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    opts.onProgress?.({ phase: 'page', page: i + 1, total: plan.length })
    const p = plan[i]
    slides.push({
      snapshot: sliceSnapshot(page.snapshot, p.start, slide.h, p.blocks, i),
      background: await cropBand(page.image, 'image/jpeg', format.w, pageH, p.start, slide.h),
    })
  }
  const { buildPptx } = await import('./pptx')
  const bytes = buildPptx(slides, slide, { title: screen.name.trim() || base, lang: opts.lang === 'en' ? 'en-US' : 'fr-FR' })
  return {
    blob: new Blob([bytes as BlobPart], { type: MIME.pptx }),
    filename: `${base}.pptx`,
    pages: slides.length,
    notices: kept,
  }
}
