/**
 * A frame's shape, placed on a page: the path the template export draws where
 * the picture was (`lib/docExport/template.ts`).
 *
 * The catalogue (`frameShapes.ts`) writes its shapes in a 0–100 box with lines,
 * quadratics, cubics and ARCS, and a frame on a page is that box stretched to
 * its size, turned by its rotation and moved to its place. An arc does not
 * survive a stretch followed by a turn — its radii and its axis would both have
 * to change — while a Bézier does: an affine map of a cubic is the cubic of the
 * mapped points. So every shape is first rewritten as lines and cubics, once,
 * and placing it is then arithmetic on points, exactly the same in an SVG, a
 * PDF, a Photoshop file and a canvas that punches the hole.
 */
import { frameShape } from './frameShapes'

export type Pt = [number, number]
export type Seg = { type: 'L'; p: Pt } | { type: 'C'; c1: Pt; c2: Pt; p: Pt }
export interface Subpath {
  start: Pt
  segs: Seg[]
}

/** A frame as the page laid it out, in CSS px from the page's top-left corner. */
export interface FrameBox {
  shape: string
  /** The centre of the frame's box. */
  cx: number
  cy: number
  /** The box's own size, before any rotation. */
  w: number
  h: number
  /** Clockwise, in degrees — CSS's direction. */
  angle: number
}

/**
 * An SVG arc as cubic Béziers (SVG 1.1 appendix F.6.5 for the centre, then one
 * cubic per quarter turn or less).
 */
function arcToCubics(p0: Pt, rx: number, ry: number, phiDeg: number, large: boolean, sweep: boolean, p1: Pt): Seg[] {
  if (rx === 0 || ry === 0) return [{ type: 'L', p: p1 }]
  if (p0[0] === p1[0] && p0[1] === p1[1]) return []
  rx = Math.abs(rx)
  ry = Math.abs(ry)
  const phi = (phiDeg * Math.PI) / 180
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  const dx = (p0[0] - p1[0]) / 2
  const dy = (p0[1] - p1[1]) / 2
  const x1 = cos * dx + sin * dy
  const y1 = -sin * dx + cos * dy
  // Radii too small for the chord are scaled up until they fit (F.6.6).
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
  if (lambda > 1) {
    rx *= Math.sqrt(lambda)
    ry *= Math.sqrt(lambda)
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den))
  const cxp = (coef * rx * y1) / ry
  const cyp = (-coef * ry * x1) / rx
  const cx = cos * cxp - sin * cyp + (p0[0] + p1[0]) / 2
  const cy = sin * cxp + cos * cyp + (p0[1] + p1[1]) / 2
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    return a
  }
  const theta1 = angle(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry)
  let delta = angle((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry)
  if (!sweep && delta > 0) delta -= 2 * Math.PI
  if (sweep && delta < 0) delta += 2 * Math.PI

  const n = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9))
  const step = delta / n
  const k = (4 / 3) * Math.tan(step / 4)
  const point = (t: number): Pt => {
    const x = rx * Math.cos(t)
    const y = ry * Math.sin(t)
    return [cos * x - sin * y + cx, sin * x + cos * y + cy]
  }
  const deriv = (t: number): Pt => {
    const x = -rx * Math.sin(t)
    const y = ry * Math.cos(t)
    return [cos * x - sin * y, sin * x + cos * y]
  }
  const out: Seg[] = []
  for (let i = 0; i < n; i++) {
    const a = theta1 + step * i
    const b = a + step
    const pa = point(a)
    const pb = i === n - 1 ? p1 : point(b)
    const da = deriv(a)
    const db = deriv(b)
    out.push({ type: 'C', c1: [pa[0] + k * da[0], pa[1] + k * da[1]], c2: [pb[0] - k * db[0], pb[1] - k * db[1]], p: pb })
  }
  return out
}

/**
 * A catalogue path as subpaths of lines and cubics. Absolute commands only —
 * the catalogue writes nothing else, and its test holds it to that.
 */
