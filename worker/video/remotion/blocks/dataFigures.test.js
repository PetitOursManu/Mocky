// The arithmetic of the five data blocks.
//
// It is the only part of them a test can reach: a `.jsx` file cannot be imported
// here — Remotion is not installed at the root and never will be — so everything
// worth asserting about a bar, a series, a motif or a map was written as a
// function over numbers, and this is the file that holds it to its word.
//
// Three claims run through the whole file and each one is a bug that shipped
// somewhere in this repository before it was a rule:
//
//   1. **Nothing holds still.** A film in which nothing moves must not be
//      producible by accident (`DEFAULT_KEN_BURNS`), and a block that arrives and
//      then freezes for fourteen seconds is that failure one level down. Every
//      continuous figure below is sampled frame by frame across the whole range of
//      scene lengths the schema accepts, and no frame may equal the one before it.
//   2. **A value is not an ornament.** A bar's height is the number the document
//      stated; the things that move continuously are the marks around it.
//   3. **Deterministic, always.** Two renders of one document have to produce the
//      same frames or the content-addressed export store keeps two files for one
//      film.
import { describe, it, expect } from 'vitest'
import {
  ARC_BULGE,
  AXIS_SWEEP_CYCLES,
  BAR_CASCADE,
  EQUALIZER_CYCLES,
  FIELD_LIT,
  FIELD_QUIET,
  LAND_MARK,
  LAND_ROWS,
  MAP_COLUMNS,
  MAP_ROWS,
  MAP_WINDOWS,
  MOTIF_FLOOR,
  PING_REACH,
  arcControl,
  axisTick,
  barGrowths,
  bezierPoint,
  columnGlow,
  equalizerLevels,
  linkPulse,
  mapCells,
  mapExtent,
  mapWindow,
  markerCells,
  markerPulse,
  pingFade,
  pingPhase,
  pingReach,
  pointAtX,
  seriesPoints,
  tracedPoints,
  waveGain,
  waveHeights,
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
    const world = new Set(mapCells('world').map((c) => `${c.col}.${c.row}`))
    for (const region of regions) {
      for (const cell of mapCells(region)) expect(world.has(`${cell.col}.${cell.row}`), region).toBe(true)
    }
  })

  it('has land in it, and reads an unknown name as the world', () => {
    for (const region of regions) expect(mapCells(region).length, region).toBeGreaterThan(20)
    expect(mapCells('atlantis')).toEqual(mapCells('world'))
    expect(mapWindow('constructor')).toEqual(MAP_WINDOWS.world)
  })

  it('positions every dot inside the viewBox its extent describes', () => {
    for (const region of regions) {
      const { columns, rows } = mapExtent(region)
      expect(columns, region).toBe(mapWindow(region).col1 - mapWindow(region).col0 + 1)
      for (const cell of mapCells(region)) {
        expect(cell.x, region).toBeGreaterThan(0)
        expect(cell.x, region).toBeLessThan(columns)
        expect(cell.y, region).toBeGreaterThan(0)
        expect(cell.y, region).toBeLessThan(rows)
      }
    }
  })
})

describe('the markers, whose positions are the composition’s', () => {
  it('gives the document the count it asked for', () => {
    for (const region of Object.keys(MAP_WINDOWS)) {
      const cells = mapCells(region)
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
      const cells = mapCells(region)
      const land = new Set(cells.map((c) => `${c.col}.${c.row}`))
      const markers = markerCells(cells, 8)
      for (const marker of markers) expect(land.has(`${marker.col}.${marker.row}`), region).toBe(true)
      expect(new Set(markers.map((m) => `${m.col}.${m.row}`)).size, region).toBe(8)
    }
  })

  it('asks for no more than the field can hold, and answers an empty one', () => {
    expect(markerCells([], 4)).toEqual([])
    expect(markerCells(mapCells('world').slice(0, 3), 8)).toHaveLength(3)
    expect(markerCells(mapCells('world'), -2)).toEqual([])
  })

  it('picks the same places twice', () => {
    expect(markerCells(mapCells('asia'), 5)).toEqual(markerCells(mapCells('asia'), 5))
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
  it('never lights a dot past what the palette measured, nor loses the field entirely', () => {
    for (const region of Object.keys(MAP_WINDOWS)) {
      const { columns } = mapExtent(region)
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
      const { columns } = mapExtent(region)
      for (const life of lives(60)) {
        const field = Array.from({ length: columns }, (_, c) => columnGlow(c, columns, life))
        expect(Math.max(...field), region).toBeGreaterThan(FIELD_QUIET)
      }
    }
  })

  it('moves on every frame of every scene length', () => {
    for (const region of ['world', 'europe']) {
      const { columns } = mapExtent(region)
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
