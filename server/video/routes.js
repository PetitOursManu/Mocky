// Express routes for video export. Mounted at /api/video, behind requireUser.
//
// Note the singular: `server/video/` is the export pipeline, `server/videos/` is
// the clip library that feeds scroll sequences into a mockup. They are different
// features that happen to sit one letter apart.
//
// `express.json()` is applied at the /api level in server/index.js, so req.body
// is parsed here.
import express from 'express'
import { VideoTimelineSchema, readableIssues, MAX_SCENES, MAX_TOTAL_DURATION_MS } from './timeline.js'
import { proposeTimeline } from './compose.js'
import { makeLlm, credsFromReq } from '../muse/llm.js'
import { quotaError } from '../storage-quota.js'

const HASH_RE = /^[a-f0-9]{64}$/

/**
 * What a job looks like to the account that owns it.
 *
 * `userId` never leaves the server. `publicUser()` in server/index.js
 * deliberately omits the account id, and the image library strips `owners` from
 * every listing for the same reason; a job document would hand one straight back
 * on the first poll of the first export.
 */
const publicJob = ({ userId, ...rest }) => rest

/**
 * How many ids /compose will even look at.
 *
 * The route runs one `existsSync` per id before anything else happens, so an
 * unbounded array is a few thousand stat() calls for the price of one request.
 * The ceiling is deliberately above MAX_SCENES rather than equal to it: a
 * selection of twenty-five images has no valid timeline, and the composer says
 * so by naming the real count — a cap of twenty would have made that sentence
 * lie.
 */
const MAX_COMPOSE_IMAGES = 100

/**
 * @param {object} deps
 * @param {import('./config.js').VideoConfigStore} deps.config
 * @param {import('./queue.js').VideoQueue} deps.queue
 * @param {ReturnType<import('./worker.js').createVideoWorker>} deps.worker
 * @param {import('../images/library.js').ImageLibrary} deps.imageLibrary
 * @param {import('./store.js').VideoExportStore} [deps.store] where a finished render lands
 * @param {{wouldExceed:(n:number)=>boolean, usage:()=>object}} [deps.budget] the instance disk ceiling
 * @param {(profile:string)=>object|null} [deps.resolveTarget] Admin-configured text
 *   provider, resolved on the 'inspiration' profile like every other structured
 *   server-side call. Absent, /compose falls back to the browser's own credentials.
 */
