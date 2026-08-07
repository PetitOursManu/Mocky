// The composition's arithmetic, tested without rendering a video.
//
// A Remotion composition is React, and checking what it looks like means
// launching Chromium, encoding a file and comparing pictures — none of which
// belongs in a suite that has to run on a checkout where Remotion is not even
// installed. What CAN be checked here is everything the picture is derived
// from: how many frames a scene lasts, where it starts, how much a transition
// takes out of the running time, and which geometry an aspect ratio maps to.
// Those are also, by a wide margin, where the defects are.
//
// This file imports `composition.js` and nothing else on purpose. The moment it
// needs `remotion` or React it stops running everywhere, and the arithmetic
// goes back to being verified by watching an mp4.
import { describe, it, expect } from 'vitest'
import {
  FPS,
  MAX_TRANSITION_SHARE,
  TRANSITION_MS,
  dimensionsFor,
  msToFrames,
  planTimeline,
} from './composition.js'

const scene = (durationMs, extra = {}) => ({
  imageId: 'a'.repeat(64),
  durationMs,
  kenBurns: 'static',
  transitionOut: 'crossfade',
  textOverlay: null,
  ...extra,
})

const timeline = (scenes, extra = {}) => ({ scenes, outputFormat: 'mp4', aspectRatio: '16:9', ...extra })

describe('dimensionsFor', () => {
  /**
   * The three ratios the schema allows, at 1080 on the long edge in all three.
   * A portrait export is not the low-quality option.
   */
  it('maps every aspect ratio the schema allows', () => {
    expect(dimensionsFor('16:9')).toEqual({ width: 1920, height: 1080 })
    expect(dimensionsFor('9:16')).toEqual({ width: 1080, height: 1920 })
    expect(dimensionsFor('1:1')).toEqual({ width: 1080, height: 1080 })
  })

  /**
   * A silent fallback to 16:9 would hand a landscape video to someone who asked
   * for a portrait one and report it as a success — the failure `.strict()`
   * exists to prevent, one layer down.
   */
  it('throws on a ratio it does not know instead of guessing', () => {
    expect(() => dimensionsFor('4:3')).toThrow(/4:3/)
    expect(() => dimensionsFor(undefined)).toThrow()
  })

  /**
   * The names a plain `DIMENSIONS[aspectRatio]` answers for and an own-key check
   * does not. `constructor` returns a function — truthy, so a `!dimensions`
   * guard lets it through — and the composition is then registered with
   * `width: undefined`, which fails inside Chromium with a message about a
   * composition rather than about a ratio.
   */
  it('does not accept a name it inherited from Object', () => {
    for (const inherited of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(() => dimensionsFor(inherited), inherited).toThrow(/Unknown aspect ratio/)
    }
  })
})

describe('msToFrames', () => {
  it('converts at 30 fps', () => {
    expect(msToFrames(1000)).toBe(30)
    expect(msToFrames(15000)).toBe(450)
  })

  /**
   * DOWN, not to nearest, and this is the test that says why. Twenty scenes
   * rounded to nearest can add up to more frames than the 120 s ceiling allows,
   * which turns a timeline the schema accepted into a render Mocky's own queue
   * times out on.
   */
  it('rounds down, so the parts can never add up to more than the whole', () => {
    expect(msToFrames(1016)).toBe(30)
    expect(msToFrames(1050)).toBe(31)

    const odd = [1017, 1017, 1017, 1017, 1017]
    const sumOfParts = odd.reduce((total, ms) => total + msToFrames(ms), 0)
    const wholeInFrames = Math.floor((odd.reduce((a, b) => a + b, 0) * FPS) / 1000)
    expect(sumOfParts).toBeLessThanOrEqual(wholeInFrames)
  })

  /** A zero-frame Sequence is one Remotion refuses; fail on arithmetic, not in Chromium. */
  it('never returns a zero-length scene', () => {
    expect(msToFrames(0)).toBe(1)
    expect(msToFrames(-5000)).toBe(1)
  })
})

