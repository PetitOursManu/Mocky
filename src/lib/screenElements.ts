/**
 * Removing an element from a screen WITHOUT a model call.
 *
 * What a click knows is the rendered DOM, and a DOM path says nothing about the
 * source: a `.map()`, a conditional and the snippet packs all shift it. So the
 * preview tags every JSX element it compiles with its RANK in the source
 * (`PICK_SOURCE_PLUGIN`, a Babel plugin run inside the frame), and a pick reads
 * the ranks back up React's own tree. That list is what lets one click tell
 * "the third card" from "the card component", which no selector can.
 *
 * The rank is read in the frame and resolved here, on the stored code, by two
 * walks that count the same way. It is the count and not an offset because the
 * frame compiles `toPreviewModule(code)` behind the snippets' prelude, which
 * moves every offset and no JSX element. `screenElements.test.ts` runs the
 * plugin's own text against this file's walk.
 *
 * The write itself is at parser offsets (I1), and it is re-parsed before it is
 * trusted: a refusal costs the person a click, a broken screen costs the screen.
 */

/** One JSX element on the way up from what was clicked: `index` is its place among its siblings. */
export interface PickedSource {
  rank: number
  index: number
}

export interface Cut {
  start: number
  end: number
  text: string
}

export type ElementRemoval =
  | { kind: 'single'; cuts: Cut[] }
  /** It is drawn several times. `cuts` takes it out everywhere; `item`, when there is one, only here. */
  | { kind: 'repeated'; count: number | null; cuts: Cut[]; item?: Cut[] }
  /** `root`: it is the screen itself. `unknown`: the source does not say how to take it out. */
  | { kind: 'refused'; reason: 'root' | 'unknown' }

/**
 * The Babel plugin the frame compiles with. Text, because it is embedded in the
 * srcDoc: no backticks and no template literals in here. `start` is where the
 * screen's own code begins, past the snippets. A Fragment is counted and not
 * tagged, since React refuses any prop on one but this file's walk sees it.
 */
export const PICK_SOURCE_PLUGIN = `function (start) {
  return function (babel) {
    var t = babel.types, n = 0;
    return { visitor: { Program: function (program) {
      program.traverse({ JSXOpeningElement: function (p) {
        if (p.node.start == null || p.node.start < start) return;
        var rank = n++, name = p.node.name;
        var fragment = (name.type === 'JSXIdentifier' && name.name === 'Fragment') ||
          (name.type === 'JSXMemberExpression' && name.property.name === 'Fragment');
        if (fragment) return;
        p.node.attributes.push(t.jsxAttribute(t.jsxIdentifier('data-mocky-src'), t.stringLiteral(String(rank))));
      } });
    } } };
  };
}`

/** A frame's report is untrusted: bounded integers or nothing. */
export function readPickedSource(raw: unknown): PickedSource[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: PickedSource[] = []
  for (const e of raw.slice(0, 32)) {
    const rank = (e as PickedSource | null)?.rank
    const index = (e as PickedSource | null)?.index
    if (!Number.isInteger(rank) || (rank as number) < 0) return undefined
    out.push({ rank: rank as number, index: Number.isInteger(index) && (index as number) >= 0 ? (index as number) : 0 })
  }
  return out.length ? out : undefined
}

/** A drag (or Alt+Arrow) as the frame reports it. */
export interface MoveRequest {
  from: PickedSource[]
  /** The dragged element's selector now, and what it will be once the screen re-renders. */
  selector: string
  after: string
  /** A reorder: the sibling it lands beside. */
  to?: PickedSource[]
  before: boolean
  /** A grid placement instead. */
  grid?: GridCell
  /** Alt+Arrow rather than a drag. */
  step: boolean
}

const selectorOf = (v: unknown) => (typeof v === 'string' ? v.slice(0, 600) : '')

