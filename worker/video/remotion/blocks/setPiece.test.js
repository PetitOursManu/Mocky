// The arithmetic of the three blocks that were added after a dependency was
// measured, and the three claims worth having as tests rather than as prose:
// nothing any of them draws holds still, nothing any of them draws leaves the box
// it was given, and each of them FILLS that box.
//
// The third one is the pass this file was rewritten for. All three used to size
// themselves on `base`, the frame's short edge — a title at 8.8% of it, a listing
// at 3%, a canvas clamped at it — so a block given a third of a column and a block
// given the whole safe area drew the same thing, and every scene came out as a
// small element floating in a large void.
import { describe, it, expect } from 'vitest'
import {
  CODE_CARET,
  SOLID_BOUND,
  SOLID_CAMERA_FOV,
  SOLID_CAMERA_Z,
  SOLID_ENTER_SCALE,
  bounceLift,
  codeCaret,
  codeMetrics,
  codeReveal,
  funTitleAccentFrom,
  funTitleGlyphs,
  funTitleHeadroom,
  funTitleLetter,
  funTitleShadow,
  funTitleSize,
  STACK_SEPARATION,
  letterAt,
  panelRadius,
  solidBoundingRadius,
  solidCanvas,
  solidGeometry,
  solidScale,
  solidSpin,
} from './setPiece.js'
// The shared scale and the shared appetite table: what these three blocks draw
// has to be the same arithmetic the layout divided their zone by.
import {
  BOX_FILL_FLOOR,
  CONSTANT_CEILING,
  CONTRAST_MIN_LARGE,
  DECLARED_SHARE,
  blockHeight,
  blockShape,
  contrastRatio,
  shapeCeiling,
  solveTypeUnit,
  typeSize,
} from '../composition.js'
import { FUN_TITLE_TREATMENTS, SOLIDS, SPINS, BLOCK_LIMITS } from '../../../../server/video/timeline.js'

const BASE = 1080

/** Boxes a block really gets: a whole safe area, a portrait one, a third of a column. */
const BOXES = [
  { width: 1690, height: 950 },
  { width: 907, height: 1300 },
  { width: 540, height: 300 },
]

/** The type units a stack really solves, across those boxes. */
const UNITS = [12, 24, 48, 120, 300]

describe('funTitle — the size comes from the box', () => {
  /**
   * The `display` step of the one shared scale, and not a fraction of its own.
   *
   * `FUN_TITLE_SIZE = 0.088` of the short edge was the second defect the six
   * exports showed, in its purest form: a `funTitle` beside a `heading` was two
   * fractions of a frame decided by two authors, so the two came out at sizes
   * that had never been compared. One step of one scale cannot do that.
   */
  it('sets its line at the display step of the unit its stack agreed on', () => {
    for (const unit of UNITS) {
      // Capped by the shape's own measure, which is what `typeScale` spends and
      // what every other block in the catalogue spends. `Motion` is one word, so
      // past 472 px the only way its six letters fit a 1690 px box is a break
      // inside the word — the defect a rendered frame showed as `NEUF S` /
      // `EIZIEME` / `S`. The claim this test is about is unchanged: ONE step of
      // ONE scale, never a fraction of its own.
      const spent = Math.min(unit, shapeCeiling(blockShape({ kind: 'funTitle', text: 'Motion' }), BOXES[0].width))
      expect(funTitleSize('Motion', BOXES[0], unit), `unit ${unit}`).toBe(typeSize('display', spent))
    }
    // And under the measure's own ceiling — which is where a stack normally is —
    // it is the unit it was handed, exactly.
    expect(funTitleSize('Motion', BOXES[0], 24)).toBe(typeSize('display', 24))
  })

  /**
   * And with no stack to read — a block solved alone in its box — the box is what
   * answers: a longer line wraps more, so it lands smaller. That is the ramp the
   * old `FUN_TITLE_COMFORT` was approximating, measured instead of drawn by hand.
   */
  it('lands smaller for a longer line, and larger in a larger box', () => {
    const small = { width: 500, height: 300 }
    const large = { width: 1000, height: 600 }
    expect(funTitleSize('x'.repeat(BLOCK_LIMITS.funTitle), small)).toBeLessThan(funTitleSize('Motion', small))
    expect(funTitleSize('Motion', large)).toBeGreaterThan(funTitleSize('Motion', small))
  })

  it('never sets a line wider than the box it was given', () => {
    for (const box of BOXES) {
      const size = funTitleSize('x'.repeat(BLOCK_LIMITS.funTitle), box)
      // Every glyph on one line at that size would be the widest a title can be;
      // it is allowed to wrap, but it may not need a measure the box has not got.
      expect(size, `${box.width}x${box.height}`).toBeLessThanOrEqual(box.height)
      expect(size).toBeGreaterThan(0)
    }
  })
})

