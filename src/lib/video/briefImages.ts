// "Make me some pictures for THIS film" — the third way a photograph reaches the
// pool, as state rather than as JSX.
//
// ── Why this is not `variantFlow.ts` with a different label ──────────────────
//
// The two look alike from the outside — both spend provider calls, both produce
// unconfirmed pictures, both end at a grid of tick boxes — and they answer
// different questions, which is the only reason a second module is allowed here.
//
// `variantFlow` answers "several takes of ONE picture": it asks for a subject of
// its own, makes a model image, gates it, and then derives siblings from that
// image. Every step is about a single photograph somebody is choosing.
//
// This answers "pictures for the film I have already described". There is no
// second subject and there must not be one: the brief is on the panel, three
// centimetres above this control, and asking a person to type what their film is
// about twice is asking them twice. There is no model image and no derivation —
// N calls against one sentence, N different pictures, a pool the composer may
// use or ignore.
//
// What they share is what they should: `generateImage(…, { pending: true })`,
// `confirmImage`, `SOURCE_DIMENSIONS` and the gate's own grid. The panel draws
// both gates with one component for exactly that reason.
//
// ── And the flag is the guarantee, not a detail ──────────────────────────────
//
// Everything made here arrives `pending: true` and stays out of every listing
// and out of every montage until a human has looked at it. Nothing in this
// module enforces that — the guard is `pendingAmong()` and the 409 in
// server/video/routes.js — but the gate below is what stops the server ever
// having to refuse anybody.

/**
 * How many pictures one press may buy.
 *
 * The ceiling is FOUR, and it is the same argument `DEFAULT_VARIANT_COUNT`
 * makes one file over: it is a grid taken in at a glance, and it is already the
 * most anybody should spend before looking at a single result. The pool holds
 * far more than four — `IMAGE_CAP` is twelve — so this is not a capacity bound,
 * it is a bound on how much money one click can spend without a second thought.
 *
 * The floor is ONE because the user's own sentence was "one or several": a
 * single picture for a single scene is a legitimate request, and a control whose
 * minimum is two would be charging for a choice nobody asked for.
 */
export const MIN_BRIEF_IMAGES = 1
export const MAX_BRIEF_IMAGES = 4

/**
 * What the count opens on.
 *
 * Two rather than one or four. One produces a picture with nothing to compare it
 * against, which turns the gate below into a yes/no on a fait accompli; four is
 * four paid calls chosen by a default rather than by a person. Two is the
 * smallest number that is a choice.
 */
export const DEFAULT_BRIEF_IMAGES = 2

export interface BriefImagesState {
  /** Ticked or not. The whole control is opt-in: nothing here happens by itself. */
  on: boolean
  count: number
  /**
   * The hashes that came back, unconfirmed, or nothing yet.
   *
   * Deduplicated by the caller before it lands here: the image store is
   * content-addressed, so two seeds that happen to produce identical bytes are
   * one entry, and a grid with the same hash twice is two tick boxes wired to
   * one picture.
   */
  batch: string[] | null
  /** Hashes ticked in the gate. Everything else stays pending, for good. */
  chosen: string[]
  /**
   * How many of the pictures asked for never arrived.
   *
   * Carried rather than recomputed, because the count is not derivable from the
   * batch once it is on screen: `count` may have been changed since, and a
   * partial failure that says nothing is a grid of two where four were paid for
   * (Q1 — degrade, and say what degraded).
   */
  missed: number
}

export function emptyBriefImages(count = DEFAULT_BRIEF_IMAGES, on = false): BriefImagesState {
  return { on, count, batch: null, chosen: [], missed: 0 }
}

/**
 * Where in the flow we are. Derived, never stored beside the state.
 *
 * Same reason `stepOf` gives next door: a `step` field and a `batch` field can
 * disagree, and the disagreement draws as a gate with nothing behind it.
 */
export type BriefImagesStep = 'off' | 'ask' | 'choose'

export function briefImagesStep(state: BriefImagesState): BriefImagesStep {
  if (!state.on) return 'off'
  return state.batch ? 'choose' : 'ask'
}

