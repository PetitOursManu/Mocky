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
// This file imports `composition.js` and its contrast mirror, and nothing else
// on purpose. The moment it needs `remotion` or React it stops running
// everywhere, and the arithmetic goes back to being verified by watching an mp4.
//
// `contrast.js` is imported directly, rather than through the re-export, because
// the legibility block below re-measures every pair from the primitives instead
// of trusting the ratio the palette computed. A test that read the palette's own
// number would agree with it by construction.
import { describe, it, expect } from 'vitest'
import { blend, contrastRatio } from './contrast.js'
import {
  BAND_VEIL,
  COMPOSITIONS,
  CONTRAST_MIN,
  CONTRAST_MIN_LARGE,
  CUE_ENTER_FRAMES,
  CUE_TAIL_GAP_FRAMES,
  EMPHASIS_ENTER_FRAMES,
  FPS,
  INK_DARK,
  INK_FLOOR,
  INK_LIGHT,
  INSTALLED_FONT_STACK,
  KICKER_SIZE,
  MAX_TRANSITION_SHARE,
  MAX_VEIL_ALPHA,
  MIN_CUE_TAIL_FRAMES,
  PALETTES,
  PAPER_FALLBACK,
  PUNCH_FRAMES,
  PUNCH_SCALE,
  SLIDESHOW_PANEL_VEIL,
  TEXTURE_ALPHA,
  THEME_FALLBACK,
  TRANSITION_MS,
  VERTICAL_CAPTION_LONG_CHARS,
  VERTICAL_CAPTION_MAX,
  VERTICAL_CAPTION_MIN,
  VERTICAL_CAPTION_SHORT_CHARS,
  VERTICAL_DIM,
  accentFirst,
  bandInset,
  compositionIdFor,
  cueFrames,
  cueProgress,
  dimensionsFor,
  easeOutCubic,
  entranceStyle,
  fontStack,
  frameBase,
  groundTint,
  hairlineTexture,
  inkCandidates,
  kenBurnsTransform,
  legibleOn,
  msToFrames,
  ordinalLabel,
  overlayAlignment,
  planTimeline,
  prefersPaper,
  productLayout,
  progressAt,
  punchTransform,
  railSegments,
  readableInk,
  resolveTheme,
  sceneLabel,
  surfaceRange,
  verticalCaptionSize,
  withAlpha,
  words,
  worstRatio,
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

  /**
   * The plan carries the scene WHOLE rather than copying its fields, and the
   * template with no `imageId` is what makes that load-bearing: a plan that
   * listed `imageId`, `kenBurns` and `textOverlay` would silently answer
   * `undefined` for all three on a `titles` scene, and the composition drawing
   * it would look correct while rendering nothing anybody wrote.
   */
  it('carries each scene whole, including the one kind that has no image', () => {
    const titleScene = { headline: 'Hello', subtitle: null, durationMs: 2000, animation: 'stagger', transitionOut: 'none' }
    const plan = planTimeline(timeline([titleScene]))
    expect(plan.scenes[0].scene).toBe(titleScene)
    expect(plan.scenes[0].durationInFrames).toBe(60)
  })

  /**
   * `transitionOut` stays inside `scene`, one level away from `enterTransition`.
   * They are opposite ends of a scene and one word apart; a plan that put them
   * side by side is how a whole timeline gets played one transition late.
   */
  it('keeps the scene transition out of the entrance fields', () => {
    const plan = planTimeline(timeline([scene(2000, { transitionOut: 'wipe-left' }), scene(2000)]))
    expect(plan.scenes[0]).not.toHaveProperty('transitionOut')
    expect(plan.scenes[0].scene.transitionOut).toBe('wipe-left')
    expect(plan.scenes[1].enterTransition).toBe('wipe-left')
  })
})

describe('compositionIdFor', () => {
  /**
   * Five templates, five compositions, and `render.js` selects by the id this
   * returns. A template with no entry cannot be reached by any route into the
   * process — the same shape the schema has on the Mocky side.
   */
  it('names a distinct composition for each template in the catalogue', () => {
    expect(Object.keys(COMPOSITIONS)).toEqual(['slideshow', 'overlay', 'vertical', 'titles', 'product'])
    expect(new Set(Object.values(COMPOSITIONS)).size).toBe(5)
    for (const [template, id] of Object.entries(COMPOSITIONS)) expect(compositionIdFor(template)).toBe(id)
  })

  /** A document from the queue's journal can predate the catalogue entirely. */
  it('reads an absent template as a slideshow', () => {
    expect(compositionIdFor(undefined)).toBe(COMPOSITIONS.slideshow)
    expect(compositionIdFor(null)).toBe(COMPOSITIONS.slideshow)
  })

  /**
   * Never the nearest composition it does have. Drawing a `product` with the
   * slideshow would produce a film with its arguments and its call to action
   * missing, reported as a success.
   */
  it('throws on a template it has no composition for, and on a name off the prototype', () => {
    expect(() => compositionIdFor('karaoke')).toThrow(/karaoke/)
    for (const inherited of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(() => compositionIdFor(inherited), inherited).toThrow(/No composition for template/)
    }
  })
})

