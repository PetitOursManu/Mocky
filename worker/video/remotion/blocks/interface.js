/**
 * The four interface blocks' own beats — `button`, `form`, `notification` and
 * `lowerThird`.
 *
 * ── Why this is a file and not four components ──────────────────────────────
 *
 * For the reason `sceneMotion` is in `composition.js`: **a `.jsx` cannot be
 * tested**. Remotion is not installed in Mocky's suite and never will be — its
 * licence is why the worker is a separate image at all — so a quantity a
 * component computes for itself is a quantity nobody can ask a question about,
 * and "does this block still move at the end of its scene" is exactly the
 * question a frozen control answers wrong while rendering perfectly. Everything
 * below is a pure function of the two numbers a block is handed, and
 * `interface.test.js` is where these beats stop being prose.
 *
 * It sits beside the blocks rather than in `composition.js` because nothing
 * outside this family reads it: `composition.js` holds what several TEMPLATES
 * share, and a press gesture is not that. Moving it there is one import line if
 * a second family ever wants the same beat — which is the moment it would stop
 * being this family's arithmetic and start being the house's.
 *
 * ── What it is not ─────────────────────────────────────────────────────────
 *
 * It is not a second notion of how things move. There is no curve here: an
 * arrival is `cueProgress`, already eased by the house `easeOutCubic` before a
 * block ever sees it, and every function below is a window, a ratio or a cycle
 * over a clock somebody else computed. A block that eased its own entrance would
 * be the twenty-fifth notion `blocks.test.js` refuses, and this file is where the
 * temptation would have been indulged.
 */

import { anchorCell, COMPOSED_BLOCK_DRIFT } from '../composition.js'

/** Read as hostile, like everything else that came off a document. */
function clamp01(value) {
  const at = Number(value)
  if (!Number.isFinite(at)) return 0
  return Math.min(1, Math.max(0, at))
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

/** How far it travels in and back out, as a fraction of the short edge. */
export const NOTICE_TRAVEL = 0.05

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