/** The same distrust as `readPickedSource`: what does not fit is dropped whole. */
export function readMoveRequest(raw: unknown): MoveRequest | undefined {
  const d = raw as Record<string, unknown> | null
  if (!d || typeof d !== 'object') return undefined
  const from = readPickedSource(d.from)
  if (!from) return undefined
  const base = { from, selector: selectorOf(d.selector), after: selectorOf(d.after), step: d.step === true }
  if (d.grid && typeof d.grid === 'object') {
    const g = d.grid as Record<string, unknown>
    const n = (v: unknown, max: number) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= max ? (v as number) : undefined)
    const colStart = n(g.col, 64)
    const rowStart = n(g.row, 64)
    if (!colStart || !rowStart) return undefined
    return { ...base, before: false, grid: { colStart, rowStart, colSpan: n(g.colSpan, 12), rowSpan: n(g.rowSpan, 12) } }
  }
  const to = readPickedSource(d.to)
  if (!to) return undefined
  return { ...base, to, before: d.before === true }
}

/** Every JSX element of the source as a Babel path, in the plugin's order; null when it does not parse. */
async function elementsOf(source: string): Promise<any[] | null> {
  try {
    const Babel = await import('@babel/standalone')
    const transform = Babel.transform ?? (Babel as any).default?.transform
    if (typeof transform !== 'function') return null
    const paths: any[] = []
    const plugin = () => ({
      visitor: {
        JSXOpeningElement(path: any) {
          paths.push(path.parentPath)
        },
      },
    })
    transform(source, { plugins: [plugin], parserOpts: { plugins: ['jsx'] }, code: false, filename: 'mocky-component.jsx' })
    return paths
  } catch {
    return null
  }
}

/** The element's own lines when nothing else is on them, or just the element. */
function lineCut(source: string, node: { start: number; end: number }): Cut {
  let start = node.start
  while (start > 0 && (source[start - 1] === ' ' || source[start - 1] === '\t')) start--
  let end = node.end
  while (end < source.length && (source[end] === ' ' || source[end] === '\t' || source[end] === '\r')) end++
  const alone = (start === 0 || source[start - 1] === '\n') && (end >= source.length || source[end] === '\n')
  if (alone) return { start, end: Math.min(end + 1, source.length), text: '' }
  return { start: node.start, end: node.end, text: '' }
}

/** One entry of an array literal, and the comma that went with it. */
function arrayCut(elements: any[], i: number): Cut {
  const el = elements[i]
  if (i < elements.length - 1) return { start: el.start, end: elements[i + 1].start, text: '' }
  if (i > 0) return { start: elements[i - 1].end, end: el.end, text: '' }
  return { start: el.start, end: el.end, text: '' }
}

const isMapCallback = (fn: any) => {
  const call = fn?.parentPath
  if (!call?.isCallExpression?.() || fn.key !== 0) return false
  const callee = call.node.callee
  return callee?.type === 'MemberExpression' && ['map', 'flatMap'].includes(callee.property?.name)
}

type Target = { cuts: Cut[] } | { rootOf: any } | null

/** How this expression comes out of whatever holds it. */
function targetOf(source: string, path: any): Target {
  const node = path.node
  const parent = path.parentPath
  if (!parent) return null
  if (parent.isJSXElement() || parent.isJSXFragment()) return { cuts: [lineCut(source, node)] }
  if (parent.isJSXExpressionContainer()) {
    const holder = parent.parentPath
    if (holder?.isJSXAttribute()) {
      let start = holder.node.start
      while (start > 0 && /\s/.test(source[start - 1])) start--
      return { cuts: [{ start, end: holder.node.end, text: '' }] }
    }
    return { cuts: [lineCut(source, parent.node)] }
  }
  if (parent.isLogicalExpression() && parent.node.operator === '&&' && parent.node.right === node) return targetOf(source, parent)
  if (parent.isArrayExpression() && !node.extra?.parenthesized) {
    const i = parent.node.elements.indexOf(node)
    if (i >= 0) return { cuts: [arrayCut(parent.node.elements, i)] }
  }
  if (parent.isReturnStatement()) return { rootOf: parent.getFunctionParent() }
  if (parent.isArrowFunctionExpression() && parent.node.body === node) return { rootOf: parent }
  if (
    parent.isConditionalExpression() ||
    parent.isVariableDeclarator() ||
    parent.isObjectProperty() ||
    parent.isArrayExpression()
  ) {
    return { cuts: [{ start: node.start, end: node.end, text: 'null' }] }
  }
  return null
}

