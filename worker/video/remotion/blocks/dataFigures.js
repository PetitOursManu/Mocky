/**
 * The arithmetic of the five DATA blocks: bars, series, motifs, and a map.
 *
 * ── Why this file exists, and where it would rather live ────────────────────
 *
 * A `.jsx` file cannot be loaded by Mocky's own suite — Remotion is not installed
 * at the root and never will be, because its licence is the reason the worker is
 * a separate image at all. So the only part of a block a test can hold is the
 * part that is not JSX, and that is this file: every quantity these five blocks
 * draw, as plain functions over plain numbers. It is the same argument
 * `composition.js` opens with, applied one level down.
 *
 * `composition.js` is where anything SHARED goes, and `index.js` says so for a
 * good reason: a helper in the blocks directory is a helper twenty-four authors
 * edit. This file is not that — it is one family's own geometry, owned by
 * whoever owns the five components beside it — and it is here rather than in
 * `composition.js` because the five were written in parallel with five other
 * families and a shared file is exactly what that arrangement could not afford.
 * If a reviewer would rather see it merged upwards, nothing in it resists: it
 * imports nothing and holds no state.
 *
 * ── The rules it keeps, which are the blocks' rules ─────────────────────────
 *
 *   - **No colour.** The opacities here are how loud a decoration is, never what
 *     colour it is; every colour arrives through `composedPalette`.
 *   - **No easing curve.** `progress` reaches a block already eased by
 *     `cueProgress`, so anything here that reads it is a WINDOW on that one
 *     arrival, never a second shape. The cadences are sums of sines, which is a
 *     rhythm and not an entrance.
 *   - **Deterministic, always.** No clock, no random, no time of day. Two renders
 *     of one document must produce identical frames or the content-addressed
 *     export store is storing two files for one film.
 *
 * ── The cadences are per SCENE, not per second ──────────────────────────────
 *
 * A block receives `progress` and `life` and no duration, so every rhythm below
 * counts cycles across the scene it is in. A four-cycle equalizer beats at 2.7 Hz
 * on a 1.5 s scene and at 0.27 Hz on a 15 s one — the same figure, ten times
 * slower. That is a real limitation and it is the schema's floor and ceiling that
 * bound it, so the counts are chosen to read at both ends rather than to be right
 * in the middle. Giving a block its own `durationInFrames` would fix it properly;
 * that is a change to the composition's props and not to a block.
 */

/**
 * The golden ratio, used everywhere below as a frequency ratio and an index
 * stride — never as a proportion anybody looks at.
 *
 * Its continued fraction is the slowest-converging one there is, which is the
 * whole reason it is here: two components whose rates are 1 and φ never line up
 * inside a scene, so an equalizer does not settle into a visible beat and a row of
 * bars never reads as one bar repeated. A ratio like 2 or 3/2 does exactly that
 * within a second, which is what made the first waveform read as a test signal.
 */
const PHI = 1.618033988749895

/** `x`, clamped to the unit interval, with anything unreadable landing at 0. */
function unit(x) {
  const n = Number(x)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
}

/**
 * A whole count of at least `min`.
 *
 * Every field these functions read has been bounded by three validators before a
 * frame is drawn, so this is not a repair — it is what keeps a test, or a caller
 * built by hand, from putting a `NaN` into a `d` attribute where it becomes an
 * SVG that silently draws nothing.
 */
function count(n, min = 1) {
  const v = Math.trunc(Number(n))
  return Number.isFinite(v) && v > min ? v : min
}

// ── barChart ─────────────────────────────────────────────────────────────────

/**
 * How much of the arrival is spent staggering the bars rather than growing them.
 *
 * A chart whose columns all rise together reads as one object fading in; a
 * cascade reads as a chart being drawn, which is the difference between a figure
 * and a slide. 45% is the share that still leaves every bar more than half the
 * arrival to travel — a stagger that eats the whole window turns the last bar
 * into a flicker at the end.
 *
 * It is a WINDOW on `progress` and not a second curve, which matters: `progress`
 * arrives already eased by `cueProgress`, so what a bar walks is the house's own
 * shape offset in time. Re-easing it here would be the twenty-fifth notion of how
 * things move that `blocks.test.js` looks for by name.
 */
