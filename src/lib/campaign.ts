/**
 * Campaign Studio: one brief, several pieces — a poster, a flyer, a post, a
 * story — each COMPOSED for its own format, sharing the facts, the art
 * direction and the pictures.
 *
 * Decided with the user: a project IS a campaign. Its direction and its
 * pictures were already the project's (`lib/projectPictures.ts`), so the only
 * new record is the brief and its facts (`Project.campaign`), and on each piece
 * the facts it was WRITTEN with (`Screen.campaign`). That second record is what
 * makes "change the date, then pick what to update" possible without asking a
 * model which piece says what: a piece is out of date exactly when a fact it
 * was written with no longer has that value. On the screen rather than in the
 * project's brief, so a version restored or a screen reverted carries its own
 * answer with it.
 *
 * Why each piece is a generation and never a resize: a story is not a cropped
 * poster. The hierarchy changes with the distance it is read from and the time
 * it is looked at — a poster is read from three metres, a story for three
 * seconds on a phone — so each piece is the type that already knows its format
 * (`lib/screenThemes.ts`), told it belongs to a campaign (`campaignSection`).
 */
import type { PageFormatId } from './pageFormats'
import type { ScreenThemeId } from './screenThemes'

export type CampaignFormatId = 'poster' | 'flyer' | 'instagram' | 'story' | 'linkedin' | 'facebook'

export interface CampaignFormat {
  id: CampaignFormatId
  /** The document type that composes it — its structure, its margins. */
  theme: ScreenThemeId
  page: PageFormatId
  /** What this piece is FOR, for the model: where it is seen, and so what it shows. */
  role: string
}

/**
 * The pieces a campaign can have, in the order they are made.
 *
 * The poster first: it is the piece with the most room for the key visual, and
 * the first piece is the one whose picture and direction the others inherit —
 * a story that set the look would hand a 9:16 crop to an A3 page. The story is
 * the `instagram` type on the 9:16 format, which the type already accepts; its
 * role line is what turns a feed post into a story.
 */
export const CAMPAIGN_FORMATS: readonly CampaignFormat[] = [
  {
    id: 'poster',
    theme: 'poster',
    page: 'a3',
    role: 'the A3 POSTER, seen on a wall from three metres: the title and the key-facts block dominate, almost nothing else',
  },
  {
    id: 'flyer',
    theme: 'flyer',
    page: 'a4',
    role: 'the A4 FLYER, read in the hand: every key fact, the highlights and the call to action',
  },
  {
    id: 'instagram',
    theme: 'instagram',
    page: 'social-portrait',
    role: 'the INSTAGRAM POST (4:5) in a feed: one hook, the date, the call to action — ONE page, not a carousel',
  },
  {
    id: 'story',
    theme: 'instagram',
    page: 'social-story',
    role: 'the INSTAGRAM STORY (9:16), full screen on a phone for a few seconds: the hook, the date and the call to action, set large in the middle band — ONE page, not a carousel',
  },
  {
    id: 'linkedin',
    theme: 'linkedin',
    page: 'social-square',
    role: 'the LINKEDIN visual (1:1), professional in tone: the title, the one fact that matters most and who is behind it — ONE page',
  },
  {
    id: 'facebook',
    theme: 'facebook',
    page: 'social-landscape',
    role: 'the FACEBOOK visual (1.91:1), a wide banner beside the post\'s own text: the title and the date or place — ONE page',
  },
]

export const CAMPAIGN_FORMAT_IDS = CAMPAIGN_FORMATS.map((f) => f.id)

export function getCampaignFormat(id: string | undefined): CampaignFormat | undefined {
  return CAMPAIGN_FORMATS.find((f) => f.id === id)
}

export function isCampaignFormatId(id: unknown): id is CampaignFormatId {
  return typeof id === 'string' && (CAMPAIGN_FORMAT_IDS as string[]).includes(id)
}

/** One piece of information every piece states the same way: a date, a place. */
export interface CampaignFact {
  id: string
  label: string
  value: string
}

/** The campaign's brief: what `Project.campaign` holds. */
export interface Campaign {
  brief: string
  facts: CampaignFact[]
  /** The formats ticked — the ones made, and the ones to make next. */
  formats: CampaignFormatId[]
}

/** What a piece records about itself: `Screen.campaign`. */
export interface ScreenCampaign {
  format: CampaignFormatId
  /** fact id → the value the piece was written with. */
  facts: Record<string, string>
}

export const BRIEF_MAX = 4000
export const FACTS_MAX = 10
export const FACT_LABEL_MAX = 40
export const FACT_VALUE_MAX = 200

const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '')

let factSeq = 0
export function newFactId(): string {
  factSeq = (factSeq + 1) % 1e6
  return `f${Date.now().toString(36)}${factSeq.toString(36)}`
}

/** A stored campaign, validated — or undefined when there is nothing worth keeping. */
export function normalizeCampaign(c: unknown): Campaign | undefined {
  if (!c || typeof c !== 'object') return undefined
  const raw = c as Partial<Campaign>
  const brief = typeof raw.brief === 'string' ? raw.brief.slice(0, BRIEF_MAX) : ''
  const seen = new Set<string>()
  const facts: CampaignFact[] = []
  for (const f of Array.isArray(raw.facts) ? raw.facts : []) {
    if (!f || typeof f !== 'object') continue
    const id = typeof f.id === 'string' && f.id ? f.id.slice(0, 40) : newFactId()
    const label = clip(f.label, FACT_LABEL_MAX)
    if (!label || seen.has(id)) continue
    seen.add(id)
    facts.push({ id, label, value: typeof f.value === 'string' ? f.value.trim().slice(0, FACT_VALUE_MAX) : '' })
    if (facts.length >= FACTS_MAX) break
  }
  const formats = [...new Set(Array.isArray(raw.formats) ? raw.formats.filter(isCampaignFormatId) : [])]
  if (!brief.trim() && !facts.length) return undefined
  // No list at all means every format; an EMPTY list is a choice, and stays one.
  return { brief, facts, formats: Array.isArray(raw.formats) ? sortFormats(formats) : [...CAMPAIGN_FORMAT_IDS] }
}

