// The product stage, checked against the projection it is drawn under.
//
// ── What this file is for, and why it is longer than the module ──────────────
//
// Everything a flat block gets wrong is visible in one screenshot. Everything a
// 3D block gets wrong happens on frame two hundred and fourteen of an mp4 nobody
// watched to the end: a corner that leaves the frustum a third of the way through
// a turn, a panel that ends the scene on the pose it started it in, a ring whose
// panels intersect at one angle out of forty. None of that can be seen from the
// source and none of it can be reached from a browser here — Remotion and `three`
// are installed in `worker/video/package.json` and nowhere else.
//
// So the claims below are re-derived from the PROJECTION rather than taken from
// the module. `inside()` is written out from the definition of a perspective
// frustum and never calls `frustumScale`; if the two agree, they agree for a
// reason. That is the same arrangement `contrast.js` has with its own corpus and
// `timeline.test.js` with the schema mirror.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BACK_TURN,
  LIGHT_UNIT,
  PICTURE_LIFT,
  RING_CAMERA,
  RING_GAP,
  RING_TILT,
  RING_TURNS,
  STAGE_CAMERA,
  STAGE_ENTER_SCALE,
  STAGE_FRAMES,
  STAGE_LIGHT,
  STAGE_MARGIN,
  STAGE_MOVES,
  STAGE_PITCH,
  STAGE_SAMPLES,
  frustumScale,
  panelGeometry,
  photoRingCanvas,
  photoRingLayout,
  photoStageCanvas,
  photoStageLayout,
  pictureAspect,
  poseCorners,
  ringAngle,
  ringAspect,
  ringCanvas,
  ringPlacement,
  ringRadius,
  ringSlotAspect,
  fitInside,
  RING_PIXEL_BUDGET,
  RING_SLOT_MAX,
  RING_SLOT_MIN,
  stageAspect,
  stageCanvas,
  stageEnter,
  stageFrame,
  stageFrustumHeight,
  stageImages,
  stageMove,
  stagePoses,
  stageRotation,
} from './stage.js'

const here = path.dirname(fileURLToPath(import.meta.url))

/** The three ratios a film can be, as the shapes a block's box turns out to be. */
const BOXES = [
  ['16:9 whole', { width: 1690, height: 950 }],
  ['16:9 band', { width: 1690, height: 470 }],
  ['16:9 cell', { width: 560, height: 310 }],
  ['9:16 whole', { width: 907, height: 1305 }],
  ['9:16 band', { width: 907, height: 430 }],
  ['1:1 whole', { width: 950, height: 950 }],
  ['strip', { width: 560, height: 120 }],
]

/** Every shape a real picture arrives in, plus the two the library allows at its edges. */
const ASPECTS = [16 / 9, 4 / 3, 3 / 2, 1, 9 / 16, 3 / 4, 2 / 3, 1344 / 768, 768 / 1344]

const FRAMES = Object.keys(STAGE_FRAMES)
const MOVES = Object.keys(STAGE_MOVES)

/**
 * Is this point, already scaled, inside the frustum?
 *
 * Written out from the definition and not from `frustumScale`: the camera sits at
 * `(0, 0, d)` looking down −z, the frustum is `|y| ≤ (d − z)·tan θv` and
 * `|x| ≤ (d − z)·aspect·tan θv`, and a point behind the camera is outside
 * whatever its x and y are. A tolerance of a millionth absorbs the double
 * arithmetic and nothing else — the module's own margin is three per cent.
 */
function inside(point, aspect, camera, { sides = true } = {}) {
  const tv = Math.tan(((camera.fov / 2) * Math.PI) / 180)
  const d = camera.position[2]
  const [x, y, z] = point
  const depth = d - z
  if (depth <= 0) return false
  const eps = 1e-6
  if (Math.abs(y) > depth * tv + eps) return false
  return !sides || Math.abs(x) <= depth * tv * aspect + eps
}

/** The corners of a `photoStage` at one moment, in world units, already scaled. */
function stageCornersAt(layout, block, life, enter = 1) {
  const pose = stageRotation(block.move, life)
  const s = layout.scale * enter
  const half = { x: layout.body.x, y: layout.body.y, z: layout.faceZ }
  return poseCorners(half, pose).map(([x, y, z]) => [x * s, y * s, z * s])
}

