import { intersectClip, makeClipper, visibleFraction } from './measure'
import {
  assignLayers,
  classifyPaint,
  gridIslands,
  opaqueBounds,
  paintOrder,
  readableColor,
  type PaintKey,
  type PaintStyle,
} from './shapes'
import { parseCssColor } from './lines'
import type { PictureItem, Rect, Rgba, ShapeItem, SlideItem } from './types'

/**
 * A page TAKEN APART, for the .pptx made to be edited in Canva: every element's
 * own paint as a native shape where a slide can say it exactly (shapes.ts
 * decides), as a small picture of that element alone where it cannot, in the
 * order the page paints them — instead of the whole design as one picture
 * under the text, which is what the faithful .pptx is and what a person who
 * wanted to recolour a card, move a sticker or delete a blob could do nothing
 * with.
 *
 * Runs in the parent on the same-origin export frame, like measure.ts, and for
 * the same reason never tests `instanceof`.
 *
 * HOW A PICTURE OF ONE ELEMENT IS MADE. Not by drawing the element alone: an
 * element out of its page loses what it inherits and what positions it. The
 * page is drawn whole, on a transparent canvas, with everything the slide says
 * natively taken out of the drawing — every glyph (as in the faithful pass),
 * every shape's own paint — so what is left is exactly what has to be a
 * picture. Two pictures that overlap would each carry the other's corner, so
 * they are spread over LAYERS no two of whose pictures overlap
 * (`assignLayers`), and the page is drawn once per layer with only that
 * layer's pictures visible: `visibility` is the one property a child can turn
 * back on under a hidden parent, which is what lets an icon on a photograph be
 * one layer and the photograph another.
 */

/** A picture of one element, to be cut from the drawing of its layer. */
export interface RasterJob {
  el: Element
  /** Where to cut, page px: the element's box, plus what its shadow or filter draws past it, inside the page. */
  rect: Rect
  layer: number
  role: PictureItem['role']
}

export type PlanEntry = { kind: 'shape'; item: ShapeItem } | { kind: 'job'; job: number } | { kind: 'frame'; index: number }

export interface DecomposePlan {
  /** The slide's ground, when the page paints a plain colour. */
  ground: Rgba | null
  /** In paint order. */
  entries: PlanEntry[]
  jobs: RasterJob[]
  /** The page's own paint as a picture (a photograph behind everything): its job is the slide's page picture, not an item. */
  pageJob: number | null
  /** Elements whose own paint the slide redraws as shapes: taken out of every drawing. */
  native: Element[]
  layers: number
}

export interface PlanOptions {
  /** measure.ts's `makeTiltTest`: a rotated element is a picture, subtree and all. */
  tilted: (el: Element | null) => boolean
  /** The carried frames' roots, in `carryFrames` order: each is a frame entry at its place in the paint order. */
  frameRoots: readonly Element[]
  /** Hidden from every drawing (the carried frames' pictures and layers): never looked at. */
  skip: ReadonlySet<Element>
}

const px = (v: string | null | undefined) => {
  const n = parseFloat(v || '')
  return Number.isFinite(n) ? n : 0
}

const meets = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

const PLATFORM_INPUTS = /^(checkbox|radio|range|color|file)$/i

/** Drawn by the platform rather than by CSS: a picture, as the browser draws it. */
function platformControl(el: Element, cs: CSSStyleDeclaration): boolean {
  const tag = el.tagName.toUpperCase()
  const appearance = cs.getPropertyValue('appearance') || cs.getPropertyValue('-webkit-appearance')
  if (appearance === 'none') return false
  if (tag === 'SELECT' || tag === 'PROGRESS' || tag === 'METER') return true
  return tag === 'INPUT' && PLATFORM_INPUTS.test(el.getAttribute('type') || '')
}