describe('progressAt, kenBurnsTransform and entranceStyle', () => {
  /**
   * Clamped at both ends, because the last scene of a timeline is rendered one
   * frame past its own length in some Remotion versions — an unclamped
   * extrapolation there is a single frame that jumps, visible only in the
   * exported file.
   */
  it('clamps at both ends and answers 1 for a span of nothing', () => {
    expect(progressAt(-5, 10)).toBe(0)
    expect(progressAt(5, 10)).toBe(0.5)
    expect(progressAt(50, 10)).toBe(1)
    expect(progressAt(3, 0)).toBe(1)
  })

  it('moves a Ken Burns scene from one end of its amplitude to the other', () => {
    expect(kenBurnsTransform('zoom-in', 0, 61)).toBe('scale(1)')
    expect(kenBurnsTransform('zoom-in', 60, 61)).toBe('scale(1.12)')
    expect(kenBurnsTransform('zoom-out', 0, 61)).toBe('scale(1.12)')
    expect(kenBurnsTransform('static', 30, 61)).toBe('none')
    // A pan travels from one side to the other and passes through centre.
    expect(kenBurnsTransform('pan-left', 30, 61)).toBe('scale(1.12) translateX(0%)')
    expect(kenBurnsTransform('pan-left', 0, 61)).toContain('translateX(4%)')
    expect(kenBurnsTransform('pan-right', 0, 61)).toContain('translateX(-4%)')
  })

  /** An enum this file does not know must not fail a render Chromium is halfway through. */
  it('answers "none" for a move it does not know rather than throwing', () => {
    expect(kenBurnsTransform('spin', 10, 60)).toBe('none')
    expect(kenBurnsTransform(undefined, 10, 60)).toBe('none')
  })

  /**
   * ONLY the incoming scene animates. A two-sided crossfade dips through the
   * background at its midpoint, so a film on a dark canvas blinks once per
   * transition.
   */
  it('animates the arriving scene from hidden to fully present', () => {
    expect(entranceStyle('crossfade', 0, 15)).toEqual({ opacity: 0 })
    expect(entranceStyle('crossfade', 15, 15)).toEqual({ opacity: 1 })
    expect(entranceStyle('wipe-left', 0, 15)).toEqual({ clipPath: 'inset(0 0 0 100%)' })
    expect(entranceStyle('wipe-right', 15, 15)).toEqual({ clipPath: 'inset(0 0% 0 0)' })
  })

  it('has no entrance for the first scene or for "none"', () => {
    expect(entranceStyle('crossfade', 4, 0)).toBeNull()
    expect(entranceStyle('none', 4, 15)).toBeNull()
    expect(entranceStyle('dissolve', 4, 15)).toBeNull()
  })

  /**
   * A plain `OVERLAY_ALIGNMENT[position] || 'center'` answers for the prototype
   * chain, so `position: "constructor"` returns a function — truthy, so the
   * fallback never fires, and a function is what lands in `justifyContent`.
   */
  it('does not take an alignment off the prototype chain', () => {
    expect(overlayAlignment('top')).toBe('flex-start')
    expect(overlayAlignment('bottom')).toBe('flex-end')
    for (const inherited of ['constructor', 'toString', '__proto__']) {
      expect(overlayAlignment(inherited), inherited).toBe('center')
    }
  })
})

describe('cueFrames', () => {
  /** Evenly stepped when the scene is long enough to hold the whole cascade. */
  it('steps evenly from its offset when there is room', () => {
    expect(cueFrames(3, 300, { step: 6, offset: 3 })).toEqual([3, 9, 15])
  })

  /**
   * THE defect this function exists to prevent, and the reason a product scene
   * bottoms out at three seconds: a headline, three arguments and a call to
   * action at a comfortable pace put the last one past the end of the scene —
   * a film missing the line it was cut to deliver, rendered and reported as a
   * success.
   */
  it('never places a cue with less than half a second of scene left after it', () => {
    for (let durationInFrames = 1; durationInFrames <= 450; durationInFrames += 7) {
      for (let count = 1; count <= 8; count += 1) {
        const cues = cueFrames(count, durationInFrames, { step: 9, offset: 4 })
        const ceiling = Math.max(0, durationInFrames - MIN_CUE_TAIL_FRAMES)
        expect(cues).toHaveLength(count)
        for (const cue of cues) {
          expect(cue, `${count} cues in ${durationInFrames} frames`).toBeGreaterThanOrEqual(0)
          expect(cue, `${count} cues in ${durationInFrames} frames`).toBeLessThanOrEqual(ceiling)
        }
        // Non-decreasing: a compressed cascade is still a cascade, never a
        // shuffle.
        expect([...cues].sort((a, b) => a - b)).toEqual(cues)
      }
    }
  })

  /**
   * Compressed as a whole rather than clipped. Clipping would pile the
   * overflowing elements onto one frame while the first ones kept their
   * leisurely spacing, which reads as a stutter.
   */
  it('compresses the whole cascade rather than clipping its tail', () => {
    const cues = cueFrames(4, 30, { step: 20, offset: 10 })
    expect(cues[cues.length - 1]).toBeLessThanOrEqual(30 - MIN_CUE_TAIL_FRAMES)
    expect(cues[1] - cues[0]).toBe(cues[2] - cues[1])
  })

  /** A scene too short for any cascade shows everything at once, which is honest. */
  it('collapses to zero on a scene with no room at all', () => {
    expect(cueFrames(3, 10, { step: 6, offset: 2 })).toEqual([0, 0, 0])
    expect(cueFrames(0, 300)).toEqual([])
  })

  /** The first element of a cascade is on screen well before its scene ends. */
  it('leaves an element time to finish arriving', () => {
    const [first] = cueFrames(3, 90, { step: 7, offset: 3 })
    expect(first + CUE_ENTER_FRAMES).toBeLessThan(90)
  })
})

describe('the tail gap', () => {
  /**
   * The beat before the last element, and nothing else. A call to action that
   * arrives one even step after the third argument reads as a fourth argument.
   */
  it('holds the last element back without moving the ones before it', () => {
    const even = cueFrames(4, 300, { step: 6, offset: 3 })
    const held = cueFrames(4, 300, { step: 6, offset: 3, tailGap: 12 })
    expect(even).toEqual([3, 9, 15, 21])
    expect(held).toEqual([3, 9, 15, 33])
  })

  /** A gap before the first thing on screen is dead air, not rhythm. */
  it('has nothing to hold back in a cascade of one', () => {
    expect(cueFrames(1, 300, { offset: 4, tailGap: 20 })).toEqual([4])
  })

  /**
   * The pause is scaled with the rest, never added on top of it. A scene too
   * short for the pause loses the pause; it never loses the element — which is
   * the failure `MIN_CUE_TAIL_FRAMES` exists to prevent, arriving through a new
   * option.
   */
  it('gives the pause up before it gives the scene up', () => {
    for (let durationInFrames = 1; durationInFrames <= 200; durationInFrames += 3) {
      const cues = cueFrames(5, durationInFrames, { step: 9, offset: 4, tailGap: CUE_TAIL_GAP_FRAMES })
      const ceiling = Math.max(0, durationInFrames - MIN_CUE_TAIL_FRAMES)
      expect(cues, `${durationInFrames} frames`).toHaveLength(5)
      for (const cue of cues) expect(cue, `${durationInFrames} frames`).toBeLessThanOrEqual(ceiling)
      expect([...cues].sort((a, b) => a - b), `${durationInFrames} frames`).toEqual(cues)
    }
  })

  /** Garbage never becomes a NaN cue, which would place an element on no frame at all. */
  it('reads a gap it cannot parse as no gap', () => {
    expect(cueFrames(3, 300, { step: 6, offset: 0, tailGap: 'soon' })).toEqual(cueFrames(3, 300, { step: 6, offset: 0 }))
    expect(cueFrames(3, 300, { step: 6, offset: 0, tailGap: -9 })).toEqual(cueFrames(3, 300, { step: 6, offset: 0 }))
  })
})