/** The corners of one panel of a `photoRing` at one moment, already scaled. */
function ringCornersAt(layout, block, count, index, life, enter = 1) {
  const at = ringPlacement(count, index, life, block.direction, layout.radius)
  const s = layout.scale * enter
  const half = layout.bound
  return poseCorners(half, { yaw: at.yaw, at: at.position, tilt: RING_TILT }).map(([x, y, z]) => [x * s, y * s, z * s])
}

/** Forty-one poses is what the fit samples; a hundred and one is what the claim is checked on. */
const LIVES = Array.from({ length: 101 }, (_, i) => i / 100)

describe('the fit keeps a stage inside its own canvas', () => {
  /**
   * The claim the whole family rests on: at no moment of any move, in any box, at
   * any picture shape, does a corner of a panel leave the frustum.
   *
   * Checked at a hundred and one moments against a fit solved over forty-one, so
   * this really is asking whether the sampling was fine enough rather than
   * replaying the module's own arithmetic back at it.
   */
  it('never lets a corner leave the frustum, at any moment of any move', () => {
    const escapes = []
    for (const [label, box] of BOXES) {
      const aspect = stageAspect(box)
      for (const frame of FRAMES) {
        for (const move of MOVES) {
          const block = { frame, move }
          for (const picture of ASPECTS) {
            const layout = photoStageLayout(block, picture, aspect)
            for (const life of LIVES) {
              for (const corner of stageCornersAt(layout, block, life)) {
                if (!inside(corner, aspect, STAGE_CAMERA)) {
                  escapes.push(`${label} ${frame}/${move} picture=${picture.toFixed(2)} life=${life}`)
                }
              }
            }
          }
        }
      }
    }
    expect(escapes.slice(0, 5)).toEqual([])
  })

  /**
   * And the entrance cannot break it either, which is worth its own case: the
   * arrival only ever shrinks the panel, so a fit that held at full size holds at
   * every moment of it. A future entrance that overshot past one would be a
   * corner outside the frame for the first nine frames of a scene — the sort of
   * thing that reads as a glitch rather than as a mistake.
   */
  it('holds through the arrival, which may only shrink', () => {
    expect(STAGE_ENTER_SCALE).toBeLessThan(1)
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      expect(stageEnter(p)).toBeLessThanOrEqual(1)
      expect(stageEnter(p)).toBeGreaterThanOrEqual(STAGE_ENTER_SCALE)
    }
    const block = { frame: 'device', move: 'turn' }
    const aspect = stageAspect({ width: 1690, height: 950 })
    const layout = photoStageLayout(block, 16 / 9, aspect)
    for (const life of LIVES) {
      for (const corner of stageCornersAt(layout, block, life, stageEnter(0))) {
        expect(inside(corner, aspect, STAGE_CAMERA), `life=${life}`).toBe(true)
      }
    }
  })

  /**
   * A ring is allowed to run out of the frame at the SIDES and never at the top
   * or the bottom.
   *
   * That asymmetry is the whole reason `frustumScale` takes a fourth element per
   * point. A carousel that kept six panels inside a portrait canvas composes each
   * of them at a tenth of it — the small element in a large void — while a
   * picture cut along the top reads as a layout that overflowed. The flat
   * `carousel` block already makes exactly this trade with `overflow: hidden`.
   */
  it('keeps every ring panel off the top and the bottom, whatever the sides do', () => {
    const escapes = []
    for (const [label, box] of BOXES) {
      const aspect = stageAspect(box)
      const ring = ringAspect(box)
      for (const frame of FRAMES) {
        for (const direction of ['left', 'right']) {
          for (const count of [3, 4, 5, 6]) {
            const block = { frame, direction }
            const shapes = Array.from({ length: count }, (_, i) => ASPECTS[i % ASPECTS.length])
            const layout = photoRingLayout(block, shapes, ring)
            for (const life of LIVES) {
              for (let i = 0; i < count; i++) {
                for (const corner of ringCornersAt(layout, block, count, i, life)) {
                  if (!inside(corner, ring, RING_CAMERA, { sides: false })) {
                    escapes.push(`${label} ${frame}/${direction} n=${count} life=${life}`)
                  }
                }
              }
            }
          }
        }
      }
    }
    expect(escapes.slice(0, 5)).toEqual([])
  })

  /**
   * And the panel the eye is meant to read — the one at the front — is held on
   * all four sides.
   *
   * A carousel whose front picture is cut in half is not a carousel that runs off
   * the frame; it is a carousel with nothing to look at.
   */
  it('reads the front panel of a ring whole', () => {
    const escapes = []
    for (const [label, box] of BOXES) {
      const aspect = stageAspect(box)
      const ring = ringAspect(box)
      for (const count of [3, 4, 5, 6]) {
        const block = { frame: 'card', direction: 'left' }
        const shapes = Array(count).fill(16 / 9)
        const layout = photoRingLayout(block, shapes, ring)
        for (const life of LIVES) {
          // The front is the panel whose centre is nearest the camera, which is
          // the one the module holds. Its angle is within half a step of zero.
          let best = 0
          let bestCos = -2
          for (let i = 0; i < count; i++) {
            const c = Math.cos(ringAngle(count, i, life, block.direction))
            if (c > bestCos) {
              bestCos = c
              best = i
            }
          }
          for (const corner of ringCornersAt(layout, block, count, best, life)) {
            if (!inside(corner, ring, RING_CAMERA)) escapes.push(`${label} n=${count} life=${life}`)
          }
        }
      }
    }
    expect(escapes.slice(0, 5)).toEqual([])
  })
})

