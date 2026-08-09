// `gallery`, held to arithmetic — and to the panel's own report about sharpness.
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
  GALLERY_GAP,
  GALLERY_STAGGER,
  GALLERY_TILE_SCALE,
  GALLERY_TILE_TRAVEL,
  galleryGrid,
  galleryHeight,
  galleryTileHeight,
  galleryTileProgress,
  galleryTileTravel,
} from './gallery.jsx'

const LAYOUTS = ['grid', 'row', 'stack']
const COUNTS = Array.from(
  { length: BLOCK_LIMITS.galleryImages - BLOCK_LIMITS.galleryImagesMin + 1 },
  (_, i) => BLOCK_LIMITS.galleryImagesMin + i,
)

/** The widest a tile can ever be: an anchor of `full` gives the whole safe area. */
function widestTile(layout, count, ratio) {
  const frame = FRAME_DIMENSIONS[ratio]
  const safe = composedSafeArea(frame.width, frame.height)
  const base = frameBase(frame.width, frame.height)
  const { columns, rows } = galleryGrid(layout, count)
  const gap = Math.round(base * GALLERY_GAP)
  return {
    width: (safe.width - (columns - 1) * gap) / columns,
    height: galleryTileHeight(rows, base),
  }
}

describe('the grid a layout makes', () => {
  it('holds every picture the document listed, and no empty row', () => {
    for (const layout of LAYOUTS) {
      for (const count of COUNTS) {
        const { columns, rows } = galleryGrid(layout, count)
        expect(columns * rows, `${layout}/${count}`).toBeGreaterThanOrEqual(count)
        expect(rows, `${layout}/${count}`).toBe(Math.ceil(count / columns))
      }
    }
  })

  it('lays four pictures two by two rather than three and an orphan', () => {
    expect(galleryGrid('grid', 4)).toEqual({ columns: 2, rows: 2 })
  })

  /**
   * An unknown layout reads as `grid`, the schema's own default, for the reason
   * `anchorName` gives: the value was refused by `validate.js` long before a
   * frame, so reaching that branch means two lists disagree — and a gallery
   * drawn as a grid beats one that vanished from a film somebody waited for (Q1).
   */
  it('falls back to the schema’s default rather than to nothing', () => {
    for (const unknown of ['mosaic', undefined, 'constructor']) {
      expect(galleryGrid(unknown, 5), String(unknown)).toEqual(galleryGrid('grid', 5))
    }
  })
})

describe('a tile is not a frame, and the panel’s warning may only err one way', () => {
  /**
   * `src/lib/video/resolution.ts` reports how much a still is about to be
   * ENLARGED, before anybody spends two minutes rendering — and it measures
   * against the whole frame, because that is what four of the five monolithic
   * compositions paint. A gallery tile is a fraction of the measure, so the same
   * picture is enlarged less here than it would be full-bleed.
   *
   * That is the direction the warning is allowed to be wrong in, and this test
   * is what keeps it that way: a tile geometry that ever exceeded the frame's
   * own enlargement would make the panel UNDER-report exactly the films that got
   * worse — the silent failure `tests/video-frame-geometry.test.js` exists for,
   * arriving through a block instead of through a table.
   *
   * Measured at the widest a tile can be, which is an anchor of `full`: every
   * other zone is narrower, so the bound holds for all ten of them.
   */
  it('never enlarges a picture more than the same still full-bleed with its camera move', () => {
    for (const ratio of Object.keys(FRAME_DIMENSIONS)) {
      const frame = FRAME_DIMENSIONS[ratio]
      const source = SOURCE_DIMENSIONS[ratio]
      const bleeding = magnification(source, frame, KEN_BURNS_PEAK)
      for (const layout of LAYOUTS) {
        for (const count of COUNTS) {
          const tile = widestTile(layout, count, ratio)
          expect(magnification(source, tile, GALLERY_TILE_SCALE), `${ratio}/${layout}/${count}`).toBeLessThan(bleeding)
        }
      }
    }
  })

  /**
   * The grid the component actually sets is `rows` tracks of `galleryTileHeight`
   * plus its gutters, so this is a claim about the drawn box and not about a
   * number beside it — which is the failure a second copy of a geometry always
   * turns out to be.
   */
  it('keeps the whole grid inside the height it asks for', () => {
    for (const base of [1080, 1920]) {
      for (const rows of [1, 2, 3, 6]) {
        const gap = Math.round(base * GALLERY_GAP)
        const total = galleryTileHeight(rows, base) * rows + (rows - 1) * gap
        // Rounding a row up may cost a pixel per row and never more, which is
        // what `split` in `composition.js` already spends on the zones.
        expect(total, `${base}/${rows}`).toBeLessThanOrEqual(galleryHeight(base) + rows)
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
   * overscale leaves half of itself as margin on each side, and the travel
   * spends less than that — so every pixel visible at rest is visible on every
   * frame, which is the argument `OVERLAY_DRIFT_PERCENT` makes at frame scale.
   */
  it('never travels further than the overscale pays for', () => {
    const margin = ((GALLERY_TILE_SCALE - 1) / 2) * 100
    expect(GALLERY_TILE_TRAVEL).toBeLessThan(margin)
    for (const life of [0, 0.5, 1]) {
      expect(Math.abs(galleryTileTravel(0, life))).toBeLessThanOrEqual(GALLERY_TILE_TRAVEL)
    }
  })
})