export function toCubics(d: string): Subpath[] {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? []
  const out: Subpath[] = []
  let i = 0
  let cmd = ''
  let cur: Pt = [0, 0]
  let sub: Subpath | null = null
  const num = () => Number(tokens[i++])
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++]
    if (cmd === 'Z') {
      if (sub) cur = sub.start
      sub = null
      continue
    }
    if (cmd === 'M') {
      cur = [num(), num()]
      sub = { start: cur, segs: [] }
      out.push(sub)
      cmd = 'L' // further pairs after an M are lines
      continue
    }
    if (!sub) {
      sub = { start: cur, segs: [] }
      out.push(sub)
    }
    if (cmd === 'L') {
      cur = [num(), num()]
      sub.segs.push({ type: 'L', p: cur })
    } else if (cmd === 'H') {
      cur = [num(), cur[1]]
      sub.segs.push({ type: 'L', p: cur })
    } else if (cmd === 'V') {
      cur = [cur[0], num()]
      sub.segs.push({ type: 'L', p: cur })
    } else if (cmd === 'C') {
      const c1: Pt = [num(), num()]
      const c2: Pt = [num(), num()]
      cur = [num(), num()]
      sub.segs.push({ type: 'C', c1, c2, p: cur })
    } else if (cmd === 'Q') {
      const q: Pt = [num(), num()]
      const p: Pt = [num(), num()]
      // A quadratic is the cubic whose handles sit two thirds of the way to its control point.
      sub.segs.push({
        type: 'C',
        c1: [cur[0] + (2 / 3) * (q[0] - cur[0]), cur[1] + (2 / 3) * (q[1] - cur[1])],
        c2: [p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])],
        p,
      })
      cur = p
    } else if (cmd === 'A') {
      const rx = num()
      const ry = num()
      const rot = num()
      const large = num() !== 0
      const sweep = num() !== 0
      const p: Pt = [num(), num()]
      sub.segs.push(...arcToCubics(cur, rx, ry, rot, large, sweep, p))
      cur = p
    } else {
      throw new Error(`unsupported path command "${cmd}"`)
    }
  }
  return out
}

const cache = new Map<string, Subpath[]>()

/** The shape's hole as lines and cubics in its 0–100 box, computed once per shape. */
export function shapeCubics(shape: string): Subpath[] {
  const s = frameShape(shape)
  let c = cache.get(s.id)
  if (!c) {
    c = toCubics(s.clip)
    cache.set(s.id, c)
  }
  return c
}

/** The 0–100 box → the frame on the page: stretch, turn about the centre, move. */
export function frameTransform(box: FrameBox): (p: Pt) => Pt {
  const a = (box.angle * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  return ([x, y]) => {
    const lx = (x / 100 - 0.5) * box.w
    const ly = (y / 100 - 0.5) * box.h
    return [box.cx + lx * cos - ly * sin, box.cy + lx * sin + ly * cos]
  }
}

/** Every point of a path through `f` — an affine map keeps lines and cubics what they are. */
export function mapSubpaths(subpaths: readonly Subpath[], f: (p: Pt) => Pt): Subpath[] {
  return subpaths.map((sp) => ({
    start: f(sp.start),
    segs: sp.segs.map((s) => (s.type === 'L' ? { type: 'L', p: f(s.p) } : { type: 'C', c1: f(s.c1), c2: f(s.c2), p: f(s.p) })),
  }))
}

/** The frame's hole on the page, in CSS px. */
export function placeFrame(box: FrameBox): Subpath[] {
  return mapSubpaths(shapeCubics(box.shape), frameTransform(box))
}

const n2 = (v: number) => String(Math.round(v * 100) / 100)

/** Subpaths as SVG path data, optionally mapped point by point (to another unit, a flipped axis…). */
export function pathData(subpaths: Subpath[], map: (p: Pt) => Pt = (p) => p): string {
  const pt = (p: Pt) => {
    const [x, y] = map(p)
    return `${n2(x)} ${n2(y)}`
  }
  return subpaths
    .map(
      (sp) =>
        `M${pt(sp.start)}` + sp.segs.map((s) => (s.type === 'L' ? `L${pt(s.p)}` : `C${pt(s.c1)} ${pt(s.c2)} ${pt(s.p)}`)).join('') + 'Z',
    )
    .join('')
}

/** The axis-aligned box a placed frame covers — for the placeholder an editor will fill. */
export function boundsOf(subpaths: Subpath[]): { x: number; y: number; w: number; h: number } {
  const pts = subpaths.flatMap((sp) => [sp.start, ...sp.segs.flatMap((s) => (s.type === 'L' ? [s.p] : [s.c1, s.c2, s.p]))])
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}
