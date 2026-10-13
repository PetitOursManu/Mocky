import { chat } from '../generate'
import type { Settings } from '../settings'
import type { PageFormatId } from '../pageFormats'
import {
  BRIEF_MAX,
  addInsideSheet,
  shapePlan,
  firstPages,
  newPublicationId,
  parsePlan,
  PLAN_SYSTEM,
  publicationSection,
  type Publication,
  type PublicationKind,
} from '../publication'
import { runNewScreen, type NewScreenHooks, type NewScreenRequest } from './newScreen'

/**
 * Plan a publication: one model call for its sheets, bounded, and a fixed plan
 * per kind when the answer cannot be read — a magazine with a sensible default
 * shape beats no magazine (degrade, never fail). Throws only what a provider
 * error or an abort throws.
 */
export async function planPublication(
  settings: Settings,
  kind: PublicationKind,
  brief: string,
  page: PageFormatId,
  opts: { lang: 'fr' | 'en'; fallbackTitle: string; signal?: AbortSignal },
): Promise<Publication> {
  let plan: ReturnType<typeof parsePlan> = null
  try {
    const content = await chat(
      settings,
      [
        { role: 'system', content: PLAN_SYSTEM },
        // The request is DATA, not instructions (Q5): fenced and named as such.
        { role: 'user', content: `Kind: ${kind}.\nThe request, between the markers:\n<<<REQUEST\n${brief.slice(0, BRIEF_MAX)}\nREQUEST>>>` },
      ],
      opts.signal,
      undefined,
      undefined,
      'publication-plan',
    )
    plan = parsePlan(content)
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err
    if (opts.signal?.aborted) throw err
  }
  return {
    id: newPublicationId(),
    kind,
    title: plan?.title || opts.fallbackTitle,
    brief,
    page,
    sheets: shapePlan(plan?.sheets ?? [], kind, opts.lang),
    createdAt: Date.now(),
  }
}

/** A sheet made by a publication run. */
export interface PublicationPiece {
  sheet: string
  screenId: string
}

/**
 * Make a publication's sheets, one generation each, in the plan's order.
 *
 * The first sheet runs Muse on the publication's brief (when the server has
 * it), and the direction it was generated under becomes the publication's —
 * handed to `onDirection` the moment it exists, so a run cancelled at sheet
 * three still leaves a publication whose next sheet looks like the first two.
 * Every later sheet is generated under that direction with Muse off: ONE
 * dossier for the volume, which is the whole point of making it this way.
 *
 * `fromIndex` lets a caller resume or add sheets to a publication that already
 * has a direction. Failures follow `runCampaign`'s rules: an abort ends the run,
 * any other error stops it with the sheets already made kept.
 */
export async function runPublication(
  base: NewScreenRequest,
  hooks: NewScreenHooks,
  publication: Publication,
  opts: {
    /** The project NOW, for each sheet. */
    getProject: () => NewScreenRequest['project']
    /** The publication's direction exists (first sheet made). */
    onDirection: (direction: string) => void
    /** A sheet is about to be made: the n-th of the run. */
    onSheet?: (title: string, n: number, total: number) => void
    fromIndex?: number
    /** Make this one sheet only (a page the person added). */
    only?: number
    /** The words the sheet is generated from, when they are not the publication's brief. */
    text?: string
  },
): Promise<PublicationPiece[]> {
  const made: PublicationPiece[] = []
  const starts = firstPages(publication.sheets)
  let direction = publication.direction
  const from = Math.max(0, opts.only ?? opts.fromIndex ?? 0)
  const to = opts.only !== undefined ? Math.min(publication.sheets.length, opts.only + 1) : publication.sheets.length
  for (let i = from; i < to; i++) {
    if (hooks.signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const sheet = publication.sheets[i]
    opts.onSheet?.(sheet.title, i - from + 1, to - from)
    const first = !direction
    const outcome = await runNewScreen(
      {
        ...base,
        text: opts.text?.trim() || publication.brief.trim() || sheet.brief || sheet.title,
        name: `${publication.title} — ${sheet.title}`,
        themeId: publication.kind,
        pageFormatId: publication.page,
        foldId: null,
        publicationContext: publicationSection(publication, i),
        publication: { direction, record: { id: publication.id, sheet: sheet.id, index: i, firstPage: starts[i] } },
        project: opts.getProject(),
        screens: hooks.currentScreens(),
        // What belonged to a typed request and not to a volume.
        images: [],
        annotationCount: 0,
        site: null,
        redesign: false,
        ultraActive: false,
        flows: undefined,
        flowContext: undefined,
        route: undefined,
        campaign: undefined,
        campaignContext: undefined,
        // The dossier is the first sheet's to write, and only its.
        museConfig: { ...base.museConfig, enabled: first && base.museAvail !== false },
      },
      hooks,
    )
    made.push({ sheet: sheet.id, screenId: outcome.screenId })
    if (first && outcome.direction?.trim()) {
      direction = outcome.direction
      opts.onDirection(direction)
    }
  }
  return made
}

/**
 * Add one inside page to a publication the person is growing, from their own
 * words: before the back cover, under the publication's direction, Muse off.
 * `onPublication` receives the publication with its new sheet BEFORE the page
 * is generated — the sheet is part of the plan from then on, so a contents
 * page made later lists it, and a run cancelled midway leaves a plan that says
 * where the page was meant to go.
 */
export async function addPublicationPage(
  base: NewScreenRequest,
  hooks: NewScreenHooks,
  publication: Publication,
  request: string,
  opts: {
    getProject: () => NewScreenRequest['project']
    onPublication: (publication: Publication) => void
    /** A short title for the new page — the composer's derived screen name. */
    title: string
  },
): Promise<PublicationPiece | null> {
  const { publication: grown, index } = addInsideSheet(publication, opts.title, request)
  opts.onPublication(grown)
  let current = grown
  const made = await runPublication(base, hooks, grown, {
    getProject: opts.getProject,
    only: index,
    text: request,
    // Only when the publication had no direction yet (its first sheet was
    // cancelled): this page then writes it, like a first sheet would.
    onDirection: (direction) => {
      current = { ...current, direction }
      opts.onPublication(current)
    },
  })
  return made[0] ?? null
}
