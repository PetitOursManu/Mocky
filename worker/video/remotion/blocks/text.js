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
import { CUE_ENTER_FRAMES, EMPHASIS_ENTER_FRAMES } from '../composition.js'

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

// ── Sizes and measures ───────────────────────────────────────────────────────

/**
 * The three heading roles, as fractions of the SHORT edge.
 *
 * `level` is a role and the sizes are the composition's, which is why they are
 * here rather than in the schema: a document says a line is a display line, and
 * what that costs in pixels is a decision somebody made once for all three
 * ratios. `display` is `AnimatedTitlesVideo`'s own headline size, so a composed
 * scene and a titled card set the same word at the same size.
 */
export const HEADING_SIZES = { display: 0.096, title: 0.062, subtitle: 0.042 }

/**
 * How wide a heading is allowed to run, in ems of its OWN size.
 *
 * A measure is a count of characters and never a share of the frame, which is
 * what makes one number right in `16:9`, `9:16` and `1:1` at once — and right
 * again inside a zone that a second block has already halved, where a percentage
 * would cap a display line at a fifth of the frame and set five characters to a
 * line. Twelve ems of display type is roughly twenty-four characters; a display
 * line running past two thirds of a landscape frame is not a heading any more,
 * it is a paragraph, and `text.test.js` holds this table to that sentence.
 *
 * It is a `max-width` and never a width: a zone narrower than the measure wins,
 * because the safe area is a promise and this is a preference.
 */
export const HEADING_MEASURE_EMS = { display: 12, title: 15, subtitle: 20 }

/** A pull quote, and the line that says who said it. */
export const QUOTE_SIZE = 0.05
export const QUOTE_ATTRIBUTION_SIZE = 0.028
export const QUOTE_MEASURE_EMS = 22

/** A marked line: running text, at the size the family sets running text. */
export const HIGHLIGHT_SIZE = 0.04
export const HIGHLIGHT_MEASURE_EMS = 24

export function headingSize(level) {
  return pick(HEADING_SIZES, level, HEADING_SIZES.title)
}

export function headingMeasure(level) {
  return pick(HEADING_MEASURE_EMS, level, HEADING_MEASURE_EMS.title)
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

/**
 * A 1 px rule at the scale of a 1080p frame.
 *
 * Mocky's own direction is "filets de 1px, aucune ombre", and one CSS pixel on a
 * frame that is 1080 tall survives an h.264 encode as a flicker rather than as a
 * line. Three device pixels is what a hairline looks like here — the same number
 * `AnimatedTitlesVideo` draws its double rule with, off the same short edge.
 */
export const RULE_THICKNESS = 0.0028

/** How much of a running rule is the accent's, before the hairline takes over. */
export const RULE_ACCENT_SHARE = 0.14

/** The quiet half of a rule, as a fraction of the ink beside it. */
export const RULE_QUIET_ALPHA = 0.3

export function ruleThickness(base) {
  return Math.max(1, Math.round((Number(base) || 0) * RULE_THICKNESS))
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

/** The kicker's rule, as a fraction of the short edge, and how much of it lands with the text. */
export const KICKER_RULE_MAX = 0.06
export const KICKER_RULE_REST = 0.55

/** The rail down the side of a quote: a quarter of it at rest, the rest across the scene. */
export const QUOTE_RAIL_REST = 0.26

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
