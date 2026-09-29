/**
 * The geometry of the cables drawn between screens on the canvas.
 *
 * A link is a `Hotspot` stored on its SOURCE screen — a rectangle normalised to
 * that screen's body, and the id of the screen it leads to. For a long time the
 * canvas drew only the rectangle, with a "→ Target" tag on it, so a prototype of
 * twelve screens read as twelve unrelated pictures: the one thing the links say
 * — how the screens hang together — was nowhere on the board. A cable per link
 * turns the board into the map of the prototype.
 *
 * Everything that can be wrong about a cable is decided here, with no React and
 * no DOM, because a rendered curve cannot be asked which side it left from and a
 * function can. The component only paints what this returns.
 *
 * Coordinates are WORLD units (the canvas's own, before the view transform), and
 * the shape of a cable does not depend on the zoom: a curve that re-bent itself
 * on every wheel tick would read as the board breathing. What must stay constant
 * ON SCREEN — stroke width, dots, labels — is the painter's business, by
 * dividing by the scale.
 *
 * The data model is untouched. The demo player reads the same hotspots, and a
 * project saved before cables existed draws its cables without a migration.
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Pt {
  x: number
  y: number
}

export type Side = 'left' | 'right' | 'top' | 'bottom'

/** One link, flattened out of `Screen.links` — see `linksOf`. */
export interface CableLink {
  /** The hotspot's id. */
  id: string
  sourceId: string
  targetId: string
  /** Normalised 0..1 to the source screen's body, as stored on the hotspot. */
  rect: Rect
  label?: string
}

export interface Cable {
  id: string
  sourceId: string
  targetId: string
  label?: string
  /** The target screen no longer exists: drawn as a short dashed stub. */
  missing: boolean
  /** A screen linking to itself (an anchor): a loop out of the right edge and back. */
  self: boolean
  /** No element was recorded, so the whole screen is the source (see `elementRect`). */
  whole: boolean
  /** Side of the ELEMENT the cable leaves from. */
  out: Side
  /** Side of the TARGET FRAME the cable arrives on. */
  in: Side
  /** The source element, in world units. */
  element: Rect
  p0: Pt
  c1: Pt
  c2: Pt
  p3: Pt
  /** The curve's own midpoint (t = 0.5). */
  mid: Pt
  /**
   * Where the curve leaves its SOURCE frame: the start of the part of the cable
   * that is not drawn over the screen it comes from. The map layer is painted
   * behind the frames, so everything before this point is hidden there.
   */
  exit: Pt
  /**
   * Where the label sits: the middle of the part after `exit`. Not `mid` — from
   * an element deep inside a 1440-wide desktop frame the curve's midpoint is
   * still inside that frame, so on the map (behind the frames) the label was
   * hidden, and in link mode it covered the page the user is picking from.
   */
  labelAt: Pt
  /**
   * SVG path data of the part after `exit` only — the cable's hit area in link
   * mode. A hit stroke along the whole curve lay over the source screen's own
   * elements, and a press meant to pick one selected the cable instead.
   */
  hitPath: string
  /** A box that contains the whole curve, for culling. */
  bounds: Rect
  /** SVG path data. */
  path: string
}

/**
 * The tunables, in world units.
 *
 * `gap` is the spacing kept between two cables arriving on the same edge. It is
 * world and not screen units on purpose (see the header): at the zoom where it
 * gets thin, a whole prototype fits on one screen and the arrivals are dots.
 */
export const CABLE_GEOMETRY = {
  /** A handle never shorter than this, or two close screens join with a kink. */
  minHandle: 60,
  /** …and never longer, or two screens far apart swing a wide loop between them. */
  maxHandle: 420,
  /** Handle length as a share of the distance between the two ends. */
  handleRatio: 0.5,
  /** Minimum spacing between two arrivals on one edge. */
  gap: 36,
  /** Arrivals stay this far from a frame's corners. */
  edgeMargin: 28,
  /** Length of the stub drawn for a link whose target is gone. */
  stub: 110,
  /** How far a self-link loops out past the frame's right edge. */
  selfLoop: 140,
}

export type CableGeometry = typeof CABLE_GEOMETRY

const OPPOSITE: Record<Side, Side> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }

