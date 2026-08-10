/**
 * The arithmetic of the two DATA blocks that are drawn by a renderer rather than
 * by the browser's own box model — `globe` and `solidChart`.
 *
 * No React, no Remotion, and **no `three`**. Same reason as `setPiece.js` next
 * door, and it matters more here than anywhere: `blocks/index.js` is imported by
 * Mocky's own vitest suite to prove the registry matches the schema in both
 * directions, and `three` is installed in `worker/video/package.json` and nowhere
 * else. Everything below is numbers — the positions a mesh is built at, never the
 * mesh — so the two components beside it can be a description of a scene and this
 * file can be a corpus.
 *
 * ── Why a second file rather than rows in `dataFigures.js` ───────────────────
 *
 * The five flat data blocks share one vocabulary: a track, a lane, a caption
 * band, a cadence. These two share a different one: a camera, a projection, a
 * lattice on a sphere. Merging them would put a spherical-coordinate helper in
 * the file `barChart` reads, and the one thing the block directory is arranged to
 * avoid is a module twenty-seven authors edit. What they DO share — the land
 * mask, the marker walk, the label band, the bar cascade — is imported from
 * `dataFigures.js` rather than copied, because a globe whose continents differed
 * from the map's would be two worlds in one film.
 *
 * ── The four rules a block drawn in GL has to keep, and where each one lives ──
 *
 *   1. **Determinism.** No die, no clock, anywhere in this directory —
 *      `blocks.test.js` scans for both. It is the trap 3D sets that flat blocks
 *      do not: a field of particles wants to look scattered, and the shortest
 *      route to "scattered" is `Math.random`. Every position here comes from an
 *      INDEX and every motion from `life`. The globe's lattice is a Fibonacci
 *      spiral precisely because it looks scattered and is a formula.
 *   2. **Nothing holds still**, and 3D has already produced the failure once: a
 *      solid spun through a whole number of quarter-turns rendered three frames
 *      byte for byte identical. So no rotation here completes a whole turn over a
 *      scene (`GLOBE_TURNS`) and no continuous term has an integer period
 *      (`CHART_LIGHT_CYCLES`).
 *   3. **A block inhabits its box.** Both canvases are a share of the block's OWN
 *      box, never of the frame — the rule at the top of `composition.js`. That is
 *      also the whole of the render bill: a scene naming eight globes draws what
 *      one frame draws, because eight boxes are eight eighths of a safe area.
 *   4. **No colour is decided here.** These functions answer positions, sizes,
 *      opacities and one ambient share. Every colour arrives through
 *      `composedPalette`, and a lit surface is measured as the two ends of its
 *      Lambert segment exactly as `solidShading` already measures a solid's.
 */

import {
  FIGURE_GAP_SHARE,
  LAND_MARK,
  LAND_ROWS,
  MAP_COLUMNS,
  MAP_NORTH,
  MAP_ROWS,
  MAP_SOUTH,
  labelBand,
  linkPulse,
  mapWindow,
  markerCells,
  markerPulse,
} from './dataFigures.js'
import { SOLID_BOUND, SOLID_CAMERA_FOV, SOLID_CAMERA_Z, SOLID_ENTER_SCALE, SOLID_LIGHT } from './setPiece.js'
import { SPRITE_AREA_GAIN } from './pointSprite.js'

const DEG = Math.PI / 180

/** A positive length, or 0. `composedLayout` guarantees it; a hand-built test does not. */
const px = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** `x`, clamped to the unit interval, with anything unreadable landing at 0. */
const unit = (x) => {
  const n = Number(x)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
}

const clamp = (x, low, high) => Math.min(high, Math.max(low, x))

// ── The camera these two are seen from ───────────────────────────────────────

/**
 * The globe is seen from the camera every lit object in this catalogue is seen
 * from, and that is a decision rather than a saving.
 *
 * `solidScene` states its own field of view and distance because react-three-
 * fiber's defaults drew a sphere as a small grey disc in the corner of a zone.
 * A second set of numbers here would be a second answer to the same question, and
 * two objects in one film seen through two lenses read as two films — which is
 * the argument `easeOutCubic` and `cueFrames` already make about movement. So the
 * lens is imported, and with it `SOLID_BOUND`: the exact radius at which a ball
 * about the origin touches the edge of its canvas and never crosses it.
 */
export const GLOBE_CAMERA = { position: [0, 0, SOLID_CAMERA_Z], fov: SOLID_CAMERA_FOV }
export const GLOBE_RADIUS = SOLID_BOUND

