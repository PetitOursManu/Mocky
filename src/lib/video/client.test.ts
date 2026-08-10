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
  videoStreamUrl,
  listVideoExports,
  deleteVideoExport,
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
    expect(sent.timeline.scenes[0]).toMatchObject({ kenBurns: 'zoom-in', transitionOut: 'crossfade', textOverlay: null })
    expect(sent.timeline.outputFormat).toBe('mp4')
  })

  /**
   * The defect: a film nothing could find.
   *
   * `projectId` beside the timeline is the only link between a finished export
   * and where it was cut, because the store is content-addressed — the hash says
   * what the file contains and nothing about who wanted it. Beside and never
   * inside: the schema is `.strict()`, so a field the worker does not render
   * cannot be in the document at all.
   */
  it('sends the project beside the timeline, never inside it', async () => {
    let sent: any = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent = JSON.parse(String(init.body))
        return { ok: true, status: 202, json: async () => ({ id: 'j1', status: 'queued' }) }
      }),
    )
    await startVideoRender(OK_TIMELINE, { project: 'p-42' })
    expect(sent.projectId).toBe('p-42')
    expect(sent.timeline.projectId).toBeUndefined()
  })

  /**
   * The theme travels beside the timeline too, and for a different reason.
   *
   * The look IS rendered — unlike the project id, which is an attribution — but
   * a composed document may not contain it: `VideoTimelineSchema` has no
   * `theme`, precisely so that a model which writes one is refused like any
   * unknown key. The server attaches it afterwards, to the document it sends the
   * worker. Sent inside, this request would be a 400.
   */
  it('sends the theme beside the timeline, never inside it', async () => {
    let sent: any = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent = JSON.parse(String(init.body))
        return { ok: true, status: 202, json: async () => ({ id: 'j1', status: 'queued' }) }
      }),
    )
    await startVideoRender(OK_TIMELINE, { theme: { colors: { accent: '#c0392b' } } })
    expect(sent.theme).toEqual({ colors: { accent: '#c0392b' } })
    expect(sent.timeline.theme).toBeUndefined()
  })

  // A project with no direction sends no theme at all, rather than an empty one:
  // "there is no direction" and "a direction asking for nothing" are different
  // facts, and the schema refuses the second.
  it('omits the theme entirely when the project has no direction', async () => {
    let sent: any = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent = JSON.parse(String(init.body))
        return { ok: true, status: 202, json: async () => ({ id: 'j1', status: 'queued' }) }
      }),
    )
    await startVideoRender(OK_TIMELINE, { theme: null })
    expect('theme' in sent).toBe(false)
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

  /**
   * The route answers 403 for two unrelated things, and the block list is what
   * separates them.
   *
   * "Motion is not enabled for this account" and "this film is drawn in 3D and
   * this account may not spend one" point at two different settings and two
   * different sentences. Discriminating on the English message is how a branch
   * nobody exercises stops working in silence, so this reads `threeDBlocks` —
   * which the route sends beside its message for exactly this purpose.
   */
  it('tells a 3D refusal apart from a Motion one, on the field and not the sentence', async () => {
    vi.stubGlobal('fetch', answer(403, { error: 'This film is composed with solidScene…', threeDBlocks: ['solidScene'] }))
    const err = await startVideoRender(OK_TIMELINE).catch((e) => e)
    expect(err.code).toBe('three-d')
    expect(err.threeDBlocks).toEqual(['solidScene'])
    // And the plain permission refusal is untouched: an empty list is not a 3D
    // refusal with nothing in it, it is the other 403.
    vi.stubGlobal('fetch', answer(403, { error: 'Not enabled.', threeDBlocks: [] }))
    expect((await startVideoRender(OK_TIMELINE).catch((e) => e)).code).toBe('no-access')
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
    // The ids are the whole world the model is shown: it picks the film, it
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

  /**
   * The 3D button is an ambition, and it travels only when it was pressed.
   *
   * Absent rather than `false` for the reason `template` is: the route reads
   * `=== true`, and a body that carries only what was asked for is one an older
   * server ignores rather than misreads. The assertion above — which compares
   * the whole body — is what would catch a `false` creeping in.
   */
  it('sends the 3D flag only when the button was down', async () => {
    const off = spy(200, { timeline: PROPOSAL, notices: [] })
    await proposeVideoTimeline('brief', [IMG], { settings: SETTINGS })
    expect(JSON.parse(String(off.init!.body))).not.toHaveProperty('forceThreeD')

    const on = spy(200, { timeline: PROPOSAL, notices: [] })
    await proposeVideoTimeline('brief', [IMG], { settings: SETTINGS, forceThreeD: true })
    expect(JSON.parse(String(on.init!.body)).forceThreeD).toBe(true)
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
    expect(out.timeline!.scenes[0]).toMatchObject({ kenBurns: 'zoom-in', transitionOut: 'crossfade', textOverlay: null })
  })

  /**
   * The composer's answer comes back with the project's direction already on
   * it: the server attaches the theme once the model's document has been
   * validated. Parsed here with `VideoTimelineSchema` — which has no `theme`,
   * deliberately, so that a MODEL cannot write one — every themed proposal was
   * refused for an unrecognised key the server itself had put there.
   */
  it('accepts the theme the server attached, rather than refusing its own key', async () => {
    const theme = { colors: { accent: '#c0392b' } }
    spy(200, { timeline: { ...PROPOSAL, theme }, notices: [] })
    const out = await proposeVideoTimeline('brief', [IMG], { settings: SETTINGS })
    expect(out.timeline).not.toBeNull()
    expect(out.notices).toEqual([])
  })

  it('sends the project’s direction so the server has one to attach', async () => {
    const theme = { colors: { accent: '#c0392b' } }
    const sent = spy(200, { timeline: { ...PROPOSAL, theme }, notices: [] })
    await proposeVideoTimeline('brief', [IMG], { settings: SETTINGS, theme })
    // Beside the brief and never inside the timeline: the model is not shown it
    // and may not write it, and the server is the only party that attaches it.
    expect(JSON.parse(String(sent.init!.body)).theme).toEqual(theme)
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
    expect(videoDownloadUrl('ab12')).toBe('/api/video/ab12?download=1')
  })

  /**
   * The defect: one URL for both jobs. Reusing the download link as a `<video
   * src>` asks the server to answer `Content-Disposition: attachment`, which is
   * an instruction to save the file rather than play it — and the Media tab's
   * play button would have put the film in the downloads folder.
   */
  it('is not the same URL the player uses', () => {
    expect(videoStreamUrl('ab12')).toBe('/api/video/ab12')
    expect(videoStreamUrl('ab12')).not.toBe(videoDownloadUrl('ab12'))
  })
})