/** A `::before` or `::after` that draws something — a shape, a glyph — is part of its element's picture. */
function pseudoPaints(win: Window, el: Element): boolean {
  for (const p of ['::before', '::after']) {
    const ps = win.getComputedStyle(el, p)
    const content = ps.content
    if (!content || content === 'none' || content === 'normal') continue
    if (content !== '""' && content !== "''") return true
    const bg = ps.backgroundColor
    if ((readableColor(bg) && parseCssColor(bg).a > 0.01) || (bg && !readableColor(bg))) return true
    if (ps.backgroundImage && ps.backgroundImage !== 'none') return true
    if (px(ps.borderTopWidth) + px(ps.borderRightWidth) + px(ps.borderBottomWidth) + px(ps.borderLeftWidth) > 0) return true
    if (ps.boxShadow && ps.boxShadow !== 'none') return true
  }
  return false
}

/**
 * An ancestor with `overflow` other than visible and rounded corners cuts
 * into this box's corner: a header bar inside a rounded card is square in the
 * DOM and rounded on the page. A shape would draw its square corners.
 */
function cutByRoundedAncestor(win: Window, el: Element, page: Element, rect: Rect, origin: DOMRect): boolean {
  for (let a = el.parentElement; a; a = a.parentElement) {
    const cs = win.getComputedStyle(a)
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      const radii = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(px)
      if (radii.some((r) => r >= 1)) {
        const b = a.getBoundingClientRect()
        const ar = { x: b.left - origin.left, y: b.top - origin.top, w: b.width, h: b.height }
        const [tl, tr, br, bl] = radii
        const right = rect.x + rect.w
        const bottom = rect.y + rect.h
        if (tl >= 1 && rect.x < ar.x + tl * 0.3 && rect.y < ar.y + tl * 0.3) return true
        if (tr >= 1 && right > ar.x + ar.w - tr * 0.3 && rect.y < ar.y + tr * 0.3) return true
        if (br >= 1 && right > ar.x + ar.w - br * 0.3 && bottom > ar.y + ar.h - br * 0.3) return true
        if (bl >= 1 && rect.x < ar.x + bl * 0.3 && bottom > ar.y + ar.h - bl * 0.3) return true
      }
    }
    if (a === page) break
  }
  return false
}

function paintStyleOf(win: Window, el: Element, cs: CSSStyleDeclaration, tilted: boolean, opacity: number): PaintStyle {
  const sides = ['top', 'right', 'bottom', 'left']
  return {
    tag: el.tagName.toUpperCase(),
    backgroundColor: cs.backgroundColor,
    backgroundImage: cs.backgroundImage,
    clipText: /\btext\b/.test(`${cs.getPropertyValue('background-clip')} ${cs.getPropertyValue('-webkit-background-clip')}`),
    borders: sides.map((s) => ({
      width: px(cs.getPropertyValue(`border-${s}-width`)),
      style: cs.getPropertyValue(`border-${s}-style`),
      color: cs.getPropertyValue(`border-${s}-color`),
    })),
    radii: ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map((c) => cs.getPropertyValue(`border-${c}-radius`)),
    boxShadow: cs.boxShadow,
    filter: cs.filter,
    backdropFilter: cs.getPropertyValue('backdrop-filter') || cs.getPropertyValue('-webkit-backdrop-filter'),
    mixBlendMode: cs.getPropertyValue('mix-blend-mode'),
    clipPath: cs.getPropertyValue('clip-path'),
    maskImage: cs.getPropertyValue('mask-image') || cs.getPropertyValue('-webkit-mask-image'),
    tilted,
    pseudo: pseudoPaints(win, el),
    platform: platformControl(el, cs),
    opacity,
    clipped: false,
  }
}

