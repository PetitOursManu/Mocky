/**
 * The arithmetic of the PRODUCT STAGE — `photoStage` and `photoRing`, the two
 * blocks that stand a picture from the library in real perspective.
 *
 * No React, no Remotion, no `three`. Same reason as `setPiece.js` next door, and
 * one reason more: `three` is installed in `worker/video/package.json` and
 * nowhere else, so a single import here would take `blocks/index.js` — which
 * imports every component — out of Mocky's own vitest suite, and with it the test
 * that proves the registry matches the schema in both directions. Everything
 * below is numbers: the DIMENSIONS of a slab and the ANGLE it is turned by, never
 * a mesh and never a material.
 *
 * ── Why a whole module for two blocks ───────────────────────────────────────
 *
 * Because the one thing a 3D block can get wrong that no reviewer sees is
 * GEOMETRY. A flat block that overflows its box shows up in a screenshot; a panel
 * that swings its near corner through the edge of the frustum shows up on frame
 * 214 of an mp4 nobody watched to the end. So the fit is solved here, in closed
 * form, and `stage.test.js` re-derives it from the projection rather than trusting
 * a margin somebody eyeballed.
 *
 * ── The four rules these two blocks are written to ──────────────────────────
 *
 *   1. **A block inhabits its box.** The canvas is the block's own box, the panel
 *      is fitted to the canvas, and nothing here reads the frame. That is the rule
 *      at the top of `composition.js` applied to a renderer: a scene naming four
 *      stages draws what one frame draws, because each canvas is a share of a box
 *      the layout already divided.
 *   2. **Nothing holds still, and no axis lands on a whole number of quarter
 *      turns.** `solidSpin` in `setPiece.js` is a long comment about a cube that
 *      rendered three byte-identical frames; a picture on a panel is the same trap
 *      with a texture on it. Every period below is fractional and every phase is
 *      offset, and `stage.test.js` checks the first and last frame of every move.
 *   3. **The camera is SAGE.** It does not move at all — the subject turns under
 *      it — and the amplitude it turns by is bounded by the frustum rather than by
 *      taste. See `frustumScale`.
 *   4. **Determinism.** No die, no clock. Every position comes from an index and
 *      from `life`; `blocks.test.js` sweeps this whole directory for both.
 */

/**
 * The camera every stage is seen from, in the units the geometry below is
 * written in.
 *
 * A LONG lens — 30° at a distance of eight, against `solidScene`'s 45° at 5.6 —
 * and it is the one aesthetic decision in this file that also buys arithmetic.
 *
 * The aesthetic half is product photography's own answer. A solid is a shape and a
 * wide angle flatters it: the perspective IS the subject. A photograph on a panel
 * is a RECTANGLE, and a wide angle turns a rectangle into a trapezoid whose two
 * vertical edges are visibly different lengths — which reads, correctly, as a
 * distorted picture rather than as a turned one. Every catalogue in the world
 * shoots its objects on something near an 85 mm for exactly that reason, and 30°
 * is about what an 85 mm sees.
 *
 * The arithmetic half is the fit. A point's constraint below is
 * `s·(|y| + z·tan θ) ≤ d·tan θ`, so the share of the frame a panel may occupy is
 * `|y| / (|y| + z·tan θ)` — which rises as the lens gets longer, because `z` is
 * how far a turned corner leans towards the camera and `tan θ` is what that lean
 * costs. At 45° a `turn` composes its picture at 45% of its canvas; at 30° the same
 * flip composes at 60%. A wider lens would make this family both uglier and
 * smaller.
 *
 * Stated rather than left to react-three-fiber's default for the reason
 * `SOLID_CAMERA_Z` gives: the default 75° put a sphere of radius 1.9 in a third of
 * its canvas.
 */
export const STAGE_CAMERA_FOV = 30
export const STAGE_CAMERA_Z = 8

/**
 * And a LONGER one again for the ring, which is a second camera in one family and
 * needs the argument that goes with it.
 *
 * A ring is not a bigger panel. Its subject is four times as wide as one picture
 * and — this is the part that decides it — the panel at the front stands a whole
 * ring radius CLOSER to the camera than the origin the frustum was measured at. A
 * point's cost in the fit is `z · tan θ`, so at 30° a six-picture ring spends more
 * of its allowance on being near the lens than on being tall, and the whole
 * carousel composes at a third of its canvas: the small element in a large void,
 * arriving through a camera instead of through a box.
 *
 * At 18° the same ring composes its front picture at 60% of the frame and keeps
 * every depth cue that matters, because the depth cue in a carousel is the panels
 * TURNING AWAY rather than the perspective on any one of them. The frustum is kept
 * the same height as the stage's so the two blocks compose at the same scale in
 * the same box.
 */
export const RING_CAMERA_FOV = 18
export const RING_CAMERA_Z = 13.6

