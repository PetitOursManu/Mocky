// The arithmetic of the TEXT family — `heading`, `kicker`, `quote`,
// `textHighlight` — with no React in it, so a test can reach every number.
//
// ── Why a `.js` beside four `.jsx`, when `index.js` says a helper here is a
//    helper twenty-four authors edit ──────────────────────────────────────────
//
// That rule is about the REGISTRY: `index.js` is a map so that twenty-four people
// can own one file each without touching the same line. This is not that file and
// not that scope. These four blocks share one notion of "a word arrives from
// behind its mask", one notion of "a rule runs the measure" and one notion of
// "the marker is being drawn" — four copies of each is three of them drifting,
// which is the argument `composition.js` is written under, applied to one family
// instead of to six compositions.
//
// It is a `.js` and not a `.jsx` for the reason `composition.js` is: a `.jsx`
// cannot be asked a question without a renderer, and every quantity below is one
// a test should be able to ask about directly. `text.test.js` is that test.
//
// Nothing here writes a colour, and nothing here eases. The curve is applied once,
// in `cueProgress`, before `progress` ever reaches a block; every function below
// is a SCHEDULE over an already-eased quantity — where a word sits in the stagger,
// which slice of the arrival a phase owns — and a schedule composed with a curve
// is still that curve. A second curve applied here would be the block easing
// twice, which is exactly what `blocks.test.js` forbids in the components.
//
// ── What changed when a block started inhabiting its box ─────────────────────
//
// This file used to hold four tables of SIZES — `HEADING_SIZES`, `QUOTE_SIZE`,
// `HIGHLIGHT_SIZE` and a rule length — each a fraction of the frame's short edge,
// and three tables of MEASURES in ems capping how far a line could run. Both are
// the defect the rule at the top of `composition.js` is about, in the two forms it
// takes in a family of type. A size read off the frame is a heading set for a
// frame it cannot see: alone in a scene it was 96 px of display type floating in
// 950 px of safe height, which is the "small element in a large void" six real
// exports showed. A measure in ems is the same mistake wearing a better argument —
// it is right that a measure is a character count rather than a share of a frame,
// and it is wrong that a block should cap itself at all, because `composedLayout`
// has ALREADY divided the row among whatever is beside it. Two caps on one
// quantity is the narrower one winning, and the narrower one was always this file.
//
// So there is one size table and it is `TYPE_ROLES`, one measure and it is the
// box, and this file reads both rather than owning either. `textLayout` is where
// that happens; everything else here is motion and ornament.
//
// One consequence is worth stating because it decided the shape of all four
// components: **no furniture of this family stands BESIDE its text.** The rule
// under a heading, the kicker's rule and the quote's mark are horizontal bands
// stacked with the runs, never a column in the margin. A column would take room
// out of the measure, the runs would wrap one line more than `textLines`
// predicted, and the block would leave the box `composedLayout` promised it fits
// in — the estimate is what the whole promise rests on, and a gutter drawn here
// is an estimate made somewhere else and quietly falsified here.
import {
  CONSTANT_CEILING,
  CUE_ENTER_FRAMES,
  EMPHASIS_ENTER_FRAMES,
  RUN_GAP,
  blockShape,
  hairline,
  runAdvanceEm,
  shapeCeiling,
  solveTypeUnit,
  textLines,
  textWidth,
  typeRole,
  typeScale,
} from '../composition.js'

/** A number pulled into 0…1, answering 0 for anything that is not one. */
const clamp01 = (value) => {
  const at = Number(value)
  if (!Number.isFinite(at)) return 0
  return at < 0 ? 0 : at > 1 ? 1 : at
}

/**
 * A named value out of a small table, or the table's own default.
 *
 * `Object.hasOwn` and not a plain lookup, for the reason `blockComponent` and
 * `dimensionsFor` both spell out: a lookup answers for the prototype chain, so
 * `level: "constructor"` hands back a function and the caller multiplies a size
 * by it. The value was refused by three validators long before a frame, so
 * reaching the fallback means two lists disagree — and a heading drawn at the
 * ordinary size beats a heading drawn at `NaN` (Q1).
 */
