import { chat } from '../generate'
import type { Settings } from '../settings'
import {
  BRIEF_MAX,
  campaignSection,
  factSnapshot,
  FACTS_SYSTEM,
  getCampaignFormat,
  newFactId,
  parseFacts,
  sortFormats,
  type Campaign,
  type CampaignFact,
  type CampaignFormatId,
} from '../campaign'
import type { Project } from '../project'
import { runNewScreen, type NewScreenHooks, type NewScreenRequest } from './newScreen'

/** Ask the model for the brief's key facts. Throws on a provider error; an unreadable answer is an empty list. */
export async function readCampaignFacts(settings: Settings, brief: string, signal?: AbortSignal): Promise<CampaignFact[]> {
  const content = await chat(
    settings,
    [
      { role: 'system', content: FACTS_SYSTEM },
      // The brief is DATA, not instructions (Q5): fenced and named as such.
      { role: 'user', content: `The campaign brief, between the markers:\n<<<BRIEF\n${brief.slice(0, BRIEF_MAX)}\nBRIEF>>>` },
    ],
    signal,
    undefined,
    undefined,
    'campaign-facts',
  )
  return parseFacts(content).map((f) => ({ id: newFactId(), ...f }))
}

/** A piece made by a campaign run. */
export interface CampaignPiece {
  format: CampaignFormatId
  screenId: string
}

/**
 * Make the campaign's pieces, one generation each, in the catalogue's order.
 *
 * Each piece is an ordinary new screen (`runNewScreen`) of its document type
 * and format, told where it sits in the campaign (`campaignSection`) and
 * stamped with the facts it is written with. What the pieces SHARE is shared
 * by construction rather than copied:
 *
 * - the direction: the first piece writes the project's when it has none, and
 *   every later piece is generated against the project as it is THEN
 *   (`getProject`), like a flow's companion screens;
 * - the pictures: only the first piece may make one (Muse, the document's own
 *   picture — whatever the request allows); every later piece is offered the
 *   project's pictures and asked to reuse them (lib/projectPictures.ts), so a
 *   campaign pays for ONE key visual, not six that disagree;
 * - the facts: every piece gets the same list, verbatim.
 *
 * Failures follow the pipeline's rules: an abort ends the run as it ends any
 * generation, and any other error stops the campaign — the pieces already made
 * stay, and the caller says which ones are missing. A piece that came back
 * with an advisory (`outcome.error`) is a piece, and the run goes on.
 */
export async function runCampaign(
  base: NewScreenRequest,
  hooks: NewScreenHooks,
  campaign: Pick<Campaign, 'brief' | 'facts'>,
  formats: CampaignFormatId[],
  opts: {
    /** The project NOW: the piece that just ended may have set its direction. */
    getProject: () => Project
    /** The name a piece is shown as, in the person's language. */
    nameFor: (format: CampaignFormatId) => string
    /** Every format the campaign has, made or to make — what each piece is told its siblings are. */
    all: CampaignFormatId[]
    /** A piece is about to be made: the n-th of the run. */
    onPiece?: (format: CampaignFormatId, n: number, total: number) => void
  },
): Promise<CampaignPiece[]> {
  const made: CampaignPiece[] = []
  const order = sortFormats(formats)
  const facts = factSnapshot(campaign.facts)
  for (const id of order) {
    if (hooks.signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const format = getCampaignFormat(id)
    if (!format) continue
    opts.onPiece?.(id, made.length + 1, order.length)
    // The first piece of THIS run makes the pictures; a later one, or any
    // piece added to a campaign that already has pieces, reuses them.
    const first = made.length === 0 && !hooks.currentScreens().some((s) => s.campaign)
    const outcome = await runNewScreen(
      {
        ...base,
        text: campaign.brief.trim(),
        name: opts.nameFor(id),
        themeId: format.theme,
        pageFormatId: format.page,
        campaignContext: campaignSection(format, opts.all, campaign.facts),
        campaign: { format: id, facts },
        project: opts.getProject(),
        screens: hooks.currentScreens(),
        // What belonged to a typed request and not to a campaign: screenshots,
        // one-shot switches, a working prototype (paper has no next page).
        images: [],
        annotationCount: 0,
        site: null,
        redesign: false,
        ultraActive: false,
        flows: undefined,
        flowContext: undefined,
        route: undefined,
        ...(first
          ? {}
          : {
              museConfig: { ...base.museConfig, enabled: false },
              docPictureSource: null,
              docImageChoice: 'none' as const,
              pinnedImages: [],
              pinnedVideo: undefined,
              providedPictures: undefined,
              pictureSubject: undefined,
            }),
      },
      hooks,
    )
    made.push({ format: id, screenId: outcome.screenId })
  }
  return made
}