/**
 * The largest number this press may ask for, given what the pool can still hold.
 *
 * Zero is a real answer — the pool is full — and the caller shows the "no room"
 * sentence rather than a select with nothing in it.
 */
export function briefImagesCeiling(room: number): number {
  const r = Math.floor(Number(room))
  if (!Number.isFinite(r) || r <= 0) return 0
  return Math.min(MAX_BRIEF_IMAGES, r)
}

export function clampBriefImageCount(value: number, room: number): number {
  const ceiling = briefImagesCeiling(room)
  if (ceiling <= 0) return 0
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return Math.min(ceiling, DEFAULT_BRIEF_IMAGES)
  return Math.min(ceiling, Math.max(MIN_BRIEF_IMAGES, n))
}

/**
 * How many pictures the button is about to buy — the ONE number the panel is
 * allowed to quote.
 *
 * It is quoted twice, on purpose: in the sentence above the button and in the
 * button's own label. A generation is a paid call, and "you are about to spend
 * three" has to be readable before the press rather than countable after it. Two
 * places, one function, so they cannot disagree — the failure this guards
 * against is a label saying four beside a loop that runs three.
 */
export function plannedBriefImages(state: BriefImagesState, room: number): number {
  return clampBriefImageCount(state.count, room)
}

/**
 * Why the step's button will not fire.
 *
 * Same shape and same reason as `VariantBlocker`: the reason is named next to
 * the disabled control, in the reader's language, and held as KEYS rather than
 * sentences so a repo-wide scan for `t('…')` cannot see them and a test has to.
 *
 * `no-brief` is the one that carries the whole idea of this control. The subject
 * of these pictures is the film's own brief, so an empty brief is not a missing
 * field on this block — it is the reason this block has nothing to say yet, and
 * the sentence points back up at the box that was already there.
 */
export type BriefImagesBlocker = 'no-brief' | 'no-room' | 'nothing-chosen'

export const BRIEF_IMAGE_BLOCKER_KEYS: Record<BriefImagesBlocker, string> = {
  'no-brief': 'video.briefImagesNeedBrief',
  'no-room': 'video.briefImagesNoRoom',
  'nothing-chosen': 'video.briefImagesNeedChoice',
}

export function briefImagesBlocker(
  state: BriefImagesState,
  brief: string,
  room: number,
): BriefImagesBlocker | null {
  switch (briefImagesStep(state)) {
    case 'off':
      return null
    case 'ask':
      // The brief first, because it is the one a person can act on without
      // touching anything else on the panel.
      if (!brief.trim()) return 'no-brief'
      return briefImagesCeiling(room) <= 0 ? 'no-room' : null
    case 'choose':
      if (state.chosen.length === 0) return 'nothing-chosen'
      // `addImage` refuses past the cap in silence, so ticking four with room
      // for one would drop three with no visible event — in the one block whose
      // entire job is deliberate choosing.
      return state.chosen.length > room ? 'no-room' : null
  }
}

export function toggleBriefChosen(state: BriefImagesState, hash: string): BriefImagesState {
  const chosen = state.chosen.includes(hash)
    ? state.chosen.filter((h) => h !== hash)
    : [...state.chosen, hash]
  return { ...state, chosen }
}

/**
 * What a finished batch leaves behind.
 *
 * Said out loud rather than left to be counted, exactly as `discardedCount`
 * says it for the variants: the ticked pictures are confirmed and join the pool,
 * and every other picture in that grid stays unconfirmed for good. It stays in
 * the store — nothing here deletes anything (M8) — simply unlisted and
 * unmountable, which is a thing to be told at the moment of pressing rather than
 * to discover a week later.
 */
export function briefImagesDiscarded(state: BriefImagesState): number {
  if (!state.batch) return 0
  return state.batch.filter((hash) => !state.chosen.includes(hash)).length
}

/**
 * Back to the start, with the tick box and the count remembered.
 *
 * Somebody who has just added two pictures and wants two more is in the middle
 * of one decision, not at the start of a new one; clearing the checkbox under
 * them would make the control look as though it had turned itself off.
 */
export function resetBriefImages(state: BriefImagesState): BriefImagesState {
  return { ...state, batch: null, chosen: [], missed: 0 }
}