/**
 * And the chart is seen ORTHOGRAPHICALLY, which is the whole reason it is legible.
 *
 * ── A 3D bar chart is a decoration unless this is true ──────────────────────
 *
 * The brief for this block was explicit: a histogram whose values cannot be read
 * is an ornament, and if it cannot be made readable it should be something else.
 * Under a PERSPECTIVE camera it cannot. Two bars of equal value at different
 * distances project to different heights — with the lens above, a bar one and a
 * half units nearer than another draws 1.73 times its height — so the one thing a
 * bar chart is for, comparing two columns by eye, is exactly what the projection
 * destroys. That is not a tuning problem: it is why a 3D bar chart is a
 * data-visualisation anti-pattern everywhere it appears.
 *
 * Orthographically it is not true. A parallel projection maps a vertical segment
 * of world length `h` to `h·cos(elevation)` on the screen WHEREVER it stands —
 * `chartProject` is that arithmetic and `dataVolume.test.js` holds it as an
 * equality across every bar of every corpus. Two equal values draw two equal
 * columns, and the volume is bought with shading and a top face rather than with
 * a vanishing point.
 *
 * The camera therefore does not move, and neither does the chart: the frame is
 * fixed so the comparison is fixed. What moves is the light — see
 * `chartLightAt`.
 */
export const CHART_ELEVATION = 18
export const CHART_AZIMUTH = 16

/**
 * Where the camera stands, in the world units this block builds in — which are
 * the canvas's own pixels, because r3f's default orthographic frustum is the
 * canvas in pixels at `zoom: 1`.
 *
 * Only `near` and `far` matter under a parallel projection; the distance changes
 * nothing about the size of anything. They are wide enough for the deepest
 * drawing the fit below can produce and no wider, since a depth range larger than
 * the scene is precision spent on empty space.
 */
export const CHART_CAMERA_Z = 4000
export const CHART_CAMERA = { position: [0, 0, CHART_CAMERA_Z], near: 1, far: CHART_CAMERA_Z * 2, zoom: 1 }

/** The light rig, shared with `solidScene` for the reason the lens is. */
export const SCENE_LIGHT = SOLID_LIGHT

// ── globe ────────────────────────────────────────────────────────────────────

/**
 * The golden angle: the turn between two consecutive points of a Fibonacci
 * lattice, and the reason a globe of dots can be even without being random.
 *
 * A lattice of `N` points at `y = 1 − (2i+1)/N` and `θ = i·GOLDEN_ANGLE` covers a
 * sphere at very nearly equal area — each point owns `4πR²/N` — which is the one
 * property a dotted globe needs and the one a latitude/longitude grid does not
 * have: sampled at a fixed step in both, a grid puts five times as many dots per
 * unit of surface at 78° north as it does at the equator, so the poles read as
 * bright caps and the tropics as a thin scatter. It is also what makes the
 * scatter DETERMINISTIC, which is the trap this block was written around.
 */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/**
 * How far apart two dots sit on the screen, in pixels, at the middle of the
 * globe — the quantity the point count is solved for.
 *
 * Not a fixed count, because the box decides the scale here as it does
 * everywhere: three thousand dots across a full safe area are a globe, and the
 * same three thousand inside a third of a cell are a grey disc. Thirty pixels is
 * where the continents of `LAND_ROWS` are still continents and the frame is still
 * affordable — below about eighteen the coastlines silt up into a texture and,
 * more to the point, the BYTES climb: the same six seconds came back at 7.5 MB at
 * a pitch of eighteen and 3.9 at thirty, against 0.73 for a plain title. A dot is
 * detail an encoder cannot predict, so the pitch is the one number in this block
 * that is a bitrate as much as a look.
 */
export const GLOBE_PITCH_PX = 30

/** And the bounds on the count that pitch implies. The ceiling is a render bill, the floor a look. */
export const GLOBE_POINTS_MIN = 350
export const GLOBE_POINTS_MAX = 9000

/**
 * How many points the lattice holds for a canvas of this many pixels.
 *
 * At the centre of the disc the projection is one to one, so the screen pitch is
 * the surface pitch: `2R·√(π/N)` world units across a disc of `canvasPx` pixels
 * for a diameter of `2R` gives `canvasPx·√(π/N)`. Solving that for the pitch above
 * is the line below, and it is the only place a count is decided.
 */
export function globePointCount(canvasPx) {
  const side = px(canvasPx)
  if (side === 0) return GLOBE_POINTS_MIN
  return Math.round(clamp(Math.PI * (side / GLOBE_PITCH_PX) ** 2, GLOBE_POINTS_MIN, GLOBE_POINTS_MAX))
}

/**
 * The lattice, as unit vectors with the latitude and longitude they stand at.
 *
 * The frame is the one the rotation below is written in: longitude 0 faces the
 * camera, so a point sits at `(cos φ·sin λ, sin φ, cos φ·cos λ)` and a yaw simply
 * ADDS to λ. Choosing that convention here rather than in the component is what
 * lets `globeVisible` be a function a test can call.
 */
export function globeLattice(count) {
  const n = Math.max(1, Math.trunc(Number(count)) || 1)
  const points = []
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * i + 1) / n
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = i * GOLDEN_ANGLE
    points.push({ x: r * Math.sin(theta), y, z: r * Math.cos(theta) })
  }
  return points
}

