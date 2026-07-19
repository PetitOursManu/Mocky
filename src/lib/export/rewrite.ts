/**
 * Rewrite a stored screen (which uses IMPLICIT globals — React hooks, Icon,
 * FadeIn, BarChart, cn…) into an explicit-ESM module for the exported project.
 *
 * "Actually used" is determined with a real scope walk (Babel), NOT a regex —
 * invariant 1. The trick: first transform JSX → React.createElement (so every
 * component reference becomes a plain Identifier), then run an analyzer pass
 * whose `ReferencedIdentifier` visitor collects identifiers with no binding in
 * scope. That set, intersected with the known globals, tells us exactly which
 * imports to add. The emitted file keeps the ORIGINAL JSX source (readable);
 * only the import header is prepended.
 *
 * The exported project uses the CLASSIC JSX runtime (see project templates), so
 * `import React` is genuinely used and there are no dangling imports.
 */
import { CAPABILITIES } from '../capabilities/registry'

/** React named exports the preview hoists onto window as bare globals. */
export const REACT_HOOKS = [
  'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useReducer',
  'useContext', 'useLayoutEffect', 'useImperativeHandle', 'useId',
  'useTransition', 'useDeferredValue', 'useSyncExternalStore',
  'createContext', 'memo', 'forwardRef', 'Fragment',
]
const HOOK_SET = new Set(REACT_HOOKS)

/** name → module specifier for every prelude component (built from the registry). */
export const PRELUDE_MODULE: Record<string, string> = { cn: '@/lib/utils' }
for (const cap of CAPABILITIES) {
  if (cap.kind === 'snippet-pack' && cap.snippets) {
    for (const s of cap.snippets) {
      for (const name of s.exports) PRELUDE_MODULE[name] = `@/components/ui/${cap.id}`
    }
  }
}

function stripFences(source: string): string {
  return source
    .replace(/^\s*```[a-zA-Z0-9]*\s*\n?/m, '')
    .replace(/\n?\s*```\s*$/m, '')
    .trim()
}

/**
 * Collect identifiers referenced with NO binding in scope (free variables).
 * Runs on already-JS (non-JSX) source. Never throws — returns an empty set on
 * a parse error so export degrades rather than crashing.
 */
export async function collectFreeIdentifiers(jsCode: string): Promise<Set<string>> {
  const found = new Set<string>()
  try {
    const Babel = await import('@babel/standalone')
    const transform = Babel.transform ?? (Babel as any).default?.transform
    transform(jsCode, {
      code: false,
      ast: false,
      plugins: [
        () => ({
          visitor: {
            ReferencedIdentifier(path: any) {
              const name = path.node.name
              if (!path.scope.hasBinding(name)) found.add(name)
            },
          },
        }),
      ],
    })
  } catch {
    // parse failed — leave `found` empty
  }
  return found
}

/** Turn JSX source into plain JS (classic runtime) so references are analyzable. */
async function toAnalyzableJs(jsx: string): Promise<string> {
  const Babel = await import('@babel/standalone')
  const transform = Babel.transform ?? (Babel as any).default?.transform
  return transform(jsx, { presets: [['react', { runtime: 'classic' }]] }).code as string
}

export interface RewrittenScreen {
  /** The full .tsx module source (import header + original JSX body). */
  source: string
  /** Module specifiers that were imported (for debugging/tests). */
  imports: string[]
}

/**
 * Build the import header for a screen, then return the header + original JSX.
 * `free` is the set of free identifiers found by analysis.
 */
export function buildImportHeader(free: Set<string>): { header: string; imports: string[] } {
  const reactNamed: string[] = []
  const byModule = new Map<string, Set<string>>()
  let needReact = false

  for (const name of free) {
    if (name === 'React') { needReact = true; continue }
    if (HOOK_SET.has(name)) { reactNamed.push(name); continue }
    const mod = PRELUDE_MODULE[name]
    if (mod) {
      if (!byModule.has(mod)) byModule.set(mod, new Set())
      byModule.get(mod)!.add(name)
    }
    // anything else (Math, console, document, …) is a real global — leave it.
  }

  const lines: string[] = []
  const imports: string[] = []
  // React import (classic runtime → React is used).
  if (needReact || reactNamed.length) {
    const named = reactNamed.sort()
    const namedPart = named.length ? `, { ${named.join(', ')} }` : ''
    lines.push(`import React${namedPart} from 'react'`)
    imports.push('react')
  }
  // Prelude imports, sorted for determinism.
  for (const mod of Array.from(byModule.keys()).sort()) {
    const names = Array.from(byModule.get(mod)!).sort()
    lines.push(`import { ${names.join(', ')} } from '${mod}'`)
    imports.push(mod)
  }
  return { header: lines.join('\n'), imports }
}

/**
 * Given a finished .tsx module source (imports + JSX), return any KNOWN global
 * (React, a hook, or a prelude component) that is STILL referenced without a
 * binding — i.e. an implicit global the rewrite failed to import. A correct
 * export yields []. Genuine platform globals (Math, console, …) are ignored.
 */
export async function unresolvedKnownGlobals(fileSource: string): Promise<string[]> {
  const known = new Set<string>([...REACT_HOOKS, 'React', ...Object.keys(PRELUDE_MODULE)])
  let free: Set<string>
  try {
    const js = await toAnalyzableJs(fileSource) // strips JSX; keeps import bindings
    free = await collectFreeIdentifiers(js)
  } catch {
    return []
  }
  return [...free].filter((n) => known.has(n))
}

/** Rewrite one stored screen's code into an explicit-ESM .tsx module. */
export async function rewriteScreenToEsm(code: string): Promise<RewrittenScreen> {
  const jsx = stripFences(code)
  let free: Set<string>
  try {
    const js = await toAnalyzableJs(jsx)
    free = await collectFreeIdentifiers(js)
  } catch {
    free = new Set()
  }
  const { header, imports } = buildImportHeader(free)
  const body = jsx.endsWith('\n') ? jsx : jsx + '\n'
  const source = header ? `${header}\n\n${body}` : body
  return { source, imports }
}
