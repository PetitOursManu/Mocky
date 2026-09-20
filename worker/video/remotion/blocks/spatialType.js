/**
 * The arithmetic of the one block that sets TYPE in three dimensions —
 * `extrudedType`.
 *
 * No React, no Remotion, no `three`. The same reason `setPiece.js` states it
 * twice: what a `.jsx` computes is what no test can reach, and this file is the
 * whole of what can go wrong in an mp4 nobody previewed — a title that left its
 * box because the near end of a turned line is magnified, a letter cut in half
 * because a size was solved on the wrong advance, and a line of type that turned
 * by a whole period and came back on the phase it started on.
 *
 * It is a NEW file rather than three more sections of `setPiece.js`, and that is
 * not tidiness: that file is the arithmetic of `funTitle`, `codeBlock` and
 * `solidScene`, and this family is being written beside three others in the same
 * pass. A separate module is what lets each of them be reviewed, reverted and
 * owned on its own.
 *
 * ── Why there is no glyph geometry in this file ──────────────────────────────
 *
 * The obvious way to extrude a letter is `ExtrudeGeometry` over the glyph's
 * outline, which is what `@react-three/drei`'s `<Text3D>` does. It was measured
 * before it was refused, exactly as Skia was for `funTitle`: **+118.9 MiB
 * installed and +59 packages on a base of 185.9 MiB** — a 64% larger install for
 * one block — and that is the cheaper half of the objection.
 *
 * The expensive half is the FONT. `Text3D` does not read a system font: it needs
 * a `typeface.json`, a facetype-converted outline dump that has to be generated
 * at build time and shipped in the image. This container installs exactly ONE
 * family (`fonts-liberation`, see the Dockerfile), and every flat block in this
 * directory names the direction's declared typeface FIRST and falls back to that
 * family — which is how "the project asked for Cormorant Garamond" becomes
 * readable text in a container with no egress. A `typeface.json` cannot do that:
 * it is one baked outline set, so a 3D title would be Liberation Sans on every
 * theme in the product while the heading beside it honoured the direction. That
 * is a film in two typefaces, and it is exactly the failure `theme.ts` refuses
 * when it declines to guess a token.
 *
 * So the type is RASTERISED by the browser that is already rendering the frame —
 * `theme.headingFont`, the same stack the flat blocks set — and the third
 * dimension is real geometry carrying it: one textured quad per WORD for the
 * face, `SPATIAL_LAYERS` behind it for the thickness, in a real scene with a
 * real camera that really turns. `funTitle` and `codeBlock` are what Skia became
 * without a package; this is what `Text3D` becomes without one.
 *
 * A word rather than a letter, and that is a measurement rather than a taste:
 * the numbers are in `SPATIAL_LAYERS` and they refused per-glyph geometry at
 * eight times what the deadline leaves. It gives back the only thing per-letter
 * placement was ever going to lose, which is the kerning the face was drawn
 * with.
 *
 * ── And why the projection is a long lens rather than a wide one ─────────────
 *
 * A wide-angle camera keystones a line of type: the near end of a turned word is
 * magnified and the far end is minified, so one word is set at two sizes and the
 * eye reads the difference as a mistake rather than as depth. `SPATIAL_FOV` is a
 * portrait lens, which leaves the two ends of a line very nearly the same size
 * while the TURN still slides the extrusion out from behind the face — and that
 * is what makes it read as thick. The residue is not ignored: it is the `fit`
 * and the `sway` in `spatialLayout`, and both are reserved rather than hoped
 * for.
 */
import {
  LINE_SAFETY,
  blockAppetite,
  blockExtent,
  blockShape,
  runAdvanceEm,
  shapeCeiling,
  solveTypeUnit,
  textWidth,
  typeRole,
} from '../composition.js'
import { letterAt } from './setPiece.js'

/** A positive length in pixels, or 0. `composedLayout` guarantees it; a hand-built test does not. */
const px = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

const RAD = Math.PI / 180

/**
 * The two roles a three-dimensional line may take, and why there is no third.
 *
 * `display` is a title card and `title` is a wordmark — the two things anybody
 * has ever extruded. `heading`'s third role, the body step, is deliberately
 * absent: at that size the whole thickness of a `deep` extrusion is under four
 * pixels, so a GL canvas, a texture per glyph and a tenth of the render budget
 * would be spent drawing a line indistinguishable from the flat one next door.
 * A block that costs a renderer has to be visibly worth it, which is the same
 * sentence `BLOCK_FAMILIES.setPiece` is built on.
 */
export const SPATIAL_ROLES = { display: 'display', title: 'title' }

/** The role a block sets its line at. `display` for anything the schema does not name. */
export function spatialRole(block) {
  const level = String(block?.level ?? '')
  return Object.hasOwn(SPATIAL_ROLES, level) ? SPATIAL_ROLES[level] : SPATIAL_ROLES.display
}

/**
 * How thick the extrusion is, as a share of the TYPE SIZE — never of the frame
 * and never of the box.
 *
 * A share of the size is what makes `deep` mean the same thing on a corner
 * wordmark and on a full-frame title: the thickness is a proportion of the
 * letter, which is what a typographer means by a heavy or a light extrusion.
 * A share of the box would make a small title in a large zone come back as a
 * slab with a word on the front of it.
 *
 * The top of the range is a quarter and not one, and the bound is the SEAM
 * rather than the look. The thickness is closed by a stroke laid under each copy
 * (`dilate` in `extrudedType.jsx`) whose width is proportional to it, and a
 * stroke past about five per cent of the em fills the aperture of an `e` — a
 * word of filled letters is a word nobody reads, which is the one thing this
 * family may not produce. `deep` at 0.27 lands the stroke at 2.0% of the em on
 * the widest angle any move reaches — the thickness is `SPATIAL_LAYERS` copies
 * and each closes only the step it takes — and `spatialType.test.js` holds the
 * inequality over every combination the schema can state.
 */
export const SPATIAL_DEPTHS = { shallow: 0.10, medium: 0.19, deep: 0.27 }

/** A named depth, or the middle one. Same `Object.hasOwn` argument as everywhere else in the renderer. */
export function spatialDepthShare(depth) {
  return typeof depth === 'string' && Object.hasOwn(SPATIAL_DEPTHS, depth) ? SPATIAL_DEPTHS[depth] : SPATIAL_DEPTHS.medium
}