/** The array literal a `.map()` walks, when the source writes one out and nothing changes it. */
function literalArray(call: any): any[] | null {
  const object = call.get('callee.object')
  let array = object.isArrayExpression() ? object.node : null
  if (!array && object.isIdentifier()) {
    const binding = object.scope.getBinding(object.node.name)
    if (binding && binding.constantViolations.length === 0 && binding.path.isVariableDeclarator()) {
      const init = binding.path.node.init
      if (init?.type === 'ArrayExpression') array = init
    }
  }
  if (!array) return null
  if (array.elements.some((e: any) => !e || e.type === 'SpreadElement')) return null
  return array.elements
}

const nameOf = (path: any): string | null => {
  const name = path.node.openingElement?.name
  return name?.type === 'JSXIdentifier' ? name.name : null
}

/** The name of the capitalized component a path is written inside, if it is declared by name. */
function componentOf(path: any): string | null {
  let fn = path.getFunctionParent()
  while (fn) {
    const name = fn.node.id?.name ?? (fn.parentPath?.isVariableDeclarator() ? fn.parentPath.node.id?.name : null)
    if (typeof name === 'string' && /^[A-Z]/.test(name)) return name
    fn = fn.getFunctionParent()
  }
  return null
}

function mapItem(source: string, fn: any, index: number): ElementRemoval {
  const call = fn.parentPath
  const elements = literalArray(call)
  if (elements && index < elements.length) return { kind: 'single', cuts: [arrayCut(elements, index)] }
  const whole = targetOf(source, call)
  if (!whole || !('cuts' in whole)) return { kind: 'refused', reason: 'unknown' }
  return { kind: 'repeated', count: elements ? elements.length : null, cuts: whole.cuts }
}

function plan(source: string, paths: any[], chain: PickedSource[], i: number): ElementRemoval {
  const entry = chain[i]
  const path = entry && paths[entry.rank]
  if (!path) return { kind: 'refused', reason: i === 0 ? 'unknown' : 'root' }
  const target = targetOf(source, path)
  if (!target) return { kind: 'refused', reason: 'unknown' }

  if ('rootOf' in target) {
    if (isMapCallback(target.rootOf)) return mapItem(source, target.rootOf, entry.index)
    // The root of a component is that component: what comes out is its use.
    return i + 1 < chain.length ? plan(source, paths, chain, i + 1) : { kind: 'refused', reason: 'root' }
  }

  // Inside a loop, one line of source is one element per item.
  const loop = path.findParent((p: any) => p.isFunction() && isMapCallback(p))
  if (loop) {
    const elements = literalArray(loop.parentPath)
    let item: Cut[] | undefined
    for (let j = i + 1; j < chain.length; j++) {
      const up = paths[chain[j].rank]
      const t = up && targetOf(source, up)
      if (t && 'rootOf' in t && t.rootOf === loop) {
        const removal = mapItem(source, loop, chain[j].index)
        if (removal.kind === 'single') item = removal.cuts
        break
      }
    }
    return { kind: 'repeated', count: elements ? elements.length : null, cuts: target.cuts, item }
  }

  // Inside a component the screen uses several times, the same.
  const component = componentOf(path)
  if (component) {
    const uses = paths.filter((p) => nameOf(p) === component).length
    let inner: ElementRemoval | null = null
    for (let j = i + 1; j < chain.length; j++) {
      const up = paths[chain[j].rank]
      if (up && nameOf(up) === component) {
        inner = plan(source, paths, chain, j)
        break
      }
    }
    if (uses > 1 || inner?.kind === 'repeated') {
      const item = inner?.kind === 'single' ? inner.cuts : inner?.kind === 'repeated' ? inner.item : undefined
      const count = uses > 1 ? uses : inner?.kind === 'repeated' ? inner.count : null
      return { kind: 'repeated', count, cuts: target.cuts, item }
    }
  }
  return { kind: 'single', cuts: target.cuts }
}

