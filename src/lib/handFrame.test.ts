import { describe, it, expect } from 'vitest'
import { FOREARM_OVERSHOOT, HAND_REACH, HAND_REFERENCE_PX, handFrame, pathPoints } from './handFrame'
import { PAGE_FORMATS } from './pageFormats'

const PRINT = PAGE_FORMATS.filter((f) => f.kind === 'print')

describe('handFrame', () => {
  it.each(PRINT)('draws nothing outside its box, but the forearm leaving through the bottom ($id)', (f) => {
    const hand = handFrame(f.w, f.h)
    const inside = [...hand.lines, hand.thumbFill, hand.nail, ...hand.thumbLines].flatMap(pathPoints)
    const back = pathPoints(hand.back)
    expect(inside.length + back.length).toBeGreaterThan(40)
    // Control points included: a curve never leaves the hull of its points.
    for (const p of [...inside, ...back]) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(hand.width + 0.01)
    }
    for (const p of inside) expect(p.y).toBeLessThanOrEqual(hand.height + 0.01)
    // The arm runs a little PAST the box — the component clips it there, so it
    // leaves the picture instead of ending on a line — and never further.
    for (const p of back) expect(p.y).toBeLessThanOrEqual(hand.height + FOREARM_OVERSHOOT * hand.scale + 0.01)
    expect(Math.max(...back.map((p) => p.y))).toBeGreaterThan(hand.height)
  })

  it.each(PRINT)('keeps the thumb in the bottom-right corner of the page ($id)', (f) => {
    // The one part drawn OVER the design: it may cover a corner, never the middle.
    const hand = handFrame(f.w, f.h)
    const onPage = pathPoints(hand.thumbFill).filter((p) => p.x <= f.w && p.y <= f.h)
    expect(onPage.length).toBeGreaterThan(0)
    for (const p of onPage) {
      expect(p.x).toBeGreaterThanOrEqual(f.w - 0.2 * Math.min(f.w, f.h))
      expect(p.y).toBeGreaterThanOrEqual(f.h - 0.1 * Math.min(f.w, f.h))
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
