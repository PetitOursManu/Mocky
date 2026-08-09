/**
 * The arithmetic of the four ANIMATED TEXT blocks — `typewriter`,
 * `animatedList`, `counter` and `logoType`: their beat, and their GEOMETRY.
 *
 * It sits in a plain `.js` beside them for the reason `composition.js` exists one
 * level up: a `.jsx` needs a React renderer to be run at all, and "does this line
 * finish typing before the cut" and "does this figure fit the box it was given"
 * are the last two questions anybody wants answered by watching an mp4.
 * Everything here is a pure function of numbers, and `animatedText.test.js` runs
 * it against the cues `layerCues` really produces and the boxes `composedLayout`
 * really hands out.
 *
 * It holds no colour and no easing curve, exactly like the components that read
 * it — the house curve reaches a block already applied, as `progress`.
 *
 * ── The geometry half, and the six exports it is written against ─────────────
 *
 * Every size in this family used to be a fraction of `base`, the frame's short
 * edge: `0.038` for a typed line, `0.034` for a list item, a ramp from `0.13` for
 * a figure, another from `0.062` for a wordmark. Four authors, four fractions,
 * and none of them could see the box the block had been given — so a `typewriter`
 * alone in a scene was a small line of text in the middle of a black frame, and a
 * `counter` stacked beside a `heading` crushed it by a factor of three.
 *
 * Both defects have one answer and it is not in this file: `composedLayout`
 * publishes one box per block and one type UNIT per stack, and `composition.js`
 * holds the single scale those units are stepped on (`TYPE_ROLES`). What is here
 * is the reading of it — the four layouts below take a box and a unit and answer
 * with the pixels their component draws, which is what makes "does it fill its
 * box" a claim rather than an intention.
 *
 * The roles are NOT chosen here either. `BLOCK_APPETITE` in `composition.js` is
 * what budgeted each block's height, run by run, and a block drawing a run at a
 * role the table did not budget is a block taller than the box it was measured
 * into. The test asserts the two agree, in both directions.
 *
 * FOR WHOEVER REVIEWS THE SIX FAMILIES TOGETHER: shared arithmetic belongs in
 * `composition.js`, and this is one family's, written while five other authors
 * were in this directory. If a second family turns out to want the same clock,
 * that is the moment to move it up — never to import this file sideways.
 */

import {
  RUN_GAP,
  blockShape,
  hairline,
  meanAdvanceEm,
  ordinalLabel,
  shapeCeiling,
  solveTypeUnit,
  textLines,
  textWidth,
  typeRole,
  typeSize,
} from '../composition.js'

const clamp01 = (n) => {
  const at = Number(n)
  if (!Number.isFinite(at)) return 0
  return Math.min(1, Math.max(0, at))
}

/**
 * ── The family clock ─────────────────────────────────────────────────────────
 *
 * These four blocks all have something to say that takes TIME: characters, items,
 * digits, letters. Every one of them was a stub that walked `progress`, and
 * `progress` is nine frames — 300 ms, the length of an arrival. A hundred and
 * twenty characters typed in 300 ms is not a typewriter, it is a wipe; six items
 * cascading inside it are 50 ms apart, which is one arrival with a soft edge.
 *
 * So the reveal runs on `life`, the scene's own clock, and completes at a SHARE
 * of it — which is also the only way this file can promise anything about the
 * cut. A block is handed no duration and no frame rate (see the note at the foot
 * of this file), so a rhythm in seconds is not expressible here; a fraction of a
 * scene is, and it is the fraction that makes "finished before the cut" a
 * statement rather than a hope.
 *
 * `progress` is still the gate, and taking the MINIMUM of the two is the whole
 * trick. Without it a block cued late — rank 7, or a scene too short for its own
 * cascade — would appear with its line already typed and its counter already
 * landed, because `life` had run on while the block was not on screen. With it,
 * the reveal is 0 at the cue whatever `life` has done, and a late block types
 * fast rather than arriving finished. Both terms are non-decreasing, so their
 * minimum is too: nothing ever un-types.
 */
export function revealRamp(progress, life, share) {
  const window = clamp01(share)
  const walked = window > 0 ? clamp01(clamp01(life) / window) : 1
  return Math.min(clamp01(progress), walked)
}

