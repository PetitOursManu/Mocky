/**
 * What a generated screen's markup actually is, as facts a rule can test.
 *
 * WHY A SEPARATE PASS
 *
 * Every SEO and accessibility rule asks a question about structure: is there
 * one `<h1>`, does this `<img>` carry an `alt`, is this `<button>` reachable by
 * name. Answering each of them by walking the source again would parse the file
 * once per rule. This walks it once and hands the rules a summary.
 *
 * WHY AN AST, AGAIN
 *
 * Invariant I1. `<img` matches inside a string that talks about images, inside
 * a commented-out block the model left behind, and inside a code sample the
 * screen itself renders. An accessibility report that says "3 images have no
 * alt" about three images that do not exist is worse than no report: it sends
 * someone looking for a problem that is not there, and it discredits the
 * findings that ARE real.
 *
 * WHAT IT CANNOT SEE, AND SAYS SO
 *
 * Source-only analysis knows the markup and nothing about the rendering. It
 * cannot measure contrast, focus order as painted, or whether a heading is
 * visually a heading. Invariant Q4 is the rule here: the score declares what it
 * did not look at rather than awarding full marks for it. Nothing in this file
 * guesses at a rendered property.
 */

/** A JSX element, reduced to what the rules ask about. */
export interface ElementFact {
  /** Lower-cased tag for host elements; the component name for `<Card />`. */
  tag: string
  /** True for `<div>`, false for `<Card />` — only host elements have semantics. */
  host: boolean
  /** 1-based line in the source, for pointing at it. */
  line: number
  /** Attribute names present, lower-cased where they are HTML-ish. */
  attrs: Record<string, AttrValue>
  /** Text this element contains directly or through descendants, trimmed. */
  text: string
  /** Ancestor host tags, innermost last. */
  ancestors: string[]
  /** Whether the element has any element children at all. */
  hasChildren: boolean
  /**
   * Whether it contains text this analysis cannot read — `{p.name}`, `{label}`,
   * `{t('save')}`.
   *
   * The single most important fact here, and the one that was missing. Without
   * it, `text` being empty means two completely different things: "this heading
   * is empty" and "this heading's words come from data". Generated screens are
   * full of the second — every item rendered from a `.map` — so a rule that
   * conflated them reported a false positive on almost every real page, which
   * is the fastest way to make a whole report untrustworthy.
   */
  hasDynamicText: boolean
}

/** A JSX attribute's value, when it is knowable without running the code. */
export type AttrValue =
  | { kind: 'string'; value: string }
  /** `alt` with no `=` at all — `<img alt />`, which is `true`, not a caption. */
  | { kind: 'bare' }
  /** `alt={x}` — present, value unknowable. Rules must not claim it is empty. */
  | { kind: 'expression'; value: string | null }

export interface ScreenFacts {
  elements: ElementFact[]
  /** False when Babel could not parse the source; every rule then stands down. */
  parsed: boolean
}

const EMPTY: ScreenFacts = { elements: [], parsed: false }

/** Host elements start lower-case; `<Card />` is a component and carries no HTML semantics. */
const isHost = (name: string) => /^[a-z]/.test(name)

function nameOf(node: any): string {
  const n = node?.name
  if (!n) return ''
  if (n.type === 'JSXIdentifier') return String(n.name)
  // `<Foo.Bar />` — a component either way, so the joined name is only a label.
  if (n.type === 'JSXMemberExpression') {
    const obj = n.object?.name ?? ''
    const prop = n.property?.name ?? ''
    return `${obj}.${prop}`
  }
  return ''
}

/**
 * The literal text an expression contributes, when it is knowable.
 *
 * `{'Send'}` is text. `{label}` is not — and reporting a button as unnamed
 * because its label came from a prop would be a false positive on perfectly
 * good code. Unknowable is recorded as unknowable, never as empty.
 */
function literalText(node: any): string | null {
  if (!node) return null
  if (node.type === 'StringLiteral') return String(node.value)
  // `tabIndex={3}` and `aria-hidden={true}` are every bit as knowable as a
  // quoted string — and in JSX they are the ONLY way to write them, since
  // `tabIndex="3"` is a string where React wants a number. Reading only strings
  // meant the tabindex rule could never fire on the syntax people actually use.
  if (node.type === 'NumericLiteral' || node.type === 'BooleanLiteral') return String(node.value)
  if (node.type === 'TemplateLiteral' && node.expressions?.length === 0) {
    return (node.quasis || []).map((q: any) => q?.value?.cooked ?? '').join('')
  }
  return null
}

