/**
 * The one round dot the two point clouds share.
 *
 * ── The defect this file is named after ─────────────────────────────────────
 *
 * `particleField` and `globe` both draw with `<points>`, and both shipped with
 * this note in place of a texture: *"square points, because a round one needs a
 * texture or a shader — the first is an asset nobody staged and the second is a
 * colour nobody measured — and at these sizes a square reads as a mote."*
 *
 * A rendered frame says otherwise. At 1080p a particle is eight to fourteen
 * device pixels across and a globe's land dot is five to nine, and what a
 * hard-edged axis-aligned square of that size reads as is not a mote: it reads
 * as a PIXEL, which is the single word the user of this feature used about the
 * whole family. Two crops — a dust cloud and a turning globe — were enough.
 *
 * ── Why the objection was wrong on both halves ──────────────────────────────
 *
 * It is not an ASSET. There is no file: the mask is drawn, here, by the browser
 * that is already drawing the frame — the same move `extrudedType` makes to get
 * a line of type into a scene without shipping a converted outline dump. A
 * `<canvasTexture>` is `THREE.CanvasTexture` resolved by the reconciler from a
 * lower-case string, exactly as `<points>` is, so this directory's rule against
 * importing `three` survives intact.
 *
 * And it is not a COLOUR. Every pixel drawn below is WHITE and only its alpha
 * varies: `PointsMaterial` multiplies the map by `material.color`, so what
 * reaches the frame is exactly `palette.accent.color` at exactly the opacity the
 * block already set — the same value, in the same places, with the corners of
 * the square taken off. A mask that carried a hue would be the objection's
 * second half and it would be right; this one carries a SHAPE.
 *
 * ── Why a canvas and not a `<dataTexture>` of computed bytes ────────────────
 *
 * That was the first version, and it is worth writing down because it looked
 * strictly better: a `Uint8Array` filled by twelve lines of arithmetic is
 * testable, needs no `document`, and is bit-identical on every machine rather
 * than merely on every build of one browser. It rendered EMPTY FRAMES — both
 * clouds, no error in the browser log, not even with a mask made entirely of
 * opaque white texels, and drawing came back the moment the child was removed.
 * A `<canvasTexture>` in the same position is what `extrudedType` has always
 * used and it works, so this file uses the mechanism this repository has a
 * rendered frame for, rather than the one that reads better.
 *
 * The determinism that buys back is real but small: this container runs one
 * pinned Chromium, `extrudedType` already rasterises every glyph of every
 * 3D title through it, and a store keyed on content would have noticed long
 * before a dot did.
 *
 * ── What it costs ───────────────────────────────────────────────────────────
 *
 * One 32 × 32 texture for the whole bundle — built once, shared by both blocks
 * and all three clouds, because nothing writes to it. 4 KiB of GPU memory and a
 * sampler fetch per fragment, on a family whose fragments are a few dozen pixels
 * each. Measured against the same 10 s films as the rest of this module, it is
 * inside the noise of a repeated run.
 */

/**
 * How many pixels across the mask is.
 *
 * A power of two, because a non-power-of-two texture forces `ClampToEdge` and
 * `LinearFilter` on some drivers and silently disables mipmapping on others —
 * none of which we want decided by the machine. 32 is chosen against the DRAWN
 * size rather than for tidiness: the largest dot this catalogue produces is
 * about sixteen device pixels across, so a 32-pixel mask is two texels per pixel
 * at the worst case, and the filter has something to interpolate instead of
 * something to invent.
 */
export const SPRITE_SIDE = 32

/**
 * How much of the mask the disc leaves as margin, as a share of the half-width.
 *
 * Not zero. A circle drawn edge to edge is a circle whose antialiased rim is the
 * outermost row of texels, and `ClampToEdge` then smears that rim outwards when
 * the sprite is magnified — a faint square halo, which is the defect coming back
 * through the fix. One sixteenth is under a device pixel at the drawn sizes
 * above and it costs the dot nothing anybody can measure.
 */
export const SPRITE_MARGIN = 0.0625

/**
 * How much LARGER a round dot has to be drawn to weigh what the square weighed.
 *
 * Both sizes in this family were calibrated against a rendered frame while the
 * point was a square — `particleSize` against the encoder's bitrate,
 * `globeDotPx` against the pitch of the land lattice — and a disc inscribed in
 * that square covers `π/4` of it, so the same number is now 21% less ink. The
 * first frames after the mask went in were visibly lighter than the ones the
 * calibration was signed off on.
 *
 * `2/√π` is the side of the square whose inscribed disc has the AREA of the old
 * square, which is the quantity both calibrations were really about: it leaves
 * the covered fraction of the frame exactly where it was, so the bitrate
 * argument behind `particleSize`'s ceiling survives the change untouched — and
 * an antialiased rim is easier for h264 than a hard one, not harder.
 *
 * It lives here rather than in the two arithmetic files because it is a fact
 * about the MASK: change the shape drawn above and this is the number that has
 * to move with it, in one place instead of in two families.
 */
export const SPRITE_AREA_GAIN = 2 / Math.sqrt(Math.PI) / (1 - SPRITE_MARGIN)

/**
 * The mask, drawn once for the whole bundle, or `null` outside a browser.
 *
 * A module constant and not a per-render call, and that is not a
 * micro-optimisation: both blocks rebuild their tree on every one of a film's
 * frames, and react-three-fiber compares `args` BY IDENTITY — a fresh canvas
 * would be a fresh `CanvasTexture` thirty times a second, each one disposing the
 * last.
 *
 * `null` when there is no `document`, which means Mocky's own vitest suite has
 * loaded the registry rather than a render running. The blocks then draw the
 * square they always drew, which is the right degradation (Q1): nothing in that
 * suite looks at a frame, and a module that threw at import time would take
 * `blocks.test.js` down with it.
 */
export const SPRITE_CANVAS = drawSprite()

/** The `args` a `<canvasTexture>` takes, or `null`. Stable for the same reason. */
export const SPRITE_ARGS = SPRITE_CANVAS ? Object.freeze([SPRITE_CANVAS]) : null

function drawSprite() {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = SPRITE_SIDE
  canvas.height = SPRITE_SIDE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  // White, and only white: the colour is the material's and this file has none.
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(SPRITE_SIDE / 2, SPRITE_SIDE / 2, (SPRITE_SIDE / 2) * (1 - SPRITE_MARGIN), 0, Math.PI * 2)
  ctx.fill()
  return canvas
}
