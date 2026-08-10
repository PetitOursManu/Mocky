// The three fields drawn in volume, as arithmetic.
//
// Everything here is one of four claims, and each of them is a defect this
// feature has already shipped once somewhere else:
//
//   1. DETERMINISM. Two calls with the same arguments return the same bytes.
//      The export store is content-addressed, so a film that differs by a pixel
//      between two runs is two films on one disk budget — and a field is where
//      a `Math.random` gets written, because "scattered" is what a field is.
//   2. NOTHING HOLDS STILL. `solidSpin` learned it on a cube that turned through
//      a whole number of quarter-turns and rendered three byte-identical PNGs. A
//      field is worse: it is naturally periodic, and a period that divides a
//      scene is a loop somebody watching can count.
//   3. THE FIELD COVERS ITS FRUSTUM. A surface that does not is an object
//      floating in a void, which is the "small element in a large void" the
//      whole box rule was written against, arriving through a geometry.
//   4. THE COST IS BOUNDED. `FIELD_PIXEL_BUDGET` is a measurement and this is
//      where the arithmetic that spends it is held to it.
//
// It imports `server/video/timeline.js` for the enums the schema really offers,
// and that import is TEST-ONLY — exactly as it is in `blocks.test.js` and
// `validate.test.js`, for the same reason: the Docker build copies
// `worker/video/` and nothing else, so a runtime import of anything under
// `server/` produces a container that boots and then fails every render on a
// missing module.
import { SPRITE_AREA_GAIN, SPRITE_MARGIN } from './pointSprite.js'
import { describe, it, expect } from 'vitest'
import {
  FIELD_CAMERA,
  FIELD_CAMERA_FOV,
  FIELD_CAMERA_Z,
  FIELD_PIXEL_BUDGET,
  FIELD_VIEW,
  GRID_DEPTH,
  GRID_FORMS,
  GRID_LIFT,
  GRID_SPAN,
  GRID_TILT,
  GRID_TRAVELS,
  LIGHT_UNIT,
  PARTICLE_DEPTH,
  PARTICLE_DRIFTS,
  PARTICLE_RISE_SPAN,
  PARTICLE_DRAWN_MAX,
  PARTICLE_DRAWN_MIN,
  PARTICLE_SIZE_MAX,
  PARTICLE_SIZE_MIN,
  PARTICLE_SPREAD,
  WAVE_DEPTH,
  WAVE_MAX_RISE,
  WAVE_SEGMENTS_X,
  WAVE_SEGMENTS_Y,
  WAVE_SWELLS,
  WAVE_TILTS,
  WAVE_WIDTH,
  fieldCanvas,
  frustumHalfHeight,
  gridRules,
  gridSway,
  gridThickness,
  noise,
  particlePositions,
  particleSize,
  particleSpin,
  waveDisplace,
  waveHeight,
  waveTilt,
} from './field.js'
import { BLOCK_LIMITS, GRID_FORMS as SCHEMA_FORMS, GRID_TRAVELS as SCHEMA_TRAVELS, PARTICLE_DRIFTS as SCHEMA_DRIFTS, WAVE_SWELLS as SCHEMA_SWELLS, WAVE_TILTS as SCHEMA_TILTS } from '../../../../server/video/timeline.js'

/** The two frames a scene really has: `tests/video-motion.test.js` compares exactly these. */
const ENDS = [0, 1]

/**
 * Every consecutive pair of a real scene, and why the ends are not enough.
 *
 * `tests/video-motion.test.js` compares the first frame of a scene with its
 * last, which is the guarantee that catches a block that never moves. It does
 * not catch the one this family is most likely to produce: a term that moves at
 * both ends and STOPS in the middle — a sine at its own turning point, a drift
 * whose rate is zero for the frames a wrap takes, a floor whose rules land back
 * on the previous frame's stations. `solidSpin` shipped three byte-identical
 * PNGs out of one turning cube, and none of them was frame 0 or the last.
 *
 * A hundred and twenty lives is four seconds at 30 fps, which is the shortest
 * scene the schema accepts and therefore the coarsest step a real film takes.
 * A term that differs on every pair here differs on every pair of a longer one
 * too, because all three of these are continuous in `life`.
 */
const FRAMES = 120
const PAIRS = Array.from({ length: FRAMES - 1 }, (_, i) => [i / (FRAMES - 1), (i + 1) / (FRAMES - 1)])

