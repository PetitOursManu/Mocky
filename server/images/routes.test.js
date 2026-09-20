import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
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
/** Stands in for requireUser, which lives in server/index.js. Rewritten per test. */
let user
/** What the last /generate call handed the library, so the `pending` coercion is visible. */
let lastSpec
/** The confirmation state of the one image the fake library knows about. */
let pending, owners

/** One registry per image profile, so a test can assert which one was used. */
const registries = {
  content: {
    list: () => [
      { id: 'pollinations', requiresKey: false },
      { id: 'none', requiresKey: false },
    ],
  },
  inspiration: { list: () => [{ id: 'fal', requiresKey: true }] },
  /**
   * NULL when nothing is configured, exactly as `createImages` builds it. The
   * real `registryFor('edit')` answers null on an instance with no
   * image-to-image provider — the one substitution `resolveImageProfile`
   * forbids — so a fake that always returned a registry would have tested a
   * server that does not exist.
   */
  edit: null,
}
/** Records which registry the last /generate call resolved to. */
let lastRegistry = null
const registryFor = (p) => {
  lastRegistry = p === 'inspiration' || p === 'edit' ? p : 'content'
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
    get: (h) => (h === HASH ? { hash: HASH, prompt: 'p', pending, owners } : null),
    ownedBy: (h, id) => h === HASH && !!id && owners.includes(id),
    confirm: (h) => {
      if (h !== HASH) return null
      pending = undefined
      return { hash: HASH, prompt: 'p', owners }
    },
    async generate(spec) {
      lastSpec = spec
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
  app.use((req, _res, next) => {
    req.user = user
    next()
  })
  app.use('/api/images', createImagesRouter({ library: makeLibrary(), registryFor }))
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`
      resolve()
    })
  })
})

beforeEach(() => {
  user = { id: 'u1', role: 'user' }
  lastSpec = null
  pending = true
  owners = ['u1']
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

  /**
   * `profileOf` used to read "only two profiles exist; anything unknown is
   * content", and the third one turned that sentence into the substitution the
   * whole edit profile exists to forbid: a caller asking for image-to-image
   * would have been answered with the content registry — its providers listed as
   * available here, its key billed at /generate — while `resolveImageProfile`
   * two files away was carefully returning null to stop precisely that.
   *
   * An empty list, and a 503 below, because null is a configuration and not a
   * fault: there really is no image-to-image on this instance.
   */
  it('answers an empty list for an edit profile nobody configured, not the content one', async () => {
    const body = await (await fetch(`${base}/api/images/providers?profile=edit`)).json()
    expect(body.providers).toEqual([])
  })

  it('503s rather than borrowing the content provider for an unconfigured edit profile', async () => {
    lastSpec = null
    const res = await fetch(`${base}/api/images/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'derive this', profile: 'edit' }),
    })
    expect(res.status).toBe(503)
    // Nothing was generated, and nothing was billed to the content key.
    expect(lastSpec).toBeNull()
    expect(String((await res.json()).error)).toMatch(/edit/i)
  })

  /** A name nobody defined is still content: that caller made no choice. */
  it('still treats an unknown profile as content', async () => {
    lastRegistry = null
    await fetch(`${base}/api/images/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'hero', profile: 'wat' }),
    })
    expect(lastRegistry).toBe('content')
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

  it('accepts a prompt the size Muse actually writes', async () => {
    // The ceiling was 2000 and sat BELOW the application's own traffic: Muse
    // builds an image prompt out of the design dossier, and a dossier with any
    // substance goes past that. The 400 reached the user as "no image appeared,
    // and none in Media either" — no message, no cause.
    const res = await fetch(`${base}/api/images/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'a'.repeat(6000) }),
    })
    expect(res.status).not.toBe(400)
  })

  it('still refuses a prompt no one could have meant', async () => {
    // The guard stays: an absurd payload used to reach the provider and come
    // back as an opaque transport error rather than an answer.
    //
    // 50 000 rather than something wilder on purpose. Past roughly 100 kB the
    // body never reaches this route at all — express.json()'s own size limit
    // answers 413 first, which is a better refusal than ours and costs nothing.
    // So the band this check actually governs is the one between what Muse
    // writes and what the body parser will carry.
    const res = await fetch(`${base}/api/images/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'a'.repeat(50_000) }),
    })
    expect(res.status).toBe(400)
    // And it says how long it actually was — without that, a future refusal is
    // undebuggable from the console, which is exactly how the 2000-character
    // ceiling stayed invisible.
    const body = await res.json()
    expect(String(body.error)).toContain('50000')
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

  /**
   * The multi-step video flow makes its model image through this route, and the
   * step only means anything if the picture arrives unconfirmed. The coercion is
   * what keeps that a contract rather than an accident of `spec` being the body:
   * anything other than a literal `true` — including the string "true", which is
   * what a form-encoded client sends — leaves the image ordinary.
   */
  it('POST /generate marks an image pending only when the body says exactly true', async () => {
    const gen = (body) =>
      fetch(`${base}/api/images/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    await gen({ prompt: 'a model shot', pending: true })
    expect(lastSpec.pending).toBe(true)
    await gen({ prompt: 'a model shot', pending: 'true' })
    expect(lastSpec.pending).toBe(false)
    await gen({ prompt: 'a model shot' })
    expect(lastSpec.pending).toBe(false)
  })
})

/**
 * The other half of the video montage guard. The server refuses to build a film
 * out of a picture nobody confirmed; this is the only door that confirms one,
 * and it is irreversible — so who may open it is the whole test.
 */
describe('POST /:hash/confirm', () => {
  const confirm = (hash) => fetch(`${base}/api/images/${hash}/confirm`, { method: 'POST' })

  it('clears the flag for the account that asked for the image', async () => {
    const res = await confirm(HASH)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.confirmed).toBe(true)
    expect(pending).toBeUndefined()
  })

  /**
   * The library is instance-wide: every signed-in account lists it, and a hash
   * is all it takes to reach an image. Without this refusal a second account
   * could confirm the variants a first was still deciding about, and the first
   * would meet its own discards in the montage picker with nothing to explain
   * how they got there.
   */
  it('refuses an account that does not own the image, and changes nothing', async () => {
    user = { id: 'u2', role: 'user' }
    const res = await confirm(HASH)
    expect(res.status).toBe(403)
    expect(pending).toBe(true)
  })

  it('is not opened by being an administrator', async () => {
    // Ownership, not privilege. An admin has no more business deciding somebody
    // else has looked at a picture than any other account.
    user = { id: 'root', role: 'admin' }
    expect((await confirm(HASH)).status).toBe(403)
    expect(pending).toBe(true)
  })

  it('answers 404 for a hash the library never had, and 400 for a non-hash', async () => {
    expect((await confirm('c'.repeat(16))).status).toBe(404)
    expect((await confirm('not-a-hash')).status).toBe(400)
  })

  it('never hands back the owners list', async () => {
    // `owners` holds account ids and `publicUser()` deliberately withholds them.
    // This route answers with a metadata object, which is the shape that leaks
    // one if nobody strips it.
    const body = await (await confirm(HASH)).json()
    expect(body.meta).not.toHaveProperty('owners')
  })
})