/**
 * How much of a scene each of the four spends revealing itself.
 *
 * Two thirds for the two that are READ — a line finishes typing with a third of
 * the scene left to be read, and a list finishes cascading with a third of it
 * left for the last item to be looked at. Three quarters for the counter, because
 * a figure is taken in at a glance and the count itself is the interesting part.
 * Half for the wordmark: a logo is one object, and half a scene assembling
 * against half standing still is what a wordmark does.
 */
export const TYPE_SHARE = 0.66
export const LIST_SHARE = 0.66
export const COUNT_SHARE = 0.75
export const LOGO_SHARE = 0.5

/**
 * One element of a cascade, as a window cut out of the family clock.
 *
 * `span` is how many slots wide one element's own travel is: at 1 the elements
 * are strictly sequential, above it they overlap. Overlap is what makes a list
 * read as a cascade rather than as a queue at a counter — a second item that
 * starts before the first has settled is the same shape `cueFrames` gives the
 * five monolithic templates.
 *
 * The LAST element finishes exactly at 1 whatever the count, which is the only
 * property anything else in this file depends on: `revealRamp` reaches 1 before
 * the cut, so every element does, and the proof does not have to be repeated per
 * element.
 */
export const LIST_ITEM_SPAN = 1.6
export const LETTER_SPAN = 3

export function staggerRamp(count, index, ramp, span = LIST_ITEM_SPAN) {
  const walked = clamp01(ramp)
  // The last element's window is `1 - width` wide and starts at `width` from the
  // end, and the two do not add back up to 1 in binary: six items came out at
  // 0.9999999999999998 on the frame the reveal was over. Nothing looks different
  // at that opacity, and everything that leans on "every element has arrived"
  // does — so the end of the ramp is stated rather than computed.
  if (walked >= 1) return 1
  const total = Math.max(1, Math.floor(Number(count)) || 0)
  const at = Math.min(total - 1, Math.max(0, Math.floor(Number(index)) || 0))
  const width = Math.min(1, Math.max(Number(span) || 1, 1) / total)
  const start = total > 1 ? (at * (1 - width)) / (total - 1) : 0
  return clamp01((walked - start) / width)
}

// ── The geometry every one of the four is laid out with ──────────────────────

const px = (n) => Math.max(0, Math.round(Number(n) || 0))
const side = (box, key) => Math.max(0, Number(box?.[key]) || 0)

/**
 * The roles this family draws, one per run, and they are a READING of
 * `BLOCK_APPETITE` rather than a second opinion about it.
 *
 * The weight table is what decided how tall each of these blocks may be — it
 * wrapped a typewriter's line as a `title` and a counter's label as a `caption`
 * and handed `stackIn` the answer. A component drawing the same run one step
 * larger is a block past the bottom of a box that was measured without it, and
 * nothing would say so: the box is not a clip, it is a promise. So the two lists
 * are held equal by the test rather than by whoever edits one of them.
 */
export const TYPEWRITER_ROLE = 'title'
export const LIST_ROLE = 'body'
export const LIST_MARKER_ROLE = 'caption'
export const COUNTER_ROLE = 'figure'
export const COUNTER_LABEL_ROLE = 'caption'
export const LOGO_ROLE = 'title'

/**
 * The type unit a block really draws at.
 *
 * The stack's, when it has one — that is the whole of the second defect: two
 * blocks in one zone that solve their own units are two scales, and a `figure`
 * step over a `title` step is 1.8 while 0.13 of the frame over 0.042 of it was
 * 3.1. `composedLayout` publishes one unit per zone and every block in the zone
 * reads it.
 *
 * Capped by `shapeCeiling` for the same reason `shapeHeight` caps it: a run that
 * cannot break is bounded by the MEASURE and not by the box, so a seven-digit
 * counter in a narrow column stops growing before the column does. Uncapped, the
 * figure would be exactly as tall as the box allows and half of it would be
 * outside the frame.
 *
 * The fallback — solving against the box alone — is for a caller with no stack,
 * which in this pipeline is nobody: `ComposedSceneVideo` always passes the unit.
 * It is here because a block that draws at 1 px because a prop was undefined is
 * a film nobody can watch, and a block a step off its neighbour is a film that
 * merely looks worse (Q1).
 */
