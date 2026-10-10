import { describe, expect, it } from 'vitest'
import {
  CARD_GUTTER,
  CARD_W,
  FIT_MAX_SCALE,
  FOCUS_ANIM_MS,
  FOCUS_MAX_SCALE,
  FRAME_PAD,
  MIN_SCALE,
  contentBox,
  easeOutCubic,
  frameBox,
  latestScreenOf,
  viewBetween,
} from './framing'

/** Just enough of a Screen for the geometry — the rest of the record is irrelevant here. */
const box = (x: number, y: number, w: number, h: number, imageHash?: string) => ({ x, y, w, h, imageHash })

describe('contentBox', () => {
  it('has nothing to bound on an empty board', () => {
    expect(contentBox([])).toBeNull()
  })

  it('bounds a single screen exactly', () => {
    expect(contentBox([box(100, 50, 400, 300)])).toEqual({ x: 100, y: 50, w: 400, h: 300 })
  })

  it('spans every screen, whatever order they arrive in', () => {
    const spread = contentBox([box(1000, 800, 200, 100), box(-200, -100, 200, 100)])
    expect(spread).toEqual({ x: -200, y: -100, w: 1400, h: 1000 })
  })

  it('counts the card column for a screen that draws one', () => {
    // The card hangs off the right of the frame, outside its box: bounding on
    // x + w alone framed the project with every card sliced down the middle.
    const withCard = contentBox([box(0, 0, 400, 300, 'abc')])
    expect(withCard).toEqual({ x: 0, y: 0, w: 400 + CARD_GUTTER + CARD_W, h: 300 })
  })

  it('does not widen a screen that draws no card', () => {
    // Most projects have none, and paying for the column unconditionally would
    // loosen every one of those fits.
    expect(contentBox([box(0, 0, 400, 300)])?.w).toBe(400)
  })

  it('only widens on the screens that actually have a card', () => {
    const mixed = contentBox([box(0, 0, 400, 300, 'abc'), box(2000, 0, 400, 300)])
    expect(mixed?.w).toBe(2400)
  })

  it('counts the column for a screen whose only card is an attached media', () => {
    // The film card draws in the same column as the Muse image, so a screen
    // that has one and no image still needs the room. Gating on `imageHash`
    // alone framed those with the card sliced down the middle — the very bug
    // the test above records, arriving by a second door.
    const withFilm = contentBox([{ x: 0, y: 0, w: 400, h: 300, attachedMedia: { kind: 'film', hash: 'ff' } }])
    expect(withFilm).toEqual({ x: 0, y: 0, w: 400 + CARD_GUTTER + CARD_W, h: 300 })
  })
})