export const BAR_CASCADE = 0.45

/**
 * Each bar's own share of the arrival, in the order the document listed them.
 *
 * Every bar finishes at `progress === 1` — the cascade delays a start, it never
 * moves an end. A stagger that pushed the last bar past the arrival would leave a
 * chart still assembling itself after the block's cue is over, which is a scene
 * that looks unfinished on the frame the next one cuts from.
 */
export function barGrowths(bars, progress) {
  const total = count(bars)
  const p = unit(progress)
  if (total === 1) return [p]
  const span = 1 - BAR_CASCADE
  // `(i / last) * BAR_CASCADE` and not `i * (BAR_CASCADE / last)`, which is the
  // same number in arithmetic and not in floating point: the second form leaves
  // the last bar starting at 0.4499999999999999, so at the end of the arrival it
  // stands at 0.9999999999999998 — a column a pixel short of its own value, on
  // every chart, for the rest of the scene.
  return Array.from({ length: total }, (_, i) => unit((p - (i / (total - 1)) * BAR_CASCADE) / span))
}

/**
 * Where the reading mark sits on the axis, as a fraction of its length.
 *
 * The bars must NOT move once they have grown: their height is the value the
 * document stated, and a column that breathes is a number that wobbles. So the
 * continuous motion of a bar chart belongs to the axis, where it is plainly an
 * ornament — a mark that scrubs along the baseline the way an eye does.
 *
 * Two rates rather than one, for the reason `PHI` is here at all: a single sine
 * is a metronome, and a metronome under a chart is the thing that makes a film
 * read as generated. The amplitudes sum to exactly 0.5, so the mark stays on the
 * axis without a clamp — and a clamp would be a flat spot, which is the one thing
 * a continuous motion cannot have.
 */
export const AXIS_SWEEP_CYCLES = 1.5
export const AXIS_WOBBLE_CYCLES = 3.7

export function axisTick(life) {
  const t = unit(life) * Math.PI * 2
  return 0.5 + 0.4 * Math.sin(t * AXIS_SWEEP_CYCLES) + 0.1 * Math.sin(t * AXIS_WOBBLE_CYCLES + 1.1)
}

// ── lineChart ────────────────────────────────────────────────────────────────

/**
 * The series as points in the unit square, `y` measured DOWNWARD.
 *
 * Normalised rather than in pixels because a block does not know how wide its box
 * is — `composedLayout` owns the boxes and hands the component only the frame's
 * short edge. So the chart is drawn in a unit box that CSS stretches, and
 * everything round (the head, its ping) is positioned in percent by the component
 * instead of being drawn inside that box, where a non-uniform stretch would turn
 * a circle into an ellipse.
 *
 * A single value is a point and not a line: `x` divides by `length - 1`, so the
 * degenerate case is answered here rather than by a NaN travelling into a `d`
 * attribute. The schema's floor is two, and this is the belt.
 */
export function seriesPoints(values) {
  const series = Array.isArray(values) ? values.filter((v) => Number.isFinite(Number(v))) : []
  if (series.length === 0) return []
  const last = series.length - 1
  return series.map((value, i) => ({
    x: last === 0 ? 0.5 : i / last,
    // The schema bounds a value to 0–100 and the height IS the value, so nothing
    // here rescales to the data's own range: a chart in a film has no axis anybody
    // reads at a glance, and an auto-scale would make two scenes with the same
    // number draw two different heights.
    y: 1 - unit(Number(value) / 100),
  }))
}

/**
 * The curve's height at a horizontal position, by straight interpolation.
 *
 * This is what the head of the trace rides. The reveal is a left-to-right wipe
 * rather than a dash offset, so the head is at `x = progress` exactly — a
 * `strokeDashoffset` walks the path by ARC length, which under the non-uniform
 * stretch above is not the same point, and the dot would drift off its own line.
 */
export function pointAtX(points, x) {
  const list = Array.isArray(points) ? points : []
  if (list.length === 0) return { x: 0, y: 1 }
  const at = unit(x)
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1]
    const b = list[i]
    if (at <= b.x) {
      const span = b.x - a.x
      const t = span > 0 ? (at - a.x) / span : 0
      return { x: at, y: a.y + (b.y - a.y) * t }
    }
  }
  return { x: at, y: list[list.length - 1].y }
}

