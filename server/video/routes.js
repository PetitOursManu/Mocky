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
 * @param {object} deps
 * @param {import('./config.js').VideoConfigStore} deps.config
 * @param {import('./queue.js').VideoQueue} deps.queue
 * @param {ReturnType<import('./worker.js').createVideoWorker>} deps.worker
 * @param {import('../images/library.js').ImageLibrary} deps.imageLibrary
 */
export function createVideoRouter({ config, queue, worker, imageLibrary }) {
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
