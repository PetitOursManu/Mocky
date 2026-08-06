// Express routes for the video service. Mounted at /api/videos.
//
// Route order matters: the literal paths are declared before anything that
// looks like a hash, exactly as the images router does.
import express from 'express'
import { readRawBody } from '../provider-proxy.js'
import { quotaError } from '../storage-quota.js'

const HASH_RE = /^[a-f0-9]{64}$/

/** Containers ffmpeg reads happily and browsers produce. */
const ACCEPTED_VIDEO = /^video\/(mp4|quicktime|webm|x-matroska)$/i
/** A clip is the heaviest thing this app accepts; still bounded. */
const MAX_VIDEO_BYTES = 200 * 1024 * 1024

/**
 * Which paths a sandboxed preview must be able to fetch WITHOUT a session.
 *
 * Same reasoning as the images router, and the same narrow shape: preview
 * iframes have an opaque origin, so their subresource requests carry no cookie.
 * An authenticated frame URL would leave every scroll sequence blank inside
 * every mockup. The URL is the capability — a 64-hex SHA-256 of the clip's own
 * bytes, unguessable, handed out only by an authenticated generation.
 *
 * Only the picture bytes are public. Metadata, generation and deletion are not.
 */
export const PUBLIC_VIDEO_PATH = /^\/[a-f0-9]{64}\/(poster\.jpg|f\/[0-9]{1,4}\.jpg)$/

