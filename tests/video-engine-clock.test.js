import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as Standalone from '@babel/standalone'

/** `ENGINE_ALIASES` in `render.hyperframes.js`, which cannot be imported here (esbuild, the producer). */
const ENGINE_ALIASES_FOR_TEST = {
  'clock.js': 'hyperframes/clock.jsx',
  'clockCanvas.js': 'hyperframes/clockCanvas.jsx',
}

/**
 * The two engines of the video worker reach a composition through one door
 * each — `remotion/clock.js` and `remotion/clockCanvas.js` — and HyperFrames
 * puts its own files behind them at build time.
 *
 * So the doors are a contract, and this is what holds it. A name exported by
 * Remotion's side and missing from HyperFrames' builds under one engine and
 * fails at import under the other, inside a container, after a browser opened.
 * And a composition that imported `remotion` directly would render under
 * Remotion and refuse to bundle under HyperFrames — or, worse, a HyperFrames
 * bundle that reached a Remotion package would carry the licence the second
 * engine exists to do without.
 */

const parse = Standalone.packages.parser.parse
const ROOT = path.resolve(import.meta.dirname, '..')
const REMOTION = path.join(ROOT, 'worker', 'video', 'remotion')
const read = (file) => fs.readFileSync(file, 'utf8')

/** Every name a module exports, read with the parser (I1). */
function exportedNames(file) {
  const ast = parse(read(file), { sourceType: 'module', plugins: ['jsx'] })
  const names = new Set()
  for (const node of ast.program.body) {
    if (node.type !== 'ExportNamedDeclaration') continue
    for (const spec of node.specifiers || []) names.add(spec.exported.name)
    const decl = node.declaration
    if (decl?.id?.name) names.add(decl.id.name)
    for (const d of decl?.declarations || []) if (d.id?.name) names.add(d.id.name)
  }
  return names
}

/** The package every import of a module names. */
function importSources(file) {
  const ast = parse(read(file), { sourceType: 'module', plugins: ['jsx'] })
  return ast.program.body.filter((n) => n.type === 'ImportDeclaration' || (n.type === 'ExportNamedDeclaration' && n.source)).map((n) => n.source.value)
}

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return filesUnder(full)
    return /\.(js|jsx)$/.test(entry.name) && !/\.test\.js$/.test(entry.name) ? [full] : []
  })
}

const isRemotion = (source) => source === 'remotion' || source.startsWith('@remotion/')

describe('the video engine doors', () => {
  it.each(Object.entries(ENGINE_ALIASES_FOR_TEST))('%s has every name its HyperFrames counterpart needs', (door, target) => {
    const wanted = exportedNames(path.join(REMOTION, door))
    const given = exportedNames(path.join(REMOTION, target))
    expect(wanted.size).toBeGreaterThan(0)
    expect([...wanted].filter((name) => !given.has(name))).toEqual([])
  })

  it('lets only the Remotion entry and the two doors import Remotion', () => {
    const allowed = new Set(['Root.jsx', 'index.js', 'clock.js', 'clockCanvas.js'].map((f) => path.join(REMOTION, f)))
    const offenders = filesUnder(REMOTION).filter((file) => !allowed.has(file) && importSources(file).some(isRemotion))
    expect(offenders.map((f) => path.relative(REMOTION, f))).toEqual([])
  })

  it('names the same doors as the HyperFrames bundler swaps', () => {
    const source = read(path.join(ROOT, 'worker', 'video', 'render.hyperframes.js'))
    for (const [door, target] of Object.entries(ENGINE_ALIASES_FOR_TEST)) {
      expect(source).toContain(`path.join(REMOTION_DIR, '${door}')`)
      expect(source).toContain(`path.join(REMOTION_DIR, ${target.split('/').map((p) => `'${p}'`).join(', ')})`)
    }
  })
})
