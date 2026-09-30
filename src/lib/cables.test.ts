import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CABLE_GEOMETRY,
  LABEL_MIN_CHORD_PX,
  MAP_LABEL_MIN_SCALE,
  arrowHead,
  bezierPoint,
  bezierTail,
  connectPressHolds,
  connectRelease,
  cullWindow,
  curveBounds,
  elementRect,
  exitParam,
  facingSides,
  grow,
  intersects,
  labelVisible,
  linksOf,
  pointerCable,
  readShowCables,
  routeCables,
  screenAt,
  sideVector,
  spreadAlong,
  writeShowCables,
  type CableLink,
  type Rect,
} from './cables'

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h })
const A = r(0, 0, 400, 300)

const link = (id: string, sourceId: string, targetId: string, rect: Rect = r(0.4, 0.4, 0.2, 0.1)): CableLink => ({
  id,
  sourceId,
  targetId,
  rect,
})

describe('facingSides', () => {
  it('leaves right and arrives left when the target is to the right', () => {
    expect(facingSides(A, r(600, 0, 400, 300))).toEqual({ out: 'right', in: 'left' })
  })
  it('leaves left and arrives right when the target is to the left', () => {
    expect(facingSides(A, r(-700, 50, 400, 300))).toEqual({ out: 'left', in: 'right' })
  })
  it('goes down when the target is stacked below', () => {
    expect(facingSides(A, r(0, 500, 400, 300))).toEqual({ out: 'bottom', in: 'top' })
  })
  it('goes up when the target is stacked above', () => {
    expect(facingSides(A, r(50, -600, 400, 300))).toEqual({ out: 'top', in: 'bottom' })
  })
  it('picks the axis with the larger gap on a diagonal', () => {
    // 100 across, 400 down: stacked, so vertical.
    expect(facingSides(A, r(500, 700, 400, 300)).out).toBe('bottom')
    // 400 across, 100 down: a row, so horizontal.
    expect(facingSides(A, r(800, 400, 400, 300)).out).toBe('right')
    // 400 across, 100 up, to the left.
    expect(facingSides(A, r(-800, -400, 400, 300)).out).toBe('left')
  })
  it('prefers horizontal on an exact diagonal tie', () => {
    expect(facingSides(A, r(600, 500, 400, 300)).out).toBe('right')
  })
  it('uses the offset between centres when the frames overlap', () => {
    expect(facingSides(A, r(100, 20, 400, 300))).toEqual({ out: 'right', in: 'left' })
    expect(facingSides(A, r(-150, 20, 400, 300))).toEqual({ out: 'left', in: 'right' })
    expect(facingSides(A, r(10, 200, 400, 300))).toEqual({ out: 'bottom', in: 'top' })
    expect(facingSides(A, r(10, -200, 400, 300))).toEqual({ out: 'top', in: 'bottom' })
  })
  it('gives a stable answer for a frame exactly on top of another', () => {
    expect(facingSides(A, { ...A })).toEqual({ out: 'right', in: 'left' })
  })
  it('handles a frame containing the other', () => {
    expect(facingSides(r(0, 0, 1000, 1000), r(700, 450, 100, 100)).out).toBe('right')
  })
  it('always arrives on the side opposite the one it leaves', () => {
    const opposite = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }
    for (const t of [r(900, 0, 10, 10), r(-900, 0, 10, 10), r(0, 900, 10, 10), r(0, -900, 10, 10), r(1, 1, 10, 10)]) {
      const s = facingSides(A, t)
      expect(s.in).toBe(opposite[s.out])
    }
  })
})

