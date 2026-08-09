/**
 * `logoType` - a wordmark drawn in type, with an optional mark beside it.
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
 * SURFACE: the ground: the word in `palette.display`, the mark in `palette.accent`.
 *
 * LEGIBILITY: The mark is a SHAPE filled with the accent and never a glyph - a drawn square exists in every renderer, and the square character does not exist in every face.
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
 * ── The assembly ────────────────────────────────────────────────────────────
 *
 * The letters start spread apart and close onto their own measure, each on its
 * own cue. That is the whole animation, and it is the one a wordmark can have
 * while staying typography: the alternative - a mark flying in, a shape drawing
 * itself - is a logo FILE being animated, and this block exists precisely because
 * there is no file. Nothing here is a path, an SVG or an image.
 *
 * The travel is normalised on the outermost letter (`letterShift` says why), so a
 * word of four letters and one of twenty-four both start the same distance wide -
 * a per-letter offset would put a long wordmark outside its own box on the first
 * frame, which in 9:16 is not "near the edge" but behind a feed's own interface.
 *
 * The mark arrives on the FIRST letter's cue rather than on a cue of its own: a
 * mark and its word are one object, and giving the mark its own beat makes it a
 * second element that happens to be next to a name.
 */

import { LETTER_SPAN, LOGO_SHARE, LOGO_SHIFT, LOGO_SIZE, fittedSize, letters, letterShift, revealRamp, staggerRamp, wordGlyphs } from './animatedText.js'

const MARK_SHARE = 0.62
const SLASH_WIDTH = 0.28
const MARK_START = 0.55
const GAP = 0.018

export const LogoType = ({ block, palette, theme, base, progress, life }) => {
  const ramp = revealRamp(progress, life, LOGO_SHARE)
  const size = fittedSize(block.text, base, LOGO_SIZE)
  const mark = Math.round(size * MARK_SHARE)
  const glyphs = letters(block.text)
  const first = staggerRamp(glyphs.length, 0, ramp, LETTER_SPAN)
  const travel = base * LOGO_SHIFT

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(base * GAP), maxWidth: '100%' }}>
      {block.mark !== 'none' ? (
        <span
          style={{
            flex: '0 0 auto',
            width: block.mark === 'slash' ? Math.round(mark * SLASH_WIDTH) : mark,
            height: mark,
            backgroundColor: palette.accent.color,
            borderRadius: block.mark === 'circle' ? '50%' : 0,
            opacity: first,
            // The skew is the mark's shape and the scale is its arrival; both in
            // one transform, because the second `transform` on an element wins
            // and the mark would come back upright.
            transform: `${block.mark === 'slash' ? 'skewX(-18deg) ' : ''}scale(${MARK_START + (1 - MARK_START) * first})`,
          }}
        />
      ) : null}
      <span
        style={{
          fontFamily: theme.headingFont,
          fontSize: size,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          color: palette.display.color,
          minWidth: 0,
        }}
      >
        {wordGlyphs(block.text).map((word, w) => (
          // One box per word, so a wordmark too wide for its zone breaks between
          // its words and never between two letters of one.
          <span key={w} style={{ display: 'inline-block', whiteSpace: 'pre' }}>
            {word.glyphs.map(({ glyph, index }) => {
              const at = staggerRamp(glyphs.length, index, ramp, LETTER_SPAN)
              return (
                <span
                  key={index}
                  style={{
                    display: 'inline-block',
                    whiteSpace: 'pre',
                    opacity: at,
                    transform: `translateX(${letterShift(glyphs.length, index, ramp) * travel}px)`,
                  }}
                >
                  {/* Model-written text as a React child: escaped here and nowhere else. */}
                  {glyph}
                </span>
              )
            })}
          </span>
        ))}
      </span>
    </div>
  )
}
