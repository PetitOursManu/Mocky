// What Node and the bundled compositions both have to agree on: the composition
// id, the output geometry, and the arithmetic that turns a VideoTimeline into a
// frame layout.
//
// It is a separate file from the components for one mechanical reason:
// `render.js` runs in Node and has to name the composition it wants, while
// `Root.jsx` and `ImageSequenceVideo.jsx` are compiled by Remotion's bundler.
// Node cannot import a `.jsx` file, so putting the id next to the component
// would force `render.js` to hard-code the string 'ImageSequenceVideo' — and a
// composition renamed on one side and not the other fails at render time,
// inside a container, as "No composition with the ID … found".
//
// The second reason arrived with the real composition, and it is the one that
// matters now: everything below is arithmetic, and arithmetic is the only part
// of a video that can be checked without producing one. `composition.test.js`
// runs inside Mocky's own vitest suite, where Remotion is not installed — which
// works only as long as this file imports neither `remotion` nor React. Do not
// move the layout maths into the JSX; it becomes untestable the moment it lands
// there.

/**
 * 30 fps, everywhere, deliberately not configurable.
 *
 * The timeline schema has no fps field, so an option here would be one the
 * model cannot reach and the user cannot see — and 60 fps doubles the number of
 * Chromium screenshots for a slideshow of stills that changes nothing anyone
 * can perceive. The render budget is 110 s on a two-core container; frames are
 * the currency it is spent in.
 */
export const FPS = 30

/**
 * Output geometry per aspect ratio. 1080p on the long edge in all three cases,
 * because a portrait export destined for a phone and a landscape one destined
 * for a laptop are the same amount of picture rotated, and picking 1080p only
 * for `16:9` would make `9:16` quietly the low-quality option.
 */
export const DIMENSIONS = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
}

/** The one composition the worker can render. `render.js` selects by this id. */
export const IMAGE_SEQUENCE = { id: 'ImageSequenceVideo' }

/**
 * How long a transition runs, at most.
 *
 * "At most" because it is also capped per pair below. Half a second is the
 * length at which a crossfade reads as intentional rather than as a dropped
 * frame, and short enough that it does not become the thing the viewer watches.
 */
export const TRANSITION_MS = 500

/**
 * A transition may never eat more than this fraction of the shorter of the two
 * scenes it joins — a third.
 *
 * The bound is reachable, not theoretical: the schema's minimum scene is 1000 ms
 * (30 frames), and an uncapped 500 ms transition on both sides of such a scene
 * would leave zero frames of it standing on its own. The result is a video in
 * which no image is ever actually shown, produced from a timeline every
 * validator accepted.
 */
export const MAX_TRANSITION_SHARE = 3

/**
 * Ken Burns amplitudes, kept small on purpose.
 *
 * 1.0 → 1.12 over a whole scene is a drift the eye reads as life rather than as
 * movement. Anything past roughly 1.2 turns a slideshow into something nobody
 * can watch twice, and the model picks the effect per scene without ever seeing
 * the result — so the ceiling has to live here, not in the prompt.
 *
 * A pan needs the same overscale for a different reason: translating an image
 * that exactly fills the frame drags the background in behind it. PAN_SCALE
 * leaves 6% of margin on each side, and PAN_SHIFT_PERCENT stays under it — the
 * shift is applied before the scale in the transform list, so the visible travel
 * is 4% × 1.12 = 4.48%, still inside the margin.
 */
export const KEN_BURNS_ZOOM = 0.12
export const PAN_SCALE = 1.12
export const PAN_SHIFT_PERCENT = 4

/**
 * Output geometry for an aspect ratio.
 *
 * Throws rather than falling back to 16:9. A ratio this file does not know is a
 * timeline the validator should already have refused, and a silent fallback
 * would hand back a landscape video to someone who asked for a portrait one and
 * call it a success — the exact failure `.strict()` exists to prevent one layer
 * up.
 */
