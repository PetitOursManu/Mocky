import { describe, it, expect } from 'vitest'
import { paletteFromPixels, saturationOf, toHex } from './palette'

/** Builds an RGBA buffer from a list of [r,g,b,count] runs. */
function pixels(runs: [number, number, number, number][], alpha = 255): Uint8ClampedArray {
  const total = runs.reduce((n, r) => n + r[3], 0)
  const out = new Uint8ClampedArray(total * 4)
  let i = 0
  for (const [r, g, b, count] of runs) {
    for (let k = 0; k < count; k++) {
      out[i++] = r
      out[i++] = g
      out[i++] = b
      out[i++] = alpha
    }
  }
  return out
}

describe('paletteFromPixels', () => {
  it('returns the colours actually present, heaviest first', () => {
    const p = paletteFromPixels(
      pixels([
        [200, 30, 40, 60], // red, 60%
        [20, 60, 200, 30], // blue, 30%
        [240, 240, 230, 10], // near-white, 10%
      ]),
    )
    expect(p.swatches.map((s) => s.hex)).toEqual(['#c81e28', '#143cc8', '#f0f0e6'])
    expect(p.swatches[0].weight).toBeCloseTo(0.6, 2)
    expect(p.swatches[1].weight).toBeCloseTo(0.3, 2)
  })

  it('merges shades the eye reads as one colour', () => {
    // Six samples of the same sky. A raw histogram returns six swatches; the
    // palette must return one, carrying all of their weight.
    const p = paletteFromPixels(
      pixels([
        [100, 140, 200, 10],
        [104, 144, 204, 10],
        [98, 138, 198, 10],
        [102, 142, 202, 10],
        [106, 146, 206, 10],
        [96, 136, 196, 10],
        [220, 90, 20, 40], // a genuinely different colour
      ]),
    )
    expect(p.swatches).toHaveLength(2)
    expect(p.swatches[0].weight).toBeCloseTo(0.6, 2)
  })

  it('ignores transparent pixels rather than counting them as black', () => {
    const opaque = pixels([[10, 200, 120, 50]])
    const clear = pixels([[0, 0, 0, 50]], 0)
    const both = new Uint8ClampedArray([...opaque, ...clear])
    const p = paletteFromPixels(both)
    expect(p.swatches).toHaveLength(1)
    expect(p.swatches[0].hex).toBe('#0ac878')
    expect(p.swatches[0].weight).toBe(1)
  })

  it('has no palette for an empty or fully transparent image', () => {
    expect(paletteFromPixels(new Uint8ClampedArray(0))).toEqual({ swatches: [], accent: null })
    expect(paletteFromPixels(pixels([[9, 9, 9, 20]], 0)).swatches).toEqual([])
  })

  it('caps the palette at the requested size', () => {
    const many = pixels(
      Array.from({ length: 20 }, (_, i) => [i * 12, 255 - i * 12, (i * 37) % 255, 5] as [number, number, number, number]),
    )
    expect(paletteFromPixels(many, { max: 4 }).swatches.length).toBeLessThanOrEqual(4)
  })
})

describe('the accent', () => {
  it('is the most saturated colour, not the most common one', () => {
    // A photograph is mostly its background. A design system needs something to
    // point with, and that is rarely the sky.
    const p = paletteFromPixels(
      pixels([
        [210, 208, 200, 85], // beige wall — dominant
        [255, 90, 0, 15], // orange — the only real colour
      ]),
    )
    expect(p.swatches[0].hex).toBe('#d2d0c8')
    expect(p.accent).toBe('#ff5a00')
  })

  it('ignores a colour too rare to be a brand colour', () => {
    // A one-percent smear of JPEG artefact must not become the accent.
    const p = paletteFromPixels(
      pixels([
        [40, 44, 50, 99],
        [255, 0, 255, 1],
      ]),
    )
    expect(p.accent).toBe('#282c32')
  })

  it('falls back to the dominant colour when nothing is saturated', () => {
    // A monochrome brief is a legitimate brief.
    const p = paletteFromPixels(
      pixels([
        [30, 30, 30, 60],
        [200, 200, 200, 40],
      ]),
    )
    expect(p.accent).toBe('#1e1e1e')
  })
})

describe('helpers', () => {
  it('formats hex with the padding a two-digit channel needs', () => {
    expect(toHex(0, 10, 255)).toBe('#000aff')
  })

  it('measures saturation as distance from grey', () => {
    expect(saturationOf(128, 128, 128)).toBe(0)
    expect(saturationOf(255, 0, 0)).toBe(1)
    expect(saturationOf(200, 150, 150)).toBeGreaterThan(0)
    expect(saturationOf(200, 150, 150)).toBeLessThan(1)
  })
})
