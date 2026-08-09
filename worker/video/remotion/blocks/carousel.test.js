// `carousel`, held to arithmetic.
//
// Two claims, and both are about a frame nobody would watch for: the strip never
// runs out where the eye is about to look, and the track is somewhere else on
// every frame of the longest scene the schema accepts.
//
// The import of `server/video/timeline.js` is TEST-ONLY, exactly as in
// `blocks.test.js`: the Docker build copies `worker/video/` and nothing else, so
// a runtime import of anything under `server/` produces a container that boots
// and then fails every render on a missing module. The bounds are read off the
// schema rather than retyped, so a picture count widened there is swept here
// without anybody remembering to.
import { describe, it, expect } from 'vitest'
import { FPS } from '../composition.js'
import { BLOCK_LIMITS, TEMPLATE_LIMITS } from '../../../../server/video/timeline.js'
import {
  CAROUSEL_GAP,
  CAROUSEL_LOOPS,
  CAROUSEL_TILE,
  CAROUSEL_WINDOW,
  carouselCopies,
  carouselOffset,
  carouselStride,
} from './carousel.jsx'

const LONGEST = Math.round((TEMPLATE_LIMITS.composed.maxSceneMs / 1000) * FPS)
const COUNTS = Array.from(
  { length: BLOCK_LIMITS.carouselImages - BLOCK_LIMITS.carouselImagesMin + 1 },
  (_, i) => BLOCK_LIMITS.carouselImagesMin + i,
)

describe('the strip behind the window', () => {
  /**
   * The seam, as arithmetic.
   *
   * A loop is seamless because there is another copy of the same picture where
   * the first one was — never because anything jumps back to the start. That
   * only holds while the strip reaches past the right-hand edge after it has
   * travelled its whole length, which is what this checks: enough tiles for the
   * travel plus the widest window a frame can show.
   *
   * A gap arriving at the edge of a frame is a film showing its own machinery,
   * and it would appear once per export, in the last seconds of one scene.
   */
  it('always has another picture where the eye is about to look', () => {
    for (const count of COUNTS) {
      expect(carouselCopies(count) * count, `${count} pictures`).toBeGreaterThanOrEqual(
        count * CAROUSEL_LOOPS + CAROUSEL_WINDOW,
      )
    }
  })

  it('never draws fewer than two copies, however many pictures there are', () => {
    for (const count of COUNTS) expect(carouselCopies(count)).toBeGreaterThanOrEqual(2)
  })

  it('steps by one tile and one gutter', () => {
    for (const base of [1080, 1920]) {
      expect(carouselStride(base)).toBe(Math.round(base * CAROUSEL_TILE) + Math.round(base * CAROUSEL_GAP))
      expect(carouselStride(base)).toBeGreaterThan(0)
    }
  })
})

describe('the track', () => {
  /**
   * Per-frame over the longest scene, where the step is smallest.
   *
   * The offset is deliberately NOT wrapped, and this is the test that says why:
   * a modulo would put one frame per loop exactly where an earlier one was, and
   * that frame is the whole of what "nothing holds still" is about. The seam is
   * paid for in copies instead, which is a `div` rather than a stutter.
   */
  it('is somewhere else on every frame, in both directions', () => {
    for (const direction of ['left', 'right']) {
      for (const count of [BLOCK_LIMITS.carouselImagesMin, BLOCK_LIMITS.carouselImages]) {
        const seen = new Set()
        for (let frame = 0; frame < LONGEST; frame++) {
          seen.add(carouselOffset(direction, count, frame / (LONGEST - 1)))
        }
        expect(seen.size, `${direction}/${count}`).toBe(LONGEST)
      }
    }
  })

  it('travels one whole length over the scene, whatever the scene is', () => {
    for (const count of COUNTS) {
      expect(carouselOffset('left', count, 0) - carouselOffset('left', count, 1)).toBeCloseTo(count * CAROUSEL_LOOPS, 10)
      expect(carouselOffset('right', count, 1) - carouselOffset('right', count, 0)).toBeCloseTo(count * CAROUSEL_LOOPS, 10)
    }
  })

  /**
   * And it stays behind its own window at both ends: the strip is never
   * translated so far right that its first tile leaves the left edge uncovered,
   * which is the same failure as running out on the right and looks identical.
   */
  it('never uncovers the edge it started from', () => {
    for (const direction of ['left', 'right']) {
      for (const count of COUNTS) {
        for (let step = 0; step <= 20; step++) {
          const offset = carouselOffset(direction, count, step / 20)
          expect(offset, `${direction}/${count}`).toBeLessThanOrEqual(0)
          expect(offset, `${direction}/${count}`).toBeGreaterThanOrEqual(-count * CAROUSEL_LOOPS)
        }
      }
    }
  })

  it('starts where the document asked it to', () => {
    // `left` opens on the first picture and carries it away; `right` opens a
    // whole length back, so pictures arrive from off-frame rather than
    // uncovering the ground behind them.
    // `toBeCloseTo` rather than `toBe`, because zero times a direction is the
    // negative zero JavaScript keeps and `Object.is` distinguishes — a
    // difference no transform has ever rendered.
    expect(carouselOffset('left', 4, 0)).toBeCloseTo(0, 10)
    expect(carouselOffset('right', 4, 0)).toBeCloseTo(-4 * CAROUSEL_LOOPS, 10)
  })
})