/** The pair at which a sampler moved LEAST, so a failure names the frame. */
const stillest = (at) => {
  let worst = { distance: Infinity, pair: null }
  for (const [a, b] of PAIRS) {
    const x = at(a)
    const y = at(b)
    const distance = x.reduce((sum, value, i) => sum + Math.abs(value - y[i]), 0)
    if (distance < worst.distance) worst = { distance, pair: [a, b] }
  }
  return worst
}

describe('the hash', () => {
  it('answers the same value for the same pair, every time', () => {
    for (let i = 0; i < 50; i += 1) {
      for (let k = 0; k < 6; k += 1) expect(noise(i, k)).toBe(noise(i, k))
    }
  })

  it('stays inside the unit interval, including at the ends nothing else reaches', () => {
    for (const [i, k] of [[0, 0], [1, 1], [-4, 2], [1e6, 3], ['x', 'y'], [undefined, null]]) {
      const value = noise(i, k)
      expect(value, `${i}/${k}`).toBeGreaterThanOrEqual(0)
      expect(value, `${i}/${k}`).toBeLessThan(1)
    }
  })

  /**
   * A hash that is nearly constant is a field of particles piled on one point,
   * which renders as a bright dot and reads as a bug. Ten buckets over four
   * hundred draws is a coarse test on purpose: it refuses a collapse without
   * pretending to be a statistician.
   */
  it('spreads, so a field is a field and not a pile', () => {
    const buckets = new Array(10).fill(0)
    for (let i = 0; i < 400; i += 1) buckets[Math.floor(noise(i, 1) * 10)] += 1
    for (const count of buckets) expect(count).toBeGreaterThan(10)
  })

  /**
   * The one thing a hash may not be built out of. `Math.sin` is accurate to
   * within an ulp and WHICH ulp is the engine's business, so the usual
   * `fract(sin(i * 12.9898) * 43758.5453)` is a die whose faces depend on the
   * build of V8 the worker image happens to carry.
   */
  it('is integer arithmetic, so two engines agree to the bit', () => {
    expect(noise.toString()).not.toMatch(/Math\.(sin|cos|tan|random)/)
  })
})

describe('the canvas a field is drawn on', () => {
  const FRAMES = [
    ['16:9 full', { width: 1690, height: 950 }],
    ['9:16 full', { width: 950, height: 1690 }],
    ['1:1 full', { width: 1268, height: 1268 }],
    ['a band', { width: 1690, height: 470 }],
    ['a cell', { width: 560, height: 310 }],
    ['a strip', { width: 560, height: 118 }],
  ]

  it('never draws more pixels than the budget, in any ratio', () => {
    for (const [where, box] of FRAMES) {
      const canvas = fieldCanvas(box)
      // One pixel of rounding either way: the two sides are rounded
      // independently and a product of two roundings is not a rounded product.
      expect(canvas.width * canvas.height, where).toBeLessThanOrEqual(FIELD_PIXEL_BUDGET * 1.01)
    }
  })

  /**
   * The other half, and the one that keeps the budget from becoming a blur: a
   * box already under it is drawn at its own pixels. A field in a cell is sharp,
   * and only the ones that fill a frame pay anything.
   */
  it('draws a small box at its own pixels', () => {
    for (const box of [{ width: 560, height: 310 }, { width: 560, height: 118 }]) {
      const canvas = fieldCanvas(box)
      expect(canvas.width).toBe(box.width)
      expect(canvas.height).toBe(box.height)
      expect(canvas.scaleX).toBe(1)
      expect(canvas.scaleY).toBe(1)
    }
  })

  /**
   * The scales are what the composition paints with, and they have to land on
   * the box EXACTLY. A single rounded factor leaves a fraction of a pixel down
   * the right edge, which on a full-frame field is a hairline of the ground
   * across the whole height of the picture.
   */
  it('covers its box exactly, on both axes', () => {
    for (const [where, box] of FRAMES) {
      const canvas = fieldCanvas(box)
      expect(canvas.width * canvas.scaleX, where).toBeCloseTo(box.width, 9)
      expect(canvas.height * canvas.scaleY, where).toBeCloseTo(box.height, 9)
      expect(canvas.box, where).toEqual({ width: box.width, height: box.height })
    }
  })

  /** A degenerate box is a canvas of one pixel, never of zero: a GL context of no pixels fails to initialise and takes the frame with it (Q1). */
  it('answers for a box that is not one', () => {
    for (const box of [undefined, null, {}, { width: 0, height: 0 }, { width: -4, height: NaN }]) {
      const canvas = fieldCanvas(box)
      expect(canvas.width).toBeGreaterThanOrEqual(1)
      expect(canvas.height).toBeGreaterThanOrEqual(1)
    }
  })

  it('keeps the camera the two blocks that need a frustum were measured against', () => {
    expect(FIELD_CAMERA).toEqual({ position: [0, 0, FIELD_CAMERA_Z], fov: FIELD_CAMERA_FOV })
    expect(FIELD_VIEW).toBeCloseTo(FIELD_CAMERA_Z * Math.tan((FIELD_CAMERA_FOV / 2) * (Math.PI / 180)), 9)
    // `solidScene.jsx` has its own copy of this and the two are the same
    // renderer's unit: three divides a punctual light by pi since r155.
    expect(LIGHT_UNIT).toBe(Math.PI)
  })
})

