/**
 * The shapes a picture can be cut into — `<ShapeFrame shape="…">`.
 *
 * A CLOSED catalogue, drawn once, here, for the reason `<Scene3D preset>` and
 * `<Animated preset>` are closed: a model that writes its own `<svg><path d=…>`
 * writes a long string of numbers, and the generation prompt already forbids it
 * because a path cut off mid-string breaks the render. A name out of a list
 * cannot be cut off, and it can be tested.
 *
 * Every path lives in a 100 × 100 box and is STRETCHED to the frame it is drawn
 * in (`preserveAspectRatio="none"`), the way a shape layer is scaled in an
 * editor. So each shape also carries `ratio`, the width over height it was drawn
 * for: a circle in a 3:4 box is an oval, which is a choice the page may make,
 * and the arch's top is a half CIRCLE only at the ratio its radii were written
 * for. The component keeps that ratio unless the page sizes the box itself.
 *
 * A shape is up to three layers, and only the first is the hole:
 *  - `clip`  — where the picture shows. The template export (the frame without
 *              its picture) reads exactly this path.
 *  - `paper` — drawn UNDER the picture: the white card of a polaroid, the black
 *              strip of a film, with `evenodd` holes where the sprockets are.
 *  - `over`  — drawn OVER it: the two strips of tape on a scrapbook photo.
 *
 * The organic shapes (blobs, a splash, a torn edge) are generated from a seeded
 * random, so the "random" is the same on every machine, in every export and in
 * every test, forever. Numbers are rounded to two decimals: a path is part of the
 * preview's source, and sixteen digits of a coordinate is weight for nothing.
 */

export type FrameFamily = 'geometric' | 'organic' | 'wave' | 'photo'

export interface FrameShape {
  id: string
  family: FrameFamily
  /** Width over height the shape was drawn for. */
  ratio: number
  /** The hole the picture shows through, in a 0–100 box. */
  clip: string
  /** Drawn under the picture (`evenodd`), in `paperColor` unless the page gives one. */
  paper?: string
  paperColor?: string
  /** Drawn over the picture, in `overColor` at `overOpacity`. */
  over?: string
  overColor?: string
  overOpacity?: number
}

// ---- numbers and paths --------------------------------------------------------

type Pt = [number, number]

const r2 = (n: number) => Math.round(n * 100) / 100
const fmt = (n: number) => String(r2(n) === 0 ? 0 : r2(n))
const pt = ([x, y]: Pt) => `${fmt(x)} ${fmt(y)}`

/** A closed polygon. */
function poly(points: Pt[]): string {
  return (
    `M${pt(points[0])}` +
    points
      .slice(1)
      .map((p) => `L${pt(p)}`)
      .join('') +
    'Z'
  )
}

/** A rectangle with rounded corners: radius `rx` across, `ry` down, in box units. */
function roundRect(x: number, y: number, w: number, h: number, rx: number, ry = rx): string {
  const a = (to: Pt) => `A${fmt(rx)} ${fmt(ry)} 0 0 1 ${pt(to)}`
  return (
    `M${pt([x + rx, y])}H${fmt(x + w - rx)}${a([x + w, y + ry])}V${fmt(y + h - ry)}${a([x + w - rx, y + h])}` +
    `H${fmt(x + rx)}${a([x, y + h - ry])}V${fmt(y + ry)}${a([x + rx, y])}Z`
  )
}

