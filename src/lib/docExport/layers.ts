/**
 * The page in LAYERS, for the editors that work in layers: an SVG for Figma,
 * Illustrator and Inkscape, a PSD for Photoshop and Photopea.
 *
 * The page is drawn by the same renderer as the PNG (render.ts, purpose
 * `layers`), but without what each `<ShapeFrame>` draws — its picture, its
 * outline, its tape — and every frame comes back above it as layers of its own
 * (frames.ts, `carryFrames`, the same reading the .pptx makes): the picture cut
 * to the frame's shape and named after it ("Cadre 2 — Polaroid"), then what the
 * frame draws over it. So a picture is replaced where it is, in its shape:
 *
 *  - SVG — each frame is a clip path holding its picture: an editor's mask
 *          group, whose picture is swapped for another.
 *  - PSD — each frame is a layer of its picture's pixels, in the shape; a photo
 *          placed above it and clipped to it (Alt + click between the two) takes
 *          the same shape — the clipping mask the person asked for in those words.
 *
 * The TEXT stays in the page's picture in both: the .pptx is the file that
 * edits words, and the dialog says so. These two used to be a "template with
 * empty frames", next to the PNG and a PDF; once the .pptx carried the frames
 * as frames, Canva included, the empty template had nothing left to offer that
 * a frame you can refill does not.
 */
import { boundsOf, frameTransform, mapSubpaths, pathData, placeFrame, toCubics, type FrameBox } from '../frameGeometry'
import { partsEn, partsFr } from '../../i18n/parts'
import { toHex6 } from './lines'
import type { FrameOverlay, Rgba } from './types'

/** The grey a frame waits in — the same as `<ShapeFrame>`'s own placeholder. */
export const PLACEHOLDER_GREY = '#d4d4d8'

/** "Cadre 2 — Blob 3": the name a frame's layer, group or shape is given. */
export function frameName(index: number, shape: string, lang: 'fr' | 'en' = 'fr'): string {
  const dict = lang === 'en' ? partsEn : partsFr
  const shapeName = dict[`frames.shape.${shape}`] || shape
  return (dict['frames.layer'] || 'Frame {n} — {shape}').replace('{n}', String(index + 1)).replace('{shape}', shapeName)
}

/** "Cadre 2 — Polaroid · contour": the names of what a frame draws around its picture. */
export function frameOverlayNames(frame: string, lang: 'fr' | 'en' = 'fr'): Record<'stroke' | 'over' | 'shadow', string> {
  const dict = lang === 'en' ? partsEn : partsFr
  return {
    stroke: `${frame} · ${dict['frames.part.stroke'] || 'outline'}`,
    over: `${frame} · ${dict['frames.part.over'] || 'tape'}`,
    shadow: `${frame} · ${dict['frames.part.shadow'] || 'shadow'}`,
  }
}

/** An id an SVG editor shows as the layer's name: ASCII, no space. */
export function frameId(index: number, shape: string): string {
  return `frame-${index + 1}-${shape.replace(/[^a-z0-9-]/gi, '')}`
}

/** A frame as the layered files carry it: named, and with a picture — the placeholder when it waits for one. */
export interface LayeredFrame {
  box: FrameBox
  name: string
  picture: { bytes: Uint8Array; type: 'png' | 'jpeg' }
  overlays: FrameOverlay[]
  overlayNames: Record<'stroke' | 'over' | 'shadow', string>
  shadow: boolean
}

