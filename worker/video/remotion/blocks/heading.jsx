import { withAlpha, words } from '../composition.js'
import {
  HEADING_RULE_REST,
  MASK_TRAVEL_PERCENT,
  RULE_ACCENT_SHARE,
  RULE_QUIET_ALPHA,
  runAt,
  ruleExtent,
  ruleWeights,
  textLayout,
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
 *   box       **the box THIS block was given**, in pixels. Every size drawn here
 *             comes out of it, through `textLayout`. Never the zone's box, and
 *             never a fraction of the frame.
 *   unit      the type unit its whole STACK agreed on, so two blocks in one zone
 *             are two steps of one scale rather than two fractions of a frame.
 *   base      the frame's short edge, and it is now reserved for the three
 *             CONSTANT METRICS named in `composition.js` - here, the hairline.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground. `palette.display` for every role - a subtitle is a smaller heading, not a quieter one - and `palette.accent` for the accented last word and the head of the rule, which are decorations and enter the search accent-first with the veil locked.
 *
 * LEGIBILITY: `level` chooses a STEP on the one type scale and never a colour, and the size that step lands on is solved against this block's own box. All three roles are display type and take the 3:1 floor `palette.display` was resolved at, which weight 800 licences past 18.66 px - and the smallest role, the body step, stays past it even at the schema's ceiling of eight blocks in one cell, where it lands at 26 px. `text.test.js` is where that is arithmetic rather than a claim. What a small box takes is the SIZE and never the ink: the type yields to the layout, the contrast never does. Nothing here is painted at a partial opacity at rest - the entrance is a MASK, not a fade, so a glyph is either absent or at the full ink that was measured. A fade would paint every word, for the frames it lasted, in a colour composited from the ink and the ground that nobody measured and that no floor covers.
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
 * A poster. Word by word from behind its own mask, the last word in the accent
 * and taking longer to arrive than its neighbours, over a double rule that runs
 * the measure.
 *
 * **It occupies the box it was given, and that is the whole of what changed.** A
 * heading used to be a fraction of the frame's short edge with an em measure
 * capping how far it could run, which meant a lone heading was 96 px of type and
 * a 12 em line in the middle of 950 px of empty safe height - the "small element
 * in a large void" six real exports showed. Now the size comes off the stack's
 * unit, which `solveTypeUnit` solved against this box, and the measure IS the
 * box, which `composedLayout` already divided among whatever else is in the row.
 * So a short line lands large, a long one wraps and lands smaller, and the size
 * falls out of the LENGTH instead of being tuned for the longest legal string -
 * which is `verticalCaptionSize`'s lesson with the box doing the arithmetic.
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
 * arithmetic a test can ask about. It stands in a band of its own whose height is
 * what `BLOCK_APPETITE` says this kind's furniture is worth - the same number the
 * layout made room for, rather than a margin in ems that nothing downstream knew
 * about.
 */

export const Heading = ({ block, palette, theme, box, unit, base, progress, life }) => {
  const layout = textLayout(block, box, unit)
  const line = runAt(layout, 0)
  const rule = ruleWeights(base, box, layout.furniture)
  const measure = ruleExtent(progress, life, HEADING_RULE_REST)
  const parts = words(block.text)

  return (
    <div style={{ width: '100%', fontFamily: theme.headingFont }}>
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
      {line ? (
        <div
          style={{
            fontSize: line.size,
            // The leading of the step, out of `TYPE_ROLES`. It is the number the
            // wrap estimate used, so a line box tightened here would be a block
            // shorter than the box the layout reserved for it — and one loosened
            // here would be a block through the bottom of it.
            lineHeight: line.leading,
            fontWeight: 800,
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
                    /*
                     * The one property that makes the sentence below TRUE.
                     *
                     * An inline-block whose `overflow` is not `visible` has its
                     * baseline at its BOTTOM MARGIN EDGE (CSS 2.1 §10.8.1), so
                     * this box sat entirely above the line's baseline and the
                     * strut still claimed its descent underneath: a line box of
                     * 1.273 em where the layout had reserved 1.08. Four real
                     * exports are what that cost — a `display` heading alone in a
                     * frame overflowed its box by 140 px and had its rule sliced
                     * off by the bottom of the video, and the frame that showed
                     * it had the word centred over the edge it was supposed to
                     * sit inside.
                     *
                     * `bottom` rather than a length: it aligns the box with the
                     * bottom of the line box instead of with a baseline, so the
                     * line box is exactly `max(strut, box)` = the leading, with
                     * no font metric in the arithmetic. A number in ems here
                     * would be Liberation Sans's descent written down a second
                     * time, and it would be wrong the day a direction names
                     * another family.
                     */
                    verticalAlign: 'bottom',
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
      ) : null}

      {/*
        The double rule of a printed page - a heavy segment in the accent, a
        hairline for the rest - drawn from the margin outwards, at the foot of a
        band the layout already counted. Scaled rather than animated on `width`,
        because a transform is composited and a width is a layout pass on every
        frame of every scene.
      */}
      <div style={{ height: layout.furniture, display: 'flex', alignItems: 'flex-end' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            width: '100%',
            transform: `scaleX(${measure})`,
            // The edge the DOCUMENT chose by naming an anchor, inherited from the
            // zone — see `--mocky-rule-origin` in `ComposedSceneVideo`. `left` was
            // hard-coded here, so a centred heading drew its rule flush against the
            // left margin while its own words sat in the middle of the measure.
            transformOrigin: 'var(--mocky-rule-origin, left) center',
          }}
        >
          <div style={{ width: `${RULE_ACCENT_SHARE * 100}%`, height: rule.heavy, backgroundColor: palette.accent.color }} />
          <div
            style={{
              flex: '1 1 auto',
              height: rule.hair,
              // A relative of the ink rather than a grey of its own: no direction
              // states a token for "the quiet line", and a fixed grey fights a pale
              // ground. Same call `AnimatedTitlesVideo` makes for the same rule.
              backgroundColor: withAlpha(palette.display.color, RULE_QUIET_ALPHA),
            }}
          />
        </div>
      </div>
    </div>
  )
}
