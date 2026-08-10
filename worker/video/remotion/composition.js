// What Node and the bundled compositions both have to agree on: the composition
// ids, the output geometry, the theme tokens, and the arithmetic that turns a
// VideoTimeline into a frame layout.
//
// It is a separate file from the components for one mechanical reason:
// `render.js` runs in Node and has to name the composition it wants, while
// `Root.jsx` and the five `.jsx` files are compiled by Remotion's bundler. Node
// cannot import a `.jsx` file, so putting an id next to its component would
// force `render.js` to hard-code the string 'ImageSequenceVideo' — and a
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
//
// The catalogue made that rule bite. Five compositions share one notion of a
// frame layout, one notion of an entrance, one notion of a cue, and one notion
// of a theme; four copies of any of them would drift, and the copy that drifted
// would be discovered by watching an mp4. So `entranceStyle`, `kenBurnsTransform`
// and `progressAt` live HERE rather than in the component that used to own them
// — they are clamped linear interpolation and string building, not rendering,
// and Remotion's own `interpolate` was the only thing keeping them out of a test.

// ── THE RULE EVERY BLOCK IS WRITTEN TO: it inhabits the box it is given ──────
//
// A composed scene hands each block a BOX, and the block dimensions everything it
// draws on that box. Not on the frame. The defect that made this a rule was in
// six real exports, in every one of the twenty-seven blocks, and it looked like
// arithmetic rather than like a mistake: `equalizer` drew `base * 0.18`, a
// fraction of the frame's short edge, whether it had been anchored `center` or
// `full`. A field that occupies 18% of the height is not a field. A `typewriter`
// alone in a scene was one small line of text in the middle of a black frame; a
// `counter` alone was an eighth of the picture. Twenty-seven blocks each drew a
// fixed fraction of the FRAME, so every scene was a small element floating in a
// large void — which is what the user had been calling "rudimentary" from the
// first export onwards, and he was right.
//
// So: a block that is given half the frame fills half the frame. Concretely —
//
//   1. `composedLayout` publishes one box PER BLOCK (`zone.layers[i].box`), never
//      the zone's box repeated. A zone shared by three blocks is three boxes; a
//      stack of two is two boxes, one above the other.
//   2. Every size a block draws is derived from that box: through `blockExtent`
//      for its outer dimensions, through the shared type unit for its type.
//   3. **The one legitimate use of the FRAME's own dimension is a constant
//      metric**: a quantity that must not change from one scene to the next
//      because it is the same object in both. There are exactly three, they are
//      named in `CONSTANT_METRICS`, and each is bounded — see the note there.
//   4. And the box is not the only bound on the type. A run's longest WORD is
//      the other one (`wordCeiling`), because a word does not break and a size
//      that assumes it does is the `NEUF S` / `EIZIEME` / `S` a frame showed.
//      It has a floor, and under the floor the block goes back to filling its
//      box — the one place where "inhabit your box" and "keep the word whole"
//      cannot both hold, decided in favour of the box.
//
// `composition.test.js` holds the rule rather than this comment: `blockExtent` is
// pure, so doubling a box has to double every dimension a block draws (the three
// constants aside), and the content of a box has to fill a stated fraction of it.
// A rule a test cannot ask about is a rule that lasts until the next block.

// The contrast arithmetic is next door rather than here, for the reason this
// file exists at all: it is a hand-kept mirror of `src/lib/audit/colors.ts` and
// `contrast.test.js` holds the two together. Mixing it into this file would put
// a mirrored formula in the middle of code that has no twin, where the next
// reader has no way to tell which half must not be edited alone.
import {
  CONTRAST_MIN,
  CONTRAST_MIN_LARGE,
  blend,
  channels,
  contrastRatio,
  relativeLuminance,
} from './contrast.js'

export { CONTRAST_MIN, CONTRAST_MIN_LARGE, blend, contrastRatio, relativeLuminance }

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

/**
 * The template a document names → the composition that draws it.
 *
 * This map IS the catalogue, on this side of the wire. `render.js` selects by
 * the id it returns and `Root.jsx` registers exactly these five, so a template
 * with no entry here cannot be reached by any route into this process — the same
 * shape the timeline schema has on the Mocky side: what cannot be named cannot
 * be asked for.
 *
 * The ids are deliberately not the template names. A composition id is a string
 * Remotion resolves inside a bundle; a template is a word in a contract two
 * services share. Spelling them the same would let a renamed component change
 * that contract by accident, and `x-mocky-worker-composition` exists precisely
 * so a reader can tell which of the two they are looking at.
 */
export const COMPOSITIONS = {
  slideshow: 'ImageSequenceVideo',
  overlay: 'OverlayBandVideo',
  vertical: 'VerticalStoryVideo',
  titles: 'AnimatedTitlesVideo',
  product: 'ProductSpotlightVideo',
  // One composition for the composable variant, and twenty-four components under
  // `blocks/` that it lays out. The catalogue did not grow a sixth LOOK; it grew
  // a look that is a combination, and this entry is where the two meet.
  composed: 'ComposedSceneVideo',
}

/**
 * The composition for a template, or a throw.
 *
 * Absent means `slideshow`, the same default the schema and `validate.js` both
 * apply, because documents composed before the catalogue existed carry no
 * template at all and come straight out of the queue's journal after a restart.
 *
 * `Object.hasOwn` and not a plain lookup, for the reason `dimensionsFor` spells
 * out below: `template: "constructor"` answers with a function off the prototype
 * chain, and a function handed to `selectComposition` as an id fails inside
 * Chromium with a message about a bundle rather than about a template.
 */
export function compositionIdFor(template) {
  const name = template === undefined || template === null ? 'slideshow' : template
  if (typeof name !== 'string' || !Object.hasOwn(COMPOSITIONS, name)) {
    throw new Error(
      `No composition for template "${String(template)}"; this worker renders ${Object.keys(COMPOSITIONS).join(', ')}.`,
    )
  }
  return COMPOSITIONS[name]
}

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
 * The scene itself is carried WHOLE, under `scene`, rather than having its
 * fields copied onto the entry. Five templates have five scene kinds — one has
 * no image at all — and a plan that listed them would be a sixth place to edit
 * whenever the schema grows. Keeping `transitionOut` inside `scene` also keeps
 * it away from `enterTransition` next door: they are one field apart and mean
 * opposite ends of a scene, and the plan is where that confusion would cost a
 * whole timeline played one transition late.
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
      scene,
      from: cursor,
      durationInFrames: durations[i],
      // The kicker's text, decided here because it is a fact about the FILM and
      // not about the scene: `03 / 08` needs the total, which no scene carries,
      // and it is EMPTY on a one-scene film because `01 / 01` is a counter with
      // nothing to count.
      //
      // It travels on the plan so that the composition which draws it and
      // `sceneMotion`, which decides whether to report its arrival at all, read
      // the same value. Computed twice, they disagreed: every one-scene film
      // reported a `kicker` progress for a kicker no frame contained — a number
      // that moves while the picture does not, which is the one thing the rule
      // above this section forbids.
      label: sceneLabel(i, scenes.length),
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

// ── Interpolation, without Remotion ──────────────────────────────────────────

/**
 * How far through a span of frames, from 0 to 1, clamped at both ends.
 *
 * This is `interpolate(frame, [0, span], [0, 1], { extrapolate: 'clamp' })` with
 * the import removed, and the import is the whole point: Remotion's version is
 * only reachable from a `.jsx` file inside a bundle, which is where the easing
 * of five compositions would have gone to stop being tested.
 *
 * Clamped at both ends because the last scene of a timeline is rendered one
 * frame past its own length in some Remotion versions, and an unclamped
 * extrapolation there produces a single frame that jumps — a defect that only
 * ever appears in the exported file, never in a preview.
 */
export function progressAt(frame, span) {
  const length = Number(span)
  if (!Number.isFinite(length) || length <= 0) return 1
  const at = Number(frame)
  if (!Number.isFinite(at)) return 0
  return Math.min(1, Math.max(0, at / length))
}

/**
 * The house curve: fast out of the gate, settling onto its mark.
 *
 * Every entrance Mocky renders in a browser eases — `Animate.ts` gives each of
 * its presets `ease: 'easeOut'`, and `CountUp` walks an easeOutCubic — while
 * every entrance this worker rendered was linear, because `progressAt` was
 * written for a Ken Burns drift and then reused for arrivals. A linear fade
 * enters and stops at the speed it travelled, which nothing physical does, and
 * it is the single thing that most makes a title sequence read as generated. Nine
 * frames of it is a title that blinks; nine frames eased is a title that lands.
 *
 * Cubic and not a spring: an overshoot burnt into 30 fps over a nine-frame
 * entrance is one or two frames past the mark, which reads as a wobble rather
 * than as bounce. There is no second curve here for the same reason there is one
 * transition length — a catalogue of easings is five compositions disagreeing.
 */
export function easeOutCubic(t) {
  const at = Number(t)
  if (!Number.isFinite(at)) return 0
  const clamped = Math.min(1, Math.max(0, at))
  return 1 - (1 - clamped) ** 3
}

/**
 * How far a cued element has arrived, from 0 before its cue to 1 once it has
 * landed — eased, and clamped by `progressAt` at both ends.
 *
 * One function so that "an element arrives" means the same thing in all five
 * compositions. The span is an argument rather than a constant because one
 * element per scene is allowed to take longer than the rest: that is what makes
 * a cascade a rhythm instead of a metronome, and it is bounded by
 * `MIN_CUE_TAIL_FRAMES` — a cue is never placed with less than that much scene
 * left, so an entrance no longer than it always finishes inside its own scene.
 */
export function cueProgress(frame, cue, span = CUE_ENTER_FRAMES) {
  return easeOutCubic(progressAt(Number(frame) - Number(cue), span))
}

/**
 * The Ken Burns move for one scene, as a CSS transform.
 *
 * Unknown kinds answer `none` rather than throwing: this runs once per frame
 * inside Chromium, and the value is validated twice before it arrives. A throw
 * here would turn a bad enum into a failed render half a minute in, where the
 * validator would have named the field in a 400.
 */
export function kenBurnsTransform(kind, frame, durationInFrames) {
  const progress = progressAt(frame, Math.max(1, durationInFrames - 1))
  switch (kind) {
    case 'zoom-in':
      return `scale(${1 + KEN_BURNS_ZOOM * progress})`
    case 'zoom-out':
      return `scale(${1 + KEN_BURNS_ZOOM * (1 - progress)})`
    // The picture drifts towards the side it is named after. The other reading —
    // the camera pans left, so the subject slides right — is just as defensible,
    // which is why it is written down here rather than left to whoever reads the
    // switch next.
    case 'pan-left':
      return `scale(${PAN_SCALE}) translateX(${PAN_SHIFT_PERCENT * (1 - 2 * progress)}%)`
    case 'pan-right':
      return `scale(${PAN_SCALE}) translateX(${PAN_SHIFT_PERCENT * (2 * progress - 1)}%)`
    default:
      return 'none'
  }
}

/**
 * How a scene arrives on top of the one it replaces, as a style object.
 *
 * Only the INCOMING scene animates. A crossfade in which both sides move — the
 * old one fading out while the new one fades in — dips through the background at
 * its midpoint, so a film on a dark canvas blinks once per transition. Fading
 * the newcomer in over a predecessor that stays opaque is the same effect
 * without the blink, and it works identically for a wipe, where the arriving
 * frame is simply clipped.
 *
 * The scene order in the DOM is the paint order, so "on top" needs nothing but
 * rendering the scenes in the order the timeline lists them.
 */
export function entranceStyle(kind, frame, enterFrames) {
  if (!enterFrames || kind === 'none') return null
  const progress = progressAt(frame, enterFrames)
  const hidden = (1 - progress) * 100
  switch (kind) {
    case 'crossfade':
      return { opacity: progress }
    // `inset()` reads top / right / bottom / left. A shrinking LEFT inset
    // uncovers the frame from its right edge, so the revealing edge travels
    // leftwards — which is what "wipe-left" names.
    case 'wipe-left':
      return { clipPath: `inset(0 0 0 ${hidden}%)` }
    case 'wipe-right':
      return { clipPath: `inset(0 ${hidden}% 0 0)` }
    case 'pixel':
      return pixelMask(progress)
    default:
      return null
  }
}

/**
 * How many cells across a `pixel` dissolve is, as a percentage of each edge.
 *
 * 5% is twenty cells on the long edge and, on a 16:9 frame, blocks of 96×54 —
 * coarse enough to read as pixels at a glance and fine enough that the reveal is
 * not four squares. Percentages and not pixels because `entranceStyle` is handed
 * a frame count and never a frame size, which is deliberate: a transition that
 * had to know the geometry would be a transition with a different amplitude in
 * each of the three ratios.
 */
export const PIXEL_CELL_PERCENT = 5

/**
 * A grid of squares growing out of nothing — the mosaic dissolve.
 *
 * Two repeating gradients, one per axis, intersected: each on its own is a set of
 * stripes, and their intersection is a grid of squares whose side grows with the
 * progress. `mask-composite: intersect` is what performs the intersection, and
 * the degradation if a renderer ignores it is deliberately harmless — the two
 * masks then ADD, which is a grid of crosses rather than squares, still hidden at
 * 0 and still fully opaque at 1. A transition that could leave the last frame of
 * a scene partly masked would be a hole in the middle of a film.
 *
 * `-webkit-` alongside the standard property because Chromium still answers to
 * both, and this string is only ever read by one browser in one container.
 */
function pixelMask(progress) {
  const cell = PIXEL_CELL_PERCENT
  const filled = Math.max(0, Math.min(1, progress)) * cell
  const stripe = (direction) =>
    `repeating-linear-gradient(${direction}, #000 0 ${filled}%, transparent ${filled}% ${cell}%)`
  const mask = `${stripe('to right')}, ${stripe('to bottom')}`
  return {
    maskImage: mask,
    WebkitMaskImage: mask,
    maskComposite: 'intersect',
    WebkitMaskComposite: 'source-in',
  }
}

/**
 * A block's anchor as the flex cell it lands in.
 *
 * Nine zones and the whole frame, and the zone is a CELL rather than a
 * coordinate: two blocks anchored to the same zone stack inside it, in the order
 * the document lists them. That is what lets `anchor` default to `center` without
 * anything landing on top of anything, and it is the line the composable variant
 * is drawn on — the model says which corner, the composition says where the
 * corner is and what happens when two things want it.
 *
 * `Object.hasOwn` for the reason `overlayAlignment` gives: a plain lookup answers
 * for the prototype chain, and `anchor: "constructor"` would put a function in
 * `justifyContent`.
 */
const ANCHOR_CELLS = {
  'top-left': { row: 'flex-start', column: 'flex-start' },
  'top-center': { row: 'flex-start', column: 'center' },
  'top-right': { row: 'flex-start', column: 'flex-end' },
  'center-left': { row: 'center', column: 'flex-start' },
  center: { row: 'center', column: 'center' },
  'center-right': { row: 'center', column: 'flex-end' },
  'bottom-left': { row: 'flex-end', column: 'flex-start' },
  'bottom-center': { row: 'flex-end', column: 'center' },
  'bottom-right': { row: 'flex-end', column: 'flex-end' },
  // The one that is not a cell: a block that fills the frame, for the things that
  // are a field rather than an element — a map, a wave, a gallery.
  full: { row: 'stretch', column: 'stretch' },
}

/** The nine zones and the whole frame, in the schema's own order. */
export const ANCHORS = Object.keys(ANCHOR_CELLS)

/**
 * The zone a value names, or `center`.
 *
 * One normalisation, read by `anchorCell` and by `composedLayout`. Two of them is
 * a block whose alignment says one corner and whose box says another — the kind
 * of disagreement that only shows up on the one anchor nobody wrote a fixture
 * for.
 */
export function anchorName(anchor) {
  return typeof anchor === 'string' && Object.hasOwn(ANCHOR_CELLS, anchor) ? anchor : 'center'
}

export function anchorCell(anchor) {
  return ANCHOR_CELLS[anchorName(anchor)]
}

/** Where a `textOverlay` box sits in the frame. */
const OVERLAY_ALIGNMENT = { top: 'flex-start', center: 'center', bottom: 'flex-end' }

/**
 * The alignment for a position, and `center` for anything else.
 *
 * `Object.hasOwn` rather than `OVERLAY_ALIGNMENT[position] || 'center'`: a plain
 * lookup answers for the prototype chain, so `position: "constructor"` returns a
 * function — truthy, so the fallback never fires, and a function is what lands
 * in `justifyContent`. The value is validated twice before it gets here; this is
 * the line that makes "read the props as hostile" actually true.
 */
export function overlayAlignment(position) {
  return typeof position === 'string' && Object.hasOwn(OVERLAY_ALIGNMENT, position)
    ? OVERLAY_ALIGNMENT[position]
    : 'center'
}

// ── Cues: when the nth piece of text arrives ─────────────────────────────────

/**
 * The gap between two elements of a cascade, in frames — 200 ms at 30 fps.
 *
 * Long enough that a title and its subtitle read as two arrivals rather than
 * one, short enough that a viewer is not waiting for the second one.
 */
export const CUE_STEP_FRAMES = 6

/** How long one element takes to arrive: 300 ms of fade and rise. */
export const CUE_ENTER_FRAMES = 9

/**
 * How much of a scene must remain AFTER its last element has arrived.
 *
 * Half a second, and it is the reason `cueFrames` compresses instead of simply
 * adding up. A product scene may be 3000 ms — 90 frames — and carry a headline,
 * three arguments and a call to action; five cues at a comfortable 300 ms each
 * would put the call to action on screen for the final two frames, or past the
 * end of the scene entirely. Text that arrives after its scene has finished is
 * a film missing the line it was cut to deliver, rendered and reported as a
 * success.
 */
export const MIN_CUE_TAIL_FRAMES = 15

/**
 * The extra beat before the LAST element of a cascade, in frames — 400 ms.
 *
 * A call to action that arrives one even step after the third argument is read
 * as a fourth argument. The pause is what turns it into a conclusion, and it is
 * the only thing that does: it cannot be said with size, since the pill is
 * already the loudest object on the card, and it cannot be said with a colour it
 * already has.
 */
export const CUE_TAIL_GAP_FRAMES = 12

/**
 * The frame each element of a cascade arrives on.
 *
 * Evenly stepped from `offset`, then scaled down as a whole if the last one
 * would land later than `MIN_CUE_TAIL_FRAMES` before the end of the scene.
 * Scaled rather than clipped: clipping would pile the overflowing elements onto
 * one frame while the first ones kept their leisurely spacing, which reads as a
 * stutter. A scene too short for any cascade collapses to zero — everything
 * arrives at once, which is honest and still legible.
 *
 * `tailGap` adds one extra beat before the last element and nothing else, which
 * is deliberately the smallest possible way to say "and then, finally". It is
 * scaled with the rest rather than added on top of it, so a scene too short for
 * the pause loses the pause instead of losing the element — the failure
 * `MIN_CUE_TAIL_FRAMES` exists to prevent, arriving through a new option.
 */
export function cueFrames(count, durationInFrames, { step = CUE_STEP_FRAMES, offset = 0, tailGap = 0 } = {}) {
  const total = Math.max(0, Math.floor(Number(count) || 0))
  if (total === 0) return []
  // A single element has nothing to wait for: a gap before the first thing on
  // screen is dead air, not rhythm.
  const gap = total > 1 ? Math.max(0, Math.floor(Number(tailGap) || 0)) : 0
  const last = Math.max(0, Math.floor(Number(durationInFrames) || 0) - MIN_CUE_TAIL_FRAMES)
  const wanted = offset + (total - 1) * step + gap
  const scale = wanted > last ? (wanted > 0 ? last / wanted : 0) : 1
  return Array.from({ length: total }, (_, i) =>
    Math.floor((offset + i * step + (i === total - 1 ? gap : 0)) * scale),
  )
}

/**
 * The frame each block of a composed scene arrives on.
 *
 * `enter` is a RANK, not a delay, and this is the one place that reading exists.
 * Two things follow from it and both are the point of having a rank at all:
 *
 *   - **Blocks sharing a rank arrive together.** A heading and the rule under it
 *     are one arrival, and saying so costs a repeated integer rather than a
 *     millisecond somebody had to compute.
 *   - **An absent rank is the position the block was written in.** A default of
 *     zero would make every silent document a pile — everything at once — which
 *     is the `kenBurns: 'static'` mistake in another costume: an optional field
 *     is a field a model omits, so the case you get by saying nothing has to be
 *     the good one.
 *
 * The beat itself is `cueFrames`, unchanged and shared with the five templates
 * that had it first: a composed scene too short for its own cascade compresses
 * it rather than losing its last block, and a second notion of "an element
 * arrives" is the drift this whole file exists to prevent.
 */
export function layerCues(layers, durationInFrames) {
  const list = Array.isArray(layers) ? layers : []
  const ranks = list.map((layer, i) => {
    const asked = Number(layer?.enter)
    return Number.isInteger(asked) && asked >= 0 ? asked : i
  })
  const distinct = [...new Set(ranks)].sort((a, b) => a - b)
  const cues = cueFrames(distinct.length, durationInFrames, { offset: 2 })
  const byRank = new Map(distinct.map((rank, i) => [rank, cues[i]]))
  return ranks.map((rank) => byRank.get(rank) ?? 0)
}

/**
 * A word list for the templates that animate words one at a time.
 *
 * Splitting a headline on whitespace is not parsing: it is prose the user or a
 * model wrote, being laid out. I1 is about discovering names in generated SOURCE
 * with a regular expression, and it names the exemption for reading prose. Each
 * word still reaches the frame as a React child and is escaped there.
 */
