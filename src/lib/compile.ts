/**
 * Compile JSX/TS source (the model's component code) into plain JS in the
 * PARENT page. This is used ONLY by the screenshot-capture pipeline
 * (lib/capture.ts): its offscreen capture iframe is same-origin, so injecting
 * already-compiled JS lets it render without shipping Babel (Babel is only
 * fetched there as a fallback if the parent-compiled path fails).
 *
 * The live PREVIEW iframe does NOT use this. It is sandboxed (null origin) and
 * ships its own Babel (public/vendor/babel.min.js), compiling the JSX inside
 * the iframe — see components/Preview.tsx (buildSrcDoc).
 *
 * Returns the compiled code string, or throws on a syntax error.
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
