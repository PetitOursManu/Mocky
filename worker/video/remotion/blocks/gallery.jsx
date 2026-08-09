/**
 * `gallery` - two to six pictures at once, arriving in cadence.
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
 * SURFACE: the ground shows between the tiles, and each tile is an opaque panel
 * under its own picture. It carries no text at all.
 *
 * LEGIBILITY: No run, so nothing to measure - which is why this block may cover
 * as much of the frame as its anchor gives it. The moment a finished version
 * adds a caption, that caption goes on a panel, for the reason `imageFrame`
 * gives.
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
 * -- Two things this block is careful about ----------------------------------
 *
 * **A tile is not a frame, and the sharpness of a still depends on which.**
 * `src/lib/video/resolution.ts` reports, before anybody spends two minutes
 * rendering, how much a picture is about to be ENLARGED — and it measures
 * against the whole frame, because that is what four of the five monolithic
 * compositions paint. A gallery tile is a third of the measure and half the
 * height, so the same still that is coarse full-bleed is comfortable here.
 * `gallery.test.js` holds that to arithmetic rather than to this sentence: it
 * takes the widest a tile can ever be — the safe area, which is what an anchor
 * of `full` gives it — and requires the enlargement to stay under what the same
 * picture takes full-bleed with its camera move, in all three ratios. That is
 * the direction the panel's warning is allowed to be wrong in: it may say a
 * gallery is coarser than it will be, never the reverse.
 *
 * **The cadence is the block's own arrival, replayed.** A gallery whose tiles
 * appeared together is a screenshot; `cueFrames` is what hands out arrivals in
 * this feature, and it works in frames, which this block does not have. So the
 * tiles divide `progress` — already eased by `cueProgress`, and passed through a
 * window rather than through a second curve. No easing is applied twice and none
 * is invented; the last tile still lands exactly when the block has finished
 * arriving, so a scene too short for the cascade compresses it, as everywhere.
 */

/** 0 to 1, for a clock this file is handed rather than one it computes. */
const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0))

/**
 * The tallest a gallery draws itself, as a fraction of the short edge — half.
 *
 * A preference and not a ceiling, like every other height in this directory: the
 * component pairs it with `maxHeight: '100%'` and a shrinkable basis, because a
 * zone is a third of the safe height while the same block anchored `full` gets
 * all of it. Six pictures in a band and six pictures filling the frame are the
 * same document.
 */
export const GALLERY_BUDGET = 0.5

/** The gutter between two tiles. `COMPOSED_STACK_GAP` is 0.024; tiles of one gallery are tighter still. */
export const GALLERY_GAP = 0.012

/** A tile's corner, as a share of the project's declared radius. */
export const GALLERY_TILE_RADIUS = 0.7

/** How small a tile starts before it lands. A scale, so nothing reflows as it arrives. */
export const GALLERY_TILE_ENTER = 0.94

/**
 * The share of the block's own arrival spent handing tiles out.
 *
 * The rest is the window each tile has to land in, so the last one finishes
 * exactly when the block does. Raising this towards 1 is how a gallery becomes a
 * cascade that outlives its own cue, which `MIN_CUE_TAIL_FRAMES` exists to
 * prevent one level up.
 */
export const GALLERY_STAGGER = 0.55

/**
 * How far a tile's picture drifts inside it, and the overscale that pays for it.
 *
 * The same argument `OVERLAY_DRIFT_PERCENT` makes at frame scale: a still held
 * for five seconds reads as a stalled render, and the smallest movement that
 * fixes that is one the eye cannot name. 4% of overscale leaves 2% of margin on
 * each side and the travel spends 1.2 of it, so every pixel visible at rest is
 * visible on every frame — `gallery.test.js` asserts that inequality rather than
 * trusting the two numbers to stay in proportion.
 */
export const GALLERY_TILE_SCALE = 1.04
export const GALLERY_TILE_TRAVEL = 1.2

/**
 * The grid a layout and a picture count make.
 *
 * `row` and `stack` are the two the document can ask for by name; `grid` is the
 * default and the only one that has to decide anything. Four pictures go two by
 * two rather than three and one, because a row of three with an orphan under it
 * is the arrangement everybody reads as a mistake.
 *
 * Anything this build does not know reads as `grid`, which is the schema's own
 * default: the value was refused by `validate.js` long before a frame, so
 * reaching that branch means two lists disagree, and a gallery drawn as a grid
 * beats one that vanished from a film somebody waited for (Q1).
 */
