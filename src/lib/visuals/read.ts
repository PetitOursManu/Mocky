/**
 * The visuals of a screen, read and changed WITHOUT a model call.
 *
 * `<Visual family doc …>` keeps its whole look in a few attributes and its
 * content in one literal, so switching a cycle to a timeline is writing one
 * attribute at an offset the parser vouched for (I1) — the way
 * `screenFrames.ts` changes a frame. Nothing else in the file moves, "Revert"
 * undoes it, and it costs nothing.
 *
 * `doc` is read as DATA: an object literal written inline, or the name of a
 * top-level `const` holding one. Anything else — a value computed, a spread, a
 * call — is reported as `null`, and then nothing here claims to know what the
 * visual says: the dialog still switches the family, the number check stays
 * silent. Never a guess.
 */
import { isVisualFamily, isVisualLook, isVisualVariant, type VisualDoc, type VisualFamily, type VisualLook, type VisualVariant } from './families'

export const VISUAL_COMPONENT = 'Visual'

export interface ScreenVisual {
  /** Rank among the screen's visuals, in source order. */
  index: number
  family: string | null
  variant: string | null
  look: string | null
  /** The other families the generation proposed for this content, best first. */
  alternatives: VisualFamily[]
  doc: VisualDoc | null
}

export interface VisualChange {
  family?: VisualFamily
  variant?: VisualVariant
  look?: VisualLook
}

type Edit = { start: number; end: number; text: string }

const attrOf = (opening: any, name: string) =>
  (Array.isArray(opening?.attributes) ? opening.attributes : []).find((a: any) => a?.type === 'JSXAttribute' && a.name?.name === name)

function literal(attr: any): string | null {
  const v = attr?.value
  if (!v) return null
  if (v.type === 'StringLiteral') return v.value
  if (v.type === 'JSXExpressionContainer') {
    const e = v.expression
    if (e?.type === 'StringLiteral') return e.value
    if (e?.type === 'TemplateLiteral' && e.expressions?.length === 0) return e.quasis?.[0]?.value?.cooked ?? null
  }
  return null
}

const NOT_DATA = Symbol('not data')

/** A literal's value, or NOT_DATA when any part of it is computed. */
function staticValue(node: any, consts: Map<string, any>, depth = 0): unknown {
  if (!node || depth > 40) return NOT_DATA
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value
    case 'NullLiteral':
      return null
    case 'TemplateLiteral':
      return node.expressions?.length === 0 ? node.quasis?.[0]?.value?.cooked ?? NOT_DATA : NOT_DATA
    case 'UnaryExpression':
      if (node.operator === '-' && node.argument?.type === 'NumericLiteral') return -node.argument.value
      return NOT_DATA
    case 'ArrayExpression': {
      const out: unknown[] = []
      for (const el of node.elements ?? []) {
        const v = staticValue(el, consts, depth + 1)
        if (v === NOT_DATA) return NOT_DATA
        out.push(v)
      }
      return out
    }
    case 'ObjectExpression': {
      const out: Record<string, unknown> = {}
      for (const p of node.properties ?? []) {
        if (p.type !== 'ObjectProperty' || p.computed) return NOT_DATA
        const key = p.key?.type === 'Identifier' ? p.key.name : p.key?.type === 'StringLiteral' ? p.key.value : null
        if (key == null) return NOT_DATA
        const v = staticValue(p.value, consts, depth + 1)
        if (v === NOT_DATA) return NOT_DATA
        out[key] = v
      }
      return out
    }
    case 'Identifier': {
      const init = consts.get(node.name)
      return init ? staticValue(init, consts, depth + 1) : NOT_DATA
    }
    default:
      return NOT_DATA
  }
}

function asDoc(v: unknown): VisualDoc | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const items = (v as { items?: unknown }).items
  if (!Array.isArray(items)) return null
  return v as VisualDoc
}

interface Visited {
  index: number
  opening: any
  /** The ObjectExpression the doc is written in (inline or a top-level const), or null. */
  docNode: any
  consts: Map<string, any>
}

