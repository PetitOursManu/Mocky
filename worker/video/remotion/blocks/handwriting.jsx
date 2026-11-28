/**
 * `handwriting` - a few words written by hand, stroke by stroke.
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
 * SURFACE: the ground, `palette.display` - the words are a headline's size and a
 * headline's role.
 *
 * LEGIBILITY: Display type: 3:1, which is what `palette.display` carries. The ink
 * is one colour at full strength; a pen stroke faded towards the ground would be
 * a colour nobody measured.
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
 * -- What this file draws, and what `hand.js` decides ------------------------
 *
 * The strokes, their order, the size and how far the pen has gone are all
 * arithmetic next door (`hand.js`), on the words Tegaki traced. This file draws
 * the marks it is handed as SVG lines and stamps, in the display ink, and owns
 * one decision: a line no hand can write whole is set as plain type in the
 * heading face rather than drawn with a hole, which is `texturedGround`'s rule —
 * a decoration yields to a word.
 */

import { HAND_SHARE, handLayout, handReveal, handStrokes } from './hand.js'
import { revealRamp } from './animatedText.js'
import { typeScale } from '../composition.js'

export const Handwriting = ({ block, palette, theme, box, unit, progress, life }) => {
  const strokes = handStrokes(block.text, block.hand)
  const ink = palette.display.color
  if (!strokes) {
    return (
      <div
        style={{
          width: '100%',
          fontFamily: theme.headingFont,
          fontSize: typeScale('display', block.text, box, { unit, nowrap: true }),
          lineHeight: 1.1,
          color: ink,
          whiteSpace: 'nowrap',
        }}
      >
        {/* Model-written text as a React child: escaped here and nowhere else. */}
        {block.text}
      </div>
    )
  }
  const layout = handLayout(strokes, block.text, box, unit)
  const marks = handReveal(strokes, revealRamp(progress, life, HAND_SHARE))
  const [x, y, w, h] = strokes.viewBox
  return (
    <div style={{ width: '100%', paddingTop: layout.air, lineHeight: 0 }}>
      {/* Inline, so the zone's own `textAlign` places the words across the measure. */}
      <svg
        width={layout.width}
        height={layout.height}
        viewBox={`${x} ${y} ${w} ${h}`}
        style={{ display: 'inline-block', overflow: 'visible' }}
      >
        <g fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round">
          {marks.map((m, i) =>
            m.type === 'stamp' ? (
              <ellipse
                key={i}
                cx={m.cx}
                cy={m.cy}
                rx={m.rx}
                ry={m.ry}
                transform={`rotate(${m.turn} ${m.cx} ${m.cy})`}
                fill={ink}
                stroke="none"
              />
            ) : (
              <line key={i} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} strokeWidth={m.w} />
            ),
          )}
        </g>
      </svg>
    </div>
  )
}
