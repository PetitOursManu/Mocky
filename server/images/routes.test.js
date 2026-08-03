import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { createImagesRouter } from './routes.js'

const HASH = 'a1b2c3d4a1b2c3d4' // valid format, 16 hex
const UPLOAD_HASH = 'b1b2c3d4b1b2c3d4'
const IMG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]) // pretend jpeg

let dir, server, base

/** One registry per image profile, so a test can assert which one was used. */
const registries = {
  content: {
    list: () => [
      { id: 'pollinations', requiresKey: false },
      { id: 'none', requiresKey: false },
    ],
  },
  inspiration: { list: () => [{ id: 'fal', requiresKey: true }] },
}
/** Records which registry the last /generate call resolved to. */
let lastRegistry = null
const registryFor = (p) => {
  lastRegistry = p === 'inspiration' ? 'inspiration' : 'content'
  return registries[lastRegistry]
}

function makeLibrary() {
  return {
    filePath: (h) => path.join(dir, `${h}.jpg`),
    fileExists: (h) => fs.existsSync(path.join(dir, `${h}.jpg`)),
    filenameFor: (h) => `hero-${h.slice(0, 8)}.jpg`,
    // Generated images are always JPEG; an upload keeps its own type.
    mimeFor: (h) => (h === UPLOAD_HASH ? 'image/png' : 'image/jpeg'),
    ingestUpload: (buffer, spec) => {
      // The real one stores the bytes; this must too, or the serve route below
      // has nothing to find.
      fs.writeFileSync(path.join(dir, `${UPLOAD_HASH}.jpg`), buffer)
      return {
        hash: UPLOAD_HASH,
        fromCache: false,
        meta: { hash: UPLOAD_HASH, prompt: spec.name, provider: 'upload', mime: spec.mime, tags: ['upload'] },
      }
    },
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
  app.use('/api/images', createImagesRouter({ library: makeLibrary(), registryFor }))
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
  it('GET /providers lists providers (content profile by default)', async () => {
    const res = await fetch(`${base}/api/images/providers`)
    expect(res.ok).toBe(true)
    const body = await res.json()
    expect(body.providers).toHaveLength(2)
    expect(body.providers[0].id).toBe('pollinations')
  })

  it('GET /providers?profile=inspiration lists the inspiration providers', async () => {
    const body = await (await fetch(`${base}/api/images/providers?profile=inspiration`)).json()
    expect(body.providers).toEqual([{ id: 'fal', requiresKey: true }])
  })

  // The art-direction reference and a hero photo run on different models, so
  // /generate must route to the registry matching the requested profile.
  it('POST /generate routes to the profile’s provider registry', async () => {
    lastRegistry = null
    await fetch(`${base}/api/images/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'a landing page mockup', profile: 'inspiration' }),
    })
    expect(lastRegistry).toBe('inspiration')

    await fetch(`${base}/api/images/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'a hero photo' }), // no profile → content
    })
    expect(lastRegistry).toBe('content')

    await fetch(`${base}/api/images/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'x', profile: 'nonsense' }), // unknown → content
    })
    expect(lastRegistry).toBe('content')
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

  it('lets an opaque origin read those bytes, which is what thumbnails need', async () => {
    // The capture shell is sandboxed without allow-same-origin, so its requests
    // are cross-origin and snapdom inlines a picture by FETCHING it. Without this
    // header the fetch fails and the thumbnail shows a grey placeholder where the
    // picture was — a silent, cosmetic-looking failure with a security cause.
    // Displaying an <img> never needed the header, so nothing here caught it.
    const res = await fetch(`${base}/api/images/${HASH}`)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  describe('POST /upload', () => {
    it('stores the bytes and reports where they landed', async () => {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
      const res = await fetch(`${base}/api/images/upload?name=photo.png&w=800&h=600`, {
        method: 'POST',
        headers: { 'content-type': 'image/png' },
        body: png,
      })
      expect(res.ok).toBe(true)
      const body = await res.json()
      expect(body.hash).toBe(UPLOAD_HASH)
      expect(body.url).toBe(`/api/images/${UPLOAD_HASH}`)
      expect(body.meta.provider).toBe('upload')
      expect(body.meta.mime).toBe('image/png')
      expect(body.meta.prompt).toBe('photo.png')
    })

    it('refuses a type it will later have to serve back', async () => {
      // SVG is an image and carries script. It is served from Mocky's own
      // origin, so it must not be accepted at all.
      for (const type of ['image/svg+xml', 'text/html', 'application/pdf', '']) {
        const res = await fetch(`${base}/api/images/upload?name=x`, {
          method: 'POST',
          headers: { 'content-type': type || 'application/octet-stream' },
          body: Buffer.from('x'),
        })
        expect(res.status, type).toBe(415)
      }
    })

    it('serves an uploaded PNG as a PNG, not as the JPEG it is stored as', async () => {
      const res = await fetch(`${base}/api/images/${UPLOAD_HASH}`)
      expect(res.headers.get('content-type')).toMatch(/image\/png/)
    })
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
