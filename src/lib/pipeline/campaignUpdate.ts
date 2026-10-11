import { factChanges, factSnapshot, type CampaignFact, type ScreenCampaign } from '../campaign'
import { factEditInstruction, replaceFacts } from '../campaignFacts'
import { detectComponentName } from '../generate'
import type { Screen } from '../project'
import type { Settings } from '../settings'
import { editScreen } from './screenPasses'

export interface UpdatedPiece {
  code: string
  componentName: Screen['componentName']
  /** For `Screen.caps`, when a model rewrote the source. */
  caps?: string[]
  /** 'direct' when no model was needed; 'model' when one wrote part of it. */
  how: 'direct' | 'model'
  /** The piece's new record: the facts it now says. */
  campaign: ScreenCampaign
}

/**
 * Bring one piece up to the brief's facts.
 *
 * Direct first (`replaceFacts`): every change the source states as a plain run
 * of text is written in place, and nothing else moves. Whatever is left — a
 * value split across two elements, a fact cleared — goes to ONE targeted edit
 * (`factEditInstruction`, the ordinary edit pass), on the source that already
 * carries the direct writes. Decided with the user: direct when possible, a
 * model otherwise.
 *
 * Returns null when the piece says nothing that changed. Throws what the edit
 * throws; the caller owns the write-back (`codeAtStart`, `previousCode`).
 */
export async function updateCampaignPiece(req: {
  settings: Settings
  screen: Screen
  facts: CampaignFact[]
  designMd: string | undefined
  signal?: AbortSignal
  onPartial?: (partial: string) => void
}): Promise<UpdatedPiece | null> {
  const { screen } = req
  if (!screen.campaign) return null
  const changes = factChanges(req.facts, screen.campaign)
  if (!changes.length) return null
  // The record keeps the facts the piece was written with, plus the new
  // values of the ones that changed — a fact added to the brief since is
  // still not one this piece says.
  const campaign: ScreenCampaign = {
    format: screen.campaign.format,
    facts: { ...screen.campaign.facts },
  }
  const now = factSnapshot(req.facts)
  for (const c of changes) {
    if (now[c.id] !== undefined) campaign.facts[c.id] = now[c.id]
    else delete campaign.facts[c.id]
  }

  const direct = await replaceFacts(
    screen.code,
    changes.map((c) => ({ from: c.from, to: c.to })),
  )
  if (!direct.remaining.length) {
    return { code: direct.code, componentName: detectComponentName(direct.code), how: 'direct', campaign }
  }
  const left = changes.filter((c) => direct.remaining.some((r) => r.from === c.from && r.to === c.to))
  const res = await editScreen({
    settings: req.settings,
    instruction: factEditInstruction(left),
    screen: { ...screen, code: direct.code },
    designMd: req.designMd,
    signal: req.signal,
    onPartial: req.onPartial,
  })
  return { code: res.code, componentName: res.componentName, caps: res.caps, how: 'model', campaign }
}
