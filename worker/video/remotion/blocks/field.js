/**
 * The arithmetic of the three FIELDS drawn in volume — `particleField`,
 * `waveMesh`, `depthGrid`.
 *
 * No React, no Remotion, no `three`. Same reason as `setPiece.js` next door, and
 * one reason more: `three` is installed in `worker/video/package.json` and
 * nowhere else, so a single import here would take `blocks/index.js` out of
 * Mocky's own vitest suite — where the registry is proved to match the schema in
 * both directions. Everything below is numbers. The three `.jsx` files turn them
 * into react-three-fiber intrinsics and `ComposedSceneVideo` opens the canvas.
 *
 * ── DETERMINISM IS THE WHOLE OF THIS FILE ───────────────────────────────────
 *
 * A field is where a renderer reaches for a die. "Scattered dust", "a wandering
 * swarm", "a grid that shimmers" — every one of those sentences has a
 * `Math.random` in it in the first draft, and `blocks.test.js` sweeps this
 * directory for exactly that. The store is CONTENT-ADDRESSED: a film that
 * differs by one pixel between two runs is filed as two films, charged twice
 * against the same disk budget, and impossible to deduplicate afterwards.
 *
 * So every position comes from an INDEX and a FRAME, through `noise` — an
 * integer hash, bit-exact on every machine, and deliberately not the
 * `fract(sin(dot(…)))` idiom every shader tutorial reaches for: that one is a
 * `Math.sin` of a large argument, and the last bits of `Math.sin` are an
 * implementation's business rather than the language's. Two calls to
 * `particlePositions` with the same arguments return the same bytes, and
 * `field.test.js` is what says so.
 *
 * ── AND NOTHING HOLDS STILL, WHICH IS THE OTHER HALF ────────────────────────
 *
 * `solidSpin` learned it the expensive way — a cube turned through a whole
 * number of quarter-turns rendered three byte-identical PNGs. A field is worse,
 * because a field is naturally periodic: a scrolling grid whose travel is a
 * whole number of cells is exactly where it started, and a wave whose phase
 * advances by 2π is a still photograph of a wave. Every rate here is therefore
 * an irrational-looking fraction and every one of them is tested at the two
 * frames a scene actually has: its first and its last.
 */
import { SPRITE_AREA_GAIN } from './pointSprite.js'

/**
 * How many pixels of GL a field may draw per frame, before it is drawn smaller
 * and stretched.
 *
 * This is the one number in the family that was decided by a stopwatch, and the
 * measurement is in `docs/video-export.md`. A field anchored `full` covers its
 * whole box on both axes — 1 690 × 950 on the safe area of a 16:9 frame, which
 * is 2.4 times the pixels the square `solidScene` canvas covers at its largest.
 * A lit surface at that size measured **+1.7 s of render per second of film**
 * on the two-core worker, against the ~1.7 s/s the duration-scaled deadline
 * leaves spare: one field would have spent the entire margin, and a film is
 * allowed more than one scene.
 *
 * Drawn inside this budget and stretched back up, the same surface measured
 * **+1.0 s/s** — a `solidScene` and change, which is the block the deadline was
 * already sized around. Cutting the budget a further third measured +0.81 s/s: a
 * fifth of a second bought for a fifth of the linear resolution, which is where
 * the trade stops being worth taking. So this is the knee of the curve rather
 * than a taste, and it is stated in PIXELS rather than as a scale because what
 * costs is the area — a portrait field and a landscape one have to be allowed
 * the same drawing.
 *
 * Every figure in this family is a RATIO to `solidScene` measured in the same
 * run and then put back on the dossier's scale. This host's software rasteriser
 * is about twice as slow in GL as the one the dossier was written on, and some
 * of these benches ran while other work had the machine: an absolute second
 * measured on a loaded box is a number about the box.
 *
 * What it costs in return is resolution, and that is why it is a FIELD rule and
 * not a house one: these three draw a lit relief, a dust and a set of rules in
 * perspective, none of which has an edge finer than the gradient across it.
 * Nothing here sets type — a block that did would have to draw at its box's own
 * pixels, and this budget is the reason none of them may.
 *
 * A field in a CELL pays nothing: a third of a zone is already under the budget,
 * so `fieldCanvas` returns its box unscaled and the drawing is sharp. Only the
 * ones that fill a frame are drawn smaller, which is the only case that was
 * expensive.
 */
