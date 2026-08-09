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
 * ── What may not be in it ───────────────────────────────────────────────────
 *
 * The same two rules the blocks are written under, for the same reasons: no
 * colour and no easing curve. `progress` arrives already eased by `cueProgress`,
 * and every continuous term below is read straight off `life`, exactly as
 * `groundDensity` reads it. Nothing here paints; it answers with numbers and the
 * components turn them into styles.
 */

/** 0 to 1, whatever arrives. A block is validated three times over; this file still must not trust a caller. */
const unit = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
}

/** A non-negative frame edge in pixels. `frameBase` guarantees it; a hand-built test does not. */
const edge = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

// ── separator ────────────────────────────────────────────────────────────────

/**
 * The house's own hairline, as a fraction of the short edge.
 *
 * 0.28% is 3 px on the 1080 both landscape and portrait exports share, and the
 * floor of 1 below is what keeps it a rule rather than nothing on a frame size
 * this catalogue does not offer yet.
 */
export const RULE_THICKNESS = 0.0028

/** How far a rule runs across the box its zone handed it. Fractions of the cell, never pixels. */
export const RULE_EXTENTS = { short: 0.18, measure: 0.62, full: 1 }

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
 * @param {number} base  the frame's short edge in pixels
 * @param {number} progress  this block's own arrival, already eased
 * @param {number} life  0 to 1 across the whole scene
 */
export function separatorGeometry(block, base, progress, life) {
  const size = edge(base)
  const treatment = RULE_TREATMENTS.includes(block?.treatment) ? block.treatment : RULE_TREATMENTS[0]
  const named = String(block?.extent)
  const width = Object.hasOwn(RULE_EXTENTS, named) ? RULE_EXTENTS[named] : RULE_EXTENTS.measure

  const thickness = Math.max(1, Math.round(size * RULE_THICKNESS))
  const drawn = RULE_DRAWN_AT_ARRIVAL + (1 - RULE_DRAWN_AT_ARRIVAL) * unit(life)

  return {
    treatment,
    width,
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

/** The bar itself, as a fraction of the short edge. 1.2% is 13 px on 1080. */
export const TRACK_THICKNESS = 0.012

/** The pitch of the ruler along the track, and how wide one of its ticks is. */
export const HATCH_PITCH = 0.014
export const HATCH_TICK = 0.0018

/**
 * How many pitches the ruler travels across one scene.
 *
 * Per SCENE and not per second, exactly like `PULSE_CYCLES`: a rhythm in
 * milliseconds is a period the model would have had to describe, and this
 * catalogue does not let a document name one. Eight pitches is about 110 px over
 * a scene — a march you notice when you look at the bar and not when you are
 * reading the label above it.
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
 * @param {number} base  the frame's short edge in pixels
 * @param {number} progress  this block's own arrival, already eased
 * @param {number} life  0 to 1 across the whole scene
 * @param {number} radiusPx  the direction's own radius, off `resolveTheme`
 */
export function progressBarGeometry(block, base, progress, life, radiusPx = 0) {
  const size = edge(base)
  const to = Math.min(100, Math.max(0, Number(block?.to) || 0))
  const fill = to * unit(progress)

  const track = Math.max(4, Math.round(size * TRACK_THICKNESS))
  const pitch = Math.max(3, Math.round(size * HATCH_PITCH))
  const asked = Number.isFinite(Number(radiusPx)) ? Math.max(0, Number(radiusPx)) : 0

  return {
    track,
    /**
     * Half the track is a pill and the direction's own radius is a design; the
     * smaller of the two is both. A project that states `radiusPx: 0` gets a
     * squared bar, which is the film it designed — `resolveTheme` already refused
     * anything that was not an integer, so this only has to choose.
     */
    radius: Math.min(track / 2, asked),
    gap: Math.max(2, Math.round(size * 0.014)),
    labelSize: Math.max(1, Math.round(size * 0.024)),
    fill,
    value: Math.round(fill),
    hatchPitch: pitch,
    // Never the whole pitch: a tick as wide as its cell is a solid bar, and the
    // ruler would then be a second opaque layer over a surface that was measured
    // without one.
    tick: Math.min(Math.max(1, Math.round(size * HATCH_TICK)), pitch - 1),
    // Modulo the pitch, so the march is seamless: at the end of a scene the
    // pattern is exactly where it started, and a scene that repeats does not jump.
    hatchOffset: ((unit(life) * HATCH_MARCH) % 1) * pitch,
  }
}