export function createVideoRouter({ config, queue, worker, imageLibrary, store, budget, resolveTarget }) {
  const router = express.Router()

  /**
   * Can this account export, and is there anything to export with?
   *
   * The worker is only probed for someone who could actually use it. This route
   * is what a panel polls, `health()` spends up to three seconds on a connect,
   * and doing that for every signed-in account on an instance where the feature
   * is off would be three seconds of nothing, repeatedly.
   *
   * No secret appears here, and none can: `publicView()` is the only projection
   * of the config, and the licence key is a boolean in it.
   */
  router.get('/status', async (req, res) => {
    const enabled = config.enabledFor(req.user)
    const workerState = enabled
      ? await worker.health()
      : { available: false, reason: 'no-access', detail: 'Video export is not enabled for this account.' }
    res.json({
      enabled,
      worker: workerState,
      // The UI has to be able to stop a user before they compose a timeline the
      // API will refuse. Quoting the bounds from the schema rather than the
      // panel is what keeps the two from drifting apart.
      limits: { maxScenes: MAX_SCENES, maxTotalDurationMs: MAX_TOTAL_DURATION_MS },
    })
  })

  /**
   * Propose a montage for images the user has ALREADY chosen.
   *
   * The model orders and tunes; it never picks a picture and never writes a
   * frame. `compose.js` holds the reasoning — this route's job is the three
   * things a router owns: who may ask, what a well-formed question is, and where
   * the credentials come from.
   *
   * The refusals mirror /render for the same reasons, in the same order. Access
   * first, so an account without the feature learns nothing about the shape of
   * the request. Then the body. Then the images, checked against the library
   * with `fileExists` rather than a metadata lookup: an id whose bytes are gone
   * would produce a beautiful proposal that fails at the first render.
   *
   * And it answers **200 with `timeline: null`** when nothing usable came back.
   * A proposal that did not happen is not a request that failed — the user still
   * has the manual editor they opened the modal with, and a 4xx there would draw
   * as a broken dialog over a feature that is working (Q1).
   */
  router.post('/compose', async (req, res) => {
    if (!config.enabledFor(req.user)) {
      return res.status(403).json({ error: 'Video export is not enabled for this account.' })
    }

    const brief = typeof req.body?.brief === 'string' ? req.body.brief.trim() : ''
    if (!brief) {
      return res.status(400).json({ error: 'Describe the film you want: a "brief" is required.' })
    }

    /*
     * Ids only, from either spelling — a bare hash or the `{ id }` objects the
     * picker already holds. Deduplicated, because the same image chosen twice is
     * one lookup and one line in the prompt; the model is free to use it in two
     * scenes, and that is a decision about the film, not about the selection.
     */
    const ids = [
      ...new Set(
        (Array.isArray(req.body?.images) ? req.body.images : [])
          .map((img) => (typeof img === 'string' ? img : img && typeof img.id === 'string' ? img.id : null))
          .filter(Boolean),
      ),
    ].slice(0, MAX_COMPOSE_IMAGES)
    if (!ids.length) {
      return res.status(400).json({ error: 'Select at least one image: the montage is built from your selection.' })
    }

    const missing = ids.filter((id) => !imageLibrary.fileExists(id))
    if (missing.length) {
      return res.status(404).json({
        error: `${missing.length} image${missing.length > 1 ? 's are' : ' is'} not in the image library. Nothing was proposed.`,
        missingImageIds: missing,
      })
    }

    /*
     * The descriptions come from the LIBRARY, never from the body.
     *
     * The browser knows them — it just drew them in the picker — but they are
     * what the model reads to decide the order of somebody's film, and the
     * library is the single source of truth for what an image is (M8). Taking
     * them from the request would mean the text steering the montage is text the
     * request supplied about itself. Uploads have a caption too: `ingestUpload`
     * records the file name as the prompt precisely so this field is never empty.
     */
    const images = ids.map((id) => {
      const meta = imageLibrary.get ? imageLibrary.get(id) : null
      return { id, prompt: meta?.prompt || '', width: meta?.width || 0, height: meta?.height || 0 }
    })

    // Credentials exactly as POST /api/muse/quality resolves them: an
    // admin-configured provider wins, otherwise the browser's own headers — and
    // the model name is read from the BODY first, which is the trap that once
    // left the SEO deep pass permanently "unconfigured". See credsFromReq.
    let admin = null
    try {
      admin = resolveTarget ? resolveTarget('inspiration') : null
    } catch {
      admin = null
    }
    const creds = admin ? { ...admin, trusted: true } : credsFromReq(req)
    const llm = creds ? makeLlm(creds) : null

    /*
     * Hang up on the provider when the browser hangs up on us.
     *
     * `proposeTimeline` has taken a `signal` since it was written and `museChat`
     * has always honoured one — nothing was ever passing it. So the panel's
     * Cancel button and closing the modal aborted the browser's fetch and left
     * the model call running to its 40 s ceiling, spending the account's own
     * provider key on an answer with nowhere left to go.
     *
     * On RES, not on req, and that is the whole subtlety. `req.on('close')` is
     * the spelling everyone reaches for — it is what server/provider-proxy.js
     * uses — but since Node 16 an IncomingMessage emits `close` when the request
     * MESSAGE completes, which for a small JSON body is a tick after
     * `express.json()` returns and long before the answer exists. Measured on
     * Node 22: `req.close` arrives with `res.writableEnded === false`, so the
     * obvious guard does not save it and every compose aborts itself. `res`
     * emits `close` once, at the real end: `writableFinished` is true when the
     * answer was delivered and false when the socket went away under it.
     */
    const abort = new AbortController()
    res.on('close', () => {
      if (!res.writableFinished) abort.abort()
    })

    try {
      const { timeline, notices } = await proposeTimeline(brief, images, { llm, signal: abort.signal })
      // Nobody is on the other end any more. Writing to a socket the client
      // closed buys nothing and risks a write-after-end on the way out.
      if (abort.signal.aborted) return
      res.json({ timeline, notices })
    } catch (err) {
      if (abort.signal.aborted) return
      // proposeTimeline is written not to throw. If it ever does, the modal is
      // open and the user's selection is intact; the honest answer is the same
      // shape with nothing in it (Q1).
      res.json({ timeline: null, notices: [err instanceof Error ? err.message : String(err)] })
    }
  })

  /**
   * Queue one render.
   *
   * The order of the three refusals is deliberate. Access first: someone with no
   * right to the feature learns nothing about what a well-formed timeline looks
   * like. Then the schema, because an id check on a document that is not a
   * timeline is meaningless. Then the images.
   */
  router.post('/render', (req, res) => {
    if (!config.enabledFor(req.user)) {
      return res.status(403).json({ error: 'Video export is not enabled for this account.' })
    }

    const parsed = VideoTimelineSchema.safeParse(req.body?.timeline)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'The timeline was refused. Nothing was queued.',
        // The issue list, not `error.message` — that is a JSON dump of the whole
        // tree and reads as a stack trace in a response body. This document is
        // model-written, so the failure being legible is what lets the caller
        // retry with a correction instead of guessing.
        issues: readableIssues(parsed.error),
      })
    }

    /*
     * `parsed.data`, never `req.body.timeline`.
     *
     * The parsed document is the one with defaults applied and unknown keys
     * refused; the raw body is the one somebody wrote. Queueing the raw body
     * would persist, and eventually send to the worker, exactly the fields the
     * schema exists to keep out — and the strictness in timeline.ts is the
     * feature's load-bearing guarantee, not a formality.
     */
    const timeline = parsed.data

    /*
     * Every image has to be on disk, checked here and not only at render time.
     *
     * `fileExists` rather than a metadata lookup: the render reads the file, so
     * an index entry whose bytes are gone is a job that fails minutes later, in
     * the queue, with the user watching a spinner. A 404 naming the ids costs
     * nothing and is the difference between a mistake and a mystery. It is a
     * check and not a guarantee — the file can still be deleted between here and
     * the render, which is why collectImages() checks again.
     */
    const missing = [...new Set(timeline.scenes.map((s) => s.imageId))].filter((id) => !imageLibrary.fileExists(id))
    if (missing.length) {
      return res.status(404).json({
        error: `${missing.length} image${missing.length > 1 ? 's are' : ' is'} not in the image library. Nothing was queued.`,
        missingImageIds: missing,
      })
    }

    /*
     * Is there anywhere to put the result?
     *
     * Last, because it is the only refusal here that is about the instance
     * rather than the request — and the only one whose answer can change while
     * the job waits, which is why the store checks again with the real size
     * before it writes. This one is cheap and asks a blunter question: the
     * volume is ALREADY at its ceiling, so a render that will take minutes of
     * CPU has nowhere to land before it starts. Spending them anyway and failing
     * at the last step is the same wasted wait, with a worse message.
     */
    if (budget?.wouldExceed(0)) {
      return res.status(507).json({ error: quotaError(budget.usage()) })
    }

    const job = queue.enqueue({ userId: req.user.id, timeline })
    // 202: accepted, not done. The body carries the id to poll.
    res.status(202).json(publicJob(job))
  })

  /**
   * One job's status.
   *
   * 403 rather than 404 on someone else's job. A job carries the timeline, and a
   * timeline carries the overlay text somebody wrote — other people's briefs are
   * exactly what the image library refuses to publish, for the same reason. The
   * existence leak the 403 admits is bounded by the id being twelve random
   * bytes: it cannot be enumerated, only replayed by someone who already had it.
   */
  router.get('/jobs/:id', (req, res) => {
    const job = queue.get(req.params.id)
    if (!job) return res.status(404).json({ error: 'No such render job.' })
    if (job.userId !== req.user?.id) {
      return res.status(403).json({ error: 'This render job belongs to another account.' })
    }
    res.json(publicJob(job))
  })

  /**
   * Download one finished render.
   *
   * Declared last, and matched on 64 hex characters: `/status` and `/render`
   * are literals declared above it, so Express reaches them first, but a router
   * whose safety depends on declaration order is one reordering away from
   * serving `/status` as a hash. The regexp is the part that does not move.
   *
   * Ownership is checked BEFORE existence, which is the reverse of the usual
   * shape and deliberate: answering 404 for an unknown hash and 403 for a
   * stranger's would turn this route into an oracle for what other people have
   * exported. Checked in this order it says the same thing either way, and it
   * says something true — a hash you did not render is not yours.
   *
   * Two sources agree on that, for the reason each one is incomplete alone: the
   * job carries the account id (`hasVideo`), and the journal is trimmed to the
   * newest fifty finished jobs; the store's `owners` set is not trimmed but is
   * bounded at twenty accounts per file. Either is enough to say yes.
   */
  router.get('/:hash', (req, res) => {
    const hash = String(req.params.hash)
    const userId = req.user?.id
    const mine = HASH_RE.test(hash) && (queue.hasVideo?.(userId, hash) || store?.ownedBy?.(hash, userId))
    if (!mine) {
      return res.status(403).json({ error: 'This render belongs to another account.' })
    }

    const file = store?.filePath?.(hash)
    if (!file) {
      // Owned, but the bytes are gone: a deletion, a restored volume, a wiped
      // data directory. Saying "no longer" rather than "not found" is the whole
      // difference between a user checking their own history and one filing a
      // bug about a download button that lies.
      return res.status(404).json({ error: 'This render is no longer stored on this instance.' })
    }

    // `private`, never the `Access-Control-Allow-Origin: *` the image and frame
    // routes carry: those paths are deliberately unauthenticated so a
    // null-origin preview can fetch them, and this one is the opposite — it sits
    // behind a session, and a shared cache holding it would hand one account's
    // export to the next request that asked.
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
    res.setHeader('Content-Disposition', `attachment; filename="${store.downloadName(hash)}"`)
    res.type(store.mimeFor(hash) || 'video/mp4')
    res.sendFile(file)
  })

  return router
}

