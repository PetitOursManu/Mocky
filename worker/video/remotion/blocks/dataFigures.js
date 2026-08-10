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
 * imports nothing of its own and holds no state.
 *
 * ── A block inhabits the box it is given ────────────────────────────────────
 *
 * The rule is at the top of `composition.js` and this file is one family's half
 * of it. Every `*Layout` function below takes the block's OWN box — the one
 * `composedLayout` published at `zone.layers[i].box` — and answers in pixels
 * inside it. Nothing here reads the frame except through the three constant
 * metrics `composition.js` names, and there is one of them in this file:
 * `hairline`, which is what an axis, a trace and a link are drawn with, bounded
 * to a quarter of the box it is drawn in.
 *
 * That is not a refactor, it is the defect six real exports showed. `equalizer`
 * drew `base * 0.18` — a fraction of the FRAME's short edge — whether it had been
 * anchored to a third of a cell or to the whole safe area, so a field given the
 * frame occupied 18% of it and every scene was a small element floating in a
 * large void. The same number appeared in all five: a plot at `base * 0.3`, a
 * wave at `base * 0.14`, a map at `base * 0.42`.
 *
 * The type sizes come from the one scale for the same reason — `typeSize(role,
 * unit)` off the unit the block's own STACK solved — never from a fraction this
 * file invents. A chart's caption and the heading beside it are two steps of one
 * scale or they are two authors disagreeing.
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

import { constantMetric, hairline, textLines, textWidth, typeRole, typeSize } from '../composition.js'

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

