import { describe, it, expect } from 'vitest'
import { HAND_REACH, HAND_REFERENCE_PX, handFrame, pathPoints } from './handFrame'
import { PAGE_FORMATS } from './pageFormats'

const PRINT = PAGE_FORMATS.filter((f) => f.kind === 'print')

describe('handFrame', () => {
  it.each(PRINT)('draws nothing outside its box ($id)', (f) => {
    const hand = handFrame(f.w, f.h)
    const all = [hand.back, ...hand.knuckles, hand.cuff, hand.cuffLine, hand.thumbFill, hand.nail, hand.crease].flatMap(pathPoints)
    expect(all.length).toBeGreaterThan(40)
    for (const p of all) {
      // Control points included: a curve never leaves the hull of its points.
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(hand.width + 0.01)
      expect(p.y).toBeLessThanOrEqual(hand.height + 0.01)
    }
  })

  it.each(PRINT)('keeps the thumb in the bottom-right corner of the page ($id)', (f) => {
    // The one part drawn OVER the design: it may cover a corner, never the middle.
    const hand = handFrame(f.w, f.h)
    const onPage = pathPoints(hand.thumbFill).filter((p) => p.x <= f.w && p.y <= f.h)
    expect(onPage.length).toBeGreaterThan(0)
    for (const p of onPage) {
      expect(p.x).toBeGreaterThanOrEqual(f.w - 0.3 * Math.min(f.w, f.h))
      expect(p.y).toBeGreaterThanOrEqual(f.h - 0.14 * Math.min(f.w, f.h))
    }
  })

  it('puts the page at the origin, at its own size', () => {
    const hand = handFrame(794, 1123)
    expect(hand.page).toEqual({ x: 0, y: 0, w: 794, h: 1123 })
    expect(hand.width).toBe(794 + HAND_REACH.right)
    expect(hand.height).toBe(1123 + HAND_REACH.bottom)
  })

  it('scales the hand by the short side, so every paper size is held by the same hand', () => {
    expect(handFrame(794, 1123).scale).toBe(1)
    expect(handFrame(1123, 794).scale).toBe(1)
    expect(handFrame(816, 1056).scale).toBeCloseTo(816 / HAND_REFERENCE_PX, 6)
    const letter = handFrame(816, 1056)
    expect(letter.width).toBeCloseTo(816 + HAND_REACH.right * letter.scale, 6)
  })

  it('never divides by nothing', () => {
    const hand = handFrame(0, 0)
    expect(Number.isFinite(hand.width) && Number.isFinite(hand.height)).toBe(true)
    expect(hand.back).not.toMatch(/NaN|Infinity/)
  })
})
