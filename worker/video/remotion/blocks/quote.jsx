import { withAlpha } from '../composition.js'
import {
  QUOTE_ATTRIBUTION_SIZE,
  QUOTE_MEASURE_EMS,
  QUOTE_RAIL_REST,
  QUOTE_SIZE,
  RULE_QUIET_ALPHA,
  quoteCue,
  ruleExtent,
  ruleThickness,
  wordReveal,
} from './text.js'

/**
 * `quote` - a sentence somebody said, and who said it.
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
 * SURFACE: the ground. The quotation takes `palette.display`; the attribution is running text and takes `palette.body`; the drawn mark is an ornament and takes `palette.accent`.
 *
 * LEGIBILITY: The two runs have DIFFERENT floors - 3:1 for the quotation, 4.5:1 for the attribution - which is why they read two entries rather than sharing one. An attribution painted in the display ink would be a run measured at the wrong bar, and it is the run most likely to be small enough for that to matter. The rail is `withAlpha` over the display ink rather than a grey of its own, for the reason `AnimatedTitlesVideo` gives about its hairline: no direction states a token for "the quiet line", and a fixed grey fights a pale ground.
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
 * A marginal column - the mark, then a rail running down beside the sentence -
 * and the quotation set against it, with the attribution arriving after.
 *
 * **The mark is DRAWN and not typed**, and that is a decision about a container
 * rather than a taste. This image installs one font family and appends Liberation
 * Sans behind whatever the direction declared; a curly pair is a glyph a declared
 * face may simply not carry, and a missing glyph is a hollow box burnt into an
 * mp4 nobody previewed. Two slabs of geometry have no font in them at all. They
 * are drawn in `currentColor` so the colour still arrives from the palette, and
 * the second one follows the first through the same stagger a heading's words
 * use - one notion of "these arrive in order", not a second one for two shapes.
 *
 * The rail is what is still moving on the four hundredth frame. It is drawn
 * downwards from the mark, lands at a quarter of its length and reaches the foot
 * of the quotation on the last frame of the scene, so no two frames of a quote
 * are the same frame. `ruleExtent` is where that stops being a promise.
 */

/**
 * The mark, as two slanted slabs on a 24x20 field.
 *
 * A prime rather than a comma: this design system is rules and set type, and a
 * calligraphic curl in the middle of it is an ornament from a different family.
 * Held as a path with two subpaths so the two slabs share one fill, and drawn
 * with no stroke at all - a stroke width would have to be scaled against a
 * viewBox and would land on a fraction of a pixel at one of the three ratios.
 */
const SLABS = ['M5 0H11L6 20H0Z', 'M18 0H24L19 20H13Z']

export const Quote = ({ block, palette, theme, base, progress, life }) => {
  const size = Math.round(base * QUOTE_SIZE)
  const mark = quoteCue('mark', progress)
  const said = quoteCue('text', progress)
  const credit = quoteCue('attribution', progress)

  return (
    <figure
      style={{
        margin: 0,
        display: 'flex',
        alignItems: 'stretch',
        gap: '0.5em',
        fontSize: size,
        // A count of characters, never a share of the frame - see
        // `HEADING_MEASURE_EMS`. The zone wins when it is narrower, which is what
        // `min()` says and a bare `em` would not.
        maxWidth: `min(100%, ${QUOTE_MEASURE_EMS}em)`,
      }}
    >
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '1.15em' }}>
        <svg
          viewBox="0 0 24 20"
          width="1.15em"
          height="0.96em"
          // Its own field is the mask, stated rather than inherited from a user
          // agent stylesheet: the slabs travel a little further than the field is
          // tall, so before they arrive there is nothing of them anywhere.
          style={{ flex: '0 0 auto', color: palette.accent.color, overflow: 'hidden' }}
        >
          {SLABS.map((path, i) => {
            const drawn = wordReveal(mark, i, SLABS.length)
            return (
              <path
                key={i}
                d={path}
                fill="currentColor"
                // Down from behind the top edge, in viewBox units, so it is the
                // same gesture at every frame size. A mask and not a fade, like
                // the heading's words: a half-faded ornament is the accent
                // composited with the ground at a value nobody measured.
                transform={`translate(0 ${(drawn - 1) * 22})`}
              />
            )
          })}
        </svg>
        {/*
          The rail. Scaled rather than animated on `height`, because a transform
          is composited and a height is a layout pass on every frame - and
          because a rail that grew by layout would push nothing, which makes the
          two indistinguishable to a viewer and very distinguishable to a
          two-core container with a 110 s budget.
        */}
        <div
          style={{
            flex: '1 1 auto',
            width: ruleThickness(base),
            marginTop: '0.3em',
            backgroundColor: withAlpha(palette.display.color, RULE_QUIET_ALPHA),
            transform: `scaleY(${ruleExtent(progress, life, QUOTE_RAIL_REST)})`,
            transformOrigin: 'top center',
          }}
        />
      </div>

      <div style={{ minWidth: 0 }}>
        <blockquote
          style={{
            margin: 0,
            opacity: said,
            transform: `translateY(${(1 - said) * base * 0.016}px)`,
            fontFamily: theme.headingFont,
            fontWeight: 600,
            lineHeight: 1.28,
            color: palette.display.color,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {/* Model-written text as a React child: escaped here and nowhere else. */}
          {block.text}
        </blockquote>
        {block.attribution ? (
          <figcaption
            style={{
              marginTop: '0.42em',
              opacity: credit,
              transform: `translateY(${(1 - credit) * base * 0.012}px)`,
              fontFamily: theme.bodyFont,
              fontSize: Math.round(base * QUOTE_ATTRIBUTION_SIZE),
              lineHeight: 1.4,
              color: palette.body.color,
            }}
          >
            {block.attribution}
          </figcaption>
        ) : null}
      </div>
    </figure>
  )
}
