import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createStockPhotos,
  normalizePexelsPhoto,
  normalizePixabayPhoto,
  pexelsPhotoTitle,
  queryLadder,
} from './stock.js'
import { ImageLibrary, sniffImageMime } from './library.js'

/**
 * The free-photo client, against a fake network — the same posture as the
 * footage tests beside it: the fetch and the SSRF guard are injected, so the
 * tests say exactly what the server would have fetched.
 */

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)])

const PEXELS_PHOTO = (id, alt = 'A lighthouse on a cliff') => ({
  id,
  width: 4000,
  height: 3000,
  url: `https://www.pexels.com/photo/a-lighthouse-on-a-cliff-${id}/`,
  photographer: 'Jane Doe',
  photographer_url: 'https://www.pexels.com/@jane',
  alt,
  src: {
    original: `https://images.pexels.com/photos/${id}/original.jpeg`,
    large2x: `https://images.pexels.com/photos/${id}/large2x.jpeg`,
    medium: `https://images.pexels.com/photos/${id}/medium.jpeg`,
  },
})

const PIXABAY_PHOTO = {
  id: 77,
  pageURL: 'https://pixabay.com/photos/id-77/',
  tags: 'lighthouse, sea, cliff',
  imageWidth: 1920,
  imageHeight: 1280,
  webformatURL: 'https://pixabay.com/get/web.jpg',
  largeImageURL: 'https://pixabay.com/get/large.jpg',
  user: 'Max',
  user_id: 42,
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function network(routes) {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, headers: init.headers || {} })
    for (const [match, answer] of routes) {
      if (typeof match === 'function' ? match(url) : url.startsWith(match)) {
        return typeof answer === 'function' ? answer(url) : answer.clone()
      }
    }
    return new Response('not found', { status: 404 })
  }
  return { fetchImpl, calls }
}

const KEYS = { pexels: { apiKey: 'PEXELS-KEY' }, pixabay: { apiKey: 'PIXABAY-KEY' } }
const guard = async (u) => new URL(u)
const file = () => new Response(JPEG, { status: 200 })

describe('normalising a photo', () => {
  it('reads Pexels: alt text first, credit kept, the large file chosen', () => {
    const p = normalizePexelsPhoto(PEXELS_PHOTO(9))
    expect(p).toMatchObject({ provider: 'pexels', id: '9', title: 'A lighthouse on a cliff', author: 'Jane Doe' })
    expect(p.file).toBe('https://images.pexels.com/photos/9/large2x.jpeg')
    expect(pexelsPhotoTitle('https://www.pexels.com/photo/red-apple-12/')).toBe('red apple')
  })

  it('reads Pixabay the same way', () => {
    const p = normalizePixabayPhoto(PIXABAY_PHOTO)
    expect(p).toMatchObject({ provider: 'pixabay', id: '77', title: 'lighthouse, sea, cliff', author: 'Max' })
    expect(p.file).toBe('https://pixabay.com/get/large.jpg')
  })
})

describe('queryLadder', () => {
  it('shrinks a sentence down to one word, longest first', () => {
    expect(queryLadder('lighthouse cliff dusk storm')).toEqual(['lighthouse cliff dusk storm', 'lighthouse cliff dusk', 'lighthouse cliff', 'lighthouse'])
    expect(queryLadder('ocean')).toEqual(['ocean'])
    expect(queryLadder('   ')).toEqual([])
  })
})

describe('search', () => {
  it('never sends the file URL to the browser, and keeps the Pexels key in a header', async () => {
    const net = network([['https://api.pexels.com/v1/search', json({ photos: [PEXELS_PHOTO(1)] })]])
    const stock = createStockPhotos({ keys: () => KEYS, fetchImpl: net.fetchImpl, guard })
    const out = await stock.search('pexels', 'lighthouse', { orientation: 'landscape' })
    expect(out.results[0].file).toBeUndefined()
    expect(net.calls[0].url).toContain('orientation=landscape')
    expect(net.calls[0].url).not.toContain('PEXELS-KEY')
    expect(net.calls[0].headers.Authorization).toBe('PEXELS-KEY')
  })

  it('refuses a library with no key, by name', async () => {
    const stock = createStockPhotos({ keys: () => ({ pexels: { apiKey: 'k' } }), fetchImpl: async () => json({}), guard })
    await expect(stock.search('pixabay', 'x')).rejects.toMatchObject({ code: 'no-key', statusCode: 409 })
  })
})

