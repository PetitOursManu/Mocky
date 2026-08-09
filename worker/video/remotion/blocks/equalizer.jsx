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
 *   box       **this block's own box**, in pixels, out of `composedLayout`. Every
 *             size drawn here comes off it. Not the zone's, and not the frame's.
 *   unit      the type unit this block's STACK solved. One per zone, so two
 *             blocks in it are two steps of one scale.
 *   base      the frame's SHORT edge. For the three constant metrics named in
 *             `CONSTANT_METRICS` and for nothing else; this block has none.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground: every bar is `palette.accent`. Anchored `full` it is a second ground, and `stackedField` is what measures whatever stands on it.
 *
 * LEGIBILITY: This block used to say of itself that it "carries no text, so the only thing it can get wrong is spending contrast something else needed - which it cannot". That sentence is true of a block in a CELL and false of one anchored `full`, and it is the sentence that made the defect invisible: painted under the nine cells, this is a second GROUND, and the export that found it had eighteen accent bars meeting a headline whose last word is in the accent by design, at 1:1 in the middle of the frame. So there are two cases. In a cell it paints the accent run the palette resolved on this ground with the veil locked, and nothing stands on it. Anchored `full` under a stack, it is a surface: `stackedField` says so, `composedPalette` measures every run over it as a tint sampled along `FIELD_RAMP`, and the density it cedes is `palette.field.alpha` applied by `ComposedSceneVideo` to the ZONE. Which is why nothing about that appears below - the rule lives where `full` means something, so that the twenty-eighth block cannot forget it.
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
 * -- The block this whole pass is named after --------------------------------
 *
 * This is the one that drew `base * 0.18` - eighteen per cent of the frame's
 * short edge - whether it had been anchored to a third of a cell or to the entire
 * safe area. A field that occupies 18% of the height of a frame it was given all
 * of is not a field, and six real exports were a small element floating in a large
 * void because twenty-seven blocks did the same thing.
 *
 * So the row IS the box. `equalizerLayout` divides `box.width` into as many
 * columns as the document asked for, the bars grow out of `box.height`, and the
 * same twelve bars are a field crossing the frame when the box is the frame and a
 * figure in a cell when it is a cell. Two scales, one expression, decided by the
 * box - which is the sentence the whole family is written to.
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

import { equalizerLayout, equalizerLevels } from './dataFigures.js'

export const Equalizer = ({ block, palette, theme, box, progress, life }) => {
  const layout = equalizerLayout(block, box, { radiusPx: theme.radiusPx })
  const levels = equalizerLevels(block.bars, block.tempo, life)

  return (
    <div
      style={{
        position: 'relative',
        width: layout.width,
        height: layout.height,
        // The whole row arrives at once. Staggering it would read as bars filling
        // up in order, which is a progress bar - and there is one of those in the
        // catalogue already.
        opacity: progress,
      }}
    >
      {levels.map((level, i) => {
        const lane = layout.bars[i]
        // The two lists are the same length by construction - both count the
        // document's `bars` through the same clamp - so this is the belt on a
        // caller built by hand rather than a case a film can reach.
        if (!lane) return null
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              bottom: 0,
              left: lane.start,
              width: lane.size,
              // Scaled by `progress` as well as by the level, so the figure grows
              // out of the baseline instead of appearing at full height and then
              // starting to move.
              height: Math.round(layout.height * level * progress),
              backgroundColor: palette.accent.color,
              borderRadius: `${layout.radius}px ${layout.radius}px 0 0`,
            }}
          />
        )
      })}
    </div>
  )
}
