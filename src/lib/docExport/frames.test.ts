import { describe, expect, it } from 'vitest'
import { coverCrop, focusOf } from './frames'

describe('the part of a picture a frame shows', () => {
  it('reads the focus the component writes, and the centre for anything else', () => {
    expect(focusOf('50% 0%')).toEqual({ x: 0.5, y: 0 })
    expect(focusOf('100% 100%')).toEqual({ x: 1, y: 1 })
    expect(focusOf('left top')).toEqual({ x: 0.5, y: 0.5 })
    expect(focusOf('')).toEqual({ x: 0.5, y: 0.5 })
  })

  it('covers the box: a landscape picture in a square loses its sides, evenly at the centre', () => {
    expect(coverCrop({ w: 400, h: 400 }, { w: 1200, h: 800 }, { x: 0.5, y: 0.5 }, 1)).toEqual({ sx: 200, sy: 0, sw: 800, sh: 800 })
    // Focused left: the left edge is kept.
    expect(coverCrop({ w: 400, h: 400 }, { w: 1200, h: 800 }, { x: 0, y: 0.5 }, 1)).toEqual({ sx: 0, sy: 0, sw: 800, sh: 800 })
    // A tall frame on the same picture keeps the full height and the box's proportions.
    const tall = coverCrop({ w: 300, h: 600 }, { w: 1200, h: 800 }, { x: 0.5, y: 0.5 }, 1)
    expect(tall.sh).toBe(800)
    expect(tall.sw / tall.sh).toBeCloseTo(0.5, 6)
  })

  it('zooms about the focus, as the component’s transform-origin does', () => {
    // Twice as close at the centre: the middle half of the visible square.
    expect(coverCrop({ w: 400, h: 400 }, { w: 800, h: 800 }, { x: 0.5, y: 0.5 }, 2)).toEqual({ sx: 200, sy: 200, sw: 400, sh: 400 })
    // Twice as close at the top: the top edge stays where it was.
    const top = coverCrop({ w: 400, h: 400 }, { w: 800, h: 800 }, { x: 0.5, y: 0 }, 2)
    expect(top).toEqual({ sx: 200, sy: 0, sw: 400, sh: 400 })
  })

  it('never reaches outside the picture', () => {
    const c = coverCrop({ w: 400, h: 400 }, { w: 1000, h: 500 }, { x: 1, y: 1 }, 1.5)
    expect(c.sx).toBeGreaterThanOrEqual(0)
    expect(c.sy).toBeGreaterThanOrEqual(0)
    expect(c.sx + c.sw).toBeLessThanOrEqual(1000 + 1e-9)
    expect(c.sy + c.sh).toBeLessThanOrEqual(500 + 1e-9)
  })
})
