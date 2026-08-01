import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createVideosRouter, PUBLIC_VIDEO_PATH } from './routes.js'

const HASH = 'a'.repeat(64)
const CLIP = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112]) // pretend mp4

let dir, server, base
/** Toggled per test — the two prerequisites are independent. */
let ffmpegAvailable = true
let ingested = null

function makeLibrary() {
  return {
    meta: (h) => (h === HASH ? { hash: HASH, frames: 4, width: 640, fps: 12 } : null),
    posterPath: (h) => (h === HASH ? path.join(dir, 'poster.jpg') : null),
    framePath: (h, i) => (h === HASH && Number(i) >= 1 && Number(i) <= 4 ? path.join(dir, 'poster.jpg') : null),
    list: () => [{ hash: HASH, frames: 4, prompt: 'p', provider: 'upload' }],
    remove: (h) => (h === HASH ? { removed: true } : null),
    async ingest(buffer, spec, opts) {
      ingested = { bytes: buffer.length, spec, opts }
      return { hash: HASH, meta: { hash: HASH, frames: 4, width: 640, fps: 12 }, fromCache: false }
    },
  }
}

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-vroutes-'))
  fs.writeFileSync(path.join(dir, 'poster.jpg'), Buffer.from([0xff, 0xd8, 0xff]))
  const app = express()
  app.use(
    '/api/videos',
    createVideosRouter({
      library: makeLibrary(),
      generate: async () => ({ hash: HASH, meta: { frames: 4 }, fromCache: false }),
      availability: async () => ({
        available: ffmpegAvailable,
        provider: '',
        model: '',
        ffmpeg: { available: ffmpegAvailable, reason: ffmpegAvailable ? undefined : 'not installed' },
        reason: ffmpegAvailable ? null : 'no-ffmpeg',
      }),
      recheck: async () => ({ available: true }),
      frameSettings: () => ({ fps: 9, width: 480, max: 50 }),
    }),
  )
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})

afterAll(async () => {
  await new Promise((r) => server.close(r))
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('PUBLIC_VIDEO_PATH', () => {
  /**
   * This regex is the whole authentication boundary for the video service: what
   * it matches is readable by anyone who knows the hash, and nothing else is.
   */
  it('opens the frame bytes and nothing else', () => {
    expect(PUBLIC_VIDEO_PATH.test(`/${HASH}/poster.jpg`)).toBe(true)
    expect(PUBLIC_VIDEO_PATH.test(`/${HASH}/f/1.jpg`)).toBe(true)
    expect(PUBLIC_VIDEO_PATH.test(`/${HASH}/f/150.jpg`)).toBe(true)

    expect(PUBLIC_VIDEO_PATH.test(`/${HASH}/meta`)).toBe(false)
    expect(PUBLIC_VIDEO_PATH.test('/library')).toBe(false)
    expect(PUBLIC_VIDEO_PATH.test('/generate')).toBe(false)
    expect(PUBLIC_VIDEO_PATH.test('/upload')).toBe(false)
    expect(PUBLIC_VIDEO_PATH.test('/availability')).toBe(false)
    // The clip itself is not public — only the pictures cut from it.
    expect(PUBLIC_VIDEO_PATH.test(`/${HASH}/source.mp4`)).toBe(false)
    expect(PUBLIC_VIDEO_PATH.test(`/${HASH}/f/../../../etc/passwd`)).toBe(false)
    expect(PUBLIC_VIDEO_PATH.test('/not-a-hash/f/1.jpg')).toBe(false)
  })
})

describe('POST /upload', () => {
  it('cuts the clip with the admin frame settings', async () => {
    ffmpegAvailable = true
    const res = await fetch(`${base}/api/videos/upload?name=demo.mp4&project=p1`, {
      method: 'POST',
      headers: { 'content-type': 'video/mp4' },
      body: CLIP,
    })
    expect(res.ok).toBe(true)
    const body = await res.json()
    expect(body).toMatchObject({ hash: HASH, frames: 4, base: `/api/videos/${HASH}` })
    expect(ingested.bytes).toBe(CLIP.length)
    expect(ingested.spec).toMatchObject({ provider: 'upload', project: 'p1', slot: 'hero' })
    expect(ingested.spec.prompt).toBe('demo.mp4')
    // Read at call time, so an admin change applies without a restart.
    expect(ingested.opts).toEqual({ fps: 9, width: 480, max: 50 })
  })

  it('refuses a container ffmpeg is not being offered', async () => {
    for (const type of ['image/png', 'application/zip', 'text/plain']) {
      const res = await fetch(`${base}/api/videos/upload`, {
        method: 'POST',
        headers: { 'content-type': type },
        body: CLIP,
      })
      expect(res.status, type).toBe(415)
    }
  })

  it('says 503 and names the missing piece when ffmpeg is absent', async () => {
    // An upload needs NO provider and no key — only ffmpeg. Reporting this as a
    // generic failure would send the admin looking for an API key they do not
    // need.
    ffmpegAvailable = false
    const res = await fetch(`${base}/api/videos/upload?name=x.mp4`, {
      method: 'POST',
      headers: { 'content-type': 'video/mp4' },
      body: CLIP,
    })
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('no-ffmpeg')
    ffmpegAvailable = true
  })
})

describe('serving a sequence', () => {
  it('serves the poster and the frames inside the sequence', async () => {
    for (const p of [`/${HASH}/poster.jpg`, `/${HASH}/f/1.jpg`, `/${HASH}/f/4.jpg`]) {
      const res = await fetch(`${base}/api/videos${p}`)
      expect(res.status, p).toBe(200)
      expect(res.headers.get('content-type'), p).toMatch(/image\/jpeg/)
      // Content-addressed: safe to cache forever.
      expect(res.headers.get('cache-control'), p).toMatch(/immutable/)
    }
  })

  it('404s past the end of the sequence', async () => {
    expect((await fetch(`${base}/api/videos/${HASH}/f/5.jpg`)).status).toBe(404)
    expect((await fetch(`${base}/api/videos/${'b'.repeat(64)}/f/1.jpg`)).status).toBe(404)
  })

  it('400s on anything that is not a hash', async () => {
    expect((await fetch(`${base}/api/videos/nope/meta`)).status).toBe(400)
  })
})
