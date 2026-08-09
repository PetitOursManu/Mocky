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
    default:
      return null
  }
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
 */
export function surfaceRange(color, alpha, tint) {
  const base = safeColor(color, THEME_FALLBACK.background)
  const a = Number.isFinite(Number(alpha)) ? Math.min(1, Math.max(0, Number(alpha))) : 1

  const grounds = [base]
  if (tint && typeof tint === 'object') {
    const density = Number.isFinite(Number(tint.alpha)) ? Math.min(1, Math.max(0, Number(tint.alpha))) : 0
    // `safeColor(..., base)` and not a drop: an unreadable tint is a layer that
    // paints nothing, which is the same range as no tint at all.
    const tinted = blend(safeColor(tint.color, base), base, density)
    if (tinted && tinted !== base) grounds.push(tinted)
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
export const KICKER_TRACKING = '0.2em'

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
 * @param {string|undefined} template
 * @param {{scene: object, durationInFrames: number, label?: string}} entry  one entry of `planTimeline`
 * @param {number} frame  the frame WITHIN the scene, as Remotion's Sequence gives it
 */
export function sceneMotion(template, entry, frame) {
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
function texturedGround(color, requests, inks, tint) {
  const textured = sharedSurface(color, 1, requests, inks, tint)
  if (textured.runs.every((run) => run.ok)) return textured
  const bare = sharedSurface(color, 1, requests, inks, undefined)
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
}
