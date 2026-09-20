// `gallery`, held to arithmetic — to the box it was given, and to the panel's
// own report about sharpness.
//
// The imports of `server/video/timeline.js` and `src/lib/video/resolution.ts`
// are TEST-ONLY, exactly as in `blocks.test.js` and
// `tests/video-frame-geometry.test.js`: the Docker build copies `worker/video/`
// and nothing else, so a runtime import of either would produce a container that
// boots and then fails every render on a missing module. Reading the bounds off
// the schema rather than retyping them is the same discipline `compose.js`
// applies to its catalogue cards — a floor copied by hand drifts from the
// validator, and the drift is discovered too late to be cheap.
import { describe, it, expect } from 'vitest'
import { composedSafeArea, frameBase } from '../composition.js'
import { BLOCK_LIMITS } from '../../../../server/video/timeline.js'
import { FRAME_DIMENSIONS, KEN_BURNS_PEAK, SOURCE_DIMENSIONS, magnification } from '../../../../src/lib/video/resolution.ts'
import {
  GALLERY_STAGGER,
  GALLERY_TILE_SCALE,
  GALLERY_TILE_TRAVEL,
  galleryRows,
  galleryTileProgress,
  galleryTileTravel,
  galleryTiles,
  tileGutter,
} from './media.js'

const LAYOUTS = ['grid', 'row', 'stack']
const COUNTS = Array.from(
  { length: BLOCK_LIMITS.galleryImages - BLOCK_LIMITS.galleryImagesMin + 1 },
  (_, i) => BLOCK_LIMITS.galleryImagesMin + i,
)

/** The whole safe area of a ratio, which is what an anchor of `full` gives a gallery. */
function fullBox(ratio) {
  const frame = FRAME_DIMENSIONS[ratio]
  const safe = composedSafeArea(frame.width, frame.height)
  return { box: { left: 0, top: 0, width: safe.width, height: safe.height }, base: frameBase(frame.width, frame.height) }
}

/** The three shapes a zone turns out to be: the field, a band, a column. */
const SHAPES = Object.keys(FRAME_DIMENSIONS).flatMap((ratio) => {
  const { box, base } = fullBox(ratio)
  return [
    [`${ratio} full`, box, base],
    [`${ratio} band`, { ...box, height: Math.round(box.height / 3) }, base],
    [`${ratio} column`, { ...box, width: Math.round(box.width / 3) }, base],
  ]
})