describe('elementRect', () => {
  it('maps a normalised rectangle into the frame', () => {
    expect(elementRect(r(100, 200, 400, 300), r(0.5, 0.5, 0.25, 0.1))).toEqual(r(300, 350, 100, 30))
  })
  it('uses the whole frame for an all-zero rectangle (an auto-link with no rect)', () => {
    expect(elementRect(A, r(0, 0, 0, 0))).toEqual(A)
  })
  it('clamps an element scrolled partly out of the frame', () => {
    const e = elementRect(A, r(-0.2, 0.9, 0.5, 0.5))
    expect(e.x).toBe(0)
    expect(e.y + e.h).toBeLessThanOrEqual(300)
    expect(e.x + e.w).toBeLessThanOrEqual(400)
  })
  it('survives non-finite values', () => {
    const e = elementRect(A, r(NaN, Infinity, 0.2, NaN))
    for (const v of Object.values(e)) expect(Number.isFinite(v)).toBe(true)
  })
})

describe('spreadAlong', () => {
  it('keeps a lone arrival where it wants to be', () => {
    expect(spreadAlong([150], 0, 300, 36)).toEqual([150])
  })
  it('clamps a wish that falls outside the edge', () => {
    expect(spreadAlong([-50], 10, 290, 36)).toEqual([10])
    expect(spreadAlong([900], 10, 290, 36)).toEqual([290])
  })
  it('pushes identical wishes apart by the gap', () => {
    const out = spreadAlong([100, 100, 100], 0, 300, 36)
    const sorted = [...out].sort((a, b) => a - b)
    expect(sorted[1] - sorted[0]).toBeGreaterThanOrEqual(36)
    expect(sorted[2] - sorted[1]).toBeGreaterThanOrEqual(36)
  })
  it('returns positions in the order it was given, sorted by wish (no crossings)', () => {
    const out = spreadAlong([200, 50, 120], 0, 300, 36)
    expect(out[1]).toBeLessThan(out[2])
    expect(out[2]).toBeLessThan(out[0])
  })
  it('pushes back from the far end without leaving the edge', () => {
    const out = spreadAlong([290, 290, 290], 0, 300, 36)
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(300)
    }
    expect(Math.max(...out)).toBe(300)
  })
  it('spreads evenly when the edge is too short for the gap', () => {
    const out = spreadAlong([5, 5, 5, 5, 5], 0, 40, 36)
    expect([...out].sort((a, b) => a - b)).toEqual([0, 10, 20, 30, 40])
  })
  it('handles an empty list and an inverted range', () => {
    expect(spreadAlong([], 0, 10, 5)).toEqual([])
    expect(spreadAlong([3, 4], 10, 0, 5)).toEqual([5, 5])
  })
})

describe('bezierPoint and curveBounds', () => {
  const p0 = { x: 0, y: 0 }
  const c1 = { x: 100, y: 0 }
  const c2 = { x: 100, y: 200 }
  const p3 = { x: 200, y: 200 }
  it('starts and ends on the end points', () => {
    expect(bezierPoint(p0, c1, c2, p3, 0)).toEqual(p0)
    expect(bezierPoint(p0, c1, c2, p3, 1)).toEqual(p3)
  })
  it('puts the midpoint at (P0 + 3C1 + 3C2 + P3) / 8', () => {
    expect(bezierPoint(p0, c1, c2, p3, 0.5)).toEqual({ x: 100, y: 100 })
  })
  it('bounds every point of the curve', () => {
    const b = curveBounds(p0, { x: 300, y: -80 }, { x: -120, y: 260 }, p3)
    for (let i = 0; i <= 50; i++) {
      const p = bezierPoint(p0, { x: 300, y: -80 }, { x: -120, y: 260 }, p3, i / 50)
      expect(p.x).toBeGreaterThanOrEqual(b.x - 1e-9)
      expect(p.x).toBeLessThanOrEqual(b.x + b.w + 1e-9)
      expect(p.y).toBeGreaterThanOrEqual(b.y - 1e-9)
      expect(p.y).toBeLessThanOrEqual(b.y + b.h + 1e-9)
    }
  })
})