/**
 * What "intensity 1" means to this renderer.
 *
 * `three` has used physically correct light units since r155 — a punctual light's
 * radiance is divided by pi — and the migration note is to multiply the old
 * intensities by pi. Without it a panel's body renders a mid grey where the
 * arithmetic says near-white, which is the one failure the whole legibility
 * section exists to prevent arriving through a renderer's units instead of through
 * a hex value.
 *
 * It is the same number `solidScene.jsx` states, and it is written twice on
 * purpose rather than shared. It belongs to the RENDERER and not to a colour:
 * `setPiece.js` is another family's arithmetic and `solidScene.jsx` is a
 * component, so an import across two block families would couple them for a
 * constant that is `Math.PI`. `stage.test.js` reads that file and refuses to let
 * the two differ, which is the same arrangement `contrast.js` has with
 * `src/lib/audit/colors.ts`.
 */
export const LIGHT_UNIT = Math.PI

/**
 * Where the one directional light sits, in the units the geometry is written in.
 *
 * A constant, because a light the document placed is a light it described — the
 * same sentence `SOLID_LIGHT` ends on. Raked from the upper left and well in
 * FRONT of the subject, which is where it differs from a solid's: a lit ball reads
 * from any angle, and a panel standing square to the camera at the start of its
 * move would be lit edge-on by a light at 45° and come back as a black rectangle
 * on the first second of the scene. In front, the body reads at rest and the
 * shading still swings as the panel turns, which is the depth cue.
 */
export const STAGE_LIGHT = [3.5, 5, 9]

/**
 * How much of the room the frustum leaves is actually used.
 *
 * Three per cent, and it is rounding rather than taste: the fit below is solved
 * on a SAMPLED rotation range, so the true worst pose can fall between two
 * samples. Half a degree of yaw at the widest amplitude moves a corner by about
 * four parts in a thousand of the panel's width, so three per cent is an order of
 * margin over the sampling error and still leaves the panel filling its canvas.
 */
export const STAGE_MARGIN = 0.97

/**
 * How many poses the fit is solved over.
 *
 * Forty-one, which is every five degrees of a `turn`'s two hundred. The
 * constraint below is smooth in the angle — it is a sum of a sine and a cosine —
 * so a sampled maximum converges quadratically, and `STAGE_MARGIN` covers what is
 * left. An odd number so that the middle of the range is always one of the
 * samples: a `turn` is exactly edge-on at its midpoint, which is its worst pose.
 */
export const STAGE_SAMPLES = 41

/** Degrees to radians, spelled out once so no call site does it by hand. */
const RAD = Math.PI / 180

/** A finite positive number, or 0. `composedLayout` guarantees the boxes; a hand-built test does not. */
const px = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * The canvas a stage is drawn in, in pixels: the block's own box, and all of it.
 *
 * Not a square, unlike `solidCanvas`. A solid is bounded by a ball, so a square
 * canvas wastes nothing; a picture is a rectangle and a square canvas would throw
 * away the whole difference between a landscape box and a landscape photograph —
 * a 16:9 panel in a square canvas inside a 16:9 box draws at 56% of the width the
 * box was handed, which is the small element in a large void this feature spent a
 * pass removing.
 *
 * `base` is the fallback for a box this file cannot read, for the reason
 * `solidCanvas` keeps one: a stage drawn at a plausible size beats a canvas of
 * zero pixels (Q1).
 */
export function stageCanvas(box, base) {
  const width = px(box?.width) || px(base)
  const height = px(box?.height) || px(base)
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) }
}

/**
 * The canvas's own shape, from the same rounding the canvas was built with.
 *
 * The fit needs it — the frustum is as wide as the canvas is — and a block cannot
 * ask the renderer for its drawing buffer. It is derived from the box rather than
 * passed as a twelfth prop, and it goes through `stageCanvas` rather than dividing
 * the box directly so that the two cannot disagree by a rounded pixel: a canvas of
 * 641×360 is not a canvas of 640.6×360, and a fit solved on the second puts a
 * corner half a pixel outside the first.
 */
export function stageAspect(box, base) {
  const canvas = stageCanvas(box, base)
  return canvas.width / canvas.height
}

/** The two camera objects `ComposedSceneVideo` opens a canvas with. One per block, never per document. */
export const STAGE_CAMERA = { position: [0, 0, STAGE_CAMERA_Z], fov: STAGE_CAMERA_FOV }
export const RING_CAMERA = { position: [0, 0, RING_CAMERA_Z], fov: RING_CAMERA_FOV }

