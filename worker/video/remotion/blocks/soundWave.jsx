/**
 * `soundWave` - a waveform running across the frame.
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
 * SURFACE: the ground, in `palette.accent` - the line and the axis it opens from, nothing else.
 *
 * LEGIBILITY: No text, same as the equalizer: it paints the decoration run the palette resolved with the veil locked, so it cannot darken a picture to keep its own colour.
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
 * -- No audio, and the same sentence as `equalizer` --------------------------
 *
 * This feature has no sound, and the schema is `.strict()` so that asking for one
 * is refused whole rather than rendered as silence and reported as a success.
 * What travels across the frame is `waveHeights`: three harmonics on an envelope
 * that reaches zero at both ends, deterministic in the frame number and in
 * nothing else. Nothing is being listened to and the component says nothing that
 * suggests otherwise.
 *
 * The arrival OPENS the wave rather than fading it in - the amplitude is scaled
 * by `progress`, so the figure grows out of its own axis. A waveform that faded
 * up at full height would be a picture of a wave; one that opens is a wave.
 */

import { waveHeights } from './dataFigures.js'

/** The box the wave is drawn in, before CSS stretches it. Ten to one: a wave is long. */
const VIEW_WIDTH = 100
const VIEW_HEIGHT = 24

export const SoundWave = ({ block, palette, base, progress, life }) => {
  const heights = waveHeights(block.samples, block.shape, life)
  const last = Math.max(1, heights.length - 1)
  const middle = VIEW_HEIGHT / 2
  const points = heights
    .map((height, i) => {
      const x = (i / last) * VIEW_WIDTH
      // Downward is positive in an SVG, so a positive sample is a crest above the
      // axis only because it is subtracted here. The arithmetic that decides the
      // shape stays in `dataFigures.js`; this line is the drawing convention.
      return `${x.toFixed(2)},${(middle - height * middle * progress).toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: Math.round(base * 0.14), display: 'block' }}
    >
      {/* The axis the wave opens from. It is what the first frame of the arrival
          looks like, and without it the block appears out of nothing rather than
          out of a line. */}
      <line
        x1="0"
        y1={middle}
        x2={VIEW_WIDTH}
        y2={middle}
        stroke={palette.accent.color}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        opacity={0.3}
      />
      <polyline
        points={points}
        fill="none"
        stroke={palette.accent.color}
        strokeWidth={Math.max(1, Math.round(base * 0.0028))}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
