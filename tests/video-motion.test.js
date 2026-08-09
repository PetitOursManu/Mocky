// A film in which nothing moves must not be producible by accident.
//
// This is the test for a defect a user reported in one sentence — "if it is just
// a title on a picture, it is rubbish" — and the code agreed with him twice
// over. `kenBurns` defaulted to `static`, so a model that omitted an optional
// field (which is what a model does with an optional field) got a photograph
// nailed to the frame; the compose prompt described `static` as "the calm
// choice"; the banded template had no movement field at all and its catalogue
// card said there was no camera move in it; and the slideshow's caption appeared
// on frame one and stayed there. Four separate decisions, each defensible on its
// own, adding up to an mp4 of still pictures with words on them.
//
// Every one of those is now the other way round, and this file is what keeps them
// there. It asks the only question that matters, in the only place it can be
// asked without rendering a video: given a document where the model filled in
// NOTHING optional, is the last frame of each scene different from the first?
//
// It is a cross-cutting test rather than a co-located one because it needs both
// sides of the wire — Mocky's schema, which decides what silence means, and the
// worker's arithmetic, which decides what the frame does — exactly like
// `video-frame-geometry.test.js` next door. Neither half proves anything alone:
// a schema that defaults to `zoom-in` over a composition that ignores it is a
// film that still holds still, which is what `.strict()` exists to prevent one
// layer up and what a test has to prevent here.
import { describe, it, expect } from 'vitest'
// No Remotion and no React on either side of this import. `composition.js` says
// so at the top, and its motion lives there rather than in the five `.jsx` files
// for this exact reason: arithmetic is the only part of a video a test can check.
import {
  MOTIONS,
  OVERLAY_DRIFT_PERCENT,
  OVERLAY_DRIFT_SCALE,
  OVERLAY_SETTLE_FRAMES,
  PAN_SCALE,
  PAN_SHIFT_PERCENT,
  overlayDriftTransform,
  planTimeline,
  sceneMotion,
} from '../worker/video/remotion/composition.js'
import {
  DEFAULT_KEN_BURNS,
  DEFAULT_OVERLAY_MOVE,
  OVERLAY_MOVES,
  TEMPLATE_LIMITS,
  VIDEO_TEMPLATES,
  VideoTimelineSchema,
} from '../src/lib/video/timeline.ts'

const ID = 'a'.repeat(64)

/**
 * The smallest legal document of each template, as a model that answered in a
 * hurry would write it: every required field, not one optional one.
 *
 * That is the shape this whole file is about. A corpus of hand-written documents
 * with `kenBurns` spelled out would have passed every day the defect was
 * shipping — the freeze was never in what a document SAID, it was in what the
 * schema made of what it left out.
 *
 * `slideshow` deliberately does not even name its template, because a document
 * out of the queue's journal does not, and that path defaults twice.
 */
const MINIMAL = {
  slideshow: (durationMs) => ({ scenes: [{ imageId: ID, durationMs }] }),
  overlay: (durationMs) => ({
    template: 'overlay',
    scenes: [{ imageId: ID, durationMs, band: { title: 'Le tableau de bord' } }],
  }),
  vertical: (durationMs) => ({ template: 'vertical', scenes: [{ imageId: ID, durationMs }] }),
  titles: (durationMs) => ({ template: 'titles', scenes: [{ headline: 'Conçu dans le navigateur', durationMs }] }),
  product: (durationMs) => ({
    template: 'product',
    scenes: [{ imageId: ID, durationMs, headline: 'La station', bullets: ['Deux cœurs'] }],
  }),
}

/** One scene's moving quantities as a value that can be compared. */
const at = (template, entry, frame) => JSON.stringify(sceneMotion(template, entry, frame))

/**
 * The first and last frames of every scene of a document, planned exactly as the
 * worker plans it.
 */
function scenesOf(template, durationMs) {
  const timeline = VideoTimelineSchema.parse(MINIMAL[template](durationMs))
  return planTimeline(timeline).scenes
}

describe('no scene of any template can hold still by default', () => {
  /**
   * The whole point, and the reason it sweeps both ends of every window: the
   * shortest legal scene is where `cueFrames` compresses hardest — a cascade that
   * did not fit would collapse to frame zero and the scene would be over before
   * anything arrived — and the longest is where a held frame is most obviously a
   * render that stopped.
   */
  it.each(VIDEO_TEMPLATES)('moves a minimal %s scene between its first and last frame', (template) => {
    for (const durationMs of [TEMPLATE_LIMITS[template].minSceneMs, TEMPLATE_LIMITS[template].maxSceneMs]) {
      for (const entry of scenesOf(template, durationMs)) {
        const last = entry.durationInFrames - 1
        expect(at(template, entry, 0), `${template} at ${durationMs} ms`).not.toBe(at(template, entry, last))
      }
    }
  })

  /**
   * Not merely different at the ends — moving throughout.
   *
   * Two distinct values is what a scene that jumps once looks like, and it would
   * satisfy the test above while still reading as a still frame with a glitch in
   * it. A real movement passes through a great many intermediate states; ten is a
   * floor low enough that a deliberately short entrance still clears it.
   */
  it.each(VIDEO_TEMPLATES)('keeps a minimal %s scene moving, rather than jumping once', (template) => {
    for (const entry of scenesOf(template, TEMPLATE_LIMITS[template].maxSceneMs)) {
      const seen = new Set()
      for (let frame = 0; frame < entry.durationInFrames; frame += 1) seen.add(at(template, entry, frame))
      expect(seen.size, template).toBeGreaterThan(10)
    }
  })

  /**
   * The map that has to grow with the catalogue, checked the way `PALETTES` and
   * `COMPOSITIONS` are: a sixth template with a composition and no motion is a
   * film nothing here can fail on, since the loops above iterate the templates
   * this map does not know about.
   */
  it('has a motion for every template in the catalogue, and no others', () => {
    expect(Object.keys(MOTIONS).sort()).toEqual([...VIDEO_TEMPLATES].sort())
  })
})