describe('routeCables', () => {
  const boxes = new Map<string, Rect>([
    ['a', r(0, 0, 400, 300)],
    ['b', r(800, 0, 400, 300)],
    ['c', r(0, 700, 400, 300)],
  ])

  it('leaves the element horizontally and lands on the facing edge', () => {
    const [c] = routeCables([link('1', 'a', 'b')], boxes)
    // element = x 160..240, y 120..150 → right-edge midpoint
    expect(c.out).toBe('right')
    expect(c.p0).toEqual({ x: 240, y: 135 })
    expect(c.in).toBe('left')
    expect(c.p3.x).toBe(800)
    // Level with its port: the straightest cable.
    expect(c.p3.y).toBe(135)
    expect(c.missing).toBe(false)
  })

  it('pulls the handles along the sides they leave and arrive by', () => {
    const [c] = routeCables([link('1', 'a', 'b')], boxes)
    expect(c.c1.y).toBe(c.p0.y)
    expect(c.c1.x).toBeGreaterThan(c.p0.x)
    expect(c.c2.y).toBe(c.p3.y)
    expect(c.c2.x).toBeLessThan(c.p3.x)
    const len = c.c1.x - c.p0.x
    expect(len).toBeGreaterThanOrEqual(CABLE_GEOMETRY.minHandle)
    expect(len).toBeLessThanOrEqual(CABLE_GEOMETRY.maxHandle)
  })

  it('goes vertically between stacked screens', () => {
    const [c] = routeCables([link('1', 'a', 'c')], boxes)
    expect(c.out).toBe('bottom')
    expect(c.in).toBe('top')
    expect(c.p0).toEqual({ x: 200, y: 150 })
    expect(c.p3).toEqual({ x: 200, y: 700 })
    expect(c.c1.x).toBe(200)
    expect(c.c1.y).toBeGreaterThan(150)
    expect(c.c2.y).toBeLessThan(700)
  })

  it('keeps a minimum handle between two very close screens', () => {
    const near = new Map<string, Rect>([
      ['a', r(0, 0, 400, 300)],
      ['b', r(410, 0, 400, 300)],
    ])
    const [c] = routeCables([link('1', 'a', 'b', r(0.9, 0.5, 0.1, 0))], near)
    expect(c.c1.x - c.p0.x).toBe(CABLE_GEOMETRY.minHandle)
  })

  it('puts the label anchor on the curve midpoint', () => {
    const [c] = routeCables([link('1', 'a', 'c')], boxes)
    expect(c.mid).toEqual(bezierPoint(c.p0, c.c1, c.c2, c.p3, 0.5))
  })

  it('spreads several arrivals on the same edge instead of stacking them', () => {
    const cables = routeCables(
      [link('1', 'a', 'b'), link('2', 'a', 'b'), link('3', 'a', 'b')],
      boxes,
    )
    const ys = cables.map((c) => c.p3.y).sort((a, b) => a - b)
    expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(CABLE_GEOMETRY.gap)
    expect(ys[2] - ys[1]).toBeGreaterThanOrEqual(CABLE_GEOMETRY.gap)
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(CABLE_GEOMETRY.edgeMargin)
      expect(y).toBeLessThanOrEqual(300 - CABLE_GEOMETRY.edgeMargin)
    }
  })

  it('spreads arrivals from different sources onto one edge without crossing them', () => {
    const three = new Map<string, Rect>([
      ['top', r(0, -200, 400, 300)],
      ['bottom', r(0, 300, 400, 300)],
      ['t', r(900, 0, 400, 300)],
    ])
    const cables = routeCables(
      [link('lo', 'bottom', 't', r(0.4, 0, 0.2, 0.1)), link('hi', 'top', 't', r(0.4, 0.9, 0.2, 0.1))],
      three,
    )
    const hi = cables.find((c) => c.id === 'hi')!
    const lo = cables.find((c) => c.id === 'lo')!
    expect(hi.in).toBe('left')
    expect(lo.in).toBe('left')
    expect(hi.p3.y).toBeLessThan(lo.p3.y)
    expect(lo.p3.y - hi.p3.y).toBeGreaterThanOrEqual(CABLE_GEOMETRY.gap)
  })

  it('does not spread arrivals that reach different edges', () => {
    const cables = routeCables([link('1', 'a', 'b'), link('2', 'c', 'b')], boxes)
    const sides = new Set(cables.map((c) => c.in))
    expect(sides.size).toBeGreaterThanOrEqual(1)
    for (const c of cables) expect(Number.isFinite(c.p3.y)).toBe(true)
  })

  it('draws a short stub for a link whose target is gone', () => {
    const [c] = routeCables([link('1', 'a', 'gone')], boxes)
    expect(c.missing).toBe(true)
    // Measured from the source FRAME's edge, not the element's.
    expect(c.p3.x).toBe(400 + CABLE_GEOMETRY.stub)
    expect(c.p3.y).toBe(c.p0.y)
    expect(c.path.startsWith('M')).toBe(true)
  })

  it("ends a dead link's stub OUTSIDE its source frame, wherever the element is", () => {
    // A button a third of the way across a desktop frame: a stub measured from
    // the element ended inside the frame, under it on the map.
    const wide = new Map<string, Rect>([['d', r(0, 0, 1440, 900)]])
    const [c] = routeCables([link('1', 'd', 'gone', r(0.3, 0.5, 0.05, 0.05))], wide)
    expect(c.p3.x).toBeGreaterThan(1440)
    expect(c.exit.x).toBeCloseTo(1440, 1)
    expect(c.labelAt.x).toBeGreaterThan(1440)
  })

  it('puts the label on the part of the cable outside the source frame', () => {
    const wide = new Map<string, Rect>([
      ['d', r(0, 0, 1440, 900)],
      ['t', r(1520, 0, 400, 900)],
    ])
    const [c] = routeCables([link('1', 'd', 't', r(0.05, 0.5, 0.05, 0.05))], wide)
    // The curve's own midpoint is still inside the 1440-wide source...
    expect(c.mid.x).toBeLessThan(1440)
    // ...the label is not, and it lies on the curve between the exit and the end.
    expect(c.exit.x).toBeCloseTo(1440, 1)
    expect(c.labelAt.x).toBeGreaterThan(1440)
    expect(c.labelAt.x).toBeLessThan(c.p3.x)
  })

  it('makes the hit area the part outside the source frame only', () => {
    const [c] = routeCables([link('1', 'a', 'b')], boxes)
    // Starts where the curve leaves frame a (x = 400), not on the element.
    expect(c.exit.x).toBeCloseTo(400, 1)
    expect(c.hitPath.startsWith(`M${Math.round(c.exit.x * 10) / 10} `)).toBe(true)
    expect(c.hitPath.endsWith(`${c.p3.x} ${c.p3.y}`)).toBe(true)
  })

  it('keeps the label on the whole curve when the curve never leaves its source', () => {
    const overlap = new Map<string, Rect>([
      ['a', r(0, 0, 400, 300)],
      ['o', r(100, 100, 100, 100)],
    ])
    // o sits inside a: the arrival point is inside a, so there is no exit.
    const [c] = routeCables([link('1', 'a', 'o')], overlap)
    expect(exitParam(c.p0, c.c1, c.c2, c.p3, overlap.get('a')!)).toBe(0)
    expect(c.labelAt).toEqual(c.mid)
    expect(c.hitPath).toBe(c.path)
  })

  it('draws nothing for a link whose source is not on the board', () => {
    expect(routeCables([link('1', 'ghost', 'a')], boxes)).toEqual([])
  })

  it('loops a self-link out of the right edge and back into it', () => {
    const [c] = routeCables([link('1', 'a', 'a')], boxes)
    expect(c.self).toBe(true)
    expect(c.in).toBe('right')
    expect(c.p3.x).toBe(400)
    expect(c.c1.x).toBeGreaterThan(400)
    expect(c.c2.x).toBeGreaterThan(400)
  })

  it('follows the live boxes it is given (a frame being dragged)', () => {
    const before = routeCables([link('1', 'a', 'b')], boxes)[0]
    const moved = new Map(boxes)
    moved.set('b', r(800, 400, 400, 300))
    const after = routeCables([link('1', 'a', 'b')], moved)[0]
    expect(after.p3).not.toEqual(before.p3)
  })

  it('gives bounds that contain the whole cable', () => {
    for (const c of routeCables([link('1', 'a', 'b'), link('2', 'a', 'c'), link('3', 'a', 'x')], boxes)) {
      for (let i = 0; i <= 20; i++) {
        const p = bezierPoint(c.p0, c.c1, c.c2, c.p3, i / 20)
        expect(intersects({ x: p.x, y: p.y, w: 0, h: 0 }, grow(c.bounds, 1e-6))).toBe(true)
      }
    }
  })

  it('writes a plain cubic path', () => {
    const [c] = routeCables([link('1', 'a', 'b')], boxes)
    expect(c.path).toMatch(/^M-?[\d.]+ -?[\d.]+C(-?[\d.]+ ){5}-?[\d.]+$/)
  })
})

