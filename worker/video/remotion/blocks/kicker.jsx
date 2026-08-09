import { KICKER_SIZE, KICKER_TRACKING } from '../composition.js'
import { KICKER_RULE_MAX, KICKER_RULE_REST, ruleExtent, ruleThickness } from './text.js'

/**
 * `kicker` - a surtitle: the smallest line on the frame, and the one that says what is coming.
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
 * SURFACE: the ground, in `palette.accent` - the decoration run, resolved accent-first with the veil locked. The rule is the same run: it is the same ornament as the word beside it, and giving it a colour of its own would be a second answer to a question the palette already answered.
 *
 * LEGIBILITY: `KICKER_SIZE` is 2.6% of the short edge, 28 px in all three ratios, which clears the 18.66 px at weight 700 that licences the 3:1 floor `palette.accent` was resolved at. Shrink it and the run drops below its own floor - which is why the size is a constant in `composition.js`, next to the assertion that holds it there, rather than a number in this file.
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
 * -- What it draws --------------------------------------------------------------
 *
 * A rule drawn out from the margin, and the line beside it. It is the device
 * `AnimatedTitlesVideo` gives the film's own counter, here as something a
 * document ASKS for - a composed scene draws no automatic kicker, because its
 * layout is the document's and a surtitle painted over a stack somebody arranged
 * is an element nobody wanted.
 *
 * The rule keeps drawing after the word has landed, and that is the block's
 * answer to "nothing holds still": `progress` is 1 for almost the whole scene by
 * design, so an entrance is all a block would have. The rule lands at just over
 * half its length and reaches the whole of it on the last frame - see
 * `ruleExtent`, where the claim is arithmetic rather than a promise.
 *
 * It grows inside a box of its final width rather than by widening one, so the
 * word beside it does not creep sideways for the length of the scene: a transform
 * is composited, a width is a layout pass, and a line of type that moves a pixel
 * every few frames reads as an instability rather than as a rule being drawn.
 */

export const Kicker = ({ block, palette, theme, base, progress, life }) => {
  const track = Math.round(base * KICKER_RULE_MAX)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        // The size sits on the wrapper so the gap can be an em of the LINE
        // rather than an em of whatever the zone happened to inherit, which is
        // the frame's default 16 px and a gap four times too small at 1080p.
        fontFamily: theme.bodyFont,
        fontSize: Math.round(base * KICKER_SIZE),
        gap: '0.7em',
        opacity: progress,
      }}
    >
      <span style={{ flex: '0 0 auto', width: track }}>
        <span
          style={{
            display: 'block',
            height: ruleThickness(base) * 2,
            backgroundColor: palette.accent.color,
            transform: `scaleX(${ruleExtent(progress, life, KICKER_RULE_REST)})`,
            transformOrigin: 'left center',
          }}
        />
      </span>
      <span
        style={{
          fontWeight: 700,
          letterSpacing: KICKER_TRACKING,
          textTransform: 'uppercase',
          color: palette.accent.color,
        }}
      >
        {/* Model-written text as a React child: escaped here and nowhere else. */}
        {block.text}
      </span>
    </span>
  )
}