const pick = (table, name, fallback) =>
  typeof name === 'string' && Object.hasOwn(table, name) ? table[name] : fallback

// ── The block, laid out in the box it was given ──────────────────────────────

/**
 * Everything a text block needs to draw itself in ONE box: the type unit its
 * stack agreed on, the size and leading of each run, and the height of the band
 * its furniture stands in.
 *
 * This is the whole of "a block inhabits its box" for this family, and it is one
 * function rather than four because the four blocks are the same object with
 * different furniture: a stack of runs, at one unit, over or under a band of
 * ornament. Every number in it is READ rather than chosen —
 *
 *   - the ROLE of each run and the weight of the furniture come out of
 *     `BLOCK_APPETITE`, through `blockShape`. That table is what `composedLayout`
 *     divided the zone with, so a component that decided its own roles would be
 *     drawing something other than the thing the layout made room for. It is also
 *     why `heading.level` is not read here: the table already maps it to a step,
 *     and mapping it a second time is the two-tables-one-question failure this
 *     file was full of.
 *   - the SIZE is `typeScale`, on the stack's unit. Two blocks in one zone
 *     therefore read two steps of one scale instead of two fractions of a frame,
 *     which is what stopped a counter from crushing the heading beside it.
 *   - the LINE COUNT is `textLines`, against the box's own width — so a long
 *     heading wraps and a short one does not, and the size falls out of the
 *     length instead of being tuned for the longest legal string.
 *
 * `unit` is the stack's when there is one and solved on this box when there is
 * not. The second case is a lone caller rather than a repair: `composedLayout`
 * always publishes one, and a block re-solving on its own box beside a neighbour
 * can land a step above it.
 *
 * The height it answers is `blockExtent`'s, computed from the other end — the
 * component's own sizes rather than the layout's estimate — which is what
 * `text.test.js` holds the two to.
 */
export function textLayout(block, box, unit) {
  const shape = blockShape(block)
  const width = Math.max(0, Number(box?.width) || 0)
  const height = Math.max(0, Number(box?.height) || 0)
  const given = Number(unit)
  const solved = Number.isFinite(given) && given > 0 ? given : solveTypeUnit([shape], width, height)

  const drawn = []
  const list = Array.isArray(shape.runs) ? shape.runs : []
  // The unit this shape can actually SPEND, which is the one `shapeHeight` spent
  // when the layout decided how much of the zone to reserve: a run that cannot
  // break stops the whole shape growing once it has filled the measure.
  const spent = Math.min(solved, shapeCeiling(shape, width))
  for (let index = 0; index < list.length; index += 1) {
    const run = list[index] ?? {}
    const size = typeScale(run.role, run.text, { width, height }, {
      tracking: run.tracking,
      mono: run.mono,
      nowrap: run.nowrap,
      unit: solved,
    })
    // `runAdvanceEm` and not the constant, so this file measures a run exactly as
    // `shapeHeight` did when the layout reserved room for it. Two readings of one
    // question is how a block and its box disagree.
    const advance = runAdvanceEm(run)
    // Counted on the UNROUNDED size, which is the one the layout counted on.
    // `size` is what CSS is given and it is that number rounded to a pixel; a
    // line count taken from the rounded value can differ by one where the measure
    // falls on a boundary, and then the component and `blockExtent` disagree
    // about how tall this block is — which is the disagreement the whole box rule
    // exists to remove. The rounding itself is half a pixel on a size of forty
    // and sits well inside `LINE_SAFETY`'s six per cent.
    const lines = run.nowrap
      ? String(run.text ?? '').trim().length
        ? 1
        : 0
      : textLines(run.text, spent * typeRole(run.role).step, width, run.tracking, advance)
    // A run with nothing in it costs nothing, which is how an absent attribution
    // leaves a quote its whole box instead of a blank line in the middle of it.
    if (lines === 0) continue
    const leading = typeRole(run.role).leading
    drawn.push({ index, role: run.role, size, leading, lines, height: lines * size * leading })
  }

  const gap = RUN_GAP * solved
  const furniture = Math.max(0, (Number(shape.fixed) || 0) * solved)
  const stacked = drawn.reduce((sum, run) => sum + run.height, 0)
  return {
    unit: solved,
    furniture,
    gap,
    runs: drawn,
    height: furniture + stacked + Math.max(0, drawn.length - 1) * gap,
  }
}

