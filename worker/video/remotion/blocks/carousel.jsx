/**
 * `carousel` - pictures sliding past, one after another, across the whole box.
 *
 * -- The contract every block in this directory is written to ----------------
 *
 * PROPS, and there are no others:
 *   block     the layer, already validated three times over. Read it; never
 *             re-check it, and never repair it.
 *   palette   `composedPalette`. **The only source of colour in this file.**
 *   theme     `resolveTheme`: `headingFont`, `bodyFont`, `radiusPx`.
 *   box       {left, top, width, height} in pixels - **this block's own box**,
 *             not its zone's. The view size and the stride both come out of it.
 *   unit      the type unit of this block's STACK, in pixels. A carousel carries
 *             no run, so it reads it only for the travel of its own arrival.
 *   base      the frame's short edge. Reserved for the three constant metrics
 *             `CONSTANT_METRICS` names - here, the gutter and the radius.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground behind the track, and an opaque panel under each picture.
 * No text.
 *
 * LEGIBILITY: Same as `gallery`: no run, nothing to measure, and a caption added
 * later belongs on a panel - including the gap that file names, which this one
 * has in the same shape. A `full` carousel under a stack is a surface made of
 * photographs, and the fielded palette measures a field as the ACCENT; a moving
 * strip of pictures is neither. Read the note in `gallery.jsx`.
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
 * -- The view comes from the box, and that is the fix ------------------------
 *
 * A view used to be `0.3 x the frame's short edge` across and `0.24` tall,
 * whatever box the block was handed. A carousel anchored `full` in a 16:9 frame
 * therefore drew a 259 px strip inside a zone 950 px tall - a ribbon floating in
 * a black field, which is the "rudimentary" the user kept naming. Now the view
 * is as tall as the box and as wide as its share of the measure: `carouselView`
 * decides how many fit, from the box's own shape, and the stride is one view and
 * one gutter.
 *
 * -- One loop per scene, and why that is the honest rate ---------------------
 *
 * A speed is a distance over a TIME, and this block is handed neither: `life` is
 * the scene's own clock already normalised, so a rate in pixels per second is
 * not something it can express - the same wall the clock's `sweep` runs into one
 * file along. Any constant rate would therefore be a rate tuned for one scene
 * length and wrong at the other end of a window that runs from 1.5 s to 15 s.
 *
 * So the track advances by exactly its own length over the scene, whatever the
 * scene is: every picture the document listed passes the frame once, and the
 * pace is the pace the film was cut at. A document that wants a faster carousel
 * asks for a shorter scene, which is a thing it can say.
 *
 * The strip is drawn several times over for the same reason a loop is seamless
 * at all - `carouselCopies` guarantees there is always another picture where the
 * eye is about to look, and it is handed the window the BOX turned out to show
 * rather than a bound written for the widest frame. A gap arriving at the edge
 * of a frame is a film showing its own machinery.
 */
import {
  carouselCopies,
  carouselOffset,
  carouselView,
  clamp01,
  constantMetric,
  enterRise,
  stackUnit,
  tileGutter,
} from './media.js'

export const Carousel = ({ block, palette, theme, box, unit, base, progress, life, images }) => {
  const ids = block.imageIds
  const gap = tileGutter(base, box)
  const view = carouselView(box, gap)
  const copies = carouselCopies(ids.length, view.visible)
  const radius = constantMetric(theme.radiusPx, view.tile)
  const rise = stackUnit(block, box, unit)
  const strip = Array.from({ length: copies * ids.length }, (_, i) => ids[i % ids.length])
  return (
    <div
      style={{
        // The box, and all of it: the window the strip runs behind. Everything
        // outside it is another picture, never the ground - that is what the
        // copies buy.
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        opacity: clamp01(progress),
        transform: `translateY(${enterRise(rise, progress)}px)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap,
          height: '100%',
          transform: `translateX(${carouselOffset(block.direction, ids.length, life) * view.stride}px)`,
        }}
      >
        {strip.map((id, index) => (
          <div
            key={index}
            style={{
              flex: `0 0 ${view.tile.width}px`,
              height: '100%',
              overflow: 'hidden',
              borderRadius: radius,
              // An opaque surface under the picture rather than the ground, for
              // the reason `imageFrame` gives: a tile whose bytes have not
              // arrived is a card, never a hole (Q1).
              backgroundColor: palette.panel.color,
            }}
          >
            {images?.[id] ? (
              <img src={images[id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
