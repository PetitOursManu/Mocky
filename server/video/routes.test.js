import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import express from 'express'
import { createVideoRouter, createVideoAdminRouter } from './routes.js'
import { MAX_SCENES } from './timeline.js'

const ID_A = 'a'.repeat(64)
const ID_B = 'b'.repeat(64)
const scene = (over = {}) => ({ imageId: ID_A, durationMs: 3000, ...over })

let server, base
/** Rewritten per test — every refusal in this router depends on one of these. */
let user, enabled, workerState, probed, adminProbed, present, enqueued, jobs, config

function makeApp() {
  const app = express()
  app.use(express.json())
  // Stands in for requireUser / requireAdmin, which live in server/index.js.
  app.use((req, _res, next) => {
    req.user = user
    next()
  })
  app.use(
    '/api/video',
    createVideoRouter({
      config: {
        enabledFor: () => enabled,
        publicView: () => config,
        update: (patch) => {
          config = { ...config, ...patch }
        },
      },
      queue: {
        enqueue: (job) => {
          enqueued = job
          const stored = { id: 'job-1', ...job, status: 'queued', createdAt: 1, startedAt: null, finishedAt: null, error: null, videoHash: null }
          jobs.push(stored)
          return stored
        },
        get: (id) => jobs.find((j) => j.id === id) || null,
      },
      worker: {
        health: async () => {
          probed = true
          return workerState
        },
      },
      imageLibrary: { fileExists: (id) => present.includes(id) },
    }),
  )
  app.use(
    '/api/admin/video',
    createVideoAdminRouter({
      config: {
        publicView: () => config,
        update: (patch) => {
          config = { ...config, ...patch }
        },
      },
      worker: {
        health: async () => {
          adminProbed = true
          return workerState
        },
      },
    }),
  )
  return app
}

beforeAll(async () => {
  const app = makeApp()
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})
afterAll(async () => {
  await new Promise((r) => server.close(r))
})

beforeEach(() => {
  user = { id: 'u1', role: 'user' }
  enabled = true
  workerState = { available: true, version: '4.0.0' }
  probed = false
  adminProbed = false
  present = [ID_A, ID_B]
  enqueued = null
  jobs = []
  config = { enabled: true, hasLicenseKey: true, access: 'allowlist', allowedUserIds: ['u1'], workerUrl: 'http://worker.test:3030' }
})

const post = (path, body) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

describe('GET /status', () => {
  it('reports the access and the worker, and quotes the schema bounds', async () => {
    const body = await (await fetch(`${base}/api/video/status`)).json()
    expect(body.enabled).toBe(true)
    expect(body.worker).toEqual({ available: true, version: '4.0.0' })
    expect(body.limits.maxScenes).toBe(MAX_SCENES)
  })

  /**
   * A three-second connect attempt per poll, for every signed-in account on an
   * instance where the feature is off, is three seconds of nothing repeated
   * forever. The panel polls this route.
   */
  it('does not probe the worker for an account that cannot use it', async () => {
    enabled = false
    const body = await (await fetch(`${base}/api/video/status`)).json()
    expect(body.enabled).toBe(false)
    expect(body.worker).toMatchObject({ available: false, reason: 'no-access' })
    expect(probed).toBe(false)
  })

  it('answers with three fields and nothing from the stored config', async () => {
    const body = await (await fetch(`${base}/api/video/status`)).json()
    // Named explicitly rather than checked for the absence of one word: the
    // config holds a licence key and a worker URL, and this route is the one an
    // ordinary account is allowed to call.
    expect(Object.keys(body).sort()).toEqual(['enabled', 'limits', 'worker'])
  })
})