describe('a stage inhabits the box it is given', () => {
  /**
   * The rule at the top of `composition.js`, for a block whose box is a canvas:
   * double the box and the drawing doubles, exactly.
   *
   * The world-space fit depends on the box's SHAPE and not on its size, so the
   * whole of the growth is the canvas's — which is the property that makes a
   * scene naming four stages draw what one frame draws.
   */
  it('draws twice as large in a box twice the size, and identically in the same shape', () => {
    for (const frame of FRAMES) {
      for (const move of MOVES) {
        const block = { frame, move }
        const small = { width: 560, height: 310 }
        const large = { width: 1120, height: 620 }
        const a = photoStageLayout(block, 16 / 9, stageAspect(small))
        const b = photoStageLayout(block, 16 / 9, stageAspect(large))
        expect(b.scale, `${frame}/${move}`).toBeCloseTo(a.scale, 9)
        expect(stageCanvas(large).width / stageCanvas(small).width).toBeCloseTo(2, 9)
        expect(stageCanvas(large).height / stageCanvas(small).height).toBeCloseTo(2, 9)
      }
    }
  })

  /**
   * And it FILLS it. Half the reason this family costs a renderer is that the
   * picture is large; a panel composing at a third of its canvas would be the
   * void this feature spent a whole pass removing, arriving through a frustum.
   *
   * Half, and the worst case is named rather than tuned to: a card that TURNS
   * OVER sweeps its own width through the depth of the frame, and the room that
   * costs is why a flip composes smaller than an orbit. `RING_CAMERA`'s note is
   * the same trade taken the other way — a longer lens rather than a smaller
   * panel — and the reason the two blocks have two lenses.
   */
  it('fills at least half of its canvas on the axis its picture governs', () => {
    const height = stageFrustumHeight()
    const thin = []
    for (const [label, box] of BOXES) {
      const aspect = stageAspect(box)
      for (const frame of FRAMES) {
        for (const move of MOVES) {
          for (const picture of ASPECTS) {
            const layout = photoStageLayout({ frame, move }, picture, aspect)
            const fill = Math.max(
              (2 * layout.picture.y * layout.scale) / height,
              (2 * layout.picture.x * layout.scale) / (height * aspect),
            )
            if (fill < 0.5) thin.push(`${label} ${frame}/${move} ${picture.toFixed(2)} → ${fill.toFixed(3)}`)
          }
        }
      }
    }
    expect(thin.slice(0, 5)).toEqual([])
  })

  /**
   * A ring fills its canvas as a RING rather than as one picture, which is a
   * different sentence and the honest one: at six pictures the front one is a bit
   * over a third of the frame, and the other five are what the rest of the frame
   * is made of.
   */
  it('spans its canvas with the whole carousel', () => {
    const height = stageFrustumHeight(RING_CAMERA)
    const thin = []
    for (const [label, box] of BOXES) {
      const aspect = ringAspect(box)
      for (const count of [3, 4, 5, 6]) {
        for (const frame of FRAMES) {
          const layout = photoRingLayout({ frame, direction: 'left' }, Array(count).fill(16 / 9), aspect)
          const span = 2 * (layout.radius + layout.bound.x) * layout.scale
          const across = Math.max(span / (height * aspect), span / height)
          if (across < 0.9) thin.push(`${label} n=${count} ${frame} → ${across.toFixed(3)}`)
        }
      }
    }
    expect(thin.slice(0, 5)).toEqual([])
  })

  /**
   * THE CLAIM THIS FAMILY OWES `src/lib/video/resolution.ts`.
   *
   * A texture enlarged past its source is exactly as soft in three dimensions as
   * in two, and the panel here is drawn INSIDE a frustum whose height is the
   * canvas — so a stage can never magnify a picture more than the same picture
   * laid flat across the same box would. That is what makes the enlargement
   * notice the panel already shows the right notice for a film that uses these
   * blocks, without a second table.
   */
  it('never magnifies a source more than a flat block in the same box would', () => {
    const height = stageFrustumHeight()
    for (const [label, box] of BOXES) {
      const aspect = stageAspect(box)
      const canvas = stageCanvas(box)
      for (const frame of FRAMES) {
        for (const move of MOVES) {
          for (const picture of ASPECTS) {
            const layout = photoStageLayout({ frame, move }, picture, aspect)
            const drawnHeight = ((2 * layout.picture.y * layout.scale) / height) * canvas.height
            const drawnWidth = ((2 * layout.picture.x * layout.scale) / (height * aspect)) * canvas.width
            const where = `${label} ${frame}/${move} ${picture.toFixed(2)}`
            expect(drawnHeight, where).toBeLessThanOrEqual(canvas.height + 1e-6)
            expect(drawnWidth, where).toBeLessThanOrEqual(canvas.width + 1e-6)
          }
        }
      }
    }
  })

  /** The canvas is the box, rounded once — so the fit and the renderer solve the same rectangle. */
  it('reads its aspect through the same rounding the canvas was built with', () => {
    for (const [, box] of BOXES) {
      const canvas = stageCanvas(box)
      expect(stageAspect(box)).toBe(canvas.width / canvas.height)
      expect(canvas.width).toBe(Math.max(1, Math.round(box.width)))
      expect(canvas.height).toBe(Math.max(1, Math.round(box.height)))
    }
  })
})

