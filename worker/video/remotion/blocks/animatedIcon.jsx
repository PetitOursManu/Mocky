/**
 * `animatedIcon` - a pictogram that moves, and a short label under it.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`.
 *   box       {left, top, width, height} in pixels - **this block's own box**.
 *             The icon is the largest square that fits it once the label has
 *             been measured.
 *   unit      the type unit of this block's STACK, in pixels. The label is the
 *             block's one run, so it is the only thing set at that unit.
 *   base      the frame's short edge. Unused: an icon has no constant metric.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene. Unused: the icon's own clock is the
 *             scene's frame, which the player reads (see `iconFrame`).
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground. The pictogram is `palette.accent` - an ornament, like a
 * clock's dial - and its knockouts are the ground's own colour; the label is
 * `palette.body`.
 *
 * LEGIBILITY: The pictogram is a graphic, not text, and takes the 3:1 floor the
 * accent run carries - the floor WCAG sets for a graphical object. Every colour
 * the animation shipped with is replaced before it is drawn (`recolourLottie`),
 * so nothing unmeasured reaches the frame. The label is running text at 4.5:1.
 *
 * TWO RULES that are not negotiable, because the three guarantees of this
 * feature rest on them:
 *
 *   1. **No colour, no font family and no easing curve is written here.** A hex
 *      value in this file is a colour nobody measured; a curve is a sixth notion
 *      of how things move. Both arrive as props, out of `composition.js`, where
 *      a test can reach them.
 *   2. **No `remotion` import, ever.** The Lottie renderer is a component this
 *      file is HANDED through `IconPlayer`, for the reason `iconPlayer.js`
 *      gives; without one it draws its frame and its label and no pictogram.
 */
import { useContext } from 'react'
import { riseShare } from '../composition.js'
import { IconPlayer } from './iconPlayer.js'
import { clamp01, enterRise, iconFace } from './media.js'

export const AnimatedIcon = ({ block, palette, theme, box, unit, progress }) => {
  const Player = useContext(IconPlayer)
  const face = iconFace(block, box, unit)
  return (
    <div
      style={{
        opacity: clamp01(progress),
        transform: `translateY(${enterRise(face.rise, progress, riseShare(block))}px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        // The box's height, as a clock claims it: a square fills the minor axis,
        // and leaving the width to the content lets the zone's alignment place it.
        height: '100%',
      }}
    >
      <div style={{ width: face.size, height: face.size }}>
        {Player ? (
          <Player icon={block.icon} ink={palette.accent.color} knockout={palette.ground.color} size={face.size} />
        ) : null}
      </div>
      {block.label ? (
        <div
          style={{
            marginTop: face.label.gap,
            fontFamily: theme.bodyFont,
            fontSize: face.label.size,
            // The last resort, as on every wrapping run: `wordCeiling` bounds the
            // size so a word fits, and this only fires on one no legible size holds.
            wordBreak: 'break-word',
            color: palette.body.color,
          }}
        >
          {block.label}
        </div>
      ) : null}
    </div>
  )
}
