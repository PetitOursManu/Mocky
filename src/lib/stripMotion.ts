/**
 * Removing raw Motion code the model was never meant to write.
 *
 * WHAT THIS GUARDS
 *
 * The animation vocabulary is a closed list of presets behind `<Animated>`; the
 * model never sees Motion's API and is told, in the capability documentation,
 * that there is no module system in the sandbox. It can still slip — models
 * have memorised `import { motion } from "motion/react"` and `<motion.div>` from
 * the whole internet, and one of those in a generated screen is a hard render
 * failure rather than a degraded one.
 *
 * WHY AN AST AND NOT A REGEX
 *
 * Invariant I1: never regex-parse generated source to decide what it contains.
 * A regex for `motion.` matches inside a string, inside a comment, and inside
 * the word `promotion`; removing an import by line pattern breaks on a
 * multi-line specifier list. Babel already compiles this code — asking it what
 * the code *is* costs one parse and cannot be fooled.
 *
 * WHAT IT DOES, AND WHAT IT DELIBERATELY DOES NOT
 *
 * An offending import is removed. `<motion.div>` becomes `<div>` — the element
 * survives with its children, its className and its content, and simply does
 * not animate. That is the same contract as everywhere else in this feature:
 * degrade to the static version, never to a blank frame.
 *
 * It does not touch `<Animated>`, and it does not touch a component the user
 * legitimately named `Motion`; only the lowercase `motion` namespace the
 * library is known by.
 */

/** Module names that mean "the animation library", in any of its published forms. */
const MOTION_MODULE = /^(motion|framer-motion)(\/.*)?$/

export interface StripResult {
  code: string
  /** Human-readable list of what was removed, for a soft warning. Empty is the normal case. */
  removed: string[]
}

/**
 * Strip raw Motion usage from generated source.
 *
 * Never throws: a file Babel cannot parse is returned untouched, because the
 * compiler downstream will report that syntax error far better than this can,
 * and swallowing the code here would turn a fixable error into an empty screen.
 */
export async function stripForbiddenMotion(source: string): Promise<StripResult> {
  if (!source || !/motion/i.test(source)) return { code: source, removed: [] }

  const removed: string[] = []
  try {
    const Babel = await import('@babel/standalone')
    const transform = Babel.transform ?? Babel.default?.transform
    if (typeof transform !== 'function') return { code: source, removed: [] }

    const plugin = () => ({
      visitor: {
        ImportDeclaration(path: any) {
          const name = String(path.node?.source?.value || '')
          if (!MOTION_MODULE.test(name)) return
          removed.push(`import from "${name}"`)
          path.remove()
        },
        /** `<motion.div>` → `<div>`, opening and closing tag alike. */
        JSXMemberExpression(path: any) {
          const obj = path.node?.object
          if (!obj || obj.type !== 'JSXIdentifier' || obj.name !== 'motion') return
          const tag = String(path.node?.property?.name || 'div')
          removed.push(`<motion.${tag}>`)
          path.replaceWith({ type: 'JSXIdentifier', name: /^[a-z]/.test(tag) ? tag : 'div' })
        },
      },
    })

    const out = transform(source, {
      // Parse only — the caller still gets JSX back, because the preview
      // compiles it itself inside the iframe.
      plugins: [plugin],
      parserOpts: { plugins: ['jsx'] },
      code: true,
      compact: false,
      retainLines: true,
      filename: 'mocky-component.jsx',
    })
    if (!out?.code) return { code: source, removed: [] }
    return { code: removed.length ? out.code : source, removed }
  } catch {
    // Unparseable: leave it exactly as it is and let the real compiler speak.
    return { code: source, removed: [] }
  }
}
