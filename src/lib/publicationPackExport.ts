import { capsForScreen, exportDocument } from './docExport'
import { renderDocument } from './docExport/render'
import { DEFAULT_PAGE_FORMAT, getPageFormat } from './pageFormats'
import type { Screen } from './project'
import type { CampaignFormatId } from './campaign'
import { makeZip, type ZipInput } from './zip'
import { FORMAT_NETWORK, packFileNames, packTextFiles, slug, type PackTexts } from './publicationPack'

/**
 * The publication pack as one .zip: every visual rendered the way the download
 * dialog renders it (a print piece as its PDF, a posted piece as one PNG per
 * page — what Calendy receives too), then the text files of
 * `packTextFiles`. A piece that cannot be rendered is left out and NAMED, and
 * the rest still downloads (degrade, never fail).
 */
export interface PackPieceInput {
  screen: Screen
  format: CampaignFormatId
  label: string
}

export interface PackZip {
  blob: Blob
  filename: string
  files: number
  /** Names of the pieces that could not be rendered. */
  failed: string[]
}

export async function buildPackZip(
  campaignName: string,
  pieces: PackPieceInput[],
  texts: Omit<PackTexts, 'formatLabel'>,
  opts: { signal?: AbortSignal; lang?: 'fr' | 'en'; onProgress?: (done: number, total: number, name: string) => void } = {},
): Promise<PackZip> {
  const rendered: { piece: PackPieceInput; pages: Uint8Array[] }[] = []
  const failed: string[] = []
  for (const [i, p] of pieces.entries()) {
    opts.onProgress?.(i, pieces.length, p.screen.name)
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      if (FORMAT_NETWORK[p.format]) {
        const format = getPageFormat(p.screen.page ?? DEFAULT_PAGE_FORMAT)
        const { pages } = await renderDocument(p.screen.code, capsForScreen(p.screen), format, { purpose: 'png', signal: opts.signal })
        rendered.push({ piece: p, pages: pages.map((pg) => pg.image) })
      } else {
        const res = await exportDocument(p.screen, 'pdf', { signal: opts.signal, lang: opts.lang })
        rendered.push({ piece: p, pages: [new Uint8Array(await res.blob.arrayBuffer())] })
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err
      failed.push(p.screen.name)
    }
  }
  opts.onProgress?.(pieces.length, pieces.length, '')

  const names = packFileNames(rendered.map((r) => ({ screenId: r.piece.screen.id, format: r.piece.format, label: r.piece.label, pages: r.pages.length })))
  const entries: ZipInput[] = []
  for (const f of names) {
    const r = rendered.find((x) => x.piece.screen.id === f.screenId)
    if (!r) continue
    // A print piece is ONE file however many pages; a posted one, one per page.
    const bytes = FORMAT_NETWORK[f.format] ? r.pages[f.page - 1] : r.pages[0]
    if (bytes) entries.push({ name: f.name, content: bytes })
  }
  const labelOf = new Map(pieces.map((p) => [p.format, p.label]))
  for (const t of packTextFiles(names, { ...texts, formatLabel: (fmt) => labelOf.get(fmt) ?? fmt })) entries.push(t)
  return { blob: makeZip(entries), filename: `${slug(campaignName || 'campagne')}-pack.zip`, files: names.length, failed }
}