export function words(text) {
  return String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * How long the element the design wants EMPHASISED takes to arrive.
 *
 * Half a second against the standard 300 ms, and the difference is the whole
 * point: a cascade in which every element enters at the same speed has a tempo
 * and no accent. One word arriving more slowly than its neighbours is the
 * cheapest stress mark in typography, and it costs no frames — the cue is where
 * it always was, only the travel is longer.
 *
 * It must not exceed `MIN_CUE_TAIL_FRAMES`, and that is an arithmetic
 * requirement rather than taste: no cue is ever placed with less than that much
 * scene left, so an entrance no longer than it is guaranteed to finish before
 * its own scene does. `composition.test.js` asserts the inequality, because the
 * day somebody makes this more generous is the day a headline's last word
 * finishes arriving after the cut.
 */
export const EMPHASIS_ENTER_FRAMES = 15

/**
 * The film's own structure, as a line of type: `03 / 08`.
 *
 * An editorial kicker needs something to say, and the alternatives were both
 * worse than this one. A schema field would be a sixth string for the model to
 * invent, translate and get wrong — and a surtitle a model wrote about a film it
 * cannot see is exactly the guessed token `theme.ts` refuses. A counter is not
 * invented: it is the timeline restating itself, it is right by construction, and
 * it gives every scene a fixed mark the eye can find.
 *
 * Empty for a single-scene film, because `01 / 01` is a counter admitting it had
 * nothing to count. The compositions render nothing at all for an empty string
 * rather than an empty box.
 */
export function sceneLabel(index, total) {
  const count = Number(total)
  const at = Number(index)
  if (!Number.isFinite(count) || !Number.isFinite(at) || count < 2 || at < 0 || at >= count) return ''
  return `${padded(at + 1)} / ${padded(count)}`
}

/**
 * One item of a list, counted: `01`, `02`, `03`.
 *
 * The marker beside a product's arguments, and the reason it is not a drawn dot
 * any more. The dot was there because `•` and `–` are not in every face and a
 * glyph this container does not have renders as a hollow box beside every
 * argument. Digits are in every face there is, and they say the thing a dot
 * cannot: that this is the second of three, rather than another line.
 *
 * Zero-padded so a list of three has three marks of the same WIDTH — an
 * enumeration whose numerals do not line up is a list that looks ragged in the
 * one place a list is supposed to look ordered.
 */
export function ordinalLabel(index) {
  const at = Number(index)
  return Number.isFinite(at) && at >= 0 ? padded(at + 1) : ''
}

/** Two digits, so a column of numerals has one width. */
function padded(n) {
  return String(Math.floor(n)).padStart(2, '0')
}

// ── The theme ────────────────────────────────────────────────────────────────

/**
 * The one font family this container actually has.
 *
 * `fonts-liberation` is installed by the Dockerfile and nothing else is. Nothing
 * in Mocky loads a webfont and this image has no egress to fetch one, so a
 * project whose direction names "Cormorant Garamond" has no such face here — and
 * a container with no matching family renders every glyph as a hollow box, burnt
 * into an mp4 nobody previewed.
 *
 * So the declared family is named FIRST and this stack follows it. That is CSS's
 * own fallback and it degrades per glyph rather than failing: an instance whose
 * image really does carry the face gets it, and every other one gets Liberation
 * Sans instead of rectangles. Never a throw — a typeface is a decoration, and
 * losing an export over one would be the wrong trade (Q1).
 */
export const INSTALLED_FONT_STACK = '"Liberation Sans", Arial, Helvetica, sans-serif'

/**
 * The same argument for the one block that needs a fixed pitch.
 *
 * `codeBlock` sets code, and code in a proportional face is code that stops
 * looking like code — the alignment is half of what makes it readable as a
 * listing rather than as a paragraph. The theme carries no monospace token and
 * never will: `ThemeFontSchema` allows ONE family name and the direction states
 * a heading and a body, so a third would be a token nobody declared.
 *
 * Liberation Mono is what `fonts-liberation` puts in the container, next to the
 * Sans this file already relies on, and the generic `monospace` closes the stack
 * so an image built without that package still sets code in something fixed
 * rather than in rectangles.
 */
export const INSTALLED_MONO_STACK = '"Liberation Mono", "DejaVu Sans Mono", Consolas, monospace'

/**
 * The look a film falls back to when the project declared nothing.
 *
 * These are the only colours in this directory that are not read from the theme,
 * and they are a choice somebody made on purpose, once, in code a reviewer read
 * — which is exactly what `theme.ts` promises on the other side when it emits
 * only the tokens a direction DECLARED and leaves the rest absent.
 *
 * It is a PAIR, and that word is the whole fix below. A ground and an ink are
 * not two independent defaults: they were chosen to be looked at together, and
 * filling one from a document while filling the other from here is how a film
 * ends up with an ink designed for paper painted on a ground designed for a
 * cinema. Two real exports were shipped that way — a dark green "Gemini 3" and a
 * dark green "Porsche 911", both on near-black, both invisible, with the call to
 * action the only legible thing on screen because it was the only element that
 * already measured its own ink.
 */
export const THEME_FALLBACK = {
  background: '#0b0b0f',
  text: '#ffffff',
  accent: '#6366f1',
  surface: '#17171f',
  radiusPx: 12,
}

/**
 * The other pair: the ground a DARK declared ink implies.
 *
 * Design documents are overwhelmingly written for a page. A direction that
 * states `#14532d` as its text colour has a light ground in mind even when it
 * never wrote one down, and `theme.ts` is right not to invent it — a guessed
 * token burnt into a film is a lie nobody can see through. What was wrong was
 * what happened next: the absent ground took the dark default, and the two
 * colours met for the first time inside an mp4.
 *
 * So the fallback is chosen by the ink instead of beside it. Same promise as
 * before — no colour is invented from the document — with the pairing decided by
 * measurement rather than by which token happened to be missing.
 */
export const PAPER_FALLBACK = {
  background: '#f7f7f4',
  text: '#101014',
  surface: '#ffffff',
}

/** The schema's own bounds, restated because this file must not trust its caller. */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const FONT_FAMILY = /^[\p{L}\p{N}][\p{L}\p{N} \-]{0,47}$/u

/**
 * A validated colour, or the fallback.
 *
 * `validate.js` already refused anything else, and this is the second lock. The
 * value is interpolated into `linear-gradient(...)` and into `rgba(...)` further
 * down, where a string is a string: the check is one comparison, and it means
 * the promise this file makes — nothing from a document becomes CSS — survives a
 * validator somebody loosens next year.
 */
function safeColor(value, fallback) {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback
}

/**
 * One declared family in front of the stack that exists.
 *
 * The quotes around the name are safe only because the charset has no quote, no
 * comma, no semicolon and no brace in it — which is the entire reason
 * `ThemeFontSchema` is written the way it is. Re-checked here for the same
 * reason `safeColor` is.
 */
export function fontStack(family) {
  return typeof family === 'string' && FONT_FAMILY.test(family)
    ? `"${family}", ${INSTALLED_FONT_STACK}`
    : INSTALLED_FONT_STACK
}

/**
 * A hex colour as `rgba()`, so a veil can be built out of a declared token.
 *
 * An unreadable colour becomes black rather than nothing. The alpha layers in
 * these compositions are what keep text legible over a photograph nobody
 * previewed, so the failure that matters is a veil that silently disappears, not
 * one that is the wrong colour.
 */
export function withAlpha(hex, alpha) {
  const [r, g, b] = channels(safeColor(hex, '#000000'))
  const a = Math.min(1, Math.max(0, Number(alpha)))
  return `rgba(${r}, ${g}, ${b}, ${Number.isFinite(a) ? a : 1})`
}

/** The two inks a composition may reach for when no theme colour can be read. */
export const INK_LIGHT = '#ffffff'
export const INK_DARK = '#101014'

/**
 * The end of the search, and it is pure black rather than `INK_DARK`.
 *
 * `#101014` is a CHOSEN near-black — the ink of `PAPER_FALLBACK`, picked because
 * a headline in absolute black on paper is harsher than anything Mocky draws in
 * a browser. That makes it the right first dark to try and the wrong last one:
 * it carries 0.005 of luminance where black carries none, which is a fifth of a
 * point of contrast, and a fifth of a point is exactly what decides a mid-tone
 * ground.
 *
 * The arithmetic is not a matter of taste. On any opaque surface, black and
 * white cross at 4.58:1 — so one of the two always clears 4.5, and a search that
 * ends in them cannot run out of options. Ending at `#101014` moves that
 * crossing to 4.36:1 and opens a band of grounds, around a relative luminance of
 * 0.19, where nothing in the list clears the bar and black would have. A sweep of
 * forty thousand random directions put 4164 runs in that band: two thirds of
 * every run this file failed to make legible, each of them missing its floor by
 * a tenth, with the answer one candidate further on.
 *
 * There is no light twin because `INK_LIGHT` is already `#ffffff`; the extreme
 * and the chosen colour are the same one at that end.
 */
export const INK_FLOOR = '#000000'

/**
 * Black or white, whichever measures better on top of a colour.
 *
 * The call to action is a filled pill in the project's accent, and an accent is
 * whatever the direction declared — a pale mint and a deep navy are both
 * plausible, and a label coloured for one is invisible on the other.
 *
 * It used to split on a relative luminance of 0.5, and the midpoint is where it
 * was wrong: an amber accent measures 0.45, took white ink, and shipped a label
 * at 2.1:1 — below the floor in both directions. Comparing the two candidates by
 * the ratio they actually produce costs one extra call and cannot be off by a
 * judgement call, because there is no longer a judgement call in it.
 */
export function readableInk(hex) {
  const fill = safeColor(hex, THEME_FALLBACK.accent)
  return contrastRatio(INK_LIGHT, fill) >= contrastRatio(INK_DARK, fill) ? INK_LIGHT : INK_DARK
}

/**
 * Whether an ink was written for paper.
 *
 * Measured, not assumed: the ink is held against both fallback grounds and takes
 * the one it reads better on. A "dark green" and a "deep navy" answer paper, a
 * cream and a white answer the dark ground, and a mid-tone answers whichever it
 * genuinely contrasts with rather than whichever a threshold happened to sit on.
 */
export function prefersPaper(ink) {
  const onPaper = contrastRatio(ink, PAPER_FALLBACK.background)
  const onDark = contrastRatio(ink, THEME_FALLBACK.background)
  if (!Number.isFinite(onPaper) || !Number.isFinite(onDark)) return false
  return onPaper >= onDark
}

/**
 * The theme a composition actually draws with: every token filled, from the
 * document where it was declared and from a fallback PAIR where it was not.
 *
 * The document's theme is entirely optional and every field inside it is too,
 * because `theme.ts` emits only what a direction stated. Resolving it in one
 * place is what lets each composition say "no hard-coded colour" and mean it.
 *
 * ── The decision this function encodes ──────────────────────────────────────
 *
 * There were two ways to stop painting an ink on a ground it was never meant to
 * meet: let each composition keep its ground and re-colour the text, or let the
 * ground follow the ink. The second is what happens here, and the first happens
 * afterwards, and the ORDER is the point.
 *
 * Deriving the ground from the ink is what respects the design. A direction that
 * states a dark green and no background wanted that green on paper; giving it
 * paper renders the film somebody designed. Re-colouring the text instead would
 * answer with white-on-black — perfectly legible, and not the project's film at
 * all, which is the failure `theme.ts` refuses when it declines to guess a
 * token. So the pairing is resolved first, here, from what was stated.
 *
 * It cannot be the whole answer, though, because a direction is allowed to state
 * BOTH colours and state them badly, and because `surface`, `accent` and the
 * veils over photographs are grounds no pairing rule reaches. That is why every
 * composition still measures each run against the surface it is really painted
 * on (`legibleOn`) and corrects what does not clear the floor. Derivation makes
 * the common case right; measurement makes every case safe.
 */
export function resolveTheme(theme) {
  const colors = theme && typeof theme === 'object' ? theme.colors || {} : {}
  const fonts = theme && typeof theme === 'object' ? theme.fonts || {} : {}
  const radius = theme && typeof theme === 'object' ? theme.radiusPx : undefined

  // `undefined` and not a fallback: which tokens were STATED is the whole input
  // to the pairing below, and a value already replaced by a default is
  // indistinguishable from one a document asked for.
  const statedBackground = stated(colors.background)
  const statedText = stated(colors.text)
  const statedSurface = stated(colors.surface)

  const pair = statedText && prefersPaper(statedText) ? PAPER_FALLBACK : THEME_FALLBACK
  const background = statedBackground ?? pair.background
  // A stated ground with no ink is the mirror case, and it takes the same
  // treatment from the other end: the ink is measured against the ground rather
  // than taken from a default that may share its polarity.
  const text = statedText ?? (statedBackground ? readableInk(statedBackground) : THEME_FALLBACK.text)
  // The surface belongs to the ground, not to the ink: it is the panel a caption
  // sits on, and a near-black card on a paper film is the same mismatch one
  // element further in.
  const surface = statedSurface ?? (readableInk(background) === INK_DARK ? PAPER_FALLBACK.surface : THEME_FALLBACK.surface)

  return {
    background,
    text,
    accent: safeColor(colors.accent, THEME_FALLBACK.accent),
    surface,
    headingFont: fontStack(fonts.heading),
    bodyFont: fontStack(fonts.body),
    // Not derived from a declared family, deliberately: a direction that states
    // "Cormorant Garamond" states a display face, and setting a listing in it
    // because it is the only name available is the guess `theme.ts` refuses.
    monoFont: INSTALLED_MONO_STACK,
    radiusPx:
      Number.isInteger(radius) && radius >= 0 && radius <= 9999 ? radius : THEME_FALLBACK.radiusPx,
  }
}

/** A colour the document actually stated, or `undefined`. Never a default. */
function stated(value) {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : undefined
}

// ── Legibility ───────────────────────────────────────────────────────────────
//
// Every colour of text in this directory is checked against the surface it is
// REALLY painted on, and corrected when it does not clear the floor. Nothing
// here is a convention: the answer comes from `contrastRatio`, and the same
// function decides it for all five compositions.
//
// Three things make "the surface it is really painted on" harder than it sounds,
// and the three levers below are one each.
//
//   1. Some text is painted over a VEIL over a photograph, and the photograph is
//      not in the theme. What the veil composites to therefore spans a range,
//      and the honest requirement is that the run clears its floor at BOTH ends
//      of that range — over a picture that is all black and one that is all
//      white. `surfaceRange` computes those two ends; `worstRatio` reads the bad
//      one. Its cost is a denser veil than a dark photograph needs, and that is
//      the price of a guarantee made without opening the picture.
//   2. Some text is deliberately QUIETER than the ink — a subtitle, a bullet.
//      That quieting used to be an alpha, which makes the painted colour depend
//      on what is behind it and therefore unmeasurable. It is now mixed to a
//      solid over the surface's own colour: identical pixels on an opaque
//      ground, near-identical under a veil, and a value a test can hold.
//   3. When the declared ink cannot be read, SOMETHING has to give. Which thing
//      gives, and in what order, is the whole of `legibleOn`.

/**
 * The order a composition tries colours in when the declared ink fails.
 *
 * The theme first, black and white last, and that is the rule rather than a
 * preference: a direction with two greens should render a legible green, not a
 * generic white that erases it. Only when nothing the project stated can be read
 * on that surface does the fallback pair get a turn — at which point legibility
 * is the only thing left worth having.
 *
 * And `INK_FLOOR` after even them, which is the difference between a list that
 * prefers black and a list that can reach it: see the constant for the band of
 * mid-tone grounds where `#101014` misses the floor by a tenth of a point.
 */
export function inkCandidates(theme) {
  return [theme?.text, theme?.surface, theme?.accent, theme?.background, INK_LIGHT, INK_DARK, INK_FLOOR]
}

/**
 * The same list with the accent in front, for the runs the DESIGN wants coloured.
 *
 * A kicker, a numeral beside an argument, a rule under a headline: these are the
 * elements whose job is to say whose film this is, and painting them in the ink
 * would make the accent a colour the project declared and the film never used.
 * So they ask for the accent first and fall through the ordinary list when it
 * cannot be read — which is the same policy as everywhere else, entered at a
 * different point.
 *
 * It is a SUPERSET of `inkCandidates`, and that is load-bearing rather than
 * incidental: every shared surface in this file already carries a run at the
 * display floor resolved from the ordinary list, so a decoration searching a
 * superset of that list at the same floor on the same surface cannot fail where
 * the text succeeded. `composition.test.js` measures both, which is what keeps
 * the sentence true.
 */
export function accentFirst(theme) {
  return [theme?.accent, ...inkCandidates(theme)]
}

/**
 * How dense a veil is allowed to become in the search for a legible pair.
 *
 * Not 1. A veil at full opacity is no longer a veil, and the picture under it is
 * the reason the scene exists — an `overlay` band that hides the capture has
 * failed even with every word legible. 0.94 still lets a trace through, and it
 * is enough to make almost any ink work; past it, the search changes the ink
 * instead, which is the visible-but-honest outcome.
 */
export const MAX_VEIL_ALPHA = 0.94

/** Step sizes for the two ladders. Small enough not to overshoot, coarse enough to stay cheap. */
const VEIL_STEP = 0.03
const QUIET_STEP = 0.06

/**
 * `from` up to `to` inclusive, or just `[from]` when there is nowhere to go.
 *
 * A `from` that is not a number collapses to `to`, never to NaN. Both callers
 * read the answer as an opacity that ends up in a CSS declaration, and a NaN
 * there paints an opaque band without saying so — the failure this whole section
 * exists to stop, arriving through the arithmetic instead of through a theme.
 */
function ladder(from, to, step) {
  const start = Number.isFinite(Number(from)) ? Math.min(1, Math.max(0, Number(from))) : to
  if (start >= to) return [Math.round(start * 100) / 100]
  const out = []
  for (let v = start; v < to; v += step) out.push(Math.round(v * 100) / 100)
  out.push(Math.round(to * 100) / 100)
  return out
}

/**
 * What a surface can composite to, as the colours worth measuring.
 *
 * An opaque surface is itself. A veil over an unknown picture is the pair of
 * extremes — the veil over black and the veil over white — and every composite
 * the real picture can produce lies between them. That nesting is why raising
 * the alpha never makes a run worse: a denser veil is a strictly narrower range
 * around the same base colour.
 *
 * `tint` is the second reason a surface is a range rather than a colour, and it
 * arrived with the backgrounds. A field of hairlines behind a headline means a
 * glyph lands either on the ground or on the ground plus a few percent of
 * something else — two colours, both KNOWN, unlike a photograph. Measuring both
 * is what stops a texture somebody added from quietly spending contrast a
 * headline had been promised, which is the one way a decorative layer can undo
 * the whole of this section without changing a single line of it.
 *
 * It may be an ARRAY, and that is what a gradient needs. Two colours measured at
 * their ends is not the same claim as a ramp between them, and the difference has
 * a counterexample rather than a doubt: on a ramp from black to a pale grey, an
 * ink at a relative luminance of 0.10 clears 3:1 against BOTH ends and meets its
 * own luminance somewhere in the middle, where the contrast is 1:1. At the 4.5
 * floor the arithmetic forbids it — two ends 4.5 apart in each direction would
 * need a luminance past 1 — but the display floor is 3, and every headline in
 * this directory takes 3. So a ramp is handed several samples and the sampling is
 * what closes the gap: an ink hiding between two adjacent samples is within a
 * fraction of one of them, and a fraction is not 3:1.
 */
export function surfaceRange(color, alpha, tint) {
  const base = safeColor(color, THEME_FALLBACK.background)
  const a = Number.isFinite(Number(alpha)) ? Math.min(1, Math.max(0, Number(alpha))) : 1

  const grounds = [base]
  const layers = Array.isArray(tint) ? tint : tint ? [tint] : []
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue
    const density = Number.isFinite(Number(layer.alpha)) ? Math.min(1, Math.max(0, Number(layer.alpha))) : 0
    // `safeColor(..., base)` and not a drop: an unreadable tint is a layer that
    // paints nothing, which is the same range as no tint at all.
    const tinted = blend(safeColor(layer.color, base), base, density)
    if (tinted && !grounds.includes(tinted)) grounds.push(tinted)
  }

  const out = []
  for (const ground of grounds) {
    if (a >= 1) {
      out.push(ground)
      continue
    }
    const dark = blend(ground, '#000000', a)
    const light = blend(ground, '#ffffff', a)
    if (dark && light) out.push(dark, light)
    else out.push(ground)
  }
  return out
}

/** The contrast of an ink against the worst end of a surface's range. NaN if anything is unreadable. */
export function worstRatio(ink, range) {
  let worst = Infinity
  for (const backdrop of range) {
    const ratio = contrastRatio(ink, backdrop)
    if (!Number.isFinite(ratio)) return NaN
    if (ratio < worst) worst = ratio
  }
  return Number.isFinite(worst) ? worst : NaN
}

/**
 * A legible ink for one run of text, and the veil it needs.
 *
 * The search is an ordered list of attempts and the first one that clears
 * `threshold` wins, so the order IS the policy:
 *
 *   1. the declared ink, at the quietness the design asked for, over veils from
 *      the declared density up to `MAX_VEIL_ALPHA` — a denser veil is the least
 *      visible repair there is, and it keeps the ink the project chose;
 *   2. the same ink, progressively less quiet — hierarchy is worth something and
 *      it is worth less than being read;
 *   3. each remaining candidate in `inkCandidates` order, never quieted, because
 *      by the time the ink itself had to be replaced, contrast is scarce.
 *
 * Nothing throws and nothing returns undefined. When no attempt clears the bar —
 * a mid-tone surface with a mid-tone palette can genuinely have no answer — the
 * best measured pair comes back with `ok: false`. Losing an export over a colour
 * would be the wrong trade (Q1), and the caller paints the most legible thing
 * available rather than the thing that was wrong.
 *
 * `lockVeil` removes the first of those three levers, and it exists for the
 * elements that are DECORATION. Raising a veil to save a caption is a trade
 * worth making — the words are why the scene exists. Raising it to save a
 * two-pixel rule is not: it darkens the photograph the film is made of so that
 * an ornament can keep the colour it preferred. Locked, the search still runs,
 * still measures, and still refuses to paint something illegible; it simply
 * changes the ink instead of the picture.
 *
 * @param {{color: string, alpha?: number}} surface  what the text lands on
 * @param {string[]} inks  candidates, most wanted first
 * @param {number} threshold  4.5 for body copy, 3 for display type
 * @param {{quiet?: number, lockVeil?: boolean}} options  1 = the ink at full strength
 * @returns {{color: string, veilAlpha: number, ratio: number, ok: boolean}}
 */
export function legibleOn(surface, inks, threshold, { quiet = 1, lockVeil = false } = {}) {
  const base = safeColor(surface?.color, THEME_FALLBACK.background)
  const declared = Number.isFinite(Number(surface?.alpha)) ? Math.min(1, Math.max(0, Number(surface.alpha))) : 1
  const bar = Number.isFinite(Number(threshold)) ? Number(threshold) : CONTRAST_MIN

  const candidates = (Array.isArray(inks) ? inks : []).filter((c) => typeof c === 'string' && HEX_COLOR.test(c))
  if (candidates.length === 0) candidates.push(THEME_FALLBACK.text)

  const veils = lockVeil ? [declared] : ladder(declared, MAX_VEIL_ALPHA, VEIL_STEP)
  const wanted = Number.isFinite(Number(quiet)) ? Math.min(1, Math.max(0, Number(quiet))) : 1

  let best = null
  for (let i = 0; i < candidates.length; i++) {
    // Only the declared ink gets a quiet ladder. A replacement is a repair
    // already; quieting it would spend the contrast that made it the answer.
    const quiets = i === 0 ? ladder(wanted, 1, QUIET_STEP) : [1]
    for (const q of quiets) {
      // Mixed over the surface's own colour rather than over the composite: the
      // quiet tint is a relative of the band it sits on, whatever the picture
      // behind the band turns out to be. The VERIFICATION below still runs
      // against both real ends of the range.
      const ink = q < 1 ? blend(candidates[i], base, q) : candidates[i]
      if (!ink) continue
      for (const veil of veils) {
        const ratio = worstRatio(ink, surfaceRange(base, veil, surface?.tint))
        if (Number.isFinite(ratio) && ratio >= bar) return { color: ink, veilAlpha: veil, ratio, ok: true }
        if (Number.isFinite(ratio) && (!best || ratio > best.ratio)) best = { color: ink, veilAlpha: veil, ratio, ok: false }
      }
    }
  }
  return best ?? { color: candidates[0], veilAlpha: declared, ratio: NaN, ok: false }
}

/**
 * Several runs that share one surface, resolved together.
 *
 * Two passes, because a band has ONE opacity and its title and its subtitle do
 * not need the same amount of it. The first pass asks each run what it needs,
 * the second re-resolves every run at the densest answer — safe in that
 * direction only, and it is the direction taken: `surfaceRange` shrinks as the
 * alpha rises, so a run can only ever gain from a veil somebody else asked for.
 *
 * Resolving them independently and painting the average, or the first one's
 * answer, is the bug this shape exists to prevent: a subtitle that needed 0.9
 * rendered on the 0.62 the title was happy with.
 *
 * A request may carry its own `inks` — a kicker asks for the accent first where
 * the title asks for the ink first — and its own `lockVeil`, which takes it out
 * of the first pass entirely: a decoration votes on nothing, it accepts the
 * density the text settled on and changes colour if it has to.
 *
 * @param {string} color  the surface's own colour
 * @param {number} alpha  the density the design asked for
 * @param {Array<{threshold: number, quiet?: number, inks?: string[], lockVeil?: boolean}>} requests
 * @param {string[]} inks  the default candidate list, for requests that name none
 * @param {{color: string, alpha: number}} [tint]  a layer painted over the whole surface
 */
function sharedSurface(color, alpha, requests, inks, tint) {
  const asked = requests
    .filter((r) => !r.lockVeil)
    .map((r) => legibleOn({ color, alpha, tint }, r.inks ?? inks, r.threshold, { quiet: r.quiet }))
  // The tint travels WITH the surface rather than beside it, so a run carries
  // everything needed to re-measure the pair from primitives — which is what
  // `composition.test.js` does, and what makes the numbers in `runs` a claim
  // somebody checks rather than a claim the palette makes about itself.
  const on = {
    color: safeColor(color, THEME_FALLBACK.background),
    alpha: Math.max(alpha, ...asked.map((a) => a.veilAlpha)),
    ...(tint ? { tint } : {}),
  }
  const runs = requests.map((r) => {
    const found = legibleOn(on, r.inks ?? inks, r.threshold, { quiet: r.quiet, lockVeil: r.lockVeil })
    return { color: found.color, on, threshold: r.threshold, ratio: found.ratio, ok: found.ok }
  })
  return { on, runs }
}

// ── Per-template geometry ────────────────────────────────────────────────────

/**
 * The edge every type size in this directory is derived from: the SHORT one.
 *
 * All three ratios are 1080 on the short edge — that is what `DIMENSIONS`
 * guarantees above — so one scale reads identically in a landscape export and a
 * portrait one. Deriving from `height` instead is the mistake that was there
 * first: a title tuned on a 1080-tall 16:9 frame came out at 1920/1080 times the
 * size in `9:16`, filling the frame with four words.
 */
export function frameBase(width, height) {
  return Math.min(Number(width) || 0, Number(height) || 0)
}

/**
 * The kicker's size and tracking, as constants rather than numbers in a
 * component — because a threshold depends on them.
 *
 * A kicker is measured at `CONTRAST_MIN_LARGE`, the 3:1 floor, and that is only
 * legitimate while it stays "large text" under the rule the audit applies: 18.66
 * px at weight 700. 0.026 of the short edge is 28 px in all three ratios, which
 * clears it with room to spare — and `composition.test.js` asserts the
 * inequality, so a kicker somebody shrinks to look more delicate fails a test
 * instead of silently dropping a run below its own floor.
 *
 * The tracking is what makes 28 px read as a surtitle rather than as small body
 * copy. `.kicker` is the most-used device in Mocky's own interface for the same
 * reason: it costs one line and it says "this is a heading" without a size.
 */
export const KICKER_SIZE = 0.026

/**
 * The size past which bold type is "large" to the audit, and therefore the size
 * past which a run measured at `CONTRAST_MIN_LARGE` is measured at the right
 * floor: 18.66 px at weight 700, WCAG's 14 pt.
 *
 * Written down here rather than in the test that used to own it, because
 * `harmoniseUnits` reads it: a cap that pushes a surtitle under this bar does not
 * make a scene quieter, it takes away the licence the accent was resolved under.
 * The two callers now cannot disagree about where the bar is.
 */
export const BOLD_LARGE_PX = 18.66
/**
 * As a number, because the type scale has to MEASURE it: a fifth of an em added
 * to every glyph is a fifth of a line's width, which is the difference between a
 * kicker that fits its box and one that wraps. The string is derived from it so
 * the two cannot drift.
 */
export const KICKER_TRACKING_EM = 0.2
export const KICKER_TRACKING = `${KICKER_TRACKING_EM}em`

/**
 * A field of 1-pixel rules, as one CSS background — the house texture.
 *
 * Mocky's own direction is "filets de 1px, aucune ombre", and a flat fill behind
 * a headline is the one place a film has nothing at all in it. A laid-paper
 * screen at 4% is not a texture anybody notices; it is what stops 1920×1080 of
 * one colour from reading as a missing background, and it survives an h.264
 * encode as a faint grain rather than as banding.
 *
 * Built from a theme colour through `withAlpha`, so it validates the hex on the
 * way through like every other declared token that becomes CSS. Never an image,
 * never a filter: `feTurbulence` over a full frame is a per-frame raster on a
 * two-core container with a 110 s budget, and grain is not worth a timeout.
 */
export const TEXTURE_ALPHA = 0.04
export const TEXTURE_GAP_PX = 9

export function hairlineTexture(color, alpha = TEXTURE_ALPHA, spacingPx = TEXTURE_GAP_PX) {
  const line = withAlpha(color, alpha)
  const gap = Math.max(2, Math.round(Number(spacingPx) || 0))
  return `repeating-linear-gradient(to bottom, ${line} 0px, ${line} 1px, transparent 1px, transparent ${gap}px)`
}

/**
 * How much of the frame an `overlay` band is allowed to cover, and how far it
 * sits off the edge.
 *
 * The band used to run the full width of the frame and touch three of its sides,
 * which is a lower third from a news bulletin: it covers the capture edge to
 * edge whatever the sentence on it is, and a four-word title then sits in the
 * middle of a bar with two thirds of it empty. A block that stops where its text
 * stops reads as something somebody placed, and it gives back the part of the
 * screenshot the film exists to show.
 *
 * Two numbers, because a 1920-wide frame and a 1080-wide one are not the same
 * problem: 62% of a landscape frame is 1190 px, which holds a 60-character title
 * on two lines, while 62% of a portrait one is 670 px and would break the same
 * title into five.
 */
export function bandInset(width, height) {
  return Number(width) > Number(height)
    ? { maxWidthPercent: 62, marginPercent: 5 }
    : { maxWidthPercent: 86, marginPercent: 6 }
}

/**
 * The punch a vertical scene lands on: 4.5% of overscale, gone in twelve frames.
 *
 * A feed is watched in cuts, and a cut with nothing on either side of it reads as
 * a stall — the picture changes and then sits there. A short push-in is what a
 * cut sounds like; it is over before a viewer could name it, and it is the one
 * thing that makes `transitionOut: "none"` look like an edit instead of an
 * omission.
 *
 * It is a separate transform from `kenBurnsTransform` rather than folded into
 * it: the Ken Burns move is the document's, the punch is the template's, and a
 * scene that asked for `static` still gets the cut. Overscale only, never
 * translation, so nothing can drag the background in behind the picture.
 */
export const PUNCH_SCALE = 0.045
export const PUNCH_FRAMES = 12

export function punchTransform(frame) {
  const settled = easeOutCubic(progressAt(frame, PUNCH_FRAMES))
  return `scale(${1 + PUNCH_SCALE * (1 - settled)})`
}

/**
 * How far each scene of a film has played, as one number per scene, from the
 * absolute frame.
 *
 * The rail this feeds is the one element of a `vertical` film that survives a
 * cut, and that is its whole job: a story told in six full-bleed pictures with
 * nothing constant between them is six pictures, and the eye has to find its
 * place again at every one. Feed applications draw exactly this bar for exactly
 * this reason.
 *
 * A segment fills between its own start and the NEXT scene's start rather than
 * over its own duration, because transitions overlap: measured on durations, two
 * segments would be in motion at once during every crossfade and the rail would
 * contradict the picture. Measured on starts it is monotone and it answers "where
 * am I in this film", which is the question a viewer is asking.
 */
export function railSegments(plan, frame) {
  const scenes = Array.isArray(plan?.scenes) ? plan.scenes : []
  const at = Number.isFinite(Number(frame)) ? Number(frame) : 0
  return scenes.map((entry, i) => {
    const start = Number(entry?.from) || 0
    const end = i + 1 < scenes.length ? Number(scenes[i + 1]?.from) || 0 : start + (Number(entry?.durationInFrames) || 0)
    return progressAt(at - start, Math.max(1, end - start))
  })
}

/**
 * The bands a phone feed covers with its own controls, as a percentage of the
 * frame height.
 *
 * A `vertical` export exists to be posted, and TikTok, Reels and Shorts all draw
 * their own interface over the video rather than beside it: the account name,
 * the caption and the sound row sit along the bottom, the action rail runs up
 * the right, and a top strip carries the tabs and the progress bar. Text placed
 * there is not merely close to the edge — it is behind a button. The numbers are
 * deliberately generous, because a caption that sits a little high costs nothing
 * and one hidden under a "Follow" button costs the whole scene.
 *
 * They are not the slideshow's 6% padding under another name. That one is about
 * broadcast overscan and framing; this one is about a specific interface drawn
 * on top by a specific set of applications, and the two would drift for
 * different reasons.
 */
