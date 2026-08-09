/**
 * The arithmetic of the two set pieces and of the one title that plays with its
 * letters — `funTitle`, `codeBlock`, `solidScene`.
 *
 * No React, no Remotion, no `three`. Same reason as `text.js`, `interface.js`
 * and `dataFigures.js` next door: what a `.jsx` file computes is what no test
 * can reach, and the three things this file works out are exactly the three that
 * fail silently in an mp4 nobody previewed — a title bent off its own zone, a
 * line of code half typed at the cut, and a solid that turned by a whole number
 * of quarter-turns and came back looking still.
 *
 * The `three` exclusion is the one worth stating twice. `solidScene` is the only
 * block whose renderer is a dependency, and if this file imported it, this file
 * would stop loading inside Mocky's own vitest suite — where `three` is no more
 * installed than Remotion is. Everything here is numbers: the geometry ARGUMENTS
 * for a mesh, not the mesh.
 *
 * ── Every size below comes from the BOX, and that is the rewrite ────────────
 *
 * These three used to size themselves on `base`, the frame's short edge:
 * `FUN_TITLE_SIZE = 0.088`, `CODE_SIZE = 0.03`, a canvas clamped at `base`. A
 * block that reads the frame draws the same thing whether it was given a third of
 * a column or the whole safe area, which is the defect the rule at the top of
 * `composition.js` is written about and which six real exports showed on every
 * scene. So the type is a step on the one shared scale — solved per stack, handed
 * down as `unit` — and the panel, the canvas and the headroom are shares of the
 * box the layout published for that block.
 */
import {
  CONSTANT_CEILING,
  LINE_SAFETY,
  MEAN_MONO_EM,
  RUN_GAP,
  DECLARED_SHARE,
  blockAppetite,
  typeRole,
  typeScale,
  typeSize,
} from '../composition.js'

/** A positive length in pixels, or 0. `composedLayout` guarantees it; a hand-built test does not. */
const px = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

// ── funTitle ─────────────────────────────────────────────────────────────────

/** How far apart the letters of a `stagger` are, as a share of the arrival. */
const LETTER_SPAN = 0.55

/**
 * The three amplitudes, as shares of the type size — and all three are bounded by
 * one thing.
 *
 * `funTitleHeadroom` is the room the block reserved out of its own appetite, and
 * it is 0.9 of a body unit against a display step of 2.4, so a lift may not
 * exceed 0.9 / 2.4 = 0.375 of the type size. Past that a letter travels through
 * the top of its box and over whatever the zone above it holds — which nothing in
 * a frame can be asked about afterwards, since the box is where the layout stops
 * being checkable. `setPiece.test.js` holds the inequality at every unit, and the
 * margin below it is what absorbs the rounding of two independent `Math.round`s.
 *
 * Every one of them is NEGATIVE in `funTitleLetter`: a letter arrives from above
 * and lifts upwards, never downwards. That is not a taste — one padding can only
 * cover one direction, and a downward entrance would need a second one, which is
 * furniture the appetite did not buy.
 */
const ARC_RISE = 0.35
const BOUNCE_RISE = 0.3
const STACK_RISE = 0.35

/**
 * How many times the bounce's wave crosses the line in one scene.
 *
 * Not a whole number, for `solidSpin`'s reason one section down: a wave that
 * completed an exact number of passes would put the last frame of a scene on the
 * same phase as its first, which is a block that ends where it started in a film
 * whose whole rule is that nothing holds still.
 */
const BOUNCE_CROSSINGS = 2.4

/** How far behind its neighbour a letter hops. This is what makes it a wave and not a jump. */
const BOUNCE_LAG = 0.055

/**
 * What share of a crossing one letter spends off the baseline.
 *
 * The rest of the time it is ON the baseline, at exactly zero, and that is the
 * whole of the fix below.
 */
const BOUNCE_HOP = 0.34

/** How wide `stretch` opens the tracking at rest, in em. */
const STRETCH_TRACKING = 0.26

/** The shadowed copy's offset, as a share of the type size. */
const STACK_OFFSET = 0.07