describe('particleField', () => {
  const COUNTS = [BLOCK_LIMITS.particlesMin, 280, BLOCK_LIMITS.particles]

  it('returns the same bytes for the same call', () => {
    for (const drift of PARTICLE_DRIFTS) {
      for (const life of [0, 0.37, 1]) {
        const a = particlePositions(280, drift, life)
        const b = particlePositions(280, drift, life)
        expect(Array.from(a), `${drift} at ${life}`).toEqual(Array.from(b))
      }
    }
  })

  /** The buffer the component reuses. Filling it in place has to answer what a fresh one does. */
  it('fills a buffer it is handed exactly as it fills a new one', () => {
    const fresh = particlePositions(120, 'swarm', 0.4)
    const reused = particlePositions(120, 'swarm', 0)
    particlePositions(120, 'swarm', 0.4, reused)
    expect(Array.from(reused)).toEqual(Array.from(fresh))
    // A buffer of the wrong length is not half-written into: it is replaced.
    const wrong = new Float32Array(9)
    expect(particlePositions(120, 'swarm', 0.4, wrong)).not.toBe(wrong)
  })

  it('stays inside the world it declares, at every count and every frame', () => {
    for (const count of COUNTS) {
      for (const drift of PARTICLE_DRIFTS) {
        for (const life of [0, 0.25, 0.5, 0.75, 1]) {
          const at = particlePositions(count, drift, life)
          for (let i = 0; i < at.length; i += 3) {
            expect(Math.abs(at[i]), `${drift} x`).toBeLessThanOrEqual(PARTICLE_SPREAD)
            expect(Math.abs(at[i + 1]), `${drift} y`).toBeLessThanOrEqual(PARTICLE_RISE_SPAN)
            expect(Math.abs(at[i + 2]), `${drift} z`).toBeLessThanOrEqual(PARTICLE_DEPTH)
          }
        }
      }
    }
  })

  /**
   * The wrap has to happen OFF the frame, and this is the inequality that says
   * so. A particle walking upwards comes back by a modulo, and a modulo inside
   * the frustum is a speck teleporting through the middle of the picture — once
   * per particle per scene, on the drift a silent document gets.
   */
  it('wraps its rising dust outside what the camera can see', () => {
    // The nearest a particle can be is the front of the world; the frustum is
    // narrowest there, so the far side is what has to clear.
    expect(PARTICLE_RISE_SPAN / 2).toBeGreaterThan(frustumHalfHeight(-PARTICLE_DEPTH / 2))
  })

  it('moves between the first frame of a scene and its last, on every drift', () => {
    for (const drift of PARTICLE_DRIFTS) {
      const [first, last] = ENDS.map((life) => Array.from(particlePositions(240, drift, life)))
      expect(first, drift).not.toEqual(last)
      // And the whole cloud is somewhere else too, or somewhere else on purpose:
      // `swarm` keeps its place and moves inside itself, which is the one drift
      // whose spin is nearly still — so the positions above are what carries it.
      const spun = ENDS.map((life) => particleSpin(drift, life))
      expect(spun[0], drift).not.toBe(spun[1])
    }
  })

  /** And on every pair of frames in between, which the two ends cannot say. */
  it('is somewhere else on every frame of a scene, on every drift', () => {
    for (const drift of PARTICLE_DRIFTS) {
      const at = (life) => [...particlePositions(80, drift, life), particleSpin(drift, life)]
      const { distance, pair } = stillest(at)
      expect(distance, `${drift} held still between ${pair?.[0]} and ${pair?.[1]}`).toBeGreaterThan(0)
    }
  })

  /**
   * A spin of a whole number of turns is `solidSpin`'s bug: the last frame of a
   * scene is the first one over again, and on a cloud with no landmark in it
   * that is a scene in which nothing happened at all.
   */
  it('never turns through a whole number of turns', () => {
    for (const drift of PARTICLE_DRIFTS) {
      const turned = (particleSpin(drift, 1) - particleSpin(drift, 0)) / (Math.PI * 2)
      expect(Math.abs(turned - Math.round(turned)), drift).toBeGreaterThan(0.02)
    }
  })

  it('sizes a mote against the count, inside the two bounds', () => {
    let previous = Infinity
    for (const count of COUNTS) {
      const size = particleSize(count)
      expect(size).toBeLessThanOrEqual(PARTICLE_DRAWN_MAX)
      expect(size).toBeGreaterThanOrEqual(PARTICLE_DRAWN_MIN)
      // Denser is finer: it is what keeps the coverage roughly constant, and it
      // is what keeps the bitrate of the densest legal field affordable.
      expect(size, String(count)).toBeLessThan(previous)
      previous = size
    }
    expect(particleSize(0)).toBeLessThanOrEqual(PARTICLE_DRAWN_MAX)
  })

  /**
   * The bounds against the DRAWN dot, and the calibration against the square.
   *
   * `PARTICLE_SIZE_MIN`/`MAX` are what was measured when a point was a square,
   * and the round mask cost `pi/4` of that area. The pair the function clamps
   * against therefore has to be the gained one — clamped against the square's,
   * every count above the floor came back 21% lighter than the frame the range
   * was signed off on, which is a calibration silently spent on a shape change.
   */
  it('pays for the round mask in the bounds as well as in the value', () => {
    expect(PARTICLE_DRAWN_MAX / PARTICLE_SIZE_MAX).toBeCloseTo(SPRITE_AREA_GAIN, 12)
    expect(PARTICLE_DRAWN_MIN / PARTICLE_SIZE_MIN).toBeCloseTo(SPRITE_AREA_GAIN, 12)
    // A disc of this side covers what the square of the calibrated side did.
    const square = PARTICLE_SIZE_MAX
    const disc = PARTICLE_DRAWN_MAX * (1 - SPRITE_MARGIN)
    expect((Math.PI / 4) * disc * disc).toBeCloseTo(square * square, 12)
  })

  /** A name off a document is matched, never looked up: `drift: "constructor"` is a drift, not a function. */
  it('answers for a drift this build does not know', () => {
    const inherited = Array.from(particlePositions(40, 'constructor', 0.3))
    expect(inherited).toEqual(Array.from(particlePositions(40, 'rise', 0.3)))
    expect(Number.isFinite(particleSpin('__proto__', 0.5))).toBe(true)
  })
})

