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
import { blend, channels as colorChannels, contrastRatio } from './contrast.js'
// The two block files that hold a share table this one mirrors — `RULE_EXTENTS`
// and `SOLID_SHARE`. They are plain arithmetic with no React and no Remotion in
// them (that is the rule `blocks.test.js` enforces), so importing them here costs
// this file none of the portability its own header is about, and it is the only
// thing that can hold `DECLARED_SHARE` equal to the two copies it was taken from.
import { RULE_EXTENTS } from './blocks/misc.js'
// `SOLID_SHARE` is not exported from its file, so the share is read back through
// the one function that applies it. Same claim, one step further out.
import { solidCanvas } from './blocks/setPiece.js'
import {
  ANCHORS,
  ANIMATED_BACKGROUNDS,
  BAND_VEIL,
  COMPOSED_CELL_GAP,
  COMPOSED_IMAGE_VEIL,
  COMPOSED_SAFE_PERCENT,
  COMPOSED_STACK_GAP,
  COMPOSITIONS,
  CONTRAST_MIN,
  CONTRAST_MIN_LARGE,
  CUE_ENTER_FRAMES,
  CUE_TAIL_GAP_FRAMES,
  DIMENSIONS,
  EMPHASIS_ENTER_FRAMES,
  FPS,
  GRADIENT_RAMP,
  INK_DARK,
  INK_FLOOR,
  INK_LIGHT,
  INSTALLED_FONT_STACK,
  KICKER_SIZE,
  MAX_TRANSITION_SHARE,
  MAX_VEIL_ALPHA,
  MIN_CUE_TAIL_FRAMES,
  MOTIONS,
  OVERLAY_DRIFT_PERCENT,
  OVERLAY_DRIFT_SCALE,
  OVERLAY_SETTLE_FRAMES,
  OVERLAY_SETTLE_SCALE,
  PALETTES,
  PAPER_FALLBACK,
  PIXEL_CELL_PERCENT,
  PULSE_FLOOR,
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
  VERTICAL_SAFE_BOTTOM_PERCENT,
  VERTICAL_SAFE_SIDE_PERCENT,
  VERTICAL_SAFE_TOP_PERCENT,
  FIELD_ALPHAS,
  FIELD_PAINTS,
  FIELD_PAINT_KINDS,
  FIELD_RAMP,
  BLOCK_APPETITE,
  BOLD_LARGE_PX,
  BOX_FILL_FLOOR,
  CONSTANT_CEILING,
  DECLARED_SHARE,
  KICKER_TRACKING_EM,
  LINE_SAFETY,
  MEAN_GLYPH_EM,
  MEAN_MONO_EM,
  TYPE_ROLES,
  accentFirst,
  anchorCell,
  backgroundKind,
  bandInset,
  blockExtent,
  blockHeight,
  blockShape,
  composedLayout,
  composedPalette,
  composedSafeArea,
  compositionIdFor,
  cueFrames,
  cueProgress,
  dimensionsFor,
  easeOutCubic,
  entranceStyle,
  fieldPaints,
  fontStack,
  frameBase,
  groundDensity,
  groundPainted,
  groundTint,
  hairlineTexture,
  harmoniseUnits,
  inkCandidates,
  kenBurnsTransform,
  layerCues,
  legibleOn,
  meanAdvanceEm,
  msToFrames,
  ordinalLabel,
  overlayAlignment,
  overlayDriftTransform,
  planTimeline,
  prefersPaper,
  productLayout,
  progressAt,
  punchTransform,
  railSegments,
  readableInk,
  resolveTheme,
  runAdvanceEm,
  sceneLabel,
  sceneMotion,
  shapeCeiling,
  solveTypeUnit,
  stackedField,
  surfaceRange,
  textLines,
  typeRole,
  typeScale,
  typeSize,
  hairline,
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

/**
 * The two halves of a `scale(x) translateY(y%)`, read back out.
 *
 * A transform is a string because that is what lands in a style, and asserting on
 * the whole string would make every one of these tests a check on the formatting
 * of a float. The numbers are the claim.
 */
const driftScale = (transform) => Number(transform.match(/scale\(([-\d.]+)\)/)[1])
const driftPercent = (transform) => Number(transform.match(/translateY\(([-\d.]+)%\)/)[1])

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

  /**
   * The kicker's text belongs to the plan, because it is the only place that
   * knows how many scenes there are — and because two computations of it
   * disagreed: `sceneMotion` reported a kicker arriving on every one-scene film,
   * where the composition draws none.
   */
  it('carries the scene counter, and leaves it empty when there is nothing to count', () => {
    const many = planTimeline(timeline([scene(2000), scene(2000), scene(2000)]))
    expect(many.scenes.map((entry) => entry.label)).toEqual(['01 / 03', '02 / 03', '03 / 03'])
    expect(planTimeline(timeline([scene(2000)])).scenes[0].label).toBe('')
  })
})

