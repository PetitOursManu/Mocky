// A composed scene puts everything on the frame, inside it, and in time.
//
// The other five templates draw a layout somebody wrote: a caption is bottom
// centre because `ImageSequenceVideo` says so, and the only way it lands
// somewhere else is if the file changes. The sixth draws a layout the DOCUMENT
// arranges, so the questions a reviewer would have answered by reading the
// component have to be answered by arithmetic instead:
//
//   - is every block the document asked for actually somewhere?
//   - is that somewhere inside the frame — including the part of a portrait frame
//     a feed application covers with its own interface?
//   - does every block arrive before its own scene ends?
//   - and does anything move at all?
//
// Cross-cutting rather than co-located, for the reason `video-motion.test.js` is:
// it needs both halves of the wire. Mocky's schema decides what SILENCE means —
// no anchor, no rank, no background — and the worker's arithmetic decides where
// that lands. Neither half proves anything alone: a schema defaulting `anchor` to
// `center` over a layout with no centre cell is a block nobody sees, and a layout
// tested on hand-written fixtures is a layout tested on documents no model writes.
import { describe, it, expect } from 'vitest'
// No Remotion and no React on either side of this import — `composition.js` holds
// no JSX precisely so that a test can ask these questions without rendering.
import {
  EMPHASIS_ENTER_FRAMES,
  MIN_CUE_TAIL_FRAMES,
  composedLayout,
  composedSafeArea,
  dimensionsFor,
  layerCues,
  planTimeline,
  sceneMotion,
} from '../worker/video/remotion/composition.js'
// The anchors come from the SCHEMA and are fed to the worker's layout, which is
// half the point of this file: a zone Mocky can express and the worker cannot
// place is a block that vanishes from a film somebody waited two minutes for.
import { ANCHORS, ASPECT_RATIOS, BLOCK_LIMITS, TEMPLATE_LIMITS, VideoTimelineSchema } from '../src/lib/video/timeline.ts'

/**
 * The poorest composed document the schema accepts: one block, no anchor, no
 * rank, no background, no transition.
 *
 * The shape that matters most here for the same reason it matters in
 * `video-motion.test.js` — the failures this feature has actually had came from
 * what a document left OUT, not from what it said. A model omits an optional
 * field; the case you get by saying nothing has to be the good one.
 */
const MINIMAL = (durationMs) => ({
  template: 'composed',
  scenes: [{ durationMs, layers: [{ kind: 'heading', text: 'Conçu par blocs' }] }],
})

/**
 * The other end: every zone used, the stack at its ceiling, on a ground that
 * moves.
 *
 * Eight layers is `BLOCK_LIMITS.layersPerScene` and there are ten zones, so the
 * ten are covered across two scenes rather than by pretending one scene can hold
 * them — a fixture that quietly asked for nine blocks would be refused by the
 * validator and the whole file would be testing the refusal.
 */
const CROWDED = (durationMs) => ({
  template: 'composed',
  scenes: [ANCHORS.slice(0, 5), ANCHORS.slice(5)].map((anchors) => ({
    durationMs,
    background: { kind: 'gridPulse', cells: 10 },
    layers: anchors.map((anchor, i) => ({ kind: 'heading', text: `Bloc ${anchor}`, anchor, ...(i % 2 ? { enter: i } : {}) })),
  })),
})

/** Both documents, in every ratio the union lets a composed film ask for. */
function films(build, durationMs) {
  return ASPECT_RATIOS.map((aspectRatio) => {
    const timeline = VideoTimelineSchema.parse({ ...build(durationMs), aspectRatio })
    const { width, height } = dimensionsFor(timeline.aspectRatio)
    return { aspectRatio, width, height, plan: planTimeline(timeline) }
  })
}

const CASES = [
  ['a minimal document', MINIMAL],
  ['a document that uses every zone', CROWDED],
]

describe('everything a composed document asks for is on the frame', () => {
  it.each(CASES)('places every block of %s, exactly once', (_label, build) => {
    for (const { aspectRatio, width, height, plan } of films(build, 6000)) {
      for (const entry of plan.scenes) {
        const placed = composedLayout(entry.scene, width, height).zones.flatMap((zone) =>
          zone.layers.map(({ index }) => index),
        )
        // A set, because one block drawn twice and one never drawn are the same
        // defect from the frame's point of view: something is missing.
        expect([...placed].sort((a, b) => a - b), aspectRatio).toEqual(entry.scene.layers.map((_layer, i) => i))
      }
    }
  })

  /**
   * Inside the frame, and inside the part of it that is actually visible.
   *
   * The margin is not decoration in either regime: a landscape frame can lose its
   * outer few per cent to a display that crops, and a portrait one loses a fifth
   * of its height to the caption row a feed draws over the video. A block behind a
   * "Follow" button is not close to an edge — it is gone, in an export that
   * reported success.
   */
  it.each(CASES)('keeps every block of %s inside the safe frame', (_label, build) => {
    for (const { aspectRatio, width, height, plan } of films(build, 6000)) {
      const safe = composedSafeArea(width, height)
      expect(safe.left, aspectRatio).toBeGreaterThan(0)
      expect(safe.left + safe.width).toBeLessThanOrEqual(width)
      expect(safe.top + safe.height).toBeLessThanOrEqual(height)
      for (const entry of plan.scenes) {
        for (const { anchor, box } of composedLayout(entry.scene, width, height).zones) {
          const where = `${aspectRatio} ${anchor}`
          expect(box.left, where).toBeGreaterThanOrEqual(safe.left)
          expect(box.top, where).toBeGreaterThanOrEqual(safe.top)
          expect(box.left + box.width, where).toBeLessThanOrEqual(safe.left + safe.width)
          expect(box.top + box.height, where).toBeLessThanOrEqual(safe.top + safe.height)
        }
      }
    }
  })
})