/** Walks the page and decides, element by element, what the slide carries and how. */
export function planDecomposition(win: Window, page: Element, opts: PlanOptions): DecomposePlan {
  const origin = page.getBoundingClientRect()
  const pageRect: Rect = { x: 0, y: 0, w: origin.width, h: origin.height }
  const { outerOf } = makeClipper(win, page, { x: origin.left, y: origin.top })
  const frameIndex = new Map(opts.frameRoots.map((r, i) => [r, i] as const))
  const records: { key: PaintKey; entry: PlanEntry }[] = []
  const jobs: (Omit<RasterJob, 'layer'> & { box: Rect })[] = []
  const native: Element[] = []
  let ground: Rgba | null = null
  let pageJob: number | null = null
  let dom = 0

  const addJob = (el: Element, rect: Rect, margin: number, role: PictureItem['role'], clip: Rect | null): number => {
    const grown = { x: rect.x - margin, y: rect.y - margin, w: rect.w + 2 * margin, h: rect.h + 2 * margin }
    const cut = intersectClip(intersectClip(grown, pageRect), clip) ?? grown
    jobs.push({ el, rect: cut, role, box: cut })
    return jobs.length - 1
  }

  const visit = (el: Element, ctx: { opacity: number; z: number; positioned: boolean }) => {
    if (opts.skip.has(el)) return
    const cs = win.getComputedStyle(el)
    if (cs.display === 'none') return
    const own = parseFloat(cs.opacity)
    const opacity = ctx.opacity * (Number.isFinite(own) ? own : 1)
    if (opacity <= 0.01) return
    const isPage = el === page
    const pos = cs.position !== 'static'
    const positioned = !isPage && (ctx.positioned || pos)
    const zi = parseInt(cs.zIndex, 10)
    const z = !isPage && pos && Number.isFinite(zi) ? zi : ctx.z
    const key: PaintKey = { z: isPage ? -1e9 : z, positioned, dom: dom++ }
    const next = { opacity, z, positioned }

    const fi = frameIndex.get(el)
    if (fi !== undefined) {
      // What a frame draws under its picture (a polaroid's paper) first, the
      // frame itself after its whole subtree: over its paper, as on the page.
      for (const c of Array.from(el.children)) visit(c, next)
      records.push({ key: { z, positioned, dom: dom++ }, entry: { kind: 'frame', index: fi } })
      return
    }

    const r = el.getBoundingClientRect()
    const rect: Rect = { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height }
    let descend = true
    const drawn = cs.visibility === 'visible' && cs.display !== 'contents' && rect.w > 0 && rect.h > 0 && meets(rect, pageRect)
    if (drawn) {
      const style = paintStyleOf(win, el, cs, !isPage && opts.tilted(el), opacity)
      let paint = classifyPaint(style, rect)
      // Clipped by an ancestor: a shape would draw what the page hides.
      const clip = isPage ? null : outerOf(el)
      if (paint.kind === 'shapes' && !isPage && (visibleFraction(rect, clip) < 0.999 || cutByRoundedAncestor(win, el, page, rect, origin))) {
        paint = classifyPaint({ ...style, clipped: true }, rect)
      }
      if (isPage) {
        if (paint.kind === 'shapes') {
          const [main, ...rest] = paint.shapes
          const fill = main?.fill
          const plain = !rest.length && main?.geom.prst === 'rect' && fill?.kind === 'solid' && !main.line && !main.shadow && fill.color.a >= 0.999
          if (plain && fill?.kind === 'solid') ground = fill.color
          else paint.shapes.forEach((item) => records.push({ key, entry: { kind: 'shape', item } }))
          native.push(el)
        } else if (paint.kind === 'raster') {
          pageJob = addJob(el, pageRect, 0, 'decor', null)
          descend = !paint.whole
        }
      } else if (paint.kind === 'shapes') {
        paint.shapes.forEach((item) => records.push({ key, entry: { kind: 'shape', item } }))
        native.push(el)
      } else if (paint.kind === 'raster') {
        records.push({ key, entry: { kind: 'job', job: addJob(el, rect, paint.margin, paint.role, clip) } })
        descend = !paint.whole
      }
    }
    if (descend) for (const c of Array.from(el.children)) visit(c, next)
  }
  visit(page, { opacity: 1, z: 0, positioned: false })

  const layerOf = assignLayers(jobs.map((j) => j.box))
  const order = paintOrder(records.map((r) => r.key))
  return {
    ground,
    entries: order.map((i) => records[i].entry),
    jobs: jobs.map((j, i) => ({ el: j.el, rect: j.rect, role: j.role, layer: layerOf[i] })),
    pageJob,
    native,
    layers: jobs.length ? Math.max(...layerOf) + 1 : 0,
  }
}

