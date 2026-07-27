// Provider registry — holds the providers in priority order and picks the first
// HEALTHY one (health is probed once and cached per session, prompt §4.1). The
// last provider is always `none`, so pick() can never fail.
//
// The provider list is MUTABLE (`setProviders`) so an admin can switch provider
// at runtime without restarting: the registry object identity stays stable for
// the routes that captured it.
import { createPollinations } from './pollinations.js'
import { createNone } from './none.js'
import { createOpenAiImages } from './openai.js'
import { createCloudflareImages } from './cloudflare.js'
import { createSdWebUi } from './sdwebui.js'
import { createFal } from './fal.js'

export function createProviderRegistry(initialProviders, opts = {}) {
  let providers = initialProviders
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
    /** Public list (id + whether it needs a key). */
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

    /** Swap the provider list (admin changed the configuration). */
    setProviders(next) {
      providers = next
      health.clear()
    },

    /** Force a re-probe next time (e.g. after settings change). */
    resetHealth() {
      health.clear()
    },
  }
}

/** Instantiate one provider by id from the admin config. */
export function createProvider(id, config = {}) {
  switch (id) {
    case 'fal': {
      const f = config.fal || {}
      return createFal({ ...f, timeoutMs: (Number(f.timeoutSec) || 300) * 1000 })
    }
    case 'openai-image':
      return createOpenAiImages(config.openai || {})
    case 'cloudflare-workers-ai':
      return createCloudflareImages(config.cloudflare || {})
    case 'sd-webui':
      return createSdWebUi(config.sdWebui || {})
    case 'none':
      return createNone()
    case 'pollinations':
    default:
      return createPollinations({ token: config.pollinations?.token })
  }
}

/**
 * Build the priority list from the admin config: the selected provider first,
 * then `none` as the guaranteed fallback (so a misconfigured key degrades to
 * placeholders instead of breaking a Muse run — M3).
 */
export function providersFromConfig(config = {}) {
  const id = config.provider || 'pollinations'
  if (id === 'none') return [createNone()]
  return [createProvider(id, config), createNone()]
}

/** Legacy/default list used when no admin config exists yet. */
export function defaultProviders(opts = {}) {
  return [createPollinations({ token: opts.pollinationsToken }), createNone()]
}
