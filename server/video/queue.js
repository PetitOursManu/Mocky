// The render queue: in memory, with a JSON journal on disk.
//
// No Redis, no BullMQ, no worker table — same posture as the rest of the store
// (see "no database, no native dependencies" in the invariants). A self-hosted
// Mocky is one process; a job queue that needs a second daemon to survive a
// restart would cost more to operate than the feature is worth. The journal
// exists for exactly one thing: so a restart can tell the user what happened to
// the render they were watching.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { totalDurationMs } from './timeline.js'

/**
 * The floor under a job's deadline, and what a job of unknown length gets.
 *
 * There is still a ceiling, and it is still a hard one: the thing being waited
 * on is a separate container that may have been killed, be swapping, or be
 * sitting on a socket nobody will ever answer. A job stuck in `rendering`
 * forever is the single most confusing failure this feature can produce — the
 * panel spins, no error is ever shown, and the only cure is a restart the user
 * has no reason to suspect.
 *
 * What changed is the ARITHMETIC behind the number. It used to be a flat 120 s,
 * justified by "120 s matches MAX_TOTAL_DURATION_MS — a render that has taken
 * longer than the video is long is not going to finish". That sentence sounds
 * right and is false: Remotion lays out and paints every frame in a headless
 * browser, so 1080p renders at roughly a QUARTER of real time, not faster than
 * it. Measured on the two-core worker, 6 s of film took 22 s and 30.5 s took
 * 130 s. The old ceiling therefore refused every film longer than about 28 s —
 * accepted by the schema, queued, watched, and then failed on the clock.
 *
 * @see JOB_BUDGET_PER_FILM_MS
 */
export const JOB_TIMEOUT_MS = 120_000

/**
 * Wall-clock allowed per millisecond of finished film, plus a fixed start-up
 * allowance for the bundle, the browser and the encoder flush.
 *
 * 6× against a measured 4.3× is deliberate headroom: the measurement is from
 * one host, and the number that matters is the one a slower machine needs. A
 * film that busts even this is a film that was never going to finish.
 */
export const JOB_BUDGET_PER_FILM_MS = 6
export const JOB_BUDGET_BASE_MS = 45_000

/**
 * The deadline for a film of `totalDurationMs`, never below the old flat value.
 *
 * Never below, because that is what makes this change safe to ship: no render
 * that fits today gets less time than it had. Short films keep a generous
 * budget — most of their cost is start-up, which does not scale with length —
 * and only the long ones, the ones that could not finish at all, get more.
 *
 * The worker computes the same thing ten seconds lower and refuses first, so
 * the side that gives up is the side that can name the machine. That gap is
 * asserted across a sweep of durations by `tests/video-render-budget.test.js`,
 * because the two formulas live in two files that cannot import each other —
 * `worker/` is excluded from Mocky's Docker build context on purpose.
 */
export function jobBudgetMs(totalDurationMs) {
  const film = Math.max(0, Number(totalDurationMs) || 0)
  return Math.max(JOB_TIMEOUT_MS, JOB_BUDGET_BASE_MS + film * JOB_BUDGET_PER_FILM_MS)
}

/** How much history the journal keeps. Bounded because nothing else prunes it. */
export const MAX_JOURNAL_JOBS = 50

/**
 * What a job found mid-flight in the journal is told at boot.
 *
 * Nothing is resumed. The timeline is still there and re-queueing would be one
 * line, but a render the user did not ask for a second time is CPU spent behind
 * their back, and on an instance that crash-loops it is spent on every boot.
 * Saying plainly that it is gone, and leaving the button to them, is the
 * honest degradation (M3).
 */
export const RESTART_ERROR =
  'The server restarted while this render was in the queue, so nothing is working on it any more. Start the export again.'

const LIVE = new Set(['queued', 'rendering'])
const ALL_STATUSES = new Set(['queued', 'rendering', 'done', 'error'])

/** A journal entry we are willing to believe. Anything else is dropped on load. */
function jobShaped(j) {
  return Boolean(j) && typeof j === 'object' && typeof j.id === 'string' && j.id !== '' && ALL_STATUSES.has(j.status)
}