export const VERTICAL_SAFE_TOP_PERCENT = 12
export const VERTICAL_SAFE_BOTTOM_PERCENT = 20
/** The action rail runs up the right edge, so the text column stops short of it. */
export const VERTICAL_SAFE_SIDE_PERCENT = 8

/**
 * The vertical caption's type size, chosen by how much caption there is.
 *
 * The format lives on scale — a phone at arm's length, often silent, one line
 * that is the whole message — and the old fixed 0.082 was tuned so that the
 * LONGEST legal caption still fitted. Which means every short one was rendered
 * at the size a 120-character one needed: three words at the size of a
 * paragraph, in the one template where three words should fill the frame.
 *
 * So the size ramps. Twenty-four characters or fewer get 0.115 of the short edge
 * — 124 px, roughly two lines of display type — and it falls to 0.058 across the
 * range, which holds a full-length caption in four lines inside the safe area
 * with the type still larger than the slideshow's.
 *
 * The long end is a RAMP and not a bound, which is why restating a number near
 * the schema's 120-character limit is safe here in a way a retyped floor never
 * is: a caption past it simply saturates at the minimum, so the two can drift
 * apart without producing a disagreement anybody has to discover.
 */
export const VERTICAL_CAPTION_MAX = 0.115
export const VERTICAL_CAPTION_MIN = 0.058
export const VERTICAL_CAPTION_SHORT_CHARS = 24
export const VERTICAL_CAPTION_LONG_CHARS = 110

export function verticalCaptionSize(text, base) {
  const chars = String(text ?? '').trim().length
  const short = VERTICAL_CAPTION_SHORT_CHARS
  const span = Math.max(1, VERTICAL_CAPTION_LONG_CHARS - short)
  const over = Math.min(1, Math.max(0, (chars - short) / span))
  const factor = VERTICAL_CAPTION_MAX - (VERTICAL_CAPTION_MAX - VERTICAL_CAPTION_MIN) * over
  return Math.round(Math.max(0, Number(base) || 0) * factor)
}

/**
 * The slow drift under an `overlay` band, and the overscale that pays for it.
 *
 * The template has no `kenBurns` field, and the schema says why: a pan across a
 * capture of an interface slides half the interface out of frame and a zoom
 * crops it, while the reason to show a screenshot at all is that it can be read.
 * What is left is the smallest amount of movement that keeps a still frame from
 * looking like a stalled render — a drift of ±1.2% of the picture's own height,
 * which at a normal reading distance is barely a motion and never a pan.
 *
 * The 1.03 overscale is not decoration. Translating an image that exactly fills
 * the frame drags the background in behind it, so the picture is 3% too big and
 * the drift stays inside the 1.5% of margin that leaves on each side. Same
 * arithmetic as `PAN_SCALE` and `PAN_SHIFT_PERCENT`, one order of magnitude down.
 *
 * Which is the whole argument for why THIS move is safe on a capture and a pan is
 * not, and it is about amplitude rather than about direction. A pan spends 4% of
 * travel on a 12% overscale: an eighth of the screenshot is cropped before the
 * first frame, and a twentieth of what is left slides past — on an interface that
 * is a sidebar. The drift spends 1.2% on 3%: a fortieth is cropped, the travel
 * stays inside the margin, and every pixel the frame shows at rest it shows on
 * every frame of the scene. Nothing the film exists to show ever leaves.
 */
export const OVERLAY_DRIFT_PERCENT = 1.2
export const OVERLAY_DRIFT_SCALE = 1.03

/**
 * `settle`: the capture arrives a hair large and eases onto its mark.
 *
 * 5.5% down to the 3% every overlay scene holds, over twelve frames — the same
 * length and the same curve as `punchTransform`, because a cut landing is one
 * idea and this file keeps one of those. It is a LANDING and not a zoom: it is
 * over in four tenths of a second, so the scale the viewer actually reads the
 * screenshot at is the same 1.03 the other two moves hold throughout.
 *
 * And it is added to the drift rather than offered instead of it. A move that
 * finished in twelve frames would leave fourteen seconds of frozen picture behind
 * it, which is the defect this field was added to make unreachable — arriving
 * through the field itself, which is the way these things usually come back.
 */
export const OVERLAY_SETTLE_SCALE = 0.025
export const OVERLAY_SETTLE_FRAMES = 12

/**
 * The `overlay` picture's transform for one frame.
 *
 * The picture drifts towards the side it is NAMED after, which is the convention
 * `kenBurnsTransform` already states for its pans — the other reading (the camera
 * drifts up, so the subject slides down) is just as defensible, which is exactly
 * why it is written down in both places rather than left to the switch.
 *
 * An unknown move drifts rather than freezing, and the direction it takes is the
 * schema's own default. Unknown kinds answering with `none` is right for
 * `kenBurnsTransform`, where `static` is a value a document may legitimately hold;
 * here there is no legitimate immobility, so the one thing this function must
 * never do is hand back a still frame because a string was misspelt three
 * validators ago.
 */
export function overlayDriftTransform(move, frame, durationInFrames) {
  const progress = progressAt(frame, Math.max(1, durationInFrames - 1))
  const away = move === 'drift-down' ? -1 : 1
  const drift = OVERLAY_DRIFT_PERCENT * away * (1 - 2 * progress)
  const landing = move === 'settle' ? OVERLAY_SETTLE_SCALE * (1 - easeOutCubic(progressAt(frame, OVERLAY_SETTLE_FRAMES))) : 0
  return `scale(${OVERLAY_DRIFT_SCALE + landing}) translateY(${drift}%)`
}

/**
 * Whether a product card stands its picture beside its text or above it.
 *
 * Landscape gets two columns because a 1920×1080 frame has room for a picture
 * and a paragraph side by side; portrait and square stack, because a column of
 * text 540 px wide is four words a line. Square lands in `column` deliberately:
 * a 1080×1080 split leaves two 540 px halves, which is the worst of both.
 */
export function productLayout(width, height) {
  return Number(width) > Number(height) ? 'row' : 'column'
}

/**
 * How much of the frame the product picture takes, per layout.
 *
 * Here rather than in `ProductSpotlightVideo.jsx`, where it was written, for the
 * reason stated at the top of this file: a `.jsx` file cannot be imported by a
 * test, and this is the one number in the catalogue that says a picture is NOT
 * full-bleed. Mocky's panel reads it to work out how much a still is about to be
 * enlarged — a product shot on half a landscape frame is asked for half as many
 * pixels as the same shot in a slideshow — and a share that lived beside the
 * component would have been a number the browser guessed at.
 */
export const PICTURE_SHARE = { row: 0.5, column: 0.45 }

// ── The composable variant's geometry ────────────────────────────────────────
//
// A zone is a name in the document and a box in the frame, and this is where the
// second one is worked out. It is here rather than in `ComposedSceneVideo.jsx`
// for the reason the whole file exists: a `.jsx` cannot be imported by a test, so
// a layout written there is a layout whose only proof is an mp4 somebody watched.
// The first version WAS written there — a CSS grid with `padding: '6%'` on it —
// and the defect that arrangement hides is the one below: 6% is a broadcast
// margin, a feed application covers a fifth of a portrait frame with its own
// interface, and a percentage cannot tell the two apart.

// ── One type scale, for every block ──────────────────────────────────────────
//
// The second defect the six exports showed was the first one wearing a hat.
// `headingSize`, the counter's figure, the typewriter's line and the wordmark
// were four fractions of `base` decided by four authors, so a `counter` and a
// `heading` stacked in one zone came out at 0.13 and 0.042 of the short edge —
// the figure crushing the title by a factor of three, in a frame nobody had
// asked for that emphasis in. Twenty-seven blocks choosing their own type size
// is twenty-six of them disagreeing, which is the argument this whole file is
// written under, applied to typography instead of to easing.
//
// So there is ONE scale. A role — display, title, body, caption, figure — is a
// STEP on it, and a step is a multiple of a unit that is solved per stack rather
// than read off the frame. The ratios between the steps are the ones the
// catalogue already had (0.096 / 0.062 / 0.040 / 0.026 / 0.130 of the short edge,
// normalised on the body step), so nothing about the relationship between a
// heading and its kicker changes. What changes is the denominator: a box instead
// of a frame.
//
// And a role is a notion of the SCENE, not of the stack it was solved in. Per
// stack was the right denominator and the wrong scope: a kicker alone in a narrow
// column had the column to itself and came out three times the heading beside it,
// which is the crushing defect above with the two blocks in different zones. The
// unit stays per stack — two zones have two measures and a narrow one must be
// allowed to compose smaller — and what is shared is the ORDER: `harmoniseUnits`
// lowers a stack until no run in it is drawn larger than a run of a superior role
// anywhere else in the frame. An inequality, never an equality.

/**
 * The average advance width of a glyph, in ems, in the family this container
 * actually has.
 *
 * The Dockerfile installs `fonts-liberation` and nothing loads a webfont, so the
 * face a film is set in is Liberation Sans (metric-compatible with Arial) unless
 * the direction named one the image happens to carry. That makes the average
 * advance a KNOWN number rather than a guess, and a known average is what lets
 * this file estimate where a line will break without measuring a glyph — which a
 * Remotion bundle cannot do before it has laid out, and a test cannot do at all.
 *
 * The number is not new. It is the one `verticalCaptionSize` was calibrated on by
 * hand, recovered from its own two ends: 110 characters at 0.058 of the short
 * edge "in four lines inside the safe area" and 24 characters at 0.115 in
 * "roughly two lines" both solve to 0.527 across the 84% of 1080 that
 * `VERTICAL_SAFE_SIDE_PERCENT` leaves. Rounded down to 0.52, because the whole
 * point of the estimate is that it must not UNDER-count lines — a line more than
 * predicted is a block through the edge of its box, a line fewer is a block a
 * little short of it. `composition.test.js` re-derives the caption ramp from this
 * constant, which is what stops the two drifting now that the number is written
 * down once instead of being implied twice.
 *
 * Arial's own metrics agree: unweighted, its lowercase averages 0.49 em and its
 * capitals 0.68, so a Title Case line lands near 0.52 and a sentence of lowercase
 * below it.
 */
export const MEAN_GLYPH_EM = 0.52

/** The same, for `Liberation Mono` — a monospace face is one advance by definition. */
export const MEAN_MONO_EM = 0.6

/**
 * The advance of one glyph CLASS, in ems of the same family — used for the runs
 * where the average above is not good enough.
 *
 * 0.52 is the mean of a SENTENCE, and a sentence is mostly lowercase. A run that
 * cannot break is usually not a sentence: a counter's face is digits and a sign,
 * a wordmark is capitals. Two real exports are why this table exists. `91%`
 * measured 2.00 em against the 1.56 the average predicted, so a counter anchored
 * `center-right` was sized to a box it then ran 172 px past — and since a nowrap
 * run has no line to give back, what a frame shows is a per cent sign sliced off
 * by the edge of the video. `MOCKY` did the same into the column beside it.
 *
 * The numbers are Liberation Sans Bold's own, rounded UP within each class:
 * digits are tabular at 0.556, its capitals average 0.71, its lowercase 0.53,
 * and `%` is 0.889 — the one glyph wide enough to be its own class, because a
 * three-character counter is two thirds of a per cent sign. `other` is generous
 * on purpose: `+` is 0.584 while a comma is 0.278, and the asymmetry says which
 * of the two to be wrong about.
 */
export const GLYPH_CLASS_EM = { digit: 0.58, upper: 0.73, lower: 0.53, space: 0.29, wide: 0.93, other: 0.5 }

/** The glyphs wide enough that averaging them away is what clipped a counter. */
const WIDE_GLYPHS = '%‰@&№'

/**
 * The mean advance of ONE STRING, rather than of a language.
 *
 * Floored at `MEAN_GLYPH_EM` so this can only ever widen an estimate: it is
 * reached from `runAdvanceEm` for unbreakable runs alone, where an underestimate
 * is a glyph outside the frame and an overestimate is a slightly smaller block.
 */
export function meanAdvanceEm(text) {
  const line = [...String(text ?? '').trim()]
  if (line.length === 0) return MEAN_GLYPH_EM
  let sum = 0
  for (const glyph of line) {
    if (glyph >= '0' && glyph <= '9') sum += GLYPH_CLASS_EM.digit
    else if (WIDE_GLYPHS.includes(glyph)) sum += GLYPH_CLASS_EM.wide
    else if (glyph === ' ') sum += GLYPH_CLASS_EM.space
    else if (glyph.toLowerCase() !== glyph.toUpperCase()) {
      sum += glyph === glyph.toUpperCase() ? GLYPH_CLASS_EM.upper : GLYPH_CLASS_EM.lower
    } else sum += GLYPH_CLASS_EM.other
  }
  return Math.max(MEAN_GLYPH_EM, sum / line.length)
}

/**
 * The advance one run is measured at — the one reading of that question.
 *
 * A monospace face has one advance by definition; everything else is measured on
 * ITS OWN GLYPHS, in the case the composition will actually set it in.
 *
 * That last clause used to have an exception in it: a run that WRAPS kept the flat
 * sentence average, on the argument that a sentence is what the average is of and
 * that `LINE_SAFETY` insures the rest. Two things killed the exception at once.
 * `meanAdvanceEm` is floored at `MEAN_GLYPH_EM`, so an ordinary sentence answers
 * the sentence average anyway — the only runs that move are the ones the average
 * was wrong about. And those runs are not hypothetical: a rendered frame carried
 * `NEUF SEIZIEMES` in display capitals, whose real advance is 0.73 em against the
 * 0.52 it was measured at, so the estimate believed nine characters fitted a line
 * that held seven. A `wordCeiling` computed on that belief would have been a bound
 * that changed nothing, and a line count computed on it is a block taller than the
 * box the layout reserved.
 *
 * `caps` is the same rule and not a fourth case: `kicker` sets a `text-transform`,
 * so the glyphs it measures are the ones it will draw rather than the ones the
 * document typed. A six-letter surtitle the flat average put on one line came back
 * on two, the second holding the single letter `C`, below the bottom of its box.
 */
export function runAdvanceEm(run) {
  if (run?.mono) return MEAN_MONO_EM
  const text = String(run?.text ?? '')
  return meanAdvanceEm(run?.caps ? text.toUpperCase() : text)
}

/**
 * The margin the wrap estimate keeps for itself.
 *
 * Words are not glyphs of equal width, and CSS breaks between them rather than
 * across them: a measure that holds 27 average characters holds 24 or 25 real
 * ones once the last word of each line has to fit whole. Six per cent is the
 * cheapest insurance there is against the failure that is not symmetrical — a
 * block that wraps one line more than this file predicted is a block past the
 * bottom of its box, and the safe area it sits in is a promise about a feed
 * application's own interface.
 */
export const LINE_SAFETY = 1.06

/**
 * The five roles, as a step on one scale and a leading.
 *
 * `step` is a multiple of the BODY step, which is 1 by definition — so a unit of
 * 40 px sets running text at 40 px and a display line at 96 px, exactly the
 * 0.040 / 0.096 of the short edge the blocks were each computing on their own.
 * `leading` is the line box, and each of the five is the one its own family
 * already drew with: 1.08 on a heading, 1.4 on running text, 1.02 on a figure
 * that has no descenders to clear.
 *
 * Five and not twenty-seven, and the ordering is the whole point: a `figure` is
 * above a `display` because a number is the scene when it is there, and a
 * `caption` is below `body` because a surtitle that is not smaller than the line
 * under it is not a surtitle. A block picks a role and never a size, exactly as
 * it picks a run off the palette and never a colour.
 *
 * A role names a SIZE and never a run: which ink a block paints with, and at
 * which contrast floor, stays `composedPalette`'s answer. The two tables are
 * deliberately not the same table — a `subtitle` is display type set small, so it
 * takes the body STEP and the display RUN, and folding them together would make
 * the smaller of two sizes quietly the stricter of two floors.
 *
 * `figure` is one step above `display` and not three, which is where the old
 * numbers were: `FIGURE_SIZE` was a ramp from 0.13 down to 0.072 of the short
 * edge, and reading its top as the figure size is what made a counter beside a
 * heading three times its neighbour. The ramp is exactly what the box does now,
 * so what is left of it is a step.
 */
export const TYPE_ROLES = {
  display: { step: 2.4, leading: 1.08 },
  figure: { step: 2.8, leading: 1.02 },
  title: { step: 1.55, leading: 1.14 },
  body: { step: 1, leading: 1.4 },
  caption: { step: 0.65, leading: 1.35 },
}

/**
 * A role, or `body`.
 *
 * `Object.hasOwn` for the reason `anchorCell` and `blockComponent` both spell
 * out: a plain lookup answers for the prototype chain, so `role: "constructor"`
 * would hand a function to a multiplication and set every line of a film at
 * `NaN` px. The value comes from this file's own tables, so reaching the fallback
 * means two of them disagree — and running text beats an invisible line (Q1).
 */
export function typeRole(role) {
  return typeof role === 'string' && Object.hasOwn(TYPE_ROLES, role) ? TYPE_ROLES[role] : TYPE_ROLES.body
}

/** The type size of a role in pixels, once a stack's unit has been solved. */
export function typeSize(role, unit) {
  return Math.max(1, Math.round((Number(unit) || 0) * typeRole(role).step))
}

/**
 * How many lines a run of text takes at a size, across a measure.
 *
 * An estimate and not a measurement, deliberately: the alternative is laying the
 * text out, which needs a browser, which is the one thing this file is written
 * not to need. It is conservative in the direction that matters (see
 * `LINE_SAFETY`) and it answers 0 for an absent run, which is how an optional
 * subtitle costs a block nothing rather than costing it a blank line.
 */
export function textLines(text, size, width, tracking = 0, advanceEm = MEAN_GLYPH_EM) {
  const chars = String(text ?? '').trim().length
  if (chars === 0) return 0
  const advance = (advanceEm + Math.max(0, Number(tracking) || 0)) * LINE_SAFETY * Math.max(0, Number(size) || 0)
  const measure = Math.max(1, Number(width) || 0)
  if (advance <= 0) return 1
  return Math.max(1, Math.ceil(chars / Math.max(1, Math.floor(measure / advance))))
}

/** How wide one line of `text` runs at a size. The other half of the same estimate. */
export function textWidth(text, size, tracking = 0, advanceEm = MEAN_GLYPH_EM) {
  const chars = String(text ?? '').trim().length
  return chars * (advanceEm + Math.max(0, Number(tracking) || 0)) * LINE_SAFETY * Math.max(0, Number(size) || 0)
}

/** The air between two runs of one block, in units. A block is not a stack: the gap is tighter. */
export const RUN_GAP = 0.35

/**
 * The height a shape draws at a given unit: its runs, wrapped, plus its furniture.
 *
 * A "shape" is what a kind is MADE OF — see `BLOCK_APPETITE`. `fixed` is the part
 * that is not type: a plot, a dial, a card's padding, the rule under a heading.
 * It is counted in units too, so the whole block scales with one number and a
 * chart cannot quietly stay the size of the frame while its labels shrink.
 *
 * Monotone non-decreasing in `unit`, which is what makes `solveTypeUnit` a
 * bisection rather than a search: more unit is more size, more size is the same
 * or more lines, and both terms only ever add.
 */
function shapeHeight(shape, width, unit) {
  const at = Math.min(Math.max(0, Number(unit) || 0), shapeCeiling(shape, width))
  let height = (Number(shape?.fixed) || 0) * at
  let drawn = 0
  for (const run of shape?.runs ?? []) {
    const role = typeRole(run?.role)
    const advance = runAdvanceEm(run)
    const size = at * role.step
    // A run that cannot break has ONE line whatever it costs — a seven-digit
    // counter wrapped onto three lines is not a counter, and nothing in `words()`
    // can break "1 000 000" anyway. What gives instead is the size, through
    // `shapeCeiling` above: the unit itself stops rising once such a run has
    // filled the measure.
    const lines = run?.nowrap
      ? (String(run?.text ?? '').trim().length ? 1 : 0)
      : textLines(run?.text, size, width, run?.tracking, advance)
    if (lines === 0) continue
    height += lines * size * role.leading
    drawn += 1
  }
  return height + Math.max(0, drawn - 1) * RUN_GAP * at
}

/**
 * The largest size at which an unbreakable run still fits the measure it was given.
 *
 * By its WHOLE length, which is what makes this the stricter of the two width
 * bounds and why `wordCeiling` below skips a `nowrap` run: a run that cannot break
 * is one word as far as a measure is concerned.
 */
function cappedByWidth(run, width, advance, chars) {
  if (chars === 0) return 0
  const per = (advance + Math.max(0, Number(run?.tracking) || 0)) * LINE_SAFETY * chars
  return per > 0 ? Math.max(0, Number(width) || 0) / per : 0
}

/**
 * Below this drawn size the type stops yielding and the WORD is what gives.
 *
 * It is `BOLD_LARGE_PX` and deliberately the same number `harmoniseUnits` floors
 * its lowering at, because it answers the same question — how small is this file
 * allowed to make a run in order to fix something else. `palette.accent` and
 * `palette.display` are resolved at the 3:1 floor, which the audit licences for
 * bold type past this bar; a bound that takes a run under it has bought an
 * unbroken word by spending the licence the colour was chosen under, which is not
 * a trade, it is one legibility guarantee paying for another.
 */
export const WORD_FIT_FLOOR_PX = BOLD_LARGE_PX

/**
 * The advance the longest WORD of a run is measured at, which is not the advance
 * the run is measured at.
 *
 * `runAdvanceEm` measures a whole run, spaces included, and a space is 0.29 em
 * against a capital's 0.73. A word holds none of them, so a run's own average
 * still under-counts the one string this bound exists to keep whole — and an
 * under-count here is the defect coming back. `meanAdvanceEm` is floored at
 * `MEAN_GLYPH_EM`, so this can only ever widen the estimate, which is the
 * asymmetry the whole family of advances is built on.
 */
function wordAdvanceEm(run, word) {
  if (run?.mono) return MEAN_MONO_EM
  return meanAdvanceEm(run?.caps ? String(word).toUpperCase() : word)
}

/**
 * A WORD IS NOT CUT IN HALF, AND THIS IS THE BOUND THAT SAYS SO.
 *
 * `textLines` packs characters against a measure, and a rendered frame is what
 * said what that costs: `NEUF SEIZIEMES` in display type on a 9:16 frame arrived
 * as `NEUF S` / `EIZIEME` / `S`. The estimate had found a size at which fourteen
 * characters fit two lines; `SEIZIEMES` does not fit one of them, and CSS did the
 * only thing left to it. Every wrapping run in this directory carries
 * `word-break: break-word`, and that declaration was read for a long time as the
 * wrapping model the estimate assumes — it is not. It is what a browser falls back
 * to when a word does not fit its line at all, and the estimate never asked
 * whether one would.
 *
 * The typographic rule is the other way round: a word does not break, so the size
 * is what must be small enough for the longest one to fit the measure. That is a
 * BOUND, exactly like the one an unbreakable run already puts on a shape, and it
 * belongs beside it rather than in six blocks.
 *
 * ── Why this is not "a paragraph with one long word is small everywhere" ──────
 *
 * It is exactly that, and that is what a typesetter does. The objection that kept
 * this bound out of `shapeCeiling` for two passes assumed the alternative worked;
 * the alternative is a word sliced through the middle, which is the one failure in
 * this feature a viewer reads as broken software rather than as a small heading.
 * A block that comes back a tenth smaller has lost slack the zone's own alignment
 * spends anyway. The cost is real and it is paid in the right currency.
 *
 * ── The floor, and what happens under it ─────────────────────────────────────
 *
 * A word can be longer than its measure at every size worth reading: a URL, a
 * German compound, an identifier, or seventy characters — the schema's own
 * ceiling for a heading — inside one cell of a 3×3 grid on a portrait frame. The
 * answer cannot be a unit tending to zero, so under `WORD_FIT_FLOOR_PX` this run
 * is not bounded AT ALL and the CSS declaration is what handles it. That is the
 * named decision the rule needs, and it is the shape `texturedGround` already
 * uses one section down: the type yields to a word, and it never yields for
 * nothing. Shrinking a headline to 18 px and breaking the word anyway is paying
 * for nothing.
 *
 * A run that cannot break is skipped: `cappedByWidth` bounds that one by its whole
 * length, which is a stricter bound than its longest word by definition.
 */
export function wordCeiling(runs, width) {
  let ceiling = Infinity
  const measure = Math.max(0, Number(width) || 0)
  for (const run of runs ?? []) {
    if (run?.nowrap) continue
    let longest = ''
    for (const word of words(run?.text)) if (word.length > longest.length) longest = word
    if (longest.length === 0) continue
    const advance = (wordAdvanceEm(run, longest) + Math.max(0, Number(run?.tracking) || 0)) * LINE_SAFETY
    if (!(advance > 0)) continue
    // No allowance taken for `typeSize`'s rounding, and that is deliberate: half a
    // pixel is an ABSOLUTE quantity and every other term here is proportional to
    // the measure, so subtracting it is what stops a doubled box from doubling its
    // type — a property `text.test.js` checks to a millionth. `LINE_SAFETY` already
    // holds six per cent, and the rounding is at most half a pixel on a size the
    // floor below keeps past 18.66, which is under three of them.
    const size = measure / (longest.length * advance)
    // The floor: a word this measure cannot hold at a size worth reading is a word
    // the layout does not get to shrink the film for. See above.
    if (size < WORD_FIT_FLOOR_PX) continue
    ceiling = Math.min(ceiling, size / typeRole(run?.role).step)
  }
  return ceiling
}

/**
 * The largest unit a shape can USE, which is not always the largest one that
 * fits — and the difference is a wordmark.
 *
 * A run that cannot break is bounded by the measure rather than by the box: 24
 * characters across 1688 px is 127 px of type and there is no taller version of
 * it. Past that point nothing about the block changes, so the ceiling has to
 * apply to the WHOLE shape and not only to that run. It was written the other way
 * round first, and a `logoType` alone in a zone came back with a 128 px word
 * beside a 760 px mark: the type had stopped growing and its furniture had not.
 *
 * A wrapping run is bounded here too, by its longest WORD — see `wordCeiling`,
 * which is the whole of that argument. `Infinity` is therefore what is left for a
 * shape with no text at all, or one whose every word already fits its measure at
 * any size the box can afford: those are the shapes where the box decides, which
 * is still most of them.
 */
export function shapeCeiling(shape, width) {
  let ceiling = wordCeiling(shape?.runs, width)
  for (const run of shape?.runs ?? []) {
    if (!run?.nowrap) continue
    if (String(run?.text ?? '').trim().length === 0) continue
    const advance = runAdvanceEm(run)
    ceiling = Math.min(ceiling, cappedByWidth(run, width, advance, String(run.text).trim().length) / typeRole(run.role).step)
  }
  return ceiling
}

/** How finely the unit is solved. 24 halvings of a 1080 px room lands inside a millionth of a pixel. */
const UNIT_STEPS = 24

/**
 * The type unit a stack of shapes reads, in pixels: the largest one at which
 * everything still fits the room.
 *
 * This is where "inhabit your box" stops being a slogan. The unit is solved
 * AGAINST THE BOX — the blocks of a stack then take the height they take at that
 * unit, and the stack fills its zone rather than sitting in the middle of it at
 * whatever size the frame's short edge implied. Two blocks in one zone read the
 * SAME unit, which is the half of the fix that stops a figure from crushing a
 * title: their sizes are two steps of one scale, 3.25 against 1.55, and never two
 * fractions of a frame neither of them can see.
 *
 * A bisection because `shapeHeight` is monotone and it JUMPS: a line count is an
 * integer, so the height of a stack is a staircase in the unit and there is no
 * formula to invert. What is left over at the answer is at most one line of the
 * run that jumped, which `composition.test.js` bounds rather than assumes.
 */