/**
 * The size a fun title is set at, in its own box.
 *
 * `display`, the same step every other headline in the catalogue takes, solved
 * against the stack's own unit — so a `funTitle` beside a `heading` is one step
 * of one scale and not two fractions of a frame. It used to be a ramp of its own
 * (0.088 of the short edge down to 0.044 past fourteen characters), which is the
 * `verticalCaptionSize` lesson written a third time: a size tuned for the longest
 * legal line renders every short one timid, and the box already knows the answer.
 * `typeScale` takes the length and the wrapping into account, so what the ramp was
 * approximating is now measured.
 */
export function funTitleSize(text, box, unit) {
  return typeScale('display', text, box, { unit })
}

/**
 * The line box a fun title sets its type in.
 *
 * The display role's own leading, read back rather than typed: the component used
 * to set 1.12 against the scale's 1.08, and a 4% difference on two lines of type
 * 340 px tall is 27 px of a block through the bottom of a box that was divided on
 * the other number.
 */
export const FUN_TITLE_LEADING = typeRole('display').leading

/**
 * The room a treatment needs above the line, in pixels.
 *
 * The arc lifts its outer letters by `ARC_RISE` of the type size and the bounce
 * lifts one of them by `BOUNCE_RISE`; a title drawn with no headroom puts that
 * lift through the top of its own box, over whatever the zone above it holds.
 * It is `BLOCK_APPETITE.funTitle.fixed` read back rather than a number typed here
 * for the reason the two share tables collapsed into `DECLARED_SHARE`: the
 * appetite is what `stackIn` divided the zone by, so a block reserving anything
 * else is a block drawing a height the layout did not allot it.
 */
export function funTitleHeadroom(unit) {
  return Math.round(px(unit) * blockAppetite('funTitle').fixed)
}

/** The letters of a line, spaces included, so a per-letter transform keeps the word gaps. */
export function funTitleGlyphs(text) {
  return Array.from(String(text ?? ''))
}

/**
 * One letter's own arrival within the line's.
 *
 * The same shape `staggerRamp` gives a wordmark: the first letter uses the whole
 * arrival, the last one uses the tail. A line whose letters all arrived together
 * is a line that faded in, which is the entrance `easeOutCubic` was brought in to
 * stop being the only one.
 */
export function letterAt(count, index, progress) {
  const n = Math.max(1, count)
  const span = LETTER_SPAN / n
  const start = (index / n) * LETTER_SPAN
  const p = (Number(progress) || 0) - start
  return Math.max(0, Math.min(1, p / Math.max(span, 1 - LETTER_SPAN)))
}

/**
 * How far off the baseline the bounce has lifted one letter — 0 for most of the
 * scene, and exactly 0, which is the defect this function exists to have fixed.
 *
 * `bounce` is the DEFAULT treatment, so it is what a silent document gets, and it
 * was a sine of the scene's clock phase-shifted by the letter's index. A sine is
 * never zero for two letters at once: the word was permanently crooked — every
 * letter parked at its own height, on every frame, including the ones nobody was
 * looking at the motion in — and a title whose baseline zigzags reads as a broken
 * render rather than as a bounce. It was the treatment a model gets by saying
 * nothing, which is the `kenBurns: 'static'` lesson from the other end: the case
 * you get for free has to be the good one.
 *
 * A travelling HOP is what a bounce actually is. A letter is on the baseline
 * until the wave reaches it, arcs once, and lands back on it — so the word is
 * straight except where the wave is passing, and every letter shares one baseline
 * the moment it has landed. `sin(π·φ)` over the window is zero at both of its
 * ends, so a letter neither jumps to its lift nor drops off it.
 */
export function bounceLift(index, life) {
  const t = Number(life) || 0
  const i = Math.max(0, Math.floor(Number(index) || 0))
  const cycle = t * BOUNCE_CROSSINGS - i * BOUNCE_LAG
  // `- Math.floor` and not `%`: a negative phase in JavaScript stays negative,
  // which would put the letters at the head of the line outside the window for
  // the whole first crossing and start the wave in the middle of the word.
  const phase = cycle - Math.floor(cycle)
  return phase < BOUNCE_HOP ? Math.sin((Math.PI * phase) / BOUNCE_HOP) : 0
}

