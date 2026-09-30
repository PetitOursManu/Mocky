import { describe, it, expect } from 'vitest'
import { FOREARM_OVERSHOOT, HAND_REACH, HAND_REFERENCE_PX, handFrame, pathPoints, smoothPath } from './handFrame'
import { PAGE_FORMATS } from './pageFormats'

const PRINT = PAGE_FORMATS.filter((f) => f.kind === 'print')

describe('handFrame', () => {
  it.each(PRINT)('stays in its box, but for the arm leaving the picture ($id)', (f) => {
    const hand = handFrame(f.w, f.h)
    const inside = [hand.thumb, hand.thumbSide, hand.nail, ...hand.creases].flatMap(pathPoints)
    const arm = [hand.fill, hand.outer, hand.inner].flatMap(pathPoints)
    expect(inside.length).toBeGreaterThan(40)
    // Control points included: a curve never leaves the hull of its points.
    for (const p of inside) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(hand.width + 0.01)
      expect(p.y).toBeLessThanOrEqual(hand.height + 0.01)
    }
    // The arm runs PAST the box at the bottom right — the component clips it
    // there, so it leaves the picture instead of ending on a line — and never
    // by more than the overshoot, nor ever above or left of the page.
    const past = FOREARM_OVERSHOOT * hand.scale + 0.01
    for (const p of arm) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(hand.width + past)
      expect(p.y).toBeLessThanOrEqual(hand.height + past)
    }
    expect(Math.max(...arm.map((p) => p.x))).toBeGreaterThan(hand.width)
    expect(Math.max(...arm.map((p) => p.y))).toBeGreaterThan(hand.height)
  })

  it.each(PRINT)('keeps the thumb a narrow band along the right edge, in the lower half ($id)', (f) => {
    // The one part drawn OVER the design: it may cover the edge, never the middle.
    const hand = handFrame(f.w, f.h)
    const short = Math.min(f.w, f.h)
    const onPage = pathPoints(hand.thumb).filter((p) => p.x < f.w)
    expect(onPage.length).toBeGreaterThan(0)
    for (const p of onPage) {
      expect(p.x).toBeGreaterThanOrEqual(f.w - 0.1 * short)
      expect(p.y).toBeGreaterThanOrEqual(f.h - 0.5 * short)
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
    expect(hand.fill).not.toMatch(/NaN|Infinity/)
  })
})

describe('smoothPath', () => {
  it('passes through every point it is given', () => {
    const pts = [[0, 0], [10, 5], [20, 0], [30, 10]] as const
    const d = smoothPath(pts)
    // Each segment ends ON the next point.
    const ends = Array.from(d.matchAll(/C[^C]*? (-?[\d.]+),(-?[\d.]+)(?= C|$)/g), (m) => [Number(m[1]), Number(m[2])])
    expect(ends).toEqual([[10, 5], [20, 0], [30, 10]])
    expect(d.startsWith('M0,0')).toBe(true)
  })

  it('closes a loop back onto its first point', () => {
    const d = smoothPath([[0, 0], [10, 0], [10, 10], [0, 10]], true)
    expect(d.endsWith('0,0 Z')).toBe(true)
  })

  it('handles the degenerate cases', () => {
    expect(smoothPath([])).toBe('')
    expect(smoothPath([[3, 4]])).toBe('M3,4')
  })
})