/** Unit vector pointing OUT of a rectangle through the given side. */
export function sideVector(side: Side): Pt {
  switch (side) {
    case 'right':
      return { x: 1, y: 0 }
    case 'left':
      return { x: -1, y: 0 }
    case 'top':
      return { x: 0, y: -1 }
    case 'bottom':
      return { x: 0, y: 1 }
  }
}

const horizontal = (s: Side) => s === 'left' || s === 'right'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const finite = (v: number, fallback = 0) => (Number.isFinite(v) ? v : fallback)

/** Midpoint of one side of a rectangle. */
export function portOn(r: Rect, side: Side): Pt {
  switch (side) {
    case 'right':
      return { x: r.x + r.w, y: r.y + r.h / 2 }
    case 'left':
      return { x: r.x, y: r.y + r.h / 2 }
    case 'top':
      return { x: r.x + r.w / 2, y: r.y }
    case 'bottom':
      return { x: r.x + r.w / 2, y: r.y + r.h }
  }
}

/**
 * The hotspot's element, in world units.
 *
 * A stored rectangle is data from a page nobody validated: an element scrolled
 * half out of view gives a negative `y`, and an auto-link proposal accepted
 * without a rectangle is written as all zeros (`applyProposals`). The first is
 * clamped into the frame, so the port stays on the screen it belongs to; the
 * second has no element to point at, so the whole screen is the source — a
 * port at the top-left corner would claim a link from a corner.
 */
export function elementRect(frame: Rect, n: Rect): Rect {
  const x = clamp(finite(n.x), 0, 1)
  const y = clamp(finite(n.y), 0, 1)
  const w = clamp(finite(n.w), 0, 1 - x)
  const h = clamp(finite(n.h), 0, 1 - y)
  if (!hasElement(n)) return { ...frame }
  return { x: frame.x + x * frame.w, y: frame.y + y * frame.h, w: w * frame.w, h: h * frame.h }
}

/** Whether a stored rectangle names an element at all — see `elementRect`. */
export function hasElement(n: Rect): boolean {
  const x = clamp(finite(n.x), 0, 1)
  const y = clamp(finite(n.y), 0, 1)
  return clamp(finite(n.w), 0, 1 - x) > 0 || clamp(finite(n.h), 0, 1 - y) > 0
}

/**
 * Which way a cable leaves its source and which edge of the target it meets.
 *
 * Decided on the two FRAMES, not on the element: the question is where the
 * other screen stands, and an element near a screen's left edge still leads to a
 * screen on the right.
 *
 * Separated frames use the axis with the larger gap, with ties going to the
 * horizontal one — the mind-map reading, and the one a row of screens (which is
 * what `packScreens` lays out) wants. Overlapping frames have no gap to compare,
 * so the offset between their centres decides; a target exactly on top of its
 * source goes right, because some answer must be given and it must be stable.
 */
export function facingSides(from: Rect, to: Rect): { out: Side; in: Side } {
  const right = to.x - (from.x + from.w)
  const left = from.x - (to.x + to.w)
  const below = to.y - (from.y + from.h)
  const above = from.y - (to.y + to.h)
  const hGap = Math.max(right, left)
  const vGap = Math.max(below, above)
  let out: Side
  if (hGap > 0 || vGap > 0) {
    if (hGap >= vGap) out = right >= left ? 'right' : 'left'
    else out = below >= above ? 'bottom' : 'top'
  } else {
    const dx = to.x + to.w / 2 - (from.x + from.w / 2)
    const dy = to.y + to.h / 2 - (from.y + from.h / 2)
    if (Math.abs(dx) >= Math.abs(dy)) out = dx >= 0 ? 'right' : 'left'
    else out = dy >= 0 ? 'bottom' : 'top'
  }
  return { out, in: OPPOSITE[out] }
}

/**
 * Positions along one edge for several arrivals, in the order they were given.
 *
 * Each cable would like to arrive level with its own port — that makes the
 * straightest cable — but two ports at the same height would then arrive on the
 * same point and read as one cable. So the wishes are sorted (which keeps the
 * cables from crossing each other on the way in), pushed apart to `gap`, and
 * pushed back inside `[lo, hi]` from the far end. When the edge is too short
 * for `gap` between every pair, they are spread evenly over it instead: closer
 * than asked, but never on top of each other.
 */
