import { parseCssColor } from './lines'
import type { GradientStop, Rect, Rgba, ShapeFill, ShapeGeom, ShapeItem, ShapeLine, ShapeShadow } from './types'

/**
 * A page's paint, element by element, in the terms of a slide — for the .pptx
 * made to be taken apart in Canva (decompose.ts walks the DOM; this decides).
 *
 * Pure on purpose, like lines.ts: what is a shape, what has to be a picture,
 * what is drawn over what — each answer is wrong in a way nobody sees until a
 * flyer comes back from Canva, so every one of them is a function a test can
 * feed a computed style to.
 *
 * The rule throughout is "say it natively when it can be said EXACTLY, and as
 * a picture of that element otherwise". A shape that is almost the element —
 * a radial gradient flattened to its first colour, a blur dropped — would be an
 * edit the person never made; a small picture of the element is the element.
 */

/** A computed colour a slide can carry: the two forms `parseCssColor` really reads. */
export const readableColor = (v: string | null | undefined): boolean => !!v && /^\s*(?:#|rgba?\(|transparent\s*$)/i.test(v)

/** Splits on `sep` outside parentheses: `rgb(0, 0, 0) 0px 1px, rgb(…)` is two shadows. */
export function splitTopLevel(s: string, sep = ','): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === sep && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** Splits on whitespace outside parentheses: `rgb(0 0 0 / 0.1) 0px 4px` is three tokens. */
function tokens(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s.trim()) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur) out.push(cur)
  return out
}

