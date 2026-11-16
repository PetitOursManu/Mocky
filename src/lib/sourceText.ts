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

/**
 * Keys of a data object whose values are machinery: `{ id: 'pro', href: '/pro' }`.
 * Not `name` or `title`: in a data array those are what a card prints.
 */
const MACHINERY_KEYS = /^(id|key|slug|url|path|href|src|img|image|photo|icon|class|className|cls|bg|color|tone|variant|type|kind|route|to|value|format|lang)$/i

export interface TextRun {
  /** Offsets of the editable text in the source, quotes excluded. */
  start: number
  end: number
  /**
   * `attr` is a JSX attribute's string, which is NOT a JavaScript string: it
   * has no backslash escapes — `title='l\'équipe'` does not parse — and takes
   * entities instead.
   */
  kind: 'jsx' | 'string' | 'template' | 'attr'
  /** The quote of a string literal or an attribute. */
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
   * chunk inside a `className` is a class list, a string a reader could not
   * pronounce — an address, a hex colour, a run with no letter — is not a
   * word, and a value the code COMPARES against is logic (see `logic` below).
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

/** Inside a `className={…}` (or `class`, `style`): what a template chunk there spells is not words. */
function inClassAttribute(path: any): boolean {
  for (let p = path.parentPath; p; p = p.parentPath) {
    if (p.node?.type === 'JSXAttribute') return /^(className|class|style)$/.test(p.node.name?.name ?? '')
    if (p.node?.type === 'JSXElement' || p.node?.type === 'Program') return false
  }
  return false
}

type ValuedRun = TextRun & { value?: string }

/** The runs of the source a reader sees as words, in source order. Null when the code does not parse. */
export async function textRuns(code: string, transform: Transform, opts: RunOptions = {}): Promise<TextRun[] | null> {
  const runs: ValuedRun[] = []
  const strict = !!opts.translation
  /**
   * Values the code compares against or keys data by. `useState('Mensuel')`
   * and `tab === 'Mensuel'` are one value in two places, and translating the
   * first without the second breaks the screen's logic while every word on it
   * reads right. So a value that appears anywhere as logic is translated
   * nowhere — a tab label left in the original language is a cosmetic miss,
   * a dead tab is a broken page.
   */
  const logic = new Set<string>()
  const attrName = (parent: any): string => {
    const n = parent?.name
    if (!n) return ''
    return n.type === 'JSXNamespacedName' ? `${n.namespace?.name}:${n.name?.name}` : n.name ?? ''
  }
  const skippedAttr = (parent: any) => {
    if (parent?.type !== 'JSXAttribute') return false
    const name = attrName(parent)
    return NOT_TEXT_ATTRS.has(name) || (strict && (NOT_TRANSLATED_ATTRS.has(name) || /^on[A-Z]/.test(name)))
  }
  const plugin = () => ({
    visitor: {
      JSXText(path: any) {
        const n = path.node
        if (typeof n.start !== 'number' || !n.value.trim()) return
        if (strict && !/\p{L}/u.test(n.value)) return
        runs.push({ start: n.start, end: n.end, kind: 'jsx' })
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
          if (parent?.type === 'BinaryExpression' || parent?.type === 'SwitchCase' || parent?.type === 'MemberExpression') {
            logic.add(n.value)
            return
          }
          if (parent?.type === 'ObjectProperty' && parent.value === n) {
            const key = parent.key?.name ?? parent.key?.value
            if (typeof key === 'string' && MACHINERY_KEYS.test(key)) {
              logic.add(n.value)
              return
            }
          }
          if (machineryString(n.value)) return
        }
        const raw = code.slice(n.start, n.end)
        const quote = raw[0]
        if (quote !== '"' && quote !== "'") return
        const kind = parent?.type === 'JSXAttribute' ? 'attr' : 'string'
        runs.push({ start: n.start + 1, end: n.end - 1, kind, quote, value: n.value })
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
  return runs
    .filter((r) => !(strict && r.value !== undefined && logic.has(r.value)))
    .map(({ value: _value, ...r }) => r)
    .sort((a, b) => a.start - b.start)
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
  if (/[\n\r]/.test(value) && run.kind !== 'template') return null
  if (run.kind === 'attr') return value.replace(new RegExp(run.quote as string, 'g'), run.quote === '"' ? '&quot;' : '&apos;')
  if (run.kind === 'string') return value.replace(/\\/g, '\\\\').replace(new RegExp(run.quote as string, 'g'), `\\${run.quote}`)
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

/** The words a reader sees, runs joined by a space and whitespace folded. */
export function visibleText(code: string, runs: TextRun[]): string {
  return runs.map((r) => code.slice(r.start, r.end)).join(' ').replace(/\s+/g, ' ')
}
