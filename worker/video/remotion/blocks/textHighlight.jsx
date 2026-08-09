import {
  HIGHLIGHT_RULE_REST,
  boxPadEm,
  highlightRoom,
  markerClip,
  markerRadius,
  markerWipe,
  runAt,
  runRise,
  ruleExtent,
  ruleWeights,
  splitMark,
  textLayout,
  underlineDropEm,
} from './text.js'

/**
 * `textHighlight` - a line with one run of it marked.
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
 *   unit      the type unit its whole STACK agreed on, so a marked line beside a
 *             heading is a step of one scale rather than a fraction of a frame.
 *   base      the frame's short edge, and it is now reserved for the three
 *             CONSTANT METRICS named in `composition.js` - here, the hairline.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground for the whole line (`palette.body`), and the accent FILL for whatever the marker has already covered - those glyphs take `palette.onFill`, the ink measured against the accent itself. The underline, the box and the rule an unmarked line draws instead are ornaments and take `palette.accent`; the run they mark stays on the ground.
 *
 * LEGIBILITY: This is the block where reading the wrong entry is invisible until it ships, and there are two ways to get it wrong. The first is the surface: text on the marker sits on `palette.fill` and not on the ground, so it takes `palette.onFill` - which is why the marker is never merely painted behind the word. See the two-layer note below. The second is the FLOOR: a marked run is running text, and running text takes 4.5:1 wherever it sits. On the ground that is `palette.body`, resolved at exactly that. On the fill, `palette.onFill` was resolved at the 3:1 display floor - the pill's floor - so the marked run is set at weight 700, which is what licences it: the audit's own rule calls bold text past 18.66 px large. That size is now the `body` step of the stack's own unit rather than 4% of the short edge, so what holds the licence is the arithmetic of the grid; `text.test.js` sweeps the arrangements a document is likely to produce, and the body step stays past that bar even at the schema's ceiling of eight blocks in one cell, where it lands at 26 px. Where a box really is too small for it, the SIZE is what yields and never the ink - the box is a promise about somebody else's interface and the type is a preference. It is `palette.accent` that this block deliberately does NOT use for text: the accent is a decoration run at 3:1, and a body-size sentence in it is a run measured at the wrong bar.
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
 * -- The marker is drawn, and it is part of what the text was measured against ---
 *
 * The obvious construction is a coloured rectangle behind the word, wiped in, and
 * it is wrong for the length of the wipe. The word would have to be painted in
 * ONE ink for a frame in which half of it is on the accent and half on the ground
 * - either an ink measured against the fill sitting on the ground, or the ground's
 * ink sitting on the fill. Both are a run on a surface nobody measured, which is
 * the defect that shipped a dark green headline on a near-black frame, arriving
 * here through an ornament instead of through a token.
 *
 * So there are two copies of the run stacked exactly, one in the ground's ink and
 * one in the fill's, and the fill and the second copy are clipped by the SAME
 * rectangle - `markerClip`, called once. Every pixel of every frame is therefore
 * one of two pairs the palette resolved: the body ink on the ground, or `onFill`
 * on the accent. There is no third state during the wipe, and none while the
 * stroke soaks upward through the word afterwards.
 *
 * -- The band, and the line that has nothing marked ------------------------------
 *
 * The furniture this kind is priced at is the ROOM its ornaments need: the drawn
 * box stands off the word and the underline drops below the baseline, and both of
 * those are outside the line box. Half the band above and half below
 * (`highlightRoom`), which is what keeps an ornament inside the block's own box
 * instead of in the stack gap or over its neighbour - the em figures and the band
 * are comparable numbers, and `text.test.js` compares them.
 *
 * The soak is what keeps this block moving after its nine frames of arrival are
 * spent: it runs on `life` and rises for the whole scene. The underline and the
 * box get the same term as a position rather than as a mask, because a rule two
 * device pixels tall clipped by 28% of its own height is a rule nobody sees. A
 * line whose `mark` is absent or does not occur has none of those, and it would
 * be the one block in this family that freezes for four hundred frames - so it
 * draws the family's rule in the room below it instead, on `ruleExtent` like
 * every other. `mark` is nullable and an optional field is a field a model omits;
 * the case you get by saying nothing has to be the good one.
 */