/** An ellipse as two half arcs — a path, so it can sit in a list of paths. */
function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${pt([cx, cy - ry])}A${fmt(rx)} ${fmt(ry)} 0 1 1 ${pt([cx, cy + ry])}A${fmt(rx)} ${fmt(ry)} 0 1 1 ${pt([cx, cy - ry])}Z`
}

/** Points of a star (or a regular polygon when `inner` is 1), first point straight up. */
function starPoints(points: number, inner: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? 1 : inner
    const a = -Math.PI / 2 + (i * Math.PI) / points
    out.push([Math.cos(a) * rad, Math.sin(a) * rad])
  }
  return out
}

/** Stretch points so their bounding box is exactly the 0–100 square. */
function fill(points: Pt[]): Pt[] {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  return points.map(([x, y]) => [((x - x0) / (x1 - x0)) * 100, ((y - y0) / (y1 - y0)) * 100])
}

/** The width over height of a set of points before `fill` squares it. */
function aspect(points: Pt[]): number {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  return r2((Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys)))
}

/** mulberry32: a few lines, no dependency, the same sequence everywhere. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** One cubic segment's points, for measuring the curve itself rather than its handles. */
function sampleCubic(p0: Pt, c1: Pt, c2: Pt, p1: Pt, n = 48): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
      u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
    ])
  }
  return out
}

/**
 * A smooth closed curve through `anchors` (Catmull-Rom, as cubic Béziers),
 * mapped so the CURVE — not its handles — fills the 0–100 box.
 */
function smoothClosed(anchors: Pt[], tension = 1): { d: string; ratio: number } {
  const n = anchors.length
  const segs: [Pt, Pt, Pt, Pt][] = []
  for (let i = 0; i < n; i++) {
    const p0 = anchors[(i - 1 + n) % n]
    const p1 = anchors[i]
    const p2 = anchors[(i + 1) % n]
    const p3 = anchors[(i + 2) % n]
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension]
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension]
    segs.push([p1, c1, c2, p2])
  }
  const curve = segs.flatMap((s) => sampleCubic(...s))
  const xs = curve.map((p) => p[0])
  const ys = curve.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const map = ([x, y]: Pt): Pt => [((x - x0) / (x1 - x0)) * 100, ((y - y0) / (y1 - y0)) * 100]
  const d = `M${pt(map(segs[0][0]))}` + segs.map(([, c1, c2, p]) => `C${pt(map(c1))} ${pt(map(c2))} ${pt(map(p))}`).join('') + 'Z'
  return { d, ratio: r2((x1 - x0) / (y1 - y0)) }
}

/** A blob: a circle whose radius wanders by a few seeded harmonics. */
function blob(seed: number, opts: { points?: number; wobble?: number; stretch?: number } = {}): { d: string; ratio: number } {
  const rand = seeded(seed)
  const n = opts.points ?? 8
  const wobble = opts.wobble ?? 0.18
  const harmonics = [2, 3, 4].map((k) => ({ k, amp: (rand() - 0.5) * 2 * wobble, phase: rand() * Math.PI * 2 }))
  const anchors: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    let rad = 1
    for (const h of harmonics) rad += (h.amp / h.k) * Math.sin(h.k * a + h.phase)
    rad *= 1 + (rand() - 0.5) * wobble * 0.6
    anchors.push([Math.cos(a) * rad * (opts.stretch ?? 1), Math.sin(a) * rad])
  }
  return smoothClosed(anchors)
}

/**
 * An edge that undulates from `from` to `to` (horizontal), as quadratic arcs
 * whose control points alternate either side of the line: consecutive controls
 * are collinear with the point between them, so the curve has no corner.
 */
function waveEdge(from: number, to: number, y: number, amp: number, halves: number): string {
  const step = (to - from) / halves
  let d = ''
  for (let i = 0; i < halves; i++) {
    const x = from + step * i
    const sign = i % 2 === 0 ? 1 : -1
    d += `Q${pt([x + step / 2, y + sign * amp * 2])} ${pt([x + step, y])}`
  }
  return d
}

/** A jagged edge: `teeth` points either side of `y`, seeded so it never changes. */
function tornEdge(from: number, to: number, y: number, amp: number, teeth: number, seed: number): string {
  const rand = seeded(seed)
  const step = (to - from) / teeth
  let d = ''
  for (let i = 1; i <= teeth; i++) {
    const x = i === teeth ? to : from + step * i + (rand() - 0.5) * step * 0.5
    const off = i === teeth ? 0 : (rand() - 0.5) * 2 * amp
    d += `L${pt([x, y + off])}`
  }
  return d
}

/** A zigzag edge from `from` to `to` along `y`, its points `offset` away from it. */
function zigzagEdge(from: number, to: number, y: number, offset: number, teeth: number): string {
  const step = (to - from) / teeth
  let d = ''
  for (let i = 0; i < teeth; i++) {
    const x = from + step * i
    d += `L${pt([x + step / 2, y + offset])}L${pt([x + step, y])}`
  }
  return d
}

/**
 * A rectangle whose four edges are a row of half circles cut INWARD (a stamp's
 * perforation) or bulging OUTWARD (scalloped), all inside the 0–100 box.
 */
function bitten(inset: number, bumps: number, outward: boolean): string {
  const lo = inset
  const hi = 100 - inset
  const span = (hi - lo) / bumps
  const r = span / 2
  // sweep 1 bulges to the left of the travel direction in a y-down box, which
  // going clockwise round the rectangle is OUTWARD; 0 bites in.
  const sweep = outward ? 1 : 0
  const arc = (to: Pt) => `A${fmt(r)} ${fmt(r)} 0 0 ${sweep} ${pt(to)}`
  let d = `M${pt([lo, lo])}`
  for (let i = 1; i <= bumps; i++) d += arc([lo + span * i, lo])
  for (let i = 1; i <= bumps; i++) d += arc([hi, lo + span * i])
  for (let i = 1; i <= bumps; i++) d += arc([hi - span * i, hi])
  for (let i = 1; i <= bumps; i++) d += arc([lo, hi - span * i])
  return d + 'Z'
}

/** Petals: arcs bulging outward between points on a circle. */
function flower(petals: number): string {
  const R = 38
  const pts: Pt[] = []
  for (let i = 0; i < petals; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / petals
    pts.push([50 + Math.cos(a) * R, 50 + Math.sin(a) * R])
  }
  const chord = 2 * R * Math.sin(Math.PI / petals)
  const rr = chord / 2
  return `M${pt(pts[0])}` + pts.map((_, i) => `A${fmt(rr)} ${fmt(rr)} 0 0 1 ${pt(pts[(i + 1) % petals])}`).join('') + 'Z'
}

// ---- the catalogue -----------------------------------------------------------

const star5 = starPoints(5, 0.45)
const burst = starPoints(16, 0.8)
const hexagon: Pt[] = [
  [25, 0],
  [75, 0],
  [100, 50],
  [75, 100],
  [25, 100],
  [0, 50],
]

const geometric: FrameShape[] = [
  { id: 'circle', family: 'geometric', ratio: 1, clip: ellipse(50, 50, 50, 50) },
  { id: 'rounded', family: 'geometric', ratio: 0.8, clip: roundRect(0, 0, 100, 100, 10, 8) },
  { id: 'squircle', family: 'geometric', ratio: 1, clip: 'M50 0C90 0 100 10 100 50C100 90 90 100 50 100C10 100 0 90 0 50C0 10 10 0 50 0Z' },
  {
    id: 'triangle',
    family: 'geometric',
    ratio: 1.15,
    clip: poly([
      [50, 0],
      [100, 100],
      [0, 100],
    ]),
  },
  {
    id: 'diamond',
    family: 'geometric',
    ratio: 1,
    clip: poly([
      [50, 0],
      [100, 50],
      [50, 100],
      [0, 50],
    ]),
  },
  { id: 'pentagon', family: 'geometric', ratio: 1.05, clip: poly(fill(starPoints(5, 1).filter((_, i) => i % 2 === 0))) },
  { id: 'hexagon', family: 'geometric', ratio: 1.15, clip: poly(hexagon) },
  {
    id: 'octagon',
    family: 'geometric',
    ratio: 1,
    clip: poly([
      [29.29, 0],
      [70.71, 0],
      [100, 29.29],
      [100, 70.71],
      [70.71, 100],
      [29.29, 100],
      [0, 70.71],
      [0, 29.29],
    ]),
  },
  { id: 'star', family: 'geometric', ratio: aspect(star5), clip: poly(fill(star5)) },
  { id: 'burst', family: 'geometric', ratio: 1, clip: poly(fill(burst)) },
  {
    id: 'heart',
    family: 'geometric',
    ratio: 1.1,
    clip: 'M50 100C22 80 0 60 0 32C0 14 14 0 30 0C40 0 47 6 50 14C53 6 60 0 70 0C86 0 100 14 100 32C100 60 78 80 50 100Z',
  },
  // A half circle on top at 3:4: the radius is half the WIDTH, which is 37.5% of the height.
  { id: 'arch', family: 'geometric', ratio: 0.75, clip: 'M0 100V37.5A50 37.5 0 0 1 100 37.5V100Z' },
  { id: 'dome', family: 'geometric', ratio: 2, clip: 'M0 100A50 100 0 0 1 100 100Z' },
  { id: 'pill', family: 'geometric', ratio: 0.6, clip: 'M0 30A50 30 0 0 1 100 30V70A50 30 0 0 1 0 70Z' },
  { id: 'drop', family: 'geometric', ratio: 0.8, clip: 'M50 0C72 26 100 44 100 60A50 40 0 0 1 0 60C0 44 28 26 50 0Z' },
  { id: 'shield', family: 'geometric', ratio: 0.85, clip: 'M50 0L100 12V45C100 75 78 92 50 100C22 92 0 75 0 45V12Z' },
  {
    id: 'cross',
    family: 'geometric',
    ratio: 1,
    clip: poly([
      [33, 0],
      [67, 0],
      [67, 33],
      [100, 33],
      [100, 67],
      [67, 67],
      [67, 100],
      [33, 100],
      [33, 67],
      [0, 67],
      [0, 33],
      [33, 33],
    ]),
  },
  {
    id: 'parallelogram',
    family: 'geometric',
    ratio: 1.4,
    clip: poly([
      [20, 0],
      [100, 0],
      [80, 100],
      [0, 100],
    ]),
  },
  { id: 'flower', family: 'geometric', ratio: 1, clip: flower(8) },
  { id: 'leaf', family: 'geometric', ratio: 1, clip: 'M0 100C0 40 40 0 100 0C100 60 60 100 0 100Z' },
]

const blobs = [
  { id: 'blob-1', b: blob(11, { wobble: 0.34 }) },
  { id: 'blob-2', b: blob(23, { wobble: 0.32 }) },
  { id: 'blob-3', b: blob(37, { wobble: 0.38 }) },
  { id: 'blob-4', b: blob(41, { points: 7 }) },
  { id: 'blob-5', b: blob(59, { stretch: 1.25 }) },
  { id: 'blob-6', b: blob(73, { points: 9, wobble: 0.22 }) },
  { id: 'splash', b: blob(97, { points: 14, wobble: 0.55 }) },
  { id: 'pebble', b: blob(5, { points: 6, wobble: 0.08, stretch: 1.45 }) },
]
const organic: FrameShape[] = blobs.map(({ id, b }) => ({ id, family: 'organic', ratio: b.ratio, clip: b.d }))

const wave: FrameShape[] = [
  { id: 'wave-bottom', family: 'wave', ratio: 0.85, clip: `M0 0H100V90${waveEdge(100, 0, 90, -4, 4)}Z` },
  { id: 'wave-top', family: 'wave', ratio: 0.85, clip: `M0 10${waveEdge(0, 100, 10, 4, 4)}V100H0Z` },
  { id: 'wave-both', family: 'wave', ratio: 1, clip: `M0 9${waveEdge(0, 100, 9, 3.5, 4)}V91${waveEdge(100, 0, 91, 3.5, 4)}Z` },
  // The inset is the bumps' radius, so they reach the box's edge and no further.
  { id: 'scallop', family: 'wave', ratio: 1, clip: bitten(5, 10, true) },
  { id: 'zigzag', family: 'wave', ratio: 1, clip: `M0 6${zigzagEdge(0, 100, 6, -6, 12)}V94${zigzagEdge(100, 0, 94, 6, 12)}Z` },
  { id: 'torn', family: 'wave', ratio: 0.9, clip: `M0 5${tornEdge(0, 100, 5, 4, 18, 7)}V95${tornEdge(100, 0, 95, 4, 18, 13)}Z` },
]

const photo: FrameShape[] = [
  // A card, the picture high on it, the deep margin at the foot for a caption.
  { id: 'polaroid', family: 'photo', ratio: 0.82, paper: roundRect(0, 0, 100, 100, 1, 1), paperColor: '#ffffff', clip: 'M6 5H94V77H6Z' },
  { id: 'stamp', family: 'photo', ratio: 0.8, paper: bitten(0, 9, false), paperColor: '#ffffff', clip: 'M11 10H89V90H11Z' },
  {
    id: 'film',
    family: 'photo',
    ratio: 1.3,
    paper:
      'M0 0H100V100H0Z' +
      Array.from({ length: 9 }, (_, i) => roundRect(3 + i * 10.9, 4, 6, 7, 1.2, 1.2) + roundRect(3 + i * 10.9, 89, 6, 7, 1.2, 1.2)).join(
        '',
      ),
    paperColor: '#111111',
    clip: 'M3 17H97V83H3Z',
  },
  {
    id: 'ticket',
    family: 'photo',
    ratio: 1.6,
    clip: 'M5 0H95A5 8 0 0 0 100 8V40A6 10 0 0 0 100 60V92A5 8 0 0 0 95 100H5A5 8 0 0 0 0 92V60A6 10 0 0 0 0 40V8A5 8 0 0 0 5 0Z',
  },
  {
    id: 'bubble',
    family: 'photo',
    ratio: 1.2,
    clip: 'M10 0H90A10 12 0 0 1 100 12V68A10 12 0 0 1 90 80H34L18 100L22 80H10A10 12 0 0 1 0 68V12A10 12 0 0 1 10 0Z',
  },
  {
    id: 'tape',
    family: 'photo',
    ratio: 1,
    clip: 'M5 7H95V95H5Z',
    over:
      poly([
        [0, 10],
        [10, 0],
        [24, 14],
        [14, 24],
      ]) +
      poly([
        [90, 0],
        [100, 10],
        [86, 24],
        [76, 14],
      ]),
    overColor: '#efe6cf',
    overOpacity: 0.85,
  },
  {
    id: 'deckle',
    family: 'photo',
    ratio: 0.85,
    paper: `M0 2${tornEdge(0, 100, 2, 1.6, 26, 3)}${'V98'}${tornEdge(100, 0, 98, 1.6, 26, 19)}Z`,
    paperColor: '#fbf8f1',
    clip: 'M8 7H92V93H8Z',
  },
  { id: 'mat', family: 'photo', ratio: 0.8, paper: 'M0 0H100V100H0Z', paperColor: '#f4efe6', clip: ellipse(50, 50, 36, 40) },
]

export const FRAME_SHAPES: readonly FrameShape[] = [...geometric, ...organic, ...wave, ...photo]

export const FRAME_SHAPE_IDS: readonly string[] = FRAME_SHAPES.map((s) => s.id)

export const FRAME_FAMILIES: readonly FrameFamily[] = ['geometric', 'organic', 'wave', 'photo']

/** The shape an unknown name falls back to: a picture with soft corners is never wrong. */
export const DEFAULT_FRAME_SHAPE = 'rounded'

export function frameShape(id: unknown): FrameShape {
  return FRAME_SHAPES.find((s) => s.id === id) ?? FRAME_SHAPES.find((s) => s.id === DEFAULT_FRAME_SHAPE)!
}

export function isFrameShape(id: unknown): id is string {
  return typeof id === 'string' && FRAME_SHAPE_IDS.includes(id)
}