/**
 * THE FIT — the largest uniform scale at which every one of these points is still
 * inside the frustum.
 *
 * This is the whole safety of the family, so it is closed form rather than a
 * margin somebody chose. The camera sits at `(0, 0, d)` looking down −z with a
 * vertical half-angle `θv` and a horizontal one whose tangent is `aspect · tan θv`.
 * A point `(x, y, z)` is inside iff
 *
 *     |y| ≤ (d − z) · tan θv        and        |x| ≤ (d − z) · aspect · tan θv
 *
 * Scaling the whole object by `s` scales the point, so the first reads
 * `s·|y| ≤ (d − s·z)·tan θv`, which rearranges to `s · (|y| + z·tan θv) ≤ d·tan θv`
 * — LINEAR in `s`. So the largest legal scale is a minimum over the points, with
 * no search and no bisection.
 *
 * A point whose bracket is negative or zero constrains nothing: it lies far enough
 * behind the origin that the frustum has opened past it, and dividing by it would
 * hand back a negative scale. That is the case a naive version gets wrong, and it
 * is reachable — the far corners of a panel turned edge-on are exactly there.
 *
 * ── A point may be held on one axis and free on the other ────────────────────
 *
 * The fourth element of a point says whether the SIDES hold it, and it exists for
 * the ring. A carousel is a thing that runs past the edges of its own frame — the
 * flat `carousel` block slides pictures out of the frame on purpose, and a ring
 * bound to keep six panels inside a portrait canvas composes each of them at a
 * tenth of it. What is never acceptable is a picture cut along the TOP or the
 * BOTTOM: that reads as a layout that overflowed rather than as a carousel. So the
 * vertical constraint holds for everything and the horizontal one only for what
 * the composition means the eye to read whole.
 *
 * Answers 1 for an empty point set rather than `Infinity`: a stage with nothing in
 * it draws nothing, and a scale of `Infinity` multiplied into a geometry is a
 * `NaN` mesh, which is a black canvas rather than an empty one (Q1).
 */
export function frustumScale(points, aspect, camera = STAGE_CAMERA) {
  const tv = Math.tan((camera.fov / 2) * RAD)
  const th = tv * Math.max(px(aspect), 1e-6)
  const d = camera.position[2]
  let scale = Infinity
  for (const point of points) {
    const [x = 0, y = 0, z = 0, sides = true] = point
    const vertical = Math.abs(y) + z * tv
    if (vertical > 0) scale = Math.min(scale, (d * tv) / vertical)
    if (!sides) continue
    const horizontal = Math.abs(x) + z * th
    if (horizontal > 0) scale = Math.min(scale, (d * th) / horizontal)
  }
  return Number.isFinite(scale) ? scale * STAGE_MARGIN : 1
}

/**
 * How tall the frustum is at the origin, in world units — what a scale means as a
 * share of the canvas.
 *
 * It is here so that `stage.test.js` can state the claim this family owes
 * `src/lib/video/resolution.ts`: the picture drawn by a stage is never enlarged
 * MORE than the same picture drawn flat in the same box, because the panel is
 * fitted inside the frustum and the frustum is the box. A 3D texture blown up
 * past its source is as soft as a 2D one, and the arithmetic that says it is not
 * happening should not be a sentence.
 *
 * The two cameras answer the same height, which is what lets a `photoStage` and a
 * `photoRing` in neighbouring zones compose at one scale.
 */
export function stageFrustumHeight(camera = STAGE_CAMERA) {
  return 2 * camera.position[2] * Math.tan((camera.fov / 2) * RAD)
}

// ── The panel ────────────────────────────────────────────────────────────────

/**
 * The three frames a picture can stand in, in units of the PICTURE's own height.
 *
 * `border` is the body showing past the picture on every side, `chin` is the extra
 * at the bottom only, and `depth` is how thick the slab is. All three are shares
 * of the picture rather than of the box, which is what makes a `card` look like
 * the same card whichever zone it lands in — the `CONSTANT_METRICS` argument, one
 * dimension out.
 *
 *   - `plain` — a bare panel. The border is the slab's own edge and nothing more,
 *     which is the "photographic plane floating in space" this family was asked
 *     for. It is the one to use when the picture is the whole subject.
 *   - `card` — a mounted print: an even margin of the project's own material all
 *     the way round. It is what makes a photograph read as an OBJECT rather than
 *     as a hole cut in the frame.
 *   - `device` — a screen in a case. The border is narrow, the body is thick, and
 *     there is a CHIN: a wider band under the picture than over it. That asymmetry
 *     is the whole difference between "a screen" and "a card", and it is why the
 *     three are three rather than two with a depth knob.
 *
 * The numbers are small on purpose. A border of a tenth of the picture's height
 * already reads as a mount at broadcast size, and every unit spent on a border is
 * a unit the picture does not get — the fit below divides the frustum among all
 * of them.
 */
export const STAGE_FRAMES = {
  plain: { border: 0.012, chin: 0, depth: 0.028 },
  card: { border: 0.07, chin: 0, depth: 0.05 },
  device: { border: 0.038, chin: 0.085, depth: 0.09 },
}

/** A named frame, or the middle one. `Object.hasOwn` for the reason `blockComponent` spells out. */
export function stageFrame(name) {
  return typeof name === 'string' && Object.hasOwn(STAGE_FRAMES, name) ? STAGE_FRAMES[name] : STAGE_FRAMES.card
}