export function solveTypeUnit(shapes, width, height, gap = 0) {
  const list = Array.isArray(shapes) ? shapes : []
  const room = Math.max(0, Number(height) || 0) - Math.max(0, list.length - 1) * Math.max(0, Number(gap) || 0)
  if (!(room > 0) || list.length === 0) return 0
  const total = (unit) => list.reduce((sum, shape) => sum + shapeHeight(shape, width, unit), 0)

  // The bracket is grown rather than assumed. A unit CAN exceed the room it is
  // solved in — `blockAppetite` counts a block's furniture in units too, so a
  // shape whose fixed part is under 1 draws less than one unit of height and the
  // answer is above the box. Doubling eight times covers 256×, past anything the
  // schema's bounds can reach.
  let high = Math.max(1, room)
  for (let i = 0; i < 8 && total(high) <= room; i += 1) high *= 2
  if (total(high) <= room) {
    // Nothing in this stack grows any more: every run is unbreakable and already
    // at its measure. The answer is the point where that happened, not the last
    // number the loop tried — see `shapeCeiling`.
    const ceiling = Math.max(...list.map((shape) => shapeCeiling(shape, width)))
    return Number.isFinite(ceiling) ? ceiling : high
  }

  let low = 0
  for (let i = 0; i < UNIT_STEPS; i += 1) {
    const mid = (low + high) / 2
    if (total(mid) <= room) low = mid
    else high = mid
  }
  return low
}

/**
 * The role steps a stack actually DRAWS, one entry per run, each carrying the
 * ceiling of the block it belongs to.
 *
 * A run with no text draws nothing, so it is not in the scene: an absent
 * `attribution` on a quote must not bound a caption three zones away with a size
 * no frame contains. The ceiling is per BLOCK and not per zone, because that is
 * the granularity at which a run stops growing — `shapeHeight` and `blockExtent`
 * both spend `min(unit, shapeCeiling(shape))`, so the size a viewer sees is that
 * product and the comparison below has to be made on it.
 */
function drawnRuns(shapes, width) {
  const drawn = []
  for (const shape of shapes ?? []) {
    const ceiling = shapeCeiling(shape, width)
    for (const run of shape?.runs ?? []) {
      if (String(run?.text ?? '').trim().length === 0) continue
      drawn.push({ step: typeRole(run?.role).step, ceiling })
    }
  }
  return drawn
}

/**
 * A ROLE IS A NOTION OF THE SCENE, AND THIS IS THE INEQUALITY THAT SAYS SO.
 *
 * `solveTypeUnit` solves one unit per STACK, and that was the right answer to the
 * defect it was written for: a `counter` and a `heading` in one zone used to be
 * two fractions of a frame neither could see, and the figure came out three times
 * the title beside it. Solving per stack closed that — inside a zone. It opened
 * the same defect one level up, and an export showed it: on a scene of eight
 * blocks, `DENSE` — a kicker ALONE in its column, sized against the whole column
 * because nothing else was in it — was three times the height of the `heading` in
 * the column next to it. A surtitle three times its own title is exactly the
 * arrangement the type scale exists to make impossible, arriving through the one
 * door the scale does not look through.
 *
 * The two are the same fault seen from two sides: a `caption` is a caption of the
 * FILM, not of the column it happens to be alone in. Being alone in a narrow
 * column is a fact about the layout; being a surtitle is a fact about the scene.
 *
 * ── Why an inequality and not one unit per scene ─────────────────────────────
 *
 * One unit for the whole scene is the obvious repair and it is wrong, because it
 * throws away the thing the box arithmetic bought. Two zones have two measures
 * and two heights: a narrow column MUST be allowed to compose smaller than the
 * band beside it — that is what "a block inhabits the box it is given" means, and
 * a scene-wide unit would be the smallest zone's unit imposed on the frame, which
 * is a return to the small element in the large void this whole pass removed.
 *
 * So what is constrained is not the unit but the ORDER the roles are for: **no
 * run is drawn larger than a run of a superior role elsewhere in the same scene.**
 * A caption may be as large as the smallest title in the film's frame; it may
 * never be larger. Below that bound every zone keeps its own answer, and two
 * zones with nothing to compare — a field of bars beside a column of pictures —
 * are not brought into agreement about anything.
 *
 * ── What it does not do ─────────────────────────────────────────────────────
 *
 * It only ever SHRINKS. A zone that is already inside the order is untouched,
 * which is most of them, and a lone stack has nothing to be compared with and is
 * returned exactly as `solveTypeUnit` answered — so the poorest document the
 * schema accepts pays nothing at all.
 *
 * It also compares stacks to OTHER stacks and never to themselves, which is not
 * a shortcut: a stack already agrees with itself, and the one way it can still
 * invert internally is a per-block measure ceiling — a counter whose face stopped
 * growing beside a title that did not. Correcting that would mean lowering the
 * whole zone below what its box allows, and "a stack is as large as its zone
 * allows" is the guarantee the box arithmetic was written to give. The two
 * defects are not the same defect and this one does not get to spend the other's
 * answer.
 *
 * And it cannot make a block overflow its
 * box: less unit is less height at every point, so a stack solved against its
 * zone and then lowered still fits the zone it was solved for. The leftover is
 * spent by the zone's own alignment, exactly like the leftover of the staircase
 * `stackIn` already had.
 *
 * ── Why it iterates ─────────────────────────────────────────────────────────
 *
 * A zone holds several roles, so lowering it to keep its caption under a title
 * elsewhere also lowers its own display — which is a superior run somebody else
 * was measured against. Caps therefore propagate, always downwards and always
 * from a superior role to an inferior one. Every step of that chain multiplies by
 * a ratio of steps greater than one, so a cycle cannot pull anything to zero and
 * the walk settles; it is bounded at one pass per stack, and a run that has not
 * settled leaves a scene a little quieter rather than failing an export (Q1).
 */
export function harmoniseUnits(stacks) {
  const list = Array.isArray(stacks) ? stacks : []
  const units = list.map((stack) => Math.max(0, Number(stack?.unit) || 0))
  // `stackRuns` rather than `runs`: the name is taken further down by the helper
  // the weight table reads, and one of the two shadowing the other is a bug that
  // compiles.
  const stackRuns = list.map((stack) => (Array.isArray(stack?.runs) ? stack.runs : []))
  // A missing ceiling is "this run can grow", which is what `shapeCeiling` answers
  // for anything that wraps — and reading it as 0 would make one malformed entry
  // collapse every inferior role in the film (Q1).
  const ceilingOf = (run) => (Number.isFinite(run?.ceiling) ? Math.max(0, run.ceiling) : Infinity)

  /*
   * How far down a stack may be pushed before the INK stops being licensed.
   *
   * The one thing in this file that is a size in pixels rather than a ratio, and
   * it is here for the reason the house always gives: the type yields, the ink
   * never does. `palette.accent` and `palette.display` are resolved at the 3:1
   * floor, which the audit licences for bold type past `BOLD_LARGE_PX` — so a cap
   * that takes a surtitle under that bar has not made a scene quieter, it has
   * taken away the licence the colour was chosen under.
   *
   * It is a FLOOR on the lowering and never a raise: a stack already composing
   * under the bar keeps its own answer, because its box is a promise about
   * somebody else's interface and the bar is not. And the ORDER bound still wins
   * over it, so nothing here can put an inferior role above a superior one.
   */
  const floorFor = (runs) => {
    let smallest = Infinity
    for (const run of runs) smallest = Math.min(smallest, Math.max(0, Number(run?.step) || 0))
    return Number.isFinite(smallest) && smallest > 0 ? BOLD_LARGE_PX / smallest : 0
  }

  for (let pass = 0; pass < list.length; pass += 1) {
    let moved = false
    for (let i = 0; i < list.length; i += 1) {
      // The order bound, which always holds, and the scale bound, which holds
      // down to the licence floor. See the two comments inside the loop.
      let cap = Infinity
      let scale = Infinity
      for (let j = 0; j < list.length; j += 1) {
        // Another stack, always. A stack is already the thing that agrees with
        // itself — one unit and an ordered scale — and the one way it can still
        // invert inside a zone is a per-block measure ceiling: a counter whose
        // face has stopped growing beside a title that has not. That case is
        // deliberately left alone rather than folded in here, because the fix for
        // it is to lower the WHOLE zone below what its box allows, and "a stack is
        // as large as its zone allows" is the guarantee the previous pass paid
        // for. This function is about the inversion that guarantee creates BETWEEN
        // zones, and about nothing else.
        if (j === i) continue
        /*
         * A FIELD is the scene, and what stands on it is a caption of it.
         *
         * A block anchored `full` is painted across the whole safe area under the
         * nine cells, so it belongs to no band and no band's appetite belongs to
         * it. That leaves a cell zone on a field solving its unit against a third
         * of the frame with nothing to be compared with — and an export showed
         * exactly that: one `equalizer`, one `kicker`, and a surtitle at 122 px of
         * capitals standing on the graph it was the surtitle OF. The largest
         * element in the frame was the smallest role in the scene, for the second
         * time, and the band alone does not close it.
         *
         * So the field's own unit is the ceiling for everything laid over it. It
         * is a cap like every other one here — a zone already composing smaller
         * keeps its answer — and it says the thing the picture says: the field
         * sets the scale, the words on it read at that scale or under it.
         */
        if (stacks[j]?.field) scale = Math.min(scale, units[j])
        /*
         * A stack of FURNITURE is not evidence about the scale of a scene.
         *
         * The SCALE bound says "no stack reads a larger unit than a stack carrying
         * a superior role", and it assumes both stacks were sized by their boxes.
         * `furnitureCeiling` breaks that assumption on purpose: a `kicker` reads the
         * FORMAT's unit, so a `barChart` anchored `full` beside one was pulled from
         * 55 px to 43 and drew three quarters of a safe area it had all of — the
         * small element in a large void, arriving through the one door that was
         * meant to keep surtitles small.
         *
         * The ORDER bound deliberately still applies, and the asymmetry is the
         * difference between the two questions. "Two stacks of one scene read one
         * scale" is about a scale furniture does not participate in; "no run is
         * drawn larger than a superior run" is about what an eye reads on the frame,
         * and a body line larger than the title of the band beside it is an
         * inversion whatever made the band small.
         */
        const scales = !list[j]?.furniture
        for (const mine of stackRuns[i]) {
          for (const other of stackRuns[j]) {
            // A role at least as high as mine. The ORDER bound below needs a
            // strictly superior one — two runs of one role cannot be out of order
            // with each other — but the SCALE bound needs the equal case too: two
            // `title` runs in one frame at 196 px and 128 px are not an inversion
            // and they are still two scales, which is the "six agents" the whole
            // pass is about. A `logoType` alone in the bottom band is where it
            // showed up.
            if (!(other.step >= mine.step)) continue
            /*
             * TWO bounds, and the second one is what this pass added.
             *
             * The first is the drawn size: no run is larger than a superior run
             * elsewhere. It has to stay, because a superior run held back by its
             * own measure — a wordmark that stopped growing at five characters
             * across its column — still draws what it draws, and an inferior role
             * above it is the inversion however the unit got there.
             *
             * The second is the SCALE: no stack reads a larger unit than a stack
             * carrying a superior role. Size alone let a caption be drawn exactly
             * as large as a title, which is not the order — it is the collapse of
             * it, and an export showed the collapse: `DENSE` came back at the same
             * cap height as the headline beside it. `TYPE_ROLES` says why in one
             * line: a surtitle that is not smaller than the line under it is not a
             * surtitle. On the unit, the same pair lands at 0.65/1.55 of that
             * title, which is where the scale puts it.
             *
             * `units[j]` and not `sizeOf` for that second bound, so a run stopped
             * by its own measure does not drag a whole zone down to it. Every
             * constraint here is `unit ≤ something already solved`, so the walk is
             * a minimum propagating; it settles, and it cannot pull anything to
             * zero.
             */
            // A run whose own measure already keeps it under the bound needs no
            // help from the unit: a wordmark that stopped growing at 24 characters
            // across its column is not what makes a heading elsewhere too small.
            if (other.step > mine.step) {
              const order = (Math.min(units[j], ceilingOf(other)) * other.step) / mine.step
              if (ceilingOf(mine) > order) cap = Math.min(cap, order)
            }
            if (scales && ceilingOf(mine) > units[j]) scale = Math.min(scale, units[j])
          }
        }
      }
      // The scale, but never under the licence floor; then the order, which has no
      // floor because an inversion is not a quieter scene, it is a wrong one.
      const bound = Math.min(cap, Math.max(scale, floorFor(stackRuns[i])))
      if (bound < units[i]) {
        units[i] = bound
        moved = true
      }
    }
    if (!moved) break
  }
  return units
}

/**
 * The type size of ONE run of a role in ONE box — the whole of section B, for a
 * caller that has a box and a line rather than a stack.
 *
 * It takes the LENGTH of the text and the number of lines that length will take
 * in that box, because both are the difference between a size that fits and a
 * size that reads as timid. That lesson is `verticalCaptionSize`'s and it is
 * older than this scale: a caption size tuned so the longest legal one still fits
 * renders every short one at the size a 120-character one needed, which in the
 * one template where three words should fill the frame is three words in the
 * middle of it. Here the ramp is not a ramp any more — the size is solved against
 * the box, so a long line lands smaller for the reason a long line is smaller,
 * rather than because somebody drew a line between 24 and 110 characters.
 */
export function typeScale(role, text, box, { tracking = 0, mono = false, nowrap = false, unit } = {}) {
  const shape = { fixed: 0, runs: [{ role, text, tracking, mono, nowrap }] }
  const width = Math.max(0, Number(box?.width) || 0)
  const given = Number(unit)
  // The stack's unit when there is one, this box's own when there is not. A block
  // in a zone MUST pass the one `composedLayout` published: re-solving on its own
  // box can land a step above its neighbour, which is the disagreement the whole
  // scale exists to remove.
  const solved =
    Number.isFinite(given) && given > 0 ? given : solveTypeUnit([shape], width, Math.max(0, Number(box?.height) || 0))
  return Math.max(1, Math.round(Math.min(solved, shapeCeiling(shape, width)) * typeRole(role).step))
}

// ── What a kind is made of, and how much of a stack it is worth ──────────────

/**
 * The two quantities a document states that are a SHARE of a box rather than a
 * size — the second half of the exception the file header names.
 *
 * A block fills the box it is given unless the document asked for less, and
 * exactly two fields may ask: `solidScene.size` and `separator.extent`. Both are
 * closed enums of three, both are shares and never pixels (which is what keeps
 * them the `anchor` argument applied to depth and to measure), and both are
 * reproduced from the block that owns them — `SOLID_SHARE` in `blocks/setPiece.js`
 * and `RULE_EXTENTS` in `blocks/misc.js` — so that `blockExtent` can answer for a
 * block without importing one. Those two copies collapse into this one the day
 * the blocks are rewritten against this contract; until then
 * `composition.test.js` is the only thing holding them equal.
 */
export const DECLARED_SHARE = {
  solidScene: { small: 0.42, medium: 0.62, large: 0.86 },
  separator: { short: 0.18, measure: 0.62, full: 1 },
}

/** A named share, or the middle one. Same `Object.hasOwn` argument as everywhere else in this file. */
function declaredShare(kind, name, fallback) {
  const table = Object.hasOwn(DECLARED_SHARE, String(kind)) ? DECLARED_SHARE[kind] : null
  if (!table) return 1
  return typeof name === 'string' && Object.hasOwn(table, name) ? table[name] : table[fallback]
}

/**
 * The three quantities that are still allowed to be read off the FRAME, and why
 * each of them has to be.
 *
 * The rule at the top of this file says a block sizes everything on its box. A
 * constant metric is the exception, and it is one exception rather than a list
 * of nice-to-haves: it covers what must be IDENTICAL from one scene to the next
 * because a viewer reads it as the same object. A hairline that is 3 px under a
 * headline in scene one and 9 px under a smaller one in scene two is not a
 * hairline, it is two different design systems in one film; a corner radius that
 * grew with its card is a card that changed shape.
 *
 * Each is bounded, because an exception with no ceiling is the rule going back
 * out of the window: none of the three may exceed `CONSTANT_CEILING` of the box
 * it is drawn in, so a rule inside a tiny zone thins to fit rather than becoming
 * the block. The grid's own gutters are in here for the same reason as the
 * hairline — `COMPOSED_CELL_GAP` and `COMPOSED_STACK_GAP` are the film's spacing,
 * not a block's dimension, and a gutter that changed per zone would be a grid
 * with no rhythm.
 */
export const CONSTANT_METRICS = ['hairline', 'radius', 'gutter']
export const HAIRLINE_SHARE = 0.0028
export const CONSTANT_CEILING = 0.25

/**
 * How much of its box a block has to fill on the axis its own row claims —
 * "reasonable", as a number, because the rule at the top of this file is not
 * checkable without one.
 *
 * Three quarters, and it is measured rather than chosen. A sweep of the whole
 * catalogue — twenty-seven kinds, each at both ends of what the schema allows
 * (the poorest legal block and the longest legal one), across twelve box shapes
 * in all three ratios — puts the worst case at 0.82: a `notification` whose card
 * lands one line short of a box that happened to fall between two line counts.
 * Nothing can do better than that in general, because a line count is an integer
 * and the leftover of a staircase is bounded by one line of whichever run jumped;
 * and nothing should do much worse, because at three quarters a box already holds
 * more void than ink — which is the whole complaint this pass answers.
 *
 * The two shares a document may ask for (`DECLARED_SHARE`) are divided out before
 * the comparison. A `small` solid fills 42% of its box because somebody wrote
 * `size: "small"`, and refusing that would be the layout overruling the document.
 */
export const BOX_FILL_FLOOR = 0.75

/** The house's 1 px rule at the scale of a 1080p frame, clamped into the box it is drawn in. */
export function hairline(base, box) {
  const thickness = Math.max(1, Math.round((Number(base) || 0) * HAIRLINE_SHARE))
  const room = Math.min(Number(box?.width) || Infinity, Number(box?.height) || Infinity)
  return Number.isFinite(room) ? Math.max(1, Math.min(thickness, Math.floor(room * CONSTANT_CEILING))) : thickness
}

/**
 * The other two constant metrics — a radius and a gutter — bounded inside the box
 * they are drawn in. ONE implementation, and the reason it is here is that it was
 * three.
 *
 * `interface.js`, `media.js` and `dataFigures.js` each grew their own from the
 * same paragraph, written in parallel by three authors, and three readings of one
 * ceiling agree everywhere except where nobody wrote a card: on a DEGENERATE box,
 * one answered 0 and one answered the full radius unbounded — and the second was
 * pinned by a test, so a divergence nobody decided read as a decision somebody
 * made. A 0×0 box is not a licence to draw anything; it is a box with no room,
 * and a corner it rounds is a corner no frame contains.
 *
 * An ABSENT box is a different question and that is why the two are not folded
 * together: a caller with no box has nothing to be bounded against, and clamping
 * to nothing there would erase the radius of every caller that has not been given
 * one. `hairline` above splits on the same line for the same reason.
 *
 * Not floored at 1, unlike a hairline: a direction that states a radius of zero
 * has stated a square corner, and rounding it up to a pixel would be the layout
 * overruling the document. A rule of zero pixels is not a thinner rule, which is
 * why the one above is floored and this one is not.
 */
export function constantMetric(px, box) {
  const asked = Math.max(0, Math.round(Number(px) || 0))
  const width = Number(box?.width)
  const height = Number(box?.height)
  if (!Number.isFinite(width) || !Number.isFinite(height)) return asked
  return Math.min(asked, Math.floor(Math.max(0, Math.min(width, height)) * CONSTANT_CEILING))
}

/** A line of text, as the runs of a block see it: absent, or a string. */
const runs = (list) => (Array.isArray(list) ? list : [])

/** What a counter puts on the frame, which is what decides how wide it is. */
function counterFace(block) {
  const to = Number(block?.to)
  const digits = Number.isFinite(to) ? String(Math.trunc(Math.abs(to))) : ''
  return `${block?.prefix ?? ''}${digits}${block?.suffix ?? ''}`
}

/**
 * What every kind is made of, in units of the body type size — the weight table.
 *
 * ── Why a weight at all ──────────────────────────────────────────────────────
 *
 * A vertical stack of N blocks in a zone of height H does not divide into H/N,
 * because the blocks are not equally hungry. A title wants height; a rule wants
 * almost none. Split evenly, a `separator` above a `heading` takes half the
 * column for three pixels of ink and the heading is set at half the size the zone
 * could carry — which is the same "small element in a large void" the whole rule
 * at the top of this file is about, arriving through the split instead of through
 * the block.
 *
 * ── The unit, and why the table is written in it ─────────────────────────────
 *
 * One unit is one BODY type size. A block's appetite is therefore "how many
 * body-sizes of height do I draw", which is the only currency in which a chart, a
 * quote and a hairline can be compared at all. Two parts to it:
 *
 *   - `runs` — the text. Its height is not in the table, because it depends on
 *     the measure the zone turned out to have: `shapeHeight` wraps every run at
 *     the unit being tried, which is what makes a 70-character heading in a
 *     narrow column ask for more of the column than a two-word one.
 *   - `fixed` — everything that is not type, in units: a plot, a dial, a card's
 *     padding, the rule under a heading, the pill around a label.
 *
 * ── The numbers, and the argument for each tier ──────────────────────────────
 *
 * The text blocks carry almost nothing fixed: 1.1 for a heading is its rule and
 * the 0.34 em of air above it; 0.7 for a kicker is its own short rule; 1.3 for a
 * button is the padding that makes a label a pill. Those are read off what the
 * blocks already draw, so a stack of text keeps the proportions it had.
 *
 * The FIELDS are the tier that had to be decided rather than measured, and the
 * first version answered the wrong question with it. "Below what height does this
 * stop being what it is" is a FLOOR — four lines for a motif of bars, six for a
 * plot, nine for a picture — and a floor is the right number for sharing a column
 * and the wrong one for owning a frame. A field's appetite is also the exchange
 * rate between a box and a type size: a `barChart` worth 6.4 units filling a
 * 950 px safe area declares one body line to be 130 px, so its own axis labels
 * came out at 85 px — a row of `L M M J V S D` set as large as a headline — and a
 * `kicker` standing on it inherited the same scale. Three real exports showed it
 * and the user's word for all three was "rudimentary".
 *
 * So the tier is what a field is worth when it IS the scene, and the number
 * behind it is a density: **a frame that carries twenty lines of running text is
 * a frame, and one that carries ten is a poster.** Twenty-two units across a safe
 * area is a body line at about 4% of the short edge and a caption at 2.7%, which
 * is the surtitle the house has always drawn. The ORDER is the floors' own, so
 * nothing about how two fields share one column has changed:
 *
 *   - 10 to 13 for `soundWave` and `equalizer` — a motif, the least of them;
 *   - 15 for a `carousel` and a `clock` — a strip and a dial are elements, not
 *     fields: they hold their own shape and the rest of the stack still reads;
 *   - 16 for a chart — a plot and the row of labels under it;
 *   - 22 for a `map`, a `gallery`, an `imageFrame`, a `solidScene` — these are the
 *     scene when they are in it, so one of them beside a heading takes the frame
 *     and leaves the heading a band, which is the arrangement anybody who writes
 *     those two blocks meant.
 *
 * `fills` says which axis a kind is entitled to fill, and it is the claim
 * `composition.test.js` checks. `both` for a field, because a field that leaves a
 * quarter of its box empty has nothing else in the box; `either` for anything
 * whose governing axis depends on its own text — a two-letter heading fills its
 * height and a seven-digit counter fills its width, and which of the two happens
 * is the content's business rather than the layout's; `width` for a rule, whose
 * thickness is a constant metric; `minor` for the one square block.
 */