describe('waveMesh', () => {
  it('returns the same height for the same point, every time', () => {
    for (const swell of WAVE_SWELLS) {
      for (const [x, y] of [[0, 0], [3.1, -2.4], [-7, 4.5]]) {
        expect(waveHeight(x, y, swell, 0.4)).toBe(waveHeight(x, y, swell, 0.4))
      }
    }
  })

  it('displaces a plane in place and touches only its third component', () => {
    const flat = new Float32Array([1, 2, 0, -3, 4, 0])
    const out = waveDisplace(flat, 'swell', 0.5)
    expect(out).toBe(flat)
    expect(flat[0]).toBe(1)
    expect(flat[1]).toBe(2)
    expect(flat[2]).toBeCloseTo(waveHeight(1, 2, 'swell', 0.5), 5)
    expect(flat[5]).toBeCloseTo(waveHeight(-3, 4, 'swell', 0.5), 5)
    // Not a throw on an argument no document can produce and a test can (Q1).
    expect(waveDisplace(null, 'swell', 0.5)).toBe(null)
  })

  it('is somewhere else on the last frame of a scene than on the first, at every swell', () => {
    for (const swell of WAVE_SWELLS) {
      const sample = (life) =>
        [-6, -2, 0, 2, 6].flatMap((x) => [-4, 0, 4].map((y) => waveHeight(x, y, swell, life)))
      const [first, last] = ENDS.map(sample)
      expect(first, swell).not.toEqual(last)
      // And not merely different at one point: a wave whose crests happened to
      // land back where they started at three of fifteen samples is a wave that
      // reads as still.
      const moved = first.filter((h, i) => Math.abs(h - last[i]) > 0.01).length
      expect(moved, swell).toBeGreaterThan(first.length / 2)
    }
  })

  /**
   * And on every pair in between. A swell is a sum of sines, which is the one
   * shape that can be identical on two frames while differing at the ends — the
   * whole surface at a turning point of its own period.
   */
  it('is somewhere else on every frame of a scene, at every swell', () => {
    for (const swell of WAVE_SWELLS) {
      const at = (life) => [-8, -3, 0, 3, 8].flatMap((x) => [-6, -2, 2, 6].map((y) => waveHeight(x, y, swell, life)))
      const { distance, pair } = stillest(at)
      expect(distance, `${swell} held still between ${pair?.[0]} and ${pair?.[1]}`).toBeGreaterThan(0)
    }
  })

  /**
   * The coverage claim, which is what keeps the sheet a FIELD.
   *
   * A plane raked by `t` about the horizontal projects `DEPTH · cos t` of
   * vertical extent and reaches `±(DEPTH / 2) · sin t` in depth; the frustum is
   * widest at the far end. If the first is smaller than the second's height,
   * the sheet has a visible edge across the frame and the block is an object in
   * a void rather than a ground.
   */
  it('covers the frustum at every tilt, and stays behind the lens', () => {
    for (const tilt of WAVE_TILTS) {
      const t = Math.abs(waveTilt(tilt))
      const far = -(WAVE_DEPTH / 2) * Math.sin(t)
      const near = -far
      // The DISPLACED sheet and not the flat plane, which is what the first
      // rendered frame caught: a trough at the far edge drops it below the top
      // of the picture and opens a notch of the bare ground across the frame.
      // Twice the deepest rise, because a trough at one edge and a crest at the
      // other are the same failure from both ends.
      const covered = WAVE_DEPTH * Math.cos(t) - 2 * WAVE_MAX_RISE
      expect(covered, `${tilt} height`).toBeGreaterThan(2 * frustumHalfHeight(far))
      // 16:9 is the widest ratio a composed film is rendered in, so it is the
      // one the width has to clear; the other two are narrower at the same
      // vertical field of view.
      expect(WAVE_WIDTH - 2 * WAVE_MAX_RISE, `${tilt} width`).toBeGreaterThan(2 * frustumHalfHeight(far) * (16 / 9))
      // And the near edge stays behind the camera, with room: a sheet through
      // the lens is a frame of one enormous quad.
      expect(near + WAVE_MAX_RISE, `${tilt} near`).toBeLessThan(FIELD_CAMERA_Z - 1)
    }
  })

  /** The tilts and swells this file knows are the ones the schema offers, in both directions. */
  it('knows exactly the vocabulary the schema accepts', () => {
    expect([...WAVE_TILTS].sort()).toEqual([...SCHEMA_TILTS].sort())
    expect([...WAVE_SWELLS].sort()).toEqual([...SCHEMA_SWELLS].sort())
    expect(waveTilt('constructor')).toBe(waveTilt('rake'))
    // The vertex budget. Every one of these is rewritten on every frame and the
    // normals are recomputed from them, which is the CPU half of this block's
    // cost and the half `FIELD_PIXEL_BUDGET` does not touch. Two thousand-odd
    // quads is about six segments across the finest ripple in the enum; past
    // that the extra vertices buy a smoothness a moving lit surface hides.
    expect(WAVE_SEGMENTS_X * WAVE_SEGMENTS_Y).toBeLessThan(2500)
  })
})

