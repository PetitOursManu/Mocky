/**
 * The arithmetic of the four ANIMATED TEXT blocks — `typewriter`,
 * `animatedList`, `counter` and `logoType`.
 *
 * It sits in a plain `.js` beside them for the reason `composition.js` exists one
 * level up: a `.jsx` needs a React renderer to be run at all, and "does this line
 * finish typing before the cut" is the last question anybody wants answered by
 * watching an mp4. Everything here is a pure function of numbers, and
 * `animatedText.test.js` runs it against the cues `layerCues` really produces.
 *
 * It holds no colour and no easing curve, exactly like the components that read
 * it — the house curve reaches a block already applied, as `progress`.
 *
 * FOR WHOEVER REVIEWS THE SIX FAMILIES TOGETHER: shared arithmetic belongs in
 * `composition.js`, and this is one family's, written while five other authors
 * were in this directory. If a second family turns out to want the same clock,
 * that is the moment to move it up — never to import this file sideways.
 */

import { ordinalLabel } from '../composition.js'

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
export const LOGO_SHIFT = 0.02

export function letterShift(count, index, ramp, span = LETTER_SPAN) {
  const total = Math.max(1, Math.floor(Number(count)) || 0)
  const at = Math.min(total - 1, Math.max(0, Math.floor(Number(index)) || 0))
  const centre = (total - 1) / 2
  const side = centre > 0 ? (at - centre) / centre : 0
  return side * (1 - staggerRamp(total, at, ramp, span))
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
 * A type size that falls as the string gets longer — `verticalCaptionSize`'s
 * shape, applied to the two blocks in this family whose content decides how wide
 * they are.
 *
 * A block is handed `base`, the frame's short edge, and never the width of the
 * box it was laid into: `composedLayout` divides a row among the columns that are
 * used, so the same wordmark may have the whole measure or a third of it. A fixed
 * size tuned on the long string makes every short one tiny, and one tuned on the
 * short string puts "1 000 000 €" through the safe margin of a 9:16 frame.
 *
 * The long end is a RAMP and not a bound, exactly as it is for the vertical
 * caption: a string past it saturates at the minimum, so this number and the
 * schema's may drift apart without producing a disagreement anybody has to
 * discover.
 */
export const LOGO_SIZE = { max: 0.062, min: 0.034, short: 8, long: 24 }
export const FIGURE_SIZE = { max: 0.13, min: 0.072, short: 4, long: 13 }

export function fittedSize(text, base, ramp) {
  const chars = letters(text).length
  const span = Math.max(1, ramp.long - ramp.short)
  const over = clamp01((chars - ramp.short) / span)
  return Math.round(Math.max(0, Number(base) || 0) * (ramp.max - (ramp.max - ramp.min) * over))
}