export function drawnUnit(block, box, unit) {
  const shape = blockShape(block)
  const width = side(box, 'width')
  const at = Number(unit)
  const solved = Number.isFinite(at) && at > 0 ? at : solveTypeUnit([shape], width, side(box, 'height'))
  return Math.max(0, Math.min(solved, shapeCeiling(shape, width)))
}

/**
 * The largest unit at which one unbreakable run still fits a measure — the same
 * question `shapeCeiling` answers, asked about a string the weight table did not
 * have.
 *
 * A counter's figure is grouped for reading — `1 000 000` is nine characters
 * where `counterFace` counted seven — so measured on the table's own string it
 * would be set 28% wider than the measure it was cleared for. The wordmark has
 * the same shape of error with two more claimants on the same measure, so it
 * builds its own room out of the same arithmetic rather than calling this with
 * one of the three. Both correct in the safe direction: the block comes out a
 * little smaller than budgeted, never a little wider than its box.
 */
export function fitUnit(role, text, width) {
  const per = textWidth(text, 1)
  if (!(per > 0)) return Infinity
  return Math.max(0, Number(width) || 0) / per / typeRole(role).step
}

/**
 * A role's size at a unit, and never rounded UP past the unit it was solved for.
 *
 * `typeSize` rounds to the nearest pixel, which is right for a size read off a
 * scale and wrong for one that has to fit a box somebody has already solved.
 * `solveTypeUnit` measured a line at 51.9 px and the round handed the component
 * 52, at which one more character stopped fitting the measure: a two-line
 * paragraph became three, 178 px of type in a 158 px box, in the one place the
 * arithmetic was meant to be exact. Half a pixel of type is invisible on a
 * frame; a line is not.
 *
 * Down and not to nearest, therefore — and it is the same asymmetry `LINE_SAFETY`
 * is: everything in this family errs towards a block a hair inside its box.
 */
function fittedType(role, unit) {
  const at = Math.max(0, Number(unit) || 0)
  return Math.max(1, Math.min(typeSize(role, at), Math.floor(at * typeRole(role).step)))
}

/** How tall `lines` of a role run, at a size. The leading is the scale's, never a block's. */
function runHeight(role, lines, size) {
  return lines * size * typeRole(role).leading
}

/**
 * What is left of a box once its content is drawn, as a gap and as air.
 *
 * The gap is capped at `RUN_GAP` — the rhythm `shapeHeight` budgeted between two
 * runs of one block — and everything past it becomes air above and below. That
 * asymmetry is deliberate in both directions. Leftover spent on the gaps would
 * be a block whose runs drift apart as its box grows, which is a stack coming
 * loose rather than a block filling; leftover spent on air keeps the block one
 * object and centres it in the room it did not need.
 *
 * And when there is no leftover the gap COLLAPSES rather than the box being
 * crossed. Nothing here should ever reach that — the unit each of the four draws
 * at was solved against the measure it really wraps in — so it is the belt behind
 * the braces: a rounding nobody predicted spends the rhythm between two runs
 * before it spends the promise the box is.
 */
function spread(height, content, gaps, cap) {
  const budget = Math.max(0, Math.max(0, Number(height) || 0) - content)
  const gap = gaps > 0 ? Math.min(Math.max(0, cap), budget / gaps) : 0
  return { gap: Math.round(gap), air: Math.round(Math.max(0, (budget - gap * gaps) / 2)) }
}

// ── typewriter ───────────────────────────────────────────────────────────────

/**
 * How many characters of a line have been typed.
 *
 * `Array.from` and not `.length`, because a `.slice` on a UTF-16 length cuts a
 * surrogate pair in half and paints the replacement glyph — a lone hollow box at
 * the end of a line, on exactly the frame a viewer is reading it. The schema's
 * charset is the user's prose: an emoji in a caption is legal and normal.
 */
export function typedCount(text, ramp) {
  const letters = Array.from(String(text ?? ''))
  return Math.round(letters.length * clamp01(ramp))
}

/** The typed head and the untyped tail, as two strings. Split once, here. */
export function typedSplit(text, ramp) {
  const letters = Array.from(String(text ?? ''))
  const shown = typedCount(text, ramp)
  return { typed: letters.slice(0, shown).join(''), rest: letters.slice(shown).join('') }
}