async function visit(source: string): Promise<Visited[] | null> {
  if (!source) return []
  const out: Visited[] = []
  try {
    const Babel = await import('@babel/standalone')
    const transform = Babel.transform ?? (Babel as any).default?.transform
    if (typeof transform !== 'function') return null
    const consts = new Map<string, any>()
    let count = 0
    const plugin = () => ({
      visitor: {
        Program(path: any) {
          for (const st of path.node?.body ?? []) {
            const decl = st.type === 'ExportNamedDeclaration' ? st.declaration : st
            if (decl?.type !== 'VariableDeclaration' || decl.kind !== 'const') continue
            for (const d of decl.declarations ?? []) if (d.id?.type === 'Identifier' && d.init) consts.set(d.id.name, d.init)
          }
        },
        JSXElement(path: any) {
          const opening = path.node?.openingElement
          if (opening?.name?.type !== 'JSXIdentifier' || opening.name.name !== VISUAL_COMPONENT) return
          const attr = attrOf(opening, 'doc')
          let docNode: any = attr?.value?.type === 'JSXExpressionContainer' ? attr.value.expression : null
          if (docNode?.type === 'Identifier') docNode = consts.get(docNode.name) ?? null
          if (docNode?.type !== 'ObjectExpression') docNode = null
          out.push({ index: count++, opening, docNode, consts })
        },
      },
    })
    transform(source, { plugins: [plugin], parserOpts: { plugins: ['jsx'] }, code: false, filename: 'mocky-component.jsx' })
  } catch {
    return null
  }
  return out
}

/** The visuals of a screen. Never throws; `[]` when nothing parses. */
export async function findScreenVisuals(source: string): Promise<ScreenVisual[]> {
  const found = await visit(source)
  return (found ?? []).map(({ index, opening, docNode, consts }) => {
    const alt = attrOf(opening, 'alternatives')
    const altValue = alt?.value?.type === 'JSXExpressionContainer' ? staticValue(alt.value.expression, consts) : NOT_DATA
    const value = docNode ? staticValue(docNode, consts) : NOT_DATA
    return {
      index,
      family: literal(attrOf(opening, 'family')),
      variant: literal(attrOf(opening, 'variant')),
      look: literal(attrOf(opening, 'look')),
      alternatives: Array.isArray(altValue) ? altValue.filter((f): f is VisualFamily => isVisualFamily(f)) : [],
      doc: value === NOT_DATA ? null : asDoc(value),
    }
  })
}

function apply(source: string, edits: Edit[]): string {
  let out = source
  const ordered = edits.map((e, i) => ({ ...e, i })).sort((a, b) => b.start - a.start || b.i - a.i)
  for (const e of ordered) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  return out
}

/** The source with one visual's family or variant changed; null when there is nothing to write. */
export async function changeScreenVisual(source: string, index: number, change: VisualChange): Promise<string | null> {
  if (change.family !== undefined && !isVisualFamily(change.family)) return null
  if (change.variant !== undefined && !isVisualVariant(change.variant)) return null
  if (change.look !== undefined && !isVisualLook(change.look)) return null
  const found = await visit(source)
  const el = found?.find((v) => v.index === index)
  if (!el || typeof el.opening?.name?.end !== 'number') return null
  const edits: Edit[] = []
  const set = (name: string, value: string | undefined) => {
    if (value === undefined) return
    const attr = attrOf(el.opening, name)
    if (attr && typeof attr.start === 'number') edits.push({ start: attr.start, end: attr.end, text: `${name}="${value}"` })
    else edits.push({ start: el.opening.name.end, end: el.opening.name.end, text: ` ${name}="${value}"` })
  }
  set('family', change.family)
  set('variant', change.variant)
  set('look', change.look)
  // The family it is leaving stays on offer: it was the generation's first
  // choice, and after one switch the dialog would otherwise forget it.
  const before = literal(attrOf(el.opening, 'family'))
  if (change.family && before && before !== change.family && isVisualFamily(before)) {
    const attr = attrOf(el.opening, 'alternatives')
    const value = attr?.value?.type === 'JSXExpressionContainer' ? staticValue(attr.value.expression, el.consts) : NOT_DATA
    const current = Array.isArray(value) ? value.filter((f): f is VisualFamily => isVisualFamily(f)) : value === NOT_DATA && attr ? null : []
    if (current) {
      const next = [...new Set([before, ...current])].filter((f) => f !== change.family)
      const text = `alternatives={${JSON.stringify(next)}}`
      if (attr && typeof attr.start === 'number') edits.push({ start: attr.start, end: attr.end, text })
      else edits.push({ start: el.opening.name.end, end: el.opening.name.end, text: ` ${text}` })
    }
  }
  if (!edits.length) return null
  const out = apply(source, edits)
  return out === source ? null : out
}

