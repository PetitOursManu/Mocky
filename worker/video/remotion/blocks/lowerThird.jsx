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
 *   box       **the box THIS block was given**, in pixels. Every size drawn here
 *             comes off it - see the rule at the top of `composition.js`, and
 *             `blockExtent`, which is what a block owes the box it is handed.
 *   unit      the type unit its STACK agreed on, so two blocks in one zone are
 *             two steps of one scale rather than two fractions of a frame.
 *   base      the frame's short edge. Reserved for the three constant metrics
 *             named in `CONSTANT_METRICS` - here, the band's own edge.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: a PANEL: the block sits on `palette.panel`, its title takes `palette.panelDisplay`, its subtitle `palette.panelBody`, and the rule `palette.panelAccent`.
 *
 * LEGIBILITY: The panel is opaque, which is the whole reason this device works over anything: a band letting the ground through would be a run measured against a surface that changes with whatever background the scene carries. Being opaque is not the same as being visible, though - `panelEdge` measures the band against the ground and gives it a rule when the two cannot be told apart.
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
 * -- The band is as tall as its box, and as wide as its name ------------------
 *
 * Both halves of that are the rule at the top of `composition.js`, and the first
 * one is what was wrong: the type was `base * 0.042` and the padding
 * `base * 0.02`, so a band given the bottom third of a frame drew a 100 px
 * stripe inside a 300 px allotment and the scene was a small element floating in
 * a large void. It is now the box, whole, with the type solved against the room
 * its padding leaves - `bandGeometry`.
 *
 * The width is the type's, and that is `bandInset`'s lesson rather than an
 * oversight: a band that runs the full measure and touches three sides is a
 * lower third from a news bulletin, with two thirds of it empty behind a
 * four-word title. In a box solved against a stack the two usually coincide,
 * because the unit grows until the title wraps and a wrapped title has used the
 * whole measure by definition. What is gone is the arbitrary fraction, not the
 * measure.
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
 * would be an ornament rather than the thing the band comes out of. It is the one
 * piece of furniture in this family that scales with its box instead of being a
 * constant metric - see `BAND_RULE` for why an edge is not a hairline.
 *
 * This is also the intro and the outro the catalogue is asked for. That is the
 * reason it leaves later than a notification does - `BAND_LEAVES_AT` - since an
 * outro that has gone with a third of its scene left is a scene ending on
 * nothing.
 */

import {
  BAND_SUBTITLE_FROM,
  bandGeometry,
  bandReveal,
  bandWidth,
  controlClock,
  panelEdge,
  panelInks,
  restOffset,
} from './interface.js'

/** A run of type, revealed from behind the band rather than faded onto it. */
const Revealed = ({ reveal, children, style }) => (
  <div style={{ overflow: 'hidden' }}>
    <div style={{ ...style, transform: `translateY(${(1 - reveal) * 100}%)` }}>{children}</div>
  </div>
)

export const LowerThird = ({ block, palette, theme, box, unit, base, progress, life }) => {
  const fromLeft = block.side === 'left'
  const clock = controlClock(progress, life)
  const open = bandWidth(progress, clock)
  const band = bandGeometry(block, box, base, unit)
  const edge = panelEdge(palette.panel, palette.ground, panelInks(palette))
  // Positive is INWARD, whichever edge the band came from: the settle approaches
  // the mark `composedLayout` gave it and never passes it, which is what keeps a
  // full-measure band off the safe margin on every frame rather than on most of
  // them. A share of the band's own width, for the reason the notice's travel is
  // a share of its own box: an amplitude belongs to the thing that moves.
  const settle = restOffset(clock) * band.width * (fromLeft ? 1 : -1)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: fromLeft ? 'row' : 'row-reverse',
        alignItems: 'stretch',
        // The box's own height, whole; the width its type runs, capped by the
        // box. See `bandGeometry`, and the header for why those are not the same
        // sentence.
        width: band.width,
        height: band.height,
        maxWidth: '100%',
        boxSizing: 'border-box',
        // Wiped in from its own edge rather than faded, and wiped back out to it:
        // a band that appears is a caption, a band that arrives is a device.
        clipPath: fromLeft ? `inset(0 ${(1 - open) * 100}% 0 0)` : `inset(0 0 0 ${(1 - open) * 100}%)`,
        transform: `translateX(${settle}px)`,
        backgroundColor: palette.panel.color,
        // A band the same value as the ground behind it is a caption that lost
        // its block: opaque and invisible at once. Measured, and drawn as a rule
        // rather than as a shadow — the house has no shadows.
        ...(edge ? { border: `${band.border}px solid ${edge.color}` } : null),
      }}
    >
      <div style={{ flex: '0 0 auto', width: band.rule, backgroundColor: palette.panelAccent.color }} />
      <div
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          // The staircase's leftover is air inside the band rather than a band
          // shorter than the box it was given: the type stops one tread below the
          // height, and the padding is what fills the difference.
          justifyContent: 'center',
          padding: `${band.padY}px ${band.padX}px`,
        }}
      >
        <Revealed
          reveal={bandReveal(progress)}
          style={{
            fontFamily: theme.headingFont,
            fontSize: band.title,
            // The LAST resort, and not the wrapping model this file measures with.
            // `wordCeiling` bounds the type so the longest word of a run fits the
            // measure, so this only ever fires under `WORD_FIT_FLOOR_PX` — a word no
            // legible size can hold, where breaking is the decided lesser evil. Left
            // out, that word would run out of the box instead. A rendered frame showed
            // the other half of it, back when nothing bounded the size at all:
            // `NEUF S` / `EIZIEME` / `S`.
            wordBreak: 'break-word',
            fontWeight: 800,
            letterSpacing: '-0.01em',
            lineHeight: 1.14,
            color: palette.panelDisplay.color,
          }}
        >
          {block.title}
        </Revealed>
        {block.subtitle ? (
          <Revealed
            reveal={bandReveal(progress, BAND_SUBTITLE_FROM)}
            style={{
              marginTop: band.gap,
              fontFamily: theme.bodyFont,
              fontSize: band.subtitle,
              // The LAST resort, and not the wrapping model this file measures with.
              // `wordCeiling` bounds the type so the longest word of a run fits the
              // measure, so this only ever fires under `WORD_FIT_FLOOR_PX` — a word no
              // legible size can hold, where breaking is the decided lesser evil. Left
              // out, that word would run out of the box instead. A rendered frame showed
              // the other half of it, back when nothing bounded the size at all:
              // `NEUF S` / `EIZIEME` / `S`.
              wordBreak: 'break-word',
              lineHeight: 1.35,
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