describe('listVideoExports', () => {
  it('asks for the project when there is one, and for everything when there is not', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        return { ok: true, status: 200, json: async () => ({ videos: [] }) }
      }),
    )
    await listVideoExports()
    await listVideoExports({ project: 'p 1/2' })
    expect(urls).toEqual(['/api/video/exports', '/api/video/exports?project=p%201%2F2'])
  })

  /**
   * The defect: an empty grid that means two opposite things.
   *
   * "You have exported nothing" and "the backend did not answer" draw the same
   * blank box, and a client that resolved `[]` on a failure would make the Media
   * tab unable to tell them apart — so the tab would say "no films yet" to
   * somebody whose films are sitting on the server.
   */
  it('throws when the listing fails rather than resolving empty', async () => {
    vi.stubGlobal('fetch', answer(500, { error: 'nope' }))
    const err = await listVideoExports().catch((e) => e)
    expect(err).toBeInstanceOf(VideoExportError)
    expect(err.code).toBe('http')
  })

  it('survives a body that is not the shape it promised', async () => {
    vi.stubGlobal('fetch', answer(200, { videos: 'not-an-array' }))
    expect(await listVideoExports()).toEqual([])
  })
})

describe('deleteVideoExport', () => {
  it('names the projects that were still pointing at the film', async () => {
    vi.stubGlobal('fetch', answer(200, { removed: true, wasUsedBy: ['p1', 'p2', 7] }))
    // `7` is dropped rather than rendered as a project name: this is a network
    // body, not a type.
    expect(await deleteVideoExport('ab12')).toEqual({ removed: true, wasUsedBy: ['p1', 'p2'] })
  })

  it('tells a stranger apart from a film that is already gone', async () => {
    vi.stubGlobal('fetch', answer(403, { error: 'another account' }))
    expect((await deleteVideoExport('ab12').catch((e) => e)).code).toBe('no-access')
    vi.stubGlobal('fetch', answer(404, { error: 'gone' }))
    expect((await deleteVideoExport('ab12').catch((e) => e)).code).toBe('not-found')
  })
})