/**
 * The caret's own cadence — blinks over the whole scene, and never a fraction of
 * a blink.
 *
 * On or off, as a boolean, and that is a legibility decision rather than a
 * stylistic one. The caret is painted in `palette.accent`, a colour measured at
 * the display floor AGAINST THE GROUND; a caret at 0.4 opacity is a colour
 * nobody measured, arrived at by fading a measured one. Painted or absent, both
 * states are known.
 *
 * Solid while the line is still being typed, because that is what a cursor does
 * under somebody's fingers — and because a blink competing with characters
 * arriving reads as a stutter rather than as typing.
 *
 * The count is per SCENE and not per second, and that is a real limitation
 * rather than a choice: a block is handed `progress` and `life`, both already
 * normalised, so nothing here can know whether the scene is a second and a half
 * or fifteen. Five blinks is the compromise — on the shortest scene the line is
 * still typing through most of it and the caret barely flips, on the longest it
 * is a slow pulse. A cadence in hertz needs `durationInFrames` or `fps` on the
 * props, which `ComposedSceneVideo` already holds and does not pass.
 */
export const CARET_BLINKS_PER_SCENE = 5

export function caretOn(ramp, life) {
  if (clamp01(ramp) < 1) return true
  return Math.floor(clamp01(life) * CARET_BLINKS_PER_SCENE * 2) % 2 === 0
}

/**
 * The caret, cut from the type rather than from the frame.
 *
 * A block caret and not the `|` glyph — a rectangle exists in every renderer and
 * the pipe is a different width in every face — so its two dimensions are this
 * file's business. Both are ems of the line they sit in, which is the whole point
 * of taking them off the type size: a typed line that now fills its box is set at
 * 130 px in a full frame and at 34 px in a corner of one, and a caret fixed at a
 * fraction of the frame was a bar taller than the letters in the second case.
 */
export const CARET_WIDTH_EM = 0.075
export const CARET_HEIGHT_EM = 0.92

/**
 * A typed line in the box it was given.
 *
 * The line is set at the stack's unit stepped to `title`, wrapped against the
 * box's own measure, and the leftover becomes air above and below — so a
 * typewriter alone in a scene is a paragraph across the safe area rather than the
 * small line in the middle of a black frame that six real exports showed.
 *
 * `Math.max(1, …)` on the line count because `textLines` answers 0 for an absent
 * run and `TypewriterBlockSchema.text` is required: a block that measured itself
 * at zero lines would be a block with no air either, drawn on the box's top edge.
 */
export function typewriterLayout(block, box, unit) {
  const width = side(box, 'width')
  const at = drawnUnit(block, box, unit)
  const size = fittedType(TYPEWRITER_ROLE, at)
  const lines = Math.max(1, textLines(block?.text, size, width))
  const content = Math.round(runHeight(TYPEWRITER_ROLE, lines, size))
  const { air } = spread(side(box, 'height'), content, 0, 0)
  return {
    unit: at,
    size,
    lines,
    leading: typeRole(TYPEWRITER_ROLE).leading,
    content,
    air,
    // The ink across the measure, `blockExtent`'s own answer for a run of type: a
    // line that wrapped has spent all of it by definition, and one that did not
    // has spent what its words take. It is the other half of "fills its box" —
    // a `title` of two words fills its width and stops, and that is the content's
    // business rather than the layout's.
    width: lines > 1 ? width : Math.min(width, Math.round(textWidth(block?.text, size))),
    height: content + 2 * air,
    caret: { width: Math.max(2, px(size * CARET_WIDTH_EM)), height: px(size * CARET_HEIGHT_EM) },
  }
}

// ── animatedList ─────────────────────────────────────────────────────────────

/**
 * The text of a marker, or `null` when the marker is a SHAPE.
 *
 * `dot` and `rule` are drawn — a rectangle and a disc — and never `•` or `–`.
 * The container installs one font family, and a glyph it does not have renders as
 * a hollow box beside every item of the list: the same reason `ordinalLabel`
 * replaced the product card's dots, which is why the numerals come from there
 * rather than from a `padStart` retyped here.
 */
export function markerLabel(marker, index) {
  return marker === 'numeral' ? ordinalLabel(index) : null
}