/**
 * HOW MANY OBJECTS THIS BLOCK IS ALLOWED TO BE, AND THE MEASUREMENTS THAT SET
 * THE NUMBER.
 *
 * The thickness is copies of the type stacked along the depth axis, because
 * there is no outline to sweep (see the header). The first version stacked them
 * per LETTER, which is the obvious reading of "letters arriving in space", and
 * it was measured in the container before it was kept. Two-core worker,
 * `--cpus=2.0 --memory=4g`, 1080p/30, 6 s of film, best of two:
 *
 *   control, a flat `heading`                     13.2 s   2.20 s/s
 *   `solidScene`, full-frame lit sphere           20.8 s  +1.26 s/s
 *   this block, 16 letters x 10 copies = 176      75.1 s  +10.3 s/s
 *   this block, 16 letters x  2 copies =  48      32.1 s   +3.1 s/s
 *
 * Two points on a line through the OBJECT count: 0.084 s of render per second of
 * film per object. The dossier's own scale puts `solidScene` at +0.9 s/s where
 * that bench read +1.26, so the 1.7 s/s the duration-scaled deadline leaves
 * spare is about 2.4 s/s here — twenty-eight objects. A sixteen-letter line at
 * ten copies is 176 of them and a twenty-four-letter one at TWO copies is 72:
 * per-glyph geometry does not fit, and no number of copies makes it fit. It is
 * refused here with its figure exactly as the wireframe was one block over.
 *
 * So the object is a WORD, and the seam between two copies is closed by
 * DILATION rather than by count: each copy is stroked by the step it takes, so
 * ONE copy behind the face is a solid side. `SPATIAL_GROUPS` words, one copy and
 * a face each — six objects, whatever the line says. What it also buys back is
 * the kerning the face was drawn with, which a line placed letter by letter
 * loses on every pair.
 *
 * Measured again, same bench, and this is what shipped:
 *
 *   control, a flat `heading`, 6 s               12.1 s   2.02 s/s
 *   `solidScene`, full-frame lit sphere          19.6 s  +1.25 s/s
 *   this block, full frame, `deep`               18.9 s  +1.13 s/s
 *   FOUR of them, one per corner                 23.5 s  +1.91 s/s
 *   control 30 s / this block 30 s        54.6 / 82.5 s  +0.93 s/s
 *
 * **0.90 of what a lit solid costs on the same run, which is about +0.8 s/s on
 * the dossier's scale** — additive, linear in the film's length (the 30 s figure
 * is the same number measured over five times the frames), and 0.97 MB against
 * the control's 0.65 for six seconds, where the refused wireframe was sixteen
 * times its control. Four of them on ONE frame is +1.37 s/s and still inside the
 * spare, which is the property the layout gives this family for nothing: a
 * canvas is the block's own BOX, so a crowded scene does not get expensive, it
 * gets small.
 */
export const SPATIAL_LAYERS = 6

/**
 * WHY IT IS SIX AND NOT THE ONE THIS FILE SHIPPED WITH.
 *
 * One copy behind the face is geometrically a correct extrusion — the projection
 * here is a long lens, so a side under it really is a band of constant width —
 * and it renders as a STICKER. Four crops of four real exports say the same
 * thing: a white word with a hard-edged flat green silhouette offset behind it is
 * what `funTitle`'s `stack` treatment draws with a `text-shadow`, and this block
 * costs a renderer to draw it.
 *
 * What a solid side has that a shadow does not is a GRADIENT: the far end of an
 * extrusion is turned away from the light and the near end is not. One quad
 * cannot carry one — a single texture painted in one colour is one flat plane
 * whatever it is behind — so the thickness has to be built out of enough copies
 * for `spatialShade`'s ramp to read as a surface rather than as two tones. Six
 * leaves the ramp's own staircase under a raster pixel at 1080p on the widest
 * side the schema can state, which is the condition it has to meet: at 1:1 the
 * band reads as one gradient, and the steps are only findable at 4×.
 *
 * It is inside the budget this file's own arithmetic set, which is the point of
 * having written the budget down: `SPATIAL_GROUPS · (SPATIAL_LAYERS + 1)` is 21
 * against the 28 objects the deadline affords, and `spatialType.test.js` holds
 * that inequality rather than trusting this sentence. It is also much cheaper
 * than an object of the kind that bench measured: those 176 objects were 176
 * RASTERS, one per glyph, and these six share the one `sides` canvas the word was
 * already drawn into — six draw calls of one texture, measured at +0.1 s/s over
 * the single-copy version on the same 10 s films as the rest of this pass.
 */

/**
 * How dark the side is at each step of its depth, as a MULTIPLIER on the colour
 * the material already carries.
 *
 * ── Why this is a shade and not a colour ────────────────────────────────────
 *
 * Every value below is a grey, and a grey multiplied into a texture is exactly
 * what `<meshLambertMaterial>` does to `palette.solid.color` one block over: the
 * Lambert term darkens a measured colour by the cosine of an angle, and this
 * darkens a measured colour by how far down the extrusion it is. No hue is
 * invented, nothing is brightened, and the brightest pixel of the side is still
 * exactly `palette.accent` — the run the palette resolved, at the value it
 * resolved it to. A ramp that could raise a value would be writing a colour; one
 * that can only lower it is drawing a shadow.
 *
 * ── Why lowering it is safe on both polarities ──────────────────────────────
 *
 * The side carries no glyph. The FACE carries the word, in `palette.display`, and
 * nothing here touches it. On a paper theme a darker side is more contrast
 * against the ground, not less; on a cinema theme it is less, and less is what a
 * receding surface should be — the deep end of an extrusion sinking towards the
 * ground it stands on is the picture, not a loss. This is `STACK_SEPARATION`'s
 * argument for `funTitle`'s shadow with the polarity spelled out.
 *
 * The floor is where it is because a side that reaches the ground on a dark theme
 * has stopped being a side: at half, `deep` still reads as one object turning
 * rather than as a word with a hole behind it.
 *
 * @param {number} layer 0 for the deepest copy, `layers - 1` for the one under the face
 * @param {number} [layers] how many copies the side is made of
 * @returns {string} a grey `#rrggbb`, for the material's `color`
 */
export const SPATIAL_SHADE_FLOOR = 0.5

/**
 * What a tile that is NOT shaded multiplies by: white, which is the identity.
 *
 * It lives here and not in the component because `blocks.test.js` sweeps this
 * directory for hex values and is right to — a block that can write `#ffffff`
 * can write `#c8a24a`, and the sweep cannot tell the two apart. White is the one
 * value that changes nothing, so it is not a colour but an ARGUMENT, and
 * arguments belong in the file the rest of this family's numbers are in.
 */
export const SPATIAL_NO_SHADE = '#ffffff'

