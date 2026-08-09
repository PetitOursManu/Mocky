import { KICKER_TRACKING } from '../composition.js'
import { KICKER_RULE_REST, MASK_TRAVEL_PERCENT, runAt, ruleExtent, ruleWeights, textLayout } from './text.js'

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
 *   box       **the box THIS block was given**, in pixels. Every size drawn here
 *             comes out of it, through `textLayout`. Never the zone's box, and
 *             never a fraction of the frame.
 *   unit      the type unit its whole STACK agreed on, so a kicker over its
 *             heading is two steps of one scale and not two guesses.
 *   base      the frame's short edge, and it is now reserved for the three
 *             CONSTANT METRICS named in `composition.js` - here, the hairline.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground, in `palette.accent` - the decoration run, resolved accent-first with the veil locked. The rule is the same run: it is the same ornament as the word under it, and giving it a colour of its own would be a second answer to a question the palette already answered.
 *
 * LEGIBILITY: The size is a STEP on the one type scale (`caption`) solved against this block's own box, and it used to be 2.6% of the short edge with an assertion beside it. That is a real change of guarantee and it is the one place in this family where it is worth stating plainly. `palette.accent` is resolved at the 3:1 floor, which the audit licenses for bold type past 18.66 px; the size now follows the box, so what holds the licence is the arithmetic of the grid rather than a constant. It holds with room in every arrangement a document is likely to produce - `text.test.js` sweeps a lone block, the ordinary two-or-three-block scene and one that spreads five zones across the grid, and the smallest cell in them sets this run at 50 px. The case it does not cover is named rather than hidden: eight blocks stacked into ONE cell is the poorest scene the schema will accept, the compose prompt's own advice is two or three, and there the unit a stack can afford brings a caption to 17 px on a square frame. The type is what yields, never the ink, because the box is a promise about somebody else's interface and the size is a preference - the same trade `verticalCaptionSize` makes. It is not repaired here on purpose: a block reads a run and never picks one, and a floor under the unit belongs to `solveTypeUnit`, where all twenty-seven kinds would get it at once. The entrance is a MASK and not a fade, so a glyph is either absent or at the full accent that was measured; a fade would paint the run, for the frames it lasted, in a colour composited with the ground that no floor covers.
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
 * A rule drawn out from the margin across the whole measure, and the tracked
 * uppercase line rising from behind it. It is the device `AnimatedTitlesVideo`
 * gives the film's own counter, here as something a document ASKS for - a
 * composed scene draws no automatic kicker, because its layout is the document's
 * and a surtitle painted over a stack somebody arranged is an element nobody
 * wanted.
 *
 * **The rule is above the line and no longer beside it**, and that is the box
 * rule rather than a taste. Beside it, the rule was 6% of the frame's short edge
 * whatever box the block had been given - a 65 px tick next to a line of type in
 * a corner cell and next to the same line filling a full frame - and, worse, it
 * stood in the MEASURE: a column of furniture takes room the wrap estimate in
 * `textLines` assumed the text had, so the label wrapped one line more than
 * `composedLayout` had reserved and the block left its box. Above it, the rule
 * runs the measure the block actually owns and the band it stands in is exactly
 * the furniture `BLOCK_APPETITE` priced this kind at.
 *
 * The rule keeps drawing after the word has landed, and that is the block's
 * answer to "nothing holds still": `progress` is 1 for almost the whole scene by
 * design, so an entrance is all a block would have. The rule lands at just over
 * half its length and reaches the whole of it on the last frame - see
 * `ruleExtent`, where the claim is arithmetic rather than a promise.
 *
 * It grows inside a box of its final width rather than by widening one, so
 * nothing under it creeps for the length of the scene: a transform is composited,
 * a width is a layout pass, and a line of type that moves a pixel every few
 * frames reads as an instability rather than as a rule being drawn.
 */

export const Kicker = ({ block, palette, theme, box, unit, base, progress, life }) => {
  const layout = textLayout(block, box, unit)
  const line = runAt(layout, 0)
  const rule = ruleWeights(base, box, layout.furniture)

  return (
    <div style={{ width: '100%', fontFamily: theme.bodyFont }}>
      {/*
        The band the weight table paid for: the rule at its top, and the air
        below it is what separates a surtitle from the line it announces. Its
        height is `fixed * unit` and not a margin in ems, because a margin is a
        number this block invents and the band is the number the layout reserved.
      */}
      <div style={{ height: layout.furniture, display: 'flex', alignItems: 'flex-start' }}>
        <div
          style={{
            width: '100%',
            height: rule.hair,
            backgroundColor: palette.accent.color,
            transform: `scaleX(${ruleExtent(progress, life, KICKER_RULE_REST)})`,
            transformOrigin: 'left center',
          }}
        />
      </div>

      {line ? (
        <div
          style={{
            fontSize: line.size,
            lineHeight: line.leading,
            overflow: 'hidden',
            // Padded out and pulled back in, exactly as a heading's words are:
            // the visible box is taller than the line box so a parenthesis or a
            // digit's tail survives the mask, and the layout is what it would
            // have been without either.
            paddingTop: '0.08em',
            paddingBottom: '0.2em',
            marginTop: '-0.08em',
            marginBottom: '-0.2em',
          }}
        >
          <div
            style={{
              fontWeight: 700,
              letterSpacing: KICKER_TRACKING,
              textTransform: 'uppercase',
              color: palette.accent.color,
              wordBreak: 'break-word',
              // Down from behind the rule. A percentage of the line's own height,
              // past 100 for the reason `MASK_TRAVEL_PERCENT` gives, so there is
              // nothing of it anywhere before it arrives.
              transform: `translateY(${(progress - 1) * MASK_TRAVEL_PERCENT}%)`,
            }}
          >
            {/* Model-written text as a React child: escaped here and nowhere else. */}
            {block.text}
          </div>
        </div>
      ) : null}
    </div>
  )
}