/**
 * The marker column, and the two shapes that stand in it.
 *
 * Its width is the widest numeral the schema can produce — six items, so `06`,
 * measured as two glyphs — plus the air between a mark and the word it belongs
 * to. Measured rather than named: `MARKER_COLUMN = 1.7` was a number somebody
 * chose for one type size, and the column has to be the mark's own width now that
 * the mark is a step of a scale solved per stack.
 *
 * The dot and the rule are fractions of the MARK, not of the frame — a disc a
 * third of a numeral's height reads as a bullet at every size. The rule's
 * thickness is the one thing here that is not: it is `hairline`, a constant
 * metric, because a rule 1 px under a small list and 4 px under a large one is
 * two design systems in one film.
 */
export const MARKER_MEASURE = '00'
export const MARKER_GAP_EM = 0.45
export const MARKER_DOT_SHARE = 0.4
export const MARKER_RULE_SHARE = 0.95

/**
 * And a marker column is a COLUMN: a quarter of the measure at the very most.
 *
 * The same quarter `CONSTANT_CEILING` puts on a hairline, for the same reason —
 * a proportion is right until it is most of the frame. A list of one item alone
 * in a scene solves an enormous unit, and at that unit two numerals and their air
 * came to 639 px of a 906 px measure: two thirds of the line spent on `01`, and
 * the item behind it wrapping onto three lines to fit what was left. Past the
 * ceiling it is the MARK that yields and never the measure, because the mark is
 * the decoration and the item is the sentence.
 */
export const MARKER_CEILING = 0.25

function markerColumn(size, marker, width) {
  const gap = MARKER_GAP_EM * size
  const ceiling = Math.max(1, width * MARKER_CEILING)
  const per = textWidth(MARKER_MEASURE, 1)
  if (per * marker + gap <= ceiling) return { column: px(per * marker + gap), size: marker }
  return { column: px(ceiling), size: Math.max(1, Math.min(marker, Math.floor(Math.max(0, ceiling - gap) / per))) }
}

/**
 * A list in the box it was given: one row per item, wrapped, and the leftover
 * spent on the rhythm between them.
 *
 * The items are set at the stack's unit — the BODY step, which is the unit
 * itself — so three items in a large box are three large lines rather than three
 * small ones at the top of it. That is the whole fix, and it happens in
 * `solveTypeUnit` rather than here: a zone holding one list solves its unit so
 * that the list fills the zone.
 *
 * The measure is the box MINUS the marker column, which is the one thing this
 * family knows that the weight table does not. `BLOCK_APPETITE` wraps the items
 * against the full width, so six items each landing within a marker's width of a
 * line break are six lines nobody budgeted — 8.4 units of overflow against 1.75
 * of give, which is a list through the bottom of its box and through whatever is
 * under it.
 *
 * So the list solves its own ceiling against its real measure and takes the
 * SMALLER of the two units. That is not a second scale: it is exactly what
 * `shapeCeiling` already does for a run that cannot break — a shape may draw at
 * less than its stack's unit when its own content will not fit, and a wordmark
 * in a narrow zone has been doing it since the scale existed. The column is
 * measured at the stack's unit first, which over-states it slightly and is
 * therefore the safe direction: the real measure ends up a little wider than the
 * one the ceiling was solved against, so the rows can only come out shorter.
 */