export function spatialShade(layer, layers = SPATIAL_LAYERS) {
  const n = Math.max(1, Math.floor(Number(layers) || 0))
  const i = Math.min(n - 1, Math.max(0, Math.floor(Number(layer) || 0)))
  // The nearest copy sits against the face and is the accent at full strength;
  // the deepest is at the floor. One copy is a side with no depth to ramp over,
  // so it keeps the value the block had before the ramp existed.
  const at = n === 1 ? 1 : i / (n - 1)
  const value = SPATIAL_SHADE_FLOOR + (1 - SPATIAL_SHADE_FLOOR) * at
  const byte = Math.max(0, Math.min(255, Math.round(value * 255)))
  const hex = byte.toString(16).padStart(2, '0')
  return `#${hex}${hex}${hex}`
}

/**
 * How many words a line is drawn as, at most.
 *
 * Three, and the product is what matters: three words times a face and one copy
 * is SIX objects, which is where the measurement above lands the block at about
 * +0.8 s/s on the dossier's scale — under what a full-frame lit solid costs, and
 * half of the 1.7 the deadline leaves.
 *
 * A line with more words than this keeps its first two and draws everything
 * after them as one group: the schema bounds the text at twenty-four
 * characters, so a fourth word is three or four letters and the group it joins
 * is at the end of the line, where a shared arrival reads as a phrase rather
 * than as a mistake.
 */
export const SPATIAL_GROUPS = 3

/**
 * The lens, in degrees of vertical field.
 *
 * Six, which is a very long lens, and the number was arrived at by measuring
 * rather than by taste. The camera's distance is set by this angle (the canvas
 * is two world units tall by construction), so the field of view is the only
 * lever on how much the near end of a turned line is magnified relative to its
 * far end — and a line of type is WIDE. A block given the whole safe area of a
 * 16:9 frame is nine world units across against a canvas two units tall, so at
 * twelve degrees the near end of a seven-degree sway came back 14% larger than the
 * far end at the schema's longest line: one word set at two sizes, which is
 * exactly what the header calls a mistake rather than depth. At four it is 4.5%,
 * which nothing reads.
 *
 * What a long lens costs is the converging-lines cue, and for an extrusion a few
 * hundredths of the measure deep there is nothing to converge. The depth is read
 * from the PARALLAX — the thickness sliding out from behind the face as the line
 * turns — and that is the same number at any focal length.
 */
export const SPATIAL_FOV = 4

/**
 * The half-height of the world at the plane the type is set on.
 *
 * One, so that the canvas is exactly two world units tall and the pixel-to-world
 * conversion is a division by the canvas height and nothing else. Every length
 * below is in these units once it has been through `spatialLayout`.
 */
export const SPATIAL_HALF = 1

/** Where the camera stands, so that `SPATIAL_HALF` fills the canvas at z = 0. */
export const SPATIAL_CAMERA_Z = SPATIAL_HALF / Math.tan((SPATIAL_FOV / 2) * RAD)

/**
 * How far the line SWINGS, per named move, in degrees.
 *
 * All three are small, and that is the difference between type in three
 * dimensions and a solid in them. `solidScene` may turn through a whole
 * revolution because a cube seen edge-on is still a cube; a word seen edge-on is
 * a vertical bar. The amplitudes here are the largest at which every glyph of a
 * line still reads: past about twenty-five degrees the counters of the round
 * letters close and the word is a texture. There are only TWO of them because
 * the third move is a depth rather than an angle — see `SPATIAL_FLOAT_DEPTH`,
 * where the reason is a cost and not a taste.
 */
export const SPATIAL_SWAY_DEG = 7
export const SPATIAL_TILT_DEG = 5

/**
 * THE ATTITUDE THE LINE STANDS AT, and the defect it was written for.
 *
 * The swing above is a SINE, centred on nothing: it crosses zero once in every
 * scene, and at that frame the extrusion is exactly behind the face and the
 * block draws a flat title. Away from it the parallax was
 * `depth · sin(7°)` — 3.3% of the type size at the widest depth the schema
 * offers, about nine pixels on a 280 px cap, and only at the peak. Three crops
 * of a real export came back as flat type with a green drop shadow, which is
 * what `funTitle`'s `stack` draws with a `text-shadow` and no renderer.
 *
 * A block whose whole subject is volume has to draw volume on EVERY frame, which
 * is `DEFAULT_KEN_BURNS`'s rule read one level down: a term is announced only
 * when it is drawn, and "thickness" was being announced on the frames it was not.
 *
 * ── Why a resting angle rather than a wider swing ───────────────────────────
 *
 * They are two different costs and only one of them is worth paying. A swing is
 * MOTION: doubling it is a title that tacks across the frame, which is the
 * sea-sickness the small amplitudes above were chosen against, and it still
 * spends part of every scene at zero. A resting angle costs no motion at all —
 * it is where the object STANDS — and it is what a photographer does with a
 * three-quarter view: the object is turned so that two of its faces are visible
 * at once, and then it barely moves.
 *
 * What it costs is foreshortening and keystoning, and the long lens is what
 * makes both nearly free. At eleven degrees a word is condensed by `1 − cos 11°`
 * = 1.8%, and at the peak of its swing by 4.9% — a WHOLE-WORD condensation and
 * not a distortion, since no letter differs from its neighbour. What it buys is
 * an extrusion showing a quarter of its own thickness at rest and a third at the
 * peak, against an eighth at the peak and NOTHING at the crossing before it. The
 * keystone, which is the thing an eye does read as a mistake, is bounded
 * separately and by the box: `spatialLayout` lowers the turn on a wide line until
 * the near end is within `SPATIAL_KEYSTONE_MAX` of the far one, and the attitude
 * is inside that bound like everything else — on the widest line the schema can
 * state it is taken away entirely.
 *
 * ── And why the PITCH has one too, which is the half that survives ──────────
 *
 * The yaw slides the extrusion sideways, out from behind the vertical stems. The
 * pitch slides it UP, out from behind the horizontals — and the two together are
 * what stops the result reading as a drop shadow: a shadow falls down and to the
 * right, and this falls up and to the left, which no viewer reads as one.
 *
 * It also survives the case the yaw does not. Keystoning is a property of the
 * MEASURE and a line is wide, not tall — nine degrees of pitch on a line box
 * keystones by half a per cent where the same angle across a full-frame measure
 * spends the whole budget — so `spatialLayout` clips the yaw of a long line and
 * never the pitch, and on the widest line the schema can state the pitch is the
 * whole of the relief. Nine degrees, which is above every pitch amplitude below,
 * so the line is never level and the extrusion never closes.
 */
