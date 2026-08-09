// The arithmetic of the three blocks that were added after a dependency was
// measured, and the two claims worth having as tests rather than as prose:
// nothing any of them draws holds still, and nothing any of them draws leaves
// the box it was given.
import { describe, it, expect } from 'vitest'
import {
  CODE_MIN_SIZE,
  CODE_SIZE,
  FUN_TITLE_MIN_SIZE,
  FUN_TITLE_SIZE,
  SOLID_ENTER_SCALE,
  codeCaret,
  codeReveal,
  codeSize,
  funTitleAccentFrom,
  funTitleGlyphs,
  funTitleLetter,
  funTitleShadow,
  funTitleSize,
  letterAt,
  solidCanvas,
  solidGeometry,
  solidScale,
  solidSpin,
} from './setPiece.js'
import { FUN_TITLE_TREATMENTS, SOLIDS, SPINS, BLOCK_LIMITS } from '../../../../server/video/timeline.js'

const BASE = 1080

describe('funTitle — the size', () => {
  it('sets a short line at the full size', () => {
    expect(funTitleSize('Motion', BASE)).toBe(Math.round(BASE * FUN_TITLE_SIZE))
  })

  /**
   * The bound is the schema's, read rather than retyped — the rule that keeps
   * biting `compose.js`. A title at the longest line the validator accepts has to
   * still be a title, not a line through the edge of its zone.
   */
  it('ramps down to its floor and never past it, up to the schema’s own bound', () => {
    const longest = 'x'.repeat(BLOCK_LIMITS.funTitle)
    expect(funTitleSize(longest, BASE)).toBeGreaterThanOrEqual(Math.round(BASE * FUN_TITLE_MIN_SIZE))
    expect(funTitleSize(longest, BASE)).toBeLessThan(funTitleSize('Motion', BASE))
  })

  it('never grows with length', () => {
    let previous = Infinity
    for (let n = 1; n <= BLOCK_LIMITS.funTitle; n += 1) {
      const size = funTitleSize('x'.repeat(n), BASE)
      expect(size).toBeLessThanOrEqual(previous)
      previous = size
    }
  })
})

describe('funTitle — the letters', () => {
  it('gives the first letter the whole arrival and the last one the tail', () => {
    expect(letterAt(6, 0, 0)).toBe(0)
    expect(letterAt(6, 0, 1)).toBe(1)
    expect(letterAt(6, 5, 0.2)).toBeLessThan(letterAt(6, 0, 0.2))
    expect(letterAt(6, 5, 1)).toBe(1)
  })

  it('keeps the spaces, so a treatment does not close a word gap it was not asked to', () => {
    expect(funTitleGlyphs('deux mots')).toHaveLength(9)
    expect(funTitleGlyphs('deux mots')[4]).toBe(' ')
  })

  /**
   * The claim `tests/video-motion.test.js` makes for a scene, made here for the
   * one block whose whole point is the letters: on every treatment, and on a
   * document that filled in nothing optional, the frame at the end of the scene
   * differs from the frame at its start.
   */
  it('moves, on every treatment, between the first frame and the last', () => {
    const size = funTitleSize('Un titre', BASE)
    const count = funTitleGlyphs('Un titre').length
    for (const treatment of FUN_TITLE_TREATMENTS) {
      const first = Array.from({ length: count }, (_, i) => funTitleLetter(treatment, count, i, 0, 0, size))
      const last = Array.from({ length: count }, (_, i) => funTitleLetter(treatment, count, i, 1, 1, size))
      expect(JSON.stringify(last), treatment).not.toBe(JSON.stringify(first))
    }
  })

  it('has every letter fully arrived by the end of its block', () => {
    for (const treatment of FUN_TITLE_TREATMENTS) {
      for (let i = 0; i < 12; i += 1) {
        expect(funTitleLetter(treatment, 12, i, 1, 1, 40).opacity, `${treatment}[${i}]`).toBe(1)
      }
    }
  })

  it('stresses the last word, and the whole line when there is only one', () => {
    expect(funTitleAccentFrom('deux mots')).toBe(5)
    expect(funTitleAccentFrom('seul')).toBe(0)
  })

  it('offsets a shadow only on the treatment that has one', () => {
    expect(funTitleShadow('stack', 100, 1)).toBeGreaterThan(0)
    for (const treatment of FUN_TITLE_TREATMENTS.filter((t) => t !== 'stack')) {
      expect(funTitleShadow(treatment, 100, 1), treatment).toBe(0)
    }
  })
})