describe('easing', () => {
  /**
   * The curve every arrival in the catalogue now runs on. Linear was what made
   * the first version read as generated: it enters and stops at the speed it
   * travelled, which nothing physical does.
   */
  it('starts fast, ends still, and stays inside its own ends', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
    // Monotone, and decelerating: every step is smaller than the one before it.
    let previous = 0
    let lastStep = Infinity
    for (let t = 0.1; t <= 1.0001; t += 0.1) {
      const value = easeOutCubic(t)
      const step = value - previous
      expect(value).toBeGreaterThan(previous)
      expect(step).toBeLessThan(lastStep)
      previous = value
      lastStep = step
    }
  })

  /** Clamped at both ends, and never NaN — the value lands in an `opacity`. */
  it('clamps rather than extrapolating', () => {
    expect(easeOutCubic(-3)).toBe(0)
    expect(easeOutCubic(9)).toBe(1)
    expect(easeOutCubic('x')).toBe(0)
    expect(easeOutCubic(undefined)).toBe(0)
  })

  it('holds an element at nothing until its cue, and at rest afterwards', () => {
    expect(cueProgress(0, 10)).toBe(0)
    expect(cueProgress(9, 10)).toBe(0)
    expect(cueProgress(10 + CUE_ENTER_FRAMES, 10)).toBe(1)
    expect(cueProgress(10 + CUE_ENTER_FRAMES / 2, 10)).toBeGreaterThan(0.5)
    // A longer span is the same arrival, slower: at the same frame it is behind.
    expect(cueProgress(14, 10, EMPHASIS_ENTER_FRAMES)).toBeLessThan(cueProgress(14, 10, CUE_ENTER_FRAMES))
  })

  /**
   * The arithmetic that lets one element of a cascade arrive more slowly than
   * its neighbours WITHOUT arriving after the cut: no cue is ever placed with
   * less than `MIN_CUE_TAIL_FRAMES` of scene left, so an entrance no longer than
   * that always finishes inside its own scene.
   */
  it('never gives the emphasised element a longer entrance than a scene has tail', () => {
    expect(EMPHASIS_ENTER_FRAMES).toBeLessThanOrEqual(MIN_CUE_TAIL_FRAMES)
    expect(CUE_ENTER_FRAMES).toBeLessThanOrEqual(MIN_CUE_TAIL_FRAMES)
    // On the shortest scene any template allows — 1000 ms — with the busiest
    // cascade, the last element is still fully arrived before the last frame.
    const cues = cueFrames(6, 30, { step: 7, offset: 3, tailGap: CUE_TAIL_GAP_FRAMES })
    expect(cues[cues.length - 1] + EMPHASIS_ENTER_FRAMES).toBeLessThanOrEqual(30)
  })
})

describe('words and the marks that count them', () => {
  it('splits a headline for the templates that animate one word at a time', () => {
    expect(words('  Designed   in the browser ')).toEqual(['Designed', 'in', 'the', 'browser'])
    expect(words('')).toEqual([])
    expect(words(null)).toEqual([])
  })

  /**
   * The kicker's text, and it is the film restating its own structure rather
   * than a string a model invented about a film it cannot see.
   */
  it('numbers a scene against the film it is in', () => {
    expect(sceneLabel(0, 4)).toBe('01 / 04')
    expect(sceneLabel(11, 12)).toBe('12 / 12')
  })

  /** `01 / 01` is a counter admitting it had nothing to count. */
  it('says nothing at all about a film with one scene', () => {
    expect(sceneLabel(0, 1)).toBe('')
    expect(sceneLabel(0, 0)).toBe('')
  })

  /** A label is rendered as a React child, so garbage must become nothing, never NaN. */
  it('refuses an index it cannot place', () => {
    for (const [index, total] of [
      [-1, 4],
      [4, 4],
      ['x', 4],
      [0, 'four'],
      [undefined, undefined],
    ]) {
      expect(sceneLabel(index, total), `${index}/${total}`).toBe('')
    }
  })

  /** Zero-padded, so a column of arguments has one numeral width. */
  it('counts the items of a list from one', () => {
    expect(ordinalLabel(0)).toBe('01')
    expect(ordinalLabel(2)).toBe('03')
    expect(ordinalLabel(-1)).toBe('')
    expect(ordinalLabel('two')).toBe('')
  })
})