export function listLayout(block, box, unit, base) {
  const width = side(box, 'width')
  const stack = drawnUnit(block, box, unit)
  const claimed = markerColumn(typeSize(LIST_ROLE, stack), typeSize(LIST_MARKER_ROLE, stack), width).column
  const at = Math.min(stack, solveTypeUnit([blockShape(block)], Math.max(1, width - claimed), side(box, 'height')))
  const size = fittedType(LIST_ROLE, at)
  // Non-decreasing in the unit, capped or not, which is what makes `claimed` an
  // upper bound of it: the measure the rows are really wrapped against can only
  // be wider than the one the ceiling above was solved for.
  const mark = markerColumn(size, fittedType(LIST_MARKER_ROLE, at), width)
  const column = mark.column
  const marker = mark.size
  const measure = Math.max(1, width - column)
  const items = Array.isArray(block?.items) ? block.items : []
  const rows = items.map((text) => {
    const lines = Math.max(1, textLines(text, size, measure))
    return { lines, height: Math.round(runHeight(LIST_ROLE, lines, size)), width: Math.min(measure, Math.round(textWidth(text, size))) }
  })
  const content = rows.reduce((sum, row) => sum + row.height, 0)
  const { gap, air } = spread(side(box, 'height'), content, Math.max(0, rows.length - 1), RUN_GAP * at)
  return {
    unit: at,
    size,
    leading: typeRole(LIST_ROLE).leading,
    rows,
    gap,
    air,
    column,
    // The first line's own box, so a mark sits on the line it belongs to rather
    // than on the middle of an item that wrapped onto four.
    line: Math.round(runHeight(LIST_ROLE, 1, size)),
    marker: {
      size: marker,
      dot: px(marker * MARKER_DOT_SHARE),
      rule: { width: px(marker * MARKER_RULE_SHARE), thickness: hairline(base, box) },
    },
    // An item arrives from the side its own mark is on, so the eye is already
    // where the next one will start. One column's worth, which is the distance
    // between the two things being related.
    slide: column,
    content,
    // The ink across the measure: the column plus the longest item, which is the
    // measure itself as soon as one of them wrapped. Same answer `blockExtent`
    // gives for a run of type, and the other half of "fills its box".
    width: Math.min(width, column + rows.reduce((widest, row) => Math.max(widest, row.width), 0)),
    height: content + gap * Math.max(0, rows.length - 1) + 2 * air,
  }
}

// ── counter ──────────────────────────────────────────────────────────────────

/**
 * The figure at one frame — and it never passes the value it is counting to.
 *
 * Clamped at BOTH ends rather than trusted, because rounding is the way a count
 * overshoots: a ramp of 0.999 on a target of 1000 rounds to 1000, which is right,
 * and any float that lands a hair past the end would round past it, which is a
 * counter that showed a number nobody wrote for one frame.
 *
 * The walk is linear on the family clock and the damping is in the arrival, and
 * that is a limitation this file states rather than hides: the house curve is
 * `easeOutCubic` and a block may not write one — the check in `blocks.test.js`
 * that forbids it is what stops twenty-four components having twenty-four
 * notions of how things move. A genuinely decelerating count needs the curve
 * applied to the SCENE clock, which only `composition.js` can publish.
 */
export function counterValue(from, to, ramp) {
  const start = Number.isFinite(Number(from)) ? Number(from) : 0
  const end = Number.isFinite(Number(to)) ? Number(to) : start
  const at = Math.round(start + (end - start) * clamp01(ramp))
  return Math.min(Math.max(start, end), Math.max(Math.min(start, end), at))
}

/**
 * Digits in groups of three, separated by a NON-BREAKING space.
 *
 * A million written `1000000` is a number nobody reads, and the two obvious
 * separators are both wrong here. `toLocaleString` would make the film depend on
 * the render container's locale — two renders of one timeline differing, which a
 * content-addressed export store cannot have, and the same reason `clock.time`
 * comes from the document rather than from the machine. A comma is a decimal
 * point in half of Europe.
 *
 * Non-breaking and not a plain space: a counter sitting in a narrow zone would
 * otherwise wrap between its own thousands, and the figure would change LINE
 * COUNT as it counted. Not the narrow no-break space either — U+202F is exactly
 * the kind of glyph `fonts-liberation` may not carry, and a missing glyph is the
 * hollow box the whole font stack exists to prevent.
 */
export const GROUP_SEPARATOR = '\u00a0'

export function groupedNumber(value) {
  const at = Math.trunc(Number(value) || 0)
  const digits = String(Math.abs(at))
  const groups = []
  for (let end = digits.length; end > 0; end -= 3) groups.unshift(digits.slice(Math.max(0, end - 3), end))
  return `${at < 0 ? '-' : ''}${groups.join(GROUP_SEPARATOR)}`
}

/** The whole figure as it is painted: the affixes the document wrote, around the grouped value. */
export function counterText(block, value) {
  return `${block?.prefix ?? ''}${groupedNumber(value)}${block?.suffix ?? ''}`
}

/**
 * The widest figure this counter will ever paint, which is what it has to be
 * measured on.
 *
 * Both ENDS, not the target: `from` defaults to 0 but a document may count DOWN,
 * and a counter measured on `to: 100` after starting at `900` is a figure a third
 * wider than its own box on its first frame. Measured on the finished string in
 * either case, never on the one being drawn — a size that fell as the count grew
 * would be a figure breathing a type size at a time.
 */
