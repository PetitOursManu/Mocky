import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { VideoQueue, RESTART_ERROR, MAX_JOURNAL_JOBS } from './queue.js'

let dir
beforeEach(() => {
  dir = path.join(os.tmpdir(), `mocky-vidq-${crypto.randomBytes(6).toString('hex')}`)
  fs.mkdirSync(dir, { recursive: true })
})
afterEach(() => {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
})

const TIMELINE = { scenes: [{ imageId: 'a'.repeat(64), durationMs: 2000 }], outputFormat: 'mp4', aspectRatio: '16:9' }
const journal = () => JSON.parse(fs.readFileSync(path.join(dir, 'video-jobs.json'), 'utf8'))
/** Flush the microtask queue — the render starts one tick after enqueue returns. */
const tick = () => new Promise((r) => setImmediate(r))

function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** A journal entry as it would have been written by a previous process. */
const stored = (over) => ({
  id: 'j',
  userId: 'u1',
  status: 'done',
  timeline: TIMELINE,
  createdAt: 1,
  startedAt: 2,
  finishedAt: 3,
  error: null,
  videoHash: null,
  ...over,
})

describe('running a job', () => {
  it('carries the render result onto the job and journals it', async () => {
    const q = new VideoQueue({ dataDir: dir, render: async () => ({ videoHash: 'f'.repeat(64) }) })
    const job = q.enqueue({ userId: 'u1', timeline: TIMELINE })
    expect(job.status).toBe('rendering')
    await q.whenIdle()
    expect(job.status).toBe('done')
    expect(job.videoHash).toBe('f'.repeat(64))
    expect(job.error).toBe(null)
    expect(job.finishedAt).toBeGreaterThanOrEqual(job.startedAt)
    // The timeline is in the journal: it is what a support question is about.
    expect(journal().jobs[0]).toMatchObject({ id: job.id, status: 'done', timeline: TIMELINE })
  })

  /**
   * A render that produced no stored file is still a render that finished. The
   * queue does not decide what counts as a result — that belongs to whoever
   * wires it — and a queue that failed such a job would make the phase where
   * the worker returns a test video look permanently broken.
   */
  it('does not invent a failure when the render returns no hash', async () => {
    const q = new VideoQueue({ dataDir: dir, render: async () => ({}) })
    const job = q.enqueue({ userId: 'u1', timeline: TIMELINE })
    await q.whenIdle()
    expect(job.status).toBe('done')
    expect(job.videoHash).toBe(null)
  })

  it('records the message when a render throws', async () => {
    const q = new VideoQueue({ dataDir: dir, render: async () => { throw new Error('worker said no') } })
    const job = q.enqueue({ userId: 'u1', timeline: TIMELINE })
    await q.whenIdle()
    expect(job.status).toBe('error')
    expect(job.error).toBe('worker said no')
    expect(job.videoHash).toBe(null)
  })

  it('survives a render that throws synchronously', async () => {
    const q = new VideoQueue({
      dataDir: dir,
      render: () => {
        throw new Error('bad wiring')
      },
    })
    const job = q.enqueue({ userId: 'u1', timeline: TIMELINE })
    await q.whenIdle()
    expect(job.status).toBe('error')
    expect(job.error).toBe('bad wiring')
  })
})

describe('one render at a time', () => {
  /**
   * A Remotion render saturates a core. Two of them on the small VPS this is
   * built for do not halve the wall clock, they double the time both feel
   * broken — so the second job must not start until the first has finished.
   */
  it('leaves the second job queued while the first runs', async () => {
    const gates = [deferred(), deferred()]
    let started = 0
    const q = new VideoQueue({
      dataDir: dir,
      render: async () => {
        const i = started++
        await gates[i].promise
        return { videoHash: `${i}`.repeat(64) }
      },
    })
    const a = q.enqueue({ userId: 'u1', timeline: TIMELINE })
    const b = q.enqueue({ userId: 'u1', timeline: TIMELINE })
    await tick()

    expect(started).toBe(1)
    expect(a.status).toBe('rendering')
    expect(b.status).toBe('queued')

    gates[0].resolve()
    gates[1].resolve()
    await q.whenIdle()
    expect(started).toBe(2)
    expect(a.videoHash).toBe('0'.repeat(64))
    expect(b.videoHash).toBe('1'.repeat(64))
  })
})

