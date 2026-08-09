/**
 * `notification` - a system notice arriving.
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
 * SURFACE: a PANEL: `palette.panel`, `palette.panelDisplay`, `palette.panelBody`, and the mark in `palette.panelAccent`.
 *
 * LEGIBILITY: `mark` is a SHAPE and not a tone, and that is a legibility decision rather than a stylistic one: a `success` tone would have to become green, green is not a token any direction states, and a colour nobody declared is a colour nobody measured.
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
 * -- Three beats, and the middle one is the hard one -------------------------
 *
 * It enters, it holds, it leaves. What separates a notification from a panel with
 * a sentence on it is the third beat: a notice that is still on screen fifteen
 * seconds later has become part of the layout, and nothing about it was ever
 * urgent. So `noticeExit` sends it back out the way it came, and it closes BEFORE
 * the cut rather than on it - a card that leaves on the last frame has not left,
 * it has been cut away from.
 *
 * The entrance is not written here at all: it is `progress`, the house arrival
 * every block in the catalogue shares. What this file adds to it is a DIRECTION,
 * read off the zone the document named - `noticeSlide` derives it from
 * `anchorCell` rather than from a second table, because a card sliding out of the
 * frame's left edge while sitting against its right is exactly the disagreement
 * two tables produce.
 *
 * The hold is the beat that had to be found something to do, and the mark is what
 * does it. A dot breathes, a bell swings, a tick draws itself as the card
 * arrives; all three read one signed number out of `markSwing`, so the family has
 * one pulse and not three. `mark: 'none'` is the case that proves the rest of the
 * block still moves - the card is settling onto its mark for the whole scene, and
 * `restOffset` is where that half-percent lives.
 */

import { controlClock, markSwing, noticeExit, noticeSlide, NOTICE_TRAVEL, restOffset } from './interface.js'

/** How much of itself a dot gains and loses on the pulse, and how far a bell swings, in degrees. */
const DOT_SWING = 0.16
const BELL_TILT = 9

/**
 * The tick's own length in the 24-unit box below, rounded up.
 *
 * It is drawn by walking a dash the length of the path off the end of it, which
 * needs a number: 5,13 to 10,18 to 19,7 measures 21.3 units. Rounded UP, because
 * a dash shorter than the path leaves the last pixels of the stroke permanently
 * undrawn, and a tick missing its point is not a tick.
 */
const TICK_LENGTH = 22

const Mark = ({ kind, color, size, progress, swing }) => {
  const scale = 1 + DOT_SWING * swing

  if (kind === 'check') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{ flex: '0 0 auto', overflow: 'visible', transform: `scale(${scale})` }}
      >
        <polyline
          points="5 13 10 18 19 7"
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={TICK_LENGTH}
          // Drawn by the card's own arrival rather than by a beat of its own: the
          // tick IS the notice appearing, and a stroke that completed after the
          // card had settled would read as a second event.
          strokeDashoffset={TICK_LENGTH * (1 - progress)}
        />
      </svg>
    )
  }

  if (kind === 'bell') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{
          flex: '0 0 auto',
          overflow: 'visible',
          // Pivoted where a bell hangs, not at its middle: rotated about its
          // centre it wobbles, rotated about its crown it rings.
          transformOrigin: '50% 15%',
          transform: `rotate(${BELL_TILT * swing}deg)`,
        }}
      >
        <path
          d="M12 3.2c-2.9 0-5.2 2.3-5.2 5.2v3.1l-1.9 3.2h14.2l-1.9-3.2V8.4c0-2.9-2.3-5.2-5.2-5.2z"
          fill={color}
        />
        <path d="M9.9 16.7c.3 1.3 1.1 2.1 2.1 2.1s1.8-.8 2.1-2.1z" fill={color} />
      </svg>
    )
  }

  return (
    <span
      style={{
        flex: '0 0 auto',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        transform: `scale(${scale})`,
      }}
    />
  )
}

export const Notification = ({ block, palette, theme, base, progress, life }) => {
  const clock = controlClock(progress, life)
  const exit = noticeExit(clock)
  const slide = noticeSlide(block.anchor)
  // One distance for both ends of the card's life: how far it still is from its
  // mark on the way in, and how far past it on the way out. The two are the same
  // travel in the same direction, which is what makes it leave the way it came.
  const away = base * NOTICE_TRAVEL * (1 - progress + exit)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: Math.round(base * 0.018),
        opacity: progress * (1 - exit),
        transform: `translate(${slide.x * away}px, ${slide.y * away}px) scale(${1 - restOffset(clock)})`,
        padding: Math.round(base * 0.024),
        borderRadius: theme.radiusPx,
        backgroundColor: palette.panel.color,
        // The narrower of a card's own measure and the zone it was given. A fixed
        // 56% of the short edge is right in a zone that has the frame to itself
        // and is twice the width of a three-column portrait cell, where it would
        // be a card hanging over the safe margin.
        maxWidth: `min(${Math.round(base * 0.56)}px, 100%)`,
      }}
    >
      {/* Tested here rather than inside `Mark`, so a notice that asked for no
          mark does not pay for the flex gap of the one it does not have. */}
      {block.mark !== 'none' ? (
        <div style={{ flex: '0 0 auto', marginTop: Math.round(base * 0.004) }}>
          <Mark
            kind={block.mark}
            color={palette.panelAccent.color}
            size={Math.round(base * 0.028)}
            progress={progress}
            swing={markSwing(life)}
          />
        </div>
      ) : null}
      <div>
        <div
          style={{
            fontFamily: theme.headingFont,
            fontSize: Math.round(base * 0.03),
            fontWeight: 700,
            color: palette.panelDisplay.color,
          }}
        >
          {block.title}
        </div>
        {block.body ? (
          <div
            style={{
              marginTop: Math.round(base * 0.008),
              fontFamily: theme.bodyFont,
              fontSize: Math.round(base * 0.025),
              lineHeight: 1.35,
              color: palette.panelBody.color,
            }}
          >
            {block.body}
          </div>
        ) : null}
      </div>
    </div>
  )
}
