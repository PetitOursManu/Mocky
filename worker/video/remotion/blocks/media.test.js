// The four things the media family shares, held to arithmetic.
//
// Each of the five blocks is checked in its own file; what is here is the part
// none of them owns and all of them rest on. A `tracks` that did not tile its
// span exactly is a gallery whose last tile crosses the safe margin, a carousel
// whose strip runs out at the edge, and neither would be visible anywhere but in
// the finished mp4 — which is the whole reason this arithmetic lives in a `.js`
// file rather than inside a component nothing can load.
import { describe, it, expect } from 'vitest'
import {
  CONSTANT_CEILING,
  RUN_GAP,
  blockShape,
  constantMetric as sharedConstantMetric,
  solveTypeUnit,
  typeRole,
  typeSize,
} from '../composition.js'
import { ENTER_RISE, boxSize, constantMetric, enterRise, runBand, stackUnit, tileGutter, tracks } from './media.js'

const SPANS = [1688, 950, 906, 400, 137, 40]
const COUNTS = [1, 2, 3, 4, 5, 6, 8]

describe('tracks — a span divided so that the pieces put it back together', () => {
  /**
   * Exactly, and that is the claim: each EDGE is rounded rather than each size,
   * so the last track ends on `round(span)` whatever the arithmetic did in
   * between. Rounding sizes instead spends a pixel per track, and six of them
   * put the right-hand tile of a gallery past the edge of a box the safe area
   * had promised nothing crosses.
   */
  it('tiles its span with no pixel left over and none borrowed', () => {
    for (const span of SPANS) {
      for (const gap of [0, 13, 32]) {
        for (const count of COUNTS) {
          const out = tracks(span, gap, count)
          expect(out, `${span}/${gap}/${count}`).toHaveLength(count)
          expect(out[0].start).toBe(0)
          const last = out[out.length - 1]
          expect(last.start + last.size, `${span}/${gap}/${count}`).toBe(Math.round(span))
          for (let i = 1; i < out.length; i += 1) {
            // Consecutive, in order, and never overlapping: the gutter is the
            // whole of what sits between two of them.
            expect(out[i].start, `${span}/${gap}/${count}`).toBeGreaterThanOrEqual(out[i - 1].start + out[i - 1].size)
          }
        }
      }
    }
  })

  /**
   * A gutter wider than the room drops rather than inverting a track.
   *
   * Eight tiles of a gallery inside a 40 px band is not a document anybody
   * writes, and it is exactly the shape a stack of eight blocks in a crowded
   * zone can hand this function. A negative width in CSS is a grid with no tiles
   * at all, which is a hole in a frame; a grid with no gutters is a grid (Q1).
   */
  it('gives up its gutters rather than a track', () => {
    const out = tracks(40, 32, 6)
    expect(out).toHaveLength(6)
    for (const track of out) expect(track.size).toBeGreaterThanOrEqual(0)
    expect(out[out.length - 1].start + out[out.length - 1].size).toBe(40)
  })

  it('answers something usable for input it should never see', () => {
    expect(tracks(0, 0, 0)).toHaveLength(1)
    expect(tracks(NaN, NaN, NaN)[0]).toEqual({ start: 0, size: 0 })
  })
})

describe('constantMetric — the exception, and its ceiling', () => {
  /**
   * A hairline, a radius and a gutter are the three quantities `CONSTANT_METRICS`
   * lets a block read off the FRAME, because a viewer reads them as the same
   * object from one scene to the next. An exception with no ceiling is the rule
   * going back out of the window, so each is bounded at a quarter of its box: a
   * 12 px radius on a 20 px strip is not a rounded corner, it is a lozenge.
   */
  it('is the same number in two boxes, and thins inside a small one', () => {
    expect(constantMetric(13, { width: 1688, height: 950 })).toBe(13)
    expect(constantMetric(13, { width: 400, height: 300 })).toBe(13)
    expect(constantMetric(13, { width: 400, height: 20 })).toBe(Math.floor(20 * CONSTANT_CEILING))
    expect(constantMetric(-5, { width: 100, height: 100 })).toBe(0)
  })

  /**
   * And it is the HOUSE's, not this family's.
   *
   * There were three of these — here, in `interface.js` and in `dataFigures.js`
   * as `figureRadius` — written in parallel from one paragraph, agreeing on every
   * box anybody had thought about and disagreeing on the degenerate one: this
   * copy answered the requested size unbounded on a 0×0 box, and this file
   * asserted it, so a divergence nobody decided read as a decision somebody made.
   * The identity is the assertion, because two implementations that agree today
   * are the state the first divergence started from.
   */
  it('is the one implementation, and not this family’s copy of it', () => {
    expect(constantMetric).toBe(sharedConstantMetric)
    expect(constantMetric(13, { width: 0, height: 0 })).toBe(0)
  })

  /** And the tile gutter is one of them: one number for the gallery and the strip. */
  it('bounds the tile gutter by the box it is drawn in', () => {
    expect(tileGutter(1080, { width: 1688, height: 950 })).toBeGreaterThan(0)
    expect(tileGutter(1080, { width: 1688, height: 950 })).toBe(tileGutter(1080, { width: 400, height: 300 }))
    expect(tileGutter(1080, { width: 40, height: 12 })).toBeLessThanOrEqual(Math.floor(12 * CONSTANT_CEILING))
  })
})

