// The continuous 3D world — `background: { kind: 'world' }` — as arithmetic.
//
// Everything a test can ask about the world is here, and nothing that draws it:
// `WorldGround.jsx` is the renderer, and it reads every number it paints from
// this file. That split is `composition.js`'s own, for `composition.js`'s own
// reason — a camera path written inside a `.jsx` is a camera path nobody can ask
// whether it ever stops moving.
//
// ── What the world is ────────────────────────────────────────────────────────
//
// One landscape for the whole FILM, not one per scene: a floor of rules, stones
// standing either side of a corridor, and a few shapes turning in the air, all
// laid along one path. Every scene painted on `world` looks into that same place
// through one camera, and the camera's position is a function of the FILM's
// frame. So two world scenes in a row are two shots of one space, and the cut
// between them is the camera flying from one station to the next — which is what
// "continuous" means here, and why a film of eight world scenes reads as one
// journey rather than eight backdrops.
//
// Scenes painted on something else simply cover it: the camera keeps travelling
// behind them, so a world scene after a flat one lands exactly where the journey
// had got to.
//
// ── Why it is legible by construction ────────────────────────────────────────
//
// Every pixel of the world is the ground mixed with the accent, at a share
// between nothing and the reach `composedPalette` settled on (`WORLD_REACHES`):
// the stones' faces are three shares of it, the rules one, the shapes one, and
// the fog blends each of them back towards the bare ground with distance. Fog
// mixes in linear light and the palette measures a gamma mix, and that difference
// is harmless for a reason worth writing down: contrast depends on luminance
// alone, and both mixes sweep exactly the luminances between the same two ends.
// So the ramp the palette sampled covers every colour this renderer can put
// under a word, whatever the camera is looking at.
import { FPS, blend } from './composition.js'

/** World units between the stations of two consecutive scenes. */
export const WORLD_STATION_DEPTH = 16

/**
 * How far the camera drifts while a scene holds, in stations per second.
 *
 * Never zero, and that is `DEFAULT_KEN_BURNS`'s lesson: a ground that holds still
 * while nothing else is arriving is a still frame, and a still frame in a world
 * is a render that cost a GL canvas to look like a JPEG.
 */
export const WORLD_CRUISE_PER_SECOND = 0.1

/**
 * How long the flight from one station to the next lasts, and the share of the
 * shorter of the two scenes it may take.
 *
 * Centred on the middle of the overlap between them, so the camera is already
 * moving while the old blocks leave and still settling while the new ones
 * arrive — a flight that started on the cut would be a jolt.
 */
export const WORLD_FLIGHT_FRAMES = 42
export const WORLD_FLIGHT_SHARE = 0.6

/** The eye's height over the floor, how far the path sways, and where the eye looks. */
export const WORLD_EYE = 2.4
export const WORLD_SWAY = 3
export const WORLD_LOOK_AHEAD = 0.5
export const WORLD_LOOK_DOWN = 1.1

/** The half-width of the corridor the path keeps clear, so no stone is ever walked through. */
export const WORLD_CORRIDOR = 3.4

/** Depth between two rows of stones, and the share of positions left empty. */
export const WORLD_SLOT = 3.5
export const WORLD_EMPTY_SHARE = 0.3

/** How much world lies behind the first station and beyond the furthest one. */
export const WORLD_BEHIND = 12
export const WORLD_AHEAD = 70

/**
 * Fog, as the exponent of `fogExp2`: at 50 units a stone is 94% ground.
 *
 * Lighter than `GRID_FOG_DENSITY`, because the world is seen along a corridor
 * and a fog that swallowed the second row of stones would be a floor in a
 * cloud. Dense enough that the rules converging at the horizon are gone before
 * they become the band of alternating pixels h264 spends its bitrate on.
 */
export const WORLD_FOG_DENSITY = 0.034

/**
 * The floor: rails along the corridor, rules across it.
 *
 * Boxes and not lines, for `depthGrid`'s reason: a line primitive is one pixel
 * wide at every depth, and a floor with no perspective in its thickness is the
 * strongest cue a picture is flat.
 */
export const WORLD_RULE_STEP = 4
export const WORLD_RULE_SPAN = 24
export const WORLD_RULE_THICKNESS = 0.05

/**
 * The shares of the reach each surface is painted at.
 *
 * Unlit, and deliberately: a light would multiply a measured colour by a cosine
 * nobody measured. The faces are three shares of ONE mix instead — tops the
 * densest, as if lit from above, the sides less, the faces towards the eye least
 * — so the stones read as solids while every colour stays on the segment the
 * palette sampled.
 */
export const WORLD_SHADES = { top: 1, side: 0.72, face: 0.48, rule: 0.55, shape: 0.9 }