describe('linksOf', () => {
  it('flattens every hotspot with its source screen', () => {
    const out = linksOf([
      { id: 'a', links: [{ id: 'h1', target: 'b', x: 0.1, y: 0.2, w: 0.3, h: 0.4, label: 'Go' }] },
      { id: 'b', links: [] },
    ])
    expect(out).toEqual([{ id: 'h1', sourceId: 'a', targetId: 'b', rect: r(0.1, 0.2, 0.3, 0.4), label: 'Go' }])
  })
})

describe('pointerCable', () => {
  it('ends exactly at the pointer and bends toward it', () => {
    const c = pointerCable(A, r(0.4, 0.4, 0.2, 0.1), { x: 900, y: 100 })
    expect(c.p3).toEqual({ x: 900, y: 100 })
    expect(c.out).toBe('right')
    expect(c.c2.x).toBeLessThan(900)
  })
  it('stays finite with the pointer on the port itself', () => {
    const c = pointerCable(A, r(0.4, 0.4, 0.2, 0.1), { x: 240, y: 135 })
    for (const p of [c.c1, c.c2, c.mid]) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })
})

describe('arrowHead', () => {
  it('points into the frame from outside its edge', () => {
    const [tip, b1, b2] = arrowHead({ x: 800, y: 100 }, 'left', 10, 4)
    expect(tip).toEqual({ x: 796, y: 100 })
    expect(b1.x).toBe(786)
    expect(b2.x).toBe(786)
    expect(Math.abs(b1.y - b2.y)).toBeCloseTo(12)
  })
  it('works on every side', () => {
    for (const side of ['left', 'right', 'top', 'bottom'] as const) {
      const [tip, b1] = arrowHead({ x: 0, y: 0 }, side, 10)
      const v = sideVector(side)
      // The base is further out along the side's outward vector than the tip.
      expect((b1.x - tip.x) * v.x + (b1.y - tip.y) * v.y).toBeCloseTo(10)
    }
  })
})