/** The `n`th run of the weight table, or nothing — a text block reads its runs by position. */
export function runAt(layout, index) {
  return (layout?.runs ?? []).find((run) => run.index === index) ?? null
}

// ── The masked word cascade ──────────────────────────────────────────────────

/**
 * How far a word sits below its own mask before it arrives, as a percentage of
 * its line box.
 *
 * Past 100 on purpose, and the reason is `AnimatedTitlesVideo`'s: the box is
 * padded below the baseline so `overflow: hidden` does not clip a descender,
 * which also means a word translated by exactly its own height still shows a row
 * of pixels in that padding — one sliver under every word of a headline, on every
 * frame before it arrives.
 */
export const MASK_TRAVEL_PERCENT = 135

/**
 * How much a word overlaps the one before it: it begins when its predecessor is
 * a little over half arrived.
 *
 * Higher than 1 because a cascade of words that each wait for the previous one to
 * land is a queue rather than a sentence — the eye reads a headline as one
 * gesture and 0 overlap makes an eight-word line take eight beats.
 */
export const WORD_OVERLAP = 2.2

/**
 * How much longer the emphasised word takes than its neighbours.
 *
 * Read off the two frame counts rather than chosen again, so the accented word of
 * a composed heading and the accented word of a titled card are the same gesture:
 * `EMPHASIS_ENTER_FRAMES` against `CUE_ENTER_FRAMES` is the house's one answer to
 * "one element of this cascade is the stress mark". Retyped as 1.7 it would drift
 * the day either constant moves.
 */
export const EMPHASIS_RATIO = EMPHASIS_ENTER_FRAMES / CUE_ENTER_FRAMES

/**
 * How far the `index`th word of `count` has arrived, given the block's own
 * arrival.
 *
 * A block is handed ONE `progress` — `cueProgress` has already placed and eased
 * the block's entrance — so a cascade inside a block is a division of that one
 * ramp, not a second set of cues. Three properties, and each of them is a
 * failure somebody would otherwise ship:
 *
 *   - **Every word is arrived when `progress` is 1.** A window that ran past the
 *     end would be a word that never lands: `progress` stops at 1 and stays there
 *     for the rest of the scene, so anything scheduled past it is a headline
 *     missing its last word for the whole film.
 *   - **The last word finishes last, and it takes longer.** Same stress mark the
 *     titled card puts on the last word of a headline, and it costs nothing: the
 *     window is longer, not later. A sentence lands on its end.
 *   - **A single word is left alone.** Nothing to stagger against, and accenting
 *     the only word there is is a colour change rather than an accent — the rule
 *     `AnimatedTitlesVideo` already applies to a one-word headline.
 *
 * The windows are solved rather than clipped, exactly as `cueFrames` scales a
 * cascade instead of piling its overflow onto one frame: the last word's longer
 * travel is paid for out of the step, so twelve words and two words both end at
 * the same place.
 */
export function wordReveal(progress, index, count) {
  const total = Math.max(1, Math.floor(Number(count) || 0))
  const at = clamp01(progress)
  if (total === 1) return at
  const i = Math.min(total - 1, Math.max(0, Math.floor(Number(index) || 0)))
  // Solved so that `(total - 1) * step + EMPHASIS_RATIO * span` is exactly 1:
  // the last word starts one step after its neighbour and finishes on the beat
  // the block's own arrival finishes.
  const step = 1 / (total - 1 + EMPHASIS_RATIO * WORD_OVERLAP)
  const span = step * WORD_OVERLAP
  const window = i === total - 1 ? EMPHASIS_RATIO * span : span
  return clamp01((at - i * step) / window)
}

/**
 * How far a run rises into place, in ems of ITS OWN size.
 *
 * An em and not a fraction of the short edge, which is what it was: a quotation
 * set at 120 px in a full frame and one set at 30 px in a corner cell were both
 * travelling the same 17 px, so the small one arrived from another zone and the
 * large one barely moved. A gesture scaled to the thing making it is the same
 * gesture at every box, which is `MEAN_GLYPH_EM`'s argument applied to motion.
 */