/**
 * How far off the body's face the picture is laid, as a share of the body's depth.
 *
 * Two coplanar surfaces in a depth buffer flicker between them from one frame to
 * the next — the one artefact of this family that a content-addressed store would
 * turn into two files for one film if the flicker were not itself deterministic.
 * It is deterministic, and it is still wrong to look at, so the picture sits
 * slightly proud of its body. A share of the depth rather than a fixed epsilon
 * because the whole panel is then scaled by the fit, and a fixed epsilon would
 * vanish on a small stage and become a visible ledge on a large one.
 */
export const PICTURE_LIFT = 0.06

/**
 * The panel a picture stands in, in units of the picture's own height.
 *
 * Everything is a HALF-extent, because that is what the fit above wants and what
 * a box geometry is built from. The picture is pushed up by half the chin so that
 * the extra band is at the bottom: a screen's chin is under its display, and one
 * centred inside its case is a card again.
 *
 * @param {number} aspect  the picture's own width over its height
 * @param {string} frame   a key of `STAGE_FRAMES`
 */
export function panelGeometry(aspect, frame) {
  const ratio = Math.max(px(aspect), 0.05)
  const { border, chin, depth } = stageFrame(frame)
  const picture = { x: ratio / 2, y: 0.5 }
  const body = {
    x: picture.x + border,
    y: picture.y + border + chin / 2,
    z: depth / 2,
  }
  return {
    body,
    picture,
    /** Where the picture's centre sits inside the body, so the chin lands under it. */
    offsetY: chin / 2,
    /** Where the two faces are laid, just proud of the body. */
    faceZ: body.z * (1 + PICTURE_LIFT),
  }
}

/**
 * The eight corners of a slab, put exactly where the component puts it.
 *
 * The composition is `tilt ∘ (at + Rx(pitch)·Ry(yaw)·p)`, and every part of it is
 * read off the JSX rather than chosen here:
 *
 *   - a point goes through the YAW first, because three.js builds an Euler in its
 *     default `XYZ` order as `Rx·Ry·Rz`, so `rotation={[pitch, yaw, 0]}` turns the
 *     vector about Y and then about X;
 *   - `at` is applied AFTER that rotation, because a mesh's local matrix is
 *     `T·R·S` — a panel of a ring turns about its own centre and is then carried
 *     out to the ring;
 *   - `tilt` is applied last, because it belongs to the group the whole ring sits
 *     in, and a group's rotation turns its children's POSITIONS as well as their
 *     orientations.
 *
 * Getting any of the three the other way round would solve the fit for a pose the
 * frame never shows, which is the failure mode of every geometry check that is not
 * derived from the transform it is checking.
 */
export function poseCorners(half, { pitch = 0, yaw = 0, at = [0, 0, 0], tilt = 0 } = {}) {
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cx = Math.cos(pitch)
  const sx = Math.sin(pitch)
  const ct = Math.cos(tilt)
  const st = Math.sin(tilt)
  const [ox = 0, oy = 0, oz = 0] = at
  const out = []
  for (const xSign of [-1, 1]) {
    for (const ySign of [-1, 1]) {
      for (const zSign of [-1, 1]) {
        const x0 = xSign * half.x
        const y0 = ySign * half.y
        const z0 = zSign * half.z
        // Yaw about Y.
        const x1 = x0 * cy + z0 * sy
        const z1 = -x0 * sy + z0 * cy
        // Then pitch about X, still about the slab's own centre.
        const y2 = y0 * cx - z1 * sx
        const z2 = y0 * sx + z1 * cx
        // Carried to where it stands.
        const x3 = x1 + ox
        const y3 = y2 + oy
        const z3 = z2 + oz
        // And the group's own tilt, which moves the position too.
        out.push([x3, y3 * ct - z3 * st, y3 * st + z3 * ct])
      }
    }
  }
  return out
}

// ── How a stage moves ────────────────────────────────────────────────────────

/**
 * The three moves, as an amplitude in radians and a fractional number of half
 * periods.
 *
 * Not one of them completes a whole period and not one amplitude is a multiple of
 * a quarter turn, which is `solidSpin`'s lesson written for a flat object where it
 * is worse: a cube on a whole turn renders identical frames, and a PANEL on a
 * whole turn renders identical frames AND spends the middle of the scene edge-on,
 * where a picture is a line.
 *
 *   - `orbit` — the camera walking round the subject, which is what it looks like
 *     and not what it is: the panel turns and the camera holds still. They are the
 *     same image for one object, and the difference matters twice — a camera the
 *     document moved would be a camera the composition does not own, and
 *     `ThreeCanvas` takes its camera once rather than per frame.
 *   - `turn` — the card turning over to show its back. It passes edge-on exactly
 *     once, at the middle of the scene, and it ends a little past flat so the back
 *     is read rather than glimpsed.
 *   - `sway` — the smallest amount of life that keeps a held frame from reading as
 *     a stalled render. `OVERLAY_DRIFT_PERCENT`'s argument, in three dimensions.
 *
 * The amplitude of `orbit` is where the sea-sickness question is actually
 * answered, and the answer is a number rather than a feeling: past about a quarter
 * turn a rectangle's near edge is half again the length of its far edge and the
 * eye reads a distortion instead of a rotation, and the fit below then has to
 * shrink the panel to keep that near corner inside the frustum — so a wider swing
 * buys a smaller picture AND a worse one. Twenty degrees is where those two stop
 * arguing.
 */
