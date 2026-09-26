import { describe, it, expect } from 'vitest'
import { createStock, pickRendition, pexelsTitle, normalizePexels, normalizePixabay } from './stock.js'
import { cleanCredit } from './library.js'

/**
 * The stock-footage client, against a fake network.
 *
 * Nothing here reaches Pexels or Pixabay: the fetch is injected, and so is the
 * SSRF guard, so the tests can say exactly which addresses the server would
 * have fetched — which is the property worth pinning. The two that matter most
 * are that the browser never chooses a URL, and that a key never leaves.
 */

const PEXELS_VIDEO = {
  id: 857251,
  width: 3840,
  height: 2160,
  duration: 12,
  url: 'https://www.pexels.com/video/a-woman-walking-on-the-beach-857251/',
  image: 'https://images.pexels.com/videos/857251/free-video-857251.jpg',
  user: { name: 'Jane Doe', url: 'https://www.pexels.com/@jane' },
  video_files: [
    { id: 1, quality: 'uhd', file_type: 'video/mp4', width: 3840, height: 2160, link: 'https://videos.pexels.com/video-files/857251/uhd.mp4' },
    { id: 2, quality: 'hd', file_type: 'video/mp4', width: 1920, height: 1080, link: 'https://videos.pexels.com/video-files/857251/hd.mp4' },
    { id: 3, quality: 'sd', file_type: 'video/mp4', width: 640, height: 360, link: 'https://videos.pexels.com/video-files/857251/sd.mp4' },
  ],
}

const PIXABAY_HIT = {
  id: 125,
  pageURL: 'https://pixabay.com/videos/id-125/',
  tags: 'flowers, yellow, blossom, spring, garden, extra',
  duration: 12,
  user: 'Coverr-Free-Footage',
  user_id: 1281706,
  videos: {
    large: { url: 'https://cdn.pixabay.com/video/large.mp4', width: 1920, height: 1080, size: 6615235, thumbnail: 'https://cdn.pixabay.com/video/large.jpg' },
    medium: { url: 'https://cdn.pixabay.com/video/medium.mp4', width: 1280, height: 720, size: 3562083, thumbnail: 'https://cdn.pixabay.com/video/medium.jpg' },
    small: { url: 'https://cdn.pixabay.com/video/small.mp4', width: 640, height: 360, size: 1030736, thumbnail: 'https://cdn.pixabay.com/video/small.jpg' },
    tiny: { url: 'https://cdn.pixabay.com/video/tiny.mp4', width: 480, height: 270, size: 426799, thumbnail: 'https://cdn.pixabay.com/video/tiny.jpg' },
  },
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** A fake network: routes by URL prefix, records every call. */
function network(routes) {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, headers: init.headers || {}, redirect: init.redirect })
    for (const [prefix, answer] of routes) {
      if (url.startsWith(prefix)) return typeof answer === 'function' ? answer(url) : answer.clone()
    }
    return new Response('not found', { status: 404 })
  }
  return { fetchImpl, calls }
}

const KEYS = { pexels: { apiKey: 'PEXELS-KEY' }, pixabay: { apiKey: 'PIXABAY-KEY' } }
const guarded = []
const guard = async (url) => {
  guarded.push(url)
  if (new URL(url).hostname.endsWith('.internal')) throw new Error('Private/internal IP targets are not allowed')
  return new URL(url)
}

function stockWith(routes, keys = KEYS) {
  const net = network(routes)
  return { stock: createStock({ keys: () => keys, fetchImpl: net.fetchImpl, guard }), calls: net.calls }
}