export class VideoQueue {
  /**
   * @param {object} deps
   * @param {string} deps.dataDir              where video-jobs.json lives
   * @param {(job:object, ctx:{signal:AbortSignal})=>Promise<{videoHash?:string|null}>} deps.render
   *   Runs one job. Resolving means done; rejecting means error. The queue does
   *   NOT judge the result — whether a render without a stored file counts as a
   *   success is the composition root's call, not this module's.
   * @param {number} [deps.timeoutMs]  fixed deadline, overriding `jobBudgetMs`. Tests only.
   * @param {()=>number} [deps.now]           injectable clock (tests)
   * @param {()=>string} [deps.newId]         injectable id source (tests)
   */
  constructor({ dataDir, render, timeoutMs = null, now = () => Date.now(), newId } = {}) {
    this.file = path.join(dataDir, 'video-jobs.json')
    this.render = render
    this.timeoutMs = timeoutMs
    this.now = now
    // 12 random bytes, not a counter: a job id is handed to the browser and
    // polled, and GET /jobs/:id answers 403 rather than 404 for someone else's
    // job. A sequential id would turn that distinction into an oracle for how
    // many renders the instance has run and when.
    this.newId = newId || (() => crypto.randomBytes(12).toString('hex'))
    this.running = null
    this.lastPersistError = null
    this._idleWaiters = []

    const { jobs, swept } = this._load()
    this.jobs = jobs
    // Written back only when the sweep actually changed something. A boot that
    // found a clean journal has nothing to say, and rewriting the file on every
    // start is a needless chance to truncate it on a full disk.
    if (swept) this._write()
  }

  // ---- persistence -------------------------------------------------------

  _load() {
    let raw
    try {
      raw = JSON.parse(fs.readFileSync(this.file, 'utf8'))
    } catch {
      // Missing or corrupt: start empty. History is nice to have; refusing to
      // boot over it would take the whole server down for a log file.
      return { jobs: [], swept: false }
    }
    const stored = Array.isArray(raw?.jobs) ? raw.jobs.filter(jobShaped) : []
    let swept = false
    const jobs = stored.map((j) => {
      if (!LIVE.has(j.status)) return j
      swept = true
      return { ...j, status: 'error', finishedAt: j.finishedAt ?? this.now(), error: RESTART_ERROR, videoHash: null }
    })
    return { jobs, swept }
  }

