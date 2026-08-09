/**
 * `imageFrame` - one picture, framed.
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
 * SURFACE: the picture itself for `bleed`, and a PANEL for `card`. The caption
 * takes `palette.panelBody` on a card and `palette.body` under the two
 * treatments that have no panel - where it sits BELOW the picture and never on
 * it.
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
 * -- What this block owns -----------------------------------------------------
 *
 * The BOX, and nothing about the move. `imageFrameBox` is the whole geometry and
 * it is exported so `imageFrame.test.js` can hold it to arithmetic; the camera
 * move is `kenBurnsTransform`, the one the slideshow has always used, reached
 * through `framedMove` below rather than rewritten at a smaller amplitude.
 */
import { kenBurnsTransform } from '../composition.js'

/** 0 to 1, for a clock this file is handed rather than one it computes. */
const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0))

/**
 * A treatment this build knows, or the schema's own default.
 *
 * Normalised ONCE, the way `anchorName` is, so that every table below is keyed
 * on a word this file has already made safe: a plain lookup answers for the
 * prototype chain, and `treatment: "constructor"` would hand back a function
 * where a number was expected. The value was refused by `validate.js` long
 * before a frame, so reaching the fallback means two lists disagree — and a
 * picture drawn as a card beats a picture that vanished from a film somebody
 * waited for (Q1).
 */
const treatmentName = (name) =>
  typeof name === 'string' && Object.hasOwn(FRAME_PICTURE_HEIGHT, name) ? name : 'card'

/**
 * How tall the picture is, per treatment, as a fraction of the short edge.
 *
 * A preference and not a ceiling: the component pairs every one of these with
 * `maxHeight: '100%'` and a shrinkable flex basis, because a zone in a composed
 * scene is a THIRD of the safe height — 295 px on a 16:9 frame — while the same
 * block anchored `full` gets the whole of it. A picture sized in fractions of
 * the short edge alone would be right in one of those two and spill out of the
 * other, and it is the block that must yield: the box comes from
 * `composedLayout`, where a test can prove nothing crossed the margin.
 */
export const FRAME_PICTURE_HEIGHT = { bleed: 0.42, inset: 0.34, card: 0.3 }

/**
 * How much of its zone each treatment takes across.
 *
 * `inset` is the one that is not full width, which is the whole of what the word
 * names: a picture standing off its own column, with the ground showing either
 * side of it. `card` fills the measure and stands off by its padding instead.
 */
export const FRAME_WIDTH_PERCENT = { bleed: 100, inset: 88, card: 100 }

/** The card's own padding, and the inner radius, as fractions of the short edge. */
export const FRAME_PADDING = 0.016
export const FRAME_INNER_RADIUS = 0.7

/** The caption: `KICKER_SIZE` is 0.026 and a caption is quieter than a surtitle. */
export const FRAME_CAPTION_SIZE = 0.022
export const FRAME_CAPTION_GAP = 0.012

/** How far the whole figure rises as it arrives, as a fraction of the short edge. */
export const FRAME_RISE = 0.02

/**
 * The camera move a framed picture makes: the house's one Ken Burns, at the
 * scene's own clock.
 *
 * `kenBurnsTransform` takes a frame and a length because the five monolithic
 * compositions are handed both; a block is handed `life`, the same quantity
 * already normalised. A length of two makes that function's own span one, so
 * `progressAt(life, 1)` is `life` itself and the transform is bit-for-bit the
 * one a slideshow scene gets at the same point of its own duration —
 * `imageFrame.test.js` asserts exactly that, over every kind and a sweep of
 * durations.
 *
 * Written as a delegation rather than as a transform of its own for the reason
 * the whole of `composition.js` exists: a second Ken Burns is a second answer to
 * "how does a picture move", and the two would be discovered to disagree by
 * watching an mp4. It belongs beside `kenBurnsTransform` itself; it is one line
 * here so that the picture cannot drift from the film around it in the meantime.
 */
const ONE_SPAN = 2

export function framedMove(kind, life) {
  return kenBurnsTransform(kind, clamp01(life), ONE_SPAN)
}

/**
 * Every measurement of the figure, in pixels, from one treatment and one edge.
 *
 * Exported because it is the only part of this block a test can check: a
 * component cannot be rendered in Mocky's suite, and "is this picture inside its
 * card" is arithmetic long before it is a frame.
 */
export function imageFrameBox(treatment, base, radiusPx) {
  const kind = treatmentName(treatment)
  const edge = Math.max(0, Number(base) || 0)
  const radius = Math.max(0, Math.round(Number(radiusPx) || 0))
  const panel = kind === 'card'
  return {
    panel,
    widthPercent: FRAME_WIDTH_PERCENT[kind],
    picture: Math.round(edge * FRAME_PICTURE_HEIGHT[kind]),
    padding: panel ? Math.round(edge * FRAME_PADDING) : 0,
    radius: panel ? radius : 0,
    // A bleeding picture has no corner to round: the whole point of the
    // treatment is that it meets its zone's edges.
    pictureRadius: kind === 'bleed' ? 0 : Math.round(radius * FRAME_INNER_RADIUS),
    captionGap: Math.round(edge * FRAME_CAPTION_GAP),
    captionSize: Math.round(edge * FRAME_CAPTION_SIZE),
  }
}

export const ImageFrame = ({ block, palette, theme, base, progress, life, images }) => {
  const box = imageFrameBox(block.treatment, base, theme.radiusPx)
  const src = images?.[block.imageId]
  const arrival = clamp01(progress)
  return (
    <figure
      style={{
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        width: `${box.widthPercent}%`,
        maxWidth: '100%',
        // The zone's height is the one this block does not know. Shrinking to it
        // is what keeps a `bleed` picture inside a 295 px band without making it
        // small in the `full` field where it belongs.
        maxHeight: '100%',
        minHeight: 0,
        opacity: arrival,
        transform: `translateY(${(1 - arrival) * base * FRAME_RISE}px)`,
        padding: box.padding,
        borderRadius: box.radius,
        backgroundColor: box.panel ? palette.panel.color : 'transparent',
      }}
    >
      <div
        style={{
          flex: '0 1 auto',
          minHeight: 0,
          height: box.picture,
          overflow: 'hidden',
          borderRadius: box.pictureRadius,
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
            marginTop: box.captionGap,
            fontFamily: theme.bodyFont,
            fontSize: box.captionSize,
            color: box.panel ? palette.panelBody.color : palette.body.color,
          }}
        >
          {block.caption}
        </figcaption>
      ) : null}
    </figure>
  )
}