/** How each picked element would come out of this source. Never throws. */
export async function planRemovals(source: string, chains: (PickedSource[] | undefined)[]): Promise<ElementRemoval[]> {
  const paths = await elementsOf(source)
  return chains.map((chain) => {
    if (!paths || !chain?.length) return { kind: 'refused', reason: 'unknown' } as const
    return plan(source, paths, chain, 0)
  })
}

/*
 * MOVING an element, with no model call either.
 *
 * A move is a reorder among the things one container holds, and the container
 * is read off the SOURCE: the children of a JSX element, or the entries of the
 * array literal a `.map()` walks. Whatever the frame's drag saw — a flex row, a
 * grid, a column of blocks — what is written is the same thing: the slots of
 * that container in a new order, the text BETWEEN them left where it was. That
 * is what keeps the indentation right without re-indenting anything: siblings
 * of one container share their margin, and the separators carry it.
 *
 * Both ends of a move are resolved the way a removal resolves its target, and
 * they must land in the SAME container. Dragging an element out of its parent
 * is a different operation — it changes what styles apply to it — and the
 * person was given reorder, not re-parenting.
 */

export type MoveRefusal =
  /** The screen itself, or a component's own root with nothing above it. */
  | 'root'
  | 'unknown'
  /** An item of a list the code computes: there is no written entry to move. */
  | 'computed'
  /** Drawn several times by one piece of code: moving it here moves it everywhere. */
  | 'repeated'
  /** The two ends are not in the same container. */
  | 'container'
  /** Its `className` is an expression Mocky does not write into. */
  | 'className'
  /** A component's use, whose class may never reach the page. */
  | 'component'
  /** The drop leaves it where it was. Not worth a notice. */
  | 'same'

export type ElementMove = { kind: 'moved'; cuts: Cut[] } | { kind: 'refused'; reason: MoveRefusal }

/** A CSS grid cell, 1-based like the lines Tailwind names. */
export interface GridCell {
  colStart: number
  rowStart: number
  /** Only when the element spans more than one track; otherwise its own span class is kept. */
  colSpan?: number
  rowSpan?: number
}

interface Slot {
  start: number
  end: number
  node: any
}

interface Unit {
  /** What moves: a JSX child, the `{…}` that holds it, or an array entry. */
  node: any
  /** The container's slots in source order. Identity of `slots` is not the container's: `container` is. */
  container: any
  slots: Slot[]
  /** The JSX element written for it, and the chain index it was found at. */
  element: any
  at: number
  /** A component's root that this use stands for, when the walk went up through one. */
  rootFrom: any | null
  /** The `.map()` call, when the unit is an entry of the array it walks. */
  list: any | null
}

const refusedMove = (reason: MoveRefusal): ElementMove => ({ kind: 'refused', reason })

/**
 * A JSX element's children as slots. Whitespace-only text is a separator, not
 * a slot; text with words is a slot narrowed to its words, so the margin
 * around it stays a separator too.
 */
function jsxSlots(source: string, parent: any): Slot[] {
  const out: Slot[] = []
  for (const child of parent.children) {
    if (child.type === 'JSXText') {
      const raw = source.slice(child.start, child.end)
      if (!raw.trim()) continue
      const lead = raw.length - raw.trimStart().length
      const trail = raw.length - raw.trimEnd().length
      out.push({ start: child.start + lead, end: child.end - trail, node: child })
    } else {
      out.push({ start: child.start, end: child.end, node: child })
    }
  }
  return out
}

