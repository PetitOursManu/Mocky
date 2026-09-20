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
  BLOCK_APPETITE,
  EMPHASIS_ENTER_FRAMES,
  MIN_CUE_TAIL_FRAMES,
  composedLayout,
  composedSafeArea,
  dimensionsFor,
  frameBase,
  layerCues,
  planTimeline,
  sceneMotion,
} from '../worker/video/remotion/composition.js'
// The blocks whose wasted pixels are measured in render seconds. They are here
// rather than in their own files because the claim below is not about any of
// them: it is about what the LAYOUT lets a document ask a renderer for.
//
// `blockCanvas` and not `solidCanvas`, and the difference is the whole reason
// this import moved. The claim used to be checked on the one descriptor a
// reviewer could name — a solid's square — while the file that decides what a
// GL canvas is went on growing beside it. A test that measures one of nine
// descriptors is green for the eight it never looked at.
import { BLOCK_CANVASES, blockCanvas } from '../worker/video/remotion/blocks/canvases.js'
// The permission's own list, which is the other end of the same wire: a block is
// three-dimensional exactly when a renderer draws it, so the names an
// administrator rations and the names that open a canvas are one list seen from
// two sides. `tests/video-3d-permission.test.js` holds it against the WORKER's
// components; this holds it against the descriptors.
import { THREE_D_BLOCKS } from '../server/video/three-d.js'
// The anchors come from the SCHEMA and are fed to the worker's layout, which is
// half the point of this file: a zone Mocky can express and the worker cannot
// place is a block that vanishes from a film somebody waited two minutes for.
import {
  ANCHORS,
  ASPECT_RATIOS,
  BLOCK_KINDS,
  BLOCK_LIMITS,
  TEMPLATE_LIMITS,
  VideoTimelineSchema,
} from '../src/lib/video/timeline.ts'

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
        for (const zone of composedLayout(entry.scene, width, height).zones) {
          // The zone, and then every block inside it. Both are claims and they
          // are not the same claim: the zone's box is the grid's, and a block's is
          // the share of that zone its own appetite bought. Until the second one
          // existed every block was handed the first, which is how eight fields
          // anchored `full` came to be 4712 px of content in 950 px of frame.
          for (const { anchor, box } of [zone, ...zone.layers.map((layer) => ({ anchor: layer.block.kind, box: layer.box }))]) {
            const where = `${aspectRatio} ${anchor}`
            expect(box.left, where).toBeGreaterThanOrEqual(safe.left)
            expect(box.top, where).toBeGreaterThanOrEqual(safe.top)
            expect(box.left + box.width, where).toBeLessThanOrEqual(safe.left + safe.width)
            expect(box.top + box.height, where).toBeLessThanOrEqual(safe.top + safe.height)
          }
        }
      }
    }
  })

  /**
   * Every kind the schema can name has a row in the weight table, and nothing
   * else does.
   *
   * The same both-directions check `blocks.test.js` runs on the registry, for the
   * same two failures. A kind with no row is laid out by `blockAppetite`'s
   * fallback — a body-sized block, which for a `map` or a `gallery` is a field
   * squeezed into one line of running text, in an export that succeeded. A row
   * with no kind is a number nobody can reach that reads as a decision somebody
   * made.
   */
  it('gives every block kind an appetite, and invents none', () => {
    expect(Object.keys(BLOCK_APPETITE).sort()).toEqual([...BLOCK_KINDS].sort())
  })

  /**
   * The heaviest legal instance of every block that opens a renderer.
   *
   * The bound below is about PIXELS, so each of these is written to ask for the
   * most of them its schema entry allows — the largest share, the most images,
   * the longest line, the highest count. A fixture at a kind's floor would make
   * the ceiling below true of a document nobody sends.
   */
  const ID_A = 'a'.repeat(64)
  const ID_B = 'b'.repeat(64)
  const GL_BLOCKS = {
    solidScene: { kind: 'solidScene', solid: 'sphere', size: 'large' },
    globe: { kind: 'globe', region: 'world', markers: 8, connections: true },
    solidChart: { kind: 'solidChart', values: [10, 40, 70, 100, 55, 30, 80, 20], plinth: true },
    photoStage: { kind: 'photoStage', imageIds: [ID_A, ID_B], frame: 'device', move: 'orbit' },
    photoRing: { kind: 'photoRing', imageIds: Array.from({ length: 6 }, () => ID_A), frame: 'card' },
    extrudedType: { kind: 'extrudedType', text: 'X'.repeat(BLOCK_LIMITS.extrudedType), depth: 'deep', spin: 'float' },
    particleField: { kind: 'particleField', count: BLOCK_LIMITS.particles, drift: 'swarm' },
    waveMesh: { kind: 'waveMesh', swell: 'ripple', tilt: 'rake' },
    depthGrid: { kind: 'depthGrid', lines: BLOCK_LIMITS.gridLines, form: 'tunnel', travel: 'toward' },
  }

  /**
   * Nine descriptors, one table, and the coverage check comes first.
   *
   * `BLOCK_CANVASES` is the file that decides how large a GL surface is, and it
   * is the file a tenth 3D block adds a line to. A budget test that walks a
   * hand-written corpus is green for whatever the corpus forgot, which is the
   * shape of the miss this whole section is written against — so the corpus is
   * held against the descriptors AND against the permission's own list, and the
   * three have to be the same nine names.
   */
  it('measures every block that opens a renderer, and misses none', () => {
    expect(Object.keys(GL_BLOCKS).sort()).toEqual([...THREE_D_BLOCKS].sort())
    expect(Object.keys(BLOCK_CANVASES).sort()).toEqual([...THREE_D_BLOCKS].sort())
  })

  /**
   * What a set piece COSTS is bounded by the layout, and not by a sentence in a
   * prompt.
   *
   * Nine blocks in the catalogue open a renderer now, and they are the ones whose
   * waste is measured in render seconds rather than in bytes: a full-frame lit
   * solid adds about 0.9 s of render per second of film on the two-core worker,
   * against the 1.7 s/s the duration-scaled deadline leaves spare. The compose
   * prompt asks for at most one set piece in the whole film and never two fields
   * in one scene, and a prompt is a request — the schema accepts eight in one
   * scene, and a provider that ignores the advice spends somebody's deadline
   * rather than somebody's taste.
   *
   * It used to be able to. The canvas was a share of the FRAME, so eight of them
   * were eight full-size canvases: 4712 px of content inside 950 px of safe
   * height, and a GL bill that grew with the block count with nothing capping it.
   * Now the canvas is a share of the block's OWN box, and that changes the
   * question from editorial to arithmetic:
   *
   *   - a canvas is at most its own box, whatever shape the descriptor answers —
   *     a square on the minor axis for the round ones, the box itself for a
   *     picture, a share of it for a chart that leaves room for captions, and a
   *     capped `FIELD_PIXEL_BUDGET` for the three fields;
   *   - the boxes of a zone tile that zone and never overlap (`stackIn`), and the
   *     ten zones are the nine cells — which tile the safe area — plus `full`,
   *     which IS the safe area.
   *
   * So whatever a document asks for, one frame of it draws at most twice the safe
   * area of GL. The prompt's sentence is then about attention, which is what a
   * prompt can actually be trusted with.
   *
   * The MIXED arrangement is the one no prose bounds at all. "One set piece per
   * film" and "never two fields in one scene" are two sentences about two
   * families, and a model shown nine expensive blocks writes a scene holding one
   * of each — which breaks neither sentence and is precisely the document the
   * deadline has to survive.
   */
  it('bounds what a stack of set pieces can ask a renderer to draw', () => {
    const cells = ANCHORS.filter((anchor) => anchor !== 'full')
    const kinds = Object.keys(GL_BLOCKS)
    const arrangements = {
      // The three shapes that matter: everything piled in one cell, everything
      // spread across the grid, and the one that used to be unbounded — a stack
      // of eight fields, each of which used to take the whole frame.
      'one zone': Array.from({ length: BLOCK_LIMITS.layersPerScene }, () => 'center'),
      'every cell': cells.slice(0, BLOCK_LIMITS.layersPerScene),
      'a field and a grid': ['full', ...cells.slice(0, BLOCK_LIMITS.layersPerScene - 1)],
      'eight fields': Array.from({ length: BLOCK_LIMITS.layersPerScene }, () => 'full'),
    }

    // Each kind on its own, and then all nine at once in the arrangement that
    // spreads them: a scene of one kind is what a prompt talks about, a scene of
    // nine is what a model actually writes.
    const corpora = [
      ...kinds.map((kind) => [kind, () => GL_BLOCKS[kind]]),
      ['one of each', (i) => GL_BLOCKS[kinds[i % kinds.length]]],
    ]

    for (const [corpus, pick] of corpora) {
      for (const [label, anchors] of Object.entries(arrangements)) {
        const build = (durationMs) => ({
          template: 'composed',
          scenes: [{ durationMs, layers: anchors.map((anchor, i) => ({ ...pick(i), anchor })) }],
        })
        for (const { aspectRatio, width, height, plan } of films(build, 6000)) {
          const safe = composedSafeArea(width, height)
          const base = frameBase(width, height)
          let drawn = 0
          for (const zone of composedLayout(plan.scenes[0].scene, width, height).zones) {
            for (const { block, box, unit } of zone.layers) {
              const canvas = blockCanvas(block, box, base, unit)
              expect(canvas, `${corpus} · ${label} · ${block.kind} has a descriptor`).not.toBe(null)
              const pixels = canvas.width * canvas.height
              // The per-block claim, which is the one with content in it: a set
              // piece cannot draw outside the box it was given, so N of them cost
              // no more than the frame does. Rounded up to a whole backing store,
              // so a box under a pixel wide is not a failure — `blockCanvas`
              // floors at one on purpose, because a GL context of zero pixels
              // fails to initialise and takes the frame with it (Q1).
              expect(pixels, `${corpus} · ${label} · ${aspectRatio} · one ${block.kind} canvas`).toBeLessThanOrEqual(
                Math.max(1, Math.ceil(box.width) * Math.ceil(box.height)),
              )
              drawn += pixels
            }
          }
          // And the whole scene, which is that claim summed over a layout that
          // tiles: the nine cells cover the safe area once and `full` covers it
          // again.
          expect(drawn, `${corpus} · ${label} · ${aspectRatio} · the whole scene`).toBeLessThanOrEqual(
            2 * safe.width * safe.height,
          )
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