describe('reading the two catalogues', () => {
  it('turns a Pexels page slug into words', () => {
    expect(pexelsTitle(PEXELS_VIDEO.url)).toBe('a woman walking on the beach')
    expect(pexelsTitle('https://www.pexels.com/video/857251/')).toBe('')
  })

  it('picks the widest mp4 the cutter will keep, and never a 4K file it would throw away', () => {
    expect(pickRendition(normalizePexels(PEXELS_VIDEO).files).width).toBe(1920)
    expect(pickRendition(normalizePexels(PEXELS_VIDEO).files, 640).width).toBe(640)
    // Nothing narrow enough: the narrowest there is, rather than nothing.
    expect(pickRendition([{ width: 4096, link: 'https://x.pexels.com/a.mp4', type: 'video/mp4' }]).width).toBe(4096)
    expect(pickRendition([{ width: 1280, link: 'https://x.pexels.com/a.webm', type: 'video/webm' }])).toBeNull()
  })

  it('normalises both into one shape, with the credit the licences ask for', () => {
    const a = normalizePexels(PEXELS_VIDEO)
    expect(a).toMatchObject({ provider: 'pexels', id: '857251', author: 'Jane Doe', pageUrl: PEXELS_VIDEO.url })
    expect(a.preview).toMatch(/sd\.mp4$/)
    const b = normalizePixabay(PIXABAY_HIT)
    expect(b).toMatchObject({ provider: 'pixabay', id: '125', author: 'Coverr-Free-Footage', width: 1920 })
    expect(b.title).toBe('flowers, yellow, blossom, spring, garden')
    expect(b.authorUrl).toBe('https://pixabay.com/users/Coverr-Free-Footage-1281706/')
    expect(b.thumbnail).toBe('https://cdn.pixabay.com/video/medium.jpg')
  })
})

describe('search', () => {
  it('asks Pexels with the key in a header, and hands the browser no file list', async () => {
    const { stock, calls } = stockWith([['https://api.pexels.com/v1/videos/search', json({ videos: [PEXELS_VIDEO], next_page: 'x' })]])
    const out = await stock.search('pexels', 'beach')
    expect(calls[0].url).toContain('query=beach')
    expect(calls[0].headers.Authorization).toBe('PEXELS-KEY')
    expect(out.hasMore).toBe(true)
    expect(out.results[0].id).toBe('857251')
    expect(out.results[0]).not.toHaveProperty('files')
    expect(JSON.stringify(out)).not.toContain('PEXELS-KEY')
  })

  it('asks Pixabay with the key in the query — and that URL never reaches the answer', async () => {
    const { stock, calls } = stockWith([['https://pixabay.com/api/videos/', json({ totalHits: 30, hits: [PIXABAY_HIT] })]])
    const out = await stock.search('pixabay', 'fleurs', { page: 1 })
    expect(calls[0].url).toContain('key=PIXABAY-KEY')
    expect(calls[0].url).toContain('safesearch=true')
    expect(out.hasMore).toBe(true)
    expect(JSON.stringify(out)).not.toContain('PIXABAY-KEY')
  })

  it('answers the same search from the cache, as Pixabay asks and both quotas need', async () => {
    const { stock, calls } = stockWith([['https://pixabay.com/api/videos/', json({ totalHits: 1, hits: [PIXABAY_HIT] })]])
    await stock.search('pixabay', 'fleurs')
    await stock.search('pixabay', 'fleurs')
    expect(calls).toHaveLength(1)
  })

  it('refuses a library with no key, and says whose job that is', async () => {
    const { stock, calls } = stockWith([], { pexels: { apiKey: '' } })
    expect(stock.status()).toEqual({ pexels: false, pixabay: false })
    await expect(stock.search('pexels', 'beach')).rejects.toMatchObject({ statusCode: 409, code: 'no-key' })
    await expect(stock.search('youtube', 'beach')).rejects.toMatchObject({ statusCode: 400 })
    expect(calls).toHaveLength(0)
  })

  it('tells a refused key apart from an exhausted quota', async () => {
    const bad = stockWith([['https://api.pexels.com/', new Response('', { status: 401 })]])
    await expect(bad.stock.search('pexels', 'a')).rejects.toThrow(/refused the API key/)
    const busy = stockWith([['https://api.pexels.com/', new Response('', { status: 429 })]])
    await expect(busy.stock.search('pexels', 'a')).rejects.toMatchObject({ statusCode: 429 })
  })

  it('returns nothing for an empty query without spending a request', async () => {
    const { stock, calls } = stockWith([])
    expect(await stock.search('pexels', '   ')).toEqual({ results: [], page: 1, hasMore: false })
    expect(calls).toHaveLength(0)
  })
})