  /** temp + rename, and never throws — a journal is not worth failing a render for. */
  _write() {
    this.lastPersistError = null
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      const tmp = `${this.file}.${crypto.randomBytes(6).toString('hex')}.tmp`
      fs.writeFileSync(tmp, JSON.stringify({ jobs: this.jobs }, null, 2))
      fs.renameSync(tmp, this.file)
    } catch (err) {
      this.lastPersistError = err.message
      console.error(`mocky: could not save the video job journal to ${this.file} — ${err.message}`)
    }
  }

  /**
   * Keep the journal bounded — the newest MAX_JOURNAL_JOBS, and never a job
   * that has not finished.
   *
   * The second half is what makes the first safe. Trimming purely by age would
   * drop a job that is still queued the moment fifty older ones exist, and the
   * user polling it would get a 404 for a render that is about to run. Live jobs
   * are therefore kept unconditionally, which means the real ceiling is
   * "50 finished + however many are in flight"; what bounds THAT is the rate
   * limit on POST /render, not this function.
   */
  _trim() {
    if (this.jobs.length <= MAX_JOURNAL_JOBS) return
    const live = this.jobs.filter((j) => LIVE.has(j.status))
    const finished = this.jobs.filter((j) => !LIVE.has(j.status)).sort((a, b) => b.createdAt - a.createdAt)
    const room = Math.max(0, MAX_JOURNAL_JOBS - live.length)
    const kept = new Set([...live, ...finished.slice(0, room)])
    // Filtered rather than concatenated, so the surviving jobs stay in the order
    // they were created — the journal is read by a person when something breaks.
    this.jobs = this.jobs.filter((j) => kept.has(j))
  }

  // ---- public surface ----------------------------------------------------

  /**
   * @returns the job, by reference: the caller sees its status change.
   *
   * `projectId` is carried rather than looked up later because the render
   * callback is the only thing that will ever know it: the store is
   * content-addressed, so by the time the bytes exist the only link back to
   * where the film was cut is whatever the job wrote down. It is a plain string
   * here — the route bounds it before it arrives.
   */
  enqueue({ userId, timeline, projectId = null }) {
    const job = {
      id: this.newId(),
      userId,
      projectId,
      status: 'queued',
      timeline,
      createdAt: this.now(),
      startedAt: null,
      finishedAt: null,
      error: null,
      videoHash: null,
    }
    this.jobs.push(job)
    this._trim()
    this._write()
    this._pump()
    return job
  }

  get(id) {
    return this.jobs.find((j) => j.id === id) || null
  }

  /**
   * Did this account render these bytes?
   *
   * The queue is the only place that ties a stored file back to a person: the
   * export store is content-addressed, so the hash says what a file contains and
   * nothing about who asked for it. `GET /api/video/:hash` reads this before it
   * reads the disk.
   *
   * It is not the whole answer, and it is not meant to be — `_trim` drops
   * finished jobs past MAX_JOURNAL_JOBS while the file stays on disk, so the
   * store's own `owners` set covers the exports whose job has aged out.
   */
  hasVideo(userId, hash) {
    if (!userId || !hash) return false
    return this.jobs.some((j) => j.userId === userId && j.videoHash === hash)
  }

  /**
   * Resolves when nothing is queued or rendering.
   *
   * Exists for the tests, and stated as such rather than dressed up: a queue
   * whose only observable is a status field can only be tested by polling, and
   * polling tests are the ones that pass on a fast machine and fail in CI.
   */
  whenIdle() {
    if (!this.running && !this.jobs.some((j) => j.status === 'queued')) return Promise.resolve()
    return new Promise((resolve) => this._idleWaiters.push(resolve))
  }

  // ---- the loop ----------------------------------------------------------

  /**
   * Start the next job, if nothing is running.
   *
   * Concurrency is one, deliberately. A Remotion render saturates a core on its
   * own; two of them on the small VPS this is built for do not finish in half
   * the time, they finish in rather more than the same total while both feel
   * broken. One at a time also means the 120 s timeout measures a render rather
   * than a render plus its queueing.
   */
  _pump() {
    if (this.running) return
    const next = this.jobs.find((j) => j.status === 'queued')
    if (!next) {
      const waiters = this._idleWaiters
      this._idleWaiters = []
      for (const resolve of waiters) resolve()
      return
    }
    this.running = next.id
    this._run(next)
  }

  /** Never throws and never rejects: every outcome lands on the job. */
  async _run(job) {
    job.status = 'rendering'
    job.startedAt = this.now()
    this._write()

    // Read off the job's OWN timeline, not off a constructor field: a two-minute
    // film and a three-second one do not cost the same, and a deadline that
    // ignores the difference has to be wrong for one of them. An injected
    // `timeoutMs` OVERRIDES rather than floors it — a test that asks for 20 ms
    // and silently gets two minutes is a test that hangs.
    const budgetMs =
      typeof this.timeoutMs === 'number' ? this.timeoutMs : jobBudgetMs(totalDurationMs(job.timeline))

    const controller = new AbortController()
    let timer = null
    const expiry = new Promise((resolve) => {
      timer = setTimeout(() => resolve({ timedOut: true }), budgetMs)
      // Unref'd: a pending render must not be the reason the process refuses to
      // exit on shutdown.
      timer.unref?.()
    })

    // Wrapped before the race so a `render` that throws synchronously is just a
    // rejection like any other. Racing rather than awaiting is the point: the
    // abort is only a request, and a worker client that ignores it would keep
    // the QUEUE hung even though the job had been marked failed — which is the
    // hang the timeout exists to prevent, moved one level up. Whatever the loser
    // of the race eventually produces is dropped: nothing reads it, and
    // Promise.race has already attached handlers to it, so a late rejection is
    // not an unhandledRejection either.
    const running = Promise.resolve().then(() => this.render(job, { signal: controller.signal }))

    try {
      const outcome = await Promise.race([running.then((value) => ({ value })), expiry])
      if (outcome.timedOut) {
        controller.abort()
        this._finish(job, {
          error: `The render did not finish within ${Math.round(budgetMs / 1000)} seconds and was given up on.`,
        })
      } else {
        const hash = outcome.value?.videoHash
        this._finish(job, { videoHash: typeof hash === 'string' && hash ? hash : null })
      }
    } catch (err) {
      this._finish(job, { error: err instanceof Error ? err.message : String(err) })
    } finally {
      clearTimeout(timer)
      this.running = null
      this._pump()
    }
  }

  _finish(job, { videoHash = null, error = null }) {
    job.status = error ? 'error' : 'done'
    job.finishedAt = this.now()
    job.error = error
    job.videoHash = videoHash
    this._trim()
    this._write()
  }
}
