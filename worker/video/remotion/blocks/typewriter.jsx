/**
 * `typewriter` - a line typed out one character at a time.
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
 * SURFACE: the ground, `palette.body`. The caret is `palette.accent`.
 *
 * LEGIBILITY: Running text: 4.5:1, which is what `palette.body` carries. The caret is drawn in `palette.accent`, a decoration measured with the veil locked - and it is painted at full strength or not at all, because a caret faded to 0.4 is a colour nobody measured.
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
 * ── What this file draws, and what `animatedText.js` decides ────────────────
 *
 * The typing is arithmetic and lives next door, for the reason every quantity in
 * this feature does: "is the line finished before the cut" is a question a test
 * has to be able to ask. This file draws three things and owns none of the beat.
 *
 * The one layout decision it does own is the UNTYPED TAIL, and it is not
 * decoration. A line that grows character by character re-wraps as it goes, and
 * the block above it in the same zone moves every time the wrap changes - the
 * stack is a flex column, so the whole scene twitches while somebody reads. The
 * tail is therefore rendered, hidden, from the first frame: the box is the size
 * of the finished line before the first character lands, and nothing below it
 * ever moves.
 */

import { TYPE_SHARE, caretOn, revealRamp, typedSplit } from './animatedText.js'

/** Body copy, and the caret cut from its own size rather than from the frame. */
const SIZE = 0.038
const CARET_WIDTH = 0.075
const CARET_HEIGHT = 0.92

export const Typewriter = ({ block, palette, theme, base, progress, life }) => {
  const ramp = revealRamp(progress, life, TYPE_SHARE)
  const { typed, rest } = typedSplit(block.text, ramp)
  const size = Math.round(base * SIZE)
  return (
    <div
      style={{
        fontFamily: theme.bodyFont,
        fontSize: size,
        lineHeight: 1.4,
        color: palette.body.color,
        maxWidth: '100%',
        // `pre-wrap`, so a double space the author wrote survives being typed.
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {/* Model-written text as a React child: escaped here and nowhere else. */}
      {typed}
      {block.caret ? (
        <span
          style={{
            display: 'inline-block',
            width: Math.max(2, Math.round(size * CARET_WIDTH)),
            height: Math.round(size * CARET_HEIGHT),
            verticalAlign: '-0.1em',
            backgroundColor: palette.accent.color,
            // A block caret and not the `|` glyph: a rectangle exists in every
            // renderer, and the pipe is a different width in every face.
            // Opacity 0 rather than an unmounted element, so the line does not
            // shift by a caret's width twice a second.
            opacity: caretOn(ramp, life) ? 1 : 0,
          }}
        />
      ) : null}
      <span style={{ visibility: 'hidden' }}>{rest}</span>
    </div>
  )
}