export function counterWidest(block) {
  const from = counterText(block, Math.trunc(Number(block?.from) || 0))
  const to = counterText(block, Math.trunc(Number(block?.to) || 0))
  return letters(from).length >= letters(to).length ? from : to
}

/** How far a counter rises as it arrives, in ems of its own figure. */
export const COUNTER_RISE_EM = 0.08

/**
 * A counter in the box it was given: the figure at the `figure` step, its label
 * at the `caption` step, and one unit governing both.
 *
 * The figure takes the box because a figure is the subject of the scene it is in
 * — but it takes it through the SCALE and not on its own authority, which is the
 * second half of the defect this pass answers. `FIGURE_SIZE` was a ramp from
 * 0.13 of the short edge and `headingSize` was 0.042 of it, so a counter stacked
 * with a heading came out three times its neighbour in a frame nobody had asked
 * for that emphasis in. Now they are 2.8 and 1.55 of one unit.
 *
 * The width is where the counter needs a measurement of its own: see `fitUnit`.
 */
export function counterLayout(block, box, unit) {
  const width = side(box, 'width')
  const at = Math.min(drawnUnit(block, box, unit), fitUnit(COUNTER_ROLE, counterWidest(block), width))
  const figure = fittedType(COUNTER_ROLE, at)
  const label = fittedType(COUNTER_LABEL_ROLE, at)
  const lines = textLines(block?.label, label, width)
  const head = Math.round(runHeight(COUNTER_ROLE, 1, figure))
  const foot = Math.round(runHeight(COUNTER_LABEL_ROLE, lines, label))
  const content = head + foot
  const { gap, air } = spread(side(box, 'height'), content, lines > 0 ? 1 : 0, RUN_GAP * at)
  return {
    unit: at,
    figure,
    figureLeading: typeRole(COUNTER_ROLE).leading,
    label,
    labelLeading: typeRole(COUNTER_LABEL_ROLE).leading,
    lines,
    gap,
    air,
    content,
    height: content + (lines > 0 ? gap : 0) + 2 * air,
    width: Math.round(textWidth(counterWidest(block), figure)),
    rise: px(figure * COUNTER_RISE_EM),
  }
}

// ── logoType ─────────────────────────────────────────────────────────────────

/**
 * How far one letter of a wordmark still has to travel, from -1 (the far left)
 * to 1 (the far right), 0 once it has closed.
 *
 * The letters start spread apart and converge: that is the assembly, and it is
 * the one animation a wordmark can have that is still typography rather than a
 * logo file being flown in. Each letter closes on its own ramp, so the word
 * gathers rather than sliding as a block.
 *
 * NORMALISED on the outermost letter — the travel is a fraction of a fixed
 * distance, never a per-letter offset multiplied by the letter count. A word of
 * twenty-four letters at a per-letter spread would start eleven letter-widths
 * wider than its own box, which is a wordmark crossing the safe margin on its
 * first frame in the one ratio that has a feed's interface drawn over it.
 */
export function letterShift(count, index, ramp, span = LETTER_SPAN) {
  const total = Math.max(1, Math.floor(Number(count)) || 0)
  const at = Math.min(total - 1, Math.max(0, Math.floor(Number(index)) || 0))
  const centre = (total - 1) / 2
  const away = centre > 0 ? (at - centre) / centre : 0
  return away * (1 - staggerRamp(total, at, ramp, span))
}

/**
 * The letters of a wordmark, one array entry each.
 *
 * `Array.from` for the reason `typedCount` gives, and the spaces are KEPT: a
 * wordmark of two words is two words, and dropping the space would close it into
 * one — the components render each entry in a `white-space: pre` box so the gap
 * survives being an element of its own.
 */
export function letters(text) {
  return Array.from(String(text ?? ''))
}

/**
 * The same letters, grouped into words, each carrying the index its ramp is
 * computed from.
 *
 * A wordmark is drawn one letter per box so each can travel on its own cue, and
 * a row of boxes is a row of things a line break may fall between — so "Studio
 * Bakaus" in a narrow zone came back broken after the second letter. Grouping
 * puts the break where a break belongs: between words, never inside one, and the
 * ramps do not notice because the index travels with the glyph.
 *
 * A run of whitespace is a group of its own so that it stays a legal break, and
 * it is rendered rather than dropped: `line()` accepts a space, and a wordmark
 * that closes up its own gap is not the wordmark that was written.
 */
