/**
 * The arithmetic of the `misc` family — `separator` and `progressBar`.
 *
 * ── Why this file exists, and why it is not `composition.js` ────────────────
 *
 * The rule the whole directory is written under is that a `.jsx` cannot be
 * tested: Remotion is not installed in Mocky's suite and never will be, because
 * its licence is the reason the worker is a separate image at all. So anything a
 * test has to reach lives in plain JavaScript, and `composition.js` is where that
 * goes when it is SHARED — one easing, one cue rhythm, one texture, because five
 * notions of "an element arrives" is four of them drifting.
 *
 * A dot pitch and a tick offset are shared by nothing. They belong to two
 * components that are one family in the schema (`BLOCK_FAMILIES.misc`), and the
 * argument `blocks/index.js` makes about itself applies one directory up: a file
 * every block author edits is a file six authors conflict in. Family-scoped,
 * owned by the two `.jsx` files that import it, and reachable by a test — which
 * was the only thing `composition.js` was needed for here.
 *
 * ── What it takes FROM `composition.js`, and why it must ────────────────────
 *
 * The box, the type unit, the hairline and the two share tables. This file used
 * to compute every size as a fraction of `base`, the frame's short edge — a
 * 13 px track and a 24 px label whether the block had been given a third of a
 * column or the whole safe area — which is the defect the rule at the top of
 * `composition.js` is written about: a block that ignores its box is a small
 * element floating in a large void, on every scene, in six real exports.
 *
 * So: `unit` (the stack's type unit, solved against the zone) decides the type
 * and the bar's thickness, the BOX decides the measure, and `base` is left with
 * the one thing it is still entitled to — a constant metric, which for these two
 * blocks is the hairline and nothing else.
 *
 * ── What may not be in it ───────────────────────────────────────────────────
 *
 * The same two rules the blocks are written under, for the same reasons: no
 * colour and no easing curve. `progress` arrives already eased by `cueProgress`,
 * and every continuous term below is read straight off `life`, exactly as
 * `groundDensity` reads it. Nothing here paints; it answers with numbers and the
 * components turn them into styles.
 */
import { DECLARED_SHARE, RUN_GAP, blockAppetite, hairline, typeRole, typeSize } from '../composition.js'

/** 0 to 1, whatever arrives. A block is validated three times over; this file still must not trust a caller. */
const unit = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
}

/** A positive length in pixels, or 0. `composedLayout` guarantees it; a hand-built test does not. */
const px = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** The box a block was given, with every field readable. Never the frame. */
const boxOf = (box) => ({ width: px(box?.width), height: px(box?.height) })

// ── separator ────────────────────────────────────────────────────────────────

/**
 * How far a rule runs across the box its zone handed it, as a share of the box.
 *
 * Read from `DECLARED_SHARE` rather than written a second time. It was a copy
 * here for one release — `composition.js` needed the three numbers to answer for
 * a block without importing one, and said in its own comment that the copies
 * collapse "the day the blocks are rewritten against this contract". This is that
 * day: a rule that ran to 62% of its box in one file and 18% in the other is a
 * block drawing something a test measured differently, and one table cannot
 * disagree with itself.
 */
export const RULE_EXTENTS = DECLARED_SHARE.separator

/** The schema's three treatments, in its own order. Anything else is a rule. */
export const RULE_TREATMENTS = ['rule', 'double', 'dots']

/**
 * How much of its extent a rule has drawn by the time it has ARRIVED — the rest
 * of it keeps drawing for the whole scene.
 *
 * A separator whose only motion is its entrance is drawn in nine frames and then
 * frozen for the remaining four hundred, which is the defect `DEFAULT_KEN_BURNS`
 * is a long comment about, one element down: a film in which nothing moves must
 * not be producible by accident, and "it moved once" is the same still frame with
 * a better first second. So the last 4% of the measure is spent across `life`.
 *
 * 4% of the measure is 27 px of a 1080-tall frame over a scene — the amplitude
 * class `TITLE_BLOCK_DRIFT` (1.6% of the short edge) already occupies, and for
 * the same reason: a rule that visibly grew would be a rule the eye follows
 * instead of the words it separates.
 */
export const RULE_DRAWN_AT_ARRIVAL = 0.96