/** A positive length, or nothing. Same argument as `count`: a `NaN` in a style is an invisible block. */
function length(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * The block's own box, as two positive numbers.
 *
 * Everything in this file measures against this and never against `base`. A box
 * with no size answers zero rather than throwing, because a block that draws
 * nothing beats a render that dies half a minute in (Q1).
 */
export function room(box) {
  return { width: length(box?.width), height: length(box?.height) }
}

// ── The two shapes every figure in this family is built out of ───────────────

/**
 * How much of a column's pitch is the air beside it.
 *
 * A share of the PITCH and not a fraction of the frame, which is the whole rule
 * one level down: twelve bars across a full safe area are twelve wide columns
 * with wide gaps, and the same twelve across a third of a cell are twelve
 * hairlines with hairline gaps. One number, two scales, decided by the box.
 */
export const FIGURE_GAP_SHARE = 0.3

/**
 * `total` columns across a measure, as start/size pairs.
 *
 * Each EDGE is rounded rather than each size, exactly as `split` does in
 * `composition.js` and for the same reason: rounding sizes spends a pixel per
 * column, and eight of them leave the last bar short of the box it was measured
 * against. The last column therefore ends on `round(measure)` whatever the
 * arithmetic did in between, which is what makes "it fills its box" a thing a
 * test can assert rather than a thing a screenshot suggests.
 */
export function tracks(measure, total, gap = 0) {
  const n = count(total)
  const span = length(measure)
  // The air can never eat the columns: a gap wider than half a pitch would leave
  // `size` negative and the row would be gaps with nothing between them.
  const air = Math.max(0, Math.min(length(gap), span / n / 2))
  const size = (span - (n - 1) * air) / n
  return Array.from({ length: n }, (_, i) => {
    const from = i * (size + air)
    const start = Math.round(from)
    return { start, size: Math.max(1, Math.round(from + size) - start) }
  })
}

/** The air between two columns of a figure, off the pitch the box turned out to have. */
export function figureGap(measure, total, share = FIGURE_GAP_SHARE) {
  return Math.max(1, Math.round((length(measure) / count(total)) * share))
}

/**
 * How wide a column may get before it stops being one.
 *
 * Two bars across a full safe area are two 800 px slabs, and a slab is not a bar
 * — it is a rectangle the eye reads as a panel. So a column is capped against the
 * height it stands in and CENTRED in its own track: the row still spans the box,
 * which is the rule, and what fills the extra is air rather than ink. 0.55
 * because a column as wide as it is tall is already a square.
 */
export const FIGURE_MAX_RATIO = 0.55

export function capped(list, cap) {
  const limit = Math.max(1, Math.round(length(cap)))
  return (Array.isArray(list) ? list : []).map(({ start, size }) =>
    size <= limit ? { start, size } : { start: start + Math.round((size - limit) / 2), size: limit },
  )
}

/**
 * A corner radius, which is a CONSTANT METRIC: the same object from one scene to
 * the next, so it comes off the theme and not off the box.
 *
 * The ceiling is `constantMetric`'s and not a third copy of it: this was the
 * third of three implementations of one paragraph, and the three disagreed on the
 * degenerate box. What is left here is what is genuinely this family's — a bar is
 * rounded against ONE extent rather than against a box, since a lane is a
 * thickness, and a figure may ask for a fraction of the theme's radius because a
 * 12 px corner on a 14 px bar is a pill and a row of pills is a row of tags.
 */
export function figureRadius(radiusPx, extent, share = 1) {
  const side = length(extent)
  return constantMetric(Math.max(0, Number(radiusPx) || 0) * share, { width: side, height: side })
}

/**
 * A run of text under a figure: its size on the one scale, and the band it needs.
 *
 * The size is `typeSize(role, unit)` and never a fraction of anything this file
 * chose — that is the second half of the same defect, and the one that made a
 * counter three times the heading beside it. The `gap` is stated in UNITS for the
 * same reason `BLOCK_APPETITE` states furniture in units: a block's own spacing
 * has to scale with the block, and the unit is the only quantity that already
 * does.
 */
export const CAPTION_GAP = 0.3

export function textBand(role, text, unit, measure) {
  const at = Math.max(1, length(unit))
  const size = typeSize(role, at)
  const leading = typeRole(role).leading
  const lines = textLines(text, size, measure)
  if (lines === 0) return { shown: false, size: 0, lines: 0, leading, height: 0, gap: 0 }
  return {
    shown: true,
    size,
    lines,
    leading,
    height: Math.round(lines * size * leading),
    gap: Math.round(at * CAPTION_GAP),
  }
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

/** How far the reading mark hangs below the axis, and how much air sits under the bars. In units. */
export const BAR_AXIS_GAP = 0.22
export const MARK_OVERHANG = 0.32

/**
 * How loud the axis and the reading mark are.
 *
 * Both are opacities on runs the palette already resolved — the rule on
 * `palette.body`, the mark on the accent run with the veil LOCKED — and neither
 * carries a glyph, so quieting one spends no contrast anybody measured. Neither
 * may be raised past 1 for the same reason `map`'s two are written down here: an
 * opacity can only ever make a decoration quieter than what was measured, never
 * louder than what was allowed.
 *
 * They live in the family module rather than in the component because that is
 * where every other number of this shape already is — `FIELD_QUIET`, `PING_ALPHA`,
 * `LINE_DOT_SHARE` — and a literal in a `.jsx` is the one a second author retypes
 * with a different value on the block next door. The rule is louder than the mark
 * because it is the thing the columns are measured FROM; a guide as loud as the
 * figure reads as one more bar rather than as an eye crossing it.
 */
export const AXIS_ALPHA = 0.45
export const MARK_ALPHA = 0.34

/**
 * How small a caption may get before it stops being a caption.
 *
 * A label under a column has the COLUMN's width and not the block's, so eight
 * twelve-character labels in a cell are asking for eight 26 px measures, and the
 * size that fits is a size nobody reads. The rule the brief states is the one
 * implemented here: it shortens, or it disappears — it never overflows. Shrinking
 * is what `labelBand` does down to this floor; below it the whole row goes, all of
 * them together, because one label present and seven missing reads as a bug
 * rather than as a decision.
 */
export const LABEL_FLOOR = 0.55

/**
 * The band of labels under a chart: the size they fit at, or nothing.
 *
 * The measure is one COLUMN, which is the fix. Sized against the block's whole
 * width, a twelve-character label was drawn at the caption step and then wrapped
 * or spilled into its neighbour, and no test could see it because the size was
 * legal.
 */
export function labelBand(labels, unit, measure) {
  const list = (Array.isArray(labels) ? labels : []).map((text) => String(text ?? '').trim()).filter(Boolean)
  const at = Math.max(1, length(unit))
  const step = typeSize('caption', at)
  const room = length(measure)
  const nothing = { shown: false, size: 0, height: 0, gap: 0 }
  if (list.length === 0 || room === 0) return nothing
  const widest = list.reduce((wide, text) => Math.max(wide, textWidth(text, step)), 0)
  const size = widest > room ? Math.floor((step * room) / widest) : step
  if (size < Math.max(1, Math.round(step * LABEL_FLOOR))) return nothing
  return {
    shown: true,
    size,
    height: Math.round(size * typeRole('caption').leading),
    gap: Math.round(at * CAPTION_GAP),
  }
}

/**
 * Everything a bar chart draws, in pixels, inside the box it was given.
 *
 * The order matters and it is the only subtle thing here: the columns are laid
 * out first because the LABEL's measure is one column, the label band is sized
 * next because the plot is what is left of the box under it, and the columns are
 * capped last against that plot's height. Solving it the other way round is
 * circular, and solving it against the block's width is the defect this whole
 * pass is about, one axis over.
 */
export function barChartLayout(block, box, { base, unit: at, radiusPx } = {}) {
  const { width, height } = room(box)
  const values = Array.isArray(block?.values) ? block.values : []
  const total = Math.max(1, values.length)
  const lanes = tracks(width, total, figureGap(width, total))
  const label = labelBand(block?.labels, at, lanes.reduce((narrow, lane) => Math.min(narrow, lane.size), Infinity))
  const axis = {
    thickness: block?.baseline === false ? 0 : hairline(base, box),
    gap: Math.round(Math.max(1, length(at)) * BAR_AXIS_GAP),
  }
  const band = label.shown ? label.height + label.gap : 0
  const plot = Math.max(1, Math.round(height - band - axis.thickness - axis.gap))
  return {
    width,
    height,
    plot,
    axis,
    label,
    // The tracks the row is divided into, and the bars drawn inside them. A label
    // is centred on its TRACK and never on its bar: a capped bar is centred in its
    // own track, so the two agree, and a caption pinned to the ink would jump
    // sideways the moment a chart of two values capped and one of six did not.
    lanes,
    bars: capped(lanes, plot * FIGURE_MAX_RATIO),
    radius: figureRadius(radiusPx, lanes[0]?.size ?? 0, 0.3),
    mark: {
      thickness: hairline(base, box),
      overhang: Math.round(Math.max(1, length(at)) * MARK_OVERHANG),
    },
  }
}

/** A bar's height in pixels: the value the document stated, grown by its own share of the arrival. */
export function barHeight(value, growth, plot) {
  return Math.round(length(plot) * unit(Number(value) / 100) * unit(growth))
}

// ── lineChart ────────────────────────────────────────────────────────────────

/**
 * The series as points in the unit square, `y` measured DOWNWARD.
 *
 * Normalised rather than in pixels because the trace is drawn in a unit box that
 * CSS stretches to the plot's own rectangle. Everything ROUND is positioned in
 * percent by the component instead of being drawn inside that box, where a
 * non-uniform stretch would turn a circle into an ellipse.
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

/** The head of the trace, as a share of the plot's SHORT side. A mark scales with the figure it marks. */
export const LINE_DOT_SHARE = 0.032

/**
 * How much taller than it is wide a plot may get.
 *
 * The one place in this family where filling the box is the wrong answer. The
 * schema bounds a value to 0–100 and nothing rescales, so the vertical exaggeration
 * of the plot IS the exaggeration of the data: a series stretched three times
 * taller than it is wide draws a ten-point difference as a cliff. 1.25 leaves
 * every ordinary cell filled — a third of a 16:9 safe area is wider than it is
 * tall — and only bites on a column, where the leftover is air split above and
 * below rather than a chart making a claim the numbers do not.
 */
export const LINE_MAX_ASPECT = 1.25

/**
 * Everything a line chart draws, in pixels, inside its box.
 *
 * The plot is inset by the widest the ping ever gets, on ALL FOUR sides: the last
 * sample sits at `x = 1` and a value of 100 sits at `y = 0`, so a ring centred on
 * either hangs half its width past the box — and the box's edge is the margin
 * `composedSafeArea` promises nothing crosses.
 */
export function lineChartLayout(block, box, { base, unit: at } = {}) {
  const { width, height } = room(box)
  const label = textBand('caption', block?.label, at, width)
  const band = label.shown ? label.height + label.gap : 0
  const dot = Math.max(3, Math.round(Math.min(width, Math.max(1, height - band)) * LINE_DOT_SHARE))
  const inset = Math.round((dot * PING_REACH) / 2)
  const measure = Math.max(1, width - 2 * inset)
  const room0 = Math.max(1, height - band - 2 * inset)
  const plotHeight = Math.min(room0, Math.round(measure * LINE_MAX_ASPECT))
  return {
    width,
    height,
    dot,
    inset,
    stroke: hairline(base, box),
    label,
    plot: {
      left: inset,
      top: inset + Math.round((room0 - plotHeight) / 2),
      width: measure,
      height: plotHeight,
    },
  }
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

/**
 * The row, in pixels, across the box it was given — which is the whole fix for
 * this block.
 *
 * `base * 0.18` is the number this family is named after in `composition.js`: a
 * field anchored to the entire safe area drew 18% of the frame's short edge and
 * left the rest empty. Here the row IS the box, so the same twelve bars are a
 * field when the box is the frame and a figure when the box is a third of a cell.
 * Two scales, one expression, decided by the box.
 */
export function equalizerLayout(block, box, { radiusPx } = {}) {
  const { width, height } = room(box)
  const total = count(block?.bars)
  const lanes = capped(tracks(width, total, figureGap(width, total)), height * FIGURE_MAX_RATIO)
  return {
    width,
    height,
    bars: lanes,
    // The top corners only, and barely: an equalizer bar is a column of light, and
    // a fully rounded one is a pill, which reads as a tag rather than as a level.
    radius: figureRadius(radiusPx, lanes[0]?.size ?? 0, 0.2),
  }
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
 *
 * The three amplitudes sum to exactly 1 and they do line up: the crest reaches the
 * edge of the box at its loudest moment, and sits near four fifths of it on an
 * ordinary frame of a `sweep`. That is what stops the amplitude needing a
 * normalisation nobody could justify — a wave scaled so that its median frame
 * touched the edge would clip on the frame where the harmonics agree.
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

/**
 * Which way the wave runs, decided by the box and by nothing else.
 *
 * The figure has about five crests across its length, so its amplitude wants to
 * stay near the spacing between them. Drawn across the width of a column — 845 px
 * of measure under 950 px of band — that puts a ±475 px swing on a 169 px crest
 * spacing, which is not a waveform, it is a zigzag. A wave in a tall box therefore
 * runs DOWN it. Same arithmetic, transposed at the last moment, and the block
 * still fills the box it was given: this is the "narrow or short" case the brief
 * names, and the one a model produces the moment two blocks share a row.
 */
export function waveOrientation(box) {
  const { width, height } = room(box)
  return height > width ? 'vertical' : 'horizontal'
}

/**
 * The waveform as points in the box, in pixels.
 *
 * `progress` opens the wave out of its own axis rather than fading it in: a
 * waveform that appeared at full height would be a picture of a wave, one that
 * opens is a wave. It is a WINDOW on the arrival and not a second curve.
 */
export function wavePoints(heights, box, progress) {
  const { width, height } = room(box)
  const list = Array.isArray(heights) ? heights : []
  const last = Math.max(1, list.length - 1)
  const along = waveOrientation(box) === 'vertical' ? height : width
  const across = waveOrientation(box) === 'vertical' ? width : height
  const middle = across / 2
  return list.map((sample, i) => {
    const travel = (i / last) * along
    const swing = middle - sample * middle * unit(progress)
    return waveOrientation(box) === 'vertical' ? { x: swing, y: travel } : { x: travel, y: swing }
  })
}

/** The axis a wave opens from, as the two ends of a line in the box. */
export function waveAxis(box) {
  const { width, height } = room(box)
  return waveOrientation(box) === 'vertical'
    ? { x1: width / 2, y1: 0, x2: width / 2, y2: height }
    : { x1: 0, y1: height / 2, x2: width, y2: height / 2 }
}

/**
 * Everything a wave draws, in pixels, inside its box.
 *
 * The stroke is the one constant metric this block has: a wave two pixels thick in
 * one scene and eight in the next is two design systems in one film, which is what
 * `CONSTANT_METRICS` exists to say. Everything else is the box.
 */
export function waveLayout(box, { base } = {}) {
  const { width, height } = room(box)
  return {
    width,
    height,
    orientation: waveOrientation(box),
    axis: waveAxis(box),
    stroke: hairline(base, box),
  }
}

// ── map ──────────────────────────────────────────────────────────────────────
//
// A schematic planisphere, as a field of dots, and everything about it is a
// deliberate limit rather than a first version.
//
// The container has no egress and no map asset, so whatever a composition draws
// has to fit in a source file. What fits is a LAND MASK — a plate carrée grid at
// 2° per column and 1.5° per row, where a cell is land when its centre falls on
// land. It is a picture rather than a generator: what ships is what a reviewer can
// read as a map, and 15 840 cells is 16.4 KB of this file's 65.5 — the whole price
// of the fix, paid once, in a sub-project that is absent from a default install.
//
// **That resolution is the fix, and the number is why.** The first mask was 64×30
// — 5.6° per column — and `world` was the only window it could carry: `europe`
// cropped 14 columns by 9 rows out of it, which is not a coarse Europe, it is a
// cloud of nine dots that says nothing, and `asia` (23×18) and `africa` (14×15)
// were the same failure. A window is a CROP of one mask, so the mask has to hold
// the smallest window's worth of detail: `europe` is 80° of longitude, and at 2°
// that is 40 columns by 26 rows, which is a silhouette with Iberia, Italy, the
// Aegean, Scandinavia and the Black Sea in it. The alternative was to take the
// four sub-regions out of the schema and let `map` draw the world alone — a map
// that does not resemble the territory is worse than no map — and that is a change
// to three validators and a prompt rather than to a block.
//
// The resolution of the DRAWING is not the resolution of the mask, and that is
// what keeps the cost where it was: `mapStride` samples the mask down to about
// sixty columns, so a world crop is the same six hundred dots it always drew while
// `europe` reads the mask whole. A finer mask is bytes; more dots would be frames.
//
// What it still refuses to draw is unchanged. There are no borders, no names, no
// disputed lines, no island smaller than a dot, and nothing identifiable below the
// scale of a country's outline. Antarctica is out of the window rather than absent
// from the mask: on a plate carrée the pole stretches into a solid band across the
// bottom of every frame it appears in and says nothing.

/** The character a land cell is written with. Everything else in a row is sea. */
export const LAND_MARK = '#'

export const MAP_COLUMNS = 180
export const MAP_ROWS = 88
/** The window the mask itself covers, in degrees. Plate carrée: one cell is one rectangle of it. */
export const MAP_NORTH = 78
export const MAP_SOUTH = -54

/**
 * The mask, one string per row of latitude, north first.
 *
 * Rasterised once from about sixty coarse coastline rings and pasted here, because
 * a generator in the source is a dependency on the generator: what ships is the
 * picture. Every row is `MAP_COLUMNS` long and `dataFigures.test.js` asserts it,
 * since a row one character short would silently shift a continent east for every
 * row below it.
 */
export const LAND_ROWS = [
    '.............................................................##################.....................................................................................................',
  '.............................................................##################.......................................................##########....................................',
  '.............................................................##################..........................................#.........###############..................................',
  '..............................................................##################................................................############################........................',
  '..............................................................##################...........................................#######################################..................',
  '..........#########.......########.............................#################....................#####...............###################################################.........',
  '........#################################......................###############....................###########.........##########################################################....',
  '.......##########################################...............############.....................####.############################################################################..',
  '......############################################...............#########......###.............#####.#############################################################################.',
  '.......#####################################.....##...............######.......#...............###################################################################################..',
  '.......###################################........................####.......................######.####.#######################################################################....',
  '.......###################################.........###.............#........................#######..########################################################################.......',
  '.........#######...#######################.........######...................................#######...#####################################################################.........',
  '.......................###################.........#######..............................#.......###...#############################################################...#####.........',
  '........................####################################...........................##.....####...#############################################################.....####.........',
  '.........................####################################.........................###.....#.....#############################################################.......##..........',
  '.........................#####################################.......................##.##...#################################################################..........#...........',
  '..........................####################################.......................#.####.#################################################################...#...................',
  '...........................####################################...........................###################################################################...#...................',
  '............................###################################.........................#####################################################################...#...................',
  '............................#################...############.##.........................####################################################################....#...................',
  '............................################.....#########..............................#################.########..########################################........................',
  '............................#################.....#######................................###############......####..########################################.....#..................',
  '............................##################...#######.............................######....#########......####...######################################......#..................',
  '............................##########################...............................######......#.####..########....#####################################......#...................',
  '.............................########################................................#####.......#..##.##########....####################################...........................',
  '.............................########################................................#####..........##.##########....#################################..##..........................',
  '.............................#######################..................................###...............##############################################...#....#.....................',
  '..............................######################...................................######...............##########################################...#..........................',
  '...............................####################...................................#########.............##########################################..............................',
  '................................##################....................................###########..........###########################################..............................',
  '................................#.################...................................#####################.###########################################..............................',
  '..................................############..##..................................##############################.###################################..............................',
  '.................................#.#######......##.................................########################.#######.##################################..............................',
  '....................................######.......#.................................########################.#######...################################..............................',
  '..................................#.#####..........................................#################################.......############################.............................',
  '.....................................####.........................................##########################.########.......########################..#.............................',
  '.....................................####........##...............................##########################.##########......#####################..................................',
  '.....................................#####...#....................................##########################..#########......########....#######....................................',
  '.......................................#######.......###..........................###########################.#########.......######.....#######....................................',
  '........................................######....................................###########################.########........#####.......######......#.............................',
  '...........................................###....................................###########################..#####..........####.........#####......##............................',
  '.............................................##...................................############################.###.............###.........#####......##............................',
  '...............................................#..................................#############################................###.........#####......##............................',
  '...............................................#.....###...........................################################.............##.........#####......###...........................',
  '................................................###.######.........................################################.............##.........####.......###...........................',
  '....................................................########........................###############################.............#.#........###.........##...........................',
  '...................................................###########.......................#############################................#.........##.........##...........................',
  '...................................................#############......................###....#####################..........................##......................................',
  '...................................................#############...............................##################............................#......#...............................',
  '...................................................##############..............................##################............................#...####...............................',
  '..................................................###############..............................#################...........................#.....#######............................',
  '..................................................################.............................#################............................#....#######............................',
  '..................................................##################...........................################.............................##...####.##...####.....................',
  '..................................................####################..........................##############...............................#......#......######...................',
  '..................................................#####################.........................##############................................#.............#######.................',
  '..................................................######################........................##############................................####............######................',
  '..................................................######################........................##############....................................#............#####................',
  '...................................................#####################........................##############......................................................#...............',
  '...................................................####################.........................##############..................................................#...................',
  '....................................................###################.........................##############.............................................#..###...................',
  '....................................................##################..........................##############..##......................................#..##.####..................',
  '.....................................................#################..........................##############..###.....................................##########..................',
  '......................................................################..........................##############..###....................................############.................',
  '.......................................................###############..........................#############...###...................................#############.................',
  '.......................................................###############..........................#############...###.................................################................',
  '.......................................................##############............................###########....###................................##################...............',
  '.......................................................#############.............................###########....###................................##################...............',
  '.......................................................###########...............................##########.....###................................###################..............',
  '.......................................................###########...............................##########........................................###################..............',
  '.......................................................##########.................................########.........................................###################..............',
  '.......................................................##########.................................########.........................................###################..............',
  '.......................................................#########..................................#######..........................................###################..............',
  '.......................................................#########...................................#####...........................................#######.###########..............',
  '......................................................#########....................................####............................................#####......########..............',
  '......................................................#######..................................................................................................######...........#...',
  '......................................................#######...................................................................................................#####...........###.',
  '......................................................#######....................................................................................................###.............##.',
  '......................................................#####......................................................................................................................##.',
  '.....................................................######.......................................................................................................##...........##...',
  '.....................................................#####........................................................................................................##...........##...',
  '.....................................................#####....................................................................................................................##....',
  '.....................................................####....................................................................................................................##.....',
  '.....................................................####...........................................................................................................................',
  '.....................................................###............................................................................................................................',
  '.....................................................###............................................................................................................................',
  '.....................................................###............................................................................................................................',
  '......................................................##............................................................................................................................',
]

/**
 * Which part of the mask each region names, as inclusive cell indices.
 *
 * Cells and not degrees, so a window can only ever be a crop of the grid that
 * exists — a window in degrees would need rounding, and a rounding that landed
 * half a cell out would draw a column of sea down the side of every continent.
 * `dataFigures.test.js` asserts each one is inside the world's and that its cells
 * are a subset of the world's, which is the whole claim a crop makes.
 */
export const MAP_WINDOWS = {
  world: { col0: 0, col1: MAP_COLUMNS - 1, row0: 0, row1: MAP_ROWS - 1 },
  // 22°W–58°E, 68.25°N–30.75°N: 40 columns by 26 rows, which is the window the
  // mask's resolution was chosen for.
  europe: { col0: 79, col1: 118, row0: 6, row1: 31 },
  americas: { col0: 5, col1: 74, row0: 0, row1: MAP_ROWS - 1 },
  asia: { col0: 101, col1: 165, row0: 0, row1: 59 },
  africa: { col0: 79, col1: 118, row0: 28, row1: 76 },
}

/** The window a region names, or the world. An unknown name was refused by `validate.js` long ago (Q1). */
export function mapWindow(region) {
  return Object.hasOwn(MAP_WINDOWS, String(region)) ? MAP_WINDOWS[region] : MAP_WINDOWS.world
}

/**
 * How far a named window may be opened up to meet the shape of its box.
 *
 * A crop has a fixed aspect and a box does not, so one of the two axes is always
 * left over: `europe` is 1.54 wide for 1 tall and a 16:9 safe area is 1.78, which
 * letterboxes 13% of the measure. Growing the window instead spends that leftover
 * on more of the same mask — the region stays centred and the map stays a crop of
 * one drawing — and it is bounded at half again, because a `europe` opened until
 * it fitted a banner would be the world with a French accent.
 */
export const MAP_CROP_GROWTH = 1.5

/** A span of cells opened to `want`, centred on what it had, and never off the mask. */
function grown(from, to, want, limit) {
  const have = to - from + 1
  const wide = Math.max(have, Math.min(limit, Math.round(length(want))))
  const extra = wide - have
  let a = from - Math.floor(extra / 2)
  let b = to + Math.ceil(extra / 2)
  if (a < 0) {
    b = Math.min(limit - 1, b - a)
    a = 0
  }
  if (b > limit - 1) {
    a = Math.max(0, a - (b - (limit - 1)))
    b = limit - 1
  }
  return [a, b]
}

/**
 * The window actually drawn: the region's own, opened towards the shape of the
 * box, and never outside the mask.
 *
 * With no box it is the region's window unchanged, which is what keeps the crop
 * claim testable on its own.
 */
export function mapCrop(region, box) {
  const window = mapWindow(region)
  const { width, height } = room(box)
  if (width === 0 || height === 0) return window
  const columns = window.col1 - window.col0 + 1
  const rows = window.row1 - window.row0 + 1
  const want = width / height
  if (want > columns / rows) {
    const [col0, col1] = grown(window.col0, window.col1, Math.min(rows * want, columns * MAP_CROP_GROWTH), MAP_COLUMNS)
    return { col0, col1, row0: window.row0, row1: window.row1 }
  }
  const [row0, row1] = grown(window.row0, window.row1, Math.min(columns / want, rows * MAP_CROP_GROWTH), MAP_ROWS)
  return { col0: window.col0, col1: window.col1, row0, row1 }
}

/**
 * How many columns the field is drawn at, and how small a dot's own cell may get.
 *
 * The mask is finer than any frame needs, deliberately (see the note above), so
 * the drawing samples it down. Sixty columns is what the old 64-column mask drew a
 * world at and it is the resolution that reads: past it the dots are closer
 * together than they are wide, which is sand rather than a map, and a world crop
 * would be six times the nodes on every one of a scene's 450 frames.
 */
export const MAP_TARGET_COLUMNS = 60
export const MAP_MIN_COLUMNS = 10
export const MAP_MIN_PITCH = 9

/**
 * The stride the mask is sampled at: never finer than the target, and coarser
 * still when the box cannot give a dot its nine pixels.
 *
 * That second half is the box deciding the scale, exactly as it does for the bars:
 * the same `world` is sixty columns across a safe area and thirty-odd inside a
 * cell, because a 4 px dot beside a 4 px gap is a grey rectangle.
 */
export function mapStride(crop, box) {
  const columns = Math.max(1, crop.col1 - crop.col0 + 1)
  const rows = Math.max(1, crop.row1 - crop.row0 + 1)
  const { width, height } = room(box)
  let stride = Math.max(1, Math.ceil(columns / MAP_TARGET_COLUMNS))
  if (width === 0 || height === 0) return stride
  const pitchAt = (s) => Math.min(width / Math.ceil(columns / s), height / Math.ceil(rows / s))
  while (
    stride < columns &&
    pitchAt(stride) < MAP_MIN_PITCH &&
    Math.ceil(columns / (stride + 1)) >= MAP_MIN_COLUMNS
  ) {
    stride += 1
  }
  return stride
}

/**
 * How much of a sampled block has to be land for its dot to be drawn.
 *
 * A quarter, and it is measured rather than chosen: swept over the mask at the
 * strides the boxes really produce, a quarter keeps Britain, Japan and New Zealand
 * — three places a viewer notices are missing — while a half erodes every coast by
 * a cell and turns the Indonesian arc into three dots. It is counted against the
 * cells actually COVERED, not against the stride squared, or the partial block at
 * the mask's edge would need a quorum it cannot reach and the last column of the
 * world would always be sea.
 */
export const MAP_LAND_QUORUM = 0.25

/**
 * Every dot of a crop, sampled at a stride, positioned in DRAWN cell units.
 *
 * `x` and `y` are cell centres, so a dot drawn at that point sits in the middle of
 * its own cell whatever the viewBox is scaled to. `col` and `row` stay the mask's
 * own indices — the top-left of the block that was sampled — because that is what
 * makes a key unique and what lets a test ask whether a marker landed on land.
 * The order is row-major, north to south, which is what makes the marker stride
 * below spread over the whole field rather than along one latitude.
 */
export function mapField(crop, stride = 1) {
  const step = count(stride)
  const columns = Math.max(1, Math.ceil((crop.col1 - crop.col0 + 1) / step))
  const rows = Math.max(1, Math.ceil((crop.row1 - crop.row0 + 1) / step))
  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const col = crop.col0 + c * step
      const row = crop.row0 + r * step
      let covered = 0
      let land = 0
      for (let dr = 0; dr < step && row + dr <= crop.row1; dr++) {
        const line = LAND_ROWS[row + dr]
        if (!line) continue
        for (let dc = 0; dc < step && col + dc <= crop.col1; dc++) {
          covered += 1
          if (line[col + dc] === LAND_MARK) land += 1
        }
      }
      if (covered > 0 && land >= Math.max(1, Math.ceil(covered * MAP_LAND_QUORUM))) {
        cells.push({ col, row, x: c + 0.5, y: r + 0.5 })
      }
    }
  }
  return { columns, rows, cells }
}

/**
 * How many dots one field may hold, whatever the crop and the box worked out to.
 *
 * The only quantity in this family that is a RENDER cost rather than a look: the
 * component's tree is rebuilt on each of a scene's 450 frames, so a dot is a
 * React element four hundred and fifty times. The old mask drew about six hundred
 * for a world, the new one draws 618 for the same crop, and a sweep of the boxes a
 * composed scene really produces — three ratios, seven zone shapes, five regions —
 * puts the worst case at 1340: Africa at stride 1 filling a 9:16 safe area. 1600
 * is above every one of them on purpose. It is a ceiling against a window somebody
 * adds later rather than a budget the ordinary case spends, and `mapSampling` pays
 * it by sampling one step coarser rather than by dropping dots off the end of a
 * list, which would take a continent away without saying so.
 */
export const MAP_MAX_DOTS = 1600

/**
 * The stride and the field together, which is the only way to bound the DOT count
 * — how many dots a stride yields depends on how much land the crop holds, and
 * that is not a formula.
 */
export function mapSampling(crop, box) {
  let stride = mapStride(crop, box)
  let field = mapField(crop, stride)
  while (field.cells.length > MAP_MAX_DOTS && field.columns > MAP_MIN_COLUMNS) {
    stride += 1
    field = mapField(crop, stride)
  }
  return { stride, field }
}

/**
 * Everything a map draws, in pixels, inside its box.
 *
 * The field keeps its own aspect — this is the one block in the family holding
 * circles, and a circle in a stretched viewBox is an ellipse — so the pitch is
 * whichever of the two axes runs out first, and `mapCrop` has already spent most
 * of the difference on more mask. `base * 0.42`, which is what this block used to
 * be tall, is gone: a map given the safe area is now the size of the safe area.
 */
export function mapLayout(block, box, { base } = {}) {
  const { width, height } = room(box)
  const crop = mapCrop(block?.region, box)
  const { stride, field } = mapSampling(crop, box)
  const pitch = Math.min(width / field.columns, height / field.rows)
  return {
    ...field,
    crop,
    stride,
    pitch,
    width: Math.round(pitch * field.columns),
    height: Math.round(pitch * field.rows),
    stroke: hairline(base, box),
  }
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