function attrValue(node: any): AttrValue {
  // `<img alt />` — JSX shorthand for `true`. Not a caption, and a rule that
  // treats it as one passes an image nobody can describe.
  if (node.value == null) return { kind: 'bare' }
  if (node.value.type === 'StringLiteral') return { kind: 'string', value: String(node.value.value) }
  if (node.value.type === 'JSXExpressionContainer') {
    const lit = literalText(node.value.expression)
    if (lit !== null) return { kind: 'string', value: lit }
    return { kind: 'expression', value: null }
  }
  return { kind: 'expression', value: null }
}

/**
 * Does this element contain an expression whose text cannot be read here?
 *
 * Recursive, because `<button><span>{label}</span></button>` is as named as
 * `<button>{label}</button>` — the words simply live one element down.
 */
function hasDynamicTextIn(node: any): boolean {
  const children = node?.children
  if (!Array.isArray(children)) return false
  for (const c of children) {
    if (c?.type === 'JSXExpressionContainer') {
      // A knowable literal is not dynamic — it already contributed to `text`.
      if (literalText(c.expression) === null && c.expression?.type !== 'JSXEmptyExpression') return true
    } else if ((c?.type === 'JSXElement' || c?.type === 'JSXFragment') && hasDynamicTextIn(c)) return true
  }
  return false
}

/** Text contributed by a JSX element's children, recursively. Unknowable parts are skipped. */
function textOf(node: any): string {
  const children = node?.children
  if (!Array.isArray(children)) return ''
  let out = ''
  for (const c of children) {
    if (c?.type === 'JSXText') out += c.value
    else if (c?.type === 'JSXExpressionContainer') {
      const lit = literalText(c.expression)
      if (lit !== null) out += lit
    } else if (c?.type === 'JSXElement') out += textOf(c)
    else if (c?.type === 'JSXFragment') out += textOf(c)
  }
  return out
}

/**
 * Walk a screen's source and describe its markup.
 *
 * Never throws. An unparseable file yields `parsed: false`, and the caller
 * reports "could not be read" instead of "no problems found" — a clean bill of
 * health for a file nobody could open is the worst answer available.
 */
export async function inspectScreen(source: string): Promise<ScreenFacts> {
  if (!source || !source.trim()) return EMPTY
  try {
    const Babel = await import('@babel/standalone')
    const transform = Babel.transform ?? Babel.default?.transform
    if (typeof transform !== 'function') return EMPTY

    const elements: ElementFact[] = []

    const plugin = () => ({
      visitor: {
        JSXElement(path: any) {
          const opening = path.node?.openingElement
          if (!opening) return
          const raw = nameOf(opening)
          if (!raw) return
          const host = isHost(raw)

          const attrs: Record<string, AttrValue> = {}
          for (const a of opening.attributes || []) {
            if (a?.type !== 'JSXAttribute') continue
            const key = String(a.name?.name || '')
            if (!key) continue
            // React spells them className/htmlFor/tabIndex; the rules speak HTML.
            const normalised =
              key === 'className' ? 'class' : key === 'htmlFor' ? 'for' : key === 'tabIndex' ? 'tabindex' : key
            attrs[normalised.toLowerCase()] = attrValue(a)
          }

          const ancestors: string[] = []
          let p = path.parentPath
          while (p) {
            if (p.node?.type === 'JSXElement') {
              const n = nameOf(p.node.openingElement)
              if (n && isHost(n)) ancestors.unshift(n.toLowerCase())
            }
            p = p.parentPath
          }

          elements.push({
            tag: host ? raw.toLowerCase() : raw,
            host,
            line: opening.loc?.start?.line ?? 0,
            attrs,
            ancestors,
            text: textOf(path.node).replace(/\s+/g, ' ').trim(),
            hasChildren: (path.node.children || []).some(
              (c: any) => c?.type === 'JSXElement' || c?.type === 'JSXFragment',
            ),
            hasDynamicText: hasDynamicTextIn(path.node),
          })
        },
      },
    })

    transform(source, {
      plugins: [plugin],
      parserOpts: { plugins: ['jsx'] },
      // Read-only: skipping codegen is the difference between one parse and a
      // full reprint of every screen being audited.
      code: false,
      filename: 'mocky-component.jsx',
    })

    return { elements, parsed: true }
  } catch {
    return EMPTY
  }
}

/** Convenience for the rules: the attribute, or undefined when absent. */
export const attr = (el: ElementFact, name: string): AttrValue | undefined => el.attrs[name]

/** The attribute's text when it is knowable, else null. Absent and unknowable differ. */
export function attrText(el: ElementFact, name: string): string | null {
  const a = el.attrs[name]
  if (!a) return null
  return a.kind === 'string' ? a.value : null
}

/** True when the attribute is there at all, whatever its value is. */
export const hasAttr = (el: ElementFact, name: string) => name in el.attrs