describe('the grid follows the box, not only the count', () => {
  /**
   * The defect the user named in one sentence: three pictures in a wide band are
   * not three pictures in a column. The table this block used to carry answered
   * `columns = count <= 3 ? count : ...` and could not tell the two apart,
   * because it was never shown the box — so the same document drew a row in one
   * zone and three slivers in another.
   */
  it('lays a wide band as a row and a narrow column as a stack', () => {
    const band = { width: 1688, height: 300 }
    const column = { width: 400, height: 1305 }
    expect(galleryRows('grid', 3, band, 13)).toEqual([3])
    expect(galleryRows('grid', 3, column, 13)).toEqual([1, 1, 1])
  })

  it('lays four pictures two by two in a square box, and five as three and two', () => {
    expect(galleryRows('grid', 4, { width: 950, height: 950 }, 13)).toEqual([2, 2])
    expect(galleryRows('grid', 5, { width: 1688, height: 950 }, 13)).toEqual([3, 2])
  })

  /**
   * Balanced rather than filled greedily, which is what removes the orphan: five
   * pictures over two rows are three and two, never four and one, and no cell is
   * ever empty. A hole in a grid is the arrangement everybody reads as a mistake,
   * and the old table's `count === 4 ? 2 : 3` was a special case written for
   * exactly one of the five counts the schema allows.
   */
  it('holds every picture the document listed, in rows with no empty cell', () => {
    for (const layout of LAYOUTS) {
      for (const count of COUNTS) {
        for (const [where, box, base] of SHAPES) {
          const rows = galleryRows(layout, count, box, tileGutter(base, box))
          const at = `${layout}/${count} @ ${where}`
          expect(rows.reduce((sum, n) => sum + n, 0), at).toBe(count)
          for (const held of rows) expect(held, at).toBeGreaterThan(0)
          // Fuller rows first, consistently: a gallery that grows denser downwards
          // reads as a paragraph. Being consistent is what stops two scenes of one
          // film disagreeing.
          for (let i = 1; i < rows.length; i += 1) expect(rows[i - 1], at).toBeGreaterThanOrEqual(rows[i])
        }
      }
    }
  })

  /** `row` and `stack` are the document saying so, and they are honoured whatever the box. */
  it('honours an arrangement the document named', () => {
    for (const [, box, base] of SHAPES) {
      const gap = tileGutter(base, box)
      expect(galleryRows('row', 5, box, gap)).toEqual([5])
      expect(galleryRows('stack', 5, box, gap)).toEqual([1, 1, 1, 1, 1])
    }
  })

  /**
   * An unknown layout reads as `grid`, the schema's own default, for the reason
   * `anchorName` gives: the value was refused by `validate.js` long before a
   * frame, so reaching that branch means two lists disagree — and a gallery
   * drawn as a grid beats one that vanished from a film somebody waited for (Q1).
   */
  it('falls back to the schema’s default rather than to nothing', () => {
    const box = { width: 1688, height: 950 }
    for (const unknown of ['mosaic', undefined, 'constructor']) {
      expect(galleryRows(unknown, 5, box, 13), String(unknown)).toEqual(galleryRows('grid', 5, box, 13))
    }
  })
})