/**
 * The part of the series that has been drawn: the points up to `x`, plus the one
 * the curve is passing through right now.
 *
 * The trace is a shorter POLYLINE and not a clipped long one, which is a
 * correctness decision rather than a taste. A clip needs an `id` in the document,
 * two charts in one film would share it — during a crossfade both scenes are
 * mounted at once — and the first definition wins, so one chart would reveal
 * itself at the other's rate. A `strokeDashoffset` avoids the id and buys a worse
 * bug: it walks the path by arc length, which under the horizontal stretch this
 * block is drawn in is not the position the head is placed at.
 *
 * Fewer points also means less to draw on the frames where least is visible,
 * which is the right way round for a render budget scaled on duration.
 */
export function tracedPoints(points, x) {
  const list = Array.isArray(points) ? points : []
  if (list.length === 0) return []
  const at = unit(x)
  const drawn = list.filter((p) => p.x <= at)
  // The head is only appended when it is not already the last point, so a trace
  // that lands exactly on a sample does not draw that sample twice — a repeated
  // vertex in a `points` list is a mitre the renderer draws at zero length, which
  // shows up as a nick in the stroke.
  if (drawn.length === 0 || drawn[drawn.length - 1].x < at) drawn.push(pointAtX(list, at))
  return drawn
}

/**
 * The ping that keeps a finished chart alive: how far through its expansion the
 * ring is, on a loop.
 *
 * A traced line is a block that moves once and then holds, which is the failure
 * `DEFAULT_KEN_BURNS` is about, one level down. The ring is the honest way to keep
 * it moving: it marks the last point of the series and says nothing about the
 * data — the alternative, a chart that keeps redrawing itself, claims the numbers
 * changed.
 *
 * A sawtooth and not a sine, because a ping restarts rather than reverses.
 */
export const PING_CYCLES = 3

export function pingPhase(life) {
  return (unit(life) * PING_CYCLES) % 1
}

/** The ring's radius, as a multiple of the head's own; it grows for the whole cycle. */
export const PING_REACH = 3.4

export function pingReach(phase) {
  return 1 + (PING_REACH - 1) * unit(phase)
}

/** And its opacity, which fades as it reaches. A ring that vanished at full size would blink. */
export const PING_ALPHA = 0.5

export function pingFade(phase) {
  return PING_ALPHA * (1 - unit(phase))
}

// ── equalizer and soundWave: motifs, and there is no audio ──────────────────
//
// Neither of these hears anything. This feature has no audio track, no
// `@remotion/media-utils`, no file and no field to ask for one — the schema is
// `.strict()` from top to bottom precisely so that a document asking for a track
// is refused whole rather than rendering silence and being reported as a success.
//
// What follows is therefore a FIGURE driven by a fixed function of the frame
// number, and the one thing that would make it a lie is a component claiming to
// listen. Nothing does. The multiple frequencies below are not a spectrum: they
// are what stops a row of bars from reading as one bar repeated, which is the
// only thing a single sine ever produces.

/** How many times the figure comes round in one scene, per tempo. See the note on cadences above. */
export const EQUALIZER_CYCLES = { slow: 2, steady: 4, fast: 8 }

/** How short the quietest bar gets. Zero would leave gaps in the row, which reads as bars that broke. */
export const MOTIF_FLOOR = 0.18

/**
 * Every bar's height, as a fraction of the block's own.
 *
 * Three components at 1, φ and 1/φ, so the figure never repeats inside a scene,
 * and a phase per bar off φ as well: a stride that is a simple fraction of 2π
 * puts bars 1 and 5 in step, and a row with a visible period in it is a row that
 * reads as wallpaper.
 *
 * The weights sum to exactly 1, which is what keeps the result inside
 * `[MOTIF_FLOOR, 1]` without a clamp — and a clamp is a flat top, where the figure
 * would hold still for a few frames at every peak.
 */