export const RUN_RISE_EM = 0.2

export function runRise(size, progress) {
  return (1 - clamp01(progress)) * Math.max(0, Number(size) || 0) * RUN_RISE_EM
}

// ── Slices of one arrival ────────────────────────────────────────────────────

/**
 * One stage of a block's own entrance, renormalised to 0…1.
 *
 * The blocks of a scene get their beat from `layerCues`; the ELEMENTS of one
 * block get theirs from here, because a block is one cue and nothing downstream
 * of `sceneMotion` knows it has three parts. Windows overlap on purpose — three
 * stages arriving strictly one after another inside nine frames reads as a
 * stutter, while overlapping them reads as a cascade.
 */
export function phase(progress, from, to) {
  const start = Number(from)
  const end = Number(to)
  const at = clamp01(progress)
  if (!Number.isFinite(start) || !Number.isFinite(end) || !(end > start)) return at
  return clamp01((at - start) / (end - start))
}

/**
 * The three stages of a quote: the mark is drawn, the sentence lands, the
 * attribution follows.
 *
 * The attribution's window ENDS at 1 like every other, for the reason
 * `wordReveal` states: a stage scheduled past the block's own arrival is a line
 * that never appears, since `progress` stops at 1 and stays there.
 */
export const QUOTE_CUES = {
  mark: [0, 0.45],
  text: [0.15, 0.85],
  attribution: [0.5, 1],
}

export function quoteCue(name, progress) {
  const window = pick(QUOTE_CUES, name, QUOTE_CUES.text)
  return phase(progress, window[0], window[1])
}

// ── Rules, and the thing that keeps moving ───────────────────────────────────

/** How much of a running rule is the accent's, before the hairline takes over. */
export const RULE_ACCENT_SHARE = 0.14

/** The quiet half of a rule, as a fraction of the ink beside it. */
export const RULE_QUIET_ALPHA = 0.3

/** How many hairlines thick the heavy segment of a double rule is. */
export const RULE_HEAVY_WEIGHT = 3

/**
 * The two thicknesses of the family's double rule, bounded by the band it is
 * drawn in.
 *
 * A thickness is a CONSTANT METRIC — one of exactly three quantities still read
 * off the frame, because a hairline 3 px under one heading and 9 px under a
 * smaller one is not a hairline, it is two design systems in one film. So it
 * comes from `hairline`, which is where that exception is written down and
 * bounded; this file only says how many of them the heavy segment is worth.
 *
 * The second bound is the reason this is a function rather than two constants:
 * an exception with no ceiling is the rule going back out of the window. A
 * 9 px segment inside a furniture band of 6 px is a block drawing past the box
 * `composedLayout` measured, so the band caps it and the hairline is the floor —
 * a rule that thinned to nothing would be furniture that is not there.
 */
export function ruleWeights(base, box, band) {
  const hair = hairline(base, box)
  const room = Math.max(hair, Math.floor(Math.max(0, Number(band) || 0)))
  return { hair, heavy: Math.max(hair, Math.min(hair * RULE_HEAVY_WEIGHT, room)) }
}

/**
 * How much of its measure a rule has drawn — and the answer to "nothing in this
 * frame is allowed to hold still".
 *
 * A block that fades in over nine frames and then freezes for the remaining four
 * hundred is a still with an entrance on it, which is the defect
 * `tests/video-motion.test.js` exists to catch one level up and which a component
 * can reintroduce on its own. `progress` cannot answer it: it is 1 for almost the
 * whole scene, by design. `life` can, and this is how the two combine —
 *
 *   - **`progress` gates it.** A rule under a heading that has not arrived is a
 *     rule under nothing.
 *   - **`life` extends it**, from `rest` when the block lands to its full measure
 *     on the last frame of the scene. Strictly increasing, so no two frames of a
 *     scene draw the same rule.
 *
 * Monotone and bounded by 1, which is what keeps it a rule running its measure
 * rather than an animation: it never retreats and it never overruns.
 */
