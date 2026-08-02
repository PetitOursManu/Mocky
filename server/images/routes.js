// Express routes for the image service + Image Library. Mounted at /api/images.
// `express.json()` is applied at the /api level in server/index.js, so req.body
// is parsed for POST /generate.
//
// Route order matters: the literal paths (/providers, /library, /library.zip,
// /generate) are declared BEFORE the `/:hash` catch-all so they aren't captured.
import express from 'express'
// The one bounded body reader in the codebase. Reused rather than rewritten:
// an unbounded read here would let a single request buffer the whole disk into
// memory, which is exactly the bug it was written to close.
import { readRawBody } from '../provider-proxy.js'
import { quotaError } from '../storage-quota.js'

const HASH_RE = /^[a-f0-9]{16,64}$/

/**
 * What an upload may be.
 *
 * An allowlist, not a blocklist: these bytes are served back from Mocky's own
 * origin, so anything the browser might treat as active content (SVG carries
 * script, and `image/svg+xml` is still an image) has no business here.
 */
const ACCEPTED_IMAGE = /^image\/(jpeg|png|webp|gif|avif)$/i
const MAX_IMAGE_BYTES = 15 * 1024 * 1024

/** How many images one "Download all" may put in a single in-memory archive. */
const MAX_ZIP_ENTRIES = 2000

/** Bounds on user-supplied generation parameters. */
const MIN_DIMENSION = 256
const MAX_DIMENSION = 2048
const MAX_PROMPT_LENGTH = 2000

/** Round and clamp a caller-supplied number, falling back when it is not one. */
function clampDimension(value, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(n)))
}

/**
 * @param {object} deps
 * @param {object} deps.library
 * @param {(profile:string)=>object} deps.registryFor  provider registry for an
 *   image profile ('content' | 'inspiration').
 */
