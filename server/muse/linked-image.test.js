/**
 * POST /api/muse/linked-image — a picture given to Muse by link.
 *
 * A direct link to a flyer reached Muse's page fetcher, came back with no text,
 * and the screen followed nothing the person had pointed at. The composer now
 * asks this route first; these tests hold what it may and may not do with the
 * address it is handed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import { createMuseRouter, sniffLinkedImage, LINKED_IMAGE_MAX_BYTES } from './routes.js'
import { InspirationFetcher, looksLikePictureUrl } from './fetch/fetcher.js'

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)])
const GIF = Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(32)])
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

/** URL → { status, headers, body }; records every address actually requested. */
const routes = {
  'https://img.example/carte-remerciement-flyer.jpg': { body: JPEG, headers: { 'content-type': 'image/jpeg' } },
  'https://img.example/anim.gif': { body: GIF, headers: { 'content-type': 'image/gif' } },
  'https://img.example/x.svg': { body: SVG, headers: { 'content-type': 'image/svg+xml' } },
  'https://site.example/': { body: '<html><body>hello</body></html>', headers: { 'content-type': 'text/html; charset=utf-8' } },
  'https://img.example/huge.jpg': { body: JPEG, headers: { 'content-type': 'image/jpeg', 'content-length': String(LINKED_IMAGE_MAX_BYTES + 1) } },
  'https://img.example/hop': { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } },
}
const seen = []
async function fetchImpl(url) {
  seen.push(url)
  const r = routes[url]
  if (!r) return new Response('nope', { status: 404 })
  return new Response(r.body ?? null, { status: r.status ?? 200, headers: r.headers ?? {} })
}
const guard = async (u) => {
  if (/169\.254|127\.0\.0\.1|localhost/.test(u)) throw new Error('blocked')
}

let server, base
beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use('/api', createMuseRouter({ host: { status: () => [] }, guard, fetchImpl }))
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})
afterAll(() => server?.close())

const ask = (url) =>
  fetch(`${base}/api/muse/linked-image`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })

describe('a picture given to Muse by link', () => {
  it('comes back as its bytes, typed by its bytes, and never kept', async () => {
    const res = await ask('https://img.example/carte-remerciement-flyer.jpg')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(Buffer.from(await res.arrayBuffer()).equals(JPEG)).toBe(true)
  })

  it('takes a GIF, which the composer accepts pasted, and refuses an SVG', async () => {
    expect((await ask('https://img.example/anim.gif')).headers.get('content-type')).toBe('image/gif')
    const svg = await ask('https://img.example/x.svg')
    expect(svg.status).toBe(415)
    expect(await svg.json()).toEqual({ code: 'not-image' })
  })

  it('answers 415 for a page, so the composer leaves it to Muse', async () => {
    const res = await ask('https://site.example/')
    expect(res.status).toBe(415)
    expect(await res.json()).toEqual({ code: 'not-image' })
  })

  it('refuses a picture too large by its header, before reading it', async () => {
    const res = await ask('https://img.example/huge.jpg')
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ code: 'too-large' })
  })

  it('never reaches an internal address, even through a redirect', async () => {
    const direct = await ask('http://169.254.169.254/latest/meta-data')
    expect(direct.status).toBe(502)
    const hop = await ask('https://img.example/hop')
    expect(hop.status).toBe(502)
    // A word, never the remote's text or the guard's.
    expect(await hop.json()).toEqual({ code: 'unreachable' })
    expect(seen).not.toContain('http://169.254.169.254/latest/meta-data')
  })

  it('refuses anything but an http(s) address', async () => {
    expect((await ask('file:///etc/passwd')).status).toBe(400)
    expect((await ask('')).status).toBe(400)
  })
})

describe('what a picture is, by its bytes', () => {
  it('knows the library four, and nothing that can carry script', () => {
    expect(sniffLinkedImage(JPEG)).toBe('image/jpeg')
    expect(sniffLinkedImage(GIF)).toBe('image/gif')
    expect(sniffLinkedImage(SVG)).toBeNull()
    expect(sniffLinkedImage(Buffer.from('GIF8'))).toBeNull()
  })
})

describe("Muse's page fetcher, handed a picture anyway", () => {
  it('recognises a picture by its path, not by a guess at a query', () => {
    expect(looksLikePictureUrl('https://www.parfumdo.com/44258-large_default/carte-remerciement-flyer.jpg')).toBe(true)
    expect(looksLikePictureUrl('https://img.example/A.PNG?w=400')).toBe(true)
    expect(looksLikePictureUrl('https://site.example/jpg-gallery')).toBe(false)
    expect(looksLikePictureUrl('not a url')).toBe(false)
  })

  it('says why it skipped it, instead of "empty content"', async () => {
    const calls = []
    const router = { call: async (...a) => (calls.push(a), { content: [{ type: 'text', text: 'page' }] }) }
    const cache = { get: () => null, set: () => {} }
    const fetcher = new InspirationFetcher(router, cache, { robots: async () => true })
    const notices = []
    const out = await fetcher.fetch(['https://img.example/carte-remerciement-flyer.jpg'], { onNotice: (m) => notices.push(m) })
    expect(out).toEqual([])
    expect(calls).toEqual([])
    expect(notices.join(' ')).toMatch(/is a picture, not a page/)
  })
})
