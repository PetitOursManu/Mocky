import {
  HIGHLIGHT_MEASURE_EMS,
  HIGHLIGHT_SIZE,
  boxPadEm,
  markerClip,
  markerWipe,
  ruleThickness,
  splitMark,
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
 *   base      the frame's SHORT edge in pixels. Every size here is a fraction of
 *             it, so one number reads the same in 16:9, 9:16 and 1:1.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground for the whole line (`palette.body`), and the accent FILL for whatever the marker has already covered - those glyphs take `palette.onFill`, the ink measured against the accent itself. The underline and the box are ornaments and take `palette.accent`; the run they mark stays on the ground.
 *
 * LEGIBILITY: This is the block where reading the wrong entry is invisible until it ships, and there are two ways to get it wrong. The first is the surface: text on the marker sits on `palette.fill` and not on the ground, so it takes `palette.onFill` - which is why the marker is never merely painted behind the word. See the two-layer note below. The second is the FLOOR: a marked run is running text, and running text takes 4.5:1 wherever it sits. On the ground that is `palette.body`, resolved at exactly that. On the fill, `palette.onFill` was resolved at the 3:1 display floor - the pill's floor - so the marked run is set at weight 700, which is what licences it: the audit's own rule calls bold text past 18.66 px large, and 4% of the short edge is 43 px. Take the weight off and the run keeps a floor it no longer earns. It is `palette.accent` that this block deliberately does NOT use for text: the accent is a decoration run at 3:1, and a body-size sentence in it is a run measured at the wrong bar.
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
 * The soak is also what keeps this block moving after its nine frames of arrival
 * are spent: it runs on `life` and rises for the whole scene. The underline and
 * the box get the same term as a position rather than as a mask, because a rule
 * two device pixels tall clipped by 28% of its own height is a rule nobody sees.
 */

/** Where the fill and the two ornaments sit relative to the run, in ems of the line. */
const MARKER_PAD_EM = 0.18

export const TextHighlight = ({ block, palette, theme, base, progress, life }) => {
  const [before, marked, after] = splitMark(block.text, block.mark)
  // Anything this build does not recognise is a marker, for the reason
  // `anchorName` and `blockComponent` both answer with a default: the value was
  // refused by three validators long before a frame, so reaching that branch
  // means two lists disagree - and a marked run drawn the commonest way beats a
  // marked run with nothing on it at all (Q1).
  const underline = block.treatment === 'underline'
  const box = block.treatment === 'box'
  const filled = !underline && !box

  const thickness = ruleThickness(base)
  // Called ONCE and handed to both layers. Two calls would be two clips, and two
  // clips are the third state this construction exists to prevent.
  const clip = markerClip(progress, life)
  const wipe = markerWipe(progress)
  const pad = filled || box ? `0 ${MARKER_PAD_EM}em` : undefined

  return (
    <div
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * base * 0.02}px)`,
        fontFamily: theme.bodyFont,
        fontSize: Math.round(base * HIGHLIGHT_SIZE),
        lineHeight: 1.5,
        color: palette.body.color,
        maxWidth: `min(100%, ${HIGHLIGHT_MEASURE_EMS}em)`,
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
                height: thickness * 2,
                backgroundColor: palette.accent.color,
                clipPath: wipe,
              }}
            />
          ) : null}

          {box ? (
            <span
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `-${boxPadEm(life)}em`,
                bottom: `-${boxPadEm(life)}em`,
                border: `${thickness}px solid ${palette.accent.color}`,
                // The project's own radius, integer pixels out of the theme -
                // the one corner shape this film is allowed to have.
                borderRadius: theme.radiusPx,
                clipPath: wipe,
              }}
            />
          ) : null}
        </span>
      ) : null}
      {after}
    </div>
  )
}