/**
 * Whether a point of the lattice stands on land, read off the map's own mask.
 *
 * The same `LAND_ROWS` the flat `map` block draws, and importing it is the point:
 * a globe with its own coastline would be a second world in the same film, and
 * the mask is 16 KB that has already been reviewed. Its window stops at 78° north
 * and 54° south — Antarctica is deliberately outside it, see `dataFigures.js` —
 * so a point beyond either is SEA rather than absent, which is why the lattice
 * covers the whole sphere and only the classification is windowed. A cap of
 * missing dots is a hole in the shell, and a hole rotates into view.
 */
export function globeIsLand(point) {
  const lat = Math.asin(clamp(Number(point?.y) || 0, -1, 1)) / DEG
  if (lat > MAP_NORTH || lat < MAP_SOUTH) return false
  const lon = Math.atan2(Number(point?.x) || 0, Number(point?.z) || 0) / DEG
  const col = Math.floor((((lon + 180) % 360) + 360) % 360 / (360 / MAP_COLUMNS))
  const row = Math.floor((MAP_NORTH - lat) / ((MAP_NORTH - MAP_SOUTH) / MAP_ROWS))
  if (row < 0 || row >= MAP_ROWS) return false
  return LAND_ROWS[row]?.[Math.min(col, MAP_COLUMNS - 1)] === LAND_MARK
}

/**
 * The lattice, with the dots that are NOT land dropped — and dropping them is a
 * measurement rather than a taste.
 *
 * The first version drew the whole shell: land bright, sea quiet, one lattice
 * split in two so no dot was drawn twice. It read beautifully and it measured
 * 1.8 s of render per second of film and 7.5 MB for six seconds — against a
 * deadline that leaves 1.7 and a control that came back at 0.73 MB. That is the
 * WIREFRAME's failure exactly, the one this catalogue already refused at 2.7 s/s
 * and 9.8 MB: thousands of tiny high-contrast points moving every frame are the
 * high-frequency detail h264 cannot predict and cannot compress, and a software
 * rasteriser blends every one of them.
 *
 * A translucent sphere in place of the sea was measured too, and it is worse on
 * the axis that matters: one draw call, but a full disc of alpha blending on
 * every frame — 30.9 s against 23.8 for the shell it replaced. What replaces it
 * is `globeGraticule`, a few hundred points on a dozen meridians, and the finished
 * block measures 0.8 s/s and 3.9 MB. See `docs/video-export.md` for the bench.
 *
 * Memoised on the count, because the component asks for it on each of a scene's
 * four hundred and fifty frames and the answer depends on nothing else. The
 * rotation is applied downstream, per frame, to the vectors this returns.
 */
const FIELDS = new Map()

export function globeField(count) {
  const n = Math.max(1, Math.trunc(Number(count)) || 1)
  const held = FIELDS.get(n)
  if (held) return held
  const land = globeLattice(n).filter((point) => globeIsLand(point))
  const field = { land }
  FIELDS.set(n, field)
  return field
}

/**
 * How many meridians and parallels the graticule is drawn with, and how finely
 * each is sampled.
 *
 * This is what makes a rotating scatter of continents read as a BALL: a meridian
 * converges towards the poles and crowds towards the limb, so the curvature is
 * drawn rather than implied, and the silhouette is where the lines run out. The
 * counts are small on purpose — see `globeField` for the numbers a full shell
 * cost — and they are not a whole fraction of anything: twelve meridians is one
 * every thirty degrees, which is a globe's own convention.
 */
export const GLOBE_MERIDIANS = 12
export const GLOBE_PARALLELS = 7
export const GLOBE_GRATICULE_STEPS = 44

/**
 * The graticule, as points on the unit sphere, memoised like the field.
 *
 * Points and not lines, for the reason the wireframe was refused: a mesh of lines
 * is the detail an encoder spends its whole allowance on. A dotted meridian is a
 * dotted meridian at a twentieth of the bitrate, and at this density the dots
 * read as a line anyway once they are near the limb.
 */
let GRATICULE = null

export function globeGraticule() {
  if (GRATICULE) return GRATICULE
  const points = []
  for (let m = 0; m < GLOBE_MERIDIANS; m++) {
    const lon = (m / GLOBE_MERIDIANS) * Math.PI * 2
    for (let i = 0; i < GLOBE_GRATICULE_STEPS; i++) {
      const lat = -Math.PI / 2 + (Math.PI * (i + 0.5)) / GLOBE_GRATICULE_STEPS
      points.push({ x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon) })
    }
  }
  for (let p = 1; p <= GLOBE_PARALLELS; p++) {
    const lat = -Math.PI / 2 + (Math.PI * p) / (GLOBE_PARALLELS + 1)
    // Sampled in proportion to the circle's own circumference, so a parallel near
    // a pole is not eight dots on top of each other.
    const steps = Math.max(6, Math.round(GLOBE_GRATICULE_STEPS * 2 * Math.cos(lat)))
    for (let i = 0; i < steps; i++) {
      const lon = (i / steps) * Math.PI * 2
      points.push({ x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon) })
    }
  }
  GRATICULE = points
  return points
}

