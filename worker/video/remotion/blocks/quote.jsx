import { withAlpha } from '../composition.js'
import {
  QUOTE_RULE_REST,
  RULE_QUIET_ALPHA,
  quoteCue,
  quoteMark,
  runAt,
  runRise,
  ruleExtent,
  ruleWeights,
  textLayout,
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
 *   box       **the box THIS block was given**, in pixels. Every size drawn here
 *             comes out of it, through `textLayout`. Never the zone's box, and
 *             never a fraction of the frame.
 *   unit      the type unit its whole STACK agreed on: the quotation and its
 *             attribution are two steps of it, never two fractions of a frame.
 *   base      the frame's short edge, and it is now reserved for the three
 *             CONSTANT METRICS named in `composition.js` - here, the hairline.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground. The quotation takes `palette.display`; the attribution is running text and takes `palette.body`; the drawn mark is an ornament and takes `palette.accent`, and the rule beside it is a hairline of the display ink at `RULE_QUIET_ALPHA`.
 *
 * LEGIBILITY: The two runs have DIFFERENT floors - 3:1 for the quotation, 4.5:1 for the attribution - which is why they read two entries rather than sharing one. An attribution painted in the display ink would be a run measured at the wrong bar, and it is the run most likely to be small enough for that to matter. It is also why the two sizes are two STEPS of one scale (`title` and `caption`) rather than two fractions of the short edge: the attribution stays in a fixed ratio to the sentence at every box size, so the run that carries the stricter floor cannot quietly become the smallest thing on the frame in a narrow column. The rail is `withAlpha` over the display ink rather than a grey of its own, for the reason `AnimatedTitlesVideo` gives about its hairline: no direction states a token for "the quiet line", and a fixed grey fights a pale ground.
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
 * A masthead - the mark, and a rule running the measure away from it - then the
 * quotation under it, and the attribution after a beat.
 *
 * **The marginal column is gone and the reason is the box.** The mark and its
 * rail used to stand to the LEFT of the sentence, which read well and was wrong
 * twice: the column was sized in ems of a type size read off the frame, so it was
 * the same 60 px beside a full-frame pull quote and beside one in a corner cell;
 * and it stood inside the measure, taking room that `textLines` had already
 * promised to the words. A block whose furniture eats its own measure wraps one
 * line more than `composedLayout` reserved for it, and the box it overflows is
 * the safe area - a promise about a feed application's interface rather than a
 * taste in margins. Stacked, the band is exactly the furniture `BLOCK_APPETITE`
 * priced this kind at, and the sentence gets the whole width.
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
 * The rule is what is still moving on the four hundredth frame. It is drawn out
 * from the mark, lands at a quarter of the measure and reaches the far edge on
 * the last frame of the scene, so no two frames of a quote are the same frame.
 * `ruleExtent` is where that stops being a promise.
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

export const Quote = ({ block, palette, theme, box, unit, base, progress, life }) => {
  const layout = textLayout(block, box, unit)
  const sentence = runAt(layout, 0)
  const credit = runAt(layout, 1)
  const glyph = quoteMark(layout.furniture)
  const rule = ruleWeights(base, box, layout.furniture)

  const mark = quoteCue('mark', progress)
  const said = quoteCue('text', progress)
  const attributed = quoteCue('attribution', progress)

  return (
    <figure style={{ margin: 0, width: '100%' }}>
      {/*
        The band the weight table paid for. Its height is `fixed * unit`, so the
        mark grows with the sentence under it instead of with the frame - a mark
        sized off the short edge was enormous in a corner cell and lost in a full
        one.
      */}
      <div style={{ height: layout.furniture, display: 'flex', alignItems: 'center', gap: glyph.gap }}>
        <svg
          viewBox="0 0 24 20"
          width={glyph.width}
          height={glyph.height}
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
          Scaled rather than animated on `width`, because a transform is
          composited and a width is a layout pass on every frame - and because a
          rule that grew by layout would push the mark, which makes the two
          indistinguishable to a viewer and very distinguishable to a two-core
          container with a 110 s budget.
        */}
        <div
          style={{
            flex: '1 1 auto',
            height: rule.hair,
            backgroundColor: withAlpha(palette.display.color, RULE_QUIET_ALPHA),
            transform: `scaleX(${ruleExtent(progress, life, QUOTE_RULE_REST)})`,
            // `left`, deliberately, and the one rule in the family that keeps it:
            // this one grows out of the quotation MARK beside it rather than across
            // an empty measure, so an origin taken from the zone's alignment would
            // detach it from the glyph it is attached to and leave a gap. The other
            // three read `--mocky-rule-origin`; see `ComposedSceneVideo`.
            transformOrigin: 'left center',
          }}
        />
      </div>

      {sentence ? (
        <blockquote
          style={{
            margin: 0,
            opacity: said,
            // An em of its own size rather than a fraction of the frame: the same
            // gesture whatever box the block landed in. See `RUN_RISE_EM`.
            transform: `translateY(${runRise(sentence.size, said)}px)`,
            fontFamily: theme.headingFont,
            fontSize: sentence.size,
            lineHeight: sentence.leading,
            fontWeight: 600,
            color: palette.display.color,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {/* Model-written text as a React child: escaped here and nowhere else. */}
          {block.text}
        </blockquote>
      ) : null}

      {credit ? (
        <figcaption
          style={{
            // The air between two runs of one block, out of `RUN_GAP` - the same
            // number `shapeHeight` counted when the layout decided how tall this
            // block would be. A margin in ems here would be a height nothing
            // upstream knew about.
            marginTop: layout.gap,
            opacity: attributed,
            transform: `translateY(${runRise(credit.size, attributed)}px)`,
            fontFamily: theme.bodyFont,
            fontSize: credit.size,
            lineHeight: credit.leading,
            color: palette.body.color,
          }}
        >
          {block.attribution}
        </figcaption>
      ) : null}
    </figure>
  )
}
