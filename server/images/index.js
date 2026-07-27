// Image service composition root — wires the paced queue, provider registry
// (driven by the admin config), the global Image Library, and the Express
// router. Nothing generates or probes at import time; the first provider health
// probe happens on the first pick().
import { SpacedQueue } from './queue.js'
import { createProviderRegistry, providersFromConfig, createProvider } from './providers/index.js'
import { ImagesConfigStore, IMAGE_PROFILES, resolveImageProfile } from './config.js'
import { ImageLibrary } from './library.js'
import { createImagesRouter } from './routes.js'

// Pollinations' anonymous tier is ≈ 1 req / 15 s and must be paced. Every other
// provider (paid API or the user's own GPU) has no such constraint.
const POLLINATIONS_INTERVAL_MS = 15_000

export function intervalForProvider(id) {
  return id === 'pollinations' ? POLLINATIONS_INTERVAL_MS : 0
}

/**
 * One queue serialises BOTH profiles, so the spacing must satisfy the slowest
 * provider in use: Pollinations' limit is per-IP, and this process has one IP.
 */
function intervalForConfig(cfg) {
  return Math.max(...IMAGE_PROFILES.map((p) => intervalForProvider(resolveImageProfile(cfg, p).provider)))
}

/**
 * @param {object} deps
 * @param {string} deps.dataDir  server/data
 * @param {number} [deps.intervalMs]  force the queue spacing (tests)
 */
export function createImages({ dataDir, intervalMs } = {}) {
  const configStore = new ImagesConfigStore(dataDir)
  const config = configStore.get()

  const queue = new SpacedQueue(intervalMs ?? intervalForConfig(config))
  // One registry per profile: 'content' (hero/produits, fast & cheap) and
  // 'inspiration' (the art-direction reference, worth a stronger model).
  const registries = Object.fromEntries(
    IMAGE_PROFILES.map((p) => [p, createProviderRegistry(providersFromConfig(resolveImageProfile(config, p)))]),
  )
  const registryFor = (profile) => registries[profile === 'inspiration' ? 'inspiration' : 'content']
  const library = new ImageLibrary(dataDir, { queue })

  /** Re-instantiate providers + re-pace the queue after a config change. */
  function reload() {
    const cfg = configStore.get()
    for (const p of IMAGE_PROFILES) registries[p].setProviders(providersFromConfig(resolveImageProfile(cfg, p)))
    if (intervalMs == null) queue.intervalMs = intervalForConfig(cfg)
    return cfg
  }

  /**
   * Admin "test": really generate a small image with the given (or configured)
   * provider, WITHOUT storing it in the library — an honest end-to-end check.
   * Returns { ok, provider, bytes } or { ok:false, error }.
   */
  async function testProvider(providerId, profile = 'content') {
    const profileCfg = resolveImageProfile(configStore.get(), profile)
    const id = providerId || profileCfg.provider
    try {
      const provider = createProvider(id, profileCfg)
      const out = await provider.generate({
        prompt: 'a simple round red apple on a plain white background',
        // 1024² is the safe common denominator: several hosted models (Seedream
        // Pro, OpenAI) reject anything smaller.
        width: 1024,
        height: 1024,
      })
      if (!out || out.skipped) return { ok: true, provider: id, skipped: true, bytes: 0 }
      const bytes = out.buffer?.length || 0
      if (!bytes) return { ok: false, provider: id, error: 'The provider returned an empty image.' }
      return { ok: true, provider: id, bytes }
    } catch (err) {
      return { ok: false, provider: id, error: err instanceof Error ? err.message : String(err) }
    }
  }

  const router = createImagesRouter({ library, registryFor })
  return { queue, registries, registryFor, library, router, configStore, reload, testProvider }
}