export function equalizerLevels(bars, tempo, life) {
  const total = count(bars)
  const cycles = Object.hasOwn(EQUALIZER_CYCLES, String(tempo))
    ? EQUALIZER_CYCLES[tempo]
    : EQUALIZER_CYCLES.steady
  const t = unit(life) * Math.PI * 2 * cycles
  return Array.from({ length: total }, (_, i) => {
    const spread = i * PHI
    const mix =
      0.5 * Math.sin(t + spread * 2) +
      0.3 * Math.sin(t * PHI + spread * 5) +
      0.2 * Math.sin(t / PHI + spread)
    return MOTIF_FLOOR + (1 - MOTIF_FLOOR) * (0.5 + 0.5 * mix)
  })
}

/** How fast the wave travels, per shape. A rate, never a frequency in hertz: see the cadence note. */
export const WAVE_TRAVEL = { pulse: 3, sweep: 1.6, breathe: 0.7 }

/**
 * How loud the wave is at a moment, per shape — the difference between the three
 * beyond their speed.
 *
 * `sweep` is even, `pulse` throbs, `breathe` swells slowly. All three stay at or
 * below 1 so the sample heights below never leave `[-1, 1]`, and none of them ever
 * reaches 0: a waveform that flatlines is the one frame that looks like a bug.
 */
export function waveGain(shape, life) {
  const t = unit(life) * Math.PI * 2
  if (shape === 'pulse') return 0.62 + 0.38 * Math.sin(t * 3 * PHI)
  if (shape === 'breathe') return 0.72 + 0.28 * Math.sin(t * 0.5)
  return 1
}

/**
 * The waveform, sample by sample, as heights in `[-1, 1]`.
 *
 * An envelope that reaches zero at both ends, because a wave cut off mid-swing at
 * the edge of its box reads as a crop rather than as a figure. Three harmonics
 * travelling at ratios of 1, φ and a slow counter-drift, for the reason above:
 * one sine is a test signal.
 */
export function waveHeights(samples, shape, life) {
  const total = count(samples, 2)
  const travel = unit(life) * Math.PI * 2 * (WAVE_TRAVEL[shape] ?? WAVE_TRAVEL.sweep)
  const gain = waveGain(shape, life)
  return Array.from({ length: total }, (_, i) => {
    const t = i / (total - 1)
    const envelope = Math.sin(Math.PI * t)
    const wave =
      0.55 * Math.sin(t * Math.PI * 2 * 2.5 - travel) +
      0.3 * Math.sin(t * Math.PI * 2 * 5.5 - travel * PHI) +
      0.15 * Math.sin(t * Math.PI * 2 * 9 + travel * 0.7)
    return envelope * gain * wave
  })
}

// ── map ──────────────────────────────────────────────────────────────────────
//
// A schematic planisphere, as a field of dots, and everything about it is a
// deliberate limit rather than a first version.
//
// The container has no egress and no map asset, so whatever a composition draws
// has to fit in a source file. What fits is a coarse LAND MASK — a plate carrée
// grid at 5.6° per column and 4.4° per row, where a cell is land when its centre
// falls on land. That resolution is the honest part: it is far too coarse to draw
// a border, a coastline or a disputed line, so it does not draw one. There are no
// names, no frontiers, no islands smaller than a dot, and no country is
// identifiable except by its shape at continental scale.
//
// Antarctica is out of the window rather than absent from the mask: the field
// stops at 54°S, because on a plate carrée the pole stretches into a solid band
// across the bottom of every frame it appears in and says nothing.
//
// A region is a CROP of this one mask and never a second drawing, which is what
// keeps `europe` and `world` from disagreeing about where a coast is.

/** The character a land cell is written with. Everything else in a row is sea. */
export const LAND_MARK = '#'

export const MAP_COLUMNS = 64
export const MAP_ROWS = 30
/** The window the mask itself covers, in degrees. Plate carrée: one cell is one rectangle of it. */
export const MAP_NORTH = 78
export const MAP_SOUTH = -54

/**
 * The mask, one string per row of latitude, north first.
 *
 * Generated once by rasterising a dozen coarse polygons and pasted here, because
 * a generator in the source is a dependency on the generator: what ships is the
 * picture, and a reviewer can read it as a picture. Every row is `MAP_COLUMNS`
 * long and `dataFigures.test.js` asserts it, since a row one character short
 * would silently shift a continent east for the rows below it.
 */