/** A deterministic hash to [0, 1): the same world in every render tab. */
function hash(n) {
  let h = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function clamp01(t) {
  const x = Number(t)
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0
}

/**
 * A flight's speed profile.
 *
 * Not `easeOutCubic`, and not a second notion of "an element arrives": this is a
 * camera leaving one place and reaching another, so it has to start from rest as
 * well as end at it. An ease-out camera leaves its station at full speed, which on
 * the first frame of a flight is a jump.
 */
function smoothstep(t) {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

/**
 * One flight per boundary between two scenes, on the film's own frame clock.
 *
 * @param {{scenes: Array<{from: number, durationInFrames: number, exitFrames?: number}>}} plan
 */
export function worldFlights(plan) {
  const scenes = Array.isArray(plan?.scenes) ? plan.scenes : []
  const flights = []
  for (let i = 0; i + 1 < scenes.length; i++) {
    const a = scenes[i]
    const b = scenes[i + 1]
    const shorter = Math.min(a.durationInFrames, b.durationInFrames)
    flights.push({
      centre: b.from + (Number(a.exitFrames) || 0) / 2,
      span: Math.max(1, Math.min(WORLD_FLIGHT_FRAMES, Math.floor(WORLD_FLIGHT_SHARE * shorter))),
    })
  }
  return flights
}

/** How far along the path the camera is at a frame of the FILM, in stations. */
export function worldTravel(flights, frame) {
  const g = Math.max(0, Number(frame) || 0)
  let u = (WORLD_CRUISE_PER_SECOND / FPS) * g
  for (const flight of flights) u += smoothstep((g - flight.centre) / flight.span + 0.5)
  return u
}

/** The path, as a point at a distance along it. */
export function worldPath(u) {
  return {
    x: WORLD_SWAY * Math.sin(u * 1.1),
    y: WORLD_EYE + 0.45 * Math.sin(u * 0.8 + 1),
    z: -u * WORLD_STATION_DEPTH,
  }
}

/** Where the camera is and what it looks at, at a frame of the film. */
export function worldCamera(flights, frame) {
  const u = worldTravel(flights, frame)
  const at = worldPath(u)
  const ahead = worldPath(u + WORLD_LOOK_AHEAD)
  return { travel: u, position: [at.x, at.y, at.z], target: [ahead.x, ahead.y - WORLD_LOOK_DOWN, ahead.z] }
}

/** The depth range the world has to cover for a film that travels this far. */
export function worldExtent(travel) {
  return { near: WORLD_BEHIND, far: -(Math.max(0, travel) + WORLD_LOOK_AHEAD) * WORLD_STATION_DEPTH - WORLD_AHEAD }
}

/**
 * The stones, either side of the corridor: the world's architecture.
 *
 * Laid out once per FILM from the furthest the camera ever gets, so every scene
 * and every render tab builds the same place.
 */
export function worldStones(travel) {
  const { near, far } = worldExtent(travel)
  const stones = []
  let k = 0
  for (let z = near; z > far; z -= WORLD_SLOT, k++) {
    const centre = worldPath(-z / WORLD_STATION_DEPTH).x
    for (const side of [-1, 1]) {
      const r = (i) => hash(k * 16 + (side > 0 ? 8 : 0) + i)
      if (r(0) < WORLD_EMPTY_SHARE) continue
      const width = 0.9 + r(1) * 2.2
      const depth = 0.9 + r(2) * 2.2
      const height = 1.4 + r(3) ** 2 * 11
      stones.push({
        x: centre + side * (WORLD_CORRIDOR + width / 2 + r(4) * 9),
        z: z - r(5) * WORLD_SLOT * 0.6,
        width,
        depth,
        height,
      })
    }
  }
  return stones
}

/** The shapes turning in the air above the corridor: what moves when the camera does not. */
export function worldShapes(travel) {
  const { near, far } = worldExtent(travel)
  const shapes = []
  let k = 0
  for (let z = near; z > far; z -= WORLD_SLOT * 2, k++) {
    const r = (i) => hash(100003 + k * 8 + i)
    if (r(0) < 0.45) continue
    const centre = worldPath(-z / WORLD_STATION_DEPTH).x
    shapes.push({
      x: centre + (r(1) * 2 - 1) * 7,
      y: 5 + r(2) * 5,
      z,
      size: 0.5 + r(3) * 1.2,
      phase: r(4) * Math.PI * 2,
      spin: 0.3 + r(5) * 0.5,
    })
  }
  return shapes
}

/** The floor's rules: rails running the corridor's length, rules across it. */
export function worldRules(travel) {
  const { near, far } = worldExtent(travel)
  const length = near - far
  const rails = []
  for (let x = -WORLD_RULE_SPAN; x <= WORLD_RULE_SPAN; x += WORLD_RULE_STEP) rails.push({ x, z: (near + far) / 2, length })
  const across = []
  for (let z = near; z > far; z -= WORLD_RULE_STEP) across.push({ z })
  return { rails, across, width: WORLD_RULE_SPAN * 2 }
}

/** A shape's turn at a frame of the film, in radians about two axes. */
export function shapeTurn(shape, frame) {
  const t = (Math.max(0, Number(frame) || 0) / FPS) * shape.spin
  return [shape.phase + t, shape.phase * 0.5 + t * 0.7, 0]
}

/**
 * The colours the world is painted in, or null when there is nothing to paint.
 *
 * Read off the palette's own `groundTint` — the far end of the ramp it measured —
 * and never off the theme, so the reach the renderer paints at is the reach the
 * palette cleared. Null when the tint yielded: the world was what made a line
 * illegible, and a world scene then is its bare ground, as a mesh scene is.
 */
export function worldColors(palette) {
  const tint = palette?.groundTint
  const layers = Array.isArray(tint) ? tint : []
  if (!layers.length) return null
  const far = layers[layers.length - 1]
  const ground = palette.ground.color
  const at = (share) => blend(far.color, ground, far.alpha * share)
  return {
    ground,
    reach: far.alpha,
    top: at(WORLD_SHADES.top),
    side: at(WORLD_SHADES.side),
    face: at(WORLD_SHADES.face),
    rule: at(WORLD_SHADES.rule),
    shape: at(WORLD_SHADES.shape),
  }
}