describe('the theme', () => {
  /**
   * Every token filled, from the document where it was declared and from the
   * fallbacks where it was not. `theme.ts` emits ONLY what a direction stated,
   * so a partial theme is the normal case rather than the odd one.
   */
  it('fills what the direction did not state without inventing a colour', () => {
    const resolved = resolveTheme({ colors: { accent: '#00FF88' }, radiusPx: 0 })
    expect(resolved.accent).toBe('#00FF88')
    expect(resolved.radiusPx).toBe(0)
    expect(resolved.background).toBe(THEME_FALLBACK.background)
    expect(resolved.text).toBe(THEME_FALLBACK.text)
    expect(resolveTheme(undefined)).toMatchObject({
      background: THEME_FALLBACK.background,
      accent: THEME_FALLBACK.accent,
      radiusPx: THEME_FALLBACK.radiusPx,
    })
  })

  /**
   * The second lock. `validate.js` already refused anything that is not a hex
   * value, and this is what keeps the promise "nothing from a document becomes
   * CSS" true of a validator somebody loosens next year — these values are
   * interpolated into `linear-gradient()` and `rgba()`.
   */
  it('refuses a colour that is not hex, whatever the validator did', () => {
    const resolved = resolveTheme({
      colors: { background: 'red; } body {', text: 'var(--x)', accent: '#12345', surface: '#abc' },
    })
    expect(resolved.background).toBe(THEME_FALLBACK.background)
    expect(resolved.text).toBe(THEME_FALLBACK.text)
    expect(resolved.accent).toBe(THEME_FALLBACK.accent)
    expect(resolved.surface).toBe('#abc')
  })

  /**
   * The container installs `fonts-liberation` and nothing else, so a declared
   * family is named FIRST and the stack that exists follows it. A container with
   * no matching family renders every glyph as a hollow box, burnt into an mp4
   * nobody previewed — CSS's own fallback is what turns that into Liberation
   * Sans instead.
   */
  it('names a declared family in front of the one the container has', () => {
    expect(fontStack('Cormorant Garamond')).toBe(`"Cormorant Garamond", ${INSTALLED_FONT_STACK}`)
    expect(fontStack(undefined)).toBe(INSTALLED_FONT_STACK)
  })

  /**
   * The quotes around a family name are only safe because the charset has no
   * quote, comma, semicolon or brace in it. Anything else is dropped whole —
   * never cleaned up, since a sanitised typeface is a different typeface.
   */
  it('drops a family name that could close a declaration', () => {
    for (const hostile of ['Inter, sans-serif', 'Inter"; color: red', 'Inter;}', "Inter'", '']) {
      expect(fontStack(hostile), hostile).toBe(INSTALLED_FONT_STACK)
    }
  })

  it('turns a declared colour into a veil, in both hex spellings', () => {
    expect(withAlpha('#000000', 0.5)).toBe('rgba(0, 0, 0, 0.5)')
    expect(withAlpha('#fff', 1)).toBe('rgba(255, 255, 255, 1)')
    expect(withAlpha('#1a2b3c', 0.25)).toBe('rgba(26, 43, 60, 0.25)')
  })

  /**
   * An unreadable colour becomes black rather than nothing. The alpha layers are
   * what keep text legible over a photograph nobody previewed, so the failure
   * that matters is a veil that silently disappears, not one that is the wrong
   * colour.
   */
  it('never produces a transparent veil out of a colour it cannot read', () => {
    expect(withAlpha('nonsense', 0.8)).toBe('rgba(0, 0, 0, 0.8)')
    expect(withAlpha('#fff', 5)).toBe('rgba(255, 255, 255, 1)')
    expect(withAlpha('#fff', -1)).toBe('rgba(255, 255, 255, 0)')
  })

  /**
   * A call to action is a filled pill in the project's accent, and an accent is
   * whatever the direction declared. A label coloured for a deep navy is
   * invisible on a pale mint, and neither the direction nor the model states a
   * second token for it.
   */
  it('picks a legible ink for a call to action on any accent', () => {
    expect(readableInk('#ffffff')).toBe('#101014')
    expect(readableInk('#fde047')).toBe('#101014')
    expect(readableInk('#101014')).toBe('#ffffff')
    expect(readableInk('#6366f1')).toBe('#ffffff')
    expect(readableInk('not a colour')).toBe(readableInk(THEME_FALLBACK.accent))
  })

  /**
   * The regression that made `readableInk` measure instead of guess. It used to
   * split on a relative luminance of 0.5; amber measures 0.44, took white, and
   * shipped a call to action at 2.1:1 — below the floor in both directions,
   * chosen by a threshold rather than by the thing the threshold approximates.
   */
  it('does not hand a mid-tone accent the ink it barely fails with', () => {
    expect(readableInk('#f59e0b')).toBe(INK_DARK)
    expect(contrastRatio(readableInk('#f59e0b'), '#f59e0b')).toBeGreaterThan(CONTRAST_MIN)
    // Both directions of the comparison, on the two colours that used to sit on
    // the wrong side of the midpoint.
    for (const accent of ['#f59e0b', '#facc15', '#22c55e', '#0ea5e9', '#6366f1', '#7c3aed']) {
      const ink = readableInk(accent)
      const other = ink === INK_LIGHT ? INK_DARK : INK_LIGHT
      expect(contrastRatio(ink, accent), accent).toBeGreaterThanOrEqual(contrastRatio(other, accent))
    }
  })

  /**
   * The pairing. A ground and an ink are not two independent defaults, and
   * filling one from a document while filling the other from here is the whole
   * of the reported defect: a dark green "Gemini 3" on a near-black frame, from
   * a direction whose two colours never met outside the composition.
   */
  it('gives a stated ink the ground it was written for', () => {
    // A dark ink was written for paper, whatever the fallback happens to be.
    const dark = resolveTheme({ colors: { text: '#14532d', accent: '#16a34a' } })
    expect(dark.background).toBe(PAPER_FALLBACK.background)
    expect(dark.text).toBe('#14532d')
    expect(dark.surface).toBe(PAPER_FALLBACK.surface)

    // A light one keeps the dark ground it has always had.
    const light = resolveTheme({ colors: { text: '#f6f4ee' } })
    expect(light.background).toBe(THEME_FALLBACK.background)
    expect(light.surface).toBe(THEME_FALLBACK.surface)
  })

  it('gives a stated ground an ink measured against it, not a default', () => {
    // The mirror case, and the one that used to produce white on cream.
    const paper = resolveTheme({ colors: { background: '#f6f4ee' } })
    expect(paper.text).toBe(INK_DARK)
    expect(contrastRatio(paper.text, paper.background)).toBeGreaterThan(CONTRAST_MIN)

    const night = resolveTheme({ colors: { background: '#0c0a09' } })
    expect(night.text).toBe(INK_LIGHT)
  })

  /**
   * Both colours stated is a direction that made its own decision, and the
   * pairing must not overrule it. A clash between two stated colours is caught
   * later, by measurement, where the correction can be per-run.
   */
  it('never overrules a direction that stated both', () => {
    const both = resolveTheme({ colors: { background: '#0a0a0a', text: '#262626' } })
    expect(both.background).toBe('#0a0a0a')
    expect(both.text).toBe('#262626')
  })

  it('decides which ground an ink belongs on by measuring, not by a threshold', () => {
    expect(prefersPaper('#14532d')).toBe(true)
    expect(prefersPaper('#1a1a18')).toBe(true)
    expect(prefersPaper('#ffffff')).toBe(false)
    expect(prefersPaper('#f6f4ee')).toBe(false)
    // Unreadable input never flips the ground: the dark pair is the one that was
    // always there, and a colour nobody could parse is not a reason to change it.
    expect(prefersPaper('not a colour')).toBe(false)
  })
})

// ── Legibility ───────────────────────────────────────────────────────────────

/**
 * Real themes, chosen so that a fix which only works for one of them fails here.
 *
 * A single theme proves nothing: the defect that started this shipped on a
 * partial theme, and the obvious repair — paint white when the ink fails —
 * passes on every dark direction and erases every pale one. So the sweep covers
 * light on light, dark on dark, a mid-tone monochrome with no contrast anywhere
 * in it, two colours a hue apart, and one theme that states the same colour four
 * times.
 */
const THEMES = {
  'nothing declared': undefined,
  // The reported defect, exactly as it arrived: an ink and an accent, no ground.
  'a dark green ink and no ground': { colors: { text: '#14532d', accent: '#16a34a' } },
  'editorial paper': {
    colors: { background: '#f6f4ee', text: '#1a1a18', accent: '#c2410c', surface: '#ffffff' },
  },
  'light on light — a pale ink on paper': {
    colors: { background: '#fafaf9', text: '#a8a29e', accent: '#d6d3d1', surface: '#f5f5f4' },
  },
  'dark on dark — a dim ink on near-black': {
    colors: { background: '#0a0a0a', text: '#262626', accent: '#171717', surface: '#171717' },
  },
  terminal: { colors: { background: '#0c0a09', text: '#e7e5e4', accent: '#a3e635', surface: '#1c1917' } },
  'monochrome mid-tone': {
    colors: { background: '#808080', text: '#8a8a8a', accent: '#767676', surface: '#909090' },
  },
  'two greens': { colors: { background: '#f0fdf4', text: '#14532d', accent: '#166534', surface: '#dcfce7' } },
  'one colour, four times': {
    colors: { background: '#3b82f6', text: '#3b82f6', accent: '#3b82f6', surface: '#3b82f6' },
  },
  'a ground and no ink': { colors: { background: '#f6f4ee' } },
  'an ink and no ground': { colors: { text: '#f6f4ee' } },
  'an amber accent': { colors: { accent: '#f59e0b' } },
}