export const BLOCK_APPETITE = {
  // ── TEXT ──
  heading: {
    fixed: 1.1,
    fills: 'either',
    runs: (b) => [{ role: b?.level === 'display' ? 'display' : b?.level === 'subtitle' ? 'body' : 'title', text: b?.text }],
  },
  // `caps` because `kicker.jsx` sets a `text-transform`, and a run measured in
  // the case the document typed is a run measured in the wrong face. See
  // `runAdvanceEm`.
  kicker: {
    fixed: 0.7,
    fills: 'either',
    runs: (b) => [{ role: 'caption', text: b?.text, tracking: KICKER_TRACKING_EM, caps: true }],
  },
  quote: { fixed: 0.9, fills: 'either', runs: (b) => [{ role: 'title', text: b?.text }, { role: 'caption', text: b?.attribution }] },
  textHighlight: { fixed: 0.5, fills: 'either', runs: (b) => [{ role: 'body', text: b?.text }] },
  funTitle: { fixed: 0.9, fills: 'either', runs: (b) => [{ role: 'display', text: b?.text }] },

  // ── ANIMATED TEXT ──
  typewriter: { fixed: 0.4, fills: 'either', runs: (b) => [{ role: 'title', text: b?.text }] },
  animatedList: { fixed: 0.4, fills: 'either', runs: (b) => runs(b?.items).map((text) => ({ role: 'body', text })) },
  counter: {
    fixed: 0.3,
    fills: 'either',
    runs: (b) => [{ role: 'figure', text: counterFace(b), nowrap: true }, { role: 'caption', text: b?.label }],
  },
  logoType: { fixed: 0.8, fills: 'either', runs: (b) => [{ role: 'title', text: b?.text, nowrap: true }] },

  // ── INTERFACE ──
  button: { fixed: 1.3, fills: 'either', runs: (b) => [{ role: 'body', text: b?.label, nowrap: true }] },
  form: {
    fixed: 2.2,
    fills: 'both',
    runs: (b) => [
      { role: 'title', text: b?.title },
      ...runs(b?.fields).map((text) => ({ role: 'body', text })),
      { role: 'body', text: b?.submit },
    ],
  },
  notification: { fixed: 1.6, fills: 'both', runs: (b) => [{ role: 'body', text: b?.title }, { role: 'caption', text: b?.body }] },
  lowerThird: { fixed: 1.1, fills: 'either', runs: (b) => [{ role: 'title', text: b?.title }, { role: 'caption', text: b?.subtitle }] },

  // ── DATA ──
  barChart: { fixed: 16, fills: 'both', runs: (b) => [{ role: 'caption', text: runs(b?.labels)[0] }] },
  lineChart: { fixed: 16, fills: 'both', runs: (b) => [{ role: 'caption', text: b?.label }] },
  equalizer: { fixed: 13, fills: 'both', runs: () => [] },
  soundWave: { fixed: 10, fills: 'both', runs: () => [] },
  map: { fixed: 22, fills: 'both', runs: () => [] },
  // A ball, so `minor` for the reason `solidScene` is: it fills the smaller side
  // of its box and floats in the middle of the other, and there is no honest way
  // to make a sphere fill a landscape measure. Worth the field tier because a
  // globe IS the scene when it is in one — the same sentence as `map`, one
  // dimension up.
  globe: { fixed: 22, fills: 'minor', runs: () => [] },
  // The flat chart's own appetite and the flat chart's own run: this is
  // `barChart` with volume, and two charts of the same numbers in one film that
  // reserved different heights for their labels would be two scales.
  solidChart: { fixed: 16, fills: 'both', runs: (b) => [{ role: 'caption', text: runs(b?.labels)[0] }] },

  // ── MEDIA AND TIME ──
  imageFrame: { fixed: 22, fills: 'both', runs: (b) => [{ role: 'caption', text: b?.caption }] },
  gallery: { fixed: 22, fills: 'both', runs: () => [] },
  carousel: { fixed: 15, fills: 'both', runs: () => [] },
  clock: { fixed: 15, fills: 'either', runs: (b) => [{ role: 'caption', text: b?.label }] },
  dateStamp: { fixed: 0.6, fills: 'either', runs: (b) => [{ role: 'body', text: b?.text, nowrap: true }] },
  // The field tier, for the reason `imageFrame` and `gallery` are on it: a
  // picture alone in a scene IS the scene. Neither sets a word of type — a
  // caption on a turning panel would be type nobody measured against a
  // photograph — so both answer no runs, and the whole of their height is the
  // canvas the layout hands them.
  photoStage: { fixed: 22, fills: 'both', runs: () => [] },
  photoRing: { fixed: 22, fills: 'both', runs: () => [] },

  // ── MISC ──
  separator: { fixed: 1, fills: 'width', runs: () => [] },
  progressBar: { fixed: 1.2, fills: 'both', runs: (b) => [{ role: 'caption', text: b?.label }] },

  // ── SET PIECES ──
  codeBlock: {
    fixed: 1.8,
    // `either`, and it is the wordmark's case rather than a panel's: a line of
    // code cannot wrap — a break somebody did not write is a different program on
    // the screen — so 64 monospace characters across a 906 px measure are 22 px of
    // type and the panel is as tall as that makes it. It fills its measure; the
    // height is the content's answer.
    fills: 'either',
    runs: (b) => runs(b?.lines).map((line) => ({ role: 'body', text: line?.text, mono: true, nowrap: true })),
  },
  solidScene: { fixed: 22, fills: 'minor', runs: () => [] },
  /*
   * A line of type with thickness — so a line of type's appetite, plus the room
   * the thickness projects into.
   *
   * `either` and `nowrap`, which is `logoType`'s row rather than `funTitle`'s and
   * is the whole typographic decision of the block: an extruded line that WRAPS
   * is two lines at two depths with an extrusion between them, and the second
   * reads as a shadow of the first. An unbreakable run is bounded by
   * `cappedByWidth` at its whole length across the measure, which is stricter
   * than `wordCeiling`'s longest word by definition — so "a word is not cut in
   * half" holds here by construction rather than by a declaration a browser
   * falls back to.
   *
   * 0.5 of furniture and not 0. The thickness lies along the DEPTH axis, so most
   * of it costs no height at all; what does is the projection — the extrusion at
   * the tilt, and the near end of a turned line magnified by the camera. Half a
   * body unit is 0.21 of a display size, and the widest either term reaches is
   * under a tenth of it. `spatialType.test.js` holds the inequality; the room is
   * not a taste, it is `funTitleHeadroom`'s argument applied to a lens.
   */
  extrudedType: {
    fixed: 0.5,
    fills: 'either',
    runs: (b) => [{ role: b?.level === 'title' ? 'title' : 'display', text: b?.text, nowrap: true }],
  },

  // ── FIELDS IN VOLUME ──
  //
  // The field tier, and these three are the clearest case for it there is:
  // a dust, a swelling surface and a floor running away from the eye are the
  // SCENE when they are in it, so one of them beside a heading takes the frame
  // and leaves the heading a band — which is the arrangement anybody who writes
  // those two lines meant. `both`, because a field that leaves a quarter of its
  // box empty has nothing else in that box, and `runs: []` because none of the
  // three sets a single character: they are the surface type stands on, and a
  // field with no text declares nothing and forbids nothing (`FIELD_FOOT`).
  particleField: { fixed: 22, fills: 'both', runs: () => [] },
  waveMesh: { fixed: 22, fills: 'both', runs: () => [] },
  depthGrid: { fixed: 22, fills: 'both', runs: () => [] },
}

/**
 * A kind's appetite, or a body-sized one.
 *
 * The fallback is reached only if this table and `BLOCK_KINDS` disagree, which
 * `blocks.test.js` is what prevents — and a block laid out as a line of running
 * text beats a block laid out at `NaN` px, which is a scene with everything piled
 * at the origin (Q1).
 */
export function blockAppetite(kind) {
  return typeof kind === 'string' && Object.hasOwn(BLOCK_APPETITE, kind)
    ? BLOCK_APPETITE[kind]
    : { fixed: 1.4, fills: 'either', runs: () => [] }
}

/**
 * A SUBJECT TAKES THE SCENE; A PIECE OF FURNITURE TAKES THE PART THAT COMES TO IT.
 *
 * The collapse that hands a lone block the whole safe area was paid for by a whole
 * pass against the small element in a large void, and it is right about almost
 * every kind: a picture, a chart, a headline or a quote alone in a scene IS the
 * scene, and anything less than the frame is that defect coming back. It is wrong
 * about seven of them, and a rendered frame is what said so — a `lowerThird` alone
 * over a photograph came back as a full-frame card hiding three fifths of the
 * picture. A name band is not a scene about a name.
 *
 * ── What decides it, and it is not how much text a kind carries ──────────────
 *
 * WHERE THE SIZE COMES FROM. A subject is dimensioned by what is around it: give
 * it more room and it is a larger version of itself, which is the whole of the
 * rule at the top of this file. A piece of furniture is dimensioned by the FORMAT
 * — a broadcast lower third is a sixth of the frame because that is what a lower
 * third IS, and one that fills the frame is not a bigger lower third, it is a
 * card. The test is a sentence anybody can apply to a twenty-eighth block: does
 * this thing get larger when the scene does, or does it only get wrong?
 *
 * ── The seven, each with the sentence that classifies it ─────────────────────
 *
 *   - `lowerThird` — the case that made the rule. Its grammar is that something
 *     else is behind it; a band with nothing behind it is a title card that has
 *     lost its title.
 *   - `kicker` — a surtitle is a surtitle OF something. It was already 200 px of
 *     capitals over the graph it captioned; the field ceiling closed that when a
 *     field was on the frame, and this closes it when nothing is.
 *   - `dateStamp` — a stamp. One line, small, in a corner: the kicker's sentence
 *     with a different run.
 *   - `separator` — a rule. Its thickness is a constant metric already, so a whole
 *     frame of it buys nothing but air, and `BLOCK_APPETITE` says what a rule is
 *     worth: one unit.
 *   - `progressBar` — a meter. It reads as a proportion of something, and the
 *     something is never the frame.
 *   - `notification` — a toast: an object that arrived over whatever was there. At
 *     full frame it is a card that has lost the thing it was notifying about.
 *   - `button` — a control, sized to be pressed. One that fills the frame reads as
 *     a coloured slab with a word on it.
 *
 * ── And the ones deliberately NOT here, because a rule is what it refuses ─────
 *
 * `heading`, `funTitle`, `quote`, `textHighlight`, `typewriter`, `animatedList`,
 * `counter`, `logoType`, `form`, `codeBlock` and every field are subjects: a title
 * card, a pull quote, a number, a wordmark, a sign-up form and a picture are all
 * scenes somebody meant to make. `logoType` is the one worth naming twice, since
 * a wordmark in a corner is furniture in every ordinary sense — but a wordmark
 * alone on a frame is a title card, and a name band alone on a frame is a mistake.
 * What keeps a corner wordmark beside its neighbours is `harmoniseUnits`, which is
 * a different question with a different answer.
 */
export const BLOCK_FURNITURE = [
  'separator',
  'progressBar',
  'kicker',
  'dateStamp',
  'notification',
  'button',
  'lowerThird',
]

/** Whether a kind is furniture. A name off a document, so it is matched and never looked up. */
export function isFurniture(kind) {
  return typeof kind === 'string' && BLOCK_FURNITURE.includes(kind)
}

/**
 * The blocks that are a GROUND, and are therefore drawn to the frame's own edges
 * rather than to the safe area.
 *
 * ── The export that made this necessary ─────────────────────────────────────
 *
 * A `waveMesh` anchored `full`, alone on a 16:9 scene, came back as a green
 * rectangle with 115 px of bare ground down the left edge and 74 px across the
 * top — a hard-cornered inset on all four sides. The same is true of a
 * `depthGrid` and of a `particleField`, and it is not a bug in any of the three:
 * `full` means the safe area, every block in the catalogue is laid out in it, and
 * for a chart or a picture that is exactly right.
 *
 * It is wrong for these three, and the schema says why in their own words: they
 * are *"three grounds with a depth to them… the answer to 'the background should
 * be in 3D'"*. The thing they are being asked to replace is
 * `scene.background`, which `ComposedSceneVideo` paints as an `AbsoluteFill` —
 * edge to edge, because a ground that stops short of an edge is not a ground. So
 * a document that asks for a 3D ground and gets a rectangle floating inside a
 * margin does not read as a composition decision; it reads as a render that
 * failed to fill, which is the "very very rudimentary" this module keeps being
 * told about.
 *
 * ── What it does NOT change ─────────────────────────────────────────────────
 *
 * Only the BOX of the `full` zone, and only when that zone holds nothing but
 * grounds. Every CELL is laid out exactly where it was, so nothing measured
 * moves: a run inside the safe area was over the field before this change and is
 * over the same field after it, which is what keeps `stackedField` and
 * `FIELD_PAINTS` true without a line of either being touched. What a bled ground
 * covers that it did not cover before is margin — a band no block has ever been
 * laid out in.
 *
 * ── The three, and why the list is short on purpose ─────────────────────────
 *
 * `particleField`, `waveMesh`, `depthGrid`: the three the schema files under
 * FIELDS IN VOLUME. `gallery`, `imageFrame`, `map`, `barChart` and the rest stay
 * out of it and the test is the same sentence `BLOCK_FURNITURE` uses — is this
 * thing the SURFACE, or a thing standing on one? A photograph bled to the frame
 * is a treatment a document asks for (`imageFrame`'s own `bleed`) and never one
 * it gets by anchoring; a chart bled to the frame is a chart with its axis
 * labels in the feed's interface.
 */
export const BLOCK_GROUNDS = ['particleField', 'waveMesh', 'depthGrid']

/** Whether a kind is a ground. Matched, never looked up, for `isFurniture`'s reason. */
export function isGround(kind) {
  return typeof kind === 'string' && BLOCK_GROUNDS.includes(kind)
}

/**
 * Whether a `full` stack is nothing but grounds, and may therefore bleed.
 *
 * Shaped like `furnitureStack` and read the same way. A `full` zone holding a
 * ground AND something else keeps the safe box: the something else is a block
 * `stackIn` divided the zone for, and dividing a bled frame would put it in the
 * band a feed draws its own interface over.
 */
export function groundStack(blocks) {
  const list = Array.isArray(blocks) ? blocks : []
  return list.length > 0 && list.every((block) => isGround(block?.kind))
}

/**
 * The whole frame, plus the room the stack drifts through.
 *
 * The drift is `composedFrame`'s own lesson one level out, and in the opposite
 * direction. There, the boxes are pulled INSIDE the safe area by `driftRoom` so
 * that translating the stack cannot push them past the promise. Here the box has
 * to be pushed OUTSIDE the frame by the same amount, because the zone drifts with
 * everything else: a ground laid out flush with the frame uncovers a strip of
 * bare colour along the top edge on the last frame of every scene — 8.6 px, the
 * same number and the same defect, arriving from the other side.
 *
 * Horizontally there is nothing to add: the drift is a `translateY`.
 */
export function composedBleed(width, height) {
  const w = Math.max(0, Math.round(Number(width) || 0))
  const h = Math.max(0, Math.round(Number(height) || 0))
  const room = driftRoom(frameBase(w, h))
  return { left: 0, top: -room, width: w, height: h + 2 * room }
}

/**
 * What a scene is worth, in units of the body type size — the density behind the
 * field tier of `BLOCK_APPETITE`, and the same number rather than a second one.
 *
 * "A frame that carries twenty lines of running text is a frame, and one that
 * carries ten is a poster." Twenty-two units across a safe area is a body line at
 * about 4% of the short edge and a caption at 2.7%. `composition.test.js` pins it
 * against the table's own field entries, because two densities that drift are a
 * `map` and a `lowerThird` disagreeing about how big a frame is.
 */
export const SCENE_UNITS = 22

/**
 * The unit a stack of FURNITURE may read: its share of a scene, and never its
 * share of the box it happened to be given.
 *
 * `Infinity` for anything else, which is most stacks — a subject alone on a frame
 * still takes the frame, and that is the guarantee this must not spend.
 *
 * Three things about the shape of it:
 *
 *   - It bounds the UNIT and not the box, for `harmoniseUnits`'s reason: `stackIn`
 *     recomputes the heights at whatever unit arrives, so the block still FILLS
 *     the box it is given and the leftover is spent by the zone's own alignment.
 *     Bounding the box instead would leave a block drawing at a unit its box no
 *     longer holds, which is the overflow the scale exists to make impossible.
 *   - It is measured against the SAFE AREA and not against the zone, because the
 *     whole claim is that furniture is sized by the format. A band in a third of a
 *     frame and a band alone on one are the same band.
 *   - ALL of the stack, never one block of it. The unit belongs to the stack, so
 *     lowering it for a `kicker` above a `heading` would shrink the heading too —
 *     and a stack holding a subject is a stack the subject is entitled to size.
 *     Mixed stacks are already right: `stackIn` divides a zone by appetite, so the
 *     kicker takes its 1.6 units against the heading's 4.
 */
export function furnitureStack(blocks) {
  const list = Array.isArray(blocks) ? blocks : []
  return list.length > 0 && list.every((block) => isFurniture(block?.kind))
}

export function furnitureCeiling(blocks, safeHeight) {
  return furnitureStack(blocks) ? Math.max(0, Number(safeHeight) || 0) / SCENE_UNITS : Infinity
}

/** A block as the solver sees it: its furniture, and its runs of text. */
export function blockShape(block) {
  const appetite = blockAppetite(block?.kind)
  return { fixed: appetite.fixed, runs: appetite.runs(block ?? {}) }
}

/** How tall a block draws at a given unit, across a given measure. */
export function blockHeight(block, width, unit) {
  return shapeHeight(blockShape(block), width, unit)
}

/**
 * What a block DRAWS in the box it was given — the contract, as arithmetic.
 *
 * Every one of the twenty-seven is written against this function: the dimensions
 * it answers are the dimensions the component has to produce, so a block that
 * quietly kept a fraction of `base` disagrees with a number a test can compute.
 * That is the whole of section D — it is pure, it takes a box, and doubling the
 * box doubles everything in the answer except the constant metrics.
 *
 * The width is where the kinds differ, and the difference is honest rather than
 * tidy. A field takes its box, because a field with a quarter of its box empty
 * has nothing else in that box. A run of type takes the width its own words take
 * at the size the box allowed — which is a fraction the layout does not get to
 * choose, since two letters cannot fill a landscape measure without being taller
 * than the box. A rule takes the share the document asked for.
 *
 * `unit` is the stack's, when there is a stack. Left out, the block is solved
 * alone in the box — which is the right answer for a lone block and the WRONG one
 * for a block with a neighbour: a staircase has flat treads, so a block re-solved
 * on its own box can come back a step larger than the unit its zone agreed on,
 * and two blocks in one zone at two units is the defect this scale exists to
 * close. `composedLayout` therefore publishes the unit next to the box, and a
 * block reads both.
 */
export function blockExtent(block, box, base, unit) {
  const width = Math.max(0, Number(box?.width) || 0)
  const height = Math.max(0, Number(box?.height) || 0)
  const kind = String(block?.kind ?? '')
  const appetite = blockAppetite(kind)
  const shape = blockShape(block)
  const at = Number(unit)
  const solved = Number.isFinite(at) && at > 0 ? at : solveTypeUnit([shape], width, height)
  const drawn = Math.min(height, shapeHeight(shape, width, solved))

  if (kind === 'separator') {
    // The air IS the block: a rule with nothing around it is a border, and what
    // makes a separator a separation is the room it holds open. Its thickness is
    // the constant metric, which is why its height is not measured against its
    // box and its width is.
    return { width: width * declaredShare('separator', block?.extent, 'measure'), height, thickness: hairline(base, box) }
  }
  if (appetite.fills === 'minor') {
    // A square block: it draws to one bounding radius, so what it can fill is the
    // smaller side of its box and the leftover on the other axis is air the zone's
    // own alignment spends. This was `kind === 'solidScene'` while a solid was the
    // only round thing in the catalogue; `fills: 'minor'` is the same claim made
    // in the weight table, where the fill test already reads it, so a second round
    // kind cannot arrive with the claim and without the branch.
    //
    // `declaredShare` answers 1 for a kind with no share table, which is what
    // makes a `globe` — which has no `size` — the whole of its own box.
    const side = Math.min(width, height) * declaredShare(kind, block?.size, 'medium')
    return { width: side, height: side }
  }
  if (appetite.fills === 'both') return { width, height: drawn }

  // Type: the longest run wins the measure, and a run that wrapped has used all
  // of it by definition.
  let widest = 0
  const spent = Math.min(solved, shapeCeiling(shape, width))
  for (const run of shape.runs) {
    const role = typeRole(run.role)
    const advance = runAdvanceEm(run)
    const size = spent * role.step
    const lines = run.nowrap
      ? (String(run.text ?? '').trim().length ? 1 : 0)
      : textLines(run.text, size, width, run.tracking, advance)
    if (lines === 0) continue
    widest = Math.max(widest, lines > 1 ? width : Math.min(width, textWidth(run.text, size, run.tracking, advance)))
  }
  return { width: widest, height: drawn }
}

/**
 * A FIELD IS NOT A UNIFORM SURFACE: THESE ARE THE KINDS THAT DECLARE WHERE THEY
 * SET TYPE.
 *
 * An export showed the gap in the sentence "a `full` block is what an element sits
 * on": a `kicker` anchored `bottom-center` over a `barChart` anchored `full` landed
 * exactly on the chart's row of axis labels. Two runs of type in the same band,
 * three labels unreadable. Both were at the right SIZE — the field ceiling and the
 * band split had done their work — so nothing about the scale could have caught it.
 * The conflict is positional: a field that draws text at the foot of its box and a
 * cell that draws text at the foot of the frame are drawing in the same place.
 *
 * ── Why the field declares, rather than the cell moving ──────────────────────
 *
 * The other repair was to push a cell laid on a field towards a band the field
 * leaves free. It is cheaper and it is wrong twice. It would MOVE a block the
 * document anchored — `anchor` is the one composition decision a document makes,
 * and a bottom-centre kicker relocated to the top is a film that did not do what it
 * was told. And it has to guess: only the block knows where its own caption goes,
 * so a rule written in the layout would be right about `barChart` by luck and about
 * the twenty-eighth kind not at all.
 *
 * Declaring costs one table and one number per scene, and what it buys is
 * arithmetic: the cells are laid out in the safe area LESS the band the field
 * reserved, so no cell box can enter it. The reservation is the layout's own
 * subtraction, exactly like the gutter between two zones.
 *
 * ── All three are a FOOT, and that is not a coincidence ─────────────────────
 *
 * A caption goes under the thing it captions. `barChart` and `lineChart` set their
 * labels under the plot and `imageFrame` its caption under the picture — three
 * components written by three hands, all three with the run last in a column. So
 * there is one edge here and not two, and a kind that one day sets type at the TOP
 * of its box is a new question rather than a new row: it would need the stack
 * pinned the other way (see `composedLayout`), and pinning both ends at once is not
 * something one stack can do.
 *
 * ── The entry condition is `fills: 'both'`, and `clock` is why ───────────────
 *
 * A block can only promise where its foot is if it FILLS its box on that axis. A
 * dial does not: it is round, so it fills the minor one and floats in the middle of
 * the other — on a 9:16 frame a full-frame `clock` is 907 px of dial in 1305 px of
 * safe height, and its label sits 175 px above the bottom of its own box. A band
 * reserved at the edge would be a band reserved where nothing is drawn, and the
 * label would still be sitting where a cell is. `clock` therefore declares nothing,
 * and `composition.test.js` holds the entry condition rather than this paragraph.
 *
 * ── What else is deliberately not in it ──────────────────────────────────────
 *
 * A field that carries no text declares nothing and forbids nothing: the poorest
 * document the schema accepts — a gallery, a solid, a wave, a chart with no labels
 * — lays out exactly as it did, which is the case this must not break.
 *
 * Furniture is not in it either, and that is the other half of `BLOCK_FURNITURE`:
 * a `progressBar` sets its label ABOVE its track, but a piece of furniture anchored
 * `full` no longer fills the safe area — it is a small block centred in it, and its
 * label is in the middle of the frame rather than at the top edge. Text blocks are
 * out for the same reason from the other side: a `heading` anchored `full` is type
 * all the way through, and a cell stacked on it is an arrangement no reservation
 * can rescue.
 */
export const FIELD_FOOT = ['barChart', 'lineChart', 'imageFrame', 'solidChart']

/**
 * The band at the bottom of its own box in which a block sets type, in pixels.
 *
 * The runs are the block's own (`BLOCK_APPETITE`), measured by `shapeHeight` at the
 * unit its stack solved — the same arithmetic that sized the box in the first
 * place, which is what makes this an estimate the component agrees with rather than
 * a second guess about it. `RUN_GAP` is the air above the run and it is the number
 * `runBand` already spends in `blocks/media.js`.
 *
 * It over-reserves in two directions and both are deliberate: `labelBand` shrinks a
 * chart's labels to fit one column and drops them below `LABEL_FLOOR`, and
 * `harmoniseUnits` only ever lowers the unit this was computed at. Reserving a band
 * a little taller than the type that lands in it costs a cell a few pixels of its
 * own; reserving one too short is the defect back.
 */
export function footBand(block, width, unit) {
  if (!FIELD_FOOT.includes(String(block?.kind ?? ''))) return 0
  const at = Math.max(0, Number(unit) || 0)
  const text = shapeHeight({ fixed: 0, runs: blockShape(block).runs }, width, at)
  return text > 0 ? text + RUN_GAP * at : 0
}

/**
 * The margin a composed frame keeps from its own edges, per axis, when nothing
 * is drawn over it.
 *
 * Broadcast overscan, the same thing the slideshow's own padding is about: a
 * frame can lose its outer few per cent to a display that crops, and a heading
 * anchored `top-left` should not be the element that discovers it. Six per cent
 * of EACH axis rather than of the width on all four sides — a percentage in CSS
 * resolves against the width, which is why the first version put a 65 px margin
 * on the 1920 px edge of a portrait frame and a 115 px one on the 1080 px edge of
 * a landscape one, the wrong way round in both.
 */
export const COMPOSED_SAFE_PERCENT = 6

/**
 * The room the stack's own DRIFT needs, at the top of the safe area and at the
 * bottom of it, in pixels.
 *
 * A composed scene translates its whole stack by `motion.drift × base`, which runs
 * from `+COMPOSED_BLOCK_DRIFT/2` on the first frame to `−COMPOSED_BLOCK_DRIFT/2` on
 * the last — 8.6 px either way on a 1080-line frame. The boxes tile the safe area
 * exactly, so the top band's first block crossed the safe TOP at the end of every
 * scene and a bottom-anchored one crossed the safe BOTTOM at the start of it. A
 * rendered corpus is what showed it: the ink of four solid-ground exports began 5
 * to 6 px above the margin, which is `(0.5 − 0.75) × 0.016 × 1080` to the pixel.
 *
 * Nothing was cropped by it — 6% of a landscape frame is 65 px and the bleed is a
 * tenth of that. What it cost is the guarantee, and the guarantee is the reason the
 * boxes are pixels rather than percentages: "a number a test can read is also a
 * margin a test can prove nothing crosses". On 9:16 it is not academic either, since
 * the bottom band is the feed's own caption row rather than overscan.
 *
 * The layout RESERVES it rather than the motion giving it up, which is the same
 * trade `FIELD_FOOT` makes one paragraph down and the one `overlay` already argues
 * for: a move is allowed the amplitude the layout leaves it, and "every pixel
 * visible at rest is visible on every frame" is a property of the pair. Half the
 * travel on each edge, rounded up, because the drift is symmetric about the middle
 * of the scene.
 */
export function driftRoom(base) {
  return Math.ceil((Math.max(0, Number(base) || 0) * COMPOSED_BLOCK_DRIFT) / 2)
}

/**
 * The part of the safe area a composed scene actually lays its zones out in: the
 * safe area, less the drift's room on each of the two edges it moves towards.
 *
 * Separate from `composedSafeArea` on purpose. That one is the PROMISE — the band
 * a feed application draws its own interface over, which is a fact about somebody
 * else's software — and this is what the composition allows itself inside it. Two
 * functions, so a test can say "the boxes are inside the frame" and "the frame plus
 * the drift is inside the promise" as two separate sentences, rather than checking
 * one number against itself.
 */
export function composedFrame(width, height) {
  const safe = composedSafeArea(width, height)
  const room = driftRoom(frameBase(width, height))
  return {
    left: safe.left,
    top: safe.top + room,
    width: safe.width,
    height: Math.max(0, safe.height - 2 * room),
  }
}

/**
 * The gutter between two zones of the 3×3 grid, as a fraction of the SHORT edge.
 *
 * Off the short edge like every other size in this directory (`frameBase` says
 * why), so the grid of a 9:16 export has the same gutters as a 16:9 one instead
 * of gutters 1.78× wider in one direction.
 */
export const COMPOSED_CELL_GAP = 0.03

/** The gap between two blocks STACKED in one zone. Tighter than the gutter: they belong together. */
export const COMPOSED_STACK_GAP = 0.024

/**
 * How much of the safe area a field's declared foot may take from the cells — a
 * quarter, the same ceiling `CONSTANT_METRICS` is bounded at and for the same
 * reason.
 *
 * A reservation is the layout giving one block's caption priority over every other
 * zone, and an exception with no ceiling is the rule going back out of the window:
 * a caption bounded at `BLOCK_LIMITS.caption` in a legal box never comes near this,
 * so what it really bounds is the disagreement between a bound and a box. Cells
 * with no height are stacks solved at a unit of zero, which is a scene with
 * everything piled at the origin (Q1).
 */
export const FIELD_FOOT_CEILING = 0.25

/**
 * Which of the three tracks an alignment names, and how text sits in it.
 *
 * Derived from `ANCHOR_CELLS` rather than written a second time: a table of nine
 * anchors against a grid position is a table that can disagree with the one above
 * it, and the disagreement would be a block drawn in the wrong corner with
 * nothing anywhere saying so. `stretch` names no track, which is exactly what
 * `full` is — the zone that is not a cell.
 *
 * These two are looked up plainly rather than through `Object.hasOwn`, and that
 * is the one place in this file where that is safe: the key is a value out of
 * `ANCHOR_CELLS` above, never a string off a document. `anchorName` is where a
 * document's own word is made safe, once.
 */
const TRACK_OF = { 'flex-start': 0, center: 1, 'flex-end': 2 }
const TEXT_OF = { 'flex-start': 'left', center: 'center', 'flex-end': 'right', stretch: 'center' }

/** `full` first: a field is what an element sits on. See `composedLayout`. */
const ZONE_ORDER = ['full', ...ANCHORS.filter((anchor) => anchor !== 'full')]

