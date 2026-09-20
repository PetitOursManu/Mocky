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
 * The typing AND the type size are arithmetic and live next door, for the reason
 * every quantity in this feature does: "is the line finished before the cut" and
 * "does this line fill the box it was given" are both questions a test has to be
 * able to ask. This file draws three things and owns neither the beat nor a size.
 *
 * It was the worst example of the defect this pass answers. The line was set at
 * `base * 0.038` - a fraction of the FRAME - so a typewriter alone in a scene,
 * handed the whole safe area, drew a small line of text in the middle of a black
 * frame and left the other nine tenths of its box empty. The size is now a step
 * of the stack's own scale (`title`), solved by `composedLayout` against this
 * box: the same block in a corner of a frame is small because its box is, and in
 * a scene of its own it is a paragraph across the safe area.
 *
 * The one layout decision it does own is the UNTYPED TAIL, and it is not
 * decoration. A line that grows character by character re-wraps as it goes, and
 * the block above it in the same zone moves every time the wrap changes - the
 * stack is a column of fixed boxes, but the line inside this one would still
 * jump. The tail is therefore rendered, hidden, from the first frame: the box is
 * the size of the finished line before the first character lands, and nothing
 * ever moves under it.
 */

import { TYPE_SHARE, caretOn, revealRamp, typedSplit, typewriterLayout } from './animatedText.js'

export const Typewriter = ({ block, palette, theme, box, unit, progress, life }) => {
  const layout = typewriterLayout(block, box, unit)
  const ramp = revealRamp(progress, life, TYPE_SHARE)
  const { typed, rest } = typedSplit(block.text, ramp)
  return (
    <div
      style={{
        // The block fills the measure it was given and the leftover height is
        // air, split above and below: a line that wrapped one fewer time than
        // `textLines` predicted stays centred in its box instead of sitting on
        // its top edge. The alignment across the measure is the ZONE's, inherited
        // - that is the edge the document chose by naming an anchor.
        width: '100%',
        paddingTop: layout.air,
        paddingBottom: layout.air,
        fontFamily: theme.bodyFont,
        fontSize: layout.size,
        lineHeight: layout.leading,
        color: palette.body.color,
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
            width: layout.caret.width,
            height: layout.caret.height,
            verticalAlign: '-0.1em',
            backgroundColor: palette.accent.color,
            // A block caret and not the `|` glyph: a rectangle exists in every
            // renderer, and the pipe is a different width in every face. Cut from
            // the line's own size, so it is a cursor at 130 px of type and at 34.
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
