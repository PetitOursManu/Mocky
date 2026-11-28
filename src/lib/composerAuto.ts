/**
 * The composer's two modes, offered when the instance has a DECISION model
 * (Jev, server/decision/): Manual, the composer as it always was, and Auto,
 * where the decision model reads each new request and says which of Mocky's
 * and Muse's options it runs with (server/decision/composer.js).
 *
 * Three rules, all decided with the user:
 * - Auto decides for ONE generation and never writes a preference. Muse's
 *   switch, the project's Créatif, its Motion Ultra, the Parcours: what the
 *   person set in Manual is still there when they come back to it.
 * - The pictures are NOT decided. In Auto they start on the free libraries,
 *   and the person can pick "AI" (or none) without leaving Auto.
 * - Auto concerns new screens. An edit keeps its screen's options, so the
 *   composer shows Manual's controls while screens are selected.
 */
import { proxyHeaders } from './proxy'
import { SCREEN_THEME_IDS } from './screenThemes'
import type { Settings } from './settings'
import type { ImageChoice } from './stockImages'
import type { DocumentImageChoice } from './documentPictures'

export type ComposerMode = 'manual' | 'auto'

/** What Auto may decide, in the order the composer draws them. Mirrors `AUTO_OPTIONS` in server/decision/composer.js. */
export const AUTO_OPTIONS = ['redesign', 'creative', 'creations', 'muse', 'ultra', 'flows', 'diagrams'] as const
export type AutoOption = (typeof AUTO_OPTIONS)[number]

export interface AutoAnswer {
  on: boolean
  /** The probability of "yes". */
  p: number
  confidence: number | null
}

export interface AutoDecision {
  options: Partial<Record<AutoOption, AutoAnswer>>
  /** Asked and not answered: those keep their Manual value. */
  unanswered: AutoOption[]
  /** Who answered: 'jev', or 'llm' when the decision model failed and the text model stood in. */
  engines: string[]
  notices: string[]
  /**
   * The screen type the request reads as, when the composer had none to give
   * (`chooseType`). `on` is false under the server's threshold: the run then
   * keeps "no type", as Manual would.
   */
  screenType?: { value: string; p: number | null; on: boolean }
  /**
   * Where the hero's scroll video comes from, when the composer offered the
   * question (`videoChoices`). "ai" is a SUGGESTION: a paid clip is asked of
   * the person before it is made (ProjectView), never started on a guess.
   */
  video?: { value: AutoVideo; p: number | null }
}

/** The video sources Auto may choose between. Mirrors VIDEO_CHOICES in server/decision/composer.js. */
export const AUTO_VIDEOS = ['none', 'free', 'motion', 'ai'] as const
export type AutoVideo = (typeof AUTO_VIDEOS)[number]

/** On/off for each option, as one run uses them. */
export type RunOptions = Record<AutoOption, boolean>

const MODE_KEY = 'mocky.composerMode.v1'

/** Manual unless this browser chose Auto: a decision model set up later must not change how anyone's screens are made. */
export function loadComposerMode(): ComposerMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'auto' ? 'auto' : 'manual'
  } catch {
    return 'manual'
  }
}

export function saveComposerMode(mode: ComposerMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    /* private mode: the choice lasts as long as the page */
  }
}

/** Whether this account has a decision model at all. False on any doubt: no Auto is the composer as it was. */
export async function composerAutoAvailable(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch('/api/muse/composer-auto', { signal })
    if (!res.ok) return false
    const body = await res.json().catch(() => null)
    return body?.available === true
  } catch {
    return false
  }
}

/**
 * The options the composer could switch on for this request — only these are
 * asked. Not a document's Motion Ultra (a document skips it, `docUltraSkipped`)
 * nor its flow (companions are for screens); nothing to redesign before a
 * direction exists.
 */
export function offeredOptions(ctx: {
  document: boolean
  hasDirection: boolean
  ultraAllowed: boolean
  creative: boolean
  creations: boolean
  /** The type is a document that draws diagrams only when asked (not a report, not a post). */
  diagrams?: boolean
}): AutoOption[] {
  return AUTO_OPTIONS.filter((o) => {
    if (o === 'redesign') return ctx.hasDirection
    if (o === 'diagrams') return !!ctx.diagrams
    if (o === 'creative') return ctx.creative
    if (o === 'creations') return ctx.creations
    if (o === 'ultra') return ctx.ultraAllowed && !ctx.document
    if (o === 'flows') return !ctx.document
    return true
  })
}