describe('funTitle — the letters, on one baseline', () => {
  it('gives the first letter the whole arrival and the last one the tail', () => {
    expect(letterAt(6, 0, 0)).toBe(0)
    expect(letterAt(6, 0, 1)).toBe(1)
    expect(letterAt(6, 5, 0.2)).toBeLessThan(letterAt(6, 0, 0.2))
    expect(letterAt(6, 5, 1)).toBe(1)
  })

  it('keeps the spaces, so a treatment does not close a word gap it was not asked to', () => {
    expect(funTitleGlyphs('deux mots')).toHaveLength(9)
    expect(funTitleGlyphs('deux mots')[4]).toBe(' ')
  })

  /**
   * ── The defect this block was named for ────────────────────────────────────
   *
   * `bounce` is the DEFAULT treatment — what a silent document gets — and it was
   * a sine of the scene's clock phase-shifted by the letter's index. A sine is
   * never zero for two letters at once, so once the line had arrived every letter
   * sat parked at its own height: the word was permanently crooked, on every
   * frame, which reads as a broken render rather than as a bounce.
   *
   * A hop is what a bounce is. Four of the five treatments leave every letter at
   * exactly 0 once it has arrived; `bounce` leaves it at 0 except where the wave
   * is passing, and `arc` is the one exception because a curve is its content.
   */
  it('leaves the word straight at rest, on the four treatments that are not the arc', () => {
    const size = 96
    for (const treatment of FUN_TITLE_TREATMENTS.filter((t) => t !== 'arc' && t !== 'bounce')) {
      for (const life of [0, 0.13, 0.5, 0.77, 1]) {
        for (let i = 0; i < 12; i += 1) {
          // `Math.abs`, because a rise of `-(1 - 1) * size` is negative zero:
          // the same pixel, and not the same value to `Object.is`.
          expect(Math.abs(funTitleLetter(treatment, 12, i, 1, life, size).rise), `${treatment}[${i}] @ ${life}`).toBe(0)
          expect(funTitleLetter(treatment, 12, i, 1, life, size).turn).toBe(0)
        }
      }
    }
  })

  it('brings every bounced letter back onto that same baseline', () => {
    for (let i = 0; i < 12; i += 1) {
      const lifts = Array.from({ length: 200 }, (_, f) => bounceLift(i, f / 199))
      // It lands: the letter is on the baseline for most of the scene, and the
      // old sine was on it for exactly two instants of each period.
      expect(lifts.filter((l) => l === 0).length, `letter ${i}`).toBeGreaterThan(100)
      expect(Math.max(...lifts)).toBeGreaterThan(0.9)
      expect(Math.min(...lifts)).toBe(0)
      // A letter at rest is at rest: no rise where there is no hop.
      for (const [f, lift] of lifts.entries()) {
        if (lift === 0) {
          expect(Math.abs(funTitleLetter('bounce', 12, i, 1, f / 199, 96).rise), `letter ${i} @ ${f}`).toBe(0)
        }
      }
    }
  })

  it('passes the hop along the line rather than lifting every letter at once', () => {
    // At any instant the wave is on part of the word, never on all of it — which
    // is the difference between a bounce and a line that jumps.
    for (const life of [0.05, 0.2, 0.45, 0.6, 0.9]) {
      const lifted = Array.from({ length: 24 }, (_, i) => bounceLift(i, life)).filter((l) => l > 0)
      expect(lifted.length, `life ${life}`).toBeLessThan(24)
    }
  })

  /**
   * The claim `tests/video-motion.test.js` makes for a scene, made here for the
   * one block whose whole point is the letters: on every treatment, and on a
   * document that filled in nothing optional, the frame at the end of the scene
   * differs from the frame at its start.
   */
  it('moves, on every treatment, between the first frame and the last', () => {
    const size = funTitleSize('Un titre', BOXES[0], 40)
    const count = funTitleGlyphs('Un titre').length
    for (const treatment of FUN_TITLE_TREATMENTS) {
      const first = Array.from({ length: count }, (_, i) => funTitleLetter(treatment, count, i, 0, 0, size))
      const last = Array.from({ length: count }, (_, i) => funTitleLetter(treatment, count, i, 1, 1, size))
      expect(JSON.stringify(last), treatment).not.toBe(JSON.stringify(first))
    }
  })

  /** And `bounce` keeps moving after it has arrived, which is the whole of `life`. */
  it('keeps the default treatment alive once every letter has landed', () => {
    const still = new Set(
      Array.from({ length: 60 }, (_, f) =>
        JSON.stringify(Array.from({ length: 10 }, (_, i) => funTitleLetter('bounce', 10, i, 1, f / 59, 96).rise)),
      ),
    )
    expect(still.size).toBeGreaterThan(30)
  })

  it('has every letter fully arrived by the end of its block', () => {
    for (const treatment of FUN_TITLE_TREATMENTS) {
      for (let i = 0; i < 12; i += 1) {
        expect(funTitleLetter(treatment, 12, i, 1, 1, 40).opacity, `${treatment}[${i}]`).toBe(1)
      }
    }
  })

  /**
   * No treatment travels further than the room the block reserved out of its own
   * appetite. A lift past it goes through the top of the box and over whatever
   * the zone above holds — and every lift is upwards, so one padding covers all
   * five: see the note on the three amplitudes in `setPiece.js`.
   */
  it('never lifts a letter further than the headroom its appetite bought', () => {
    for (const unit of [1, 2, 3, 7, 12, 24, 48, 120, 300]) {
      const size = funTitleSize('Un titre un peu plus long', BOXES[0], unit)
      const headroom = funTitleHeadroom(unit)
      for (const treatment of FUN_TITLE_TREATMENTS) {
        for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
          for (const life of [0, 0.3, 0.66, 1]) {
            for (let i = 0; i < 16; i += 1) {
              const { rise } = funTitleLetter(treatment, 16, i, progress, life, size)
              expect(rise, `${treatment}[${i}] @ unit ${unit}`).toBeLessThanOrEqual(0)
              expect(-rise, `${treatment}[${i}] @ unit ${unit}`).toBeLessThanOrEqual(headroom)
            }
          }
        }
      }
    }
  })

  it('stresses the last word, and the whole line when there is only one', () => {
    expect(funTitleAccentFrom('deux mots')).toBe(5)
    expect(funTitleAccentFrom('seul')).toBe(0)
  })

  it('offsets a shadow only on the treatment that has one', () => {
    expect(funTitleShadow('stack', 100, 1)).toBeGreaterThan(0)
    for (const treatment of FUN_TITLE_TREATMENTS.filter((t) => t !== 'stack')) {
      expect(funTitleShadow(treatment, 100, 1), treatment).toBe(0)
    }
  })

  /**
   * A shadow needs a second COLOUR, and a render found the direction that has none.
   *
   * `HAZARD` in the review corpus states the same dark green for `text` and for
   * `accent` on a near-black ground, so `legibleOn` resolved both runs to `#ffffff`
   * and the offset copy came back as a second white `MOTION` seven per cent away
   * from the first — a word that reads as a printing fault. The floor is just past
   * "the same ink" and nowhere near a legibility bar, because the copy carries no
   * glyph anybody reads: gold behind white measures 1.76:1 on the editorial
   * direction and is obviously a shadow, so a 3:1 test would delete the treatment on
   * the themes that render it correctly.
   */
  it('declines to draw a shadow in the word’s own ink', () => {
    expect(funTitleShadow('stack', 100, 1, '#ffffff', '#ffffff')).toBe(0)
    expect(funTitleShadow('stack', 100, 1, '#eef1f5', '#e2b04a')).toBeGreaterThan(0)
    expect(contrastRatio('#eef1f5', '#e2b04a')).toBeLessThan(CONTRAST_MIN_LARGE)
    expect(contrastRatio('#eef1f5', '#e2b04a')).toBeGreaterThanOrEqual(STACK_SEPARATION)
    // A caller that names no inks keeps the answer it always had: the offset is a
    // fact about the treatment, and the colours are what let it decline (Q1).
    expect(funTitleShadow('stack', 100, 1)).toBe(funTitleShadow('stack', 100, 1, '#000000', '#ffffff'))
  })
})