/** Where the element at `chain[i]` sits, as something a reorder can move. */
function resolveUnit(source: string, paths: any[], chain: PickedSource[], i: number, rootFrom: any = null): Unit | MoveRefusal {
  const entry = chain[i]
  const path = entry && paths[entry.rank]
  if (!path) return i === 0 ? 'unknown' : 'root'
  // `{on && <b/>}` and `{on ? <a/> : <b/>}` move whole: the condition goes with its element.
  let at = path
  for (;;) {
    const p = at.parentPath
    if (p?.isLogicalExpression() && p.node.right === at.node) at = p
    else if (p?.isConditionalExpression() && p.node.test !== at.node) at = p
    else break
  }
  const parent = at.parentPath
  if (!parent) return 'unknown'
  const base = { element: path, at: i, rootFrom, list: null }
  if (parent.isJSXElement() || parent.isJSXFragment()) {
    return { ...base, node: at.node, container: parent.node, slots: jsxSlots(source, parent.node) }
  }
  if (parent.isJSXExpressionContainer()) {
    const holder = parent.parentPath
    if (holder?.isJSXElement() || holder?.isJSXFragment()) {
      return { ...base, node: parent.node, container: holder.node, slots: jsxSlots(source, holder.node) }
    }
    return 'unknown'
  }
  const fn = parent.isReturnStatement()
    ? parent.getFunctionParent()
    : parent.isArrowFunctionExpression() && parent.node.body === at.node
      ? parent
      : null
  if (!fn) return 'unknown'
  if (isMapCallback(fn)) {
    const elements = literalArray(fn.parentPath)
    if (!elements) return 'computed'
    const item = elements[entry.index]
    if (!item) return 'unknown'
    return {
      ...base,
      node: item,
      container: elements,
      slots: elements.map((e: any) => ({ start: e.start, end: e.end, node: e })),
      list: fn.parentPath,
    }
  }
  // A component's root is that component: what moves is its use.
  return i + 1 < chain.length ? resolveUnit(source, paths, chain, i + 1, path) : 'root'
}

/** Is this code drawn more than once — inside a loop, or a component the screen uses several times? */
function repeatedAt(paths: any[], chain: PickedSource[], i: number, path: any): boolean {
  if (path.findParent((p: any) => p.isFunction() && isMapCallback(p))) return true
  const component = componentOf(path)
  if (!component) return false
  if (paths.filter((p) => nameOf(p) === component).length > 1) return true
  for (let j = i + 1; j < chain.length; j++) {
    const up = paths[chain[j].rank]
    if (up && nameOf(up) === component) return repeatedAt(paths, chain, j, up)
  }
  return false
}

const unitRepeats = (paths: any[], chain: PickedSource[], u: Unit) =>
  repeatedAt(paths, chain, u.at, u.list ?? u.element)

/** The slots in a new order, the separators where they were: one cut over the part that changed. */
function reorder(source: string, slots: Slot[], from: number, to: number, position: 'before' | 'after'): ElementMove {
  if (from < 0 || to < 0 || from === to) return refusedMove(from === to && from >= 0 ? 'same' : 'unknown')
  const order = slots.map((_, k) => k).filter((k) => k !== from)
  const at = order.indexOf(to) + (position === 'after' ? 1 : 0)
  order.splice(at, 0, from)
  let lo = 0
  while (lo < order.length && order[lo] === lo) lo++
  if (lo === order.length) return refusedMove('same')
  let hi = order.length - 1
  while (order[hi] === hi) hi--
  let text = ''
  for (let n = lo; n <= hi; n++) {
    if (n > lo) text += source.slice(slots[n - 1].end, slots[n].start)
    text += source.slice(slots[order[n]].start, slots[order[n]].end)
  }
  return { kind: 'moved', cuts: [{ start: slots[lo].start, end: slots[hi].end, text }] }
}