describe('import', () => {
  const MB = 1024 * 1024

  it('reads the clip back BY ID and downloads the file the provider named', async () => {
    const { stock, calls } = stockWith([
      ['https://api.pexels.com/v1/videos/videos/857251', json(PEXELS_VIDEO)],
      ['https://videos.pexels.com/video-files/857251/hd.mp4', new Response(Buffer.from('mp4-bytes'))],
    ])
    const { buffer, spec } = await stock.fetchClip('pexels', '857251', { maxBytes: MB })
    expect(buffer.toString()).toBe('mp4-bytes')
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.pexels.com/v1/videos/videos/857251',
      'https://videos.pexels.com/video-files/857251/hd.mp4',
    ])
    expect(spec).toMatchObject({ provider: 'pexels', prompt: 'a woman walking on the beach' })
    expect(spec.credit).toMatchObject({ source: 'pexels', author: 'Jane Doe', pageUrl: PEXELS_VIDEO.url })
  })

  it('accepts nothing but a numeric id — the browser never gets to name a URL', async () => {
    const { stock, calls } = stockWith([])
    await expect(stock.fetchClip('pexels', 'https://evil.example/x.mp4', { maxBytes: MB })).rejects.toMatchObject({ statusCode: 400 })
    await expect(stock.fetchClip('pexels', '../1', { maxBytes: MB })).rejects.toMatchObject({ statusCode: 400 })
    expect(calls).toHaveLength(0)
  })

  it('refuses a file on a host that is not the library\'s own', async () => {
    const odd = { ...PIXABAY_HIT, videos: { large: { ...PIXABAY_HIT.videos.large, url: 'https://attacker.example/x.mp4' } } }
    const { stock, calls } = stockWith([['https://pixabay.com/api/videos/', json({ hits: [odd] })]])
    await expect(stock.fetchClip('pixabay', '125', { maxBytes: 20 * MB })).rejects.toThrow(/Refusing to download from attacker\.example/)
    expect(calls.some((c) => c.url.includes('attacker'))).toBe(false)
  })

  it('follows a redirect only through the SSRF guard, hop by hop', async () => {
    guarded.length = 0
    const hop = new Response(null, { status: 302, headers: { location: 'https://cdn.internal/steal' } })
    const { stock, calls } = stockWith([
      ['https://pixabay.com/api/videos/', json({ hits: [PIXABAY_HIT] })],
      ['https://cdn.pixabay.com/video/large.mp4', hop],
    ])
    await expect(stock.fetchClip('pixabay', '125', { maxBytes: 10 * MB })).rejects.toThrow(/not allowed/)
    expect(guarded).toEqual(['https://cdn.pixabay.com/video/large.mp4', 'https://cdn.internal/steal'])
    expect(calls.find((c) => c.url.includes('cdn.pixabay.com')).redirect).toBe('manual')
    expect(calls.some((c) => c.url.includes('cdn.internal'))).toBe(false)
  })

  it('stops at the size limit — announced, stated by the catalogue, or counted while reading', async () => {
    // Stated by Pixabay: refused before any download.
    const stated = stockWith([['https://pixabay.com/api/videos/', json({ hits: [PIXABAY_HIT] })]])
    await expect(stated.stock.fetchClip('pixabay', '125', { maxBytes: 1000 })).rejects.toMatchObject({ statusCode: 413 })
    expect(stated.calls).toHaveLength(1)

    // No size anywhere, and a body larger than allowed: counted while reading.
    const unsized = { ...PEXELS_VIDEO }
    const counted = stockWith([
      ['https://api.pexels.com/v1/videos/videos/', json(unsized)],
      // A factory, not a shared Response: a clone is a tee, and cancelling one
      // branch of a tee waits for the other — the read below would never end.
      ['https://videos.pexels.com/', () => new Response(Buffer.alloc(5000))],
    ])
    await expect(counted.stock.fetchClip('pexels', '857251', { maxBytes: 1000 })).rejects.toMatchObject({ statusCode: 413 })
  })
})

describe('the credit kept with the clip', () => {
  it('keeps short strings and the libraries\' own https links, nothing else', () => {
    expect(
      cleanCredit({ source: 'pexels', id: 1, author: 'Jane', authorUrl: 'javascript:alert(1)', pageUrl: 'https://www.pexels.com/video/x-1/' }),
    ).toEqual({ source: 'pexels', id: '1', author: 'Jane', authorUrl: '', pageUrl: 'https://www.pexels.com/video/x-1/' })
    expect(cleanCredit({ source: 'pixabay', pageUrl: 'https://evil.example/' }).pageUrl).toBe('')
    expect(cleanCredit({ source: 'youtube' })).toBeNull()
    expect(cleanCredit(null)).toBeNull()
  })
})