/**
 * The contrast of one run, re-measured from the primitives.
 *
 * Deliberately NOT `run.ratio`: the palette computed that number, and a test
 * that read it back would agree with the code by construction. This rebuilds the
 * surface from its declared colour and alpha, over both extremes of what an
 * unknown picture can be, and takes the worse of the two — which is the claim
 * the feature actually makes.
 *
 * The `tint` is rebuilt here too, and it is the reason a background is allowed
 * to exist in these templates at all: a field of hairlines over a flat ground
 * means a glyph sits on one of two known colours, and this measures both. A
 * helper that ignored it would go green on a texture dense enough to eat the
 * headline's margin — the one way a decorative layer can undo the guarantee
 * without touching the code that makes it.
 */
function measure(run) {
  const { color, alpha, tint } = run.on
  const grounds = [color]
  if (tint) grounds.push(blend(tint.color, color, tint.alpha))
  const backdrops = grounds.flatMap((ground) =>
    alpha >= 1 ? [ground] : [blend(ground, '#000000', alpha), blend(ground, '#ffffff', alpha)],
  )
  return Math.min(...backdrops.map((bg) => contrastRatio(run.color, bg)))
}

describe('no text is ever illegible, and it is decided by measurement', () => {
  /**
   * The whole point, in one loop: every composition, every theme, every run.
   *
   * The failure message names the composition, the theme, the pair and the
   * number, because "a contrast test failed" on a sweep of sixty combinations
   * sends the reader nowhere.
   */
  for (const [name, build] of Object.entries(PALETTES)) {
    describe(name, () => {
      for (const [label, document] of Object.entries(THEMES)) {
        it(`clears its floor on: ${label}`, () => {
          const palette = build(resolveTheme(document))
          const failures = palette.runs
            .map((run) => {
              const ratio = measure(run)
              return ratio >= run.threshold
                ? null
                : `${run.color} on ${run.on.color}@${run.on.alpha} = ${ratio.toFixed(2)}:1, needs ${run.threshold}:1`
            })
            .filter(Boolean)
          expect(failures.join('\n')).toBe('')
        })
      }
    })
  }

  /**
   * Guarding the guard. Every palette must actually produce runs, or the loop
   * above is green because it iterated nothing — the failure mode a data-driven
   * test has that a hand-written one does not.
   */
  it('measures something for every template in the catalogue', () => {
    expect(Object.keys(PALETTES).sort()).toEqual(Object.keys(COMPOSITIONS).sort())
    for (const [name, build] of Object.entries(PALETTES)) {
      const palette = build(resolveTheme(undefined))
      expect(palette.runs.length, name).toBeGreaterThan(0)
      for (const run of palette.runs) {
        expect(run.color, name).toMatch(/^#[0-9a-f]{6}$/)
        expect([CONTRAST_MIN, CONTRAST_MIN_LARGE]).toContain(run.threshold)
      }
    }
  })

  /**
   * The defect, end to end, on the two compositions it was reported on.
   *
   * Not "the headline is legible" — that is the loop above — but "the headline
   * is still the project's green". The obvious repair passes the loop and fails
   * this: a white headline on black is perfectly readable and is not the film
   * anybody designed.
   */
  it('renders the reported film in its own colours rather than repainting it white', () => {
    const theme = resolveTheme({ colors: { text: '#14532d', accent: '#16a34a' } })
    for (const build of [PALETTES.titles, PALETTES.product]) {
      const palette = build(theme)
      expect(palette.ground.color).toBe(PAPER_FALLBACK.background)
      expect(palette.headline.color).toBe('#14532d')
      expect(palette.headline.color).not.toBe(INK_LIGHT)
    }
  })

  /**
   * The rule the fallback pair is last for. A direction with two greens has to
   * render a legible green; answering with black or white would clear every
   * threshold and throw away the art direction, which is the failure the
   * candidate ORDER exists to prevent.
   */
  it('reaches for the theme before it reaches for black or white', () => {
    const theme = resolveTheme(THEMES['two greens'])
    const palette = PALETTES.titles(theme)
    expect([theme.text, theme.accent, theme.surface, theme.background]).toContain(palette.headline.color)
    expect(palette.headline.color).not.toBe(INK_LIGHT)
    expect(palette.headline.color).not.toBe(INK_DARK)

    // And the order itself, stated: the declared ink first, the fallback pair
    // last, and pure black after even them.
    expect(inkCandidates(theme).slice(0, 4)).toEqual([theme.text, theme.surface, theme.accent, theme.background])
    expect(inkCandidates(theme).slice(-3)).toEqual([INK_LIGHT, INK_DARK, INK_FLOOR])
  })

  /**
   * The search must never end while an answer is still on the table.
   *
   * `INK_DARK` is a chosen near-black and it carries 0.005 of luminance, which is
   * a fifth of a point of contrast; on a ground around 0.19 of relative luminance
   * that fifth of a point is the whole margin. Black and white cross at 4.58:1,
   * so an OPAQUE surface always has an ink that clears 4.5 — and a list that
   * stopped at `#101014` stopped at 4.36:1 and left two thirds of this file's
   * measured failures one candidate short of legible.
   *
   * The ground below is in that band. It is checked twice: that the arithmetic
   * still says what the constant claims, and that the palette actually reaches
   * the answer rather than degrading next to it.
   */
  it('ends its search at black, not at the near-black it prefers', () => {
    const ground = '#976f68'
    expect(contrastRatio(INK_LIGHT, ground)).toBeLessThan(CONTRAST_MIN)
    expect(contrastRatio(INK_DARK, ground)).toBeLessThan(CONTRAST_MIN)
    expect(contrastRatio(INK_FLOOR, ground)).toBeGreaterThanOrEqual(CONTRAST_MIN)

    const found = legibleOn({ color: ground, alpha: 1 }, inkCandidates(resolveTheme(undefined)), CONTRAST_MIN)
    expect(found.ok).toBe(true)
    expect(found.color).toBe(INK_FLOOR)
  })

  /**
   * A theme with no contrast anywhere in it is where the fallback pair earns its
   * place — and where the sweep above would be satisfied by an answer that was
   * only ever going to be black or white.
   */
  it('falls back to black or white only when nothing in the theme can be read', () => {
    const palette = PALETTES.titles(resolveTheme(THEMES['one colour, four times']))
    expect([INK_LIGHT, INK_DARK]).toContain(palette.headline.color)
  })
})

describe('the veil is a lever, and it only ever moves one way', () => {
  /**
   * A veil is raised before an ink is replaced, because a denser band is the
   * least visible repair available and it keeps the colour the project chose.
   * Lowering one would be the opposite: a repair that makes the very thing it
   * was called about worse.
   */
  it('never lowers a veil below the density the design asked for', () => {
    for (const document of Object.values(THEMES)) {
      const theme = resolveTheme(document)
      expect(PALETTES.slideshow(theme).panel.alpha).toBeGreaterThanOrEqual(SLIDESHOW_PANEL_VEIL)
      expect(PALETTES.overlay(theme).band.alpha).toBeGreaterThanOrEqual(BAND_VEIL)
      expect(PALETTES.vertical(theme).dim.alpha).toBeGreaterThanOrEqual(VERTICAL_DIM)
    }
  })

  it('never makes a veil opaque, because a band that hides the capture has failed too', () => {
    for (const document of Object.values(THEMES)) {
      const theme = resolveTheme(document)
      expect(PALETTES.overlay(theme).band.alpha).toBeLessThanOrEqual(MAX_VEIL_ALPHA)
      expect(PALETTES.slideshow(theme).panel.alpha).toBeLessThanOrEqual(MAX_VEIL_ALPHA)
    }
  })

  /**
   * The default direction must not change. Every existing export was cut on it,
   * and a legibility pass that re-tinted films which were already correct would
   * be a redesign wearing a bug fix's clothes.
   */
  it('leaves a film cut on the default direction exactly as it was', () => {
    const theme = resolveTheme(undefined)
    expect(PALETTES.overlay(theme).band.alpha).toBe(BAND_VEIL)
    expect(PALETTES.slideshow(theme).panel.alpha).toBe(SLIDESHOW_PANEL_VEIL)
    expect(PALETTES.titles(theme).headline.color).toBe(THEME_FALLBACK.text)
    expect(PALETTES.product(theme).cta.color).toBe(INK_LIGHT)
  })

  /**
   * Both runs on a band share its opacity, so the band has to be dense enough
   * for the one that needed most. Resolving them independently and painting the
   * title's answer is the bug this two-pass shape exists to prevent.
   */
  it('resolves two runs on one band at the density the greedier one needed', () => {
    for (const document of Object.values(THEMES)) {
      const palette = PALETTES.overlay(resolveTheme(document))
      expect(palette.title.on).toBe(palette.band)
      expect(palette.subtitle.on).toBe(palette.band)
    }
  })

  it('narrows what a picture can composite a veil to, as the veil gets denser', () => {
    // The nesting that makes raising an alpha safe: the range only shrinks, so a
    // run can never be made worse by a veil somebody else asked for.
    const [darkAt6, lightAt6] = surfaceRange('#808080', 0.6)
    const [darkAt9, lightAt9] = surfaceRange('#808080', 0.9)
    expect(parseInt(darkAt9.slice(1, 3), 16)).toBeGreaterThan(parseInt(darkAt6.slice(1, 3), 16))
    expect(parseInt(lightAt9.slice(1, 3), 16)).toBeLessThan(parseInt(lightAt6.slice(1, 3), 16))
    expect(surfaceRange('#808080', 1)).toEqual(['#808080'])
  })
})

describe('legibleOn degrades, it never fails', () => {
  /**
   * Q1, at the level of a single colour. A mid-tone surface with a mid-tone
   * palette can genuinely have no answer at 4.5:1 — the two windows where white
   * and black each work leave a narrow band between them — and the honest
   * outcome is the most legible pair available with `ok: false`, not a thrown
   * error that costs somebody an export they already queued for.
   */
  it('answers with its best attempt when nothing clears the bar', () => {
    const impossible = legibleOn({ color: '#797979' }, ['#7a7a7a'], CONTRAST_MIN)
    expect(impossible.ok).toBe(false)
    expect(impossible.color).toMatch(/^#[0-9a-f]{6}$/)
    expect(impossible.ratio).toBeGreaterThan(0)
  })

  it('answers for a surface and a candidate list it cannot read', () => {
    for (const hostile of [undefined, null, { color: 'red; } body {' }, { color: '#fff', alpha: 'x' }]) {
      const found = legibleOn(hostile, ['nonsense', undefined], CONTRAST_MIN_LARGE)
      expect(found.color, JSON.stringify(hostile)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  /**
   * The quiet ladder. A subtitle is quieter than its headline on purpose, and
   * hierarchy is worth something — it is worth less than being read, so the
   * quieting is walked back before the ink is replaced.
   */
  it('gives up quietness before it gives up the ink', () => {
    // Paper with a green ink: a 74% mix lands just under 4.5:1, and the answer is
    // a stronger green rather than a different colour.
    const found = legibleOn({ color: '#f7f7f4' }, ['#14532d', INK_DARK], CONTRAST_MIN, { quiet: 0.74 })
    expect(found.ok).toBe(true)
    expect(found.color).not.toBe(INK_DARK)
    expect(contrastRatio(found.color, '#f7f7f4')).toBeGreaterThanOrEqual(CONTRAST_MIN)
  })
})

describe('a decoration is measured, and it never darkens the picture', () => {
  /**
   * The accent enters the search at a different point rather than through a
   * different mechanism — and it is a SUPERSET of the ordinary list, which is
   * what makes "a decoration cannot fail where the text succeeded" true rather
   * than hopeful: every shared surface already carries a run at the display
   * floor resolved from `inkCandidates`.
   */
  it('asks for the accent first and then for everything else', () => {
    for (const document of Object.values(THEMES)) {
      const theme = resolveTheme(document)
      expect(accentFirst(theme)[0]).toBe(theme.accent)
      for (const candidate of inkCandidates(theme)) expect(accentFirst(theme)).toContain(candidate)
    }
  })

  /**
   * The lock, on the case it was written for. The fallback indigo cannot be read
   * on the default band at the density the design asked for, and the veil ladder
   * would happily buy it six more points of opacity — which hides the capture the
   * banded template exists to show.
   */
  it('gives up the accent rather than the capture', () => {
    const theme = resolveTheme(undefined)
    const surface = { color: theme.surface, alpha: BAND_VEIL }
    const free = legibleOn(surface, accentFirst(theme), CONTRAST_MIN_LARGE)
    const locked = legibleOn(surface, accentFirst(theme), CONTRAST_MIN_LARGE, { lockVeil: true })

    expect(free.color).toBe(theme.accent)
    expect(free.veilAlpha).toBeGreaterThan(BAND_VEIL)

    expect(locked.veilAlpha).toBe(BAND_VEIL)
    expect(locked.color).not.toBe(theme.accent)
    expect(locked.ok).toBe(true)

    // And the palette took the locked answer: the band is exactly as dense as it
    // was before there was a kicker on it.
    expect(PALETTES.overlay(theme).band.alpha).toBe(BAND_VEIL)
  })

  /**
   * Every accent run sits on the surface its neighbours sit on, at the density
   * its neighbours settled. A decoration resolved on a surface of its own would
   * be measuring a frame nobody renders.
   */
  it('paints every accent on the same surface as the text beside it', () => {
    for (const document of Object.values(THEMES)) {
      const theme = resolveTheme(document)
      const titles = PALETTES.titles(theme)
      const overlay = PALETTES.overlay(theme)
      const vertical = PALETTES.vertical(theme)
      const product = PALETTES.product(theme)
      expect(titles.accented.on).toBe(titles.ground)
      expect(overlay.accented.on).toBe(overlay.band)
      expect(vertical.accented.on).toBe(vertical.dim)
      expect(product.accented.on).toBe(product.ground)
    }
  })

  /**
   * The rail is the one accent run that is NOT locked, and the comment on it
   * says why: its track carries no other run, so there is no density somebody
   * else already proved workable, and 0.55 over an unknown photograph spans a
   * range wide enough that black and white can both fail at one end of it. It is
   * allowed to thicken because it costs a bar three pixels tall.
   */
  it('lets the story rail thicken its own track, since nothing else is on it', () => {
    for (const [label, document] of Object.entries(THEMES)) {
      const palette = PALETTES.vertical(resolveTheme(document))
      expect(palette.rail.track.alpha, label).toBeGreaterThanOrEqual(VERTICAL_DIM)
      expect(palette.rail.track.alpha, label).toBeLessThanOrEqual(MAX_VEIL_ALPHA)
      expect(palette.rail.fill.on, label).toBe(palette.rail.track)
      // And it is not the dim: darkening the picture to colour a rail is the
      // trade this shape exists to refuse.
      expect(palette.rail.track, label).not.toBe(palette.dim)
    }
  })

  /**
   * A texture is the one decorative layer that can undo the whole legibility
   * section without touching a line of it: a glyph on a hairline field sits on
   * one of two colours, and a palette that measured only one of them would go
   * green on a texture dense enough to eat a headline's margin.
   *
   * Both colours are KNOWN here, unlike a photograph, so both are measured — and
   * the composition paints the texture by reading the same object back, which is
   * what stops a density nudged in a component from leaving the measurement
   * behind.
   */
  it('measures the ground a texture makes, not the ground underneath it', () => {
    expect(surfaceRange('#ffffff', 1, { color: '#000000', alpha: 0.5 })).toEqual(['#ffffff', '#808080'])
    // A tint that cannot be read paints nothing, so the range is what it was.
    expect(surfaceRange('#ffffff', 1, { color: 'red; } body {', alpha: 0.5 })).toEqual(['#ffffff'])
    expect(surfaceRange('#ffffff', 1, { color: '#000000', alpha: 0 })).toEqual(['#ffffff'])
    expect(surfaceRange('#ffffff', 1)).toEqual(['#ffffff'])
  })

  it('carries the texture on the two grounds that have one, and on neither photograph', () => {
    for (const [label, document] of Object.entries(THEMES)) {
      const theme = resolveTheme(document)
      for (const name of ['titles', 'product']) {
        const ground = PALETTES[name](theme).ground
        expect(ground.tint, `${name} on ${label}`).toEqual(groundTint(theme))
        expect(ground.tint.alpha).toBe(TEXTURE_ALPHA)
      }
      // A template whose ground IS a photograph has nothing to texture, and a
      // tint there would be a claim about a surface this file cannot see.
      expect(PALETTES.overlay(theme).band.tint, label).toBeUndefined()
      expect(PALETTES.vertical(theme).dim.tint, label).toBeUndefined()
    }
  })

  /**
   * The texture costs contrast, and this is the test that says how much. A
   * headline still clears its floor over the tinted ground — which the sweep
   * above proves for every theme — and the tint is what a reader would have to
   * change to make that stop being true.
   */
  it('leaves a headline its margin over the tinted ground', () => {
    for (const [label, document] of Object.entries(THEMES)) {
      const palette = PALETTES.titles(resolveTheme(document))
      const tinted = blend(palette.ground.tint.color, palette.ground.color, palette.ground.tint.alpha)
      expect(contrastRatio(palette.headline.color, tinted), label).toBeGreaterThanOrEqual(CONTRAST_MIN_LARGE)
    }
  })

  /**
   * And the case the test above cannot reach: a ground where the texture is what
   * makes a line illegible.
   *
   * Every other layer in this file can move — a veil rises, a quiet ink goes back
   * to full strength, an ink is replaced — and the hairline field was the one
   * exception, fixed at `TEXTURE_ALPHA` and therefore able to spend contrast that
   * nothing could win back. `#5f7780` is such a ground: bare it has an ink at
   * 4.5, tinted with a pale accent it has none, and the run used to come back
   * `ok: false` rather than give up an ornament nobody is looking at.
   *
   * Both directions are asserted, because "drop the texture" on its own is a fix
   * that quietly removes it everywhere.
   */
  it('gives up the texture rather than a line of text, and only then', () => {
    const brittle = resolveTheme({ colors: { background: '#5f7780', accent: '#fbf556', surface: '#436260' } })
    const bare = PALETTES.titles(brittle)
    expect(bare.ground.tint).toBeUndefined()
    for (const run of bare.runs) expect(run.ok, `${run.color} on ${run.on.color}`).toBe(true)

    // The same ground, and the texture would have cost it: with the tint there
    // is no candidate at the body floor at all.
    const tinted = surfaceRange(brittle.background, 1, groundTint(brittle))
    const best = Math.max(...inkCandidates(brittle).map((ink) => worstRatio(ink, tinted)))
    expect(best).toBeLessThan(CONTRAST_MIN)

    // Everywhere else the field stays: the sweep's own themes all keep theirs,
    // which is what the test above already walks.
    expect(PALETTES.titles(resolveTheme(undefined)).ground.tint).toEqual(groundTint(resolveTheme(undefined)))
  })
})

describe('per-template geometry', () => {
  /**
   * The SHORT edge, because all three ratios are 1080 there. Deriving a type
   * scale from `height` is the mistake that was there first: a title tuned on a
   * 1080-tall 16:9 frame comes out at 1920/1080 times the size in `9:16`,
   * filling the frame with four words.
   */
  it('derives one type scale from the short edge of every ratio', () => {
    expect(frameBase(1920, 1080)).toBe(1080)
    expect(frameBase(1080, 1920)).toBe(1080)
    expect(frameBase(1080, 1080)).toBe(1080)
  })

  /**
   * Square stacks deliberately: a 1080×1080 split leaves two 540 px halves,
   * which is the worst of both a picture and a paragraph.
   */
  it('stands a product card side by side only in landscape', () => {
    expect(productLayout(1920, 1080)).toBe('row')
    expect(productLayout(1080, 1920)).toBe('column')
    expect(productLayout(1080, 1080)).toBe('column')
  })

  /**
   * The kicker's size is a constant because a THRESHOLD depends on it: it is
   * measured at the 3:1 display floor, which is only legitimate while it stays
   * "large text" under the rule the audit applies — 18.66 px at weight 700.
   * Shrink it to look more delicate and a run silently drops below its own floor.
   */
  it('keeps the kicker large enough for the floor it is measured at', () => {
    for (const [width, height] of [
      [1920, 1080],
      [1080, 1920],
      [1080, 1080],
    ]) {
      expect(Math.round(frameBase(width, height) * KICKER_SIZE)).toBeGreaterThanOrEqual(24)
    }
  })

  /**
   * A band that stops where its text stops gives back the strip of the capture
   * the film exists to show. Both numbers matter: 62% of a portrait frame would
   * break a 60-character title into five lines, which is why there are two.
   */
  it('keeps a band off every edge, and wider on a narrow frame', () => {
    const landscape = bandInset(1920, 1080)
    const portrait = bandInset(1080, 1920)
    expect(landscape.maxWidthPercent).toBeLessThan(portrait.maxWidthPercent)
    for (const inset of [landscape, portrait, bandInset(1080, 1080)]) {
      expect(inset.marginPercent).toBeGreaterThan(0)
      // Never the whole frame: a band that reaches the far edge is the lower
      // third this template stopped being.
      expect(inset.maxWidthPercent + 2 * inset.marginPercent).toBeLessThan(100)
    }
  })

  /**
   * The push-in that makes a cut land. Overscale only — a translation would drag
   * the background in behind the picture — and gone by `PUNCH_FRAMES`, so it can
   * never be mistaken for the document's own Ken Burns move.
   */
  it('lands a cut and then gets out of the way', () => {
    expect(punchTransform(0)).toBe(`scale(${1 + PUNCH_SCALE})`)
    expect(punchTransform(PUNCH_FRAMES)).toBe('scale(1)')
    expect(punchTransform(9999)).toBe('scale(1)')
    expect(punchTransform('x')).toBe(`scale(${1 + PUNCH_SCALE})`)
    // Decelerating, like every other arrival in the catalogue.
    const half = Number(punchTransform(PUNCH_FRAMES / 2).match(/scale\(([\d.]+)\)/)[1])
    expect(half).toBeLessThan(1 + PUNCH_SCALE / 2)
  })

  /**
   * The one element of a vertical film that survives a cut, and the reason it is
   * measured on scene STARTS rather than on durations: transitions overlap, so
   * two segments would be in motion at once during every crossfade and the rail
   * would contradict the picture.
   */
  it('fills one segment at a time, in order, to the end of the film', () => {
    const plan = planTimeline(timeline([scene(2000), scene(2000), scene(2000)], { aspectRatio: '9:16' }))
    expect(railSegments(plan, 0)).toEqual([0, 0, 0])
    expect(railSegments(plan, plan.totalFrames)).toEqual([1, 1, 1])

    let previous = [0, 0, 0]
    for (let frame = 0; frame <= plan.totalFrames; frame += 1) {
      const fills = railSegments(plan, frame)
      // Monotone in time, and never more than one segment part-way: everything
      // before the current scene is full, everything after it is empty.
      const moving = fills.filter((fill) => fill > 0 && fill < 1)
      expect(moving.length, `frame ${frame}`).toBeLessThanOrEqual(1)
      fills.forEach((fill, i) => expect(fill, `frame ${frame}, segment ${i}`).toBeGreaterThanOrEqual(previous[i]))
      previous = fills
    }
  })

  it('answers for a plan it cannot read rather than throwing inside Chromium', () => {
    expect(railSegments(undefined, 10)).toEqual([])
    expect(railSegments({ scenes: [] }, 10)).toEqual([])
    expect(railSegments({ scenes: [{ from: 0, durationInFrames: 30 }] }, 'x')).toEqual([0])
  })

  /**
   * The old fixed size was tuned so that the LONGEST legal caption fitted, which
   * rendered every short one at the size a paragraph needed — three words at
   * paragraph size, in the one template where three words should fill the frame.
   */
  it('gives a short caption the frame and a long one the safe area', () => {
    const base = 1080
    expect(verticalCaptionSize('Trois mots ici', base)).toBe(Math.round(base * VERTICAL_CAPTION_MAX))
    expect(verticalCaptionSize('x'.repeat(VERTICAL_CAPTION_LONG_CHARS), base)).toBe(
      Math.round(base * VERTICAL_CAPTION_MIN),
    )
    // Past the ramp it saturates rather than continuing to shrink, which is what
    // makes restating a number near the schema's limit safe here.
    expect(verticalCaptionSize('x'.repeat(400), base)).toBe(Math.round(base * VERTICAL_CAPTION_MIN))

    // Non-increasing across the whole range, and never below the floor.
    let previous = Infinity
    for (let chars = 0; chars <= 200; chars += 1) {
      const size = verticalCaptionSize('x'.repeat(chars), base)
      expect(size, `${chars} characters`).toBeLessThanOrEqual(previous)
      expect(size).toBeGreaterThanOrEqual(Math.round(base * VERTICAL_CAPTION_MIN))
      previous = size
    }
    // Larger at BOTH ends than the slideshow's fixed 0.082, which is the whole
    // point of the template.
    expect(verticalCaptionSize('x'.repeat(VERTICAL_CAPTION_SHORT_CHARS), base)).toBeGreaterThan(base * 0.082)
  })

  it('never answers a caption size out of a base it cannot read', () => {
    expect(verticalCaptionSize('anything', undefined)).toBe(0)
    expect(verticalCaptionSize(null, 1080)).toBe(Math.round(1080 * VERTICAL_CAPTION_MAX))
  })

  /**
   * The texture is CSS built from a declared token, so it goes through
   * `withAlpha` like every other colour that becomes a style — which validates
   * the hex on the way through, for the reason `safeColor` exists at all.
   */
  it('builds the hairline field out of a validated colour', () => {
    expect(hairlineTexture('#ffffff', 0.5, 8)).toBe(
      'repeating-linear-gradient(to bottom, rgba(255, 255, 255, 0.5) 0px, rgba(255, 255, 255, 0.5) 1px, transparent 1px, transparent 8px)',
    )
    // A colour that could close a declaration becomes black, never itself.
    expect(hairlineTexture('red; } body {', 0.5, 8)).toContain('rgba(0, 0, 0, 0.5)')
    expect(hairlineTexture('#ffffff', 0.5, 'x')).toContain('transparent 2px')
  })
})