/**
 * How far the globe is allowed to be tipped towards the viewer.
 *
 * `europe` centres on 49° north and `africa` near the equator, so an uncorrected
 * tilt would show one region from almost above and the other edge-on: two shots
 * of two different objects. The cap keeps every region a globe seen from slightly
 * above, which is what a globe looks like.
 */
export const GLOBE_MAX_TILT = 32

/**
 * Which way the globe faces at the start of a scene: the centre of the window the
 * region names, read off the map's own table.
 *
 * `region` frames a globe exactly as it frames the flat map — it says which part
 * of the world the scene is ABOUT, and nothing about where a marker goes. A
 * document that stated a longitude would be stating a coordinate, which is the
 * line the whole catalogue is drawn on.
 */
export function globeFacing(region) {
  const window = mapWindow(region)
  const col = (window.col0 + window.col1 + 1) / 2
  const row = (window.row0 + window.row1 + 1) / 2
  return {
    lon: -180 + col * (360 / MAP_COLUMNS),
    lat: MAP_NORTH - row * ((MAP_NORTH - MAP_SOUTH) / MAP_ROWS),
  }
}

/**
 * How much of a turn the globe makes across one scene.
 *
 * Not a whole one, and this is `solidSpin`'s lesson rather than a taste: a sphere
 * turned through exactly 2π is pixel-identical at its first frame and its last,
 * which is precisely what `tests/video-motion.test.js` compares — and a film in
 * which nothing moves must not be producible by accident. Under half a turn also
 * keeps the region the document named on the visible side for most of the scene,
 * which is what naming it was for.
 */
export const GLOBE_TURNS = 0.42

/** Where the globe stands on this frame: a yaw that runs, and a fixed tilt. */
export function globeOrientation(region, life) {
  const facing = globeFacing(region)
  return {
    yaw: -facing.lon * DEG + unit(life) * Math.PI * 2 * GLOBE_TURNS,
    tilt: clamp(facing.lat, -GLOBE_MAX_TILT, GLOBE_MAX_TILT) * DEG,
  }
}

/** A point of the lattice, turned: yaw about the pole, then tilt towards the viewer. */
export function globeRotate(point, yaw, tilt) {
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const x = (Number(point?.x) || 0) * cy + (Number(point?.z) || 0) * sy
  const behind = -(Number(point?.x) || 0) * sy + (Number(point?.z) || 0) * cy
  const ct = Math.cos(tilt)
  const st = Math.sin(tilt)
  const y = (Number(point?.y) || 0) * ct - behind * st
  const z = (Number(point?.y) || 0) * st + behind * ct
  return { x, y, z }
}

/**
 * The dots of a field that are on the near side, as the flat array a GL buffer
 * takes.
 *
 * Culled here rather than hidden behind an occluding sphere, and the difference
 * is one of guarantees rather than of looks. A depth-only sphere would work only
 * as long as it was drawn FIRST — an ordering the renderer decides, not this file
 * — and a sphere painted in the ground's colour would be a flat disc over a
 * gradient or a photograph. Half a lattice is arithmetic, and arithmetic is what
 * a test can hold.
 */
export function globeVisible(points, yaw, tilt, radius) {
  const list = Array.isArray(points) ? points : []
  const r = px(radius) || GLOBE_RADIUS
  const out = []
  for (const point of list) {
    const turned = globeRotate(point, yaw, tilt)
    if (turned.z <= 0) continue
    out.push(turned.x * r, turned.y * r, turned.z * r)
  }
  return Float32Array.from(out)
}

/**
 * How wide a dot is drawn, in PIXELS — and it is pixels rather than world units
 * on purpose.
 *
 * A `pointsMaterial` with size attenuation turned on computes its own point size
 * in the vertex shader from a scale factor that is a property of the renderer
 * rather than of this scene, which would make the one quantity a reviewer wants
 * to check — how big is a dot — a number nobody in this file can state. With
 * attenuation off the size IS the size, in device pixels, and the loss is that a
 * dot near the limb is not drawn smaller than one at the centre. On a field this
 * dense that reads as an even grid, which is what a dotted globe is.
 */
export const GLOBE_DOT_SHARE = 0.4

export function globeDotPx(canvasPx, count) {
  const side = px(canvasPx)
  const n = Math.max(1, Math.trunc(Number(count)) || 1)
  // `SPRITE_AREA_GAIN` for the reason `particleSize` states: `GLOBE_DOT_SHARE`
  // was chosen against a rendered lattice of SQUARE points, and the mask that
  // made them round took a fifth of the ink away. The gain puts the covered area
  // back where the pitch was signed off, and nowhere else.
  return Math.max(1, Math.round(GLOBE_DOT_SHARE * SPRITE_AREA_GAIN * side * Math.sqrt(Math.PI / n)))
}