export function ruleExtent(progress, life, rest) {
  const floor = Number.isFinite(Number(rest)) ? clamp01(rest) : 0
  return clamp01(progress) * (floor + (1 - floor) * clamp01(life))
}

/** Where the rule under a heading stands when the words land: a third of the measure. */
export const HEADING_RULE_REST = 0.34

/** The kicker's rule, and how much of it lands with the text. */
export const KICKER_RULE_REST = 0.55

/** The rule beside a quote's mark: a quarter of it at rest, the rest across the scene. */
export const QUOTE_RULE_REST = 0.26

/**
 * How much of its band the quotation mark stands in, and the aspect of the two
 * slabs that draw it.
 *
 * A share of the band and not of the frame, for the reason the whole file was
 * rewritten: the mark is the quote's furniture, `BLOCK_APPETITE` says how much
 * of the stack that furniture is worth, and the band is that number in pixels. A
 * mark sized off the short edge was the same mark in a corner cell and in a full
 * frame — enormous in the first and lost in the second.
 */
export const QUOTE_MARK_SHARE = 0.86
export const QUOTE_MARK_ASPECT = 24 / 20
export const QUOTE_MARK_GAP_SHARE = 0.3

export function quoteMark(band) {
  const room = Math.max(0, Number(band) || 0)
  const height = room * QUOTE_MARK_SHARE
  return { height, width: height * QUOTE_MARK_ASPECT, gap: room * QUOTE_MARK_GAP_SHARE }
}

// ── The marker, which is drawn and never posed ───────────────────────────────

/**
 * When the marker starts being drawn, as a fraction of the block's arrival.
 *
 * After the line, never with it: a highlight that appears at the same instant as
 * the words it marks is a coloured word rather than a mark somebody made.
 */
export const MARK_DRAW_FROM = 0.35

/**
 * How much of the word's height the marker covers when it first lands.
 *
 * A highlighter stroke soaks upwards through what it crosses, and that is the
 * term that keeps this block moving for the whole scene rather than for nine
 * frames of it. It is a FLOOR and it only ever rises, which matters for more
 * than the look: see `markerClip`.
 */
export const MARK_SOAK_FLOOR = 0.72

export function markerDraw(progress) {
  return phase(progress, MARK_DRAW_FROM, 1)
}

export function markerSoak(life) {
  return MARK_SOAK_FLOOR + (1 - MARK_SOAK_FLOOR) * clamp01(life)
}

/**
 * How much of a marked line's furniture stands above it, the rest standing below.
 *
 * Half and half, and the number it has to cover is `BOX_PAD_EM + BOX_TRAVEL_EM`:
 * the drawn box stands off the word by that much at the start of the scene and
 * closes onto it, and the underline drops by `UNDERLINE_DROP_EM +
 * UNDERLINE_TRAVEL_EM`. Both are ems of the run, the run is the body step, and
 * the band is `fixed * unit` - so the two are comparable numbers and
 * `text.test.js` compares them. An ornament drawn outside the block's own band is
 * an ornament in the stack gap or over its neighbour, which is the same failure
 * as a block through the bottom of its box, arriving through a decoration.
 */
export const HIGHLIGHT_ROOM_SHARE = 0.5

export function highlightRoom(band) {
  return Math.max(0, Number(band) || 0) * HIGHLIGHT_ROOM_SHARE
}

/** The rule a line with nothing marked draws instead: it lands at a third and runs the rest. */
export const HIGHLIGHT_RULE_REST = 0.33

/** A fraction as a CSS percentage, at two decimals so a frame's clip is a stable string. */
const percent = (value) => `${Math.round(clamp01(value) * 10000) / 100}%`

/**
 * The clip the marker's FILL and the ink on it both use — one string, two layers.
 *
 * This is the whole legibility argument of `textHighlight`, expressed as
 * geometry. A marked run painted in `palette.onFill` is an ink measured against
 * the accent, and while the marker is only half drawn the other half of that run
 * would be sitting on the GROUND — an ink on a surface nobody measured, which is
 * the defect that shipped a dark green headline on a near-black frame arriving
 * through an ornament instead of through a token.
 *
 * So the marker is not painted under the word and the word is not recoloured on
 * top of it. Two copies of the run are stacked — one in the ground's ink, one in
 * the fill's — and the fill and the second copy are clipped by this SAME
 * rectangle. Every pixel of the frame is therefore one of two measured pairs:
 * the ground's ink on the ground, or the fill's ink on the fill. There is no
 * third state at any point of the wipe, and none while the stroke soaks upward.
 *
 * Which is also why `markerSoak` may only rise: an uncovered top slice of a glyph
 * shows the ground copy, which is legible, while a covered slice with no fill
 * under it would not be.
 */
