/**
 * A printed document shown the way a flyer is: held in a hand.
 *
 * The devices of `deviceFrames.ts` are screens, and a flyer is paper — putting
 * one in a tablet (which its 794-px width would choose) says the wrong thing
 * about it. So paper gets its own wireframe: a right hand holding the sheet by
 * its bottom-right corner, the thumb on the front, the fingers' knuckles showing
 * past the right edge, a cuff below.
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

/** How far the hand reaches past the page's right and bottom edges, in hand units. */
export const HAND_REACH = { right: 270, bottom: 350 } as const

/*
 * The drawing, in hand units. Parts that lie over the page are hidden behind it
 * (the palm and the fingers are BEHIND the sheet); only the thumb is drawn in
 * front. The palm's inner contour runs into the thumb's lower edge, so the two
 * read as one hand rather than a thumb glued onto a mitten.
 */
const BACK =
  'M -110,-420 C -20,-440 40,-420 46,-384 C 52,-348 40,-326 50,-300 C 60,-266 54,-240 58,-212 ' +
  'C 62,-178 54,-154 60,-126 C 72,-70 110,-20 150,26 C 186,66 206,112 220,160 L 244,250 L 50,272 ' +
  'C 42,200 4,138 -80,95 C -120,60 -140,-100 -110,-420 Z'
/** The creases where the fingers meet, past the page's edge. */
const KNUCKLES = [
  'M 46,-384 C 30,-376 16,-372 0,-374',
  'M 50,-300 C 34,-294 20,-292 2,-294',
  'M 58,-212 C 42,-206 28,-204 10,-206',
  'M 60,-126 C 46,-120 34,-118 18,-120',
]
const CUFF = 'M 36,236 L 244,210 L 266,318 L 58,346 Z'
const CUFF_LINE = 'M 40,258 L 248,232'
/** Open at its base, where it grows out of the palm: the fill closes it, the stroke does not. */
const THUMB = 'M 52,128 C 26,50 -10,0 -70,-44 C -110,-74 -160,-104 -190,-90 C -216,-78 -210,-42 -178,-24 C -140,-2 -104,24 -80,95'
const NAIL = 'M -160,-86 C -178,-96 -198,-88 -196,-70 C -194,-56 -176,-50 -162,-58 C -154,-64 -152,-80 -160,-86 Z'
const CREASE = 'M -96,-36 C -88,-20 -86,-6 -92,8'

export interface HandFrame {
  /** The frame's box: the page at (0, 0) plus what the hand adds to its right and below. */
  width: number
  height: number
  page: { x: 0; y: 0; w: number; h: number }
  /** Hand units → page pixels. */
  scale: number
  /** SVG path data, in page pixels. `back` and `cuff` go under the page, the rest over it. */
  back: string
  knuckles: string[]
  cuff: string
  cuffLine: string
  thumbFill: string
  thumbStroke: string
  nail: string
  crease: string
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
    knuckles: KNUCKLES.map(at),
    cuff: at(CUFF),
    cuffLine: at(CUFF_LINE),
    thumbFill: at(THUMB + ' Z'),
    thumbStroke: at(THUMB),
    nail: at(NAIL),
    crease: at(CREASE),
  }
}

/** The coordinate pairs of a path, for the tests. */
export function pathPoints(d: string): { x: number; y: number }[] {
  return Array.from(d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g), (m) => ({ x: Number(m[1]), y: Number(m[2]) }))
}