/**
 * The part of the frame a composed scene is allowed to put things in.
 *
 * Two regimes, and the split is the one `VERTICAL_SAFE_TOP_PERCENT` already
 * argues for: a 9:16 export exists to be POSTED, and a feed application draws its
 * own interface over the video — the caption and the sound row along the bottom,
 * the action rail up the right, the tabs across the top. A `bottom-center` block
 * inside a 6% margin there is not close to an edge, it is behind a button. So a
 * portrait frame pays the feed's bands and the other two pay overscan, and the
 * numbers are the vertical template's own rather than a second set that would
 * drift from them for no reason.
 *
 * `height > width` is the whole test because the catalogue has exactly three
 * ratios and one of them is taller than it is wide — `productLayout` splits on
 * the same comparison for the same reason. A square is not a feed frame: 1:1 is
 * posted into a grid, not under a caption row.
 *
 * The edges are rounded OUTWARD — up on the near side, down on the far one — so
 * the area is never a fraction of a pixel wider than the margin it promised. To
 * nearest, a 230.4 px band came back as 230: invisible on a frame, and wrong in
 * the one direction that matters, since the band is a promise about somebody
 * else's interface rather than a taste in margins.
 */
export function composedSafeArea(width, height) {
  const w = Math.max(0, Number(width) || 0)
  const h = Math.max(0, Number(height) || 0)
  const feed = h > w
  const side = feed ? (VERTICAL_SAFE_SIDE_PERCENT / 100) * w : (COMPOSED_SAFE_PERCENT / 100) * w
  const above = feed ? (VERTICAL_SAFE_TOP_PERCENT / 100) * h : (COMPOSED_SAFE_PERCENT / 100) * h
  const below = feed ? (VERTICAL_SAFE_BOTTOM_PERCENT / 100) * h : (COMPOSED_SAFE_PERCENT / 100) * h
  const left = Math.ceil(side)
  const top = Math.ceil(above)
  return {
    left,
    top,
    width: Math.max(0, Math.floor(w - side) - left),
    height: Math.max(0, Math.floor(h - below) - top),
  }
}

/**
 * `count` tracks and their gutters across a span, as start/size pairs — divided
 * in the proportions `weights` asks for, or equally when it asks for nothing.
 *
 * Each edge is rounded rather than each size, so the tracks tile the span
 * exactly: the last one ends on `round(start + span)` whatever the arithmetic did
 * in between. Rounding sizes instead spends a pixel per track, and three of them
 * put the right-hand column past the margin it was measured from — a failure that
 * shows up on one ratio out of three and reads as noise.
 *
 * The weights are what makes a band a band rather than a third. `stackIn` has
 * divided a zone by APPETITE since the day a `separator` above a `heading` took
 * half the column for three pixels of ink, and the grid itself went on dividing
 * by COUNT: a scene of a surtitle, a title and a logotype gave the surtitle the
 * same 295 px as the title, so three quarters of the top band was empty and the
 * film's own headline was set at a third of the height it could carry. It is the
 * same defect one level up, and the fix is the same table.
 *
 * A zero weight is floored rather than honoured: a track nothing wants is a track
 * of no height, and a box of no height is a stack solved at a unit of zero (Q1).
 */
function split(start, span, gap, count, weights = null) {
  const total = Math.max(1, count)
  const asked = Array.isArray(weights) && weights.length === total ? weights : null
  const shares = Array.from({ length: total }, (_, i) => Math.max(WEIGHT_FLOOR, Number(asked?.[i]) || (asked ? 0 : 1)))
  const sum = shares.reduce((a, b) => a + b, 0)
  const room = span - (total - 1) * gap
  let cursor = start
  return shares.map((share) => {
    const track = (room * share) / sum
    const at = Math.round(cursor)
    const end = Math.round(cursor + track)
    cursor += track + gap
    return { start: at, size: Math.max(0, end - at) }
  })
}

/** The share a track nothing asked for still gets. See `split`. */
const WEIGHT_FLOOR = 0.001

/**
 * What a stack of blocks ASKS of the axis it stacks on, in units of the body
 * type size — the same currency `BLOCK_APPETITE` is written in.
 *
 * `shapeHeight` at a unit of one, which is the appetite with every run on a
 * single line: at that size the type is a pixel tall and nothing wraps, so what
 * comes back is furniture plus one line box per run that has text. Wrapping is
 * deliberately not in it — the band is decided before any unit is solved, and a
 * weight that depended on the unit would be a fixpoint rather than an answer.
 * A long heading in a narrow column therefore asks for a little less than it will
 * take, and gets it back through the alignment that spends a zone's leftover.
 */
function stackAppetite(blocks, width) {
  return blocks.reduce((sum, { block }) => sum + Math.max(0, shapeHeight(blockShape(block), width, 1)), 0)
}

/**
 * The blocks of one zone, each with the box it actually gets.
 *
 * This is the first clause of the rule at the top of the file, and it is the
 * arithmetic the other two rest on: until a block is handed its OWN box, "fill
 * your box" has nothing to mean. The zone's box was what every block received —
 * eight `solidScene` blocks anchored `full` were eight canvases of 589 px each,
 * 4712 px of content inside 950 px of safe height, in a picture of 2.07 Mpx.
 *
 * The split is by APPETITE and never by count: `solveTypeUnit` finds the one type
 * unit at which the whole stack fits the zone, and each block then takes the
 * height it draws at that unit. That is what makes a rule take a rule's worth of
 * the column and a heading take a heading's — see `BLOCK_APPETITE` for the table
 * and for the argument behind each tier.
 *
 * There is a leftover and it is content-bound rather than a slack somebody chose:
 * a line count is an integer, so the stack's height is a staircase in the unit and
 * the answer sits on the last tread that fits. Six list items of the same length
 * gain a line together, which is why the tread can be deep — and no size between
 * the two exists. It is spent according to the zone's own alignment, the property
 * that was already keeping a crowded stack inside the frame: a column in the top
 * band grows downward, one in the bottom band grows upward, and the middle one
 * grows both ways. Nothing here can put a box outside the zone, because the unit
 * was solved so that it could not.
 *
 * Edges are rounded rather than heights, for `split`'s own reason: rounding each
 * height spends a pixel per block, and eight of them put the last box past the
 * margin it was measured from.
 *
 * The unit is PASSED rather than solved here, because the zone is no longer the
 * last word on it: `harmoniseUnits` may lower it so that a caption alone in a
 * column is not drawn larger than a title in the column beside it. Lowering only
 * ever leaves room over — the heights below are recomputed at whatever unit
 * arrived, so the boxes still tile the zone and the leftover is spent by the same
 * alignment as the staircase's.
 */
function stackIn(box, layers, gap, justify, unit) {
  const shapes = layers.map(({ block }) => blockShape(block))
  const heights = shapes.map((shape) => Math.max(0, shapeHeight(shape, box.width, unit)))
  const drawn = heights.reduce((sum, at) => sum + at, 0) + Math.max(0, layers.length - 1) * gap
  const slack = Math.max(0, box.height - drawn)
  let cursor = box.top + (justify === 'center' ? slack / 2 : justify === 'flex-end' ? slack : 0)

  const placed = layers.map((layer, i) => {
    const top = Math.round(cursor)
    const bottom = Math.round(cursor + heights[i])
    cursor += heights[i] + gap
    return { ...layer, unit, box: { left: box.left, top, width: box.width, height: Math.max(0, bottom - top) } }
  })
  return { unit, layers: placed }
}

/**
 * Where every block of a composed scene goes: one entry per zone that holds
 * something, in paint order.
 *
 * ── The rule for two blocks in one zone, and why it is stacking ──────────────
 *
 * They STACK, vertically, in the order the document listed them. The alternative
 * was to refuse the document at validation, and it is the wrong trade twice over.
 * A refusal there would have to be a rule the model can follow — "never anchor
 * two blocks to the same zone" — which turns nine zones into a maximum of nine
 * blocks and makes the common case (a kicker over its heading, a heading over its
 * rule) something a document has to spell out by inventing an anchor for each
 * line. And it would refuse the SILENT document: `anchor` defaults to `center`,
 * so a model that omits it on two blocks would be told its film is illegal for
 * saying nothing, which is the `kenBurns: 'static'` lesson in reverse.
 *
 * Stacking makes the default correct instead: a scene whose blocks name no anchor
 * at all is a centred column, which is what a stack of blocks should look like
 * when nobody said otherwise.
 *
 * The zone's own alignment is what keeps a crowded stack inside the frame. A
 * column in the top row grows DOWNWARD from its cell, one in the bottom row grows
 * upward, and the middle grows both ways — so a stack too tall for its cell
 * spills towards the middle of the frame and never past the edge it was anchored
 * to. That is a property of the alignment rather than a clamp, which matters
 * because the height a block actually draws is not something this file can know.
 *
 * `full` is first in the list and therefore painted first, under the nine cells:
 * a map, a wave or a gallery is a FIELD, and an element anchored `center` on top
 * of it is the arrangement anybody writing those two blocks meant. Two `full`
 * blocks divide the safe area between them by the same arithmetic that divides a
 * cell (`stackIn`) — one rule for all ten zones, not nine and an exception. They
 * used to divide it EQUALLY, through a `flex: 1 1 0` in the composition, which is
 * the same defect as an even split anywhere else: a field and a rule are not
 * equally hungry.
 *
 * ── A row is divided among the columns that are USED ─────────────────────────
 *
 * A fixed 3×3 of equal thirds is the obvious reading of "nine zones" and it makes
 * the commonest scene there is unreadable. `anchor` defaults to `center`, so a
 * document that names none puts everything in one cell — and a cell a third of a
 * 16:9 frame wide is 563 px, which is five characters of display type on a line.
 * The zone is a POSITION; the width belongs to whatever else is beside it.
 *
 * So each row band is split among the columns that hold something, in order. One
 * column used takes the whole measure, two take half each, three take thirds —
 * and the alignment still says which edge the content sits on, so a lone
 * `top-left` block is at the left margin with room to run rather than boxed into
 * a third. Nothing overlaps at any of the three, because the split is the same
 * arithmetic the grid was.
 *
 * The bands are divided the same way, among the rows that hold something — it was
 * the same defect one axis over, and 295 px of a 16:9 safe area is a stack sized
 * for a third of a picture with the other two thirds empty.
 *
 * ── Unless a FIELD is on the frame, in which case the bands are the grid's ────
 *
 * Dropping an unused track is only right because the track is EMPTY. A block
 * anchored `full` is painted under the nine cells over the whole safe area, so
 * the rows a scene did not name are not empty at all — and a scene of an
 * `equalizer` and a `kicker` handed the kicker the entire safe area, which came
 * out as 200 px of capitals across the graph it was the surtitle of. With a field
 * on the frame the bands are the grid's own three; the columns still collapse,
 * because a height sets a type SIZE and a width sets a MEASURE, and a line
 * running the full measure of a field is what a line over a field should do.
 *
 * ── And a field is not a uniform surface: it says where it sets type ─────────
 *
 * "A `full` block is what an element sits on" was true about the paint order and
 * silent about the geometry. A `kicker` anchored `bottom-center` over a `barChart`
 * anchored `full` landed exactly on the chart's row of labels — two runs of type in
 * one band, both at the right size, so nothing about the scale could have caught
 * it. `FIELD_FOOT` is the declaration and the argument for making the field
 * declare rather than moving the cell; the subtraction is below, and it is one
 * number: the cells share the safe area LESS the band the field reserved.
 *
 * ── A block whose size comes from the FORMAT does not take the scene ─────────
 *
 * The collapse that hands a lone block the whole safe area is right about a
 * picture, a chart and a headline and wrong about a name band: a `lowerThird` alone
 * over a photograph came back as a full-frame card. `BLOCK_FURNITURE` is that
 * distinction and `furnitureCeiling` is what it costs — a bound on the unit of a
 * stack that holds nothing else, which is why a subject alone still takes
 * everything and a mixed stack is untouched.
 *
 * Timing is deliberately absent: `layerCues` answers when a block arrives and
 * this answers where it lands, and keeping them apart is what lets the motion be
 * checked on a document with no frame size and the layout on a frame with no
 * duration.
 */
export function composedLayout(scene, width, height) {
  const layers = Array.isArray(scene?.layers) ? scene.layers : []
  // The safe area LESS the drift's room, and never the safe area itself: the whole
  // stack is translated by up to `driftRoom(base)` towards either edge on every
  // scene, so laying out flush with the promise is the promise broken by exactly
  // that translation. See `composedFrame`.
  const frame = composedFrame(width, height)
  const base = frameBase(width, height)
  const gutter = Math.round(base * COMPOSED_CELL_GAP)
  const gap = Math.round(base * COMPOSED_STACK_GAP)

  // Which blocks each zone holds, in the order the document listed them. An
  // anchor this build does not know lands in `center`, like `anchorCell`'s own
  // fallback: the value was refused by `validate.js` long before a frame, so
  // reaching that branch means two lists disagree — and a block drawn in the
  // middle beats a block that silently vanished from a film somebody waited for
  // (Q1).
  const held = new Map()
  layers.forEach((block, index) => {
    const anchor = anchorName(block?.anchor)
    if (!held.has(anchor)) held.set(anchor, [])
    held.get(anchor).push({ index, block })
  })

  const used = [new Set(), new Set(), new Set()]
  for (const anchor of held.keys()) {
    const cell = ANCHOR_CELLS[anchor]
    if (TRACK_OF[cell.row] !== undefined) used[TRACK_OF[cell.row]].add(TRACK_OF[cell.column])
  }
  const columns = used.map((occupied) => {
    const order = [...occupied].sort((a, b) => a - b)
    const boxes = split(frame.left, frame.width, gutter, order.length)
    return new Map(order.map((column, i) => [column, boxes[i]]))
  })
  // The bands are divided among the rows that are USED, exactly as a row is
  // divided among its columns — and it is the same defect one axis over. A fixed
  // third of the safe height is 295 px of a 16:9 frame, so the commonest scene
  // there is (everything in `center`, because that is what `anchor` defaults to)
  // was a stack sized for a third of a picture with the other two thirds empty:
  // the void the rule at the top of this file is about, arriving through the
  // grid rather than through a block. The asymmetry the first version kept —
  // rows fixed, columns shared — was an argument about OVERFLOW, and it no
  // longer applies: a stack whose unit was solved against its band cannot be
  // taller than the band. What survives of it is the alignment, which still
  // decides which way the leftover is spent.
  //
  // ── Except that a FIELD claims every band, and no column ────────────────────
  //
  // Collapsing a track is only right because the track that was dropped is
  // EMPTY: a lone block takes the whole measure because there is nothing beside
  // it and the whole height because there is nothing above it. A block anchored
  // `full` makes the second half of that sentence false — it is painted under the
  // nine cells, over the whole safe area — and an export showed what that costs:
  // a scene of one `equalizer` and one `kicker` gave the kicker the entire safe
  // area, because `full` occupies no row of the grid, and a surtitle came out as
  // 200 px of capitals across a graph it was the surtitle OF. The biggest element
  // in the frame was the smallest role in the scene.
  //
  // So a field claims every band: with one on the scene the rows are the grid's
  // own three, a cell block gets a band rather than the frame, and a scene whose
  // only block IS the field still gives it everything (it reads no row — see
  // below — and there is no cell to divide the bands among).
  //
  // Columns are deliberately NOT treated the same way, and the asymmetry is the
  // difference between the two axes rather than a taste: a box's height is what
  // sets the type size, and its width is what sets the MEASURE. A block that
  // takes the whole width is a line that runs the full measure, which is what a
  // line over a field should do; a block that takes the whole height is the
  // scene, and the field was the scene. Collapsing the columns is also what keeps
  // a heading over a photograph off the 563 px third that made this rule
  // necessary in the first place.
  const field = held.has('full')
  const usedRows = [0, 1, 2].filter((row) => field || used[row].size > 0)
  // The box a `full` zone gets, needed here rather than in the loop below because
  // the field's own unit is what decides how much of the frame the CELLS are laid
  // out in — see the foot, next.
  const wholeFrame = { left: frame.left, top: frame.top, width: frame.width, height: frame.height }
  const blocksOf = (inZone) => inZone.map(({ block }) => block)
  // And the box a `full` zone gets when everything in it is a GROUND: the frame's
  // own edges, plus the drift's room on the two it moves towards. `BLOCK_GROUNDS`
  // carries the export that made it necessary — a lit sheet asked to be the
  // background of a scene came back as a rectangle inset by six per cent, which
  // reads as a render that failed rather than as a margin.
  const bledFrame = composedBleed(width, height)
  // A stack's own box decides its unit, unless the stack is furniture — whose scale
  // comes from the scene and not from the room it was left in. See
  // `furnitureCeiling`, and `BLOCK_FURNITURE` for what a piece of furniture is.
  const unitFor = (inZone, box) =>
    Math.min(
      solveTypeUnit(inZone.map(({ block }) => blockShape(block)), box.width, box.height, gap),
      furnitureCeiling(blocksOf(inZone), frame.height),
    )

  /*
   * The band the field paints text in, which the cells are then laid out ABOVE.
   *
   * A `kicker` anchored `bottom-center` over a `barChart` anchored `full` landed on
   * the chart's own row of labels: two runs of type in one band, both at the right
   * size, the conflict entirely positional. `FIELD_FOOT` is the declaration and the
   * argument for it; this is the subtraction.
   *
   * Three things make the arithmetic hold rather than nearly hold:
   *
   *   - it is the LAST block of the `full` stack, because that is the one whose box
   *     ends on the safe bottom;
   *   - the unit is the field's own, solved before `harmoniseUnits`, which only
   *     ever lowers it — so the band reserved is never shorter than the type that
   *     lands in it;
   *   - and one GUTTER of air, the grid's own, because a cell whose box ends
   *     exactly on a caption is touching it. Two things that are not the same
   *     object are separated by a gutter everywhere else in this file, and it is
   *     also what covers a picture block's own margin under its caption
   *     (`TILE_GUTTER` is four tenths of this one).
   */
  const inField = held.get('full')
  // Nothing declared is nothing reserved — the gutter belongs to the band and not
  // to the absence of one, or every field on earth would push the cells up by it.
  const band = inField ? footBand(inField[inField.length - 1]?.block, wholeFrame.width, unitFor(inField, wholeFrame)) : 0
  const foot = band > 0 ? Math.min(Math.round(band + gutter), Math.floor(frame.height * FIELD_FOOT_CEILING)) : 0
  /*
   * And the bands are divided by APPETITE, not by count.
   *
   * `stackIn` has divided a zone that way since a `separator` above a `heading`
   * took half a column for three pixels of ink; the grid went on dividing by
   * count, which is the same defect one level up. A real export showed it: a
   * surtitle, a title with its rule and its list, and a logotype — three used
   * rows, three equal bands, so the surtitle sat alone in 295 px of which it drew
   * 65, and the film's own headline was solved against a third of a frame that
   * had two thirds to spare. What that costs is not only air: a stack fills the
   * box it is given, so an over-large band is an over-large type unit, and the
   * logotype in the bottom band came back three times the heading in the middle
   * one. Weighted bands make the units agree by construction — every zone reads
   * roughly `safeHeight / (what the whole scene asked for)` — which is what
   * `harmoniseUnits` then only has to tidy rather than to rescue.
   *
   * A row's weight is the HUNGRIEST of its cells and not their sum: the columns
   * of one row sit side by side, so the band has to hold the tallest of them and
   * the others keep the leftover their own alignment spends.
   *
   * With a field on the frame the bands stay the grid's own three. A `full` block
   * is painted across all of them, so there is no row it is the appetite OF, and
   * a weight it cannot appear in would divide the frame among the cells as if the
   * field were not there.
   */
  const weights = field
    ? null
    : usedRows.map((row) => {
        let most = 0
        for (const column of used[row]) {
          const box = columns[row].get(column)
          for (const [anchor, inZone] of held) {
            const cell = ANCHOR_CELLS[anchor]
            if (TRACK_OF[cell.row] !== row || TRACK_OF[cell.column] !== column) continue
            most = Math.max(most, stackAppetite(inZone, box?.size ?? frame.width))
          }
        }
        return most
      })
  // Less the field's foot: the cells share what is left of the safe area, so the
  // bottom band ends where the field's caption begins.
  const bands = split(frame.top, frame.height - foot, gutter, usedRows.length, weights)
  const rows = new Map(usedRows.map((row, i) => [row, bands[i]]))

  // Every zone with the box it gets, before a single unit is solved: the scale is
  // a scene-wide question now (`harmoniseUnits`), so no stack can be laid out
  // until all of them have been measured.
  const placed = []
  for (const anchor of ZONE_ORDER) {
    const inZone = held.get(anchor)
    if (!inZone) continue
    const cell = ANCHOR_CELLS[anchor]
    const row = rows.get(TRACK_OF[cell.row])
    const column = columns[TRACK_OF[cell.row]]?.get(TRACK_OF[cell.column])
    // A `full` zone holding nothing but grounds is the SURFACE of the scene, and
    // a surface stops at the frame. Everything else keeps the safe frame, which
    // is what it has always had. See `BLOCK_GROUNDS`.
    const bleeds = anchor === 'full' && groundStack(blocksOf(inZone))
    const box = bleeds
      ? bledFrame
      : !row || !column
        ? { left: frame.left, top: frame.top, width: frame.width, height: frame.height }
        : { left: column.start, top: row.start, width: column.size, height: row.size }
    // `stretch` is a legal `align-items` and not a legal `justify-content`, so
    // the sharing zone is reported as a flag and a valid pair rather than as a
    // value the composition would have to translate.
    //
    // The pair is `center` and it used to be `flex-start`, which was the wrong
    // half of the same sentence. A field fills both axes and does not care; a
    // block anchored `full` that fills only ONE — a counter whose figure has
    // stopped growing at the measure, a `codeBlock` whose lines cannot wrap —
    // takes the height it takes and leaves the rest. Pinned to the top, that
    // leftover is a band of nothing under the block, which is exactly the void
    // this pass exists to remove: two real exports put a seven-digit counter in
    // the upper two thirds of a frame and eight lines of code in the top third of
    // a square. A band's own edge is the safe edge and that is why the nine cells
    // keep theirs; `full` has no edge to anchor to, so its leftover is spent
    // symmetrically.
    //
    // Unless it has DECLARED one. A field that reserved a foot has been promised a
    // band at the bottom of the safe area, and a promise about an edge is only true
    // if the block really ends on it: centred, a field whose unit `harmoniseUnits`
    // lowered would draw its caption above the band the cells were kept out of, and
    // the reservation would have moved the defect rather than removed it. Pinning
    // is what makes the subtraction exact at every unit.
    const justify = cell.row === 'stretch' ? (anchor === 'full' && foot > 0 ? 'flex-end' : 'center') : cell.row
    const shapes = inZone.map(({ block }) => blockShape(block))
    placed.push({
      anchor,
      box,
      share: cell.row === 'stretch',
      justify,
      align: cell.column,
      textAlign: TEXT_OF[cell.column] ?? 'left',
      inZone,
      // Whether this zone IS the field. `harmoniseUnits` reads it: a block
      // anchored `full` belongs to no band, so it is the one zone whose unit has
      // to bound the cells rather than be bounded by them.
      //
      // Furniture anchored `full` is deliberately not one. The clause says "the
      // field sets the scale of the scene", and a block that is sized by the format
      // sets no scale — a `lowerThird` anchored `full` capping every heading in the
      // frame to a band's own unit is that sentence read backwards.
      field: anchor === 'full' && !furnitureStack(blocksOf(inZone)),
      // Whether this stack was sized by the FORMAT rather than by its box, which
      // makes it worthless as evidence about the scene's scale. `harmoniseUnits`
      // reads it for the scale bound and deliberately not for the order one.
      furniture: furnitureStack(blocksOf(inZone)),
      // What this stack would read on its own, and what it puts on the frame for
      // the scene to compare it with.
      //
      // Against the box it really got, bled or not, because `stackIn`'s whole
      // guarantee is that a stack solved on a box FILLS that box: solved on the
      // safe frame and laid out in the bled one, a lone ground drew its 932 px in
      // a 1098 px zone and came back centred with a strip of bare colour above
      // and below it — the defect the bleed exists to remove, moved eighty pixels.
      //
      // It does raise the ceiling a field puts on the cells through
      // `harmoniseUnits`, by exactly the margin the ground gained, and that is
      // bounded rather than free: every cell box is where it was, so a heading
      // allowed a larger unit still cannot draw past a band that did not move.
      // What the clause was written against is a `kicker` at three times its
      // heading, not one at a fifteenth more.
      unit: unitFor(inZone, box),
      runs: drawnRuns(shapes, box.width),
    })
  }

  // One unit per zone still, and never one for the scene — but no zone may draw a
  // role larger than a superior role somewhere else in the same frame. See
  // `harmoniseUnits` for why that is an inequality rather than a shared unit.
  const units = harmoniseUnits(placed)
  const zones = placed.map((zone, i) => {
    const stack = stackIn(zone.box, zone.inZone, gap, zone.justify, units[i])
    return {
      anchor: zone.anchor,
      box: zone.box,
      share: zone.share,
      justify: zone.justify,
      align: zone.align,
      textAlign: zone.textAlign,
      // The type unit this zone's stack reads — ONE per stack, which is the half
      // of the fix that stops a figure from crushing a title beside it, bounded by
      // the scene's own order of roles, which is the half that stops a kicker
      // alone in a column from being three times the heading next to it.
      unit: stack.unit,
      // The band at the BOTTOM of this zone in which it sets type, and which the
      // nine cells were laid out above — `FIELD_FOOT` is the declaration, and 0 is
      // every zone that declares nothing, which is all of them but one. Published
      // rather than kept private because the guarantee it exists for is an absence,
      // and an absence is only checkable against the thing that was reserved.
      foot: zone.anchor === 'full' ? foot : 0,
      // Every block with the box it actually gets, never the zone's repeated.
      layers: stack.layers,
    }
  })
  return { frame, gutter, gap, zones }
}

/**
 * How dense an animated ground is at a given point in its scene.
 *
 * The curve lives here and not in the composition for the reason every other
 * number in this file does — and for one more that is specific to it: this is the
 * only quantity a composed film has that can UNDO the legibility guarantee.
 * `composedPalette` measured every run against the ground's tint at full
 * strength, so a pulse that ever went above 1 would be text on a surface nobody
 * measured. It is bounded below by `PULSE_FLOOR` and above by the density that
 * was measured, and the asymmetry is the whole argument: a layer that can only
 * ever get fainter cannot spend contrast the measurement promised. Same reasoning
 * `vertical` relies on when it keeps a directional gradient over a uniform dim.
 *
 * `gridPulse` beats faster than `particles` drift, which is the only difference
 * between the two and is why they share one function rather than each owning a
 * sine somewhere.
 */
export const PULSE_FLOOR = 0.4
const PULSE_CYCLES = { gridPulse: 6, particles: 4 }

export function groundDensity(kind, ground) {
  const cycles = Object.hasOwn(PULSE_CYCLES, String(kind)) ? PULSE_CYCLES[kind] : 0
  if (!cycles) return 1
  const life = Math.min(1, Math.max(0, Number(ground) || 0))
  return PULSE_FLOOR + (1 - PULSE_FLOOR) * (0.5 + 0.5 * Math.sin(life * Math.PI * cycles))
}

// ── The motion of one scene ──────────────────────────────────────────────────
//
// Every quantity that CHANGES between two frames of a scene, for all five
// compositions, computed here and read by the `.jsx` files rather than the other
// way round.
//
// It was written the other way round first, and that is what the user's report
// was about. Each composition worked out its own arrivals inline, so "does this
// scene move at all" was a question you could only answer by rendering it — and
// the answer for a `slideshow` whose document had left `kenBurns` unset was no.
// A still photograph, a caption laid on it with no entrance, held for fifteen
// seconds, delivered as a film. Every part of that was legal.
//
// So the motion joined the arithmetic, for the reason stated at the top of this
// file: arithmetic is the only part of a video a test can check. `sceneMotion`
// is what `tests/video-motion.test.js` compares between a scene's first frame
// and its last, which is a proof that no template can silently go still — and it
// is a proof about the FILM rather than about a model of it only because the
// compositions read the same object.
//
// Nothing here is a new vocabulary. Every term is `cueProgress`, `easeOutCubic`
// through `punchTransform`, or one of the two picture transforms; five notions of
// "an element arrives" is four of them drifting, and this is the file that says so.
//
// One rule governs the SHAPE of what comes back: a term appears only when the
// composition actually draws the thing it belongs to. A `caption` progress
// reported for a scene that carries no caption is a number that changes while the
// frame does not, and a test asking "did anything move" would have accepted it —
// which is the same failure as a schema field the renderer ignores, arriving
// through the one thing written to catch it.
//
// "Draws" is not only about what the SCENE carries, and that is where the rule
// was first broken: a kicker exists when the FILM has more than one scene, so
// every one-scene overlay and every one-scene titles card reported an arrival for
// a counter no frame contained. The label is therefore computed once, in
// `planTimeline`, and both this file and the composition read that one value.

