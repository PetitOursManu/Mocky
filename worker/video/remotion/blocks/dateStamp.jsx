/**
 * `dateStamp` - a date, as the document writes it, at the size its box allows.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`.
 *   box       {left, top, width, height} in pixels - **this block's own box**,
 *             not its zone's. The type is solved against it.
 *   unit      the type unit of this block's STACK, in pixels. The date is one
 *             body line, so it is that unit less whatever the measure caps it to.
 *   base      the frame's short edge. Reserved for the three constant metrics
 *             `CONSTANT_METRICS` names - here, the rule and the radius.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground: `palette.body` for the date, with the rule, the box and
 * the travelling head in `palette.accent`.
 *
 * LEGIBILITY: Small running text, so 4.5:1 - `palette.body`. The box is a border
 * in the accent and never a fill, because a fill would put this run on a surface
 * the palette measured for display type instead. The head that moves is an
 * ornament and is allowed to fade; the date itself is painted at full strength
 * on every frame, since an ink that dims spends contrast the palette promised -
 * the asymmetry `groundDensity` relies on, applied to a decoration instead of to
 * a ground.
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
 * -- The type is solved, not chosen ------------------------------------------
 *
 * `DATE_SIZE` was 0.026 of the frame's short edge, so a stamp given a whole band
 * set itself at 28 px in the middle of it, and a stamp given a narrow column ran
 * out of the box. The size is now `typeScale` against this block's own box, with
 * `nowrap` - a date broken over two lines is not a date - and the furniture is
 * exactly what the box has left over. That subtraction is what `BLOCK_APPETITE`
 * budgeted 0.6 of a body line for; taking the remainder instead of re-deriving
 * that number is what keeps the block filling its box when the two disagree.
 *
 * The letter-spacing this block used to carry went with it, and the note above
 * `runBand` in `media.js` is why: the appetite table declares a plain body run
 * here, so a tracking added on top of it is a line 15% wider than the box that
 * was measured for it - a date set at 295 px in a box built for 340, with the
 * difference spent as air underneath. `kicker` is the block whose table row does
 * declare a tracking, which is the shape of the rule.
 *
 * -- Never the host's own date, and the reason is not tidiness ---------------
 *
 * Same rule as the clock: a date read off the render machine is a fact about the
 * MACHINE, and it makes two renders of one timeline differ - which the content-
 * addressed export store cannot have, since the hash is the file's identity.
 * `block.text` is a line the model wrote, bounded at thirty characters, and
 * `dateStamp.test.js` reads this file and `media.js` to check that nothing in
 * either can reach a clock at all.
 *
 * -- What moves, on a block that is one short line --------------------------
 *
 * The ornament, and only the ornament. A date stamp is a burn-in, and the thing
 * a burn-in has that a caption does not is a head running along its own rule -
 * so all three treatments carry one and it is what keeps this block from being
 * a still frame after its own arrival. `plain` has no track for it to run along,
 * so there the head IS the rule, drawing itself across the measure over the
 * scene; the other two already have a track, so the head travels along it. Both
 * are monotonic in `life`, which is what makes "somewhere else on every frame" a
 * claim a test can check.
 */
import { DATE_TRACK_ALPHA, clamp01, dateStampBox, dateStampHead, enterRise } from './media.js'

export const DateStamp = ({ block, palette, theme, box, unit, base, progress, life }) => {
  const stamp = dateStampBox(block, box, unit, base, theme.radiusPx)
  const head = dateStampHead(block.treatment, life)
  const arrival = clamp01(progress)
  return (
    <div
      style={{
        opacity: arrival,
        transform: `translateY(${enterRise(stamp.rise, progress)}px)`,
        maxWidth: '100%',
      }}
    >
      <span
        style={{
          position: 'relative',
          display: 'inline-block',
          fontFamily: theme.bodyFont,
          fontSize: stamp.size,
          lineHeight: stamp.size > 0 ? stamp.line / stamp.size : 1,
          whiteSpace: 'nowrap',
          color: palette.body.color,
          paddingTop: stamp.padY,
          paddingLeft: stamp.padX,
          paddingRight: stamp.padX,
          // Boxed spends its air above and below the line; the other two spend
          // all of it under, as the room a rule needs to read as a rule rather
          // than as an underline. Same total either way - see `dateStampBox`.
          paddingBottom: stamp.boxed ? stamp.padY : stamp.gap,
          // A border and never a fill: a filled box would put this run on the
          // accent, which the palette measured for display type and not for this.
          border: stamp.boxed ? `${stamp.rule}px solid ${palette.accent.color}` : 'none',
          borderRadius: stamp.radius,
        }}
      >
        {block.text}
        {/* The track the head runs along. `plain` has none by definition, which
            is what makes its head a rule drawing itself rather than a second
            copy of this one. */}
        {block.treatment === 'plain' ? null : (
          <span
            style={{
              position: 'absolute',
              left: stamp.boxed ? stamp.rule : 0,
              right: stamp.boxed ? stamp.rule : 0,
              bottom: stamp.boxed ? stamp.rule : 0,
              height: stamp.rule,
              backgroundColor: palette.accent.color,
              opacity: DATE_TRACK_ALPHA,
            }}
          />
        )}
        <span
          style={{
            position: 'absolute',
            left: `${head.left}%`,
            width: `${head.width}%`,
            bottom: stamp.boxed ? stamp.rule : 0,
            height: stamp.rule,
            backgroundColor: palette.accent.color,
          }}
        />
      </span>
    </div>
  )
}