describe('everything a composed document asks for arrives', () => {
  /**
   * Every block is fully on screen before its scene cuts, at both ends of the
   * duration window.
   *
   * The short end is where `cueFrames` compresses hardest — eight blocks at a
   * comfortable pace do not fit in a second and a half, and the answer has to be a
   * faster cascade rather than a block that arrives after its own scene. The long
   * end is where a cue that never fired would be most obviously a hole.
   */
  it.each(CASES)('brings every block of %s in before its scene ends', (_label, build) => {
    for (const durationMs of [TEMPLATE_LIMITS.composed.minSceneMs, TEMPLATE_LIMITS.composed.maxSceneMs]) {
      for (const { aspectRatio, plan } of films(build, durationMs)) {
        for (const entry of plan.scenes) {
          const cues = layerCues(entry.scene.layers, entry.durationInFrames)
          expect(cues, aspectRatio).toHaveLength(entry.scene.layers.length)
          for (const cue of cues) {
            expect(cue).toBeGreaterThanOrEqual(0)
            expect(cue).toBeLessThanOrEqual(Math.max(0, entry.durationInFrames - MIN_CUE_TAIL_FRAMES))
          }
          // And the arrival itself is finished, not merely started: the last frame
          // of the scene shows every block at full strength.
          const last = sceneMotion('composed', entry, entry.durationInFrames - 1)
          expect(last.layers, `${aspectRatio} at ${durationMs} ms`).toEqual(entry.scene.layers.map(() => 1))
        }
      }
    }
  })

  /**
   * A rank is an ORDER, and the layout does not reshuffle it.
   *
   * Two things could quietly disagree here: the cascade is computed over the
   * document's own list, while the layout groups that list by zone. A layout that
   * renumbered anything would give block 3's arrival to block 5, and every frame
   * of it would look plausible.
   */
  it('gives each block the arrival computed for its own position in the document', () => {
    const [{ width, height, plan }] = films(CROWDED, 6000)
    for (const entry of plan.scenes) {
      const cues = layerCues(entry.scene.layers, entry.durationInFrames)
      for (const zone of composedLayout(entry.scene, width, height).zones) {
        for (const { index, block } of zone.layers) {
          expect(entry.scene.layers[index]).toBe(block)
          // Nothing on its own cue, everything one entrance later. The longest
          // entrance there is, since one block per scene may arrive at the
          // emphasis pace — and `MIN_CUE_TAIL_FRAMES` is what makes even that one
          // land inside its own scene.
          const on = (frame) => sceneMotion('composed', entry, frame).layers[index]
          expect(on(cues[index]), `block ${index} on its cue`).toBe(0)
          expect(on(cues[index] + EMPHASIS_ENTER_FRAMES), `block ${index} after its entrance`).toBe(1)
        }
      }
    }
  })
})

describe('and nothing about a composed scene holds still', () => {
  /**
   * `tests/video-motion.test.js` owns this claim for all six templates; it is
   * restated here on the crowded document because that is the one this file
   * builds. A stack at its ceiling is where a cascade could compress to nothing
   * and leave a scene that arrives whole on frame zero and then sits there.
   */
  it.each(CASES)('moves %s between its first frame and its last', (_label, build) => {
    for (const { aspectRatio, plan } of films(build, TEMPLATE_LIMITS.composed.maxSceneMs)) {
      for (const entry of plan.scenes) {
        const first = JSON.stringify(sceneMotion('composed', entry, 0))
        const last = JSON.stringify(sceneMotion('composed', entry, entry.durationInFrames - 1))
        expect(first, aspectRatio).not.toBe(last)
      }
    }
  })
})

describe('the fixtures above are what they claim to be', () => {
  /**
   * Guarding the guard, as the palette sweep does: a crowded document that quietly
   * stopped covering every zone, or a stack under the schema's ceiling, would make
   * every loop in this file green for having iterated less.
   */
  it('covers every zone the schema can name, at the stack’s ceiling', () => {
    const { plan } = films(CROWDED, 6000)[0]
    const used = plan.scenes.flatMap((entry) => entry.scene.layers.map((layer) => layer.anchor))
    expect([...new Set(used)].sort()).toEqual([...ANCHORS].sort())
    expect(Math.max(...plan.scenes.map((entry) => entry.scene.layers.length))).toBeLessThanOrEqual(
      BLOCK_LIMITS.layersPerScene,
    )
  })

  /** And the minimal one really is silent: one block, and nothing else said. */
  it('leaves the minimal document with no anchor, no rank and no ground of its own', () => {
    const [scene] = MINIMAL(4000).scenes
    expect(Object.keys(scene).sort()).toEqual(['durationMs', 'layers'])
    expect(Object.keys(scene.layers[0]).sort()).toEqual(['kind', 'text'])
  })
})
