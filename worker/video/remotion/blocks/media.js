/**
 * The arithmetic of the five blocks that carry a picture or a time —
 * `imageFrame`, `gallery`, `carousel`, `clock`, `dateStamp`.
 *
 * No React, no Remotion, no `three`. Same reason as `text.js`, `interface.js`,
 * `dataFigures.js` and `setPiece.js` next door: what a `.jsx` file computes is
 * what no test can reach, and every quantity in this family is one that fails
 * silently in an mp4 nobody previewed — a gallery laid out as a column inside a
 * band, a carousel whose tiles are the size of a frame nobody gave it, a dial
 * that occupies a fifth of the picture it was handed.
 *
 * ── The rule this file was rewritten to obey ────────────────────────────────
 *
 * A block inhabits the BOX it is given. The rule and its three clauses are at
 * the top of `composition.js`; what it meant here is that every number below
 * used to be a fraction of the FRAME's short edge — `CLOCK_SIZE = 0.2`,
 * `CAROUSEL_TILE = 0.3`, `GALLERY_BUDGET = 0.5` — so a clock anchored `full`
 * drew the same 216 px dial as a clock stacked three-deep in a corner, and six
 * real exports came back as a small element floating in a large void.
 *
 * The shape of the answer is the same in all five, and it is worth stating once
 * because it is what makes them agree with `blockExtent`:
 *
 *   1. the block's RUNS of text are measured first, with the shared type scale,
 *      at the unit its whole stack agreed on (`runBand`);
 *   2. everything left over goes to the FIELD — the picture, the grid, the
 *      strip, the dial. There is no third case, so a media block fills its box
 *      by construction rather than by a constant somebody tuned;
 *   3. the only quantities still read off the frame are the constant metrics
 *      `CONSTANT_METRICS` names — a hairline, a radius, a gutter — and each is
 *      bounded at `CONSTANT_CEILING` of the box it is drawn in, so a rule inside
 *      a tiny zone thins to fit instead of becoming the block.
 *
 * ── Determinism, which is a storage property here and not a taste ───────────
 *
 * Nothing in this file reads a clock or a die. `clock` and `dateStamp` are the
 * two blocks a reader would most expect to, and they must not: the export store
 * is content-addressed, so a film that differs between two renders is filed
 * twice, charged twice against the same disk budget, and impossible to
 * deduplicate. `blocks.test.js` scans this directory for `Date` and
 * `Math.random`; `clock.test.js` and `dateStamp.test.js` scan these two blocks'
 * own sources on top of it.
 */
import {
  COMPOSED_CELL_GAP,
  CONSTANT_CEILING,
  RUN_GAP,
  blockAppetite,
  blockShape,
  hairline,
  kenBurnsTransform,
  solveTypeUnit,
  textLines,
  typeRole,
  typeScale,
  typeSize,
} from '../composition.js'

// ── What all five share ──────────────────────────────────────────────────────

/** 0 to 1, for a clock this family is handed rather than one it computes. */
export const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0))

/** A box as two usable numbers, whatever arrived. Never negative, never NaN. */
export function boxSize(box) {
  return {
    width: Math.max(0, Math.round(Number(box?.width) || 0)),
    height: Math.max(0, Math.round(Number(box?.height) || 0)),
  }
}

/**
 * A constant metric, clamped into the box it is drawn in.
 *
 * The exception the file header names, applied: a hairline, a corner radius and
 * a gutter are the same OBJECT from one scene to the next, so they are read off
 * the frame rather than off a box — and each is bounded at a quarter of its box,
 * because an exception with no ceiling is the rule going back out of the window.
 * A 12 px radius on a 20 px strip is not a rounded corner, it is a lozenge.
 */
export function constantMetric(size, box) {
  const asked = Math.max(0, Math.round(Number(size) || 0))
  const { width, height } = boxSize(box)
  const room = Math.min(width, height)
  if (!(room > 0)) return asked
  return Math.max(0, Math.min(asked, Math.floor(room * CONSTANT_CEILING)))
}

/**
 * The gutter between two tiles of one picture block, in pixels.
 *
 * One number for the gallery and the carousel, deliberately: a grid of six
 * stills and a strip of six stills are the same film's spacing, and two
 * constants for it is the drift `composition.js` exists to prevent one level up.
 * Below `COMPOSED_CELL_GAP`, which separates two ZONES — tiles of one block
 * belong together in a way two zones do not.
 */
