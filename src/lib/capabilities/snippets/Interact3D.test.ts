import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { InteractSource } from './Interact'
import { Interact3DSource } from './Interact3D'

/**
 * The depth half of the interaction kit, from the strings the preview
 * prepends. A rendered corridor was checked in a browser; what geometry and
 * timing can prove is proved here.
 */

type V3 = [number, number, number]
const kit = new Function(
  'React',
  `${InteractSource}\n${Interact3DSource}
return { Box3D, MaskRise, SheetCrop, MockySpace, mockyBezier, mockyBoxShade, mockyView, MOCKY_EASE };`,
)(React) as {
  Box3D: React.FC<Record<string, unknown>>
  MaskRise: React.FC<Record<string, unknown>>
  SheetCrop: React.FC<Record<string, unknown>>
  MockySpace: { facing: (a: V3, b: V3) => number; look: (a: V3, b: V3) => number; ring: (a: number, r: number, y?: number) => V3 }
  mockyBezier: (a: number, b: number, c: number, d: number) => (t: number) => number
  mockyBoxShade: (rx: number, ry: number, rz: number, face: string, light?: V3) => { lambert: number; normal: V3 }
  mockyView: (cam: Record<string, number>, p: V3) => { ahead: number; dist: number }
  MOCKY_EASE: Record<string, (t: number) => number>
}

describe('easing', () => {
  it('solves a cubic-bezier the way a browser does', () => {
    const linear = kit.mockyBezier(0, 0, 1, 1)
    expect(linear(0.3)).toBeCloseTo(0.3, 5)
    const ease = kit.mockyBezier(0.25, 0.1, 0.25, 1) // CSS `ease`
    expect(ease(0.5)).toBeCloseTo(0.8024, 3)
    expect(ease(0)).toBe(0)
    expect(ease(1)).toBe(1)
  })

  it('names the curves a brief uses', () => {
    expect(kit.MOCKY_EASE.quartOut(0.5)).toBeCloseTo(1 - 0.5 ** 4, 9)
    expect(kit.MOCKY_EASE.sineInOut(0.5)).toBeCloseTo(0.5, 9)
  })
})

describe('Box3D', () => {
  it('turns the right face towards the viewer at rotateY −90, and lights it', () => {
    const cover = kit.mockyBoxShade(0, -90, 0, 'right')
    expect(cover.normal[2]).toBeCloseTo(1, 9)
    expect(cover.lambert).toBeGreaterThan(0.8)
    // …while the spine turns away and goes dark.
    expect(kit.mockyBoxShade(0, -90, 0, 'front').lambert).toBeLessThan(0.4)
  })

  it('draws only the faces it is given, each hidden from behind', () => {
    const out = renderToStaticMarkup(
      React.createElement(kit.Box3D, { w: 36, h: 210, d: 110, front: 'spine', right: 'cover', 'data-film': 'noon', onClick: () => {} }),
    )
    expect(out.match(/data-face=/g)?.length).toBe(2)
    expect(out).toContain('data-face="right"')
    expect(out).toContain('rotateY(90deg) translateZ(18px)')
    expect(out).toContain('backface-visibility:hidden')
    expect(out).toContain('data-film="noon"')
    expect(out).toContain('transform-style:preserve-3d')
  })
})

describe('a clickable volume', () => {
  it('is a keyboard button, unless the page decided otherwise', () => {
    const on = renderToStaticMarkup(React.createElement(kit.Box3D, { w: 10, h: 10, d: 2, front: 'x', onClick: () => {}, 'aria-label': 'Open Noon in Ashes' }))
    expect(on).toContain('tabindex="0"')
    expect(on).toContain('role="button"')
    expect(on).toContain('aria-label="Open Noon in Ashes"')
    expect(renderToStaticMarkup(React.createElement(kit.Box3D, { w: 10, h: 10, d: 2, front: 'x' }))).not.toContain('tabindex')
    expect(renderToStaticMarkup(React.createElement(kit.Box3D, { w: 10, h: 10, d: 2, front: 'x', onClick: () => {}, tabIndex: -1 }))).toContain('tabindex="-1"')
  })
})

describe('Space3D arithmetic', () => {
  it('faces an object towards a point and turns a camera to look at it', () => {
    const at: V3 = [18, 2, 0]
    // A print on the outer wall at angle 0 faces the centre: −x.
    expect(kit.MockySpace.facing(at, [0, 2, 0])).toBeCloseTo(-Math.PI / 2, 9)
    // A camera at the centre looking at it turns right (negative yaw).
    expect(kit.MockySpace.look([0, 2, 0], at)).toBeCloseTo(-Math.PI / 2, 9)
    const p = kit.MockySpace.ring(Math.PI / 2, 12.2, 1.95)
    expect(p[0]).toBeCloseTo(0, 9)
    expect(p[2]).toBeCloseTo(12.2, 9)
  })

  it('knows what is ahead of the camera and what is behind it', () => {
    const cam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }
    expect(kit.mockyView(cam, [0, 0, -5]).ahead).toBeCloseTo(5, 9)
    expect(kit.mockyView(cam, [0, 0, 5]).ahead).toBeCloseTo(-5, 9)
    // Turned a quarter left, −x is ahead.
    expect(kit.mockyView({ ...cam, yaw: Math.PI / 2 }, [-3, 0, 0]).ahead).toBeCloseTo(3, 9)
  })
})

describe('MaskRise', () => {
  it('holds each line under its own mask until it plays', () => {
    const out = renderToStaticMarkup(React.createElement(kit.MaskRise, { play: false }, 'a', 'b'))
    expect(out.match(/overflow:hidden/g)?.length).toBe(2)
    expect(out.match(/translateY\(110%\)/g)?.length).toBe(2)
  })
})

describe('SheetCrop as a mask', () => {
  it('cuts its children with the crop instead of drawing it, and mirrors without mirroring words', () => {
    const out = renderToStaticMarkup(
      React.createElement(kit.SheetCrop, { sheet: { src: 'https://x/s.png', w: 2688, h: 1520 }, box: [98, 145, 403, 849], mask: true, flip: true }, 'NUTRITION'),
    )
    expect(out).toContain('mask-image:url(')
    expect(out).not.toContain('background-image')
    expect(out.match(/scaleX\(-1\)/g)?.length).toBe(2)
  })
})
