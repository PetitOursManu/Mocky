import { describe, expect, it } from 'vitest'
import { readPsd } from 'ag-psd'
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import { buildTemplatePdf, buildTemplatePsd, buildTemplateSvg, frameId, frameName, PLACEHOLDER_GREY } from './template'
import { documentHasFrames } from './files'
import { rotationOf } from './frames'
import { pathData, placeFrame } from '../frameGeometry'
import { getPageFormat } from '../pageFormats'
import type { PageSnapshot } from './types'

// The smallest valid PNG there is: one transparent pixel.
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) =>
  c.charCodeAt(0),
)

const format = getPageFormat('social-square')
const snapshot: PageSnapshot = {
  index: 0,
  width: format.w,
  height: format.h,
  lines: [],
  blocks: [],
  fields: [],
  links: [],
  frames: [
    { shape: 'blob-3', cx: 300, cy: 400, w: 420, h: 430, angle: 0 },
    { shape: 'polaroid', cx: 800, cy: 700, w: 300, h: 366, angle: -6 },
  ],
}

describe('the template of a document', () => {
  it('is offered only to a document with a picture in a shape', () => {
    expect(documentHasFrames('<Page><ShapeFrame shape="arch" /></Page>')).toBe(true)
    expect(documentHasFrames('<Page><img src="/x" /></Page>')).toBe(false)
  })

  it('names each frame after its place and its shape, in the person’s language, and gives editors an ASCII id', () => {
    expect(frameName(0, 'blob-3', 'fr')).toBe('Cadre 1 — Blob 3')
    expect(frameName(1, 'polaroid', 'en')).toBe('Frame 2 — Polaroid')
    expect(frameId(1, 'wave-bottom')).toBe('frame-2-wave-bottom')
  })

  it('reads a frame’s turn off its computed transform', () => {
    expect(rotationOf('none')).toEqual({ angle: 0, scale: 1 })
    const turned = rotationOf(`matrix(${Math.cos(-0.1)}, ${Math.sin(-0.1)}, ${-Math.sin(-0.1)}, ${Math.cos(-0.1)}, 0, 0)`)
    expect(turned.angle).toBeCloseTo((-0.1 * 180) / Math.PI, 6)
    expect(turned.scale).toBeCloseTo(1, 6)
  })

  it('SVG: the page, then one named clip group per frame holding a grey rectangle', () => {
    const svg = buildTemplateSvg({ png: PNG, snapshot }, 'fr')
    expect(svg).toContain(`width="${format.w}" height="${format.h}" viewBox="0 0 ${format.w} ${format.h}"`)
    expect(svg).toContain('<image id="page"')
    expect(svg).toContain('href="data:image/png;base64,')
    expect(svg).toContain('<clipPath id="frame-1-blob-3-shape">')
    expect(svg).toContain(`<path d="${pathData(placeFrame(snapshot.frames![0]))}"/>`)
    expect(svg).toContain('<g id="frame-2-polaroid" clip-path="url(#frame-2-polaroid-shape)"><title>Cadre 2 — Polaroid</title>')
    expect(svg.match(new RegExp(`fill="${PLACEHOLDER_GREY}"`, 'g'))).toHaveLength(2)
    // The page comes first, so the frames sit above it where an editor can select them.
    expect(svg.indexOf('<image')).toBeLessThan(svg.indexOf('<g id="frames">'))
  })

  it('SVG: a page with no frame is just the page', () => {
    const svg = buildTemplateSvg({ png: PNG, snapshot: { ...snapshot, frames: [] } })
    expect(svg).not.toContain('clipPath')
  })

  it('PDF: one page per page at the format’s size, each frame a clip around the placeholder picture', async () => {
    const bytes = await buildTemplatePdf(
      [
        { png: PNG, snapshot },
        { png: PNG, snapshot: { ...snapshot, index: 1, frames: [] } },
      ],
      format,
      {
        title: 'Post',
        placeholder: PNG,
      },
    )
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2)
    expect(doc.getPage(0).getSize()).toEqual({ width: format.widthPt, height: format.heightPt })
    expect(doc.getTitle()).toBe('Post')
    // Page 1 draws the page and two placeholders, each inside a clip (W n) of its own state (q … Q).
    const contents = doc.getPage(0).node.Contents()
    const streams = contents instanceof PDFArray ? contents.asArray().map((r) => doc.context.lookup(r)) : [contents]
    const ops = streams
      .filter((st): st is PDFRawStream => st instanceof PDFRawStream)
      .map((st) => new TextDecoder('latin1').decode(decodePDFRawStream(st).decode()))
      .join('\n')
    expect(ops.match(/\bW\s+n\b/g)).toHaveLength(2)
    expect(ops.match(/\bDo\b/g)).toHaveLength(3)
  })

  it('PSD: the page at the bottom, one layer per frame above it, named, where its shape is', async () => {
    const px = (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(200) })
    const bytes = await buildTemplatePsd({
      width: 40,
      height: 30,
      page: px(40, 30),
      composite: px(40, 30),
      frames: [{ name: 'Cadre 1 — Blob 3', left: 5, top: 6, pixels: px(10, 8) }],
    })
    const psd = readPsd(bytes.buffer as ArrayBuffer, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true })
    expect([psd.width, psd.height]).toEqual([40, 30])
    expect(psd.children?.map((l) => l.name)).toEqual(['Page', 'Cadre 1 — Blob 3'])
    const frame = psd.children![1]
    expect([frame.left, frame.top, frame.right, frame.bottom]).toEqual([5, 6, 15, 14])
  })
})
