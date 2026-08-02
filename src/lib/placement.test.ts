import { describe, it, expect } from 'vitest'
import { placeScreen, packScreens, DEFAULT_W, DEFAULT_H, type Box } from './project'

/**
 * Screens landing on top of each other was the single most reported annoyance:
 * every new screen had to be dragged off the previous one by hand.
 *
 * Two independent causes, both reproduced here. The old rule was
 * `slotPosition(screens.length)` — a fixed 1024x720 cell, indexed by a count.
 * A desktop screen is 1440 wide, so it always ran into the next column; and a
 * count says nothing about where screens actually are once one has been moved.
 */

const box = (x: number, y: number, w = DEFAULT_W, h = DEFAULT_H): Box => ({ x, y, w, h })
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

describe('placeScreen', () => {
  it('puts the first screen at the origin', () => {
    expect(placeScreen([], 1440, 900)).toEqual({ x: 0, y: 0 })
  })

  it('never overlaps a desktop screen with the one before it', () => {
    // The exact regression: 1440-wide screens in a 1024-wide cell.
    const placed: Box[] = []
    for (let i = 0; i < 8; i++) {
      const p = placeScreen(placed, 1440, 900)
      placed.push({ ...p, w: 1440, h: 900 })
    }
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(overlap(placed[i], placed[j]), `screen ${i} overlaps ${j}`).toBe(false)
      }
    }
  })

  it('avoids a screen that was dragged into the next free slot', () => {
    // One screen at the origin, and another parked exactly where the naive
    // grid would post the newcomer.
    const existing = [box(0, 0), box(DEFAULT_W + 80, 0)]
    const p = placeScreen(existing, DEFAULT_W, DEFAULT_H)
    const cand = { ...p, w: DEFAULT_W, h: DEFAULT_H }
    for (const e of existing) expect(overlap(cand, e)).toBe(false)
  })

  it('handles mixed sizes without collision', () => {
    const existing = [box(0, 0, 1440, 900), box(1520, 0, 390, 844)]
    const p = placeScreen(existing, 820, 1180)
    const cand = { ...p, w: 820, h: 1180 }
    for (const e of existing) expect(overlap(cand, e)).toBe(false)
  })

  it('anchors on the existing cluster rather than snapping back to 0,0', () => {
    // Every screen dragged far away: the next one joins them, it does not
    // reappear alone at the origin.
    const existing = [box(9000, 9000, 400, 400)]
    const p = placeScreen(existing, 400, 400)
    expect(p.x).toBeGreaterThanOrEqual(9000)
    expect(p.y).toBeGreaterThanOrEqual(9000)
  })
})

describe('packScreens', () => {
  it('lays out mixed sizes without overlap', () => {
    const screens: Box[] = [
      box(0, 0, 1440, 900),
      box(0, 0, 390, 844),
      box(0, 0, 820, 1180),
      box(0, 0, 1440, 900),
    ]
    const placed = packScreens(screens).map((p, i) => ({ ...p, w: screens[i].w, h: screens[i].h }))
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(overlap(placed[i], placed[j]), `${i} overlaps ${j}`).toBe(false)
      }
    }
  })

  it('keeps the given order left to right, then down', () => {
    const screens: Box[] = Array.from({ length: 4 }, () => box(0, 0, 500, 500))
    const placed = packScreens(screens, 3)
    expect(placed[0]).toEqual({ x: 0, y: 0 })
    expect(placed[1].x).toBeGreaterThan(placed[0].x)
    expect(placed[2].x).toBeGreaterThan(placed[1].x)
    // Fourth wraps onto a new row.
    expect(placed[3].x).toBe(0)
    expect(placed[3].y).toBeGreaterThan(placed[0].y)
  })

  it('gives a row the height of its tallest screen', () => {
    const screens: Box[] = [box(0, 0, 400, 400), box(0, 0, 400, 1200), box(0, 0, 400, 400), box(0, 0, 400, 400)]
    const placed = packScreens(screens, 3)
    // The wrapped screen clears the 1200-tall one, not the 400-tall one.
    expect(placed[3].y).toBeGreaterThanOrEqual(1200)
  })

  it('survives screens with missing dimensions', () => {
    const screens = [{ x: 0, y: 0, w: NaN, h: NaN }, box(0, 0)] as Box[]
    expect(() => packScreens(screens)).not.toThrow()
    expect(packScreens(screens).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
  })
})