export const STAGE_MOVES = {
  orbit: { yaw: 0.35, halfPeriods: 1.7, phase: 0.12, spin: false },
  turn: { yaw: 1.12 * Math.PI, halfPeriods: 0, phase: 0, spin: true },
  sway: { yaw: 0.16, halfPeriods: 1.3, phase: 0.08, spin: false },
}

/** A named move, or the one a silent document should get. */
export function stageMove(name) {
  return typeof name === 'string' && Object.hasOwn(STAGE_MOVES, name) ? STAGE_MOVES[name] : STAGE_MOVES.orbit
}

/**
 * The tilt every stage carries, on top of its own move.
 *
 * Four degrees, and it is not decoration: a rectangle turning about a vertical
 * axis alone is indistinguishable from a rectangle being squeezed horizontally,
 * which is precisely how a flat `scaleX` animation looks. One degree of pitch is
 * what tells an eye there is a third dimension. Its period is fractional and out
 * of phase with every yaw above, so no combination of the two returns to its own
 * first frame.
 */
export const STAGE_PITCH = 0.07
const PITCH_HALF_PERIODS = 1.1
const PITCH_PHASE = 0.27

/**
 * Where a stage is turned to on one frame, in radians.
 *
 * `life` and not `progress`: the move runs for the whole scene. The arrival is the
 * scale, next door — the same split `solidSpin` and `solidScale` make.
 */
export function stageRotation(move, life) {
  const t = Math.max(0, Math.min(1, Number(life) || 0))
  const spec = stageMove(move)
  const yaw = spec.spin ? t * spec.yaw : spec.yaw * Math.sin((t * spec.halfPeriods + spec.phase) * Math.PI)
  return {
    pitch: STAGE_PITCH * Math.sin((t * PITCH_HALF_PERIODS + PITCH_PHASE) * Math.PI),
    yaw,
  }
}

/** The poses a move visits, sampled, so the fit can be solved over all of them at once. */
export function stagePoses(move) {
  const out = []
  for (let i = 0; i < STAGE_SAMPLES; i++) out.push(stageRotation(move, i / (STAGE_SAMPLES - 1)))
  return out
}

/** The stage's own arrival: it grows into the frame, like a solid. */
export const STAGE_ENTER_SCALE = 0.82

export function stageEnter(progress) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0))
  return STAGE_ENTER_SCALE + (1 - STAGE_ENTER_SCALE) * p
}

// ── photoStage: one picture ──────────────────────────────────────────────────

/**
 * The picture's own shape, read off the texture the composition loaded.
 *
 * A property read and nothing else — no `three` import is needed to ask an image
 * how wide it is. A texture that has not reported a size takes the CANVAS's shape:
 * a blank panel is a frame this file could not fix, and the least surprising shape
 * to leave empty is the shape of the box it was given (Q1). It is reachable only
 * if a staged file failed to decode, which `staging.js` refuses long before a
 * frame.
 */
export function pictureAspect(texture, fallback) {
  const image = texture?.image
  const width = Number(image?.naturalWidth || image?.width)
  const height = Number(image?.naturalHeight || image?.height)
  if (width > 0 && height > 0) return width / height
  return Math.max(px(fallback), 0.05)
}

/**
 * Everything `photoStage.jsx` draws, in world units, for one frame.
 *
 * The fit is solved over the WHOLE move rather than for this frame's pose, which
 * is the only version of it that is correct: a panel scaled to fit the pose it is
 * currently in would grow and shrink across the scene — a zoom nobody asked for,
 * and one that would make the picture's own enlargement vary from frame to frame.
 * One scale for the scene, chosen so the worst pose still fits.
 *
 * @param {object} block     the layer, already validated three times over
 * @param {number} aspect    the picture's own width over its height
 * @param {number} canvas    the canvas's width over its height
 */
export function photoStageLayout(block, aspect, canvas) {
  const geometry = panelGeometry(aspect, block?.frame)
  const move = block?.move
  // `faceZ` and not `body.z`: the picture is laid slightly proud of its body, so
  // the thing that reaches furthest towards the camera when the panel turns is the
  // picture and not the slab under it.
  const half = { x: geometry.body.x, y: geometry.body.y, z: geometry.faceZ }
  const points = []
  for (const pose of stagePoses(move)) {
    for (const corner of poseCorners(half, pose)) points.push(corner)
  }
  return { ...geometry, scale: frustumScale(points, canvas) }
}

// ── photoRing: several pictures on a carousel ────────────────────────────────