describe('the tiles inhabit the box', () => {
  /**
   * They tile it exactly: no pixel left over on either axis, and none borrowed.
   *
   * This is the whole of "a block fills the box it is given" for this block. What
   * was here before was a grid `GALLERY_BUDGET = 0.5` of the frame's short edge
   * tall, so a gallery handed the entire safe area drew itself across half of it
   * and left the rest black — the void six real exports came back as.
   */
  it('covers every pixel of it, in every layout, count and shape', () => {
    for (const layout of LAYOUTS) {
      for (const count of COUNTS) {
        for (const [where, box, base] of SHAPES) {
          const gap = tileGutter(base, box)
          const tiles = galleryTiles(layout, count, box, gap)
          const at = `${layout}/${count} @ ${where}`
          expect(tiles, at).toHaveLength(count)
          expect(Math.min(...tiles.map((t) => t.left)), at).toBe(0)
          expect(Math.min(...tiles.map((t) => t.top)), at).toBe(0)
          expect(Math.max(...tiles.map((t) => t.left + t.width)), at).toBe(box.width)
          expect(Math.max(...tiles.map((t) => t.top + t.height)), at).toBe(box.height)
          for (const tile of tiles) {
            expect(tile.width, at).toBeGreaterThan(0)
            expect(tile.height, at).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  /** Double the box, double the tiles — the property a fraction of the frame fails. */
  it('doubles what it draws when its box doubles', () => {
    for (const layout of LAYOUTS) {
      for (const count of COUNTS) {
        const one = galleryTiles(layout, count, { width: 800, height: 600 }, 0)
        const two = galleryTiles(layout, count, { width: 1600, height: 1200 }, 0)
        for (let i = 0; i < count; i += 1) {
          expect(two[i].width / one[i].width, `${layout}/${count}`).toBeCloseTo(2, 1)
          expect(two[i].height / one[i].height, `${layout}/${count}`).toBeCloseTo(2, 1)
        }
      }
    }
  })
})

describe('a tile is not a frame, and the panel’s warning may only err one way', () => {
  /**
   * `src/lib/video/resolution.ts` reports how much a still is about to be
   * ENLARGED, before anybody spends two minutes rendering — and it measures
   * against the whole frame, because that is what four of the five monolithic
   * compositions paint. A gallery tile is a share of the box, so the same picture
   * is enlarged less here than it would be full-bleed.
   *
   * That is the direction the warning is allowed to be wrong in, and this test is
   * what keeps it that way: a tile geometry that ever exceeded the frame's own
   * enlargement would make the panel UNDER-report exactly the films that got
   * worse — the silent failure `tests/video-frame-geometry.test.js` exists for,
   * arriving through a block instead of through a table.
   *
   * Measured at the widest a tile can be, which is an anchor of `full`: every
   * other zone is smaller, so the bound holds for all ten of them.
   */
  it('never enlarges a picture more than the same still full-bleed with its camera move', () => {
    for (const ratio of Object.keys(FRAME_DIMENSIONS)) {
      const frame = FRAME_DIMENSIONS[ratio]
      const source = SOURCE_DIMENSIONS[ratio]
      const bleeding = magnification(source, frame, KEN_BURNS_PEAK)
      const { box, base } = fullBox(ratio)
      for (const layout of LAYOUTS) {
        for (const count of COUNTS) {
          for (const tile of galleryTiles(layout, count, box, tileGutter(base, box))) {
            expect(magnification(source, tile, GALLERY_TILE_SCALE), `${ratio}/${layout}/${count}`).toBeLessThan(bleeding)
          }
        }
      }
    }
  })
})

describe('the cadence the tiles arrive on', () => {
  it('hands them out in order, and never puts one ahead of the one before it', () => {
    for (const count of COUNTS) {
      for (let step = 0; step <= 20; step++) {
        const at = step / 20
        for (let i = 1; i < count; i++) {
          expect(galleryTileProgress(i - 1, count, at)).toBeGreaterThanOrEqual(galleryTileProgress(i, count, at))
        }
      }
    }
  })

  /**
   * Every tile has landed by the time the block has, which is what keeps a
   * gallery one element of the stack's cascade rather than a cascade of its own.
   * `cueFrames` guarantees the block's own cue leaves `MIN_CUE_TAIL_FRAMES` of
   * scene after it; a tile arriving later than its block would spend that budget
   * a second time, and the last picture would land after the cut.
   */
  it('has landed every tile when the block has finished arriving', () => {
    for (const count of COUNTS) {
      for (let i = 0; i < count; i++) {
        expect(galleryTileProgress(i, count, 0), `${count}/${i}`).toBe(0)
        expect(galleryTileProgress(i, count, 1), `${count}/${i}`).toBe(1)
      }
    }
    expect(GALLERY_STAGGER).toBeLessThan(1)
  })
})

describe('nothing in a tile holds still', () => {
  /**
   * Per-frame, over the longest scene the composed variant accepts, because that
   * is where the step is smallest: a drift that rounded flat would show up there
   * first, and a picture that arrives and then sits is the reported defect
   * itself.
   */
  it('is somewhere else on every frame', () => {
    const FRAMES = 450
    for (const index of [0, 1, 5]) {
      const seen = new Set()
      for (let frame = 0; frame < FRAMES; frame++) seen.add(galleryTileTravel(index, frame / (FRAMES - 1)))
      expect(seen.size, `tile ${index}`).toBe(FRAMES)
    }
  })

  it('drifts the tiles apart rather than sliding the grid as one slab', () => {
    expect(galleryTileTravel(0, 0.25)).toBe(-galleryTileTravel(1, 0.25))
  })

  /**
   * The amplitude rule, and the one that keeps this from undoing `cover`: the
   * overscale leaves half of itself as margin on each side, and the travel spends
   * less than that — so every pixel visible at rest is visible on every frame,
   * which is the argument `OVERLAY_DRIFT_PERCENT` makes at frame scale.
   */
  it('never travels further than the overscale pays for', () => {
    const margin = ((GALLERY_TILE_SCALE - 1) / 2) * 100
    expect(GALLERY_TILE_TRAVEL).toBeLessThan(margin)
    for (const life of [0, 0.5, 1]) {
      expect(Math.abs(galleryTileTravel(0, life))).toBeLessThanOrEqual(GALLERY_TILE_TRAVEL)
    }
  })
})