describe('codeBlock — the panel fills its box', () => {
  const lines = (n, length = 20) => Array.from({ length: n }, () => ({ text: 'x'.repeat(length), role: 'plain' }))
  /** What `stackIn` would solve for a block alone in a box — the unit the component is handed. */
  const alone = (block, box) => solveTypeUnit([blockShape({ kind: 'codeBlock', ...block })], box.width, box.height)

  /**
   * The type comes down with the number of lines, and it is the BOX that makes it
   * do so: ten lines and two lines are the same block asking the same zone for
   * room, and the unit is what the zone can pay. `CODE_SIZE = 0.03` of the frame
   * gave both the same type and let the panel grow past the zone instead.
   */
  it('sets a long listing smaller than a short one in the same box', () => {
    // Boxes whose HEIGHT is what binds. In a tall narrow one the measure caps
    // both listings at the same size, which is the other half of the rule and is
    // what the test above this one is about.
    for (const box of [{ width: 1690, height: 300 }, { width: 907, height: 400 }, { width: 540, height: 300 }]) {
      const short = { lines: lines(BLOCK_LIMITS.codeLinesMin, 20) }
      const long = { lines: lines(BLOCK_LIMITS.codeLines, 20) }
      expect(
        codeMetrics(long, box, alone(long, box)).size,
        `${box.width}x${box.height}`,
      ).toBeLessThan(codeMetrics(short, box, alone(short, box)).size)
    }
  })

  it('sizes from the longest line, never the average, and keeps it inside the panel', () => {
    for (const box of BOXES) {
      const mixed = { lines: [{ text: 'a', role: 'plain' }, { text: 'x'.repeat(BLOCK_LIMITS.codeLine), role: 'plain' }] }
      const all = { lines: lines(2, BLOCK_LIMITS.codeLine) }
      expect(codeMetrics(mixed, box, alone(mixed, box)).size).toBe(codeMetrics(all, box, alone(all, box)).size)
      const panel = codeMetrics(all, box, alone(all, box))
      expect(panel.width, `${box.width}`).toBeLessThanOrEqual(box.width)
    }
  })

  /**
   * And it FILLS the measure when the measure is what capped it, padding
   * included. That is the half `blockExtent` cannot answer — it does not know a
   * panel has any padding — and the half that made a `codeBlock` alone on a frame
   * a small grey card in the middle of it.
   */
  it('fills the width of a box the longest line could not have been wider than', () => {
    const box = { width: 900, height: 1200 }
    const block = { lines: lines(3, BLOCK_LIMITS.codeLine) }
    const panel = codeMetrics(block, box, alone(block, box))
    expect(panel.width).toBeLessThanOrEqual(box.width)
    expect(panel.width / box.width).toBeGreaterThan(0.95)
  })

  it('grows with the box: twice the room, more than half again the type', () => {
    const block = { lines: lines(6, 30) }
    const small = { width: 500, height: 320 }
    const large = { width: 1000, height: 640 }
    expect(codeMetrics(block, large, alone(block, large)).size).toBeGreaterThan(
      codeMetrics(block, small, alone(block, small)).size * 1.5,
    )
  })

  /**
   * A caption is paid for out of the furniture budget rather than drawn on top of
   * it, so a captioned panel and a bare one are the same height. A block that
   * quietly drew a line and a half more than its appetite is a stack overflowing
   * its zone with nothing saying so.
   */
  it('pays for its caption out of its own padding', () => {
    for (const box of BOXES) {
      const bare = { lines: lines(4, 24) }
      const tabbed = { lines: lines(4, 24), caption: 'index.ts' }
      const unit = alone(bare, box)
      expect(Math.abs(codeMetrics(tabbed, box, unit).height - codeMetrics(bare, box, unit).height)).toBeLessThanOrEqual(2)
      expect(codeMetrics(tabbed, box, unit).captionSize).toBeGreaterThan(0)
      expect(codeMetrics(bare, box, unit).captionSize).toBe(0)
    }
  })

  /**
   * And it never draws taller than the height `stackIn` divided the zone by.
   *
   * `blockHeight` is that number — the same `shapeHeight` the solver used — and a
   * panel taller than it is a stack overflowing its zone, which is the one thing
   * the layout cannot be asked about afterwards. The leading is where it went
   * wrong: `shapeHeight` puts `RUN_GAP` between two runs of one block, so a panel
   * setting its lines at the bare body leading sat in 85% of its own box.
   */
  it('draws the height the layout allotted it, and never more', () => {
    for (const box of [...BOXES, { width: 1690, height: 300 }, { width: 400, height: 900 }]) {
      for (const n of [BLOCK_LIMITS.codeLinesMin, 6, BLOCK_LIMITS.codeLines]) {
        const block = { lines: lines(n, 28) }
        const unit = alone(block, box)
        const panel = codeMetrics(block, box, unit)
        const promised = blockHeight({ kind: 'codeBlock', ...block }, box.width, unit)
        expect(panel.height, `${n} lines in ${box.width}x${box.height}`).toBeLessThanOrEqual(promised + 3)
        // Two regimes, and the shortfall in the second is exactly the padding.
        // When the HEIGHT is what bound the type, the panel draws the whole
        // allotment; when the MEASURE bound it, the type had to come down by the
        // padding `blockExtent` does not know a panel has — which is still well
        // inside the house floor for how much of a box a block must fill.
        const measureBound = panel.size < typeSize('body', unit)
        expect(panel.height / promised, `${n} lines in ${box.width}x${box.height}`).toBeGreaterThan(
          measureBound ? BOX_FILL_FLOOR : 0.97,
        )
      }
    }
  })

  /**
   * The panel's corner is a CONSTANT METRIC, and it has the ceiling every other
   * one in this catalogue has.
   *
   * The block used to write `borderRadius: theme.radiusPx` straight into a style
   * while `button`, `form`, `notification`, `gallery` and `carousel` all clamped
   * theirs. `ThemeSchema` accepts a whole number up to 9999 and `parseDesignSpec`
   * reads whatever a direction stated, so an ordinary "generous corners" of 40 px
   * drew a three-line snippet as a lozenge — on the block whose whole point is
   * that a listing looks like a listing.
   *
   * Bounded on the PANEL and not on the box, because the panel is what has the
   * corner: a short listing is as wide as its own measure, which is a good deal
   * narrower than the box the layout gave it.
   */
  it('bounds the panel’s corner by the panel, never by the theme alone', () => {
    for (const box of BOXES) {
      for (const n of [BLOCK_LIMITS.codeLinesMin, BLOCK_LIMITS.codeLines]) {
        const block = { lines: lines(n, 28) }
        const panel = codeMetrics(block, box, alone(block, box))
        const room = Math.min(panel.width, panel.height)
        const where = `${n} lines in ${box.width}x${box.height}`
        // A modest radius is the theme's own number, untouched.
        expect(panelRadius(10, panel), where).toBe(10)
        // The schema's ceiling is not a corner: it is a quarter of the panel.
        expect(panelRadius(9999, panel), where).toBe(Math.floor(room * CONSTANT_CEILING))
        expect(panelRadius(9999, panel), where).toBeLessThanOrEqual(room / 4)
      }
    }
    // A stated square corner stays square — rounding a zero up to a pixel would be
    // the layout overruling the direction. And nothing here answers a NaN, which
    // in a `borderRadius` is a corner the browser silently drops.
    const panel = codeMetrics({ lines: lines(3, 24) }, BOXES[0], 40)
    expect(panelRadius(0, panel)).toBe(0)
    expect(panelRadius(-4, panel)).toBe(0)
    expect(panelRadius(undefined, panel)).toBe(0)
    expect(panelRadius(12, undefined)).toBe(0)
  })

  /** A box or a unit this file should never see still answers with a drawable panel (Q1). */
  it('draws something rather than nothing for a box or a unit it cannot read', () => {
    for (const box of [undefined, {}, { width: 0, height: 0 }, { width: 'large', height: null }]) {
      for (const unit of [undefined, 0, 48]) {
        const panel = codeMetrics({ lines: lines(3, 24) }, box, unit)
        const finite = [panel.size, panel.pad, panel.padY, panel.lineHeight, panel.width, panel.height]
        expect(finite.every(Number.isFinite), `${JSON.stringify(box)} @ ${unit}`).toBe(true)
        expect(panel.size).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('draws a caret narrower than the type it follows', () => {
    expect(CODE_CARET).toBeGreaterThan(0)
    expect(CODE_CARET).toBeLessThan(1)
  })

  /**
   * The failure this catches is the one nobody sees in a still: a listing whose
   * last line is half typed when the scene cuts. `LINE_SPAN` leaves the tail for
   * the reason `cueFrames` leaves `MIN_CUE_TAIL_FRAMES`.
   */
  it('finishes every line before its block has finished arriving', () => {
    for (const reveal of ['lines', 'type']) {
      for (const n of [BLOCK_LIMITS.codeLinesMin, BLOCK_LIMITS.codeLines]) {
        const list = lines(n, BLOCK_LIMITS.codeLine)
        const shown = codeReveal(list, reveal, 0.85)
        for (const [i, line] of shown.entries()) {
          expect(line.chars, `${reveal}[${i}]`).toBe(list[i].text.length)
          expect(line.opacity, `${reveal}[${i}]`).toBe(1)
        }
      }
    }
  })

  it('starts with nothing written', () => {
    const list = lines(4)
    expect(codeReveal(list, 'type', 0).every((l) => l.chars === 0)).toBe(true)
    expect(codeReveal(list, 'lines', 0).every((l) => l.opacity === 0)).toBe(true)
  })

  it('types the whole panel as one stream, so a long line takes longer than a short one', () => {
    const mixed = [{ text: 'ab', role: 'plain' }, { text: 'x'.repeat(40), role: 'plain' }]
    const half = codeReveal(mixed, 'type', 0.35)
    expect(half[0].chars).toBe(2)
    expect(half[1].chars).toBeGreaterThan(0)
    expect(half[1].chars).toBeLessThan(40)
  })

  it('draws a caret only while something is being typed', () => {
    const list = lines(3)
    expect(codeCaret(list, 'lines', 0.5)).toBe(null)
    expect(codeCaret(list, 'type', 0.999)).toBe(null)
    expect(typeof codeCaret(list, 'type', 0.3)).toBe('number')
  })
})

describe('solidScene — one size, four solids', () => {
  it('has a geometry for every solid the schema names', () => {
    for (const solid of SOLIDS) {
      const { geometry, args } = solidGeometry(solid)
      expect(typeof geometry, solid).toBe('string')
      expect(Array.isArray(args) && args.length > 0, solid).toBe(true)
      expect(args.every((n) => Number.isFinite(n)), solid).toBe(true)
    }
  })

  /**
   * ── The defect `size` was named for ────────────────────────────────────────
   *
   * A `large` used to mean four different things: a sphere of radius 1.9 drew 82%
   * of its canvas, a torus of 1.7 + 0.62 drew all of it, a cube of side 2.6 drew
   * barely half. Three documents asking for the same share got three sizes, and
   * the worst of them shipped as a torus at 15% of the frame's height. One
   * bounding radius is what makes the word mean something.
   */
  it('builds every solid to one bounding radius', () => {
    for (const solid of SOLIDS) {
      const { geometry, args } = solidGeometry(solid)
      expect(solidBoundingRadius(geometry, args), solid).toBeCloseTo(SOLID_BOUND, 6)
    }
  })

  /**
   * And that radius is the camera's own limit: a point of a ball of radius R at
   * distance d projects to at most `R / sqrt(d² − R²)` of the frame's half-height,
   * so the solid touches the edge of its canvas and never crosses it — at every
   * orientation, which is why the bound is the sphere and not the silhouette.
   */
  it('fills its canvas without ever leaving it, at any orientation', () => {
    const half = Math.tan((SOLID_CAMERA_FOV / 2) * (Math.PI / 180))
    const projected = SOLID_BOUND / Math.sqrt(SOLID_CAMERA_Z ** 2 - SOLID_BOUND ** 2)
    expect(projected).toBeLessThanOrEqual(half)
    // And it is not timid either: within 5% of the room the camera leaves.
    expect(projected / half).toBeGreaterThan(0.95)
  })

  /**
   * The bug this exists to have already fixed, and it was a real one: a probe
   * spinning a cube by π/2 per beat rendered frames 0, 45 and 90 as three
   * byte-identical PNGs. A symmetric solid on a symmetric turn is a film in which
   * nothing moves, produced by arithmetic rather than by a default — which is the
   * same failure `DEFAULT_KEN_BURNS` exists to refuse, one level down.
   */
  it('never returns to its first orientation at the end of a scene', () => {
    for (const spin of SPINS) {
      const first = solidSpin(spin, 0)
      const last = solidSpin(spin, 1)
      const quarters = ['x', 'y', 'z'].map((axis) => (last[axis] - first[axis]) / (Math.PI / 2))
      // Not a whole number of quarter-turns on every axis at once: a cube is
      // pixel-identical after one, and every solid in the enum is after four.
      expect(quarters.some((q) => Math.abs(q - Math.round(q)) > 0.05), spin).toBe(true)
    }
  })

  it('is in motion at every point of the scene, not only at its ends', () => {
    for (const spin of SPINS) {
      for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const a = solidSpin(spin, t)
        const b = solidSpin(spin, t + 0.01)
        expect(JSON.stringify(a) === JSON.stringify(b), `${spin} at ${t}`).toBe(false)
      }
    }
  })

  it('arrives by growing, and is at full size once it has', () => {
    expect(solidScale(0)).toBe(SOLID_ENTER_SCALE)
    expect(solidScale(1)).toBe(1)
    expect(solidScale(0.5)).toBeGreaterThan(SOLID_ENTER_SCALE)
  })

  /**
   * The canvas is the only place in this directory where a wasted pixel costs
   * render seconds rather than bytes — a full-frame lit solid measured 0.9 s of
   * render per second of film. It is square, and it is a share of the box the
   * layout gave THIS block.
   */
  it('never draws a canvas larger than the box it was given', () => {
    for (const size of Object.keys(DECLARED_SHARE.solidScene)) {
      for (const box of [{ width: 1800, height: 400 }, { width: 300, height: 900 }, { width: 1080, height: 1080 }]) {
        const side = solidCanvas(box, size, BASE)
        expect(side, `${size} in ${box.width}x${box.height}`).toBeLessThanOrEqual(Math.min(box.width, box.height))
        expect(side).toBeGreaterThan(0)
      }
    }
  })

  /**
   * And never smaller than the share either. The frame used to creep back in
   * through a `Math.min(room, base)`, so on the one ratio where a box can be wider
   * than the short edge, `large` quietly meant something smaller than the document
   * asked for.
   */
  it('takes its share of the box, not of the frame', () => {
    for (const [size, share] of Object.entries(DECLARED_SHARE.solidScene)) {
      expect(solidCanvas({ width: 4000, height: 4000 }, size, BASE), size).toBe(Math.round(4000 * share))
      expect(solidCanvas({ width: 1000, height: 1000 }, size, BASE) / 1000).toBeCloseTo(share, 2)
    }
  })

  it('grows with the named size and with nothing else', () => {
    const box = { width: 1080, height: 1080 }
    expect(solidCanvas(box, 'small', BASE)).toBeLessThan(solidCanvas(box, 'medium', BASE))
    expect(solidCanvas(box, 'medium', BASE)).toBeLessThan(solidCanvas(box, 'large', BASE))
    // An unknown size reads as the middle one rather than throwing: the validator
    // already refused anything else, so reaching this branch means the three
    // readers disagree, and a solid drawn at the wrong size beats a render that
    // dies half a minute in (Q1).
    expect(solidCanvas(box, 'enormous', BASE)).toBe(solidCanvas(box, 'medium', BASE))
    // And a name off the prototype chain is not a share: a plain lookup would
    // hand back a FUNCTION, which is truthy, so `?? medium` never fires and the
    // canvas is NaN pixels wide.
    for (const inherited of ['constructor', 'toString', '__proto__', 'valueOf']) {
      expect(solidCanvas(box, inherited, BASE), inherited).toBe(solidCanvas(box, 'medium', BASE))
    }
    // A box this file cannot read still draws something (Q1).
    expect(solidCanvas(undefined, 'medium', BASE)).toBe(solidCanvas({ width: BASE, height: BASE }, 'medium', BASE))
  })
})
