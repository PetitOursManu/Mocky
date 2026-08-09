// The arithmetic of the five data blocks.
//
// It is the only part of them a test can reach: a `.jsx` file cannot be imported
// here — Remotion is not installed at the root and never will be — so everything
// worth asserting about a bar, a series, a motif or a map was written as a
// function over numbers, and this is the file that holds it to its word.
//
// Four claims run through the whole file and each one is a bug that shipped
// somewhere in this repository before it was a rule:
//
//   1. **A block inhabits the box it is given.** `equalizer` drew `base * 0.18`
//      whether it had been anchored to a third of a cell or to the whole safe
//      area, and six real exports were a small element floating in a large void.
//      So every `*Layout` here is measured against its box, twice: doubling the
//      box doubles the drawing, and multiplying `base` by ten changes nothing but
//      the constant metrics.
//   2. **Nothing holds still.** A film in which nothing moves must not be
//      producible by accident (`DEFAULT_KEN_BURNS`), and a block that arrives and
//      then freezes for fourteen seconds is that failure one level down. Every
//      continuous figure below is sampled frame by frame across the whole range of
//      scene lengths the schema accepts, and no frame may equal the one before it.
//   3. **A value is not an ornament.** A bar's height is the number the document
//      stated; the things that move continuously are the marks around it.
//   4. **Deterministic, always.** Two renders of one document have to produce the
//      same frames or the content-addressed export store keeps two files for one
//      film.
import { describe, it, expect } from 'vitest'
import { BOX_FILL_FLOOR, CONSTANT_CEILING, blockShape, solveTypeUnit, typeSize } from '../composition.js'
import {
  ARC_BULGE,
  AXIS_SWEEP_CYCLES,
  BAR_CASCADE,
  EQUALIZER_CYCLES,
  FIELD_LIT,
  FIELD_QUIET,
  FIGURE_MAX_RATIO,
  LABEL_FLOOR,
  LAND_MARK,
  LAND_ROWS,
  LINE_MAX_ASPECT,
  MAP_COLUMNS,
  MAP_CROP_GROWTH,
  MAP_MAX_DOTS,
  MAP_MIN_PITCH,
  MAP_ROWS,
  MAP_TARGET_COLUMNS,
  MAP_WINDOWS,
  MOTIF_FLOOR,
  PING_REACH,
  arcControl,
  axisTick,
  barChartLayout,
  barGrowths,
  barHeight,
  bezierPoint,
  capped,
  columnGlow,
  equalizerLayout,
  equalizerLevels,
  figureRadius,
  labelBand,
  lineChartLayout,
  linkPulse,
  mapCrop,
  mapField,
  mapLayout,
  mapSampling,
  mapStride,
  mapWindow,
  markerCells,
  markerPulse,
  pingFade,
  pingPhase,
  pingReach,
  pointAtX,
  seriesPoints,
  tracedPoints,
  tracks,
  waveGain,
  waveHeights,
  waveLayout,
  waveOrientation,
  wavePoints,
} from './dataFigures.js'

/**
 * The scene lengths a film can really contain, in frames at 30 fps.
 *
 * The schema bounds a composed scene to 1.5–15 s, and a cadence counted in cycles
 * per SCENE behaves differently at the two ends — which is exactly why the range
 * is swept rather than sampled at one comfortable duration. 45 frames is the
 * short end, where a sine advances fastest between frames and two samples can
 * straddle a peak; 450 is the long end, where it advances least and two samples
 * can land on the same value.
 */
const SCENES = [45, 90, 150, 300, 450]

/** Every frame of a scene, as the `life` a block would be handed on it. */
const lives = (frames) => Array.from({ length: frames }, (_, f) => f / (frames - 1))

/** How many times a sampled signal turns around. A single sine turns twice per cycle and no more. */
const turns = (series) => {
  let n = 0
  for (let i = 1; i < series.length - 1; i++) {
    const up = series[i] > series[i - 1] && series[i] >= series[i + 1]
    const down = series[i] < series[i - 1] && series[i] <= series[i + 1]
    if (up || down) n++
  }
  return n
}

/**
 * The boxes a composed scene really hands a block, and they are the point.
 *
 * `full` is the 16:9 safe area — one block anchored `full`, which is the case
 * every one of these five used to draw a fraction of the frame in. `band` and
 * `column` are what a shared row and a shared band produce, and they are the
 * shapes nobody looks at and the model produces the moment a scene holds two
 * blocks. `cell` is a third of a third.
 */
const BOXES = {
  full: { left: 116, top: 65, width: 1688, height: 950 },
  half: { left: 116, top: 65, width: 819, height: 950 },
  band: { left: 116, top: 65, width: 1688, height: 210 },
  column: { left: 116, top: 65, width: 480, height: 820 },
  cell: { left: 116, top: 65, width: 520, height: 300 },
}

/** The unit a block alone in its box reads: `stackIn`'s answer for a stack of one. */
const soloUnit = (block, box) => solveTypeUnit([blockShape(block)], box.width, box.height)

/** The same box at twice the size, which is the only way to ask whether a drawing is relative. */
const doubled = (box) => ({ ...box, width: box.width * 2, height: box.height * 2 })

