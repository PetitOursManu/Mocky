/**
 * The four interface blocks' own beats and their own boxes — `button`, `form`,
 * `notification` and `lowerThird`.
 *
 * ── Why this is a file and not four components ──────────────────────────────
 *
 * For the reason `sceneMotion` is in `composition.js`: **a `.jsx` cannot be
 * tested**. Remotion is not installed in Mocky's suite and never will be — its
 * licence is why the worker is a separate image at all — so a quantity a
 * component computes for itself is a quantity nobody can ask a question about,
 * and "does this block still move at the end of its scene" is exactly the
 * question a frozen control answers wrong while rendering perfectly. Everything
 * below is a pure function of what a block is handed, and `interface.test.js` is
 * where these numbers stop being prose.
 *
 * That argument was made about the beats and it applies twice as hard to the
 * GEOMETRY, which is the second half of this file and the newer one. "A block
 * inhabits the box it is given" was a sentence in a header while every size in
 * all four components was a fraction of the frame, and nothing anywhere could be
 * asked whether it was true. It is now `buttonGeometry`, `formGeometry`,
 * `noticeGeometry` and `bandGeometry` — four pure functions of a box and a type
 * unit, held against `blockExtent`, which is the same arithmetic computed from
 * the other direction.
 *
 * It sits beside the blocks rather than in `composition.js` because nothing
 * outside this family reads it: `composition.js` holds what several TEMPLATES
 * share, and a press gesture is not that. Moving it there is one import line if
 * a second family ever wants the same beat — which is the moment it would stop
 * being this family's arithmetic and start being the house's. `panelEdge` is the
 * first candidate: a card, a framed picture and a code panel are all surfaces
 * that have to be seen, and the day a second family measures one is the day it
 * belongs upstairs.
 *
 * ── What it is not ─────────────────────────────────────────────────────────
 *
 * It is not a second notion of how things move, and it is not a second type
 * scale. There is no curve here: an arrival is `cueProgress`, already eased by
 * the house `easeOutCubic` before a block ever sees it, and every beat below is
 * a window, a ratio or a cycle over a clock somebody else computed. There is no
 * size here either: every one of them is `typeSize` of a role, on the unit the
 * stack agreed on, and every run a kind is made of is read off `blockShape`
 * rather than listed again. A block that eased its own entrance would be the
 * twenty-fifth notion `blocks.test.js` refuses; a block that invented a size
 * would be the fourth fraction of the frame that made a counter three times the
 * heading beside it.
 */

import {
  anchorCell,
  blockAppetite,
  blockHeight,
  blockShape,
  COMPOSED_BLOCK_DRIFT,
  CONSTANT_CEILING,
  CONTRAST_MIN_LARGE,
  hairline,
  RUN_GAP,
  shapeCeiling,
  solveTypeUnit,
  surfaceRange,
  textWidth,
  typeSize,
  worstRatio,
} from '../composition.js'

/** Read as hostile, like everything else that came off a document. */
function clamp01(value) {
  const at = Number(value)
  if (!Number.isFinite(at)) return 0
  return Math.min(1, Math.max(0, at))
}

// ── The box, and what these four draw in it ─────────────────────────────────
//
// The rule is at the top of `composition.js` and six real exports are why: a
// block draws on the box `composedLayout` handed it, and the only reads of the
// FRAME left are the three constant metrics. All four files here failed it in
// the same way — a pill was `base * 0.03` of type inside `base * 0.018` of
// padding whether its zone was a third of a portrait column or the whole safe
// area, a card was `base * 0.56` wide in a box of 1688 px — so every one of them
// was a small element floating in a large void, which is the "rudimentary" the
// user kept naming.
//
// Everything below answers in PIXELS, out of two props: the block's own box and
// the type unit its STACK agreed on. Nothing here invents a fraction, and
// nothing here re-solves a scale: `typeSize` is the one ramp, `blockShape` is
// where the runs of a kind are written down once, and `interface.test.js` holds
// every answer against `blockExtent` — the same arithmetic asked from the other
// direction, which is what would catch this family drifting from the table that
// divided the zone.

/** A box read as hostile, like everything else that came off a document. */
function safeBox(box) {
  return {
    width: Math.max(0, Number(box?.width) || 0),
    height: Math.max(0, Number(box?.height) || 0),
  }
}

/**
 * The type unit this block reads: its stack's.
 *
 * Passed rather than solved, because two blocks in one zone reading two units is
 * the defect `TYPE_ROLES` exists to close — a `counter` beside a `heading` at
 * three times its size. Re-solving here would land a step away from the
 * neighbour's on the flat tread of a staircase. The fallback is for a caller
 * with a box and no stack, and it is the same expression `typeScale` falls back
 * to for the same reason.
 */