describe('planTimeline', () => {
  it('lays scenes end to end when no transition is asked for', () => {
    const plan = planTimeline(timeline([scene(2000, { transitionOut: 'none' }), scene(3000, { transitionOut: 'none' })]))
    expect(plan.scenes.map((s) => [s.from, s.durationInFrames])).toEqual([
      [0, 60],
      [60, 90],
    ])
    expect(plan.totalFrames).toBe(150)
  })

  /**
   * THE invariant of this file. A transition bites into the end of the outgoing
   * scene and the start of the incoming one; it is never appended. A transition
   * that added its own duration would make the schema's 120 s ceiling a lie by
   * up to nineteen half-seconds, and the queue's 120 s job timeout would start
   * killing exports that validated cleanly.
   */
  it('overlaps a transition instead of adding it to the running time', () => {
    const scenes = [scene(5000), scene(5000), scene(5000)]
    const withTransitions = planTimeline(timeline(scenes))
    const withNone = planTimeline(timeline(scenes.map((s) => ({ ...s, transitionOut: 'none' }))))

    const overlap = Math.floor((TRANSITION_MS * FPS) / 1000)
    expect(withNone.totalFrames).toBe(450)
    expect(withTransitions.totalFrames).toBe(450 - 2 * overlap)
    expect(withTransitions.totalFrames).toBeLessThan(withNone.totalFrames)

    // And the second scene really does start before the first one ends.
    expect(withTransitions.scenes[1].from).toBeLessThan(
      withTransitions.scenes[0].from + withTransitions.scenes[0].durationInFrames,
    )
  })

  /**
   * `transitionOut` belongs to the scene that LEAVES, but it is the scene that
   * arrives which animates — it fades or wipes in on top of its predecessor. A
   * plan that read each scene's own `transitionOut` as its entrance would play
   * every transition one scene late, and the first scene would fade in from
   * nothing for no reason.
   */
  it('gives each scene the transition declared by the one before it', () => {
    const plan = planTimeline(
      timeline([scene(2000, { transitionOut: 'wipe-left' }), scene(2000, { transitionOut: 'crossfade' }), scene(2000)]),
    )
    expect(plan.scenes.map((s) => s.enterTransition)).toEqual(['none', 'wipe-left', 'crossfade'])
    expect(plan.scenes[0].enterFrames).toBe(0)
    expect(plan.scenes[1].enterFrames).toBeGreaterThan(0)
  })

  /**
   * The schema's minimum scene is 1000 ms — 30 frames — and an uncapped 500 ms
   * transition on both sides of one leaves nothing of it standing alone. The
   * result would be a video in which no image is ever actually shown, built
   * from a timeline every validator accepted.
   */
  it('never lets a transition eat more than a third of the shorter scene', () => {
    const plan = planTimeline(timeline([scene(1000), scene(1000), scene(1000)]))
    const budget = Math.floor((TRANSITION_MS * FPS) / 1000)
    const capped = Math.floor(30 / MAX_TRANSITION_SHARE)
    expect(capped).toBeLessThan(budget)
    expect(plan.scenes[1].enterFrames).toBe(capped)
    expect(plan.totalFrames).toBe(90 - 2 * capped)
  })

  /** `none` on one pair must not disturb the pair next to it. */
  it('applies the transition per pair, not per timeline', () => {
    const plan = planTimeline(timeline([scene(2000, { transitionOut: 'none' }), scene(2000), scene(2000)]))
    expect(plan.scenes[1].enterFrames).toBe(0)
    expect(plan.scenes[2].enterFrames).toBeGreaterThan(0)
  })

  /**
   * The last scene's `transitionOut` defaults to 'crossfade' in the schema and
   * there is nothing after it. Honouring it would fade the end of the video
   * into the background — a different feature, and one nobody asked for.
   */
  it('ignores the last scene transition rather than fading out to nothing', () => {
    const one = planTimeline(timeline([scene(4000)]))
    expect(one.totalFrames).toBe(120)
    expect(one.scenes[0].enterFrames).toBe(0)
  })

  /**
   * The whole-timeline ceiling, checked on the worst legal document: eight
   * fifteen-second scenes are exactly the 120 000 ms the schema allows. The
   * render must not be longer than the timeline says it is, in either
   * direction of the transition question.
   */
  it('keeps the longest legal timeline inside 120 seconds of frames', () => {
    const scenes = Array.from({ length: 8 }, () => scene(15000))
    const ceiling = (120000 * FPS) / 1000

    expect(planTimeline(timeline(scenes)).totalFrames).toBeLessThanOrEqual(ceiling)
    expect(planTimeline(timeline(scenes.map((s) => ({ ...s, transitionOut: 'none' })))).totalFrames).toBe(ceiling)
  })

  it('reads the geometry from the timeline, not from a default', () => {
    expect(planTimeline(timeline([scene(2000)], { aspectRatio: '9:16' }))).toMatchObject({
      width: 1080,
      height: 1920,
      fps: FPS,
    })
  })

  /** A composition with no scenes has no frames, and Remotion cannot render zero. */
  it('refuses an empty timeline', () => {
    expect(() => planTimeline(timeline([]))).toThrow(/at least one scene/)
  })
})
