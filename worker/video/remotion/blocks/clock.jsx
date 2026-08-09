/**
 * `clock` - a clock, and it does not tell the time.
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
 * SURFACE: the ground. The dial, the ticks and the sweep hand are
 * `palette.accent`; the two hands that carry the stated time and the digits are
 * `palette.display`; the label under them is `palette.body`.
 *
 * LEGIBILITY: The digits are display type on the ground and take the 3:1 floor
 * `palette.display` carries; the label under them is running text at 4.5:1. Two
 * entries, as everywhere. The dial is an ornament and takes the accent run,
 * which was resolved with the veil locked — an ornament does not get to darken a
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
 * -- It never reads this machine's clock -------------------------------------
 *
 * `block.time` is what the document states and there is no other source. A
 * render host in another timezone would burn its own hour into somebody's film,
 * and two renders of one timeline would then differ — which the content-
 * addressed export store cannot have, since the hash IS the identity of the
 * file. `clock.test.js` pins the angles for a stated time, so a `Date` reaching
 * this file fails a test rather than shipping.
 *
 * Absent, the hands sweep and no numerals are drawn, which is a clock as a
 * motif.
 *
 * -- The sweep hand moves on every frame, and never by a whole second --------
 *
 * A tick is what a clock does when a machine tells it the time; a sweep is what
 * it does when nothing does. This one is continuous in `life` — the second hand
 * of a mechanical movement rather than the minute hand of a station clock — and
 * `clockHands` is exported so the test can assert that no two consecutive frames
 * of the longest legal scene put it in the same place.
 *
 * The RATE is the thing this block cannot compute, and the reason is the same
 * one `carousel` runs into: `life` is the scene's clock already normalised, so
 * degrees per second is not expressible here. `real` therefore spends the
 * quarter turn a real second hand makes in the longest scene the schema allows,
 * and `fast` spends three whole turns, which is time visibly passing. The
 * document chooses between those two; neither is a lie about a second, because
 * nothing here claims to be counting them.
 */

/** 0 to 1, for a clock this file is handed rather than one it computes. */
const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0))

/**
 * How many turns the sweep hand makes over one scene.
 *
 * `fast` is the schema's default, so it is also the fallback: the case you get
 * by saying nothing has to be the one that moves, which is rule 6 of the feature
 * restated one block down.
 */
export const CLOCK_SWEEP_TURNS = { real: 0.25, fast: 3 }

/** A digital face with no stated time says so. It never fills the gap from the host. */
export const CLOCK_BLANK = '--:--'

/** The dial and the type, as fractions of the short edge. */
export const CLOCK_SIZE = 0.2
export const CLOCK_DIGITS = 0.09
export const CLOCK_LABEL = 0.024
export const CLOCK_GAP = 0.012

/** The rim, a tick and the three hands, as fractions of the short edge or of the dial. */
export const CLOCK_RIM = 0.004
export const CLOCK_TICK = 0.0025
export const CLOCK_TICK_LENGTH = 0.06
export const CLOCK_HAND = { hour: 0.3, minute: 0.42, sweep: 0.46 }
export const CLOCK_HAND_WIDTH = { hour: 0.005, minute: 0.0035, sweep: 0.002 }

/** How present the twelve ticks are beside the hands. An ornament may fade; a run may not. */
export const CLOCK_TICK_ALPHA = 0.55

/** How far the orbit of a digital face's sweep dot sits from the digits. */
export const CLOCK_ORBIT = 0.05

/**
 * Where the three hands point, in degrees clockwise from twelve.
 *
 * The two that carry the stated time are read off the document and nothing else,
 * and they ADVANCE with the sweep: a clock whose second hand turns under a
 * minute hand nailed to its mark is a clock nobody believes. One turn of the
 * sweep is one minute, so it is six degrees of minute hand and half a degree of
 * hour hand — the gearing of a real movement, which costs two multiplications.
 *
 * The split is a `split(':')` and not the schema's own regular expression: the
 * value arrived validated three times over and copying the rule here would make
 * a fourth reader of it. What this needs to know is whether the document stated
 * anything at all, which is the `null` the schema itself writes.
 */