function stackUnit(unit, block, box) {
  const at = Number(unit)
  if (Number.isFinite(at) && at > 0) return at
  return solveTypeUnit([blockShape(block)], box.width, box.height)
}

/**
 * A quantity read off the frame, bounded inside the box it is drawn in.
 *
 * `CONSTANT_METRICS` names the three — a hairline, a radius, the grid's gutters
 * — and the ceiling is what keeps the exception from becoming the rule again: a
 * 12 px radius on a 20 px row is a lozenge rather than a card, and a rule
 * thicker than a quarter of its box IS the block. Not floored at 1: a direction
 * that states a radius of zero has stated a square corner, and rounding it up to
 * a pixel would be the layout overruling the document.
 */
export function constantMetric(px, box) {
  const { width, height } = safeBox(box)
  const room = Math.floor(Math.min(width, height) * CONSTANT_CEILING)
  return Math.max(0, Math.min(Math.round(Number(px) || 0), Math.max(0, room)))
}

/**
 * The height a block's runs take at a unit, across a measure — its box minus its
 * own furniture.
 *
 * Derived from `blockHeight` and `BLOCK_APPETITE` rather than re-added here: the
 * weight table is where a kind's runs are written down, and a second copy of
 * "what a notification is made of" in this file is the drift that put a figure
 * three times the size of the title beside it.
 */
export function runsHeight(block, width, unit) {
  const shape = blockShape(block)
  const at = Math.min(unit, shapeCeiling(shape, width))
  return Math.max(0, blockHeight(block, width, unit) - blockAppetite(block?.kind).fixed * at)
}

/**
 * The largest unit this block's runs fit in the room its furniture leaves, never
 * above the stack's own.
 *
 * This is the one place the four of them are allowed to fall below the shared
 * scale, and the reason is padding. `BLOCK_APPETITE` wraps every run against the
 * WHOLE box, because that is the measure a zone divides; a card then spends some
 * of that measure on its own padding, and a run that fitted three lines across
 * 1688 px takes four across 1448 — a line more than the box was sized for, which
 * is a card overflowing by a line of display type. Capped by the stack's unit it
 * can only ever go DOWN, so two blocks in one zone still cannot disagree upward,
 * and the visible cost is a card whose type is a tenth smaller rather than a
 * card with a sentence clipped off the bottom of it (Q1).
 */
function fitUnit(block, room, unit) {
  const shape = blockShape(block)
  const solved = solveTypeUnit([{ fixed: 0, runs: shape.runs }], room.width, room.height)
  return Math.max(0, Math.min(unit, solved))
}

// ── A panel has to be SEEN, and that is arithmetic too ──────────────────────
//
// A real export named this one. On a light direction — surface `#ffffff` over a
// background `#f7f5f0` — a `notification` had no border and no shadow, so the
// card was invisible and the notice read as a rectangle of text floating on the
// frame. Every run on it had been measured against the panel, correctly, and
// nothing anywhere had asked whether the panel itself could be told apart from
// what it sits on: `composedPalette` resolves what is painted ON a surface, and
// a surface nobody can see is not a legibility failure by that definition.
//
// The house has an answer to this and it is not a shadow. `DESIGN-SYSTEM.md`:
// "les filets remplacent les ombres — l'élévation se lit par la valeur et par un
// filet, jamais par un flou". So the card carries a rule when it needs one, and
// "needs one" is measured rather than assumed.

/**
 * How far a panel has to stand off the ground before it needs no edge, and how
 * visible an edge has to be once it does.
 *
 * 3:1, the same floor the audit applies to anything that is not text and the one
 * `CONTRAST_MIN_LARGE` already carries — a card's boundary is a user interface
 * component under exactly the rule `rules.ts` would use on the screen this film
 * was cut from. Aliased rather than retyped so the two cannot drift.
 */
export const PANEL_SEPARATION = CONTRAST_MIN_LARGE

/**
 * The rule a surface needs to be seen against the ground behind it, or `null`
 * when it is already its own shape.
 *
 * The candidate list is the caller's, in the order it wants them tried, and
 * every entry is a colour `composedPalette` already resolved — this function
 * measures, it never invents, which is the same contract every block in the
 * directory is under. An edge has to clear the floor against BOTH surfaces: one
 * that clears only against the ground is a card with a halo, and one that clears
 * only against the panel is a rule nobody can see the outside of.
 *
 * The two failures either side of it are worth naming. Drawing an edge always
 * would put a hairline around a dark card on a dark ground where the value
 * difference already does the work, which is the "trois niveaux de surface" the
 * design system asks for undone by an ornament. Drawing one never is the export
 * above. And when nothing clears — a mid-tone panel on a mid-tone ground — the
 * most visible candidate is returned rather than none, because a faint edge is a
 * card and no edge is a rectangle of text (Q1).
 */