export interface AutoRequest {
  text: string
  lang: 'fr' | 'en'
  screenType: string | null
  document: boolean
  site: 'reproduce' | 'redesign' | null
  project: { name: string; hasDirection: boolean; screens: number }
  offered: AutoOption[]
  /** The composer has no type: let the decision model choose one. */
  chooseType?: boolean
  /** The video sources this account can use for the hero; the question is asked only with some. */
  videoChoices?: Exclude<AutoVideo, 'none'>[]
}

/** Ask. Throws on a refusal or a network failure; the caller degrades to Manual's values. */
export async function decideComposerOptions(req: AutoRequest, settings: Settings, signal?: AbortSignal): Promise<AutoDecision> {
  const res = await fetch('/api/muse/composer-auto', {
    method: 'POST',
    headers: proxyHeaders(settings),
    body: JSON.stringify({ ...req, model: settings.model }),
    signal,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(typeof body?.error === 'string' ? body.error : `HTTP ${res.status}`)
  }
  return readDecision(await res.json())
}

/** A server answer made safe to read: unknown options and malformed answers are dropped. */
export function readDecision(raw: unknown): AutoDecision {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const known = (x: unknown): x is AutoOption => typeof x === 'string' && (AUTO_OPTIONS as readonly string[]).includes(x)
  const options: AutoDecision['options'] = {}
  const src = r.options && typeof r.options === 'object' ? (r.options as Record<string, unknown>) : {}
  for (const [k, v] of Object.entries(src)) {
    if (!known(k) || !v || typeof v !== 'object') continue
    const a = v as Record<string, unknown>
    if (typeof a.on !== 'boolean' || typeof a.p !== 'number') continue
    options[k] = { on: a.on, p: a.p, confidence: typeof a.confidence === 'number' ? a.confidence : null }
  }
  const strings = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [])
  // A type is read only when it is one of the composer's own: anything else
  // would arm a theme no part of the pipeline knows.
  const st = r.screenType && typeof r.screenType === 'object' ? (r.screenType as Record<string, unknown>) : null
  const typeKnown = st && typeof st.value === 'string' && (st.value === 'none' || (SCREEN_THEME_IDS as readonly string[]).includes(st.value))
  const screenType =
    st && typeKnown
      ? { value: st.value as string, p: typeof st.p === 'number' ? st.p : null, on: st.on === true && st.value !== 'none' }
      : undefined
  const v = r.video && typeof r.video === 'object' ? (r.video as Record<string, unknown>) : null
  const video =
    v && typeof v.value === 'string' && (AUTO_VIDEOS as readonly string[]).includes(v.value)
      ? { value: v.value as AutoVideo, p: typeof v.p === 'number' ? v.p : null }
      : undefined
  return {
    options,
    unanswered: strings(r.unanswered).filter(known),
    engines: strings(r.engines),
    notices: strings(r.notices),
    ...(screenType ? { screenType } : {}),
    ...(video ? { video } : {}),
  }
}

/**
 * The Muse settings one run uses for its hero video, once Auto (and, for a
 * paid clip, the person) has answered. Never saved: Auto changes nothing the
 * person set in Manual.
 */
export function museVideoFor<C extends { video: boolean; videoPin: unknown; videoMotion?: boolean; videoFind?: boolean }>(
  config: C,
  choice: AutoVideo,
): C {
  const clean = { ...config, video: false, videoPin: null, videoMotion: false, videoFind: false }
  if (choice === 'ai') return { ...clean, video: true }
  if (choice === 'motion') return { ...clean, videoMotion: true }
  if (choice === 'free') return { ...clean, videoFind: true }
  return clean
}

/**
 * The options one run uses: the decision's answer where it gave one, Manual's
 * value everywhere else — an option not offered, not answered, or a decision
 * that failed altogether (null). Pure, so the rule is a test and not a reading.
 */
export function runOptionsFor(decision: AutoDecision | null, offered: readonly AutoOption[], manual: RunOptions): RunOptions {
  const out = { ...manual }
  if (!decision) return out
  for (const o of offered) {
    const a = decision.options[o]
    if (a) out[o] = a.on
  }
  return out
}

/** Auto's pictures: the free libraries first, then what this account can open. Never "AI" by default. */
export function autoImageDefault(choices: readonly ImageChoice[]): ImageChoice {
  return choices.includes('stock') ? 'stock' : choices.includes('none') ? 'none' : (choices[0] ?? 'none')
}

/** The same for a document: a free photo when the libraries are open, else no picture — never a paid one unasked. */
export function autoDocImageDefault(choices: readonly DocumentImageChoice[]): DocumentImageChoice {
  return choices.includes('stock') ? 'stock' : 'none'
}
