/**
 * `separator` - a rule across the measure, drawing itself for the whole scene.
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
 * SURFACE: the ground, in `palette.accent`.
 *
 * LEGIBILITY: No text. It is the plainest decoration in the catalogue and it still reads the accent run rather than a colour of its own, because an accent nobody can read is an invisible rule and the palette already knows that. The accent was resolved with the veil LOCKED, which is the same statement from the other end: darkening a photograph so a two-pixel rule can keep its colour is a trade an ornament does not get to make.
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
 * WHAT MOVES, and it is not only the entrance. The rule draws out from the left
 * on `progress` and then keeps drawing, spending the last 4% of its measure
 * across `life` - see `RULE_DRAWN_AT_ARRIVAL`. A separator whose only motion was
 * its arrival would be drawn in nine frames and frozen for the four hundred
 * after them, which is the still frame with a better first second that
 * `DEFAULT_KEN_BURNS` exists to refuse.
 *
 * The three treatments are three LOOKS and not one plus its garnish: a rule, two
 * rules, or a dotted band. The stub drew the dots underneath a solid stroke,
 * which made `dots` mean `rule` and something, and left the enum with two entries
 * that differed by an ornament instead of three a document chooses between.
 */
import { separatorGeometry } from './misc.js'

export const Separator = ({ block, palette, base, progress, life }) => {
  const rule = separatorGeometry(block, base, progress, life)
  const stroke = { height: rule.thickness, backgroundColor: palette.accent.color }

  return (
    <div
      style={{
        width: `${rule.width * 100}%`,
        // Clipped rather than scaled, and the reason is in `separatorGeometry`:
        // a `scaleX` squashes what it reveals, so the dotted treatment arrived as
        // a row of ellipses that grew round as the rule finished. `inset()` reads
        // top / right / bottom / left, so a shrinking RIGHT inset uncovers the
        // box from its left edge - the same reading `entranceStyle` gives a wipe,
        // one level up.
        clipPath: `inset(0 ${(1 - rule.reveal) * 100}% 0 0)`,
      }}
    >
      {rule.treatment === 'dots' ? (
        <div
          style={{
            height: rule.dotHeight,
            // A repeated radial gradient rather than a row of elements: a dotted
            // rule across a full-width zone is sixty divs React reconciles on
            // every one of the 3600 frames a film can hold.
            backgroundImage: `radial-gradient(${palette.accent.color} 40%, transparent 40%)`,
            backgroundSize: `${rule.dotPitch}px ${rule.dotHeight}px`,
          }}
        />
      ) : (
        <>
          <div style={stroke} />
          {rule.treatment === 'double' ? <div style={{ ...stroke, marginTop: rule.gap }} /> : null}
        </>
      )}
    </div>
  )
}
