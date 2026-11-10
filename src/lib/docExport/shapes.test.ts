import { describe, expect, it } from 'vitest'
import {
  assignLayers,
  classifyPaint,
  geometryOf,
  gridIslands,
  opaqueBounds,
  paintMargin,
  paintOrder,
  parseLinearGradient,
  parseShadows,
  pickShadow,
  type PaintStyle,
} from './shapes'

/** A computed style as `getComputedStyle` writes one for a plain <div>: paints nothing. */
function css(over: Partial<PaintStyle> = {}): PaintStyle {
  const none = { width: 0, style: 'none', color: 'rgb(0, 0, 0)' }
  return {
    tag: 'DIV',
    backgroundColor: 'rgba(0, 0, 0, 0)',
    backgroundImage: 'none',
    clipText: false,
    borders: [none, none, none, none],
    radii: ['0px', '0px', '0px', '0px'],
    boxShadow: 'none',
    filter: 'none',
    backdropFilter: 'none',
    mixBlendMode: 'normal',
    clipPath: 'none',
    maskImage: 'none',
    tilted: false,
    pseudo: false,
    platform: false,
    opacity: 1,
    clipped: false,
    ...over,
  }
}
const box = { x: 10, y: 20, w: 200, h: 100 }
const side = (width: number, color = 'rgb(17, 24, 39)', style = 'solid') => ({ width, style, color })

describe('a linear gradient, as a slide draws one', () => {
  it('reads what the browser computes from a Tailwind gradient', () => {
    const g = parseLinearGradient('linear-gradient(to right, rgb(59, 130, 246), rgb(147, 51, 234))', box)!
    expect(g.angle).toBe(90)
    expect(g.stops).toEqual([
      { pos: 0, color: { r: 59, g: 130, b: 246, a: 1 } },
      { pos: 1, color: { r: 147, g: 51, b: 234, a: 1 } },
    ])
  })

  it('spreads missing stops between their neighbours, and reads % and px', () => {
    const g = parseLinearGradient('linear-gradient(180deg, rgb(0, 0, 0) 0%, rgb(255, 0, 0), rgb(0, 0, 255) 50px)', box)!
    // At 180deg the gradient line is the box's height: 50 px is half of it.
    const [a, b, c] = g.stops.map((s) => s.pos)
    expect(a).toBe(0)
    expect(b).toBeCloseTo(0.25, 9)
    expect(c).toBeCloseTo(0.5, 9)
  })

  it('takes a corner as the angle CSS gives it on THIS box', () => {
    const square = parseLinearGradient('linear-gradient(to top right, rgb(0, 0, 0), rgb(255, 255, 255))', { w: 100, h: 100 })!
    expect(square.angle).toBeCloseTo(45, 6)
    const wide = parseLinearGradient('linear-gradient(to bottom right, rgb(0, 0, 0), rgb(255, 255, 255))', { w: 200, h: 100 })!
    expect(wide.angle).toBeCloseTo(180 - (Math.atan2(100, 200) * 180) / Math.PI, 6)
  })

  it('fades to transparent in the neighbour’s colour, not through grey', () => {
    const g = parseLinearGradient('linear-gradient(rgb(236, 72, 153), transparent)', box)!
    expect(g.stops[1].color).toEqual({ r: 236, g: 72, b: 153, a: 0 })
  })

  it('refuses what it cannot draw exactly', () => {
    expect(parseLinearGradient('radial-gradient(rgb(0, 0, 0), rgb(255, 255, 255))', box)).toBeNull()
    expect(parseLinearGradient('repeating-linear-gradient(rgb(0, 0, 0), rgb(255, 255, 255) 10px)', box)).toBeNull()
    expect(parseLinearGradient('linear-gradient(rgb(0, 0, 0), rgb(1, 1, 1)), url("x.png")', box)).toBeNull()
    expect(parseLinearGradient('linear-gradient(oklch(0.7 0.1 200), rgb(1, 1, 1))', box)).toBeNull()
    expect(parseLinearGradient('linear-gradient(rgb(0, 0, 0), 30%, rgb(1, 1, 1))', box)).toBeNull()
  })
})

