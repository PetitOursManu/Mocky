import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as Standalone from '@babel/standalone'
import { COMPOSITIONS } from './remotion/composition.js'

/**
 * `render.js` and the two `.jsx` files, checked without Remotion.
 *
 * These are the only modules in the repository that NO test can import:
 * `render.js` pulls in `@remotion/bundler` at the top, and the components are
 * compiled by Remotion's own bundler. Everything around them was carefully made
 * importable for exactly that reason — `validate.js`, `staging.js` and
 * `remotion/composition.js` have no Remotion import precisely so their defects
 * surface here rather than in a container.
 *
 * Which left these three with no floor at all, and the failure they produce is
 * the worst available: the image builds, the container boots, `/health` answers,
 * and every render dies inside a dynamic import with a `ReferenceError` nobody
 * sees except in a log they have to go and find. It nearly happened while
 * extracting the staging module — a `const CODECS` removed with the block above
 * it, still referenced two lines down, and every test in this repository stayed
 * green.
 *
 * A Babel scope walk, not a regular expression, and that is invariant I1 applied
 * to the one place it was missing: an unbound identifier is a question about
 * scope, and only a parser can answer it. The bar is `globalThis` — an
 * identifier that is neither imported, nor declared, nor a real global is a name
 * that does not exist at run time.
 */

const parse = Standalone.packages.parser.parse
const traverse = Standalone.packages.traverse.default || Standalone.packages.traverse

const HERE = path.dirname(fileURLToPath(import.meta.url))
const read = (rel) => fs.readFileSync(path.join(HERE, rel), 'utf8')

/**
 * Names Node provides that are not properties of `globalThis`.
 *
 * `import.meta` is syntax rather than an identifier, so it never appears; these
 * two are the module-scope values a bundler injects. Short and closed on
 * purpose — a growing exception list is how this check stops checking.
 */
const MODULE_GLOBALS = new Set(['require', 'module', 'exports', '__dirname', '__filename'])

/** Every identifier referenced in `source` that nothing binds and nothing defines. */
function unbound(source) {
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] })
  const names = new Set()
  traverse(ast, {
    Program(programPath) {
      // `scope.globals` is Babel's own answer to this question: every reference
      // that resolved to no binding in any enclosing scope.
      for (const name of Object.keys(programPath.scope.globals)) {
        if (MODULE_GLOBALS.has(name)) continue
        if (name in globalThis) continue
        names.add(name)
      }
      programPath.stop()
    },
  })
  return [...names]
}

describe('the modules no test can import', () => {
  it.each([
    'render.js',
    'remotion/Root.jsx',
    'remotion/index.js',
    // One line per composition, and the list grows with the catalogue: these
    // five are the only React in the repository that nothing compiles until a
    // container is already rendering.
    'remotion/ImageSequenceVideo.jsx',
    'remotion/OverlayBandVideo.jsx',
    'remotion/VerticalStoryVideo.jsx',
    'remotion/AnimatedTitlesVideo.jsx',
    'remotion/ProductSpotlightVideo.jsx',
  ])('%s parses and references nothing that does not exist', (file) => {
    expect(unbound(read(file))).toEqual([])
  })

  /**
   * Every composition `COMPOSITIONS` names has a file, and `Root.jsx` registers
   * it.
   *
   * The failure this closes is the one the whole file is about, in its most
   * expensive form: a template accepted by `validate.js`, selected by
   * `compositionIdFor`, and then not found in the bundle — which surfaces as
   * "No composition with the ID … found" after Chromium has already started, in
   * a container log nobody is watching.
   */
  it('registers a component for every composition the catalogue names', () => {
    const root = read('remotion/Root.jsx')
    for (const [template, id] of Object.entries(COMPOSITIONS)) {
      expect(fs.existsSync(path.join(HERE, 'remotion', `${id}.jsx`)), `${template} → ${id}.jsx`).toBe(true)
      expect(root, `${id} is registered in Root.jsx`).toContain(`COMPOSITIONS.${template}`)
      expect(root, `${id} is imported by Root.jsx`).toContain(`from './${id}.jsx'`)
    }
  })

  /**
   * The check has to be able to fail, or it is a green test that verifies
   * nothing. This is the exact shape of the near-miss: a constant deleted with
   * the comment block above it, still used below.
   */
  it('would have caught the constant that was nearly deleted', () => {
    expect(unbound('function codecFor(f) { return CODECS[f] }')).toEqual(['CODECS'])
    expect(unbound("import { a } from 'x'\nexport const b = a + Object.keys({}).length")).toEqual([])
  })
})
