/**
 * The frames of a screen, read and changed WITHOUT a model call.
 *
 * `<ShapeFrame shape src alt focus …>` (snippets/ShapeFrame.ts) is a component
 * whose whole look lives in a handful of attributes, so changing a frame's shape
 * or its picture is writing one attribute — at an offset the parser vouched for
 * (I1), the way `plugFilmIntoSlot` plugs a film and `screenImages.ts` swaps a
 * picture. Nothing else in the file moves, "Revert" undoes it like any edit, and
 * it costs nothing.
 *
 * Two kinds of element are listed:
 *  - every `<ShapeFrame>`, to change its shape, its picture or its framing;
 *  - every `<img>` with a written address, to PUT it in a frame: the tag becomes
 *    `ShapeFrame` and gains a `shape`, its other attributes kept as they are —
 *    `src`, `alt` and `className` mean the same thing on both.
 *
 * An element is named by its kind and its rank in the source, and found again by
 * parsing on every write: the dialog passes the code it listed from, and a write
 * against code that changed since is refused by the caller, not guessed at here.
 *
 * What it will not do: rewrite an attribute the code COMPUTES. `src={item.photo}`
 * inside a `.map()` is one element drawn once per item; writing a literal there
 * would put the same picture on every card. Such a value is reported as `null`
 * (and the element as `repeated`), and the dialog does not offer to change it.
 */
import { isFrameShape } from './frameShapes'

export const FRAME_COMPONENT = 'ShapeFrame'

/** The framing choices the dialog offers — the component's own `focus` names. */
export const FRAME_FOCI = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'] as const
export type FrameFocus = (typeof FRAME_FOCI)[number]

export interface ScreenFrame {
  kind: 'frame' | 'img'
  /** Rank among the elements of its kind, in source order. */
  index: number
  /** The written shape, or null when absent or computed (an `<img>` has none). */
  shape: string | null
  /** The written picture address, or null when computed. */
  src: string | null
  alt: string | null
  focus: string | null
  shadow: boolean
  /** Inside a `.map()`: one element drawn several times. */
  repeated: boolean
}

export interface FrameChange {
  shape?: string
  src?: string
  alt?: string
  focus?: FrameFocus
  shadow?: boolean
}

type Edit = { start: number; end: number; text: string }

const attrOf = (opening: any, name: string) =>
  (Array.isArray(opening?.attributes) ? opening.attributes : []).find((a: any) => a?.type === 'JSXAttribute' && a.name?.name === name)

/** A written string value: `"x"` or `{"x"}` / `{'x'}` / a template with no expression. */
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

/** `shadow`, `shadow={true}` → true; absent or `{false}` → false. */
function flag(attr: any): boolean {
  if (!attr) return false
  if (attr.value == null) return true
  const e = attr.value.type === 'JSXExpressionContainer' ? attr.value.expression : null
  return e?.type === 'BooleanLiteral' ? e.value : true
}

/**
 * A string as a JSX attribute value. JSX strings have no escapes — `"a\"b"` is
 * a backslash and a broken attribute — so anything with a quote or a backslash
 * goes in an expression container instead.
 */
