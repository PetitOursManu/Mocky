import { getPageFormat, isPageFormat, type PageFormatId } from './pageFormats'
import type { FoldId } from './folds'

/**
 * "Parcours" for a DOCUMENT — the pages that follow one another in a piece of
 * paper or a post, where a prototype has screens that open one another.
 *
 * The composer's Parcours switch used to stop at the edge of documents ("paper
 * has no next page", newScreen.ts), and that was true of the flow KIT — there is
 * no `MockyFlow.go` on a sheet — but not of the idea: a flyer has a back, a post
 * can be a carousel, and a person who switched Parcours on for a flyer was
 * asking for both faces. So for a document the switch means a SEQUENCE of pages
 * with a role each, stated to the model the way a companion screen is told its
 * place in a flow (`companionSection`), and nothing else changes.
 *
 * Off, nothing here is asked and the prompt is byte for byte the one it was
 * (V7). A folded leaflet has its faces from the fold whatever the switch says
 * (`foldHint`), so it gets no second list to argue with; a poster has no back;
 * a report, a manual or an invoice already runs to several pages by its own
 * brief; a magazine or a book is a publication (lib/publication.ts), whose
 * sheets each get their own place in the issue.
 */

export type DocSequenceKind = 'recto-verso' | 'carousel' | 'stories'

/** Types whose paper has a back worth designing. */
const TWO_SIDED = new Set(['flyer', 'menu'])

/** How many images a carousel is asked for when the request does not say. */
export const CAROUSEL_PAGES = 5

export function documentSequenceKind(
  themeId: string | null | undefined,
  page: PageFormatId | null | undefined,
  fold?: FoldId | null,
): DocSequenceKind | null {
  if (!page || !isPageFormat(page) || fold) return null
  const format = getPageFormat(page)
  if (format.kind === 'social') return format.id === 'social-story' ? 'stories' : 'carousel'
  if (format.kind === 'print' && themeId && TWO_SIDED.has(themeId)) return 'recto-verso'
  return null
}

/** The section appended to the plan, or undefined when this document has no sequence. */
export function documentSequenceSection(
  themeId: string | null | undefined,
  page: PageFormatId | null | undefined,
  fold?: FoldId | null,
): string | undefined {
  const kind = documentSequenceKind(themeId, page, fold)
  if (!kind) return undefined
  if (kind === 'recto-verso') {
    return [
      'PAGE SEQUENCE — this piece is printed RECTO-VERSO: write exactly 2 <Page>s, in this order.',
      '1. RECTO (the front) — what stops someone: the headline, the one picture or composition, the essential facts. It must work alone, as if the back did not exist.',
      '2. VERSO (the back) — what the person turns it over for: the detail (programme, list, prices, how it works), the practical information (address, a small map placeholder, opening hours, access), the call to action again, and the coupon if the request implies one.',
      'Both faces share the same palette, wordmark and grid so they read as one sheet, but the verso is not a copy of the recto: it carries what the recto had no room for.',
    ].join('\n')
  }
  const what = kind === 'stories' ? 'a SEQUENCE OF STORIES, tapped through one at a time' : 'a CAROUSEL, swiped one image at a time'
  return [
    `PAGE SEQUENCE — this post is ${what}: write ${CAROUSEL_PAGES} <Page>s, in this order, unless the request names another number.`,
    `1. THE HOOK — a promise or a question that makes the next image worth seeing, set huge.`,
    `2 to ${CAROUSEL_PAGES - 1}. ONE IDEA PER PAGE — a step, a reason, a figure or an example, numbered, each readable on its own.`,
    `${CAROUSEL_PAGES}. THE CALL TO ACTION — what to do now (follow, save, book, the link), with the wordmark.`,
    `Every page carries the same wordmark in the same corner and a page counter ("2/${CAROUSEL_PAGES}"); the grid, the palette and the type stay the same from page to page so the sequence reads as one piece${
      kind === 'carousel' ? ', and a shape or a line may run off the right edge of one page and continue on the left edge of the next to invite the swipe' : ''
    }.`,
  ].join('\n')
}
