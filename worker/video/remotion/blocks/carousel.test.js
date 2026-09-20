// `carousel`, held to arithmetic.
//
// Three claims, and every one of them is about a frame nobody would watch for:
// the views are cut out of the BOX rather than out of the frame, the strip never
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
import { FPS, composedSafeArea, dimensionsFor, frameBase } from '../composition.js'
import { BLOCK_LIMITS, TEMPLATE_LIMITS } from '../../../../server/video/timeline.js'
import {
  CAROUSEL_LOOPS,
  CAROUSEL_MAX_VISIBLE,
  carouselCopies,
  carouselOffset,
  carouselView,
  tileGutter,
} from './media.js'

const LONGEST = Math.round((TEMPLATE_LIMITS.composed.maxSceneMs / 1000) * FPS)
const COUNTS = Array.from(
  { length: BLOCK_LIMITS.carouselImages - BLOCK_LIMITS.carouselImagesMin + 1 },
  (_, i) => BLOCK_LIMITS.carouselImagesMin + i,
)

/** The three shapes a zone turns out to be, in all three ratios. */
const SHAPES = ['16:9', '9:16', '1:1'].flatMap((ratio) => {
  const { width, height } = dimensionsFor(ratio)
  const safe = composedSafeArea(width, height)
  const base = frameBase(width, height)
  return [
    [`${ratio} full`, { width: safe.width, height: safe.height }, base],
    [`${ratio} band`, { width: safe.width, height: Math.round(safe.height / 3) }, base],
    [`${ratio} column`, { width: Math.round(safe.width / 3), height: safe.height }, base],
  ]
})

describe('the view comes out of the box', () => {
  /**
   * The defect, as arithmetic. A view used to be `0.3 × the frame's short edge`
   * across and `0.24` tall whatever box the block was handed, so a carousel
   * anchored `full` in a 16:9 frame drew a 259 px strip inside a zone 950 px
   * tall — a ribbon floating in a black field.
   */
  it('makes every view as tall as its box, and the views span the measure', () => {
    for (const [where, box, base] of SHAPES) {
      const gap = tileGutter(base, box)
      const view = carouselView(box, gap)
      expect(view.tile.height, where).toBe(box.height)
      expect(view.visible, where).toBeGreaterThanOrEqual(1)
      expect(view.visible, where).toBeLessThanOrEqual(CAROUSEL_MAX_VISIBLE)
      // The views and their gutters put the measure back together, to the pixel
      // `tracks` rounds with: a strip that fell short would show the ground
      // between two pictures, which is the seam the copies exist to remove.
      const spanned = view.visible * view.tile.width + (view.visible - 1) * gap
      expect(Math.abs(spanned - box.width), where).toBeLessThanOrEqual(view.visible)
      expect(view.stride, where).toBe(view.tile.width + gap)
    }
  })

  /** Double the box, double the view: the property a fraction of the frame fails. */
  it('doubles what it draws when its box doubles', () => {
    const one = carouselView({ width: 900, height: 500 }, 0)
    const two = carouselView({ width: 1800, height: 1000 }, 0)
    expect(two.visible).toBe(one.visible)
    expect(two.tile.width / one.tile.width).toBeCloseTo(2, 1)
    expect(two.tile.height / one.tile.height).toBeCloseTo(2, 1)
  })

  /**
   * A wide band shows more views than a portrait column, which is the whole of
   * "the step and the size come from the box": the same document is a filmstrip
   * in one zone and a single picture sliding in another, and neither of those is
   * a number this block was tuned for.
   */
  it('shows more views across a band than down a column', () => {
    const band = carouselView({ width: 1688, height: 300 }, 13)
    const column = carouselView({ width: 302, height: 1305 }, 13)
    expect(band.visible).toBeGreaterThan(column.visible)
    expect(column.visible).toBe(1)
  })

  it('answers something usable for a box it should never be given', () => {
    for (const bad of [null, { width: 0, height: 0 }, { width: NaN, height: NaN }]) {
      const view = carouselView(bad, 0)
      expect(view.visible, String(bad)).toBe(1)
      expect(view.tile.width, String(bad)).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(view.stride), String(bad)).toBe(true)
    }
  })
})

describe('the strip behind the window', () => {
  /**
   * The seam, as arithmetic.
   *
   * A loop is seamless because there is another copy of the same picture where
   * the first one was — never because anything jumps back to the start. That only
   * holds while the strip reaches past the far edge after it has travelled its
   * whole length, which is what this checks, at the widest window any box can
   * turn out to show.
   *
   * A gap arriving at the edge of a frame is a film showing its own machinery,
   * and it would appear once per export, in the last seconds of one scene.
   */
  it('always has another picture where the eye is about to look', () => {
    for (const count of COUNTS) {
      for (let visible = 1; visible <= CAROUSEL_MAX_VISIBLE; visible += 1) {
        expect(carouselCopies(count, visible) * count, `${count}/${visible}`).toBeGreaterThanOrEqual(
          count * CAROUSEL_LOOPS + visible + 1,
        )
      }
    }
  })

  it('never draws fewer than two copies, however many pictures there are', () => {
    for (const count of COUNTS) expect(carouselCopies(count, 1)).toBeGreaterThanOrEqual(2)
  })

  /**
   * And the strip really does cover the window at both ends of the travel, in
   * pixels rather than in tiles: the left edge never uncovers the ground and the
   * right edge is always still behind another picture. Computed from the same
   * three functions the component calls, so a window widened in one of them
   * cannot leave the other two behind.
   */
  it('covers the box at every point of the scene, in every shape a zone can be', () => {
    for (const [where, box, base] of SHAPES) {
      const gap = tileGutter(base, box)
      const view = carouselView(box, gap)
      for (const count of COUNTS) {
        const tiles = carouselCopies(count, view.visible) * count
        for (const direction of ['left', 'right']) {
          for (let step = 0; step <= 20; step += 1) {
            const left = carouselOffset(direction, count, step / 20) * view.stride
            const at = `${where} ${direction}/${count}@${step}`
            expect(left, at).toBeLessThanOrEqual(0)
            expect(left + tiles * view.stride - gap, at).toBeGreaterThanOrEqual(box.width)
          }
        }
      }
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