describe('runBand — the runs come out of the box before the field does', () => {
  /**
   * The half of "inhabit your box" the field cannot do for itself. A caption's
   * height depends on how long the model's sentence turned out to be and on how
   * wide the zone turned out to be; the picture above it can only take what is
   * left. Measured here off the same estimate `shapeHeight` used to SIZE the box,
   * so the two agree — a component that guessed two lines where the layout had
   * budgeted three draws a picture through the bottom of its own box.
   */
  it('costs a block nothing when the run is absent', () => {
    for (const absent of [null, undefined, '', '   ']) {
      expect(runBand(absent, 'caption', 40, 900).band, String(absent)).toBe(0)
      expect(runBand(absent, 'caption', 40, 900).lines).toBe(0)
    }
  })

  it('reads the shared scale and never a size of its own', () => {
    for (const role of ['caption', 'body', 'title', 'display', 'figure']) {
      expect(runBand('Une ligne', role, 40, 900).size, role).toBe(typeSize(role, 40))
    }
  })

  it('grows with the number of lines, and carries the air above them', () => {
    const one = runBand('Court', 'caption', 40, 900)
    const many = runBand('x'.repeat(400), 'caption', 40, 900)
    expect(many.lines).toBeGreaterThan(one.lines)
    expect(many.band).toBeGreaterThan(one.band)
    expect(one.band).toBe(one.height + Math.round(RUN_GAP * 40))
    expect(one.height).toBe(Math.round(one.lines * one.size * typeRole('caption').leading))
  })

  /** A narrower measure is more lines, which is what makes a box decide a band. */
  it('takes more of a narrow box than of a wide one', () => {
    const text = 'Une légende assez longue pour se replier dans une colonne étroite'
    expect(runBand(text, 'caption', 40, 300).band).toBeGreaterThan(runBand(text, 'caption', 40, 1200).band)
  })

  /**
   * And a tracked run is measured tracked, which is the argument no block in this
   * family passes and the reason the parameter is here anyway: `BLOCK_APPETITE`
   * is the authority on what a run is, `kicker` is the row that declares a
   * tracking, and a family that grows one must measure it rather than add a
   * letter-spacing the layout never saw.
   */
  it('counts a tracking when it is given one', () => {
    // A hundred characters, because a line count is an integer: sixty of them
    // take three lines either way, and a claim about a staircase has to be made
    // at a tread it actually crosses.
    const text = 'x'.repeat(100)
    expect(runBand(text, 'caption', 40, 400, 0.2).lines).toBeGreaterThan(runBand(text, 'caption', 40, 400).lines)
  })
})

describe('stackUnit — the stack’s unit, or the box’s own', () => {
  /**
   * `composedLayout` publishes one unit per zone and the composition passes it,
   * which is the half of the type fix that stops a figure from crushing a title
   * beside it. The fallback is what `blockExtent` does in the same situation, and
   * it exists for the same reason: a block set at a plausible size beats a block
   * set at `NaN` px, which is a scene piled at the origin (Q1).
   */
  it('takes the unit it is given', () => {
    const block = { kind: 'gallery', imageIds: ['a', 'b'] }
    expect(stackUnit(block, { width: 900, height: 450 }, 37)).toBe(37)
  })

  it('solves the box alone when there is none, exactly as `blockExtent` does', () => {
    for (const kind of ['imageFrame', 'gallery', 'carousel', 'clock', 'dateStamp']) {
      const block = { kind, text: 'Mars 2026', caption: null, label: null, imageIds: ['a', 'b'] }
      const box = { width: 900, height: 450 }
      for (const absent of [undefined, null, 0, -1, NaN, 'big']) {
        expect(stackUnit(block, box, absent), `${kind}/${String(absent)}`).toBe(
          solveTypeUnit([blockShape(block)], box.width, box.height),
        )
      }
    }
  })
})

describe('enterRise — an arrival measured in type, not in frames', () => {
  /**
   * A travel of 22 px is a gesture under a full-frame gallery and a lurch under a
   * date stamp in a corner, which is the same defect as every other constant this
   * pass removed — one number for two boxes that have nothing in common. Half a
   * body line reads as an arrival at any size.
   */
  it('is proportional to the block’s own type, and gone once the block has landed', () => {
    expect(enterRise(40, 0)).toBe(ENTER_RISE * 40)
    expect(enterRise(80, 0)).toBe(2 * enterRise(40, 0))
    expect(enterRise(40, 1)).toBe(0)
    // Clamped by the arrival it is handed, never extrapolated past it.
    expect(enterRise(40, 2)).toBe(0)
    expect(enterRise(40, -1)).toBe(enterRise(40, 0))
    expect(enterRise(NaN, 0)).toBe(0)
  })
})

describe('boxSize — a box, whatever arrived', () => {
  it('never answers a negative dimension or a NaN', () => {
    for (const bad of [null, undefined, {}, { width: -10, height: 'x' }, { width: NaN, height: NaN }]) {
      const { width, height } = boxSize(bad)
      expect(Number.isInteger(width), String(bad)).toBe(true)
      expect(Number.isInteger(height), String(bad)).toBe(true)
      expect(width).toBeGreaterThanOrEqual(0)
      expect(height).toBeGreaterThanOrEqual(0)
    }
  })
})
