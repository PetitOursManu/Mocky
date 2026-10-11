/**
 * Changing a fact in a finished piece WITHOUT a model call, when the piece
 * says it plainly.
 *
 * A campaign asks every piece to write each fact verbatim, in one run of text
 * (`campaignSection`), so "12 mars" → "19 mars" is usually a replacement at a
 * known place in the source: free, instant, and nothing else moves — which is
 * exactly what an update promises and what a model rewriting the page cannot
 * guarantee. When the text is not there as written, the caller falls back on
 * a targeted edit (decided with the user: direct first, a model otherwise).
 *
 * Read with the parser (I1), never with a regex over the source: the same
 * words can be a class name, an import or a key, and only the tree says which
 * runs a reader sees. The matching itself is on those runs' text — whitespace
 * folded the way JSX folds it, case ignored and then restored, so "SAMEDI 12
 * MARS" written in capitals gets its new value in capitals too.
 *
 * Two answers keep it honest:
 * - a run the new value cannot be written into safely (a brace in JSX text) is
 *   not touched, and the fact is handed to the model;
 * - after the replacement, the old value is looked for again in the text a
 *   reader would see, with adjacent runs JOINED — `<b>12</b> mars` holds
 *   "12 mars" across two runs, which no single run matches. Found again, the
 *   fact goes to the model as well, for that remaining place.
 */

/** Attributes whose strings are machinery, not words. */
const NOT_TEXT_ATTRS = new Set(['className', 'class', 'style', 'key', 'id', 'ref', 'role', 'type', 'name', 'htmlFor', 'shape', 'preset', 'variant'])

interface TextRun {
  /** Offsets of the editable text in the source, quotes excluded. */
  start: number
  end: number
  kind: 'jsx' | 'string' | 'template'
  /** The quote of a string literal. */
  quote?: string
}

type Transform = (code: string, opts: Record<string, unknown>) => unknown

async function loadTransform(): Promise<Transform | null> {
  const Babel = await import('@babel/standalone')
  const transform = (Babel as any).transform ?? (Babel as any).default?.transform
  return typeof transform === 'function' ? transform : null
}

/** The runs of the source a reader sees as words, in source order. Null when the code does not parse. */
async function textRuns(code: string, transform: Transform): Promise<TextRun[] | null> {
  const runs: TextRun[] = []
  const plugin = () => ({
    visitor: {
      JSXText(path: any) {
        const n = path.node
        if (typeof n.start === 'number' && n.value.trim()) runs.push({ start: n.start, end: n.end, kind: 'jsx' })
      },
      StringLiteral(path: any) {
        const n = path.node
        const parent = path.parent
        if (typeof n.start !== 'number' || !n.value.trim()) return
        // Imports, object keys and machinery attributes are not words.
        if (parent?.type === 'ImportDeclaration' || parent?.type === 'ExportAllDeclaration' || parent?.type === 'ExportNamedDeclaration') return
        if ((parent?.type === 'ObjectProperty' || parent?.type === 'ClassProperty') && parent.key === n) return
        if (parent?.type === 'JSXAttribute' && NOT_TEXT_ATTRS.has(parent.name?.name)) return
        // A string in a call such as classNames('…') or cn('…') is machinery too.
        if (parent?.type === 'CallExpression' && parent.callee?.type === 'Identifier' && /^(cn|clsx|classNames|cx)$/.test(parent.callee.name)) return
        const raw = code.slice(n.start, n.end)
        const quote = raw[0]
        if (quote !== '"' && quote !== "'") return
        runs.push({ start: n.start + 1, end: n.end - 1, kind: 'string', quote })
      },
      TemplateElement(path: any) {
        const n = path.node
        if (typeof n.start === 'number' && n.value?.raw?.trim()) runs.push({ start: n.start, end: n.end, kind: 'template' })
      },
    },
  })
  try {
    transform(code, { plugins: [plugin], parserOpts: { plugins: ['jsx'] }, code: false, filename: 'mocky-campaign.jsx' })
  } catch {
    return null
  }
  return runs.sort((a, b) => a.start - b.start)
}

/**
 * A value as a pattern: escaped, any whitespace run matching any whitespace
 * run, and never inside a longer word — "Mars" the planet is not in "marsupial".
 */
