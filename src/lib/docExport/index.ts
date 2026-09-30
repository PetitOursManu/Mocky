import { resolveCapabilities, selectCapabilities } from '../capabilities/select'
import { DEFAULT_PAGE_FORMAT, getPageFormat } from '../pageFormats'
import type { Screen } from '../project'
import { makeZip } from '../zip'
import { MIME, fileBaseName, pageFileName } from './files'
import { renderDocument, type RenderNotice } from './render'

/**
 * A document screen → one downloadable file. The dialog's only entry point.
 *
 * Three outputs, each for a different next step:
 *  - `pdf`  — to print or to send, with its `<Field>`s fillable in any reader;
 *  - `pptx` — to keep EDITING: every text a text box, openable in Google Slides
 *             (upload to Drive, "Open with Google Slides"), PowerPoint, Keynote;
 *  - `png`  — to post: one picture per page, zipped when there are several.
 */

export type ExportKind = 'pdf' | 'pptx' | 'png'

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
  const { pages, notices } = await renderDocument(screen.code, capsForScreen(screen), format, {
    purpose: kind,
    signal: opts.signal,
    onPage: (page, total) => opts.onProgress?.({ phase: 'page', page, total }),
  })
  if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  opts.onProgress?.({ phase: 'build' })

  const title = screen.name.trim() || base
  let blob: Blob
  let filename: string
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
      pages.map((p) => ({ snapshot: p.snapshot, background: p.image })),
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