function pin(st: CSSStyleDeclaration, prop: string, value: string): () => void {
  const inline = st.getPropertyValue(prop)
  const prio = st.getPropertyPriority(prop)
  st.setProperty(prop, value, 'important')
  return () => (inline ? st.setProperty(prop, inline, prio) : st.removeProperty(prop))
}

/**
 * The page as layer `layer` is drawn: every shape's own paint out (the slide
 * draws it), only this layer's pictures visible. To run AFTER the text hide
 * rules, which pin borders that follow `color` back — this pins them out
 * again — and undone before them.
 */
export function pinResidue(plan: DecomposePlan, layer: number): () => void {
  const undo: Array<() => void> = []
  for (const el of plan.native) {
    const st = (el as HTMLElement).style
    if (!st) continue
    undo.push(
      pin(st, 'background-color', 'transparent'),
      pin(st, 'background-image', 'none'),
      pin(st, 'border-top-color', 'transparent'),
      pin(st, 'border-right-color', 'transparent'),
      pin(st, 'border-bottom-color', 'transparent'),
      pin(st, 'border-left-color', 'transparent'),
      pin(st, 'box-shadow', 'none'),
    )
  }
  for (const j of plan.jobs) {
    const st = (j.el as HTMLElement).style
    if (st) undo.push(pin(st, 'visibility', j.layer === layer ? 'visible' : 'hidden'))
  }
  return () => {
    for (let i = undo.length - 1; i >= 0; i--) undo[i]()
  }
}

/** A cut of a drawing: where it lands on the page and its PNG. */
export interface Cut {
  rect: Rect
  bytes: Uint8Array
}