describe('shadows', () => {
  it('reads Tailwind’s shadow-lg and keeps the one that shows most', () => {
    const list = parseShadows('rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px')
    expect(list).toHaveLength(3)
    const { shadow, ring, inset } = pickShadow(list)
    expect(shadow).toEqual({ dx: 0, dy: 10, blur: 15, color: { r: 0, g: 0, b: 0, a: 0.1 } })
    expect(ring).toBeNull()
    expect(inset).toBe(false)
  })

  it('reads a ring as an outline and an inner shadow as something a shape cannot draw', () => {
    expect(pickShadow(parseShadows('rgb(255, 255, 255) 0px 0px 0px 2px')).ring).toEqual({ width: 2, color: { r: 255, g: 255, b: 255, a: 1 }, dash: 'solid' })
    expect(pickShadow(parseShadows('rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset')).inset).toBe(true)
  })

  it('says how far a shadow or a filter draws past the box', () => {
    expect(paintMargin('rgba(0, 0, 0, 0.1) 0px 10px 15px -3px', 'none')).toBe(25)
    expect(paintMargin('none', 'drop-shadow(rgba(0, 0, 0, 0.18) 0px 10px 18px)')).toBe(28)
    expect(paintMargin('none', 'none')).toBe(0)
  })
})

describe('corners', () => {
  it('names the preset a slide has', () => {
    expect(geometryOf(['0px', '0px', '0px', '0px'], 100, 50)).toEqual({ prst: 'rect' })
    expect(geometryOf(['12px', '12px', '12px', '12px'], 100, 50)).toEqual({ prst: 'roundRect', radius: 12 })
    expect(geometryOf(['9999px', '9999px', '9999px', '9999px'], 40, 40)).toEqual({ prst: 'ellipse' })
    expect(geometryOf(['9999px', '9999px', '9999px', '9999px'], 120, 40)).toEqual({ prst: 'roundRect', radius: 20 })
    expect(geometryOf(['50%', '50%', '50%', '50%'], 120, 40)).toEqual({ prst: 'ellipse' })
    expect(geometryOf(['16px', '16px', '0px', '0px'], 100, 50)).toEqual({ prst: 'round2SameRect', radius: 16, flip: false })
    expect(geometryOf(['0px', '0px', '8px', '8px'], 100, 50)).toEqual({ prst: 'round2SameRect', radius: 8, flip: true })
  })

  it('has no preset for one rounded corner', () => {
    expect(geometryOf(['16px', '0px', '0px', '0px'], 100, 50)).toBeNull()
  })
})

