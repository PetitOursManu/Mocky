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
 *   base      the frame's SHORT edge in pixels. Every size here is a fraction of
 *             it, so one number reads the same in 16:9, 9:16 and 1:1.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: its own FILL: `palette.fill` painted, `palette.onFill` for the label. The outline variant sits on the ground instead and takes `palette.accent`.
 *
 * LEGIBILITY: This is where the measured-ink discipline came from - the product card's call to action was the only legible element in the export that started all of it, because it was the only one choosing its ink by measuring. Filled: read `onFill`. Outline: read `accent`. Never the other way round.
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
 * -- Why it grows, and why it presses ----------------------------------------
 *
 * A button is the end of a frame, never a fifth line of it, and everything about
 * this block is that one sentence. The product card names three devices that turn
 * a call to action into an ending; two of them belong to a layout this block does
 * not own, so what is left is the third and it is the one that carries: the
 * control GROWS onto its mark while everything above it rose onto theirs.
 * `buttonScale` is where that lives, with the reason `layerCues` cannot hand it a
 * beat of silence.
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

import { buttonScale, controlClock } from './interface.js'

/**
 * The outline's own weight, and the filled variant's invisible one.
 *
 * The filled pill carries the same border in its own fill colour rather than
 * none, so the two variants have the same box to the pixel: a document that
 * switches between them would otherwise move every block stacked under it in the
 * zone by four pixels, for a change that was supposed to be a colour.
 */
const OUTLINE_PX = 2

export const Button = ({ block, palette, theme, base, progress, life }) => {
  const filled = block.variant === 'filled'
  const clock = controlClock(progress, life)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        opacity: progress,
        // Never above 1, on any frame: `buttonScale` is an approach and a
        // subtraction, never an overshoot. A pill larger than its mark is a pill
        // past the margin on the four anchors that sit against one.
        transform: `scale(${buttonScale(progress, clock, block.press)})`,
        padding: `${Math.round(base * 0.018)}px ${Math.round(base * 0.034)}px`,
        borderRadius: theme.radiusPx,
        boxSizing: 'border-box',
        backgroundColor: filled ? palette.fill.color : 'transparent',
        border: `${OUTLINE_PX}px solid ${filled ? palette.fill.color : palette.accent.color}`,
        color: filled ? palette.onFill.color : palette.accent.color,
        fontFamily: theme.bodyFont,
        fontSize: Math.round(base * 0.03),
        fontWeight: 700,
        letterSpacing: '0.01em',
        // Deliberately allowed to wrap, and bounded by the zone it was given. A
        // label is thirty characters and a three-column portrait zone is a fifth
        // of 1080 px, so a pill that refused to wrap would be a pill leaving the
        // frame - and a control past the safe margin is a worse picture than a
        // control on two lines.
        maxWidth: '100%',
        textAlign: 'center',
      }}
    >
      {block.label}
    </span>
  )
}
