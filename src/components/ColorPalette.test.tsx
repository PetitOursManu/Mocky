import { describe, expect, it } from 'vitest'
import { DEFAULT_PALETTE } from './ColorPalette'

describe('the default palette', () => {
  it('is six rows of twelve distinct hexes, greys from black to white first', () => {
    expect(DEFAULT_PALETTE).toHaveLength(6)
    for (const row of DEFAULT_PALETTE) {
      expect(row).toHaveLength(12)
      for (const hex of row) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    }
    expect(DEFAULT_PALETTE[0][0]).toBe('#000000')
    expect(DEFAULT_PALETTE[0][11]).toBe('#ffffff')
    const all = DEFAULT_PALETTE.flat()
    expect(new Set(all).size).toBe(all.length)
  })
})
