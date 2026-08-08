// Image service composition root — wires the paced queue, provider registry
// (driven by the admin config), the global Image Library, and the Express
// router. Nothing generates or probes at import time; the first provider health
// probe happens on the first pick().
import { SpacedQueue } from './queue.js'
import { createProviderRegistry, providersFromConfig, createProvider } from './providers/index.js'
import { sampleSourceImage } from './providers/init.js'
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
 * One queue serialises EVERY profile, so the spacing must satisfy the slowest
 * provider in use: Pollinations' limit is per-IP, and this process has one IP.
 * A profile that resolves to nothing ('edit', unconfigured) contributes no
 * constraint — the `0` seed keeps `Math.max` honest if that ever becomes all of
 * them.
 */
function intervalForConfig(cfg) {
  return Math.max(0, ...IMAGE_PROFILES.map((p) => intervalForProvider(resolveImageProfile(cfg, p)?.provider)))
}

/**
 * @param {object} deps
 * @param {string} deps.dataDir  server/data
 * @param {number} [deps.intervalMs]  force the queue spacing (tests)
 */
export function createImages({ dataDir, intervalMs, budget } = {}) {
  const configStore = new ImagesConfigStore(dataDir)
  const config = configStore.get()

  const queue = new SpacedQueue(intervalMs ?? intervalForConfig(config))
  // One registry per profile: 'content' (hero/produits, fast & cheap),
  // 'inspiration' (the art-direction reference, worth a stronger model) and
  // 'edit' (image-to-image).
  //
  // The edit registry is NULL until an admin configures one, and callers have to
  // read that as "off". Building it from the content profile instead would hand
  // an edit request to a text-to-image provider, which is the one outcome the
  // profile exists to prevent (see resolveImageProfile).
  const registries = {}
  const rebuild = (cfg, p) => {
    const prof = resolveImageProfile(cfg, p)
    registries[p] = prof ? createProviderRegistry(providersFromConfig(prof)) : null
  }
  for (const p of IMAGE_PROFILES) rebuild(config, p)
  const registryFor = (profile) => registries[IMAGE_PROFILES.includes(profile) ? profile : 'content']
  const library = new ImageLibrary(dataDir, { queue })

  /** Re-instantiate providers + re-pace the queue after a config change. */
  function reload() {
    const cfg = configStore.get()
    for (const p of IMAGE_PROFILES) {
      const prof = resolveImageProfile(cfg, p)
      // Keep the registry object when there is one: routes captured `registryFor`
      // but the health cache lives in the registry, and swapping the object would
      // silently drop it.
      if (prof && registries[p]) registries[p].setProviders(providersFromConfig(prof))
      else rebuild(cfg, p)
    }
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
    if (!profileCfg) {
      return {
        ok: false,
        provider: '',
        error:
          "Aucun fournisseur d'édition d'image n'est enregistré sur cette instance. Choisissez-en un et enregistrez avant de tester : contrairement à l'image d'inspiration, ce profil n'emprunte aucune clé au profil de contenu.",
      }
    }
    const id = providerId || profileCfg.provider
    try {
      const provider = createProvider(id, profileCfg)
      const req = {
        prompt: 'a simple round red apple on a plain white background',
        // 1024² is the safe common denominator: several hosted models (Seedream
        // Pro, OpenAI) reject anything smaller.
        width: 1024,
        height: 1024,
      }
      // The edit profile is tested WITH a source image, because a text-to-image
      // call proves nothing about it: it succeeds against a model that cannot
      // edit at all, which is exactly the mistake this button should catch —
      // Cloudflare's default model and fal's schnell endpoint both pass a
      // text-to-image test and both refuse an input image.
      if (profile === 'edit') {
        req.init = sampleSourceImage()
        req.prompt = 'the same picture, repainted as a loose watercolour'
      }
      const out = await provider.generate(req)
      if (!out || out.skipped) return { ok: true, provider: id, skipped: true, bytes: 0 }
      const bytes = out.buffer?.length || 0
      if (!bytes) return { ok: false, provider: id, error: 'The provider returned an empty image.' }
      return { ok: true, provider: id, bytes }
    } catch (err) {
      return { ok: false, provider: id, error: err instanceof Error ? err.message : String(err) }
    }
  }

  const router = createImagesRouter({ library, registryFor, budget })
  return { queue, registries, registryFor, library, router, configStore, reload, testProvider }
}
