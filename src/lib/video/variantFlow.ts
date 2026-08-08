// The "start from one image" path, as state rather than as JSX.
//
// The flow is three steps and two confirmation gates: describe a subject and get
// ONE picture, look at it and keep it, then ask for several takes and tick the
// ones worth keeping. Everything the buttons depend on lives here for the reason
// `draft.ts` gives about its own arithmetic — the dialog is untestable in this
// repository (no DOM, no testing-library), so the logic that decides whether a
// control fires has to be somewhere a test can reach it.
//
// What this module is NOT is the guard. Nothing here can stop an unconfirmed
// image reaching a film; that is `pendingAmong()` and the 409 in
// server/video/routes.js. These are the two gates a person walks through, and
// they exist so that the server never has to refuse anybody.
import type { VariantBatch } from './client'

/**
 * How many takes one batch may hold.
 *
 * Mirrors MIN_VARIANTS / MAX_VARIANTS in server/video/variants.js, and the
 * mirror is checked at run time rather than trusted: /status quotes the server's
 * own numbers and `variantLimits()` prefers them, so a panel cannot offer a
 * count the route would silently clamp. These are the answer before /status
 * lands, and on a server too old to quote anything.
 */
export const MIN_VARIANTS = 2
export const MAX_VARIANTS = 6

/**
 * What the picker opens on.
 *
 * Four rather than two or six. Two is the minimum a comparison can be made from
 * and reads as stingy; six is every axis the server has plus a crossed pair, and
 * it is also six provider calls the account pays for before anyone has decided
 * whether the first one was any good. Four is a grid you take in at a glance.
 */
export const DEFAULT_VARIANT_COUNT = 4

export interface VariantLimits {
  min: number
  max: number
}

/** The server's bounds when it quoted them, ours when it did not. */
export function variantLimits(quoted?: { minVariants?: number; maxVariants?: number }): VariantLimits {
  const min = Number.isFinite(quoted?.minVariants) ? (quoted!.minVariants as number) : MIN_VARIANTS
  const max = Number.isFinite(quoted?.maxVariants) ? (quoted!.maxVariants as number) : MAX_VARIANTS
  // Ordered, whatever arrived. A server answering max < min would otherwise give
  // `clampVariantCount` an empty interval and a number pinned to neither bound.
  return min <= max ? { min, max } : { min: max, max: min }
}

export function clampVariantCount(value: number, limits: VariantLimits): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return Math.min(limits.max, Math.max(limits.min, DEFAULT_VARIANT_COUNT))
  return Math.min(limits.max, Math.max(limits.min, n))
}

/**
 * Where in the flow we are.
 *
 * Derived from the state, never stored beside it. A `step` field and a `model`
 * field can disagree — that is what a failed regeneration does to them — and the
 * disagreement draws as a gate with nothing behind it.
 */
export type VariantStep = 'describe' | 'keep' | 'ask' | 'choose'

export interface VariantFlowState {
  /** What the user typed. Kept across an abandon: retyping it is a punishment. */
  subject: string
  /** The one model image, once it exists. Unconfirmed until the user keeps it. */
  modelHash: string | null
  /**
   * Has the first gate been answered?
   *
   * Its own field rather than "the image is no longer pending", because the two
   * are not the same fact and the difference is visible: a model image whose
   * bytes matched something already in the library arrives NOT pending — the
   * store is content-addressed, so it landed on an entry somebody accepted long
   * ago — and reading confirmation off the flag would walk that user straight
   * past the gate on a picture they had not seen.
   */
  modelKept: boolean
  count: number
  /** Null until a batch came back. Carries `derived`, which the panel must show. */
  batch: VariantBatch | null
  /** Hashes ticked in the second gate. Everything else stays pending, for good. */
  chosen: string[]
}

export function emptyVariantFlow(count = DEFAULT_VARIANT_COUNT): VariantFlowState {
  return { subject: '', modelHash: null, modelKept: false, count, batch: null, chosen: [] }
}