describe('the hard timeout', () => {
  it('gives up on a render that never answers, and says so', async () => {
    const q = new VideoQueue({ dataDir: dir, timeoutMs: 10, render: () => new Promise(() => {}) })
    const job = q.enqueue({ userId: 'u1', timeline: TIMELINE })
    await q.whenIdle()
    expect(job.status).toBe('error')
    expect(job.error).toMatch(/did not finish within/)
  })

  it('aborts the signal it handed the render', async () => {
    let aborted = false
    const q = new VideoQueue({
      dataDir: dir,
      timeoutMs: 10,
      render: (_job, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            aborted = true
            reject(new Error('aborted'))
          })
        }),
    })
    q.enqueue({ userId: 'u1', timeline: TIMELINE })
    await q.whenIdle()
    expect(aborted).toBe(true)
  })

  /**
   * The abort is a request, not a guarantee. A client that ignores it must not
   * be able to wedge the queue behind it: a hung job blocking every later render
   * forever is the failure the timeout exists to prevent, and it comes back one
   * level up if the loop awaits the render instead of racing it.
   */
  it('moves on to the next job even though the hung one never returns', async () => {
    const q = new VideoQueue({
      dataDir: dir,
      timeoutMs: 10,
      render: (job) => (job.timeline.tag === 'hang' ? new Promise(() => {}) : Promise.resolve({ videoHash: 'b'.repeat(64) })),
    })
    const hung = q.enqueue({ userId: 'u1', timeline: { ...TIMELINE, tag: 'hang' } })
    const after = q.enqueue({ userId: 'u1', timeline: TIMELINE })
    await q.whenIdle()
    expect(hung.status).toBe('error')
    expect(after.status).toBe('done')
    expect(after.videoHash).toBe('b'.repeat(64))
  })
})

describe('what a restart does to jobs it finds', () => {
  /**
   * A job left in `rendering` by a process that died is the most disorienting
   * failure this feature can produce: the panel spins forever and nothing ever
   * reports an error, because nothing is running.
   */
  it('fails every unfinished job with an explicit reason, and leaves finished ones alone', async () => {
    fs.writeFileSync(
      path.join(dir, 'video-jobs.json'),
      JSON.stringify({
        jobs: [
          stored({ id: 'j1', status: 'rendering', finishedAt: null }),
          stored({ id: 'j2', status: 'queued', startedAt: null, finishedAt: null }),
          stored({ id: 'j3', status: 'done', videoHash: 'c'.repeat(64) }),
          stored({ id: 'j4', status: 'error', error: 'the worker refused' }),
        ],
      }),
    )
    let calls = 0
    const q = new VideoQueue({
      dataDir: dir,
      render: async () => {
        calls++
        return {}
      },
    })

    expect(q.get('j1').status).toBe('error')
    expect(q.get('j1').error).toBe(RESTART_ERROR)
    expect(q.get('j1').finishedAt).toBeTruthy()
    expect(q.get('j2').status).toBe('error')
    expect(q.get('j2').error).toBe(RESTART_ERROR)
    expect(q.get('j3')).toMatchObject({ status: 'done', videoHash: 'c'.repeat(64) })
    expect(q.get('j4')).toMatchObject({ status: 'error', error: 'the worker refused' })

    // Nothing is resumed: a render the user did not ask for again is CPU spent
    // behind their back, and on a crash-looping instance it is spent every boot.
    await tick()
    expect(calls).toBe(0)
  })

  it('persists the sweep, so a second restart sees the same story', () => {
    fs.writeFileSync(path.join(dir, 'video-jobs.json'), JSON.stringify({ jobs: [stored({ id: 'j1', status: 'queued' })] }))
    new VideoQueue({ dataDir: dir, render: async () => ({}) })
    expect(journal().jobs[0]).toMatchObject({ id: 'j1', status: 'error', error: RESTART_ERROR })
    const again = new VideoQueue({ dataDir: dir, render: async () => ({}) })
    expect(again.get('j1').status).toBe('error')
  })

  it('starts empty on a corrupt or missing journal instead of refusing to boot', () => {
    expect(new VideoQueue({ dataDir: dir, render: async () => ({}) }).jobs).toEqual([])
    fs.writeFileSync(path.join(dir, 'video-jobs.json'), '{ not json')
    expect(new VideoQueue({ dataDir: dir, render: async () => ({}) }).jobs).toEqual([])
    fs.writeFileSync(path.join(dir, 'video-jobs.json'), JSON.stringify({ jobs: [{ nope: 1 }, stored({ id: 'ok' })] }))
    const q = new VideoQueue({ dataDir: dir, render: async () => ({}) })
    expect(q.jobs.map((j) => j.id)).toEqual(['ok'])
  })
})

