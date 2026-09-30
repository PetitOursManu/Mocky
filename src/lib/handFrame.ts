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

/*
 * Traced twice. The first tracing, off the small reference, had the thumb stop
 * dead at the page's edge and a notch in the line between thumb and index; the
 * user circled both. The second, off a 2.1× enlargement of the same picture,
 * shows what the small one hid: the thumb's contour does not end at the edge —
 * it runs down along it and curves out as the base of the thumb (`THENAR`),
 * and the notch was the tip of the index finger showing between thumb and palm
 * (`FINGER_TIP`), a shape of its own.
 */

/** The back of the hand, from where it leaves the page's edge to where the arm leaves the picture. */
const OUTER: Pt[] = [
  [0, -413], [29, -408], [74, -399], [82, -391], [114, -352], [143, -317], [167, -293], [181, -276],
  [188, -257], [190, -229], [195, -200], [202, -162], [210, -114], [215, -76], [224, -43], [238, -19],
  [262, 10], [286, 40], [333, 100], [384, 160], [419, 200],
]
/** The inside of the wrist, from the page's bottom-right corner down out of the picture. */
const INNER: Pt[] = [
  [0, 0], [10, 26], [24, 48], [45, 64], [67, 73], [75, 80], [95, 107], [124, 152], [167, 229], [190, 271],
]
/** The thumb on the front: from where it meets the page's edge, up round the tip, back to the edge. */
const THUMB: Pt[] = [
  [0, -210], [-4, -221], [-11, -238], [-23, -260], [-34, -281], [-44, -302], [-51, -323], [-55, -342],
  [-55, -360], [-50, -373], [-40, -382], [-24, -386], [-10, -384], [0, -376],
]
/** The base of the thumb: the thumb's contour carried down along the edge and out into the palm. */
const THENAR: Pt[] = [
  [0, -210], [4, -190], [6, -177], [3, -152], [0, -124], [0, -100], [3, -76], [10, -55], [21, -34],
  [37, -16], [58, 2], [86, 14],
]
/** Between the thumb and the palm, from the thumb's tip down into the palm. */
const THUMB_SIDE: Pt[] = [
  [0, -375], [14, -357], [25, -341], [32, -329], [42, -307], [51, -285], [64, -255], [80, -232],
  [99, -213], [122, -194], [141, -174], [155, -155],
]
/** The tip of the index finger, showing between the thumb and the palm. */
const FINGER_TIP: Pt[] = [[47, -300], [60, -288], [74, -281], [68, -269], [64, -255]]
/** The nail, a closed loop. */
const NAIL: Pt[] = [
  [-46, -366], [-37, -376], [-20, -379], [-4, -372], [4, -358], [7, -346], [-1, -338], [-18, -332],
  [-32, -328], [-41, -331], [-46, -343], [-48, -356],
]
/** Short lines: the thumb's knuckle wrinkles, the fingers' folds, the palm's and the wrist's creases. */
const CREASES: Pt[][] = [
  [[-10, -291], [6, -298], [23, -303]],
  [[-2, -283], [13, -290], [29, -295]],
  [[6, -276], [18, -280], [30, -283]],
  [[62, -378], [48, -355], [32, -330]],
  [[74, -281], [97, -297], [120, -312]],
  [[81, -229], [108, -249], [136, -268]],
  [[95, -214], [116, -221], [136, -225]],
  [[6, -177], [26, -150], [55, -133]],
  [[215, -48], [206, -29], [193, -12]],
  [[170, 9], [141, 32], [114, 61]],
  [[79, 43], [121, 95], [162, 155]],
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
  /** The thumb as a closed shape, for its shadow on the sheet. */
  thumbShadow: string
  thenar: string
  thumbSide: string
  fingerTip: string
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
    thumbShadow: smoothPath(thumb) + ' Z',
    thenar: line(THENAR),
    thumbSide: line(THUMB_SIDE),
    fingerTip: line(FINGER_TIP),
    nail: line(NAIL, true),
    creases: CREASES.map((c) => line(c)),
  }
}

/** The coordinate pairs of a path, for the tests. */
export function pathPoints(d: string): { x: number; y: number }[] {
  return Array.from(d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g), (m) => ({ x: Number(m[1]), y: Number(m[2]) }))
}
