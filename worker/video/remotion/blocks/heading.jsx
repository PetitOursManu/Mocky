import { withAlpha, words } from '../composition.js'
import {
  HEADING_RULE_REST,
  MASK_TRAVEL_PERCENT,
  RULE_ACCENT_SHARE,
  RULE_QUIET_ALPHA,
  headingMeasure,
  headingSize,
  ruleExtent,
  ruleThickness,
  wordReveal,
} from './text.js'

/**
 * `heading` - a line of display type, at one of three roles.
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
 * SURFACE: the ground. `palette.display` for every role - a subtitle is a smaller heading, not a quieter one - and `palette.accent` for the accented last word and the head of the rule, which are decorations and enter the search accent-first with the veil locked.
 *
 * LEGIBILITY: `level` chooses a SIZE and never a colour. All three roles are display type and take the 3:1 floor `palette.display` was resolved at, which the smallest of them clears on size alone: 0.042 of the short edge is 45 px. Nothing here is painted at a partial opacity at rest - the entrance is a MASK, not a fade, so a glyph is either absent or at the full ink that was measured. A fade would paint every word, for the frames it lasted, in a colour composited from the ink and the ground that nobody measured and that no floor covers.
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
 * Word by word from behind its own mask, the last word in the accent and taking
 * longer to arrive than its neighbours, over a rule that runs the measure.
 *
 * The mask is what makes it read as titling rather than as an element appearing,
 * and it is the treatment `AnimatedTitlesVideo` already gives a headline: the
 * word is inside a box with `overflow: hidden`, padded past its own descenders,
 * and it travels up into view. The accent goes to the LAST word because a
 * sentence lands on its end, and to no word at all when there is only one -
 * accenting the only word there is is a colour change, not an accent.
 *
 * The rule is the thing that is still moving on the four hundredth frame. Every
 * other term here is an arrival, and an arrival is over in nine frames; the rule
 * lands at a third of its measure and runs the rest of it across the scene, so no
 * two frames of a heading are the same frame. See `ruleExtent`, where that is
 * arithmetic a test can ask about.
 */

export const Heading = ({ block, palette, theme, base, progress, life }) => {
  const parts = words(block.text)
  const thickness = ruleThickness(base)
  const measure = ruleExtent(progress, life, HEADING_RULE_REST)

  return (
    <div
      style={{
        fontFamily: theme.headingFont,
        fontSize: Math.round(base * headingSize(block.level)),
        // A count of characters and never a share of the frame - the zone has
        // already been divided among whatever else is in its row, so a
        // percentage here would cap a display line at a fifth of the frame. The
        // zone still wins when it is the narrower of the two, which is what
        // `min()` says and what a bare `em` would not.
        maxWidth: `min(100%, ${headingMeasure(block.level)}em)`,
      }}
    >
      {/*
        Inline flow and not a flex row, which `AnimatedTitlesVideo` uses for the
        same cascade. That file aligns to one margin and nothing else; a block
        lands in a zone whose alignment the DOCUMENT chose, and `text-align` is
        the property that carries it — a flex container ignores it, so a
        `top-right` heading that ran to two lines would set both of them flush
        LEFT inside a box sitting on the right margin. The word space is its own
        for the same reason: a gap in ems is a number beside a font that already
        has one.
      */}
      <div
        style={{
          fontWeight: 800,
          lineHeight: 1.08,
          letterSpacing: '-0.02em',
          color: palette.display.color,
          wordBreak: 'break-word',
        }}
      >
        {parts.map((word, i) => {
          const emphasis = parts.length > 1 && i === parts.length - 1
          const arrived = wordReveal(progress, i, parts.length)
          return (
            <span key={i}>
              {i > 0 ? ' ' : null}
              <span
                style={{
                  display: 'inline-block',
                  overflow: 'hidden',
                  // Padding out and margin back in: the visible box is taller
                  // than the line box so descenders survive `overflow: hidden`,
                  // and the layout is exactly what it would have been without
                  // either.
                  paddingTop: '0.08em',
                  paddingBottom: '0.2em',
                  marginTop: '-0.08em',
                  marginBottom: '-0.2em',
                  color: emphasis ? palette.accent.color : undefined,
                }}
              >
                <span style={{ display: 'inline-block', transform: `translateY(${(1 - arrived) * MASK_TRAVEL_PERCENT}%)` }}>
                  {/* Model-written text as a React child: escaped here and nowhere else. */}
                  {word}
                </span>
              </span>
            </span>
          )
        })}
      </div>

      {/*
        The double rule of a printed page - a heavy segment in the accent, a
        hairline for the rest - drawn from the margin outwards. Scaled rather
        than animated on `width`, because a transform is composited and a width
        is a layout pass on every frame of every scene.
      */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          marginTop: '0.34em',
          transform: `scaleX(${measure})`,
          transformOrigin: 'left center',
        }}
      >
        <div style={{ width: `${RULE_ACCENT_SHARE * 100}%`, height: thickness * 3, backgroundColor: palette.accent.color }} />
        <div
          style={{
            flex: '1 1 auto',
            height: thickness,
            // A relative of the ink rather than a grey of its own: no direction
            // states a token for "the quiet line", and a fixed grey fights a pale
            // ground. Same call `AnimatedTitlesVideo` makes for the same rule.
            backgroundColor: withAlpha(palette.display.color, RULE_QUIET_ALPHA),
          }}
        />
      </div>
    </div>
  )
}