const isColorToken = (t: string) => /^(?:#|rgba?\(|transparent$)/i.test(t)
const lengthPx = (t: string): number | null => {
  const m = /^(-?\d*\.?\d+)(px)?$/.exec(t)
  return m ? Number(m[1]) : null
}

// ── gradients ───────────────────────────────────────────────────────────────

/**
 * One `linear-gradient(…)` as a slide can draw it: an angle and stops in sRGB.
 * Null for anything else — several layers, `repeating-`, a radial or conic
 * gradient, a colour a slide cannot carry, an interpolation hint — which then
 * becomes a picture of the element rather than a gradient it is not.
 *
 * `box` is the element's size: a corner direction ("to top right") is an angle
 * that depends on it, and a stop in px is a share of the gradient line.
 */
export function parseLinearGradient(css: string, box: { w: number; h: number }): { angle: number; stops: GradientStop[] } | null {
  const layers = splitTopLevel(css.trim())
  if (layers.length !== 1) return null
  const m = /^linear-gradient\((.*)\)$/i.exec(layers[0])
  if (!m) return null
  const args = splitTopLevel(m[1])
  if (!args.length) return null
  let angle = 180
  const dir = args[0].trim().toLowerCase()
  const corner = Math.atan2(box.h, box.w) * (180 / Math.PI)
  const ang = /^(-?\d*\.?\d+)(deg|turn|rad|grad)$/.exec(dir)
  if (ang) {
    const v = Number(ang[1])
    angle = ang[2] === 'deg' ? v : ang[2] === 'turn' ? v * 360 : ang[2] === 'rad' ? (v * 180) / Math.PI : v * 0.9
    args.shift()
  } else if (dir.startsWith('to ')) {
    const sides = dir.slice(3).split(/\s+/).sort().join(' ')
    const table: Record<string, number> = {
      top: 0,
      right: 90,
      bottom: 180,
      left: 270,
      'right top': corner,
      'bottom right': 180 - corner,
      'bottom left': 180 + corner,
      'left top': 360 - corner,
    }
    if (!(sides in table)) return null
    angle = table[sides]
    args.shift()
  }
  const len = Math.abs(box.w * Math.sin((angle * Math.PI) / 180)) + Math.abs(box.h * Math.cos((angle * Math.PI) / 180)) || 1
  const raw: { color: Rgba | 'transparent'; pos: number | null }[] = []
  for (const a of args) {
    const t = tokens(a)
    if (!t.length || !isColorToken(t[0])) return null // a hint, or a colour a slide cannot say
    const color = /^transparent$/i.test(t[0]) ? 'transparent' : parseCssColor(t[0])
    const positions = t.slice(1).map((p) => {
      if (p.endsWith('%')) return Number(p.slice(0, -1)) / 100
      const px = lengthPx(p)
      return px === null ? NaN : px / len
    })
    if (positions.some((p) => !Number.isFinite(p)) || positions.length > 2) return null
    if (!positions.length) raw.push({ color, pos: null })
    else positions.forEach((pos) => raw.push({ color, pos }))
  }
  if (raw.length < 2) return null
  // Missing positions: the ends at 0 and 1, the rest spread between their neighbours.
  if (raw[0].pos === null) raw[0].pos = 0
  if (raw[raw.length - 1].pos === null) raw[raw.length - 1].pos = 1
  for (let i = 1; i < raw.length; i++) {
    if (raw[i].pos !== null) {
      raw[i].pos = Math.max(raw[i].pos!, raw[i - 1].pos!)
      continue
    }
    let j = i
    while (raw[j].pos === null) j++
    const from = raw[i - 1].pos!
    const to = raw[j].pos!
    for (let k = i; k < j; k++) raw[k].pos = from + ((to - from) * (k - i + 1)) / (j - i + 1)
  }
  // `transparent` is transparent BLACK, and a slide interpolates it as such —
  // a fade to grey. It takes its neighbour's colour at no opacity instead,
  // which is what a browser draws.
  const stops = raw.map((r, i) => {
    if (r.color !== 'transparent') return { pos: r.pos!, color: r.color }
    const near = raw.slice(i + 1).find((x) => x.color !== 'transparent') ?? [...raw.slice(0, i)].reverse().find((x) => x.color !== 'transparent')
    const c = near && near.color !== 'transparent' ? near.color : { r: 0, g: 0, b: 0, a: 1 }
    return { pos: r.pos!, color: { ...c, a: 0 } }
  })
  return { angle: ((angle % 360) + 360) % 360, stops }
}

// ── shadows ───────────────────────────────────────────────────────────────

export interface CssShadow {
  dx: number
  dy: number
  blur: number
  spread: number
  color: Rgba
  inset: boolean
}

/** A computed `box-shadow` list. Unreadable entries are left out, not guessed. */
export function parseShadows(css: string | null | undefined): CssShadow[] {
  if (!css || css === 'none') return []
  const out: CssShadow[] = []
  for (const part of splitTopLevel(css)) {
    const t = tokens(part)
    let color: Rgba | null = null
    let inset = false
    const lens: number[] = []
    let bad = false
    for (const tok of t) {
      if (/^inset$/i.test(tok)) inset = true
      else if (isColorToken(tok)) color = parseCssColor(tok)
      else {
        const v = lengthPx(tok)
        if (v === null) bad = true
        else lens.push(v)
      }
    }
    if (bad || lens.length < 2 || !color) continue
    out.push({ dx: lens[0], dy: lens[1], blur: Math.max(0, lens[2] ?? 0), spread: lens[3] ?? 0, color, inset })
  }
  return out
}

/**
 * What a slide keeps of a shadow list: the one outer shadow that shows most (a
 * slide shape has one), and a RING — Tailwind's `ring-2` is a shadow with
 * nothing but spread — as an outline. `inset` is set when an inner shadow
 * shows: a slide shape cannot draw one, so the element becomes a picture.
 * Tailwind's placeholders (`0 0 #0000`) show nothing and count for nothing.
 */
export function pickShadow(list: readonly CssShadow[]): { shadow: ShapeShadow | null; ring: ShapeLine | null; inset: boolean } {
  const shows = list.filter((s) => s.color.a > 0.01)
  const inset = shows.some((s) => s.inset)
  const outer = shows.filter((s) => !s.inset)
  const rings = outer.filter((s) => s.dx === 0 && s.dy === 0 && s.blur === 0 && s.spread > 0)
  const casts = outer.filter((s) => !rings.includes(s) && (s.blur > 0 || s.dx !== 0 || s.dy !== 0))
  const best = casts.reduce<CssShadow | null>((a, s) => (!a || s.blur + Math.abs(s.dy) > a.blur + Math.abs(a.dy) ? s : a), null)
  const ring = rings.reduce<CssShadow | null>((a, s) => (!a || s.spread > a.spread ? s : a), null)
  return {
    shadow: best ? { dx: best.dx, dy: best.dy, blur: best.blur, color: best.color } : null,
    ring: ring ? { width: ring.spread, color: ring.color, dash: 'solid' } : null,
    inset,
  }
}

/** How far past its box an element's shadows and filters draw, px — the margin its picture needs. */
export function paintMargin(boxShadow: string | null | undefined, filter: string | null | undefined): number {
  let m = 0
  for (const s of parseShadows(boxShadow)) if (!s.inset) m = Math.max(m, s.blur + Math.max(0, s.spread) + Math.max(Math.abs(s.dx), Math.abs(s.dy)))
  if (filter && filter !== 'none') {
    // drop-shadow(0 10px 18px …) and blur(8px): the lengths, generously.
    const lens = [...filter.matchAll(/(-?\d*\.?\d+)px/g)].map((x) => Math.abs(Number(x[1])))
    if (lens.length) m = Math.max(m, lens.reduce((a, b) => a + b, 0))
  }
  return Math.min(96, Math.ceil(m))
}

// ── corners ───────────────────────────────────────────────────────────────

/** One computed corner radius (`8px`, `50%`, `10px 20px`) in px, on a box of `w` × `h`. */
export function cornerPx(v: string | null | undefined, w: number, h: number): { px: number; half: boolean } {
  const first = (v || '').trim().split(/\s+/)[0] || '0'
  if (first.endsWith('%')) {
    const p = Number(first.slice(0, -1)) / 100
    return { px: (Number.isFinite(p) ? p : 0) * Math.min(w, h), half: p >= 0.5 }
  }
  const n = parseFloat(first)
  const px = Number.isFinite(n) ? Math.max(0, n) : 0
  return { px, half: px >= Math.min(w, h) / 2 }
}

/**
 * Four computed radii (top-left, top-right, bottom-right, bottom-left) as a
 * preset a slide has, or null when none says it: a circle or an ellipse, a
 * rounded rectangle (a pill is one with corners of half its height), the top
 * or the bottom two corners rounded alike. Anything else is a picture.
 */
export function geometryOf(radii: readonly string[], w: number, h: number): ShapeGeom | null {
  const c = [0, 1, 2, 3].map((i) => cornerPx(radii[i], w, h))
  const r = c.map((x) => Math.min(x.px, Math.min(w, h) / 2))
  if (r.every((x) => x < 0.5)) return { prst: 'rect' }
  if (c.every((x) => x.half)) {
    const pctAll = radii.every((v) => (v || '').trim().endsWith('%'))
    // `rounded-full` on a square is a circle; on anything else a pill. `50%` is an ellipse.
    if (pctAll || Math.abs(w - h) < 1) return { prst: 'ellipse' }
    return { prst: 'roundRect', radius: Math.min(w, h) / 2 }
  }
  const same = (a: number, b: number) => Math.abs(a - b) < 0.5
  if (same(r[0], r[1]) && same(r[1], r[2]) && same(r[2], r[3])) return { prst: 'roundRect', radius: r[0] }
  if (same(r[0], r[1]) && r[2] < 0.5 && r[3] < 0.5) return { prst: 'round2SameRect', radius: r[0], flip: false }
  if (same(r[2], r[3]) && r[0] < 0.5 && r[1] < 0.5) return { prst: 'round2SameRect', radius: r[2], flip: true }
  return null
}

// ── one element ───────────────────────────────────────────────────────────

/** The computed style an element's own paint is read from (decompose.ts fills it). */
export interface PaintStyle {
  /** Upper case. */
  tag: string
  backgroundColor: string
  backgroundImage: string
  /** `background-clip: text`: the background is the text's ink, and travels with the text box. */
  clipText: boolean
  /** Top, right, bottom, left. */
  borders: { width: number; style: string; color: string }[]
  /** Top-left, top-right, bottom-right, bottom-left. */
  radii: string[]
  boxShadow: string
  filter: string
  backdropFilter: string
  mixBlendMode: string
  clipPath: string
  maskImage: string
  /** Rotated, scaled or set vertically (measure.ts's `makeTiltTest`). */
  tilted: boolean
  /** A `::before` or `::after` draws something. */
  pseudo: boolean
  /** A control the platform draws (a checkbox, a select's arrow, a range). */
  platform: boolean
  /** The opacity it is drawn at, ancestors included. */
  opacity: number
  /** An ancestor clips it — by its edge or a rounded corner — where it is drawn. */
  clipped: boolean
}

export type Paint =
  /** Paints nothing of its own (its children may). */
  | { kind: 'none' }
  /** One or more native shapes: the box, and a bar per side for a border not drawn alike all round. */
  | { kind: 'shapes'; shapes: ShapeItem[] }
  /**
   * A picture of the element. `whole`: its subtree is drawn with it and not
   * looked into (an icon, a photograph, a rotated card, a blur) — otherwise
   * only its own paint, its children taken apart on their own.
   */
  | { kind: 'raster'; whole: boolean; margin: number; role: 'picture' | 'icon' | 'decor' }

const PICTURE_TAGS = new Set(['IMG', 'PICTURE', 'VIDEO', 'CANVAS', 'IFRAME', 'OBJECT', 'EMBED'])
const shows = (v: string) => !!v && v !== 'none' && v !== 'normal'

const withOpacity = (c: Rgba, k: number): Rgba => ({ ...c, a: c.a * k })

/**
 * What one element paints, and how a slide carries it (see the module's rule).
 * `rect` is its border box on the page.
 */
export function classifyPaint(s: PaintStyle, rect: Rect): Paint {
  const margin = paintMargin(s.boxShadow, s.filter)
  if (PICTURE_TAGS.has(s.tag)) return { kind: 'raster', whole: true, margin, role: 'picture' }
  if (s.tag === 'SVG') return { kind: 'raster', whole: true, margin, role: 'icon' }
  if (s.platform) return { kind: 'raster', whole: true, margin, role: 'decor' }
  // These change how the whole subtree is drawn, so the subtree goes with them.
  if (s.tilted || shows(s.filter) || shows(s.backdropFilter) || shows(s.clipPath) || shows(s.maskImage) || (s.mixBlendMode && s.mixBlendMode !== 'normal')) {
    return { kind: 'raster', whole: true, margin, role: 'decor' }
  }
  const own: Paint = { kind: 'raster', whole: false, margin, role: 'decor' }

  const bgImage = s.clipText ? 'none' : s.backgroundImage || 'none'
  const bgColorOk = readableColor(s.backgroundColor) || !s.backgroundColor
  const bg = s.clipText || !s.backgroundColor ? { r: 0, g: 0, b: 0, a: 0 } : parseCssColor(s.backgroundColor)
  const sides = s.borders.map((b) => ({
    ...b,
    on: b.width > 0 && b.style !== 'none' && b.style !== 'hidden' && (!readableColor(b.color) || parseCssColor(b.color).a > 0.01),
  }))
  const shadows = parseShadows(s.boxShadow)
  const picked = pickShadow(shadows)
  const paints = (bgColorOk && bg.a > 0.01) || !bgColorOk || bgImage !== 'none' || sides.some((b) => b.on) || !!picked.shadow || !!picked.ring || picked.inset
  if (!paints) return s.pseudo ? own : { kind: 'none' }
  if (s.pseudo || s.clipped || picked.inset || !bgColorOk) return own

  let fill: ShapeFill | null = bg.a > 0.01 ? { kind: 'solid', color: withOpacity(bg, s.opacity) } : null
  if (bgImage !== 'none') {
    const g = parseLinearGradient(bgImage, rect)
    // A gradient over a colour is two layers; one with see-through stops would need both.
    if (!g || (fill && g.stops.some((x) => x.color.a < 0.999))) return own
    fill = { kind: 'linear', angle: g.angle, stops: g.stops.map((x) => ({ pos: x.pos, color: withOpacity(x.color, s.opacity) })) }
  }

  const geom = geometryOf(s.radii, rect.w, rect.h)
  if (!geom) return own

  const on = sides.filter((b) => b.on)
  if (on.some((b) => !readableColor(b.color) || !/^(solid|dashed|dotted)$/.test(b.style))) return own
  const uniform =
    on.length === 4 && on.every((b) => Math.abs(b.width - on[0].width) < 0.01 && b.style === on[0].style && b.color.replace(/\s/g, '') === on[0].color.replace(/\s/g, ''))
  let line: ShapeLine | null = null
  let box = rect
  const extra: ShapeItem[] = []
  if (uniform) {
    const bw = on[0].width
    line = { width: bw, color: withOpacity(parseCssColor(on[0].color), s.opacity), dash: on[0].style === 'dashed' ? 'dash' : on[0].style === 'dotted' ? 'dot' : 'solid' }
    // A CSS border lies INSIDE the box, a slide outline ON its edge: the shape
    // is inset by half the line so the outline's outer edge is the box's.
    box = { x: rect.x + bw / 2, y: rect.y + bw / 2, w: Math.max(0, rect.w - bw), h: Math.max(0, rect.h - bw) }
  } else if (on.length) {
    // A border on some sides only — a rule under a heading, a bar at the left
    // of a quote — is a bar per side. Only on a square box, and only solid: a
    // rounded corner bends the bar, and a dashed bar is a picture of one.
    if (geom.prst !== 'rect' || on.some((b) => b.style !== 'solid')) return own
    sides.forEach((b, i) => {
      if (!b.on) return
      const w = b.width
      const r =
        i === 0
          ? { x: rect.x, y: rect.y, w: rect.w, h: w }
          : i === 1
            ? { x: rect.x + rect.w - w, y: rect.y, w, h: rect.h }
            : i === 2
              ? { x: rect.x, y: rect.y + rect.h - w, w: rect.w, h: w }
              : { x: rect.x, y: rect.y, w, h: rect.h }
      extra.push({ kind: 'shape', rect: r, geom: { prst: 'rect' }, fill: { kind: 'solid', color: withOpacity(parseCssColor(b.color), s.opacity) }, line: null, shadow: null })
    })
  }
  if (!line && picked.ring) line = { ...picked.ring, color: withOpacity(picked.ring.color, s.opacity) }
  const shadow = picked.shadow ? { ...picked.shadow, color: withOpacity(picked.shadow.color, s.opacity) } : null
  const shapes: ShapeItem[] = []
  if (fill || line || shadow) {
    const g: ShapeGeom =
      geom.prst === 'roundRect' || geom.prst === 'round2SameRect'
        ? { ...geom, radius: Math.max(0, geom.radius - (line && uniform ? line.width / 2 : 0)) }
        : geom
    shapes.push({ kind: 'shape', rect: box, geom: g, fill, line, shadow })
  }
  shapes.push(...extra)
  return shapes.length ? { kind: 'shapes', shapes } : { kind: 'none' }
}

// ── order and layers ──────────────────────────────────────────────────────

/** Where an element paints in its page, simplified (see `paintOrder`). */
export interface PaintKey {
  /** The z-index of the nearest positioned ancestor-or-self that has one, else 0. */
  z: number
  /** It, or an ancestor up to the page, is positioned. */
  positioned: boolean
  /** Document order. */
  dom: number
}

/**
 * The order things are painted in, as indices into `keys`: CSS's painting
 * order, kept to what a generated page uses. Negative z-index first; then
 * everything in the flow, in document order; then positioned things (and what
 * they contain) at z-index auto or 0, in document order; then positive z-index,
 * lowest first. One stacking context for the whole page — a z-index inside a
 * z-indexed card is compared with the page's, which is right as long as the
 * card's own z is the larger, and generated pages rarely nest them otherwise.
 */
export function paintOrder(keys: readonly PaintKey[]): number[] {
  return keys
    .map((_, i) => i)
    .sort((a, b) => {
      const ka = keys[a]
      const kb = keys[b]
      if (ka.z !== kb.z) return ka.z - kb.z
      if (ka.positioned !== kb.positioned) return ka.positioned ? 1 : -1
      return ka.dom - kb.dom
    })
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/**
 * Pictures into layers no two of which overlap within one: each layer is ONE
 * extra drawing of the page, in which only its pictures show, so a picture
 * cut out of it holds that element and nothing else. Greedy, first layer that
 * fits; past `max` the last layer takes the rest (two overlapping pictures
 * then carry each other's corner — a flaw, not a failure).
 */
export function assignLayers(rects: readonly Rect[], max = 4): number[] {
  const layers: Rect[][] = []
  return rects.map((r) => {
    let i = layers.findIndex((l) => !l.some((o) => overlaps(o, r)))
    if (i < 0) {
      if (layers.length < max) {
        layers.push([])
        i = layers.length - 1
      } else i = max - 1
    }
    layers[i].push(r)
    return i
  })
}

/**
 * The bounds of what is drawn in an RGBA buffer: the smallest box holding
 * every pixel more opaque than `threshold`, or null when nothing is. A picture
 * of an element is cut to it, so its box in the editor is what it shows.
 */
export function opaqueBounds(data: ArrayLike<number>, w: number, h: number, threshold = 4): { x: number; y: number; w: number; h: number } | null {
  let x1 = w
  let y1 = h
  let x2 = -1
  let y2 = -1
  for (let y = 0; y < h; y++) {
    const row = y * w * 4
    for (let x = 0; x < w; x++) {
      if (data[row + x * 4 + 3] > threshold) {
        if (x < x1) x1 = x
        if (x > x2) x2 = x
        if (y < y1) y1 = y
        if (y > y2) y2 = y
      }
    }
  }
  return x2 < 0 ? null : { x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 }
}

/**
 * Islands of occupied cells on a coarse grid (8-connected), as cell bounds —
 * what is left of a page once every shape and picture was taken out of it (a
 * list's bullets, an outline nobody classified) becomes one picture per
 * island rather than one picture of the page.
 */
export function gridIslands(occupied: ArrayLike<number>, cols: number, rows: number): { c0: number; r0: number; c1: number; r1: number }[] {
  const seen = new Uint8Array(cols * rows)
  const out: { c0: number; r0: number; c1: number; r1: number }[] = []
  for (let i = 0; i < cols * rows; i++) {
    if (!occupied[i] || seen[i]) continue
    const box = { c0: cols, r0: rows, c1: -1, r1: -1 }
    const stack = [i]
    seen[i] = 1
    while (stack.length) {
      const j = stack.pop()!
      const c = j % cols
      const r = (j - c) / cols
      box.c0 = Math.min(box.c0, c)
      box.r0 = Math.min(box.r0, r)
      box.c1 = Math.max(box.c1, c)
      box.r1 = Math.max(box.r1, r)
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const cc = c + dc
          const rr = r + dr
          if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue
          const k = rr * cols + cc
          if (occupied[k] && !seen[k]) {
            seen[k] = 1
            stack.push(k)
          }
        }
      }
    }
    out.push(box)
  }
  return out
}