export function dimensionsFor(aspectRatio) {
  // `Object.hasOwn`, not `DIMENSIONS[aspectRatio]`, and the difference is the
  // difference between throwing and not: a plain lookup answers for the whole
  // prototype chain, so `aspectRatio: "constructor"` hands back a function, the
  // `!dimensions` test passes it, and the composition is registered with
  // `width: undefined`. The promise this function makes above is that an unknown
  // ratio throws; an own key is the only thing that counts as known.
  if (typeof aspectRatio !== 'string' || !Object.hasOwn(DIMENSIONS, aspectRatio)) {
    throw new Error(`Unknown aspect ratio "${aspectRatio}"; this worker renders ${Object.keys(DIMENSIONS).join(', ')}.`)
  }
  return DIMENSIONS[aspectRatio]
}

/**
 * Milliseconds to frames, rounded DOWN.
 *
 * Down, not to nearest, and the difference is the whole-timeline ceiling. The
 * schema refuses more than 120 000 ms of scenes; rounding each scene to nearest
 * lets twenty of them add up to 3610 frames, which is 120.33 s — a render longer
 * than the limit that was supposed to bound it. `floor` is subadditive, so the
 * sum of the parts can never exceed the floor of the whole, and the cost is at
 * most one frame per scene.
 *
 * The `max(1, …)` guard is for input this function should never see: a scene of
 * zero frames is a Sequence Remotion refuses, and failing on the arithmetic
 * rather than inside Chromium is worth one comparison.
 */
export function msToFrames(ms) {
  return Math.max(1, Math.floor((Number(ms) * FPS) / 1000))
}

/**
 * A VideoTimeline as a frame layout: where each scene starts, how long it
 * lasts, and how much it overlaps the one before it.
 *
 * The overlap is the load-bearing idea. A transition bites into the END of the
 * outgoing scene and the START of the incoming one; it is never added to the
 * running time. A transition that appended its own duration would make the
 * schema's 120 s ceiling a lie by up to nineteen half-seconds, and the queue's
 * 120 s job timeout would start killing exports that validated cleanly.
 *
 * Which also explains the field names: `transitionOut` belongs to the scene that
 * leaves, but it is the scene that ARRIVES which animates — it fades or wipes in
 * on top of its predecessor. So scene i carries the transition declared by
 * scene i-1, under `enterTransition`.
 *
 * @param {{scenes: Array<object>, aspectRatio?: string}} timeline
 */
export function planTimeline(timeline) {
  const scenes = Array.isArray(timeline?.scenes) ? timeline.scenes : []
  if (scenes.length === 0) {
    throw new Error('A timeline needs at least one scene; this one has none.')
  }
  const { width, height } = dimensionsFor(timeline?.aspectRatio ?? '16:9')
  const budget = Math.max(1, Math.floor((TRANSITION_MS * FPS) / 1000))

  const durations = scenes.map((scene) => msToFrames(scene.durationMs))
  const overlaps = scenes.map((scene, i) => {
    // The last scene has nothing to transition into. Its `transitionOut` is
    // still whatever the model wrote — the schema defaults it to 'crossfade' —
    // and honouring it would mean fading the end of the video into the
    // background, which is a different feature nobody asked for.
    if (i === scenes.length - 1) return 0
    if ((scene.transitionOut ?? 'crossfade') === 'none') return 0
    const shorter = Math.min(durations[i], durations[i + 1])
    return Math.max(0, Math.min(budget, Math.floor(shorter / MAX_TRANSITION_SHARE)))
  })

  let cursor = 0
  const planned = scenes.map((scene, i) => {
    const entry = {
      imageId: scene.imageId,
      kenBurns: scene.kenBurns ?? 'static',
      textOverlay: scene.textOverlay ?? null,
      from: cursor,
      durationInFrames: durations[i],
      enterTransition: i === 0 ? 'none' : (scenes[i - 1].transitionOut ?? 'crossfade'),
      enterFrames: i === 0 ? 0 : overlaps[i - 1],
    }
    cursor += durations[i] - overlaps[i]
    return entry
  })

  // `cursor` has accumulated Σ(duration − overlap), and the last overlap is
  // always 0, so it is exactly where the final scene ends.
  return { fps: FPS, width, height, totalFrames: cursor, scenes: planned }
}