export const TILE_GUTTER = COMPOSED_CELL_GAP * 0.4

export function tileGutter(base, box) {
  return constantMetric((Number(base) || 0) * TILE_GUTTER, box)
}

/**
 * How far a media block rises as it arrives, in UNITS of its own type.
 *
 * In units and not in pixels off the frame, for the reason everything else in
 * this file changed: a travel of 22 px is a gesture under a full-frame gallery
 * and a lurch under a date stamp in a corner. Half a body line is the smallest
 * rise that reads as an arrival at any size.
 */
export const ENTER_RISE = 0.5

export function enterRise(unit, progress) {
  return (1 - clamp01(progress)) * ENTER_RISE * Math.max(0, Number(unit) || 0)
}

/**
 * The type unit this block reads: its stack's, or its own box's.
 *
 * `composedLayout` publishes one unit per zone and the composition passes it, so
 * the fallback is only reached when a block is drawn outside a composed scene or
 * when the two files disagree. Solving alone in the box is exactly what
 * `blockExtent` does in the same situation — a block set at a plausible size
 * beats a block set at `NaN` px, which is a scene piled at the origin (Q1).
 */
export function stackUnit(block, box, unit) {
  const at = Number(unit)
  if (Number.isFinite(at) && at > 0) return at
  const { width, height } = boxSize(box)
  return solveTypeUnit([blockShape(block)], width, height)
}

/**
 * One run of text, measured: its size, how many lines it takes across a measure,
 * and the BAND it costs the block — the lines plus the air above them.
 *
 * This is the half of "inhabit your box" that the field cannot do for itself.
 * A caption is not furniture: its height depends on how long the model's
 * sentence turned out to be and on how wide the zone turned out to be, and the
 * picture above it can only take what is left. Computing it here, off the same
 * `textLines` estimate `shapeHeight` used to size the box in the first place, is
 * what makes the two agree — a component that guessed a caption at two lines
 * where the layout had budgeted three draws a picture through the bottom of its
 * own box.
 *
 * `band` is 0 for an absent run, which is how an optional caption costs a block
 * nothing rather than costing it a blank line.
 */
/**
 * ── The tracking, and why these two blocks no longer have any ────────────────
 *
 * `BLOCK_APPETITE` is the authority on what a block's runs ARE, because it is
 * what sized the box in the first place. It declares a plain `body` run for
 * `dateStamp` and a plain `caption` run for `clock`, with no tracking — and a
 * letter-spacing this file added on top of that is a line 15% wider than the
 * box the layout measured for it. On a 16:9 field that was a date set at 295 px
 * inside a box built for 340, with 268 px of air underneath: the void this pass
 * removes, arriving through a decoration.
 *
 * `kicker` is the block that has tracking, and its row in the table says so.
 * That is the shape of the rule: a run is tracked when the table tracks it.
 */
export function runBand(text, role, unit, measure, tracking = 0) {
  const at = Math.max(0, Number(unit) || 0)
  const size = typeSize(role, at)
  const lines = textLines(text, size, measure, tracking)
  const height = Math.round(lines * size * typeRole(role).leading)
  const gap = Math.round(RUN_GAP * at)
  return { size, lines, gap, height, band: lines > 0 ? height + gap : 0 }
}

/**
 * `count` tracks and their gutters across a span, as start/size pairs that tile
 * it EXACTLY.
 *
 * The same arithmetic `split` performs on the zones of a frame, and here for the
 * same reason: each edge is rounded rather than each size, so the last track
 * ends on `round(span)` whatever happened in between. Rounding sizes instead
 * spends a pixel per track, and six of them put the right-hand tile of a gallery
 * past the edge of a box the safe area had promised nothing crosses.
 *
 * A gutter wider than the room is dropped rather than allowed to make a track
 * negative: a grid with no gaps beats a grid whose tiles have inverted widths,
 * which in CSS is a grid with no tiles at all (Q1).
 */
export function tracks(span, gap, count) {
  const total = Math.max(1, Math.floor(Number(count) || 0))
  const room = Math.max(0, Number(span) || 0)
  let g = Math.max(0, Number(gap) || 0)
  if ((total - 1) * g >= room) g = 0
  const track = (room - (total - 1) * g) / total
  return Array.from({ length: total }, (_, i) => {
    const from = i * (track + g)
    const at = Math.round(from)
    return { start: at, size: Math.max(0, Math.round(from + track) - at) }
  })
}