/**
 * How loud the two halves of the shell are.
 *
 * Both are opacities on the accent run the palette has already resolved against
 * the ground with the veil locked, so neither can be louder than what was
 * measured — the same rule `FIELD_QUIET` and `FIELD_LIT` keep on the flat map.
 * The graticule is what makes the object a sphere rather than a scatter of
 * continents hanging in space, and it has to stay quiet enough that the land
 * reads as the figure: under a third is where the meridians are visible and the
 * coastlines are still the first thing an eye lands on.
 */
export const GLOBE_GRID_ALPHA = 0.32
export const GLOBE_LAND_ALPHA = 0.9

/** How much bigger than a dot a marker is drawn, and how far a connection bows off the surface. */
export const GLOBE_MARKER_SHARE = 2.6
export const GLOBE_ARC_LIFT = 0.16

/**
 * A marker's radius in WORLD units, from the two quantities that are already in
 * pixels.
 *
 * The canvas is square and the camera is `GLOBE_CAMERA`, so the sphere's own
 * silhouette fills it: a world length of `2·GLOBE_RADIUS` is `canvasPx` across,
 * which is the whole of the conversion. It is here rather than in the component
 * because it is the one number that crosses between the two spaces, and a
 * conversion written in a `.jsx` is a conversion no test can call.
 */
export function globeMarkerRadius(canvasPx, dotPx) {
  const side = px(canvasPx)
  if (side === 0) return 0
  return (GLOBE_MARKER_SHARE * px(dotPx) * GLOBE_RADIUS) / side
}

/** How many points one connection is drawn with. A trail rather than a stroke: see `globeArc`. */
export const GLOBE_ARC_STEPS = 26

/**
 * Where the markers go — decided HERE, which is the point, and by the same walk
 * the flat map uses.
 *
 * The schema carries a COUNT and nothing else, exactly as `map` does: a document
 * that placed a marker would be placing a coordinate. `markerCells` is a golden-
 * ratio stride over the land points, which spreads them over the whole field
 * instead of clustering them the way a fixed stride over an ordered list does,
 * and it is imported rather than rewritten so that a globe and a map of the same
 * film mark the same places.
 */
export function globeMarkers(field, count) {
  return markerCells(field?.land ?? [], count)
}

/**
 * A connection between two markers, as points along the shorter great circle,
 * lifted off the surface.
 *
 * A spherical interpolation and not a straight line: a chord between two distant
 * markers passes THROUGH the globe, so half of it would be drawn on the far side
 * of a shell whose far side is not drawn. The lift is a raised sine, so the arc
 * leaves and meets the surface at its two markers rather than floating above
 * them.
 *
 * It is drawn as a trail of points rather than as a stroke because a line in this
 * renderer is a second material and a second draw call for a decoration, and
 * because a trail can be revealed by taking fewer of its points — which is what
 * `globeArcs` does with `linkPulse` and what makes a connection travel.
 */
export function globeArc(from, to, steps = GLOBE_ARC_STEPS) {
  const n = Math.max(2, Math.trunc(Number(steps)) || 2)
  const dot = clamp(from.x * to.x + from.y * to.y + from.z * to.z, -1, 1)
  const angle = Math.acos(dot)
  const sin = Math.sin(angle)
  const out = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    // Two antipodal or identical markers have no unique great circle between
    // them; a straight blend is the answer that draws something rather than a
    // division by zero (Q1).
    const a = sin < 1e-6 ? 1 - t : Math.sin((1 - t) * angle) / sin
    const b = sin < 1e-6 ? t : Math.sin(t * angle) / sin
    const lift = 1 + GLOBE_ARC_LIFT * Math.sin(Math.PI * t)
    out.push({
      x: (from.x * a + to.x * b) * lift,
      y: (from.y * a + to.y * b) * lift,
      z: (from.z * a + to.z * b) * lift,
    })
  }
  return out
}

/**
 * Every connection of a scene, as the flat array a GL buffer takes — near side
 * only, and drawn only as far as its own pulse has travelled.
 *
 * Consecutive markers and not every pair: eight markers make twenty-eight pairs,
 * which is a ball of string rather than a network, and the count the document
 * asked for is the count of PLACES.
 */
export function globeArcs(markers, yaw, tilt, radius, life) {
  const list = Array.isArray(markers) ? markers : []
  const r = px(radius) || GLOBE_RADIUS
  const out = []
  for (let i = 0; i + 1 < list.length; i++) {
    const drawn = linkPulse(life, i)
    const arc = globeArc(list[i], list[i + 1])
    for (let k = 0; k < arc.length; k++) {
      if (k / (arc.length - 1) > drawn) break
      const turned = globeRotate(arc[k], yaw, tilt)
      if (turned.z <= 0) continue
      out.push(turned.x * r, turned.y * r, turned.z * r)
    }
  }
  return Float32Array.from(out)
}