/**
 * The other half of the proof above, and the half that was missing.
 *
 * "The last frame differs from the first" is only worth something if every
 * quantity it compares is a quantity somebody can SEE. A progress reported for an
 * element the composition does not draw satisfies the test and changes nothing on
 * the frame — which is the same failure as a schema field the renderer ignores,
 * arriving through the one thing written to catch it.
 *
 * It was not hypothetical. `kicker` was reported on every ONE-SCENE film, where
 * `sceneLabel` is empty and neither banded nor titled composition draws a counter
 * at all, and `subtitle` was reported on every overlay band that carries none. So
 * the two sides are compared here rather than assumed: the table is read off the
 * five `.jsx` files, and it is an equality, because a term the composition draws
 * and the motion does NOT report is an `undefined` in a style attribute.
 */
describe('a motion term is reported only when the composition draws it', () => {
  const drawn = {
    slideshow: (scene) => ['picture', ...(scene.textOverlay ? ['caption'] : [])],
    overlay: (scene, label) => [
      'picture',
      'band',
      'title',
      ...(label ? ['kicker'] : []),
      ...(scene.band.subtitle ? ['subtitle'] : []),
    ],
    vertical: (scene) => ['punch', 'picture', ...(scene.textOverlay ? ['words', 'rule'] : [])],
    titles: (scene, label) => [
      'drift',
      'words',
      'rule',
      ...(label ? ['kicker'] : []),
      ...(scene.subtitle ? ['subtitle'] : []),
    ],
    product: (scene) => ['picture', 'headline', 'bullets', ...(scene.cta ? ['closing', 'cta'] : [])],
  }

  /** The same five documents as above, and the same five with every optional field filled. */
  const FULL = {
    slideshow: (d) => ({ scenes: [{ imageId: ID, durationMs: d, textOverlay: { content: 'Une accroche', position: 'bottom' } }] }),
    overlay: (d) => ({
      template: 'overlay',
      scenes: [{ imageId: ID, durationMs: d, band: { title: 'Le tableau de bord', subtitle: 'Tout, en un écran' } }],
    }),
    vertical: (d) => ({
      template: 'vertical',
      scenes: [{ imageId: ID, durationMs: d, textOverlay: { content: 'Trois mots', position: 'bottom' } }],
    }),
    titles: (d) => ({ template: 'titles', scenes: [{ headline: 'Conçu ici', subtitle: 'Et rendu ailleurs', durationMs: d }] }),
    product: (d) => ({
      template: 'product',
      scenes: [{ imageId: ID, durationMs: d, headline: 'La station', bullets: ['Deux cœurs'], cta: 'Essayer' }],
    }),
  }

  /** A film of two scenes, so the counter exists — and one of one, so it does not. */
  const twice = (doc) => ({ ...doc, scenes: [doc.scenes[0], doc.scenes[0]] })

  it.each(VIDEO_TEMPLATES)('reports exactly what a %s scene puts on the frame', (template) => {
    const durationMs = TEMPLATE_LIMITS[template].maxSceneMs
    for (const build of [MINIMAL[template], FULL[template]]) {
      for (const doc of [build(durationMs), twice(build(durationMs))]) {
        const plan = planTimeline(VideoTimelineSchema.parse(doc))
        plan.scenes.forEach((entry) => {
          const reported = Object.keys(sceneMotion(template, entry, 3)).sort()
          expect(reported, `${template} ${plan.scenes.length} scene(s)`).toEqual(
            drawn[template](entry.scene, entry.label).sort(),
          )
        })
      }
    }
  })

  /**
   * The counter itself: one string, computed in `planTimeline`, read by the
   * motion and by the composition. Two computations of it is what produced the
   * defect, so the test is that there is one.
   */
  it('takes the counter off the plan rather than from a second count', () => {
    const one = planTimeline(VideoTimelineSchema.parse(MINIMAL.titles(4000)))
    const two = planTimeline(VideoTimelineSchema.parse(twice(MINIMAL.titles(4000))))
    expect(one.scenes[0].label).toBe('')
    expect(two.scenes.map((e) => e.label)).toEqual(['01 / 02', '02 / 02'])
    expect(sceneMotion('titles', one.scenes[0], 3)).not.toHaveProperty('kicker')
    expect(sceneMotion('titles', two.scenes[0], 3)).toHaveProperty('kicker')
  })
})

