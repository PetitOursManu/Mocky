import { describe, it, expect } from 'vitest'
import { CAPABILITIES } from './registry'
import { resolveCapabilities } from './select'
import { buildPrelude } from './prelude'
import { compileJsx } from '../compile'

/**
 * Registry-level invariants (see the "invariants" doc). These are BUILD-time
 * guards — they lock in decisions that broke the preview before. They are
 * additive to prelude.test.ts (atomicity / metadata / React-global collisions).
 */
describe('registry invariants', () => {
  // Invariant 3: NO CDN <script> for JS. A `cdn-css` <link> is the only safe
  // CDN kind. An external JS <script> capability would gate otherwise-valid
  // previews behind a flaky network fetch — this is exactly what the removed
  // `lucide` capability did. Enforce its absence mechanically.
  it('no capability has kind "cdn-script"', () => {
    const offenders = CAPABILITIES.filter((c) => c.kind === 'cdn-script').map((c) => c.id)
    expect(offenders, `cdn-script capabilities are forbidden: ${offenders.join(', ')}`).toEqual([])
  })

  // Generated components run in a scope where React hooks are hoisted onto
  // window. A snippet-pack export that shadows one of those — or a DOM global
  // the generated JSX might plausibly reference by name (Image, Menu, Link, …) —
  // would silently break at runtime. (`Icon` is intentionally NOT here: it is
  // the icons pack's own export; the next test guards its uniqueness.)
  it('no export collides with a React global or a DOM global', () => {
    const RESERVED = new Set([
      // Runtime globals hoisted into the preview iframe / prelude
      'React', 'ReactDOM', 'Babel', 'cn',
      'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useReducer',
      'useContext', 'useLayoutEffect', 'useImperativeHandle', 'useId',
      'useTransition', 'createContext', 'memo', 'forwardRef', 'Fragment',
      // DOM globals whose names read like plausible component names
      'Image', 'Text', 'Menu', 'Link', 'Filter', 'Option', 'Search',
      'Audio', 'Location', 'History',
    ])
    for (const cap of CAPABILITIES) {
      if (cap.kind !== 'snippet-pack' || !cap.snippets) continue
      for (const snippet of cap.snippets) {
        for (const name of snippet.exports) {
          expect(
            RESERVED.has(name),
            `"${name}" (from "${cap.id}") collides with a reserved / DOM global`,
          ).toBe(false)
        }
      }
    }
  })

  // `Icon` is the special namespace injected by the baseline pack; no other
  // pack may export it (that would shadow the icon set at runtime).
  it('only the baseline "icons" pack exports the "Icon" namespace', () => {
    const iconExporters: string[] = []
    for (const cap of CAPABILITIES) {
      if (cap.kind !== 'snippet-pack' || !cap.snippets) continue
      if (cap.snippets.some((s) => s.exports.includes('Icon'))) iconExporters.push(cap.id)
    }
    expect(iconExporters).toEqual(['icons'])
  })

  // Every capability combination a real generation can pick must produce a
  // prelude that is valid JSX Babel can compile — otherwise the screen fails to
  // render before the model's own code even runs. compileJsx is the same
  // compile path capture.ts uses. This is what `npm run smoke` exercises.
  it.each([
    ['baseline', ['icons']],
    ['+charts', ['icons', 'charts']],
    ['+motion', ['icons', 'motion']],
    ['all', ['icons', 'charts', 'motion']],
  ] as const)('prelude compiles for combo: %s', async (_label, ids) => {
    const prelude = buildPrelude(resolveCapabilities([...ids]))
    expect(prelude.length).toBeGreaterThan(0)
    await expect(compileJsx(prelude)).resolves.toBeTypeOf('string')
  })
})