export function panelEdge(surface, ground, inks) {
  const behind = surfaceRange(ground?.color, ground?.alpha, ground?.tint)
  const own = surfaceRange(surface?.color, surface?.alpha, surface?.tint)
  const apart = worstRatio(surface?.color, behind)
  if (Number.isFinite(apart) && apart >= PANEL_SEPARATION) return null

  let best = null
  for (const ink of Array.isArray(inks) ? inks : []) {
    if (typeof ink !== 'string') continue
    const inside = worstRatio(ink, own)
    const outside = worstRatio(ink, behind)
    if (!Number.isFinite(inside) || !Number.isFinite(outside)) continue
    const ratio = Math.min(inside, outside)
    if (ratio >= PANEL_SEPARATION) return { color: ink, ratio }
    if (!best || ratio > best.ratio) best = { color: ink, ratio }
  }
  return best
}

/**
 * The three inks a panel may draw its own edge with, most wanted first.
 *
 * The accent first because a card outlined in the project's own colour is the
 * house's own device and the direction is why the film looks like the product it
 * was cut from; the two text inks after it, because by the time the accent has
 * failed to be visible against the ground, contrast is scarce and a rule that
 * can be seen beats a rule in the right colour. Same ordering argument as
 * `inkCandidates`, one surface in.
 */
export function panelInks(palette) {
  return [palette?.panelAccent?.color, palette?.panelBody?.color, palette?.panelDisplay?.color].filter(Boolean)
}

/**
 * The clock an interface gesture runs on: the scene's own, gated by the block's
 * own arrival.
 *
 * A block is handed two numbers and remembers nothing between frames — Remotion
 * re-renders the tree for each of the 3600 frames a film can hold — so "the frame
 * my entrance finished on" is not a quantity that exists in here. `life` alone
 * would therefore have started every gesture before its block was on screen: a
 * form ranked last appears with a third of its fields already typed, which is a
 * form nothing happened in.
 *
 * The lesser of the two is the honest answer available, and it has the three
 * properties the beats below need: it is 0 while the block is still off screen,
 * it tracks `life` once the arrival is complete, and it reaches exactly 1 on the
 * scene's last frame however late the block was ranked — which is what keeps an
 * exit inside its own scene instead of past the cut.
 *
 * **It is `revealRamp`'s gate, at `share: 1`.** The animated-text family reached
 * the same `min(progress, life)` from the other end — a typewriter needs a clock
 * longer than an arrival, an interface gesture needs one that outlives it — and
 * two families arriving independently at one expression is the argument for it
 * moving into `composition.js` the day a third one wants it. It is written twice
 * today rather than imported across a family boundary, which is the cheaper of
 * the two mistakes while both are being built.
 *
 * What it costs is a late block's gestures being COMPRESSED into its entrance:
 * on the shortest legal scene carrying eight blocks, `cueFrames` puts the last
 * cue at frame 30 of 45, and this clock then runs 0 → 0.89 over the nine frames
 * of that arrival. That is the same trade `cueFrames` itself makes one line
 * earlier — a cascade too long for its scene is compressed rather than losing its
 * last element — and it is the right way round: a form that types quickly is a
 * form that typed, while a form keyed on `life` alone would have been filled in
 * before it existed.
 */
export function controlClock(progress, life) {
  return Math.min(clamp01(progress), clamp01(life))
}

/**
 * How far an interface element still is from its mark, as a fraction — the
 * family's one answer to "nothing holds still".
 *
 * A control that reaches its position and freezes is a screenshot with a fade in
 * front of it, and for the fourteen seconds a scene may still have to run it is
 * exactly that. So an interface element keeps closing the last half-percent of
 * its arrival for the whole scene and lands on its mark at the cut, and every one
 * of the four spends it on its own axis: a scale for the things that grow, a
 * horizontal offset for the band that wipes.
 *
 * **It only ever approaches**, and that is the part that is not a taste. The
 * value is positive, decreasing and zero at the end, so a block starts INSIDE
 * where `composedLayout` put it and settles onto it. A residual that overshot
 * would put a band a few pixels past the safe margin `composedSafeArea`
 * measured — the `overlay` lesson about amplitude, arriving through an ornament.
 *
 * A third of the drift the whole stack already rides, and DERIVED from it rather
 * than chosen beside it: this is a second motion on top of that one, so a change
 * to the house drift has to take it along instead of leaving two numbers that
 * used to agree.
 */
