/**
 * `soundWave` - a waveform running across the box it was given.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`.
 *   box       **this block's own box**, in pixels, out of `composedLayout`. Every
 *             size drawn here comes off it. Not the zone's, and not the frame's.
 *   unit      the type unit this block's STACK solved. This block carries no
 *             text, so it reads none of it.
 *   base      the frame's SHORT edge. For the constant metrics named in
 *             `CONSTANT_METRICS`; here that is the stroke, and nothing else.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground, in `palette.accent` - the line and the axis it opens from, nothing else.
 *
 * LEGIBILITY: Same two cases as the equalizer, and the same correction. In a cell it carries no text: it paints the decoration run the palette resolved with the veil locked, so it cannot darken a picture to keep its own colour. Anchored `full` with something stacked on it, it is a second GROUND painted under the nine cells - "it carries no text, so it cannot spend contrast something else needed" is the sentence that hid that for six agents, and it is false here. What makes it safe is not in this file: `stackedField` detects the pair, `composedPalette` measures every run over the wave as a tint sampled along its own density, and `ComposedSceneVideo` applies `palette.field.alpha` to the ZONE. A wave is exactly the block somebody puts a wordmark on, which is why the catalogue card recommends it that way.
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
 * -- The box decides how long the wave is, and which way it runs --------------
 *
 * It used to be `base * 0.14` tall and full-width whatever it had been given,
 * which is the defect the whole family was rewritten for: a wave handed the safe
 * area drew a fourteenth of the frame's short edge across it.
 *
 * Now the figure is the box, and the box also decides its DIRECTION. The wave has
 * about five crests along its length, so its amplitude wants to stay near the
 * spacing between them; drawn across a column - 845 px of measure under 950 px of
 * band - that is a swing three times the crest spacing, which is a zigzag and not
 * a waveform. `waveOrientation` therefore sends a wave in a tall box DOWN it.
 * Same arithmetic, transposed once, in `dataFigures.js` where a test can ask.
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

import { waveHeights, waveLayout, wavePoints } from './dataFigures.js'

export const SoundWave = ({ block, palette, box, base, progress, life }) => {
  const layout = waveLayout(box, { base })
  const heights = waveHeights(block.samples, block.shape, life)
  const points = wavePoints(heights, box, progress)
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ')
  // A viewBox of zero draws nothing at all and prints a warning per frame; a box
  // with no size is a layout that has already gone wrong, and a block that
  // degrades beats a render that dies half a minute in (Q1).
  const width = Math.max(1, layout.width)
  const height = Math.max(1, layout.height)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ display: 'block' }}
    >
      {/* The axis the wave opens from. It is what the first frame of the arrival
          looks like, and without it the block appears out of nothing rather than
          out of a line. It runs the length of the box, whichever way that is. */}
      <line
        x1={layout.axis.x1}
        y1={layout.axis.y1}
        x2={layout.axis.x2}
        y2={layout.axis.y2}
        stroke={palette.accent.color}
        strokeWidth={layout.stroke}
        opacity={0.3}
      />
      <polyline
        points={points}
        fill="none"
        stroke={palette.accent.color}
        strokeWidth={layout.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
