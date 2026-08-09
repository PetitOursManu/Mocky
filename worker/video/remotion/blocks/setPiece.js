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
 */

// ── funTitle ─────────────────────────────────────────────────────────────────

/** Display size for a fun title, as a share of the short edge. Below `heading`'s: every treatment spends room. */
export const FUN_TITLE_SIZE = 0.088

/** The floor a long line is allowed to shrink to before it simply wraps. */
export const FUN_TITLE_MIN_SIZE = 0.044

/** Characters that fit on one line at `FUN_TITLE_SIZE`. Past it the size ramps down. */
const FUN_TITLE_COMFORT = 14

/** How far apart the letters of a `stagger` are, as a share of the arrival. */
const LETTER_SPAN = 0.55

/** The arc's rise at the ends of the line, as a share of the type size. */
const ARC_RISE = 0.42

/** The bounce's travel, and how much of the scene it keeps moving for. */
const BOUNCE_RISE = 0.3

/** How wide `stretch` opens the tracking at rest, in em. */
const STRETCH_TRACKING = 0.26

/** The shadowed copy's offset, as a share of the type size. */
const STACK_OFFSET = 0.07

/**
 * The size a line of `n` characters is set at.
 *
 * Ramped rather than clamped, and it is the `verticalCaptionSize` lesson applied
 * to a title: a size tuned for the longest legal line makes every short one look
 * timid, and a size tuned for a short one puts a forty-character line through
 * the edge of its zone. Both ends are named, and everything between is linear.
 */
export function funTitleSize(text, base) {
  const length = Math.max(1, String(text ?? '').length)
  if (length <= FUN_TITLE_COMFORT) return Math.round(base * FUN_TITLE_SIZE)
  // 40 is the schema's own bound and it is not typed here: the ramp reaches its
  // floor at four times the comfortable length, whatever the bound turns out to
  // be. A ramp anchored to a bound retyped in this file is the drift CLAUDE.md
  // keeps naming.
  const over = Math.min(1, (length - FUN_TITLE_COMFORT) / (FUN_TITLE_COMFORT * 3))
  return Math.round(base * (FUN_TITLE_SIZE - (FUN_TITLE_SIZE - FUN_TITLE_MIN_SIZE) * over))
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
 */
export function funTitleLetter(treatment, count, index, progress, life, size) {
  const at = letterAt(count, index, progress)
  const n = Math.max(1, count)
  // -1 at the first letter, +1 at the last: the line's own axis, so a treatment
  // reads the same on three letters and on forty.
  const across = n === 1 ? 0 : (index / (n - 1)) * 2 - 1
  const t = Number(life) || 0

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
        // A sine on the scene's own clock, phase-shifted along the line, so the
        // letters keep passing a wave between them after they have all arrived.
        rise: -Math.sin(t * Math.PI * 2 + index * 0.6) * size * BOUNCE_RISE * at * 0.35 - (1 - at) * size * BOUNCE_RISE,
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
      return { opacity: at, rise: (1 - at) * size * 0.5, turn: 0, tracking: 0, scale: 1 }
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

/** Monospace size for a panel of code, as a share of the short edge. */
export const CODE_SIZE = 0.03

/** How many characters a line is set for. Past it the size ramps down, exactly as a title does. */
const CODE_COMFORT = 34

export const CODE_MIN_SIZE = 0.019

/** The share of the block's arrival each line of a `lines` reveal gets. */
const LINE_SPAN = 0.7

/**
 * The size a panel of code is set at, from its LONGEST line.
 *
 * The longest and not the average, and not the schema's bound either: a panel
 * sized for sixty-four characters sets two short lines in type nobody can read,
 * and a panel sized for the average puts the one long line through the edge.
 */
export function codeSize(lines, base) {
  const longest = (Array.isArray(lines) ? lines : []).reduce((max, l) => Math.max(max, String(l?.text ?? '').length), 1)
  if (longest <= CODE_COMFORT) return Math.round(base * CODE_SIZE)
  const over = Math.min(1, (longest - CODE_COMFORT) / CODE_COMFORT)
  return Math.round(base * (CODE_SIZE - (CODE_SIZE - CODE_MIN_SIZE) * over))
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

/** The share of its own box a solid fills, per size. A share and never a pixel: the `anchor` argument, in depth. */
const SOLID_SHARE = { small: 0.42, medium: 0.62, large: 0.86 }

/**
 * The camera, in the units the geometry below is written in.
 *
 * Stated rather than left to react-three-fiber's own default, and the first
 * render is why: at the default 75-degree field of view and a distance of 7, a
 * sphere of radius 1.9 filled a third of its canvas and came back as a small
 * grey disc in the corner of a zone. These two numbers put the largest solid in
 * the enum at about four fifths of the frame it was given, which is what "a
 * canvas sized to its zone" was supposed to mean.
 */
export const SOLID_CAMERA_Z = 5.6
export const SOLID_CAMERA_FOV = 45

/**
 * The canvas a solid is drawn in, in pixels.
 *
 * Square, and clipped to the smaller side of the box it was given: a canvas
 * wider than its zone is a WebGL surface being rasterised for pixels the frame
 * never shows, and this is the one block where a wasted pixel is measured in
 * render seconds rather than in bytes. A full-frame lit solid already costs
 * about 0.9 s of render per second of film on the two-core worker.
 */
export function solidCanvas(box, size, base) {
  const share = SOLID_SHARE[size] ?? SOLID_SHARE.medium
  const room = Math.min(Number(box?.width) || base, Number(box?.height) || base)
  return Math.max(1, Math.round(Math.min(room, base) * share))
}

/**
 * The arguments a geometry is built from — numbers, never a mesh.
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
      return { geometry: 'sphere', args: [1.9, 48, 32] }
    case 'torus':
      return { geometry: 'torus', args: [1.7, 0.62, 20, 48] }
    case 'prism':
      // A cylinder of three sides IS a triangular prism, and it is one primitive
      // rather than a mesh somebody assembled out of vertices — which is the
      // line this block is not allowed to cross.
      return { geometry: 'cylinder', args: [1.9, 1.9, 2.6, 3] }
    case 'cube':
    default:
      return { geometry: 'box', args: [2.6, 2.6, 2.6] }
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