/**
 * Admin settings. Mounted at /api/admin/video behind requireAdmin.
 *
 * A separate router because the mount points differ, not because the concerns
 * do: both halves read the same store, and `publicView()` is the only shape the
 * config is ever allowed to leave the server in — the licence key included, as a
 * boolean.
 */
export function createVideoAdminRouter({ config, worker }) {
  const router = express.Router()

  router.get('/config', (req, res) => {
    res.json(config.publicView())
  })

  /**
   * Probe the worker on the administrator's behalf.
   *
   * /status already reports worker health, but only to an account the feature is
   * enabled FOR — and `videoEnabledFor()` deliberately refuses to grant an admin
   * implicit access, so an admin who has not added themselves to the allowlist
   * reads `no-access` there. That is the wrong answer in the one place the URL
   * is typed: it would have made a working worker look unreachable.
   *
   * `health()` never throws (Q1: failing to CHECK must not look like failing to
   * DO), and a router built without a worker answers the same shape rather than
   * a 500 the panel would draw as a blank status line.
   */
  router.get('/health', async (req, res) => {
    res.json(
      worker?.health
        ? await worker.health()
        : { available: false, reason: 'not-configured', detail: 'No render worker is wired up on this server.' },
    )
  })

  router.put('/config', (req, res) => {
    config.update(req.body || {})
    // The updated view, so the panel shows what was actually stored rather than
    // what it sent: an ignored access mode or a refused worker URL is invisible
    // otherwise, and the admin walks away believing a setting that did not take.
    res.json(config.publicView())
  })

  return router
}