/**
 * How much room a ring leaves between two panels, as a share of a panel's width.
 *
 * Twelve per cent. Below about a tenth the panels of a six-picture ring touch at
 * their near corners as the ring turns — two photographs meeting edge to edge read
 * as one torn photograph — and much above it the ring is a circle of stamps with
 * the ground showing through, which is the void this feature spent a pass
 * removing.
 */
export const RING_GAP = 0.12

/**
 * How far the ring turns across a scene, in turns.
 *
 * Fractional for the reason every period in this file is, and there is a second
 * trap here that a lone panel does not have: a ring of `n` identical panels maps
 * onto ITSELF every `1/n` of a turn, so a rotation of `k/n` turns would put the
 * last frame of a scene on the same geometry as its first. The pictures differ, so
 * the frame would not truly repeat — but the arrangement would, and the film would
 * end where it started. 0.57 turns is at least a seventh of a step away from a
 * whole number of steps for every count the schema allows.
 */
export const RING_TURNS = 0.57

/**
 * How far the ring is tilted towards the camera. A CONSTANT, not a move.
 *
 * Seven degrees of looking down on the ring, which is what separates a carousel
 * from a row of panels sliding sideways. It does not animate: a ring that turns
 * AND tilts is two rotations an eye has to separate, and the one it stops reading
 * is the one that carries the pictures.
 */
export const RING_TILT = 0.12

/** Half a turn, for the face on the back of a card. A number the `.jsx` does not get to write. */
export const BACK_TURN = Math.PI

/**
 * THE SLOT — the one shape every panel of a ring is built to, and the bug a
 * rendered frame is what found.
 *
 * The first version gave each panel its own picture's shape and sized the ring on
 * the widest of them. That is right for a lone stage and catastrophic for a ring:
 * a carousel of five screenshots in which one is a 12:1 header banner asked for a
 * ring nearly twice as wide as the others needed, the front panel then stood a
 * whole radius nearer the lens, and the fit shrank the entire carousel to a row of
 * specks in a black frame. One picture ruined the block.
 *
 * It is also wrong on its own terms. A carousel whose slots are different widths
 * is not a carousel; the thing that makes a row of pictures read as a set is that
 * they are presented identically. So a ring has ONE slot, every panel is that
 * slot, and each picture is fitted inside its own — letterboxed against the body,
 * exactly as a wide print is mounted on a standard card.
 *
 * The slot's shape is the MEDIAN of the pictures', which is what makes one outlier
 * cost nothing, clamped into a band a carousel can actually hold. The band is not
 * a taste: past about 16:9 the front panel's own width is what the fit binds on
 * and the whole ring shrinks, and under about 3:5 the panels are columns with
 * nothing between them.
 */
export const RING_SLOT_MIN = 0.6
export const RING_SLOT_MAX = 1.8

export function ringSlotAspect(aspects) {
  const list = (Array.isArray(aspects) ? aspects : []).map((a) => Math.max(px(a), 0.05)).sort((a, b) => a - b)
  if (list.length === 0) return 1
  // The lower median on an even count, deliberately: a ring of four in which two
  // are wide and two are tall composes on the narrower pair, because a slot too
  // wide costs every panel its size and a slot too narrow costs two of them a
  // margin.
  const median = list[Math.floor((list.length - 1) / 2)]
  return Math.max(RING_SLOT_MIN, Math.min(RING_SLOT_MAX, median))
}

/**
 * A picture fitted inside a slot, keeping its own shape — `contain`, never
 * `cover`.
 *
 * Cropping would need the texture's `repeat` and `offset` nudged, which is a
 * mutation of an object several meshes share, and it would throw away part of a
 * photograph somebody chose. Letterboxed, what shows around a wide picture is the
 * body — a colour the palette measured — rather than a crop nobody asked for.
 */
export function fitInside(aspect, slot) {
  const ratio = Math.max(px(aspect), 0.05)
  const wide = ratio >= slot.x / slot.y
  return wide ? { x: slot.x, y: slot.x / ratio } : { x: slot.y * ratio, y: slot.y }
}

/**
 * The body built around ONE fitted picture, in the slot's own units.
 *
 * The rim is the same thickness on every panel of a ring — that is what makes
 * them read as a set — but it hugs the picture rather than the slot, and a
 * rendered frame is what settled the difference. Bodies built to the slot left a
 * wide picture in a tall panel and a tall one in a wide panel, so a carousel of
 * five screenshots came back as five slabs of saturated accent with a photograph
 * inset in each: the letterbox was the block's own ornament, at the size of the
 * block. Hugging, the accent is a rim and the pictures are the carousel.
 */
export function panelAround(picture, frame) {
  const { border, chin, depth } = stageFrame(frame)
  return {
    body: { x: picture.x + border, y: picture.y + border + chin / 2, z: depth / 2 },
    picture,
    offsetY: chin / 2,
    faceZ: (depth / 2) * (1 + PICTURE_LIFT),
  }
}

