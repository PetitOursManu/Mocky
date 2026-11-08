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