export const SPATIAL_REST_YAW_DEG = 11
export const SPATIAL_REST_PITCH_DEG = 9

/**
 * How much of each amplitude a named move uses, on each axis.
 *
 * One table read by both the MOVE and the BOUNDS, which it was not: the bound
 * for `tilt` said five degrees of yaw where the move used two and a half, so the
 * layout reserved room for an angle the frame never showed. Two spellings of one
 * quantity is how a reservation and a drawing drift apart.
 */
const SPIN_SHARES = {
  sway: { yaw: 1, pitch: 0.4 },
  tilt: { yaw: 0.35, pitch: 1 },
  float: { yaw: 0.25, pitch: 0.25 },
}

function spinShare(spin) {
  return typeof spin === 'string' && Object.hasOwn(SPIN_SHARES, spin) ? SPIN_SHARES[spin] : SPIN_SHARES.sway
}

/** How far a named move swings each axis, in radians. The rest angle is not in these. */
export function spatialYawSwing(spin) {
  return spinShare(spin).yaw * SPATIAL_SWAY_DEG * RAD
}

export function spatialPitchSwing(spin) {
  return spinShare(spin).pitch * SPATIAL_TILT_DEG * RAD
}

/**
 * How much of its own thickness the side shows on the WORST frame of the worst
 * line — the number `SPATIAL_REST_PITCH_DEG` exists to keep off zero.
 *
 * Six per cent, and it is a floor rather than the value: the ordinary line runs
 * between a seventh and a third of its thickness, and this is what is left in the
 * worst corner of the sweep — a `tilt`, whose pitch is its move and therefore
 * swings closest to level, on a line wide enough that the keystone has taken the
 * whole attitude away and clipped the yaw to `SPATIAL_SWAY_FLOOR` as well. It
 * measures 7.2% there. `spatialType.test.js` sweeps every move against every clip
 * and holds the inequality; before the resting attitude the same sweep answered
 * ZERO, once per scene, for all three moves.
 */
export const SPATIAL_RELIEF_FLOOR = 0.06

/**
 * The share of its own thickness the extrusion projects on one frame.
 *
 * An extrusion runs along the depth axis, so what it puts on the FRAME is its
 * length times the sine of whatever the line is turned by — `sin(yaw)` across
 * and `sin(pitch)` up, and the two are perpendicular on the frame, so the offset
 * is their hypotenuse. It is a pure function of the move so that the claim above
 * is arithmetic rather than a crop somebody looked at.
 */
export function spatialRelief(spin, life, allowed) {
  const at = spatialSpin(spin, life, allowed)
  return Math.hypot(Math.sin(at.yaw), Math.sin(at.pitch))
}

/**
 * How far a word breathes in DEPTH under `float`, in type sizes.
 *
 * The third move is a translation and not a third rotation, and that is a cost
 * decision written into the look. Every angle the block turns to has to be paid
 * for in DILATION — the stroke that closes the seam between two copies of the
 * stack is proportional to the sine of the resting turn, and a per-word rotation
 * of fourteen degrees put a ring of nine per cent of the em around every word,
 * which fills the aperture of an `e`. Buying more layers instead is the object
 * budget, which is already spent.
 *
 * A depth costs neither. The words sit at slightly different distances and drift
 * between them, so the line breathes and the perspective does the work — three
 * per cent of size between the nearest word and the farthest, which is a
 * difference a viewer reads as space rather than as a size.
 */
export const SPATIAL_FLOAT_DEPTH = 0.9

/**
 * How many times each move crosses its own middle in one scene, and none of them
 * is a whole number.
 *
 * `solidSpin`'s bug, one block over, and it is worth restating because this
 * family is where it is most likely to come back: a probe rendering frames 0, 45
 * and 90 of a cube turning a quarter-turn per beat produced three byte-identical
 * PNGs. A line of type swinging through a whole number of periods ends the scene
 * on the phase it started on — and `tests/video-motion.test.js` compares exactly
 * those two frames. The offsets are what stop the first frame sitting at the
 * middle of the swing as well, which is where a sine starts.
 */
const SWAY_PERIODS = 1.3
const TILT_PERIODS = 0.9
const FLOAT_PERIODS = 1.1
const SWAY_PHASE = 0.12
const TILT_PHASE = 0.31
const FLOAT_PHASE = 0.07

/** How far behind its neighbour a word floats. This is what makes it a wave and not a pulse. */
const FLOAT_LAG = 0.17

/**
 * How far behind the plane a word starts, in TYPE SIZES, and how far it is
 * turned when it gets there.
 *
 * BEHIND, always, and that is the whole of the arrival's safety argument. A word
 * arriving from in FRONT of the plane is magnified by the camera on its first
 * frames, so it draws outside the box the layout gave the block — the
 * `funTitleHeadroom` lesson, arriving through a camera instead of through a
 * padding. A word arriving from behind is smaller than it will end up, so every
 * frame of the entrance is inside the frame the last one occupies, and there is
 * nothing to reserve.
 *
 * Nothing here fades. The face is painted at the ink `composedPalette` measured
 * and it is painted at full strength on every frame it exists — an opacity ramp
 * would put every word, for the frames it lasted, in a colour composited from
 * the ink and the ground that nobody measured and that no floor covers. That is
 * `heading`'s rule about its mask and `solidScene`'s about its scale; the
 * arrival is DEPTH here for the same reason it is a scale there.
 */
export const SPATIAL_ENTER_DEPTH = 2.6
export const SPATIAL_ENTER_TURN_DEG = 24

/**
 * The share of its own canvas the drawing is allowed to take before the camera
 * is applied.
 *
 * The canvas has to be decided BEFORE the projection can be worked out — the
 * world scale is two units over the canvas height, so a canvas that depended on
 * the projection would not solve, and a fixpoint that fails to converge is a
 * title drawn at NaN px (Q1). So the canvas is sized on the drawing's own
 * dimensions plus this margin, the magnification is then measured against a
 * canvas that exists, and `fit` gives back whatever the margin did not cover.
 *
 * A tenth, which is about twice the largest magnification a 12-degree lens
 * produces on the widest line the schema allows. The cost of the slack is a
 * title a few per cent smaller; the cost of being short of it is a letter
 * through the edge of its own canvas, and a clipped glyph is the one defect in
 * this feature a viewer reads as broken software.
 */
export const SPATIAL_ROOM = 0.9