// ── imageFrame ───────────────────────────────────────────────────────────────

/**
 * The three treatments, as the two things that actually differ between them.
 *
 * `margin` is in GUTTERS and `panel` says whether a surface is painted behind
 * the picture. That is the whole of it, and the change from what was here before
 * is the point: `inset` used to be 88% of the measure and `card` 30% of the
 * frame's short edge, so a picture given the whole safe area drew itself at a
 * third of it. A treatment is a way of FRAMING a picture, never a way of
 * declining the box — the two fields a document may use to ask for less are
 * `DECLARED_SHARE`'s, and neither of them is here.
 *
 * So all three fill their box and differ in what surrounds the picture: `bleed`
 * meets the edges, `inset` stands off them by one gutter with the ground
 * showing, `card` stands off them by one gutter with a panel behind.
 */
const FRAME_FRAMING = {
  bleed: { panel: false, margin: 0, round: false },
  inset: { panel: false, margin: 1, round: true },
  card: { panel: true, margin: 1, round: true },
}

/**
 * A treatment this build knows, or the schema's own default.
 *
 * `Object.hasOwn` and normalised once, the way `anchorName` is: a plain lookup
 * answers for the prototype chain, so `treatment: "constructor"` would hand back
 * a function where a number was expected. The value was refused by `validate.js`
 * long before a frame, so reaching the fallback means two lists disagree — and a
 * picture drawn as a card beats a picture that vanished from a film somebody
 * waited for (Q1).
 */
export function frameTreatment(name) {
  return typeof name === 'string' && Object.hasOwn(FRAME_FRAMING, name) ? name : 'card'
}

/** The picture's corner, as a share of the project's declared radius. */
export const FRAME_INNER_RADIUS = 0.7

/**
 * How much of its box a caption may take before the picture starts paying for it
 * — half.
 *
 * Never reached by a legal document in a legal box: a caption is bounded at
 * `BLOCK_LIMITS.caption` and the layout sized the box for it. It is the
 * degradation for the case where the two disagree, and the direction matters —
 * a picture block whose picture has been squeezed to nothing is a picture block
 * that failed, whereas a caption clipped by a line is a caption (Q1).
 */
export const FRAME_CAPTION_CEILING = 0.5

/**
 * The camera move a framed picture makes: the house's one Ken Burns, at the
 * scene's own clock.
 *
 * `kenBurnsTransform` takes a frame and a length because the five monolithic
 * compositions are handed both; a block is handed `life`, the same quantity
 * already normalised. A length of two makes that function's own span one, so
 * `progressAt(life, 1)` is `life` itself and the transform is bit-for-bit the
 * one a slideshow scene gets at the same point of its own duration.
 *
 * A delegation and not a transform of its own, for the reason the whole of
 * `composition.js` exists: a second Ken Burns is a second answer to "how does a
 * picture move", and the two would be discovered to disagree by watching an mp4.
 * It is also what bounds the amplitude — a pan spends 4% of travel on a 12%
 * overscale, so every pixel visible at rest stays inside the frame for the whole
 * of it, and a block that rewrote the move at its own scale would be the one
 * place that guarantee could be lost.
 */
const ONE_SPAN = 2

export function framedMove(kind, life) {
  return kenBurnsTransform(kind, clamp01(life), ONE_SPAN)
}

/**
 * Every measurement of a framed picture, in pixels, from the box it was given.
 *
 * The picture takes the box less its margin and less the band its caption needs,
 * which is the whole of clause 2 in the header: runs first, field second, no
 * third case. The three sums below therefore reconstruct the box exactly —
 * `imageFrame.test.js` asserts that rather than trusting this sentence.
 */