/**
 * Where a letter sits, per treatment.
 *
 * Everything is returned as a NUMBER — a rise in pixels, a rotation in degrees,
 * a tracking in em, an opacity — and the `.jsx` file turns those into a
 * transform. That split is what lets `setPiece.test.js` ask whether a title moved
 * without a browser, and it is the same split `sceneMotion` makes one level up.
 *
 * `life` is in here as well as `progress`, and not as decoration: `bounce` keeps
 * moving for the whole scene. A title whose only motion is its entrance is drawn
 * in nine frames and frozen for the four hundred after them, which is the still
 * frame `DEFAULT_KEN_BURNS` exists to refuse, arriving through a block instead of
 * through a camera.
 *
 * Four of the five leave every letter at `rise: 0` and `turn: 0` once it has
 * arrived — one baseline, which is what a line of type is. `arc` is the one
 * exception and it is the treatment's whole content: a curve somebody asked for,
 * symmetric about the middle of the line, rather than the accidental zigzag
 * `bounceLift` is a long comment about.
 */
export function funTitleLetter(treatment, count, index, progress, life, size) {
  const at = letterAt(count, index, progress)
  const n = Math.max(1, count)
  // -1 at the first letter, +1 at the last: the line's own axis, so a treatment
  // reads the same on three letters and on forty.
  const across = n === 1 ? 0 : (index / (n - 1)) * 2 - 1

  switch (treatment) {
    case 'arc':
      return {
        opacity: at,
        // The ends rise and the middle sits: an arc, drawn with a rise and a
        // rotation per letter rather than with a path. A path would be an SVG
        // `textPath`, which needs the glyph outlines this container has no way
        // to measure, and measuring them wrong is a title off its own baseline.
        rise: -(1 - across * across) * size * ARC_RISE * at,
        turn: across * 14 * at,
        tracking: 0,
        scale: 1,
      }
    case 'bounce':
      return {
        opacity: at,
        // Two terms and they answer two different questions: the hop is the
        // treatment, the `(1 - at)` is the entrance — the letter drops onto the
        // baseline it will then share with every other one.
        rise: -(bounceLift(index, life) * at + (1 - at)) * size * BOUNCE_RISE,
        turn: 0,
        tracking: 0,
        scale: 1,
      }
    case 'stretch':
      return {
        opacity: at,
        rise: 0,
        turn: 0,
        // Opens from nothing to the full tracking, so the line grows into its
        // measure instead of appearing at it.
        tracking: STRETCH_TRACKING * at,
        scale: 1,
      }
    case 'swap':
      return { opacity: at, rise: 0, turn: 0, tracking: 0, scale: 0.86 + 0.14 * at }
    case 'stack':
    default:
      // It settles ONTO the baseline from above, like the bounce's own entrance,
      // rather than rising to it from below. See the note on the three
      // amplitudes: the block reserved its room on one side, and that side is the
      // top — an entrance travelling the other way needs a padding nobody bought.
      return { opacity: at, rise: -(1 - at) * size * STACK_RISE, turn: 0, tracking: 0, scale: 1 }
  }
}

/** The shadowed copy's offset in pixels, for `stack`. Zero for every other treatment. */
export function funTitleShadow(treatment, size, progress) {
  return treatment === 'stack' ? Math.round(size * STACK_OFFSET * (Number(progress) || 0)) : 0
}

/**
 * Which letters `swap` paints in the accent: the last word.
 *
 * The last word and not a field, for the reason `sceneLabel` is not a field: a
 * word chosen by a model out of a line it cannot see rendered is a guess about a
 * frame, and this one costs a string to bound, mirror and validate. The last word
 * is what `AnimatedTitlesVideo` already stresses, so the two agree by
 * construction.
 */
export function funTitleAccentFrom(text) {
  const line = String(text ?? '')
  const at = line.trimEnd().lastIndexOf(' ')
  return at === -1 ? 0 : at + 1
}

// ── codeBlock ────────────────────────────────────────────────────────────────

/** The share of the block's arrival each line of a `lines` reveal gets. */
const LINE_SPAN = 0.7

/** The caret's height and its offset, as shares of the type size. */
export const CODE_CARET = 0.55

/** How much of one monospace character a line of `n` of them takes, per pixel of type size. */
const MONO_ADVANCE = MEAN_MONO_EM * LINE_SAFETY

