// What a lit block really paints, in the units the defect was reported in.
//
// The claim this file holds is one sentence: **the frame carries the segment the
// palette measured, all of it and nothing outside it.** `solidShading` proves
// that measuring the two ends of a Lambert segment measures every face between
// them; that proof is about the colours a frame carries, and until this pass the
// frame carried neither end — a share meant for bytes was handed to a renderer
// that shades in linear light, and the renderer then ran the result through a
// tone curve nobody asked for. A near-white sheet came back spanning 37 levels
// of the 109 that had been measured and cleared.
import { describe, it, expect } from 'vitest'
import { contrastRatio, relativeLuminance } from '../contrast.js'
import { SOLID_SHADES } from '../composition.js'
import { litAmbient, litFace, litFloor, litSpan } from './shading.js'

/**
 * Twelve inks a direction really produces, plus the two ends of the ramp.
 *
 * The near-whites are the common case — `accentFirst` resolves an ornament on a
 * cinema ground and lands on one — and the dark saturated ones are the paper
 * themes, where the sRGB curve is nearly straight and the two spaces this file
 * converts between very nearly agree. Both have to work.
 */
const INKS = [
  '#ffffff',
  '#f2f2f2',
  '#e8e4dc',
  '#c8a24a',
  '#4ade80',
  '#38bdf8',
  '#f97316',
  '#a855f7',
  '#1a4d2e',
  '#7a1f1f',
  '#101014',
  '#000000',
]

const GROUNDS = ['#101014', '#0a0a0a', '#fafaf8', '#ffffff', '#243447', '#f5efe6']

describe('the transfer this file converts through', () => {
  /**
   * Encode and decode are exact inverses to the byte, which is what makes
   * "nothing is brightened" a fact rather than a hope: at `ambient` 1 the whole
   * chain has to hand back the colour it was given, unchanged, at every angle.
   */
  it('paints the material itself when there is no shading to do', () => {
    for (const ink of INKS) {
      for (const at of [0, 0.3, 1]) expect(litFace(ink, 1, at), `${ink} @ ${at}`).toBe(ink)
    }
  })

  /**
   * And it is `contrast.js`'s own curve, not a second one.
   *
   * The check is indirect on purpose and it is stronger for it: the share below
   * is computed with THIS file's decode and compared with a luminance computed
   * by the mirror one directory up. Two different curves would not agree to six
   * places, and a mirror nothing holds is a mirror that drifts — the arrangement
   * `contrast.js` already has with `src/lib/audit/colors.ts`.
   */
  it('agrees with the luminance the rest of the renderer measures with', () => {
    for (const ink of INKS) {
      for (const ambient of SOLID_SHADES) {
        const painted = relativeLuminance(litFace(ink, ambient, 0))
        const measured = relativeLuminance(litFloor(ink, ambient))
        // A byte of rounding at each end, which on the darkest inks is a large
        // share of a very small number — so the tolerance is relative to the
        // material rather than absolute.
        const room = Math.max(1e-4, relativeLuminance(ink) * 0.04)
        expect(Math.abs(painted - measured), `${ink} @ ${ambient}`).toBeLessThan(room)
      }
    }
  })
})

describe('the darkest face is the colour that was measured', () => {
  /**
   * THE GUARANTEE, stated where it can be checked. `fieldColors` samples
   * `scaleColor(color, ambient)` and `legibleOn` clears it against the ground;
   * this is the claim that the frame then carries a face with that contrast and
   * not one two thirds of the way back to the material.
   */
  it('clears exactly what the palette cleared, on every ground', () => {
    for (const ink of INKS) {
      for (const ambient of SOLID_SHADES) {
        for (const ground of GROUNDS) {
          const painted = contrastRatio(litFace(ink, ambient, 0), ground)
          const measured = contrastRatio(litFloor(ink, ambient), ground)
          expect(Math.abs(painted - measured) / measured, `${ink} @ ${ambient} on ${ground}`).toBeLessThan(0.05)
        }
      }
    }
  })

  /**
   * And nothing lands outside the segment, at any angle the renderer can
   * compute. That is the whole of `solidShading`'s proof: the two ends are
   * measured, so every face between them is, and a face darker than the floor or
   * brighter than the material is a colour nobody cleared.
   */
  it('keeps every face between the two ends, and moves monotonically between them', () => {
    for (const ink of INKS) {
      for (const ambient of SOLID_SHADES) {
        const floor = relativeLuminance(litFace(ink, ambient, 0))
        const full = relativeLuminance(ink)
        let previous = -1
        for (let i = 0; i <= 20; i += 1) {
          const light = relativeLuminance(litFace(ink, ambient, i / 20))
          expect(light, `${ink} @ ${ambient} @ ${i}`).toBeGreaterThanOrEqual(floor - 1e-9)
          expect(light).toBeLessThanOrEqual(full + 1e-9)
          expect(light).toBeGreaterThanOrEqual(previous - 1e-9)
          previous = light
        }
      }
    }
  })
})