export const REST_CREEP = COMPOSED_BLOCK_DRIFT / 3

export function restOffset(clock) {
  return REST_CREEP * (1 - clamp01(clock))
}

// ── button ──────────────────────────────────────────────────────────────────

/**
 * Where the control comes from, as a scale.
 *
 * It GROWS where its neighbours rise, and that is the whole of what this block
 * can do about being a conclusion rather than a fifth line. The product card
 * makes the same argument with three devices — a beat of silence, a rule that
 * closes the list, and an entrance of its own — and only the third is available
 * here: `layerCues` calls `cueFrames` without a `tailGap`, because a composed
 * scene's last block is whatever the document listed last and not necessarily an
 * ending. What the cascade does hand over for free is `EMPHASIS_ENTER_FRAMES`,
 * which `composedMotion` gives to the block that arrives last alone — so a button
 * written last already enters more slowly than everything above it.
 */
export const BUTTON_ENTER_SCALE = 0.94

/**
 * When the control is pressed, on its own clock, and how deep.
 *
 * Late rather than central: a press at the halfway mark is a control
 * demonstrating itself, and a press once the frame has been read is the scene
 * concluding. The dip is 5% because it has to survive being 4.5% of a pill that
 * is a twentieth of the frame — smaller reads as a rendering error, larger reads
 * as a bounce, which is the overshoot `easeOutCubic` was chosen over a spring to
 * avoid.
 */
export const BUTTON_PRESS_AT = 0.58
export const BUTTON_PRESS_SPAN = 0.12
export const BUTTON_PRESS_DEPTH = 0.05

/**
 * How deep in the press, 0 to 1 and back.
 *
 * A bump and not a ramp: zero at both ends of its window, deepest in the middle,
 * so the control leaves the press exactly where it entered it. Half a sine is the
 * cheapest shape with that property, and it is a cycle rather than an easing —
 * nothing here is an entrance, and the one curve this directory has is applied
 * before a block is handed anything.
 */
export function buttonPress(clock) {
  const at = (clamp01(clock) - BUTTON_PRESS_AT) / BUTTON_PRESS_SPAN
  if (at <= 0 || at >= 1) return 0
  return Math.sin(Math.PI * at)
}

/**
 * The control's whole scale: where it came from, the press, and the settle.
 *
 * Never above 1, on any frame, for any argument — the assertion `interface.test.js`
 * makes and the reason the press is a subtraction and the settle an approach. A
 * pill that grew past its mark would be a pill whose ink was measured on a box it
 * is not the size of, and on a `bottom-right` anchor it would be a pill past the
 * margin.
 */
export function buttonScale(progress, clock, pressed) {
  const arrived = BUTTON_ENTER_SCALE + (1 - BUTTON_ENTER_SCALE) * clamp01(progress)
  const dip = pressed ? BUTTON_PRESS_DEPTH * buttonPress(clock) : 0
  return arrived * (1 - restOffset(clock)) * (1 - dip)
}

/**
 * The air either side of the label, in ems of the label's own size.
 *
 * In ems and not in units, because a pill's padding is a property of the type
 * inside it — the one place in this family where the neighbouring block's scale
 * is the wrong denominator. A control whose side padding came off the stack's
 * unit would be a two-word button with the padding of the four-line quote above
 * it. 0.62 em is what the old `base * 0.034` beside `base * 0.03` of type came
 * to, recovered rather than re-chosen, so a pill that fitted its label before
 * fits it now.
 */
export const PILL_PAD_EM = 0.62

/**
 * A control's tracking, as a number, because the size below has to MEASURE it.
 *
 * Same shape as `KICKER_TRACKING` and the same reason: a hundredth of an em on
 * every glyph is a hundredth of the line's width, and a width the estimate does
 * not know about is a label through the side of its own pill. The string is
 * derived from the number so the two cannot drift.
 */
export const PILL_TRACKING_EM = 0.01
export const PILL_TRACKING = `${PILL_TRACKING_EM}em`

