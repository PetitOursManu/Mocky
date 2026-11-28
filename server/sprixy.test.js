import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { SprixyStore, sprixyRouter, createSprixyClient } from './sprixy.js'
import { createMcpPictures } from './mcp/images.js'
import { ImageLibrary } from './images/library.js'

/**
 * Mocky → Sprixy, against a fake Sprixy on loopback that behaves like the real
 * one where it matters: a catalog token is refused everywhere but the catalog
 * (403 TOKEN_SCOPE), a full token lists the projects, and pictures are PNGs.
 */

const CATALOG = 'spx_catalog_token_0123456789'
const FULL = 'spx_full_token_0123456789abcd'
const PNG = (n) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(24, n)])
const ASSETS = [
  { id: 'ast_goblin', name: 'Goblin archer', kind: 'character', projectId: 'prj_1', projectName: 'Dungeon', width: 32, height: 32, frames: 1, tags: ['goblin'], image: { width: 512, height: 512, scale: 16 }, credit: { author: 'Dev', source: 'Sprixy' } },
  { id: 'ast_walk', name: 'Knight walk', kind: 'animation', projectId: 'prj_1', projectName: 'Dungeon', width: 32, height: 48, frames: 4, tags: [], image: { width: 352, height: 528, scale: 11 }, credit: { author: 'Dev', source: 'Sprixy' } },
]
const fake = { server: null, base: '', seen: [] }

function startFake() {
  fake.server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    fake.seen.push(`${req.method} ${url.pathname}${url.search}`)
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    const auth = req.headers.authorization
    if (auth !== `Bearer ${CATALOG}` && auth !== `Bearer ${FULL}`) return send(401, { error: { code: 'UNAUTHORIZED' } })
    if (!url.pathname.startsWith('/api/v1/catalog')) {
      if (auth === `Bearer ${CATALOG}`) return send(403, { error: { code: 'TOKEN_SCOPE' } })
      if (url.pathname === '/api/v1/projects') return send(200, { items: [] })
      return send(404, {})
    }
    if (url.pathname === '/api/v1/catalog') return send(200, { owner: { name: 'Dev' }, projects: [{ id: 'prj_1', name: 'Dungeon', assetCount: 2 }] })
    if (url.pathname === '/api/v1/catalog/assets') {
      const q = (url.searchParams.get('q') || '').toLowerCase()
      const items = ASSETS.filter((a) => !q || a.name.toLowerCase().includes(q))
      return send(200, { total: items.length, items })
    }
    const m = url.pathname.match(/^\/api\/v1\/catalog\/assets\/([\w-]+)(\/image)?$/)
    const a = m && ASSETS.find((x) => x.id === m[1])
    if (!a) return send(404, { error: { code: 'NOT_FOUND' } })
    if (!m[2]) return send(200, a)
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.end(PNG(Number(url.searchParams.get('size')) % 250))
  })
  return new Promise((resolve) => {
    fake.server.listen(0, '127.0.0.1', () => {
      fake.base = `http://127.0.0.1:${fake.server.address().port}`
      resolve()
    })
  })
}

let dir, server, base, store
const fakeUser = (req, _res, next) => {
  req.user = { id: 'u1' }
  next()
}

beforeAll(async () => {
  await startFake()
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-sprixy-'))
  store = new SprixyStore(dir)
  const app = express()
  app.use('/api', express.json())
  // The tests talk to a loopback Sprixy, which the real guard refuses — that
  // refusal has its own test below, with the guard left in place.
  app.use('/api/sprixy', sprixyRouter({ store, requireUser: fakeUser, client: createSprixyClient({ assertTarget: async () => {} }) }))
  app.use('/api/guarded', sprixyRouter({ store: new SprixyStore(path.join(dir, 'g')), requireUser: fakeUser }))
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => {
  server?.close()
  fake.server?.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

const json = (method, url, body) =>
  fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }))

