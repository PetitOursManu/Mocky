/**
 * Pictures an ASSISTANT brings to a design: a free photo it chose among
 * thumbnails, or a picture it has — one it generated (ChatGPT hands a file over
 * as a download link, `openai/fileParams`) or found, by its address.
 *
 * Everything lands in the account's image library through the same doors the
 * interface uses (library.ingestStock / ingestUpload, the disk budget, the
 * stock access list), so the screen shows it from Mocky's own origin (M6) and
 * the Media page lists it like any other.
 *
 * A picture by address is the person's own upload, made by their assistant:
 * the same responsibility for its rights as a file dropped into Media, and the
 * same reason it is not a third-party picture Muse scraped (M2 is about what
 * Mocky goes and fetches on its own). What the server does to get it is the
 * dangerous part, and it is held like the provider proxy: the SSRF guard on
 * every hop (DNS included), redirects followed by hand and re-checked, a size
 * cap counted while reading, and the bytes sniffed — a JPEG, PNG or WebP, or
 * nothing. Never SVG: a picture served from Mocky's origin must not be able to
 * carry script.
 */
import { sniffImageMime } from '../images/library.js'

/** Same ceiling as an upload from the interface. */
export const MAX_PICTURE_BYTES = 15 * 1024 * 1024
const MAX_REDIRECTS = 3
const FETCH_TIMEOUT_MS = 20_000

/**
 * @param {object} d
 * @param {import('../images/library.js').ImageLibrary} d.library
 * @param {object|null} d.stock                       server/images/stock.js
 * @param {{ wouldExceed(n:number):boolean, add(n:number):void }|null} d.budget
 * @param {(user) => boolean} d.stockAccessFor
 * @param {(url: string) => Promise<unknown>} d.guard  throws for an address the server must not reach
 * @param {typeof fetch} [d.fetchImpl]
 */
export function createMcpPictures(d) {
  const fetchImpl = d.fetchImpl || fetch

  function store(buffer, ingest) {
    if (d.budget?.wouldExceed(buffer.length)) throw Object.assign(new Error('The storage quota of this Mocky is full.'), { code: 'quota' })
    const out = ingest()
    if (!out.fromCache) d.budget?.add(buffer.length)
    return out.hash
  }

  /** Download `url` as a picture, refusing anything the guard or the sniffer would. */
  async function download(url) {
    let target = String(url || '')
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!/^https?:\/\//i.test(target)) throw Object.assign(new Error('Only http(s) addresses can be read.'), { code: 'bad-url' })
      await d.guard(target)
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
      try {
        const res = await fetchImpl(target, { redirect: 'manual', signal: ac.signal })
        if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
          target = new URL(res.headers.get('location'), target).href
          continue
        }
        if (!res.ok) throw Object.assign(new Error(`The address answered HTTP ${res.status}.`), { code: 'http' })
        const declared = Number(res.headers.get('content-length') || 0)
        if (declared > MAX_PICTURE_BYTES) throw Object.assign(new Error('The picture is larger than 15 MB.'), { code: 'too-large' })
        const chunks = []
        let size = 0
        for await (const chunk of res.body) {
          size += chunk.length
          if (size > MAX_PICTURE_BYTES) throw Object.assign(new Error('The picture is larger than 15 MB.'), { code: 'too-large' })
          chunks.push(chunk)
        }
        return Buffer.concat(chunks)
      } finally {
        clearTimeout(timer)
      }
    }
    throw Object.assign(new Error('Too many redirects.'), { code: 'redirects' })
  }

  return {
    /** Whether this account may use free photos at all, and whether a library is configured. */
    freeAvailable(user) {
      const providers = d.stock?.status?.() || {}
      return Boolean(d.stock) && d.stockAccessFor(user) && Object.values(providers).some(Boolean)
    },

    /** Thumbnails for the assistant to LOOK at. Nothing is stored. */
    async searchFree(query, { orientation, count = 6 } = {}) {
      const out = await d.stock.candidates(String(query || '').slice(0, 200), { orientation, count })
      return {
        query: out.query,
        candidates: (out.candidates || []).map((c) => ({
          id: `${c.provider}:${c.id}`,
          title: c.title || '',
          author: c.author || '',
          page: c.pageUrl || '',
          width: c.width || 0,
          height: c.height || 0,
          thumb: c.thumb,
        })),
      }
    },

    /** Import a free photo the assistant chose (`pexels:123`). Returns its library hash. */
    async importFree(user, freeId, use) {
      const m = /^(pexels|pixabay):(\d{1,20})$/.exec(String(freeId || ''))
      if (!m) throw Object.assign(new Error('A free image id looks like "pexels:123", from search_free_images.'), { code: 'bad-id' })
      const got = await d.stock.fetchPhoto(m[1], m[2], { maxBytes: MAX_PICTURE_BYTES })
      return store(got.buffer, () => d.library.ingestStock(got.buffer, { ...got.spec, owner: user.id, project: '', tags: ['mcp'], name: use }))
    },

    /** Import a picture by its address (or ChatGPT's file link). Returns its library hash. */
    async importUrl(user, url, use) {
      const buffer = await download(url)
      const mime = sniffImageMime(buffer)
      if (!mime) throw Object.assign(new Error('That address is not a JPEG, PNG or WebP picture.'), { code: 'not-image' })
      return store(buffer, () => d.library.ingestUpload(buffer, { name: String(use || 'image from an assistant').slice(0, 200), owner: user.id, mime, tags: ['mcp'] }))
    },

    /** Whether `hash` is a picture of this account's — the only pictures a design may be given. */
    owns(user, hash) {
      return /^[a-f0-9]{64}$/.test(String(hash)) && Boolean(d.library.get(hash)) && d.library.ownedBy(hash, user.id)
    },
  }
}
