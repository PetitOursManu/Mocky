// Image service composition root — wires the paced queue, provider registry
// (driven by the admin config), the global Image Library, and the Express
// router. Nothing generates or probes at import time; the first provider health
// probe happens on the first pick().
import { SpacedQueue } from './queue.js'
import { createProviderRegistry, providersFromConfig, createProvider } from './providers/index.js'
import { ImagesConfigStore } from './config.js'
import { ImageLibrary } from './library.js'
import { createImagesRouter } from './routes.js'

// Pollinations' anonymous tier is ≈ 1 req / 15 s and must be paced. Every other
// provider (paid API or the user's own GPU) has no such constraint.
const POLLINATIONS_INTERVAL_MS = 15_000

export function intervalForProvider(id) {
  return id === 'pollinations' ? POLLINATIONS_INTERVAL_MS : 0
}

/**
 * @param {object} deps
 * @param {string} deps.dataDir  server/data
 * @param {number} [deps.intervalMs]  force the queue spacing (tests)
 */
export function createImages({ dataDir, intervalMs } = {}) {
  const configStore = new ImagesConfigStore(dataDir)
  const config = configStore.get()

  const queue = new SpacedQueue(intervalMs ?? intervalForProvider(config.provider))
  const registry = createProviderRegistry(providersFromConfig(config))
  const library = new ImageLibrary(dataDir, { queue })

  /** Re-instantiate providers + re-pace the queue after a config change. */
  function reload() {
    const cfg = configStore.get()
    registry.setProviders(providersFromConfig(cfg))
    if (intervalMs == null) queue.intervalMs = intervalForProvider(cfg.provider)
    return cfg
  }

  /**
   * Admin "test": really generate a small image with the given (or configured)
   * provider, WITHOUT storing it in the library — an honest end-to-end check.
   * Returns { ok, provider, bytes } or { ok:false, error }.
   */
  async function testProvider(providerId) {
    const cfg = configStore.get()
    const id = providerId || cfg.provider
    try {
      const provider = createProvider(id, cfg)
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

  const router = createImagesRouter({ library, registry })
  return { queue, registry, library, router, configStore, reload, testProvider }
}