describe('depthGrid', () => {
  const COUNTS = [BLOCK_LIMITS.gridLinesMin, 10, BLOCK_LIMITS.gridLines]

  it('lays out the same floor for the same frame, every time', () => {
    for (const travel of GRID_TRAVELS) {
      expect(gridRules(10, travel, 0.3)).toEqual(gridRules(10, travel, 0.3))
    }
  })

  it('draws two rules per line and keeps every one of them on the floor', () => {
    for (const lines of COUNTS) {
      for (const travel of GRID_TRAVELS) {
        for (const life of [0, 0.5, 1]) {
          const rules = gridRules(lines, travel, life)
          expect(rules.length, `${lines}/${travel}`).toBe(lines * 2)
          for (const rule of rules) {
            const bound = rule.axis === 'depth' ? GRID_SPAN / 2 : GRID_DEPTH / 2
            expect(Math.abs(rule.at), `${travel} ${rule.axis}`).toBeLessThanOrEqual(bound + 1e-9)
            // Between nothing and the accent, which is the pair the palette
            // measures for this field. Anything outside it is a surface nobody
            // sampled.
            expect(rule.opacity).toBeGreaterThan(0)
            expect(rule.opacity).toBeLessThanOrEqual(1)
          }
        }
      }
    }
  })

  /**
   * The whole floor, not one of its two halves. `sway` is the travel that does
   * not scroll at all — its motion is the swing — so a check that only compared
   * the rules would pass on two of the three and be vacuous on the one that
   * needed it. What a frame shows is both.
   */
  it('is somewhere else on the last frame than on the first, at every travel', () => {
    for (const travel of GRID_TRAVELS) {
      const floor = (life) => JSON.stringify([gridRules(12, travel, life), gridSway(travel, life)])
      expect(floor(ENDS[0]), travel).not.toBe(floor(ENDS[1]))
    }
  })

  /**
   * And on every pair in between, which for this block is the case with a
   * mechanism behind it rather than a precaution: a floor SCROLLS by wrapping,
   * so every rule that leaves one end reappears at the other. A wrap computed
   * against the wrong span puts the whole floor back on the previous frame's
   * stations once per cycle — a stutter the two ends of a scene cannot see, and
   * the reason the opacities are sampled here as well as the positions.
   */
  it('is somewhere else on every frame of a scene, at every travel', () => {
    for (const travel of GRID_TRAVELS) {
      const at = (life) => [
        ...gridRules(12, travel, life).flatMap((rule) => [rule.at ?? 0, rule.opacity ?? 0]),
        gridSway(travel, life),
      ]
      const { distance, pair } = stillest(at)
      expect(distance, `${travel} held still between ${pair?.[0]} and ${pair?.[1]}`).toBeGreaterThan(0)
    }
  })

  /**
   * `sway` is the travel with no advance at all, so the whole of its motion is
   * the swing — and a swing through a whole period is `solidSpin`'s `rock`
   * before it was fixed: pixel-identical on the first and last frame of a scene.
   */
  it('swings the one travel that does not scroll, and only that one', () => {
    expect(gridSway('sway', 0)).not.toBeCloseTo(gridSway('sway', 1), 3)
    for (const travel of ['toward', 'away']) expect(gridSway(travel, 0.4), travel).toBe(0)
  })

  /** A rule stays a rule: thinner as the floor gets denser, and never a slab. */
  it('thins its rules as the floor gets denser', () => {
    let previous = Infinity
    for (const lines of COUNTS) {
      const thickness = gridThickness(lines)
      expect(thickness, String(lines)).toBeLessThan(previous)
      expect(thickness).toBeLessThan(GRID_DEPTH / lines / 4)
      previous = thickness
    }
    expect(Number.isFinite(gridThickness(0))).toBe(true)
  })

  /**
   * The floor is below the eye and its rules are in front of the lens. Lifted
   * too little it is seen edge on and is a line across the frame; lifted too
   * much it leaves the frame entirely, and a `tunnel` becomes two empty bands.
   */
  it('puts its floor under the eye and inside the picture', () => {
    expect(GRID_LIFT).toBeGreaterThan(0)
    expect(GRID_LIFT).toBeLessThan(FIELD_VIEW)
    // Raked past a quarter turn: a floor, and not a wall with a pattern on it.
    expect(Math.abs(GRID_TILT)).toBeGreaterThan(Math.PI / 4)
    expect(Math.abs(GRID_TILT)).toBeLessThan(Math.PI / 2)
  })

  it('knows exactly the vocabulary the schema accepts', () => {
    expect([...GRID_FORMS].sort()).toEqual([...SCHEMA_FORMS].sort())
    expect([...GRID_TRAVELS].sort()).toEqual([...SCHEMA_TRAVELS].sort())
    expect([...PARTICLE_DRIFTS].sort()).toEqual([...SCHEMA_DRIFTS].sort())
  })
})
