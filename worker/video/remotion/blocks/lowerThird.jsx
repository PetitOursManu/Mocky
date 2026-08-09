/**
 * `lowerThird` - the broadcast lower third: a name, a role, and a rule down its leading edge.
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
 * SURFACE: a PANEL: the block sits on `palette.panel`, its title takes `palette.panelDisplay`, its subtitle `palette.panelBody`, and the rule `palette.panelAccent`.
 *
 * LEGIBILITY: The panel is opaque, which is the whole reason this device works over anything: a band letting the ground through would be a run measured against a surface that changes with whatever background the scene carries.
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
 * -- It arrives sideways, and it leaves the same way -------------------------
 *
 * The block is a wipe from its own edge and never a fade, because a band that
 * appears is a caption and a band that arrives is a device. `bandWidth` is that
 * one number in both directions: the wipe in, driven by the house arrival, and
 * the roll back out at the end of the scene, driven by the block's own clock. One
 * quantity rather than two states - a composition reading one number cannot hold
 * a band open while its exit is running, which two booleans absolutely can.
 *
 * **The type rises from behind the band, and it starts inside the wipe.** The
 * band has to exist before anything can be revealed from behind it, so
 * `BAND_TEXT_FROM` is a window on the SAME arrival rather than a second cue -
 * `OverlayBandVideo` settled this once and this is that treatment inside a block.
 * A title that rose with the wipe would be a title travelling across the frame in
 * the open, which is the fade this device exists instead of.
 *
 * **The rule leads.** It is at the leading edge, so the wipe reveals it first and
 * the band unrolls from it: an accent stripe that arrived with everything else
 * would be an ornament rather than the thing the band comes out of.
 *
 * This is also the intro and the outro the catalogue is asked for. That is the
 * reason it leaves later than a notification does - `BAND_LEAVES_AT` - since an
 * outro that has gone with a third of its scene left is a scene ending on
 * nothing.
 */

import {
  BAND_SUBTITLE_FROM,
  bandReveal,
  bandWidth,
  controlClock,
  restOffset,
} from './interface.js'

/** A run of type, revealed from behind the band rather than faded onto it. */
const Revealed = ({ reveal, children, style }) => (
  <div style={{ overflow: 'hidden' }}>
    <div style={{ ...style, transform: `translateY(${(1 - reveal) * 100}%)` }}>{children}</div>
  </div>
)

export const LowerThird = ({ block, palette, theme, base, progress, life }) => {
  const fromLeft = block.side === 'left'
  const clock = controlClock(progress, life)
  const open = bandWidth(progress, clock)
  // Positive is INWARD, whichever edge the band came from: the settle approaches
  // the mark `composedLayout` gave it and never passes it, which is what keeps a
  // full-measure band off the safe margin on every frame rather than on most of
  // them.
  const settle = restOffset(clock) * base * (fromLeft ? 1 : -1)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: fromLeft ? 'row' : 'row-reverse',
        alignItems: 'stretch',
        // Wiped in from its own edge rather than faded, and wiped back out to it:
        // a band that appears is a caption, a band that arrives is a device.
        clipPath: fromLeft ? `inset(0 ${(1 - open) * 100}% 0 0)` : `inset(0 0 0 ${(1 - open) * 100}%)`,
        transform: `translateX(${settle}px)`,
        backgroundColor: palette.panel.color,
        maxWidth: '100%',
      }}
    >
      <div style={{ width: Math.max(3, Math.round(base * 0.005)), backgroundColor: palette.panelAccent.color }} />
      <div style={{ padding: `${Math.round(base * 0.02)}px ${Math.round(base * 0.03)}px`, minWidth: 0 }}>
        <Revealed
          reveal={bandReveal(progress)}
          style={{
            fontFamily: theme.headingFont,
            fontSize: Math.round(base * 0.042),
            fontWeight: 800,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            color: palette.panelDisplay.color,
          }}
        >
          {block.title}
        </Revealed>
        {block.subtitle ? (
          <Revealed
            reveal={bandReveal(progress, BAND_SUBTITLE_FROM)}
            style={{
              marginTop: Math.round(base * 0.008),
              fontFamily: theme.bodyFont,
              fontSize: Math.round(base * 0.026),
              lineHeight: 1.3,
              color: palette.panelBody.color,
            }}
          >
            {block.subtitle}
          </Revealed>
        ) : null}
      </div>
    </div>
  )
}
