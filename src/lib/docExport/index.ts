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

export type ExportKind = 'pdf' | 'pptx' | 'png' | TemplateExportKind

/** The template — the document with its frames left empty (template.ts). */
export type TemplateExportKind = 'frames-png' | 'frames-svg' | 'frames-pdf' | 'frames-psd'

export const TEMPLATE_KINDS: readonly TemplateExportKind[] = ['frames-png', 'frames-svg', 'frames-pdf', 'frames-psd']

const isTemplate = (kind: ExportKind): kind is TemplateExportKind => (TEMPLATE_KINDS as readonly string[]).includes(kind)

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
  const template = isTemplate(kind)
  const { pages, notices } = await renderDocument(screen.code, capsForScreen(screen), format, {
    // The template's page is drawn as the PNG is, nothing left out, but at the
    // resolution of a file someone will edit (raster.ts, SOCIAL_EDIT_SCALE);
    // every format of it is built from that one picture.
    purpose: template ? 'template' : kind,
    template,
    signal: opts.signal,
    onPage: (page, total) => opts.onProgress?.({ phase: 'page', page, total }),
  })
  if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  opts.onProgress?.({ phase: 'build' })

  const title = screen.name.trim() || base
  const lang = opts.lang === 'en' ? 'en' : 'fr'
  let blob: Blob
  let filename: string
  /** One file per page, zipped when there are several. */
  const perPage = (ext: string, mime: string, files: Uint8Array[]) => {
    if (files.length === 1) return { blob: new Blob([files[0] as BlobPart], { type: mime }), filename: `${base}${ext}` }
    return { blob: makeZip(files.map((content, i) => ({ name: pageFileName(i, files.length).replace(/\.png$/, ext), content }))), filename: `${base}.zip` }
  }
  if (template) {
    const tpl = await import('./template')
    const sheets = pages.map((p) => ({ png: p.image, snapshot: p.snapshot }))
    let out: { blob: Blob; filename: string }
    if (kind === 'frames-pdf') {
      const bytes = await tpl.buildTemplatePdf(sheets, format, { title, placeholder: await tpl.placeholderPng(), lang })
      out = { blob: new Blob([bytes as BlobPart], { type: MIME.pdf }), filename: `${base}.pdf` }
    } else if (kind === 'frames-svg') {
      const enc = new TextEncoder()
      out = perPage('.svg', MIME.svg, sheets.map((s) => enc.encode(tpl.buildTemplateSvg(s, lang))))
    } else if (kind === 'frames-psd') {
      const files: Uint8Array[] = []
      for (const s of sheets) files.push(await tpl.templatePsdForPage(s, lang))
      out = perPage('.psd', MIME.psd, files)
    } else {
      out = perPage('.png', MIME.png, sheets.map((s) => s.png))
    }
    return { ...out, pages: pages.length, notices }
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
    // Frames carried as shapes of their own: named like the template's, and a
    // frame still waiting for its picture holds the template's placeholder.
    const tpl = pages.some((p) => p.frames?.length) ? await import('./template') : null
    const placeholder =
      tpl && pages.some((p) => p.frames?.some((f) => !f.picture)) ? { bytes: await tpl.placeholderPng(), type: 'png' as const } : null
    const bytes = buildPptx(
      pages.map((p) => ({
        snapshot: p.snapshot,
        background: p.image,
        frames: tpl
          ? (p.frames ?? []).flatMap((f, j) => {
              const picture = f.picture ?? placeholder
              if (!picture) return []
              const name = tpl.frameName(j, f.box.shape, lang)
              return [{ ...f, picture, name, overlayNames: tpl.frameOverlayNames(name, lang) }]
            })
          : [],
      })),
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