function pattern(value: string): RegExp | null {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return null
  const body = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'giu')
}

/** The new value in the case the old one was written in: all capitals stay capitals. */
function inCaseOf(found: string, next: string): string {
  const letters = found.replace(/[^\p{L}]/gu, '')
  return letters.length > 1 && letters === letters.toUpperCase() && letters !== letters.toLowerCase() ? next.toUpperCase() : next
}

/** The new value escaped for where it goes, or null when it cannot go there safely. */
function escapeFor(run: TextRun, value: string): string | null {
  if (run.kind === 'jsx') return /[{}<>]/.test(value) ? null : value
  if (run.kind === 'string') {
    if (/[\n\r]/.test(value)) return null
    return value.replace(/\\/g, '\\\\').replace(new RegExp(run.quote as string, 'g'), `\\${run.quote}`)
  }
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

/** The words a reader sees, runs joined by a space and whitespace folded. */
function visibleText(code: string, runs: TextRun[]): string {
  return runs.map((r) => code.slice(r.start, r.end)).join(' ').replace(/\s+/g, ' ')
}

export interface FactReplacement {
  from: string
  to: string
}

export interface ReplaceOutcome {
  code: string
  /** Changes written directly, everywhere the piece says them. */
  done: FactReplacement[]
  /** Changes a model has to make: not found as written, or found somewhere a direct write cannot reach. */
  remaining: FactReplacement[]
}

/**
 * Write each change into the source where its old value is a plain run of
 * text. Never throws; code that does not parse comes back untouched with every
 * change left for the model, which reads code it can at least see.
 */
export async function replaceFacts(code: string, changes: FactReplacement[]): Promise<ReplaceOutcome> {
  const done: FactReplacement[] = []
  const remaining: FactReplacement[] = []
  const transform = await loadTransform().catch(() => null)
  if (!transform) return { code, done, remaining: [...changes] }
  let current = code
  for (const change of changes) {
    const re = pattern(change.from)
    // Clearing a fact removes words, which is a layout decision: the model's.
    if (!re || !change.to.trim()) {
      remaining.push(change)
      continue
    }
    const runs = await textRuns(current, transform)
    if (!runs) {
      remaining.push(change)
      continue
    }
    const edits: { start: number; end: number; text: string }[] = []
    let blocked = false
    for (const run of runs) {
      const text = current.slice(run.start, run.end)
      for (const m of text.matchAll(re)) {
        const escaped = escapeFor(run, inCaseOf(m[0], change.to.trim()))
        if (escaped === null) {
          blocked = true
          continue
        }
        const start = run.start + (m.index ?? 0)
        edits.push({ start, end: start + m[0].length, text: escaped })
      }
    }
    let next = current
    for (const e of edits.sort((a, b) => b.start - a.start)) next = next.slice(0, e.start) + e.text + next.slice(e.end)
    // A write that broke the parse is not a write.
    const after = edits.length ? await textRuns(next, transform) : runs
    if (!after) {
      remaining.push(change)
      continue
    }
    if (edits.length) current = next
    // The old value may still be there, across runs or where it could not be
    // written: what the reader sees is checked, the new value taken out first
    // so "Lyon" → "Lyon 3e" does not find "Lyon" in its own answer.
    const toRe = pattern(change.to)
    const seen = visibleText(current, after)
    const left = (pattern(change.from) as RegExp).test(toRe ? seen.replace(toRe, ' ') : seen)
    if (!edits.length || blocked || left) remaining.push(change)
    else done.push(change)
  }
  return { code: current, done, remaining }
}

/** The instruction for the model, for what a direct write could not do. */
export function factEditInstruction(changes: Array<FactReplacement & { label: string }>): string {
  return [
    'Update these facts in the design, everywhere they appear, and change NOTHING else: same layout, same styles, same pictures, same copy around them. If a new value is longer, adjust only the type size or the line breaks of that text so it still fits its block.',
    ...changes.map((c) =>
      c.to.trim()
        ? `- ${c.label}: "${c.from}" becomes "${c.to.trim()}" — written exactly like that, as one run of text.`
        : `- ${c.label}: "${c.from}" is no longer true — remove it, and close the gap it leaves.`,
    ),
  ].join('\n')
}