describe('nothing on a stage holds still', () => {
  /**
   * The bug `solidSpin` is a long comment about, in a family where it is worse: a
   * flat panel on a whole turn is not merely identical at both ends, it spends
   * the middle of its scene edge-on, where a picture is a line.
   */
  it('ends every move somewhere it did not start', () => {
    for (const move of MOVES) {
      const first = stageRotation(move, 0)
      const last = stageRotation(move, 1)
      const moved = Math.abs(first.yaw - last.yaw) + Math.abs(first.pitch - last.pitch)
      expect(moved, move).toBeGreaterThan(0.05)
    }
  })

  /** And it differs at every step of the way, not only between the ends. */
  it('differs from one frame to the next, all the way through', () => {
    for (const move of MOVES) {
      for (let i = 1; i < LIVES.length; i++) {
        const a = stageRotation(move, LIVES[i - 1])
        const b = stageRotation(move, LIVES[i])
        expect(Math.abs(a.yaw - b.yaw) + Math.abs(a.pitch - b.pitch), `${move} @ ${LIVES[i]}`).toBeGreaterThan(0)
      }
    }
  })

  /**
   * No axis lands on a whole number of quarter turns, and no wave completes a
   * whole number of periods.
   *
   * The first is what made three frames of a cube byte-identical; the second is
   * what made a rocking solid identical at both ends of its scene. Both are
   * checked on the TOTAL travel rather than on the constants, so a future move
   * written as a sum of two waves is covered by the same case.
   */
  it('turns by no whole number of quarter turns', () => {
    const quarter = Math.PI / 2
    for (const move of MOVES) {
      const travel = Math.abs(stageRotation(move, 1).yaw - stageRotation(move, 0).yaw)
      const steps = travel / quarter
      expect(Math.abs(steps - Math.round(steps)), move).toBeGreaterThan(0.1)
    }
    // And the pitch, which every move carries on top of its own.
    expect(STAGE_PITCH).toBeGreaterThan(0)
    const pitchTravel = Math.abs(stageRotation('sway', 1).pitch - stageRotation('sway', 0).pitch)
    expect(pitchTravel).toBeGreaterThan(0)
  })

  /**
   * A ring has a trap of its own: `n` panels map the ring onto ITSELF every `1/n`
   * of a turn, so a rotation of a whole number of steps ends the scene on the
   * arrangement it began with.
   */
  it('never turns a ring by a whole number of its own steps', () => {
    for (const count of [3, 4, 5, 6]) {
      const steps = RING_TURNS * count
      expect(Math.abs(steps - Math.round(steps)), `n=${count}`).toBeGreaterThan(0.1)
    }
    for (const direction of ['left', 'right']) {
      for (const count of [3, 4, 5, 6]) {
        const first = ringAngle(count, 0, 0, direction)
        const last = ringAngle(count, 0, 1, direction)
        expect(Math.abs(first - last), `${direction} n=${count}`).toBeGreaterThan(0.1)
      }
    }
  })

  /** The two directions really are two directions, and neither is a standstill. */
  it('turns a ring the way the document asked', () => {
    const left = ringAngle(4, 0, 0.5, 'left')
    const right = ringAngle(4, 0, 0.5, 'right')
    expect(Math.sign(left)).toBe(-1)
    expect(Math.sign(right)).toBe(1)
  })
})

