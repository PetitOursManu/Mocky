import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { createImagesRouter } from './routes.js'

const HASH = 'a1b2c3d4a1b2c3d4' // valid format, 16 hex
const IMG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]) // pretend jpeg

let dir, server, base

const fakeRegistry = {
  list: () => [
    { id: 'pollinations', requiresKey: false },
    { id: 'none', requiresKey: false },
  ],
}

function makeLibrary() {
  return {
    filePath: (h) => path.join(dir, `${h}.jpg`),
    fileExists: (h) => fs.existsSync(path.join(dir, `${h}.jpg`)),
    filenameFor: (h) => `hero-${h.slice(0, 8)}.jpg`,
    list: () => [{ hash: HASH, prompt: 'p', tags: ['hero'], seed: 1, width: 10, height: 10, provider: 'fake' }],
    zip: () => Buffer.from('PKzip'),
    toggleFavorite: (h) => (h === HASH ? { favorite: true } : null),
    remove: (h) => (h === HASH ? { removed: true, projects: ['p1'] } : null),
    async generate(spec) {
      if (spec.prompt === 'skip') return { skipped: true }
      return { hash: HASH, fromCache: false, meta: { hash: HASH } }
    },
  }
}

beforeAll(async () => {
  dir = path.join(os.tmpdir(), `muse-routes-${crypto.randomBytes(6).toString('hex')}`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${HASH}.jpg`), IMG_BYTES)

  const app = express()
  app.use(express.json())
  app.use('/api/images', createImagesRouter({ library: makeLibrary(), registry: fakeRegistry }))
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`
      resolve()
    })
  })
})

afterAll(async () => {
  await new Promise((r) => server.close(r))
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
})

describe('image routes', () => {
  it('GET /providers lists providers', async () => {
    const res = await fetch(`${base}/api/images/providers`)
    expect(res.ok).toBe(true)
    const body = await res.json()
    expect(body.providers).toHaveLength(2)
  })

  it('GET /library returns the filtered listing', async () => {
    const res = await fetch(`${base}/api/images/library?q=hero`)
    const body = await res.json()
    expect(body.images[0].hash).toBe(HASH)
  })

  it('GET /:hash serves the image bytes from Mocky origin', async () => {
    const res = await fetch(`${base}/api/images/${HASH}`)
    expect(res.ok).toBe(true)
    expect(res.headers.get('content-type')).toMatch(/image\/jpeg/)
    const buf = Buffer.from(await res.arrayBuffer())
    expect(Buffer.compare(buf, IMG_BYTES)).toBe(0)
  })

  it('GET /:hash?download=1 sets an attachment disposition + filename', async () => {
    const res = await fetch(`${base}/api/images/${HASH}?download=1`)
    expect(res.ok).toBe(true)
    const cd = res.headers.get('content-disposition') || ''
    expect(cd).toMatch(/attachment/i)
    expect(cd).toMatch(/hero-a1b2c3d4\.jpg/)
  })

  it('rejects a malformed hash with 400', async () => {
    const res = await fetch(`${base}/api/images/not-a-hash`)
    expect(res.status).toBe(400)
  })

  it('returns 404 for a well-formed but unknown hash', async () => {
    const res = await fetch(`${base}/api/images/ffffffffffffffff`)
    expect(res.status).toBe(404)
  })

  it('POST /generate requires a prompt', async () => {
    const res = await fetch(`${base}/api/images/generate`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('POST /generate returns a hash + same-origin url', async () => {
    const res = await fetch(`${base}/api/images/generate`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: 'a bakery' }),
    })
    const body = await res.json()
    expect(body.hash).toBe(HASH)
    expect(body.url).toBe(`/api/images/${HASH}`)
  })

  it('POST /generate surfaces the skipped/placeholder path', async () => {
    const res = await fetch(`${base}/api/images/generate`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: 'skip' }),
    })
    expect(await res.json()).toEqual({ skipped: true })
  })
})