describe('culling', () => {
  it('intersects boxes that touch or overlap, not boxes apart', () => {
    expect(intersects(r(0, 0, 10, 10), r(5, 5, 10, 10))).toBe(true)
    expect(intersects(r(0, 0, 10, 10), r(10, 10, 5, 5))).toBe(true)
    expect(intersects(r(0, 0, 10, 10), r(11, 0, 5, 5))).toBe(false)
  })
  it('covers the viewport with slack on every side', () => {
    const view = { x: -500, y: -300, scale: 0.5 }
    const w = cullWindow(view, 1000, 800)
    // The visible world rectangle is x 1000..3000, y 600..2200.
    expect(w.x).toBeLessThanOrEqual(1000 - 1000)
    expect(w.y).toBeLessThanOrEqual(600 - 800)
    expect(w.x + w.w).toBeGreaterThanOrEqual(3000 + 1000)
    expect(w.y + w.h).toBeGreaterThanOrEqual(2200 + 800)
  })
  it('does not change for a small pan (so the layer is not re-rendered)', () => {
    const a = cullWindow({ x: -500, y: -300, scale: 0.5 }, 1000, 800)
    // 40 world units across and 20 down: inside one grid cell.
    const b = cullWindow({ x: -520, y: -290, scale: 0.5 }, 1000, 800)
    expect(b).toEqual(a)
  })
  it('survives a zero scale', () => {
    const w = cullWindow({ x: 0, y: 0, scale: 0 }, 100, 100)
    expect(Number.isFinite(w.w)).toBe(true)
  })
})