/**
 * The beat before a slideshow caption arrives, in frames.
 *
 * Two frames, the same opening beat the banded template uses — long enough that
 * the picture is on screen first, short enough not to read as a delay. The
 * caption used to have no entrance at all: it was simply present from the first
 * frame, which on a `static` scene made the whole composition one still image.
 */
export const SLIDESHOW_CAPTION_OFFSET = 2

/** How long an `overlay` band takes to wipe in: a third of a second, ahead of its own text. */
export const BAND_REVEAL_FRAMES = 10

/**
 * How far a `titles` block travels over a whole scene, as a fraction of the short
 * edge — 1.6%, or 17 px.
 *
 * A drift and not an animation, and the same idea as `OVERLAY_DRIFT_PERCENT`
 * applied to type instead of to a picture: a still frame held for five seconds
 * reads as a stalled render even when it is exactly what was asked for, and the
 * smallest amount of movement that fixes that is less than the eye can name.
 *
 * Applied to the BLOCK and never to the ground, which is the legibility half of
 * the choice: the ground is the surface `titlesPalette` measured every run
 * against, and a ground that moved under fixed type would be text crossing a
 * surface nobody measured. Moving the type with its own ground behind it changes
 * no pair the palette resolved.
 */
export const TITLE_BLOCK_DRIFT = 0.016

/**
 * The move a `product` picture makes. Not a document field — this template has
 * none — but not nothing either: a product shot held perfectly still beside a
 * cascade of arriving text is the half of the frame that looks broken.
 */
export const PRODUCT_PICTURE_MOVE = 'zoom-in'

/** The `slideshow`: a picture that moves, and a caption that arrives on it. */
function slideshowMotion(entry, frame) {
  const { scene, durationInFrames } = entry
  const [captionCue] = cueFrames(1, durationInFrames, { offset: SLIDESHOW_CAPTION_OFFSET })
  return {
    picture: kenBurnsTransform(scene?.kenBurns, frame, durationInFrames),
    // The long entrance, like the banded title and the product headline: on a
    // slideshow the caption is the only line in the scene, so it is by definition
    // the one that has to be read.
    ...(scene?.textOverlay ? { caption: cueProgress(frame, captionCue, EMPHASIS_ENTER_FRAMES) } : {}),
  }
}

/** The `overlay`: a capture that drifts, and a block put down on it in four beats. */
function overlayMotion(entry, frame) {
  const { scene, durationInFrames } = entry
  // The block arrives, then its kicker, then the title, then the subtitle. One
  // arrival carrying everything reads as a caption; four read as somebody putting
  // a card down and then saying what is on it.
  //
  // All four cues are PLACED whether or not the scene carries all four elements,
  // for the reason `titlesMotion` gives: a title that landed at two different
  // moments depending on whether there was a subtitle under it would be two
  // rhythms in one film. Only the reporting is conditional.
  const [band, kicker, title, subtitle] = cueFrames(4, durationInFrames, { offset: 2, step: 5 })
  return {
    picture: overlayDriftTransform(scene?.move, frame, durationInFrames),
    band: cueProgress(frame, band, BAND_REVEAL_FRAMES),
    ...(entry?.label ? { kicker: cueProgress(frame, kicker) } : {}),
    title: cueProgress(frame, title, EMPHASIS_ENTER_FRAMES),
    ...(scene?.band?.subtitle ? { subtitle: cueProgress(frame, subtitle, CUE_ENTER_FRAMES) } : {}),
  }
}

/** The `vertical`: a cut that lands, a picture that moves, and a caption spoken word by word. */
function verticalMotion(entry, frame) {
  const { scene, durationInFrames } = entry
  const parts = words(scene?.textOverlay?.content)
  const cues = cueFrames(parts.length + 1, durationInFrames, { offset: 2, step: 3 })
  return {
    punch: punchTransform(frame),
    picture: kenBurnsTransform(scene?.kenBurns, frame, durationInFrames),
    ...(scene?.textOverlay
      ? {
          words: parts.map((_, i) => cueProgress(frame, cues[i])),
          rule: cueProgress(frame, cues[cues.length - 1]),
        }
      : {}),
  }
}

/** The `titles`: a block that drifts, and a cascade that lands on it. */
function titlesMotion(entry, frame) {
  const { scene, durationInFrames } = entry
  const parts = words(scene?.headline)
  const staggered = scene?.animation === 'stagger'
  // One cascade for the whole scene. Four separate calls would each fit on their
  // own and still overrun together, which is how a subtitle lands past the cut.
  const cues = cueFrames((staggered ? parts.length : 1) + 3, durationInFrames, {
    offset: 2,
    step: staggered ? 4 : 6,
    tailGap: CUE_TAIL_GAP_FRAMES,
  })
  const wordCues = cues.slice(1, cues.length - 2)
  return {
    // Halfway through the scene the block is where it would have been all along;
    // it arrives a little low and leaves a little high.
    drift: (0.5 - progressAt(frame, Math.max(1, durationInFrames - 1))) * TITLE_BLOCK_DRIFT,
    // Only when there is one to draw: a one-scene film has no counter, and its
    // cue is still placed above so the headline lands where it always does.
    ...(entry?.label ? { kicker: cueProgress(frame, cues[0]) } : {}),
    words: parts.map((_, i) =>
      cueProgress(
        frame,
        staggered ? wordCues[i] : wordCues[0],
        // The last word of a headline of several takes half a second where its
        // neighbours take three tenths — the emphasis is in the timing as well as
        // in the colour. See `EMPHASIS_ENTER_FRAMES`.
        parts.length > 1 && i === parts.length - 1 ? EMPHASIS_ENTER_FRAMES : CUE_ENTER_FRAMES,
      ),
    ),
    rule: cueProgress(frame, cues[cues.length - 2]),
    // The cue is placed whether or not there is a subtitle — the cascade's shape
    // must not depend on it, or a headline would land at two different moments in
    // two otherwise identical scenes — but it is only REPORTED when there is one.
    ...(scene?.subtitle ? { subtitle: cueProgress(frame, cues[cues.length - 1]) } : {}),
  }
}

/** The `product`: a picture that pushes in, and a card that enumerates and then concludes. */
function productMotion(entry, frame) {
  const { scene, durationInFrames } = entry
  const bullets = Array.isArray(scene?.bullets) ? scene.bullets : []
  const hasCta = Boolean(scene?.cta)
  const cues = cueFrames(1 + bullets.length + (hasCta ? 2 : 0), durationInFrames, {
    offset: 3,
    step: 7,
    tailGap: CUE_TAIL_GAP_FRAMES,
  })
  return {
    picture: kenBurnsTransform(PRODUCT_PICTURE_MOVE, frame, durationInFrames),
    headline: cueProgress(frame, cues[0], EMPHASIS_ENTER_FRAMES),
    bullets: bullets.map((_, i) => cueProgress(frame, cues[i + 1], CUE_ENTER_FRAMES)),
    ...(hasCta
      ? {
          closing: cueProgress(frame, cues[cues.length - 2]),
          cta: cueProgress(frame, cues[cues.length - 1]),
        }
      : {}),
  }
}

/**
 * How much a composed stack drifts over its scene — the same 1.6% the titled
 * card drifts, aliased rather than chosen again.
 *
 * Two notions of "a block breathes" is one of them drifting, which is the rule
 * this whole file is written under. And the reason it is the STACK that moves and
 * not the ground is the reason `TITLE_BLOCK_DRIFT` gives: the ground is the
 * surface `composedPalette` measured every run against, and a ground moving under
 * fixed type would be text crossing a surface nobody measured.
 */
export const COMPOSED_BLOCK_DRIFT = TITLE_BLOCK_DRIFT

/**
 * The grounds that move on their own, and therefore the ones that report a term.
 *
 * `solid` and `hairlines` do not, and that is the honest answer rather than a
 * gap: a composed scene moves through its blocks and its drift whatever it is
 * painted on, and reporting a `ground` progress for a field of static rules
 * would be a number that changes while the frame does not — the exact thing
 * `tests/video-motion.test.js` exists to catch.
 */
export const ANIMATED_BACKGROUNDS = ['gradient', 'gridPulse', 'particles']

/**
 * Whether the composition will actually paint the ground's second layer.
 *
 * The three animated grounds all move by moving that layer — a ramp slid across
 * the frame, a grid pulsing, a field of dots drifting — and `Ground` paints
 * nothing at all when `palette.groundTint` is empty. Which it can be: the tint
 * YIELDS. `texturedGround` drops it when the bare ground carries every run and
 * the tinted one does not, and `fieldedGround` drops it after the field has run
 * out of rungs. A decoration cedes to a word, and when it does, a `gradient`
 * scene is a flat colour.
 *
 * So the ground's progress has to follow the paint and not the kind. Otherwise
 * it is a number that changes while the frame does not — which is exactly what
 * the kicker used to report on every one-scene film, and exactly what a "did
 * anything move" test would accept.
 *
 * It is theoretical on today's corpus: `composition.test.js` sweeps six grounds
 * across a dozen real directions and the tint survives on every one of them. It
 * is written down anyway, because "no theme in the corpus fires this" is a
 * statement about the corpus, and the next direction somebody types is not in it.
 *
 * It answers for `solid` and `image` too, and the answer is no: neither has a
 * second layer at all. That costs the motion nothing — neither is in
 * `ANIMATED_BACKGROUNDS` — and it is what `Ground` reads to decide it has
 * nothing to draw, which is the point of having one function rather than two
 * readings of the same field.
 */
export function groundPainted(palette) {
  const tint = palette?.groundTint
  const layers = Array.isArray(tint) ? tint : tint ? [tint] : []
  return layers.length > 0
}

/** The ground a document names, or the field of hairlines silence means. */
export function backgroundKind(background) {
  const kind = background && typeof background === 'object' ? background.kind : undefined
  return typeof kind === 'string' && BACKGROUND_SURFACES.includes(kind) ? kind : 'hairlines'
}

/** The composable variant: a stack that drifts, a cascade that lands on it, and a ground. */
function composedMotion(entry, frame, { ground: paints = true } = {}) {
  const { scene, durationInFrames } = entry
  const layers = Array.isArray(scene?.layers) ? scene.layers : []
  const cues = layerCues(layers, durationInFrames)
  const life = progressAt(frame, Math.max(1, durationInFrames - 1))
  const kind = backgroundKind(scene?.background)

  // The stress mark of a cascade goes to the block that arrives LAST, and only
  // when it arrives alone: `enter` is a rank, so the last block written is not
  // necessarily the last one on screen, and an emphasis given to two blocks at
  // once is a tempo rather than an accent.
  const latest = cues.length ? Math.max(...cues) : 0
  const alone = cues.filter((cue) => cue === latest).length === 1

  return {
    // Halfway through the scene the stack is where it would have been all along;
    // it arrives a little low and leaves a little high.
    drift: (0.5 - life) * COMPOSED_BLOCK_DRIFT,
    layers: layers.map((_, i) =>
      cueProgress(
        frame,
        cues[i],
        alone && layers.length > 1 && cues[i] === latest ? EMPHASIS_ENTER_FRAMES : CUE_ENTER_FRAMES,
      ),
    ),
    ...(kind === 'image' ? { picture: kenBurnsTransform(scene?.background?.move, frame, durationInFrames) } : {}),
    // The KIND says the ground can move; `paints` says the composition still has
    // a layer to move. Both, because the tint yields — see `groundPainted`.
    ...(ANIMATED_BACKGROUNDS.includes(kind) && paints ? { ground: life } : {}),
  }
}

/**
 * The motion of a template, keyed exactly like `COMPOSITIONS` and `PALETTES`.
 *
 * Same shape and the same reason: a template that gains a composition without
 * gaining an entry here is a template whose movement nothing checks, and
 * `composition.test.js` iterates the three maps together so the omission fails
 * the suite rather than shipping a film that holds still.
 */
export const MOTIONS = {
  slideshow: slideshowMotion,
  overlay: overlayMotion,
  vertical: verticalMotion,
  titles: titlesMotion,
  product: productMotion,
  composed: composedMotion,
}

/**
 * Every moving quantity of one scene at one frame.
 *
 * Absent means `slideshow`, the same default `compositionIdFor` and the schema
 * both apply, because a document out of the queue's journal may predate the
 * catalogue. An unknown template answers with an empty object rather than
 * throwing: `compositionIdFor` has already refused it by name long before a frame
 * is drawn, and a throw inside Chromium turns a refusal the caller could read
 * into a render that died half a minute in.
 *
 * The fourth argument is what the composition has decided to PAINT, for the one
 * term no arithmetic here can work out on its own. A composed ground's second
 * layer survives or is dropped by the legibility search, which needs a theme, and
 * this file's motion has never been given one — so the composition passes the
 * answer down rather than the motion guessing it. Everything in it defaults to
 * the ordinary case, so a caller that knows nothing gets the film it always got
 * (`groundPainted` says why that is the right default).
 *
 * @param {string|undefined} template
 * @param {{scene: object, durationInFrames: number, label?: string}} entry  one entry of `planTimeline`
 * @param {number} frame  the frame WITHIN the scene, as Remotion's Sequence gives it
 * @param {{ground?: boolean}} [paints]  which optional layers the composition is drawing
 */
export function sceneMotion(template, entry, frame, paints = {}) {
  const name = template === undefined || template === null ? 'slideshow' : template
  if (typeof name !== 'string' || !Object.hasOwn(MOTIONS, name)) return {}
  const at = Number.isFinite(Number(frame)) ? Number(frame) : 0
  return MOTIONS[name](
    {
      scene: entry?.scene ?? {},
      durationInFrames: Math.max(1, Number(entry?.durationInFrames) || 1),
      // Normalised here rather than trusted, like every other field: an entry
      // built by hand — a test, a caller that predates the field — has no label,
      // and "there is no counter on this scene" is what an absent one means.
      label: typeof entry?.label === 'string' ? entry.label : '',
    },
    at,
    // Normalised the same way, and for the same reason: a caller that passes
    // nothing, or a shape this build does not know, gets the ordinary film.
    { ground: paints?.ground !== false },
  )
}

// ── Per-template palettes ────────────────────────────────────────────────────
//
// One function per composition, each answering with the colours that composition
// paints and the surface each of them lands on. The compositions read these and
// hold no colour of their own.
//
// They live here, with the arithmetic, for the reason the whole file exists: a
// `.jsx` file cannot be tested without Remotion, and "is this text legible" is
// the last question anybody wants answered by watching an mp4. Every run carries
// its surface and its threshold, so `composition.test.js` can re-measure the
// pair from primitives rather than trusting the number the palette computed.

/** How much quieter than the ink a secondary line is, per template. */
const TITLES_SUBTITLE_QUIET = 0.74
const BAND_SUBTITLE_QUIET = 0.76
const PRODUCT_BULLET_QUIET = 0.82

/**
 * How opaque the veils start out. Each may be raised by the search above; none
 * is ever lowered.
 */
export const SLIDESHOW_PANEL_VEIL = 0.62
export const BAND_VEIL = 0.88
export const VERTICAL_DIM = 0.34

/**
 * The track the story rail is drawn on.
 *
 * Its own surface rather than the picture, because the rail sits above every
 * scene of the film and the picture under it changes six times. Unlike the dim
 * it is allowed to get denser — the two ends of what an unknown photograph can
 * composite it to are far apart at 0.55, and a rail is a bar three pixels tall,
 * so paying for it with opacity costs nothing anybody is watching.
 */
export const RAIL_TRACK_ALPHA = 0.55

/**
 * The request every DECORATION in this file makes.
 *
 * The accent first, the display floor, and the veil locked. All three are the
 * same decision from different sides: an ornament should carry the project's
 * colour, it is display-sized where it appears, and it is not worth darkening a
 * photograph for. A helper rather than three literals in five palettes, so the
 * policy is stated once and a template that forgets one of the three cannot
 * exist.
 */
function accentRun(theme) {
  return { threshold: CONTRAST_MIN_LARGE, inks: accentFirst(theme), lockVeil: true }
}

/**
 * The hairline field the two flat-ground templates are drawn on, as a tint.
 *
 * The accent and not the ink, for the one reason that survives every theme: the
 * accent is the token a direction never uses for its ground and never for its
 * body copy, so a field of it is the layer most likely to be seen — and it is
 * the project's own colour, which is the only excuse a background has for
 * existing at all.
 *
 * It is returned as the surface's `tint` and the composition paints it by reading
 * the same two values back off the palette. That is the point of the shape: the
 * texture that gets measured and the texture that gets drawn are one object, so
 * a density somebody nudges in a component cannot leave the measurement behind.
 */
export function groundTint(theme) {
  return { color: safeColor(theme?.accent, THEME_FALLBACK.accent), alpha: TEXTURE_ALPHA }
}

/**
 * A flat ground and the texture over it — with the texture given up when it is
 * what makes a line illegible.
 *
 * Every other layer in this file can move. A veil rises, a quiet ink goes back
 * to full strength, an ink is replaced by the next candidate. The hairline field
 * was the one exception: fixed at `TEXTURE_ALPHA`, measured but not negotiable,
 * so on a mid-tone ground it split the surface into two colours far enough apart
 * that NOTHING cleared 4.5 — while the same ground bare had an answer. The sweep
 * puts every remaining failure of these two templates in exactly that shape: 66
 * runs, all of them legible the moment the texture is dropped.
 *
 * Which settles the priority, and it is not a close call. The field exists so
 * that 1920×1080 of one colour does not read as a missing background; the words
 * are why anyone pressed export. A decoration that cannot be raised is a
 * decoration that gets removed.
 *
 * Binary rather than a ladder, unlike the veil, because 0.04 is already the
 * faintest layer on the frame — a texture at half of it is not a quieter texture,
 * it is one nobody can see — and because the compositions read the tint back off
 * this object to paint it, so an absent tint paints nothing with no second
 * decision anywhere. And it is only ever traded for a run that CLEARS: a ground
 * where neither version works keeps its texture, since giving up the design buys
 * nothing there.
 */
function texturedGround(color, requests, inks, tint, alpha = 1) {
  const textured = sharedSurface(color, alpha, requests, inks, tint)
  if (textured.runs.every((run) => run.ok)) return textured
  const bare = sharedSurface(color, alpha, requests, inks, undefined)
  return bare.runs.every((run) => run.ok) ? bare : textured
}

/**
 * `slideshow` — one caption on a panel over a photograph.
 *
 * Both a panel and a shadow in the composition, because either alone loses; only
 * the panel is measurable, so only the panel carries the promise.
 */
export function slideshowPalette(theme) {
  const { on, runs } = sharedSurface(
    theme.surface,
    SLIDESHOW_PANEL_VEIL,
    [{ threshold: CONTRAST_MIN_LARGE }],
    inkCandidates(theme),
  )
  return { panel: on, caption: runs[0], runs }
}

/**
 * `overlay` — a title and a subtitle on a band over a capture.
 *
 * One band, two runs, one opacity: see `sharedSurface`.
 */
export function overlayPalette(theme) {
  const { on, runs } = sharedSurface(
    theme.surface,
    BAND_VEIL,
    [
      { threshold: CONTRAST_MIN_LARGE },
      { threshold: CONTRAST_MIN, quiet: BAND_SUBTITLE_QUIET },
      // The kicker and the rule that gives the band its edge. Locked, because a
      // band raised to 0.94 so that an indigo accent could stay indigo would
      // hide the capture — which is the other half of this template's promise.
      accentRun(theme),
    ],
    inkCandidates(theme),
  )
  return { band: on, title: runs[0], subtitle: runs[1], accented: runs[2], runs }
}

/**
 * `vertical` — a caption over a full-bleed picture.
 *
 * The template used to rely on a gradient anchored to one edge, and a gradient
 * is exactly what cannot be measured: what sits under a glyph depends on where
 * the line broke and how tall the caption ran, and a caption positioned `center`
 * landed on the raw photograph with the scrim already faded to nothing.
 *
 * So the promise moved to a UNIFORM dim over the whole frame, which has one
 * value everywhere and can therefore be computed. The directional gradient stays
 * on top of it as framing: it only ever adds density, so it cannot invalidate a
 * guarantee made on the dim alone. The cost is a picture darkened where it used
 * to be untouched, and it buys the only version of this template whose caption
 * is legible wherever the model put it.
 */
export function verticalPalette(theme) {
  const { on, runs } = sharedSurface(
    theme.background,
    VERTICAL_DIM,
    [{ threshold: CONTRAST_MIN_LARGE }, accentRun(theme)],
    inkCandidates(theme),
  )
  // The rail's own track, resolved separately for the reason the product pill is:
  // it is a different surface, painted over every scene rather than under one
  // caption, and folding it into the dim would darken the whole picture to give a
  // three-pixel bar its colour.
  //
  // Not locked, and it is the one accent run in the file that is not. A lock
  // trades density for ink, which needs some OTHER run to have already fixed a
  // density that works; this surface carries nothing else, and 0.55 over an
  // unknown photograph spans a range wide enough that black and white can both
  // fail at one end of it. So the track is allowed to thicken — which costs a bar
  // three pixels tall and no part of the picture.
  const rail = sharedSurface(
    theme.background,
    RAIL_TRACK_ALPHA,
    [{ threshold: CONTRAST_MIN_LARGE, inks: accentFirst(theme) }],
    inkCandidates(theme),
  )
  return {
    dim: on,
    caption: runs[0],
    accented: runs[1],
    rail: { track: rail.on, fill: rail.runs[0] },
    runs: [...runs, ...rail.runs],
  }
}

/**
 * `titles` — words on the project's own ground, and no picture at all.
 *
 * The template the defect was reported on. Its ground is opaque, so there is no
 * veil to raise and no picture to be uncertain about: if the headline is not
 * legible here, it is because the ink and the ground were never designed to meet
 * — which `resolveTheme` now prevents, and which this measures anyway.
 */
export function titlesPalette(theme) {
  const { on, runs } = texturedGround(
    theme.background,
    [
      { threshold: CONTRAST_MIN_LARGE },
      { threshold: CONTRAST_MIN, quiet: TITLES_SUBTITLE_QUIET },
      // The kicker and the emphasised word — one run, because they are one
      // decision: this is where the project's colour appears in a film that has
      // no picture in it. On an opaque ground the lock changes nothing; it is
      // there so that "a decoration never moves a veil" is true of every accent
      // in the catalogue rather than of four of them.
      accentRun(theme),
    ],
    inkCandidates(theme),
    groundTint(theme),
  )
  return { ground: on, headline: runs[0], subtitle: runs[1], accented: runs[2], runs }
}

/**
 * `product` — a headline, its arguments, and a call to action on a filled pill.
 *
 * Two surfaces, not one: the card's ground and the accent the pill is filled
 * with. The pill was the only element in the catalogue that already measured its
 * own ink, which is why it stayed readable in the export where everything around
 * it disappeared.
 */
export function productPalette(theme) {
  const card = texturedGround(
    theme.background,
    [
      { threshold: CONTRAST_MIN_LARGE },
      { threshold: CONTRAST_MIN, quiet: PRODUCT_BULLET_QUIET },
      // The numeral beside each argument, and the rule that separates the card
      // from its call to action. A drawn dot needed no ink of its own; a numeral
      // is type, and type is measured here like all the rest.
      accentRun(theme),
    ],
    inkCandidates(theme),
    groundTint(theme),
  )
  // The label takes the display floor, like every other bold run in the
  // catalogue: 37 px at weight 700 is "large text" under the same rule the audit
  // applies. It matters here more than anywhere else — the fallback accent
  // `#6366f1` carries white at 4.47:1, so at 4.5 the default pill has no legible
  // ink in the theme, in the fallback pair, or anywhere else.
  const pill = sharedSurface(theme.accent, 1, [{ threshold: CONTRAST_MIN_LARGE }], inkCandidates(theme))
  return {
    ground: card.on,
    headline: card.runs[0],
    bullet: card.runs[1],
    accented: card.runs[2],
    cta: pill.runs[0],
    runs: [...card.runs, ...pill.runs],
  }
}

/**
 * `composed` — a stack of blocks on one of six grounds.
 *
 * ── The one thing a block author has to know ────────────────────────────────
 *
 * A block never picks a colour. It reads one of the runs below and paints with
 * it, and that is the whole of the legibility contract: twenty-four components
 * cannot each be trusted to measure, and twenty-four components each measuring
 * would be twenty-three copies of this function.
 *
 * Three surfaces, because a block paints on one of exactly three things:
 *
 *   - **the GROUND** (`display`, `body`, `accent`) — a heading, a quote, a rule;
 *   - **a PANEL** (`panelDisplay`, `panelText`, `panelBody`, `panelAccent`) — the
 *     card a notification, a form or a framed picture sits on, which is opaque
 *     `theme.surface` and therefore its own surface whatever the ground is;
 *   - **a FILL** (`onFill`) — the ink on something painted in the accent: a
 *     button, a highlight marker, a bar of a chart carrying a number.
 *
 * ── Why the panel has four runs where the ground has three ──────────────────
 *
 * Because of `codeBlock`, and it is a floor rather than a shade. The ground's
 * three runs are a hierarchy: display type at 3:1, running text at 4.5:1 and
 * quieted, an ornament. Every panel in the catalogue was that same trio — a
 * title, a subtitle under it, a mark beside it — until a block arrived whose
 * MAJORITY run is neither: a wall of monospace at the `body` step, where the
 * plain lines are most of the panel and the quiet ones are the aside.
 *
 * With three runs it had two places to go and both were wrong. `panelBody` is
 * the quiet run, so the listing would have been painted in the colour of its own
 * commentary — and `panelDisplay` is measured at `CONTRAST_MIN_LARGE`, so that is
 * where it went, and twenty lines of 21 px monospace shipped at a floor of 3:1
 * (3.19:1 in the worst case of the sweep). That floor is licensed by SIZE — the
 * audit's own rule reads 24 px, or 18.66 px bold — and a listing is neither.
 * Which of the two floors applies is decided by the type ROLE and never by what
 * the surface happens to offer, exactly as `contrast.js` says.
 *
 * Raising the type instead does not work, and the arithmetic is why: 64
 * monospace characters — the schema's own ceiling for a line — at 24 px are
 * 921 px across, and the safe measure of a 9:16 frame is 906. The code would have
 * to wrap, and a break somebody did not write is a different program on the
 * screen. So the run moves rather than the type: `panelText` is running text at
 * FULL strength on the panel, at 4.5:1, and `panelBody` stays what it was.
 *
 * ── Why the ground is a range and not a colour ──────────────────────────────
 *
 * Two of the six grounds are not one colour. A `gradient` runs between the
 * project's background and its surface, and an `image` is a photograph nobody in
 * this process has opened. `surfaceRange` already had the vocabulary for both —
 * a veil measured at the two extremes a picture can composite it to, and a tint
 * measured beside its base — so a ground is expressed as `{ color, alpha, tint }`
 * and every one of the six is a case of that one shape:
 *
 *   solid       the colour, opaque, no tint
 *   hairlines   the colour plus the house texture, as a tint
 *   gridPulse   the same, and the pulse only ever goes BELOW the measured density
 *   particles   the same, dots instead of rules
 *   gradient    a RAMP of tints from the ground to the surface — see below
 *   image       the colour at a veil, measured over black and over white
 *
 * The pulse and the drift are the trap worth naming. A texture that could get
 * DENSER than what was measured would spend contrast nothing here knows about,
 * so the animated grounds are measured at their maximum and animate downwards
 * only. That is the same asymmetry `vertical` relies on when it keeps its
 * directional gradient on top of a uniform dim: a layer that can only ever add
 * legibility cannot invalidate a guarantee.
 *
 * And the whole tint yields, exactly as `texturedGround` already made it yield
 * for the two flat templates: a ground whose texture — or whose gradient — is
 * what makes a line illegible is painted flat instead. A decoration cedes to a
 * word, and it never cedes for nothing, since the bare ground has to CLEAR what
 * the tinted one failed.
 */