/**
 * How much larger the near end of a turned line may be than its far end.
 *
 * One word set at two sizes reads as a mistake rather than as depth, and five
 * per cent is where the difference stops being visible across a line - a
 * neighbouring pair of letters then differs by a fortieth of that, which is
 * nothing. `spatialLayout` holds it by lowering the SWAY on a wide line rather
 * than by lengthening the lens further, for the reason written there.
 */
export const SPATIAL_KEYSTONE_MAX = 1.05

/**
 * How little of its own move a line may be reduced to before the keystone is
 * accepted instead.
 *
 * A film in which nothing moves must not be producible by accident - the rule
 * `DEFAULT_KEN_BURNS` is written about - and a bound with no floor is exactly
 * that: the widest legal line would sway by a fraction of a degree and read as a
 * flat title somebody paid a renderer for. Past this the trade reverses and the
 * frame carries a keystone it can afford (Q1).
 */
export const SPATIAL_SWAY_FLOOR = 0.4

/**
 * How far the drawing may be scaled UP to fill what `blockExtent` claims for it.
 *
 * The estimate that solved the size is conservative on purpose — see `boost` in
 * `extrudedType.jsx`, and the rendered frame that filled 74% of its own measure
 * — so the block recovers the slack rather than leaving a quarter of the frame
 * empty beside a title. A half is far more than any real face needs against
 * `GLYPH_CLASS_EM`; it is here so that a measurement THIS FILE DID NOT MAKE
 * cannot scale a title through the frame. A font reporting an absurd advance is
 * not a case anybody has seen, and it is one line to make impossible.
 */
export const SPATIAL_BOOST_MAX = 1.5

/**
 * How the rasters are made, in the units the component draws them at.
 *
 * The face of a word is a quad carrying a picture of that word, drawn by the
 * browser's own text engine at `SPATIAL_SUPERSAMPLE` times the size it will be
 * seen at — so the texture has a spare sample per screen pixel and the edges
 * survive the projection. `SPATIAL_RASTER_MAX` is what stops a full-frame title
 * from allocating a quarter of a gigabyte of texture: past that many pixels of
 * em the type is upscaled by a fraction of a per cent per pixel, which no viewer
 * sees and which every frame of the render pays for.
 *
 * `SPATIAL_GLYPH_BOX` is the raster's height in ems — enough for the ascender
 * and the descender of any face the direction can name — and `SPATIAL_GLYPH_PAD`
 * is the room a word is allowed to overhang its own advance by, which is what an
 * italic `f` and a swash `Q` need and what an advance measured from the font
 * does not include.
 */
export const SPATIAL_SUPERSAMPLE = 2
export const SPATIAL_RASTER_MAX = 256
export const SPATIAL_GLYPH_BOX = 1.34
export const SPATIAL_GLYPH_BASELINE = 1.02
export const SPATIAL_GLYPH_PAD = 0.14

/**
 * The words a line is drawn as — the objects, and there are never more than
 * `SPATIAL_GROUPS` of them.
 *
 * A word and not a letter, and the measurement is in `SPATIAL_LAYERS`. What it
 * buys back is typography: a word rasterised whole is a word the browser has
 * KERNED, where a line placed letter by letter loses every pair the face was
 * designed with. `logoType` and `funTitle` pay that price because their whole
 * subject is the individual letter; this block's subject is the line.
 *
 * The overflow joins the LAST group rather than being dropped or given a group
 * of its own: a line of six words comes back as three words and a phrase, which
 * arrives as one thing. Trailing and repeated spaces collapse, because a group
 * is a thing that arrives and an empty one is a beat with nothing in it.
 */
export function spatialGroups(text) {
  const words = String(text ?? '')
    .split(/\s+/)
    .filter((word) => word.length > 0)
  if (words.length <= SPATIAL_GROUPS) return words
  const kept = words.slice(0, SPATIAL_GROUPS - 1)
  kept.push(words.slice(SPATIAL_GROUPS - 1).join(' '))
  return kept
}

/**
 * The widest angle the LINE reaches, and the widest one a WORD reaches inside
 * it — two numbers, in radians, because they swing two different levers.
 *
 * The line's angle acts on half the MEASURE: a line two thirds of a frame wide
 * that turns seven degrees brings its near end a long way towards the camera. A
 * word's own angle acts on half a WORD, which is the same trigonometry over a
 * length several times smaller. Folding the two into one bound was the first
 * version and it cost a fifth of the type size for nothing — the roll was
 * charged against the whole line as though it were rigid.
 *
 * They still ADD where they meet, in `spatialLayout`, because `roll` turns each
 * word inside a line that is itself swaying: a bound taken on either alone is a
 * bound the other crosses. Same reason `driftRoom` is added to the safe area
 * rather than compared with it.
 *
 * The ENTRANCE is in the word's number and not in a third one: every move
 * arrives with its words turned, so the widest a word is ever set at is the
 * larger of its roll and its entrance.
 *
 * The line's number is its resting attitude PLUS its swing, which is what makes
 * every caller correct without knowing about the attitude at all: the dilation
 * closes the seam at the angle the stack is spread furthest at, the layout
 * reserves the room the thickness projects to at that same angle, and the
 * keystone bound lowers exactly the quantity it is bounding. A rest angle added
 * to the move and not to this would be an angle nothing reserved room for.
 */
export function spatialLineTurn(spin) {
  return SPATIAL_REST_YAW_DEG * RAD + spatialYawSwing(spin)
}

/** The same, on the other axis: the widest the line is ever pitched. Never clipped — see the rest angle. */
export function spatialLinePitch(spin) {
  return SPATIAL_REST_PITCH_DEG * RAD + spatialPitchSwing(spin)
}

export function spatialGroupTurn(spin) {
  return Math.max(spatialRestTurn(spin), SPATIAL_ENTER_TURN_DEG * RAD)
}

/** How far a word floats out of the plane on this frame, in type sizes. Zero unless it floats. */
export function spatialFloat(spin, index, life) {
  if (spin !== 'float') return 0
  const t = Number(life) || 0
  const i = Math.max(0, Math.floor(Number(index) || 0))
  // Half a cycle above the plane and half below would put a word in FRONT of it,
  // which is the one thing the arrival is not allowed to do — see
  // `SPATIAL_ENTER_DEPTH`. So it is a positive depth throughout: the word breathes
  // between the plane and `SPATIAL_FLOAT_DEPTH` behind it, and never in front.
  const wave = Math.sin(2 * Math.PI * (FLOAT_PERIODS * t + FLOAT_PHASE - i * FLOAT_LAG))
  return ((1 - wave) / 2) * SPATIAL_FLOAT_DEPTH
}

