/**
 * `carousel` - pictures sliding past, one after another.
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
 * SURFACE: the ground behind the track, and an opaque panel under each picture.
 * No text.
 *
 * LEGIBILITY: Same as `gallery`: no run, nothing to measure, and a caption added
 * later belongs on a panel.
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
 * -- One loop per scene, and why that is the honest rate ---------------------
 *
 * A speed is a distance over a TIME, and this block is handed neither: `life` is
 * the scene's own clock already normalised, so a rate in pixels per second is
 * not something it can express — the same wall the clock's `sweep` runs into one
 * file along. Any constant rate would therefore be a rate tuned for one scene
 * length and wrong at the other end of a window that runs from 1.5 s to 15 s.
 *
 * So the track advances by exactly its own length over the scene, whatever the
 * scene is: every picture the document listed passes the frame once, and the
 * pace is the pace the film was cut at. A document that wants a faster carousel
 * asks for a shorter scene, which is a thing it can say.
 *
 * The strip is drawn several times over for the same reason a loop is seamless
 * at all — `carouselCopies` guarantees there is always another picture where the
 * eye is about to look, and `carousel.test.js` holds it to that rather than to
 * this paragraph. A gap arriving at the edge of a frame is a film showing its
 * own machinery.
 */

/** 0 to 1, for a clock this file is handed rather than one it computes. */
const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0))

/** A tile, as fractions of the short edge: three tenths across and a quarter tall. */
export const CAROUSEL_TILE = 0.3
export const CAROUSEL_HEIGHT = 0.24
export const CAROUSEL_GAP = 0.012

/** A tile's corner, as a share of the project's declared radius — `gallery`'s own. */
export const CAROUSEL_TILE_RADIUS = 0.7

/** How far the track rises as it arrives, as a fraction of the short edge. */
export const CAROUSEL_RISE = 0.02

/** How many tile widths the track advances over one scene. See the header. */
export const CAROUSEL_LOOPS = 1

/**
 * The most tiles a frame can show at once, and therefore how much strip has to
 * exist beyond the one being looked at.
 *
 * A 16:9 safe area is 1690 px across and a tile with its gutter is 337, so five
 * whole tiles and a sliver: six covers it, and six covers the other two ratios
 * with room to spare since both are narrower. It is a bound rather than a
 * measurement because this block is never told its own width — the zone comes
 * from `composedLayout`, one level up.
 */
export const CAROUSEL_WINDOW = 6

/** The distance from one tile to the next, in pixels. */
export function carouselStride(base) {
  const edge = Math.max(0, Number(base) || 0)
  return Math.round(edge * CAROUSEL_TILE) + Math.round(edge * CAROUSEL_GAP)
}

/**
 * How many times the document's pictures are laid end to end.
 *
 * Enough that the strip still reaches past the right-hand edge when the track
 * has travelled its whole length: the loop is seamless because there is another
 * copy of the same picture where the first one was, and never because anything
 * jumps back to the start. Two copies are enough for eight pictures and four are
 * needed for two, which is why this is arithmetic and not a constant.
 */
export function carouselCopies(count) {
  const total = Math.max(1, Math.floor(Number(count) || 0))
  return Math.max(2, Math.ceil((total * CAROUSEL_LOOPS + CAROUSEL_WINDOW) / total))
}

/**
 * Where the track sits at a given point of the scene, in TILES, signed.
 *
 * Monotonic in `life` and never wrapped, which is what makes "the track is
 * somewhere else on every frame" a claim a test can check: a modulo would put
 * one frame per loop back where an earlier one was, and that frame is the whole
 * point of the rule. The seam is paid for in copies instead — cheaper, since a
 * tile is a `div` and a discontinuity is a film that stutters once a scene.
 *
 * `left` means the pictures travel leftwards, which is the direction a reader of
 * a left-to-right language expects a strip of them to move. `right` is the same
 * travel begun a full length back, so the strip arrives from off-frame rather
 * than uncovering the ground behind it.
 */
export function carouselOffset(direction, count, life) {
  const total = Math.max(1, Math.floor(Number(count) || 0))
  const travelled = clamp01(life) * CAROUSEL_LOOPS * total
  return direction === 'right' ? travelled - total * CAROUSEL_LOOPS : -travelled
}

export const Carousel = ({ block, palette, theme, base, progress, life, images }) => {
  const ids = block.imageIds
  const stride = carouselStride(base)
  const copies = carouselCopies(ids.length)
  const arrival = clamp01(progress)
  const radius = Math.round(Math.max(0, Number(theme.radiusPx) || 0) * CAROUSEL_TILE_RADIUS)
  const strip = Array.from({ length: copies * ids.length }, (_, i) => ids[i % ids.length])
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '100%',
        // The window the strip runs behind. Everything outside it is another
        // picture, never the ground: that is what the copies buy.
        overflow: 'hidden',
        height: Math.round(base * CAROUSEL_HEIGHT),
        maxHeight: '100%',
        minHeight: 0,
        flex: '0 1 auto',
        opacity: arrival,
        transform: `translateY(${(1 - arrival) * base * CAROUSEL_RISE}px)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: Math.round(base * CAROUSEL_GAP),
          height: '100%',
          transform: `translateX(${carouselOffset(block.direction, ids.length, life) * stride}px)`,
        }}
      >
        {strip.map((id, index) => (
          <div
            key={index}
            style={{
              flex: `0 0 ${Math.round(base * CAROUSEL_TILE)}px`,
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
