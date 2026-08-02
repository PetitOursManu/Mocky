// Video service composition root: provider → library → frames → router.
//
// Kept apart from the image service on purpose. The two look alike from a
// distance and behave nothing alike up close: an image is one call and a few
// hundred kilobytes, a video is a multi-minute job, several megabytes, a second
// binary (ffmpeg) and a per-clip price. Folding it into createImages() would
// have put a conditional in every one of that module's seams.
import { createFal } from '../images/providers/fal.js'
import { ffmpegStatus, resetFfmpegStatus } from './frames.js'
import { VideoLibrary } from './library.js'
import { createVideosRouter } from './routes.js'

/**
 * @param {object} deps
 * @param {string} deps.dataDir
 * @param {import('../images/config.js').ImagesConfigStore} deps.configStore
 * @param {Function} [deps.fetchImpl]  injected for tests
 */
export function createVideos({ dataDir, configStore, fetchImpl, budget } = {}) {
  const library = new VideoLibrary(dataDir)

  /**
   * Can a video be made right now, and if not, exactly what is missing?
   *
   * Two independent things have to be true, and the UI needs to say WHICH one
   * failed: "activez un fournisseur vidéo" and "ffmpeg manque dans l'image"
   * are fixed in completely different places, and a single "indisponible"
   * would send the user hunting.
   */
  async function availability({ force = false } = {}) {
    const cfg = configStore.videoProfile()
    const ff = await ffmpegStatus({ force })
    const hasProvider = Boolean(cfg.provider) && cfg.provider !== 'none'
    const hasKey = cfg.provider === 'fal' ? Boolean(cfg.fal?.apiKey) : false
    return {
      available: hasProvider && hasKey && ff.available,
      provider: cfg.provider || '',
      model: cfg.fal?.model || '',
      ffmpeg: ff,
      // Ordered by what the admin should fix first.
      reason: !hasProvider
        ? 'no-provider'
        : !hasKey
          ? 'no-key'
          : !ff.available
            ? 'no-ffmpeg'
            : null,
    }
  }

  /** Re-probe ffmpeg (the admin may have just installed it) and re-read config. */
  async function recheck() {
    resetFfmpegStatus()
    return availability({ force: true })
  }

  /**
   * Generate (or reuse) one scroll sequence.
   *
   * The cache is consulted BEFORE the provider, not after: the point of a
   * content-addressed store here is not disk space, it is not paying twice for
   * the same clip. Regenerating a screen with an unchanged hero prompt is the
   * common case while iterating.
   *
   * @param {object} spec { prompt, negative?, project?, slot?, seed? }
   */
  async function generate(spec = {}) {
    const prompt = String(spec.prompt || '').trim()
    if (!prompt) throw new Error('A "prompt" is required.')

    const state = await availability()
    if (!state.available) {
      const err = new Error(
        state.reason === 'no-ffmpeg'
          ? "ffmpeg n'est pas disponible dans ce conteneur — la vidéo au défilement ne peut pas être découpée."
          : "Aucun fournisseur vidéo n'est configuré (Admin → Génération d'images → Vidéo).",
      )
      err.code = state.reason
      throw err
    }

    const cfg = configStore.videoProfile()
    const cacheSpec = {
      prompt,
      negative: spec.negative || '',
      provider: cfg.provider,
      model: cfg.fal?.model || '',
      seconds: spec.seconds || '',
    }
    const hit = library.cached(cacheSpec)
    if (hit) return hit

    const provider = createFal({
      apiKey: cfg.fal?.apiKey || '',
      model: cfg.fal?.model || '',
      timeoutMs: (Number(cfg.fal?.timeoutSec) || 600) * 1000,
      fetchImpl,
    })
    const out = await provider.generateVideo({ prompt, negative: spec.negative, seed: spec.seed })

    return library.ingest(
      out.buffer,
      { ...cacheSpec, project: spec.project || '', slot: spec.slot || 'hero' },
      cfg.frames || {},
    )
  }

  const router = createVideosRouter({
    budget,
    library,
    generate,
    availability,
    recheck,
    // Uploads are cut with the same settings as generated clips — read at call
    // time so an admin change applies without a restart.
    frameSettings: () => configStore.videoProfile().frames || {},
  })
  return { library, router, availability, recheck, generate }
}