/**
 * The panel, in the box the layout gave it.
 *
 * ── The two things a panel of code has to get right ─────────────────────────
 *
 * It has to FILL its box, and the type has to come DOWN as the listing grows.
 * Both used to be one number — `CODE_SIZE = 0.03` of the frame's short edge,
 * ramped by the longest line — so a two-line snippet and a ten-line one were set
 * at the same size, the panel was as tall as the lines happened to make it, and a
 * `codeBlock` alone on a frame was a small grey card in the middle of it.
 *
 * Now both fall out of the box:
 *
 *   - the stack's `unit` was solved by `stackIn` so that the WHOLE block fits its
 *     zone, and `BLOCK_APPETITE.codeBlock` counts every line as a `body` run, so
 *     ten lines land at a smaller unit than two — the type comes down with the
 *     line count because the box did not grow;
 *   - and the measure caps it: a line of code cannot wrap (a break nobody wrote
 *     is a different program on the screen), so the longest line plus the panel's
 *     own padding has to fit the box's width. That is the `shapeCeiling` argument,
 *     computed here with the padding in it — which `blockExtent` cannot do, since
 *     it does not know a panel has any.
 *
 * The furniture budget is `BLOCK_APPETITE.codeBlock.fixed` and it is SPLIT rather
 * than added to: a caption takes its share of the padding instead of being drawn
 * on top of it, so a captioned panel and a bare one both draw the height the
 * layout allotted. A block that quietly drew 1.4 units more than its appetite is
 * a stack that overflows its zone with nothing saying so.
 */
export function codeMetrics(block, box, unit) {
  const lines = Array.isArray(block?.lines) ? block.lines : []
  const width = px(box?.width)
  const longest = lines.reduce((max, l) => Math.max(max, String(l?.text ?? '').length), 1)
  const furniture = blockAppetite('codeBlock').fixed

  // The size the stack agreed on, and the size the measure allows — the smaller.
  // `longest * advance + furniture` because the padding is a share of the SIZE
  // too, so both sides of the inequality scale with it and it solves in one line.
  //
  // Either may be absent, and neither absence is a throw: a block handed no unit
  // takes the measure's answer, a block handed no box takes the stack's, and a
  // block handed neither sets one pixel of type rather than `NaN` of it — which
  // is a panel piled at the origin (Q1).
  const capped = width > 0 ? width / (longest * MONO_ADVANCE + furniture) : Infinity
  const asked = px(unit) > 0 ? typeSize('body', unit) : capped
  const solved = Math.min(asked, capped)
  const size = Number.isFinite(solved) ? Math.max(1, Math.round(solved)) : 1

  const pad = Math.round((size * furniture) / 2)
  const captionSize = block?.caption ? typeSize('caption', unit) : 0
  const captionGap = captionSize ? Math.round(px(unit) * RUN_GAP) : 0
  // The caption is paid for out of the same budget, never on top of it. When it
  // asks for more than the budget holds the padding goes to zero rather than the
  // panel growing: a tight panel is a frame somebody can still read (Q1).
  const captionBlock = captionSize ? Math.round(captionSize * typeRole('caption').leading) + captionGap : 0
  const padY = Math.max(0, Math.round((size * furniture - captionBlock) / 2))

  // The body leading, plus the air `shapeHeight` puts BETWEEN two runs of one
  // block — `RUN_GAP`, once per gap, spread over the lines. Without it the panel
  // draws `n × 1.4` of type inside a box the layout divided on `n × 1.4 + (n−1) ×
  // 0.35`, so a listing of ten lines sat in 85% of its own box with the rest
  // empty: the void this whole pass is about, arriving through a leading.
  const gaps = lines.length > 1 ? (RUN_GAP * (lines.length - 1)) / lines.length : 0
  const lineHeight = Math.round(size * (typeRole('body').leading + gaps))
  const measure = Math.round(longest * MONO_ADVANCE * size)

  return {
    size,
    /** The side padding, and the top and bottom one, which the caption eats into. */
    pad,
    padY,
    captionSize,
    captionGap,
    captionLeading: typeRole('caption').leading,
    lineHeight,
    /** The panel's own dimensions: it fills the width whenever the measure is what capped the type. */
    width: Math.min(width || Infinity, measure + 2 * pad),
    height: 2 * padY + captionBlock + lines.length * lineHeight,
  }
}

