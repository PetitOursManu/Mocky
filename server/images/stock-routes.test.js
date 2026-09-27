import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import { createImagesRouter } from './routes.js'

/**
 * The free-photo routes with the client and the library faked. What is pinned:
 * the administrator's access list is enforced on every verb, the account
 * recorded is the session's, and "nothing found" is an answer rather than an
 * error.
 */

const HASH = 'c'.repeat(64)
let server, base
let allowed = true
let stored = null
let pickAnswer = null

const stock = {
  status: () => ({ pexels: true, pixabay: false }),
  async search(provider, q) {
    return { results: [{ provider, id: '1', title: q }], page: 1, hasMore: false }
  },
  async fetchPhoto(provider, id) {
    return { buffer: Buffer.alloc(10), spec: { name: 'x', provider, credit: { source: provider, id } } }
  },
  async pick() {
    return pickAnswer
  },
  async candidates(query) {
    return { query, candidates: [{ provider: 'pexels', id: '3', thumb: 'data:image/jpeg;base64,AA==' }] }
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
    '/api/images',
    createImagesRouter({
      stock,
      stockAccessFor: () => allowed,
      registryFor: () => null,
      library: {
        list: () => [],
        ingestStock(buffer, spec) {
          stored = spec
          return { hash: HASH, fromCache: false, meta: { hash: HASH, owners: ['u1'], credit: spec.credit } }
        },
      },
    }),
  )
  await new Promise((resolve) => {
    server = app.listen(0, resolve)
  })
  base = `http://127.0.0.1:${server.address().port}/api/images`
})

afterAll(() => server?.close())

const post = (p, body) =>
  fetch(`${base}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

describe('free stock photos', () => {
  it('reports both libraries off to an account without access, and refuses it by name', async () => {
    allowed = false
    const status = await (await fetch(`${base}/stock/status`)).json()
    expect(status).toEqual({ providers: { pexels: false, pixabay: false }, allowed: false })
    const res = await post('/stock/pick', { query: 'sea' })
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('no-access')
    allowed = true
  })

  it('imports a chosen photo under the session account, never one from the body', async () => {
    const res = await post('/stock/import', { provider: 'pexels', id: '5', project: 'p1', owner: 'someone-else' })
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.url).toBe(`/api/images/${HASH}`)
    expect(j.meta.owners).toBeUndefined()
    expect(stored).toMatchObject({ owner: 'u1', project: 'p1' })
  })

  it('answers found:false when nothing matched, and the photo when something did', async () => {
    pickAnswer = null
    expect(await (await post('/stock/pick', { query: 'zzz' })).json()).toEqual({ found: false })
    pickAnswer = {
      buffer: Buffer.alloc(10),
      spec: { name: 'sea', provider: 'pexels', credit: { source: 'pexels', id: '9' } },
      item: { provider: 'pexels', id: '9' },
      query: 'sea',
    }
    const j = await (await post('/stock/pick', { query: 'sea waves', tags: ['ultra', 'backdrop'] })).json()
    expect(j).toMatchObject({ found: true, stockId: 'pexels:9', url: `/api/images/${HASH}` })
    expect(stored.tags).toEqual(['ultra', 'backdrop'])
  })

  it('shows candidates without storing anything, and imports the chosen one with its tags', async () => {
    stored = null
    const c = await (await post('/stock/candidates', { query: 'sea' })).json()
    expect(c.candidates).toHaveLength(1)
    expect(stored).toBeNull()
    const j = await (await post('/stock/import', { provider: 'pexels', id: '3', tags: ['ultra', 'scene'] })).json()
    expect(j.stockId).toBe('pexels:3')
    expect(stored.tags).toEqual(['ultra', 'scene'])
  })

  it('wants a query', async () => {
    expect((await post('/stock/pick', {})).status).toBe(400)
  })
})
