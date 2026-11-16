/**
 * The words of a screen's source, read with the parser (I1).
 *
 * Lifted out of `campaignFacts.ts`, where it was private, when two more callers
 * needed it: the translation (lib/translate.ts), which rewrites EVERY run a
 * reader sees, and the token propagation (lib/tokenPropagate.ts), which only
 * needs to know that a rewrite still parses. `replaceFacts` reads exactly what
 * it read before — its filter is the default here, and its tests did not move.
 */

/** Attributes whose strings are machinery, not words. */
const NOT_TEXT_ATTRS = new Set(['className', 'class', 'style', 'key', 'id', 'ref', 'role', 'type', 'name', 'htmlFor', 'shape', 'preset', 'variant'])

/**
 * Further attributes a TRANSLATION must not touch. A fact is matched by its
 * value, so an address in `href` is never a candidate for "12 mars"; a
 * translation takes every run, and handing a model `src="/photos/plage.jpg"`
 * to translate is how a picture's address comes back as `/photos/beach.jpg`.
 */
const NOT_TRANSLATED_ATTRS = new Set([
  'src',
  'href',
  'srcSet',
  'poster',
  'action',
  'to',
  'route',
  'video',
  'image',
  'icon',
  'color',
  'accent',
  'fill',
  'stroke',
  'format',
  'fold',
  'mode',
  'size',
  'theme',
  'data-doc',
  'data-screen',
  'xmlns',
  'viewBox',
  'd',
  'points',
  'target',
  'rel',
  'lang',
  'dir',
  'autoComplete',
  'inputMode',
  'method',
  'encType',
  'pattern',
])

export interface TextRun {
  /** Offsets of the editable text in the source, quotes excluded. */
  start: number
  end: number
  kind: 'jsx' | 'string' | 'template'
  /** The quote of a string literal. */
  quote?: string
}

export type Transform = (code: string, opts: Record<string, unknown>) => unknown

export async function loadTransform(): Promise<Transform | null> {
  const Babel = await import('@babel/standalone')
  const transform = (Babel as any).transform ?? (Babel as any).default?.transform
  return typeof transform === 'function' ? transform : null
}

export interface RunOptions {
  /**
   * Read for a translation: the attributes above are machinery too, a template
   * chunk inside a `className` is a class list, and a string a reader could not
   * pronounce — an address, a hex colour, a run with no letter — is not a word.
   */
  translation?: boolean
}