describe('the columns every figure in this family is built out of', () => {
  it('tiles its measure exactly, whatever the count and the gap', () => {
    for (const measure of [1688, 819, 520, 97]) {
      for (const total of [1, 2, 3, 8, 24]) {
        for (const gap of [0, 1, 12]) {
          const lanes = tracks(measure, total, gap)
          expect(lanes, `${measure}/${total}/${gap}`).toHaveLength(total)
          expect(lanes[0].start).toBe(0)
          const last = lanes[lanes.length - 1]
          // The last edge lands on the measure itself: rounding sizes instead of
          // edges spends a pixel per column, and eight of them leave a chart short
          // of the box it was measured against.
          expect(last.start + last.size, `${measure}/${total}/${gap}`).toBe(Math.round(measure))
          for (const lane of lanes) expect(lane.size).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })

  it('never lets the air eat the columns', () => {
    // A gap wider than the pitch would leave a row of gaps with nothing between
    // them, which is a block that draws nothing on a frame nobody previewed.
    const lanes = tracks(100, 8, 400)
    for (const lane of lanes) expect(lane.size).toBeGreaterThanOrEqual(1)
  })

  it('caps a slab and keeps it in the middle of its own track', () => {
    const lanes = tracks(1000, 2, 10)
    const narrow = capped(lanes, 100)
    for (const [i, lane] of narrow.entries()) {
      expect(lane.size).toBe(100)
      expect(lane.start).toBeGreaterThanOrEqual(lanes[i].start)
      expect(lane.start + lane.size).toBeLessThanOrEqual(lanes[i].start + lanes[i].size)
      // Centred, so a label pinned to the TRACK is still a label under its bar.
      const before = lane.start - lanes[i].start
      const after = lanes[i].start + lanes[i].size - lane.start - lane.size
      expect(Math.abs(before - after)).toBeLessThanOrEqual(1)
    }
  })

  it('leaves a column alone when it is already narrower than the cap', () => {
    const lanes = tracks(600, 8, 6)
    expect(capped(lanes, 500)).toEqual(lanes)
  })

  /**
   * A radius is a CONSTANT METRIC — the same object from one scene to the next —
   * so it comes off the theme. An exception with no ceiling is the rule going back
   * out of the window, which is what `CONSTANT_CEILING` is for: a 12 px radius on
   * a 14 px bar is a pill, and a row of pills is a row of tags.
   */
  it('bounds a corner radius by the thing it rounds', () => {
    expect(figureRadius(12, 400)).toBe(12)
    expect(figureRadius(12, 14)).toBe(Math.floor(14 * CONSTANT_CEILING))
    expect(figureRadius(0, 400)).toBe(0)
    expect(figureRadius(12, 0)).toBe(0)
  })
})

describe('the cascade of a bar chart', () => {
  it('finishes every bar at the end of the arrival, however many there are', () => {
    for (const bars of [2, 3, 5, 8]) {
      expect(barGrowths(bars, 1), `${bars} bars`).toEqual(Array.from({ length: bars }, () => 1))
    }
  })

  it('has started none of them at the beginning of it', () => {
    expect(barGrowths(8, 0)).toEqual(Array.from({ length: 8 }, () => 0))
  })

  /**
   * The order is the document's, and the amounts fall from first to last.
   *
   * A cascade that ran the other way would draw the chart right to left, which is
   * not a taste: `labels` pairs with `values` by index and the eye reads the pair
   * in the order the row is laid out.
   */
  it('draws them in the order the document listed them', () => {
    const growths = barGrowths(8, 0.5)
    for (let i = 1; i < growths.length; i++) expect(growths[i]).toBeLessThan(growths[i - 1])
  })

  it('holds a bar at nothing until its own turn comes', () => {
    const bars = 8
    // The same expression the cascade uses, not an algebraic rearrangement of it:
    // `i * (BAR_CASCADE / last)` is a different float, and a test that computed a
    // start a hair before the real one would pass on a bar that had already begun.
    const startOf = (i) => (i / (bars - 1)) * BAR_CASCADE
    for (let i = 0; i < bars; i++) {
      expect(barGrowths(bars, startOf(i))[i], `bar ${i}`).toBe(0)
      expect(barGrowths(bars, startOf(i) + BAR_CASCADE / (2 * (bars - 1)))[i], `bar ${i}`).toBeGreaterThan(0)
    }
  })

  it('gives a single bar the whole arrival rather than a stagger with nothing to stagger', () => {
    expect(barGrowths(1, 0.4)).toEqual([0.4])
  })

  it('never leaves the unit interval, whatever it is handed', () => {
    for (const p of [-1, 0, 0.5, 1, 2, NaN, undefined]) {
      for (const g of barGrowths(6, p)) expect(g, String(p)).toBeGreaterThanOrEqual(0)
      for (const g of barGrowths(6, p)) expect(g, String(p)).toBeLessThanOrEqual(1)
    }
  })

  it('draws the value the document stated, as a share of the plot it was given', () => {
    expect(barHeight(100, 1, 400)).toBe(400)
    expect(barHeight(50, 1, 400)).toBe(200)
    expect(barHeight(50, 0.5, 400)).toBe(100)
    // Doubling the plot doubles the column: the height is the value, in the box.
    expect(barHeight(37, 1, 800)).toBe(2 * barHeight(37, 1, 400))
  })
})

describe('the reading mark that keeps a finished chart alive', () => {
  it('stays on the axis it is reading', () => {
    for (const life of lives(300)) {
      expect(axisTick(life)).toBeGreaterThanOrEqual(0)
      expect(axisTick(life)).toBeLessThanOrEqual(1)
    }
  })

  /**
   * The claim the whole file is about, for this block: the bars stop, so the mark
   * may not.
   */
  it('moves on every frame of every scene length the schema allows', () => {
    for (const frames of SCENES) {
      const series = lives(frames).map(axisTick)
      for (let f = 1; f < series.length; f++) expect(series[f], `${frames} frames, frame ${f}`).not.toBe(series[f - 1])
    }
  })

  /**
   * And it is not a metronome. A single sine at `AXIS_SWEEP_CYCLES` turns around
   * three times across a scene; the second rate is what makes the mark scrub like
   * something being read rather than swing like a pendulum, and it is the
   * difference between motion that reads as designed and motion that reads as
   * generated.
   */
  it('carries more than one rate, so it does not swing', () => {
    expect(turns(lives(300).map(axisTick))).toBeGreaterThan(Math.ceil(AXIS_SWEEP_CYCLES * 2))
  })
})

describe('a label under a column, which shortens or disappears', () => {
  it('keeps the caption step when the column is wide enough for it', () => {
    const band = labelBand(['Q1', 'Q2'], 40, 400)
    expect(band.shown).toBe(true)
    expect(band.size).toBe(typeSize('caption', 40))
  })

  /**
   * The rule stated as arithmetic: a caption is measured against its own COLUMN,
   * so it shrinks to fit one — and it is never wider than the column it sits in,
   * which is the whole difference between a chart and a row of overlapping words.
   */
  it('shrinks to fit the narrowest column it was given', () => {
    const wide = labelBand(['September'], 40, 400)
    const narrow = labelBand(['September'], 40, 120)
    expect(narrow.size).toBeLessThan(wide.size)
    expect(narrow.size * 'September'.length * 0.52).toBeLessThanOrEqual(120)
  })

  it('takes the whole row away rather than half of it, below the floor', () => {
    const step = typeSize('caption', 40)
    // One label present and seven missing reads as a bug rather than as a
    // decision, so the band goes whole.
    expect(labelBand(['Wednesday 12'], 40, 8).shown).toBe(false)
    expect(labelBand(['Wednesday 12'], 40, 8).height).toBe(0)
    const floor = Math.round(step * LABEL_FLOOR)
    expect(floor).toBeGreaterThan(0)
  })

  it('answers nothing for a chart with no labels at all', () => {
    expect(labelBand(null, 40, 400).shown).toBe(false)
    expect(labelBand([], 40, 400).shown).toBe(false)
    expect(labelBand(['  '], 40, 400).shown).toBe(false)
  })
})

describe('a bar chart, in the box it was given', () => {
  const chart = { kind: 'barChart', values: [40, 90, 60, 75], labels: ['Q1', 'Q2', 'Q3', 'Q4'], baseline: true }
  const layoutIn = (box, base = 1080) => barChartLayout(chart, box, { base, unit: soloUnit(chart, box), radiusPx: 12 })

  it('spends every pixel of its box, on both axes', () => {
    for (const [name, box] of Object.entries(BOXES)) {
      const layout = layoutIn(box)
      const bands = layout.plot + layout.axis.gap + layout.axis.thickness + layout.label.gap + layout.label.height
      expect(layout.width, name).toBe(box.width)
      // The plot, the axis and the labels tile the height exactly — no slack, and
      // nothing past the bottom of a box whose edge is the safe margin.
      expect(bands, name).toBe(box.height)
      const last = layout.lanes[layout.lanes.length - 1]
      expect(layout.lanes[0].start, name).toBe(0)
      expect(last.start + last.size, name).toBe(box.width)
    }
  })

  it('gives the plot most of its box, which is what stops a chart being a strip', () => {
    for (const [name, box] of Object.entries(BOXES)) {
      expect(layoutIn(box).plot / box.height, name).toBeGreaterThan(BOX_FILL_FLOOR)
    }
  })

  it('doubles everything it draws when the box doubles', () => {
    const box = BOXES.cell
    const small = layoutIn(box)
    const large = barChartLayout(chart, doubled(box), {
      base: 1080,
      unit: soloUnit(chart, doubled(box)),
      radiusPx: 12,
    })
    expect(large.width).toBe(2 * small.width)
    expect(large.plot / small.plot).toBeGreaterThan(1.9)
    expect(large.label.size / small.label.size).toBeGreaterThan(1.6)
  })

  /**
   * The other half of the rule: the frame may only reach a block through a
   * CONSTANT METRIC. Ten times the frame with the same box changes the hairline
   * the axis is drawn with and nothing else — if it changed the plot, the block
   * would be reading the frame again under another name.
   */
  it('reads the frame for its hairlines and for nothing else', () => {
    const box = BOXES.cell
    const near = layoutIn(box, 1080)
    const far = layoutIn(box, 10800)
    expect(far.plot + far.axis.thickness).toBe(near.plot + near.axis.thickness)
    expect(far.label).toEqual(near.label)
    expect(far.lanes).toEqual(near.lanes)
    expect(far.axis.thickness).toBeGreaterThan(near.axis.thickness)
  })

  it('never draws a column wider than it is tall enough to justify', () => {
    // Two values across a full safe area are two 800 px slabs, and a slab reads as
    // a panel rather than as a bar.
    const wide = { kind: 'barChart', values: [40, 90], labels: null, baseline: true }
    const layout = barChartLayout(wide, BOXES.full, { base: 1080, unit: soloUnit(wide, BOXES.full), radiusPx: 12 })
    for (const bar of layout.bars) expect(bar.size).toBeLessThanOrEqual(Math.round(layout.plot * FIGURE_MAX_RATIO))
    // And the row still spans the box: what fills the extra is air, not ink.
    expect(layout.lanes[layout.lanes.length - 1].start + layout.lanes[1].size).toBeGreaterThan(BOXES.full.width * 0.5)
  })

  it('draws no axis when the document turned it off, and keeps its mark', () => {
    const bare = { ...chart, baseline: false }
    const layout = barChartLayout(bare, BOXES.cell, { base: 1080, unit: soloUnit(bare, BOXES.cell), radiusPx: 12 })
    expect(layout.axis.thickness).toBe(0)
    expect(layout.mark.thickness).toBeGreaterThan(0)
  })
})

describe('a series, and the trace that draws it', () => {
  it('spans the box and puts a hundred at the top', () => {
    const points = seriesPoints([0, 50, 100])
    expect(points.map((p) => p.x)).toEqual([0, 0.5, 1])
    // `y` is measured downward, like every other SVG coordinate in this repository.
    expect(points.map((p) => p.y)).toEqual([1, 0.5, 0])
  })

  it('draws the value the document stated and never rescales to its own range', () => {
    // Three values that never reach the top: an auto-scale would put the largest
    // at the ceiling, and the same number would then draw two heights in two
    // scenes of one film.
    expect(seriesPoints([10, 20, 30]).map((p) => p.y)).toEqual([0.9, 0.8, 0.7])
  })

  it('answers for a degenerate series rather than putting a NaN in a path', () => {
    expect(seriesPoints([])).toEqual([])
    expect(seriesPoints([50])).toEqual([{ x: 0.5, y: 0.5 }])
    expect(pointAtX([], 0.5)).toEqual({ x: 0, y: 1 })
  })

  it('interpolates between two samples, and lands exactly on them', () => {
    const points = seriesPoints([0, 100])
    expect(pointAtX(points, 0)).toEqual({ x: 0, y: 1 })
    expect(pointAtX(points, 1)).toEqual({ x: 1, y: 0 })
    expect(pointAtX(points, 0.25).y).toBeCloseTo(0.75, 10)
  })

  it('traces the whole series by the end of the arrival, and nothing at the start of it', () => {
    const points = seriesPoints([0, 40, 90, 30, 70])
    expect(tracedPoints(points, 1)).toEqual(points)
    expect(tracedPoints(points, 0)).toEqual([points[0]])
  })

  /**
   * The head is at `x = progress` exactly, which is the property the whole shape
   * of this function exists for: the dot and the ring are placed in percent by the
   * component, and a trace revealed by arc length would leave them off the line by
   * more on the steep parts — where it would be noticed.
   */
  it('ends where the head is, and every point it draws is on the curve', () => {
    const points = seriesPoints([0, 40, 90, 30, 70])
    for (const progress of [0.1, 0.25, 0.37, 0.5, 0.62, 0.75, 0.9]) {
      const drawn = tracedPoints(points, progress)
      expect(drawn[drawn.length - 1].x, String(progress)).toBeCloseTo(progress, 10)
      for (const p of drawn) expect(p.y, `${progress} at ${p.x}`).toBeCloseTo(pointAtX(points, p.x).y, 10)
    }
  })

  it('grows monotonically and never draws a vertex twice', () => {
    const points = seriesPoints([0, 40, 90, 30, 70])
    let previous = 0
    for (let i = 0; i <= 40; i++) {
      const drawn = tracedPoints(points, i / 40)
      expect(drawn.length).toBeGreaterThanOrEqual(previous)
      previous = drawn.length
      const xs = drawn.map((p) => p.x)
      // A repeated vertex is a zero-length mitre, which the renderer draws as a
      // nick in the stroke.
      expect(new Set(xs).size, `at ${i / 40}`).toBe(xs.length)
    }
  })
})

describe('the ping on the head of a line', () => {
  it('restarts rather than reverses', () => {
    expect(pingPhase(0)).toBe(0)
    // A sawtooth: the value drops back to zero, which a sine never does.
    const series = lives(300).map(pingPhase)
    expect(series.some((v, i) => i > 0 && v < series[i - 1])).toBe(true)
  })

  it('grows from the head and fades as it goes', () => {
    expect(pingReach(0)).toBe(1)
    expect(pingReach(1)).toBeCloseTo(PING_REACH, 10)
    expect(pingFade(1)).toBe(0)
    expect(pingFade(0)).toBeGreaterThan(0)
  })

  it('moves on every frame of every scene length', () => {
    for (const frames of SCENES) {
      const series = lives(frames).map((life) => pingReach(pingPhase(life)))
      for (let f = 1; f < series.length; f++) expect(series[f], `${frames} frames`).not.toBe(series[f - 1])
    }
  })
})

describe('a line chart, in the box it was given', () => {
  const chart = { kind: 'lineChart', values: [10, 40, 30, 80, 60, 95], label: 'Monthly revenue', area: true }
  const layoutIn = (box, base = 1080) => lineChartLayout(chart, box, { base, unit: soloUnit(chart, box) })

  it('keeps the whole plot, and the ring on its last point, inside its box', () => {
    for (const [name, box] of Object.entries(BOXES)) {
      const layout = layoutIn(box)
      const reach = Math.round((layout.dot * PING_REACH) / 2)
      expect(layout.plot.left, name).toBeGreaterThanOrEqual(reach)
      expect(layout.plot.top, name).toBeGreaterThanOrEqual(reach)
      expect(layout.plot.left + layout.plot.width + reach, name).toBeLessThanOrEqual(box.width)
      expect(layout.plot.top + layout.plot.height + reach + layout.label.height, name).toBeLessThanOrEqual(box.height)
    }
  })

  it('fills the measure it was given rather than a fraction of the frame', () => {
    for (const [name, box] of Object.entries(BOXES)) {
      expect(layoutIn(box).plot.width / box.width, name).toBeGreaterThan(BOX_FILL_FLOOR)
    }
  })

  /**
   * The one place this family does not fill its box, and the reason is the data
   * rather than the layout: nothing rescales the values, so a plot stretched three
   * times taller than it is wide draws a ten-point difference as a cliff.
   */
  it('refuses to exaggerate a series in a column', () => {
    const layout = layoutIn(BOXES.column)
    expect(layout.plot.height / layout.plot.width).toBeLessThanOrEqual(LINE_MAX_ASPECT + 0.01)
    // And what is left over is air split evenly, not a chart pinned to the top.
    const band = layout.label.height + layout.label.gap
    const above = layout.plot.top - layout.inset
    const below = BOXES.column.height - band - layout.inset - layout.plot.top - layout.plot.height
    expect(Math.abs(above - below)).toBeLessThanOrEqual(1)
  })

  it('doubles everything it draws when the box doubles', () => {
    const small = layoutIn(BOXES.cell)
    const large = lineChartLayout(chart, doubled(BOXES.cell), {
      base: 1080,
      unit: soloUnit(chart, doubled(BOXES.cell)),
    })
    expect(large.dot / small.dot).toBeGreaterThan(1.9)
    expect(large.plot.width / small.plot.width).toBeGreaterThan(1.9)
    expect(large.label.size / small.label.size).toBeGreaterThan(1.6)
  })

  it('reads the frame for its stroke and for nothing else', () => {
    const near = layoutIn(BOXES.cell, 1080)
    const far = layoutIn(BOXES.cell, 10800)
    expect(far.plot).toEqual(near.plot)
    expect(far.dot).toBe(near.dot)
    expect(far.stroke).toBeGreaterThan(near.stroke)
  })

  it('gives the whole box to the plot when the document wrote no label', () => {
    const bare = { ...chart, label: null }
    const with0 = lineChartLayout(bare, BOXES.cell, { base: 1080, unit: soloUnit(bare, BOXES.cell) })
    expect(with0.label.shown).toBe(false)
    expect(with0.plot.height).toBeGreaterThan(layoutIn(BOXES.cell).plot.height)
  })
})

describe('the equalizer, which is a motif and hears nothing', () => {
  it('stays between its floor and the top of its box', () => {
    for (const tempo of Object.keys(EQUALIZER_CYCLES)) {
      for (const life of lives(150)) {
        for (const level of equalizerLevels(16, tempo, life)) {
          expect(level, tempo).toBeGreaterThanOrEqual(MOTIF_FLOOR)
          expect(level, tempo).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('is the same figure twice, because two renders of one film have to match', () => {
    expect(equalizerLevels(12, 'steady', 0.37)).toEqual(equalizerLevels(12, 'steady', 0.37))
  })

  /**
   * A row of bars all at one height is one bar repeated, which is what a single
   * shared phase produces and the reason each bar's is a golden-ratio stride.
   */
  it('never draws every bar at the same height', () => {
    for (const life of lives(150)) expect(new Set(equalizerLevels(12, 'steady', life)).size).toBeGreaterThan(1)
  })

  it('moves on every frame of every scene length, at every tempo', () => {
    for (const tempo of Object.keys(EQUALIZER_CYCLES)) {
      for (const frames of SCENES) {
        const series = lives(frames).map((life) => equalizerLevels(12, tempo, life))
        for (let f = 1; f < series.length; f++) {
          expect(series[f].some((v, i) => v !== series[f - 1][i]), `${tempo}, ${frames} frames, frame ${f}`).toBe(true)
        }
      }
    }
  })

  /**
   * Several frequencies, and this is the test that says so.
   *
   * One sine at `n` cycles turns around `2n` times across a scene. The figure has
   * to turn more often than that or it is a sinusoid with extra steps — which
   * reads as a wallpaper pattern rather than as an equalizer, and was what the
   * first version of this file drew.
   */
  it('is not a single sinusoid', () => {
    const series = lives(300).map((life) => equalizerLevels(12, 'steady', life)[0])
    expect(turns(series)).toBeGreaterThan(EQUALIZER_CYCLES.steady * 2)
  })

  it('takes its rate from the tempo, and reads an unknown one as the middle one', () => {
    expect(equalizerLevels(12, 'fast', 0.3)).not.toEqual(equalizerLevels(12, 'slow', 0.3))
    expect(equalizerLevels(12, 'nonsense', 0.3)).toEqual(equalizerLevels(12, 'steady', 0.3))
  })

  /**
   * The block this whole pass is named after: `base * 0.18`, whatever the box.
   *
   * A field anchored `full` has to cross the frame and the same twelve bars in a
   * cell have to be a figure, and the only difference between the two is the box.
   */
  it('is the box, at every shape a scene can hand it', () => {
    for (const [name, box] of Object.entries(BOXES)) {
      const layout = equalizerLayout({ kind: 'equalizer', bars: 12 }, box, { radiusPx: 12 })
      expect(layout.height, name).toBe(box.height)
      expect(layout.width, name).toBe(box.width)
      const last = layout.bars[layout.bars.length - 1]
      expect(layout.bars[0].start, name).toBeGreaterThanOrEqual(0)
      expect(last.start + last.size, name).toBeLessThanOrEqual(box.width)
      // The row spans the measure: the first column starts at the edge and the
      // last ends on it, which is what "a field crosses the frame" means.
      expect(last.start + last.size, name).toBeGreaterThan(box.width * BOX_FILL_FLOOR)
    }
  })

  it('draws the count the document asked for, at every count the schema allows', () => {
    for (const bars of [4, 12, 24]) {
      const layout = equalizerLayout({ kind: 'equalizer', bars }, BOXES.cell, { radiusPx: 12 })
      expect(layout.bars, String(bars)).toHaveLength(bars)
      expect(layout.bars.length).toBe(equalizerLevels(bars, 'steady', 0.3).length)
    }
  })

  it('doubles its bars when its box doubles', () => {
    const small = equalizerLayout({ kind: 'equalizer', bars: 12 }, BOXES.cell, { radiusPx: 12 })
    const large = equalizerLayout({ kind: 'equalizer', bars: 12 }, doubled(BOXES.cell), { radiusPx: 12 })
    expect(large.height).toBe(2 * small.height)
    expect(large.bars[3].size / small.bars[3].size).toBeGreaterThan(1.9)
  })

  it('never draws a bar wide enough to read as a panel', () => {
    const layout = equalizerLayout({ kind: 'equalizer', bars: 4 }, BOXES.band, { radiusPx: 12 })
    for (const bar of layout.bars) expect(bar.size).toBeLessThanOrEqual(Math.round(BOXES.band.height * FIGURE_MAX_RATIO))
  })
})

describe('the wave, which hears nothing either', () => {
  it('stays inside its box at every shape and every moment', () => {
    for (const shape of ['pulse', 'sweep', 'breathe']) {
      for (const life of lives(150)) {
        for (const height of waveHeights(64, shape, life)) {
          expect(height, shape).toBeGreaterThanOrEqual(-1)
          expect(height, shape).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  /**
   * Zero at both ends, because a wave cut off mid-swing at the edge of its box
   * reads as a crop rather than as a figure.
   */
  it('opens from its axis and returns to it', () => {
    for (const shape of ['pulse', 'sweep', 'breathe']) {
      const heights = waveHeights(48, shape, 0.37)
      expect(heights[0], shape).toBeCloseTo(0, 10)
      expect(heights[heights.length - 1], shape).toBeCloseTo(0, 10)
    }
  })

  it('never flatlines: there is no frame that looks like a bug', () => {
    for (const shape of ['pulse', 'sweep', 'breathe']) {
      for (const life of lives(90)) expect(waveGain(shape, life), shape).toBeGreaterThan(0)
    }
  })

  it('carries several harmonics rather than one', () => {
    // Across the box at a fixed moment: one harmonic gives two turns per cycle
    // and the figure would read as a test signal.
    expect(turns(waveHeights(64, 'sweep', 0.3))).toBeGreaterThan(4)
  })

  it('travels on every frame of every scene length, at every shape', () => {
    for (const shape of ['pulse', 'sweep', 'breathe']) {
      for (const frames of SCENES) {
        const series = lives(frames).map((life) => waveHeights(48, shape, life))
        for (let f = 1; f < series.length; f++) {
          expect(series[f].some((v, i) => v !== series[f - 1][i]), `${shape}, ${frames} frames`).toBe(true)
        }
      }
    }
  })

  it('draws a different figure per shape, and reads an unknown one as the even one', () => {
    expect(waveHeights(48, 'pulse', 0.3)).not.toEqual(waveHeights(48, 'breathe', 0.3))
    expect(waveHeights(48, 'nonsense', 0.3)).toEqual(waveHeights(48, 'sweep', 0.3))
  })

  it('runs the length of its box and never past it', () => {
    for (const [name, box] of Object.entries(BOXES)) {
      const points = wavePoints(waveHeights(48, 'sweep', 0.4), box, 1)
      for (const point of points) {
        expect(point.x, name).toBeGreaterThanOrEqual(0)
        expect(point.x, name).toBeLessThanOrEqual(box.width)
        expect(point.y, name).toBeGreaterThanOrEqual(0)
        expect(point.y, name).toBeLessThanOrEqual(box.height)
      }
      const along = waveOrientation(box) === 'vertical' ? points.map((p) => p.y) : points.map((p) => p.x)
      expect(along[0], name).toBe(0)
      expect(along[along.length - 1], name).toBe(waveOrientation(box) === 'vertical' ? box.height : box.width)
    }
  })

  /**
   * The narrow box, which is the case nobody looks at and the one a model produces
   * the moment two blocks share a row. Five crests across 845 px of measure under
   * 950 px of band is a zigzag, so a wave in a tall box runs down it.
   */
  it('turns to run down a box that is taller than it is wide', () => {
    expect(waveOrientation(BOXES.column)).toBe('vertical')
    expect(waveOrientation(BOXES.band)).toBe('horizontal')
    expect(waveOrientation(BOXES.full)).toBe('horizontal')
    const points = wavePoints(waveHeights(48, 'sweep', 0.4), BOXES.column, 1)
    expect(points[0].y).toBe(0)
    expect(points[points.length - 1].y).toBe(BOXES.column.height)
  })

  it('opens out of its own axis rather than fading in at full height', () => {
    const flat = wavePoints(waveHeights(48, 'sweep', 0.4), BOXES.full, 0)
    for (const point of flat) expect(point.y).toBeCloseTo(BOXES.full.height / 2, 10)
  })

  it('draws its axis the length of the box, and its stroke off the frame', () => {
    const wide = waveLayout(BOXES.full, { base: 1080 })
    expect(wide.axis).toEqual({ x1: 0, y1: 475, x2: 1688, y2: 475 })
    const tall = waveLayout(BOXES.column, { base: 1080 })
    expect(tall.axis).toEqual({ x1: 240, y1: 0, x2: 240, y2: 820 })
    expect(waveLayout(BOXES.full, { base: 10800 }).stroke).toBeGreaterThan(wide.stroke)
  })
})

describe('the land mask', () => {
  it('is a rectangle, because a short row shifts every continent below it east', () => {
    expect(LAND_ROWS).toHaveLength(MAP_ROWS)
    for (const [i, row] of LAND_ROWS.entries()) expect(row.length, `row ${i}`).toBe(MAP_COLUMNS)
  })

  it('holds nothing but land and sea', () => {
    for (const [i, row] of LAND_ROWS.entries()) expect(row.replace(/[.#]/g, ''), `row ${i}`).toBe('')
  })

  it('is a silhouette and not an empty grid', () => {
    const land = LAND_ROWS.join('').split('').filter((c) => c === LAND_MARK).length
    // A third of the planet is land; a mask an order of magnitude off that is one
    // somebody replaced with a placeholder.
    expect(land / (MAP_COLUMNS * MAP_ROWS)).toBeGreaterThan(0.2)
    expect(land / (MAP_COLUMNS * MAP_ROWS)).toBeLessThan(0.5)
  })

  /**
   * The resolution is the fix, and this is the claim behind it.
   *
   * A window is a CROP of one mask, so the mask has to hold the smallest window's
   * worth of detail. At 5.6° per column `europe` was fourteen columns by nine
   * rows, which is not a coarse Europe but a cloud of nine dots — and `asia` and
   * `africa` were the same. Forty columns is a silhouette.
   */
  it('is fine enough that the smallest window is still a map', () => {
    for (const region of Object.keys(MAP_WINDOWS)) {
      const field = mapField(mapWindow(region), 1)
      expect(field.columns, region).toBeGreaterThanOrEqual(40)
      expect(field.rows, region).toBeGreaterThanOrEqual(24)
      expect(field.cells.length, region).toBeGreaterThan(300)
    }
  })
})

describe('a region, which is a crop of that one mask', () => {
  const regions = Object.keys(MAP_WINDOWS)

  it('never reaches outside the grid', () => {
    for (const region of regions) {
      const w = mapWindow(region)
      expect(w.col0, region).toBeGreaterThanOrEqual(0)
      expect(w.row0, region).toBeGreaterThanOrEqual(0)
      expect(w.col1, region).toBeLessThan(MAP_COLUMNS)
      expect(w.row1, region).toBeLessThan(MAP_ROWS)
      expect(w.col1, region).toBeGreaterThan(w.col0)
      expect(w.row1, region).toBeGreaterThan(w.row0)
    }
  })

  /**
   * The claim a crop makes, and the reason `region` is not a second drawing: a
   * coast is in one place, and `europe` and `world` cannot disagree about where.
   */
  it('shows cells the world shows, in the same places', () => {
    const world = new Set(mapField(mapWindow('world'), 1).cells.map((c) => `${c.col}.${c.row}`))
    for (const region of regions) {
      for (const cell of mapField(mapWindow(region), 1).cells) {
        expect(world.has(`${cell.col}.${cell.row}`), region).toBe(true)
      }
    }
  })

  it('has land in it, and reads an unknown name as the world', () => {
    expect(mapWindow('atlantis')).toEqual(MAP_WINDOWS.world)
    expect(mapWindow('constructor')).toEqual(MAP_WINDOWS.world)
  })

  it('positions every dot inside the viewBox its own extent describes', () => {
    for (const region of regions) {
      for (const stride of [1, 2, 3, 4]) {
        const field = mapField(mapWindow(region), stride)
        for (const cell of field.cells) {
          expect(cell.x, region).toBeGreaterThan(0)
          expect(cell.x, region).toBeLessThan(field.columns)
          expect(cell.y, region).toBeGreaterThan(0)
          expect(cell.y, region).toBeLessThan(field.rows)
        }
      }
    }
  })

  /**
   * Sampling coarser must not invent land. Every dot of a coarse field stands on a
   * block that held land in the fine one, which is what keeps `world` at sixty
   * columns the same drawing as `world` at a hundred and eighty.
   */
  it('never puts a dot where the mask has no land at all', () => {
    for (const stride of [2, 3, 4]) {
      for (const cell of mapField(mapWindow('world'), stride).cells) {
        let land = 0
        for (let dr = 0; dr < stride; dr++) {
          for (let dc = 0; dc < stride; dc++) {
            if (LAND_ROWS[cell.row + dr]?.[cell.col + dc] === LAND_MARK) land += 1
          }
        }
        expect(land, `${cell.col}.${cell.row} at ${stride}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('the crop a box asks for', () => {
  it('is the region itself when there is no box to shape it', () => {
    for (const region of Object.keys(MAP_WINDOWS)) {
      expect(mapCrop(region, null)).toEqual(mapWindow(region))
      expect(mapCrop(region, { width: 0, height: 0 })).toEqual(mapWindow(region))
    }
  })

  it('only ever opens the window, never closes it, and never leaves the mask', () => {
    for (const region of Object.keys(MAP_WINDOWS)) {
      const named = mapWindow(region)
      for (const box of Object.values(BOXES)) {
        const crop = mapCrop(region, box)
        expect(crop.col1 - crop.col0 + 1, region).toBeGreaterThanOrEqual(named.col1 - named.col0 + 1)
        expect(crop.row1 - crop.row0 + 1, region).toBeGreaterThanOrEqual(named.row1 - named.row0 + 1)
        expect(crop.col0, region).toBeGreaterThanOrEqual(0)
        expect(crop.row0, region).toBeGreaterThanOrEqual(0)
        expect(crop.col1, region).toBeLessThan(MAP_COLUMNS)
        expect(crop.row1, region).toBeLessThan(MAP_ROWS)
      }
    }
  })

  /**
   * Bounded, because a `europe` opened until it fitted a banner would be the world
   * with a French accent. Half again is the whole allowance.
   */
  it('never opens a window past half again its own size', () => {
    const named = mapWindow('europe')
    const wide = mapCrop('europe', { width: 4000, height: 200 })
    expect(wide.col1 - wide.col0 + 1).toBeLessThanOrEqual(Math.round((named.col1 - named.col0 + 1) * MAP_CROP_GROWTH))
  })
})

describe('how finely the mask is sampled', () => {
  it('never draws finer than the resolution that reads', () => {
    for (const region of Object.keys(MAP_WINDOWS)) {
      for (const box of Object.values(BOXES)) {
        const crop = mapCrop(region, box)
        const { field } = mapSampling(crop, box)
        expect(field.columns, region).toBeLessThanOrEqual(MAP_TARGET_COLUMNS + 1)
      }
    }
  })

  it('gives a dot the pixels it needs, or samples coarser until it can', () => {
    for (const region of Object.keys(MAP_WINDOWS)) {
      for (const [name, box] of Object.entries(BOXES)) {
        const crop = mapCrop(region, box)
        const { field } = mapSampling(crop, box)
        const pitch = Math.min(box.width / field.columns, box.height / field.rows)
        // A 4 px dot beside a 4 px gap is a grey rectangle, not a map.
        expect(pitch, `${region} in ${name}`).toBeGreaterThanOrEqual(MAP_MIN_PITCH - 1)
      }
    }
  })

  /**
   * The one quantity in this family that is a RENDER cost: a dot is a React
   * element on each of a scene's 450 frames.
   */
  it('holds the dot count under its ceiling, whatever the crop', () => {
    for (const region of Object.keys(MAP_WINDOWS)) {
      for (const box of Object.values(BOXES)) {
        expect(mapSampling(mapCrop(region, box), box).field.cells.length, region).toBeLessThanOrEqual(MAP_MAX_DOTS)
      }
    }
    // And the ceiling is reachable rather than decorative: the whole mask at
    // stride 1 is five thousand dots, and the sampling is what refuses it.
    const huge = { width: 8000, height: 4000 }
    expect(mapField(mapWindow('world'), 1).cells.length).toBeGreaterThan(MAP_MAX_DOTS)
    expect(mapSampling(mapWindow('world'), huge).field.cells.length).toBeLessThanOrEqual(MAP_MAX_DOTS)
  })

  it('answers a stride without a box, so the crop can be checked on its own', () => {
    expect(mapStride(mapWindow('world'), null)).toBe(Math.ceil(MAP_COLUMNS / MAP_TARGET_COLUMNS))
    expect(mapStride(mapWindow('europe'), null)).toBe(1)
  })
})

describe('a map, in the box it was given', () => {
  it('fills one axis of its box exactly and never crosses the other', () => {
    for (const region of Object.keys(MAP_WINDOWS)) {
      for (const [name, box] of Object.entries(BOXES)) {
        const layout = mapLayout({ kind: 'map', region }, box, { base: 1080 })
        expect(layout.width, `${region} in ${name}`).toBeLessThanOrEqual(box.width)
        expect(layout.height, `${region} in ${name}`).toBeLessThanOrEqual(box.height)
        // `base * 0.42` is gone: a map given the safe area is the size of the safe
        // area on whichever axis runs out first.
        const fills = layout.width >= box.width - 1 || layout.height >= box.height - 1
        expect(fills, `${region} in ${name}`).toBe(true)
      }
    }
  })

  it('doubles when its box doubles', () => {
    const small = mapLayout({ kind: 'map', region: 'world' }, BOXES.cell, { base: 1080 })
    const large = mapLayout({ kind: 'map', region: 'world' }, doubled(BOXES.cell), { base: 1080 })
    expect(large.width / small.width).toBeGreaterThan(1.5)
    expect(large.height / small.height).toBeGreaterThan(1.5)
  })

  it('reads the frame for its hairline and for nothing else', () => {
    const near = mapLayout({ kind: 'map', region: 'europe' }, BOXES.cell, { base: 1080 })
    const far = mapLayout({ kind: 'map', region: 'europe' }, BOXES.cell, { base: 10800 })
    expect(far.width).toBe(near.width)
    expect(far.cells.length).toBe(near.cells.length)
    expect(far.stroke).toBeGreaterThan(near.stroke)
  })
})

describe('the markers, whose positions are the composition’s', () => {
  const fieldOf = (region) => mapField(mapWindow(region), 2).cells

  it('gives the document the count it asked for', () => {
    for (const region of Object.keys(MAP_WINDOWS)) {
      const cells = fieldOf(region)
      for (const markers of [0, 1, 3, 8]) {
        expect(markerCells(cells, markers), `${region}, ${markers}`).toHaveLength(markers)
      }
    }
  })

  /**
   * The property worth having: a marker in the middle of an ocean is the frame
   * everybody sees.
   */
  it('puts every one of them on land, and never two on one dot', () => {
    for (const region of Object.keys(MAP_WINDOWS)) {
      const cells = fieldOf(region)
      const land = new Set(cells.map((c) => `${c.col}.${c.row}`))
      const markers = markerCells(cells, 8)
      for (const marker of markers) expect(land.has(`${marker.col}.${marker.row}`), region).toBe(true)
      expect(new Set(markers.map((m) => `${m.col}.${m.row}`)).size, region).toBe(8)
    }
  })

  it('asks for no more than the field can hold, and answers an empty one', () => {
    expect(markerCells([], 4)).toEqual([])
    expect(markerCells(fieldOf('world').slice(0, 3), 8)).toHaveLength(3)
    expect(markerCells(fieldOf('world'), -2)).toEqual([])
  })

  it('picks the same places twice', () => {
    expect(markerCells(fieldOf('asia'), 5)).toEqual(markerCells(fieldOf('asia'), 5))
  })

  it('pulses each one in its own part of the cycle', () => {
    for (const life of lives(150)) {
      const pulses = Array.from({ length: 8 }, (_, i) => markerPulse(life, i))
      for (const pulse of pulses) {
        expect(pulse).toBeGreaterThanOrEqual(0)
        expect(pulse).toBeLessThanOrEqual(1)
      }
      // Eight markers blinking together read as a status board rather than as
      // eight places.
      expect(new Set(pulses.map((p) => p.toFixed(6))).size).toBeGreaterThan(1)
    }
  })
})

describe('the links between them', () => {
  it('bows off the chord, by an amount that grows with the distance', () => {
    const a = { x: 0, y: 0 }
    const near = { x: 4, y: 0 }
    const far = { x: 12, y: 0 }
    expect(Math.abs(arcControl(a, near).y)).toBeCloseTo(ARC_BULGE * 4, 10)
    expect(Math.abs(arcControl(a, far).y)).toBeCloseTo(ARC_BULGE * 12, 10)
  })

  it('answers for two markers on one point rather than dividing by nothing', () => {
    expect(arcControl({ x: 3, y: 5 }, { x: 3, y: 5 })).toEqual({ x: 3, y: 5 })
  })

  it('starts at one marker and ends at the other', () => {
    const a = { x: 1, y: 2 }
    const b = { x: 9, y: 6 }
    const control = arcControl(a, b)
    expect(bezierPoint(a, control, b, 0)).toEqual(a)
    expect(bezierPoint(a, control, b, 1)).toEqual(b)
    // And it leaves the chord in between, which is what makes it an arc.
    expect(bezierPoint(a, control, b, 0.5).y).not.toBeCloseTo(4, 6)
  })

  it('sends a pulse across every link, on every frame of every scene length', () => {
    for (const frames of SCENES) {
      const series = lives(frames).map((life) => [0, 1, 2].map((i) => linkPulse(life, i)))
      for (const moment of series) for (const p of moment) {
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThan(1)
      }
      for (let f = 1; f < series.length; f++) {
        expect(series[f].some((v, i) => v !== series[f - 1][i]), `${frames} frames`).toBe(true)
      }
    }
  })
})

describe('the meridian sweeping the field', () => {
  const columnsOf = (region) => mapField(mapWindow(region), 2).columns

  it('never lights a dot past what the palette measured, nor loses the field entirely', () => {
    for (const region of Object.keys(MAP_WINDOWS)) {
      const columns = columnsOf(region)
      for (const life of lives(90)) {
        for (let c = 0; c < columns; c++) {
          expect(columnGlow(c, columns, life), region).toBeGreaterThanOrEqual(FIELD_QUIET)
          expect(columnGlow(c, columns, life), region).toBeLessThanOrEqual(FIELD_LIT)
        }
      }
    }
  })

  it('always has something lit, however narrow the crop', () => {
    for (const region of Object.keys(MAP_WINDOWS)) {
      const columns = columnsOf(region)
      for (const life of lives(60)) {
        const field = Array.from({ length: columns }, (_, c) => columnGlow(c, columns, life))
        expect(Math.max(...field), region).toBeGreaterThan(FIELD_QUIET)
      }
    }
  })

  it('moves on every frame of every scene length', () => {
    for (const region of ['world', 'europe']) {
      const columns = columnsOf(region)
      for (const frames of SCENES) {
        const series = lives(frames).map((life) =>
          Array.from({ length: columns }, (_, c) => columnGlow(c, columns, life)),
        )
        for (let f = 1; f < series.length; f++) {
          expect(series[f].some((v, i) => v !== series[f - 1][i]), `${region}, ${frames} frames`).toBe(true)
        }
      }
    }
  })

  it('wraps, so the sweep leaves one edge and arrives at the other', () => {
    // The column at the far edge is lit while the sweep is still at the near one:
    // an unwrapped distance makes the meridian stop dead at the right-hand side.
    expect(columnGlow(63, 64, 0)).toBeGreaterThan(FIELD_QUIET)
  })
})
