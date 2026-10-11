/**
 * The TEMPLATE of a document: the page as it was designed, with every
 * `<ShapeFrame>` left EMPTY, for someone to put their own pictures in later, in
 * the editor they already use.
 *
 * The page is drawn by the same renderer as the ordinary PNG (render.ts with
 * `template: true`): each frame's picture hidden, its shape measured, and the
 * shape cut out of the page's picture so it is transparent. Then each format
 * puts the frame back as something its editor treats as a frame:
 *
 *  - PNG — the page with holes: slide a photograph under it, in anything.
 *  - SVG — Figma, Illustrator, Inkscape: each frame a clip path holding a grey
 *          rectangle, named after its shape — an editor's mask group, whose
 *          fill is replaced by an image.
 *  - PDF — Canva, Illustrator, Affinity: each frame a vector clip holding a
 *          placeholder PICTURE. A clipped picture in an imported PDF is what
 *          Canva turns into one of its frames, the thing a photo is dropped
 *          into — the route the people who make Canva frames by hand document.
 *  - PSD — Photoshop: the page as a layer, and one layer per frame, filled in
 *          the frame's shape above it; a photograph placed above a frame layer
 *          and clipped to it (Alt + click between them) is the clipping mask the
 *          person asked for in those words.
 *
 * What a template does not keep is the page's TEXT as text: it is in the
 * picture. The .pptx export is the one that edits words, and it says so.
 */
import { boundsOf, pathData, placeFrame, type FrameBox, type Subpath } from '../frameGeometry'
import { partsEn, partsFr } from '../../i18n/parts'
import type { PageFormat } from '../pageFormats'
import type { PageSnapshot } from './types'

export type TemplateKind = 'png' | 'svg' | 'pdf' | 'psd'

/** The grey a frame waits in — the same as `<ShapeFrame>`'s own placeholder. */
export const PLACEHOLDER_GREY = '#d4d4d8'

/** "Cadre 2 — Blob 3": the name a frame's layer, group or id is given. */
export function frameName(index: number, shape: string, lang: 'fr' | 'en' = 'fr'): string {
  const dict = lang === 'en' ? partsEn : partsFr
  const shapeName = dict[`frames.shape.${shape}`] || shape
  return (dict['frames.layer'] || 'Frame {n} — {shape}').replace('{n}', String(index + 1)).replace('{shape}', shapeName)
}

/** An id an SVG editor shows as the layer's name: ASCII, no space. */
export function frameId(index: number, shape: string): string {
  return `frame-${index + 1}-${shape.replace(/[^a-z0-9-]/gi, '')}`
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return btoa(bin)
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const n2 = (v: number) => String(Math.round(v * 100) / 100)

/**
 * One page as an SVG: the page's picture (holes and all), and above it one
 * group per frame — a clip path in the frame's shape around a grey rectangle.
 * In page px, so the file is the page's own size.
 */
export function buildTemplateSvg(page: { png: Uint8Array; snapshot: PageSnapshot }, lang: 'fr' | 'en' = 'fr'): string {
  const { width: W, height: H } = page.snapshot
  const href = `data:image/png;base64,${toBase64(page.png)}`
  const frames = page.snapshot.frames ?? []
  const groups = frames.map((f, i) => {
    const placed = placeFrame(f)
    const b = boundsOf(placed)
    const id = frameId(i, f.shape)
    return (
      `<clipPath id="${id}-shape"><path d="${pathData(placed)}"/></clipPath>` +
      `<g id="${id}" clip-path="url(#${id}-shape)"><title>${esc(frameName(i, f.shape, lang))}</title>` +
      `<rect x="${n2(b.x)}" y="${n2(b.y)}" width="${n2(b.w)}" height="${n2(b.h)}" fill="${PLACEHOLDER_GREY}"/></g>`
    )
  })
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<image id="page" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" href="${href}" xlink:href="${href}"/>` +
    (groups.length ? `<g id="frames">${groups.join('')}</g>` : '') +
    `</svg>\n`
  )
}

/** pdf-lib operators drawing a path, in PDF points with the y axis up. */
function pathOperators(lib: typeof import('pdf-lib'), subs: Subpath[], map: (p: [number, number]) => [number, number]) {
  const ops = []
  for (const sp of subs) {
    const [sx, sy] = map(sp.start)
    ops.push(lib.moveTo(sx, sy))
    for (const s of sp.segs) {
      if (s.type === 'L') {
        const [x, y] = map(s.p)
        ops.push(lib.lineTo(x, y))
      } else {
        const [ax, ay] = map(s.c1)
        const [bx, by] = map(s.c2)
        const [x, y] = map(s.p)
        ops.push(lib.appendBezierCurve(ax, ay, bx, by, x, y))
      }
    }
    ops.push(lib.closePath())
  }
  return ops
}

/**
 * The PDF: per page, the page's picture full-bleed, then each frame as a vector
 * clip around a placeholder picture (see the header for why a picture).
 */
