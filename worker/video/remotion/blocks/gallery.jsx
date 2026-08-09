/**
 * `gallery` - two to six pictures at once, arriving in cadence, filling the box.
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
 *   unit      the type unit of this block's STACK, in pixels. A gallery carries
 *             no run, so it reads it only for the travel of its own arrival.
 *   base      the frame's short edge. Reserved for the three constant metrics
 *             `CONSTANT_METRICS` names - here, the gutter and the radius.
 *   progress  0 to 1, this block's own arrival, already eased by `cueProgress`.
 *   life      0 to 1 across the whole scene, for anything that runs continuously.
 *   images    staged pictures by id. Only the three media blocks read it.
 *
 * SURFACE: the ground shows between the tiles, and each tile is an opaque panel
 * under its own picture. It carries no text at all.
 *
 * LEGIBILITY: No run of its own, so this block measures nothing - which is why it
 * may cover as much of the frame as its anchor gives it. The moment a finished
 * version adds a caption, that caption goes on a panel, for the reason
 * `imageFrame` gives.
 *
 * One thing that follows is NAMED here rather than left as an implication,
 * because the neighbouring version of it shipped a heading nobody could read:
 * "no run" is a statement about what this block PAINTS, never about what may be
 * painted over it. Anchored `full` it is drawn under the nine cells, so a heading
 * in a cell stands on photographs. `composedPalette` handles a fielded scene by
 * measuring the field as the ACCENT (`equalizer`, `soundWave`, `map`,
 * `lineChart`, `barChart` are what reach for it), and a picture is not the
 * accent - so that measurement does not cover this case, and no veil covers it
 * either, since `COMPOSED_IMAGE_VEIL` belongs to the `image` GROUND. A stack over
 * a `full` gallery is therefore text on a photograph nobody opened. It is a
 * legibility gap with a name, not an oversight: the fix belongs in
 * `composedPalette` beside `FIELD_ALPHAS`, and it is not in this file, which
 * chooses no colour at all.
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
 * -- Three things this block is careful about --------------------------------
 *
 * **The grid follows the BOX, not only the count.** Three pictures in a wide
 * band are a row; the same three in a narrow column are a stack. The table this
 * block used to carry answered `columns = count <= 3 ? count : ...` and could
 * not tell the two apart, because it was never shown the box - so a gallery
 * anchored `full` in a portrait frame drew three slivers 302 px wide. The choice
 * is now measured, in `galleryRows`, and the tiles tile the box exactly.
 *
 * **A tile is not a frame, and the sharpness of a still depends on which.**
 * `src/lib/video/resolution.ts` reports, before anybody spends two minutes
 * rendering, how much a picture is about to be ENLARGED - and it measures
 * against the whole frame, because that is what four of the five monolithic
 * compositions paint. A gallery tile is a share of the box, so the same still
 * that is coarse full-bleed is comfortable here. `gallery.test.js` holds that to
 * arithmetic rather than to this sentence, at the widest a tile can ever be.
 * That is the direction the panel's warning is allowed to be wrong in: it may
 * say a gallery is coarser than it will be, never the reverse.
 *
 * **The cadence is the block's own arrival, replayed.** A gallery whose tiles
 * appeared together is a screenshot; `cueFrames` is what hands out arrivals in
 * this feature, and it works in frames, which this block does not have. So the
 * tiles divide `progress` - already eased by `cueProgress`, and passed through a
 * window rather than through a second curve. No easing is applied twice and none
 * is invented; the last tile still lands exactly when the block has finished
 * arriving, so a scene too short for the cascade compresses it, as everywhere.
 */
import {
  GALLERY_TILE_ENTER,
  GALLERY_TILE_SCALE,
  constantMetric,
  enterRise,
  galleryTileProgress,
  galleryTileTravel,
  galleryTiles,
  stackUnit,
  tileGutter,
} from './media.js'

export const Gallery = ({ block, palette, theme, box, unit, base, progress, life, images }) => {
  const ids = block.imageIds
  const gap = tileGutter(base, box)
  const tiles = galleryTiles(block.layout, ids.length, box, gap)
  const radius = constantMetric(theme.radiusPx, tiles[0] ?? box)
  const rise = stackUnit(block, box, unit)
  return (
    <div
      style={{
        // The box, and all of it. The tiles are absolutely positioned off
        // `galleryTiles`, which is pixels a test can read: a `1fr` grid drew the
        // same picture and could not be asked whether a row had left the box.
        position: 'relative',
        width: '100%',
        height: '100%',
        transform: `translateY(${enterRise(rise, progress)}px)`,
      }}
    >
      {ids.map((id, index) => {
        const arrival = galleryTileProgress(index, ids.length, progress)
        const tile = tiles[index] ?? tiles[tiles.length - 1]
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: tile.left,
              top: tile.top,
              width: tile.width,
              height: tile.height,
              overflow: 'hidden',
              borderRadius: radius,
              // An opaque surface under the picture rather than the ground, for
              // the reason `imageFrame` gives: a tile whose bytes have not
              // arrived is a card, never a hole (Q1).
              backgroundColor: palette.panel.color,
              opacity: arrival,
              transform: `scale(${GALLERY_TILE_ENTER + (1 - GALLERY_TILE_ENTER) * arrival})`,
            }}
          >
            {images?.[id] ? (
              <img
                src={images[id]}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  transform: `scale(${GALLERY_TILE_SCALE}) translateY(${galleryTileTravel(index, life)}%)`,
                }}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