describe('how much of the range a lit surface really gets', () => {
  /**
   * The defect, as a number. A `waveMesh` on a near-white ink measured 39 levels
   * across the whole sheet; the segment the palette had measured is 109 wide,
   * and this is what says the frame now carries it.
   *
   * `0.9` of the measured span and a byte on top, rather than all of it: the two
   * ends coincide in LUMINANCE and the painted floor distributes that luminance
   * across the three channels the way linear light does, which moves a saturated
   * channel by a byte or two either way. Contrast is a function of luminance, so
   * the guarantee is exact; the span is a picture of it and is allowed a
   * rounding — which on `#101014` at the shallowest shade is a segment three
   * bytes wide and therefore all of the tolerance there is.
   */
  it('spans the segment the palette measured, and not a third of it', () => {
    for (const ink of INKS) {
      const rgb = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16))
      for (const ambient of SOLID_SHADES) {
        const measured = rgb.reduce((sum, c) => sum + (c - Math.round(c * ambient)), 0) / 3
        expect(litSpan(ink, ambient).levels, `${ink} @ ${ambient}`).toBeGreaterThanOrEqual(measured * 0.9 - 1)
      }
    }
    // The case the defect was reported on, in its own units.
    expect(litSpan('#f2f2f2', SOLID_SHADES[0]).levels).toBeGreaterThan(100)
  })

  /**
   * The conversion only ever DARKENS the light, and by how much depends on the
   * ink: the sRGB curve is straight near black, so a dark material's two spaces
   * nearly agree and the share barely moves, while a near-white loses half of
   * it. A version that returned the share unchanged would pass every legibility
   * test in this file and paint the sheet that started all this.
   */
  it('hands a light less than the share the palette wrote, except where the curve is straight', () => {
    for (const ink of INKS.filter((c) => c !== '#000000')) {
      for (const ambient of SOLID_SHADES.filter((a) => a < 1)) {
        expect(litAmbient(ink, ambient), `${ink} @ ${ambient}`).toBeLessThan(ambient)
      }
    }
    expect(litAmbient('#f2f2f2', 0.55)).toBeLessThan(0.3)
    expect(litAmbient('#101014', 0.55)).toBeGreaterThan(0.4)
  })

  /** The two lights still sum to one, so the brightest face is the material itself. */
  it('leaves the directional share as the rest of it', () => {
    for (const ink of INKS) {
      for (const ambient of SOLID_SHADES) {
        const share = litAmbient(ink, ambient)
        expect(share).toBeGreaterThanOrEqual(0)
        expect(share).toBeLessThanOrEqual(1)
        expect(litFace(ink, ambient, 1), `${ink} @ ${ambient}`).toBe(ink)
      }
    }
  })
})

describe('what it answers when it is handed nothing', () => {
  /**
   * A material with no light in it at all is black at every shade, and the ratio
   * this file is built on is 0/0 there. A `NaN` reaching a light intensity is a
   * black frame half a minute into a render (Q1).
   */
  it('degrades rather than dividing by zero', () => {
    expect(litAmbient('#000000', 0.55)).toBe(0.55)
    expect(litAmbient('not a colour', 0.55)).toBe(0.55)
    expect(litAmbient('#f2f2f2', undefined)).toBe(1)
    expect(litFloor('not a colour', 0.55)).toBe('not a colour')
    expect(litFace('not a colour', 0.55, 0)).toBe('not a colour')
    expect(litSpan('not a colour', 0.55).levels).toBe(0)
    for (const ambient of [0, 1]) expect(Number.isFinite(litAmbient('#4ade80', ambient))).toBe(true)
  })

  /** A shade of zero is a black object, which is a colour and not a failure. */
  it('paints black when the palette asked for black', () => {
    expect(litFace('#f2f2f2', 0, 0)).toBe('#000000')
    expect(litFloor('#f2f2f2', 0)).toBe('#000000')
  })
})
