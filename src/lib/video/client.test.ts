import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  POLL_GRACE_MS,
  VideoExportError,
  fetchVideoAccess,
  fetchVideoJob,
  pollDeadlinePassed,
  startVideoRender,
  videoDownloadUrl,
} from './client'
import type { VideoTimelineInput } from './timeline'

afterEach(() => vi.unstubAllGlobals())

const IMG = 'a'.repeat(64)
const OK_TIMELINE: VideoTimelineInput = { scenes: [{ imageId: IMG, durationMs: 3000 }] }

/** One canned HTTP answer. */
function answer(status: number, body: unknown = {}) {
  return vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }))
}

describe('startVideoRender', () => {
  it('sends the parsed document, defaults applied — never the raw form state', async () => {
    let sent: any = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent = JSON.parse(String(init.body))
        return { ok: true, status: 202, json: async () => ({ id: 'j1', status: 'queued' }) }
      }),
    )
    const job = await startVideoRender(OK_TIMELINE)
    expect(job.id).toBe('j1')
    // The defaults are what make the sent document self-describing: the worker
    // reads `transitionOut`, and a timeline that never spells it out is one the
    // journal cannot be read back from.
    expect(sent.timeline.scenes[0]).toMatchObject({ kenBurns: 'static', transitionOut: 'crossfade', textOverlay: null })
    expect(sent.timeline.outputFormat).toBe('mp4')
  })

  it('refuses a bad timeline before spending a request on it', async () => {
    const fetchSpy = answer(202)
    vi.stubGlobal('fetch', fetchSpy)
    // A control that can express a 20-second scene is a bug in this repository.
    // Catching it at the click, rather than as a 400, is what stops it reading
    // like a server problem.
    const err = await startVideoRender({ scenes: [{ imageId: IMG, durationMs: 20000 }] }).catch((e) => e)
    expect(err).toBeInstanceOf(VideoExportError)
    expect(err.code).toBe('invalid')
    expect(err.issues.length).toBeGreaterThan(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  /**
   * The three refusals the panel has to tell apart. Each one sends the user
   * somewhere different — shorten the film, re-pick the pictures, ask the
   * administrator — and all three arrive as `{ error: "…" }` with nothing but
   * the status to separate them.
   */
  it.each([
    [403, {}, 'no-access'],
    [400, { issues: [{ path: 'scenes', message: 'too long' }] }, 'invalid'],
    [404, { missingImageIds: [IMG] }, 'missing-images'],
    [507, {}, 'quota'],
    [500, {}, 'http'],
  ])('maps HTTP %i onto the code the panel translates', async (status, body, code) => {
    vi.stubGlobal('fetch', answer(status as number, { error: 'server said so', ...(body as object) }))
    const err = await startVideoRender(OK_TIMELINE).catch((e) => e)
    expect(err.code).toBe(code)
    expect(err.status).toBe(status)
    expect(err.message).toBe('server said so')
  })

  it('carries the missing image ids, so the panel can name them', async () => {
    vi.stubGlobal('fetch', answer(404, { error: 'gone', missingImageIds: [IMG] }))
    const err = await startVideoRender(OK_TIMELINE).catch((e) => e)
    expect(err.missingImageIds).toEqual([IMG])
  })

  it('calls a dead server "offline", not "the render failed"', async () => {
    // A TypeError out of fetch means nothing was queued at all. Reported as a
    // render failure it sends the user looking for a bug in their timeline.
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const err = await startVideoRender(OK_TIMELINE).catch((e) => e)
    expect(err.code).toBe('offline')
  })

  it('lets an abort through untouched, so a caller can ignore its own cancellation', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw abort }))
    const err = await startVideoRender(OK_TIMELINE).catch((e) => e)
    expect(err).toBe(abort)
    expect(err).not.toBeInstanceOf(VideoExportError)
  })
})

describe('fetchVideoJob', () => {
  it('returns the job', async () => {
    vi.stubGlobal('fetch', answer(200, { id: 'j1', status: 'done', videoHash: 'ff' }))
    expect((await fetchVideoJob('j1')).status).toBe('done')
  })

  it('distinguishes a forgotten job from someone else’s', async () => {
    // The journal keeps the newest fifty finished jobs, so a 404 here is not an
    // error the user made — it is history that aged out, and it needs different
    // words from "this belongs to another account".
    vi.stubGlobal('fetch', answer(404, { error: 'No such render job.' }))
    expect((await fetchVideoJob('j1').catch((e) => e)).code).toBe('not-found')
    vi.stubGlobal('fetch', answer(403, { error: 'Another account.' }))
    expect((await fetchVideoJob('j1').catch((e) => e)).code).toBe('no-access')
  })

  it('escapes the id it puts in the path', async () => {
    let url = ''
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      url = u
      return { ok: true, status: 200, json: async () => ({}) }
    }))
    await fetchVideoJob('../status')
    expect(url).toBe('/api/video/jobs/..%2Fstatus')
  })
})

describe('fetchVideoAccess', () => {
  it('reads the bounds from the server rather than restating them', async () => {
    // The panel quotes the ceiling next to the total. Quoting the server's copy
    // is what keeps the sentence true after somebody edits the schema.
    vi.stubGlobal('fetch', answer(200, { enabled: true, worker: { available: true }, limits: { maxScenes: 20, maxTotalDurationMs: 120000 } }))
    const access = await fetchVideoAccess()
    expect(access.limits.maxTotalDurationMs).toBe(120000)
  })
})

describe('pollDeadlinePassed', () => {
  const BUDGET = 120_000

  it('never gives up on a job that has not started rendering', () => {
    // Concurrency is one, so a job can sit in the queue behind another for as
    // long as that one takes. A deadline counted from `enqueue` would abandon
    // renders that had not begun — and the file would still arrive, unclaimed.
    expect(pollDeadlinePassed(null, Number.MAX_SAFE_INTEGER, BUDGET)).toBe(false)
  })

  it('waits out the whole render ceiling before saying anything', () => {
    // The server gives up at the ceiling itself and marks the job failed, with
    // a sentence worth more than ours. Firing first would replace it.
    expect(pollDeadlinePassed(0, BUDGET, BUDGET)).toBe(false)
    expect(pollDeadlinePassed(0, BUDGET + POLL_GRACE_MS, BUDGET)).toBe(false)
  })

  it('gives up once the server has had the ceiling plus its grace', () => {
    expect(pollDeadlinePassed(0, BUDGET + POLL_GRACE_MS + 1, BUDGET)).toBe(true)
  })
})

describe('videoDownloadUrl', () => {
  it('is a plain URL, for a plain link', () => {
    expect(videoDownloadUrl('ab12')).toBe('/api/video/ab12')
  })
})