describe('codeBlock', () => {
  const lines = (n, length = 20) => Array.from({ length: n }, () => ({ text: 'x'.repeat(length), role: 'plain' }))

  it('sets a short listing at the full size and a wide one smaller', () => {
    expect(codeSize(lines(3, 10), BASE)).toBe(Math.round(BASE * CODE_SIZE))
    expect(codeSize(lines(3, BLOCK_LIMITS.codeLine), BASE)).toBeGreaterThanOrEqual(Math.round(BASE * CODE_MIN_SIZE))
    expect(codeSize(lines(3, BLOCK_LIMITS.codeLine), BASE)).toBeLessThan(codeSize(lines(3, 10), BASE))
  })

  it('sizes from the longest line, never the average', () => {
    const mixed = [{ text: 'a', role: 'plain' }, { text: 'x'.repeat(BLOCK_LIMITS.codeLine), role: 'plain' }]
    expect(codeSize(mixed, BASE)).toBe(codeSize(lines(2, BLOCK_LIMITS.codeLine), BASE))
  })

  /**
   * The failure this catches is the one nobody sees in a still: a listing whose
   * last line is half typed when the scene cuts. `LINE_SPAN` leaves the tail for
   * the reason `cueFrames` leaves `MIN_CUE_TAIL_FRAMES`.
   */
  it('finishes every line before its block has finished arriving', () => {
    for (const reveal of ['lines', 'type']) {
      for (const n of [BLOCK_LIMITS.codeLinesMin, BLOCK_LIMITS.codeLines]) {
        const list = lines(n, BLOCK_LIMITS.codeLine)
        const shown = codeReveal(list, reveal, 0.85)
        for (const [i, line] of shown.entries()) {
          expect(line.chars, `${reveal}[${i}]`).toBe(list[i].text.length)
          expect(line.opacity, `${reveal}[${i}]`).toBe(1)
        }
      }
    }
  })

  it('starts with nothing written', () => {
    const list = lines(4)
    expect(codeReveal(list, 'type', 0).every((l) => l.chars === 0)).toBe(true)
    expect(codeReveal(list, 'lines', 0).every((l) => l.opacity === 0)).toBe(true)
  })

  it('types the whole panel as one stream, so a long line takes longer than a short one', () => {
    const mixed = [{ text: 'ab', role: 'plain' }, { text: 'x'.repeat(40), role: 'plain' }]
    const half = codeReveal(mixed, 'type', 0.35)
    expect(half[0].chars).toBe(2)
    expect(half[1].chars).toBeGreaterThan(0)
    expect(half[1].chars).toBeLessThan(40)
  })

  it('draws a caret only while something is being typed', () => {
    const list = lines(3)
    expect(codeCaret(list, 'lines', 0.5)).toBe(null)
    expect(codeCaret(list, 'type', 0.999)).toBe(null)
    expect(typeof codeCaret(list, 'type', 0.3)).toBe('number')
  })
})

describe('solidScene', () => {
  it('has a geometry for every solid the schema names', () => {
    for (const solid of SOLIDS) {
      const { geometry, args } = solidGeometry(solid)
      expect(typeof geometry, solid).toBe('string')
      expect(Array.isArray(args) && args.length > 0, solid).toBe(true)
      expect(args.every((n) => Number.isFinite(n)), solid).toBe(true)
    }
  })

  /**
   * The bug this exists to have already fixed, and it was a real one: a probe
   * spinning a cube by π/2 per beat rendered frames 0, 45 and 90 as three
   * byte-identical PNGs. A symmetric solid on a symmetric turn is a film in which
   * nothing moves, produced by arithmetic rather than by a default — which is the
   * same failure `DEFAULT_KEN_BURNS` exists to refuse, one level down.
   */
  it('never returns to its first orientation at the end of a scene', () => {
    for (const spin of SPINS) {
      const first = solidSpin(spin, 0)
      const last = solidSpin(spin, 1)
      const quarters = ['x', 'y', 'z'].map((axis) => (last[axis] - first[axis]) / (Math.PI / 2))
      // Not a whole number of quarter-turns on every axis at once: a cube is
      // pixel-identical after one, and every solid in the enum is after four.
      expect(quarters.some((q) => Math.abs(q - Math.round(q)) > 0.05), spin).toBe(true)
    }
  })

  it('is in motion at every point of the scene, not only at its ends', () => {
    for (const spin of SPINS) {
      for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const a = solidSpin(spin, t)
        const b = solidSpin(spin, t + 0.01)
        expect(JSON.stringify(a) === JSON.stringify(b), `${spin} at ${t}`).toBe(false)
      }
    }
  })

  it('arrives by growing, and is at full size once it has', () => {
    expect(solidScale(0)).toBe(SOLID_ENTER_SCALE)
    expect(solidScale(1)).toBe(1)
    expect(solidScale(0.5)).toBeGreaterThan(SOLID_ENTER_SCALE)
  })

  /**
   * The canvas is the only place in this directory where a wasted pixel costs
   * render seconds rather than bytes — a full-frame lit solid measured 0.9 s of
   * render per second of film. It is square, it never leaves its zone, and it
   * never exceeds the short edge of the frame.
   */
  it('never draws a canvas larger than the box it was given', () => {
    for (const size of ['small', 'medium', 'large']) {
      for (const box of [{ width: 1800, height: 400 }, { width: 300, height: 900 }, { width: 1080, height: 1080 }]) {
        const side = solidCanvas(box, size, BASE)
        expect(side, `${size} in ${box.width}x${box.height}`).toBeLessThanOrEqual(Math.min(box.width, box.height))
        expect(side).toBeLessThanOrEqual(BASE)
        expect(side).toBeGreaterThan(0)
      }
    }
  })

  it('grows with the named size and with nothing else', () => {
    const box = { width: 1080, height: 1080 }
    expect(solidCanvas(box, 'small', BASE)).toBeLessThan(solidCanvas(box, 'medium', BASE))
    expect(solidCanvas(box, 'medium', BASE)).toBeLessThan(solidCanvas(box, 'large', BASE))
    // An unknown size reads as the middle one rather than throwing: the validator
    // already refused anything else, so reaching this branch means the three
    // readers disagree, and a solid drawn at the wrong size beats a render that
    // dies half a minute in (Q1).
    expect(solidCanvas(box, 'enormous', BASE)).toBe(solidCanvas(box, 'medium', BASE))
  })
})
