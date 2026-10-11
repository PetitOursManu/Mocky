import { describe, expect, it } from 'vitest'
import { boundsOf, pathData, placeFrame, shapeCubics, toCubics, type Pt } from './frameGeometry'
import { FRAME_SHAPES } from './frameShapes'

const bez = (p0: Pt, c1: Pt, c2: Pt, p: Pt, t: number): Pt => {
  const u = 1 - t
  return [
    u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p[0],
    u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p[1],
  ]
}

describe('a frame’s shape, placed on a page', () => {
  it('rewrites every shape of the catalogue as lines and cubics, absolute commands only', () => {
    for (const s of FRAME_SHAPES) {
      expect(s.clip, s.id).not.toMatch(/[a-z]/)
      const subs = shapeCubics(s.id)
      expect(subs.length, s.id).toBeGreaterThan(0)
      for (const sp of subs) expect(sp.segs.length, s.id).toBeGreaterThan(1)
    }
  })

  it('draws an arc as cubics that stay on the arc', () => {
    // The catalogue's circle: two half arcs of radius 50 about (50, 50).
    const [sp] = toCubics(FRAME_SHAPES.find((s) => s.id === 'circle')!.clip)
    let from = sp.start
    for (const s of sp.segs) {
      expect(s.type).toBe('C')
      if (s.type !== 'C') continue
      for (let t = 0; t <= 1; t += 0.125) {
        const [x, y] = bez(from, s.c1, s.c2, s.p, t)
        expect(Math.hypot(x - 50, y - 50)).toBeCloseTo(50, 0)
      }
      from = s.p
    }
    expect(from[0]).toBeCloseTo(50, 6)
    expect(from[1]).toBeCloseTo(0, 6)
  })

  it('keeps a quadratic’s curve when it becomes a cubic', () => {
    const [sp] = toCubics('M0 0Q50 100 100 0Z')
    const s = sp.segs[0]
    expect(s.type).toBe('C')
    if (s.type === 'C') {
      // The quadratic's midpoint is (50, 50).
      const [x, y] = bez(sp.start, s.c1, s.c2, s.p, 0.5)
      expect(x).toBeCloseTo(50, 6)
      expect(y).toBeCloseTo(50, 6)
    }
  })

  it('stretches the box to the frame, turns it about its centre and moves it to its place', () => {
    const square = (angle: number) => placeFrame({ shape: 'diamond', cx: 200, cy: 100, w: 80, h: 40, angle })
    // Unturned, the diamond's top point is the middle of the box's top edge.
    expect(square(0)[0].start[0]).toBeCloseTo(200, 6)
    expect(square(0)[0].start[1]).toBeCloseTo(80, 6)
    // Turned a quarter clockwise, that point is now to the right of the centre.
    expect(square(90)[0].start[0]).toBeCloseTo(220, 6)
    expect(square(90)[0].start[1]).toBeCloseTo(100, 6)
    const b = boundsOf(square(0))
    expect(b).toEqual({ x: 160, y: 80, w: 80, h: 40 })
  })

  it('writes path data an SVG, a canvas and a PDF can all read', () => {
    const d = pathData(placeFrame({ shape: 'heart', cx: 50, cy: 50, w: 100, h: 100, angle: 0 }))
    expect(d).toMatch(/^M[\d.\- ]+(?:[LC][\d.\- ]+)+Z$/)
    // The same points, mapped into another unit with the y axis flipped (a PDF's).
    const flipped = pathData(placeFrame({ shape: 'heart', cx: 50, cy: 50, w: 100, h: 100, angle: 0 }), ([x, y]) => [
      x * 0.75,
      100 - y * 0.75,
    ])
    expect(flipped.startsWith('M37.5 ')).toBe(true)
  })
})
