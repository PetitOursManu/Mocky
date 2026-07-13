import { describe, it, expect } from 'vitest'
import { CAPABILITIES, CAPABILITY_MAP } from './registry'
import { resolveCapabilities } from './select'
import { buildPrelude, injectedNames } from './prelude'

/**
 * For every snippet-pack in the registry, assert:
 * 1. exports.length === components.length (metadata matches exports)
 * 2. every name in exports appears in the pack SOURCE string
 * 3. buildPrelude([pack]) contains every name in exports
 * This makes the desync impossible to reintroduce.
 */
describe('snippet-pack atomicity', () => {
  const snippetPacks = CAPABILITIES.filter((c) => c.kind === 'snippet-pack')

  it('there are at least 2 snippet-packs (charts + magicui)', () => {
    expect(snippetPacks.length).toBeGreaterThanOrEqual(2)
  })

  for (const pack of snippetPacks) {
    describe(pack.id, () => {
      const resolved = resolveCapabilities([pack.id])
      const myPack = resolved.find((c) => c.id === pack.id)

      it('has snippets and components defined', () => {
        expect(myPack).toBeDefined()
        expect(myPack!.snippets).toBeDefined()
        expect(myPack!.snippets!.length).toBeGreaterThan(0)
        expect(myPack!.components).toBeDefined()
      })

      it('every name in exports appears in the source string', () => {
        for (const snippet of myPack!.snippets!) {
          for (const name of snippet.exports) {
            expect(
              snippet.source.includes(name),
              `"${name}" is in exports but not found in the source string`,
            ).toBe(true)
          }
        }
      })

      it('every component name is in some snippet exports', () => {
        const allExports = new Set(myPack!.snippets!.flatMap((s) => s.exports))
        for (const comp of myPack!.components!) {
          expect(
            allExports.has(comp.name),
            `component "${comp.name}" has metadata but no snippet exports it`,
          ).toBe(true)
        }
      })

      it('every export name has component metadata', () => {
        const compNames = new Set(myPack!.components!.map((c) => c.name))
        for (const snippet of myPack!.snippets!) {
          for (const name of snippet.exports) {
            expect(
              compNames.has(name),
              `"${name}" is exported but has no component metadata`,
            ).toBe(true)
          }
        }
      })

      it('buildPrelude contains every exported name', () => {
        const prelude = buildPrelude(resolved)
        const injected = injectedNames(resolved)
        for (const snippet of myPack!.snippets!) {
          for (const name of snippet.exports) {
            expect(
              prelude.includes(name),
              `"${name}" not found in buildPrelude output`,
            ).toBe(true)
            expect(
              injected.has(name),
              `"${name}" not in injectedNames set`,
            ).toBe(true)
          }
        }
      })
    })
  }
})

describe('baseline (icons)', () => {
  it('buildPrelude with baseline caps contains var Icon =', () => {
    const iconsCap = resolveCapabilities(['icons'])
    const prelude = buildPrelude(iconsCap)
    expect(prelude).toContain('var Icon =')
    expect(prelude).toContain('Icon.Home')
    expect(prelude).toContain('Icon.Search')
    expect(prelude).toContain('Icon.ChevronLeft')
    expect(prelude).toContain('Icon.MoreHorizontal')
  })

  it('icons is a baseline capability (always selected)', () => {
    expect(CAPABILITY_MAP['icons']?.baseline).toBe(true)
  })
})

describe('no export collisions across snippet-packs', () => {
  const REACT_GLOBALS = [
    'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useReducer',
    'useContext', 'useLayoutEffect', 'useImperativeHandle', 'useId',
    'useTransition', 'createContext', 'memo', 'forwardRef', 'Fragment',
    'React', 'ReactDOM', 'Babel', 'cn',
  ]

  it('no two snippet-packs export the same name', () => {
    const seen = new Map<string, string>() // name -> pack id
    for (const cap of CAPABILITIES) {
      if (cap.kind !== 'snippet-pack' || !cap.snippets) continue
      for (const snippet of cap.snippets) {
        for (const name of snippet.exports) {
          expect(
            seen.has(name),
            `"${name}" is exported by both "${seen.get(name)}" and "${cap.id}"`
          ).toBe(false)
          seen.set(name, cap.id)
        }
      }
    }
  })

  it('no pack export collides with a React hook global or reserved name', () => {
    for (const cap of CAPABILITIES) {
      if (cap.kind !== 'snippet-pack' || !cap.snippets) continue
      for (const snippet of cap.snippets) {
        for (const name of snippet.exports) {
          expect(
            REACT_GLOBALS.includes(name),
            `"${name}" (from "${cap.id}") collides with a React global or reserved name`
          ).toBe(false)
        }
      }
    }
  })
})