export function wordGlyphs(text) {
  const groups = []
  let current = null
  letters(text).forEach((glyph, index) => {
    const space = /\s/.test(glyph)
    if (space || !current) {
      current = { space, glyphs: [] }
      groups.push(current)
    }
    current.glyphs.push({ glyph, index })
    if (space) current = null
  })
  return groups
}

/**
 * The mark beside the word: its share of the type, the scale it enters at, and
 * the air between the two.
 *
 * A `slash` is the same height and a fraction of the width, which is what makes
 * it a slash rather than a thin square. The mark enters by growing into place
 * rather than fading, on the FIRST letter's cue: a mark and its word are one
 * object, and giving the mark a beat of its own makes it a second element that
 * happens to be next to a name.
 */
export const MARK_SHARE = 0.62
export const MARK_SLASH_SHARE = 0.28
export const MARK_GAP_EM = 0.3
export const MARK_ENTER_SCALE = 0.55

/** How far the outermost letter of a wordmark starts from its closed position, in ems. */
export const LOGO_TRAVEL_EM = 0.22

/** The mark's own width, in ems of the type beside it: none at all, a square, or a slash's fraction of one. */
function markShare(mark) {
  if (mark === 'none') return 0
  return mark === 'slash' ? MARK_SHARE * MARK_SLASH_SHARE : MARK_SHARE
}

/**
 * A wordmark in the box it was given: one line, as large as the shorter of its
 * two constraints allows.
 *
 * The box's HEIGHT is one of them, through the stack's unit; the box's WIDTH is
 * the other, and the width has three claimants rather than one. The word itself,
 * the mark beside it, and the room the letters need to start apart in — a
 * wordmark solved against the bare measure closes onto an assembly with nowhere
 * to assemble from, and a block that has stopped moving is the defect the whole
 * `sceneMotion` section exists to prevent. Reserving two travels costs about
 * three per cent of the type on the longest legal wordmark; not reserving them
 * costs the animation entirely on exactly the one that fills its box.
 *
 * `shapeCeiling` cannot see the mark, so this is the one size in the family
 * solved from its own arithmetic rather than read off the unit — in the safe
 * direction, as always: smaller than budgeted, never wider than the box.
 */
export function logoLayout(block, box, unit) {
  const width = side(box, 'width')
  const step = typeRole(LOGO_ROLE).step
  // Measured on the wordmark's OWN glyphs. A wordmark is capitals — `MOCKY` is
  // 3.78 em of Liberation Sans Bold against the 2.76 the sentence average
  // predicts — and it cannot wrap, so the error came out on the right-hand side:
  // a real 1:1 export put the `Y` 59 px past the safe margin, six pixels from the
  // edge of the video. See `meanAdvanceEm`.
  const per = textWidth(block?.text, 1, 0, meanAdvanceEm(block?.text))
  const share = markShare(block?.mark)
  const gap = share > 0 ? MARK_GAP_EM : 0
  const room = per + share + gap + 2 * LOGO_TRAVEL_EM
  const size = fittedType(LOGO_ROLE, Math.min(drawnUnit(block, box, unit), room > 0 ? width / room / step : Infinity))
  const mark = { width: px(share * size), height: share > 0 ? px(MARK_SHARE * size) : 0, gap: px(gap * size) }
  const drawn = Math.round(per * size) + mark.width + mark.gap
  const content = Math.round(runHeight(LOGO_ROLE, 1, size))
  const { air } = spread(side(box, 'height'), content, 0, 0)
  return {
    unit: size / step,
    size,
    leading: typeRole(LOGO_ROLE).leading,
    mark,
    // Bounded by the room actually left over, so no letter starts outside the box
    // on the first frame — which in 9:16 is not "near an edge" but behind a feed's
    // own interface.
    travel: Math.max(0, Math.min(px(LOGO_TRAVEL_EM * size), Math.floor((width - drawn) / 2))),
    width: drawn,
    content,
    air,
    height: content + 2 * air,
  }
}