export const COMPOSED_BODY_QUIET = PRODUCT_BULLET_QUIET

/**
 * How dim a photographic ground is under a stack of blocks.
 *
 * `VERTICAL_DIM`, aliased: text over a picture nobody has opened is one problem
 * with one answer, and a second number for it would be a second answer that
 * drifts. Like every veil in this file it is a floor — `legibleOn` raises it when
 * a run needs more, and never lowers it.
 */
export const COMPOSED_IMAGE_VEIL = VERTICAL_DIM

/**
 * Where a `gradient` ground is sampled, as fractions of the way from the
 * background to the surface.
 *
 * Four samples plus the base. The reason there is more than one is in
 * `surfaceRange`: two ends clearing 3:1 does NOT prove an ink is outside the
 * band between them, and an ink inside the band meets its own luminance
 * somewhere along the ramp, where the contrast is 1:1. Sampling closes it — an
 * ink hiding between two adjacent samples sits within a fraction of one of them,
 * and a fraction is not three.
 */
export const GRADIENT_RAMP = [0.25, 0.5, 0.75, 1]

/**
 * How dense a `full` field is allowed to be when something is stacked on it,
 * densest first.
 *
 * This exists because a real export shipped a heading nobody could read, and the
 * cause was a sentence in `equalizer.jsx` that was true of every other block and
 * false of that one: "it carries no text, so the only thing it can get wrong is
 * spending contrast something else needed — which it cannot". A block anchored
 * `full` is painted UNDER the nine cells, on purpose, because a wave or a map is
 * what an element sits on. That makes it a SURFACE, and `composedPalette`
 * measured every run against the ground alone — so eighteen accent bars ran
 * behind a white headline whose last word was in the accent, and the two met at
 * 1:1 in the middle of the frame.
 *
 * The answer is the one this file already gives everywhere else: the field is a
 * decoration, the heading is why anybody pressed export, and a decoration cedes
 * to a word. It cedes DENSITY rather than colour — the project's own accent is
 * the only excuse a field has for existing — and it cedes it in measured steps,
 * the first of which is "not at all". A scene with no stack keeps the whole
 * ladder unused: nothing is drawn over the field, so nothing has to be measured
 * against it.
 *
 * 1 is in the list and is not padding. It is what makes the common case free and
 * what makes the search honest: a pale field on a dark ground genuinely does
 * carry a headline at full strength, and stepping it down anyway would be an
 * ornament yielding for nothing — the trade `texturedGround` refuses in the same
 * words one screen up.
 */
export const FIELD_ALPHAS = [1, 0.62, 0.4, 0.24]

/**
 * Where a field's own density is sampled, as fractions of the density it is
 * painted at.
 *
 * `GRADIENT_RAMP`'s argument, one layer down and for the same reason. A field is
 * not one colour: `map` draws its dots at full strength and its links at a
 * fraction, `barChart` fills its columns and rules its axis, and everything
 * inside a zone painted at α composites somewhere between the bare ground and
 * the accent at α. Measuring only the two ends is exactly the claim
 * `surfaceRange` has a counterexample for at the display floor of 3 — an ink
 * whose luminance sits between them meets itself somewhere in the middle, where
 * the contrast is 1:1.
 */
export const FIELD_RAMP = [0.25, 0.5, 0.75, 1]

/** The six grounds, in the schema's own order. Anything else reads as `hairlines`. */
const BACKGROUND_SURFACES = ['solid', 'gradient', 'hairlines', 'gridPulse', 'particles', 'image']

/**
 * One ground as the three things `surfaceRange` understands.
 *
 * The tint is always an ARRAY here, even when it holds one layer, so the
 * composition has one shape to read back: `tint[0]` is the texture a field is
 * painted with, and the last entry is the far end of a ramp. An absent tint means
 * paint nothing — which is both "this ground has no second layer" and "the second
 * layer was what made a line illegible", and the composition does not have to
 * tell those apart.
 */
function groundSurface(theme, kind) {
  switch (kind) {
    case 'solid':
      return { color: theme.background, alpha: 1, tint: undefined }
    case 'gradient':
      return {
        color: theme.background,
        alpha: 1,
        tint: GRADIENT_RAMP.map((alpha) => ({ color: safeColor(theme.surface, THEME_FALLBACK.surface), alpha })),
      }
    case 'image':
      return { color: theme.background, alpha: COMPOSED_IMAGE_VEIL, tint: undefined }
    default:
      // hairlines, gridPulse and particles are one measurement: the house texture
      // in the project's accent, at the density the composition paints it.
      return { color: theme.background, alpha: 1, tint: [groundTint(theme)] }
  }
}

/**
 * How dim a lit solid's darkest face is allowed to be, as a share of its
 * material colour.
 *
 * Below this the object stops reading as lit and starts reading as two flat
 * shapes; above it there is not enough difference between the faces for the
 * perspective to be visible at all, which is the whole point of paying for a
 * renderer.
 */
/**
 * The shading depths a lit solid is allowed to try, darkest first.
 *
 * Darkest first because the deepest one that still clears the floor is the one
 * that reads as lit; the last entry is a solid painted flat, which keeps its
 * perspective and its silhouette and is what a ground with no room gets (Q1).
 */
export const SOLID_SHADES = [0.55, 0.7, 0.85, 1]

/** The first of those, named because `setPiece.test.js` and this file both mean the same "as lit as it gets". */
export const SOLID_SHADE_FLOOR = SOLID_SHADES[0]

/** A colour with every channel multiplied, clamped to the byte. Not a mix: a Lambert term. */
function scaleColor(color, factor) {
  const rgb = channels(color)
  if (!rgb) return color
  const hex = rgb
    .map((c) => Math.max(0, Math.min(255, Math.round(c * factor))).toString(16).padStart(2, '0'))
    .join('')
  return `#${hex}`
}

/**
 * The material colour and the ambient share a lit solid is drawn with, so that
 * EVERY face of it clears the same floor its ink did.
 *
 * This is the one block whose surface is not flat, and the legibility guarantee
 * had to be extended rather than reused. A Lambert face is `material × (ambient +
 * directional · n·l)` with the two intensities summing to one, so every face of a
 * solid lies on the segment between `material × ambient` and `material`.
 * Contrast against a fixed surface is monotone in luminance on each side of that
 * surface, and luminance is monotone along a channel-wise ramp — so measuring the
 * two ENDS measures every face between them. That is the whole proof, and it is
 * why this returns two numbers rather than a light rig.
 *
 * The material is the ORNAMENT's run — the accent, resolved on the ground with
 * the veil locked — and not the display ink it used to be. A real export said
 * why: a torus anchored `full` under a heading was painted in
 * `palette.solid.color`, which WAS `palette.display.color`, so the object and the
 * word standing on it were the same colour and met at 1:1 wherever they
 * overlapped. An object and the text laid over it cannot share an ink; that is
 * the founding mistake of this whole section, one composition further on. The
 * accent is also the right colour on its own terms — a lit solid is a decoration,
 * and a decoration carries the project's colour (`accentRun`). It can still
 * coincide with the ink on a direction whose accent cannot be read at all, since
 * `accentFirst` then falls through to the ordinary list: being legible outranks
 * being distinct, as it does everywhere else in this file.
 *
 * The material is a run the palette already resolved, so the LIT end is
 * measured by construction and only the dim end is measured here. Lambert can
 * only ever darken, and that direction was written the other way round first: an
 * ink brightened so that the DIM face landed exactly on the measured colour. It
 * is arithmetically sound and it renders nothing — the ordinary case is a
 * near-white ink on a dark ground, whose brightest channel is already at 96% of
 * the byte, so the material came back one part in twenty-five brighter and the
 * solid was flat. A near-white ink darkened to 55% still clears 3:1 on any ground
 * it cleared at full strength by a wide margin, which is what the sweep in
 * `composition.test.js` says.
 *
 * The depth is searched rather than fixed for the grounds where it does not:
 * `SOLID_SHADES` is tried darkest first and the first that clears wins. A ground
 * with no answer at all gets a flat solid rather than a failed export.
 */
export function solidShading(surface, ink) {
  for (const ambient of SOLID_SHADES) {
    if (ambient >= 1) break
    if (legibleOn(surface, [scaleColor(ink, ambient)], CONTRAST_MIN_LARGE, { lockVeil: true }).ok) {
      return { color: ink, ambient }
    }
  }
  return { color: ink, ambient: 1 }
}

/**
 * What a block anchored `full` PAINTS, when a stack is standing on it.
 *
 * `FIELD_ALPHAS` made a field enter the measurement; this table is what makes
 * that true of every field rather than of five of them. Measuring a surface means
 * knowing which colour it puts on the frame — `fieldedGround` samples the colours
 * named here — and a field painted in a colour nobody named escapes the
 * measurement exactly as the whole field did before it.
 *
 * Two answers, and the second is the one that was missing. `equalizer`,
 * `soundWave`, `map`, `barChart` and `lineChart` paint the ACCENT, as a run or as
 * a fill, which is what the boolean version of this measured on everybody's
 * behalf. `solidScene` paints a lit SOLID: the one thing in this directory drawn
 * at more than one brightness, whose faces lie on the segment between `material`
 * and `material × ambient`, and a segment with two ends is exactly what
 * `surfaceRange` knows how to measure. The export that found the gap rendered a
 * flat grey torus under a heading in the same ink — `field.alpha` walked its
 * whole ladder against a colour nothing on the frame was painted with, and dimmed
 * the object without ever helping the word.
 *
 * A kind that names nothing takes the accent: that is what a field meant until
 * this pass, and it is the loudest thing a decoration reaches for. The three
 * MEDIA blocks are the honest gap and it stays named — `gallery`, `carousel` and
 * `imageFrame` anchored `full` paint photographs nobody in this process has
 * opened, so what gets measured for them is an accent that is not on the frame.
 * Closing that one needs a picture, not a row in a table.
 */
export const FIELD_PAINTS = {
  equalizer: 'accent',
  soundWave: 'accent',
  map: 'accent',
  barChart: 'accent',
  lineChart: 'accent',
  // A shell of dots painted in the ornament's own run, at two opacities — which
  // is the accent, sampled along its density exactly as every other tinted field
  // is. It carries no second ink: there is no light in that scene at all.
  globe: 'accent',
  solidScene: 'solid',
  /*
   * The two picture stages, and the row is only half of what they paint.
   *
   * Their BODIES — the rim, the mount, the case, the back of a card — are
   * `palette.solid`, lit by the same two-light rig as a solid, so every face of
   * them lies on the segment `solidShading` measured and `fieldColors` samples
   * its two ends. That half is closed.
   *
   * The other half is the PHOTOGRAPH, and it is the honest gap `gallery`,
   * `carousel` and `imageFrame` already carry: nobody in this process has opened
   * the picture, so a heading standing on one of these fields is measured against
   * an ink the frame may not contain. Naming `solid` rather than leaving them to
   * the default is what makes the measurable half measured — the default would
   * sample the accent, which a body painted at `ambient × material` is not.
   */
  photoStage: 'solid',
  photoRing: 'solid',
  // Lit boxes in `palette.solid`, so the same segment a solid is measured on:
  // every face lies between `material × ambient` and `material`, and two ends
  // measure everything between them. Its LABELS are flat type on the ground and
  // are not part of the field at all — they are drawn outside the canvas.
  solidChart: 'solid',
  /*
   * A third answer, and it is the one the two above would each get wrong.
   *
   * `extrudedType` paints the FACE of every letter in `palette.display` and the
   * thickness behind it in `palette.accent`. Measured as `accent` it would be
   * measured as its ornament and not as its subject — the face is the largest
   * ink on the frame — and measured as nothing at all it would be a full-frame
   * surface in the very ink a `heading` stacked on it uses, which is the 1:1
   * meeting this whole section exists to have already prevented. So it names
   * both, and `fieldColors` is where the pair becomes two colours.
   */
  extrudedType: 'type',
  /*
   * The three fields in volume, and two answers between them.
   *
   * `particleField` and `depthGrid` are unlit: a speck and a rule are painted in
   * `palette.accent` and in nothing else, at opacities that run from nothing up
   * to full — so what lands on a frame is somewhere between the bare ground and
   * the accent, which is exactly the pair `fieldedGround` already samples along
   * `FIELD_RAMP`. Naming the default explicitly rather than letting them fall
   * through it, for `FIELD_PAINTS`'s own reason: a kind whose paint nobody wrote
   * down is a kind whose paint nobody checked.
   *
   * `waveMesh` is lit, so it is `solidScene`'s answer for `solidScene`'s reason:
   * every point of a Lambert sheet lies on the segment between `material ×
   * ambient` and `material`, contrast is monotone between them, and two ends
   * measure the whole surface. It is the case where getting this wrong would
   * cost the most — a sheet anchored `full` is the largest single ink a frame
   * can carry — and it is also the one where the temptation is greatest, since a
   * lit surface looks like it is many colours.
   */
  particleField: 'accent',
  depthGrid: 'accent',
  waveMesh: 'solid',
}

/**
 * The paints, in one fixed order.
 *
 * `fieldPaints` answers in this order and never in the document's, because that
 * answer is also a cache key: `ComposedSceneVideo` resolves one palette per
 * distinct key, and two scenes that paint the same two surfaces in the other
 * order are one search, not two.
 */
export const FIELD_PAINT_KINDS = ['accent', 'solid', 'type']

/** The one a kind that names none is measured as. See `FIELD_PAINTS`. */
export const DEFAULT_FIELD_PAINT = 'accent'

/**
 * Which surfaces this scene paints UNDER its stack — empty when it paints none.
 *
 * Both halves are needed and neither is enough. A `full` block alone on a frame
 * is the whole picture and owes nobody contrast; a stack with no `full` block
 * sits on the ground the palette already measured. It is the pair that creates a
 * surface nothing measured, and it is the pair the panel and the model can both
 * produce without asking for anything unusual — `anchor` defaults to `center`,
 * so "an equalizer and a headline" is two lines of a document.
 *
 * A list rather than a flag, because "there is a field" was never the question a
 * palette needed answered: it has to know WHICH ink to sample, and a scene may
 * stack a wave and a solid under one heading. Deduped, so a document naming eight
 * equalizers is one accent.
 *
 * Read off `anchorName` rather than the raw field, so a value this build does not
 * know is counted where it will actually be drawn — and off `Object.hasOwn`, so a
 * `kind` of `constructor` is a field painted in the accent rather than a function.
 */
export function fieldPaints(scene) {
  const layers = Array.isArray(scene?.layers) ? scene.layers : []
  const paints = new Set()
  let over = false
  for (const layer of layers) {
    if (anchorName(layer?.anchor) !== 'full') {
      over = true
      continue
    }
    const kind = String(layer?.kind ?? '')
    paints.add(Object.hasOwn(FIELD_PAINTS, kind) ? FIELD_PAINTS[kind] : DEFAULT_FIELD_PAINT)
  }
  return over ? FIELD_PAINT_KINDS.filter((paint) => paints.has(paint)) : []
}

/** The predicate the same walk answers: is this scene the pair at all. */
export function stackedField(scene) {
  return fieldPaints(scene).length > 0
}

/**
 * The ground with a field painted across it, at the densest density every run
 * still clears.
 *
 * Two ladders nested, and the order is the priority `texturedGround` already
 * settled: the field steps down first, and only when it has run out of steps is
 * the house texture given up — because the texture is 4% of one colour and the
 * field is the block somebody asked for. Both are decorations; one of them is in
 * the document.
 *
 * When nothing clears at any density on either ground, the faintest field on the
 * bare ground is returned and the export ships (Q1). That is a frame with a
 * contrast this file could not fix, not a render that failed after the user
 * waited in a queue.
 *
 * `colors` is `fieldColors`'s answer — what the blocks anchored `full` actually
 * paint, which is the accent for five of them and a lit solid's two ends for the
 * sixth. This function measures whatever it is handed; deciding what a field is
 * made of belongs to `FIELD_PAINTS`, one screen up.
 */
function fieldedGround(ground, requests, inks, colors) {
  const own = Array.isArray(ground.tint) ? ground.tint : ground.tint ? [ground.tint] : []
  const painted = (alpha) => colors.flatMap((color) => FIELD_RAMP.map((step) => ({ color, alpha: alpha * step })))
  const resolve = (tint, alpha) => sharedSurface(ground.color, ground.alpha, requests(), inks, [...tint, ...painted(alpha)])


  for (const tint of [own, []]) {
    for (const alpha of FIELD_ALPHAS) {
      const resolved = resolve(tint, alpha)
      if (resolved.runs.every((run) => run.ok)) return { surface: resolved, alpha, tint }
    }
  }
  const faintest = FIELD_ALPHAS[FIELD_ALPHAS.length - 1]
  return { surface: resolve([], faintest), alpha: faintest, tint: [] }
}

/**
 * The option as a list of paints.
 *
 * `true` reads as the accent, which is what a field meant when this was a
 * boolean: a caller written against the old contract keeps measuring the surface
 * it used to measure rather than silently measuring none (Q1). Filtered through
 * `FIELD_PAINT_KINDS` so an unknown name is ignored instead of becoming an
 * undefined colour inside `surfaceRange`.
 */
function fieldRequest(field) {
  if (field === true) return [DEFAULT_FIELD_PAINT]
  if (!Array.isArray(field)) return []
  return FIELD_PAINT_KINDS.filter((paint) => field.includes(paint))
}

/**
 * The colours a field is measured as, one entry per paint.
 *
 * The accent is TWO colours because the five blocks that reach for it reach
 * differently: `equalizer`, `soundWave`, `map` and `lineChart` paint the accent
 * RUN — the ornament the palette resolved on this ground — and `barChart` fills
 * its columns with the theme's accent as a FILL. Measuring the run alone would
 * leave the columns of a chart unmeasured, which is the same defect one block
 * over.
 *
 * The solid is two ends of a segment rather than a colour, and that is the whole
 * reason this function exists: every face of a lit solid lies between `material`
 * and `material × ambient`, contrast is monotone between them, so the two ends
 * measure every face. `solidShading` has the proof.
 *
 * The `type` is two inks and not one shade of one: `extrudedType` sets the face
 * of its letters in the display ink and the thickness behind them in the accent,
 * which is the pair `funTitle`'s `stack` already draws flat. Measuring the accent
 * alone would leave the largest ink on the frame unmeasured — the face — and that
 * is precisely the omission the whole of `FIELD_PAINTS` exists to have closed,
 * arriving through the one field that is made of words.
 *
 * Deduped by value, because the solid's material IS the accent run and a title's
 * thickness is too: a scene that stacks a wave, a torus and an extruded line
 * measures four colours rather than six, and the ramp `fieldedGround` builds over
 * them is a third shorter for it.
 */
function fieldColors(paints, { accent, display, theme, solid }) {
  const colors = []
  for (const paint of paints) {
    const painted =
      paint === 'solid'
        ? [solid.color, scaleColor(solid.color, solid.ambient)]
        : paint === 'type'
          ? [display.color, accent.color]
          : [accent.color, safeColor(theme?.accent, THEME_FALLBACK.accent)]
    for (const color of painted) if (!colors.includes(color)) colors.push(color)
  }
  return colors
}

/**
 * @param {object} theme
 * @param {object} [background]
 * @param {{field?: string[]|boolean}} [scene]  `field` is what the blocks
 *   anchored `full` PAINT under this scene's stack — see `fieldPaints`. Empty
 *   when nothing stands on a field, which is most scenes.
 */
export function composedPalette(theme, background, { field = false } = {}) {
  const ground = groundSurface(theme, backgroundKind(background))
  /**
   * The two runs of TEXT, which are the ones a field can make illegible.
   *
   * The accent is deliberately not among them, and the first version of this fix
   * shipped because it was: measured against a surface that a field of the accent
   * had already tinted, the accent run cannot clear against itself, falls through
   * `accentFirst` to a near-white — and the frame came back with grey bars behind
   * a grey headline. Legible, and the project's colour gone. That is the failure
   * `theme.ts` refuses when it declines to guess a token, and the one
   * `inkCandidates` is ordered to avoid: a generic white clears every threshold
   * and erases the art direction.
   *
   * So the ornament is measured against the ground it is painted ON, exactly as
   * before, and the words painted OVER it are measured against ground plus
   * ornament. Which leaves one honest gap, named here rather than hidden: accent
   * TEXT — a `kicker` — anchored over a field of the same accent is not measured
   * against it. It is the one run whose colour is the point, so the alternative is
   * the grey frame above.
   */
  const text = () => [{ threshold: CONTRAST_MIN_LARGE }, { threshold: CONTRAST_MIN, quiet: COMPOSED_BODY_QUIET }]
  const requests = () => [...text(), accentRun(theme)]
  /*
   * The panel's own list: the same three, plus running text at FULL strength.
   *
   * Fourth rather than second, so the three indices every other block already
   * reads keep their meaning — and on the PANEL only, because the ground has no
   * block whose bulk is running text. Adding it to the ground would put a fourth
   * request into `fieldedGround`'s ladder, which would step a field's density
   * down for a run nothing paints.
   *
   * It costs the other three nothing: the panel is opaque, so `sharedSurface`'s
   * shared veil is 1 before this request and 1 after it, and a run that asks for
   * no veil cannot move a run that already had one. And it always has an answer
   * wherever `panelBody` does — quieting an ink blends it TOWARDS the surface, so
   * the full-strength ink's contrast is never the lower of the two.
   */
  const panelRequests = () => [...requests(), { threshold: CONTRAST_MIN }]

  const plain = texturedGround(ground.color, requests(), inkCandidates(theme), ground.tint, ground.alpha)
  // The ornament's run is the plain one on every scene — see `text` above.
  const accent = plain.runs[2]
  /*
   * The lit solid, resolved on the PLAIN ground and before the field, for two
   * reasons that turn out to be the same one.
   *
   * It is painted under the nine cells, on the ground and never on the fielded
   * surface, so the ground is what it has to be told apart from. And when the
   * solid IS the field, a colour taken from the pass that measures the field
   * would be a fixpoint rather than an answer — the argument the accent run
   * already makes two lines up, arriving through the one block whose colour is
   * also a surface.
   */
  const solid = solidShading(plain.on, accent.color)
  /*
   * The field, measured as the colours it actually paints.
   *
   * Which colours those are is `FIELD_PAINTS`, and the table exists because this
   * used to be a boolean: every field was measured as the accent, so a
   * `solidScene` anchored `full` — painted in a colour of its own, at more than
   * one brightness — was a second ground that never entered the measurement. The
   * runs come from the plain resolution for the same reason the accent's does.
   */
  const paints = fieldRequest(field)
  const surface = paints.length
    ? fieldedGround(
        ground,
        text,
        inkCandidates(theme),
        // `plain.runs[0]` and not the fielded display run, for the reason the
        // accent and the solid are both taken from the plain resolution: a field
        // measured with a colour that came out of the pass measuring the field is
        // a fixpoint rather than an answer. The consequence is honest and it is
        // the right one — a full-frame line of type in the display ink with a
        // heading stacked on it walks the whole density ladder, because those two
        // really cannot both be read.
        fieldColors(paints, { accent, display: plain.runs[0], theme, solid }),
      )
    : { surface: plain, alpha: 1, tint: plain.on.tint }
  const measured = surface.surface
  // The card, resolved on its own surface: it is opaque `theme.surface`, so a
  // photograph or a ramp behind it changes nothing about what a glyph on it
  // lands on. Folding it into the ground would darken a whole frame to give a
  // notification its contrast.
  const panel = sharedSurface(theme.surface, 1, panelRequests(), inkCandidates(theme))
  // And the accent as a FILL: the pill, the marker, the pressed button. This is
  // the surface the product card's call to action proved was worth measuring —
  // it was the only legible element in the export that started all of this.
  const fill = sharedSurface(theme.accent, 1, [{ threshold: CONTRAST_MIN_LARGE }], inkCandidates(theme))

  return {
    ground: measured.on,
    /*
     * What the composition PAINTS as the ground's second layer, which is not
     * always what `ground.tint` holds.
     *
     * They differ by exactly the field: `ground.tint` is the whole stack that was
     * measured, so that `composition.test.js` can re-derive every ratio from
     * primitives and a layer nobody accounted for cannot hide, while this is the
     * ground's own texture and nothing else. Reading `ground.tint` in `Ground`
     * instead would paint the field twice — once as a texture behind everything,
     * once as the block it is — and on a gradient it would take the ramp's far
     * end from the accent, since that composition reads the LAST entry.
     */
    groundTint: surface.tint,
    display: measured.runs[0],
    body: measured.runs[1],
    accent,
    /*
     * How dense a `full` zone is painted. 1 unless something stands on it — see
     * `FIELD_ALPHAS`.
     *
     * An opacity on the ZONE rather than a colour handed to five components, and
     * that is the whole reason this fix is eight lines instead of five files: a
     * block that had to be told it was a field would be a rule every future block
     * has to remember, and the one it forgets is the one that ships a heading
     * nobody can read. The zone is where `full` means anything at all.
     */
    field: { alpha: surface.alpha },
    // The lit solid's two numbers, resolved above from the ORNAMENT's run and on
    // the ground it is painted on. A block reads this rather than shading a
    // colour itself, for the reason every other block reads a run: twenty-seven
    // components cannot each be trusted to measure.
    solid,
    panel: panel.on,
    panelDisplay: panel.runs[0],
    panelBody: panel.runs[1],
    panelAccent: panel.runs[2],
    // The panel's running text at full strength, for the block whose bulk IS
    // running text. See `panelRequests` for why it is a fourth run and not a
    // reuse of one of the three above.
    panelText: panel.runs[3],
    fill: fill.on,
    onFill: fill.runs[0],
    // Two from the surface the words are on, then the ornament from the ground
    // it is painted on. Sliced rather than spread, because the fielded
    // resolution is asked for two requests and the plain one for three.
    runs: [measured.runs[0], measured.runs[1], accent, ...panel.runs, ...fill.runs],
  }
}

/**
 * The palette for a template, keyed exactly like `COMPOSITIONS`.
 *
 * Same shape and the same reason: what cannot be named cannot be asked for, and
 * a template that gains a composition without gaining a palette is a template
 * whose text nothing checks. `composition.test.js` iterates this map, so the
 * omission fails the suite rather than shipping.
 */
export const PALETTES = {
  slideshow: slideshowPalette,
  overlay: overlayPalette,
  vertical: verticalPalette,
  titles: titlesPalette,
  product: productPalette,
  // One argument, like its neighbours, so the sweep in `composition.test.js`
  // reaches it the same way — and it answers for the ground a document gets by
  // saying nothing. The other five grounds are swept beside it, by name, because
  // a palette that is only ever measured on its default is a palette measured on
  // one sixth of what it can be handed.
  composed: (theme) => composedPalette(theme),
}
