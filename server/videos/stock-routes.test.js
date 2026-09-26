import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import { createVideosRouter } from './routes.js'

/**
 * The three stock routes, with the client faked: what is under test here is
 * that an import is treated like an upload — ffmpeg checked, quota refused
 * before writing, the admin's frame settings applied, the credit carried — and
 * that the caller's own account is recorded, not one written in the body.
 */

const HASH = 'b'.repeat(64)
let server, base
let ffmpeg = true
let usage = { bytes: 0, maxBytes: 0, ratio: null }
let ingested = null
let asked = null
/** What the administrator allows the test account; changed per test. */
let access = { generate: true, stock: true }

const stock = {
  status: () => ({ pexels: true, pixabay: false }),
  async search(provider, q) {
    return { results: [{ provider, id: '1', title: q }], page: 1, hasMore: false }
  },
  async fetchClip(provider, id, opts) {
    asked = { provider, id, opts }
    return {
      buffer: Buffer.alloc(1000),
      spec: { prompt: 'plage', provider, model: '', credit: { source: provider, id: String(id), author: 'Jane' } },
    }
  },
}

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: 'u1' }
    next()
  })
  app.use(
    '/api/videos',
    createVideosRouter({
      stock,
      budget: { usage: () => usage, wouldExceed: (b) => Boolean(usage.maxBytes) && usage.bytes + b > usage.maxBytes },
      library: {
        list: () => [],
        async ingest(buffer, spec, opts) {
          ingested = { bytes: buffer.length, spec, opts }
          return { hash: HASH, meta: { frames: 12, width: 640, fps: 12 }, fromCache: false }
        },
      },
      generate: async () => ({}),
      availability: async () => ({ available: true, reason: null, ffmpeg: { available: ffmpeg } }),
      recheck: async () => ({}),
      frameSettings: () => ({ fps: 9, width: 480, max: 50 }),
      accessFor: () => access,
    }),
  )
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${server.address().port}/api/videos`
})

afterAll(async () => {
  await new Promise((r) => server.close(r))
})

const post = (body) =>
  fetch(`${base}/stock/import`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

describe('stock routes', () => {
  it('say which libraries are on, and nothing about their keys', async () => {
    const j = await (await fetch(`${base}/stock/status`)).json()
    expect(j).toEqual({ providers: { pexels: true, pixabay: false }, ffmpeg: true, allowed: true })
  })

  it('search', async () => {
    const j = await (await fetch(`${base}/stock/search?provider=pexels&q=plage`)).json()
    expect(j.results[0]).toMatchObject({ provider: 'pexels', title: 'plage' })
  })

  it('import a clip like an upload: cut with the admin settings, credited, owned by the session', async () => {
    usage = { bytes: 0, maxBytes: 0, ratio: null }
    const res = await post({ provider: 'pexels', id: '42', project: 'p1', owner: 'someone-else' })
    expect(res.status).toBe(200)
    expect((await res.json()).base).toBe(`/api/videos/${HASH}`)
    expect(asked).toMatchObject({ provider: 'pexels', id: '42' })
    expect(ingested.opts).toEqual({ fps: 9, width: 480, max: 50 })
    expect(ingested.spec).toMatchObject({ project: 'p1', owner: 'u1', credit: { author: 'Jane' } })
  })

  it('bounds the download by what the quota can still hold, a third of it', async () => {
    usage = { bytes: 0, maxBytes: 3000, ratio: 0 }
    await post({ provider: 'pexels', id: '42' })
    expect(asked.opts.maxBytes).toBe(1000)
    usage = { bytes: 3000, maxBytes: 3000, ratio: 1 }
    asked = null
    const res = await post({ provider: 'pexels', id: '42' })
    expect(res.status).toBe(507)
    expect(asked).toBeNull()
    usage = { bytes: 0, maxBytes: 0, ratio: null }
  })

  it('refuses before downloading when ffmpeg is missing', async () => {
    ffmpeg = false
    asked = null
    const res = await post({ provider: 'pexels', id: '42' })
    ffmpeg = true
    expect(res.status).toBe(503)
    expect(asked).toBeNull()
  })

  it('follow what the administrator allows this account, at the route and not only in the panel', async () => {
    access = { generate: true, stock: false }
    asked = null
    const status = await (await fetch(`${base}/stock/status`)).json()
    expect(status).toMatchObject({ allowed: false, providers: { pexels: false, pixabay: false } })
    expect((await fetch(`${base}/stock/search?provider=pexels&q=x`)).status).toBe(403)
    expect((await post({ provider: 'pexels', id: '42' })).status).toBe(403)
    expect(asked).toBeNull()

    access = { generate: false, stock: true }
    const avail = await (await fetch(`${base}/availability`)).json()
    expect(avail).toMatchObject({ available: false, reason: 'no-access', access: { generate: false, stock: true } })
    const gen = await fetch(`${base}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'x' }),
    })
    expect(gen.status).toBe(403)

    // Neither: not even one's own clip, since there is no feature to put it in.
    access = { generate: false, stock: false }
    const up = await fetch(`${base}/upload`, { method: 'POST', headers: { 'content-type': 'video/mp4' }, body: 'x' })
    expect(up.status).toBe(403)
    access = { generate: true, stock: true }
  })
})
