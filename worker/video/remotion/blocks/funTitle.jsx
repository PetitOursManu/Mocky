/**
 * `funTitle` - a title that plays with its own letters.
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
 * SURFACE: the ground, in `palette.display` - and `palette.accent` for the one word `swap` stresses.
 *
 * LEGIBILITY: Every treatment moves letters and none of them changes what a letter is painted with. The `stack` shadow is the case worth naming: it is the ACCENT run, offset behind the display run, so the copy underneath is a colour the palette resolved rather than a tint somebody derived from the ink - a shadow mixed from the display colour would be a colour nobody measured, sitting exactly where a reader's eye is.
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
 * -- Why five looks and not one look with parameters -------------------------
 *
 * The user asked for fun titles and the obvious way to get them is Skia:
 * `@remotion/skia` draws text on a path, blurs it and fills it with a shader in
 * about ten lines. It was measured before it was refused - 461 MB of
 * node_modules against a 1.57 GB image, 443 of them being prebuilt `.a` and `.so`
 * binaries for iOS, tvOS, macOS and Android that cannot execute in this
 * container, and a peer set of React 19 with react-native and reanimated against
 * a worker on React 18. What is left is what a browser has always done: a
 * per-letter transform. It is less than Skia and it is not nothing, and the five
 * treatments are five COMPOSITIONS rather than one with an amplitude, for the
 * reason `anchor` is a zone: a number a model tunes is a rendering it described.
 */
import { funTitleAccentFrom, funTitleGlyphs, funTitleLetter, funTitleShadow, funTitleSize } from './setPiece.js'

export const FunTitle = ({ block, palette, theme, base, progress, life }) => {
  const size = funTitleSize(block.text, base)
  const glyphs = funTitleGlyphs(block.text)
  const accentFrom = block.treatment === 'swap' ? funTitleAccentFrom(block.text) : glyphs.length
  const shadow = funTitleShadow(block.treatment, size, progress)

  const letter = (glyph, index, run) => {
    const at = funTitleLetter(block.treatment, glyphs.length, index, progress, life, size)
    return (
      <span
        key={index}
        style={{
          display: 'inline-block',
          // Preserved, so the spaces between words are letters like any other and
          // a treatment does not close the gaps it was not asked to close.
          whiteSpace: 'pre',
          opacity: at.opacity,
          color: run.color,
          letterSpacing: at.tracking ? `${at.tracking}em` : undefined,
          transform: `translateY(${at.rise}px) rotate(${at.turn}deg) scale(${at.scale})`,
        }}
      >
        {/* Model-written text as a React child: escaped here and nowhere else. */}
        {glyph}
      </span>
    )
  }

  const line = (run, accentRun) =>
    glyphs.map((glyph, index) => letter(glyph, index, index >= accentFrom ? accentRun : run))

  return (
    <div
      style={{
        position: 'relative',
        fontFamily: theme.headingFont,
        fontSize: size,
        fontWeight: 800,
        lineHeight: 1.12,
        letterSpacing: '-0.015em',
        maxWidth: '100%',
      }}
    >
      {shadow ? (
        // Behind, offset, and drawn in the accent - see LEGIBILITY above. It is
        // `aria-hidden` in spirit and simply absent from the flow: a second copy
        // in the flow would double the measure and break the line.
        <div style={{ position: 'absolute', left: shadow, top: shadow, width: '100%' }}>
          {line(palette.accent, palette.accent)}
        </div>
      ) : null}
      <div style={{ position: 'relative' }}>{line(palette.display, palette.accent)}</div>
    </div>
  )
}