describe('a ring is a ring', () => {
  /**
   * Panels do not intersect, at any count and at any moment.
   *
   * The chord between two neighbours on a circle of radius `R` is `2R·sin(π/n)`,
   * and it has to hold one panel plus the gap. The answer changes by a factor of
   * two between three panels and six, so a radius tuned for six leaves three of
   * them overlapping their own centres — which reads as one torn photograph.
   */
  it('leaves room between two neighbours, at every count', () => {
    for (const count of [3, 4, 5, 6]) {
      for (const half of [0.4, 0.9, 1.2]) {
        const radius = ringRadius(count, half)
        const chord = 2 * radius * Math.sin(Math.PI / count)
        expect(chord, `n=${count} half=${half}`).toBeGreaterThanOrEqual(2 * half * (1 + RING_GAP) - 1e-9)
      }
    }
    expect(RING_GAP).toBeGreaterThan(0)
  })

  /**
   * ONE slot, and one outlier costs a margin rather than the whole block.
   *
   * The defect, on a rendered frame: a carousel of five screenshots in which one
   * was a 12:1 header banner asked for a ring nearly twice as wide as the others
   * needed, so the panel at the front stood a whole radius nearer the lens and the
   * fit shrank the entire carousel to a row of specks. Sized on the median it is
   * the banner that gets a margin.
   */
  it('builds every panel to one slot, chosen so an outlier costs nothing', () => {
    const aspect = stageAspect({ width: 1690, height: 950 })
    const even = photoRingLayout({ frame: 'plain' }, Array(5).fill(1.5), aspect)
    const outlier = photoRingLayout({ frame: 'plain' }, [1.5, 1.5, 1.5, 1.5, 12], aspect)
    expect(outlier.radius).toBeCloseTo(even.radius, 9)
    expect(outlier.scale).toBeCloseTo(even.scale, 9)
    // The banner is fitted inside the slot rather than cropped or stretched, and
    // its BODY hugs it rather than filling the slot — a rendered frame is why:
    // bodies built to the slot made the letterbox the block's own ornament, at
    // the size of the block.
    const slot = outlier.slot.picture
    const banner = outlier.panels[4]
    expect(banner.picture.x / banner.picture.y).toBeCloseTo(12, 6)
    expect(banner.picture.x).toBeLessThanOrEqual(slot.x + 1e-9)
    expect(banner.picture.y).toBeLessThanOrEqual(slot.y + 1e-9)
    expect(banner.body.y).toBeLessThan(outlier.slot.body.y)
    // And a picture of the slot's own shape fills it exactly.
    expect(outlier.panels[0].picture.x).toBeCloseTo(slot.x, 9)
    expect(outlier.panels[0].picture.y).toBeCloseTo(slot.y, 9)
    // Every panel is bounded by the slot, and the fit is solved on the box that
    // really holds them — which is what stops a ring of letterboxed banners from
    // being scaled as though each were a full card.
    for (const panel of outlier.panels) {
      expect(panel.body.x).toBeLessThanOrEqual(outlier.slot.body.x + 1e-9)
      expect(panel.body.y).toBeLessThanOrEqual(outlier.slot.body.y + 1e-9)
      expect(panel.body.x).toBeLessThanOrEqual(outlier.bound.x + 1e-9)
      expect(panel.body.y).toBeLessThanOrEqual(outlier.bound.y + 1e-9)
    }
    // Three banners are bounded by a banner, never by the slot they sit in.
    const banners = photoRingLayout({ frame: 'plain' }, [10, 10, 10], stageAspect({ width: 1690, height: 950 }))
    expect(banners.bound.y).toBeLessThan(banners.slot.body.y)
    // And the order they were written in cannot change what they compose at.
    const shuffled = photoRingLayout({ frame: 'plain' }, [12, 1.5, 1.5, 1.5, 1.5], aspect)
    const rotated = photoRingLayout({ frame: 'plain' }, [1.5, 1.5, 12, 1.5, 1.5], aspect)
    expect(shuffled.scale).toBeCloseTo(rotated.scale, 12)
    expect(shuffled.radius).toBeCloseTo(rotated.radius, 12)
  })

  /** The slot's shape is a median inside a band a carousel can hold. */
  it('clamps the slot into a band, so no ring is a row of columns or of ribbons', () => {
    expect(ringSlotAspect([12, 12, 12])).toBe(RING_SLOT_MAX)
    expect(ringSlotAspect([0.1, 0.1, 0.1])).toBe(RING_SLOT_MIN)
    expect(ringSlotAspect([1, 1.5, 2])).toBeCloseTo(1.5, 9)
    expect(ringSlotAspect([])).toBe(1)
    // Every picture keeps its own shape inside whatever slot it lands in.
    for (const aspect of ASPECTS) {
      const fitted = fitInside(aspect, { x: 0.75, y: 0.5 })
      expect(fitted.x / fitted.y, String(aspect)).toBeCloseTo(aspect, 6)
      expect(fitted.x).toBeLessThanOrEqual(0.75 + 1e-9)
      expect(fitted.y).toBeLessThanOrEqual(0.5 + 1e-9)
    }
  })

  /** Each panel faces outward, so the one at the front is square to the camera. */
  it('faces its panels outward', () => {
    const placement = ringPlacement(4, 0, 0, 'left', 3)
    expect(placement.yaw).toBeCloseTo(0, 9)
    expect(placement.position[2]).toBeCloseTo(3, 9)
    expect(placement.position[0]).toBeCloseTo(0, 9)
    const opposite = ringPlacement(4, 2, 0, 'left', 3)
    expect(opposite.position[2]).toBeCloseTo(-3, 9)
  })
})