export function galleryGrid(layout, count) {
  const total = Math.max(1, Math.floor(Number(count) || 0))
  if (layout === 'row') return { columns: total, rows: 1 }
  if (layout === 'stack') return { columns: 1, rows: total }
  const columns = total <= 3 ? total : total === 4 ? 2 : 3
  return { columns, rows: Math.ceil(total / columns) }
}

/** The whole grid's preferred height, in pixels. */
export function galleryHeight(base) {
  return Math.round(Math.max(0, Number(base) || 0) * GALLERY_BUDGET)
}

/**
 * One row's height, in pixels.
 *
 * The arithmetic CSS is about to do with `1fr` tracks, written down so a test
 * can reach it: the rows divide the budget less their gutters. It is here rather
 * than left to the browser because "how much is this picture enlarged" is a
 * question asked before the render, and a number only a layout engine knows is
 * a number nobody can answer with.
 */
export function galleryTileHeight(rows, base) {
  const edge = Math.max(0, Number(base) || 0)
  const total = Math.max(1, Math.floor(Number(rows) || 0))
  const gap = Math.round(edge * GALLERY_GAP)
  return Math.max(1, Math.round((galleryHeight(edge) - (total - 1) * gap) / total))
}

/**
 * How far one tile has arrived, from the block's own arrival.
 *
 * Ordered by index and never overlapping its predecessor by more than the
 * window, and every tile is landed by the time the block is: a gallery is one
 * element of the stack's cascade, not a cascade of its own that could outlive
 * the scene.
 */
export function galleryTileProgress(index, count, progress) {
  const total = Math.max(1, Math.floor(Number(count) || 0))
  const at = clamp01(progress)
  if (total < 2) return at
  const rank = Math.min(total - 1, Math.max(0, Math.floor(Number(index) || 0)))
  // The share first and the multiplication after, so the LAST tile's start is
  // `GALLERY_STAGGER` exactly and its arrival divides `1 - GALLERY_STAGGER` by
  // itself. Stepping by `GALLERY_STAGGER / (total - 1)` and adding it up instead
  // lands a hair under 1 in binary floating point — a last tile that is 99.99%
  // arrived on the last frame of its scene, which is invisible in a frame and
  // exactly the kind of thing a test asserts about.
  const start = GALLERY_STAGGER * (rank / (total - 1))
  return clamp01((at - start) / (1 - GALLERY_STAGGER))
}

/**
 * How far a tile's picture has drifted inside it at a given point of the scene,
 * as a percentage of the tile's own height.
 *
 * Linear and monotonic in `life`, which is what makes "this tile is somewhere
 * else on every frame" a claim a test can check — a sine would hold still for a
 * frame at each of its turning points, which is the one frame the whole rule is
 * about. Alternating by index so the grid drifts as a set of pictures and not as
 * one slab, which is the same movement as no movement at all.
 */
export function galleryTileTravel(index, life) {
  const direction = Math.max(0, Math.floor(Number(index) || 0)) % 2 === 0 ? 1 : -1
  return direction * GALLERY_TILE_TRAVEL * (2 * clamp01(life) - 1)
}

export const Gallery = ({ block, palette, theme, base, progress, life, images }) => {
  const ids = block.imageIds
  const { columns, rows } = galleryGrid(block.layout, ids.length)
  const gap = Math.round(base * GALLERY_GAP)
  const tile = galleryTileHeight(rows, base)
  const radius = Math.round(Math.max(0, Number(theme.radiusPx) || 0) * GALLERY_TILE_RADIUS)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        // `1fr` tracks over a height built from `galleryTileHeight`, so a row is
        // exactly the number the sharpness claim was measured on when the zone
        // is tall enough — and divides whatever it is given when it is not. The
        // same document is a band in a cell and a field under an anchor of
        // `full`, and neither of the two is the one this block was tuned for.
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap,
        width: '100%',
        maxWidth: '100%',
        height: tile * rows + (rows - 1) * gap,
        maxHeight: '100%',
        minHeight: 0,
        flex: '0 1 auto',
      }}
    >
      {ids.map((id, index) => {
        const arrival = galleryTileProgress(index, ids.length, progress)
        return (
          <div
            key={index}
            style={{
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