/**
 * What a button draws in the box it was given: a pill as tall as the box, as
 * wide as its label needs, and never wider than the box.
 *
 * The height is the box's, whole. `BLOCK_APPETITE` sizes a button at 1.3 units
 * of furniture around one line of body type, so a box handed to a button IS a
 * pill of that shape — the padding is what is left over above and below the
 * line, and centring the label spends it. That is the sentence "a block inhabits
 * its box" in the simplest case there is, and it is also why the old
 * `base * 0.018` had to go: it drew the same 19 px pill in a 100 px zone and in
 * a 550 px one.
 *
 * The width is where a control differs from a card. `fills: 'either'` is its own
 * row in the weight table, and the honest reading of it is that a two-word
 * button cannot fill a landscape measure without being taller than the box: what
 * a pill owes its box is the height, and its width is what its label takes. So
 * the label is measured, the padding is added, and the whole is capped by the
 * box — a cap that binds only on a label that already ran the measure, which is
 * why the size below is solved against the room the padding leaves rather than
 * against the box. Solved the other way round, a 30-character label at its
 * ceiling came back one padding wider than the zone it was allotted.
 */
export function buttonGeometry(block, box, base, unit) {
  const { width, height } = safeBox(box)
  const at = stackUnit(unit, block, { width, height })
  const label = String(block?.label ?? '')
  const step = typeSize('body', at)
  // The label's own advance at one pixel of type, plus the two paddings, which
  // are a share of that same size: the whole thing is linear in the size, so the
  // largest one that fits the measure is a division rather than a search.
  const per = textWidth(label, 1, PILL_TRACKING_EM) + 2 * PILL_PAD_EM
  // Floored and not rounded, and it is the difference between a pill that fits
  // and a pill clamped to its box: a size rounded UP puts the label's estimate a
  // few pixels past the measure, and the only thing left to give at that point
  // is the padding the label sits in.
  const size = Math.max(1, per > 0 ? Math.min(step, Math.floor(width / per)) : step)
  const padX = Math.round(size * PILL_PAD_EM)
  return {
    size,
    padX,
    width: Math.min(width, Math.round(textWidth(label, size, PILL_TRACKING_EM)) + 2 * padX),
    height,
    // The outline's weight is a constant metric, like every other rule in this
    // directory: a border that grew with its button would be two design systems
    // in one film, and the filled variant carries the same one in its own fill
    // colour so that switching variant moves nothing below it in the zone.
    border: hairline(base, { width, height }),
  }
}

// ── form ────────────────────────────────────────────────────────────────────

/**
 * When the last field is full, on the block's own clock — and therefore when the
 * submit is allowed to light up.
 *
 * The two numbers are one decision: a submit that activates while a field is
 * still filling is a form whose button does not mean anything, and that is the
 * one assertion in this file that is about SEQUENCE rather than amplitude.
 * `interface.test.js` sweeps the clock and holds the submit at exactly zero until
 * every field has reached one.
 */
export const FORM_FILLED_BY = 0.72

/** How much of a field's own share is typing, the rest being the pause before the next one. */
export const FIELD_TYPE_SHARE = 0.72

/** How long the submit takes to fill, from its leading edge. */
export const FORM_SUBMIT_SPAN = 0.2

/**
 * The state of every row and of the submit at one frame.
 *
 * `caret` is an INDEX and not a boolean per row: a caret in two places is two
 * people typing, and the index is also what says where focus sits during the
 * pause between two fields — the first row that is not full, which is the row
 * about to receive text. It is `-1` once the form is filled, because the caret
 * leaving is how a form says it is done; the sweep across the submit is the rest
 * of that sentence.
 */
export function formCadence(count, clock) {
  const total = Math.max(0, Math.floor(Number(count) || 0))
  const at = clamp01(clock)
  if (total === 0) return { fields: [], caret: -1, submit: 0 }
  const share = FORM_FILLED_BY / total
  const fields = Array.from({ length: total }, (_, i) => clamp01((at - i * share) / (share * FIELD_TYPE_SHARE)))
  const caret = fields.findIndex((typed) => typed < 1)
  return { fields, caret, submit: clamp01((at - FORM_FILLED_BY) / FORM_SUBMIT_SPAN) }
}

/**
 * The card's own padding, a field's, and the submit's — in units of the body
 * type size, which is the currency `BLOCK_APPETITE` counts furniture in.
 *
 * They are that table's 2.2 spent: half a unit of card padding a side, a sixth
 * inside each field, a fifth around the submit. A form with four fields spends a
 * little more than the table budgeted and pays for it in type size rather than
 * in overflow — `fitUnit` is where that trade is made, and it is the right way
 * round, since a form is the one block whose rows are the point.
 */
export const FORM_PAD = 0.5
export const ROW_PAD_Y = 0.16
export const ROW_PAD_X = 0.4
export const SUBMIT_PAD_Y = 0.22
export const SUBMIT_PAD_X = 0.5