describe('a panel is a panel', () => {
  /** The picture never reaches past the body it is mounted on, in any frame. */
  it('keeps the picture inside its own body', () => {
    for (const frame of FRAMES) {
      for (const aspect of ASPECTS) {
        const g = panelGeometry(aspect, frame)
        const where = `${frame} ${aspect.toFixed(2)}`
        expect(g.picture.x, where).toBeLessThanOrEqual(g.body.x)
        expect(g.offsetY + g.picture.y, where).toBeLessThanOrEqual(g.body.y + 1e-9)
        expect(g.offsetY - g.picture.y, where).toBeGreaterThanOrEqual(-g.body.y - 1e-9)
        // The picture's shape is the picture's, whatever the frame around it.
        expect(g.picture.x / g.picture.y, where).toBeCloseTo(aspect, 9)
      }
    }
  })

  /**
   * The picture sits PROUD of the body, or the two surfaces flicker against each
   * other in the depth buffer — the one artefact here that is deterministic and
   * still wrong to look at.
   */
  it('lays the picture just off the body', () => {
    expect(PICTURE_LIFT).toBeGreaterThan(0)
    for (const frame of FRAMES) {
      const g = panelGeometry(1.5, frame)
      expect(g.faceZ).toBeGreaterThan(g.body.z)
    }
  })

  /** A screen has a chin and a card does not: that asymmetry is what makes them two things. */
  it('gives a device a chin and nothing else one', () => {
    expect(STAGE_FRAMES.device.chin).toBeGreaterThan(0)
    expect(STAGE_FRAMES.plain.chin).toBe(0)
    expect(STAGE_FRAMES.card.chin).toBe(0)
    expect(panelGeometry(1.5, 'device').offsetY).toBeGreaterThan(0)
    expect(panelGeometry(1.5, 'card').offsetY).toBe(0)
    // And a mount shows more body than a bare panel does.
    expect(STAGE_FRAMES.card.border).toBeGreaterThan(STAGE_FRAMES.plain.border)
  })

  /** Half a turn is half a turn, and the `.jsx` does not get to write the number. */
  it('turns a back face all the way over', () => {
    expect(BACK_TURN).toBeCloseTo(Math.PI, 12)
  })
})

