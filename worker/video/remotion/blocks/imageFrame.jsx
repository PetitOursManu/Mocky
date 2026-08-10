/**
 * `imageFrame` - one picture, framed, filling the box it was given.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`.
 *   box       {left, top, width, height} in pixels - **this block's own box**,
 *             not its zone's. Every size drawn here comes out of it.
 *   unit      the type unit of this block's STACK, in pixels. One per zone, so
 *             two blocks side by side are two steps of one scale.
 *   base      the frame's short edge. Reserved for the three constant metrics
 *             `CONSTANT_METRICS` names - here, the gutter and the radius.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the picture itself for `bleed` and `inset`, and a PANEL for `card`.
 * The caption takes `palette.panelBody` on a card and `palette.body` under the
 * two treatments that have no panel - where it sits BELOW the picture and never
 * on it.
 *
 * LEGIBILITY: A caption over a bleeding picture is the case to be careful with:
 * nothing measured that surface, because a photograph is not in the theme. So
 * the caption is never painted over the picture. On a card it lands on
 * `palette.panelBody`, which is opaque `theme.surface`; without a card it lands
 * under the picture on the ground, which `composedPalette` measured. The palette
 * has no entry for text on a bare photograph, deliberately, and this file does
 * not invent one.
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
 * -- What this block owns, and what it stopped owning ------------------------
 *
 * The geometry is `imageFrameBox` in `media.js`, where a test can reach it
 * without React, and it is the whole of what this file draws: the picture takes
 * the box less its margin and less the band the caption needs. Nothing here is
 * a fraction of the frame any more - `FRAME_PICTURE_HEIGHT` used to be 0.42 of
 * the short edge for `bleed`, so a picture handed the entire safe area drew
 * itself at two fifths of it and the rest of the scene was black.
 *
 * The camera move is `framedMove`, which is `kenBurnsTransform` at the scene's
 * own clock and therefore bounded by it: a pan spends 4% of travel on a 12%
 * overscale, so nothing visible at rest slides out of the frame. Rewriting that
 * amplitude here is the one way this block could lose that guarantee, which is
 * why the move is a delegation and not a transform.
 */
import { clamp01, enterRise, framedMove, imageFrameBox } from './media.js'

export const ImageFrame = ({ block, palette, theme, box, unit, base, progress, life, images }) => {
  const geometry = imageFrameBox(block, box, unit, base, theme.radiusPx)
  const src = images?.[block.imageId]
  const ink = geometry.panel ? palette.panelBody.color : palette.body.color
  return (
    <figure
      style={{
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        // The box, and all of it. `box-sizing` is what makes the margin an
        // inside measurement, so the three sums below reconstruct the box the
        // layout handed over rather than overflowing it by two gutters.
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: geometry.margin,
        opacity: clamp01(progress),
        transform: `translateY(${enterRise(geometry.rise, progress)}px)`,
        borderRadius: geometry.radius,
        backgroundColor: geometry.panel ? palette.panel.color : 'transparent',
      }}
    >
      <div
        style={{
          flex: '0 0 auto',
          width: '100%',
          height: geometry.picture.height,
          overflow: 'hidden',
          borderRadius: geometry.pictureRadius,
          // An opaque surface under the picture rather than the ground: a
          // photograph that has not decoded yet shows a card, not a hole. The
          // worker refuses a missing image long before a frame, so this is belt
          // and braces (Q1).
          backgroundColor: palette.panel.color,
        }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transform: framedMove(block.move, life),
            }}
          />
        ) : null}
      </div>
      {block.caption ? (
        <figcaption
          style={{
            flex: '0 0 auto',
            marginTop: geometry.caption.gap,
            fontFamily: theme.bodyFont,
            fontSize: geometry.caption.size,
            // The LAST resort, and not the wrapping model this file measures with.
            // `wordCeiling` bounds the type so the longest word of a run fits the
            // measure, so this only ever fires under `WORD_FIT_FLOOR_PX` — a word no
            // legible size can hold, where breaking is the decided lesser evil. Left
            // out, that word would run out of the box instead. A rendered frame showed
            // the other half of it, back when nothing bounded the size at all:
            // `NEUF S` / `EIZIEME` / `S`.
            wordBreak: 'break-word',
            lineHeight: geometry.caption.lines > 0 ? geometry.caption.height / geometry.caption.lines / geometry.caption.size : 1,
            color: ink,
          }}
        >
          {block.caption}
        </figcaption>
      ) : null}
    </figure>
  )
}