export function imageFrameBox(block, box, unit, base, radiusPx) {
  const treatment = frameTreatment(block?.treatment)
  const framing = FRAME_FRAMING[treatment]
  const { width, height } = boxSize(box)
  const at = stackUnit(block, box, unit)
  const margin = framing.margin * tileGutter(base, box)
  const measure = Math.max(0, width - 2 * margin)
  const caption = runBand(block?.caption, 'caption', at, Math.max(1, measure))
  const band = Math.min(caption.band, Math.floor(height * FRAME_CAPTION_CEILING))
  const radius = framing.round ? constantMetric(radiusPx, box) : 0
  return {
    treatment,
    panel: framing.panel,
    width,
    height,
    // The card's padding and the inset's margin are one number: they draw the
    // same box and differ only in what is painted behind it.
    margin,
    radius,
    // A bleeding picture has no corner to round: the whole point of the
    // treatment is that it meets the edges of its box.
    pictureRadius: framing.round ? Math.round(radius * FRAME_INNER_RADIUS) : 0,
    picture: { width: measure, height: Math.max(0, height - 2 * margin - band) },
    caption: { ...caption, band },
    rise: at,
  }
}

// ── gallery ──────────────────────────────────────────────────────────────────

/**
 * The tile shape a grid aims for — square.
 *
 * A gallery is a set of pictures read as one object, and a set reads as a set
 * when its members are the same shape as each other and none of them is a
 * sliver. Square is where a `cover` crop treats a landscape source and a
 * portrait one equally badly, which for a block that cannot know what it was
 * handed is the right place to stand.
 */
export const GALLERY_TILE_AIM = 1

/**
 * How many rows a gallery of `count` pictures takes IN THIS BOX, and how many
 * pictures each row holds.
 *
 * This is the defect the user named in one sentence: three pictures in a wide
 * band are not three pictures in a column, and the table that answered
 * `columns = count <= 3 ? count : ...` could not tell the two apart because it
 * was never shown the box. So the split is chosen by measurement — for every
 * legal number of rows, the tiles that split implies are compared against
 * `GALLERY_TILE_AIM`, and the closest wins. A wide band comes back a row, a
 * narrow column comes back a stack, and four pictures in a square come back two
 * by two, which is what the old table said for the one case it was written for.
 *
 * The rows are BALANCED rather than filled greedily, which is what removes the
 * orphan: five pictures over two rows are three and two, never four and one, and
 * no cell is ever empty. That also means a row can be wider-tiled than its
 * neighbour, which is an editorial arrangement rather than a hole.
 *
 * `row` and `stack` are the document saying so, and they are honoured whatever
 * the box: a named arrangement is a thing a document is allowed to ask for, the
 * same way `kenBurns: 'static'` is. Anything this build does not know reads as
 * `grid`, the schema's own default (Q1).
 */
export function galleryRows(layout, count, box, gap = 0) {
  const total = Math.max(1, Math.floor(Number(count) || 0))
  if (layout === 'row') return [total]
  if (layout === 'stack') return Array.from({ length: total }, () => 1)

  const { width, height } = boxSize(box)
  const g = Math.max(0, Number(gap) || 0)
  let best = { rows: 1, cost: Infinity }
  for (let rows = 1; rows <= total; rows += 1) {
    const columns = Math.ceil(total / rows)
    const tile = {
      width: (width - (columns - 1) * g) / columns,
      height: (height - (rows - 1) * g) / rows,
    }
    // A ratio compared in logarithms, so a tile twice as wide as the aim and one
    // half as wide cost the same. Compared linearly, "too wide" is unbounded and
    // "too narrow" tops out at the aim itself, and every gallery in a landscape
    // box came back a stack.
    const cost =
      tile.width > 0 && tile.height > 0
        ? Math.abs(Math.log(tile.width / tile.height / GALLERY_TILE_AIM))
        : Infinity
    if (cost < best.cost) best = { rows, cost }
  }

  const base = Math.floor(total / best.rows)
  const extra = total % best.rows
  // The fuller rows first: a gallery that grows denser downwards reads as a
  // paragraph, and one that thins downwards reads as a heading. Neither is
  // wrong; being consistent is what stops two scenes of one film disagreeing.
  return Array.from({ length: best.rows }, (_, i) => base + (i < extra ? 1 : 0))
}

/**
 * One box per picture, tiling the gallery's own box exactly.
 *
 * Pixels and not `1fr` tracks, for the reason `composedLayout` gives about
 * percentages: a number a test can read is also a geometry a test can prove
 * nothing crosses — and "how much is this still about to be enlarged" is a
 * question the panel asks before anybody spends two minutes rendering, which a
 * number only a layout engine knows cannot answer.
 */
