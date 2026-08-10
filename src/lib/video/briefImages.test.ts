import { describe, it, expect } from 'vitest'
import {
  BRIEF_IMAGE_BLOCKER_KEYS,
  DEFAULT_BRIEF_IMAGES,
  MAX_BRIEF_IMAGES,
  MIN_BRIEF_IMAGES,
  briefImagesBlocker,
  briefImagesCeiling,
  briefImagesDiscarded,
  briefImagesStep,
  clampBriefImageCount,
  emptyBriefImages,
  plannedBriefImages,
  resetBriefImages,
  toggleBriefChosen,
} from './briefImages'
import { translate } from '../../i18n'

const hashes = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i).repeat(64))

describe('the step', () => {
  it('opens closed: nothing here happens without a tick', () => {
    expect(briefImagesStep(emptyBriefImages())).toBe('off')
  })

  it('is derived from the batch, never stored beside it', () => {
    const on = emptyBriefImages(2, true)
    expect(briefImagesStep(on)).toBe('ask')
    expect(briefImagesStep({ ...on, batch: hashes(2) })).toBe('choose')
    // A batch under an unticked box is the disagreement a stored `step` would
    // draw as a gate nobody opened.
    expect(briefImagesStep({ ...on, on: false, batch: hashes(2) })).toBe('off')
  })
})

describe('how many will be made', () => {
  it('is bounded by the pool as well as by the ceiling', () => {
    expect(briefImagesCeiling(12)).toBe(MAX_BRIEF_IMAGES)
    expect(briefImagesCeiling(2)).toBe(2)
    // A full pool answers zero rather than one: there is nowhere to put a
    // picture, so buying one would be a paid call with no destination.
    expect(briefImagesCeiling(0)).toBe(0)
    expect(briefImagesCeiling(-3)).toBe(0)
    expect(briefImagesCeiling(Number.NaN)).toBe(0)
  })

  it('clamps whatever the select hands back', () => {
    expect(clampBriefImageCount(99, 12)).toBe(MAX_BRIEF_IMAGES)
    expect(clampBriefImageCount(0, 12)).toBe(MIN_BRIEF_IMAGES)
    expect(clampBriefImageCount(Number.NaN, 12)).toBe(DEFAULT_BRIEF_IMAGES)
    // The pool wins over the ceiling: three ticked with room for two is two.
    expect(clampBriefImageCount(3, 2)).toBe(2)
  })

  /**
   * The number in the sentence and the number in the button label are the same
   * call, which is the whole point of this function existing.
   *
   * A generation is a paid call. "Four will be made" over a loop that runs three
   * is the one failure this control cannot have, and two independent
   * computations is how that happens.
   */
  it('is one answer, quoted by the sentence and by the button alike', () => {
    const state = { ...emptyBriefImages(4, true) }
    expect(plannedBriefImages(state, 12)).toBe(4)
    expect(plannedBriefImages(state, 1)).toBe(1)
    expect(plannedBriefImages(state, 0)).toBe(0)
  })
})

describe('the blockers', () => {
  it('says nothing while the box is unticked', () => {
    expect(briefImagesBlocker(emptyBriefImages(), '', 12)).toBeNull()
  })

  /**
   * The subject of these pictures is the film's own brief, so an empty brief is
   * not a missing field on this block — it is the reason the block has nothing
   * to work from. Asking for a second subject here is asking the same person the
   * same question twice.
   */
  it('sends an empty brief back to the box that already exists', () => {
    expect(briefImagesBlocker(emptyBriefImages(2, true), '   ', 12)).toBe('no-brief')
    expect(briefImagesBlocker(emptyBriefImages(2, true), 'une bouilloire', 12)).toBeNull()
  })

  it('refuses a full pool before a call is spent', () => {
    expect(briefImagesBlocker(emptyBriefImages(2, true), 'une bouilloire', 0)).toBe('no-room')
  })

  it('will not add nothing, and will not add more than fits', () => {
    const batch = hashes(3)
    const gate = { ...emptyBriefImages(3, true), batch }
    expect(briefImagesBlocker(gate, 'x', 12)).toBe('nothing-chosen')
    expect(briefImagesBlocker({ ...gate, chosen: batch }, 'x', 12)).toBeNull()
    // `addImage` refuses past the cap silently, so three ticked with room for
    // one would drop two with nothing on screen to account for it.
    expect(briefImagesBlocker({ ...gate, chosen: batch }, 'x', 1)).toBe('no-room')
  })

  it.each(['fr', 'en'] as const)('names every one of them in %s', (lang) => {
    const missing = Object.values(BRIEF_IMAGE_BLOCKER_KEYS).filter(
      (key) => translate(lang, key as never) === key,
    )
    expect(missing).toEqual([])
  })
})

describe('the gate', () => {
  it('opens with nothing ticked', () => {
    // Everything ticked by default makes the gate a formality, and a formality
    // is what people click through.
    const gate = { ...emptyBriefImages(3, true), batch: hashes(3) }
    expect(gate.chosen).toEqual([])
    expect(briefImagesDiscarded(gate)).toBe(3)
  })

  it('ticks and unticks', () => {
    const gate = { ...emptyBriefImages(2, true), batch: hashes(2) }
    const one = toggleBriefChosen(gate, hashes(2)[0])
    expect(one.chosen).toEqual([hashes(2)[0]])
    expect(briefImagesDiscarded(one)).toBe(1)
    expect(toggleBriefChosen(one, hashes(2)[0]).chosen).toEqual([])
  })

  /**
   * The tick box and the count survive; the pictures do not — and "do not" means
   * the panel forgets them, not that anything is deleted (M8).
   */
  it('comes back ready for another round rather than switched off', () => {
    const done = resetBriefImages({ ...emptyBriefImages(3, true), batch: hashes(3), chosen: hashes(1), missed: 1 })
    expect(done).toEqual({ on: true, count: 3, batch: null, chosen: [], missed: 0 })
  })
})