describe('screenAt', () => {
  const boxes = new Map<string, Rect>([
    ['a', r(0, 0, 400, 300)],
    ['b', r(200, 100, 400, 300)],
  ])
  it('returns the topmost frame under the point', () => {
    expect(screenAt({ x: 250, y: 150 }, ['a', 'b'], boxes)).toBe('b')
    expect(screenAt({ x: 50, y: 50 }, ['a', 'b'], boxes)).toBe('a')
  })
  it('skips the excluded screen and finds the one beneath', () => {
    expect(screenAt({ x: 250, y: 150 }, ['a', 'b'], boxes, 'b')).toBe('a')
  })
  it('returns null over empty canvas', () => {
    expect(screenAt({ x: 5000, y: 5000 }, ['a', 'b'], boxes)).toBeNull()
  })
})

describe('labelVisible', () => {
  const boxes = new Map<string, Rect>([
    ['a', r(0, 0, 400, 300)],
    ['b', r(1000, 0, 400, 300)],
  ])
  // Seen chord 600 world: from where the curve leaves a (x 400) to b (x 1000).
  const [c] = routeCables([link('1', 'a', 'b')], boxes)
  it('shows the label when the cable is long enough on screen', () => {
    expect(labelVisible(c, 1, { interactive: true })).toBe(true)
  })
  it('hides it when the cable is too short on screen', () => {
    expect(labelVisible(c, (LABEL_MIN_CHORD_PX - 1) / 600, { interactive: true })).toBe(false)
    // The stretch across the source screen does not count: at this zoom the
    // whole curve is long enough, the part that is seen is not.
    expect(labelVisible(c, (LABEL_MIN_CHORD_PX + 1) / 760, { interactive: true })).toBe(false)
  })
  it('always names a dead link, except on the zoomed-out map', () => {
    const [dead] = routeCables([link('1', 'a', 'gone')], boxes)
    expect(labelVisible(dead, 0.5, { interactive: true })).toBe(true)
    expect(labelVisible(dead, MAP_LABEL_MIN_SCALE, { interactive: false })).toBe(true)
    expect(labelVisible(dead, MAP_LABEL_MIN_SCALE - 0.01, { interactive: false })).toBe(false)
  })
  it('always shows an emphasised cable in link mode', () => {
    expect(labelVisible(c, 0.01, { interactive: true, emphasised: true })).toBe(true)
  })
  it('keeps the quiet map free of words when zoomed out', () => {
    expect(labelVisible(c, MAP_LABEL_MIN_SCALE - 0.01, { interactive: false })).toBe(false)
    expect(labelVisible(c, 1, { interactive: false })).toBe(true)
  })
})

describe('the map toggle store', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('defaults to shown, and remembers a choice', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    })
    expect(readShowCables()).toBe(true)
    writeShowCables(false)
    expect(readShowCables()).toBe(false)
    writeShowCables(true)
    expect(readShowCables()).toBe(true)
  })
  it('falls back to shown when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(readShowCables()).toBe(true)
    expect(() => writeShowCables(false)).not.toThrow()
  })
})