/**
 * Two flat arrays, end to end — and the reason this function exists is a
 * measurement rather than tidiness.
 *
 * Every cloud of points costs about fifteen milliseconds a FRAME whatever is in
 * it: the positions are rebuilt on each of a scene's four hundred and fifty
 * frames, so the geometry behind them is disposed and re-created that many times,
 * and the bill is per BUFFER rather than per point. Measured on the worker: the
 * same globe drawn at 7854 dots and at 2827 took 23.8 s and 24.4 s for six
 * seconds of film — a two-and-a-half-fold cut in the dots that changed nothing —
 * while dropping one cloud of the three took 2.7 s off it.
 *
 * So the connections travel in the LAND's buffer. They are the same ink at the
 * same strength, which is also the right answer on its own terms: an arc between
 * two lit places reads as belonging to them rather than as a third thing on the
 * frame. The graticule keeps its own buffer because it is the one run that has to
 * be QUIETER than the land — a mesh as bright as the continents is a mesh instead
 * of a globe.
 */
export function joinPoints(first, second) {
  const a = first instanceof Float32Array ? first : new Float32Array(0)
  const b = second instanceof Float32Array ? second : new Float32Array(0)
  if (b.length === 0) return a
  if (a.length === 0) return b
  const out = new Float32Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

/**
 * The square canvas a globe is drawn in: the smaller side of the block's OWN box.
 *
 * Square because the object is a ball — the same answer `solidCanvas` gives, and
 * the same reason `BLOCK_APPETITE` calls this kind `minor`. There is no `size`
 * field to divide it by: a globe is the subject of its scene when it is in one,
 * and a document that wanted a smaller one anchors it to a smaller zone.
 */
export function globeCanvas(box, base) {
  const room = Math.min(px(box?.width) || px(base), px(box?.height) || px(base))
  return Math.max(1, Math.round(room))
}

/** The globe's own arrival: it grows into the frame, on the scale a solid already uses. */
export function globeScale(progress) {
  return SOLID_ENTER_SCALE + (1 - SOLID_ENTER_SCALE) * unit(progress)
}

/**
 * How lit a marker is on this frame.
 *
 * `markerPulse` is the flat map's own curve and it is imported for the reason the
 * mask is: two blocks marking the same places at two rhythms are two films. What
 * is added here is the near-side fade — a marker at the limb is a marker about to
 * pass behind the globe, and one that vanished at full brightness would blink.
 */
export function globeMarkerLight(point, yaw, tilt, life, index) {
  const turned = globeRotate(point, yaw, tilt)
  if (turned.z <= 0) return { shown: false, x: 0, y: 0, z: 0, light: 0 }
  return {
    shown: true,
    x: turned.x,
    y: turned.y,
    z: turned.z,
    // `z` is the cosine of the angle off the line of sight, so it is already the
    // fade: full at the centre of the disc, zero at the silhouette.
    light: turned.z * (0.45 + 0.55 * unit(markerPulse(life, index))),
  }
}

// ── solidChart ───────────────────────────────────────────────────────────────

/**
 * How deep a bar is, as a share of its width, and how much of the pitch is air.
 *
 * The air is `FIGURE_GAP_SHARE`, the flat chart's own, so a row of eight solid
 * bars has the same rhythm as a row of eight flat ones. The depth follows from
 * it: see `chartOcclusion`, where the two together are what prove no bar can hide
 * another.
 */
export const CHART_DEPTH_SHARE = 1

/**
 * How thick the plinth is, in body units of the bar row's own height, and how
 * far it oversails the row.
 *
 * A plate rather than a rule: this is the 3D counterpart of `barChart`'s baseline
 * and it does the same job — it says where zero is. A hairline would not, since a
 * line drawn in perspective is the one element whose thickness the projection is
 * free to change.
 */
export const CHART_PLINTH = 0.035
export const CHART_PLINTH_MARGIN = 0.35

/**
 * The proof that no bar hides another, as a function rather than as a paragraph.
 *
 * A box of width `w` and depth `d`, yawed by `a`, has a silhouette `w·cos a +
 * d·sin a` wide, and the bars' centres are `p·cos a` apart on the screen. So the
 * row is free of occlusion exactly when `w + d·tan a ≤ p`. With the air the flat
 * chart already spends — `w = (1 − FIGURE_GAP_SHARE)·p` — and a depth equal to the
 * width, that bounds the yaw at `atan(gap/(1 − gap))`, which is a little over 23°.
 * `CHART_AZIMUTH` sits at 16, and `dataVolume.test.js` holds the inequality
 * rather than the number.
 *
 * The elevation needs no such bound: every bar of the row stands at the same
 * depth, so tipping the camera moves all of them by the same amount and no two of
 * them ever cross.
 */
export function chartOcclusion(azimuth = CHART_AZIMUTH, gap = FIGURE_GAP_SHARE) {
  const width = 1 - gap
  const depth = width * CHART_DEPTH_SHARE
  return { spread: width + depth * Math.tan(azimuth * DEG), pitch: 1 }
}

/**
 * A world point, projected — the arithmetic the components draw with and the
 * arithmetic the test measures.
 *
 * The chart is built upright and TURNED, rather than the camera being placed
 * somewhere and pointed: with the camera left where a canvas puts it, looking
 * down its own −Z, the projected coordinates of a point are simply its rotated x
 * and y, and there is no `lookAt` to agree with. It is `solidScene`'s arrangement
 * — a fixed camera and a spinning mesh — applied to a fixed pose.
 *
 * Read the second line, because it is the block's whole claim: `y` enters it once,
 * multiplied by `cos(elevation)` and by nothing else. Two bars of equal height
 * therefore draw equal columns wherever they stand.
 */
export function chartProject(point, elevation = CHART_ELEVATION, azimuth = CHART_AZIMUTH) {
  const e = elevation * DEG
  const a = azimuth * DEG
  const x = (Number(point?.x) || 0) * Math.cos(a) + (Number(point?.z) || 0) * Math.sin(a)
  const behind = -(Number(point?.x) || 0) * Math.sin(a) + (Number(point?.z) || 0) * Math.cos(a)
  return { x, y: (Number(point?.y) || 0) * Math.cos(e) + behind * Math.sin(e) }
}

/**
 * How thin and how wide a bar may get, as multiples of the row's own height.
 *
 * The row's width is solved so that the drawing has the SHAPE of its canvas —
 * which is what "a block fills the box it is given" means on both axes at once —
 * and the two bounds are where that stops. A strip three times as wide as it is
 * tall would otherwise give eight bars the proportions of paving slabs, and a
 * narrow column would give them the proportions of hairs. What is left over when
 * a bound bites is air, split evenly, exactly as `LINE_MAX_ASPECT` spends it.
 */
export const CHART_BAR_MIN = 0.07
export const CHART_BAR_MAX = 0.5

/**
 * The row's width in world units, for a plot one unit tall.
 *
 * Solved rather than chosen. The projected drawing is `Wc·K1` wide and `C0 +
 * Wc·K2` tall, both linear in the row's width, so there is exactly one width at
 * which the drawing has the canvas's own aspect — and `K1 > A·K2` for every
 * aspect a zone can be, since `K1` is near one and `K2` is a product of two
 * sines.
 */
export function chartRowWidth(count, aspect, { elevation = CHART_ELEVATION, azimuth = CHART_AZIMUTH } = {}) {
  const n = Math.max(1, Math.trunc(Number(count)) || 1)
  const e = elevation * DEG
  const a = azimuth * DEG
  const wide = Math.max(0.01, Number(aspect) || 1)
  const bar = (1 - FIGURE_GAP_SHARE) / n
  const depth = bar * CHART_DEPTH_SHARE
  const k1 = Math.cos(a) + depth * Math.sin(a)
  const k2 = Math.sin(e) * (Math.sin(a) + depth * Math.cos(a))
  const c0 = (1 + CHART_PLINTH) * Math.cos(e)
  const solved = k1 - wide * k2 > 1e-6 ? (wide * c0) / (k1 - wide * k2) : n / (1 - FIGURE_GAP_SHARE)
  // The bounds are on the BAR and the row follows, because the bar is the thing
  // an eye reads as too thin or too fat.
  return clamp(solved * bar, CHART_BAR_MIN, CHART_BAR_MAX) * (n / (1 - FIGURE_GAP_SHARE))
}

/**
 * Everything a solid chart draws, in the canvas it was given.
 *
 * The order is `barChartLayout`'s and for the same reason: the labels are sized
 * against ONE lane, the plot is what is left of the box under them, and the row
 * is fitted to the plot. Solving it the other way round is circular.
 *
 * Two things are answered in two different spaces and the names say which.
 * `world` is what the meshes are built from, in units where the plot is one unit
 * tall; `scale` and `offset` are what the group carries so that the projection of
 * that world lands inside the canvas, in pixels. `lanes` is where each bar ends up
 * ON THE SCREEN, which is the only way a flat caption can sit under a projected
 * column.
 */
export function solidChartLayout(block, box, { unit: at, base } = {}) {
  const width = px(box?.width) || px(base)
  const height = px(box?.height) || px(base)
  const values = Array.isArray(block?.values) ? block.values : []
  const count = Math.max(1, values.length)

  // Sized against a lane of the FLAT row, which is the estimate `barChart` makes
  // with `tracks`: the projected lanes below are within a few per cent of it, and
  // a caption band a few pixels tall either way costs a cell nothing while a
  // circular solve would cost a reader an hour.
  const label = labelBand(block?.labels, at, (width / count) * (1 - FIGURE_GAP_SHARE))
  const band = label.shown ? label.height + label.gap : 0
  const canvas = { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height - band)) }

  const row = chartRowWidth(count, canvas.width / canvas.height)
  const bar = (row * (1 - FIGURE_GAP_SHARE)) / count
  const depth = bar * CHART_DEPTH_SHARE
  const pitch = row / count
  const bars = values.map((value, i) => ({
    x: -row / 2 + pitch * (i + 0.5),
    width: bar,
    depth,
    // A value of zero is a box of no height, which is a geometry with no faces —
    // the plinth is where zero is read, so the column simply is not there.
    height: unit(Number(value) / 100),
  }))

  // The projected bounding box, over the corners that can actually be extreme:
  // the plinth's four feet and the four corners of the FULL plot. Everything else
  // lies inside their hull, because the projection is linear.
  //
  // The full plot and never the tallest bar, which is the difference between a
  // chart and a picture of one. The schema bounds a value to 0–100 and nothing
  // rescales — `seriesPoints` argues it for the flat line chart — so a fit made
  // against the tallest column would draw a row whose highest value is 20 at the
  // same size as one whose highest is 100, and two scenes stating different
  // numbers would look identical.
  const plate = {
    width: row + 2 * bar * CHART_PLINTH_MARGIN,
    depth: depth + 2 * bar * CHART_PLINTH_MARGIN,
  }
  const corners = []
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      corners.push({ x: (sx * plate.width) / 2, y: -CHART_PLINTH, z: (sz * plate.depth) / 2 })
      corners.push({ x: (sx * row) / 2, y: 1, z: (sz * depth) / 2 })
    }
  }
  const shot = corners.map((corner) => chartProject(corner))
  const left = Math.min(...shot.map((p) => p.x))
  const right = Math.max(...shot.map((p) => p.x))
  const bottom = Math.min(...shot.map((p) => p.y))
  const top = Math.max(...shot.map((p) => p.y))
  const scale = Math.min(canvas.width / Math.max(1e-6, right - left), canvas.height / Math.max(1e-6, top - bottom))
  const offset = {
    x: -((left + right) / 2) * scale,
    y: -((bottom + top) / 2) * scale,
  }

  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    canvas,
    label,
    world: { bars, row, bar, depth, plate, plinth: CHART_PLINTH },
    scale,
    offset,
    /**
     * Where each column stands on the screen, in canvas pixels from the left —
     * the projection of its own centre line, which is what a caption under a
     * turned column has to be centred on. Sized to the pitch rather than to the
     * bar, exactly as `barChartLayout` centres a label on its TRACK: a capped bar
     * and an uncapped one then caption alike.
     */
    lanes: bars.map((one) => {
      const centre = chartProject({ x: one.x, y: 0, z: 0 }).x * scale + offset.x + canvas.width / 2
      const lane = pitch * Math.cos(CHART_AZIMUTH * DEG) * scale
      return { start: Math.round(centre - lane / 2), size: Math.max(1, Math.round(lane)) }
    }),
  }
}