export function createImagesRouter({ library, registryFor, budget }) {
  const router = express.Router()

  /** Only two profiles exist; anything unknown is content (the default job). */
  const profileOf = (v) => (v === 'inspiration' ? 'inspiration' : 'content')

  // Available providers + whether each needs a key (Advanced drawer).
  router.get('/providers', (req, res) => {
    res.json({ providers: registryFor(profileOf(req.query.profile)).list() })
  })

  function filtersFromQuery(q) {
    return {
      query: typeof q.q === 'string' ? q.q : undefined,
      project: typeof q.project === 'string' ? q.project : undefined,
      favorites: q.favorites === '1' || q.favorites === 'true',
      slotType: typeof q.slot === 'string' ? q.slot : undefined,
    }
  }

  // Library listing with search/filters.
  router.get('/library', (req, res) => {
    res.json({ images: library.list(filtersFromQuery(req.query)) })
  })

  // "Tout télécharger" — ZIP of the current filtered selection (+ manifest).
  router.get('/library.zip', (req, res) => {
    try {
      const hashes = library.list(filtersFromQuery(req.query)).map((m) => m.hash)
      // The archive is built whole in memory. On a large library that is a
      // multi-gigabyte allocation, and an OOM kill takes the entire instance
      // down — no try/catch saves you from the kernel. A ceiling with a clear
      // message beats a server that dies on a GET.
      if (hashes.length > MAX_ZIP_ENTRIES) {
        return res.status(413).json({
          error: `Too many images to download at once (${hashes.length}, max ${MAX_ZIP_ENTRIES}). Narrow the filter — by project, by favourites, or by search — and download in batches.`,
        })
      }
      const buf = library.zip(hashes)
      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Disposition', 'attachment; filename="mocky-images.zip"')
      res.end(buf)
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  // Generate (or reuse) an image.
  // Body: { prompt, negative?, seed?, width?, height?, tags?, project?, slotType?, providerId?, profile? }
  // `profile` picks WHICH image model runs: 'inspiration' for the art-direction
  // reference, 'content' (default) for pictures embedded in the screen.
  router.post('/generate', async (req, res) => {
    const spec = req.body || {}
    if (!spec.prompt || !String(spec.prompt).trim()) {
      return res.status(400).json({ error: 'A "prompt" is required.' })
    }
    // Admin settings were carefully clamped; the user-facing entry point was
    // not validated at all. `{"width":100000}` went straight to the provider —
    // to a paid one that is a bill, to a local sd-webui a hung GPU — and a
    // multi-megabyte prompt came back as an opaque undici error, not a 400.
    if (String(spec.prompt).length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({ error: `The prompt is too long (max ${MAX_PROMPT_LENGTH} characters).` })
    }
    if (spec.negative != null && String(spec.negative).length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({ error: `The negative prompt is too long (max ${MAX_PROMPT_LENGTH} characters).` })
    }
    if (spec.width != null) spec.width = clampDimension(spec.width, 1024)
    if (spec.height != null) spec.height = clampDimension(spec.height, 1024)
    // A generated image is a few hundred kB, but its size is only known once the
    // provider has been paid. Reserving one typical image keeps the check honest
    // without pretending to know the answer in advance.
    if (budget?.wouldExceed(2 * 1024 * 1024)) {
      return res.status(507).json({ error: quotaError(budget.usage()) })
    }
    try {
      const out = await library.generate(spec, { registry: registryFor(profileOf(spec.profile)) })
      if (out.skipped) return res.json({ skipped: true })
      if (!out.fromCache) budget?.add(library.fileSize?.(out.hash) ?? 0)
      res.json({ hash: out.hash, url: `/api/images/${out.hash}`, fromCache: out.fromCache, meta: out.meta })
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  /**
   * Import the user's own image.
   *
   * The body IS the file — no multipart, no parser dependency. The browser has
   * a File object, `fetch` can send it as-is with its own content type, and
   * everything the server needs to know beyond the bytes (name, dimensions,
   * project) fits in the query string. Multipart would have added a dependency
   * to re-derive exactly this.
   *
   * Body: raw bytes.  Query: ?name=&w=&h=&project=
   */
  router.post('/upload', async (req, res) => {
    const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    if (!ACCEPTED_IMAGE.test(mime)) {
      return res.status(415).json({ error: `Unsupported image type "${mime || 'unknown'}".` })
    }
    try {
      const buffer = await readRawBody(req, MAX_IMAGE_BYTES)
      // Refuse BEFORE writing. A full volume fails its writes silently — every
      // _persist swallows — so the honest place to stop is here.
      if (budget?.wouldExceed(buffer.length)) {
        return res.status(507).json({ error: quotaError(budget.usage()) })
      }
      const out = library.ingestUpload(buffer, {
        name: req.query.name,
        width: req.query.w,
        height: req.query.h,
        project: req.query.project,
        mime,
      })
      // Content-addressed: a re-upload of the same bytes reuses the file on
      // disk, so charging for it would leak quota on every duplicate.
      if (!out.fromCache) budget?.add(buffer.length)
      res.json({ hash: out.hash, url: `/api/images/${out.hash}`, fromCache: out.fromCache, meta: out.meta })
    } catch (err) {
      res.status(err?.statusCode === 413 ? 413 : 400).json({
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })

  // Toggle favorite.
  router.post('/:hash/favorite', (req, res) => {
    if (!HASH_RE.test(req.params.hash)) return res.status(400).json({ error: 'Bad hash' })
    const meta = library.toggleFavorite(req.params.hash)
    if (!meta) return res.status(404).json({ error: 'Not found' })
    res.json({ favorite: meta.favorite })
  })

  // Explicit deletion (the only thing that removes a file — M8). Warns which
  // projects still reference it.
  router.delete('/:hash', (req, res) => {
    if (!HASH_RE.test(req.params.hash)) return res.status(400).json({ error: 'Bad hash' })
    // Measured before the unlink, or there is nothing left to measure.
    const freed = library.fileSize?.(req.params.hash) ?? 0
    const out = library.remove(req.params.hash)
    if (out) budget?.remove(freed)
    if (!out) return res.status(404).json({ error: 'Not found' })
    res.json({ removed: true, wasUsedBy: out.projects })
  })

  // Serve an image from Mocky's own origin (M6). `?download=1` → attachment.
  router.get('/:hash', (req, res) => {
    const { hash } = req.params
    if (!HASH_RE.test(hash)) return res.status(400).json({ error: 'Bad hash' })
    const fp = library.filePath(hash)
    if (!fp || !library.fileExists(hash)) return res.status(404).json({ error: 'Not found' })
    // Generated images are immutable (content-addressed) — cache aggressively.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    if (req.query.download === '1') {
      return res.download(fp, library.filenameFor(hash))
    }
    res.type(library.mimeFor(hash))
    res.sendFile(fp)
  })

  return router
}