export const LAND_ROWS = [
  '......................######....................####............',
  '...............##.....######...............#####################',
  '..#################...#####.......#############################.',
  '..##################...##........############################...',
  '...#....#############.............#######################.......',
  '.........#############.........#.########################.......',
  '..........############..........#########################.......',
  '..........##########...........#########################........',
  '..........#########...........##..#####################.........',
  '...........########...........##....##################..#.......',
  '...........#######..............#####.################..........',
  '............###..#............#######################...........',
  '.............##...............############..#########...........',
  '..............##.............#############...##..##.............',
  '................#............############....##..##..#..........',
  '.................####.........###########.........#..#..........',
  '..................#####.......##########..........#.............',
  '..................######.........#######...........##...........',
  '..................#######.........#####...........#.....#.......',
  '...................#######........#####............#.....#......',
  '...................######.........#####................#........',
  '...................######.........#####.#.............####......',
  '....................####..........#####.#...........######......',
  '...................####............###..............#######.....',
  '...................####............##...............#######.....',
  '...................###..................................###.....',
  '...................##.........................................##',
  '...................##.........................................#.',
  '...................##...........................................',
  '...................#............................................',
]

/**
 * Which part of the mask each region shows, as inclusive cell indices.
 *
 * Cells and not degrees, so a window can only ever be a crop of the grid that
 * exists — a window in degrees would need rounding, and a rounding that landed
 * half a cell out would draw a column of sea down the side of every continent.
 * `dataFigures.test.js` asserts each one is inside the world's and that its cells
 * are a subset of the world's, which is the whole claim a crop makes.
 */
export const MAP_WINDOWS = {
  world: { col0: 0, col1: MAP_COLUMNS - 1, row0: 0, row1: MAP_ROWS - 1 },
  // 22°W–58°E, 67°N–32°N. Starts below the Greenland cells rather than at the
  // meridian, because a lone dot in a corner reads as dirt on the lens.
  europe: { col0: 28, col1: 41, row0: 2, row1: 10 },
  americas: { col0: 1, col1: 26, row0: 0, row1: MAP_ROWS - 1 },
  asia: { col0: 36, col1: 58, row0: 0, row1: 17 },
  africa: { col0: 28, col1: 41, row0: 10, row1: 24 },
}

/** The window a region names, or the world. An unknown name was refused by `validate.js` long ago (Q1). */
export function mapWindow(region) {
  return Object.hasOwn(MAP_WINDOWS, String(region)) ? MAP_WINDOWS[region] : MAP_WINDOWS.world
}

/** How many cells wide and tall a region is — the SVG's own viewBox, so the dots stay round. */
export function mapExtent(region) {
  const w = mapWindow(region)
  return { columns: w.col1 - w.col0 + 1, rows: w.row1 - w.row0 + 1 }
}

/**
 * Every land cell of a region, positioned in cell units within the crop.
 *
 * `x` and `y` are cell CENTRES, so a dot drawn at that point sits in the middle
 * of its cell whatever the viewBox is scaled to. The order is row-major, north to
 * south, which is what makes the marker stride below spread over the whole field
 * rather than along one latitude.
 */
export function mapCells(region) {
  const w = mapWindow(region)
  const cells = []
  for (let row = w.row0; row <= w.row1; row++) {
    const line = LAND_ROWS[row] ?? ''
    for (let col = w.col0; col <= w.col1; col++) {
      if (line[col] === LAND_MARK) {
        cells.push({ col, row, x: col - w.col0 + 0.5, y: row - w.row0 + 0.5 })
      }
    }
  }
  return cells
}

/**
 * Where the markers go — decided HERE, which is the point.
 *
 * The schema carries a count and nothing else: a document that placed its markers
 * would be placing pixels, and a latitude is a coordinate under another name. So
 * the positions are the composition's, and they are a golden-ratio stride over
 * the land cells — a low-discrepancy walk, which spreads them over the whole
 * field instead of clustering them the way a fixed stride over a row-major list
 * does.
 *
 * They always land ON land, which is the property worth having and the one the
 * test asserts: a marker in the middle of an ocean is the frame everybody sees.
 */
const GOLDEN_STRIDE = 0.6180339887498949