export const FIELD_PIXEL_BUDGET = 640000

/**
 * The canvas a field is drawn on, and the transform that puts it back over its
 * box.
 *
 * Two scales rather than one, because a single rounded factor leaves a seam: the
 * backing store is an integer number of pixels and the box is another, so
 * `scale(1/s)` lands a fraction of a pixel short of the right edge and paints a
 * hairline of the ground down it. `scaleX`/`scaleY` are derived from the ROUNDED
 * canvas, so the drawing covers its box exactly whatever the rounding did.
 */
export function fieldCanvas(box) {
  const width = Math.max(1, Math.round(Number(box?.width) || 0))
  const height = Math.max(1, Math.round(Number(box?.height) || 0))
  const scale = Math.min(1, Math.sqrt(FIELD_PIXEL_BUDGET / (width * height)))
  const drawn = { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
  return { ...drawn, box: { width, height }, scaleX: width / drawn.width, scaleY: height / drawn.height }
}

/**
 * The camera every field is seen through, and why it is not the solid's.
 *
 * `SOLID_CAMERA` frames an OBJECT: its distance and its field of view are
 * derived from `SOLID_BOUND`, the radius at which a solid exactly touches the
 * edge of its square canvas. That derivation has no meaning here — a field has
 * no bounding sphere, it is the space the frame is cut out of — and the lens
 * that suits the two is not the same lens. An object is read on a long one,
 * because perspective distortion on a turning cube reads as a wobble; a field is
 * read on a wide one, because the depth IS the subject and a long lens flattens
 * a receding grid into a set of parallel lines.
 *
 * So there are two cameras in this feature and there is one of everything else.
 * The house rule that keeps five compositions agreeing — one easing, one cue
 * rhythm, one texture — is about MOTION, and every field below moves on
 * `composition.js`'s own clock like everything else in the catalogue.
 *
 * Every geometry in this file is sized against these two numbers, so they are
 * not free to move: `FIELD_VIEW` is the half-height of the frustum at the
 * origin, and the sheet, the dust and the grid are all measured in it.
 */
export const FIELD_CAMERA_FOV = 50
export const FIELD_CAMERA_Z = 6.4
export const FIELD_CAMERA = { position: [0, 0, FIELD_CAMERA_Z], fov: FIELD_CAMERA_FOV }

/** The half-height of what the camera sees at the origin, in the units below. */
export const FIELD_VIEW = FIELD_CAMERA_Z * Math.tan((FIELD_CAMERA_FOV / 2) * (Math.PI / 180))

/**
 * What "intensity 1" means to this renderer, for the one field that is lit.
 *
 * three has used physically correct light units since r155: a punctual light's
 * radiance is divided by pi, and the migration note is to multiply the old
 * intensities by pi to keep the old look. Without it the first render of a lit
 * solid came back a mid grey where the arithmetic said near-white — a surface
 * whose measured colour and its painted colour disagreed, which is exactly the
 * failure the legibility section exists to prevent, arriving through a
 * renderer's units rather than through a hex value.
 *
 * `solidScene.jsx` has its own copy of this constant and that duplication is
 * deliberate: it belongs to another family, and one file per family is what
 * lets twenty-odd people own a block each without meeting in a shared header.
 * `field.test.js` pins the value, so the two cannot drift into two different
 * pictures of the same arithmetic.
 */
export const LIGHT_UNIT = Math.PI

/**
 * A hash of two integers, in [0, 1). Bit-exact everywhere, which is the point.
 *
 * Integer mixing only — `Math.imul`, shifts and xors are exactly specified by
 * the language, so this answers the same on every build of every engine. The
 * usual `fract(sin(i * 12.9898) * 43758.5453)` does not: `Math.sin` is
 * accurate to within an ulp and which ulp is the engine's business, and the
 * whole value of this function is in the bits an ulp lives in.
 *
 * `k` is a lane, not a seed a document can set: there is no seed field in the
 * schema and there must not be one. A document that could reseed a field would
 * be a document that renders differently from itself, which is the same failure
 * a die is, arriving through a key instead of through a call.
 */
export function noise(i, k) {
  let h = Math.imul((Number(i) | 0) + 1, 0x27d4eb2d) ^ Math.imul((Number(k) | 0) + 1, 0x165667b1)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h ^= h >>> 12
  h = Math.imul(h, 0x297a2d39)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

// ── particleField ────────────────────────────────────────────────────────────

/**
 * How far the dust spreads, in the camera's own units.
 *
 * The vertical span is deliberately LARGER than what the camera sees, and that
 * is the whole of the `rise` drift working. A particle that walks upwards has to
 * come back, and a modulo is the only way to do that without a second buffer —
 * so the wrap has to happen where nobody is looking. `FIELD_VIEW` is the visible
 * half-height at the origin and the farthest dust sits at `-PARTICLE_DEPTH / 2`,
 * where the frustum is wider still; `PARTICLE_RISE_SPAN` clears both, so a
 * particle jumps from the top of the world to the bottom of it off-frame. Drawn
 * at exactly the visible height, it teleported through the middle of the picture
 * once per particle per scene.
 */
export const PARTICLE_SPREAD = 8.2
export const PARTICLE_DEPTH = 4.4
export const PARTICLE_RISE_SPAN = 2 * (FIELD_VIEW + PARTICLE_DEPTH * 0.62)

/** How far one particle wanders off its own place, as a share of the spacing. */
const PARTICLE_SWING = 0.16

/**
 * The three drifts, as the rates they run at. None is a whole number of
 * anything, for `solidSpin`'s reason: a field that completes its cycle inside a
 * scene ends the scene where it began it.
 *
 *   - `rise`  — the dust lifts, slowly, and turns a few degrees with it.
 *   - `orbit` — the whole cloud turns about the vertical, which is the drift
 *     that reads as VOLUME: the near dust crosses the frame faster than the far.
 *   - `swarm` — every particle runs its own small loop, out of phase with its
 *     neighbours, and the cloud stays where it is.
 */
export const PARTICLE_DRIFTS = ['rise', 'orbit', 'swarm']
const PARTICLE_DRIFT_RATES = {
  rise: { lift: 0.37, spin: 0.55, loop: 0.9 },
  orbit: { lift: 0.06, spin: 1.7 * Math.PI, loop: 0.7 },
  swarm: { lift: 0.09, spin: 0.31, loop: 3.3 },
}

/** The rates of a named drift, or `rise`'s. A name off a document, so it is never looked up. */
function driftRate(drift) {
  return typeof drift === 'string' && Object.hasOwn(PARTICLE_DRIFT_RATES, drift)
    ? PARTICLE_DRIFT_RATES[drift]
    : PARTICLE_DRIFT_RATES.rise
}

/** How far the whole cloud has turned on this frame, in radians. */
export function particleSpin(drift, life) {
  return (Math.max(0, Math.min(1, Number(life) || 0)) + 0.07) * driftRate(drift).spin
}

/**
 * Where every particle is on this frame — `count × 3` floats, x/y/z.
 *
 * Pure, and that is not a style note: it is what lets `field.test.js` prove two
 * calls agree to the bit, that the field is inside the world it declares, and
 * that no frame of a scene equals its first. The component allocates the array
 * once and this fills it, so a film of nine hundred frames does not allocate
 * nine hundred buffers.
 *
 * `into` is optional and is the same object every frame in the component. A
 * caller that passes a buffer of the wrong length gets a new one rather than a
 * half-written field: a document cannot reach that, but a test can.
 */
export function particlePositions(count, drift, life, into) {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  const t = Math.max(0, Math.min(1, Number(life) || 0))
  const rate = driftRate(drift)
  const out = into instanceof Float32Array && into.length === n * 3 ? into : new Float32Array(n * 3)

  for (let i = 0; i < n; i += 1) {
    // Its own phase and its own radius, from its index alone. Two particles that
    // share a phase move as one, which is what a field must not look like.
    const phase = noise(i, 4) * Math.PI * 2
    const swing = PARTICLE_SWING * (0.4 + noise(i, 5))
    // `- Math.floor` and not `%`: a negative phase stays negative in JavaScript,
    // and a particle at a negative height is a particle outside the world this
    // function promises its caller. Same trap `bounceLift` documents.
    const climb = noise(i, 2) + t * rate.lift
    const rise = climb - Math.floor(climb)
    const loop = t * rate.loop * Math.PI * 2 + phase

    out[i * 3] = (noise(i, 1) - 0.5) * PARTICLE_SPREAD + Math.sin(loop) * swing
    out[i * 3 + 1] = (rise - 0.5) * PARTICLE_RISE_SPAN + Math.cos(loop * 0.83) * swing
    out[i * 3 + 2] = (noise(i, 3) - 0.5) * PARTICLE_DEPTH + Math.cos(loop) * swing
  }
  return out
}

/**
 * How large one particle is drawn, in world units — and it comes DOWN as the
 * count goes up.
 *
 * Two reasons, and the second is the one that was measured. A field of nine
 * hundred dots at the size that suits sixty is a solid wall of accent, so the
 * look wants roughly constant coverage: `n · s²` fixed means `s ∝ 1/√n`. And
 * hundreds of small bright squares in motion are the worst thing h264 has ever
 * been handed — the same high-frequency detail that got a wireframe refused. At
 * the schema's ceiling this lands at seven hundredths of the way across the
 * world and the six-second export measured 2.0 MB; nine hundred of them at half
 * that size measured 3.9 MB, for a field nobody could see the shape of.
 *
 * Clamped at both ends: a sparse field of enormous blobs is not a field, and a
 * dense one of sub-pixel dots is a grey haze that costs bitrate to say nothing.
 */
export const PARTICLE_SIZE_SPAN = 1.7
export const PARTICLE_SIZE_MIN = 0.045
export const PARTICLE_SIZE_MAX = 0.16

/**
 * The same two clamps as DRAWN, once the round mask has been paid for.
 *
 * The three constants above are a calibration of a SQUARE point — that is what
 * was on the frame when the bitrate was measured and when "a sparse field of
 * enormous blobs is not a field" was decided. A disc inscribed in that square
 * covers `pi/4` of it, so drawing the same numbers as circles is 21% less ink
 * than either end of the range was signed off on. `SPRITE_AREA_GAIN` converts a
 * square's side into the disc's side of the same AREA, which is the quantity
 * both bounds are really about, and applying it to the bounds as well as to the
 * value is what keeps the range the range that was measured.
 */
export const PARTICLE_DRAWN_MIN = PARTICLE_SIZE_MIN * SPRITE_AREA_GAIN
export const PARTICLE_DRAWN_MAX = PARTICLE_SIZE_MAX * SPRITE_AREA_GAIN

export function particleSize(count) {
  const n = Math.max(1, Math.floor(Number(count) || 0))
  return Math.min(PARTICLE_DRAWN_MAX, Math.max(PARTICLE_DRAWN_MIN, (PARTICLE_SIZE_SPAN * SPRITE_AREA_GAIN) / Math.sqrt(n)))
}

// ── waveMesh ─────────────────────────────────────────────────────────────────

/**
 * The sheet, in the camera's units, and why it is this large.
 *
 * A surface that does not cover the frustum draws an EDGE across the frame, and
 * an edge is what turns a field into an object floating in a void — the defect
 * the whole box rule is written against. So the sheet is sized against the
 * camera rather than chosen: at the far side of the deepest tilt the frustum is
 * `FIELD_VIEW · (z + FIELD_CAMERA_Z) / FIELD_CAMERA_Z` half-tall and 16:9 as
 * wide as that, and `field.test.js` holds the inequality for every tilt in the
 * enum rather than leaving these three numbers as a claim.
 *
 * The segment counts are the other half of the budget, and the half
 * `FIELD_PIXEL_BUDGET` does not touch. Every vertex is rewritten on every frame
 * and the normals are recomputed from them, so this is a CPU cost that does not
 * fall when the canvas does: 48 × 28 is about six quads across the finest ripple
 * the enum offers, and past that the extra vertices buy a smoothness a moving
 * lit surface hides.
 */
export const WAVE_WIDTH = 20
export const WAVE_DEPTH = 15
export const WAVE_SEGMENTS_X = 48
export const WAVE_SEGMENTS_Y = 28

/**
 * How far the sheet is raked away from the camera, in radians.
 *
 * Two, and the ceiling is geometric rather than editorial: past about a quarter
 * turn the near edge of a sheet this size comes through the camera. A steeper
 * rake is a different block — a floor — and there is one of those next door.
 */
export const WAVE_TILTS = ['face', 'rake']
const WAVE_TILT_RADIANS = { face: -0.14, rake: -0.44 }

export function waveTilt(tilt) {
  return typeof tilt === 'string' && Object.hasOwn(WAVE_TILT_RADIANS, tilt)
    ? WAVE_TILT_RADIANS[tilt]
    : WAVE_TILT_RADIANS.rake
}

/**
 * The three swells: an amplitude, a wavelength and a speed each.
 *
 * A named look and never three numbers a document states, for `funTitle`'s
 * reason: an amplitude in a schema is where a model starts describing its own
 * rendering. These are three seas.
 *
 * Every speed is a rate per scene and none of them is a whole number of cycles,
 * so the last frame of a scene is never the first one over again. Three
 * components at ratios that do not divide each other, which is `equalizerLevels`
 * one block over: two waves at a rational ratio have a period, and a period
 * inside a six-second scene is a loop somebody watching can count.
 */
export const WAVE_SWELLS = ['calm', 'swell', 'ripple']
const WAVE_SWELL_SHAPES = {
  calm: { rise: 0.62, wave: 0.85, speed: 2.3 },
  swell: { rise: 0.72, wave: 1.35, speed: 4.1 },
  ripple: { rise: 0.42, wave: 2.2, speed: 7.3 },
}

/**
 * The three terms' weights, and the steepest the sheet can get.
 *
 * A rendered frame is what set these. The first version was gentle — an
 * amplitude a third of this against the same wavelengths — and it came back a
 * flat orange slab with a faint contour in it: a Lambert face is lit by its
 * NORMAL, and a wave whose steepest slope is eighteen degrees tilts its normals
 * by eighteen degrees, which against an ambient share of a half is a variation
 * nobody can see. What a sea looks like is slopes, so the product `rise × wave`
 * is what had to be raised, and it is now near one at every swell — a slope of
 * about forty-five degrees at the crest, which swings a normal through enough of
 * the light to read as relief rather than as a gradient.
 *
 * `WAVE_MAX_RISE` is the sum of the three amplitudes at the deepest swell, and it
 * is not decoration either: the sheet is displaced along its own normal, so it
 * eats into the margin by which the geometry covers the frustum. `field.test.js`
 * subtracts it from the coverage rather than assuming the plane is flat.
 */
const WAVE_TERMS = [1, 0.82, 0.55]
export const WAVE_MAX_RISE =
  Math.max(...WAVE_SWELLS.map((swell) => WAVE_SWELL_SHAPES[swell].rise)) * WAVE_TERMS.reduce((a, b) => a + b, 0)

function swellShape(swell) {
  return typeof swell === 'string' && Object.hasOwn(WAVE_SWELL_SHAPES, swell)
    ? WAVE_SWELL_SHAPES[swell]
    : WAVE_SWELL_SHAPES.swell
}

/** How high the sheet stands at one point of it, on one frame. */
export function waveHeight(x, y, swell, life) {
  const s = swellShape(swell)
  const t = Math.max(0, Math.min(1, Number(life) || 0)) * s.speed
  const u = Number(x) || 0
  const v = Number(y) || 0
  return (
    Math.sin(u * s.wave + t) * s.rise * WAVE_TERMS[0] +
    Math.sin(v * s.wave * 0.79 - t * 0.71) * s.rise * WAVE_TERMS[1] +
    Math.sin((u + v) * s.wave * 0.47 + t * 0.43) * s.rise * WAVE_TERMS[2]
  )
}

/**
 * The sheet's own vertices, displaced in place.
 *
 * It takes the array a `planeGeometry` already built rather than building one,
 * because the plane's x and y are what the wave is a function OF: reading them
 * back is what keeps the displacement a property of the surface instead of of
 * the index, so a sheet with a different segment count is the same sea at a
 * different resolution.
 */
export function waveDisplace(array, swell, life) {
  if (!array || typeof array.length !== 'number') return array
  for (let i = 0; i + 2 < array.length; i += 3) {
    array[i + 2] = waveHeight(array[i], array[i + 1], swell, life)
  }
  return array
}

/**
 * Where the one light that reads a relief sits.
 *
 * To the side and high, never over the camera's shoulder — see `waveMesh.jsx`.
 * A constant, because a light a document placed is a light it described.
 */
export const WAVE_LIGHT = [-5, 7, 3.5]

/** The frustum's half-height at a depth, for the coverage claim above. */
export function frustumHalfHeight(z) {
  return (FIELD_VIEW * (FIELD_CAMERA_Z - (Number(z) || 0))) / FIELD_CAMERA_Z
}

// ── depthGrid ────────────────────────────────────────────────────────────────

/**
 * The floor, in the camera's units, and the two forms it takes.
 *
 * `floor` is one plane under the eye and `tunnel` is that plane mirrored above
 * it. The second is not a decoration: a floor alone leaves the top of the frame
 * on the bare ground, which is a horizon and reads as one — right for a scene
 * whose subject is distance, wrong for a scene that wanted the whole frame to be
 * this. Two draw calls per rule instead of one, and the measurement says that
 * costs nothing: the grid is thirty thin boxes and it is the cheapest of the
 * three fields either way.
 */
export const GRID_FORMS = ['floor', 'tunnel']
export const GRID_SPAN = 19
export const GRID_DEPTH = 27
export const GRID_TILT = -1.26
export const GRID_LIFT = 2.55

/**
 * How thick a rule is, in world units — a share of the gap between two of them
 * and not a hairline in pixels.
 *
 * The three `CONSTANT_METRICS` are constants because a viewer reads them as the
 * same object from one scene to the next, and that argument does not survive a
 * camera: a rule of one pixel at the near edge of this floor is fourteen at the
 * far one, because that is what perspective IS. So the thickness is a share of
 * the grid's own spacing, which keeps a grid of six rules and one of sixteen
 * looking like the same floor at two densities rather than like a floor and a
 * mesh.
 */
export const GRID_RULE_SHARE = 0.032

/**
 * How fast the floor dissolves into the ground behind it — and this one number
 * is worth more than every other in this section put together.
 *
 * A grid in perspective converges, and where it converges the rules land a pixel
 * or two apart: a band of alternating pixels crawling towards a vanishing point,
 * which is the exact high-frequency detail h264 has nothing to spend but
 * bitrate on. Measured without it, the densest legal floor came back at **6.0 MB
 * for six seconds** against a lit solid's 0.86 — three quarters of the way to
 * the 9.8 MB that got a wireframe refused — and at +1.15 s of render per second
 * of film, which made the cheapest of the three fields the dearest.
 *
 * Fog costs nothing and fixes both: with it the same floor is 4.1 MB and
 * +0.85 s/s. It is also, unusually, the right PICTURE:
 * a floor whose far end simply stops has a visible edge across the frame, and
 * one that dissolves is what distance looks like. And it is inside the
 * legibility guarantee by construction rather than by luck — fog blends towards
 * the ground colour, so every pixel of the block still lies between the bare
 * ground and the accent, which is the pair `composedPalette` measures for this
 * field.
 *
 * `fogExp2`, so the density is `1 − exp(−(density · distance)²)`: at the far end
 * of the floor, about nineteen units out, that is two thirds gone, and the rules
 * that are actually converging are past it.
 */
export const GRID_FOG_DENSITY = 0.058

export function gridThickness(lines) {
  return (GRID_DEPTH / Math.max(2, Math.floor(Number(lines) || 0))) * GRID_RULE_SHARE
}

/**
 * The three travels. `still` is deliberately absent, and that is `OVERLAY_MOVES`'
 * argument rather than `kenBurns`'s: a drift here crops nothing and hides
 * nothing, so a document buys nothing by asking the floor to hold — and what it
 * would cost is the one guarantee this feature refuses to lose by accident.
 *
 * The rates are cells per scene and none is a whole number, for the reason every
 * rate in this file is not: a floor that has scrolled exactly five cells is a
 * floor that has not moved.
 */
export const GRID_TRAVELS = ['toward', 'away', 'sway']
const GRID_TRAVEL_RATES = { toward: 5.3, away: -5.3, sway: 0 }
const GRID_SWAY_RADIANS = 0.21

function travelRate(travel) {
  return typeof travel === 'string' && Object.hasOwn(GRID_TRAVEL_RATES, travel)
    ? GRID_TRAVEL_RATES[travel]
    : GRID_TRAVEL_RATES.toward
}

/** How far the floor has swung about the vertical, for the one travel that does. */
export function gridSway(travel, life) {
  const t = Math.max(0, Math.min(1, Number(life) || 0))
  if (travelRate(travel) !== 0) return 0
  // Not a whole period and not starting at zero: `solidSpin`'s `rock` had both
  // faults and rendered its first and last frame identically.
  return Math.sin((t * 1.6 + 0.13) * Math.PI) * GRID_SWAY_RADIANS
}

/**
 * Every rule of the floor on this frame: where it sits and how present it is.
 *
 * The near rules are drawn at full strength and the far ones fade out, and the
 * fade is what makes a receding grid affordable. Undimmed, the rules converge
 * towards the horizon into a band of alternating pixels — the high-frequency
 * detail h264 spends its whole allowance on, and precisely what got a wireframe
 * refused at sixteen times the bitrate of a lit solid.
 *
 * Every opacity lies between nothing and one, so what the frame is painted with
 * is somewhere between the bare ground and the accent — the two colours
 * `composedPalette` measures for a field. A block that painted outside that pair
 * would be a surface nobody measured, which is the founding mistake of the whole
 * legibility section.
 */
export function gridRules(lines, travel, life) {
  const n = Math.max(2, Math.min(64, Math.floor(Number(lines) || 0)))
  const t = Math.max(0, Math.min(1, Number(life) || 0))
  const advance = t * travelRate(travel)
  const step = GRID_DEPTH / n
  const out = []

  for (let i = 0; i < n; i += 1) {
    // The rules that run away from the eye. They do not travel: they are what
    // the travelling ones are measured against, and a grid whose two axes both
    // moved would read as a floor sliding sideways.
    out.push({ axis: 'depth', at: (i / (n - 1) - 0.5) * GRID_SPAN, opacity: 1 })
  }
  for (let i = 0; i < n; i += 1) {
    // `- Math.floor` again: `advance` is negative for `away`, and a negative
    // modulo in JavaScript puts the rule outside the floor rather than at the
    // other end of it.
    const walked = (i + advance) / n
    const wrapped = walked - Math.floor(walked)
    const at = (wrapped - 0.5) * GRID_DEPTH
    // 0 at the far edge, 1 at the near one. The rule closest to the camera is
    // also the one crossing the most pixels, so the fade spends the least where
    // it costs the most.
    const near = wrapped
    out.push({ axis: 'across', at, opacity: 0.12 + near * 0.88, step })
  }
  return out
}
