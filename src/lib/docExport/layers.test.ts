import { describe, expect, it } from 'vitest'
import { readPsd } from 'ag-psd'
import { buildLayeredPsd, buildLayeredSvg, frameId, frameName, frameOverlayNames, type LayeredFrame } from './layers'
import { rotationOf } from './frames'
import { frameShape } from '../frameShapes'
import { frameTransform, pathData, placeFrame, toCubics } from '../frameGeometry'

// The smallest valid PNG there is: one transparent pixel.
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) =>
  c.charCodeAt(0),
)

const frame = (over: Partial<LayeredFrame> = {}): LayeredFrame => ({
  box: { shape: 'blob-3', cx: 300, cy: 400, w: 420, h: 430, angle: 0 },
  name: 'Cadre 1 — Blob 3',
  picture: { bytes: PNG, type: 'png' },
  overlays: [],
  overlayNames: frameOverlayNames('Cadre 1 — Blob 3', 'fr'),
  shadow: false,
  ...over,
})

describe('the page in layers', () => {
  it('names each frame after its place and its shape, in the person’s language, and gives editors an ASCII id', () => {
    expect(frameName(0, 'blob-3', 'fr')).toBe('Cadre 1 — Blob 3')
    expect(frameName(1, 'polaroid', 'en')).toBe('Frame 2 — Polaroid')
    expect(frameId(1, 'wave-bottom')).toBe('frame-2-wave-bottom')
    expect(frameOverlayNames('Cadre 1', 'fr')).toEqual({ stroke: 'Cadre 1 · contour', over: 'Cadre 1 · ruban', shadow: 'Cadre 1 · ombre' })
  })

  it('reads a frame’s turn off its computed transform', () => {
    expect(rotationOf('none')).toEqual({ angle: 0, scale: 1 })
    const turned = rotationOf(`matrix(${Math.cos(-0.1)}, ${Math.sin(-0.1)}, ${-Math.sin(-0.1)}, ${Math.cos(-0.1)}, 0, 0)`)
    expect(turned.angle).toBeCloseTo((-0.1 * 180) / Math.PI, 6)
    expect(turned.scale).toBeCloseTo(1, 6)
  })

  it('SVG: the page, then each frame as a named mask group holding ITS picture', () => {
    const svg = buildLayeredSvg({ png: PNG, width: 1080, height: 1080, frames: [frame()] })
    expect(svg).toContain('width="1080" height="1080" viewBox="0 0 1080 1080"')
    expect(svg).toContain('<image id="page"')
    expect(svg).toContain(`<clipPath id="frame-1-blob-3-shape"><path d="${pathData(placeFrame(frame().box))}"/></clipPath>`)
    const group = svg.slice(svg.indexOf('<g id="frame-1-blob-3"'))
    expect(group).toMatch(
      /^<g id="frame-1-blob-3" clip-path="url\(#frame-1-blob-3-shape\)"><title>Cadre 1 — Blob 3<\/title><image x="90" y="185" width="420" height="430"/,
    )
    expect(group).toContain('href="data:image/png;base64,')
    // The page comes first, so the frames sit above it where an editor can select them.
    expect(svg.indexOf('<image id="page"')).toBeLessThan(svg.indexOf('<g id="frames">'))
  })

  it('SVG: a turned frame’s picture turns with it, inside a clip that is already turned', () => {
    const svg = buildLayeredSvg({
      png: PNG,
      width: 1080,
      height: 1080,
      frames: [frame({ box: { shape: 'polaroid', cx: 800, cy: 700, w: 300, h: 366, angle: -6 } })],
    })
    expect(svg).toContain('transform="rotate(-6 800 700)"')
  })

  it('SVG: the shadow is a filter AROUND the clipped group, and the outline and tape are paths over it', () => {
    const tape = frameShape('tape')
    const box = { shape: 'tape', cx: 300, cy: 300, w: 300, h: 300, angle: 0 }
    const svg = buildLayeredSvg({
      png: PNG,
      width: 600,
      height: 600,
      frames: [
        frame({
          box,
          shadow: true,
          overlays: [
            { role: 'stroke', d: tape.clip, fill: null, stroke: { r: 17, g: 24, b: 39, a: 1 }, strokeWidth: 4, opacity: 1 },
            { role: 'over', d: tape.over!, fill: { r: 239, g: 230, b: 207, a: 1 }, stroke: null, strokeWidth: 0, opacity: 0.85 },
          ],
          overlayNames: frameOverlayNames('Cadre 1', 'fr'),
        }),
      ],
    })
    // A filter on the clipped element itself would be clipped away with it.
    expect(svg).toContain('<g filter="url(#frame-1-tape-shadow)"><g id="frame-1-tape" clip-path=')
    expect(svg).toContain('<feDropShadow dx="0" dy="10" stdDeviation="9"')
    expect(svg).toContain(
      `<path id="frame-1-tape-stroke" d="${pathData(toCubics(tape.clip), frameTransform(box))}" fill="none" stroke="#111827" stroke-width="4" stroke-linejoin="round"><title>Cadre 1 · contour</title></path>`,
    )
    expect(svg).toContain('fill="#EFE6CF" fill-opacity="0.85"><title>Cadre 1 · ruban</title>')
    expect(svg.indexOf('-stroke"')).toBeGreaterThan(svg.indexOf('<g id="frame-1-tape"'))
  })

  it('SVG: a page with no frame is just the page', () => {
    const svg = buildLayeredSvg({ png: PNG, width: 100, height: 100, frames: [] })
    expect(svg).not.toContain('clipPath')
    expect(svg).not.toContain('<defs>')
  })

  it('PSD: the page at the bottom, then each layer named and where it was drawn', async () => {
    const px = (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(200) })
    const bytes = await buildLayeredPsd({
      width: 40,
      height: 30,
      composite: px(40, 30),
      layers: [
        { name: 'Page', left: 0, top: 0, pixels: px(40, 30) },
        { name: 'Cadre 1 — Blob 3 · ombre', left: 3, top: 4, pixels: px(14, 12) },
        { name: 'Cadre 1 — Blob 3', left: 5, top: 6, pixels: px(10, 8) },
      ],
    })
    const psd = readPsd(bytes.buffer as ArrayBuffer, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true })
    expect([psd.width, psd.height]).toEqual([40, 30])
    expect(psd.children?.map((l) => l.name)).toEqual(['Page', 'Cadre 1 — Blob 3 · ombre', 'Cadre 1 — Blob 3'])
    const f = psd.children![2]
    expect([f.left, f.top, f.right, f.bottom]).toEqual([5, 6, 15, 14])
  })
})
