import { resolveCapabilities, selectCapabilities } from '../capabilities/select'
import { DEFAULT_PAGE_FORMAT, getPageFormat } from '../pageFormats'
import type { Screen } from '../project'
import { makeZip } from '../zip'
import { MIME, fileBaseName, pageFileName } from './files'
import { renderDocument, type RenderNotice } from './render'
import type { LayeredFrame } from './layers'
import type { RenderedPage } from './types'

/**
 * A document screen → one downloadable file. The dialog's only entry point.
 *
 * Five outputs, each for a different next step:
 *  - `pdf`  — to print or to send, with its `<Field>`s fillable in any reader;
 *  - `pptx` — to keep EDITING: every text a text box and every picture in a
 *             shape a frame of its own — in Canva, Google Slides (upload to
 *             Drive, "Open with Google Slides"), PowerPoint, Keynote;
 *  - `png`  — to post: one picture per page, zipped when there are several;
 *  - `psd`, `svg` — to finish in a layered editor (layers.ts): the page, and
 *             each picture in a shape as a layer or a mask group of its own.
 */

export type ExportKind = 'pdf' | 'pptx' | 'png' | 'psd' | 'svg'

/** The files built from the page in layers (layers.ts). */
const isLayered = (kind: ExportKind): kind is 'psd' | 'svg' => kind === 'psd' || kind === 'svg'

export type ExportProgress =
  | { phase: 'render' }
  | { phase: 'page'; page: number; total: number }
  | { phase: 'build' }

export interface ExportResult {
  blob: Blob
  filename: string
  pages: number
  notices: RenderNotice[]
}

export interface ExportOptions {
  signal?: AbortSignal
  onProgress?: (p: ExportProgress) => void
  /** Interface language, for the PDF's /Lang and the slides' spell-check language. */
  lang?: 'fr' | 'en'
}

/**
 * The capabilities the screen was generated with, as a thumbnail resolves them:
 * without them the capture shell has none of the globals the component calls
 * (`Icon`, the page kit's `<Page>`…), it throws on render, and the export is a
 * blank. Screens saved before `caps` was stored re-derive them from the prompt.
 */
export function capsForScreen(screen: Pick<Screen, 'caps' | 'prompt'>) {
  return resolveCapabilities(screen.caps && screen.caps.length > 0 ? screen.caps : selectCapabilities(screen.prompt || ''))
}

export async function exportDocument(screen: Screen, kind: ExportKind, opts: ExportOptions = {}): Promise<ExportResult> {
  const format = getPageFormat(screen.page ?? DEFAULT_PAGE_FORMAT)
  const base = fileBaseName(screen.name)
  opts.onProgress?.({ phase: 'render' })
  const layered = isLayered(kind)
  const { pages, notices } = await renderDocument(screen.code, capsForScreen(screen), format, {
    purpose: layered ? 'layers' : kind,
    signal: opts.signal,
    onPage: (page, total) => opts.onProgress?.({ phase: 'page', page, total }),
  })
  if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  opts.onProgress?.({ phase: 'build' })

  const title = screen.name.trim() || base
  const lang = opts.lang === 'en' ? 'en' : 'fr'
  /** One file per page, zipped when there are several. */
  const perPage = (ext: string, mime: string, files: Uint8Array[]) => {
    if (files.length === 1) return { blob: new Blob([files[0] as BlobPart], { type: mime }), filename: `${base}${ext}` }
    return { blob: makeZip(files.map((content, i) => ({ name: pageFileName(i, files.length).replace(/\.png$/, ext), content }))), filename: `${base}.zip` }
  }
  // Every frame carried on its own, named after its place and its shape; a
  // frame still waiting for its picture holds the placeholder.
  const named = await nameFrames(pages, lang)

  let blob: Blob
  let filename: string
  if (layered) {
    const ly = await import('./layers')
    const sheets = pages.map((p, i) => ({ png: p.image, width: format.w, height: format.h, frames: named[i] }))
    const files: Uint8Array[] = []
    // One page at a time: a PSD holds every layer's pixels while it is written.
    for (const s of sheets) files.push(kind === 'svg' ? new TextEncoder().encode(ly.buildLayeredSvg(s)) : await ly.layeredPsdForPage(s))
    return { ...perPage(kind === 'svg' ? '.svg' : '.psd', kind === 'svg' ? MIME.svg : MIME.psd, files), pages: pages.length, notices }
  }
  if (kind === 'pdf') {
    const { buildPdf } = await import('./pdf')
    const bytes = await buildPdf(
      pages.map((p) => ({ snapshot: p.snapshot, jpeg: p.image })),
      format,
      { title, lang: opts.lang === 'en' ? 'en-US' : 'fr-FR' },
    )
    blob = new Blob([bytes as BlobPart], { type: MIME.pdf })
    filename = `${base}.pdf`
  } else if (kind === 'pptx') {
    const { buildPptx } = await import('./pptx')
    const bytes = buildPptx(
      pages.map((p, i) => ({ snapshot: p.snapshot, background: p.image, frames: named[i] })),
      format,
      { title, lang: opts.lang === 'en' ? 'en-US' : 'fr-FR' },
    )
    blob = new Blob([bytes as BlobPart], { type: MIME.pptx })
    filename = `${base}.pptx`
  } else if (pages.length === 1) {
    blob = new Blob([pages[0].image as BlobPart], { type: MIME.png })
    filename = `${base}.png`
  } else {
    blob = makeZip(pages.map((p, i) => ({ name: pageFileName(i, pages.length), content: p.image })))
    filename = `${base}.zip`
  }
  return { blob, filename, pages: pages.length, notices }
}

export type { RenderNotice } from './render'

/** Each page's carried frames, named, every one of them holding a picture. */
async function nameFrames(pages: RenderedPage[], lang: 'fr' | 'en'): Promise<LayeredFrame[][]> {
  if (!pages.some((p) => p.frames?.length)) return pages.map(() => [])
  const ly = await import('./layers')
  const placeholder = pages.some((p) => p.frames?.some((f) => !f.picture)) ? { bytes: await ly.placeholderPng(), type: 'png' as const } : null
  return pages.map((p) =>
    (p.frames ?? []).flatMap((f, j) => {
      const picture = f.picture ?? placeholder
      if (!picture) return []
      const name = ly.frameName(j, f.box.shape, lang)
      return [{ ...f, picture, name, overlayNames: ly.frameOverlayNames(name, lang) }]
    }),
  )
}