/**
 * The panel's corner radius: the project's own, bounded by the panel it rounds.
 *
 * A radius is one of the three `CONSTANT_METRICS` — it comes off the theme rather
 * than off a box, because a corner that grew with its card is a card that changed
 * shape from one scene to the next. What the same paragraph of `composition.js`
 * says in the next breath is that the exception has a CEILING, and this block was
 * the one place in the catalogue that did not apply it: `codeBlock.jsx` wrote
 * `borderRadius: theme.radiusPx` raw while `button`, `form`, `notification`,
 * `gallery` and `carousel` all clamp theirs.
 *
 * That is reachable rather than theoretical. `ThemeSchema` accepts a whole number
 * of pixels up to 9999 and `parseDesignSpec` reads whatever a direction stated, so
 * a design that says 40 px — which is an ordinary "generous corners" — drew a
 * three-line snippet as a lozenge, and a larger one drew an ellipse with code in
 * it. Measured on the panel's own two dimensions rather than on the block's box,
 * because the panel is what has the corner: it is as wide as its measure, which
 * on a short listing is a good deal narrower than the box it sits in.
 */
export function panelRadius(radiusPx, panel) {
  const room = Math.min(px(panel?.width), px(panel?.height))
  const asked = Math.max(0, Math.round(Number(radiusPx) || 0))
  return Math.max(0, Math.min(asked, Math.floor(room * CONSTANT_CEILING)))
}

/**
 * How much of each line is visible.
 *
 * Two reveals, and they are two different films. `lines` brings a line in whole,
 * one after another, which is code being READ; `type` writes it out character by
 * character, which is code being WRITTEN. The second is why this returns a
 * character count rather than an opacity — a half-typed line is the frame the
 * `typewriter` block already makes, and doing it with an opacity would be a fade
 * pretending to be typing.
 *
 * Both finish before the block's arrival does, never at the cut: `LINE_SPAN`
 * leaves the tail, for the reason `cueFrames` leaves `MIN_CUE_TAIL_FRAMES`. Code
 * that finishes typing on the last frame of its scene is code nobody read.
 */
export function codeReveal(lines, reveal, progress) {
  const list = Array.isArray(lines) ? lines : []
  const p = Math.max(0, Math.min(1, Number(progress) || 0))
  const n = Math.max(1, list.length)
  if (reveal === 'type') {
    // The whole panel is one stream of characters, so a long line takes longer
    // than a short one — which is what typing is. Measured per line, a
    // three-character line and a sixty-character one would take the same beat.
    const total = list.reduce((sum, l) => sum + String(l?.text ?? '').length, 0)
    let budget = Math.round((total * Math.min(1, p / LINE_SPAN)))
    return list.map((l) => {
      const length = String(l?.text ?? '').length
      const shown = Math.max(0, Math.min(length, budget))
      budget -= length
      return { chars: shown, opacity: shown > 0 ? 1 : 0 }
    })
  }
  // The STARTS are spread so the LAST line ends exactly at `LINE_SPAN`, rather
  // than the starts being spread over it and the last line finishing past it.
  // Written the other way round first, and a listing of ten lines then had its
  // tenth line still fading at 93% of the block's arrival — which is the frame
  // the cut lands on, and the failure this whole span exists to prevent.
  const span = Math.max(LINE_SPAN / n, LINE_SPAN * 0.25)
  const step = n > 1 ? (LINE_SPAN - span) / (n - 1) : 0
  return list.map((_, i) => {
    const at = Math.max(0, Math.min(1, (p - i * step) / span))
    return { chars: String(list[i]?.text ?? '').length, opacity: at }
  })
}

/** Whether the caret is drawn on this frame, and on which line. Null when nothing is being typed. */
export function codeCaret(lines, reveal, progress) {
  if (reveal !== 'type') return null
  const shown = codeReveal(lines, reveal, progress)
  const index = shown.findIndex((line, i) => line.chars < String(lines?.[i]?.text ?? '').length)
  return index === -1 ? null : index
}

// ── solidScene ───────────────────────────────────────────────────────────────

/**
 * The camera, in the units the geometry below is written in.
 *
 * Stated rather than left to react-three-fiber's own default, and the first
 * render is why: at the default 75-degree field of view and a distance of 7, a
 * sphere of radius 1.9 filled a third of its canvas and came back as a small
 * grey disc in the corner of a zone.
 */