/**
 * The widest angle a word reaches ONCE IT HAS LANDED, which is the entrance
 * taken back out of the number above.
 *
 * Two callers want two different bounds and conflating them was wrong in one
 * direction: `spatialLayout` reserves room for the widest angle the block ever
 * reaches, entrance included, because a word outside its canvas is a word cut in
 * half whenever it happens. The stack's DILATION wants the resting angle,
 * because a seam shows where the stack is spread furthest across the frame and
 * during an entrance the word is at the back of its travel, drawn at three
 * quarters of its size, where the same step projects to a fraction of a pixel.
 * Dilating for the entrance puts a stroke of six per cent of the em around every
 * word for the whole scene, which closes the aperture of an `e`.
 *
 * It is ZERO for all three moves today, and the function is still here rather
 * than folded away: it is the number a fourth move would have to declare, and
 * the reason there is no per-word ROTATION is exactly that this number is what a
 * dilation is computed from. A move that turns a word is a move that thickens
 * every contour on the frame for the whole scene.
 */
export function spatialRestTurn() {
  return 0
}

/**
 * The size a three-dimensional line is set at, in its own box.
 *
 * The run is UNBREAKABLE, which is the whole typographic decision of this block
 * written as one flag in `BLOCK_APPETITE`. A line that wraps in three dimensions
 * is two lines at two depths with an extrusion between them, and the second
 * reads as a shadow of the first; more practically, `shapeCeiling` bounds an
 * unbreakable run by its whole length across the measure, which is a stricter
 * bound than `wordCeiling`'s longest word by definition — so the promise that a
 * word is not cut in half is kept here by construction rather than by a
 * declaration a browser falls back to. The schema's own bound of 24 characters
 * is the other half of it: see `BLOCK_LIMITS.extrudedType`.
 *
 * It is `blockExtent`'s own arithmetic and not `typeScale`, and the difference is
 * one field. `typeScale` solves a bare RUN — `fixed: 0` — so a block with
 * furniture comes back a step larger than the box it was divided for: a
 * single-letter title on a full frame was solved 36% taller here than
 * `blockExtent` claimed for it, and the block then drew what it had solved. The
 * shape a block is made of is `blockShape`, and this family is not entitled to a
 * second reading of it.
 */
export function spatialSize(block, box, unit) {
  const shape = blockShape(block)
  const width = px(box?.width)
  const given = Number(unit)
  const solved = Number.isFinite(given) && given > 0 ? given : solveTypeUnit([shape], width, px(box?.height))
  return Math.max(1, Math.round(Math.min(solved, shapeCeiling(shape, width)) * typeRole(spatialRole(block)).step))
}

/**
 * Everything the block draws, in pixels and in world units, from the box it was
 * given and nothing else.
 *
 * The order matters and it is the only tricky thing in this file. The canvas has
 * to be decided first, because the world scale is `2 / canvasHeight` and every
 * length after that is expressed in it; the projection can then be measured
 * against a canvas that exists, and `fit` is what gives back the difference. The
 * alternative — solving the canvas and the projection together — is a fixpoint,
 * and a fixpoint that fails to converge is a title drawn at NaN px (Q1).
 */