export interface LayeredPage {
  /** The page without its frames' drawing, as a PNG. */
  png: Uint8Array
  /** The page's size in px. */
  width: number
  height: number
  frames: LayeredFrame[]
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return btoa(bin)
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const n2 = (v: number) => String(Math.round(v * 100) / 100)
const href = (type: string, bytes: Uint8Array) => {
  const url = `data:${type};base64,${toBase64(bytes)}`
  return `href="${url}" xlink:href="${url}"`
}

/** An outline or a strip of tape, in page px: a path with its paint. */
function overlaySvg(o: FrameOverlay, box: FrameBox, id: string, name: string): string {
  const paint = (attr: 'fill' | 'stroke', c: Rgba | null) =>
    c ? `${attr}="#${toHex6(c)}"${c.a * o.opacity < 0.999 ? ` ${attr}-opacity="${n2(c.a * o.opacity)}"` : ''}` : `${attr}="none"`
  const stroke =
    o.stroke && o.strokeWidth > 0 ? `${paint('stroke', o.stroke)} stroke-width="${n2(o.strokeWidth)}" stroke-linejoin="round"` : ''
  return (
    `<path id="${id}-${o.role}" d="${pathData(toCubics(o.d), frameTransform(box))}" ${paint('fill', o.fill)}${stroke ? ` ${stroke}` : ''}>` +
    `<title>${esc(name)}</title></path>`
  )
}

/**
 * One page as an SVG, in page px: the page's picture, then per frame a named
 * group clipping its picture (turned with the frame), and what the frame draws
 * over it. A shadow is a filter on a group AROUND the clipped one — a filter
 * applies before the clip on the same element, which would cut the shadow off.
 */
export function buildLayeredSvg(page: LayeredPage): string {
  const { width: W, height: H } = page
  const defs: string[] = []
  const groups = page.frames.map((f, i) => {
    const id = frameId(i, f.box.shape)
    const { cx, cy, w, h, angle } = f.box
    defs.push(`<clipPath id="${id}-shape"><path d="${pathData(placeFrame(f.box))}"/></clipPath>`)
    const turn = angle ? ` transform="rotate(${n2(angle)} ${n2(cx)} ${n2(cy)})"` : ''
    const picture =
      `<g id="${id}" clip-path="url(#${id}-shape)"><title>${esc(f.name)}</title>` +
      `<image x="${n2(cx - w / 2)}" y="${n2(cy - h / 2)}" width="${n2(w)}" height="${n2(h)}" preserveAspectRatio="none"${turn} ` +
      `${href(`image/${f.picture.type}`, f.picture.bytes)}/></g>`
    let out = picture
    if (f.shadow) {
      defs.push(
        `<filter id="${id}-shadow" x="-20%" y="-20%" width="140%" height="150%">` +
          '<feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#000000" flood-opacity="0.18"/></filter>',
      )
      out = `<g filter="url(#${id}-shadow)">${picture}</g>`
    }
    return out + f.overlays.map((o) => overlaySvg(o, f.box, id, f.overlayNames[o.role])).join('')
  })
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    `<image id="page" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" ${href('image/png', page.png)}/>` +
    (groups.length ? `<g id="frames">${groups.join('')}</g>` : '') +
    `</svg>\n`
  )
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
 * The PSD: its layers bottom to top (the page first), and the flattened picture
 * a viewer without layers shows. Layers come in already drawn: a shape is
 * filled by a canvas, which is the browser's half.
 */
export async function buildLayeredPsd(doc: { width: number; height: number; layers: PsdLayer[]; composite: Pixels }): Promise<Uint8Array> {
  const { writePsdUint8Array } = await import('ag-psd')
  return writePsdUint8Array({
    width: doc.width,
    height: doc.height,
    imageData: doc.composite,
    children: doc.layers.map((l) => ({ name: l.name, left: l.left, top: l.top, imageData: l.pixels })),
  })
}

// ---- the browser's half --------------------------------------------------------

async function decodeImage(bytes: Uint8Array, type: string): Promise<ImageBitmap> {
  return createImageBitmap(new Blob([bytes as BlobPart], { type }))
}

function pixelsOf(canvas: HTMLCanvasElement): Pixels {
  const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
  return { width: canvas.width, height: canvas.height, data }
}

const rgba = (c: Rgba, opacity: number) => `rgba(${c.r}, ${c.g}, ${c.b}, ${Math.max(0, Math.min(1, c.a * opacity))})`

/**
 * The picture a frame waits with: grey, with a quiet mark in the middle so it
 * reads as "a picture goes here" rather than as a grey shape of the design.
 * Square, drawn once; every file stretches it to its frame.
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

/**
 * The PSD of one page, drawn in the browser. Per frame, bottom to top: its
 * shadow, its picture in its shape, its outline, its tape — each a layer of
 * only its own box, so a page of ten frames is not ten pages of pixels. The
 * shadow is a layer of its own because a clipping mask clips to a layer's
 * ALPHA: baked into the picture's layer, it would have given the next photo a
 * soft halo.
 */
export async function layeredPsdForPage(page: LayeredPage): Promise<Uint8Array> {
  const base = await decodeImage(page.png, 'image/png')
  const W = base.width
  const H = base.height
  const scale = W / page.width
  const composite = document.createElement('canvas')
  composite.width = W
  composite.height = H
  const cctx = composite.getContext('2d')!
  cctx.drawImage(base, 0, 0)
  const pageCanvas = document.createElement('canvas')
  pageCanvas.width = W
  pageCanvas.height = H
  pageCanvas.getContext('2d')!.drawImage(base, 0, 0)
  base.close?.()
  const layers: PsdLayer[] = [{ name: 'Page', left: 0, top: 0, pixels: pixelsOf(pageCanvas) }]

  /** A layer covering `bounds` (page px) plus `margin`, drawn in page px by `draw`. */
  const layer = (
    name: string,
    bounds: { x: number; y: number; w: number; h: number },
    margin: number,
    draw: (ctx: CanvasRenderingContext2D) => void,
  ) => {
    const left = Math.max(0, Math.floor((bounds.x - margin) * scale))
    const top = Math.max(0, Math.floor((bounds.y - margin) * scale))
    const right = Math.min(W, Math.ceil((bounds.x + bounds.w + margin) * scale))
    const bottom = Math.min(H, Math.ceil((bounds.y + bounds.h + margin) * scale))
    if (right <= left || bottom <= top) return
    const canvas = document.createElement('canvas')
    canvas.width = right - left
    canvas.height = bottom - top
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(scale, 0, 0, scale, -left, -top)
    draw(ctx)
    layers.push({ name, left, top, pixels: pixelsOf(canvas) })
    cctx.drawImage(canvas, left, top)
  }

  for (const f of page.frames) {
    const placed = placeFrame(f.box)
    const shape = new Path2D(pathData(placed))
    const bounds = boundsOf(placed)
    if (f.shadow) {
      // The component's drop-shadow(0 10px 18px rgba(0,0,0,.18)), with the shape itself taken back out.
      layer(f.overlayNames.shadow, bounds, 40, (ctx) => {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.18)'
        ctx.shadowBlur = 18 * scale
        ctx.shadowOffsetY = 10 * scale
        ctx.fill(shape)
        ctx.shadowColor = 'transparent'
        ctx.globalCompositeOperation = 'destination-out'
        ctx.fill(shape)
      })
    }
    const picture = await decodeImage(f.picture.bytes, `image/${f.picture.type}`)
    layer(f.name, bounds, 0, (ctx) => {
      ctx.clip(shape)
      ctx.translate(f.box.cx, f.box.cy)
      ctx.rotate((f.box.angle * Math.PI) / 180)
      ctx.drawImage(picture, -f.box.w / 2, -f.box.h / 2, f.box.w, f.box.h)
    })
    picture.close?.()
    for (const o of f.overlays) {
      const placedOverlay = mapSubpaths(toCubics(o.d), frameTransform(f.box))
      const path = new Path2D(pathData(placedOverlay))
      layer(f.overlayNames[o.role], boundsOf(placedOverlay), o.strokeWidth, (ctx) => {
        if (o.fill) {
          ctx.fillStyle = rgba(o.fill, o.opacity)
          ctx.fill(path, 'evenodd')
        }
        if (o.stroke && o.strokeWidth > 0) {
          ctx.strokeStyle = rgba(o.stroke, o.opacity)
          ctx.lineWidth = o.strokeWidth
          ctx.lineJoin = 'round'
          ctx.stroke(path)
        }
      })
    }
  }
  return buildLayeredPsd({ width: W, height: H, layers, composite: pixelsOf(composite) })
}