export const SOLID_CAMERA_Z = 5.6
export const SOLID_CAMERA_FOV = 45

/** How much of the room the camera leaves is actually used. The 2% is the rounding, not a taste. */
const SOLID_MARGIN = 0.98

/**
 * The radius every solid in the enum is built to — one number, and that is the
 * point of it.
 *
 * A `size: "large"` used to mean four different things. The canvas was 86% of the
 * box, and then a sphere of radius 1.9 drew 82% of that canvas while a torus of
 * 1.7 + 0.62 drew all of it and a cube of side 2.6 drew barely half: three
 * documents asking for the same size got three sizes, and the one that read worst
 * — a torus at 15% of the frame's height, in the export that named this defect —
 * looked like a bug rather than like a choice. A share the schema offers has to
 * mean the same share whichever solid it is applied to.
 *
 * The number is the camera's own limit rather than a taste. Every vertex of every
 * solid lies inside a ball of this radius about the origin, and a point of that
 * ball projects to at most `R / sqrt(d² − R²)` of the frame's half-height — so
 * `R = d · sin(fov/2)` is exactly the radius at which the ball touches the edge of
 * the canvas and never crosses it. At that radius a solid FILLS the canvas the
 * layout gave it, which is the whole of the rule at the top of `composition.js`,
 * applied to the one block drawn by a renderer.
 *
 * It bounds the solid at every orientation, which is why it is the bounding
 * sphere and not the silhouette: these things spin. A cube normalised on its
 * face-on silhouette would put its corners through the edge of the canvas twice
 * per turn, and a clipped corner is not a smaller cube — it is a broken render.
 */
export const SOLID_BOUND = SOLID_CAMERA_Z * Math.sin((SOLID_CAMERA_FOV / 2) * (Math.PI / 180)) * SOLID_MARGIN

/**
 * The canvas a solid is drawn in, in pixels.
 *
 * Square, and a share of the smaller side of the box the layout gave THIS block —
 * never the frame. It used to be clamped at `base` as well, which was the frame
 * creeping back in through a `Math.min`: on the one ratio where a box can be
 * wider than the short edge, the clamp made `large` mean something smaller than
 * the document asked for, and nothing said so.
 *
 * `base` is left as the fallback for a box this file cannot read, because a solid
 * drawn at a plausible size beats a canvas of zero pixels (Q1). The share is read
 * from `DECLARED_SHARE` rather than kept as a copy here: `composition.js` needs
 * it to answer for the block in `blockExtent`, and one table cannot disagree with
 * itself.
 *
 * It stays square and it stays clipped to the box because this is the one block
 * where a wasted pixel is measured in render seconds rather than in bytes — a
 * full-frame lit solid costs about 0.9 s of render per second of film on the
 * two-core worker.
 */
export function solidCanvas(box, size, base) {
  const shares = DECLARED_SHARE.solidScene
  // `Object.hasOwn` and not `shares[size] ?? shares.medium`, for the reason
  // `blockComponent` spells out: a plain lookup answers for the prototype chain,
  // so `size: "constructor"` hands back a FUNCTION — truthy, so `??` never fires,
  // and the multiplication below is a canvas of NaN pixels.
  const share = typeof size === 'string' && Object.hasOwn(shares, size) ? shares[size] : shares.medium
  const room = Math.min(px(box?.width) || px(base), px(box?.height) || px(base))
  return Math.max(1, Math.round(room * share))
}

/**
 * The arguments a geometry is built from — numbers, never a mesh.
 *
 * Every one of them is scaled so that its bounding sphere is `SOLID_BOUND`, which
 * is what makes `size` mean one thing across the four solids; the PROPORTIONS are
 * the ones that were drawn by hand (a torus whose tube is 0.36 of its ring, a
 * prism half again as wide as it is tall), so nothing about the shapes changes.
 *
 * The segment counts are the other half of the render budget. A sphere at 48×32
 * measured 0.9 s of render per second of film and a torus at 24×64 drawn as a
 * WIREFRAME measured 2.7, which is past what the deadline leaves; the wireframe
 * is not in the schema for that reason and these counts are why the solids that
 * are in it stay affordable.
 */