/**
 * A separator at one frame: how thick, how long, and how much of it is drawn.
 *
 * ── Two dimensions, two sources, and that is the whole of this block ────────
 *
 * The LENGTH is the box's: a share of the measure the zone gave it, so a rule in
 * a third of a column is a third as long as the same rule across a whole frame,
 * and `blockExtent` answers the same number for it. The THICKNESS is the frame's,
 * through `hairline` — it is a constant metric, one of exactly three, because a
 * rule 3 px thick under a headline and 9 px thick under a smaller one in the next
 * scene is not a hairline, it is two design systems in one film. `hairline`
 * bounds it at a quarter of the box, so a rule inside a tiny zone thins to fit
 * rather than becoming the block.
 *
 * Everything else here is derived from that thickness rather than from `base` a
 * second time: a dotted band whose pitch came off the frame while its dots came
 * off a clamped thickness is a band whose dots stop being round in a small box.
 *
 * The reveal comes back as a FRACTION rather than as a transform, and the
 * component clips with it instead of scaling. `scaleX` was what the first version
 * did — cheaper, composited, and it squashes what it scales: the dotted treatment
 * is a radial-gradient inside the box, so at half progress every dot was a
 * half-width ellipse that grew round as the rule finished. A clip reveals a
 * pattern; a scale redraws it at the wrong aspect on every frame but the last.
 *
 * Both lookups are `Object.hasOwn` / `includes` for the reason `anchorCell` and
 * `blockComponent` both spell out: a plain lookup answers for the prototype
 * chain, and `extent: "constructor"` would hand a component a FUNCTION where a
 * width was expected. `validate.js` refused that value long before a frame, so
 * reaching the fallback means two lists disagree — and a rule at the default
 * measure beats a render that dies half a minute in (Q1).
 *
 * @param {{treatment?: string, extent?: string}} block
 * @param {{width: number, height: number}} box  this block's own box, in pixels
 * @param {number} base  the frame's short edge, for the one constant metric
 * @param {number} progress  this block's own arrival, already eased
 * @param {number} life  0 to 1 across the whole scene
 */
export function separatorGeometry(block, box, base, progress, life) {
  const room = boxOf(box)
  const treatment = RULE_TREATMENTS.includes(block?.treatment) ? block.treatment : RULE_TREATMENTS[0]
  const named = String(block?.extent)
  const share = Object.hasOwn(RULE_EXTENTS, named) ? RULE_EXTENTS[named] : RULE_EXTENTS.measure

  const thickness = hairline(base, room)
  const drawn = RULE_DRAWN_AT_ARRIVAL + (1 - RULE_DRAWN_AT_ARRIVAL) * unit(life)

  return {
    treatment,
    /** The share of the box, kept as a fraction so the component and `blockExtent` agree by construction. */
    width: share,
    /** And the same length in pixels, which is what the box makes it. */
    length: Math.round(room.width * share),
    thickness,
    /** The space between the two strokes of a `double`, and above a dotted band. */
    gap: thickness * 2,
    /** A dotted band is drawn as a repeated radial gradient: its cell is this wide and this tall. */
    dotPitch: thickness * 6,
    dotHeight: thickness * 2,
    // Clamped rather than trusted to land on 1, because what it means to exceed
    // it is not "a rounding error": the width above is the box `composedLayout`
    // measured, and the safe area that box sits in is a promise about a feed
    // application's own interface rather than a taste in margins.
    reveal: Math.min(1, unit(progress) * drawn),
  }
}

// ── progressBar ──────────────────────────────────────────────────────────────

/**
 * How much of the block's furniture is the bar itself, the rest being the air
 * between the label and it.
 *
 * `BLOCK_APPETITE.progressBar.fixed` is the height this block promises to draw
 * that is not type — 1.2 body sizes — and the promise is what `blockExtent`
 * hands back and what `stackIn` divided the zone by. So the two pieces are a
 * SPLIT of that number rather than two numbers of their own: whatever the bar
 * does not take, the air takes, and the block draws exactly the height the layout
 * gave it. A track and a gap chosen independently would add up to something else
 * on every box, which is the same "small element in a large void" the rule at the
 * top of `composition.js` is about, arriving through a sum instead of a fraction.
 */
export const TRACK_SHARE_OF_FIXED = 0.55

/**
 * The flattest a bar is allowed to get — the thickness may not exceed a twelfth
 * of the length.
 *
 * A progress bar is a LINEAR object: it says "this far along", and a slab that is
 * a third as thick as it is long says nothing of the sort. A lone bar in a whole
 * safe area solves a type unit of about 450 px, and 0.55 × 1.2 of that is a
 * 300 px slab across a 1690 px box — the poster the box asked for, drawn as a
 * brick. The cap is also what makes the ruler's own guarantee provable: see
 * `HATCH_MIN_TICKS`.
 */