/**
 * Where one panel of a ring sits and which way it faces, on one frame.
 *
 * The panel faces OUTWARD — its own yaw is its angle round the ring — so the one
 * at the front is square to the camera and the ones at the sides are turned away.
 * That is a carousel; panels that all faced the camera would be a fan of cards on
 * a turntable, which is a different and much stranger object.
 */
export function ringAngle(count, index, life, direction) {
  const n = Math.max(1, Math.floor(Number(count) || 1))
  const t = Math.max(0, Math.min(1, Number(life) || 0))
  const way = direction === 'right' ? 1 : -1
  return ((Math.max(0, Math.floor(Number(index) || 0)) % n) / n + way * t * RING_TURNS) * 2 * Math.PI
}

/**
 * The radius a ring of `count` panels of half-width `halfWidth` needs, in world
 * units.
 *
 * The chord between two neighbours on a circle of radius `R` is `2R·sin(π/n)`, and
 * it has to hold one panel plus the gap. Solved rather than guessed because the
 * answer changes by a factor of two between three panels and six, and a radius
 * tuned for six leaves three of them overlapping their own centres.
 */
export function ringRadius(count, halfWidth) {
  const n = Math.max(2, Math.floor(Number(count) || 2))
  const needed = 2 * px(halfWidth) * (1 + RING_GAP)
  return needed / (2 * Math.sin(Math.PI / n))
}

/**
 * Everything `photoRing.jsx` draws, in world units, for one frame.
 *
 * Every panel is ONE slot — see `ringSlotAspect` for the export that made that
 * necessary — and each picture is fitted inside its own, keeping its own shape.
 * So a portrait photograph is never stretched into a landscape slot, and a header
 * banner among five screenshots costs a margin rather than the whole block.
 *
 * @param {object} block      the layer
 * @param {number[]} aspects  one per picture, in the document's own order
 * @param {number} canvas     the canvas's width over its height
 */
export function photoRingLayout(block, aspects, canvas) {
  const list = (Array.isArray(aspects) ? aspects : []).map((a) => Math.max(px(a), 0.05))
  const count = list.length
  // The SLOT: what every panel is bounded by, what the ring is spaced on, and
  // what the fit is solved against. The panels themselves hug their own pictures
  // inside it — see `panelAround`.
  const slot = panelGeometry(ringSlotAspect(list), block?.frame)
  const panels = list.map((aspect) => panelAround(fitInside(aspect, slot.picture), block?.frame))
  // A ring of nothing. The schema's floor is three and `validate.js` refuses
  // fewer, so this is reachable only from a hand-built call — and an empty ring
  // that answers a finite scale is a scene with a gap in it rather than a render
  // that dies on a `NaN` mesh (Q1).
  if (count === 0) return { slot, panels, bound: slot.body, radius: 0, scale: 1 }
  // The box that holds EVERY panel, component by component — never the slot's.
  //
  // The slot is the bound a panel may not exceed; what the panels actually came
  // out as is usually smaller, and solving the fit on the slot instead threw that
  // difference away. A rendered frame is what showed it: a ring of three header
  // banners, all of them letterboxed to a fraction of the slot's height, was
  // scaled as though each were a full 16:9 card and came back as three thin bars
  // in the middle of an empty frame. It stays order-independent — a maximum over
  // a set — so the same three pictures in another order compose identically.
  const bound = {
    x: Math.max(...panels.map((p) => p.body.x)),
    y: Math.max(...panels.map((p) => p.body.y)),
    z: Math.max(...panels.map((p) => p.faceZ)),
  }
  const radius = ringRadius(count, bound.x)
  const direction = block?.direction

  // Every panel, at every sampled moment of the turn. The ring has no move of its
  // own beyond its spin, so the sample count is the same one a lone panel uses and
  // the poses are the ring's angles rather than `stageRotation`'s.
  //
  // Only the panel AT THE FRONT is held by the sides — the one whose angle is
  // within half a step of the camera, which is exactly one of them at any moment.
  // The others are turned away and are meant to run out of the frame, which is
  // what a carousel does; see `frustumScale`.
  const frontArc = Math.cos(Math.PI / Math.max(2, count)) - 1e-9
  const half = bound
  const points = []
  for (let s = 0; s < STAGE_SAMPLES; s++) {
    const life = s / (STAGE_SAMPLES - 1)
    for (let i = 0; i < count; i++) {
      const angle = ringAngle(count, i, life, direction)
      const at = [Math.sin(angle) * radius, 0, Math.cos(angle) * radius]
      const front = Math.cos(angle) >= frontArc
      for (const corner of poseCorners(half, { yaw: angle, at, tilt: RING_TILT })) {
        points.push([corner[0], corner[1], corner[2], front])
      }
    }
  }

  return { slot, panels, bound, radius, scale: frustumScale(points, canvas, RING_CAMERA) }
}

