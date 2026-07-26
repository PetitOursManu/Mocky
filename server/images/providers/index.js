// Provider registry — holds the providers in priority order and picks the first
// HEALTHY one (health is probed once and cached per session, prompt §4.1). The
// last provider is the guaranteed fallback (`none`), so pick() always resolves.
import { createPollinations } from './pollinations.js'
import { createNone } from './none.js'

export function createProviderRegistry(providers, opts = {}) {
  const health = new Map() // id → boolean (cached probe)

  async function probe(p) {
    if (health.has(p.id)) return health.get(p.id)
    let ok = false
    try {
      ok = await p.healthy()
    } catch {
      ok = false
    }
    health.set(p.id, ok)
    return ok
  }

  return {
    /** Public list for the Advanced drawer. */
    list() {
      return providers.map((p) => ({ id: p.id, requiresKey: !!p.requiresKey }))
    },

    get(id) {
      return providers.find((p) => p.id === id) || null
    },

    /** First healthy provider in priority order; falls back to the last one. */
    async pick() {
      for (const p of providers) {
        if (await probe(p)) return p
      }
      return providers[providers.length - 1]
    },

    /** Force a re-probe next time (e.g. after settings change). */
    resetHealth() {
      health.clear()
    },
  }
}

/**
 * Default registry: Pollinations (zero-key) → none. Optional providers
 * (cloudflare-workers-ai, local-comfy) plug in here behind Advanced settings.
 */
export function defaultProviders(opts = {}) {
  return [createPollinations({ token: opts.pollinationsToken }), createNone()]
}