async function pngOf(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('encode failed')
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * `rect` (page px) cut out of a drawing at `scale`, trimmed to what is drawn in
 * it — so the picture's box in the editor is what it shows. Null when nothing
 * is: an element whose only paint was taken out, or covered.
 */
export async function cutDrawing(canvas: HTMLCanvasElement, rect: Rect, scale: number): Promise<Cut | null> {
  const sx = Math.max(0, Math.floor(rect.x * scale))
  const sy = Math.max(0, Math.floor(rect.y * scale))
  const sw = Math.min(canvas.width, Math.ceil((rect.x + rect.w) * scale)) - sx
  const sh = Math.min(canvas.height, Math.ceil((rect.y + rect.h) * scale)) - sy
  if (sw <= 0 || sh <= 0) return null
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  const data = ctx.getImageData(sx, sy, sw, sh)
  const b = opaqueBounds(data.data, sw, sh)
  if (!b) return null
  const out = document.createElement('canvas')
  out.width = b.w
  out.height = b.h
  try {
    out.getContext('2d')!.putImageData(data, -b.x, -b.y, b.x, b.y, b.w, b.h)
    return { rect: { x: (sx + b.x) / scale, y: (sy + b.y) / scale, w: b.w / scale, h: b.h / scale }, bytes: await pngOf(out) }
  } finally {
    out.width = 0
    out.height = 0
  }
}

/** One cell of the grid what is left over is looked for on, page px. */
export const LEFTOVER_CELL = 12
/** Past this many islands, what is left is one picture: a page of specks is not a page of layers. */
export const MAX_LEFTOVERS = 40

/**
 * What is still drawn once every picture was cut and every shape taken out —
 * what nothing classified: a list's bullets, an outline. Each island of it is
 * one picture, so it travels rather than vanishing, and travels in pieces.
 */
export async function leftovers(canvas: HTMLCanvasElement, cuts: readonly Rect[], scale: number): Promise<Cut[]> {
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  for (const r of cuts) ctx.clearRect(Math.floor(r.x * scale) - 1, Math.floor(r.y * scale) - 1, Math.ceil(r.w * scale) + 2, Math.ceil(r.h * scale) + 2)
  const cell = Math.max(1, Math.round(LEFTOVER_CELL * scale))
  const cols = Math.ceil(canvas.width / cell)
  const rows = Math.ceil(canvas.height / cell)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const occ = new Uint8Array(cols * rows)
  for (let y = 0; y < canvas.height; y++) {
    const row = y * canvas.width * 4
    const r = Math.floor(y / cell) * cols
    for (let x = 0; x < canvas.width; x++) {
      if (data[row + x * 4 + 3] > 8) occ[r + Math.floor(x / cell)] = 1
    }
  }
  let islands = gridIslands(occ, cols, rows)
  if (!islands.length) return []
  if (islands.length > MAX_LEFTOVERS) {
    islands = [{ c0: 0, r0: 0, c1: cols - 1, r1: rows - 1 }]
  }
  const out: Cut[] = []
  for (const i of islands) {
    const rect = { x: (i.c0 * cell) / scale, y: (i.r0 * cell) / scale, w: ((i.c1 - i.c0 + 1) * cell) / scale, h: ((i.r1 - i.r0 + 1) * cell) / scale }
    const cut = await cutDrawing(canvas, rect, scale)
    if (cut) out.push(cut)
  }
  return out
}

/** The page's own picture (its job), full page, over its ground, as a JPEG: the slide's page picture. */
export async function pageDrawing(canvas: HTMLCanvasElement, ground: Rgba | null): Promise<Uint8Array> {
  const out = document.createElement('canvas')
  out.width = canvas.width
  out.height = canvas.height
  try {
    const ctx = out.getContext('2d')!
    const g = ground ?? { r: 255, g: 255, b: 255, a: 1 }
    ctx.fillStyle = `rgb(${g.r}, ${g.g}, ${g.b})`
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(canvas, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) throw new Error('encode failed')
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    out.width = 0
    out.height = 0
  }
}

/** Draws the page with `extra` applied on a transparent canvas and hands the canvas to `consume`; null when nothing could draw it. */
export type DrawPage = <T>(extra: () => () => void, consume: (canvas: HTMLCanvasElement) => Promise<T>) => Promise<{ value: T } | null>

export interface TakenApart {
  items: SlideItem[]
  /** The page's own picture, when it has one (`DecomposePlan.pageJob`). */
  background: Uint8Array | null
  /** Layers no renderer could draw: their pictures are missing. */
  failed: boolean
}

/**
 * The plan carried out: one drawing per layer, each layer's pictures cut out
 * of its own drawing, what is left over cut from the first, and everything
 * assembled in paint order — leftovers at the bottom, over the ground, since
 * what nothing classified is mostly decoration under the content.
 */
export async function takeApart(plan: DecomposePlan, scale: number, draw: DrawPage): Promise<TakenApart> {
  const cuts = new Map<number, Cut>()
  let rest: Cut[] = []
  let background: Uint8Array | null = null
  let failed = false
  const all = plan.jobs.map((j) => j.rect)
  for (let layer = 0; layer < Math.max(1, plan.layers); layer++) {
    const done = await draw(
      () => pinResidue(plan, layer),
      async (canvas) => {
        for (let k = 0; k < plan.jobs.length; k++) {
          const job = plan.jobs[k]
          if (job.layer !== layer) continue
          if (k === plan.pageJob) background = await pageDrawing(canvas, plan.ground)
          else {
            const cut = await cutDrawing(canvas, job.rect, scale)
            if (cut) cuts.set(k, cut)
          }
        }
        if (layer === 0) rest = await leftovers(canvas, all, scale)
        return true
      },
    )
    if (!done) failed = true
  }
  const items: SlideItem[] = rest.map((c) => ({ kind: 'picture', rect: c.rect, role: 'decor', image: { bytes: c.bytes, type: 'png' } }))
  for (const e of plan.entries) {
    if (e.kind === 'shape') items.push(e.item)
    else if (e.kind === 'frame') items.push({ kind: 'frame', index: e.index })
    else {
      const cut = cuts.get(e.job)
      if (cut) items.push({ kind: 'picture', rect: cut.rect, role: plan.jobs[e.job].role, image: { bytes: cut.bytes, type: 'png' } })
    }
  }
  return { items, background, failed }
}