describe('what a stage refuses to answer with', () => {
  /**
   * A name off a document is MATCHED and never looked up. `Object.hasOwn` here for
   * the reason `blockComponent` spells out: a plain lookup answers for the
   * prototype chain, so `frame: "constructor"` hands back a function and the
   * multiplication two lines later is a panel of `NaN` units.
   */
  it('does not resolve a name it inherited from Object', () => {
    for (const name of ['constructor', '__proto__', 'toString', 'valueOf', undefined, 42, '']) {
      expect(stageFrame(name), String(name)).toBe(STAGE_FRAMES.card)
      expect(stageMove(name), String(name)).toBe(STAGE_MOVES.orbit)
    }
  })

  /** No input the layout can be handed produces a `NaN` — which is a scene piled at the origin (Q1). */
  it('answers a finite geometry for every degenerate input', () => {
    const degenerate = [undefined, null, {}, { width: 0, height: 0 }, { width: -5, height: 'no' }]
    for (const box of degenerate) {
      const canvas = stageCanvas(box, 1080)
      expect(Number.isFinite(canvas.width) && canvas.width > 0).toBe(true)
      expect(Number.isFinite(canvas.height) && canvas.height > 0).toBe(true)
      const layout = photoStageLayout({}, 0, stageAspect(box, 1080))
      expect(Number.isFinite(layout.scale) && layout.scale > 0).toBe(true)
      const ring = photoRingLayout({}, [], stageAspect(box, 1080))
      expect(Number.isFinite(ring.scale) && ring.scale > 0).toBe(true)
      expect(Number.isFinite(ring.radius)).toBe(true)
      expect(ring.panels).toEqual([])
    }
    // An empty point set is a stage with nothing in it, not a scale of Infinity.
    expect(frustumScale([], 1.78)).toBe(1)
  })

  /** A picture that could not be measured takes the canvas's shape rather than a guess. */
  it('falls back to the canvas when a texture reports no size', () => {
    expect(pictureAspect(undefined, 1.5)).toBe(1.5)
    expect(pictureAspect({ image: {} }, 1.5)).toBe(1.5)
    expect(pictureAspect({ image: { width: 0, height: 0 } }, 1.5)).toBe(1.5)
    expect(pictureAspect({ image: { naturalWidth: 1344, naturalHeight: 768 } }, 1.5)).toBeCloseTo(1344 / 768, 9)
    // An `ImageBitmap` reports `width`/`height` and no `natural*`; both are read.
    expect(pictureAspect({ image: { width: 800, height: 400 } }, 1.5)).toBeCloseTo(2, 9)
  })

  /** Only ids the schema's own `imageIds` carries — a third spelling is a picture nobody staged. */
  it('names only the pictures the document listed', () => {
    expect(stageImages({ imageIds: ['a', 'b'] })).toEqual(['a', 'b'])
    expect(stageImages({ imageIds: ['a', '', null, 7] })).toEqual(['a'])
    expect(stageImages({})).toEqual([])
    expect(stageImages(undefined)).toEqual([])
  })

  /** Two runs of one document are one film: nothing here reads a die or a clock. */
  it('answers the same thing twice', () => {
    const block = { frame: 'device', move: 'turn' }
    const a = photoStageLayout(block, 16 / 9, 1.78)
    const b = photoStageLayout(block, 16 / 9, 1.78)
    expect(a).toEqual(b)
    expect(stageRotation('orbit', 0.37)).toEqual(stageRotation('orbit', 0.37))
    expect(photoRingLayout({ frame: 'card' }, [1, 1.5, 2], 1.78)).toEqual(
      photoRingLayout({ frame: 'card' }, [1, 1.5, 2], 1.78),
    )
  })
})

