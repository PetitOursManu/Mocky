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
/*
 * A ceiling on the prompt, and why it is this high.
 *
 * It was 2000, and that was wrong: it sat BELOW Mocky's own traffic. Muse builds
 * an image prompt out of the design dossier — art direction, palette, subject,
 * framing — and a dossier with any substance produces more than two thousand
 * characters. So the guard rejected the application's normal work with a 400 the
 * user only saw as "no image appeared, and none in Media either".
 *
 * The guard is worth keeping. Its purpose was never to have an opinion about
 * prompt length; it was to stop an absurd payload reaching a paid provider,
 * where it used to come back as an opaque undici error rather than an answer.
 * Twenty thousand characters is far above anything Muse writes and far below
 * anything that costs memory, which is the shape a limit like this should have:
 * invisible to real use, closed to the pathological.
 */
const MAX_PROMPT_LENGTH = 20000

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

  /**
   * Which profile a request names. Three of them now, and 'edit' is NOT folded
   * into content.
   *
   * This read "only two profiles exist; anything unknown is content", which was
   * true when it was written and became the one substitution the third profile
   * exists to forbid. `resolveImageProfile` deliberately answers null for an
   * unconfigured 'edit' so that a text-to-image provider can never stand in for
   * an image-to-image one; quietly mapping the name to 'content' one layer above
   * restores exactly that, with the extra sting that the picture is billed to a
   * key the administrator chose for a different job.
   *
   * So the fallback survives only for a name nobody defined, where "content" is
   * the honest reading of a caller who did not choose.
   */
  const profileOf = (v) => (v === 'inspiration' || v === 'edit' ? v : 'content')

  // Available providers + whether each needs a key (Advanced drawer).
  router.get('/providers', (req, res) => {
    const registry = registryFor(profileOf(req.query.profile))
    // An empty list, not a 500. `registryFor('edit')` is null on an instance
    // where image-to-image was never configured, and that is a configuration
    // rather than a fault: "nothing is available here" is the true answer, and
    // it is the shape the Advanced drawer already knows how to draw (Q1).
    res.json({ providers: registry ? registry.list() : [] })
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
  /**
   * Strip `owners` from anything sent to a browser.
   *
   * The field holds account ids, and the library is INSTANCE-WIDE: every
   * signed-in user lists every image. Left in, an ordinary account learns its
   * own id from the `meta` of its first upload, subtracts its own images, and
   * has the global library partitioned by author — who made how many, and which
   * prompts belong together. `publicUser()` in server/index.js deliberately
   * omits `id` for exactly this reason, and only GET /api/admin/users publishes
   * it.
   *
   * Nothing in `src/` reads `owners`: the usage report consumes it server-side
   * through `collectUsage`, which reads the library object directly. So this
   * costs the feature nothing.
   */
  const withoutOwners = (m) => {
    const { owners, ...rest } = m
    return rest
  }

  router.get('/library', (req, res) => {
    res.json({ images: library.list(filtersFromQuery(req.query)).map(withoutOwners) })
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
      return res.status(400).json({
        error: `The prompt is too long: ${String(spec.prompt).length} characters, max ${MAX_PROMPT_LENGTH}.`,
      })
    }
    if (spec.negative != null && String(spec.negative).length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({
        error: `The negative prompt is too long: ${String(spec.negative).length} characters, max ${MAX_PROMPT_LENGTH}.`,
      })
    }
    if (spec.width != null) spec.width = clampDimension(spec.width, 1024)
    if (spec.height != null) spec.height = clampDimension(spec.height, 1024)
    /*
     * Which model runs — resolved here so that "there is none" is an answer
     * rather than a crash.
     *
     * Only the 'edit' profile can come back null, and only on an instance where
     * no image-to-image provider was ever configured. Before this line the null
     * reached `library.generate` and died as a TypeError on `registry.pick`,
     * reported as a 502 naming a provider failure that never happened. 503 says
     * the true thing instead: nothing is wrong with the request, there is simply
     * nothing configured to serve it, and that is an administrator's job.
     */
    const registry = registryFor(profileOf(spec.profile))
    if (!registry) {
      return res.status(503).json({
        error:
          'No provider is configured for the "edit" image profile on this instance. ' +
          'Unlike the inspiration profile, it borrows nothing from the content one.',
      })
    }
    // A generated image is a few hundred kB, but its size is only known once the
    // provider has been paid. Reserving one typical image keeps the check honest
    // without pretending to know the answer in advance.
    if (budget?.wouldExceed(2 * 1024 * 1024)) {
      return res.status(507).json({ error: quotaError(budget.usage()) })
    }
    try {
      // Who asked, taken from the session rather than from the body: the body
      // is the caller's to write, and an attribution anyone can forge is worth
      // less than no attribution at all. `requireUser` guards this router in
      // server/index.js, so it is always there.
      spec.owner = req.user?.id
      /*
       * A caller may ask for its image to arrive unconfirmed, and only that.
       *
       * The multi-step video flow generates its model image through this very
       * route, and the whole point of that step is that nobody has seen the
       * picture yet — so the flag has to be expressible from a browser. Coerced
       * here rather than inherited from the body, because `spec` IS the body:
       * left implicit, a truthy string would have set it and, more to the point,
       * nothing in this file would have said the field was part of the contract.
       *
       * There is no way back through this route. Clearing the flag is
       * POST /:hash/confirm, which checks ownership; `pending: false` in a
       * generate body means nothing and is not read.
       */
      spec.pending = req.body?.pending === true
      const out = await library.generate(spec, { registry })
      if (out.skipped) return res.json({ skipped: true })
      if (!out.fromCache) budget?.add(library.fileSize?.(out.hash) ?? 0)
      res.json({ hash: out.hash, url: `/api/images/${out.hash}`, fromCache: out.fromCache, meta: withoutOwners(out.meta) })
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
        // From the session, never the query string — see the note on generate.
        owner: req.user?.id,
        mime,
      })
      // Content-addressed: a re-upload of the same bytes reuses the file on
      // disk, so charging for it would leak quota on every duplicate.
      if (!out.fromCache) budget?.add(buffer.length)
      res.json({ hash: out.hash, url: `/api/images/${out.hash}`, fromCache: out.fromCache, meta: withoutOwners(out.meta) })
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

  /**
   * "I have seen this one, keep it." Clears the `pending` flag, for good.
   *
   * Ownership, not merely a session, and that is the one refusal worth spelling
   * out. The image library is instance-wide: every signed-in account can list it
   * and every hash in it is reachable by anyone who has the hash. Confirmation
   * is different in kind from favouriting or downloading — it is what makes an
   * image mountable into a film, and it is irreversible — so the account that
   * asked for the picture is the only one entitled to say a human looked at it.
   * Without the check, a second account could confirm a batch of variants the
   * first one was still deciding about, and the first would find its own
   * discards in the montage picker with nothing to explain how they got there.
   *
   * 404 before 403, unlike GET /api/video/:hash. There is no oracle to protect
   * here — an authenticated listing already publishes every non-pending hash on
   * the instance — and the two answers really do send someone to different
   * places: "that image is gone" and "that image is not yours".
   */
  router.post('/:hash/confirm', (req, res) => {
    const { hash } = req.params
    if (!HASH_RE.test(hash)) return res.status(400).json({ error: 'Bad hash' })
    if (!library.get(hash)) return res.status(404).json({ error: 'Not found' })
    if (!library.ownedBy(hash, req.user?.id)) {
      return res.status(403).json({ error: 'This image belongs to another account.' })
    }
    const meta = library.confirm(hash)
    if (!meta) return res.status(404).json({ error: 'Not found' })
    res.json({ confirmed: true, meta: withoutOwners(meta) })
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
    // Readable from an opaque origin. Displaying an <img> never needed this, but
    // the capture shell (src/lib/capture.ts) is sandboxed without
    // allow-same-origin, and a capture engine that inlines a picture by FETCHING its bytes needs it —
    // a cross-origin read, which without this header fails. Not exercised today
    // (the capture frame is same-origin again), kept because it costs nothing
    // and this route is public by design. `*` costs nothing here: this route is
    // already unauthenticated by design (see the note above its mount in
    // server/index.js), so there are no credentials for a wildcard to expose,
    // and a wildcard cannot carry any.
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (req.query.download === '1') {
      return res.download(fp, library.filenameFor(hash))
    }
    res.type(library.mimeFor(hash))
    res.sendFile(fp)
  })

  return router
}