export async function buildTemplatePdf(
  pages: Array<{ png: Uint8Array; snapshot: PageSnapshot }>,
  format: Pick<PageFormat, 'w' | 'h' | 'widthPt' | 'heightPt'>,
  opts: { title: string; placeholder: Uint8Array; lang?: 'fr' | 'en' },
): Promise<Uint8Array> {
  const lib = await import('pdf-lib')
  const doc = await lib.PDFDocument.create()
  doc.setTitle(opts.title, { showInWindowTitleBar: true })
  doc.setCreator('Mocky')
  const placeholder = await doc.embedPng(opts.placeholder)
  const k = format.widthPt / format.w
  for (const p of pages) {
    const page = doc.addPage([format.widthPt, format.heightPt])
    const img = await doc.embedPng(p.png)
    page.drawImage(img, { x: 0, y: 0, width: format.widthPt, height: format.heightPt })
    const toPt = ([x, y]: [number, number]): [number, number] => [x * k, format.heightPt - y * k]
    for (const f of p.snapshot.frames ?? []) {
      const placed = placeFrame(f)
      const b = boundsOf(placed)
      page.pushOperators(lib.pushGraphicsState(), ...pathOperators(lib, placed, toPt), lib.clip(), lib.endPath())
      page.drawImage(placeholder, { x: b.x * k, y: format.heightPt - (b.y + b.h) * k, width: b.w * k, height: b.h * k })
      page.pushOperators(lib.popGraphicsState())
    }
  }
  return doc.save()
}

/** Pixels the PSD writer takes without a canvas — what the browser hands it, and a test can build. */
export interface Pixels {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface PsdLayer {
  name: string
  left: number
  top: number
  pixels: Pixels
}

/**
 * The PSD: the page at the bottom (holes and all), one layer per frame above
 * it, and the flattened picture a viewer without layers shows. Layers come in
 * already drawn: a shape is filled by a canvas, which is the browser's half.
 */
export async function buildTemplatePsd(doc: {
  width: number
  height: number
  page: Pixels
  frames: PsdLayer[]
  composite: Pixels
}): Promise<Uint8Array> {
  const { writePsdUint8Array } = await import('ag-psd')
  return writePsdUint8Array(
    {
      width: doc.width,
      height: doc.height,
      imageData: doc.composite,
      children: [
        { name: 'Page', left: 0, top: 0, imageData: doc.page },
        ...doc.frames.map((f) => ({ name: f.name, left: f.left, top: f.top, imageData: f.pixels })),
      ],
    },
    // The page has holes, so it is not a background; said anyway, in case one does not.
    { noBackground: true },
  )
}

// ---- the browser's half --------------------------------------------------------

async function decodePng(bytes: Uint8Array): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: 'image/png' }))
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  bitmap.close?.()
  return canvas
}

function pixelsOf(canvas: HTMLCanvasElement, x = 0, y = 0, w = canvas.width, h = canvas.height): Pixels {
  const data = canvas.getContext('2d')!.getImageData(x, y, w, h).data
  return { width: w, height: h, data }
}

/**
 * The picture a frame waits with in the PDF: grey, with a quiet mark in the
 * middle so it reads as "a picture goes here" rather than as a grey shape of
 * the design. Square, drawn once; the PDF stretches it to each frame.
 */
export async function placeholderPng(): Promise<Uint8Array> {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = PLACEHOLDER_GREY
  ctx.fillRect(0, 0, size, size)
  // A mountain and a sun, the universal "picture" glyph, in a slightly darker grey.
  ctx.fillStyle = '#b4b4bc'
  ctx.beginPath()
  ctx.moveTo(78, 168)
  ctx.lineTo(112, 122)
  ctx.lineTo(136, 150)
  ctx.lineTo(152, 132)
  ctx.lineTo(178, 168)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.arc(156, 100, 12, 0, Math.PI * 2)
  ctx.fill()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('placeholder encode failed')
  return new Uint8Array(await blob.arrayBuffer())
}

/** The PSD of one page, drawn in the browser: page layer, frame layers, flattened copy. */
export async function templatePsdForPage(page: { png: Uint8Array; snapshot: PageSnapshot }, lang: 'fr' | 'en' = 'fr'): Promise<Uint8Array> {
  const base = await decodePng(page.png)
  const W = base.width
  const H = base.height
  const scale = W / page.snapshot.width
  const frames: PsdLayer[] = []
  const composite = document.createElement('canvas')
  composite.width = W
  composite.height = H
  const cctx = composite.getContext('2d')!
  cctx.drawImage(base, 0, 0)
  const boxes: FrameBox[] = page.snapshot.frames ?? []
  boxes.forEach((f, i) => {
    const placed = placeFrame(f)
    const b = boundsOf(placed)
    // Only the frame's own box, so a page of ten frames is not ten pages of pixels.
    const left = Math.max(0, Math.floor(b.x * scale))
    const top = Math.max(0, Math.floor(b.y * scale))
    const right = Math.min(W, Math.ceil((b.x + b.w) * scale))
    const bottom = Math.min(H, Math.ceil((b.y + b.h) * scale))
    if (right <= left || bottom <= top) return
    const layer = document.createElement('canvas')
    layer.width = right - left
    layer.height = bottom - top
    const ctx = layer.getContext('2d')!
    ctx.setTransform(scale, 0, 0, scale, -left, -top)
    ctx.fillStyle = PLACEHOLDER_GREY
    const shape = new Path2D(pathData(placed))
    ctx.fill(shape)
    frames.push({ name: frameName(i, f.shape, lang), left, top, pixels: pixelsOf(layer) })
    cctx.save()
    cctx.setTransform(scale, 0, 0, scale, 0, 0)
    cctx.fillStyle = PLACEHOLDER_GREY
    cctx.fill(shape)
    cctx.restore()
  })
  return buildTemplatePsd({ width: W, height: H, page: pixelsOf(base), frames, composite: pixelsOf(composite) })
}
