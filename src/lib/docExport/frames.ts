/**
 * The frames of a document page: where each `<ShapeFrame>` sits, and the page
 * drawn WITHOUT its picture — for the template export (template.ts), and for
 * the .pptx, which carries each frame as a shape of its own (`carryFrames`).
 *
 * Runs in the parent on the same-origin export frame, like measure.ts, and for
 * the same reason never tests `instanceof`.
 */
import { pathData, placeFrame, type FrameBox } from '../frameGeometry'
import { frameShape } from '../frameShapes'
import { parseCssColor } from './lines'
import type { CarriedFrame, FrameOverlay } from './types'

/** On a `<ShapeFrame>`'s root: its shape. Written by snippets/ShapeFrame.ts. */
export const FRAME_ATTR = 'data-mocky-frame'
/** On the layer that holds its picture — what the template leaves out. */
export const FRAME_PHOTO_ATTR = 'data-mocky-frame-photo'
/** On each drawn layer: `paper` under the picture, `stroke` and `over` above it. */
export const FRAME_LAYER_ATTR = 'data-mocky-frame-layer'

/** `matrix(a, b, c, d, e, f)` → its rotation (degrees, clockwise) and scale; identity for anything else. */
export function rotationOf(transform: string | null | undefined): { angle: number; scale: number } {
  const m = /^matrix\(\s*([^,]+),\s*([^,]+),/.exec(transform || '')
  if (!m) return { angle: 0, scale: 1 }
  const a = Number(m[1])
  const b = Number(m[2])
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { angle: 0, scale: 1 }
  return { angle: (Math.atan2(b, a) * 180) / Math.PI, scale: Math.hypot(a, b) || 1 }
}

/**
 * Every frame on the page, in page px.
 *
 * The CENTRE is read off the bounding box, which a rotation about the centre
 * leaves where it was; the SIZE off `offsetWidth/Height`, which is the box
 * before its transform — the bounding box of a turned frame is larger than the
 * frame. A rotation set on an ANCESTOR is not followed: the component rotates
 * itself (`rotate`), and a model turning a whole card with a frame inside is
 * rare enough to leave the shape square to the page rather than guess.
 */
export function measureFrames(win: Window, page: Element): FrameBox[] {
  const origin = page.getBoundingClientRect()
  const out: FrameBox[] = []
  page.querySelectorAll(`[${FRAME_ATTR}]`).forEach((el) => {
    const box = boxOf(win, el, origin)
    if (box) out.push(box)
  })
  return out
}

function boxOf(win: Window, el: Element, origin: DOMRect): FrameBox | null {
  const shape = el.getAttribute(FRAME_ATTR) || ''
  const r = el.getBoundingClientRect()
  const html = el as HTMLElement
  const { angle, scale } = rotationOf(win.getComputedStyle(el).transform)
  const w = (html.offsetWidth || r.width) * scale
  const h = (html.offsetHeight || r.height) * scale
  if (!(w > 0 && h > 0)) return null
  return { shape, cx: r.left + r.width / 2 - origin.left, cy: r.top + r.height / 2 - origin.top, w, h, angle }
}

/** Hide these elements from the picture; the undo shows them again. */
export function hideElements(els: Iterable<Element>): () => void {
  const undo: Array<() => void> = []
  for (const el of els) {
    const st = (el as HTMLElement).style
    const before = st.getPropertyValue('visibility')
    const prio = st.getPropertyPriority('visibility')
    st.setProperty('visibility', 'hidden', 'important')
    undo.push(() => (before ? st.setProperty('visibility', before, prio) : st.removeProperty('visibility')))
  }
  return () => undo.reverse().forEach((u) => u())
}

/** Hide every frame's picture (its grey placeholder too); the undo shows them again. */
export function hideFramePhotos(page: Element): () => void {
  return hideElements(Array.from(page.querySelectorAll(`[${FRAME_PHOTO_ATTR}]`)))
}

// ── the .pptx: each frame a shape of its own ─────────────────────────────────

/**
 * `object-position` as fractions of the free space — what `<ShapeFrame focus>`
 * writes ("50% 0%") — and the centre for anything this does not read.
 */
export function focusOf(objectPosition: string | null | undefined): { x: number; y: number } {
  const parts = (objectPosition || '').trim().split(/\s+/)
  const frac = (v: string | undefined) => {
    const m = /^(-?\d*\.?\d+)%$/.exec(v || '')
    return m ? Math.max(0, Math.min(1, Number(m[1]) / 100)) : 0.5
  }
  return { x: frac(parts[0]), y: frac(parts[1] ?? parts[0]) }
}

/**
 * The part of a picture a frame shows, in the picture's own pixels:
 * `object-fit: cover` at `object-position`, then the frame's zoom about that
 * same point (the component's `transform-origin` is its focus). The .pptx
 * carries exactly that part, so the slide's picture needs no crop of its own:
 * a crop is one more thing an importer can read differently, and a slide's
 * shape fill STRETCHES its picture to the box.
 */
export function coverCrop(
  box: { w: number; h: number },
  natural: { w: number; h: number },
  focus: { x: number; y: number },
  zoom: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const z = zoom >= 1 ? zoom : 1
  const s = Math.max(box.w / natural.w, box.h / natural.h)
  const ox = (box.w - natural.w * s) * focus.x
  const oy = (box.h - natural.h * s) * focus.y
  const sw = Math.min(natural.w, box.w / z / s)
  const sh = Math.min(natural.h, box.h / z / s)
  const sx = (box.w * focus.x * (1 - 1 / z) - ox) / s
  const sy = (box.h * focus.y * (1 - 1 / z) - oy) / s
  return {
    sx: Math.max(0, Math.min(natural.w - sw, sx)),
    sy: Math.max(0, Math.min(natural.h - sh, sy)),
    sw,
    sh,
  }
}

const JPEG_QUALITY = 0.92

/**
 * The frame's picture as it shows in the frame, at the export's resolution and
 * never above the picture's own. JPEG unless a pixel is see-through. Throws
 * when the picture cannot be read back (another origin's) — the caller then
 * leaves that frame in the page.
 */
async function cutPicture(win: Window, img: HTMLImageElement, box: FrameBox, scale: number): Promise<CarriedFrame['picture']> {
  const cs = win.getComputedStyle(img)
  const crop = coverCrop(box, { w: img.naturalWidth, h: img.naturalHeight }, focusOf(cs.objectPosition), rotationOf(cs.transform).scale)
  const k = Math.min(scale, crop.sw / box.w)
  const w = Math.max(1, Math.round(box.w * k))
  const h = Math.max(1, Math.round(box.h * k))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h)
    const data = ctx.getImageData(0, 0, w, h).data
    let opaque = true
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        opaque = false
        break
      }
    }
    const type = opaque ? 'jpeg' : 'png'
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, `image/${type}`, JPEG_QUALITY))
    if (!blob) throw new Error('encode failed')
    return { bytes: new Uint8Array(await blob.arrayBuffer()), type }
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