export function galleryTiles(layout, count, box, gap = 0) {
  const rows = galleryRows(layout, count, box, gap)
  const { width, height } = boxSize(box)
  const bands = tracks(height, gap, rows.length)
  const out = []
  rows.forEach((held, row) => {
    const columns = tracks(width, gap, held)
    for (const column of columns) {
      out.push({ left: column.start, top: bands[row].start, width: column.size, height: bands[row].size })
    }
  })
  return out.slice(0, Math.max(1, Math.floor(Number(count) || 0)))
}

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

// ── carousel ─────────────────────────────────────────────────────────────────

/**
 * The tile shape a strip aims for, and how many of them a frame may show.
 *
 * Portrait, and that is the difference between a carousel and a gallery: a strip
 * reads as a strip when the eye can hold three or four views at once, which
 * needs each of them narrower than it is tall. 0.62 puts three views across a
 * 16:9 safe area and one across a portrait column, both of which are the right
 * answer for the box they were given.
 *
 * The ceiling is what stops a shallow band from becoming a contact sheet: a
 * 200 px-tall strip across 1690 px would otherwise ask for thirteen views, each
 * of them a thumbnail nobody can read at 30 fps.
 */
export const CAROUSEL_TILE_AIM = 0.62
export const CAROUSEL_MAX_VISIBLE = 6

/**
 * How many views the box shows at once, and what one of them measures.
 *
 * Every number comes from the box: the view is as tall as the box, as wide as
 * its share of the measure, and the stride is one view and one gutter. What was
 * here before was `0.3 × the frame's short edge` whatever box it was handed, so
 * a carousel anchored `full` in a 16:9 frame drew five tiles across a strip
 * 259 px tall inside a zone 950 px tall — the void this pass is about, in the
 * one block whose whole subject is a horizontal measure.
 */
export function carouselView(box, gap = 0) {
  const { width, height } = boxSize(box)
  const g = Math.max(0, Number(gap) || 0)
  const aim = Math.max(1, height * CAROUSEL_TILE_AIM + g)
  const visible = Math.max(1, Math.min(CAROUSEL_MAX_VISIBLE, Math.round(width / aim)))
  const [track] = tracks(width, g, visible)
  const tile = { width: track.size, height }
  return { visible, tile, stride: tile.width + g }
}

/** How many tile widths the track advances over one scene. See the block's header. */
export const CAROUSEL_LOOPS = 1

/**
 * How many times the document's pictures are laid end to end.
 *
 * Enough that the strip still reaches past the far edge when the track has
 * travelled its whole length: the loop is seamless because there is another copy
 * of the same picture where the first one was, and never because anything jumps
 * back to the start. The window is an argument now rather than a constant,
 * because it is a property of the BOX — a wide band shows six views and a
 * portrait column shows one, and a bound written for the widest case is four
 * copies of a strip nobody can see.
 *
 * The `+ 1` is the partial view at the trailing edge: a whole number of views
 * fits exactly, so the pixel after the last one is the ground unless one more
 * tile is there.
 */
export function carouselCopies(count, visible) {
  const total = Math.max(1, Math.floor(Number(count) || 0))
  const window = Math.max(1, Math.floor(Number(visible) || 0))
  return Math.max(2, Math.ceil((total * CAROUSEL_LOOPS + window + 1) / total))
}

/**
 * Where the track sits at a given point of the scene, in VIEWS, signed.
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

// ── clock ────────────────────────────────────────────────────────────────────

/**
 * How many turns the sweep hand makes over one scene.
 *
 * `fast` is the schema's default, so it is also the fallback: the case you get
 * by saying nothing has to be the one that moves.
 *
 * The RATE is the thing this block cannot compute, and the reason is the same
 * one the carousel runs into: `life` is the scene's clock already normalised, so
 * degrees per second is not expressible here. `real` therefore spends the
 * quarter turn a real second hand makes in the longest scene the schema allows,
 * and `fast` spends three whole turns, which is time visibly passing. Neither is
 * a lie about a second, because nothing here claims to be counting them.
 */
export const CLOCK_SWEEP_TURNS = { real: 0.25, fast: 3 }

/** A digital face with no stated time says so. It never fills the gap from the host. */
export const CLOCK_BLANK = '--:--'