/**
 * Move the element `from` names to just before or after the one `to` names.
 * Both are chains as the frame reports them; only ranks and indices travel,
 * never offsets. Never throws.
 */
export async function planMove(
  source: string,
  from: PickedSource[] | undefined,
  to: PickedSource[] | undefined,
  position: 'before' | 'after',
): Promise<ElementMove> {
  const paths = await elementsOf(source)
  if (!paths || !from?.length || !to?.length) return refusedMove('unknown')
  const a = resolveUnit(source, paths, from, 0)
  if (typeof a === 'string') return refusedMove(a)
  const b = resolveUnit(source, paths, to, 0)
  if (typeof b === 'string') return refusedMove(b === 'root' ? 'container' : b)
  if (a.container !== b.container) return refusedMove('container')
  if (unitRepeats(paths, from, a)) return refusedMove('repeated')
  const index = (node: any) => a.slots.findIndex((s) => s.node === node)
  return reorder(source, a.slots, index(a.node), index(b.node), position)
}

/*
 * Placing an element on a grid cell is a class, not a reorder: the
 * `col-start-*` / `row-start-*` of Tailwind 3 (the preview's runtime). The
 * literal is rewritten at parser offsets; only its tokens are matched, and only
 * the ones that place an item on the grid — the shorthands (`col-[…]`,
 * `col-auto`) and the ends included, since any of them left behind would fight
 * the new start. Under every variant too: a `md:col-start-2` left in place is
 * the class the preview, wide enough for `md:`, actually applies, so the drop
 * would do nothing anybody could see.
 */
