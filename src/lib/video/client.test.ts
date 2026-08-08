import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  BRIEF_MAX_LENGTH,
  POLL_GRACE_MS,
  VideoExportError,
  fetchVideoAccess,
  fetchVideoJob,
  pollDeadlinePassed,
  proposeVideoTimeline,
  requestVariants,
  startVideoRender,
  videoDownloadUrl,
} from './client'
import type { VideoTimelineInput } from './timeline'
import { defaultSettings } from '../settings'

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
    [409, { pendingImageIds: [IMG] }, 'pending-images'],
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

  /**
   * 409 is its own code because it is the one refusal that is not about the
   * timeline: the document is valid and every file is on disk. It means the
   * selection still holds a picture nobody confirmed — the server's guard firing
   * where the panel's two gates did not — and the ids are what let the user find
   * which scene to deal with.
   */
  it('carries the unconfirmed ids, kept apart from the missing ones', async () => {
    vi.stubGlobal('fetch', answer(409, { error: 'awaiting confirmation', pendingImageIds: [IMG] }))
    const err = await startVideoRender(OK_TIMELINE).catch((e) => e)
    expect(err.code).toBe('pending-images')
    expect(err.pendingImageIds).toEqual([IMG])
    expect(err.missingImageIds).toEqual([])
  })

  it('does not choke when the server names ids that are not strings', async () => {
    // It is a network body, not a type. A `null` in that array reached
    // `id.slice(0, 16)` in the banner and took the dialog down through the error
    // boundary — a crash while drawing an error.
    vi.stubGlobal('fetch', answer(409, { error: 'x', pendingImageIds: [IMG, null, 7] }))
    const err = await startVideoRender(OK_TIMELINE).catch((e) => e)
    expect(err.pendingImageIds).toEqual([IMG])
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

describe('proposeVideoTimeline', () => {
  const SETTINGS = { ...defaultSettings(), baseUrl: 'https://models.test', apiKey: 'sk-test', model: 'a-model' }
  const PROPOSAL = { scenes: [{ imageId: IMG, durationMs: 3000, kenBurns: 'zoom-in', transitionOut: 'none', textOverlay: null }], outputFormat: 'mp4', aspectRatio: '16:9' }

  /** Capture what left the browser, and answer with `body`. */
  function spy(status: number, body: unknown) {
    const sent: { url?: string; init?: RequestInit } = {}
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        sent.url = url
        sent.init = init
        return { ok: status >= 200 && status < 300, status, json: async () => body }
      }),
    )
    return sent
  }

  it('sends the brief, the picked ids and the model name in the body', async () => {
    // The ids are the whole world the model is shown: it orders and tunes, it
    // never chooses a picture, and the server refuses an id from outside this
    // list rather than substituting the nearest one.
    const sent = spy(200, { timeline: PROPOSAL, notices: [] })
    await proposeVideoTimeline('a calm slideshow', [IMG], { settings: SETTINGS })
    expect(sent.url).toBe('/api/video/compose')
    expect(JSON.parse(String(sent.init!.body))).toEqual({
      brief: 'a calm slideshow',
      images: [IMG],
      // In the BODY, not only the header: `credsFromReq` reads the body first,
      // and a route that sent just the header is what once left a whole pass
      // reporting "no model configured" on an instance that plainly had one.
      model: 'a-model',
    })
  })

  it('carries the browser’s provider settings, so "bring your own key" works here too', async () => {
    const sent = spy(200, { timeline: PROPOSAL, notices: [] })
    await proposeVideoTimeline('brief', [IMG], { settings: SETTINGS })
    const headers = sent.init!.headers as Record<string, string>
    expect(headers['x-provider-base']).toBe('https://models.test')
    expect(headers['authorization']).toBe('Bearer sk-test')
    // Without the dialect header every browser-configured target is addressed
    // as Ollama, and the four OpenAI-dialect providers in the picker fail here
    // while working everywhere else.
    expect(headers['x-provider-kind']).toBeTruthy()
  })

  it('resolves when nothing was proposed, rather than throwing at the panel', async () => {
    // Q1: a proposal that did not happen is not a request that failed. The user
    // still has the editor they opened the panel with, and a thrown error would
    // draw a red banner over a feature that is working.
    spy(200, { timeline: null, notices: ['No text model is configured.'] })
    const out = await proposeVideoTimeline('brief', [IMG], { settings: SETTINGS })
    expect(out.timeline).toBeNull()
    expect(out.notices).toEqual(['No text model is configured.'])
  })

  it('applies the schema’s defaults to what it hands the form', async () => {
    // The proposal reaches the editor as a parsed document, so a scene the model
    // left half-specified arrives with the same defaults a hand-built one gets.
    spy(200, { timeline: { scenes: [{ imageId: IMG, durationMs: 2000 }] }, notices: [] })
    const out = await proposeVideoTimeline('brief', [IMG], { settings: SETTINGS })
    expect(out.timeline!.scenes[0]).toMatchObject({ kenBurns: 'static', transitionOut: 'crossfade', textOverlay: null })
  })

  it('refuses a timeline this browser’s schema rejects instead of filling the form with it', async () => {
    // The only check that can see the hand-mirrored server schema drift from
    // this one. Without it the form fills with a document /render will refuse,
    // and the refusal arrives later, reading as if the user had composed it.
    //
    // Refused, never repaired: clamping the 99 s scene to 15 s would turn a
    // failed call into a shipped video, which is the exact hole the schema was
    // written to close — the film is not the one that was described, and nobody
    // can tell which one they are looking at.
    spy(200, { timeline: { scenes: [{ imageId: IMG, durationMs: 99000 }] }, notices: [] })
    const out = await proposeVideoTimeline('brief', [IMG], { settings: SETTINGS })
    expect(out.timeline).toBeNull()
    expect(out.notices.join(' ')).toContain('durationMs')
  })

  it.each([
    [403, {}, 'no-access'],
    [400, {}, 'invalid'],
    [404, { missingImageIds: [IMG] }, 'missing-images'],
    [500, {}, 'http'],
  ])('throws on HTTP %i, which is the request being wrong rather than the answer', async (status, body, code) => {
    spy(status as number, { error: 'server said so', ...(body as object) })
    const err = await proposeVideoTimeline('brief', [IMG], { settings: SETTINGS }).catch((e) => e)
    expect(err).toBeInstanceOf(VideoExportError)
    expect(err.code).toBe(code)
  })

  it('lets an abort through untouched, so a cancelled proposal is silent', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw abort }))
    const err = await proposeVideoTimeline('brief', [IMG], { settings: SETTINGS }).catch((e) => e)
    expect(err).toBe(abort)
  })

  it('calls a dead server "offline" here as well', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const err = await proposeVideoTimeline('brief', [IMG], { settings: SETTINGS }).catch((e) => e)
    expect(err.code).toBe('offline')
  })

  it('says something when a 200 carries neither a timeline nor a reason', async () => {
    // The route never answers that shape: every exit with no timeline goes
    // through `refuse()`, which carries a sentence. So this is something in
    // FRONT of it — a reverse proxy's own 200, a build that predates /compose.
    // Passed on as it stood, the button spun, stopped, and changed nothing
    // visible anywhere on the panel. Degrading is allowed (Q1); degrading in
    // silence is the one thing it forbids.
    spy(200, {})
    const out = await proposeVideoTimeline('brief', [IMG], { settings: SETTINGS })
    expect(out.timeline).toBeNull()
    expect(out.notices).toHaveLength(1)
    expect(out.notices[0]).toMatch(/\S/)
  })

  it('counts the refusals it did not print, rather than trimming in silence', async () => {
    // server/video/compose.js says "…and N more" about its own list. A trimmed
    // report that does not say it was trimmed reads as the whole story, which
    // is how four problems become the reason nobody looks for the other two.
    spy(200, {
      timeline: { scenes: Array.from({ length: 6 }, () => ({ imageId: IMG, durationMs: 99000 })) },
      notices: [],
    })
    const out = await proposeVideoTimeline('brief', [IMG], { settings: SETTINGS })
    expect(out.timeline).toBeNull()
    // Four sentences and a tally. Six scenes at 99 s each break the per-scene
    // ceiling six times AND the 120 s total, so there are seven refusals here —
    // which is the point: the count has to come from the list, not from a
    // number somebody typed next to it.
    expect(out.notices).toHaveLength(5)
    expect(out.notices[out.notices.length - 1]).toMatch(/…and 3 more problems/)
  })

  it('bounds the brief at the length the server actually reads', () => {
    // server/video/compose.js SLICES rather than refusing, so a form that let
    // more through would drop the end of a sentence in silence and compose from
    // the rest.
    expect(BRIEF_MAX_LENGTH).toBe(600)
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

describe('requestVariants', () => {
  const batch = { derived: true, images: [{ hash: IMG, url: `/api/images/${IMG}`, axis: 'angle', fromCache: false }], notices: [] }

  it('asks for the image and the count, and hands back what happened', async () => {
    let sent: any = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent = JSON.parse(String(init.body))
        return { ok: true, status: 200, json: async () => batch }
      }),
    )
    const out = await requestVariants(IMG, 4, { project: 'p1' })
    expect(sent).toEqual({ imageId: IMG, count: 4, project: 'p1' })
    expect(out.derived).toBe(true)
    expect(out.images).toHaveLength(1)
  })

  /**
   * The field this whole path exists to publish, and the one place a falsy
   * default would be a lie in the user's favour. A server too old to send it
   * says nothing; `body.derived === true` reads that as "not derived", which is
   * the cautious direction — claiming a derivation nobody performed is the
   * failure this feature was written to prevent.
   */
  it('never reports a derivation the server did not claim', async () => {
    vi.stubGlobal('fetch', answer(200, { images: [], notices: [] }))
    expect((await requestVariants(IMG, 2)).derived).toBe(false)
    vi.stubGlobal('fetch', answer(200, { derived: 'yes', images: [], notices: [] }))
    expect((await requestVariants(IMG, 2)).derived).toBe(false)
  })

  it('keeps a partial batch, because a lost axis is not a lost request', async () => {
    // Q1: one provider hiccup out of six is a degradation, and the notices are
    // the only thing that says which one died.
    vi.stubGlobal('fetch', answer(200, { derived: false, images: [], notices: ['Variante 3 : …', 7] }))
    const out = await requestVariants(IMG, 6)
    expect(out.notices).toEqual(['Variante 3 : …'])
  })

  it.each([
    [403, 'no-access'],
    [400, 'invalid'],
    [404, 'missing-images'],
    [503, 'no-provider'],
    [507, 'quota'],
    [502, 'http'],
  ])('maps HTTP %i onto its own code', async (status, code) => {
    vi.stubGlobal('fetch', answer(status as number, { error: 'server said so' }))
    const err = await requestVariants(IMG, 4).catch((e) => e)
    expect(err.code).toBe(code)
    expect(err.message).toBe('server said so')
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