/**
 * The dial's own furniture, as shares of the DIAL and never of the frame.
 *
 * That is the whole change in this block: a rim of `0.004 × the short edge` was
 * 4 px under a dial of 216 px and 4 px under a dial of 950 px, so a clock given
 * the frame came back as a hairline circle. A rim is part of the drawing, not a
 * constant metric — it is not the same object from one scene to the next, it is
 * this dial's edge — so it scales with what it is drawn on.
 */
export const CLOCK_RIM = 0.02
export const CLOCK_TICK = 0.0125
export const CLOCK_TICK_LENGTH = 0.06
export const CLOCK_HAND = { hour: 0.3, minute: 0.42, sweep: 0.46 }
export const CLOCK_HAND_WIDTH = { hour: 0.025, minute: 0.0175, sweep: 0.01 }

/** How present the twelve ticks are beside the hands. An ornament may fade; a run may not. */
export const CLOCK_TICK_ALPHA = 0.55

/** The sweep dot's orbit and its size, in ems of the digits it turns under. */
export const CLOCK_ORBIT_EM = 0.55
export const CLOCK_DOT_EM = 0.1

/**
 * Where the three hands point, in degrees clockwise from twelve.
 *
 * The two that carry the stated time are read off the document and nothing else,
 * and they ADVANCE with the sweep: a clock whose second hand turns under a
 * minute hand nailed to its mark is a clock nobody believes. One turn of the
 * sweep is one minute, so it is six degrees of minute hand and half a degree of
 * hour hand — the gearing of a real movement, which costs two multiplications.
 *
 * The split is a `split(':')` and not the schema's own regular expression: the
 * value arrived validated three times over and copying the rule here would make
 * a fourth reader of it. What this needs to know is whether the document stated
 * anything at all, which is the `null` the schema itself writes.
 */
export function clockHands(time, sweep, life) {
  const at = clamp01(life)
  const turns = Object.hasOwn(CLOCK_SWEEP_TURNS, String(sweep)) ? CLOCK_SWEEP_TURNS[sweep] : CLOCK_SWEEP_TURNS.fast
  const parts = typeof time === 'string' ? time.split(':') : []
  const hours = Number(parts[0])
  const minutes = Number(parts[1])
  const stated = parts.length === 2 && Number.isFinite(hours) && Number.isFinite(minutes)
  const swept = at * turns
  return {
    stated,
    sweep: swept * 360,
    minute: (stated ? minutes : 0) * 6 + swept * 6,
    hour: (stated ? hours % 12 : 0) * 30 + (stated ? minutes : 0) * 0.5 + swept * 0.5,
  }
}

/**
 * Every measurement of a clock, in pixels, from the box it was given.
 *
 * The label is the block's one RUN, so it is measured first with the stack's own
 * unit; everything left is the face. An analog dial is the largest circle that
 * fits what remains, and a digital face is the largest line of digits that fits
 * it — the two are the same claim about the same room, which is why they share a
 * function and why `clock.test.js` can assert that neither of them leaves the
 * box.
 *
 * The digits are solved against the room rather than at the stack's unit, and
 * the reason is `BLOCK_APPETITE`: `clock` declares six units of furniture and
 * exactly one run, the label. The face is that furniture — it is the dial, drawn
 * with numerals instead of hands — so it takes the room the way a dial does. A
 * digital face set at the body step would be a clock occupying two lines of a
 * box sized for six.
 */
export function clockFace(block, box, unit, base) {
  const { width, height } = boxSize(box)
  const at = stackUnit(block, box, unit)
  const label = runBand(block?.label, 'caption', at, Math.max(1, width))
  const room = Math.max(0, height - label.band)
  const size = Math.max(0, Math.min(width, room))

  const hand = (name) => ({
    length: Math.round(size * CLOCK_HAND[name]),
    width: Math.max(1, Math.round(size * CLOCK_HAND_WIDTH[name])),
  })
  const stated = clockHands(block?.time, block?.sweep, 0).stated
  const digits = typeScale('display', stated ? block?.time : CLOCK_BLANK, { width, height: room }, {
    nowrap: true,
  })
  return {
    label,
    room,
    size,
    rim: Math.max(1, Math.round(size * CLOCK_RIM)),
    tick: Math.max(1, Math.round(size * CLOCK_TICK)),
    tickLength: Math.round(size * CLOCK_TICK_LENGTH),
    hour: hand('hour'),
    minute: hand('minute'),
    sweep: hand('sweep'),
    // A digital face is the digits and nothing else, so the line box is the room
    // it was given: the block fills its box on the one axis a line of type can.
    digits,
    orbit: Math.round(digits * CLOCK_ORBIT_EM),
    dot: Math.max(2, Math.round(digits * CLOCK_DOT_EM)),
    // The hairline is the one number here that is a constant metric, and it is
    // the underline of a digital face: the same rule under every clock of a film.
    rule: hairline(base, box),
    rise: at,
  }
}