/**
 * How far the card rises onto its mark, as a share of its own box.
 *
 * Half a notice's travel, because a form does not arrive from off screen — it is
 * already where it belongs and it settles. It was `base * 0.02`, which is the
 * same defect as any other frame fraction: 21 px of rise is a settle in a zone
 * of 950 px and a card jumping a fifth of its own height in one of 120.
 */
export const FORM_RISE = 0.025

/**
 * What a form draws in its box: a card the size of the box, with fields that run
 * its whole measure.
 *
 * `fills: 'both'` in the weight table, and it is the only honest reading of a
 * form: a card with a quarter of its box empty has nothing else in that box, and
 * a field narrower than the card it sits in is the "small element in a large
 * void" this whole pass is about, one level down. So the card takes the box —
 * both axes — and every row takes the card's measure. The old
 * `min(base * 0.42, 100%)` drew the same 454 px card in a zone of 1688 px and in
 * one of 530.
 *
 * The type is then solved against the room the furniture leaves rather than
 * against the box, for `fitUnit`'s reason: the weight table wrapped every field
 * against the whole measure, and a card that spends 130 px of it on padding
 * makes a line the box was never sized for.
 */
export function formGeometry(block, box, base, unit) {
  const { width, height } = safeBox(box)
  const at = stackUnit(unit, block, { width, height })
  const fields = Array.isArray(block?.fields) ? block.fields : []

  const pad = Math.round(at * FORM_PAD)
  const rowPadY = Math.round(at * ROW_PAD_Y)
  const rowPadX = Math.round(at * ROW_PAD_X)
  const submitPadY = Math.round(at * SUBMIT_PAD_Y)
  const submitPadX = Math.round(at * SUBMIT_PAD_X)

  const inner = { width: Math.max(1, width - 2 * pad), height: Math.max(1, height - 2 * pad) }
  // Every one of those paddings is height the runs do not get, and the rows'
  // measure is narrower again — the same subtraction on both axes, done before
  // the type is solved rather than discovered after it.
  const furniture = fields.length * 2 * rowPadY + (block?.submit ? 2 * submitPadY : 0)
  const room = {
    width: Math.max(1, inner.width - 2 * rowPadX),
    height: Math.max(1, inner.height - furniture),
  }
  const own = fitUnit(block, room, at)

  const row = typeSize('body', own)
  return {
    unit: own,
    pad,
    rowPadY,
    rowPadX,
    submitPadY,
    submitPadX,
    width,
    height,
    measure: inner.width,
    title: typeSize('title', own),
    row,
    gap: Math.round(own * RUN_GAP),
    // A caret is a rule in a field, so it is the field's own rule: constant
    // across scenes, bounded inside the row it blinks in — and never blinking,
    // for the reason `caretOn` gives the whole directory.
    caret: hairline(base, { width: inner.width, height: row }),
    border: hairline(base, { width: inner.width, height: row + 2 * rowPadY }),
    travel: travelIn({ width, height }, FORM_RISE),
    // What the card actually needs to be, so a test can hold it against the box
    // it was given rather than against a picture somebody looked at.
    content: Math.round(runsHeight(block, room.width, own) + furniture + 2 * pad),
  }
}

/*
 * There is no blink here, and that is a decision rather than an omission.
 *
 * `caretOn` in `animatedText.js` states the rule for the whole directory: a caret
 * is SOLID while the line is being typed, because a blink competing with
 * characters arriving reads as a stutter. A form's caret is never in the other
 * case — `formCadence` takes it away the frame the last field fills, so the only
 * state it is ever drawn in is the one that rule already makes solid. A blink
 * written here would be a second cadence for the same object, on the same frame
 * as a typewriter's, at whichever rate the second author picked.
 */

// ── notification ────────────────────────────────────────────────────────────

/**
 * The three beats: it enters, it holds, it leaves.
 *
 * The entrance is not here, and that is the point — it is `progress`, the house
 * arrival every block in the catalogue shares. What a notice needs on top of it
 * is an END, because a system notice that stays for fifteen seconds is a panel.
 * So only the departure is written down, as a window on the block's own clock,
 * and it closes before the cut rather than on it: a notice that leaves on the
 * last frame has not left, it has been cut away from.
 */
export const NOTICE_LEAVES_AT = 0.82
export const NOTICE_GONE_BY = 0.96

/**
 * How far it travels in and back out, as a fraction of its OWN box.
 *
 * It was a fraction of the short edge, which is the same defect as a size read
 * off the frame wearing the other hat: 54 px of travel is a card arriving from
 * just outside itself when the box is the safe area, and a card flying in from
 * half a frame away when the box is a third of a portrait column. An amplitude
 * belongs to the thing that moves. The number is unchanged — a twentieth — so a
 * notice that occupied its zone travels exactly what it did before.
 */