describe('the two things this family shares with its neighbours', () => {
  /**
   * `LIGHT_UNIT` is the same π `solidScene.jsx` states, and it is written twice
   * rather than imported: it belongs to the RENDERER, `setPiece.js` is another
   * family's arithmetic and a `.jsx` is a component, so sharing it would couple
   * two block families for one constant.
   *
   * Held equal by reading the other file as TEXT, which is the arrangement
   * `contrast.js` and `timeline.js` both have with the things they mirror. A
   * value that drifted here would light a panel at a third of a solid's
   * brightness beside it, in a palette that measured neither.
   */
  it('lights a panel in the units a solid is lit in', () => {
    const source = fs.readFileSync(path.join(here, 'solidScene.jsx'), 'utf8')
    expect(source).toMatch(/const LIGHT_UNIT = Math\.PI/)
    expect(LIGHT_UNIT).toBe(Math.PI)
    // And the light is placed in FRONT of the subject, which is where it differs:
    // a panel square to the camera lit from 45° comes back black.
    expect(STAGE_LIGHT[2]).toBeGreaterThan(STAGE_LIGHT[0])
    expect(STAGE_LIGHT[2]).toBeGreaterThan(STAGE_LIGHT[1])
  })

  /** The descriptors `blocks/canvases.js` lists: the whole box, and a lens each. */
  it('opens a canvas the size of the block’s own box', () => {
    const box = { width: 640, height: 360 }
    const stage = photoStageCanvas({ frame: 'card' }, box, 1080)
    const ring = photoRingCanvas({ frame: 'plain' }, box, 1080)
    expect(stage).toEqual({ width: 640, height: 360, camera: STAGE_CAMERA })
    // A ring under its budget is its box exactly, painted back over itself.
    expect(ring).toEqual({
      width: 640,
      height: 360,
      camera: RING_CAMERA,
      stretch: true,
      frame: { width: 640, height: 360 },
    })
    // The ring's lens is the longer of the two, which is the whole reason there
    // are two: a carousel's front panel stands a ring radius nearer the camera.
    expect(RING_CAMERA.fov).toBeLessThan(STAGE_CAMERA.fov)
    // And both frustums are the same height, so the two blocks compose at one
    // scale in one scene.
    expect(stageFrustumHeight(RING_CAMERA)).toBeCloseTo(stageFrustumHeight(STAGE_CAMERA), 1)
  })

  /** The fit is sampled, and the margin is what covers the sampling. */
  it('samples an odd number of poses and keeps a margin under one', () => {
    expect(STAGE_SAMPLES % 2).toBe(1)
    expect(stagePoses('turn')).toHaveLength(STAGE_SAMPLES)
    expect(STAGE_MARGIN).toBeGreaterThan(0.9)
    expect(STAGE_MARGIN).toBeLessThan(1)
    // The middle sample is the middle of the move, which for a flip is edge-on —
    // its worst pose.
    const middle = stagePoses('turn')[(STAGE_SAMPLES - 1) / 2]
    expect(middle.yaw).toBeCloseTo(stageRotation('turn', 0.5).yaw, 12)
  })

  /**
   * The one block of this family that is bounded by a COST rather than by a
   * shape, and the budget only ever bites on the scene that measured over it.
   */
  it('draws a ring inside a pixel budget, and pays nothing under it', () => {
    for (const [label, box] of BOXES) {
      const drawn = ringCanvas(box)
      const where = `${label}`
      expect(drawn.width * drawn.height, where).toBeLessThanOrEqual(RING_PIXEL_BUDGET + 1)
      // Never larger than the box, and never a different shape from it.
      expect(drawn.width, where).toBeLessThanOrEqual(drawn.box.width)
      expect(drawn.height, where).toBeLessThanOrEqual(drawn.box.height)
      expect(drawn.width / drawn.height, where).toBeCloseTo(drawn.box.width / drawn.box.height, 1)
      expect(ringAspect(box)).toBe(drawn.width / drawn.height)
    }
    // A cell is far under the budget and is drawn at its own size, to the pixel.
    const cell = ringCanvas({ width: 560, height: 310 })
    expect(cell.width).toBe(560)
    expect(cell.height).toBe(310)
  })

  /** A ring leans towards the camera, and the lean never animates. */
  it('tilts a ring by a constant', () => {
    expect(RING_TILT).toBeGreaterThan(0)
    expect(RING_TILT).toBeLessThan(Math.PI / 8)
  })
})
