/**
 * Compile JSX/TS source (the model's component code) into plain JS, once, in
 * the parent page. The result is injected into the sandboxed preview iframe so
 * it does NOT need to ship Babel (~3 MB) — the iframe only runs the compiled JS.
 *
 * Babel is imported dynamically so it stays out of the initial bundle and is
 * only fetched the first time a screen is rendered. Returns the compiled code
 * string, or throws on a syntax error.
 *
 * Note: `@babel/standalone` is a CommonJS module that exports `transform` as a
 * named export (no default export), so we use a namespace import.
 */
export async function compileJsx(source: string): Promise<string> {
  const cleaned = source
    .replace(/^\s*```[a-zA-Z0-9]*\s*\n?/m, '')
    .replace(/\n?\s*```\s*$/m, '')
    .trim()
  if (!cleaned) throw new Error('Empty component source')
  const Babel = await import('@babel/standalone')
  const transform = Babel.transform ?? Babel.default?.transform
  if (typeof transform !== 'function') throw new Error('Babel.transform is not available')
  return transform(cleaned, {
    presets: [['react', { runtime: 'classic' }]],
    filename: 'mocky-component.jsx',
  }).code as string
}