/** A stored piece record, validated, or undefined. */
export function normalizeScreenCampaign(c: unknown): ScreenCampaign | undefined {
  if (!c || typeof c !== 'object') return undefined
  const raw = c as Partial<ScreenCampaign>
  if (!isCampaignFormatId(raw.format)) return undefined
  const facts: Record<string, string> = {}
  if (raw.facts && typeof raw.facts === 'object') {
    for (const [k, v] of Object.entries(raw.facts)) if (typeof v === 'string') facts[k.slice(0, 40)] = v.slice(0, FACT_VALUE_MAX)
  }
  return { format: raw.format, facts }
}

/** The formats in the catalogue's order, which is the order they are made in. */
export function sortFormats(ids: CampaignFormatId[]): CampaignFormatId[] {
  return CAMPAIGN_FORMAT_IDS.filter((id) => ids.includes(id))
}

/** The facts as a piece records them: only those with a value. */
export function factSnapshot(facts: CampaignFact[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of facts) if (f.value.trim()) out[f.id] = f.value.trim()
  return out
}

/** A fact whose value changed since a piece was written. */
export interface FactChange {
  id: string
  label: string
  from: string
  to: string
}

/**
 * What changed for one piece. A fact the piece was never written with (added
 * to the brief later) is not a change for it — it never said anything about
 * it, and "update" would mean adding it, which is a design decision, not an
 * update. A fact deleted from the brief is not one either: removing words from
 * a finished piece is an edit the person asks for in their own words.
 */
export function factChanges(facts: CampaignFact[], written: ScreenCampaign | undefined): FactChange[] {
  if (!written) return []
  const out: FactChange[] = []
  for (const f of facts) {
    const from = written.facts[f.id]
    if (from === undefined) continue
    const to = f.value.trim()
    if (to !== from) out.push({ id: f.id, label: f.label, from, to })
  }
  return out
}

/**
 * The generation section that makes a piece part of the campaign.
 *
 * The facts are asked for VERBATIM and in one unbroken run of text, with the
 * case left to CSS: that is what lets a later change be a text replacement
 * rather than a model call (`replaceFacts`). Which facts a piece shows stays
 * its own call — a story has no room for an address — so the list is what may
 * be said, never what must.
 */
export function campaignSection(format: CampaignFormat, all: CampaignFormatId[], facts: CampaignFact[]): string {
  const others = sortFormats(all)
    .filter((id) => id !== format.id)
    .map((id) => getCampaignFormat(id)?.role.split(',')[0].split(':')[0])
    .filter(Boolean)
  const stated = facts.filter((f) => f.value.trim())
  return [
    `CAMPAIGN — this piece is ${format.role}.`,
    others.length
      ? `It is one of a coordinated campaign that also has ${others.join('; ')}. Every piece shares the art direction, the pictures and the key facts, but each is COMPOSED for its own format — its own layout, hierarchy and crop — never a scaled, cropped or stretched copy of another piece.`
      : 'It is the first piece of a campaign: the others will share its art direction, its pictures and these facts.',
    stated.length
      ? [
          'KEY FACTS — when this piece shows one, write its value EXACTLY as given, character for character, as ONE unbroken run of text: never split it across elements, never reword, abbreviate, translate or re-case it in the source (use CSS for upper case). Choose which ones this format has room for; never state a fact that contradicts them.',
          ...stated.map((f) => `- ${f.label}: ${f.value.trim()}`),
        ].join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

// ---------------------------------------------------------------------------
// Reading the facts off a brief: one small model call.
// ---------------------------------------------------------------------------

export const FACTS_SYSTEM = `You read the brief of a communication campaign (an event, an offer, a launch) and list its KEY FACTS: the pieces of information every creation of the campaign must state identically.

Typically: the name of what is announced (label it as a title), the date or dates, the time, the place or address, the price or the offer, the call to action (a URL, a phone number, where to book), the organiser.

Rules:
- Only facts the brief STATES. Never invent, complete or guess one.
- Copy each value EXACTLY as the brief writes it — same spelling, same language, same punctuation.
- Labels are one or two words, in the brief's language.
- At most ${FACTS_MAX} facts, the most important first.

Answer with ONLY a JSON object: {"facts":[{"label":"…","value":"…"}]}`

/** The model's answer, read leniently: a fence or a sentence around the object is tolerated. */
export function parseFacts(content: string): Array<{ label: string; value: string }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    const a = content.indexOf('{')
    const b = content.lastIndexOf('}')
    if (a < 0 || b <= a) return []
    try {
      parsed = JSON.parse(content.slice(a, b + 1))
    } catch {
      return []
    }
  }
  const list = parsed && typeof parsed === 'object' ? (parsed as { facts?: unknown }).facts : undefined
  if (!Array.isArray(list)) return []
  const out: Array<{ label: string; value: string }> = []
  for (const f of list) {
    const label = clip(f?.label, FACT_LABEL_MAX)
    const value = clip(f?.value, FACT_VALUE_MAX)
    if (label && value && !out.some((o) => o.label.toLowerCase() === label.toLowerCase())) out.push({ label, value })
    if (out.length >= FACTS_MAX) break
  }
  return out
}