function jsxString(value: string): string {
  return /["\\\n]/.test(value) ? `{${JSON.stringify(value)}}` : `"${value}"`
}

function attrText(name: string, value: string | boolean): string {
  if (typeof value === 'boolean') return value ? name : `${name}={false}`
  return `${name}=${jsxString(value)}`
}

interface Visited {
  kind: 'frame' | 'img'
  index: number
  opening: any
  closing: any
  repeated: boolean
}

/** Every frame and framable picture, in source order; null when the source does not parse. */
async function visit(source: string): Promise<Visited[] | null> {
  if (!source) return []
  const out: Visited[] = []
  try {
    const Babel = await import('@babel/standalone')
    const transform = Babel.transform ?? (Babel as any).default?.transform
    if (typeof transform !== 'function') return null
    const counts = { frame: 0, img: 0 }
    const plugin = () => ({
      visitor: {
        JSXElement(path: any) {
          const opening = path.node?.openingElement
          if (opening?.name?.type !== 'JSXIdentifier') return
          const name = opening.name.name
          const kind = name === FRAME_COMPONENT ? 'frame' : name === 'img' ? 'img' : null
          if (!kind) return
          // An <img> whose address is computed cannot be framed by a write; a
          // frame always can (its shape is ours), whatever its picture is.
          if (kind === 'img' && literal(attrOf(opening, 'src')) == null) return
          const repeated = !!path.findParent(
            (p: any) => p.isCallExpression?.() && p.node?.callee?.type === 'MemberExpression' && p.node.callee.property?.name === 'map',
          )
          out.push({ kind, index: counts[kind]++, opening, closing: path.node.closingElement, repeated })
        },
      },
    })
    transform(source, { plugins: [plugin], parserOpts: { plugins: ['jsx'] }, code: false, filename: 'mocky-component.jsx' })
  } catch {
    return null
  }
  return out
}

/** The frames of a screen and the pictures that could become one. Never throws; `[]` when nothing parses. */
export async function findScreenFrames(source: string): Promise<ScreenFrame[]> {
  const found = await visit(source)
  return (found ?? []).map(({ kind, index, opening, repeated }) => ({
    kind,
    index,
    shape: kind === 'frame' ? literal(attrOf(opening, 'shape')) : null,
    src: literal(attrOf(opening, 'src')),
    alt: literal(attrOf(opening, 'alt')),
    focus: kind === 'frame' ? literal(attrOf(opening, 'focus')) : null,
    shadow: kind === 'frame' ? flag(attrOf(opening, 'shadow')) : false,
    repeated,
  }))
}

/**
 * The source with one frame changed — or one picture put in a frame, when the
 * target is an `<img>` and the change names a shape. Null when the element is
 * gone, the change is not one this can write (an unknown shape, a picture the
 * code computes), or nothing would change. Never throws.
 */
export async function changeScreenFrame(
  source: string,
  target: { kind: 'frame' | 'img'; index: number },
  change: FrameChange,
): Promise<string | null> {
  if (change.shape !== undefined && !isFrameShape(change.shape)) return null
  if (change.focus !== undefined && !(FRAME_FOCI as readonly string[]).includes(change.focus)) return null
  const found = await visit(source)
  const el = found?.find((v) => v.kind === target.kind && v.index === target.index)
  if (!el) return null
  const { opening, closing } = el
  if (typeof opening?.name?.end !== 'number') return null

  const edits: Edit[] = []
  if (el.kind === 'img') {
    // Framing a picture is renaming its tag; the shape is what makes it a frame.
    if (!change.shape) return null
    edits.push({ start: opening.name.start, end: opening.name.end, text: FRAME_COMPONENT })
    if (closing?.name && typeof closing.name.start === 'number')
      edits.push({ start: closing.name.start, end: closing.name.end, text: FRAME_COMPONENT })
  }

  const set = (name: string, value: string | boolean | undefined) => {
    if (value === undefined) return
    const attr = attrOf(opening, name)
    if (attr && typeof attr.start === 'number' && typeof attr.end === 'number') {
      // A computed picture stays computed: see the header.
      if (name === 'src' && literal(attr) == null) throw new Error('computed src')
      edits.push({ start: attr.start, end: attr.end, text: attrText(name, value) })
    } else if (value !== false) {
      edits.push({ start: opening.name.end, end: opening.name.end, text: ` ${attrText(name, value)}` })
    }
  }
  try {
    set('shape', change.shape)
    set('src', change.src)
    set('alt', change.alt)
    set('focus', change.focus)
    set('shadow', change.shadow)
  } catch {
    return null
  }
  if (!edits.length) return null

  // Applied from the end, so every earlier offset still points where it did.
  // Inserts at the same offset keep their written order.
  let out = source
  const ordered = edits.map((e, i) => ({ ...e, i })).sort((a, b) => b.start - a.start || b.i - a.i)
  for (const e of ordered) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  return out === source ? null : out
}