export const TRACK_ASPECT = 12

/**
 * The pitch of the ruler, in TRACK THICKNESSES — and this is the defect it was
 * written for.
 *
 * The pitch used to be 1.4% of the short edge and the track 1.2% of it, which is
 * a ruler whose step is 1.15 times its own thickness: at 1080p that is a 15 px
 * pitch on a 13 px bar, and the result reads as a hatched band rather than as a
 * progression. The ticks ate the fill — the eye counts stripes instead of
 * measuring a length, which is the one thing this block exists to show.
 *
 * A pitch relative to the THICKNESS cannot do that, whatever the frame: at 2.6
 * thicknesses the marks are unmistakably marks on a bar. And the thickness is the
 * box's, through the type unit, so the ruler scales with the block instead of
 * with the export's resolution.
 */
export const HATCH_PITCH_TRACKS = 2.6

/**
 * And the other end: a bar always carries at least six marks.
 *
 * A pitch of 2.6 thicknesses on a bar capped at a twelfth of its length is at
 * most one 4.6th of the measure, so a thick bar would show two marks and a
 * marching pair of blocks is not a ruler. Six is the count below which the
 * pattern stops reading as a scale.
 *
 * The two constants are chosen so the guarantee survives the clamp: with the
 * track bounded by `TRACK_ASPECT`, the clamped pitch is at least the measure over
 * six, which is at least twice the thickness. `misc.test.js` asserts that
 * inequality rather than trusting this paragraph — it is the whole of the fix.
 */
export const HATCH_MIN_TICKS = 6

/** A tick is this share of its own cell. Never the whole of it: see the note on `tick` below. */
export const HATCH_TICK_SHARE = 0.14

/**
 * How many pitches the ruler travels across one scene.
 *
 * Per SCENE and not per second, exactly like `PULSE_CYCLES`: a rhythm in
 * milliseconds is a period the model would have had to describe, and this
 * catalogue does not let a document name one. Eight pitches is a march you notice
 * when you look at the bar and not when you are reading the label above it.
 */
export const HATCH_MARCH = 8

/**
 * The three densities the bar is painted at, and every one of them is BELOW 1.
 *
 * The palette measured `palette.accent` and `palette.onFill` at full strength,
 * with the veil locked for the accent because it is decoration. Every layer here
 * is that same colour, quieter — the asymmetry `groundDensity` states in one
 * sentence: a layer that can only ever get fainter cannot spend contrast the
 * measurement promised. Nothing painted here is text, and it still holds to the
 * rule, because the bar sits on the ground every other run was measured against.
 */
export const TRACK_QUIET = 0.25
export const TICK_QUIET = 0.5
export const FILL_TICK_QUIET = 0.22

/**
 * A bar at one frame: its geometry, its value, and where the ruler has marched to.
 *
 * ── Everything below is the box, through the unit ───────────────────────────
 *
 * `unit` is the type unit its whole stack agreed on, solved by `stackIn` against
 * the zone, so the label is a step on the one scale (`typeSize('caption', …)`)
 * and the bar's thickness is a share of the same number. That is the second
 * defect the six exports showed: a 24 px label beside a heading set at 96 px,
 * because the two were fractions of a frame decided by two authors.
 *
 * The heights add up to the promise on purpose — `air` is whatever the capped
 * track leaves of `BLOCK_APPETITE.progressBar.fixed`, so a bar with a label draws
 * `label + air + track` and one without draws `air/2 + track + air/2`, and both
 * are exactly what `blockExtent` told the layout to expect.
 *
 * `fill` and `value` are ONE quantity read twice, and that is the point of
 * computing them here rather than in the component. The number printed beside a
 * bar that says something different from the bar is a defect nobody catches by
 * watching, because both are plausible on their own; asserted equal in
 * `misc.test.js`, it cannot happen.
 *
 * The ruler is what keeps the block alive after it has arrived, and it is drawn
 * across the WHOLE track — the reached part and the remainder both — for a
 * reason that only shows at the two ends of the range: a march living in the
 * remainder freezes at `to: 100`, and one living in the fill freezes at `to: 0`.
 * Both are values the schema accepts and a document will eventually write. One
 * ruler, two inks, and the phase is shared so the ticks line up where the paint
 * changes.
 *
 * @param {{to?: number, label?: string|null, showValue?: boolean}} block
 * @param {{width: number, height: number}} box  this block's own box, in pixels
 * @param {number} typeUnit  the type unit its stack agreed on, in pixels
 * @param {number} progress  this block's own arrival, already eased
 * @param {number} life  0 to 1 across the whole scene
 * @param {number} radiusPx  the direction's own radius, off `resolveTheme`
 */
