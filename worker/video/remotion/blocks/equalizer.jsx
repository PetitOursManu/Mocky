/**
 * `equalizer` - bars rising and falling on a deterministic curve.
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
 * SURFACE: the ground: every bar is `palette.accent`.
 *
 * LEGIBILITY: It carries no text, so the only thing it can get wrong is spending contrast something else needed - which it cannot, because it paints the accent run the palette already resolved on this ground with the veil locked.
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
 * -- It is a motif, and nothing here is listening ----------------------------
 *
 * **There is no audio in this feature and there is no field to ask for one.**
 * This is a MOTIF, not a meter: the bars follow a fixed function of the frame
 * number, with no `@remotion/media-utils`, no file and nothing being listened to.
 * It only becomes a lie if something claims otherwise, and nothing does - the
 * component draws bars and says nothing about what they are bars OF.
 *
 * The curve is `equalizerLevels`, three components at ratios that never line up
 * inside a scene, and it lives beside the other four data blocks' arithmetic so a
 * test can hold it. That is also what makes the "no frame of this is identical to
 * the last" claim checkable, which for a figure driven by a sine is the whole
 * claim.
 */

import { equalizerLevels } from './dataFigures.js'

export const Equalizer = ({ block, palette, theme, base, progress, life }) => {
  const height = Math.round(base * 0.18)
  const levels = equalizerLevels(block.bars, block.tempo, life)
  // The top corners only, and barely: an equalizer bar is a column of light, and
  // a fully rounded one is a pill, which reads as a tag rather than as a level.
  const radius = Math.max(0, Math.round(theme.radiusPx * 0.2))

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: Math.max(1, Math.round(base * 0.004)),
        height,
        width: '100%',
        // The whole row arrives at once. Staggering it would read as bars filling
        // up in order, which is a progress bar - and there is one of those in the
        // catalogue already.
        opacity: progress,
      }}
    >
      {levels.map((level, i) => (
        <div
          key={i}
          style={{
            flex: '1 1 0',
            // Scaled by `progress` as well as by the level, so the figure grows
            // out of the baseline instead of appearing at full height and then
            // starting to move.
            height: Math.round(height * level * progress),
            backgroundColor: palette.accent.color,
            borderRadius: `${radius}px ${radius}px 0 0`,
          }}
        />
      ))}
    </div>
  )
}
