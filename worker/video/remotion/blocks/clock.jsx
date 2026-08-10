/**
 * `clock` - a clock that takes the whole box, and does not tell the time.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`.
 *   box       {left, top, width, height} in pixels - **this block's own box**,
 *             not its zone's. The dial is the largest circle that fits it.
 *   unit      the type unit of this block's STACK, in pixels. The label is the
 *             block's one run, so it is the only thing set at that unit.
 *   base      the frame's short edge. Reserved for the three constant metrics
 *             `CONSTANT_METRICS` names - here, the hairline under a digital face.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground. The dial, the ticks and the sweep hand are
 * `palette.accent`; the two hands that carry the stated time and the digits are
 * `palette.display`; the label under them is `palette.body`.
 *
 * LEGIBILITY: The digits are display type on the ground and take the 3:1 floor
 * `palette.display` carries; the label under them is running text at 4.5:1. Two
 * entries, as everywhere. The dial is an ornament and takes the accent run,
 * which was resolved with the veil locked - an ornament does not get to darken a
 * photograph so that it can keep its colour.
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
 * -- The dial takes the box --------------------------------------------------
 *
 * `CLOCK_SIZE` was 0.2 of the frame's short edge, so a clock anchored `full` and
 * a clock stacked three deep in a corner drew the same 216 px dial - one of them
 * a fifth of the picture, the other spilling out of its column. The dial is now
 * the largest circle that fits what the box has left once the label has been
 * measured, and every part of it - the rim, the ticks, the three hands - is a
 * share of that circle rather than of the frame. A rim of four pixels under a
 * 950 px dial is not a rim.
 *
 * -- It never reads this machine's clock -------------------------------------
 *
 * `block.time` is what the document states and there is no other source. A
 * render host in another timezone would burn its own hour into somebody's film,
 * and two renders of one timeline would then differ - which the content-
 * addressed export store cannot have, since the hash IS the identity of the
 * file. `clock.test.js` pins the angles for a stated time and reads both this
 * file and `media.js`, so a `Date` reaching either fails a test rather than
 * shipping.
 *
 * Absent, the hands sweep and no numerals are drawn, which is a clock as a
 * motif.
 *
 * -- The sweep hand moves on every frame, and never by a whole second --------
 *
 * A tick is what a clock does when a machine tells it the time; a sweep is what
 * it does when nothing does. This one is continuous in `life` - the second hand
 * of a mechanical movement rather than the minute hand of a station clock - and
 * `clockHands` is exported so the test can assert that no two consecutive frames
 * of the longest legal scene put it in the same place.
 */
import { CLOCK_BLANK, CLOCK_TICK_ALPHA, clamp01, clockFace, clockHands, enterRise } from './media.js'

/** One hand, pinned at the dial's centre and rotated about it. */
const Hand = ({ hand, angle, color }) => (
  <div
    style={{
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: hand.width,
      height: hand.length,
      backgroundColor: color,
      borderRadius: hand.width,
      transformOrigin: 'bottom center',
      transform: `translate(-50%, -100%) rotate(${angle}deg)`,
    }}
  />
)

export const Clock = ({ block, palette, theme, box, unit, base, progress, life }) => {
  const face = clockFace(block, box, unit, base)
  const hands = clockHands(block.time, block.sweep, life)
  const arrival = clamp01(progress)
  return (
    <div
      style={{
        opacity: arrival,
        transform: `translateY(${enterRise(face.rise, progress)}px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        // The box's HEIGHT, and all of it: the face below is sized against
        // `face.room`, which is this height less the band the label needed. The
        // width is deliberately not claimed — a dial is round, so it can only
        // ever fill the minor axis, and leaving the width to the content is what
        // lets the zone's own alignment decide which edge a corner-anchored clock
        // sits on. A `width: 100%` here would centre every clock in the film.
        height: '100%',
      }}
    >
      {block.face === 'digital' ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <div
            style={{
              fontFamily: theme.headingFont,
              fontSize: face.digits,
              fontWeight: 800,
              lineHeight: 1,
              // Tabular figures, so the digits do not shift sideways as the
              // hands advance under them: a clock whose colon moves is a clock
              // that reads as a bug.
              fontVariantNumeric: 'tabular-nums',
              color: palette.display.color,
            }}
          >
            {hands.stated ? block.time : CLOCK_BLANK}
          </div>
          {/* The one moving part of a digital face: a dot on a circular orbit,
              carrying the same sweep the dial's third hand does. A digit that
              counted seconds would be a number nobody stated, arriving one
              whole unit at a time - the two things this block exists not to
              do. */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '100%',
              width: face.dot,
              height: face.dot,
              marginTop: face.rule,
              borderRadius: '50%',
              backgroundColor: palette.accent.color,
              transformOrigin: `50% ${face.orbit}px`,
              transform: `translateX(-50%) rotate(${hands.sweep}deg)`,
            }}
          />
        </div>
      ) : (
        <div
          style={{
            position: 'relative',
            width: face.size,
            height: face.size,
            borderRadius: '50%',
            border: `${face.rim}px solid ${palette.accent.color}`,
            boxSizing: 'border-box',
          }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: '50%',
                top: 0,
                width: face.tick,
                height: face.tickLength,
                backgroundColor: palette.accent.color,
                opacity: CLOCK_TICK_ALPHA,
                transformOrigin: `50% ${face.size / 2}px`,
                transform: `translateX(-50%) rotate(${i * 30}deg)`,
              }}
            />
          ))}
          <Hand hand={face.hour} angle={hands.hour} color={palette.display.color} />
          <Hand hand={face.minute} angle={hands.minute} color={palette.display.color} />
          <Hand hand={face.sweep} angle={hands.sweep} color={palette.accent.color} />
        </div>
      )}
      {block.label ? (
        <div
          style={{
            marginTop: face.label.gap,
            fontFamily: theme.bodyFont,
            fontSize: face.label.size,
            // The house's own break, and the one `textLines` assumes: the estimate packs
            // characters against the measure, so a run that will only break between words
            // puts more type on a line than the layout reserved room for. An export shipped
            // `photographie` reading `photograph`, clipped by the mask its type rises from.
            wordBreak: 'break-word',
            // No tracking: `BLOCK_APPETITE` declares a plain caption run here,
            // and a letter-spacing the layout did not measure is a label that
            // wraps onto a line the dial had to pay for. See `runBand`.
            color: palette.body.color,
          }}
        >
          {block.label}
        </div>
      ) : null}
    </div>
  )
}