describe('silence never asks for a freeze', () => {
  /**
   * The line the defect was on. `static` is a legitimate value and it stays in
   * the enum — a capture of an interface has real reasons to be held, and
   * removing an enum value refuses every saved draft that names it — but it is
   * now something a document has to ASK for.
   */
  it('never defaults a camera move to static', () => {
    for (const [template, move] of Object.entries(DEFAULT_KEN_BURNS)) {
      expect(move, template).not.toBe('static')
    }
    expect(OVERLAY_MOVES).not.toContain('static')
    expect(OVERLAY_MOVES).toContain(DEFAULT_OVERLAY_MOVE)
  })

  it('gives a slideshow scene a real camera move when the document names none', () => {
    const [scene] = VideoTimelineSchema.parse(MINIMAL.slideshow(4000)).scenes
    expect(scene.kenBurns).toBe(DEFAULT_KEN_BURNS.slideshow)
    expect(scene.kenBurns).not.toBe('static')
  })

  it('gives an overlay scene a drift when the document names none', () => {
    const [scene] = VideoTimelineSchema.parse(MINIMAL.overlay(4000)).scenes
    expect(scene.move).toBe(DEFAULT_OVERLAY_MOVE)
  })
})

describe('static is still reachable, and it still means still', () => {
  /**
   * The exact boundary of the guarantee above, written down so the next reader
   * does not have to infer it: a document that ASKS for a held frame and puts no
   * text on it gets a held frame. That is the case the enum exists for, and the
   * one the default stopped being.
   */
  const held = (extra) =>
    planTimeline(VideoTimelineSchema.parse({ scenes: [{ imageId: ID, durationMs: 6000, kenBurns: 'static', ...extra }] }))
      .scenes[0]

  it('holds a picture the document asked to hold', () => {
    const entry = held({})
    expect(at('slideshow', entry, 0)).toBe(at('slideshow', entry, entry.durationInFrames - 1))
  })

  /**
   * And the moment there is something to read, even a held scene has an arrival.
   * The caption used to be present from frame one, which is what made `static`
   * plus a caption a single still image — literally "a title on a picture".
   */
  it('still brings a caption in on a scene it was asked to hold', () => {
    const entry = held({ textOverlay: { content: 'Une accroche', position: 'bottom' } })
    expect(sceneMotion('slideshow', entry, 0).caption).toBe(0)
    expect(sceneMotion('slideshow', entry, entry.durationInFrames - 1).caption).toBe(1)
  })
})

describe('the overlay drift keeps the whole capture', () => {
  /**
   * The arithmetic that separates this movement from the pan the template
   * refuses, and the reason it is safe on a screenshot.
   *
   * The picture is painted `OVERLAY_DRIFT_SCALE` past `cover`, which leaves half
   * of the surplus as margin on each edge; the drift travels
   * `OVERLAY_DRIFT_PERCENT` of the picture's own height, scaled by that same
   * overscale. As long as the travel is under the margin, every pixel the frame
   * shows at rest it shows on every frame — nothing of the interface leaves.
   *
   * The pan is the comparison, and it is an order of magnitude away: it crops an
   * eighth of the capture before the first frame in order to slide a twentieth of
   * it. Both are legal transforms; only one of them can be done to a screenshot.
   */
  it('travels less than the margin its overscale leaves', () => {
    const margin = ((OVERLAY_DRIFT_SCALE - 1) / 2) * 100
    expect(OVERLAY_DRIFT_PERCENT * OVERLAY_DRIFT_SCALE).toBeLessThan(margin * OVERLAY_DRIFT_SCALE + margin)
    expect(OVERLAY_DRIFT_PERCENT).toBeLessThan(margin)
    // An order of magnitude below what a pan spends, which is the whole argument.
    expect(OVERLAY_DRIFT_SCALE - 1).toBeLessThan((PAN_SCALE - 1) / 3)
    expect(OVERLAY_DRIFT_PERCENT).toBeLessThan(PAN_SHIFT_PERCENT / 3)
  })

  it.each(OVERLAY_MOVES)('moves a whole scene under %s, not just its opening', (move) => {
    const frames = 300
    // Past the landing, so a `settle` that had stopped moving would be caught.
    const after = OVERLAY_SETTLE_FRAMES + 1
    expect(overlayDriftTransform(move, after, frames)).not.toBe(overlayDriftTransform(move, frames - 1, frames))
  })

  it('never answers with a still frame, whatever it is handed', () => {
    for (const move of [...OVERLAY_MOVES, undefined, null, 'static', 'constructor', 42]) {
      const first = overlayDriftTransform(move, 0, 200)
      const last = overlayDriftTransform(move, 199, 200)
      expect(first, String(move)).not.toBe(last)
      expect(first, String(move)).not.toBe('none')
    }
  })
})
