import type { Capability } from '../capabilities/types'
import type { PageFormat } from '../pageFormats'
import { makeTiltTest, snapshotPage } from './measure'
import { openSettledDocument } from './render'
import type { OutsideItem, PageExcess } from './types'

/**
 * "Ajuster à la page": what a document's pages lose at the trim, measured, so
 * a correction can be asked for in numbers and checked in the same numbers.
 *
 * The notice that offers it ("le contenu dépasse de la page 1") came with no
 * way to act on it but rewording a prompt, and the model that wrote the page
 * never saw it rendered: it guessed a height and the guess was 106 px long. A
 * correction told only "it overflows" guesses again. So the page is rendered
 * the way the export reads it (`openSettledDocument`), measured by the
 * export's own definition (`snapshotPage` — glyphs and fields, never a shape
 * that bleeds), and the model is told by how much and which words; the answer
 * is then rendered and measured again BEFORE it is written back, because a
 * rewrite that moved the overflow to another page, or made it worse, must not
 * replace a page that was only too long.
 *
 * Not the repair loop (nothing failed to render), not the polish (nothing is
 * wrong with the design), not an edit (the person asked for nothing but the
 * fit): its own prompt, `FIT_PROMPT` in generate.ts, for the reason the other
 * three have theirs.
 */

export interface PageOverflow {
  /** 1-based. */
  page: number
  excess: PageExcess
  outside: OutsideItem[]
}

export interface FitReport {
  /** How many pages the document holds. */
  pages: number
  /** Only the pages that overflow, in order. Empty: everything fits. */
  over: PageOverflow[]
}

/** Differences under this are layout noise, not a correction that landed or failed. */
export const FIT_NOISE_PX = 4

/** Render a document offscreen and measure what crosses each page's edge. */
export async function measureFit(
  code: string,
  caps: Capability[],
  format: PageFormat,
  signal?: AbortSignal,
): Promise<FitReport> {
  const { frame, pages, close } = await openSettledDocument(code, caps, format, signal)
  try {
    const over: PageOverflow[] = []
    pages.forEach((el, i) => {
      const snap = snapshotPage(frame.win, el, i, format.w, format.h, makeTiltTest(frame.win, el))
      if (snap.overflow && snap.excess) over.push({ page: i + 1, excess: snap.excess, outside: snap.outside ?? [] })
    })
    return { pages: pages.length, over }
  } finally {
    close()
  }
}

/** The worst crossing of one page, whichever edge it is. */
export function pageExcessPx(p: Pick<PageOverflow, 'excess'>): number {
  const e = p.excess
  return Math.max(e.top, e.right, e.bottom, e.left)
}

/** One number for a whole document: the sum of every page's worst crossing. */
export function totalExcessPx(r: FitReport): number {
  return r.over.reduce((sum, p) => sum + pageExcessPx(p), 0)
}

export type FitVerdict =
  /** Nothing crosses any edge any more. */
  | 'fits'
  /** Still over, but by less, on no page that was clear before. Worth keeping. */
  | 'closer'
  /** No better — or worse, or the page count changed. The original stays. */
  | 'rejected'

/**
 * Is the rewrite worth writing back?
 *
 * A page count that moved is rejected even when everything then fits: the
 * button says "fit to the page", and a second page is a different document —
 * the person's to ask for, which the notice already tells them they can.
 * A page that was clear and now overflows is rejected however much the others
 * improved: the export would cut something that was whole.
 */
export function fitVerdict(before: FitReport, after: FitReport): FitVerdict {
  if (after.pages !== before.pages) return 'rejected'
  if (after.over.length === 0) return 'fits'
  const wasOver = new Set(before.over.map((p) => p.page))
  if (after.over.some((p) => !wasOver.has(p.page))) return 'rejected'
  return totalExcessPx(after) < totalExcessPx(before) - FIT_NOISE_PX ? 'closer' : 'rejected'
}

const EDGE_WORDS: Record<keyof PageExcess, string> = {
  bottom: 'past the BOTTOM edge',
  right: 'past the RIGHT edge',
  top: 'past the TOP edge',
  left: 'past the LEFT edge',
}

/**
 * The measurement, as the model will read it. Every number is the page's own
 * pixels, the unit the Tailwind classes in the code are written in — the model
 * can subtract `mt-7` from 106 px, it cannot subtract it from "a bit too long".
 */
export function fitFindings(report: FitReport, format: PageFormat): string {
  const lines: string[] = [`Every page is exactly ${format.w} × ${format.h} px. Content past an edge is cut when printed.`, '']
  for (const p of report.over) {
    const edges = (Object.keys(EDGE_WORDS) as (keyof PageExcess)[])
      .filter((k) => p.excess[k] > 0)
      .map((k) => `${p.excess[k]} px ${EDGE_WORDS[k]}`)
    lines.push(`Page ${p.page}: content runs ${edges.join(', and ')}.`)
    const texts = p.outside.filter((o) => !o.field && o.text.trim()).map((o) => `"${o.text.trim()}"`)
    const fields = p.outside.filter((o) => o.field).map((o) => `"${o.text || '?'}"`)
    if (texts.length) lines.push(`  Text outside the page: ${texts.join(', ')}.`)
    if (fields.length) lines.push(`  Fillable fields outside the page: ${fields.join(', ')}.`)
  }
  return lines.join('\n')
}
