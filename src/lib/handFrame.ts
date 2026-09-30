/**
 * A printed document shown the way a flyer is: held in a hand.
 *
 * The devices of `deviceFrames.ts` are screens, and a flyer is paper — putting
 * one in a tablet (which its 794-px width would choose) says the wrong thing
 * about it. So paper gets its own line drawing: a right hand holding the sheet
 * by its RIGHT edge, low down, the thumb lying on the front along that edge,
 * the fingers behind the sheet, the back of the hand and the wrist leaving the
 * picture at the bottom right.
 *
 * The drawing is traced from a reference the user chose (a mockup of a flyer
 * held this way) — two freehand attempts before it read as a glove on a stick,
 * then as a mitten. Its points were read off that picture on a grid, and
 * because its page is almost exactly an A4 at 96 dpi, they were kept in page
 * pixels as they were: HAND UNITS are pixels of an A4 page at 1 : 1, measured
 * from the page's bottom-right corner (x to the right, y down; the page is
 * where x < 0 and y < 0). A page of another size scales the hand by its SHORT
 * side, so a US Letter or a landscape A4 is held by the same hand.
 *
 * Points, not hand-written curves: each outline is a list of points smoothed
 * into cubic Béziers (`smoothPath`), so a retouch is moving a point, not
 * re-balancing control handles.
 *
 * Same split as the devices: every number here, in the page's own pixels; the
 * component only multiplies and draws. The tests hold what cannot be seen in a
 * test of a drawing: nothing leaves the frame's box except the arm, which runs
 * past it on purpose and is clipped there (so it leaves the picture as in a
 * photograph), and the thumb — the one part drawn OVER the design — stays a
 * narrow band along the right edge in the lower half of the page.
 */

type Pt = readonly [number, number]

/** The short side the hand was traced at: an A4 page's width at 96 dpi. */
export const HAND_REFERENCE_PX = 794

/** How far the frame's box reaches past the page's right and bottom edges, in hand units. */
export const HAND_REACH = { right: 300, bottom: 170 } as const
/** How far the arm runs past the box (right and bottom) before the clip cuts it. */
export const FOREARM_OVERSHOOT = 140

/* ── the tracing, in hand units ─────────────────────────────────────────────── */

/** The back of the hand, from where it leaves the page's edge to where the arm leaves the picture. */
const OUTER: Pt[] = [
  [1, -410], [60, -398], [72, -391], [100, -358], [135, -308], [160, -283], [175, -258],
  [180, -218], [183, -188], [190, -118], [200, -68], [215, -28], [235, 2], [260, 32],
  [308, 82], [370, 145], [436, 212],
]
/** The inside of the wrist, from the page's bottom-right corner down out of the picture. */
const INNER: Pt[] = [
  [0, 0], [25, 37], [60, 69], [75, 82], [105, 132], [135, 190], [160, 250], [176, 310],
]
/** The thumb on the front: from where it leaves the page's edge, up round the tip, back to the edge. */
const THUMB: Pt[] = [
  [-1, -183], [-5, -208], [-15, -238], [-27, -263], [-40, -293], [-50, -323], [-55, -348],
  [-54, -368], [-45, -380], [-30, -386], [-15, -384], [1, -373],
]
/** Between the thumb and the index finger, down to where the palm starts. */
const THUMB_SIDE: Pt[] = [
  [1, -373], [25, -333], [41, -298], [60, -281], [55, -258], [70, -228], [85, -213], [110, -188],
]
/** The nail, a closed loop. */
const NAIL: Pt[] = [
  [-47, -361], [-43, -334], [-33, -326], [2, -337], [5, -348], [0, -370], [-15, -378], [-40, -376],
]
/** Short lines: the thumb's knuckle wrinkles, the fingers' folds, the palm's creases. */
const CREASES: Pt[][] = [
  [[-10, -288], [5, -294], [20, -298]],
  [[-3, -281], [11, -287], [25, -292]],
  [[5, -274], [15, -277], [25, -279]],
  [[24, -333], [34, -350], [44, -366]],
  [[60, -281], [80, -294], [100, -304]],
  [[70, -228], [94, -246], [117, -263]],
  [[85, -218], [98, -221], [110, -223]],
  [[-1, -178], [16, -158], [35, -140]],
  [[1, -78], [34, -34], [70, 12]],
  [[67, 42], [88, 68], [110, 97]],
]

/**
 * A polyline smoothed into cubic Béziers through every point (Catmull-Rom,
 * tension 1/6 — the classic conversion), so the curve passes exactly through
 * the traced points. Closed for a loop such as the nail.
 */
export function smoothPath(points: readonly Pt[], closed = false): string {
  const n = points.length
  if (n === 0) return ''
  const f = (v: number) => Math.round(v * 100) / 100
  if (n === 1) return `M${f(points[0][0])},${f(points[0][1])}`
  const at = (i: number): Pt => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))])
  let d = `M${f(points[0][0])},${f(points[0][1])}`
  const segments = closed ? n : n - 1
  for (let i = 0; i < segments; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`
  }
  return closed ? d + ' Z' : d
}

export interface HandFrame {
  /** The frame's box: the page at (0, 0) plus what the hand adds to its right and below. */
  width: number
  height: number
  page: { x: 0; y: 0; w: number; h: number }
  /** Hand units → page pixels. */
  scale: number
  /**
   * SVG path data, in page pixels, all drawn OVER the page: the palm and the
   * fingers are behind the sheet and simply not drawn, and nothing of the hand
   * but the thumb lies over the page. `fill` is the visible hand as one shape
   * (it runs along the page's edge, where it must not be stroked); the other
   * paths are the lines to stroke.
   */
  fill: string
  outer: string
  inner: string
  thumb: string
  thumbSide: string
  nail: string
  creases: string[]
}

export function handFrame(pageW: number, pageH: number): HandFrame {
  const w = Math.max(1, pageW)
  const h = Math.max(1, pageH)
  const s = Math.min(w, h) / HAND_REFERENCE_PX
  const place = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [w + x * s, h + y * s] as const)
  const line = (pts: readonly Pt[], closed = false) => smoothPath(place(pts), closed)

  // The visible hand as one area: the back of the hand, round the far corner
  // past the clip, up the inside of the wrist to the page's corner, up the
  // page's edge to the thumb, round the thumb, and back up the edge.
  const outer = place(OUTER)
  const inner = place(INNER)
  const thumb = place(THUMB)
  const far: Pt = [outer[outer.length - 1][0], inner[inner.length - 1][1]]
  const fill =
    smoothPath(outer) +
    ` L${far[0]},${far[1]}` +
    ' ' + smoothPath([...inner].reverse()).replace(/^M/, 'L') +
    ' ' + smoothPath(thumb).replace(/^M/, 'L') +
    ` L${outer[0][0]},${outer[0][1]} Z`

  return {
    width: w + HAND_REACH.right * s,
    height: h + HAND_REACH.bottom * s,
    page: { x: 0, y: 0, w, h },
    scale: s,
    fill,
    outer: smoothPath(outer),
    inner: smoothPath(inner),
    thumb: smoothPath(thumb),
    thumbSide: line(THUMB_SIDE),
    nail: line(NAIL, true),
    creases: CREASES.map((c) => line(c)),
  }
}

/** The coordinate pairs of a path, for the tests. */
export function pathPoints(d: string): { x: number; y: number }[] {
  return Array.from(d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g), (m) => ({ x: Number(m[1]), y: Number(m[2]) }))
}