export const NOTICE_TRAVEL = 0.05

/**
 * A distance an element travels on its way in, as a share of its own box.
 *
 * The minor side, for `frameBase`'s reason one level down: a card in a wide flat
 * box and the same card in a tall narrow one should arrive from the same
 * distance, and the shorter side is the one that reads as "just outside itself"
 * in both.
 */
function travelIn(box, share) {
  const { width, height } = safeBox(box)
  return share * Math.min(width, height)
}

export function noticeTravel(box) {
  return travelIn(box, NOTICE_TRAVEL)
}

export function noticeExit(clock) {
  return clamp01((clamp01(clock) - NOTICE_LEAVES_AT) / (NOTICE_GONE_BY - NOTICE_LEAVES_AT))
}

/**
 * Which edge a notice comes from and returns to, as a unit direction.
 *
 * Read off `anchorCell`, so the zone the document named and the direction the
 * card travels are ONE table: a second one would be a notice sliding out of the
 * frame's left edge while sitting against its right, and it would only show up on
 * the anchors nobody wrote a fixture for.
 *
 * Horizontal wins when there is a horizontal edge to win — a `top-left` notice
 * comes from the left rather than from the top, because the side is the nearer
 * edge and a card entering across the frame's top passes over whatever is up
 * there. A card in a centred column has no edge of its own and comes from ABOVE,
 * which is where a system notice has always come from.
 */
export function noticeSlide(anchor) {
  const cell = anchorCell(anchor)
  if (cell.column === 'flex-start') return { x: -1, y: 0 }
  if (cell.column === 'flex-end') return { x: 1, y: 0 }
  if (cell.row === 'flex-end') return { x: 0, y: 1 }
  return { x: 0, y: -1 }
}

/**
 * The mark's own pulse: signed, so a dot can breathe and a bell can swing both
 * ways from one number.
 *
 * This is what makes the HOLD a beat rather than a pause. Three cycles a scene,
 * against the caret's five, because a mark is beside a sentence somebody is
 * reading and the caret is the sentence being written.
 */
export const MARK_CYCLES = 3

export function markSwing(life) {
  return Math.sin(clamp01(life) * MARK_CYCLES * 2 * Math.PI)
}

/**
 * The card's padding, in units — the whole of the 1.6 `BLOCK_APPETITE` budgets
 * for a notification's furniture, split between the two edges.
 *
 * The same number horizontally, because a card with more air above its title
 * than beside it is a card that was measured on one axis. What that costs is
 * measure, and the measure is paid for in `fitUnit` rather than in a clipped
 * line.
 */
export const CARD_PAD = 0.8

/**
 * What a notification draws in its box: a card the size of the box.
 *
 * `fills: 'both'`, like the form, and for the reason the weight table gives —
 * this is a panel, and a panel that leaves a quarter of its box empty has
 * nothing else in the box. The old `maxWidth: min(base * 0.56, 100%)` is exactly
 * the defect the pass is about: 605 px of card whether the zone was 1688 px wide
 * or 530, so a notice alone on a scene was an eighth of the picture.
 *
 * The mark's column is reserved at the STACK's unit and drawn at the card's own,
 * which are the same number on every card whose text did not have to shrink. The
 * asymmetry is deliberate and it is the safe direction: a mark drawn smaller
 * than its reservation leaves a little air beside it, while a reservation
 * smaller than the mark takes a line off the measure the type was solved for.
 */
export function noticeGeometry(block, box, base, unit) {
  const { width, height } = safeBox(box)
  const at = stackUnit(unit, block, { width, height })
  const pad = Math.round(at * CARD_PAD)
  const marked = block?.mark !== 'none'
  const reserve = marked ? typeSize('body', at) + Math.round(at * RUN_GAP) : 0

  const room = {
    width: Math.max(1, width - 2 * pad - reserve),
    height: Math.max(1, height - 2 * pad),
  }
  const own = fitUnit(block, room, at)
  const title = typeSize('body', own)

  return {
    unit: own,
    pad,
    width,
    height,
    measure: room.width,
    title,
    body: typeSize('caption', own),
    gap: Math.round(own * RUN_GAP),
    // The mark is furniture and it scales with the card: a dot the size of the
    // title's own body step is what reads as a status beside a line, at every
    // size the box can turn out to be.
    mark: marked ? title : 0,
    markGap: marked ? Math.round(own * RUN_GAP) : 0,
    travel: noticeTravel({ width, height }),
    border: hairline(base, { width, height }),
    content: Math.round(runsHeight(block, room.width, own) + 2 * pad),
  }
}