describe('connecting a Sprixy', () => {
  it('refuses a token that is not a Sprixy one, and a full-access token', async () => {
    expect((await json('PUT', '/api/sprixy', { base: fake.base, token: 'hello' })).status).toBe(400)
    const full = await json('PUT', '/api/sprixy', { base: fake.base, token: FULL })
    expect(full.status).toBe(400)
    expect(full.body.code).toBe('full-token')
    expect(full.body.error).toMatch(/Read-only catalog/)
    expect(store.get('u1')).toBeNull()
  })

  it('keeps a read-only catalog token, and never sends it back', async () => {
    const r = await json('PUT', '/api/sprixy', { base: `${fake.base}/api/`, token: CATALOG })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ connected: true, owner: 'Dev', projects: [{ id: 'prj_1', name: 'Dungeon', assetCount: 2 }] })
    expect(JSON.stringify(r.body)).not.toContain(CATALOG)
    expect(JSON.stringify((await json('GET', '/api/sprixy')).body)).not.toContain(CATALOG)
    expect(store.get('u1')).toMatchObject({ base: fake.base, token: CATALOG })
    if (process.platform !== 'win32') expect(fs.statSync(path.join(dir, 'sprixy.json')).mode & 0o777).toBe(0o600)
    expect((await json('GET', '/api/sprixy/catalog')).body.projects).toHaveLength(1)
  })

  it('says a wrong token in one sentence', async () => {
    const r = await json('PUT', '/api/sprixy', { base: fake.base, token: 'spx_wrong_token_000000' })
    expect(r.body.error).toBe('Sprixy refused the token.')
  })

  it('goes through the SSRF guard: a Sprixy on loopback is refused', async () => {
    const r = await json('PUT', '/api/guarded', { base: fake.base, token: CATALOG })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('This address is not allowed.')
  })
})

describe('Sprixy assets through the MCP pictures', () => {
  const library = () => new ImageLibrary(fs.mkdtempSync(path.join(dir, 'lib-')))
  const pictures = (lib) =>
    createMcpPictures({
      library: lib,
      stock: null,
      budget: { wouldExceed: () => false, add: () => {} },
      stockAccessFor: () => false,
      guard: async () => {},
      sprixy: { store, client: createSprixyClient({ assertTarget: async () => {} }) },
    })

  it('shows thumbnails to look at, and stores nothing', async () => {
    const lib = library()
    const p = pictures(lib)
    expect(p.sprixyAvailable({ id: 'u1' })).toBe(true)
    expect(p.sprixyAvailable({ id: 'someone-else' })).toBe(false)
    const out = await p.searchSprixy({ id: 'u1' }, 'goblin')
    expect(out.candidates).toEqual([
      expect.objectContaining({ id: 'sprixy:ast_goblin', title: 'Goblin archer', kind: 'character', width: 32, height: 32, project: 'Dungeon' }),
    ])
    expect(out.candidates[0].thumb).toMatch(/^data:image\/png;base64,/)
    expect(fake.seen).toContain('GET /api/v1/catalog/assets/ast_goblin/image?size=128')
    expect(Object.keys(lib.state.byHash)).toHaveLength(0)
  })

  it('imports a chosen asset as crisp pixel art, credited to its author', async () => {
    const lib = library()
    const p = pictures(lib)
    const hash = await p.importSprixy({ id: 'u1' }, 'sprixy:ast_walk', 'the knight')
    const meta = lib.get(hash)
    expect(meta).toMatchObject({ provider: 'sprixy', mime: 'image/png', width: 352, height: 528, prompt: 'the knight', owners: ['u1'] })
    expect(meta.tags).toEqual(expect.arrayContaining(['sprixy', 'pixel-art', 'mcp']))
    expect(meta.tags).not.toContain('upload')
    expect(meta.credit).toEqual({ source: 'sprixy', id: 'ast_walk', author: 'Dev', authorUrl: '', pageUrl: '' })
    expect(p.isPixelArt(hash)).toBe(true)
    expect(fake.seen).toContain('GET /api/v1/catalog/assets/ast_walk/image?size=512')
  })

  it('refuses an id that is not a Sprixy one, and an account that is not connected', async () => {
    const p = pictures(library())
    await expect(p.importSprixy({ id: 'u1' }, 'pexels:123', 'x')).rejects.toThrow(/sprixy:ast_/)
    await expect(p.importSprixy({ id: 'u1' }, 'sprixy:../../etc', 'x')).rejects.toThrow(/sprixy:ast_/)
    await expect(p.importSprixy({ id: 'nobody' }, 'sprixy:ast_goblin', 'x')).rejects.toThrow(/not connected/)
  })
})

describe('disconnecting', () => {
  it('forgets the address and the token', async () => {
    const r = await json('PUT', '/api/sprixy', { base: null })
    expect(r.body).toEqual({ connected: false })
    expect(store.get('u1')).toBeNull()
  })
})