export function spreadAlong(desired: number[], lo: number, hi: number, gap: number): number[] {
  const n = desired.length
  if (n === 0) return []
  if (hi < lo) return desired.map(() => (lo + hi) / 2)
  const order = desired.map((_, i) => i).sort((a, b) => desired[a] - desired[b] || a - b)
  const placed = new Array<number>(n)
  if (n > 1 && (n - 1) * gap > hi - lo) {
    order.forEach((idx, rank) => {
      placed[idx] = lo + ((hi - lo) * rank) / (n - 1)
    })
    return placed
  }
  const p = order.map((idx) => clamp(finite(desired[idx], (lo + hi) / 2), lo, hi))
  for (let i = 1; i < n; i++) p[i] = Math.max(p[i], p[i - 1] + gap)
  if (p[n - 1] > hi) p[n - 1] = hi
  for (let i = n - 2; i >= 0; i--) p[i] = Math.min(p[i], p[i + 1] - gap)
  order.forEach((idx, rank) => {
    placed[idx] = p[rank]
  })
  return placed
}

/** A point on a cubic Bézier. */
export function bezierPoint(p0: Pt, c1: Pt, c2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return { x: a * p0.x + b * c1.x + c * c2.x + d * p3.x, y: a * p0.y + b * c1.y + c * c2.y + d * p3.y }
}

/**
 * A box around the curve.
 *
 * The control polygon's box, not the curve's tight one: a Bézier lies inside
 * the convex hull of its four points, so this is always large enough, and it is
 * four comparisons instead of solving the derivative. For culling, too large is
 * free and too small is a cable that vanishes while still on screen.
 */
