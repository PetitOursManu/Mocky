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
 * ── The letters assemble at the size of the box ─────────────────────────────
 *
 * The word was `LOGO_SIZE`, a ramp from 0.062 of the frame's short edge down to
 * 0.034 - a wordmark tuned so that the longest legal one fits, which sets every
 * short one at the size a long one needed and puts a four-letter name in the
 * middle of an empty frame. The box does that arithmetic now: the size is the
 * `title` step of the unit `composedLayout` solved for this stack, capped by what
 * the measure can carry, so the same wordmark is a corner mark in a corner and a
 * poster when it is given the frame.
 *
 * The mark and the travel are in that cap, and both had to be: `shapeCeiling`
 * measures the WORD, and a square beside it plus the room its letters need to
 * start apart in are two claims on the same measure. `logoLayout` reserves them
 * - it is the one size in this family solved from its own arithmetic, and it errs
 * small, because a wordmark a hair under its budget is invisible and one a hair
 * over is a letter outside the safe area.
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

import {
  LETTER_SPAN,
  LOGO_SHARE,
  MARK_ENTER_SCALE,
  letters,
  letterShift,
  logoLayout,
  revealRamp,
  staggerRamp,
  wordGlyphs,
} from './animatedText.js'

export const LogoType = ({ block, palette, theme, box, unit, progress, life }) => {
  const ramp = revealRamp(progress, life, LOGO_SHARE)
  const layout = logoLayout(block, box, unit)
  const glyphs = letters(block.text)
  const first = staggerRamp(glyphs.length, 0, ramp, LETTER_SPAN)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: layout.mark.gap,
        // A row of two objects rather than a run of text, so it is the WRAPPER's
        // `alignItems` - the zone's own alignment, the edge the document chose by
        // naming an anchor - that places it, and not an inherited `text-align`
        // that a flex row would ignore.
        maxWidth: '100%',
        paddingTop: layout.air,
        paddingBottom: layout.air,
      }}
    >
      {block.mark !== 'none' ? (
        <span
          style={{
            flex: '0 0 auto',
            width: layout.mark.width,
            height: layout.mark.height,
            backgroundColor: palette.accent.color,
            borderRadius: block.mark === 'circle' ? '50%' : 0,
            opacity: first,
            // The skew is the mark's shape and the scale is its arrival; both in
            // one transform, because the second `transform` on an element wins
            // and the mark would come back upright.
            transform: `${block.mark === 'slash' ? 'skewX(-18deg) ' : ''}scale(${MARK_ENTER_SCALE + (1 - MARK_ENTER_SCALE) * first})`,
          }}
        />
      ) : null}
      <span
        style={{
          fontFamily: theme.headingFont,
          fontSize: layout.size,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: layout.leading,
          color: palette.display.color,
          minWidth: 0,
        }}
      >
        {wordGlyphs(block.text).map((word, w) => (
          // One box per word, so a wordmark too wide for its zone breaks between
          // its words and never between two letters of one. The size was solved
          // so that it does not have to, which makes this a guard rather than a
          // layout: `BLOCK_APPETITE` budgets one line for a wordmark.
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
                    transform: `translateX(${letterShift(glyphs.length, index, ramp) * layout.travel}px)`,
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
