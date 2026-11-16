import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { CalendyStore, calendyRouter, cleanPost, normalizeBase } from './calendy.js'

/**
 * Mocky → Calendy, against a fake Calendy on loopback that behaves like the
 * real one where it matters here: a Bearer token, a 403 for any foreign
 * Origin, `statut: "idee"` by default, and pictures as raw bodies.
 */

const TOKEN = 'calendy-test-token-0123456789'
const fake = { posts: [], photos: [], origins: [], server: null, base: '' }

function startFake() {
  fake.server = http.createServer((req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.headers.origin) {
      fake.origins.push(req.headers.origin)
      return send(403, { error: 'Origine non autorisée.' })
    }
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'Jeton' })
    const url = new URL(req.url, 'http://x')
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const buf = Buffer.concat(chunks)
      const m = url.pathname.match(/^\/api\/posts\/([\w-]+)(?:\/photo\/(meta|linkedin))?$/)
      if (req.method === 'GET' && url.pathname === '/api/posts') {
        const { du, au, q } = Object.fromEntries(url.searchParams)
        return send(200, fake.posts.filter((p) => p.datePublication >= du && p.datePublication <= au && (!q || p.titre.includes(q))))
      }
      if (req.method === 'POST' && url.pathname === '/api/posts') {
        const body = JSON.parse(buf.toString('utf8'))
        const post = { id: `po${fake.posts.length + 1}`, statut: 'idee', ...body }
        fake.posts.push(post)
        return send(201, post)
      }
      if (m && !m[2]) {
        const post = fake.posts.find((p) => p.id === m[1])
        if (!post) return send(404, { error: 'Post introuvable.' })
        if (req.method === 'GET') return send(200, post)
        if (req.method === 'PUT') {
          Object.assign(post, JSON.parse(buf.toString('utf8')))
          return send(200, post)
        }
      }
      if (m && m[2] && (req.method === 'POST' || req.method === 'PUT')) {
        fake.photos.push({ id: m[1], slot: m[2], method: req.method, type: req.headers['content-type'], size: buf.length })
        return send(req.method === 'PUT' ? 200 : 201, { ok: true })
      }
      send(404, { error: 'Introuvable.' })
    })
  })
  return new Promise((resolve) => {
    fake.server.listen(0, '127.0.0.1', () => {
      fake.base = `http://127.0.0.1:${fake.server.address().port}`
      resolve()
    })
  })
}

let dir, app, server, base
const fakeUser = (req, _res, next) => {
  req.user = { id: 'u1' }
  next()
}

beforeAll(async () => {
  await startFake()
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-calendy-'))
  app = express()
  app.use('/api', express.json())
  // The tests talk to a loopback Calendy, which the real guard refuses — that
  // refusal has its own test below, with the guard left in place.
  app.use('/api/calendy', calendyRouter({ store: new CalendyStore(dir), requireUser: fakeUser, assertTarget: async () => {} }))
  app.use('/api/guarded', calendyRouter({ store: new CalendyStore(path.join(dir, 'g')), requireUser: fakeUser }))
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

describe('normalizeBase and cleanPost', () => {
  it('reads an address with or without /api', () => {
    expect(normalizeBase('https://cal.example.org/api/')).toBe('https://cal.example.org')
    expect(normalizeBase('https://cal.example.org/')).toBe('https://cal.example.org')
    expect(normalizeBase('ftp://x')).toBeNull()
    expect(normalizeBase('not a url')).toBeNull()
  })

  it('keeps only known networks and well-formed days', () => {
    expect(cleanPost({ date: '2026-12-01', titre: ' A ', plateformes: ['Instagram', 'TikTok'] })).toMatchObject({ titre: 'A', plateformes: ['Instagram'] })
    expect(() => cleanPost({ date: '01/12/2026', titre: 'A', plateformes: ['Instagram'] })).toThrow()
    expect(() => cleanPost({ date: '2026-12-01', titre: 'A', plateformes: [] })).toThrow()
  })
})

describe('the Calendy link', () => {
  it('refuses a wrong token, keeps a right one, and never gives it back', async () => {
    expect((await json('PUT', '/api/calendy', { base: fake.base, token: 'wrong' })).status).toBe(400)
    const ok = await json('PUT', '/api/calendy', { base: `${fake.base}/api`, token: TOKEN })
    expect(ok.status).toBe(200)
    expect(ok.body).toEqual({ connected: true, host: new URL(fake.base).host })
    const view = await json('GET', '/api/calendy')
    expect(JSON.stringify(view.body)).not.toContain(TOKEN)
  })

  it('creates an idea, then finds the same post again instead of a twin', async () => {
    const post = { date: '2026-12-03', time: '09:00', titre: 'Campagne · Post Instagram', plateformes: ['Instagram'] }
    const first = await json('POST', '/api/calendy/posts', post)
    expect(first.body).toMatchObject({ created: true })
    expect(fake.posts.at(-1)).toMatchObject({ statut: 'idee', datePublication: '2026-12-03', heure: '09:00' })

    // Known id: updated in place, its day following the piece.
    const again = await json('POST', '/api/calendy/posts', { ...post, time: '11:45', calendyId: first.body.id })
    expect(again.body).toEqual({ id: first.body.id, created: false })
    expect(fake.posts.find((p) => p.id === first.body.id).heure).toBe('11:45')

    // Id forgotten (a reverted piece): found by its day, title and networks.
    const found = await json('POST', '/api/calendy/posts', post)
    expect(found.body).toEqual({ id: first.body.id, created: false })
    expect(fake.posts).toHaveLength(1)
  })

  it('sends pictures as raw bodies, replacing the visual on the first', async () => {
    const id = fake.posts[0].id
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
    const send = (q) =>
      fetch(`${base}/api/calendy/posts/${id}/photo/meta${q}`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: png }).then((r) => r.status)
    expect(await send('?replace=1')).toBe(200)
    expect(await send('')).toBe(200)
    expect(fake.photos.map((p) => [p.method, p.slot, p.type, p.size])).toEqual([
      ['PUT', 'meta', 'image/png', png.length],
      ['POST', 'meta', 'image/png', png.length],
    ])
  })

  it('never sends an Origin header', () => {
    expect(fake.origins).toEqual([])
  })

  it('is refused by the SSRF guard on a private address', async () => {
    const r = await json('PUT', '/api/guarded', { base: fake.base, token: TOKEN })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/not allowed/)
  })

  it('disconnects', async () => {
    expect((await json('PUT', '/api/calendy', { base: null })).body).toEqual({ connected: false })
    expect((await json('POST', '/api/calendy/posts', { date: '2026-12-03', titre: 'x', plateformes: ['Instagram'] })).status).toBe(409)
  })
})