export function solidGeometry(solid) {
  switch (solid) {
    case 'sphere':
      // A ball IS its own bounding sphere.
      return { geometry: 'sphere', args: [SOLID_BOUND, 48, 32] }
    case 'torus': {
      // ring + tube is the bound; the tube keeps its 0.36 share of the ring.
      const ring = SOLID_BOUND / 1.3647
      return { geometry: 'torus', args: [ring, SOLID_BOUND - ring, 20, 48] }
    }
    case 'prism': {
      // A cylinder of three sides IS a triangular prism, and it is one primitive
      // rather than a mesh somebody assembled out of vertices — which is the
      // line this block is not allowed to cross. Its bound is the corner:
      // sqrt(r² + (h/2)²), with h kept at 1.368 r.
      const radius = SOLID_BOUND / Math.hypot(1, 0.684)
      return { geometry: 'cylinder', args: [radius, radius, radius * 1.368, 3] }
    }
    case 'cube':
    default: {
      // Half a cube's diagonal is its bound: s·√3/2.
      const side = (2 * SOLID_BOUND) / Math.sqrt(3)
      return { geometry: 'box', args: [side, side, side] }
    }
  }
}

/**
 * The radius of the ball a geometry fits inside — the claim `solidGeometry` makes,
 * as a function a test can check.
 *
 * It is here rather than in the test file because it is the definition the
 * arguments above were derived FROM: a fifth solid added to the enum has to answer
 * this function with `SOLID_BOUND`, and a reader of that pull request should find
 * the rule next to the numbers rather than in a suite.
 */
export function solidBoundingRadius(geometry, args) {
  const [a = 0, b = 0, c = 0] = Array.isArray(args) ? args : []
  switch (geometry) {
    case 'sphere':
      return a
    case 'torus':
      return a + b
    case 'cylinder':
      // `args` is [radiusTop, radiusBottom, height, segments].
      return Math.hypot(Math.max(a, b), c / 2)
    case 'box':
    default:
      return Math.hypot(a, b, c) / 2
  }
}

/**
 * How far the solid has turned on this frame, in radians, per axis.
 *
 * Never a whole number of quarter-turns over the scene, and that is a bug this
 * function exists to have already fixed: a cube spun exactly 2π on both axes is
 * pixel-identical at its first and last frame, and a probe rendering frames 0, 45
 * and 90 of a cube turning π/2 per beat produced three byte-identical PNGs. A
 * film in which nothing moves must not be producible by accident, and a symmetric
 * solid on a symmetric turn is exactly that, arriving through arithmetic instead
 * of through a default.
 *
 * `life` and not `progress`: the turn runs for the whole scene. The arrival is
 * the scale, next door.
 */
export function solidSpin(spin, life) {
  const t = Number(life) || 0
  switch (spin) {
    case 'turn':
      // One axis, and 1.4 turns rather than 1: a cube on a whole turn is a cube
      // that ends where it started.
      return { x: 0.32, y: t * Math.PI * 2.8, z: 0 }
    case 'rock':
      // Back and forth, never all the way round: the move for a solid whose front
      // is the thing worth looking at.
      //
      // Not a whole PERIOD either, and that is the same bug as a whole turn.
      // `sin(2πt)` is zero at both ends of the scene, so a rocking solid was
      // pixel-identical on its first and last frame — which is exactly what
      // `tests/video-motion.test.js` compares. The offset phase and the 1.6
      // periods are what make the rock end somewhere it did not start.
      return {
        x: Math.sin((t * 1.6 + 0.1) * Math.PI) * 0.24,
        y: Math.sin((t * 1.6 + 0.1) * Math.PI) * 0.5,
        z: 0,
      }
    case 'tumble':
    default:
      return { x: t * Math.PI * 1.7, y: t * Math.PI * 2.3, z: t * 0.35 }
  }
}

/** The solid's own arrival: it grows into the frame, from `SOLID_ENTER_SCALE` to full. */
export const SOLID_ENTER_SCALE = 0.72

export function solidScale(progress) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0))
  return SOLID_ENTER_SCALE + (1 - SOLID_ENTER_SCALE) * p
}

/** Where the one directional light sits. A constant, because a light the document placed is a light it described. */
export const SOLID_LIGHT = [4, 6, 8]