describe('what one element paints, and how a slide carries it', () => {
  it('paints nothing when it draws nothing', () => {
    expect(classifyPaint(css(), box)).toEqual({ kind: 'none' })
  })

  it('makes a coloured, rounded, outlined, shadowed card ONE native shape', () => {
    const p = classifyPaint(
      css({
        backgroundColor: 'rgb(255, 255, 255)',
        borders: [side(2), side(2), side(2), side(2)],
        radii: ['16px', '16px', '16px', '16px'],
        boxShadow: 'rgba(0, 0, 0, 0.1) 0px 4px 6px -1px',
        opacity: 0.5,
      }),
      box,
    )
    expect(p.kind).toBe('shapes')
    if (p.kind !== 'shapes') return
    expect(p.shapes).toHaveLength(1)
    const [s] = p.shapes
    // The outline sits on the edge in a slide, inside the box in CSS: inset by half of it.
    expect(s.rect).toEqual({ x: 11, y: 21, w: 198, h: 98 })
    expect(s.geom).toEqual({ prst: 'roundRect', radius: 15 })
    expect(s.fill).toEqual({ kind: 'solid', color: { r: 255, g: 255, b: 255, a: 0.5 } })
    expect(s.line).toEqual({ width: 2, color: { r: 17, g: 24, b: 39, a: 0.5 }, dash: 'solid' })
    expect(s.shadow?.color.a).toBeCloseTo(0.05, 6)
  })

  it('draws a border on some sides only as a bar per side', () => {
    const p = classifyPaint(css({ borders: [side(0), side(0), side(1, 'rgb(229, 231, 235)'), side(4, 'rgb(236, 72, 153)')] }), box)
    expect(p.kind).toBe('shapes')
    if (p.kind !== 'shapes') return
    expect(p.shapes.map((s) => s.rect)).toEqual([
      { x: 10, y: 119, w: 200, h: 1 },
      { x: 10, y: 20, w: 4, h: 100 },
    ])
  })

  it('carries a simple linear gradient as a gradient fill', () => {
    const p = classifyPaint(css({ backgroundImage: 'linear-gradient(to right, rgb(59, 130, 246), rgb(147, 51, 234))' }), box)
    expect(p.kind === 'shapes' && p.shapes[0].fill?.kind).toBe('linear')
  })

  it('makes a picture of what no shape says exactly — its own paint only', () => {
    for (const over of [
      { backgroundImage: 'url("/api/images/abc")' },
      { backgroundImage: 'radial-gradient(rgb(0, 0, 0), rgb(255, 255, 255))' },
      { backgroundColor: 'oklch(0.7 0.1 200)' },
      { backgroundColor: 'rgb(0, 0, 0)', radii: ['16px', '0px', '0px', '0px'] },
      { backgroundColor: 'rgb(0, 0, 0)', boxShadow: 'rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset' },
      { backgroundColor: 'rgb(0, 0, 0)', clipped: true },
      { backgroundColor: 'rgb(0, 0, 0)', pseudo: true },
      { pseudo: true },
    ] satisfies Partial<PaintStyle>[]) {
      expect(classifyPaint(css(over), box), JSON.stringify(over)).toMatchObject({ kind: 'raster', whole: false })
    }
  })

  it('makes a picture of the whole subtree for what changes how everything inside is drawn', () => {
    expect(classifyPaint(css({ tag: 'IMG' }), box)).toMatchObject({ kind: 'raster', whole: true, role: 'picture' })
    expect(classifyPaint(css({ tag: 'SVG' }), box)).toMatchObject({ kind: 'raster', whole: true, role: 'icon' })
    expect(classifyPaint(css({ tilted: true }), box)).toMatchObject({ kind: 'raster', whole: true })
    expect(classifyPaint(css({ filter: 'blur(8px)' }), box)).toMatchObject({ kind: 'raster', whole: true, margin: 8 })
    expect(classifyPaint(css({ maskImage: 'url("data:…")' }), box)).toMatchObject({ kind: 'raster', whole: true })
    expect(classifyPaint(css({ platform: true }), box)).toMatchObject({ kind: 'raster', whole: true })
  })

  it('leaves a gradient painted INTO text to the text box', () => {
    expect(classifyPaint(css({ clipText: true, backgroundImage: 'linear-gradient(rgb(0, 0, 0), rgb(1, 1, 1))' }), box)).toEqual({ kind: 'none' })
  })
})

describe('paint order', () => {
  it('puts the flow first, then what is positioned, then positive z, negative z under all', () => {
    const order = paintOrder([
      { z: 0, positioned: true, dom: 0 }, // an absolute blob, early in the source
      { z: 0, positioned: false, dom: 1 }, // a card in the flow
      { z: 10, positioned: true, dom: 2 }, // a sticker on top
      { z: -1, positioned: true, dom: 3 }, // a backdrop behind
      { z: 0, positioned: false, dom: 4 },
    ])
    expect(order).toEqual([3, 1, 4, 0, 2])
  })
})

describe('layers of pictures', () => {
  it('never puts two overlapping pictures in one layer', () => {
    const photo = { x: 0, y: 0, w: 400, h: 300 }
    const icon = { x: 20, y: 20, w: 24, h: 24 }
    const other = { x: 500, y: 0, w: 100, h: 100 }
    expect(assignLayers([photo, icon, other])).toEqual([0, 1, 0])
    // Past the cap, the last layer takes the rest.
    expect(assignLayers([photo, photo, photo], 2)).toEqual([0, 1, 1])
  })
})

describe('what a drawing holds', () => {
  it('bounds what is opaque', () => {
    const w = 4
    const h = 3
    const data = new Uint8ClampedArray(w * h * 4)
    data[(1 * w + 2) * 4 + 3] = 255
    data[(2 * w + 1) * 4 + 3] = 200
    expect(opaqueBounds(data, w, h)).toEqual({ x: 1, y: 1, w: 2, h: 2 })
    expect(opaqueBounds(new Uint8ClampedArray(w * h * 4), w, h)).toBeNull()
  })

  it('finds islands of what is left, touching corners included', () => {
    // prettier-ignore
    const occ = [
      1, 0, 0, 0,
      0, 1, 0, 1,
      0, 0, 0, 1,
    ]
    expect(gridIslands(occ, 4, 3)).toEqual([
      { c0: 0, r0: 0, c1: 1, r1: 1 },
      { c0: 3, r0: 1, c1: 3, r1: 2 },
    ])
  })
})