const PLACES = /^(?:[^\s:]+:)*!?(?:col|row)-(?:start-|end-|auto$|\[)/
const SPANS_COL = /^(?:[^\s:]+:)*!?col-span-/
const SPANS_ROW = /^(?:[^\s:]+:)*!?row-span-/

const named = (prefix: string, n: number, max: number) => (n <= max ? `${prefix}-${n}` : `${prefix}-[${n}]`)

function placementClasses(cell: GridCell): string[] {
  const out = [named('col-start', cell.colStart, 13), named('row-start', cell.rowStart, 13)]
  if (cell.colSpan && cell.colSpan > 1) out.push(`col-span-${Math.min(cell.colSpan, 12)}`)
  if (cell.rowSpan && cell.rowSpan > 1) out.push(`row-span-${Math.min(cell.rowSpan, 12)}`)
  return out
}

/**
 * One literal's tokens without the dropped ones. Null when a dropped token
 * touches an interpolation (`col-start-${n}`): half of it is code, and
 * removing the written half would leave a class nobody wrote.
 */
function withoutTokens(raw: string, drop: (tok: string) => boolean, openStart: boolean, openEnd: boolean): string | null {
  let touched = false
  const out = raw.replace(/(\s*)(\S+)/g, (m: string, ws: string, tok: string, offset: number) => {
    if (!drop(tok)) return m
    if ((openStart && offset + ws.length === 0) || (openEnd && offset + m.length === raw.length)) touched = true
    return ''
  })
  if (touched) return null
  return /^\s/.test(raw) ? out : out.replace(/^\s+/, '')
}

const joinClasses = (kept: string, add: string[], gap: boolean) =>
  kept + (kept ? (/\s$/.test(kept) ? '' : ' ') : gap ? ' ' : '') + add.join(' ')

function classCut(source: string, opening: any, add: string[], drop: (tok: string) => boolean): Cut | null {
  const attr = opening.attributes.find((a: any) => a.type === 'JSXAttribute' && a.name?.name === 'className')
  if (!attr) return { start: opening.name.end, end: opening.name.end, text: ` className="${add.join(' ')}"` }
  let lit = attr.value
  if (lit?.type === 'JSXExpressionContainer') lit = lit.expression
  if (lit?.type === 'StringLiteral') {
    const kept = withoutTokens(source.slice(lit.start + 1, lit.end - 1), drop, false, false)
    if (kept === null) return null
    return { start: lit.start + 1, end: lit.end - 1, text: joinClasses(kept, add, false) }
  }
  if (lit?.type === 'TemplateLiteral') {
    const quasis = lit.quasis
    const last = quasis.length - 1
    let text = ''
    for (let k = 0; k <= last; k++) {
      const q = quasis[k]
      let kept = withoutTokens(source.slice(q.start, q.end), drop, k > 0, k < last)
      if (kept === null) return null
      if (k === last) kept = joinClasses(kept, add, last > 0)
      if (k > 0) text += source.slice(quasis[k - 1].end, q.start)
      text += kept
    }
    return { start: quasis[0].start, end: quasis[last].end, text }
  }
  return null
}

/** Host elements, and `motion.*`, which forwards its class to one. */
function writesItsOwnClass(path: any): boolean {
  const name = path.node.openingElement?.name
  if (name?.type === 'JSXIdentifier') return /^[a-z]/.test(name.name)
  return name?.type === 'JSXMemberExpression' && name.object?.type === 'JSXIdentifier' && name.object.name === 'motion'
}

/** Put the element `chain` names on this grid cell, by its class. Never throws. */
export async function planGridPlacement(source: string, chain: PickedSource[] | undefined, cell: GridCell): Promise<ElementMove> {
  const ok = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 64
  if (!ok(cell.colStart) || !ok(cell.rowStart)) return refusedMove('unknown')
  const paths = await elementsOf(source)
  if (!paths || !chain?.length) return refusedMove('unknown')
  const u = resolveUnit(source, paths, chain, 0)
  if (typeof u === 'string') return refusedMove(u)
  // One class written in a loop places every item on the same cell.
  if (u.list || unitRepeats(paths, chain, u)) return refusedMove('repeated')
  let target = u.element
  if (!writesItsOwnClass(target)) {
    // A component used once: its root is the element the grid holds.
    const root = u.rootFrom
    const name = nameOf(target)
    if (!root || !name || componentOf(root) !== name || paths.filter((p) => nameOf(p) === name).length !== 1) {
      return refusedMove('component')
    }
    if (!writesItsOwnClass(root)) return refusedMove('component')
    target = root
  }
  const drop = (tok: string) =>
    PLACES.test(tok) || (!!cell.colSpan && cell.colSpan > 1 && SPANS_COL.test(tok)) || (!!cell.rowSpan && cell.rowSpan > 1 && SPANS_ROW.test(tok))
  const cut = classCut(source, target.node.openingElement, placementClasses(cell), drop)
  if (!cut) return refusedMove('className')
  if (cut.text === source.slice(cut.start, cut.end)) return refusedMove('same')
  return { kind: 'moved', cuts: [cut] }
}

/** The source with these cuts made, or null when the result would not parse. Never throws. */
export async function applyCuts(source: string, cuts: Cut[]): Promise<string | null> {
  if (cuts.length === 0) return null
  // Two picks can overlap, a card and its title, or two neighbours sharing a
  // comma. The outer cut already holds the inner one.
  const sorted = [...cuts].sort((a, b) => a.start - b.start || b.end - a.end)
  const merged: Cut[] = []
  for (const cut of sorted) {
    const last = merged[merged.length - 1]
    if (last && cut.start < last.end) {
      last.end = Math.max(last.end, cut.end)
      last.text = ''
    } else {
      merged.push({ ...cut })
    }
  }
  let out = source
  for (let i = merged.length - 1; i >= 0; i--) out = out.slice(0, merged[i].start) + merged[i].text + out.slice(merged[i].end)
  return (await elementsOf(out)) ? out : null
}
