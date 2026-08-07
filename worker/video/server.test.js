// The worker's HTTP contract, tested from Mocky's own suite.
//
// The worker is a separate sub-project with its own package.json, so testing it
// here needs a justification: the thing under test is not Remotion, it is the
// wire between `server/video/worker.js` and this service. Both ends of that
// wire are in this repository and neither can see the other, which is precisely
// the shape where a contract drifts unnoticed — the worker gains a JSON error
// body, or loses `version`, and nothing fails until an administrator reports
// that the panel says "unavailable" for a container that is plainly running.
//
// It works because `server.js` imports no Remotion package. If a future change
// makes it do so, this file stops running on every machine that has not built
// the worker, and that is the signal to move the import back behind render.js.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createApp, VERSION } from './server.js'

let server, base
/** Rewritten per test: every case below is one of these behaving differently. */
let renderImpl, logged

const app = () =>
  createApp({
    renderVideo: (opts) => renderImpl(opts),
    timeoutMs: 80,
    log: { error: (m) => logged.push(m), warn: () => {}, log: () => {} },
  })

const IMAGE_ID = 'a'.repeat(64)
/** One base64 pixel — the injected renderer never decodes it. */
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

/**
 * The smallest body the worker accepts.
 *
 * A helper rather than a literal in every test, because since the worker
 * validates what it is sent, `{}` no longer reaches the renderer at all — every
 * case below that is not ABOUT validation has to send something valid to get
 * past it.
 */
const validBody = (extra = {}) => ({
  timeline: { scenes: [{ imageId: IMAGE_ID, durationMs: 2000 }] },
  images: [{ id: IMAGE_ID, mime: 'image/png', base64: PIXEL }],
  ...extra,
})