export function curveBounds(p0: Pt, c1: Pt, c2: Pt, p3: Pt): Rect {
  const xs = [p0.x, c1.x, c2.x, p3.x]
  const ys = [p0.y, c1.y, c2.y, p3.y]
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

const r1 = (v: number) => Math.round(v * 10) / 10

export function cablePath(p0: Pt, c1: Pt, c2: Pt, p3: Pt): string {
  return `M${r1(p0.x)} ${r1(p0.y)}C${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(p3.x)} ${r1(p3.y)}`
}

const add = (p: Pt, v: Pt, k: number): Pt => ({ x: p.x + v.x * k, y: p.y + v.y * k })
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

/** The part of a cubic Bézier from `t` to its end, by de Casteljau. */
export function bezierTail(p0: Pt, c1: Pt, c2: Pt, p3: Pt, t: number): [Pt, Pt, Pt, Pt] {
  const a = lerp(p0, c1, t)
  const b = lerp(c1, c2, t)
  const c = lerp(c2, p3, t)
  const d = lerp(a, b, t)
  const e = lerp(b, c, t)
  return [lerp(d, e, t), e, c, { ...p3 }]
}

/**
 * The parameter at which a curve leaves `frame` for good — 0 when it starts
 * outside, or when it never leaves (overlapping frames: its end is inside, and
 * then the whole curve is the best answer there is).
 *
 * Sampled, then refined by bisection, rather than solved: a cable's handles can
 * make its coordinate along the out-axis non-monotonic, and thirty-three samples
 * plus fourteen halvings is a few hundred multiplications per cable, which a
 * drag re-routing forty cables per frame does not notice.
 */
export function exitParam(p0: Pt, c1: Pt, c2: Pt, p3: Pt, frame: Rect): number {
  const inside = (p: Pt) => p.x > frame.x && p.x < frame.x + frame.w && p.y > frame.y && p.y < frame.y + frame.h
  if (inside(p3)) return 0
  const N = 32
  let last = -1
  for (let i = 0; i <= N; i++) if (inside(bezierPoint(p0, c1, c2, p3, i / N))) last = i
  if (last < 0) return 0
  let lo = last / N
  let hi = (last + 1) / N
  for (let k = 0; k < 14; k++) {
    const m = (lo + hi) / 2
    if (inside(bezierPoint(p0, c1, c2, p3, m))) lo = m
    else hi = m
  }
  return hi
}

function finish(base: Omit<Cable, 'mid' | 'bounds' | 'path' | 'exit' | 'labelAt' | 'hitPath'>, frame: Rect): Cable {
  const { p0, c1, c2, p3 } = base
  const t = exitParam(p0, c1, c2, p3, frame)
  const tail = bezierTail(p0, c1, c2, p3, t)
  return {
    ...base,
    mid: bezierPoint(p0, c1, c2, p3, 0.5),
    exit: tail[0],
    labelAt: bezierPoint(p0, c1, c2, p3, (t + 1) / 2),
    bounds: curveBounds(p0, c1, c2, p3),
    path: cablePath(p0, c1, c2, p3),
    hitPath: cablePath(...tail),
  }
}

/**
 * Every link of a project, as the list `routeCables` reads.
 *
 * Structural rather than `Screen[]` so the geometry never imports the project
 * module — the tests build these by hand.
 */
export function linksOf(
  screens: ReadonlyArray<{ id: string; links: ReadonlyArray<{ id: string; target: string; x: number; y: number; w: number; h: number; label?: string }> }>,
): CableLink[] {
  const out: CableLink[] = []
  for (const s of screens) {
    for (const h of s.links) {
      out.push({ id: h.id, sourceId: s.id, targetId: h.target, rect: { x: h.x, y: h.y, w: h.w, h: h.h }, label: h.label })
    }
  }
  return out
}

/**
 * Route every link into a cable.
 *
 * `boxes` are the frames AS DRAWN — the canvas passes the live boxes of a move
 * or resize in progress, so a cable follows a frame while it is dragged rather
 * than snapping to it on release. A link whose SOURCE is not in `boxes` is not
 * drawn at all (there is nothing to draw it from); one whose target is missing
 * is drawn as a stub, because a dangling link is precisely what the user needs
 * to see and delete.
 */
export function routeCables(
  links: ReadonlyArray<CableLink>,
  boxes: ReadonlyMap<string, Rect>,
  g: CableGeometry = CABLE_GEOMETRY,
): Cable[] {
  type Pending = {
    link: CableLink
    frame: Rect
    element: Rect
    target: Rect | undefined
    out: Side
    in: Side
    p0: Pt
    self: boolean
    desired: number
    along?: number
  }
  const pending: Pending[] = []
  for (const link of links) {
    const frame = boxes.get(link.sourceId)
    if (!frame) continue
    const element = elementRect(frame, link.rect)
    const target = boxes.get(link.targetId)
    const self = link.sourceId === link.targetId && !!target
    let sides: { out: Side; in: Side }
    if (!target) sides = { out: 'right', in: 'left' }
    else if (self) sides = { out: 'right', in: 'right' }
    else sides = facingSides(frame, target)
    const p0 = portOn(element, sides.out)
    // Where the cable would like to land: level with its own port, or — for a
    // loop back into its own screen — near the top of the right edge, so the
    // loop is a loop and not a line running back over itself.
    const desired = self ? frame.y : horizontal(sides.in) ? p0.y : p0.x
    pending.push({ link, frame, element, target, out: sides.out, in: sides.in, p0, self, desired })
  }

  // Spread the arrivals of each target edge.
  const groups = new Map<string, Pending[]>()
  for (const p of pending) {
    if (!p.target) continue
    const key = `${p.link.targetId}|${p.in}`
    const list = groups.get(key)
    if (list) list.push(p)
    else groups.set(key, [p])
  }
  for (const list of groups.values()) {
    const t = list[0].target!
    const side = list[0].in
    const start = horizontal(side) ? t.y : t.x
    const len = horizontal(side) ? t.h : t.w
    const margin = Math.min(g.edgeMargin, len / 2)
    const along = spreadAlong(
      list.map((p) => p.desired),
      start + margin,
      start + len - margin,
      g.gap,
    )
    list.forEach((p, i) => {
      p.along = along[i]
    })
  }

  return pending.map((p) => {
    const { link, frame, element, target, out, self, p0 } = p
    const common = {
      id: link.id,
      sourceId: link.sourceId,
      targetId: link.targetId,
      label: link.label,
      element,
      out,
      in: p.in,
      self,
      whole: !hasElement(link.rect),
      p0,
    }
    if (!target) {
      // Measured from the FRAME's edge, not the element's: the map is painted
      // behind the frames, and 110 units from a button in the middle of a
      // desktop screen ended inside that screen — the one link the user most
      // needed to see was the one the map could not show at all.
      const p3 = { x: frame.x + frame.w + g.stub, y: p0.y }
      return finish({ ...common, missing: true, c1: lerp(p0, p3, 1 / 3), c2: lerp(p0, p3, 2 / 3), p3 }, frame)
    }
    const edge = portOn(target, p.in)
    const p3 = horizontal(p.in) ? { x: edge.x, y: p.along! } : { x: p.along!, y: edge.y }
    if (self) {
      const loopX = frame.x + frame.w + g.selfLoop
      return finish({ ...common, missing: false, c1: { x: loopX, y: p0.y }, c2: { x: loopX, y: p3.y }, p3 }, frame)
    }
    const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y)
    const handle = clamp(dist * g.handleRatio, g.minHandle, g.maxHandle)
    return finish({
      ...common,
      missing: false,
      c1: add(p0, sideVector(out), handle),
      c2: add(p3, sideVector(p.in), handle),
      p3,
    }, frame)
  })
}