export function spatialLayout(block, box, unit) {
  const width = px(box?.width)
  const height = px(box?.height)
  const size = spatialSize(block, box, unit)
  const role = typeRole(spatialRole(block))
  const lineHeight = Math.round(size * role.leading)
  const depthPx = Math.round(size * spatialDepthShare(block?.depth))

  // The measure the line takes at that size, on the advances of its OWN glyphs.
  // `runAdvanceEm` and not the sentence average, for the reason it exists: a
  // title is mostly capitals, which set at 0.73 em against the 0.52 an average
  // predicts, and a line laid out on the average is a line a third wider than
  // the box that was divided for it.
  const run = blockAppetite('extrudedType').runs(block ?? {})[0]
  const measure = textWidth(block?.text, size, 0, runAdvanceEm(run))

  /*
   * What `blockExtent` claims this kind draws in this box - the contract, read
   * back rather than trusted.
   *
   * `stackIn` divided the zone on that claim, so a block drawing past it is a
   * stack overflowing a zone with nothing saying so. The claim knows nothing of
   * the thickness or of the lens, which is right: it is the flat estimate of a
   * line of type, and this file's job is to draw a three-dimensional one INSIDE
   * it. So the canvas and the fit are both capped by it, and the whole cost of
   * the dimension is a title two or three per cent smaller than a flat one -
   * paid in the SIZE, which is the currency `wordCeiling` and `furnitureCeiling`
   * already spend.
   *
   * Read back through `blockExtent` itself rather than recomputed here, and the
   * difference is 1.6 px: this file ROUNDS its type size to a whole pixel (a
   * canvas is drawn at integers) and `blockExtent` does not, so a measure derived
   * from the rounded size is a hair wider than the one the layout was divided on.
   * A hair is enough - the claim is an upper bound, and a block that exceeds its
   * own has stopped being checkable by the one function that checks every kind.
   * `base` is 0 because this kind draws no constant metric; only the separator's
   * branch reads it. Floored at a pixel because a degenerate box makes the claim
   * exactly zero, and a drawing of zero pixels is a scene with a hole in it where
   * a title should be (Q1).
   */
  const claim = blockExtent(block, box, 0, unit)
  const claimWidth = Math.max(1, claim.width)
  const claimHeight = Math.max(1, claim.height)

  /*
   * What the thickness costs on the FRAME, which is not what it costs in space.
   *
   * An extrusion runs along the depth axis: head-on it costs nothing at all, and
   * what it adds to the drawing is its own length times the sine of whatever the
   * block is turned by. The first version added the whole thickness to both
   * axes, which charged a `deep` display line 1.7 body units of furniture - three
   * times its whole appetite - for a projection that is under a fifth of that.
   *
   * The two angles ADD on the horizontal, because `roll` turns each letter inside
   * a line that is itself swaying; the vertical takes the pitch alone, since
   * neither the line's yaw nor a letter's moves anything up or down.
   *
   * Both are read off the same functions the MOVE is drawn from, so the resting
   * attitude is reserved for without appearing here: a rest angle the layout did
   * not know about would be an extrusion projecting outside the canvas the block
   * opened for it.
   */
  const swingX = Math.sin(spatialLineTurn(block?.spin)) + Math.sin(spatialGroupTurn(block?.spin))
  const swingY = Math.sin(spatialLinePitch(block?.spin))
  const needWidth = measure + 2 * depthPx * swingX
  const needHeight = lineHeight + 2 * depthPx * swingY

  // The canvas: what the drawing needs plus the room, capped by what the block is
  // entitled to draw and clipped to the box the layout published. Capped rather
  // than left at the need, because the fit below holds the drawing inside the
  // claim anyway - a canvas sized on the unfitted need was 45% wider than the
  // single letter it contained, which on this family is GL area every frame of
  // the scene pays for. Clipped and never clamped upwards: a canvas larger than
  // its box paints over the zone next door.
  const canvasWidth = Math.max(1, Math.min(width || 1, Math.round(Math.min(needWidth, claimWidth) / SPATIAL_ROOM)))
  const canvasHeight = Math.max(1, Math.min(height || 1, Math.round(Math.min(needHeight, claimHeight) / SPATIAL_ROOM)))

  const worldPerPx = (2 * SPATIAL_HALF) / canvasHeight

  /*
   * How far the LINE is allowed to turn in this box, which is not always what its
   * move asks for.
   *
   * Keystoning is a property of the MEASURE and not of the amplitude: a word two
   * world units wide can sway seven degrees and nothing reads, and the same seven
   * degrees on a twenty-four-character line of capitals - thirty world units
   * across, because a long line is set small and its canvas shrinks with it - put
   * the near end 7% larger than the far one. A longer lens buys some of that back
   * and the returns stop: closing the field to two degrees to rescue the widest
   * legal line is a camera chosen for a case rather than a camera.
   *
   * So a long line sways LESS, by exactly the amount that holds the keystone at
   * `SPATIAL_KEYSTONE_MAX`. That is the trade `overlay` makes with its own
   * amplitude one file up - the move yields, the legibility does not - and the
   * floor is what stops the trade going all the way: a scene in which nothing
   * moves must not be producible by accident, so past `SPATIAL_SWAY_FLOOR` the
   * keystone is accepted rather than the motion given up (Q1).
   *
   * ── Two budgets, because a turn is now two things ───────────────────────────
   *
   * The line's yaw is a resting ATTITUDE plus a SWING around it, and they answer
   * to the keystone differently. The swing is the MOVE and keeps its floor, for
   * the reason the floor exists. The attitude is where the object stands: it is
   * the relief on an ordinary line and it is worth nothing at all if the price is
   * a title set at two sizes, so it takes what the budget has left after the move
   * and goes to zero when there is none. On the widest line the schema can state
   * that is exactly what happens, and the relief that survives is the PITCH,
   * which no keystone bound touches — a line is wide, not tall.
   *
   * Folding the two into one share was the first version and it broke the bound
   * it was written for: the floor then guaranteed a minimum ANGLE rather than a
   * minimum motion, and a twenty-three character line came back keystoned past
   * `SPATIAL_KEYSTONE_MAX` with nothing in the arithmetic to say so.
   */
  const swingMax = spatialYawSwing(block?.spin)
  const restMax = SPATIAL_REST_YAW_DEG * RAD
  const halfWorld = (measure / 2) * worldPerPx
  const swungMax = (SPATIAL_CAMERA_Z * (SPATIAL_KEYSTONE_MAX - 1)) / SPATIAL_KEYSTONE_MAX
  const allowed = halfWorld > 0 ? Math.asin(Math.min(1, swungMax / halfWorld)) : spatialLineTurn(block?.spin)
  const swing = swingMax > 0 ? Math.max(SPATIAL_SWAY_FLOOR, Math.min(1, allowed / swingMax)) : 1
  const rest = restMax > 0 ? Math.max(0, Math.min(1, (allowed - swing * swingMax) / restMax)) : 1
  // The widest the line really turns in this box, which is what the stack is
  // spread by and what the camera magnifies. Published, so the component's
  // dilation closes the seam this line has rather than the one the move asks for.
  const turned = rest * restMax + swing * swingMax

  /*
   * How much the nearest thing the block draws is magnified by the camera.
   *
   * Two terms, and the thickness is deliberately not a third: an extrusion runs
   * AWAY from the viewer, and rotating it about the letter's own axis maps
   * `(0,0,-D)` to `(-D sin, 0, -D cos)` - still behind the face at every angle.
   * It was in the sum in the first version, which reserved room for a
   * magnification that cannot happen and took seven per cent off the size of a
   * `deep` title to pay for it.
   *
   * What is left is the line swinging half its own measure towards the camera,
   * and one word swinging half of itself. A word's half is taken as the measure
   * over the number of groups, which over-states the shortest of them and is
   * therefore a bound rather than a guess. A perspective camera magnifies by
   * `d / (d - dz)`; this is the residue the long lens leaves, and reserving it
   * is what the header means by "reserved rather than hoped for".
   */
  const swung = halfWorld * Math.sin(turned)
  const near = swung + (measure / 2 / Math.max(1, spatialGroups(block?.text).length)) * Math.sin(spatialGroupTurn(block?.spin)) * worldPerPx
  const magnify = SPATIAL_CAMERA_Z / Math.max(0.001, SPATIAL_CAMERA_Z - near)
  /*
   * And how much bigger the near END of the line is than its far one, which is
   * what "keystoning" means and is the number the sway is bounded against.
   *
   * It is a different quantity from `magnify` and both are needed: this one is a
   * property of the LOOK - one word set at two sizes reads as a mistake - while
   * the other is the room the layout has to reserve so that nothing leaves the
   * canvas. A letter turning on its own axis contributes to the second and not
   * to the first, since it changes nothing about how its neighbours compare.
   */
  const keystone = SPATIAL_CAMERA_Z / Math.max(0.001, SPATIAL_CAMERA_Z - swung)

  const fit = Math.max(
    0,
    Math.min(
      1,
      Math.min(canvasWidth, claimWidth) / Math.max(1, needWidth * magnify),
      Math.min(canvasHeight, claimHeight) / Math.max(1, needHeight * magnify),
    ),
  )

  return {
    needWidth,
    needHeight,
    size,
    leading: role.leading,
    lineHeight,
    depthPx,
    measure,
    canvas: { width: canvasWidth, height: canvasHeight },
    worldPerPx,
    magnify,
    keystone,
    /**
     * What the block is entitled to draw, in pixels — `blockExtent`'s own answer,
     * floored at a pixel.
     *
     * Published rather than kept private because the component is the only half
     * of this family that knows what the type REALLY measures: the estimate is
     * conservative by `LINE_SAFETY` and by every rounding in `GLYPH_CLASS_EM`, so
     * a nowrap line laid out at its real advances came back filling 74% of the
     * measure the box was divided on — a quarter of the frame empty beside a
     * title, which is the "small element in a large void" this whole pass is
     * about. The component scales up to this and no further; see `boost`.
     */
    claim: { width: claimWidth, height: claimHeight },
    /**
     * How much of its move and how much of its attitude this box allows, so that
     * a long line does not keystone. `spatialSpin` takes the pair; see the two
     * budgets above for why it is a pair and not a number.
     */
    turn: { swing, rest },
    /** The widest the line really turns here, in radians: what the stack is spread by. */
    turned,
    /** The share of its own size the line is drawn at, so that the turn stays inside the canvas. */
    fit,
    /** The raster's em size, in pixels: what the browser is asked to draw one glyph at. */
    rasterEm: Math.max(8, Math.min(SPATIAL_RASTER_MAX, Math.round(size * SPATIAL_SUPERSAMPLE))),
  }
}