// ── dateStamp ────────────────────────────────────────────────────────────────

/** How much wider than tall the box's padding runs. A stamp is a horizontal object. */
export const DATE_PAD_RATIO = 1.8

/** How present the track is under the head. An ornament may fade; a run may not. */
export const DATE_TRACK_ALPHA = 0.35

/** How much of the measure the travelling head covers, in percent. */
export const DATE_HEAD_PERCENT = 24

/**
 * Where the accent head sits at a given point of the scene, in percent of the
 * measure.
 *
 * `plain` has no track, so its head grows from nothing to the whole measure: the
 * rule draws itself, which is a treatment that starts bare and ends underlined
 * rather than a second `rule`. The other two have a track already, so the head
 * is a fixed length travelling along it.
 *
 * Both are linear and monotonic in `life`, deliberately. A head that eased would
 * be a twenty-eighth notion of how things move, and one that oscillated would
 * hold still for a frame at each turning point — which is the single frame the
 * rule about immobility is about.
 */
export function dateStampHead(treatment, life) {
  const at = clamp01(life)
  if (treatment === 'plain') return { left: 0, width: 100 * at }
  return { left: at * (100 - DATE_HEAD_PERCENT), width: DATE_HEAD_PERCENT }
}

/**
 * Every measurement of a date stamp, in pixels, from the box it was given.
 *
 * The type is the whole block, so it is solved against the box with the stack's
 * unit — `typeScale` with `nowrap`, because a date broken over two lines is not
 * a date, and because that is what makes the size fall back to the measure when
 * the box is narrower than the line.
 *
 * The furniture is then everything the box has left, which is the exact
 * arithmetic `BLOCK_APPETITE.dateStamp.fixed` budgeted for it — 0.6 of a body
 * line. Taking the remainder rather than re-deriving that number is what makes
 * the block fill its box even when the two disagree, and it is one subtraction
 * instead of a constant somebody would have to keep equal to a table one file
 * over.
 *
 * The remainder is CAPPED at that budget, and the case is the one place this
 * block cannot grow into a box: a date is one line that cannot wrap, so once the
 * measure has fixed its size, a taller box buys nothing. Left uncapped, a stamp
 * handed a box twice its own height put the whole difference under its rule —
 * 380 px of air below eleven characters, which is a void of a different shape
 * and not a fix. Capped, the block is its own size and the zone's alignment
 * centres it, which is what `ComposedSceneVideo` wraps every block for.
 */
export function dateStampBox(block, box, unit, base, radiusPx) {
  const { width, height } = boxSize(box)
  const at = stackUnit(block, box, unit)
  // No tracking, and the note above `runBand` is why: `BLOCK_APPETITE` declares
  // a plain body run for this block, and a letter-spacing the layout did not
  // measure is a line wider than the box it was sized for.
  const size = typeScale('body', block?.text, { width, height }, { nowrap: true, unit: at })
  const line = Math.round(size * typeRole('body').leading)
  const rule = hairline(base, box)
  const furniture = Math.max(0, Math.min(height - line, Math.round(blockAppetite('dateStamp').fixed * at)))
  const boxed = block?.treatment === 'boxed'
  // Boxed spends its furniture above AND below the line, the other two spend it
  // all under the line as the air a rule needs to read as a rule rather than as
  // an underline. Same total either way, which is what keeps the block filling
  // the box whichever treatment the document asked for.
  const padY = boxed ? Math.max(0, Math.floor((furniture - rule) / 2)) : 0
  return {
    boxed,
    size,
    line,
    rule,
    padY,
    padX: boxed ? Math.round(padY * DATE_PAD_RATIO) : 0,
    gap: boxed ? 0 : Math.max(0, furniture - rule),
    radius: boxed ? constantMetric(radiusPx, box) : 0,
    width,
    height,
    rise: at,
  }
}