/**
 * The cable being drawn, from a picked element to wherever the pointer is.
 *
 * The free end is treated as a target of no size, so it bends exactly the way
 * the finished cable will once it lands — the preview is the same function, not
 * an approximation of it.
 */
export function pointerCable(frame: Rect, rect: Rect, point: Pt, g: CableGeometry = CABLE_GEOMETRY): Cable {
  const element = elementRect(frame, rect)
  const sides = facingSides(frame, { x: point.x, y: point.y, w: 0, h: 0 })
  const p0 = portOn(element, sides.out)
  const dist = Math.hypot(point.x - p0.x, point.y - p0.y)
  const handle = clamp(dist * g.handleRatio, Math.min(g.minHandle, dist / 2), g.maxHandle)
  return finish({
    id: '',
    sourceId: '',
    targetId: '',
    missing: false,
    self: false,
    whole: !hasElement(rect),
    out: sides.out,
    in: sides.in,
    element,
    p0,
    c1: add(p0, sideVector(sides.out), handle),
    c2: add(point, sideVector(sides.in), handle),
    p3: { ...point },
  }, frame)
}

/**
 * The triangle of an arrowhead whose TIP sits `offset` outside the target edge
 * at `p3`, pointing into the frame. `offset` leaves room for the socket drawn on
 * the edge itself, so the arrow meets the socket rather than piercing it.
 */
export function arrowHead(p3: Pt, inSide: Side, size: number, offset = 0): Pt[] {
  const v = sideVector(inSide)
  const tip = add(p3, v, offset)
  const base = add(tip, v, size)
  const perp = { x: -v.y, y: v.x }
  return [tip, add(base, perp, size * 0.6), add(base, perp, -size * 0.6)]
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y
}

export function grow(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by }
}

/**
 * The world rectangle cables are drawn for, SNAPPED so that a pan does not
 * change it on every frame.
 *
 * The origin is the viewport's, less half a viewport, rounded DOWN to a grid of
 * half a viewport; the size is fixed at two viewports and one step. Panning
 * inside a grid cell therefore returns the very same numbers — only the origin
 * could move, and it is snapped — so the memoised layer is not re-rendered, and
 * the size is enough that the visible area plus half a viewport of slack on
 * every side is covered wherever in the cell the view is. Snapping both edges
 * separately was the first version: each edge crossed its own grid line at a
 * different moment, which doubled the re-renders it was there to save.
 */
export function cullWindow(view: { x: number; y: number; scale: number }, vw: number, vh: number): Rect {
  const s = view.scale > 0 ? view.scale : 1
  const w = vw / s
  const h = vh / s
  const step = Math.max(w, h, 1) / 2
  const x0 = Math.floor((-view.x / s - w / 2) / step) * step
  const y0 = Math.floor((-view.y / s - h / 2) / step) * step
  return { x: x0, y: y0, w: 2 * w + step, h: 2 * h + step }
}

/**
 * The frame under a world point, topmost first — the LAST drawn wins, as it
 * does for the pointer. `exclude` is the source screen: a link from a screen to
 * itself is not something the picker has ever offered.
 */
