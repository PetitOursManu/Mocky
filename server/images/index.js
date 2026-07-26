// Image service composition root — wires the paced queue, provider registry, the
// global Image Library, and the Express router. Nothing generates or probes at
// import time; the first provider health probe happens on the first pick().
import { SpacedQueue } from './queue.js'
import { createProviderRegistry, defaultProviders } from './providers/index.js'
import { ImageLibrary } from './library.js'
import { createImagesRouter } from './routes.js'

// Pollinations anonymous tier ≈ 1 req / 15 s.
const POLLINATIONS_INTERVAL_MS = 15_000

/**
 * @param {object} deps
 * @param {string} deps.dataDir  server/data
 * @param {string} [deps.pollinationsToken]  optional token to raise limits
 * @param {number} [deps.intervalMs]  queue spacing (default 15s)
 */
export function createImages({ dataDir, pollinationsToken, intervalMs } = {}) {
  const queue = new SpacedQueue(intervalMs ?? POLLINATIONS_INTERVAL_MS)
  const registry = createProviderRegistry(defaultProviders({ pollinationsToken }))
  const library = new ImageLibrary(dataDir, { queue })
  const router = createImagesRouter({ library, registry })
  return { queue, registry, library, router }
}
