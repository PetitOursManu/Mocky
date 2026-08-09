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
 *   box       THIS block's own box in pixels, `{left, top, width, height}` -
 *             never its zone's. Every size drawn here comes out of it.
 *   unit      the type unit its whole STACK reads, in pixels. A role is a step
 *             on that one scale; a fraction invented here is the defect.
 *   base      the frame's short edge. Reserved for the three constant metrics
 *             named in `CONSTANT_METRICS`, and this block draws none of them.
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
 * ── The figure takes the box, and it no longer takes its neighbour's ────────
 *
 * A counter is the subject of the scene it is in, so it fills the box it was
 * given - and it is the SCALE that says how, not this file. The size was
 * `FIGURE_SIZE`, a ramp from 0.13 of the frame's short edge, while a heading was
 * 0.042 of it: two fractions decided by two authors, so a counter and a heading
 * stacked in one zone came out at three to one, in a frame nobody had asked for
 * that emphasis in. Now both read the unit `composedLayout` solved for their
 * stack, the figure at the `figure` step and the heading at `title`, and the
 * ratio between them is 1.8 by construction.
 *
 * What the ramp was doing, the box does better: `solveTypeUnit` grows the unit
 * until the block fills its box, and `counterLayout` caps it where the widest
 * figure this counter can paint fills the measure. A seven-digit total in a
 * narrow column is small because it is seven digits, not because somebody drew a
 * line at thirteen characters.
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

import { COUNT_SHARE, counterLayout, counterText, counterValue, revealRamp } from './animatedText.js'

export const Counter = ({ block, palette, theme, box, unit, progress, life }) => {
  const ramp = revealRamp(progress, life, COUNT_SHARE)
  const layout = counterLayout(block, box, unit)
  const figure = counterText(block, counterValue(block.from, block.to, ramp))
  return (
    <div
      style={{
        width: '100%',
        paddingTop: layout.air,
        paddingBottom: layout.air,
        opacity: progress,
        transform: `translateY(${(1 - progress) * layout.rise}px)`,
      }}
    >
      <div
        style={{
          fontFamily: theme.headingFont,
          // Sized against the box, and measured on the widest figure this
          // document can produce rather than on the one being painted - a size
          // that fell as the count grew would be a figure breathing a type size
          // at a time.
          fontSize: layout.figure,
          fontWeight: 800,
          lineHeight: layout.figureLeading,
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
            marginTop: layout.gap,
            fontFamily: theme.bodyFont,
            fontSize: layout.label,
            lineHeight: layout.labelLeading,
            color: palette.body.color,
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