/** Looks like machinery rather than words: an address, a path, a colour, a token. */
function machineryString(value: string): boolean {
  const v = value.trim()
  if (!/\p{L}/u.test(v)) return true
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return true
  if (/^(?:https?:|mailto:|tel:|data:|blob:|\/|\.\/|\.\.\/|#)/i.test(v)) return true
  if (/^[\w.-]+\.(?:png|jpe?g|webp|gif|svg|mp4|webm|pdf|json|js|css)$/i.test(v)) return true
  // One token with no space but a dash, a dot or an underscore: `rounded-xl`, `hero.cta`.
  if (!/\s/.test(v) && /[-_.:/]/.test(v) && !/[.!?…]$/.test(v)) return true
  return false
}

/** Inside a `className={…}` (or `class`): what a template chunk there spells is classes. */
function inClassAttribute(path: any): boolean {
  for (let p = path.parentPath; p; p = p.parentPath) {
    if (p.node?.type === 'JSXAttribute') return /^(className|class|style)$/.test(p.node.name?.name ?? '')
    if (p.node?.type === 'JSXElement' || p.node?.type === 'Program') return false
  }
  return false
}

/** The runs of the source a reader sees as words, in source order. Null when the code does not parse. */
export async function textRuns(code: string, transform: Transform, opts: RunOptions = {}): Promise<TextRun[] | null> {
  const runs: TextRun[] = []
  const strict = !!opts.translation
  const attrName = (parent: any): string | undefined => {
    const n = parent?.name
    if (!n) return undefined
    return n.type === 'JSXNamespacedName' ? `${n.namespace?.name}:${n.name?.name}` : n.name
  }
  const skippedAttr = (parent: any) => {
    if (parent?.type !== 'JSXAttribute') return false
    const name = attrName(parent) ?? ''
    return NOT_TEXT_ATTRS.has(name) || (strict && (NOT_TRANSLATED_ATTRS.has(name) || /^on[A-Z]/.test(name)))
  }
  const plugin = () => ({
    visitor: {
      JSXText(path: any) {
        const n = path.node
        if (typeof n.start === 'number' && n.value.trim()) {
          if (strict && !/\p{L}/u.test(n.value)) return
          runs.push({ start: n.start, end: n.end, kind: 'jsx' })
        }
      },
      StringLiteral(path: any) {
        const n = path.node
        const parent = path.parent
        if (typeof n.start !== 'number' || !n.value.trim()) return
        // Imports, object keys and machinery attributes are not words.
        if (parent?.type === 'ImportDeclaration' || parent?.type === 'ExportAllDeclaration' || parent?.type === 'ExportNamedDeclaration') return
        if ((parent?.type === 'ObjectProperty' || parent?.type === 'ClassProperty') && parent.key === n) return
        if (skippedAttr(parent)) return
        // A string in a call such as classNames('…') or cn('…') is machinery too.
        if (parent?.type === 'CallExpression' && parent.callee?.type === 'Identifier' && /^(cn|clsx|classNames|cx)$/.test(parent.callee.name)) return
        if (strict) {
          if (machineryString(n.value)) return
          // `{ className: '…' }`, `{ href: '…' }` in a data array: keyed by a machinery name.
          if (parent?.type === 'ObjectProperty' && parent.value === n) {
            const key = parent.key?.name ?? parent.key?.value
            if (typeof key === 'string' && (NOT_TEXT_ATTRS.has(key) || NOT_TRANSLATED_ATTRS.has(key) || /^(id|slug|url|path|img|photo|class|cls|bg|tone|variant)$/i.test(key))) return
          }
          // A comparison or a switch case is logic: `status === 'Payé'` must keep its spelling.
          if (parent?.type === 'BinaryExpression' || parent?.type === 'SwitchCase' || parent?.type === 'MemberExpression') return
          if (parent?.type === 'JSXExpressionContainer' && skippedAttr(path.parentPath?.parent)) return
        }
        const raw = code.slice(n.start, n.end)
        const quote = raw[0]
        if (quote !== '"' && quote !== "'") return
        runs.push({ start: n.start + 1, end: n.end - 1, kind: 'string', quote })
      },
      TemplateElement(path: any) {
        const n = path.node
        if (typeof n.start !== 'number' || !n.value?.raw?.trim()) return
        if (strict && (inClassAttribute(path) || machineryString(n.value.raw))) return
        runs.push({ start: n.start, end: n.end, kind: 'template' })
      },
    },
  })
  try {
    transform(code, { plugins: [plugin], parserOpts: { plugins: ['jsx'] }, code: false, filename: 'mocky-text.jsx' })
  } catch {
    return null
  }
  return runs.sort((a, b) => a.start - b.start)
}

/** Whether the code still parses as a screen does. */
export async function parses(code: string, transform?: Transform | null): Promise<boolean> {
  const tf = transform ?? (await loadTransform().catch(() => null))
  if (!tf) return false
  try {
    tf(code, { parserOpts: { plugins: ['jsx'] }, code: false, filename: 'mocky-parse.jsx' })
    return true
  } catch {
    return false
  }
}

/** A new value escaped for where it goes, or null when it cannot go there safely. */
export function escapeFor(run: TextRun, value: string): string | null {
  if (run.kind === 'jsx') return /[{}<>]/.test(value) ? null : value
  if (run.kind === 'string') {
    if (/[\n\r]/.test(value)) return null
    return value.replace(/\\/g, '\\\\').replace(new RegExp(run.quote as string, 'g'), `\\${run.quote}`)
  }
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

/** The words a reader sees, runs joined by a space and whitespace folded. */
export function visibleText(code: string, runs: TextRun[]): string {
  return runs.map((r) => code.slice(r.start, r.end)).join(' ').replace(/\s+/g, ' ')
}