/**
 * The source with its `<Doc format>` set to another page — what "Decline"
 * writes into a COPY of a visual. A visual measures its own box, so the same
 * content laid out again at another size is the whole job: no model. Null when
 * the code has no `<Doc>` with a written format, or it already says this one.
 */
export async function setDocFormat(source: string, format: string): Promise<string | null> {
  if (!/^[a-z0-9-]{2,24}$/.test(format)) return null
  let edit: Edit | null = null
  try {
    const Babel = await import('@babel/standalone')
    const transform = Babel.transform ?? (Babel as any).default?.transform
    if (typeof transform !== 'function') return null
    const plugin = () => ({
      visitor: {
        JSXOpeningElement(path: any) {
          if (edit || path.node?.name?.type !== 'JSXIdentifier' || path.node.name.name !== 'Doc') return
          const attr = attrOf(path.node, 'format')
          if (!attr || literal(attr) == null || typeof attr.start !== 'number') return
          edit = { start: attr.start, end: attr.end, text: `format="${format}"` }
        },
      },
    })
    transform(source, { plugins: [plugin], parserOpts: { plugins: ['jsx'] }, code: false, filename: 'mocky-component.jsx' })
  } catch {
    return null
  }
  if (!edit) return null
  const out = apply(source, [edit])
  return out === source ? null : out
}

/**
 * The source with the `value` and `unit` of some items taken out of one
 * visual's doc — the figures the text never gave (`numbers.ts`). The item
 * stays: its words were the text's, only the number was made up. Null when
 * the doc is not a literal this can edit, or nothing changes.
 */
export async function dropVisualValues(source: string, index: number, items: readonly number[]): Promise<string | null> {
  if (!items.length) return null
  const found = await visit(source)
  const el = found?.find((v) => v.index === index)
  const itemsProp = el?.docNode?.properties?.find(
    (p: any) => p.type === 'ObjectProperty' && !p.computed && (p.key?.name === 'items' || p.key?.value === 'items'),
  )
  const list = itemsProp?.value?.type === 'ArrayExpression' ? itemsProp.value.elements : null
  if (!list) return null
  const edits: Edit[] = []
  for (const i of items) {
    const obj = list[i]
    if (obj?.type !== 'ObjectExpression') continue
    const props: any[] = obj.properties ?? []
    props.forEach((p: any, k: number) => {
      const key = p.type === 'ObjectProperty' && !p.computed ? (p.key?.name ?? p.key?.value) : null
      if (key !== 'value' && key !== 'unit') return
      // From this property to the next one, so its comma goes with it; the
      // last one takes the comma BEFORE it instead.
      const next = props[k + 1]
      const prev = props[k - 1]
      if (next) edits.push({ start: p.start, end: next.start, text: '' })
      else if (prev) edits.push({ start: prev.end, end: p.end, text: '' })
      else edits.push({ start: p.start, end: p.end, text: '' })
    })
  }
  if (!edits.length) return null
  // Two adjacent removals (value then unit, unit last) overlap on the comma
  // between them: merge overlapping ranges before writing.
  edits.sort((a, b) => a.start - b.start)
  const merged: Edit[] = []
  for (const e of edits) {
    const last = merged[merged.length - 1]
    if (last && e.start <= last.end) last.end = Math.max(last.end, e.end)
    else merged.push({ ...e })
  }
  const out = apply(source, merged)
  return out === source ? null : out
}
