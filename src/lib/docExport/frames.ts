/**
 * The frames of a document page, for the template export (template.ts): where
 * each `<ShapeFrame>` sits, and the page drawn WITHOUT its picture.
 *
 * Runs in the parent on the same-origin export frame, like measure.ts, and for
 * the same reason never tests `instanceof`.
 */
import { pathData, placeFrame, type FrameBox } from '../frameGeometry'

/** On a `<ShapeFrame>`'s root: its shape. Written by snippets/ShapeFrame.ts. */
export const FRAME_ATTR = 'data-mocky-frame'
/** On the layer that holds its picture — what the template leaves out. */
export const FRAME_PHOTO_ATTR = 'data-mocky-frame-photo'

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
    const shape = el.getAttribute(FRAME_ATTR) || ''
    const r = el.getBoundingClientRect()
    const html = el as HTMLElement
    const { angle, scale } = rotationOf(win.getComputedStyle(el).transform)
    const w = (html.offsetWidth || r.width) * scale
    const h = (html.offsetHeight || r.height) * scale
    if (!(w > 0 && h > 0)) return
    out.push({ shape, cx: r.left + r.width / 2 - origin.left, cy: r.top + r.height / 2 - origin.top, w, h, angle })
  })
  return out
}

/** Hide every frame's picture (its grey placeholder too); the undo shows them again. */
export function hideFramePhotos(page: Element): () => void {
  const undo: Array<() => void> = []
  page.querySelectorAll(`[${FRAME_PHOTO_ATTR}]`).forEach((el) => {
    const st = (el as HTMLElement).style
    const before = st.getPropertyValue('visibility')
    const prio = st.getPropertyPriority('visibility')
    st.setProperty('visibility', 'hidden', 'important')
    undo.push(() => (before ? st.setProperty('visibility', before, prio) : st.removeProperty('visibility')))
  })
  return () => undo.reverse().forEach((u) => u())
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