beforeAll(async () => {
  await new Promise((resolve) => {
    server = app().listen(0, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})
afterAll(async () => {
  await new Promise((r) => server.close(r))
})

beforeEach(() => {
  logged = []
  renderImpl = async () => ({ buffer: Buffer.from('fake-mp4-bytes'), contentType: 'video/mp4' })
})

const post = (body, init = {}) =>
  fetch(`${base}/render`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  })

describe('GET /health', () => {
  /**
   * `createVideoWorker.health()` reads `body.version` and shows it to the
   * administrator. A worker that answered 200 with any other shape would report
   * itself available with an undefined version — a panel saying the worker is
   * up and refusing to say what it is.
   */
  it('answers 200 with ok and a version string', async () => {
    const res = await fetch(`${base}/health`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.version).toBe(VERSION)
    expect(typeof body.version).toBe('string')
  })
})

describe('POST /render', () => {
  /**
   * The client does `Buffer.from(await res.arrayBuffer())` and throws on an
   * empty one. Bytes and a video content type are the entire success contract.
   */
  it('returns the rendered bytes with a video content type', async () => {
    const res = await post(validBody())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('video/mp4')
    const bytes = Buffer.from(await res.arrayBuffer())
    expect(bytes.length).toBeGreaterThan(0)
  })

  /**
   * Which composition produced the bytes, and — the half that is a regression
   * guard rather than a convenience — that the worker no longer announces
   * itself as a test card. `x-mocky-worker-phase: test-card` was phase 1's way
   * of warning that the response was NOT the requested timeline; a container
   * left behind on that image would otherwise be indistinguishable from a
   * current one in a network trace.
   */
  it('names the composition it rendered and no longer claims to be a test card', async () => {
    const res = await post(validBody())
    expect(res.headers.get('x-mocky-worker-composition')).toBe('ImageSequenceVideo')
    expect(res.headers.get('x-mocky-worker-phase')).toBeNull()
  })

  /**
   * Defence in depth: Mocky validates the same document before enqueuing it,
   * and this worker is still a plain HTTP endpoint with no authentication of
   * its own. A refusal must cost nothing — no Chromium, no render slot — and it
   * must name the field, because the sentence lands in front of whoever asked
   * for the export.
   */
  it('refuses an invalid timeline with 400 and never calls the renderer', async () => {
    let called = false
    renderImpl = async () => {
      called = true
      return { buffer: Buffer.from('x'), contentType: 'video/mp4' }
    }
    const res = await post({ timeline: { scenes: [{ imageId: IMAGE_ID, durationMs: 40000 }] }, images: [] })
    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(await res.text()).toContain('durationMs')
    expect(called).toBe(false)
  })

  /**
   * A caller sending a malformed body in a loop must not hold the render slot
   * closed against the one request that was correct — which is why validation
   * happens before `busy` is taken, not after.
   */
  it('leaves the render slot free after a refusal', async () => {
    expect((await post({ timeline: { scenes: [] }, images: [] })).status).toBe(400)
    expect((await post(validBody())).status).toBe(200)
  })

  /**
   * The renderer receives the PARSED document: the validator fills in the
   * schema's defaults and decodes the base64 once, so nothing downstream has to
   * decide what an absent field meant.
   */
  it('hands the renderer a normalised timeline and decoded images', async () => {
    let seen = null
    renderImpl = async (opts) => {
      seen = opts
      return { buffer: Buffer.from('x'), contentType: 'video/mp4' }
    }
    await post(validBody())
    expect(seen.timeline.scenes[0]).toMatchObject({ kenBurns: 'static', transitionOut: 'crossfade', textOverlay: null })
    expect(seen.timeline.aspectRatio).toBe('16:9')
    expect(Buffer.isBuffer(seen.images[0].bytes)).toBe(true)
    expect(seen.images[0].extension).toBe('.png')
  })

  /**
   * The client splices up to 300 characters of a non-2xx body into the sentence
   * the user reads. An Express HTML error page there is unreadable, and a JSON
   * envelope shows up as braces in the middle of a French sentence.
   */
  it('reports a failure as one line of plain text, not HTML or JSON', async () => {
    renderImpl = async () => {
      throw new Error('Chromium could not be launched')
    }
    const res = await post(validBody())
    expect(res.status).toBe(500)
    expect(res.headers.get('content-type')).toContain('text/plain')
    const text = await res.text()
    expect(text).toContain('Chromium could not be launched')
    expect(text).not.toContain('<')
    expect(text.split('\n')).toHaveLength(1)
    // The detail belongs in the container log as well — that is where an admin
    // looks once the user's message has told them which machine to look at.
    expect(logged.join(' ')).toContain('Chromium could not be launched')
  })

  /** A renderer that resolves with nothing must not become a successful export of nothing. */
  it('refuses an empty render rather than answering 200', async () => {
    renderImpl = async () => ({ buffer: Buffer.alloc(0), contentType: 'video/mp4' })
    const res = await post(validBody())
    expect(res.status).toBe(500)
    expect(await res.text()).toContain('no bytes')
  })

  /**
   * Two Remotion renders on a two-core container do not take half the time
   * each. Mocky's queue serialises jobs, but nothing stops a second caller.
   */
  it('refuses a second render while one is running', async () => {
    let release
    renderImpl = () => new Promise((resolve) => (release = () => resolve({ buffer: Buffer.from('x'), contentType: 'video/mp4' })))
    const first = post(validBody())
    // Wait for the first request to be inside the handler before racing it.
    await new Promise((r) => setTimeout(r, 20))
    const second = await post(validBody())
    expect(second.status).toBe(429)
    expect(await second.text()).toContain('one video at a time')
    release()
    expect((await first).status).toBe(200)
  })

  /**
   * The slot has to come back even when the renderer ignores the abort. This is
   * the failure the timeout exists to prevent, one level up: without the race,
   * a single wedged render leaves the worker answering 429 to everything until
   * somebody restarts the container, and the message it gives is true, which is
   * what makes it so hard to diagnose.
   */
  it('gives up on an overrunning render and frees the slot for the next one', async () => {
    renderImpl = () => new Promise(() => {})
    const res = await post(validBody())
    expect(res.status).toBe(504)
    expect(await res.text()).toContain('abandoned')

    renderImpl = async () => ({ buffer: Buffer.from('later'), contentType: 'video/mp4' })
    expect((await post(validBody())).status).toBe(200)
  })

  /**
   * The licence key reaches the renderer — that is what opens Remotion's
   * telemetry, and the whole reason it is entered explicitly — and it reaches
   * nothing else. A key echoed in a response or a log is a secret leaked to
   * whoever can read either.
   */
  it('passes the licence key to the renderer and never echoes or logs it', async () => {
    const KEY = 'rm-licence-do-not-leak-0001'
    let seen = 'not-called'
    renderImpl = async ({ licenseKey }) => {
      seen = licenseKey
      throw new Error('rendering is not the point of this test')
    }
    const res = await post(validBody({ licenseKey: KEY }))
    expect(seen).toBe(KEY)
    expect(await res.text()).not.toContain(KEY)
    expect(logged.join(' ')).not.toContain(KEY)
  })

  /** An absent key must be `null`, not `''` — render.js decides on truthiness. */
  it('normalises a missing or blank licence key to null', async () => {
    let seen = 'not-called'
    renderImpl = async ({ licenseKey }) => {
      seen = licenseKey
      return { buffer: Buffer.from('x'), contentType: 'video/mp4' }
    }
    await post(validBody())
    expect(seen).toBeNull()
    await post(validBody({ licenseKey: '   ' }))
    expect(seen).toBeNull()
  })
})

describe('everything else', () => {
  /**
   * A workerUrl with a stray path is a typo an administrator makes once, and
   * Express answers it with an HTML page whose first 300 characters then appear
   * inside the user's error message.
   */
  it('answers an unknown route with plain text naming the route', async () => {
    const res = await fetch(`${base}/api/render`, { method: 'POST' })
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(await res.text()).toContain('POST /api/render')
  })

  /** Malformed JSON is refused by express.json() before any route runs. */
  it('answers a malformed body with plain text rather than an HTML stack page', async () => {
    const res = await fetch(`${base}/render`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not json',
    })
    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(await res.text()).toContain('refused')
  })
})