describe('bounds and persistence', () => {
  it(`keeps at most ${MAX_JOURNAL_JOBS} jobs, the most recent`, async () => {
    const old = Array.from({ length: 60 }, (_, i) => stored({ id: `old${i}`, createdAt: 1000 + i }))
    fs.writeFileSync(path.join(dir, 'video-jobs.json'), JSON.stringify({ jobs: old }))
    const q = new VideoQueue({ dataDir: dir, render: async () => ({ videoHash: 'd'.repeat(64) }), now: () => 9999 })
    const fresh = q.enqueue({ userId: 'u1', timeline: TIMELINE })
    await q.whenIdle()

    expect(q.jobs).toHaveLength(MAX_JOURNAL_JOBS)
    expect(q.get(fresh.id)).toBeTruthy()
    expect(q.get('old0')).toBe(null) // the oldest went first
    expect(q.get('old59')).toBeTruthy()
    expect(journal().jobs).toHaveLength(MAX_JOURNAL_JOBS)
    // Still in creation order — the journal is read by a person when something
    // breaks, and a file sorted newest-first reads backwards.
    expect(q.jobs.map((j) => j.createdAt)).toEqual([...q.jobs.map((j) => j.createdAt)].sort((a, b) => a - b))
  })

  /**
   * Trimming purely by age would evict a job that has not run yet the moment
   * fifty older ones exist, and the browser polling it would get a 404 for a
   * render that was about to start.
   */
  it('never evicts a job that has not finished', async () => {
    const q = new VideoQueue({ dataDir: dir, timeoutMs: 5_000, render: () => new Promise(() => {}) })
    for (let i = 0; i < MAX_JOURNAL_JOBS + 5; i++) q.enqueue({ userId: 'u1', timeline: TIMELINE })
    expect(q.jobs).toHaveLength(MAX_JOURNAL_JOBS + 5)
    expect(q.jobs.every((j) => j.status === 'queued' || j.status === 'rendering')).toBe(true)
  })

  it('writes atomically and leaves no temp file behind', async () => {
    const q = new VideoQueue({ dataDir: dir, render: async () => ({ videoHash: 'e'.repeat(64) }) })
    q.enqueue({ userId: 'u1', timeline: TIMELINE })
    await q.whenIdle()
    const files = fs.readdirSync(dir)
    expect(files).toContain('video-jobs.json')
    expect(files.filter((f) => f.endsWith('.tmp'))).toEqual([])
  })

  it('still renders when the journal cannot be written', async () => {
    const asFile = path.join(dir, 'afile')
    fs.writeFileSync(asFile, 'x')
    const q = new VideoQueue({ dataDir: asFile, render: async () => ({ videoHash: '0'.repeat(64) }) })
    const job = q.enqueue({ userId: 'u1', timeline: TIMELINE })
    await q.whenIdle()
    // Degrade, never fail: losing the history is not a reason to lose the render.
    expect(job.status).toBe('done')
    expect(q.lastPersistError).toBeTruthy()
  })

  it('answers null for an id it has never seen', () => {
    expect(new VideoQueue({ dataDir: dir, render: async () => ({}) }).get('nope')).toBe(null)
  })

  /**
   * A job id is handed to the browser and polled, and GET /jobs/:id answers 403
   * rather than 404 for someone else's job. A sequential id would turn that into
   * an oracle for how many renders the instance has run.
   */
  it('gives every job an unguessable id', () => {
    const q = new VideoQueue({ dataDir: dir, render: async () => ({}) })
    const ids = new Set(Array.from({ length: 5 }, () => q.enqueue({ userId: 'u1', timeline: TIMELINE }).id))
    expect(ids.size).toBe(5)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{24}$/)
  })
})
