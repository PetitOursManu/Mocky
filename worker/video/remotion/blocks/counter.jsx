/**
 * `counter` - a number that counts up to itself.
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
 * SURFACE: the ground: the figure in `palette.display`, the label in `palette.body`.
 *
 * LEGIBILITY: The figure is the largest thing this block draws and takes the display floor; the label under it is running text and takes 4.5:1. Two runs, two entries.
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
 * ── Two clocks, and the reason there are two ────────────────────────────────
 *
 * The ARRIVAL - the opacity and the rise - walks `progress`, which is the house
 * curve already applied: that is where the damping in this block lives, and it is
 * the only place a block is allowed to have any, since a curve written here would
 * be a twenty-fifth notion of how things move.
 *
 * The COUNT walks the scene's clock, because `progress` is nine frames and a
 * figure that reaches a million in three hundred milliseconds is a flicker rather
 * than a count. It stops ON its value - `counterValue` clamps both ends, since
 * rounding is how a count overshoots by one for a single frame - and it stops
 * with a quarter of the scene left, because a number nobody had time to read is a
 * counter that failed.
 *
 * What it does NOT have is a second breath afterwards. `COMPOSED_BLOCK_DRIFT`
 * says why: the stack already moves, and two notions of "a block breathes" is one
 * of them drifting.
 */

import { COUNT_SHARE, FIGURE_SIZE, counterValue, fittedSize, groupedNumber, revealRamp } from './animatedText.js'

const LABEL_SIZE = 0.028
const LABEL_GAP = 0.016
const RISE = 0.02

export const Counter = ({ block, palette, theme, base, progress, life }) => {
  const ramp = revealRamp(progress, life, COUNT_SHARE)
  const figure = `${block.prefix ?? ''}${groupedNumber(counterValue(block.from, block.to, ramp))}${block.suffix ?? ''}`
  // Measured on the FINISHED string and not on the one being drawn, or the type
  // size would shrink as the count grew and the figure would breathe a size at a
  // time.
  const settled = `${block.prefix ?? ''}${groupedNumber(block.to)}${block.suffix ?? ''}`
  return (
    <div style={{ opacity: progress, transform: `translateY(${(1 - progress) * base * RISE}px)`, maxWidth: '100%' }}>
      <div
        style={{
          fontFamily: theme.headingFont,
          fontSize: fittedSize(settled, base, FIGURE_SIZE),
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          // Tabular figures, or the number jumps a character wide as it counts.
          fontVariantNumeric: 'tabular-nums',
          // The thousands are held together by a non-breaking space already; this
          // is the affix, which is a currency mark that belongs on the figure's
          // own line whatever the width of the zone.
          whiteSpace: 'nowrap',
          color: palette.display.color,
        }}
      >
        {figure}
      </div>
      {block.label ? (
        <div
          style={{
            marginTop: Math.round(base * LABEL_GAP),
            fontFamily: theme.bodyFont,
            fontSize: Math.round(base * LABEL_SIZE),
            color: palette.body.color,
            maxWidth: '100%',
            wordBreak: 'break-word',
          }}
        >
          {/* Model-written text as a React child: escaped here and nowhere else. */}
          {block.label}
        </div>
      ) : null}
    </div>
  )
}