describe('compositionIdFor', () => {
  /**
   * Six templates, six compositions, and `render.js` selects by the id this
   * returns. A template with no entry cannot be reached by any route into the
   * process — the same shape the schema has on the Mocky side.
   *
   * The sixth is the composable variant, and it is ONE composition rather than a
   * sixth look: what varies inside it is which blocks it lays out, and those are
   * components under `blocks/` that this map never names.
   */
  it('names a distinct composition for each template in the catalogue', () => {
    expect(Object.keys(COMPOSITIONS)).toEqual(['slideshow', 'overlay', 'vertical', 'titles', 'product', 'composed'])
    expect(new Set(Object.values(COMPOSITIONS)).size).toBe(6)
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

describe('sceneMotion', () => {
  /**
   * The five compositions read this object instead of working out their own
   * arrivals, which is what makes "does this scene move" answerable without
   * rendering an mp4. `tests/video-motion.test.js` asks the whole question, over
   * documents parsed by the real schema; what belongs here is the shape.
   */
  it('has an entry for every composition, keyed the same way', () => {
    expect(Object.keys(MOTIONS).sort()).toEqual(Object.keys(COMPOSITIONS).sort())
    expect(Object.keys(MOTIONS).sort()).toEqual(Object.keys(PALETTES).sort())
  })

  /** A document from the queue's journal can predate the catalogue entirely. */
  it('reads an absent template as a slideshow', () => {
    const entry = { scene: scene(4000), durationInFrames: 120 }
    expect(sceneMotion(undefined, entry, 10)).toEqual(sceneMotion('slideshow', entry, 10))
    expect(sceneMotion(null, entry, 10)).toEqual(sceneMotion('slideshow', entry, 10))
  })

  /**
   * Answers rather than throws, unlike `compositionIdFor`, and the difference is
   * where each one runs: that function is called once, in Node, before anything
   * is rendered — it is the refusal, and it names the template. This one runs on
   * every frame inside Chromium, where a throw turns a message the caller could
   * read into a render that dies half a minute in.
   */
  it('answers for anything it is handed rather than throwing inside a browser', () => {
    for (const bad of ['karaoke', 'constructor', '__proto__', 42, {}]) {
      expect(sceneMotion(bad, { scene: {}, durationInFrames: 90 }, 0), String(bad)).toEqual({})
    }
    expect(() => sceneMotion('titles', undefined, undefined)).not.toThrow()
    expect(() => sceneMotion('product', { scene: null, durationInFrames: 0 }, NaN)).not.toThrow()
  })

  /**
   * A term is reported only when the composition draws the thing it belongs to.
   *
   * Not tidiness: a `caption` progress running 0 → 1 on a scene that carries no
   * caption is a number that changes while the frame does not, and the test that
   * asks "did anything move between the first and last frame" would have accepted
   * it. That is the same defect as a schema field the renderer ignores, arriving
   * through the one thing written to catch it.
   */
  it('reports nothing for text a scene does not carry', () => {
    const bare = { scene: scene(4000), durationInFrames: 120 }
    expect(sceneMotion('slideshow', bare, 60)).not.toHaveProperty('caption')
    expect(sceneMotion('slideshow', { ...bare, scene: scene(4000, { textOverlay: { content: 'Hi', position: 'top' } }) }, 60)).toHaveProperty(
      'caption',
    )

    const noCta = { scene: { imageId: 'a'.repeat(64), durationMs: 4000, headline: 'A', bullets: ['b'] }, durationInFrames: 120 }
    expect(sceneMotion('product', noCta, 60)).not.toHaveProperty('cta')
    expect(sceneMotion('product', { ...noCta, scene: { ...noCta.scene, cta: 'Go' } }, 60)).toHaveProperty('cta')

    const noSubtitle = { scene: { headline: 'A B', durationMs: 4000, animation: 'fade' }, durationInFrames: 120 }
    expect(sceneMotion('titles', noSubtitle, 60)).not.toHaveProperty('subtitle')

    // The band's subtitle is optional like the rest, and was the one term that
    // was reported unconditionally.
    const band = (subtitle) => ({
      scene: { imageId: 'a'.repeat(64), durationMs: 4000, move: 'drift-up', band: { title: 'T', subtitle } },
      durationInFrames: 120,
      label: '01 / 02',
    })
    expect(sceneMotion('overlay', band(null), 60)).not.toHaveProperty('subtitle')
    expect(sceneMotion('overlay', band('S'), 60)).toHaveProperty('subtitle')
  })

  /**
   * The same rule again, on the one term whose answer is not in the document.
   *
   * A `gradient`, a `gridPulse` and a `particles` ground all move by moving the
   * ground's SECOND layer, and `Ground` paints no second layer at all when the
   * palette dropped it — which it does when that layer is what made a line
   * illegible (`texturedGround`, `fieldedGround`). A decoration cedes to a word,
   * and the frame it cedes on is a flat colour. Reporting a progress there is a
   * number that moves on an image that does not, which is what the kicker taught
   * two describe blocks up.
   *
   * The kind alone cannot answer it, so the composition passes what it paints.
   * The sweep says the tint survives on every direction in this corpus, so this
   * is theoretical today — and a claim about the corpus is not a claim about the
   * next direction somebody writes.
   */
  it('reports a ground progress only when there is a ground layer to move', () => {
    const composed = (kind) => ({
      scene: { durationMs: 4000, background: { kind }, layers: [{ kind: 'heading', text: 'A' }] },
      durationInFrames: 120,
    })
    for (const kind of ANIMATED_BACKGROUNDS) {
      expect(sceneMotion('composed', composed(kind), 60), kind).toHaveProperty('ground')
      expect(sceneMotion('composed', composed(kind), 60, { ground: true }), kind).toHaveProperty('ground')
      expect(sceneMotion('composed', composed(kind), 60, { ground: false }), kind).not.toHaveProperty('ground')
    }
    // A ground that never animates reports nothing either way: the flag says
    // whether there is a layer, not whether the layer moves.
    for (const kind of ['solid', 'hairlines', 'image']) {
      expect(sceneMotion('composed', composed(kind), 60, { ground: true }), kind).not.toHaveProperty('ground')
    }
    // And the drift and the stack are untouched by it, so a scene whose ground
    // gave up its texture still moves.
    const dropped = sceneMotion('composed', composed('gradient'), 60, { ground: false })
    expect(dropped.layers).toHaveLength(1)
    expect(dropped.drift).not.toBe(sceneMotion('composed', composed('gradient'), 0, { ground: false }).drift)
  })

  /**
   * The flag is read off the palette, and `Ground` reads the same function to
   * decide it has nothing to draw. Two readings of "is there a layer" is one of
   * them reporting a term the frame does not contain.
   */
  it('agrees with the palette about whether a ground has a layer at all', () => {
    const theme = resolveTheme(THEMES['editorial paper'])
    for (const [ground, background] of Object.entries(GROUNDS)) {
      const palette = composedPalette(theme, background)
      const layers = palette.groundTint ?? []
      expect(groundPainted(palette), ground).toBe(layers.length > 0)
    }
    // `solid` and `image` have no second layer at all, which is not the same
    // statement as "a photograph does not move" — the picture is its own term.
    expect(groundPainted(composedPalette(theme, GROUNDS.solid))).toBe(false)
    expect(groundPainted(composedPalette(theme, GROUNDS.image))).toBe(false)
    expect(groundPainted(composedPalette(theme, GROUNDS.hairlines))).toBe(true)
  })

  /**
   * The kicker is the same rule applied to a fact about the FILM rather than
   * about the scene: `sceneLabel` is empty on a one-scene film, so neither the
   * banded nor the titled composition draws a counter there — and both used to
   * report one arriving.
   *
   * The label is read off the entry rather than counted here, so an entry built
   * without one (a caller older than the field) means "no counter" instead of
   * meaning `undefined` in an opacity.
   */
  it('reports the kicker only on a film that has a counter to draw', () => {
    const overlay = (label) => ({
      scene: { imageId: 'a'.repeat(64), durationMs: 4000, move: 'drift-up', band: { title: 'T', subtitle: null } },
      durationInFrames: 120,
      ...(label === undefined ? {} : { label }),
    })
    expect(sceneMotion('overlay', overlay(''), 60)).not.toHaveProperty('kicker')
    expect(sceneMotion('overlay', overlay(undefined), 60)).not.toHaveProperty('kicker')
    expect(sceneMotion('overlay', overlay('02 / 07'), 60)).toHaveProperty('kicker')

    const titles = (label) => ({ scene: { headline: 'A B', durationMs: 4000, animation: 'fade' }, durationInFrames: 120, label })
    expect(sceneMotion('titles', titles(''), 60)).not.toHaveProperty('kicker')
    expect(sceneMotion('titles', titles('02 / 07'), 60)).toHaveProperty('kicker')
  })

  /**
   * And the cascade does not move when a term stops being reported: the cues are
   * placed for four elements whether or not the scene carries four, or a band
   * with a subtitle and one without would put their titles on different frames.
   */
  it('places the overlay cues the same way whatever the band carries', () => {
    const at = (subtitle, label) =>
      sceneMotion(
        'overlay',
        {
          scene: { imageId: 'a'.repeat(64), durationMs: 4000, move: 'drift-up', band: { title: 'T', subtitle } },
          durationInFrames: 120,
          label,
        },
        9,
      ).title
    expect(at(null, '')).toBe(at('S', '03 / 04'))
  })

  /**
   * The emphasis is in the timing as well as in the colour: the last word of a
   * headline of several takes `EMPHASIS_ENTER_FRAMES` where its neighbours take
   * `CUE_ENTER_FRAMES`, so partway through a shared cue it has arrived less far.
   * A single-word headline is left alone — that is not an accent, it is a
   * different speed for the only word there is.
   */
  it('gives the last word of a headline the longer entrance', () => {
    const entry = { scene: { headline: 'Conçu dans le navigateur', durationMs: 5000, animation: 'fade' }, durationInFrames: 150 }
    // Partway through the cue the four words share: same start, different speeds.
    const { words: arrived } = sceneMotion('titles', entry, 12)
    expect(arrived).toHaveLength(4)
    expect(arrived[0]).toBeGreaterThan(0)
    expect(arrived[3]).toBeLessThan(arrived[0])
    expect(arrived[0]).toBe(arrived[1])

    const alone = { scene: { headline: 'Mocky', durationMs: 5000, animation: 'fade' }, durationInFrames: 150 }
    expect(sceneMotion('titles', alone, 12).words).toHaveLength(1)
  })
})

describe('overlayDriftTransform', () => {
  /**
   * The move that answered the report, and the one that had to be safe on a
   * screenshot. Named after the side the PICTURE goes, the convention
   * `kenBurnsTransform` already states for its pans.
   */
  it('drifts to the side it is named after, through its own rest position', () => {
    const up = [0, 100, 199].map((f) => driftPercent(overlayDriftTransform('drift-up', f, 200)))
    expect(up[0]).toBeCloseTo(OVERLAY_DRIFT_PERCENT, 5)
    expect(up[1]).toBeCloseTo(0, 1)
    expect(up[2]).toBeCloseTo(-OVERLAY_DRIFT_PERCENT, 5)

    const down = [0, 199].map((f) => driftPercent(overlayDriftTransform('drift-down', f, 200)))
    expect(down[0]).toBeCloseTo(-OVERLAY_DRIFT_PERCENT, 5)
    expect(down[1]).toBeCloseTo(OVERLAY_DRIFT_PERCENT, 5)
  })

  /**
   * `settle` is a LANDING added to the drift, never offered instead of it. A move
   * that finished in twelve frames would leave fourteen seconds of frozen picture
   * behind it — the defect this field exists to make unreachable, arriving
   * through the field itself.
   */
  it('lands the settle onto the scale the other two hold, and keeps drifting after', () => {
    expect(driftScale(overlayDriftTransform('settle', 0, 200))).toBeCloseTo(OVERLAY_DRIFT_SCALE + OVERLAY_SETTLE_SCALE, 5)
    expect(driftScale(overlayDriftTransform('settle', OVERLAY_SETTLE_FRAMES, 200))).toBeCloseTo(OVERLAY_DRIFT_SCALE, 5)
    expect(driftScale(overlayDriftTransform('settle', 199, 200))).toBeCloseTo(OVERLAY_DRIFT_SCALE, 5)
    // Decelerating, like every other arrival in the catalogue.
    expect(driftScale(overlayDriftTransform('settle', OVERLAY_SETTLE_FRAMES / 2, 200))).toBeLessThan(
      OVERLAY_DRIFT_SCALE + OVERLAY_SETTLE_SCALE / 2,
    )
    // And still drifting once it has landed, which `drift-up` is doing all along.
    expect(driftPercent(overlayDriftTransform('settle', OVERLAY_SETTLE_FRAMES, 200))).not.toBe(
      driftPercent(overlayDriftTransform('settle', 199, 200)),
    )
  })

  /**
   * An unknown value drifts rather than freezing, which is the opposite of
   * `kenBurnsTransform`'s answer for the same situation — and deliberately so.
   * There, `static` is a value a document may legitimately hold, so `none` is a
   * legal outcome; here there is no legitimate immobility, and the one thing this
   * function must never do is hand back a still frame because a string was
   * misspelt three validators ago.
   */
  it('never freezes on a value it does not know', () => {
    for (const bad of [undefined, null, 'static', 'pan-left', 'constructor', 7]) {
      const t = overlayDriftTransform(bad, 0, 200)
      expect(t, String(bad)).toBe(overlayDriftTransform('drift-up', 0, 200))
      expect(t).not.toBe('none')
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
/** A colour with every channel multiplied, so the test can rebuild the dim end of a Lambert segment. */
function scale(color, factor) {
  const hex = colorChannels(color)
    .map((c) => Math.max(0, Math.min(255, Math.round(c * factor))).toString(16).padStart(2, '0'))
    .join('')
  return `#${hex}`
}

function measure(run) {
  const { color, alpha, tint } = run.on
  const grounds = [color]
  // One layer or several: a hairline field is one tint over the ground, and a
  // gradient is a RAMP sampled several times along its length. Rebuilt here from
  // whatever the palette says it measured, rather than assuming the shape — a
  // helper that only understood a single tint would silently stop checking the
  // ground with the most colours in it.
  for (const layer of Array.isArray(tint) ? tint : tint ? [tint] : []) {
    grounds.push(blend(layer.color, color, layer.alpha))
  }
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

// ── The composable variant ───────────────────────────────────────────────────

/** Every ground a composed scene can be painted on, as a document states it. */
const GROUNDS = {
  solid: { kind: 'solid' },
  gradient: { kind: 'gradient', direction: 'to-bottom' },
  hairlines: { kind: 'hairlines' },
  gridPulse: { kind: 'gridPulse', cells: 8 },
  particles: { kind: 'particles', density: 2 },
  image: { kind: 'image', imageId: 'a'.repeat(64), move: 'zoom-in' },
}

describe('composedPalette', () => {
  /**
   * The sweep the whole variant rests on: six grounds, a dozen real directions,
   * every run re-measured from primitives.
   *
   * `PALETTES.composed` above is only ever handed the ground a silent document
   * gets, which is one sixth of what this palette can be handed — and the other
   * five are where the interesting failures are. A gradient is a ramp between two
   * colours, a photograph is a colour nobody in this process has seen, and a
   * pulsing grid is a tint that also moves.
   */
  for (const [ground, background] of Object.entries(GROUNDS)) {
    describe(ground, () => {
      for (const [label, document] of Object.entries(THEMES)) {
        it(`clears every floor on: ${label}`, () => {
          const palette = composedPalette(resolveTheme(document), background)
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
   * The lit solid, which is the one surface in this directory that is not flat.
   *
   * A Lambert face is `material x (ambient + directional . n.l)`, so every face of
   * a `solidScene` lies on the segment between `material x ambient` and
   * `material`. Contrast against a fixed surface is monotone in luminance on each
   * side of that surface, and luminance is monotone along a channel-wise ramp —
   * so measuring the two ENDS measures every face between them. That is the whole
   * claim `solidShading` makes, and this is where it stops being prose.
   *
   * Both ends against every ground and every direction, because the two failures
   * are on opposite sides: on a dark ground the shading brightens and the DIM end
   * is the one at the floor, on paper it darkens and the BRIGHT end is.
   */
  it('lights a solid so that every face of it clears the display floor', () => {
    for (const [ground, background] of Object.entries(GROUNDS)) {
      for (const [label, document] of Object.entries(THEMES)) {
        const palette = composedPalette(resolveTheme(document), background)
        const { color, ambient } = palette.solid
        expect(ambient, `${ground} / ${label}`).toBeGreaterThan(0)
        expect(ambient).toBeLessThanOrEqual(1)
        for (const face of [color, scale(color, ambient)]) {
          const ratio = measure({ color: face, on: palette.ground })
          expect(ratio, `${ground} / ${label}: ${face} on ${palette.ground.color}`).toBeGreaterThanOrEqual(
            CONTRAST_MIN_LARGE,
          )
        }
      }
    }
  })

  /**
   * And it really is lit, on the directions where it can be.
   *
   * A guard on the degradation rather than on the shading: `solidShading` falls
   * back to a flat material when neither end clears, which is legal (Q1) and
   * would also be the answer if the arithmetic silently stopped working. A flat
   * solid keeps its perspective and its silhouette; a catalogue of four solids
   * that are all flat is a dependency paid for and not used.
   */
  it('shades rather than flattens on the directions that have room for it', () => {
    const shaded = Object.values(THEMES).filter(
      (document) => composedPalette(resolveTheme(document), GROUNDS.solid).solid.ambient < 1,
    )
    expect(shaded.length).toBeGreaterThan(Object.keys(THEMES).length / 2)
  })

  /**
   * Guarding the guard, as the five templates already do: a palette that produced
   * no runs would make every loop above green for having iterated nothing.
   */
  it('resolves the three surfaces a block can paint on, whatever the ground', () => {
    /*
     * The floor each run is resolved at, stated here rather than inferred.
     *
     * It is the half of the guarantee the sweep above cannot see: that loop
     * checks every run against ITS OWN threshold, so a run whose threshold was
     * wrong passes it by construction. Which floor applies is decided by the type
     * ROLE — display type and bold labels take 3, running text takes 4.5 — and a
     * run mapped to the wrong one is exactly the defect `panelText` was added
     * for: `codeBlock`'s majority role read `panelDisplay` and shipped a wall of
     * 21 px monospace measured at 3:1.
     */
    const FLOORS = {
      display: CONTRAST_MIN_LARGE,
      body: CONTRAST_MIN,
      accent: CONTRAST_MIN_LARGE,
      panelDisplay: CONTRAST_MIN_LARGE,
      panelBody: CONTRAST_MIN,
      panelAccent: CONTRAST_MIN_LARGE,
      panelText: CONTRAST_MIN,
      onFill: CONTRAST_MIN_LARGE,
    }
    for (const background of Object.values(GROUNDS)) {
      const palette = composedPalette(resolveTheme(undefined), background)
      // The ground, the panel and the accent fill. Twenty-seven components read
      // one of these, which is what stops twenty-seven of them measuring.
      expect(palette.runs).toHaveLength(Object.keys(FLOORS).length)
      for (const [key, floor] of Object.entries(FLOORS)) {
        expect(palette[key].color, key).toMatch(/^#[0-9a-f]{6}$/)
        expect(palette[key].threshold, key).toBe(floor)
      }
    }
  })

  /**
   * The panel carries running text at full strength, and that is a floor rather
   * than a shade.
   *
   * `codeBlock` is why. Its `plain` role is the MAJORITY of a listing — running
   * text at the `body` step, 21 px on an ordinary stack — and it read
   * `panelDisplay`, resolved at 3:1, because the panel had no full-strength run
   * at 4.5. The worst case across this corpus measured 3.19:1, which the audit
   * would report as a finding on the screen the film was cut from.
   *
   * Two claims, and the second is what makes the first free: the run clears 4.5
   * on every ground and every direction, and it is never quieter than
   * `panelBody`, because quieting an ink blends it towards the surface it is
   * measured against.
   */
  it('gives the panel a full-strength run for the text that is not display type', () => {
    for (const ground of Object.keys(GROUNDS)) {
      for (const [label, document] of Object.entries(THEMES)) {
        const palette = composedPalette(resolveTheme(document), GROUNDS[ground])
        const where = `${ground} / ${label}`
        expect(palette.panelText.threshold, where).toBe(CONTRAST_MIN)
        // An opaque panel always has an answer, which is `INK_FLOOR`'s argument
        // one surface over: black and white cross at 4.58:1, so one of the two
        // clears 4.5 whatever `theme.surface` turns out to be.
        expect(palette.panelText.ok, where).toBe(true)
        expect(measure(palette.panelText), where).toBeGreaterThanOrEqual(CONTRAST_MIN)
        // Never the quieter of the two. `panelBody` starts its ladder at
        // `COMPOSED_BODY_QUIET` and walks up; this one starts at full strength.
        expect(measure(palette.panelText), where).toBeGreaterThanOrEqual(measure(palette.panelBody) - 1e-9)
      }
    }
  })

  /**
   * A gradient is a RANGE and it is sampled along its length, not at its ends.
   *
   * Two ends clearing 4.5:1 does prove the ink is outside the band between them —
   * the arithmetic forbids anything else, since two ends 4.5 apart in each
   * direction would need a luminance past 1. At the DISPLAY floor of 3 it proves
   * nothing: a ramp from black to a pale grey clears 3:1 at both ends against an
   * ink whose own luminance sits between them, and somewhere along that ramp the
   * contrast is 1:1. Every headline in this directory takes 3.
   */
  it('samples a gradient ground along its ramp', () => {
    const palette = composedPalette(resolveTheme(THEMES['editorial paper']), GROUNDS.gradient)
    expect(palette.ground.tint).toHaveLength(GRADIENT_RAMP.length)
    // Densest last, so the composition can read the far end of the ramp off the
    // same object the palette measured.
    expect(palette.ground.tint[palette.ground.tint.length - 1].alpha).toBe(1)
  })

  /**
   * The texture yields to a word, and never for nothing.
   *
   * `texturedGround` drops the tint when the bare ground carries every run and the
   * tinted one does not — so a palette that comes back WITH a tint and a failing
   * run is a palette that had no better option, and one that comes back without a
   * tint had a reason. Stated as the invariant rather than as a fixture, because a
   * theme chosen today to make the trade fire is a theme somebody rebalances into
   * uselessness next year.
   */
  it('gives the ground its texture up before it gives a line up', () => {
    for (const ground of ['hairlines', 'gridPulse', 'particles', 'gradient']) {
      for (const document of Object.values(THEMES)) {
        const theme = resolveTheme(document)
        const palette = composedPalette(theme, GROUNDS[ground])
        if (palette.ground.tint) continue
        // No tint means the trade fired. It is only ever legitimate if the bare
        // ground really does carry every run.
        expect(palette.runs.every((run) => measure(run) >= run.threshold), `${ground} on a bare ground`).toBe(true)
      }
    }
  })

  /**
   * A photographic ground is a veil, and a veil is measured over both extremes of
   * what a picture can composite it to. The floor is the one `vertical` already
   * uses; the ceiling is the one that keeps a band from hiding the capture.
   */
  it('dims a photographic ground, between the floor and the ceiling every veil has', () => {
    for (const document of Object.values(THEMES)) {
      const palette = composedPalette(resolveTheme(document), GROUNDS.image)
      expect(palette.ground.alpha).toBeGreaterThanOrEqual(COMPOSED_IMAGE_VEIL)
      expect(palette.ground.alpha).toBeLessThanOrEqual(MAX_VEIL_ALPHA)
      // No tint over a photograph: the two things that make a surface a range are
      // a veil and a tint, and stacking them would measure a texture over a
      // picture nobody has opened.
      expect(palette.ground.tint).toBeUndefined()
    }
  })

  it('leaves an opaque ground opaque, so a flat film is exactly what it was', () => {
    for (const ground of ['solid', 'hairlines', 'gradient', 'gridPulse', 'particles']) {
      expect(composedPalette(resolveTheme(undefined), GROUNDS[ground]).ground.alpha, ground).toBe(1)
    }
  })

  /**
   * A palette depends on the theme and on the ground's KIND, and on nothing else.
   *
   * That is what lets `ComposedSceneVideo` resolve at most six of them for a
   * twelve-scene film instead of one per scene — and it matters because the
   * composition re-renders on every one of the 3600 frames a film can hold, while
   * the search behind a palette really is a search. The claim is checked rather
   * than asserted in a comment: a parameter that started changing what gets
   * MEASURED, rather than only what gets painted, would make that memo wrong in
   * the invisible direction.
   */
  it('depends on the ground’s kind and not on its parameters', () => {
    const theme = resolveTheme(THEMES['editorial paper'])
    const same = (a, b) => expect(composedPalette(theme, a).runs).toEqual(composedPalette(theme, b).runs)
    same({ kind: 'gradient', direction: 'to-bottom' }, { kind: 'gradient', direction: 'radial' })
    same({ kind: 'gridPulse', cells: 4 }, { kind: 'gridPulse', cells: 16 })
    same({ kind: 'particles', density: 1 }, { kind: 'particles', density: 3 })
    same({ kind: 'image', imageId: 'a'.repeat(64) }, { kind: 'image', imageId: 'b'.repeat(64), move: 'pan-left' })
  })

  /*
   * ── A field is a surface, and a real export proved it ──────────────────────
   *
   * `equalizer` said of itself that it "carries no text, so the only thing it can
   * get wrong is spending contrast something else needed — which it cannot".
   * True of a block in a cell and false of one anchored `full`, which is painted
   * UNDER the nine cells on purpose. The film that started this put eighteen
   * accent bars across the middle of the frame and a headline over them whose
   * last word is in the accent by design: the two met at 1:1, on a palette that
   * had measured every run against a ground nothing was standing on.
   */
  describe('a field under a stack', () => {
    /**
     * The three shapes a field comes in, and the second one is why this is a
     * table rather than one fixture.
     *
     * A field used to be a boolean and every field was measured as the accent,
     * which is what five of the six paint. `solidScene` paints a lit solid in a
     * colour of its own, at two brightnesses, and a real export showed what that
     * omission looks like: a flat grey torus under a heading in the same ink,
     * with `field.alpha` walking its whole ladder against a colour nothing on the
     * frame carried. The third case is the one that says the answer is a SET —
     * a wave and a torus under one heading are two surfaces, and both are on the
     * frame.
     */
    const FIELD_CASES = {
      accent: { kinds: ['equalizer'], paints: ['accent'] },
      solid: { kinds: ['solidScene'], paints: ['solid'] },
      both: { kinds: ['equalizer', 'solidScene'], paints: ['accent', 'solid'] },
    }

    /** A scene shaped like the export that failed: a field, and a headline on it. */
    const stacked = (background, kinds = ['equalizer']) => ({
      background,
      layers: [
        ...kinds.map((kind) => ({ kind, anchor: 'full' })),
        { kind: 'heading', text: 'On dessine ce qui bouge', anchor: 'center' },
      ],
    })

    /**
     * The colours a field of each paint really puts on the frame, rebuilt here
     * rather than read off the palette that is being checked.
     *
     * The accent pair is what `equalizer` draws as a run and `barChart` as a
     * fill. The solid pair is the two ends of the Lambert segment: `material` and
     * `material × ambient`, rebuilt with this file's own `scale`. The ambient IS
     * read off the palette, and that is not the palette marking its own homework
     * — it is the number the block is told to light with, so it is an input to
     * what gets painted rather than a claim about contrast, and the claim is
     * re-measured below.
     */
    const fieldInks = (paints, theme, plain) => {
      const colors = []
      for (const paint of paints) {
        const pair =
          paint === 'solid'
            ? [plain.solid.color, scale(plain.solid.color, plain.solid.ambient)]
            : [plain.accent.color, theme.accent]
        for (const color of pair) if (!colors.includes(color)) colors.push(color)
      }
      return colors
    }

    /** The surface a run over that field really lands on, at a given density. */
    const fieldRange = (palette, colors, alpha) =>
      surfaceRange(palette.ground.color, palette.ground.alpha, [
        ...(palette.groundTint ?? []),
        ...colors.flatMap((color) => FIELD_RAMP.map((step) => ({ color, alpha: alpha * step }))),
      ])

    /**
     * The palettes these sweeps share, resolved once each.
     *
     * Not an optimisation for its own sake: a fielded search measures every ink
     * against a ground plus up to sixteen sampled tints at both ends of a veil,
     * and the corpus is three paints × six grounds × a dozen directions asked for
     * by four tests below. Resolved per assertion it is twelve seconds of the
     * suite and, on a loaded machine, a test that fails on the clock rather than
     * on a colour. The claims are unchanged: what is cached is the ANSWER, and
     * every one of them is still re-measured from primitives.
     */
    const CACHE = new Map()
    const paletteOf = (name, ground, paints = []) => {
      const key = `${name}|${ground}|${paints.join('+')}`
      if (!CACHE.has(key)) {
        CACHE.set(key, composedPalette(resolveTheme(THEMES[name]), GROUNDS[ground], { field: paints }))
      }
      return CACHE.get(key)
    }

    it('is only a field when something stands on it', () => {
      expect(stackedField(stacked(GROUNDS.solid))).toBe(true)
      // Alone on the frame it owes nobody contrast: nothing is drawn over it.
      expect(stackedField({ layers: [{ kind: 'equalizer', anchor: 'full' }] })).toBe(false)
      // And a stack with no field sits on the ground the palette always measured.
      expect(stackedField({ layers: [{ kind: 'heading', text: 'x', anchor: 'center' }] })).toBe(false)
      // An anchor this build does not know lands in `center`, like `anchorName`'s
      // own fallback — so it counts as something standing on the field, not as a
      // second field.
      expect(stackedField({ layers: [{ kind: 'equalizer', anchor: 'full' }, { kind: 'heading', anchor: 'nowhere' }] })).toBe(true)
    })

    /**
     * And the palette is told WHICH surface, not merely that there is one.
     *
     * The order is the table's and never the document's, because that answer is
     * also a cache key: two scenes painting the same two surfaces in the other
     * order have to be one search.
     */
    it('names the surfaces a scene paints under its stack', () => {
      for (const [label, { kinds, paints }] of Object.entries(FIELD_CASES)) {
        expect(fieldPaints(stacked(GROUNDS.solid, kinds)), label).toEqual(paints)
      }
      // Reversed in the document, identical out of the walk.
      expect(fieldPaints(stacked(GROUNDS.solid, ['solidScene', 'equalizer']))).toEqual(['accent', 'solid'])
      // Eight waves are one accent: the answer is a set.
      expect(fieldPaints(stacked(GROUNDS.solid, Array.from({ length: 8 }, () => 'soundWave')))).toEqual(['accent'])
      // No stack, no field — whatever it would have painted.
      expect(fieldPaints({ layers: [{ kind: 'solidScene', anchor: 'full' }] })).toEqual([])
      // A kind this build does not know is measured as the accent, which is what
      // every field meant before the table existed. `constructor` is in here
      // because `FIELD_PAINTS` is an object and a lookup on it is a lookup.
      for (const kind of ['carousel', 'constructor', undefined]) {
        expect(fieldPaints(stacked(GROUNDS.solid, [kind])), String(kind)).toEqual(['accent'])
      }
      // And the table names blocks that exist and paints that are measured. A
      // misspelt key is a row that never fires, which reads as a field measured
      // correctly and is a field measured as the accent it does not paint.
      for (const [kind, paint] of Object.entries(FIELD_PAINTS)) {
        expect(BLOCK_APPETITE, kind).toHaveProperty(kind)
        expect(FIELD_PAINT_KINDS, kind).toContain(paint)
      }
    })

    /*
     * One pair of claims per paint, rather than one pair over all three.
     *
     * Same corpus either way; what splits it is the clock. A fielded search is
     * about a second per ground-and-direction sweep, so a single test covering
     * three paints twice over runs past vitest's five, and a suite that fails on
     * the clock fails differently on every machine. Per paint it is also the
     * report a failure wants: the density a SOLID field settled on is not the
     * accent's answer, and a run that says which is a run somebody can read.
     */
    for (const [label, { paints }] of Object.entries(FIELD_CASES)) {
      /**
       * The claim, over every ground and every real direction: with the field
       * painted at the density the palette chose, every run still clears its own
       * floor — measured from primitives rather than taken from the palette's
       * word.
       */
      it(`keeps every run legible over a ${label} field`, () => {
        for (const ground of Object.keys(GROUNDS)) {
          for (const name of Object.keys(THEMES)) {
            const theme = resolveTheme(THEMES[name])
            const palette = paletteOf(name, ground, paints)
            const range = fieldRange(palette, fieldInks(paints, theme, paletteOf(name, ground)), palette.field.alpha)
            // `display` and `body` only: the accent IS the field, and a run
            // measured against a surface made of itself resolves to a near-white
            // that erases the direction. `composedPalette` says so at length.
            for (const run of [palette.display, palette.body]) {
              const ratio = worstRatio(run.color, range)
              // Q1 all the way down: a palette with no answer at any density ships
              // the faintest field rather than failing the export, and says so by
              // marking the run. What must never happen is a run reported OK that
              // a re-measurement contradicts.
              if (!run.ok) continue
              expect(ratio, `${label} · ${name} · ${ground} · ${run.threshold}`).toBeGreaterThanOrEqual(run.threshold)
            }
          }
        }
      })

      /**
       * A decoration cedes to a word, and never for nothing.
       *
       * The ladder starts at 1 and the first entry that clears wins, so the claim
       * worth checking is not "it sometimes stays at 1" — that depends on how
       * saturated a direction's accent happens to be — but that the step it
       * stopped on is the DENSEST one available: painting the same field one rung
       * denser has to break something. A ladder that stepped down for company
       * would be an ornament yielding for nothing, which is the trade
       * `texturedGround` refuses in the same words.
       */
      it(`takes the densest ${label} field every run clears`, () => {
        for (const ground of Object.keys(GROUNDS)) {
          for (const name of Object.keys(THEMES)) {
            const theme = resolveTheme(THEMES[name])
            const palette = paletteOf(name, ground, paints)
            expect(FIELD_ALPHAS, `${label} · ${name} · ${ground}`).toContain(palette.field.alpha)

            const rung = FIELD_ALPHAS.indexOf(palette.field.alpha)
            // A palette that found no answer at any density ships the faintest and
            // says so by leaving a run not-ok (Q1). There is no denser rung to
            // argue about there.
            if (rung <= 0 || ![palette.display, palette.body].every((run) => run.ok)) continue

            const colors = fieldInks(paints, theme, paletteOf(name, ground))
            const range = fieldRange(palette, colors, FIELD_ALPHAS[rung - 1])
            const survives = [palette.display, palette.body].every(
              (run) => worstRatio(run.color, range) >= run.threshold,
            )
            expect(survives, `${label} · ${name} · ${ground} gave up a density it did not have to`).toBe(false)
          }
        }
      })
    }

    /**
     * A field that paints something else is measured as something else.
     *
     * The sweep above proves each palette right about its own field, and it
     * cannot see the defect this pass was written for: a solid field measured as
     * the accent also passes a sweep that asks it about the accent. So this one
     * asks the other question — is a solid field ever a different answer from an
     * accent field — and it has to be yes SOMEWHERE, or the paint is being
     * ignored and every claim above is about a table nothing reads.
     *
     * Somewhere and not everywhere: on a direction whose accent is faint against
     * its ground, both fields clear at full density and the two palettes agree,
     * which is correct rather than a miss.
     */
    it('measures a solid field as the segment it paints, and not as the accent', () => {
      const differs = []
      for (const ground of Object.keys(GROUNDS)) {
        for (const name of Object.keys(THEMES)) {
          const theme = resolveTheme(THEMES[name])
          const asAccent = paletteOf(name, ground, ['accent'])
          const asSolid = paletteOf(name, ground, ['solid'])
          const plain = paletteOf(name, ground)
          // The dim end of the Lambert segment, over a field measured on the
          // accent alone: this is the surface the export had and nobody checked.
          const unmeasured = fieldRange(asAccent, fieldInks(['solid'], theme, plain), asAccent.field.alpha)
          const blind = [asAccent.display, asAccent.body].some(
            (run) => run.ok && worstRatio(run.color, unmeasured) < run.threshold,
          )
          if (blind) {
            // Where measuring the accent alone would have shipped an illegible
            // run, measuring the solid must not.
            const range = fieldRange(asSolid, fieldInks(['solid'], theme, plain), asSolid.field.alpha)
            for (const run of [asSolid.display, asSolid.body]) {
              if (!run.ok) continue
              expect(worstRatio(run.color, range), `${name} · ${ground}`).toBeGreaterThanOrEqual(run.threshold)
            }
          }
          if (asSolid.field.alpha !== asAccent.field.alpha) differs.push(`${name} · ${ground}`)
        }
      }
      expect(differs.length, 'a solid field never resolved differently from an accent one').toBeGreaterThan(0)
    })

    /**
     * An object and the word standing on it cannot be the same colour.
     *
     * That is the founding mistake of this whole section, one composition later:
     * the solid's material was `palette.display.color`, so a torus and the
     * heading over it met at 1:1 wherever they overlapped. It is the ORNAMENT's
     * run now — the accent, which is what every other decoration in this file
     * carries — and that is the structural half of the claim, asserted on every
     * cell of the sweep.
     *
     * The other half is measured, because it cannot be universal: where the
     * ornament itself falls through to the ink, the solid follows it. Two ways
     * that happens and both are policy rather than accident — a direction whose
     * accent nothing can read on its own ground (four of the twelve are written
     * to be exactly that), and a photographic ground, where an ornament's veil is
     * LOCKED and an accent rarely clears over both extremes of an unknown
     * picture. `accentFirst` lands on the ink in both, because being legible
     * outranks being distinct everywhere else in this file too. So the claim is:
     * wherever the ornament kept the project's own colour, the solid is not the
     * heading's ink — and that is a majority of the corpus rather than a corner
     * of it, which is what stops the test from being green for having skipped.
     */
    it('paints a solid in the ornament’s ink and not in the heading’s', () => {
      let kept = 0
      for (const ground of Object.keys(GROUNDS)) {
        for (const name of Object.keys(THEMES)) {
          const theme = resolveTheme(THEMES[name])
          const palette = paletteOf(name, ground)
          const where = `${name} · ${ground}`
          expect(palette.solid.color, where).toBe(palette.accent.color)
          // The ornament fell through: nothing here can separate two colours the
          // search collapsed onto one.
          if (palette.accent.color !== theme.accent) continue
          // And a direction that states its accent as the very ink the heading
          // ended up with has asked for one colour, which is not this bug.
          if (theme.accent === palette.display.color) continue
          kept++
          expect(palette.solid.color, where).not.toBe(palette.display.color)
        }
      }
      expect(kept).toBeGreaterThan((Object.keys(THEMES).length * Object.keys(GROUNDS).length) / 2)
    })

    /**
     * The solid is painted on the GROUND, under the nine cells, so that is what
     * it is measured against — even when it is itself the field.
     *
     * Measured against the fielded surface it would be measured against itself,
     * which is the fixpoint the accent run already refuses two lines above it in
     * `composedPalette`, arriving through the one block whose colour is also a
     * surface.
     */
    it('measures a solid against the bare ground, fielded or not', () => {
      for (const ground of Object.keys(GROUNDS)) {
        for (const name of Object.keys(THEMES)) {
          for (const paints of [['solid'], ['accent', 'solid']]) {
            expect(paletteOf(name, ground, paints).solid, `${name} · ${ground}`).toEqual(paletteOf(name, ground).solid)
          }
        }
      }
    })

    it('leaves a scene with no field exactly as it was', () => {
      for (const ground of Object.keys(GROUNDS)) {
        for (const name of Object.keys(THEMES)) {
          const theme = resolveTheme(THEMES[name])
          const palette = paletteOf(name, ground)
          expect(palette.field.alpha, ground).toBe(1)
          // The ornament keeps the project's colour on every scene, fielded or
          // not — it is measured on the ground either way.
          expect(paletteOf(name, ground, ['accent']).accent).toEqual(palette.accent)
          // The whole point of the memo in `ComposedSceneVideo`: nothing about a
          // film without a stacked field changed, byte for byte. An empty list
          // and the old `false` are the same request.
          for (const field of [false, []]) {
            expect(palette.runs).toEqual(composedPalette(theme, GROUNDS[ground], { field }).runs)
          }
          // And `true` still means what it meant when this was a boolean, so a
          // caller written against the old contract measures a surface rather
          // than none (Q1).
          expect(composedPalette(theme, GROUNDS[ground], { field: true }).runs).toEqual(
            paletteOf(name, ground, ['accent']).runs,
          )
        }
      }
    })

    /**
     * What the composition PAINTS is not what the palette MEASURED, and the
     * difference is exactly the field.
     *
     * `Ground` reads `groundTint`; a `Ground` reading `ground.tint` would paint
     * the field twice — once as a texture behind everything, once as the block it
     * is — and on a gradient it would take the ramp's far end off the accent,
     * since that branch reads the last entry.
     */
    it('keeps the field out of the texture the ground is painted with', () => {
      for (const name of Object.keys(THEMES)) {
        for (const ground of ['hairlines', 'gridPulse', 'particles', 'gradient']) {
          const palette = paletteOf(name, ground, ['accent'])
          // One layer for a texture, `GRADIENT_RAMP.length` for a ramp, and
          // nothing at all when the texture was the thing in the way — never the
          // eight the field adds to the measurement.
          const own = ground === 'gradient' ? GRADIENT_RAMP.length : 1
          expect([0, own], `${ground} paints only its own texture`).toContain((palette.groundTint ?? []).length)
          // A gradient still ends on its own far end, at full density, which is
          // the entry `Ground` reads to draw the ramp.
          if (ground === 'gradient' && palette.groundTint?.length) {
            expect(palette.groundTint[palette.groundTint.length - 1].alpha).toBe(1)
          }
        }
      }
    })
  })

  it('reads a ground it does not know as the field of hairlines, rather than throwing', () => {
    // The kind was refused by `validate.js` long before a frame. Reaching this
    // branch means the two disagree, and a film in the wrong texture beats a
    // render that died half a minute in (Q1).
    for (const bad of [undefined, null, {}, { kind: 'video' }, { kind: 'constructor' }]) {
      expect(backgroundKind(bad), JSON.stringify(bad)).toBe('hairlines')
    }
  })
})

describe('layerCues', () => {
  const stack = (...enters) => enters.map((enter) => (enter === null ? {} : { enter }))

  /**
   * An absent rank is the position the block was written in.
   *
   * A default of zero would make every silent document a pile — everything at
   * once — which is the `kenBurns: 'static'` mistake in another costume: an
   * optional field is a field a model omits, so the case you get by saying
   * nothing has to be the good one.
   */
  it('reads an absent rank as the order the blocks were written in', () => {
    const cues = layerCues(stack(null, null, null), 300)
    expect(cues).toEqual([...cues].sort((a, b) => a - b))
    expect(new Set(cues).size).toBe(3)
  })

  /** Blocks sharing a rank arrive together — a heading and its rule are one arrival. */
  it('lands two blocks of one rank on the same frame', () => {
    const cues = layerCues(stack(0, 0, 1), 300)
    expect(cues[0]).toBe(cues[1])
    expect(cues[2]).toBeGreaterThan(cues[1])
  })

  /**
   * The rank is an ORDER and not a position on a clock.
   *
   * A block at rank 5 after one at rank 2 is the same cascade as 5 after 4 — the
   * gap between two ranks buys nothing, because the beat between two arrivals is
   * `cueFrames`. A model writing 0 and 500 gets exactly what a model writing 0
   * and 1 gets, which is why the field is bounded at the number of blocks a scene
   * can hold rather than at anything resembling a duration.
   */
  it('orders by rank rather than by the numbers themselves', () => {
    expect(layerCues(stack(5, 2), 300)).toEqual(layerCues(stack(1, 0), 300))
    expect(layerCues(stack(2, 5), 300)).toEqual(layerCues(stack(0, 1), 300))
  })

  /**
   * And the beat is `cueFrames`, unchanged: a scene too short for its own cascade
   * compresses it rather than losing its last block, which is what
   * `MIN_CUE_TAIL_FRAMES` has always guaranteed for the other five.
   */
  it('never places a block with less than half a second of scene left after it', () => {
    for (const durationInFrames of [45, 90, 300, 450]) {
      const cues = layerCues(stack(null, null, null, null, null, null, null, null), durationInFrames)
      for (const cue of cues) expect(cue).toBeLessThanOrEqual(Math.max(0, durationInFrames - MIN_CUE_TAIL_FRAMES))
    }
  })

  it('answers for an empty stack rather than throwing inside a browser', () => {
    expect(layerCues([], 300)).toEqual([])
    expect(layerCues(undefined, 300)).toEqual([])
  })
})

describe('anchorCell', () => {
  /**
   * A zone and never a coordinate. Nine cells plus the whole frame, and two blocks
   * in one zone stack inside it — which is what lets `anchor` default to `center`
   * without anything landing on top of anything.
   */
  it('maps every zone the schema names', () => {
    expect(ANCHORS).toHaveLength(10)
    for (const anchor of ANCHORS) {
      const cell = anchorCell(anchor)
      expect(typeof cell.row, anchor).toBe('string')
      expect(typeof cell.column, anchor).toBe('string')
    }
  })

  it('does not take a cell off the prototype chain', () => {
    for (const inherited of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(anchorCell(inherited), inherited).toEqual(anchorCell('center'))
    }
    expect(anchorCell(undefined)).toEqual(anchorCell('center'))
  })
})

// ── Where the blocks land ────────────────────────────────────────────────────
//
// The layout was a CSS grid inside `ComposedSceneVideo.jsx` first, and this whole
// section is the argument for moving it: a `padding: '6%'` is a picture somebody
// has to watch, while a box in pixels is a claim a test can refuse. The two
// claims below are the ones a viewer would have made — nothing is off the frame,
// and nothing is on top of anything.

/** The three frames the catalogue renders, by name, so a failure says which. */
const FRAMES = Object.entries(DIMENSIONS)

/** A scene of blocks at the anchors named, in that order. */
const stackOf = (...anchors) => ({ layers: anchors.map((anchor) => ({ kind: 'heading', text: 'Bloc', anchor })) })

describe('composedSafeArea', () => {
  it('stays inside the frame in every ratio', () => {
    for (const [ratio, { width, height }] of FRAMES) {
      const frame = composedSafeArea(width, height)
      expect(frame.left, ratio).toBeGreaterThan(0)
      expect(frame.top, ratio).toBeGreaterThan(0)
      expect(frame.left + frame.width, ratio).toBeLessThanOrEqual(width)
      expect(frame.top + frame.height, ratio).toBeLessThanOrEqual(height)
    }
  })

  /**
   * The margin is per AXIS, which is the defect the first version shipped: a
   * percentage in a CSS `padding` resolves against the width on all four sides, so
   * a portrait frame got 65 px off its 1920 px edge and a landscape one 115 px off
   * its 1080 px edge — the wrong way round in both, from one number that looked
   * symmetrical.
   */
  it('spends the same share of each axis on a frame nothing is drawn over', () => {
    const { width, height } = DIMENSIONS['16:9']
    const frame = composedSafeArea(width, height)
    expect(frame.left / width).toBeCloseTo(COMPOSED_SAFE_PERCENT / 100, 3)
    expect(frame.top / height).toBeCloseTo(COMPOSED_SAFE_PERCENT / 100, 3)
  })

  /**
   * And a 9:16 export pays the feed's bands instead, because it exists to be
   * posted: the caption and the sound row cover the bottom of the frame, the
   * action rail the right edge, the tabs the top. A `bottom-center` block inside a
   * 6% margin there is not close to an edge — it is behind a button.
   */
  it('keeps a portrait frame clear of the interface a feed draws over it', () => {
    const { width, height } = DIMENSIONS['9:16']
    const frame = composedSafeArea(width, height)
    expect(frame.top).toBeGreaterThanOrEqual((VERTICAL_SAFE_TOP_PERCENT / 100) * height)
    expect(height - (frame.top + frame.height)).toBeGreaterThanOrEqual((VERTICAL_SAFE_BOTTOM_PERCENT / 100) * height)
    expect(width - (frame.left + frame.width)).toBeGreaterThanOrEqual((VERTICAL_SAFE_SIDE_PERCENT / 100) * width)
    expect(frame.left).toBeGreaterThanOrEqual((VERTICAL_SAFE_SIDE_PERCENT / 100) * width)
  })

  /**
   * A square is NOT a feed frame, and saying so is worth a test: 1:1 is posted
   * into a grid rather than under a caption row, and a fifth of its height given
   * away to an interface nobody draws is a fifth of the film.
   */
  it('does not make a square pay the feed’s price', () => {
    const { width, height } = DIMENSIONS['1:1']
    const frame = composedSafeArea(width, height)
    expect(frame.top / height).toBeCloseTo(COMPOSED_SAFE_PERCENT / 100, 3)
    expect(frame.height / height).toBeGreaterThan(1 - (2 * VERTICAL_SAFE_TOP_PERCENT) / 100)
  })

  it('answers a box rather than a NaN when it is handed nothing', () => {
    // Reached only if `useVideoConfig` ever answers late. A zero-sized frame is a
    // black film; a NaN is `left: NaN` in a style attribute and a scene with every
    // block piled at the origin (Q1).
    for (const [w, h] of [[undefined, undefined], [null, 0], ['x', 'y']]) {
      const frame = composedSafeArea(w, h)
      for (const value of Object.values(frame)) expect(Number.isFinite(value)).toBe(true)
    }
  })
})

describe('composedLayout', () => {
  const { width, height } = DIMENSIONS['16:9']

  /**
   * Everything the document asked for is on the frame, exactly once.
   *
   * The failure this refuses is the quiet one: a block that matched no zone would
   * simply not be drawn, and the export would come back a success missing a line
   * somebody wrote. So the indices are compared as a set against the document's
   * own — one missing and one duplicated are the same assertion.
   */
  it('places every block of a scene exactly once', () => {
    const scenes = [
      stackOf('center'),
      stackOf('center', 'center', 'center'),
      stackOf(...ANCHORS),
      { layers: [{ kind: 'heading', text: 'Sans ancre' }, { kind: 'kicker', text: 'Ni rang' }] },
      stackOf('constructor', '__proto__', 'nowhere'),
    ]
    for (const composed of scenes) {
      const placed = composedLayout(composed, width, height).zones.flatMap((zone) => zone.layers.map((l) => l.index))
      expect([...placed].sort((a, b) => a - b)).toEqual(composed.layers.map((_, i) => i))
    }
  })

  /** An anchor no build knows lands in the middle, rather than nowhere. */
  it('reads an anchor it does not know as the centre', () => {
    const zones = composedLayout(stackOf('nowhere'), width, height).zones
    expect(zones).toHaveLength(1)
    expect(zones[0].anchor).toBe('center')
  })

  /**
   * Two blocks in one zone STACK; they do not overlap and they do not refuse the
   * document. The order is the document's, which is the whole of what a repeated
   * anchor means.
   */
  it('stacks the blocks of one zone in the order the document listed them', () => {
    const layout = composedLayout(stackOf('center', 'center', 'center'), width, height)
    expect(layout.zones).toHaveLength(1)
    expect(layout.zones[0].layers.map((l) => l.index)).toEqual([0, 1, 2])
    // Stacked with air between them rather than touching: the gap is what makes
    // three blocks in one zone read as three blocks.
    expect(layout.gap).toBeGreaterThan(0)
  })

  /**
   * Nothing crosses the safe margin — the claim the whole geometry exists to
   * support, over every arrangement of anchors the schema can express.
   */
  it('keeps every zone inside the safe frame, in every ratio', () => {
    for (const [ratio, size] of FRAMES) {
      for (const anchors of [[...ANCHORS], ['top-left', 'bottom-right'], ['center'], ['full', 'center']]) {
        const { frame, zones } = composedLayout(stackOf(...anchors), size.width, size.height)
        for (const { anchor, box } of zones) {
          const where = `${ratio} ${anchor}`
          expect(box.left, where).toBeGreaterThanOrEqual(frame.left)
          expect(box.top, where).toBeGreaterThanOrEqual(frame.top)
          expect(box.left + box.width, where).toBeLessThanOrEqual(frame.left + frame.width)
          expect(box.top + box.height, where).toBeLessThanOrEqual(frame.top + frame.height)
          expect(box.width, where).toBeGreaterThan(0)
          expect(box.height, where).toBeGreaterThan(0)
        }
      }
    }
  })

  /**
   * And no two of the nine overlap. `full` is excluded on purpose: it is the field
   * the other nine are drawn ON, which is why it is first in the list and
   * therefore painted first.
   */
  it('never lets two cells overlap, whichever of the nine are used', () => {
    for (const [ratio, size] of FRAMES) {
      const { zones } = composedLayout(stackOf(...ANCHORS), size.width, size.height)
      const cells = zones.filter((zone) => zone.anchor !== 'full')
      expect(zones[0].anchor, ratio).toBe('full')
      for (const a of cells) {
        for (const b of cells) {
          if (a === b) continue
          const apart =
            a.box.left + a.box.width <= b.box.left ||
            b.box.left + b.box.width <= a.box.left ||
            a.box.top + a.box.height <= b.box.top ||
            b.box.top + b.box.height <= a.box.top
          expect(apart, `${ratio}: ${a.anchor} over ${b.anchor}`).toBe(true)
        }
      }
    }
  })

  /**
   * A row belongs to the columns that are USED, and the default document is why.
   *
   * `anchor` defaults to `center`, so a scene that names none puts everything in
   * one cell — and a fixed third of a 16:9 frame is 563 px, which is five
   * characters of display type on a line. The commonest scene there is would have
   * been the one this layout could not render.
   */
  it('gives a lone column the whole measure, and shares it when there is a neighbour', () => {
    const alone = composedLayout(stackOf('center'), width, height).zones[0]
    const paired = composedLayout(stackOf('center-left', 'center-right'), width, height).zones
    const thirds = composedLayout(stackOf('center-left', 'center', 'center-right'), width, height).zones
    const frame = composedSafeArea(width, height)
    expect(alone.box.width).toBe(frame.width)
    for (const zone of paired) expect(zone.box.width).toBeLessThan(frame.width / 2 + 1)
    for (const zone of thirds) expect(zone.box.width).toBeLessThan(frame.width / 3 + 1)
    // A neighbour in ANOTHER row costs nothing: the split is per band.
    expect(composedLayout(stackOf('center', 'top-left'), width, height).zones.find((z) => z.anchor === 'center').box.width)
      .toBe(frame.width)
  })

  /** The three bands are the same in every scene: a row's anchored edge is the safe edge. */
  it('anchors the top band to the safe top and the bottom band to the safe bottom', () => {
    const frame = composedSafeArea(width, height)
    const { zones } = composedLayout(stackOf('top-center', 'bottom-center'), width, height)
    const top = zones.find((zone) => zone.anchor === 'top-center')
    const bottom = zones.find((zone) => zone.anchor === 'bottom-center')
    expect(top.box.top).toBe(frame.top)
    expect(bottom.box.top + bottom.box.height).toBe(frame.top + frame.height)
    // Which is what makes an overflowing stack safe: it grows towards the middle.
    expect(top.justify).toBe('flex-start')
    expect(bottom.justify).toBe('flex-end')
  })

  /**
   * `full` is the safe area and not the frame. A field that bled to the edge would
   * be a map cropped by overscan and a gallery whose bottom row sits under a
   * phone's caption box — the two failures the safe area exists to prevent,
   * arriving through the one anchor that opts out of it.
   */
  it('gives a field the safe area, and makes two fields share it', () => {
    const frame = composedSafeArea(width, height)
    const one = composedLayout(stackOf('full'), width, height).zones[0]
    expect(one.box).toEqual(frame)
    expect(one.share).toBe(true)
    // `stretch` is a legal `align-items` and not a legal `justify-content`: the
    // sharing zone is reported as a flag plus a valid pair, never as a value the
    // composition would have to translate. `center` and not `flex-start`, because
    // a `full` zone has no edge of its own to anchor to — see `composedLayout`,
    // and the counter that shipped in the upper two thirds of a frame.
    expect(one.justify).toBe('center')
    expect(one.align).toBe('stretch')
    expect(composedLayout(stackOf('full', 'full'), width, height).zones[0].layers).toHaveLength(2)
  })

  /**
   * A field claims every band, so what stands on it gets a band and not the frame.
   *
   * `full` occupies no row and no column of the grid — it is painted UNDER the
   * nine cells — and the collapse that gives a lone block the whole safe area read
   * that as "the frame is empty". A real export showed what it costs: one
   * `equalizer` and one `kicker`, and the kicker was handed the entire safe area
   * and came out as 200 px of capitals over the graph it was the surtitle of.
   *
   * The measure is not touched, and the asymmetry is the point: a height sets the
   * type SIZE and a width sets the measure, so a line over a field still runs the
   * full width of it.
   */
  it('gives a cell beside a field a band of the grid, and a lone field the frame', () => {
    const frame = composedSafeArea(width, height)
    // Without a field: the lone band is the whole height, exactly as before.
    expect(composedLayout(stackOf('center'), width, height).zones[0].box.height).toBe(frame.height)

    const withField = composedLayout(stackOf('full', 'center'), width, height).zones
    const field = withField.find((zone) => zone.anchor === 'full')
    const cell = withField.find((zone) => zone.anchor === 'center')
    expect(field.box).toEqual(frame)
    expect(cell.box.height).toBeLessThan(frame.height / 2)
    expect(cell.box.width).toBe(frame.width)
    // The bands are the grid's own three, so a top-anchored block is still at the
    // safe top rather than a third of the way down it.
    const top = composedLayout(stackOf('full', 'top-center'), width, height).zones.find((z) => z.anchor === 'top-center')
    expect(top.box.top).toBe(frame.top)
    expect(top.box.height).toBeLessThan(frame.height / 2)
    // And the case the fix must not break: a field on its own is still the frame.
    expect(composedLayout(stackOf('full'), width, height).zones[0].box).toEqual(frame)
  })

  /** The gutter and the stack gap are two numbers, and the tighter one is inside a zone. */
  it('separates two zones by more than it separates two blocks of one zone', () => {
    const { gap, gutter } = composedLayout(stackOf('center'), width, height)
    expect(gutter).toBeGreaterThan(gap)
    expect(gap).toBe(Math.round(frameBase(width, height) * COMPOSED_STACK_GAP))
    expect(gutter).toBe(Math.round(frameBase(width, height) * COMPOSED_CELL_GAP))
  })

  /**
   * The three bands belong to the rows that are USED, for the reason the columns
   * already did — it is the same defect one axis over. A fixed third of the safe
   * height is 295 px of a 16:9 frame, and `anchor` defaults to `center`, so the
   * commonest scene there is was a stack sized for a third of a picture with the
   * other two thirds empty.
   */
  it('gives a lone band the whole height, and shares it when there is a neighbour', () => {
    const frame = composedSafeArea(width, height)
    expect(composedLayout(stackOf('center'), width, height).zones[0].box.height).toBe(frame.height)
    const pair = composedLayout(stackOf('top-center', 'bottom-center'), width, height).zones
    for (const zone of pair) expect(zone.box.height).toBeLessThan(frame.height / 2 + 1)
    const three = composedLayout(stackOf('top-left', 'center', 'bottom-right'), width, height).zones
    for (const zone of three) expect(zone.box.height).toBeLessThan(frame.height / 3 + 1)
    // A neighbour in another COLUMN costs a band nothing: the split is per axis.
    expect(composedLayout(stackOf('center-left', 'center-right'), width, height).zones[0].box.height).toBe(frame.height)
  })

  /**
   * And the bands are divided by APPETITE, exactly as a zone is.
   *
   * The grid went on dividing by count long after `stackIn` stopped, and it is
   * the same defect one level up: a surtitle and a headline are not equally
   * hungry, so three equal bands leave three quarters of the top one empty and
   * solve the film's own headline against a third of a frame that had two thirds
   * to spare. What that costs is not only air — a stack fills the box it is
   * given, so an over-large band is an over-large type unit, and the export that
   * showed it had a `logoType` in the bottom band at three times the `heading` in
   * the middle one.
   *
   * The consequence worth pinning is the one that makes the rest of this file
   * simpler: weighted bands make the zones read the SAME unit by construction,
   * because every one of them ends up with `safeHeight / what the scene asked
   * for`. `harmoniseUnits` then tidies rather than rescues.
   */
  it('divides the bands by appetite, so a surtitle and a headline read one scale', () => {
    const layers = [
      { kind: 'kicker', text: 'Dense', anchor: 'top-left' },
      { kind: 'heading', level: 'title', text: 'Huit blocs dans un cadre', anchor: 'center' },
      { kind: 'logoType', text: 'MOCKY', mark: 'slash', anchor: 'bottom-left' },
    ]
    for (const [ratio, size] of FRAMES) {
      const { zones } = composedLayout({ layers }, size.width, size.height)
      const band = (anchor) => zones.find((zone) => zone.anchor === anchor).box.height
      // The row that carries a title and its rule asks for more than the row that
      // carries five tracked capitals, and gets it.
      expect(band('center'), ratio).toBeGreaterThan(band('top-left'))
      expect(band('center'), ratio).toBeGreaterThan(band('bottom-left'))
      // And every zone ends up reading ONE unit, which is what weighted bands buy:
      // each of them gets `safeHeight × (its share of what the scene asked for)`,
      // so they all solve to `safeHeight / (what the scene asked for)`.
      // `harmoniseUnits` tidies the remainder rather than rescuing the frame.
      const units = zones.map((zone) => zone.unit)
      expect(Math.max(...units) / Math.min(...units), ratio).toBeLessThan(1.05)
    }
  })

  /**
   * A field is the scene, so the words laid on it read at the field's own scale.
   *
   * A block anchored `full` belongs to no band, which is why the bands stay the
   * grid's own three when one is on the frame — and that leaves a cell zone
   * solving its unit against a third of the safe area with nothing in the scene
   * to be compared with. The export: one `equalizer`, one `kicker`, and a
   * surtitle at 122 px of capitals standing on the graph it was the surtitle of.
   * The band alone does not close it; the field's unit does.
   */
  it('never lets a cell read a larger unit than the field it stands on', () => {
    const layers = [
      { kind: 'equalizer', bars: 24, tempo: 'fast', anchor: 'full' },
      { kind: 'kicker', text: 'Signal', anchor: 'top-center' },
    ]
    for (const [ratio, size] of FRAMES) {
      const { zones } = composedLayout({ layers }, size.width, size.height)
      const field = zones.find((zone) => zone.anchor === 'full')
      const cell = zones.find((zone) => zone.anchor === 'top-center')
      expect(cell.unit, ratio).toBeLessThanOrEqual(field.unit + 1e-6)
      // A surtitle that is a twentieth of the height it stands in rather than an
      // eighth of it. Against the SAFE AREA and not the frame's short edge: the
      // band a cell gets is a third of that area, and it is what the old answer
      // was eight per cent of.
      expect(cell.unit * TYPE_ROLES.caption.step, ratio).toBeLessThan(
        composedSafeArea(size.width, size.height).height * 0.06,
      )
    }
  })

  /**
   * Every block gets its OWN box, and the boxes tile the zone in the document's
   * order without overlapping or leaving it.
   *
   * This is the defect the whole pass is about, at its root: the zone's box was
   * handed to every block in it. Eight `solidScene` blocks anchored `full` were
   * eight canvases of 589 px — 4712 px of content inside 950 px of safe height,
   * in a picture 1080 px tall.
   */
  it('gives every block its own box, tiling its zone in order', () => {
    for (const [ratio, size] of FRAMES) {
      for (const kinds of [['heading'], ['kicker', 'heading', 'separator'], KINDS.slice(0, 8)]) {
        const layers = kinds.map((kind) => ({ ...LONGEST[kind], anchor: 'center' }))
        const { zones, gap } = composedLayout({ layers }, size.width, size.height)
        const [zone] = zones
        expect(zone.layers.map((l) => l.index), ratio).toEqual(kinds.map((_k, i) => i))
        let previous = zone.box.top
        for (const layer of zone.layers) {
          const where = `${ratio} ${layer.block.kind}`
          expect(layer.box.top, where).toBeGreaterThanOrEqual(previous - 1)
          expect(layer.box.left, where).toBe(zone.box.left)
          expect(layer.box.width, where).toBe(zone.box.width)
          expect(layer.box.top + layer.box.height, where).toBeLessThanOrEqual(zone.box.top + zone.box.height + 1)
          previous = layer.box.top + layer.box.height + gap
        }
      }
    }
  })

  /** Eight fields anchored `full` are eight boxes, not the safe area eight times. */
  it('divides `full` among the fields that share it', () => {
    const layers = Array.from({ length: 8 }, () => ({ ...POOREST.solidScene, anchor: 'full' }))
    const { zones, gap } = composedLayout({ layers }, width, height)
    const [zone] = zones
    expect(zone.layers).toHaveLength(8)
    const total = zone.layers.reduce((sum, l) => sum + l.box.height, 0) + 7 * gap
    expect(total).toBeLessThanOrEqual(zone.box.height + 1)
    for (const layer of zone.layers) expect(layer.box.height).toBeLessThan(zone.box.height / 7)
  })

  /**
   * A stack is divided by APPETITE and never by count: a title wants height and a
   * rule wants almost none. Split evenly, a separator above a heading takes half
   * the column for three pixels of ink.
   */
  it('divides a zone by what its blocks are made of, not by how many there are', () => {
    const layers = [
      { ...POOREST.separator, anchor: 'center' },
      { ...LONGEST.heading, anchor: 'center' },
      { ...POOREST.kicker, anchor: 'center' },
    ]
    const [zone] = composedLayout({ layers }, width, height).zones
    const [rule, title, kicker] = zone.layers.map((l) => l.box.height)
    expect(title).toBeGreaterThan(rule * 3)
    expect(title).toBeGreaterThan(kicker * 2)
  })

  /**
   * The box a block is given is the box it draws — the two halves of the
   * arithmetic agreeing.
   *
   * They are computed by different code from different directions: `stackIn`
   * solves a unit for the whole stack and lays out the heights it implies, while
   * `blockExtent` is handed one box and answers what fits in it. A weight table
   * that drifted from the type scale would show up here as a block whose box is
   * not what it draws, which is a block floating in its own allotment.
   *
   * `solidScene` is out of it and the reason is geometric rather than a licence:
   * it is a SQUARE with a share the document asked for, so it cannot fill the
   * height of a landscape box at all — its own claim is on the minor axis, and
   * `blockExtent` is where that is checked.
   */
  it('hands a block a box that is exactly what it draws in it', () => {
    for (const [ratio, size] of FRAMES) {
      const base = frameBase(size.width, size.height)
      for (let count = 1; count <= 8; count += 1) {
        for (let seed = 0; seed < KINDS.length; seed += 1) {
          const layers = Array.from({ length: count }, (_, i) => ({
            ...LONGEST[KINDS[(seed + i * 5) % KINDS.length]],
            anchor: 'center',
          }))
          for (const zone of composedLayout({ layers }, size.width, size.height).zones) {
            for (const layer of zone.layers) {
              if (layer.block.kind === 'solidScene') continue
              const drawn = blockExtent(layer.block, layer.box, base, layer.unit)
              expect(drawn.height, `${ratio} ${layer.block.kind} in a stack of ${count}`).toBeCloseTo(layer.box.height, -0.5)
            }
          }
        }
      }
    }
  })

  /**
   * And the stack is as large as its zone allows, which is the claim that makes
   * "fills its box" mean something at the level of a scene: two per cent more type
   * would not fit.
   *
   * A staircase is why this is an assertion about the UNIT rather than about the
   * leftover: a line count is an integer, so a stack can be a line short of its
   * zone with no size between the two that fits. What can be proved is that the
   * unit is the largest one that does — which is the same sentence a designer
   * means by "as big as it goes".
   */
  it('sets a stack as large as its zone allows', () => {
    for (const [ratio, size] of FRAMES) {
      for (let count = 1; count <= 8; count += 1) {
        for (let seed = 0; seed < KINDS.length; seed += 1) {
          const layers = Array.from({ length: count }, (_, i) => ({
            ...LONGEST[KINDS[(seed + i * 3) % KINDS.length]],
            anchor: 'center',
          }))
          const { zones, gap } = composedLayout({ layers }, size.width, size.height)
          for (const zone of zones) {
            const room = zone.box.height - (zone.layers.length - 1) * gap
            const at = (unit) => zone.layers.reduce((sum, l) => sum + blockHeight(l.block, zone.box.width, unit), 0)
            const taller = at(zone.unit * 1.02)
            // Or the stack cannot spend more at all: a run that cannot break is
            // bounded by the measure rather than by the box, and 24 characters
            // across 1688 px is 127 px of type with no taller version of it.
            // `shapeCeiling` is where that is worked out; here it shows up as a
            // stack whose height does not answer a larger unit.
            expect(taller > room || taller === at(zone.unit), `${ratio} ${count} blocks, seed ${seed}`).toBe(true)
          }
        }
      }
    }
  })

  /**
   * One unit per zone, which is the other half of the fix: a `counter` and a
   * `heading` stacked together used to come out at 0.13 and 0.042 of the short
   * edge — the figure crushing the title by a factor of three, in a frame nobody
   * had asked for that emphasis in. Two steps of one scale is 2.8 against 1.55,
   * and it is the same ratio in every zone of every film.
   */
  it('reads one type unit per zone, so two blocks are two steps of one scale', () => {
    const layers = [
      { ...POOREST.heading, anchor: 'center' },
      { kind: 'counter', to: 250, from: 0, prefix: null, suffix: null, label: null, anchor: 'center' },
    ]
    const [zone] = composedLayout({ layers }, width, height).zones
    expect(zone.layers.every((l) => l.unit === zone.unit)).toBe(true)
    const ratio = typeSize('figure', zone.unit) / typeSize('title', zone.unit)
    expect(ratio).toBeCloseTo(TYPE_ROLES.figure.step / TYPE_ROLES.title.step, 1)
    expect(ratio).toBeLessThan(2)
  })

  it('answers for a scene with no layers rather than throwing inside a browser', () => {
    for (const empty of [undefined, null, {}, { layers: [] }, { layers: 'no' }]) {
      expect(composedLayout(empty, width, height).zones).toEqual([])
    }
  })
})

// ── The type scale, and the rule that a block inhabits its box ───────────────
//
// Three claims, and they are the three the six real exports failed:
//
//   1. a block draws on its BOX and not on the frame — so doubling the box has to
//      double the drawing, and the three constant metrics are the only exception;
//   2. what it draws FILLS that box, which is what a `typewriter` alone in the
//      middle of a black frame did not;
//   3. two blocks in one zone read ONE scale, which is what a counter three times
//      its neighbouring heading did not.
//
// The corpus is both ends of what the schema allows rather than a handful of
// plausible blocks: the poorest legal one and the longest legal one. A layout is
// wrong at its extremes long before it is wrong in the middle, and the extremes
// are what a model writes when a brief is short or a heading is a sentence.

/** The poorest legal block of every kind: nothing optional, everything at its floor. */
const POOREST = {
  heading: { kind: 'heading', text: 'Ok', level: 'title' },
  kicker: { kind: 'kicker', text: 'A' },
  quote: { kind: 'quote', text: 'Non.', attribution: null },
  textHighlight: { kind: 'textHighlight', text: 'Un', mark: null },
  funTitle: { kind: 'funTitle', text: 'Go' },
  typewriter: { kind: 'typewriter', text: 'Un' },
  animatedList: { kind: 'animatedList', items: ['Un'] },
  counter: { kind: 'counter', to: 9, from: 0, prefix: null, suffix: null, label: null },
  logoType: { kind: 'logoType', text: 'M' },
  button: { kind: 'button', label: 'Go' },
  form: { kind: 'form', title: null, fields: ['Nom'], submit: null },
  notification: { kind: 'notification', title: 'Ok', body: null },
  lowerThird: { kind: 'lowerThird', title: 'Ana', subtitle: null },
  barChart: { kind: 'barChart', values: [1, 2], labels: null },
  lineChart: { kind: 'lineChart', values: [1, 2], label: null },
  equalizer: { kind: 'equalizer', bars: 4 },
  soundWave: { kind: 'soundWave', samples: 24 },
  map: { kind: 'map', markers: 0 },
  imageFrame: { kind: 'imageFrame', imageId: 'a'.repeat(64), caption: null },
  gallery: { kind: 'gallery', imageIds: ['a'.repeat(64), 'b'.repeat(64)] },
  carousel: { kind: 'carousel', imageIds: ['a'.repeat(64), 'b'.repeat(64)] },
  clock: { kind: 'clock', label: null },
  dateStamp: { kind: 'dateStamp', text: '2026' },
  separator: { kind: 'separator', extent: 'measure' },
  progressBar: { kind: 'progressBar', to: 0, label: null },
  codeBlock: { kind: 'codeBlock', lines: [{ text: 'a' }, { text: 'b' }], caption: null },
  solidScene: { kind: 'solidScene', size: 'medium' },
}

/** Words rather than a repeated letter: the wrap estimate breaks between words. */
const filler = (n) => 'Mot '.repeat(Math.ceil(n / 4)).slice(0, n).trim()

/** The longest legal block of every kind, at the schema's own bounds. */
const LONGEST = {
  heading: { kind: 'heading', text: filler(70), level: 'display' },
  kicker: { kind: 'kicker', text: filler(40) },
  quote: { kind: 'quote', text: filler(180), attribution: filler(40) },
  textHighlight: { kind: 'textHighlight', text: filler(90), mark: filler(40) },
  funTitle: { kind: 'funTitle', text: filler(40) },
  typewriter: { kind: 'typewriter', text: filler(120) },
  animatedList: { kind: 'animatedList', items: Array.from({ length: 6 }, () => filler(60)) },
  counter: { kind: 'counter', to: 1000000, prefix: filler(8), suffix: filler(8), label: filler(40) },
  logoType: { kind: 'logoType', text: filler(24) },
  button: { kind: 'button', label: filler(30) },
  form: { kind: 'form', title: filler(40), fields: Array.from({ length: 4 }, () => filler(30)), submit: filler(24) },
  notification: { kind: 'notification', title: filler(40), body: filler(90) },
  lowerThird: { kind: 'lowerThird', title: filler(50), subtitle: filler(70) },
  barChart: { kind: 'barChart', values: Array(8).fill(50), labels: Array(8).fill(filler(12)) },
  lineChart: { kind: 'lineChart', values: Array(12).fill(50), label: filler(24) },
  equalizer: { kind: 'equalizer', bars: 24 },
  soundWave: { kind: 'soundWave', samples: 96 },
  map: { kind: 'map', markers: 8 },
  imageFrame: { kind: 'imageFrame', imageId: 'a'.repeat(64), caption: filler(70) },
  gallery: { kind: 'gallery', imageIds: Array(6).fill('a'.repeat(64)) },
  carousel: { kind: 'carousel', imageIds: Array(8).fill('a'.repeat(64)) },
  clock: { kind: 'clock', label: filler(24) },
  dateStamp: { kind: 'dateStamp', text: filler(30) },
  separator: { kind: 'separator', extent: 'short' },
  progressBar: { kind: 'progressBar', to: 100, label: filler(24) },
  codeBlock: { kind: 'codeBlock', lines: Array.from({ length: 10 }, () => ({ text: filler(64) })), caption: filler(30) },
  solidScene: { kind: 'solidScene', size: 'small' },
}

const KINDS = Object.keys(BLOCK_APPETITE)

/** Boxes of every shape a zone can turn out to be, in all three ratios. */
const SHAPES = []
for (const [ratio, { width, height }] of FRAMES) {
  const safe = composedSafeArea(width, height)
  const base = frameBase(width, height)
  SHAPES.push([`${ratio} whole`, safe, base])
  SHAPES.push([`${ratio} band`, { ...safe, height: Math.round(safe.height / 2) }, base])
  SHAPES.push([`${ratio} cell`, { ...safe, width: Math.round(safe.width / 3), height: Math.round(safe.height / 3) }, base])
  SHAPES.push([`${ratio} strip`, { ...safe, width: Math.round(safe.width / 3), height: Math.round(safe.height / 8) }, base])
}

/** The share a document itself asked for, which is divided out before a fill is judged. */
const asked = (block) =>
  block.kind === 'separator'
    ? DECLARED_SHARE.separator[block.extent]
    : block.kind === 'solidScene'
      ? DECLARED_SHARE.solidScene[block.size]
      : 1

describe('the type scale', () => {
  /**
   * One scale, five steps, in the order the roles mean something in.
   *
   * The defect this refuses is the one that shipped: `headingSize`, the counter's
   * figure, the typewriter's line and the wordmark were four fractions of the
   * frame decided by four authors, and a counter beside a heading came out three
   * times its size. Two blocks in one zone now read one unit, so the ratio between
   * them is a ratio between two steps of this table and nothing else.
   */
  it('orders its five roles and derives every size from one unit', () => {
    const unit = 40
    const sizes = Object.fromEntries(Object.keys(TYPE_ROLES).map((role) => [role, typeSize(role, unit)]))
    expect(sizes.caption).toBeLessThan(sizes.body)
    expect(sizes.body).toBeLessThan(sizes.title)
    expect(sizes.title).toBeLessThan(sizes.display)
    expect(sizes.display).toBeLessThan(sizes.figure)
    // A number is the scene when it is there, and it is still ONE step above a
    // headline rather than three: `FIGURE_SIZE`'s 0.13 was the top of a ramp.
    expect(sizes.figure / sizes.display).toBeLessThan(1.4)
    // The body step is 1 by definition, which is what makes the table readable.
    expect(sizes.body).toBe(unit)
  })

  /**
   * `MEAN_GLYPH_EM` is not a new number: it is the one `verticalCaptionSize` was
   * calibrated on by hand, and this is the test that stops the two drifting now
   * that it is written down.
   *
   * The long end is what pins it. The ramp's own comment says a full-length
   * caption holds "in four lines inside the safe area" at 0.058 of the short edge
   * — 110 characters over four lines of 907 px at 63 px is an average advance of
   * 0.524 em. The short end is the looser claim ("roughly two lines") and it is
   * checked as an inequality for that reason.
   */
  it('is the constant `verticalCaptionSize` was calibrated on', () => {
    const { width, height } = DIMENSIONS['9:16']
    const base = frameBase(width, height)
    const measure = width * (1 - (2 * VERTICAL_SAFE_SIDE_PERCENT) / 100)
    const short = 'x'.repeat(VERTICAL_CAPTION_SHORT_CHARS)
    const long = 'x'.repeat(VERTICAL_CAPTION_LONG_CHARS)
    expect(textLines(short, verticalCaptionSize(short, base), measure)).toBeLessThanOrEqual(2)
    const implied = measure / ((VERTICAL_CAPTION_LONG_CHARS / 4) * verticalCaptionSize(long, base))
    expect(implied).toBeGreaterThan(MEAN_GLYPH_EM * 0.95)
    expect(implied).toBeLessThan(MEAN_GLYPH_EM * 1.1)
  })

  /**
   * The sentence average is not the average of a COUNTER, and a run that cannot
   * break has no line to give back when the difference bites.
   *
   * Liberation Sans Bold sets `91%` in 2.00 em — digits at 0.556 twice and a per
   * cent sign at 0.889 — against the 1.56 em that 0.52 predicts. That gap is 172
   * px on a 828 px column, and what a frame showed was the per cent sign sliced
   * off by the edge of the video, because `shapeCeiling` had licensed a size the
   * measure could not hold.
   */
  it('measures an unbreakable run on its own glyphs, and never narrower than the average', () => {
    // Digits and a per cent sign are wider than a sentence; the estimate follows.
    expect(meanAdvanceEm('91%')).toBeGreaterThan(MEAN_GLYPH_EM)
    expect(meanAdvanceEm('MOCKY')).toBeGreaterThan(meanAdvanceEm('mocky'))
    // …and it still covers the real face, which is the whole point. Measured
    // WITH `LINE_SAFETY`, because that is the product `cappedByWidth` divides by
    // and the six per cent is what a class average is allowed to lean on: `MOCKY`
    // is five of the widest capitals there are and lands at 0.756 against a class
    // written for 0.71.
    const real = { '9': 0.556, '1': 0.556, '%': 0.889, M: 0.889, O: 0.778, C: 0.722, K: 0.722, Y: 0.667 }
    for (const word of ['91%', 'MOCKY']) {
      const drawn = [...word].reduce((sum, glyph) => sum + real[glyph], 0) / word.length
      expect(meanAdvanceEm(word) * LINE_SAFETY).toBeGreaterThanOrEqual(drawn)
    }
    // A floor, never a discount: an empty or unclassifiable run keeps the average.
    expect(meanAdvanceEm('')).toBe(MEAN_GLYPH_EM)
    expect(meanAdvanceEm(null)).toBe(MEAN_GLYPH_EM)
    expect(meanAdvanceEm('...')).toBeGreaterThanOrEqual(MEAN_GLYPH_EM)
  })

  /** Four runs, four advances — and only the two middle ones are new. */
  it('reads a monospace run at the mono advance and a breakable one at the average', () => {
    expect(runAdvanceEm({ mono: true, nowrap: true, text: '91%' })).toBe(MEAN_MONO_EM)
    expect(runAdvanceEm({ text: '91%' })).toBe(MEAN_GLYPH_EM)
    expect(runAdvanceEm({ nowrap: true, text: '91%' })).toBe(meanAdvanceEm('91%'))
    // The case the composition chose, not the one the document typed.
    expect(runAdvanceEm({ caps: true, text: 'trafic' })).toBe(meanAdvanceEm('TRAFIC'))
    expect(runAdvanceEm({ caps: true, text: 'trafic' })).toBeGreaterThan(runAdvanceEm({ text: 'trafic' }))
  })

  /**
   * A `kicker` is the block where the two ways of being wrong meet: capitals it
   * did not ask for, plus a fifth of an em of tracking it did. Six letters came
   * back on two lines with a lone `C` under the bottom of the box.
   */
  it('fits a kicker on the line the layout reserved for it', () => {
    const box = { left: 116, top: 65, width: 1688, height: 950 }
    const block = { kind: 'kicker', text: 'Trafic' }
    const shape = blockShape(block)
    const unit = solveTypeUnit([shape], box.width, box.height)
    const size = typeSize('caption', Math.min(unit, shapeCeiling(shape, box.width)))
    // Liberation Sans Bold sets TRAFIC at 0.611 em a glyph; the tracking is real
    // width too, and both together still have to hold one line.
    expect(size * (0.611 + KICKER_TRACKING_EM) * 6).toBeLessThanOrEqual(box.width)
    expect(blockHeight(block, box.width, unit)).toBeLessThanOrEqual(box.height)
  })

  /**
   * The defect, end to end: a counter drawn in the box `composedLayout` gave it
   * has to FIT that box. `blockExtent` is the arithmetic a test can ask, and the
   * real width of the face is what it is checked against.
   */
  it('keeps a nowrap figure inside its own measure', () => {
    const box = { left: 0, top: 0, width: 828, height: 950 }
    const block = { kind: 'counter', to: 91, suffix: '%', label: 'de couverture' }
    const unit = solveTypeUnit([blockShape(block)], box.width, box.height)
    const size = typeSize('figure', Math.min(unit, shapeCeiling(blockShape(block), box.width)))
    // 2.00 em is what Liberation Sans Bold actually sets `91%` in.
    expect(size * 2.0).toBeLessThanOrEqual(box.width)
    expect(blockExtent(block, box, 1080, unit).width).toBeLessThanOrEqual(box.width)
  })

  /** The estimate errs WIDE, never narrow: a line more than predicted is a block through its own edge. */
  it('counts lines conservatively, and none at all for an absent run', () => {
    expect(textLines('', 40, 500)).toBe(0)
    expect(textLines(null, 40, 500)).toBe(0)
    expect(textLines('x'.repeat(40), 40, 500)).toBeGreaterThan(textLines('x'.repeat(10), 40, 500))
    expect(textLines('x'.repeat(40), 40, 250)).toBeGreaterThan(textLines('x'.repeat(40), 40, 500))
    // Twenty characters at 40 px is 416 px of advance in a 500 px measure, which
    // one line holds and a narrower estimate would have put on two.
    expect(textLines('x'.repeat(20), 40, 500)).toBe(1)
  })

  /**
   * The lesson `verticalCaptionSize` taught, generalised: a size tuned on the
   * longest legal line renders every short one at the size a long one needed. Here
   * the length is not a ramp any more — it is the box doing the arithmetic.
   */
  it('sets a short line larger than a long one in the same box', () => {
    const box = { left: 0, top: 0, width: 900, height: 300 }
    expect(typeScale('title', 'Trois mots ici', box)).toBeGreaterThan(typeScale('title', filler(140), box))
  })

  /** And a bigger box is a bigger line: the whole point of solving against a box. */
  it('sets the same line larger in a bigger box', () => {
    const text = 'Une ligne de titre'
    const small = typeScale('title', text, { width: 450, height: 150 })
    const large = typeScale('title', text, { width: 900, height: 300 })
    expect(large / small).toBeGreaterThan(1.9)
    expect(large / small).toBeLessThan(2.1)
  })
})

describe('blockExtent — a block inhabits the box it is given', () => {
  /**
   * Nothing a block draws crosses the box it was handed, at either end of what
   * the schema allows, in every shape a zone can turn out to be.
   *
   * The box's own edge is the safe margin `composedSafeArea` promises nothing
   * crosses, and in a 9:16 export that margin is a promise about a feed
   * application's interface rather than a taste in margins.
   */
  it.each([['poorest', POOREST], ['longest', LONGEST]])('keeps the %s block of every kind inside its box', (_label, corpus) => {
    for (const kind of KINDS) {
      for (const [where, box, base] of SHAPES) {
        const drawn = blockExtent(corpus[kind], box, base)
        expect(drawn.width, `${kind} @ ${where}`).toBeLessThanOrEqual(box.width + 1)
        expect(drawn.height, `${kind} @ ${where}`).toBeLessThanOrEqual(box.height + 1)
      }
    }
  })

  /**
   * And it fills it. This is the defect, stated as arithmetic: `equalizer` drew
   * `base * 0.18` whether it had been anchored `center` or `full`, so a field
   * occupied 18% of the height of a frame it had been given all of — and every
   * scene was a small element floating in a large void.
   *
   * The axis is the one the kind's own row claims, because they are not the same
   * for all twenty-seven: a field owes both, a rule owes its measure, a square owes
   * its minor side, and a run of type owes whichever its own words reach — two
   * letters cannot fill a landscape measure without being taller than the box.
   */
  it.each([['poorest', POOREST], ['longest', LONGEST]])('fills its box with the %s block of every kind', (_label, corpus) => {
    for (const kind of KINDS) {
      for (const [where, box, base] of SHAPES) {
        const block = corpus[kind]
        const drawn = blockExtent(block, box, base)
        const across = drawn.width / box.width
        const down = drawn.height / box.height
        const fills = BLOCK_APPETITE[kind].fills
        const filled =
          fills === 'both'
            ? Math.min(across, down)
            : fills === 'width'
              ? across
              : fills === 'minor'
                ? Math.min(drawn.width, drawn.height) / Math.min(box.width, box.height)
                : Math.max(across, down)
        expect(filled / asked(block), `${kind} @ ${where}`).toBeGreaterThanOrEqual(BOX_FILL_FLOOR)
      }
    }
  })

  /**
   * Double the box, double the drawing — the property that says a size came off
   * the box rather than off the frame, and the one a fraction of `base` fails
   * however plausible the picture it drew.
   *
   * Exactly double, not approximately: the estimate is linear in the size and the
   * measure grows with it, so the same words break in the same places. A kind that
   * kept one number in frame units would show up here as a ratio drifting towards
   * 1.
   */
  it('doubles everything it draws when its box doubles', () => {
    for (const corpus of [POOREST, LONGEST]) {
      for (const kind of KINDS) {
        for (const [w, h] of [[800, 400], [500, 500], [300, 700]]) {
          const one = blockExtent(corpus[kind], { left: 0, top: 0, width: w, height: h }, 1080)
          const two = blockExtent(corpus[kind], { left: 0, top: 0, width: w * 2, height: h * 2 }, 1080)
          for (const axis of ['width', 'height']) {
            if (one[axis] === 0) continue
            expect(two[axis] / one[axis], `${kind} ${axis} @ ${w}×${h}`).toBeCloseTo(2, 1)
          }
        }
      }
    }
  })

  /**
   * The named exception, and its ceiling.
   *
   * A hairline is the one thing that must NOT double with its box: 3 px under a
   * headline in one scene and 9 px under a smaller one in the next is not a
   * hairline, it is two design systems in one film. It is also bounded, because an
   * exception with no ceiling is the rule going back out of the window — inside a
   * box too small to hold it, the rule thins rather than becoming the block.
   */
  it('keeps a hairline constant across box sizes, and bounded inside a small one', () => {
    const big = { width: 1600, height: 900 }
    const small = { width: 800, height: 450 }
    expect(hairline(1080, big)).toBe(hairline(1080, small))
    expect(hairline(1080, big)).toBe(3)
    // 4 px of box cannot hold 3 px of rule and still be a rule under something.
    expect(hairline(1080, { width: 40, height: 4 })).toBeLessThanOrEqual(Math.floor(4 * CONSTANT_CEILING) || 1)
    // A separator is the one block whose thickness is that metric rather than a
    // share of its box, which is why its own height is air by design.
    const rule = blockExtent(POOREST.separator, { left: 0, top: 0, width: 900, height: 200 }, 1080)
    const wider = blockExtent(POOREST.separator, { left: 0, top: 0, width: 1800, height: 400 }, 1080)
    expect(rule.thickness).toBe(wider.thickness)
    expect(wider.width / rule.width).toBeCloseTo(2, 1)
  })

  /**
   * The two shares a document may ask for are the blocks' own, and this is the
   * only thing holding the copies equal until the blocks read `DECLARED_SHARE`
   * themselves. A rule that ran to 62% of its box here and 18% in `misc.js` is a
   * block drawing something a test measured differently.
   */
  it('mirrors the two share tables the blocks still own', () => {
    expect(DECLARED_SHARE.separator).toEqual(RULE_EXTENTS)
    for (const [size, share] of Object.entries(DECLARED_SHARE.solidScene)) {
      // Read back through the function that applies it: `SOLID_SHARE` is private
      // to its file, and a square canvas in a square box is exactly its share.
      expect(solidCanvas({ width: 1000, height: 1000 }, size, 4000) / 1000).toBeCloseTo(share, 2)
    }
  })
})

// ── A role is a notion of the SCENE ──────────────────────────────────────────
//
// Solving one unit per stack fixed the crushing inside a zone and created an
// inversion between zones: on a scene of eight blocks, a `kicker` alone in its
// column — sized against a column nothing else was in — came out three times the
// height of the `heading` in the column beside it. A surtitle three times its own
// title is the arrangement the type scale exists to prevent, arriving through the
// one door the scale did not look through.
//
// The rule is an INEQUALITY and not a shared unit, because two zones have two
// measures and a narrow column must still be allowed to compose smaller: no run
// is drawn larger than a run of a superior role somewhere else in the same scene.
// Below that bound every zone keeps its own answer.

/** The runs a scene really puts on the frame, with the size each is drawn at. */
function sceneRuns(scene, width, height) {
  const out = []
  for (const zone of composedLayout(scene, width, height).zones) {
    for (const { block, box, unit } of zone.layers) {
      const shape = blockShape(block)
      // The size a block DRAWS: the stack's unit, capped by its own measure the
      // way `shapeHeight` and `blockExtent` both cap it. A run that stopped
      // growing at 24 characters across its column is not drawn at the unit.
      const at = Math.min(unit, shapeCeiling(shape, box.width))
      for (const run of shape.runs) {
        if (String(run.text ?? '').trim().length === 0) continue
        out.push({
          where: `${zone.anchor}/${block.kind}`,
          zone: zone.anchor,
          step: typeRole(run.role).step,
          size: typeSize(run.role, at),
          block,
          box,
          unit,
        })
      }
    }
  }
  return out
}

/**
 * Scenes covering the ten zones, one to eight layers, with and without a field —
 * three arrangements, because the defect only appears when two zones can
 * disagree and the guarantee it must not cost only appears when they cannot.
 */
function arrangements(count, seed) {
  const cells = ANCHORS.filter((anchor) => anchor !== 'full')
  const at = (i) => cells[(seed + i) % cells.length]
  return {
    // One block per zone, walking the nine cells: where two units can disagree.
    spread: Array.from({ length: count }, (_, i) => at(i)),
    // Pairs sharing a zone: where a stack has to keep agreeing with itself.
    stacked: Array.from({ length: count }, (_, i) => at(Math.floor(i / 2))),
    // A field under the lot, which is the zone that occupies no cell.
    field: ['full', ...Array.from({ length: count - 1 }, (_, i) => at(i))],
  }
}

describe('a role is a notion of the scene, not of the stack it was solved in', () => {
  /**
   * The rule, over the whole corpus: nothing of a role is larger than something
   * of a superior role in the same frame.
   *
   * Pairs inside ONE zone are excluded, and the exclusion is the decision rather
   * than a convenience. A stack already agrees with itself — one unit, an ordered
   * scale — and the only way it can still invert is a per-block measure ceiling: a
   * counter whose face has stopped growing beside a title that has not. Correcting
   * that means lowering the whole zone below what its box allows, which is the
   * guarantee the box arithmetic was written to give and which the test below is
   * the other half of. Two defects, and this one does not get to spend the other's
   * answer.
   */
  it('never draws a run larger than a run of a superior role elsewhere in the scene', () => {
    let checked = 0
    for (const [ratio, size] of FRAMES) {
      for (let count = 1; count <= 8; count += 1) {
        for (let seed = 0; seed < KINDS.length; seed += 1) {
          for (const [shape, anchors] of Object.entries(arrangements(count, seed))) {
            const layers = anchors.map((anchor, i) => ({
              ...(i % 2 ? LONGEST : POOREST)[KINDS[(seed + i * 7) % KINDS.length]],
              anchor,
            }))
            const runs = sceneRuns({ layers }, size.width, size.height)
            for (const mine of runs) {
              for (const other of runs) {
                if (other.zone === mine.zone || !(other.step > mine.step)) continue
                expect(
                  mine.size,
                  `${ratio} ${shape} ${count}×, seed ${seed}: ${mine.where} over ${other.where}`,
                ).toBeLessThanOrEqual(other.size)
                checked += 1
              }
            }
          }
        }
      }
    }
    // The sweep really did compare things: a corpus that quietly stopped putting
    // two roles in two zones would pass this for having iterated less.
    expect(checked).toBeGreaterThan(1000)
  })

  /**
   * And the box is still full — the guarantee the previous pass paid for, which
   * a scene-wide cap is exactly the sort of thing that would quietly undo.
   *
   * It cannot here, and the reason is structural rather than lucky: a block's box
   * is what it DRAWS at the unit its stack ended up with (`stackIn` measures the
   * heights after the cap, not before), so lowering a unit lowers the box with it
   * and the leftover goes back to the zone. A version of this fix that had capped
   * the unit and kept the boxes would show up here as every block in a corrected
   * zone floating in its own allotment.
   */
  it('still fills every box it hands out, over the same corpus', () => {
    let checked = 0
    for (const [ratio, size] of FRAMES) {
      const base = frameBase(size.width, size.height)
      for (let count = 1; count <= 8; count += 1) {
        for (let seed = 0; seed < KINDS.length; seed += 1) {
          for (const [shape, anchors] of Object.entries(arrangements(count, seed))) {
            const layers = anchors.map((anchor, i) => ({
              ...(i % 2 ? LONGEST : POOREST)[KINDS[(seed + i * 7) % KINDS.length]],
              anchor,
            }))
            for (const zone of composedLayout({ layers }, size.width, size.height).zones) {
              for (const { block, box, unit } of zone.layers) {
                if (!(box.width > 0 && box.height > 0)) continue
                const drawn = blockExtent(block, box, base, unit)
                const across = drawn.width / box.width
                const down = drawn.height / box.height
                const fills = BLOCK_APPETITE[block.kind].fills
                const filled =
                  fills === 'both'
                    ? Math.min(across, down)
                    : fills === 'width'
                      ? across
                      : fills === 'minor'
                        ? Math.min(drawn.width, drawn.height) / Math.min(box.width, box.height)
                        : Math.max(across, down)
                expect(
                  filled / asked(block),
                  `${ratio} ${shape} ${count}×, seed ${seed}: ${block.kind} @ ${zone.anchor}`,
                ).toBeGreaterThanOrEqual(BOX_FILL_FLOOR)
                checked += 1
              }
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000)
  })

  /**
   * The export that made this necessary, as two blocks: `DENSE` alone in a column
   * beside a heading in the next one. It was three times the heading's height.
   *
   * The second export is why the bound moved from the SIZE to the UNIT. Bounded
   * on the size, the surtitle came back at exactly the headline's cap height —
   * inside the letter of the rule and outside its point, since a caption that is
   * not smaller than the line it announces is not a caption. On the unit the pair
   * lands where `TYPE_ROLES` puts it: 0.65 against 1.55.
   */
  it('never draws a kicker alone in a column larger than the heading beside it', () => {
    const layers = [
      { ...POOREST.kicker, text: 'Dense', anchor: 'center-left' },
      { ...LONGEST.heading, anchor: 'center-right' },
    ]
    for (const [ratio, size] of FRAMES) {
      const runs = sceneRuns({ layers }, size.width, size.height)
      const kicker = runs.find((run) => run.where.endsWith('kicker'))
      const heading = runs.find((run) => run.where.endsWith('heading'))
      expect(kicker.size, `${ratio}: the surtitle over its own title`).toBeLessThanOrEqual(heading.size)
      // And it keeps its RANK: the two are two steps of one scale, not two sizes
      // that merely happen to be ordered. The bound is on the unit, so the column
      // that had to give something up reads the other's unit and draws its own
      // step of it.
      expect(kicker.size / heading.size, `${ratio}: the rank of a surtitle`).toBeCloseTo(
        TYPE_ROLES.caption.step / TYPE_ROLES.display.step,
        2,
      )
    }
  })

  /**
   * `harmoniseUnits` on its own: it only ever lowers, and it lowers nothing it has
   * nothing to compare with.
   *
   * The second half is what makes the poorest document the schema accepts pay
   * nothing at all — one block, no anchor, one stack, and the answer is exactly
   * what `solveTypeUnit` gave.
   */
  it('lowers a stack only against another one, and never raises anything', () => {
    const caption = { step: TYPE_ROLES.caption.step, ceiling: Infinity }
    const title = { step: TYPE_ROLES.title.step, ceiling: Infinity }
    // A lone stack, however large: nothing to be measured against.
    expect(harmoniseUnits([{ unit: 400, runs: [caption] }])).toEqual([400])
    // A caption twice the size of a title elsewhere comes back at the title's
    // UNIT — so it draws its own step of it, 0.65 against 1.55, rather than the
    // same cap height. Bounding the size was the first version and it collapsed
    // the order it was meant to keep.
    const [surtitle, headline] = harmoniseUnits([
      { unit: 400, runs: [caption] },
      { unit: 40, runs: [title] },
    ])
    expect(headline).toBe(40)
    expect(surtitle).toBeCloseTo(40, 6)
    // The other way round costs nothing: a title is not bounded by a caption.
    expect(harmoniseUnits([{ unit: 40, runs: [title] }, { unit: 400, runs: [caption] }])[0]).toBe(40)
    // A run that stopped growing at its own measure does not drag its zone down.
    const capped = { step: TYPE_ROLES.title.step, ceiling: 10 }
    expect(harmoniseUnits([{ unit: 400, runs: [caption] }, { unit: 400, runs: [capped] }])[1]).toBe(400)
    // And nothing it is handed makes it throw inside a browser.
    expect(harmoniseUnits(undefined)).toEqual([])
    expect(harmoniseUnits([{}, { unit: 'x', runs: 'no' }])).toEqual([0, 0])
  })

  /**
   * The lowering stops where the INK's licence does.
   *
   * `palette.accent` and `palette.display` are resolved at the 3:1 floor, which
   * the audit licences for bold type past `BOLD_LARGE_PX`. Bounding the scale
   * rather than the size is stricter — that is the point of it — and on a crowded
   * frame it would push a surtitle under that bar, which is not a quieter scene
   * but a run measured at a floor it no longer qualifies for. So the scale bound
   * has a floor, and the ORDER bound does not: an inversion is wrong at every
   * size.
   */
  it('stops lowering a run at the size its ink was licensed for', () => {
    const caption = { step: TYPE_ROLES.caption.step, ceiling: Infinity }
    const body = { step: TYPE_ROLES.body.step, ceiling: Infinity }
    // The scale alone would put a caption beside a 20 px body run at 13 px. The
    // floor holds it at the licence instead.
    const [surtitle] = harmoniseUnits([{ unit: 400, runs: [caption] }, { unit: 20, runs: [body] }])
    expect(surtitle * TYPE_ROLES.caption.step).toBeCloseTo(BOLD_LARGE_PX, 6)
    // And the ORDER still wins over the floor: the surtitle is at the licence and
    // still under the body run it is measured against.
    expect(surtitle * TYPE_ROLES.caption.step).toBeLessThanOrEqual(20 * TYPE_ROLES.body.step + 1e-9)
    // A stack that already composes under the bar keeps its own answer: its box is
    // a promise about somebody else's interface and the bar is not.
    expect(harmoniseUnits([{ unit: 4, runs: [caption] }, { unit: 20, runs: [body] }])[0]).toBe(4)
  })
})

describe('groundDensity', () => {
  /**
   * The one quantity a composed film has that could undo the legibility
   * guarantee. `composedPalette` measured every run against the ground's tint at
   * full strength, so a pulse above 1 is text on a surface nobody measured — and
   * the asymmetry is the whole argument: a layer that can only get fainter cannot
   * spend contrast the measurement promised.
   */
  it('never rises above the density that was measured, and never falls through the floor', () => {
    for (const kind of ['gridPulse', 'particles']) {
      for (let step = 0; step <= 100; step += 1) {
        const density = groundDensity(kind, step / 100)
        expect(density, `${kind} at ${step}%`).toBeLessThanOrEqual(1)
        expect(density, `${kind} at ${step}%`).toBeGreaterThanOrEqual(PULSE_FLOOR)
      }
    }
  })

  it('holds a ground that does not animate at full strength', () => {
    for (const kind of ['solid', 'hairlines', 'gradient', 'image', 'constructor', undefined]) {
      expect(groundDensity(kind, 0.5), String(kind)).toBe(1)
    }
  })

  it('actually moves the grounds that do animate', () => {
    for (const kind of ['gridPulse', 'particles']) {
      expect(groundDensity(kind, 0), kind).not.toBe(groundDensity(kind, 0.25))
    }
  })
})

describe('the mosaic dissolve', () => {
  /**
   * A transition that could leave the last frame of a scene partly masked would be
   * a hole in the middle of a film, so the two ends are what this checks: nothing
   * shows at the start, everything shows at the end.
   */
  it('reveals nothing at its start and everything at its end', () => {
    const start = entranceStyle('pixel', 0, 20)
    const end = entranceStyle('pixel', 20, 20)
    expect(start.maskImage).toContain('0 0%')
    expect(end.maskImage).toContain(`0 ${PIXEL_CELL_PERCENT}%`)
    // At full reveal the transparent range is empty, so the mask is opaque
    // whatever a renderer makes of `mask-composite`.
    expect(end.maskImage).toContain(`${PIXEL_CELL_PERCENT}% ${PIXEL_CELL_PERCENT}%`)
  })

  it('carries the prefixed spelling beside the standard one', () => {
    const style = entranceStyle('pixel', 10, 20)
    expect(style.WebkitMaskImage).toBe(style.maskImage)
    expect(style.maskComposite).toBe('intersect')
  })

  it('belongs to the arriving scene, like every other transition', () => {
    // No entrance for the first scene, and none for `none`: this is shared code,
    // so the rule is the same one the four older transitions follow.
    expect(entranceStyle('pixel', 0, 0)).toBe(null)
  })
})