describe('exitParam and bezierTail', () => {
  const p0 = { x: 100, y: 50 }
  const c1 = { x: 300, y: 50 }
  const c2 = { x: 500, y: 50 }
  const p3 = { x: 700, y: 50 }
  it('finds where a curve leaves a frame', () => {
    const t = exitParam(p0, c1, c2, p3, r(0, 0, 400, 100))
    expect(bezierPoint(p0, c1, c2, p3, t).x).toBeCloseTo(400, 1)
  })
  it('is 0 for a curve that starts outside, or never leaves', () => {
    expect(exitParam(p0, c1, c2, p3, r(-500, 0, 100, 100))).toBe(0)
    expect(exitParam(p0, c1, c2, p3, r(0, 0, 1000, 100))).toBe(0)
  })
  it('splits a curve into a tail that traces the same points', () => {
    const k1 = { x: 100, y: 300 }
    const k2 = { x: 700, y: -200 }
    const tail = bezierTail(p0, k1, k2, p3, 0.4)
    const at = bezierPoint(p0, k1, k2, p3, 0.4)
    expect(tail[0].x).toBeCloseTo(at.x, 6)
    expect(tail[0].y).toBeCloseTo(at.y, 6)
    expect(tail[3]).toEqual(p3)
    const inTail = bezierPoint(...tail, 0.5)
    const inWhole = bezierPoint(p0, k1, k2, p3, 0.7)
    expect(inTail.x).toBeCloseTo(inWhole.x, 6)
    expect(inTail.y).toBeCloseTo(inWhole.y, 6)
  })
})

describe('connecting: press and release', () => {
  const boxes = new Map<string, Rect>([
    ['src', r(0, 0, 400, 300)],
    ['a', r(600, 0, 400, 300)],
    ['b', r(800, 100, 400, 300)],
  ])
  const base = { order: ['src', 'a', 'b'], boxes, sourceId: 'src' }

  it('holds the cable on the primary button only, and never while Space pans', () => {
    expect(connectPressHolds(0, false)).toBe(true)
    expect(connectPressHolds(1, false)).toBe(false)
    expect(connectPressHolds(2, false)).toBe(false)
    expect(connectPressHolds(0, true)).toBe(false)
  })

  it('ignores a release that did not start on the layer', () => {
    // A press on the bar's buttons, or a pan, ends in a release too.
    expect(connectRelease({ ...base, button: 0, pressed: false, point: { x: 700, y: 50 } })).toEqual({ kind: 'ignore' })
  })

  it('ignores the middle button, which pans', () => {
    expect(connectRelease({ ...base, button: 1, pressed: true, point: { x: 700, y: 50 } })).toEqual({ kind: 'ignore' })
  })

  it('plugs into the topmost screen under the pointer', () => {
    expect(connectRelease({ ...base, button: 0, pressed: true, point: { x: 900, y: 150 } })).toEqual({
      kind: 'drop',
      targetId: 'b',
    })
  })

  it('never plugs into the source screen', () => {
    expect(connectRelease({ ...base, button: 0, pressed: true, point: { x: 100, y: 100 } })).toEqual({ kind: 'cancel' })
  })

  it('lets go on nothing, or with no position', () => {
    expect(connectRelease({ ...base, button: 0, pressed: true, point: { x: 5000, y: 5000 } })).toEqual({ kind: 'cancel' })
    expect(connectRelease({ ...base, button: 0, pressed: true, point: null })).toEqual({ kind: 'cancel' })
  })

  it('treats a reconnection dropped back on its own target as letting go', () => {
    expect(connectRelease({ ...base, button: 0, pressed: true, point: { x: 650, y: 50 }, current: 'a' })).toEqual({
      kind: 'cancel',
    })
    expect(connectRelease({ ...base, button: 0, pressed: true, point: { x: 1100, y: 350 }, current: 'a' })).toEqual({
      kind: 'drop',
      targetId: 'b',
    })
  })
})
