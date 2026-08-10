// Which blocks of the catalogue are DRAWN IN 3D, and what a document made of
// them costs an account that may not have them.
//
// This exists as its own file, and not as two more constants in `config.js` or
// `timeline.js`, because it is the one fact three unrelated places have to agree
// on: `compose.js` decides what to OFFER, `routes.js` decides what to ACCEPT,
// and `worker/video/remotion/ComposedSceneVideo.jsx` decides what to WRAP in a
// GL canvas. Written in each of them it would be three lists, and the one that
// drifts is the one nobody tests — which here means a block quietly offered to
// an account the administrator excluded.
//
// It is deliberately NOT in `server/video/timeline.js`. That file is a hand-kept
// mirror of `src/lib/video/timeline.ts` held together by a corpus test, and
// three-dimensionality is not a fact about the SCHEMA: every 3D block is
// validated by exactly the same bounded integers and closed enums as a heading,
// which is rule 1 of this feature and the reason a 3D capability costs the
// founding rule nothing. What makes a block three-dimensional is its RENDERER,
// and the renderer lives in the worker.
import { BLOCK_KINDS } from './timeline.js'

/**
 * The blocks whose component returns react-three-fiber intrinsics.
 *
 * A NAMED list rather than a derived one, because nothing in the zod schema can
 * be asked the question: `solidScene` differs from `barChart` in what draws it,
 * not in what validates it. So the list is guarded from both ends instead —
 * `tests/video-3d-permission.test.js` requires every name here to be a real
 * block kind, and requires every block component that renders an r3f intrinsic
 * to be named here. The second direction is the one that matters: a 3D block
 * added to the catalogue and forgotten in this file is a block the permission
 * does not cover, offered to everybody, which is exactly the failure this
 * feature was asked to prevent.
 */
export const THREE_D_BLOCKS = [
  'globe',
  'solidChart',
  'photoStage',
  'photoRing',
  'solidScene',
  'extrudedType',
  // The three FIELDS. They are here for the same reason as the six above and
  // one more: a field is what a scene is painted on, so it is the kind a model
  // reaches for most readily — an account that may not spend a 3D render would
  // otherwise meet the refusal on the block it asked for least deliberately.
  'particleField',
  'waveMesh',
  'depthGrid',
]

const THREE_D = new Set(THREE_D_BLOCKS)

/** The rest of the catalogue: what a film can still be made of. */
export const FLAT_BLOCKS = BLOCK_KINDS.filter((kind) => !THREE_D.has(kind))

/** Whether one block kind is drawn in 3D. */
export const isThreeDBlock = (kind) => THREE_D.has(kind)

/**
 * The 3D blocks a document actually carries, in the order the catalogue lists
 * them, deduplicated.
 *
 * Shaped like `timelineImageIds` and used the same way: it walks scenes and
 * layers rather than trusting a `template` field, because a document arriving at
 * `POST /render` need never have passed through `/compose` — that is the whole
 * reason this check is on the route and not in the panel. A film that names no
 * template at all is a slideshow and has no `layers`, so it answers `[]` without
 * a special case.
 *
 * @param {object|null|undefined} timeline a document already accepted by the schema
 * @returns {string[]} block kinds, or an empty array
 */
export function threeDBlocksIn(timeline) {
  const found = new Set()
  for (const scene of timeline?.scenes || []) {
    for (const layer of scene?.layers || []) {
      if (typeof layer?.kind === 'string' && THREE_D.has(layer.kind)) found.add(layer.kind)
    }
  }
  // Catalogue order, not encounter order: the sentence built from this is read
  // by a person, and two identical refusals that list the same two blocks in
  // different orders read as two different problems.
  return THREE_D_BLOCKS.filter((kind) => found.has(kind))
}

