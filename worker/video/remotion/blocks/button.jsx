/**
 * `button` - a control, with the gesture of being pressed.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`.
 *   box       **the box THIS block was given**, in pixels. Every size drawn here
 *             comes off it - see the rule at the top of `composition.js`, and
 *             `blockExtent`, which is what a block owes the box it is handed.
 *   unit      the type unit its STACK agreed on, so two blocks in one zone are
 *             two steps of one scale rather than two fractions of a frame.
 *   base      the frame's short edge. Reserved for the three constant metrics
 *             named in `CONSTANT_METRICS` - here, the outline's weight.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: its own FILL: `palette.fill` painted, `palette.onFill` for the label. The outline variant sits on the ground instead and takes `palette.accent`.
 *
 * LEGIBILITY: This is where the measured-ink discipline came from - the product card's call to action was the only legible element in the export that started all of it, because it was the only one choosing its ink by measuring. Filled: read `onFill`. Outline: read `accent`. Never the other way round. And a filled pill is itself a SURFACE, so `panelEdge` asks whether it can be told apart from the ground before trusting its own fill to draw its edge.
 *
 * TWO RULES that are not negotiable, because the three guarantees of this
 * feature rest on them:
 *
 *   1. **No colour, no font family and no easing curve is written here.** A hex
 *      value in this file is a colour nobody measured; a curve is a sixth notion
 *      of how things move. Both arrive as props, out of `composition.js`, where
 *      a test can reach them.
 *   2. **No `remotion` import, ever.** Nothing here needs a frame hook - the
 *      frame arrives as `progress` and `life` - and staying free of it is what
 *      lets `blocks.test.js` load the whole registry inside Mocky's own suite,
 *      where Remotion is not installed.
 *
 * -- It is a conclusion, at the size of its box ------------------------------
 *
 * A button is the end of a frame, never a fifth line of it, and everything about
 * this block is that one sentence. The product card names three devices that turn
 * a call to action into an ending; two of them belong to a layout this block does
 * not own, so what is left is the third and it is the one that carries: the
 * control GROWS onto its mark while everything above it rose onto theirs.
 * `buttonScale` is where that lives, with the reason `layerCues` cannot hand it a
 * beat of silence.
 *
 * What it was NOT was the size of the frame it was in. Every dimension in here
 * used to be a fraction of `base` - `base * 0.03` of type inside `base * 0.018`
 * of padding - so the same 19 px pill was drawn in a third of a portrait column
 * and in a zone that had the whole safe area, and a button alone on a scene was a
 * small control floating in a large void. `buttonGeometry` answers off the box
 * instead: the pill is as tall as the box, its label as large as the box and the
 * stack's own unit allow, and its width is what that label takes.
 *
 * Then it is pressed - once, late, and back. A control that arrives and holds
 * still is a picture of a control, and the press is the only thing that says the
 * frame was the end of something rather than a slide with a pill on it. It never
 * repeats: a button pressing itself every two seconds is a demo loop, which is
 * the thing this catalogue is trying not to look like.
 *
 * The dip is a SCALE and nothing else. The obvious second half - a fill that
 * darkens under the finger, a ripple spreading from it - is a colour nobody
 * measured landing under the one label whose contrast was resolved against the
 * fill at full strength, which is the defect the whole legibility section exists
 * to prevent, arriving as an ornament.
 */

import { PILL_TRACKING, buttonGeometry, buttonScale, constantMetric, controlClock, panelEdge } from './interface.js'

export const Button = ({ block, palette, theme, box, unit, base, progress, life }) => {
  const filled = block.variant === 'filled'
  const clock = controlClock(progress, life)
  const pill = buttonGeometry(block, box, base, unit)
  /*
   * A filled pill is a surface of its own, and a surface nobody can tell apart
   * from the ground behind it is a label floating on the frame. It is the same
   * defect the notification named on a light direction, one block over: the ink
   * on the fill was measured, the fill against the ground was not. Its own
   * colour when it stands on its own - which is what keeps the two variants the
   * same box to the pixel - and a measured edge when it does not.
   */
  const edge = filled
    ? panelEdge(palette.fill, palette.ground, [palette.onFill.color, palette.display.color, palette.accent.color])
    : null
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // The box's own height, whole: `BLOCK_APPETITE` sizes a button at one
        // line of body type inside 1.3 units of furniture, so the box a button
        // is handed IS a pill of that shape and the padding is what centring the
        // label spends. The width is the label's, capped by the box - see
        // `buttonGeometry` for why a control owes its box the height and not the
        // measure.
        width: pill.width,
        height: pill.height,
        maxWidth: '100%',
        boxSizing: 'border-box',
        padding: `0 ${pill.padX}px`,
        opacity: progress,
        // Never above 1, on any frame: `buttonScale` is an approach and a
        // subtraction, never an overshoot. A pill larger than its mark is a pill
        // past the margin on the four anchors that sit against one.
        transform: `scale(${buttonScale(progress, clock, block.press)})`,
        borderRadius: constantMetric(theme.radiusPx, box),
        backgroundColor: filled ? palette.fill.color : 'transparent',
        border: `${pill.border}px solid ${filled ? (edge?.color ?? palette.fill.color) : palette.accent.color}`,
        color: filled ? palette.onFill.color : palette.accent.color,
        fontFamily: theme.bodyFont,
        fontSize: pill.size,
        fontWeight: 700,
        letterSpacing: PILL_TRACKING,
        lineHeight: 1,
        // It used to be allowed to wrap, and that was the right answer while the
        // type size was a fraction of the frame: a thirty-character label at a
        // size nothing had measured against the zone really could leave the
        // frame, and two lines beat that. It is now solved against the measure
        // the padding leaves, so the label fits by construction - and a wrapped
        // second line inside a pill whose height is its box would be the line
        // that hangs outside it.
        whiteSpace: 'nowrap',
        textAlign: 'center',
      }}
    >
      {block.label}
    </span>
  )
}