/**
 * How many times the light comes round in one scene, and how far it swings.
 *
 * **The bars must not move once they have grown**, which is `barChart`'s rule and
 * the reason it exists: a column's height is the number the document stated, and
 * a value that breathes is a value nobody can read. A chart that stopped moving
 * would then be the still frame `DEFAULT_KEN_BURNS` refuses, one block down — so
 * what carries the scene is the LIGHT. It re-shades the faces continuously,
 * changes no height, and is the one continuous motion a lit object has that a
 * flat one does not.
 *
 * The count is not a whole number for `solidSpin`'s reason: a light back where it
 * started is a last frame identical to a first. The swing stays well inside a
 * quarter turn so the row is never lit from behind, where every face would sit at
 * the ambient end of its own segment and the chart would read as a silhouette.
 */
export const CHART_LIGHT_CYCLES = 1.3
export const CHART_LIGHT_SWING = 0.42

/**
 * Where the one directional light stands on this frame.
 *
 * It orbits the rig `solidScene` uses rather than replacing it, so the two blocks
 * are lit from the same quarter, and it stays a single directional light: the
 * proof that every face lies between `material × ambient` and `material` is a
 * statement about ONE Lambert term, and a second light would put a face outside
 * the segment `composedPalette` measured.
 */
export function chartLightAt(life) {
  const [x, y, z] = SCENE_LIGHT
  const angle = Math.sin(unit(life) * Math.PI * 2 * CHART_LIGHT_CYCLES) * CHART_LIGHT_SWING
  return [x * Math.cos(angle) + z * Math.sin(angle), y, -x * Math.sin(angle) + z * Math.cos(angle)]
}
