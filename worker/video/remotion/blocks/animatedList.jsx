/**
 * `animatedList` - a short list whose items arrive one after another.
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
 *   base      the frame's short edge. Reserved for the three constant metrics -
 *             here, the thickness of the `rule` marker and nothing else.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground: items in `palette.body`, markers in `palette.accent`.
 *
 * LEGIBILITY: Each item is running text and takes 4.5:1. The markers beside them are display-sized decoration on the same ground, which is the pair `accentFirst` exists for - an accent nobody can read still falls through to something legible. A marker is painted at the accent's FULL strength on every frame it is on screen: what fades is the item arriving, never the mark, because a marker at half opacity is a grey bullet on a ground the palette never measured it against.
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
 * ── The height, and how three items spend a large box ───────────────────────
 *
 * The items were `base * 0.034` and the rows `base * 0.014` apart - two
 * fractions of the FRAME, so a list of three handed a whole safe area drew three
 * small lines against the top of it and left the rest empty. Both are gone. The
 * item size is the stack's unit at the `body` step, solved by `composedLayout`
 * against this box, so a list alone in a zone is set at whatever size makes it
 * fill the zone; the rhythm between rows is `RUN_GAP`, the same one `shapeHeight`
 * budgeted, and the leftover is air above and below rather than a rhythm that
 * grows with the box - a list that spaced itself out to fill would be a stack
 * coming apart rather than a list.
 *
 * ── The cadence, and why it is not this block's arrival ─────────────────────
 *
 * The items used to share one `progress`, which is nine frames: six items inside
 * it are fifty milliseconds apart, which is one fade with a soft edge rather than
 * a list being counted out. The cascade runs on the scene's own clock instead
 * (`staggerRamp` over `revealRamp`), and every window is cut so the LAST item
 * closes at the end of the share - which is what makes "every item has arrived
 * before the cut" arithmetic instead of a hope.
 *
 * The two markers that are not numerals are DRAWN - a rule and a disc - and never
 * a glyph. The container installs one font family, and a bullet it does not carry
 * renders as a hollow box beside every item at once; `ordinalLabel` is already in
 * the house for the same reason, on the product card's arguments.
 */

import { LIST_SHARE, listLayout, markerLabel, revealRamp, staggerRamp } from './animatedText.js'

export const AnimatedList = ({ block, palette, theme, box, unit, base, progress, life }) => {
  const ramp = revealRamp(progress, life, LIST_SHARE)
  const layout = listLayout(block, box, unit, base)
  const shape = {
    // Drawn, not typed. `borderRadius` full for the disc, and the rule keeps the
    // thickness a hairline has everywhere else in this directory - a constant
    // metric, because a mark 1 px under a small list and 4 px under a large one
    // is two design systems in one film.
    dot: { flex: '0 0 auto', width: layout.marker.dot, height: layout.marker.dot, borderRadius: '50%' },
    rule: { flex: '0 0 auto', width: layout.marker.rule.width, height: layout.marker.rule.thickness, borderRadius: 0 },
  }

  return (
    <ol
      style={{
        margin: 0,
        padding: 0,
        listStyle: 'none',
        width: '100%',
        paddingTop: layout.air,
        paddingBottom: layout.air,
      }}
    >
      {block.items.map((item, i) => {
        const at = staggerRamp(block.items.length, i, ramp)
        const label = markerLabel(block.marker, i)
        return (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              marginBottom: i === block.items.length - 1 ? 0 : layout.gap,
              opacity: at,
              // Arriving from the marker's side, so the eye is already where the
              // next item will start. One marker column, which is the distance
              // between the two things being related - and a distance off the
              // type rather than off the frame, so it stays proportional to an
              // item at every size the box can produce.
              transform: `translateX(${(1 - at) * layout.slide}px)`,
              fontFamily: theme.bodyFont,
              fontSize: layout.size,
              lineHeight: layout.leading,
              color: palette.body.color,
            }}
          >
            <span
              style={{
                flex: '0 0 auto',
                width: layout.column,
                height: layout.line,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                color: palette.accent.color,
                fontSize: layout.marker.size,
                fontWeight: 700,
                // Tabular figures, or `01` and `06` are two different widths and
                // the items they belong to no longer line up.
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {/* `Object.hasOwn` and not a plain lookup, the discipline
                  `blockComponent` states: a lookup answers for the prototype
                  chain, so `marker: "constructor"` would spread a function into
                  a style object and paint an empty box. */}
              {label ?? (
                <span
                  style={{
                    ...(Object.hasOwn(shape, block.marker) ? shape[block.marker] : shape.dot),
                    backgroundColor: palette.accent.color,
                  }}
                />
              )}
            </span>
            {/*
              The item takes the rest of the measure, which is exactly the measure
              `listLayout` wrapped it against. Left-aligned whatever the zone's
              own alignment says: a list is a column of items hanging off one mark
              column, and a ragged left edge under a row of marks is not a list.

              Model-written text as a React child: escaped here and nowhere else.
            */}
            <span style={{ flex: '1 1 auto', minWidth: 0, textAlign: 'left', wordBreak: 'break-word' }}>{item}</span>
          </li>
        )
      })}
    </ol>
  )
}