export function stepOf(state: VariantFlowState): VariantStep {
  if (!state.modelHash) return 'describe'
  if (!state.modelKept) return 'keep'
  if (!state.batch) return 'ask'
  return 'choose'
}

/** The first gate, answered. Nothing downstream is reachable without it. */
export function keepModel(state: VariantFlowState): VariantFlowState {
  return { ...state, modelKept: true }
}

/**
 * Give up on this picture and start again.
 *
 * The subject survives; the image does not — and "does not" here means the panel
 * forgets it, not that anything is deleted. It stays in the store, unconfirmed,
 * unlisted and unmountable (M8: only an explicit deletion removes a file). That
 * is the whole reason the flag is a flag rather than a delete: abandoning a take
 * must not be able to destroy an image that somebody else's project already
 * points at, and the store is content-addressed, so an identical picture IS the
 * same entry.
 */
export function abandonModel(state: VariantFlowState): VariantFlowState {
  return { ...state, modelHash: null, modelKept: false, batch: null, chosen: [] }
}

/** Tick or untick one variant. */
export function toggleChosen(state: VariantFlowState, hash: string): VariantFlowState {
  const chosen = state.chosen.includes(hash) ? state.chosen.filter((h) => h !== hash) : [...state.chosen, hash]
  return { ...state, chosen }
}

/**
 * Why the step's button will not fire.
 *
 * Same shape and same reason as `DraftBlocker`: the panel names the reason next
 * to the disabled control. `no-room` is the one that is not about this flow at
 * all — `addScene` refuses silently past MAX_SCENES, so ticking six variants
 * with room for two would drop four of them with no visible event, in the one
 * screen whose entire job is to let somebody choose pictures deliberately.
 */
export type VariantBlocker = 'no-subject' | 'nothing-chosen' | 'no-room'

export const VARIANT_BLOCKER_KEYS: Record<VariantBlocker, string> = {
  'no-subject': 'video.variantNeedSubject',
  'nothing-chosen': 'video.variantNeedChoice',
  'no-room': 'video.variantNoRoom',
}

export function variantBlocker(state: VariantFlowState, room: number): VariantBlocker | null {
  switch (stepOf(state)) {
    case 'describe':
      return state.subject.trim() ? null : 'no-subject'
    case 'keep':
      // Keep, regenerate and abandon are always live: this gate exists to be
      // answered, and a disabled answer would be a dead end with three buttons.
      return null
    case 'ask':
      // The count is clamped on the way in, so there is no illegal value to
      // report — and the picture behind this step has already been accepted.
      return null
    case 'choose':
      if (state.chosen.length === 0) return 'nothing-chosen'
      return state.chosen.length > room ? 'no-room' : null
  }
}

/**
 * What the panel is allowed to claim about where the variants come from.
 *
 * Three values, not two, and the third is the point. `false` is a claim — "these
 * were born of the same sentence, they never saw your picture" — and a server
 * that predates the field says nothing at all, which is not that claim. Printing
 * it anyway would be inventing a fact about somebody else's instance in the one
 * place this feature promised not to.
 */
export type Derivation = 'derived' | 'siblings' | 'unknown'

export const DERIVATION_KEYS: Record<Derivation, string> = {
  derived: 'video.variantsAreDerived',
  siblings: 'video.variantsAreSiblings',
  unknown: 'video.variantsDerivationUnknown',
}

export function derivationOf(flag: boolean | undefined | null): Derivation {
  if (flag === true) return 'derived'
  if (flag === false) return 'siblings'
  return 'unknown'
}

/**
 * How many of a finished batch were left behind.
 *
 * Said out loud rather than left to be counted, because it is the irreversible
 * half of the second gate: the ticked ones are confirmed and join the montage,
 * and every other picture in that grid stays unconfirmed for good. Somebody
 * closing this panel with four of six ticked should have been told what happens
 * to the other two, at the moment they press the button.
 */
export function discardedCount(state: VariantFlowState): number {
  if (!state.batch) return 0
  return state.batch.images.filter((v) => !state.chosen.includes(v.hash)).length
}