// ── lowerThird ──────────────────────────────────────────────────────────────

/**
 * Where inside its own arrival the type starts to rise from behind the block.
 *
 * A sub-beat of ONE arrival and not a second cue: the band has to exist before
 * anything can be revealed from behind it, so a title that rose with the wipe
 * would be a title travelling across the frame in the open. `OverlayBandVideo`
 * settled the same question the same way, and this is that treatment inside a
 * block.
 */
export const BAND_TEXT_FROM = 0.3
export const BAND_SUBTITLE_FROM = 0.45

/**
 * When the band rolls back out, on the block's own clock.
 *
 * Later than the notice's, because this is the device a report uses to name
 * somebody and the name has to be readable for most of the shot, and it is the
 * `intro/outro` case as well — an outro that has left with a third of its scene
 * to run is a scene ending on nothing.
 */
export const BAND_LEAVES_AT = 0.88
export const BAND_GONE_BY = 0.99

export function bandExit(clock) {
  return clamp01((clamp01(clock) - BAND_LEAVES_AT) / (BAND_GONE_BY - BAND_LEAVES_AT))
}

/**
 * How much of the band is drawn, from its leading edge: the wipe in and the wipe
 * back out, as one number.
 *
 * One quantity rather than two states, because the two really are the same
 * gesture run in both directions — and a composition reading one number cannot
 * hold a band open while its exit is running, which two booleans absolutely can.
 */
export function bandWidth(progress, clock) {
  return clamp01(progress) * (1 - bandExit(clock))
}

/** How far a run of type has risen from behind the band, over a window of the arrival. */
export function bandReveal(progress, from = BAND_TEXT_FROM) {
  const at = clamp01(from)
  if (at >= 1) return clamp01(progress)
  return clamp01((clamp01(progress) - at) / (1 - at))
}

/**
 * The band's own air, and the weight of the rule at its leading edge, in units.
 *
 * 1.1 vertically is `BLOCK_APPETITE`'s whole budget for this kind, split between
 * the two edges; the horizontal padding is wider because a band is a horizontal
 * device and it is unbudgeted for the reason the button's is — `fills: 'either'`
 * means the width belongs to the content.
 *
 * The rule is the one piece of furniture in this family that is NOT a constant
 * metric, and the distinction is worth stating because it looks like a hairline.
 * A hairline is constant because a viewer reads it as the same object from scene
 * to scene — the rule under a heading, the border of a field. This one is the
 * band's leading EDGE: it is what the block unrolls from and it belongs to the
 * band's own proportions, so 3 px of it against a name set at 300 px would not
 * be a delicate stripe, it would be a missing one.
 */
export const BAND_PAD_Y = 0.55
export const BAND_PAD_X = 0.9
export const BAND_RULE = 0.14

/**
 * What a lower third draws in its box: a band as tall as the box, running the
 * measure its type runs.
 *
 * The height is the box's, whole — the same sentence as the button's, and what
 * turns a stripe of 45 px into the band a low zone was actually given. The width
 * is the type's, and that is `bandInset`'s lesson rather than an omission: a
 * band that runs the full width and touches three sides is a lower third from a
 * news bulletin, with two thirds of it empty behind a four-word title. In a box
 * solved against a stack the two usually coincide — the unit grows until the
 * title wraps, and a wrapped title has used the whole measure by definition — so
 * the band that reaches its box's edge does it because its name is long, not
 * because somebody wrote a fraction.
 */
export function bandGeometry(block, box, base, unit) {
  const { width, height } = safeBox(box)
  const at = stackUnit(unit, block, { width, height })
  const padY = Math.round(at * BAND_PAD_Y)
  const padX = Math.round(at * BAND_PAD_X)
  const rule = Math.max(1, Math.round(at * BAND_RULE))

  const room = {
    width: Math.max(1, width - rule - 2 * padX),
    height: Math.max(1, height - 2 * padY),
  }
  const own = fitUnit(block, room, at)
  const title = typeSize('title', own)
  const subtitle = block?.subtitle ? typeSize('caption', own) : 0
  const measure = Math.min(
    room.width,
    Math.max(textWidth(block?.title, title), subtitle ? textWidth(block.subtitle, subtitle) : 0),
  )

  return {
    unit: own,
    padX,
    padY,
    rule,
    title,
    subtitle,
    gap: Math.round(own * RUN_GAP),
    width: Math.min(width, Math.round(measure) + rule + 2 * padX),
    height,
    measure: room.width,
    border: hairline(base, { width, height }),
    content: Math.round(runsHeight(block, room.width, own) + 2 * padY),
  }
}
