import { describe, it, expect } from 'vitest'
import {
  DEFAULT_VARIANT_COUNT,
  DERIVATION_KEYS,
  MAX_VARIANTS,
  MIN_VARIANTS,
  VARIANT_BLOCKER_KEYS,
  abandonModel,
  clampVariantCount,
  derivationOf,
  discardedCount,
  emptyVariantFlow,
  stepOf,
  keepModel,
  toggleChosen,
  variantBlocker,
  variantLimits,
} from './variantFlow'
import type { VariantBatch } from './client'
import { translate } from '../../i18n'

const batch = (over: Partial<VariantBatch> = {}): VariantBatch => ({
  derived: true,
  images: [
    { hash: 'a'.repeat(64), url: '/api/images/a', axis: 'angle', fromCache: false },
    { hash: 'b'.repeat(64), url: '/api/images/b', axis: 'light', fromCache: false },
  ],
  notices: [],
  ...over,
})

const atGate1 = () => ({ ...emptyVariantFlow(), subject: 'a kettle', modelHash: 'm'.repeat(64) })
const withModel = () => keepModel(atGate1())

describe('the step', () => {
  /**
   * Derived, never stored. A `step` field beside a `modelHash` field can
   * disagree — a regeneration that threw is exactly how — and the disagreement
   * draws as a gate with nothing behind it.
   */
  it('follows what actually exists', () => {
    expect(stepOf(emptyVariantFlow())).toBe('describe')
    expect(stepOf(atGate1())).toBe('keep')
    expect(stepOf(withModel())).toBe('ask')
    expect(stepOf({ ...withModel(), batch: batch() })).toBe('choose')
  })

  /**
   * `modelKept` is its own field rather than "the image is no longer pending",
   * and this is the case that forces it: the store is content-addressed, so a
   * model image whose bytes match one already in the library arrives NOT pending
   * — it landed on an entry somebody accepted long ago. Reading confirmation off
   * that flag would walk this user straight past the gate on a picture they had
   * not seen.
   */
  it('does not treat an already-confirmed picture as an answered gate', () => {
    expect(stepOf(atGate1())).toBe('keep')
  })

  /**
   * Abandoning forgets the picture; it does not delete it. The image stays in
   * the store, unconfirmed and unlisted (M8 — only an explicit deletion removes
   * a file), and the sentence the user typed survives because retyping it is a
   * punishment for changing their mind.
   */
  it('goes back to the description without losing it', () => {
    const after = abandonModel({ ...withModel(), batch: batch(), chosen: ['a'.repeat(64)] })
    expect(stepOf(after)).toBe('describe')
    expect(after.subject).toBe('a kettle')
    expect(after.chosen).toEqual([])
  })
})

describe('the count', () => {
  it('prefers the bounds the server quoted', () => {
    // /status quotes MIN_VARIANTS and MAX_VARIANTS so the picker cannot offer a
    // number the route would silently clamp.
    expect(variantLimits({ minVariants: 3, maxVariants: 5 })).toEqual({ min: 3, max: 5 })
    expect(variantLimits(undefined)).toEqual({ min: MIN_VARIANTS, max: MAX_VARIANTS })
    expect(variantLimits({ minVariants: 3 })).toEqual({ min: 3, max: MAX_VARIANTS })
  })

  it('puts an inverted pair back in order', () => {
    // A server answering max < min leaves clampVariantCount an empty interval,
    // and a number pinned to neither bound.
    expect(variantLimits({ minVariants: 6, maxVariants: 2 })).toEqual({ min: 2, max: 6 })
  })

  it('clamps, and lands on the default when there is no number at all', () => {
    const limits = variantLimits()
    expect(clampVariantCount(4, limits)).toBe(4)
    expect(clampVariantCount(99, limits)).toBe(MAX_VARIANTS)
    expect(clampVariantCount(1, limits)).toBe(MIN_VARIANTS)
    expect(clampVariantCount(3.4, limits)).toBe(3)
    expect(clampVariantCount(Number.NaN, limits)).toBe(DEFAULT_VARIANT_COUNT)
  })
})

describe('the blockers', () => {
  it('asks for a subject before it offers to spend a provider call', () => {
    expect(variantBlocker(emptyVariantFlow(), 20)).toBe('no-subject')
    expect(variantBlocker({ ...emptyVariantFlow(), subject: '  \n ' }, 20)).toBe('no-subject')
    expect(variantBlocker({ ...emptyVariantFlow(), subject: 'a kettle' }, 20)).toBeNull()
  })

  it('leaves the first gate answerable, and the count step too', () => {
    // Keep / regenerate / abandon are the whole point of that step. A disabled
    // answer would be a dead end with three buttons on it.
    expect(variantBlocker(atGate1(), 20)).toBeNull()
    expect(variantBlocker(withModel(), 20)).toBeNull()
  })

  it('will not add nothing', () => {
    expect(variantBlocker({ ...withModel(), batch: batch() }, 20)).toBe('nothing-chosen')
  })

  /**
   * `addScene` refuses silently past MAX_SCENES, so ticking six variants with
   * room for two would drop four of them with no visible event — in the one
   * screen whose entire job is to let somebody choose pictures deliberately.
   */
  it('refuses a selection larger than the room left in the timeline', () => {
    const state = { ...withModel(), batch: batch(), chosen: ['a'.repeat(64), 'b'.repeat(64)] }
    expect(variantBlocker(state, 1)).toBe('no-room')
    expect(variantBlocker(state, 2)).toBeNull()
  })
})

describe('the honesty about where the pictures came from', () => {
  /**
   * Three values, and the third is the reason this function exists. `false` is a
   * claim — "these never saw your picture" — and a server too old to send the
   * field is not making it. Collapsing the two with `!flag` would invent a fact
   * about somebody else's instance in the one place this feature promised not
   * to.
   */
  it('tells "no edit profile" apart from "nobody said"', () => {
    expect(derivationOf(true)).toBe('derived')
    expect(derivationOf(false)).toBe('siblings')
    expect(derivationOf(undefined)).toBe('unknown')
    expect(derivationOf(null)).toBe('unknown')
  })

  it('counts what the user is about to leave behind', () => {
    // Irreversible: everything unticked stays unconfirmed for good, so the panel
    // says how many before the button is pressed rather than after.
    const state = { ...withModel(), batch: batch(), chosen: ['a'.repeat(64)] }
    expect(discardedCount(state)).toBe(1)
    expect(discardedCount(toggleChosen(state, 'b'.repeat(64)))).toBe(0)
    expect(discardedCount(emptyVariantFlow())).toBe(0)
  })

  it('ticks and unticks', () => {
    const one = toggleChosen(emptyVariantFlow(), 'a'.repeat(64))
    expect(one.chosen).toEqual(['a'.repeat(64)])
    expect(toggleChosen(one, 'a'.repeat(64)).chosen).toEqual([])
  })
})

/**
 * The keys no repo-wide check can see, because the component calls
 * `t(DERIVATION_KEYS[d])` and the literal never appears next to a `t(`. Same
 * failure mode as the enum labels in VideoExportDialog.test.ts: a missing entry
 * draws a blank line, a present one naming a key nobody wrote draws
 * "video.variantsAreDerived" at the exact spot the user is deciding what to
 * spend.
 */
describe.each(['fr', 'en'] as const)('the labels in %s', (lang) => {
  it('resolves every one of them', () => {
    const keys = [...Object.values(DERIVATION_KEYS), ...Object.values(VARIANT_BLOCKER_KEYS)]
    expect(keys.filter((k) => translate(lang, k) === k)).toEqual([])
  })
})