/** Where the fill and the two ornaments sit relative to the run, in ems of the line. */
const MARKER_PAD_EM = 0.18

export const TextHighlight = ({ block, palette, theme, box, unit, base, progress, life }) => {
  const layout = textLayout(block, box, unit)
  const line = runAt(layout, 0)
  const room = highlightRoom(layout.furniture)
  const rule = ruleWeights(base, box, room)

  const [before, marked, after] = splitMark(block.text, block.mark)
  // Anything this build does not recognise is a marker, for the reason
  // `anchorName` and `blockComponent` both answer with a default: the value was
  // refused by three validators long before a frame, so reaching that branch
  // means two lists disagree - and a marked run drawn the commonest way beats a
  // marked run with nothing on it at all (Q1).
  const underline = block.treatment === 'underline'
  const drawn = block.treatment === 'box'
  const filled = !underline && !drawn

  // Called ONCE and handed to both layers. Two calls would be two clips, and two
  // clips are the third state this construction exists to prevent.
  const clip = markerClip(progress, life)
  const wipe = markerWipe(progress)
  const pad = filled || drawn ? `0 ${MARKER_PAD_EM}em` : undefined

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        paddingTop: room,
        paddingBottom: room,
        opacity: progress,
        // An em of its own size rather than a fraction of the frame, so the
        // gesture is the same in a corner cell and in a full frame.
        transform: `translateY(${runRise(line?.size ?? 0, progress)}px)`,
        fontFamily: theme.bodyFont,
        fontSize: line?.size,
        lineHeight: line?.leading,
        color: palette.body.color,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {/* Model-written text as a React child: escaped here and nowhere else. */}
      {before}
      {marked ? (
        <span style={{ position: 'relative', display: 'inline-block', fontWeight: 700, padding: pad }}>
          {filled ? (
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                backgroundColor: palette.fill.color,
                clipPath: clip,
              }}
            />
          ) : null}

          {/*
            Positioned, and that is load-bearing rather than tidy: a positioned
            child paints above in-flow inline content whatever the DOM order, so
            the fill above would cover this run and the run would be invisible
            for the whole scene. Positioning it puts all three layers in one
            paint order, which is then the order they are written in.
            `AnimatedTitlesVideo` learned this with a texture that covered its
            own headline.
          */}
          <span style={{ position: 'relative' }}>{marked}</span>

          {filled ? (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                // The same padding as the run under it, so the two copies set
                // the same glyphs at the same places: with `left` and `right`
                // both pinned, the padding comes out of the same box and the
                // content edges coincide.
                padding: pad,
                color: palette.onFill.color,
                clipPath: clip,
              }}
            >
              {marked}
            </span>
          ) : null}

          {underline ? (
            <span
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `-${underlineDropEm(life)}em`,
                height: rule.heavy,
                backgroundColor: palette.accent.color,
                clipPath: wipe,
              }}
            />
          ) : null}

          {drawn ? (
            <span
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `-${boxPadEm(life)}em`,
                bottom: `-${boxPadEm(life)}em`,
                border: `${rule.hair}px solid ${palette.accent.color}`,
                // The project's own radius - the one corner shape this film is
                // allowed to have - bounded by the run it is drawn around. Raw
                // out of the theme it was one of the two corners in the catalogue
                // with no ceiling on it, and a stated 40 px turned a marked word
                // into a lozenge. See `markerRadius`.
                borderRadius: markerRadius(theme.radiusPx, line, marked),
                clipPath: wipe,
              }}
            />
          ) : null}
        </span>
      ) : null}
      {after}

      {marked ? null : (
        <span
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            // In the room the band already holds open below the line, so the one
            // block in this family that would otherwise hold still keeps drawing
            // without asking the layout for a pixel it did not reserve.
            bottom: Math.max(0, (room - rule.hair) / 2),
            height: rule.hair,
            backgroundColor: palette.accent.color,
            transform: `scaleX(${ruleExtent(progress, life, HIGHLIGHT_RULE_REST)})`,
            transformOrigin: 'left center',
          }}
        />
      )}
    </div>
  )
}
