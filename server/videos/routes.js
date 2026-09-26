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

/** Everyone may do everything: what a router built without an access rule means. */
const OPEN_ACCESS = () => ({ generate: true, stock: true })

export function createVideosRouter({
  library,
  generate,
  availability,
  recheck,
  frameSettings,
  budget,
  stock,
  accessFor = OPEN_ACCESS,
}) {
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

  /**
   * The account's own answer, not the instance's. `access` says what the
   * administrator allows THIS account, and `available` is false for an account
   * that may not generate — so every caller that already reads it (the Muse
   * panel, the generation itself) stops offering a clip it would be refused.
   */
  const personal = (state, user) => {
    const access = accessFor(user)
    return {
      ...state,
      access,
      available: Boolean(state.available) && access.generate,
      reason: access.generate ? state.reason : 'no-access',
    }
  }

  /** A refusal that names what is missing and who can change it. */
  const refuse = (res, what) =>
    res.status(403).json({
      code: 'no-access',
      error:
        what === 'stock'
          ? "Votre compte n'a pas accès aux vidéos libres de droits — un administrateur peut l'ouvrir dans Admin."
          : what === 'generate'
            ? "Votre compte n'a pas accès aux vidéos générées — un administrateur peut l'ouvrir dans Admin."
            : "Votre compte n'a pas accès aux vidéos — un administrateur peut l'ouvrir dans Admin.",
    })

  router.get('/availability', async (req, res) => {
    res.json(personal(await availability(), req.user))
  })

  router.post('/recheck', async (req, res) => {
    res.json(personal(await recheck(), req.user))
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

  /**
   * Free stock footage (see stock.js). Three routes: which libraries are on,
   * one page of results, and importing the clip a person chose.
   *
   * The import is cut exactly like an upload — same ffmpeg check, same quota
   * refused BEFORE writing, same frame settings — because that is what it is:
   * an upload whose download step the server did.
   */
  router.get('/stock/status', async (req, res) => {
    const state = await availability()
    const allowed = accessFor(req.user).stock
    // A library this account may not use is reported as off: the interface
    // hides what it would only be refused.
    const on = stock && allowed ? stock.status() : { pexels: false, pixabay: false }
    res.json({ providers: on, ffmpeg: state.ffmpeg.available, allowed })
  })

  // Query: ?provider=pexels|pixabay&q=&page=
  router.get('/stock/search', async (req, res) => {
    if (!stock) return res.status(503).json({ error: 'Stock footage is not available.' })
    if (!accessFor(req.user).stock) return refuse(res, 'stock')
    try {
      res.json(await stock.search(String(req.query.provider || ''), String(req.query.q || ''), { page: req.query.page }))
    } catch (err) {
      res.status(err?.statusCode || 502).json({ error: err instanceof Error ? err.message : String(err), code: err?.code })
    }
  })

  // Body: { provider, id, project? }
  router.post('/stock/import', async (req, res) => {
    if (!stock) return res.status(503).json({ error: 'Stock footage is not available.' })
    if (!accessFor(req.user).stock) return refuse(res, 'stock')
    const state = await availability()
    if (!state.ffmpeg.available) {
      return res
        .status(503)
        .json({ code: 'no-ffmpeg', error: "ffmpeg n'est pas disponible dans ce conteneur — le clip ne peut pas être découpé." })
    }
    const body = req.body || {}
    try {
      // The byte limit is the upload's, less what the quota can still take:
      // a clip is kept whole AND cut, three times its size on disk.
      const usage = budget?.usage()
      const room = usage?.maxBytes ? Math.floor((usage.maxBytes - usage.bytes) / 3) : Infinity
      const maxBytes = Math.min(MAX_VIDEO_BYTES, room)
      if (maxBytes <= 0) return res.status(507).json({ error: quotaError(usage) })
      const { buffer, spec } = await stock.fetchClip(String(body.provider || ''), body.id, { maxBytes })
      if (budget?.wouldExceed(buffer.length * 3)) {
        return res.status(507).json({ error: quotaError(budget.usage()) })
      }
      const out = await library.ingest(
        buffer,
        { ...spec, project: String(body.project || ''), slot: 'hero', owner: req.user?.id },
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
      res.status(err?.statusCode || 502).json({ error: err instanceof Error ? err.message : String(err), code: err?.code })
    }
  })

  // Body: { prompt, negative?, project?, slot?, seed? }
  router.post('/generate', async (req, res) => {
    // Checked here and not only in the panel: this route is what spends money.
    if (!accessFor(req.user).generate) return refuse(res, 'generate')
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
    // A person's own clip is free to cut, so either kind of access admits it;
    // an account with neither has no video feature to put it in.
    const access = accessFor(req.user)
    if (!access.generate && !access.stock) return refuse(res, 'any')
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