describe('POST /render', () => {
  it('queues the PARSED timeline, with the defaults applied', async () => {
    const res = await post('/api/video/render', { timeline: { scenes: [scene()] } })
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body).toMatchObject({ id: 'job-1', status: 'queued' })

    /*
     * The raw body is what somebody wrote; the parsed one is what the schema
     * accepted. Queueing the raw document would persist — and eventually send to
     * the worker — exactly the fields `.strict()` exists to keep out.
     */
    expect(enqueued.timeline).toEqual({
      scenes: [{ imageId: ID_A, durationMs: 3000, kenBurns: 'static', transitionOut: 'crossfade', textOverlay: null }],
      outputFormat: 'mp4',
      aspectRatio: '16:9',
    })
  })

  it('takes the owner from the session, never from the body', async () => {
    await post('/api/video/render', { timeline: { scenes: [scene()] }, userId: 'someone-else' })
    expect(enqueued.userId).toBe('u1')
  })

  it('never sends the account id back', async () => {
    const body = await (await post('/api/video/render', { timeline: { scenes: [scene()] } })).json()
    expect(body.userId).toBeUndefined()
  })

  /**
   * Access is checked before the schema on purpose: an account with no right to
   * the feature should not be able to use the 400s as a free description of what
   * a well-formed timeline looks like.
   */
  it('403s without access, and queues nothing', async () => {
    enabled = false
    const res = await post('/api/video/render', { timeline: { scenes: [scene()] } })
    expect(res.status).toBe(403)
    expect(enqueued).toBe(null)
  })

  it('400s on a refused timeline with issues a person can act on', async () => {
    const res = await post('/api/video/render', { timeline: { scenes: [scene({ imageId: 'A'.repeat(64) })] } })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.issues).toEqual([{ path: 'scenes.0.imageId', message: expect.stringMatching(/lower-case SHA-256/) }])
    expect(enqueued).toBe(null)
  })

  it('400s on an unknown key rather than accepting a field nothing renders', async () => {
    // The whole point of `.strict()`: an invented `audio` would validate, be
    // ignored at render, and the export would be announced as a success.
    const res = await post('/api/video/render', { timeline: { scenes: [scene()], audio: 'track.mp3' } })
    expect(res.status).toBe(400)
    expect(enqueued).toBe(null)
  })

  it('400s when the total runtime is over the ceiling', async () => {
    const scenes = Array.from({ length: 20 }, () => scene({ durationMs: 15000 }))
    const res = await post('/api/video/render', { timeline: { scenes } })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.issues[0]).toMatchObject({ path: 'scenes' })
  })

  it('400s when there is no timeline in the body at all', async () => {
    expect((await post('/api/video/render', {})).status).toBe(400)
  })

  /**
   * Checked at enqueue rather than only at render: an image whose bytes are gone
   * is otherwise a job that fails minutes later, in the queue, with the user
   * watching a spinner and no idea which picture was the problem.
   */
  it('404s naming the images that are not in the library', async () => {
    present = [ID_A]
    const res = await post('/api/video/render', { timeline: { scenes: [scene(), scene({ imageId: ID_B })] } })
    expect(res.status).toBe(404)
    expect((await res.json()).missingImageIds).toEqual([ID_B])
    expect(enqueued).toBe(null)
  })
})

describe('GET /jobs/:id', () => {
  const queueOne = () => post('/api/video/render', { timeline: { scenes: [scene()] } })

  it('returns the caller’s own job without the account id', async () => {
    await queueOne()
    const body = await (await fetch(`${base}/api/video/jobs/job-1`)).json()
    expect(body).toMatchObject({ id: 'job-1', status: 'queued' })
    expect(body.userId).toBeUndefined()
    expect(body.timeline).toBeTruthy()
  })

  it('404s for an id nobody has', async () => {
    expect((await fetch(`${base}/api/video/jobs/nope`)).status).toBe(404)
  })

  /**
   * A job carries the timeline, and a timeline carries the overlay text somebody
   * wrote. Other people's briefs are exactly what the image library refuses to
   * publish, and for the same reason.
   */
  it('403s on somebody else’s job', async () => {
    await queueOne()
    user = { id: 'u2', role: 'admin' }
    const res = await fetch(`${base}/api/video/jobs/job-1`)
    expect(res.status).toBe(403)
    expect(await res.text()).not.toContain('imageId')
  })
})

describe('the admin config routes', () => {
  it('returns the public view, which has no licence key in it', async () => {
    const text = await (await fetch(`${base}/api/admin/video/config`)).text()
    expect(text).toContain('hasLicenseKey')
    expect(text).not.toMatch(/"licenseKey"/)
  })

  /**
   * The stored view, not the patch. An ignored access mode or a refused worker
   * URL is invisible otherwise, and the admin walks away believing a setting
   * that never took.
   */
  it('answers a PUT with what was actually stored', async () => {
    const res = await fetch(`${base}/api/admin/video/config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    })
    expect(await res.json()).toMatchObject({ enabled: false, hasLicenseKey: true })
  })

  /**
   * The admin probe exists because /status refuses to answer one: it reports the
   * worker only to an account the feature is enabled for, and an admin is NOT
   * implicitly on the allowlist. Without this route the panel that owns the URL
   * field would have shown a healthy worker as inaccessible.
   */
  it('probes the worker for an admin who is not on the allowlist', async () => {
    user = { id: 'someone-not-listed', role: 'admin' }
    enabled = false
    const body = await (await fetch(`${base}/api/admin/video/health`)).json()
    expect(adminProbed).toBe(true)
    expect(body).toEqual({ available: true, version: '4.0.0' })
  })

  it('reports an unreachable worker as a state, not as a failed request', async () => {
    workerState = { available: false, reason: 'unreachable', detail: 'connect ECONNREFUSED' }
    const res = await fetch(`${base}/api/admin/video/health`)
    // 200 with an honest answer, like POST /api/muse/quality with no model:
    // "I could not reach it" is a fact about the worker, not an error in the
    // request, and a 5xx here would render as an empty status line.
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ available: false, reason: 'unreachable' })
  })
})