export function screenAt(
  point: Pt,
  order: ReadonlyArray<string>,
  boxes: ReadonlyMap<string, Rect>,
  exclude?: string,
): string | null {
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]
    if (id === exclude) continue
    const b = boxes.get(id)
    if (!b) continue
    if (point.x >= b.x && point.x <= b.x + b.w && point.y >= b.y && point.y <= b.y + b.h) return id
  }
  return null
}

/** Below this on-screen distance between its ends, a cable's label is not drawn. */
export const LABEL_MIN_CHORD_PX = 110
/** Outside link mode, labels only from this zoom up: below it the map is the point, not the words. */
export const MAP_LABEL_MIN_SCALE = 0.3

/**
 * Whether a cable's label is drawn.
 *
 * Labels are counter-scaled so they stay legible, which means that at a low zoom
 * a label is larger than its cable — twelve of them are a wall of pills over the
 * map they label. So a label needs a cable long enough ON SCREEN to carry it,
 * and in the quiet map view, a zoom where the screens themselves are readable.
 * A cable the user is pointing at, selecting or looking up in the links panel
 * always shows its label: that is the one moment it is being read.
 */
export function labelVisible(cable: Cable, scale: number, opts: { interactive: boolean; emphasised?: boolean }): boolean {
  if (opts.interactive && opts.emphasised) return true
  if (!opts.interactive && scale < MAP_LABEL_MIN_SCALE) return false
  // A dead link says so whatever its length: its stub is short by design, and
  // "(missing screen)" is the one label that asks for something to be done.
  if (cable.missing) return true
  // Measured on the part that is SEEN (from `exit`): the stretch across the
  // source screen carries no label, so it cannot make room for one.
  const chord = Math.hypot(cable.p3.x - cable.exit.x, cable.p3.y - cable.exit.y) * scale
  return chord >= LABEL_MIN_CHORD_PX
}

/**
 * Whether a press on the connecting layer takes hold of the cable in hand
 * (`CableConnect`). Only the primary button, and not while Space is held: the
 * middle button and Space+drag are how the canvas pans, and the board must stay
 * navigable while a cable is in hand, or a distant screen is unreachable.
 * Space+drag was swallowed at first, and its release plugged the cable into
 * whatever screen the pan ended over.
 */
export function connectPressHolds(button: number, spaceDown: boolean): boolean {
  return button === 0 && !spaceDown
}

export type ConnectRelease = { kind: 'ignore' } | { kind: 'drop'; targetId: string } | { kind: 'cancel' }

/**
 * What a release does while a cable is in hand.
 *
 * Ignored unless the primary button went down ON the layer (`pressed`): a press
 * on the bar's buttons, or a pan, ends with a release too, and must neither plug
 * nor drop the cable. Otherwise a release over a screen other than the source
 * plugs it in, and a release over nothing lets go of it. `current` is the screen
 * a reconnected cable is already plugged into: dropping it back there is letting
 * go — there is nothing to write.
 */
export function connectRelease(opts: {
  button: number
  pressed: boolean
  point: Pt | null
  order: ReadonlyArray<string>
  boxes: ReadonlyMap<string, Rect>
  sourceId: string
  current?: string
}): ConnectRelease {
  if (opts.button !== 0 || !opts.pressed) return { kind: 'ignore' }
  if (!opts.point) return { kind: 'cancel' }
  const hit = screenAt(opts.point, opts.order, opts.boxes, opts.sourceId)
  if (!hit || hit === opts.current) return { kind: 'cancel' }
  return { kind: 'drop', targetId: hit }
}

const SHOW_KEY = 'mocky.showCables'

/**
 * Whether the quiet map of cables is drawn outside link mode. Per browser, on
 * by default: the cables are the only place the board says how the screens
 * connect, and a map you must know to switch on is one nobody discovers.
 * Storage can throw (private mode, blocked site data) — then the default holds.
 */
export function readShowCables(): boolean {
  try {
    return localStorage.getItem(SHOW_KEY) !== '0'
  } catch {
    return true
  }
}

export function writeShowCables(show: boolean): void {
  try {
    localStorage.setItem(SHOW_KEY, show ? '1' : '0')
  } catch {
    // Not remembered for next time — the toggle still works for this session.
  }
}