function overlayOf(win: Window, layer: Element): FrameOverlay | null {
  const path = layer.querySelector('path')
  const d = path?.getAttribute('d')
  if (!path || !d) return null
  const cs = win.getComputedStyle(path)
  const paint = (v: string) => (!v || v === 'none' ? null : parseCssColor(v))
  const role = layer.getAttribute(FRAME_LAYER_ATTR) === 'stroke' ? 'stroke' : 'over'
  const opacity = Number(win.getComputedStyle(layer).opacity)
  return {
    role,
    d,
    fill: paint(cs.fill),
    stroke: paint(cs.stroke),
    strokeWidth: parseFloat(cs.strokeWidth) || 0,
    opacity: Number.isFinite(opacity) ? opacity : 1,
  }
}

/**
 * Every frame of the page the .pptx can carry as a shape of its own, and the
 * layers to take out of the page's picture in exchange: the picture, and what
 * is drawn over it (an outline, tape), which would otherwise sit UNDER the
 * shape that now holds the photograph.
 *
 * WHY A SHAPE FILLED WITH A PICTURE. Canva's import of a .pptx was tested with
 * four spellings of one blob: a picture cropped to a free-form shape and to a
 * preset oval both came in as SQUARE frames — Canva keeps the picture and drops
 * the crop — while a shape FILLED with the picture came in as a frame of that
 * shape, free-form or preset, that a photo is dropped into. PowerPoint, Keynote
 * and Google Slides read the same thing as a picture they can change.
 *
 * A frame whose picture cannot be read stays in the page as it was drawn —
 * the page is right, only that frame is not separate. Its paper (a polaroid's
 * border) stays in the page in every case: it is UNDER the picture.
 */
export async function carryFrames(win: Window, page: Element, scale: number): Promise<{ frames: CarriedFrame[]; hide: Element[] }> {
  const origin = page.getBoundingClientRect()
  const frames: CarriedFrame[] = []
  const hide: Element[] = []
  for (const root of Array.from(page.querySelectorAll(`[${FRAME_ATTR}]`))) {
    const box = boxOf(win, root, origin)
    const photo = Array.from(root.children).find((c) => c.hasAttribute(FRAME_PHOTO_ATTR))
    if (!box || !photo) continue
    const img = photo.querySelector('img')
    let picture: CarriedFrame['picture'] = null
    if (img) {
      if (!img.complete || !img.naturalWidth || !img.naturalHeight) continue
      try {
        picture = await cutPicture(win, img, box, scale)
      } catch (err) {
        console.warn('mocky: a frame’s picture stays in the page —', err)
        continue
      }
    }
    const layers = Array.from(root.children).filter((c) => /^(stroke|over)$/.test(c.getAttribute(FRAME_LAYER_ATTR) || ''))
    const overlays = layers.map((l) => overlayOf(win, l)).filter((o): o is FrameOverlay => !!o)
    // A drop shadow follows what is drawn: with the picture gone from the page,
    // a frame with no paper under it lost its shadow there and carries it here.
    const shadow = /drop-shadow/.test(win.getComputedStyle(root).filter || '') && !frameShape(box.shape).paper
    frames.push({ box, picture, overlays, shadow })
    hide.push(photo, ...layers)
  }
  return { frames, hide }
}

/**
 * Cut each frame out of the page's picture: transparent where the photograph
 * goes, so it can be slid UNDER the page in any editor. `scale` is the
 * picture's pixels per page px.
 */
export function punchFrames(canvas: HTMLCanvasElement, frames: FrameBox[], scale: number): void {
  if (!frames.length) return
  const ctx = canvas.getContext('2d')
  if (!ctx || typeof Path2D !== 'function') return
  ctx.save()
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.globalCompositeOperation = 'destination-out'
  for (const f of frames) ctx.fill(new Path2D(pathData(placeFrame(f))))
  ctx.restore()
}