/**
 * How many 3D blocks one SCENE may stack.
 *
 * This is the bound that keeps a 3D film renderable at all, and it exists
 * because the number written everywhere else was wrong by a factor of four.
 *
 * Measured in the worker container (two cores, RENDER_CONCURRENCY=2, 1080p30):
 * a flat film renders at 1.78 s of wall clock per second of film; a film whose
 * scenes carry THREE 3D blocks renders at 6.68. The deadline grants 6 (see
 * `jobBudgetMs`), so that film is killed at about 90% of the way through —
 * after twelve minutes of somebody watching a spinner. Two blocks fit: the fit
 * is linear in the number of blocks on screen, 1.78 + 2 × 1.63 = 5.04 against 6.
 *
 * Per SCENE and not per film, because the cost is per FRAME: eight scenes each
 * carrying one solid cost what one scene carrying one solid costs, while one
 * scene carrying eight costs eight times as much. A per-film cap would refuse
 * the cheap film and accept the expensive one.
 *
 * The margin is thin on purpose and it is thin in the SAFE direction: the
 * measurement above comes from a host whose software GL rasteriser is about
 * 2.3× slower than the one the original +0.9 s/s figure was taken on. An
 * operator with hardware acceleration has far more room; one with less than
 * this host has a worker that gives up with a message naming the machine, which
 * is the failure this bound is trying to spare a user, not the one it can
 * eliminate.
 */
export const MAX_THREE_D_LAYERS = 2

/**
 * The most 3D blocks any single scene stacks — what the render actually costs.
 *
 * Zero for a film that carries none, including a document with no `layers` at
 * all, which is every one of the five original templates.
 */
export function threeDLoadOf(timeline) {
  let worst = 0
  for (const scene of timeline?.scenes || []) {
    let here = 0
    for (const layer of scene?.layers || []) {
      if (typeof layer?.kind === 'string' && THREE_D.has(layer.kind)) here += 1
    }
    if (here > worst) worst = here
  }
  return worst
}

/**
 * The refusal for a film that stacks more 3D than one can render.
 *
 * It names the arithmetic rather than the rule, because "at most two" read on
 * its own sounds arbitrary and invites somebody to raise it. And it says what
 * to do — spreading the same blocks across scenes costs nothing, which is the
 * part a person cannot guess from a bare limit.
 */
export function threeDLoadRefusal(load, consequence) {
  return (
    `One scene of this film stacks ${load} blocks drawn in 3D, and ${MAX_THREE_D_LAYERS} is the most a scene ` +
    `can carry. Rendering 1080p in a headless browser costs about 1.6 seconds per second of film for each 3D ` +
    `block on screen, and past ${MAX_THREE_D_LAYERS} the film cannot finish inside its own deadline. Spreading ` +
    `them over separate scenes costs nothing — the price is per frame, not per film. ${consequence}`
  )
}

/**
 * The refusal, for both doors.
 *
 * One sentence in one place because the module's rule is that a refusal NAMES
 * WHAT IS STILL POSSIBLE and never says a bare no — `compose.js` says that about
 * a picture-bearing film over an empty selection, and a permission is the case
 * where a bare no is most tempting and least useful. The person reading this did
 * not choose the blocks; a model did, from a catalogue an administrator narrowed
 * after the fact. So the sentence says who to ask AND what to ask for instead,
 * and the count comes from `FLAT_BLOCKS` rather than from prose, so it cannot
 * drift when the catalogue grows.
 *
 * @param {string[]} used  the 3D blocks in the document, or [] when the caller
 *   is refusing a REQUEST for 3D rather than a document that already carries it
 * @param {string} consequence  what did not happen, in the tense of the route
 */
export function threeDRefusal(used, consequence) {
  const subject = used.length
    ? `This film is composed with ${used.join(', ')}, which ${used.length > 1 ? 'are' : 'is'} drawn in 3D.`
    : 'A 3D film was asked for.'
  return (
    // "about a fifth more" was here until the cost was measured rather than
    // assumed: one 3D block on screen roughly DOUBLES the render, and the doc
    // that said +0.9 s/s was out by a factor of four. A refusal that
    // understates why it exists is one an administrator waves through.
    `${subject} 3D rendering is not enabled for this account on this instance — one 3D block roughly doubles ` +
    `the render time of a film, so an administrator grants it per account. Ask for it, or compose the same ` +
    `film without it: the other ${FLAT_BLOCKS.length} blocks and every ground are available. ${consequence}`
  )
}
