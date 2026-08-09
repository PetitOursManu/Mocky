/**
 * `dateStamp` - a date, as the document writes it.
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
 * SURFACE: the ground: `palette.body` for the date, with the rule, the box and
 * the travelling head in `palette.accent`.
 *
 * LEGIBILITY: Small running text, so 4.5:1 - `palette.body`. The box is a border
 * in the accent and never a fill, because a fill would put this run on a surface
 * the palette measured for display type instead. The head that moves is an
 * ornament and is allowed to fade; the date itself is painted at full strength
 * on every frame, since an ink that dims spends contrast the palette promised —
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
 * -- Never the host's own date, and the reason is not tidiness ---------------
 *
 * Same rule as the clock: a date read off the render machine is a fact about the
 * MACHINE, and it makes two renders of one timeline differ — which the content-
 * addressed export store cannot have, since the hash is the file's identity.
 * `block.text` is a line the model wrote, bounded at thirty characters, and
 * `dateStamp.test.js` reads this file to check that nothing in it can reach a
 * clock at all.
 *
 * -- What moves, on a block that is one short line --------------------------
 *
 * The ornament, and only the ornament. A date stamp is a burn-in, and the thing
 * a burn-in has that a caption does not is a head running along its own rule —
 * so all three treatments carry one and it is what keeps this block from being
 * a still frame after its own arrival. `plain` has no track for it to run along,
 * so there the head IS the rule, drawing itself across the measure over the
 * scene; the other two already have a track, so the head travels along it. Both
 * are monotonic in `life`, which is what makes "somewhere else on every frame" a
 * claim a test can check.
 */

/** 0 to 1, for a clock this file is handed rather than one it computes. */
const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0))

/** The type: `KICKER_SIZE`'s own 0.026, because a date stamp is a surtitle that happens to be a date. */
export const DATE_SIZE = 0.026
export const DATE_TRACKING = '0.08em'

/** The rule, the box's padding and the gap over the rule, as fractions of the short edge. */
export const DATE_RULE = 0.0025
export const DATE_PAD_Y = 0.008
export const DATE_PAD_X = 0.014
export const DATE_GAP = 0.008

/** How far the block rises as it arrives, as a fraction of the short edge. */
export const DATE_RISE = 0.02

/** How present the track is under the head. An ornament may fade; a run may not. */
export const DATE_TRACK_ALPHA = 0.35

/** How much of the measure the travelling head covers, in percent. */
export const DATE_HEAD_PERCENT = 24

/**
 * Where the accent head sits at a given point of the scene, in percent of the
 * measure.
 *
 * `plain` has no track, so its head grows from nothing to the whole measure: the
 * rule draws itself, which is a treatment that starts bare and ends underlined
 * rather than a second `rule`. The other two have a track already, so the head
 * is a fixed length travelling along it.
 *
 * Both are linear and monotonic in `life`, deliberately. A head that eased would
 * be a twenty-fifth notion of how things move, and one that oscillated would
 * hold still for a frame at each turning point — which is the single frame the
 * rule about immobility is about.
 */
export function dateStampHead(treatment, life) {
  const at = clamp01(life)
  if (treatment === 'plain') return { left: 0, width: 100 * at }
  return { left: at * (100 - DATE_HEAD_PERCENT), width: DATE_HEAD_PERCENT }
}

export const DateStamp = ({ block, palette, theme, base, progress, life }) => {
  const head = dateStampHead(block.treatment, life)
  const arrival = clamp01(progress)
  const rule = Math.max(1, Math.round(base * DATE_RULE))
  const boxed = block.treatment === 'boxed'
  return (
    <div
      style={{
        opacity: arrival,
        transform: `translateY(${(1 - arrival) * base * DATE_RISE}px)`,
        maxWidth: '100%',
      }}
    >
      <span
        style={{
          position: 'relative',
          display: 'inline-block',
          fontFamily: theme.bodyFont,
          fontSize: Math.round(base * DATE_SIZE),
          letterSpacing: DATE_TRACKING,
          color: palette.body.color,
          padding: boxed ? `${Math.round(base * DATE_PAD_Y)}px ${Math.round(base * DATE_PAD_X)}px` : 0,
          paddingBottom: boxed ? Math.round(base * DATE_PAD_Y) : Math.round(base * DATE_GAP),
          // A border and never a fill: a filled box would put this run on the
          // accent, which the palette measured for display type and not for this.
          border: boxed ? `${rule}px solid ${palette.accent.color}` : 'none',
          borderRadius: boxed ? theme.radiusPx : 0,
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
              left: boxed ? rule : 0,
              right: boxed ? rule : 0,
              bottom: boxed ? rule : 0,
              height: rule,
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
            bottom: boxed ? rule : 0,
            height: rule,
            backgroundColor: palette.accent.color,
          }}
        />
      </span>
    </div>
  )
}