export function clockHands(time, sweep, life) {
  const at = clamp01(life)
  const turns = Object.hasOwn(CLOCK_SWEEP_TURNS, String(sweep)) ? CLOCK_SWEEP_TURNS[sweep] : CLOCK_SWEEP_TURNS.fast
  const parts = typeof time === 'string' ? time.split(':') : []
  const hours = Number(parts[0])
  const minutes = Number(parts[1])
  const stated = parts.length === 2 && Number.isFinite(hours) && Number.isFinite(minutes)
  const swept = at * turns
  return {
    stated,
    sweep: swept * 360,
    minute: (stated ? minutes : 0) * 6 + swept * 6,
    hour: (stated ? hours % 12 : 0) * 30 + (stated ? minutes : 0) * 0.5 + swept * 0.5,
  }
}

/**
 * Every measurement of the dial, in pixels.
 *
 * Exported for the one claim worth making about it: no hand is longer than the
 * radius, so nothing pokes out of the circle it is drawn in — which is the kind
 * of thing that is obvious in a browser and invisible in an mp4 nobody
 * previewed.
 */
export function clockDial(base) {
  const edge = Math.max(0, Number(base) || 0)
  const size = Math.round(edge * CLOCK_SIZE)
  const hand = (name) => ({
    length: Math.round(size * CLOCK_HAND[name]),
    width: Math.max(1, Math.round(edge * CLOCK_HAND_WIDTH[name])),
  })
  return {
    size,
    rim: Math.max(2, Math.round(edge * CLOCK_RIM)),
    tick: Math.max(1, Math.round(edge * CLOCK_TICK)),
    tickLength: Math.round(size * CLOCK_TICK_LENGTH),
    hour: hand('hour'),
    minute: hand('minute'),
    sweep: hand('sweep'),
  }
}

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

export const Clock = ({ block, palette, theme, base, progress, life }) => {
  const dial = clockDial(base)
  const hands = clockHands(block.time, block.sweep, life)
  const arrival = clamp01(progress)
  return (
    <div
      style={{
        opacity: arrival,
        transform: `translateY(${(1 - arrival) * base * 0.02}px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: '100%',
      }}
    >
      {block.face === 'digital' ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <div
            style={{
              fontFamily: theme.headingFont,
              fontSize: Math.round(base * CLOCK_DIGITS),
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
              whole unit at a time — the two things this block exists not to
              do. */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '100%',
              width: dial.sweep.width * 3,
              height: dial.sweep.width * 3,
              marginTop: Math.round(base * CLOCK_GAP),
              borderRadius: '50%',
              backgroundColor: palette.accent.color,
              transformOrigin: `50% ${Math.round(base * CLOCK_ORBIT)}px`,
              transform: `translateX(-50%) rotate(${hands.sweep}deg)`,
            }}
          />
        </div>
      ) : (
        <div
          style={{
            position: 'relative',
            width: dial.size,
            height: dial.size,
            borderRadius: '50%',
            border: `${dial.rim}px solid ${palette.accent.color}`,
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
                width: dial.tick,
                height: dial.tickLength,
                backgroundColor: palette.accent.color,
                opacity: CLOCK_TICK_ALPHA,
                transformOrigin: `50% ${dial.size / 2}px`,
                transform: `translateX(-50%) rotate(${i * 30}deg)`,
              }}
            />
          ))}
          <Hand hand={dial.hour} angle={hands.hour} color={palette.display.color} />
          <Hand hand={dial.minute} angle={hands.minute} color={palette.display.color} />
          <Hand hand={dial.sweep} angle={hands.sweep} color={palette.accent.color} />
        </div>
      )}
      {block.label ? (
        <div
          style={{
            marginTop: Math.round(base * CLOCK_GAP * 2),
            fontFamily: theme.bodyFont,
            fontSize: Math.round(base * CLOCK_LABEL),
            letterSpacing: '0.08em',
            color: palette.body.color,
          }}
        >
          {block.label}
        </div>
      ) : null}
    </div>
  )
}
