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
 *   base      the frame's SHORT edge in pixels. Every size here is a fraction of
 *             it, so one number reads the same in 16:9, 9:16 and 1:1.
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

import { LIST_SHARE, markerLabel, revealRamp, staggerRamp } from './animatedText.js'

const SIZE = 0.034
const ROW_GAP = 0.014
/** The marker column: wide enough for `01`, so the items align whatever the mark. */
const MARKER_COLUMN = 1.7
const MARKER_SIZE = 0.72
const DOT = 0.3
const RULE_LENGTH = 0.62
const RULE_WEIGHT = 0.09
const SLIDE = 0.018

export const AnimatedList = ({ block, palette, theme, base, progress, life }) => {
  const ramp = revealRamp(progress, life, LIST_SHARE)
  const size = Math.round(base * SIZE)
  const line = Math.round(size * 1.35)
  const shape = {
    // Drawn, not typed. `borderRadius` full for the disc, and the rule keeps the
    // weight a hairline has everywhere else in this directory.
    dot: { width: Math.round(size * DOT), height: Math.round(size * DOT), borderRadius: '50%' },
    rule: { width: Math.round(size * RULE_LENGTH), height: Math.max(2, Math.round(size * RULE_WEIGHT)), borderRadius: 0 },
  }

  return (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none', maxWidth: '100%', width: '100%' }}>
      {block.items.map((item, i) => {
        const at = staggerRamp(block.items.length, i, ramp)
        const label = markerLabel(block.marker, i)
        return (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              marginBottom: i === block.items.length - 1 ? 0 : Math.round(base * ROW_GAP),
              opacity: at,
              // Arriving from the marker's side, so the eye is already where the
              // next item will start. A fraction of the short edge, like every
              // other distance here.
              transform: `translateX(${(1 - at) * base * SLIDE}px)`,
              fontFamily: theme.bodyFont,
              fontSize: size,
              lineHeight: 1.35,
              color: palette.body.color,
            }}
          >
            <span
              style={{
                flex: '0 0 auto',
                width: Math.round(size * MARKER_COLUMN),
                height: line,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                color: palette.accent.color,
                fontSize: Math.round(size * MARKER_SIZE),
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
            {/* Model-written text as a React child: escaped here and nowhere else. */}
            <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{item}</span>
          </li>
        )
      })}
    </ol>
  )
}
