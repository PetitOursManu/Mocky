import { describe, it, expect } from 'vitest'
import { CAPABILITIES } from './registry'
import { resolveCapabilities } from './select'
import { injectedNames } from './prelude'
import type { Capability } from './types'

/**
 * For every snippet-pack in the registry, assert that every component name
 * advertised in the CAPABILITIES prompt section is also injected by
 * buildPrelude. This makes the desync impossible to reintroduce.
 */
describe('snippet-pack atomicity', () => {
  const snippetPacks = CAPABILITIES.filter((c) => c.kind === 'snippet-pack')

  it('there are at least 2 snippet-packs (magicui + charts)', () => {
    expect(snippetPacks.length).toBeGreaterThanOrEqual(2)
  })

  for (const pack of snippetPacks) {
    describe(pack.id, () => {
      const resolved = resolveCapabilities([pack.id])
      const myPack = resolved.find((c) => c.id === pack.id) as Capability

      it('every component has a non-empty source', () => {
        for (const comp of myPack.components || []) {
          expect(comp.source, `component "${comp.name}" has empty source`).toBeTruthy()
          expect(comp.source.length, `component "${comp.name}" source is empty`).toBeGreaterThan(0)
        }
      })

      it('advertised names === injected names', () => {
        const advertised = new Set((myPack.components || []).map((c) => c.name))
        const injected = injectedNames(resolved)
        for (const name of advertised) {
          expect(injected.has(name), `"${name}" is advertised but NOT injected by buildPrelude`).toBe(true)
        }
        // Injected should not have extra names not in advertised
        for (const name of injected) {
          expect(advertised.has(name), `"${name}" is injected but NOT advertised`).toBe(true)
        }
      })
    })
  }
})