/**
 * Where one panel stands and which way it faces, as the component writes it.
 *
 * A `position` and a `yaw` rather than two sines in a `.jsx`: the same split
 * `sceneMotion` makes one level up, and the reason `stage.test.js` can check that
 * a ring never puts two panels in the same place without opening a browser.
 */
export function ringPlacement(count, index, life, direction, radius) {
  const yaw = ringAngle(count, index, life, direction)
  const r = px(radius)
  return { position: [Math.sin(yaw) * r, 0, Math.cos(yaw) * r], yaw }
}

// ── What the composition needs to open a canvas ──────────────────────────────

/**
 * The pictures a stage needs staged as GL textures.
 *
 * `imageIds` and never a second key, which is not a style choice: `timelineImageIds`
 * in the schema walks `imageId` and `imageIds` and nothing else, and it is what
 * decides which files the worker stages and what `/compose` checks against the
 * user's own selection. A block that invented a third spelling would name a
 * picture nobody staged and nobody authorised — a blank panel in the good case.
 */
export function stageImages(block) {
  const ids = Array.isArray(block?.imageIds) ? block.imageIds : []
  return ids.filter((id) => typeof id === 'string' && id.length > 0)
}

/**
 * The two canvas descriptors `blocks/canvases.js` lists, one per block.
 *
 * The whole box, and a lens each. A canvas smaller than the box would be the void
 * this feature spent a pass removing, and a canvas larger than it would be render
 * seconds paid on every frame of every scene for pixels nothing reads — which is
 * the trade that file's header is about.
 */
export function photoStageCanvas(block, box, base) {
  return { ...stageCanvas(box, base), camera: STAGE_CAMERA }
}

/**
 * How many pixels a RING may be drawn on before it is painted back over its box.
 *
 * The one block of this family that had to be bounded, and every number below was
 * measured on the two-core container over twenty seconds of film rather than
 * reasoned about.
 *
 *   a plain title (the control)               1.52 s of render per second of film
 *   + a full-frame `solidScene`                                            + 0.90
 *   + a full-frame `photoStage`                                            + 0.18
 *   + a full-frame flat `gallery` of six                                   + 0.26
 *   + a full-frame `photoRing` of six, unbounded                           + 2.24
 *   + the same ring, drawn inside this budget                              + 1.35
 *
 * against the roughly 1.7 s/s the duration-scaled deadline leaves spare. Unbounded
 * it is one block spending a whole film's margin, which is the trade `field.js`
 * refuses in the same words.
 *
 * The FLAT gallery is the line that decides what to do about it. Six screenshots
 * on one frame cost 4.58 MB of h264 against the control's 1.75, and that whole
 * encoder bill is 0.26 s/s — so the ring's two and a quarter are not the pictures
 * being encoded, they are the pictures being SAMPLED: eighteen textured quads at
 * the grazing angles a software rasteriser is slowest at, and that cost falls with
 * the resolution it is drawn at. It does not fall to nothing — extrapolating the
 * two measurements leaves about 0.9 s/s of geometry and encoding that no budget
 * touches — which is why this is a bound and not a cure, and why the card says a
 * ring is the most expensive thing in the catalogue.
 *
 * It is the same six hundred thousand `field.js` arrived at, and the agreement is
 * not a shared constant: it is the same rasteriser in the same container reaching
 * the same trade from two different blocks. What a ring gives up for it is
 * sharpness on pictures nobody is meant to read closely — only the panel at the
 * front is ever square to the eye, and the card already says to use something else
 * when the viewer has to read what is on them. A ring in a CELL is far under this
 * and is drawn at its own size, to the pixel.
 */
export const RING_PIXEL_BUDGET = 600000

/** The surface a ring is really drawn on: its box, inside the budget above. */
export function ringCanvas(box, base) {
  const asked = stageCanvas(box, base)
  const scale = Math.min(1, Math.sqrt(RING_PIXEL_BUDGET / (asked.width * asked.height)))
  // FLOOR and not round, because the budget is a ceiling: rounding both sides up
  // puts a full-frame landscape canvas twelve pixels over the number this is
  // measured against, and a bound a test has to be given slack for is a bound
  // nobody can state. At a scale of one it is the box, to the pixel.
  return {
    width: Math.max(1, Math.floor(asked.width * scale)),
    height: Math.max(1, Math.floor(asked.height * scale)),
    box: asked,
  }
}

/** The aspect of that surface — never the box's, or the fit solves the wrong rectangle. */
export function ringAspect(box, base) {
  const canvas = ringCanvas(box, base)
  return canvas.width / canvas.height
}

export function photoRingCanvas(block, box, base) {
  const drawn = ringCanvas(box, base)
  // `stretch`, so the drawing is painted back over the whole box rather than
  // placed in the corner of it. `blockCanvas` applies the two scales, one per
  // axis, so an integer backing store cannot leave a hairline of the ground down
  // the right edge.
  return { width: drawn.width, height: drawn.height, camera: RING_CAMERA, stretch: true, frame: drawn.box }
}