export function createVideosRouter({ library, generate, availability, recheck, frameSettings, budget }) {
  const router = express.Router()

  // Immutable, content-addressed: cache for a year. Also readable from any
  // origin: these paths are unauthenticated by design (see their mount in
  // server/index.js), so a wildcard exposes no credentials and can carry none.
  // Nothing needs it today — the capture shell is same-origin again — but a
  // capture engine that inlines pictures by fetching their bytes would, and the
  // header costs nothing to keep.
  const immutable = (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('Access-Control-Allow-Origin', '*')
  }

  router.get('/availability', async (_req, res) => {
    res.json(await availability())
  })

  router.post('/recheck', async (_req, res) => {
    res.json(await recheck())
  })

  /** Account ids never leave the server — see the note in images/routes.js. */
  const withoutOwners = (m) => {
    const { owners, ...rest } = m
    return rest
  }

  router.get('/library', (req, res) => {
    const project = typeof req.query.project === 'string' ? req.query.project : undefined
    res.json({ videos: library.list({ project }).map(withoutOwners) })
  })

  // Body: { prompt, negative?, project?, slot?, seed? }
  router.post('/generate', async (req, res) => {
    try {
      // From the session, not the body: an attribution the caller can write is
      // worth less than none. `requireUser` guards this router.
      const out = await generate({ ...(req.body || {}), owner: req.user?.id })
      res.json({
        hash: out.hash,
        frames: out.meta.frames,
        width: out.meta.width,
        fps: out.meta.fps,
        fromCache: Boolean(out.fromCache),
        base: `/api/videos/${out.hash}`,
        poster: `/api/videos/${out.hash}/poster.jpg`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // A missing provider or a missing binary is a configuration problem, not
      // a provider failure — 503 says "not enabled here", 502 says "the model
      // let us down", and the UI needs to tell them apart.
      const status = err && (err.code === 'no-provider' || err.code === 'no-key' || err.code === 'no-ffmpeg') ? 503 : 502
      res.status(status).json({ error: msg, code: err?.code || undefined })
    }
  })

  /**
   * Import the user's own clip and cut it into a scroll sequence.
   *
   * Needs ffmpeg but NOT a provider: nothing is generated, so no key and no
   * cost. An instance with no fal account can still use this feature entirely,
   * which is worth stating — the availability check the Muse panel does is
   * about GENERATING, and would otherwise hide a path that works.
   *
   * Body: raw bytes.  Query: ?name=&project=
   */
  router.post('/upload', async (req, res) => {
    const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    if (!ACCEPTED_VIDEO.test(mime)) {
      return res.status(415).json({ error: `Unsupported video type "${mime || 'unknown'}".` })
    }
    const state = await availability()
    if (!state.ffmpeg.available) {
      return res
        .status(503)
        .json({ code: 'no-ffmpeg', error: "ffmpeg n'est pas disponible dans ce conteneur — le clip ne peut pas être découpé." })
    }
    try {
      const buffer = await readRawBody(req, MAX_VIDEO_BYTES)
      // A clip is kept whole AND expanded into up to 150 stills, so the disk
      // cost is a multiple of what was uploaded. Three times is the shape
      // observed on real sequences; under-reserving here is how a "within
      // quota" upload still fills the volume.
      // Refuse BEFORE writing. A store that is already full fails its writes
      // silently (every _persist swallows), so the honest place to stop is here.
      if (budget?.wouldExceed(buffer.length * 3)) {
        return res.status(507).json({ error: quotaError(budget.usage()) })
      }
      const out = await library.ingest(
        buffer,
        {
          prompt: String(req.query.name || 'vidéo importée').slice(0, 200),
          provider: 'upload',
          model: '',
          project: req.query.project || '',
          slot: 'hero',
          owner: req.user?.id,
        },
        frameSettings ? frameSettings() : {},
      )
      res.json({
        hash: out.hash,
        frames: out.meta.frames,
        width: out.meta.width,
        fps: out.meta.fps,
        fromCache: Boolean(out.fromCache),
        base: `/api/videos/${out.hash}`,
        poster: `/api/videos/${out.hash}/poster.jpg`,
      })
    } catch (err) {
      res.status(err?.statusCode === 413 ? 413 : 400).json({
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })

  router.get('/:hash/meta', (req, res) => {
    if (!HASH_RE.test(req.params.hash)) return res.status(400).json({ error: 'Bad hash' })
    const meta = library.meta(req.params.hash)
    if (!meta) return res.status(404).json({ error: 'Not found' })
    res.json(meta)
  })

  /*
   * Cut an existing clip again at the current settings.
   *
   * Not in PUBLIC_VIDEO_PATH, so it is behind requireUser like everything that
   * is not picture bytes. It costs ffmpeg time and disk, nothing else: the
   * source has been on disk since ingest, so no provider is called and no money
   * is spent — which is the whole reason this is a button rather than a note in
   * the docs telling people to regenerate.
   */
  router.post('/:hash/recut', async (req, res) => {
    if (!HASH_RE.test(req.params.hash)) return res.status(400).json({ error: 'Bad hash' })
    const before = library.clipSize(req.params.hash)
    if (!before) return res.status(404).json({ error: 'Not found' })

    // A re-cut at a higher rate can multiply what this clip occupies. Charge the
    // budget for the growth it could cause, not for the frames it will replace.
    const settings = frameSettings ? frameSettings() : {}
    if (budget?.wouldExceed(before * 4)) {
      return res.status(507).json({ error: quotaError(budget.usage()) })
    }

    try {
      const out = await library.recut(req.params.hash, settings)
      if (!out) return res.status(404).json({ error: 'Not found' })
      // Signed, because `add` clamps a negative to zero: a re-cut that made the
      // clip SMALLER would otherwise never give the disk back, and the budget
      // would drift upwards a little on every pass.
      const delta = library.clipSize(req.params.hash) - before
      if (delta >= 0) budget?.add?.(delta)
      else budget?.remove?.(-delta)
      res.json({ hash: out.hash, frames: out.meta.frames, width: out.meta.width, fps: out.meta.fps })
    } catch (err) {
      // Nothing was destroyed: recut stages the new sequence and only swaps it
      // in once it is whole, so the clip still plays exactly as it did.
      const code = err?.code === 'NO_SOURCE' ? 409 : err?.code === 'FFMPEG_MISSING' ? 503 : 500
      res.status(code).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  router.delete('/:hash', (req, res) => {
    if (!HASH_RE.test(req.params.hash)) return res.status(400).json({ error: 'Bad hash' })
    const out = library.remove(req.params.hash)
    if (!out) return res.status(404).json({ error: 'Not found' })
    res.json({ removed: true })
  })

  router.get('/:hash/poster.jpg', (req, res) => {
    if (!HASH_RE.test(req.params.hash)) return res.status(400).json({ error: 'Bad hash' })
    const fp = library.posterPath(req.params.hash)
    if (!fp) return res.status(404).json({ error: 'Not found' })
    immutable(res)
    res.type('image/jpeg')
    res.sendFile(fp)
  })

  // One frame of the sequence, 1-based: /f/1.jpg … /f/<frames>.jpg
  //
  // Declared as `:index` and the extension stripped here, rather than as
  // `:index.jpg`: how a path pattern splits on a dot has changed between
  // path-to-regexp majors, and this route is load-bearing for every frame of
  // every sequence. One `replace` is cheaper than depending on that.
  router.get('/:hash/f/:index', (req, res) => {
    if (!HASH_RE.test(req.params.hash)) return res.status(400).json({ error: 'Bad hash' })
    const index = String(req.params.index).replace(/\.jpg$/i, '')
    const fp = library.framePath(req.params.hash, index)
    if (!fp) return res.status(404).json({ error: 'Not found' })
    immutable(res)
    res.type('image/jpeg')
    res.sendFile(fp)
  })

  return router
}