export function markerCells(cells, markers) {
  const list = Array.isArray(cells) ? cells : []
  const wanted = Math.min(Math.max(0, Math.trunc(Number(markers)) || 0), list.length)
  const taken = new Set()
  const out = []
  for (let k = 0; out.length < wanted; k++) {
    let at = Math.floor((((k + 1) * GOLDEN_STRIDE) % 1) * list.length)
    // The stride is low-discrepancy, not injective: two of the first eight can
    // still round into one cell on a small crop, and two markers on one dot is a
    // count the document asked for and did not get.
    while (taken.has(at)) at = (at + 1) % list.length
    taken.add(at)
    out.push(list[at])
  }
  return out
}

/** How many times a marker comes round in one scene. Slow: a marker is a place, not an alarm. */
export const MARKER_PULSES = 2.5

/**
 * How lit a marker is, on its own phase.
 *
 * The phase stride is φ turns, so eight markers pulse in eight different parts of
 * the cycle: markers in step read as a blinking row, which is the one thing that
 * would make a field of places look like a status board.
 */
export function markerPulse(life, index) {
  const at = Number.isFinite(Number(index)) ? Number(index) : 0
  return 0.5 + 0.5 * Math.sin(unit(life) * Math.PI * 2 * MARKER_PULSES + at * PHI * Math.PI * 2)
}

/** How far a connection bows off its own chord, as a share of its length. */
export const ARC_BULGE = 0.18

/**
 * The control point of the arc between two markers.
 *
 * The perpendicular is `(dy, -dx)`, which already has the chord's own length, so
 * the bow scales with the distance without a normalisation — a fixed bow makes a
 * short link look like a loop and a long one look straight.
 */
export function arcControl(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return { x: (a.x + b.x) / 2 + ARC_BULGE * dy, y: (a.y + b.y) / 2 - ARC_BULGE * dx }
}

/** A point on that arc: one quadratic Bézier, evaluated. Nothing here is a curve anybody eases. */
export function bezierPoint(a, control, b, t) {
  const s = unit(t)
  const inv = 1 - s
  return {
    x: inv * inv * a.x + 2 * inv * s * control.x + s * s * b.x,
    y: inv * inv * a.y + 2 * inv * s * control.y + s * s * b.y,
  }
}

/** How many times a link's pulse crosses it in one scene, and the phase per link. */
export const LINK_PULSES = 2

export function linkPulse(life, index) {
  const at = Number.isFinite(Number(index)) ? Number(index) : 0
  return (unit(life) * LINK_PULSES + at * GOLDEN_STRIDE) % 1
}

/**
 * How loud the dot field is at rest, and under the sweep.
 *
 * Both are opacities on the accent run the palette already resolved with the veil
 * LOCKED — a decoration does not get to darken a photograph so it can keep its
 * colour — so raising one here can only ever make the field quieter than what was
 * measured, never louder than what was allowed.
 */
export const FIELD_QUIET = 0.26
export const FIELD_LIT = 0.62

/** How many times the meridian crosses the field in one scene, and how wide it is. */
export const SWEEP_CYCLES = 1.5
export const SWEEP_WIDTH = 0.22

/**
 * How lit one column of the field is: a meridian sweeping across it.
 *
 * By COLUMN and not by cell, which is a rendering decision as much as a
 * compositional one. A world crop holds six hundred dots, and six hundred
 * opacities recomputed on each of a scene's 450 frames is a cost paid inside a
 * render budget that is already four times real time; a column is one value for
 * twenty dots, and the sweep reads as a meridian rather than as noise.
 *
 * The band falls off on a raised cosine, so a column brightens and dims
 * continuously — a linear falloff has a corner, and a corner in an opacity is
 * visible as a line crossing the field.
 */
export function columnGlow(column, columns, life) {
  const total = count(columns)
  const at = Number(column)
  if (!Number.isFinite(at)) return FIELD_QUIET
  const sweep = ((unit(life) * SWEEP_CYCLES) % 1) * total
  const raw = Math.abs(at + 0.5 - sweep)
  // Wrapped, because the meridian leaves one edge and arrives at the other: an
  // unwrapped distance makes the sweep stop dead at the right-hand side.
  const distance = Math.min(raw, total - raw)
  const band = Math.max(1e-6, SWEEP_WIDTH * total)
  const lit = distance >= band ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * distance) / band)
  return FIELD_QUIET + (FIELD_LIT - FIELD_QUIET) * lit
}