describe('pick', () => {
  it('shortens the query until something is found, then downloads that photo', async () => {
    const net = network([
      [(u) => u.startsWith('https://api.pexels.com/v1/search') && u.includes('query=lighthouse%20cliff%20dusk'), json({ photos: [] })],
      [(u) => u.startsWith('https://api.pexels.com/v1/search') && u.includes('query=lighthouse%20cliff&'), json({ photos: [PEXELS_PHOTO(5)] })],
      ['https://images.pexels.com/', file()],
    ])
    const stock = createStockPhotos({ keys: () => ({ pexels: KEYS.pexels }), fetchImpl: net.fetchImpl, guard })
    const out = await stock.pick('lighthouse cliff dusk', { maxBytes: 1e6 })
    expect(out.query).toBe('lighthouse cliff')
    expect(out.item.id).toBe('5')
    expect(out.buffer.equals(JPEG)).toBe(true)
    expect(out.spec.credit).toMatchObject({ source: 'pexels', id: '5', author: 'Jane Doe' })
  })

  it('never hands back a photo already used in the series', async () => {
    const net = network([
      ['https://api.pexels.com/v1/search', json({ photos: [PEXELS_PHOTO(1), PEXELS_PHOTO(2)] })],
      ['https://images.pexels.com/', file()],
    ])
    const stock = createStockPhotos({ keys: () => ({ pexels: KEYS.pexels }), fetchImpl: net.fetchImpl, guard })
    const out = await stock.pick('lighthouse', { exclude: ['pexels:1'], maxBytes: 1e6 })
    expect(out.item.id).toBe('2')
  })

  it('tries the other library when the first is down', async () => {
    const net = network([
      ['https://api.pexels.com/', json({}, 500)],
      ['https://pixabay.com/api/', json({ hits: [PIXABAY_PHOTO], totalHits: 1 })],
      ['https://pixabay.com/get/', file()],
    ])
    const stock = createStockPhotos({ keys: () => KEYS, fetchImpl: net.fetchImpl, guard })
    const out = await stock.pick('lighthouse', { maxBytes: 1e6 })
    expect(out.item.provider).toBe('pixabay')
  })

  it('answers null when nothing matches anywhere', async () => {
    const net = network([['https://api.pexels.com/', json({ photos: [] })]])
    const stock = createStockPhotos({ keys: () => ({ pexels: KEYS.pexels }), fetchImpl: net.fetchImpl, guard })
    expect(await stock.pick('zzzz qqqq', { maxBytes: 1e6 })).toBeNull()
  })

  it('refuses to download from a host the library does not own', async () => {
    const evil = { ...PEXELS_PHOTO(3), src: { large2x: 'https://evil.example.com/x.jpg' } }
    const net = network([['https://api.pexels.com/', json({ photos: [evil] })]])
    const stock = createStockPhotos({ keys: () => ({ pexels: KEYS.pexels }), fetchImpl: net.fetchImpl, guard })
    await expect(stock.pick('x', { maxBytes: 1e6 })).rejects.toThrow(/Refusing to download/)
    expect(net.calls.some((c) => c.url.includes('evil.example.com'))).toBe(false)
  })
})

describe('candidates — what a vision model is shown', () => {
  it('hands back thumbnails as data URLs, across both libraries, minus the photos already used', async () => {
    const net = network([
      ['https://api.pexels.com/v1/search', json({ photos: [PEXELS_PHOTO(1), PEXELS_PHOTO(2)] })],
      ['https://pixabay.com/api/', json({ hits: [PIXABAY_PHOTO], totalHits: 1 })],
      ['https://images.pexels.com/', file()],
      ['https://pixabay.com/get/', file()],
    ])
    const stock = createStockPhotos({ keys: () => KEYS, fetchImpl: net.fetchImpl, guard })
    const out = await stock.candidates('lighthouse', { exclude: ['pexels:1'], count: 8 })
    expect(out.query).toBe('lighthouse')
    expect(out.candidates.map((c) => `${c.provider}:${c.id}`)).toEqual(['pexels:2', 'pixabay:77'])
    expect(out.candidates[0].thumb).toMatch(/^data:image\/jpeg;base64,/)
    // The full-size file is the server's to download, after the choice.
    expect(out.candidates[0].file).toBeUndefined()
    // Only thumbnails were fetched, never a large file.
    expect(net.calls.some((c) => c.url.includes('large2x') || c.url.includes('large.jpg'))).toBe(false)
  })

  it('leaves out a thumbnail that is not a picture', async () => {
    const net = network([
      ['https://api.pexels.com/v1/search', json({ photos: [PEXELS_PHOTO(1)] })],
      ['https://images.pexels.com/', new Response('<html>nope</html>', { status: 200 })],
    ])
    const stock = createStockPhotos({ keys: () => ({ pexels: KEYS.pexels }), fetchImpl: net.fetchImpl, guard })
    expect((await stock.candidates('lighthouse')).candidates).toEqual([])
  })
})

describe('storing a stock photo', () => {
  let dir
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-stockimg-'))
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('keeps the credit and the library it came from, and is not called an upload', () => {
    const lib = new ImageLibrary(dir)
    const out = lib.ingestStock(JPEG, {
      name: 'Lighthouse',
      provider: 'pexels',
      project: 'p1',
      credit: { source: 'pexels', id: '5', author: 'Jane', pageUrl: 'javascript:alert(1)' },
    })
    expect(out.meta).toMatchObject({ provider: 'pexels', mime: 'image/jpeg', prompt: 'Lighthouse' })
    expect(out.meta.tags).toEqual(expect.arrayContaining(['stock', 'pexels']))
    expect(out.meta.tags).not.toContain('upload')
    expect(out.meta.credit).toMatchObject({ source: 'pexels', author: 'Jane', pageUrl: '' })
  })

  it('refuses bytes that are not a photo', () => {
    const lib = new ImageLibrary(dir)
    expect(() => lib.ingestStock(Buffer.from('<svg onload=alert(1)></svg>'), { provider: 'pexels' })).toThrow(/not a JPEG/)
    expect(sniffImageMime(Buffer.from('<html>........'))).toBeNull()
  })
})