describe('frameBox', () => {
  const viewport = { width: 1200, height: 800 }

  it('refuses a box with no area', () => {
    expect(frameBox({ x: 0, y: 0, w: 0, h: 100 }, viewport, FRAME_PAD, FIT_MAX_SCALE)).toBeNull()
    expect(frameBox({ x: 0, y: 0, w: 100, h: -1 }, viewport, FRAME_PAD, FIT_MAX_SCALE)).toBeNull()
  })

  it('refuses a viewport with no area', () => {
    // A container measured before layout reports 0×0. Framing against it would
    // produce a NaN scale and blank the board.
    expect(frameBox({ x: 0, y: 0, w: 100, h: 100 }, { width: 0, height: 800 }, 0, 1)).toBeNull()
  })

  it('fits the constraining axis and leaves the padding on it', () => {
    // 2000 wide into 1200 with 80 either side → (1200 - 160) / 2000.
    const v = frameBox({ x: 0, y: 0, w: 2000, h: 100 }, viewport, FRAME_PAD, FIT_MAX_SCALE)!
    expect(v.scale).toBeCloseTo(1040 / 2000)
    expect(v.x).toBeCloseTo(FRAME_PAD)
  })

  it('centres the box in the viewport', () => {
    const b = { x: 300, y: 200, w: 400, h: 300 }
    const v = frameBox(b, viewport, FRAME_PAD, FIT_MAX_SCALE)!
    // The box's centre, mapped through the transform, lands on the viewport's.
    expect(v.x + (b.x + b.w / 2) * v.scale).toBeCloseTo(viewport.width / 2)
    expect(v.y + (b.y + b.h / 2) * v.scale).toBeCloseTo(viewport.height / 2)
  })

  it('never blows a small board up past its ceiling', () => {
    // A single 200×150 screen would want 5×. Life size is the point where
    // showing an arrangement stops being what is happening.
    const v = frameBox({ x: 0, y: 0, w: 200, h: 150 }, viewport, FRAME_PAD, FIT_MAX_SCALE)!
    expect(v.scale).toBe(FIT_MAX_SCALE)
  })

  it('stops one screen short of life size, so its edge stays visible', () => {
    const v = frameBox({ x: 0, y: 0, w: 200, h: 150 }, viewport, FRAME_PAD, FOCUS_MAX_SCALE)!
    expect(v.scale).toBe(FOCUS_MAX_SCALE)
  })

  it('never shrinks past MIN_SCALE, however far the board is spread', () => {
    const v = frameBox({ x: 0, y: 0, w: 10_000_000, h: 10_000_000 }, viewport, FRAME_PAD, FIT_MAX_SCALE)!
    expect(v.scale).toBe(MIN_SCALE)
  })

  it('answers differently for the same box when the container changes size', () => {
    // The regression this module exists for: the framing is a function of the
    // container, so a stored result is wrong the moment the container resizes.
    const b = { x: 0, y: 0, w: 2000, h: 1500 }
    const wide = frameBox(b, { width: 1600, height: 900 }, FRAME_PAD, FIT_MAX_SCALE)!
    const narrow = frameBox(b, { width: 700, height: 900 }, FRAME_PAD, FIT_MAX_SCALE)!
    expect(narrow.scale).toBeLessThan(wide.scale)
    expect(narrow.x + (b.x + b.w / 2) * narrow.scale).toBeCloseTo(350)
  })
})

describe('latestScreenOf', () => {
  it('has no answer for an empty board', () => {
    expect(latestScreenOf([])).toBeNull()
  })

  it('picks the most recently created, not the last in the array', () => {
    // Array order is creation order today, but an import or a cross-device
    // merge can hand back a list in any order.
    const screens = [
      { id: 'a', createdAt: 30 },
      { id: 'b', createdAt: 10 },
      { id: 'c', createdAt: 20 },
    ]
    expect(latestScreenOf(screens)?.id).toBe('a')
  })

  it('keeps the first of a tie rather than reporting nothing', () => {
    const screens = [
      { id: 'a', createdAt: 5 },
      { id: 'b', createdAt: 5 },
    ]
    expect(latestScreenOf(screens)?.id).toBe('a')
  })
})

describe('the camera on its way to a screen', () => {
  const viewport = { width: 1000, height: 600 }
  const from = { x: 80, y: 80, scale: 0.4 }
  const to = { x: -900, y: -300, scale: 0.8 }
  const centre = (v: { x: number; y: number; scale: number }) => ({
    x: (viewport.width / 2 - v.x) / v.scale,
    y: (viewport.height / 2 - v.y) / v.scale,
  })

  it('starts where it was and lands exactly on the target', () => {
    expect(viewBetween(from, to, 0, viewport)).toEqual(from)
    expect(viewBetween(from, to, 1, viewport)).toEqual(to)
    expect(viewBetween(from, to, 1.2, viewport)).toEqual(to)
  })

  // Interpolating x, y and scale apart bends the path: the board swings
  // sideways while it zooms. The point at the centre must go straight.
  it('moves the point at the centre of the view in a straight line', () => {
    const a = centre(from)
    const b = centre(to)
    for (const t of [0.25, 0.5, 0.75]) {
      const c = centre(viewBetween(from, to, t, viewport))
      expect(c.x).toBeCloseTo(a.x + (b.x - a.x) * t, 6)
      expect(c.y).toBeCloseTo(a.y + (b.y - a.y) * t, 6)
    }
  })

  it('zooms by a constant ratio, so a long zoom is as even as a short one', () => {
    const half = viewBetween(from, to, 0.5, viewport).scale
    expect(half).toBeCloseTo(Math.sqrt(from.scale * to.scale), 9)
  })

  it('arrives fast and settles, within [0, 1]', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(2)).toBe(1)
    expect(FOCUS_ANIM_MS).toBeLessThanOrEqual(400)
  })
})
