/**
 * A printed document shown the way a flyer is: held in a hand.
 *
 * The devices of `deviceFrames.ts` are screens, and a flyer is paper — putting
 * one in a tablet (which its 794-px width would choose) says the wrong thing
 * about it. So paper gets its own wireframe: a right hand holding the sheet by
 * its bottom-right corner, the thumb on the front, the fingers' knuckles showing
 * past the right edge, the wrist leaving through the bottom of the picture.
 *
 * Same split as the devices: every number here, in the page's own pixels, and
 * the component only multiplies and draws. The hand is drawn once, in HAND
 * UNITS relative to the page's bottom-right corner (x to the right, y down;
 * the page is where x < 0 and y < 0), for an A4 page seen at 1 : 1 — a hand
 * about as long as the sheet is wide, which is roughly true of a real one. A
 * page of another size scales the hand by its SHORT side, so a US Letter or a
 * landscape A4 is held by the same hand, not a giant's or a child's.
 *
 * Two things are asserted by the tests rather than trusted to the drawing:
 * nothing is drawn outside the frame's box (the fit-to-area scale depends on
 * it), and the thumb stays in the bottom-right corner of the page — it is the
 * one part drawn OVER the design, so how much of the flyer it hides is a
 * number worth holding.
 */

/** The short side the hand was drawn for: an A4 page's width at 96 dpi. */
export const HAND_REFERENCE_PX = 794

/**
 * How far the frame's box reaches past the page's right and bottom edges, in
 * hand units. The forearm is drawn a little PAST the bottom and the component
 * clips it at the box, so the arm leaves through the edge of the picture as in
 * a photograph — closing it with a line, or a cuff, is what made the first
 * version read as a glove on a stick.
 */
export const HAND_REACH = { right: 224, bottom: 300 } as const
/** How far the forearm runs under the box's bottom edge before the clip. */
export const FOREARM_OVERSHOOT = 16

/*
 * The drawing, in hand units. It follows how a real hand holds a flyer in the
 * mockup photographs it was drawn from: the thumb lies FLAT on the front near
 * the corner, slim and tapered, its nail at the tip; the fingers are behind the
 * sheet, the index finger's side just showing past the right edge; the palm is
 * under the corner and the wrist leaves through the bottom. The thumb reaches
 * little onto the page — about a thumb's last joint — because it is the one
 * part drawn over the design.
 */
const BACK =
  'M -60,-300 C -10,-310 26,-300 30,-276 C 34,-250 28,-226 32,-196 C 38,-150 44,-110 54,-70 ' +
  'C 66,-20 98,30 136,78 C 164,116 186,160 200,230 L 216,316 L -6,316 ' +
  'C -8,250 -18,196 -36,156 C -46,134 -52,120 -54,108 L -56,-300 Z'
/** Soft interior lines: the index finger's tip crease, its knuckle, the palm's edge. */
const LINES = ['M 30,-276 C 22,-268 10,-264 -4,-266', 'M 44,-110 C 34,-104 22,-100 10,-100', 'M 54,-70 C 60,-40 68,-10 78,22']
/** Open at its base, where it grows out of the palm: the fill closes it, the stroke does not. */
const THUMB =
  'M 42,98 C 36,60 20,28 -6,0 C -30,-26 -60,-46 -90,-54 C -112,-60 -130,-50 -128,-34 ' +
  'C -126,-22 -114,-16 -98,-11 C -80,-4 -68,12 -60,34 C -56,56 -54,82 -54,108'
const NAIL = 'M -96,-52 C -108,-55 -120,-49 -120,-39 C -120,-31 -110,-28 -100,-30 C -92,-33 -88,-40 -90,-46 C -91,-49 -93,-51 -96,-52 Z'
/** The cuticle, and the two creases of the thumb's joint. */
const THUMB_LINES = ['M -84,-48 C -86,-42 -88,-35 -90,-29', 'M -40,-30 C -46,-22 -50,-14 -52,-6', 'M -32,-24 C -36,-17 -39,-11 -41,-4']

export interface HandFrame {
  /** The frame's box: the page at (0, 0) plus what the hand adds to its right and below. */
  width: number
  height: number
  page: { x: 0; y: 0; w: number; h: number }
  /** Hand units → page pixels. */
  scale: number
  /** SVG path data, in page pixels. `back` and `lines` go under the page, the thumb over it. */
  back: string
  lines: string[]
  thumbFill: string
  thumbStroke: string
  nail: string
  thumbLines: string[]
}

/** Every coordinate pair of a path moved from hand units to page pixels. */
function place(d: string, cornerX: number, cornerY: number, s: number): string {
  return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => {
    const px = cornerX + Number(x) * s
    const py = cornerY + Number(y) * s
    return `${round(px)},${round(py)}`
  })
}

const round = (n: number) => Math.round(n * 100) / 100

export function handFrame(pageW: number, pageH: number): HandFrame {
  const w = Math.max(1, pageW)
  const h = Math.max(1, pageH)
  const s = Math.min(w, h) / HAND_REFERENCE_PX
  const at = (d: string) => place(d, w, h, s)
  return {
    width: w + HAND_REACH.right * s,
    height: h + HAND_REACH.bottom * s,
    page: { x: 0, y: 0, w, h },
    scale: s,
    back: at(BACK),
    lines: LINES.map(at),
    thumbFill: at(THUMB + ' Z'),
    thumbStroke: at(THUMB),
    nail: at(NAIL),
    thumbLines: THUMB_LINES.map(at),
  }
}

/** The coordinate pairs of a path, for the tests. */
export function pathPoints(d: string): { x: number; y: number }[] {
  return Array.from(d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g), (m) => ({ x: Number(m[1]), y: Number(m[2]) }))
}