export function markerClip(progress, life) {
  return `inset(${percent(1 - markerSoak(life))} ${percent(1 - markerDraw(progress))} 0% 0%)`
}

/**
 * The same wipe with no vertical term, for the two treatments that draw an
 * ORNAMENT rather than a surface.
 *
 * A rule two device pixels tall clipped by 28% of its own height is a rule
 * nobody sees; the underline and the box move vertically by their offset instead,
 * which is a position rather than a mask.
 */
export function markerWipe(progress) {
  return `inset(0% ${percent(1 - markerDraw(progress))} 0% 0%)`
}

/** How far under the baseline the underline sits: it rises to meet the word across the scene. */
export const UNDERLINE_DROP_EM = 0.06
export const UNDERLINE_TRAVEL_EM = 0.07

export function underlineDropEm(life) {
  return UNDERLINE_DROP_EM + (1 - markerSoak(life)) * UNDERLINE_TRAVEL_EM
}

/** How far the drawn box stands off the word: it closes onto it across the scene. */
export const BOX_PAD_EM = 0.14
export const BOX_TRAVEL_EM = 0.1

export function boxPadEm(life) {
  return BOX_PAD_EM + (1 - markerSoak(life)) * BOX_TRAVEL_EM
}

/**
 * The corner radius of the `box` treatment: the project's own, bounded by the
 * marked run it is drawn around.
 *
 * A radius is one of the three `CONSTANT_METRICS` — it comes off the theme rather
 * than off a box, because a corner that grew with the thing it rounds is a shape
 * that changed from one scene to the next. The same paragraph of `composition.js`
 * says in the next breath that the exception has a CEILING, and this treatment was
 * one of the two places in the catalogue that did not apply it: the component
 * wrote `borderRadius: theme.radiusPx` raw, while `button`, `form`,
 * `notification`, `gallery` and `carousel` all clamp theirs.
 *
 * It is reachable rather than theoretical. `ThemeSchema` accepts a whole number of
 * pixels up to 9999 and `parseDesignSpec` reads whatever a direction stated, so an
 * ordinary "generous corners" of 40 px drew a marked word inside a lozenge and a
 * larger one drew an ellipse around it — on the one block whose whole job is to
 * put a mark on a WORD.
 *
 * Both dimensions are the family's own estimate rather than a measurement: the
 * line box for the height, `textWidth` for the measure, exactly as `textLayout`
 * counts lines. Both are FLOORS of the drawn box — it stands off the word by
 * `boxPadEm` and closes onto it across the scene, and the fill adds its own
 * padding — so the bound errs the way `LINE_SAFETY` does, tight rather than
 * generous.
 */
export function markerRadius(radiusPx, run, mark) {
  const size = Math.max(0, Number(run?.size) || 0)
  const leading = Math.max(0, Number(run?.leading) || 0)
  const room = Math.min(size * leading, textWidth(mark, size))
  const asked = Math.max(0, Math.round(Number(radiusPx) || 0))
  return Math.max(0, Math.min(asked, Math.floor(room * CONSTANT_CEILING)))
}

/**
 * Where the marked run sits in the line, or nowhere.
 *
 * A search over prose and not a parse: I1 is about discovering names in generated
 * SOURCE with a regular expression and it names the exemption for laying out
 * prose somebody wrote. A `mark` that does not occur leaves the line unmarked —
 * never an error, never a repair, and never a second search with different rules.
 */
export function splitMark(text, mark) {
  const line = String(text ?? '')
  if (!mark) return [line, '', '']
  const at = line.indexOf(String(mark))
  if (at < 0) return [line, '', '']
  return [line.slice(0, at), String(mark), line.slice(at + String(mark).length)]
}