/**
 * What the block actually draws in its box, in pixels — the claim `blockExtent`
 * makes for this kind, as a function a test can check.
 *
 * It is deliberately the PROJECTED extent and not the type's own: a turned line
 * is wider than the word it is made of, and the whole reason `fit` exists is
 * that the difference was invisible until it was written down.
 */
export function spatialExtent(block, box, unit) {
  const layout = spatialLayout(block, box, unit)
  return {
    width: layout.needWidth * layout.fit * layout.magnify,
    height: layout.needHeight * layout.fit * layout.magnify,
  }
}

/** The whole move, for a caller with no box to be bounded by. */
export const WHOLE_TURN = Object.freeze({ swing: 1, rest: 1 })

/**
 * How far the LINE has turned on this frame, in radians.
 *
 * `life` and not `progress`: the turn runs for the whole scene, exactly as
 * `solidSpin`'s does. The arrival is the depth, next door.
 *
 * Two axes for every move rather than one, and the second is always the smaller:
 * a word rotating about a single axis reads as a card being flipped, and a word
 * with a little of the other axis in it reads as an object held in the hand. The
 * two frequencies are different and neither is whole, so the pair never returns
 * to where it started inside one scene.
 */
export function spatialSpin(spin, life, allowed = WHOLE_TURN) {
  const t = Number(life) || 0
  // What THIS box allows of the two halves of the yaw — `spatialLayout`'s `turn`,
  // so that a wide line does not keystone. Neither touches the pitch: keystoning
  // is a property of the MEASURE, and a line is wide, not tall. Defaulted to the
  // whole of both, so a caller with no layout — `spatialMoved`, and any test
  // asking what the move IS — reads the move.
  const share = (name) => {
    const value = Number(allowed?.[name])
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1
  }
  const sway = Math.sin(2 * Math.PI * (SWAY_PERIODS * t + SWAY_PHASE))
  const tilt = Math.sin(2 * Math.PI * (TILT_PERIODS * t + TILT_PHASE))
  /*
   * A swing AROUND an attitude, and never around nothing.
   *
   * The three moves differ in how much of each axis they use — a `tilt` is a
   * plaque leaning away and back, a `float` barely moves the line at all because
   * its words are moving in depth — and none of them may bring the line square
   * to the camera, where the extrusion is exactly behind the face and the block
   * draws a flat title with a coloured edge. `SPATIAL_REST_YAW_DEG` carries that
   * argument and the measurement.
   *
   * The two shares are the box's, and they are two because the keystone takes
   * them in an order: the MOVE keeps at least its floor and the ATTITUDE takes
   * what is left, down to nothing on the widest line the schema can state. See
   * `spatialLayout`, where the budget is divided.
   */
  return {
    yaw: share('rest') * SPATIAL_REST_YAW_DEG * RAD + share('swing') * sway * spatialYawSwing(spin),
    pitch: SPATIAL_REST_PITCH_DEG * RAD + tilt * spatialPitchSwing(spin),
  }
}




/**
 * Where one word is on its way in — a depth, a turn, and nothing else.
 *
 * `letterAt` is imported from `setPiece.js` rather than written again, and that
 * is the house rule about arrivals rather than a saving of six lines: the first
 * group uses the whole of the block's cue and the last one uses the tail, which
 * is the one shape a staggered line arrives with in this renderer. A second ramp
 * here would be a second notion of "an element arrives", which is precisely what
 * `easeOutCubic` was made the only easing to stop.
 *
 * Both terms are ZERO once the word has landed. That is what makes the line a
 * line: a word still carrying a fraction of its entrance on the four hundredth
 * frame is a line whose baseline never resolves, which is the defect
 * `bounceLift` is a long comment about.
 */
export function spatialGroupEnter(count, index, progress) {
  const at = letterAt(count, index, progress)
  // Alternating, so the line assembles from both sides rather than combing one
  // way. The sign comes from the INDEX and never from a die: `blocks.test.js`
  // scans this whole directory for one, and a scatter of words is exactly where
  // somebody reaches for it.
  const side = index % 2 === 0 ? 1 : -1
  return {
    at,
    /** How far behind the plane it still is, in type sizes. Never in front: see `SPATIAL_ENTER_DEPTH`. */
    behind: (1 - at) * SPATIAL_ENTER_DEPTH,
    /** How far it is still turned, in radians. */
    turn: (1 - at) * SPATIAL_ENTER_TURN_DEG * RAD * side,
  }
}

/**
 * Whether the block draws a different frame at two moments of one scene — the
 * arithmetic behind "nothing in a film may hold still".
 *
 * It exists as a function rather than as a line in the test because the answer
 * has to be the same one the component reads: a test that recomputed the turn
 * from the constants would be a second implementation, and the frame it is
 * asked about would be the one the block does not draw.
 */
export function spatialMoved(block, count, a, b) {
  const at = (life) => {
    const spin = spatialSpin(block?.spin, life)
    const floats = []
    for (let i = 0; i < Math.max(1, count); i += 1) floats.push(spatialFloat(block?.spin, i, life))
    return [spin.yaw, spin.pitch, ...floats]
  }
  const first = at(a)
  const last = at(b)
  return first.some((value, i) => Math.abs(value - last[i]) > 1e-9)
}

/**
 * The advance of one run, in pixels, at a size — the fallback for a renderer that
 * cannot measure text.
 *
 * The component uses the browser's own `measureText`, because a raster placed on
 * an estimated advance is a line with visibly uneven word spacing and the
 * estimate exists to bound a SIZE rather than to set one. This is what it falls
 * back to when there is no canvas at all: the same per-glyph table
 * `meanAdvanceEm` is built on, so a line laid out without a browser is laid out
 * at the width the layout reserved for it (Q1).
 */
export function spatialAdvance(text, size) {
  return runAdvanceEm({ text }) * String(text ?? '').length * LINE_SAFETY * Math.max(0, Number(size) || 0)
}