export function progressBarGeometry(block, box, typeUnit, progress, life, radiusPx = 0) {
  const room = boxOf(box)
  const to = Math.min(100, Math.max(0, Number(block?.to) || 0))
  const fill = to * unit(progress)

  const unitPx = px(typeUnit)
  const furniture = Math.max(0, Math.round(unitPx * blockAppetite('progressBar').fixed))
  // Three bounds, and each one is a different way the bar stops being a bar: the
  // appetite it was allotted, the length it has to stay slimmer than, and the box
  // it may never exceed. The floor of 3 keeps it visible on a frame size this
  // catalogue does not offer yet.
  const track = Math.max(
    3,
    Math.min(
      Math.round(furniture * TRACK_SHARE_OF_FIXED),
      Math.floor(room.width / TRACK_ASPECT) || Infinity,
      Math.floor(room.height) || Infinity,
    ),
  )
  /*
   * The air, and WHERE it goes — which is the difference between a block that
   * fills its box and a block with a hole in it.
   *
   * The gap under the label is `RUN_GAP`, the house's own air between two runs of
   * one block, and never "whatever is left over". Left over is what it was for
   * one draft, and the draft showed why: a bar in a narrow column is capped by
   * `TRACK_ASPECT` at 45 px out of an allotment of 548, so the remaining 503 went
   * between the label and the bar — a label, half a frame of nothing, and a rule.
   * That is the void this whole pass is about, arriving through a margin instead
   * of through a fraction.
   *
   * So the slack is spent as padding, half above and half below: the group stays
   * a group, sits in the middle of what it was allotted, and the block still
   * draws the full height `stackIn` divided the zone by.
   */
  const gap = block?.label ? Math.min(Math.max(0, furniture - track), Math.round(unitPx * RUN_GAP)) : 0
  const pad = Math.max(0, Math.round((furniture - track - gap) / 2))

  // At least six marks across the measure, and never a step tighter than the bar
  // is thick. `HATCH_MIN_TICKS` is where the two meet.
  const coarsest = Math.max(3, Math.floor(room.width / HATCH_MIN_TICKS) || Infinity)
  const pitch = Math.max(3, Math.min(Math.round(track * HATCH_PITCH_TRACKS), coarsest))

  const labelSize = typeSize('caption', typeUnit)
  const asked = Number.isFinite(Number(radiusPx)) ? Math.max(0, Number(radiusPx)) : 0

  return {
    track,
    /** The air under the label — `RUN_GAP`, and 0 when there is no label. */
    gap,
    /** And the slack, above and below the group. See the note above. */
    pad,
    /**
     * Half the track is a pill and the direction's own radius is a design; the
     * smaller of the two is both. A project that states `radiusPx: 0` gets a
     * squared bar, which is the film it designed — `resolveTheme` already refused
     * anything that was not an integer, so this only has to choose.
     */
    radius: Math.min(track / 2, asked),
    /** The air between the bar and the value beside it: the same `RUN_GAP`, horizontally. */
    valueGap: Math.max(2, Math.round(unitPx * RUN_GAP)),
    labelSize,
    labelLeading: typeRole('caption').leading,
    /**
     * The value is set to the bar's own height rather than to the label's.
     *
     * It sits BESIDE the track, so its line is what decides the row's height —
     * and a caption-sized numeral beside a bar capped by `TRACK_ASPECT` is a row
     * taller than the track, which is height the block never asked the layout
     * for. Bounded by the label's size as well, because a value larger than the
     * word it answers is a bar shouting its own number.
     */
    valueSize: Math.max(1, Math.min(labelSize, Math.round(track * 0.86))),
    fill,
    value: Math.round(fill),
    hatchPitch: pitch,
    // Never the whole pitch: a tick as wide as its cell is a solid bar, and the
    // ruler would then be a second opaque layer over a surface that was measured
    // without one.
    tick: Math.min(Math.max(1, Math.round(pitch * HATCH_TICK_SHARE)), pitch - 1),
    // Modulo the pitch, so the march is seamless: at the end of a scene the
    // pattern is exactly where it started, and a scene that repeats does not jump.
    hatchOffset: ((unit(life) * HATCH_MARCH) % 1) * pitch,
  }
}
