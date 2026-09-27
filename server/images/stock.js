// Free stock PHOTOS: search Pexels and Pixabay, and put one photo into the image
// library as an ordinary picture — the still counterpart of server/videos/stock.js.
//
// Same contract as the footage, and the same reason it is not an M2 problem:
// these libraries publish their photos FOR reuse, under a licence that says so,
// and the file is stored with its author's credit exactly like an upload. The
// same administrator keys serve both (a Pexels or Pixabay key is not scoped to
// one medium), so there is no second place to paste them.
//
// Three ways in, and they differ on who chooses:
//
//  - search + import — a person looks at the results in Media and picks one.
//  - candidates + import — the GENERATION asks for "a photo of this", gets a
//    handful of thumbnails back, and a vision model LOOKS at them and picks
//    one, or none (src/lib/stockImages.ts). This is the path that works: a
//    first version picked on words alone and put a gas mask on a space page.
//  - pick — the same without eyes, for a model with no vision: the first result
//    of the best query, which is the search engine's own best guess.
//
// A query is retried shorter when it finds nothing, because even a query the
// model wrote for a search can be one word too specific.
//
// The browser never sends a URL. Every file downloaded here was named by the
// provider's own API, answered to the administrator's key, and still goes
// through the SSRF guard hop by hop (`downloadStockFile`).
import { assertSafeTargetResolved } from '../provider-proxy.js'
import { downloadStockFile, STOCK_LABELS, STOCK_PROVIDERS } from '../videos/stock.js'
import { sniffImageMime } from './library.js'

export { STOCK_PROVIDERS, STOCK_LABELS }

/** Where a photo may be downloaded from — a second opinion on the API's answer. */
const PHOTO_HOSTS = {
  pexels: /(^|\.)pexels\.com$/i,
  pixabay: /(^|\.)pixabay\.com$/i,
}

/** What an orientation is called by each library. */
export const ORIENTATIONS = ['landscape', 'portrait', 'square']
const PIXABAY_ORIENTATION = { landscape: 'horizontal', portrait: 'vertical' }

const CACHE_MS = 24 * 60 * 60 * 1000
const CACHE_MAX = 300
const PER_PAGE = 24
const API_TIMEOUT_MS = 15_000
const DOWNLOAD_TIMEOUT_MS = 60_000

/**
 * How many thumbnails a vision model is shown per picture. Enough that the
 * right photo is usually among them, few enough that one call stays cheap —
 * the thumbnails are ~350 px, a fraction of what one generated image costs.
 */
export const CANDIDATES_DEFAULT = 8
const CANDIDATES_MAX = 12
/** A thumbnail is a few dozen kilobytes; anything past this is not one. */
const THUMB_MAX_BYTES = 400 * 1024
const THUMB_TIMEOUT_MS = 15_000

/** The words of a Pexels page slug: `/photo/a-red-apple-on-a-table-1234/`. */
export function pexelsPhotoTitle(pageUrl) {
  const m = /\/photo\/([^/?#]+?)-\d+\/?(?:[?#]|$)/.exec(String(pageUrl || ''))
  return m ? m[1].replace(/-/g, ' ').trim() : ''
}

/** One Pexels photo, in the shape the interface and the importer share. */
export function normalizePexelsPhoto(p) {
  const src = p?.src || {}
  return {
    provider: 'pexels',
    id: String(p?.id ?? ''),
    title: String(p?.alt || '').trim() || pexelsPhotoTitle(p?.url),
    thumbnail: String(src.medium || src.small || src.tiny || ''),
    width: Number(p?.width) || 0,
    height: Number(p?.height) || 0,
    author: String(p?.photographer || ''),
    authorUrl: String(p?.photographer_url || ''),
    pageUrl: String(p?.url || ''),
    // ~1880 px on the long side: more than a hero needs, a fraction of the original.
    file: String(src.large2x || src.large || src.original || ''),
  }
}

/** One Pixabay photo, same shape. */
export function normalizePixabayPhoto(h) {
  const user = String(h?.user || '')
  return {
    provider: 'pixabay',
    id: String(h?.id ?? ''),
    title: String(h?.tags || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 5).join(', '),
    // Pixabay documents `_640` in this URL as swappable for `_340`: the size a
    // grid and a vision model both need, at a quarter of the bytes.
    thumbnail: String(h?.webformatURL || h?.previewURL || '').replace(/_640(\.\w+)$/, '_340$1'),
    width: Number(h?.imageWidth) || 0,
    height: Number(h?.imageHeight) || 0,
    author: user,
    authorUrl: user && h?.user_id ? `https://pixabay.com/users/${encodeURIComponent(user)}-${h.user_id}/` : '',
    pageUrl: String(h?.pageURL || ''),
    // 1280 px: the largest the free API hands out without full access.
    file: String(h?.largeImageURL || h?.webformatURL || ''),
  }
}

/** What the browser is shown: everything but the file to download. */
function forBrowser(item) {
  const { file: _file, ...rest } = item
  return rest
}

/**
 * The queries a search tries, longest first.
 *
 * A stock search matches words, and more words is fewer results: "a lone
 * lighthouse on a cliff at dusk" can find nothing where "lighthouse cliff"
 * finds hundreds. So the query shrinks until something comes back — never below
 * one word, never more than four tries.
 */
export function queryLadder(query) {
  const words = String(query || '').trim().split(/\s+/).filter(Boolean).slice(0, 6)
  const out = []
  for (const n of [words.length, 3, 2, 1]) {
    if (n <= 0 || n > words.length) continue
    const q = words.slice(0, n).join(' ')
    if (!out.includes(q)) out.push(q)
  }
  return out
}

/**
 * @param {object} deps
 * @param {() => { pexels?: { apiKey?: string }, pixabay?: { apiKey?: string } }} deps.keys  read at call time
 * @param {typeof fetch} [deps.fetchImpl]
 * @param {(url: string) => Promise<URL>} [deps.guard]
 * @param {() => number} [deps.now]
 */
export function createStockPhotos({ keys, fetchImpl = fetch, guard = assertSafeTargetResolved, now = Date.now } = {}) {
  const cache = new Map()
  const keyOf = (provider) => String(keys?.()?.[provider]?.apiKey || '')

  /** Which libraries are usable right now. Names only — a key never leaves. */
  function status() {
    return Object.fromEntries(STOCK_PROVIDERS.map((p) => [p, Boolean(keyOf(p))]))
  }

  function assertProvider(provider) {
    if (!STOCK_PROVIDERS.includes(provider)) {
      const err = new Error(`Unknown stock library "${provider}".`)
      err.statusCode = 400
      throw err
    }
    if (!keyOf(provider)) {
      const err = new Error(`${STOCK_LABELS[provider]} is not configured on this instance (Admin → Free stock videos and photos).`)
      err.statusCode = 409
      err.code = 'no-key'
      throw err
    }
  }

  /** The libraries with a key, or a named refusal when there is none. */
  function configured() {
    const providers = STOCK_PROVIDERS.filter((p) => keyOf(p))
    if (!providers.length) {
      const err = new Error('No free stock library is configured on this instance (Admin → Free stock videos and photos).')
      err.statusCode = 409
      err.code = 'no-key'
      throw err
    }
    return providers
  }

  async function api(provider, url) {
    const cached = cache.get(url)
    if (cached && now() - cached.at < CACHE_MS) return cached.body
    const headers = provider === 'pexels' ? { Authorization: keyOf('pexels') } : {}
    const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(API_TIMEOUT_MS) })
    if (!res.ok) {
      const err = new Error(
        res.status === 401 || res.status === 403
          ? `${STOCK_LABELS[provider]} refused the API key (HTTP ${res.status}).`
          : res.status === 429
            ? `${STOCK_LABELS[provider]}: too many requests for now — try again in a few minutes.`
            : `${STOCK_LABELS[provider]} answered HTTP ${res.status}.`,
      )
      err.statusCode = res.status === 429 ? 429 : 502
      throw err
    }
    const body = await res.json()
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
    cache.set(url, { at: now(), body })
    return body
  }

  /** One page of results, with the file URL still attached (server side only). */
  async function searchRaw(provider, query, { page = 1, orientation } = {}) {
    assertProvider(provider)
    const q = String(query || '').trim().slice(0, 100)
    if (!q) return { results: [], page: 1, hasMore: false }
    const p = Math.max(1, Math.min(50, Math.floor(Number(page) || 1)))
    const orient = ORIENTATIONS.includes(orientation) ? orientation : ''
    if (provider === 'pexels') {
      const url =
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${PER_PAGE}&page=${p}` +
        (orient ? `&orientation=${orient}` : '')
      const body = await api(provider, url)
      const results = (body?.photos || []).map(normalizePexelsPhoto).filter((r) => r.id && r.file)
      return { results, page: p, hasMore: Boolean(body?.next_page) }
    }
    // Pixabay has no "square"; asking for all is closer than asking for either side.
    const pxOrient = PIXABAY_ORIENTATION[orient] || 'all'
    const url =
      `https://pixabay.com/api/?key=${encodeURIComponent(keyOf('pixabay'))}&q=${encodeURIComponent(q)}` +
      `&image_type=photo&orientation=${pxOrient}&per_page=${PER_PAGE}&page=${p}&safesearch=true`
    const body = await api(provider, url)
    const results = (body?.hits || []).map(normalizePixabayPhoto).filter((r) => r.id && r.file)
    return { results, page: p, hasMore: p * PER_PAGE < (Number(body?.totalHits) || 0) }
  }

  async function search(provider, query, opts = {}) {
    const out = await searchRaw(provider, query, opts)
    return { ...out, results: out.results.map(forBrowser) }
  }

  /** One photo by id, read back from the provider — never from the browser. */
  async function lookup(provider, id) {
    assertProvider(provider)
    const clean = String(id || '')
    if (!/^\d{1,20}$/.test(clean)) {
      const err = new Error('Invalid photo id.')
      err.statusCode = 400
      throw err
    }
    if (provider === 'pexels') {
      return normalizePexelsPhoto(await api(provider, `https://api.pexels.com/v1/photos/${clean}`))
    }
    const body = await api(provider, `https://pixabay.com/api/?key=${encodeURIComponent(keyOf('pixabay'))}&id=${clean}`)
    const hit = body?.hits?.[0]
    if (!hit) {
      const err = new Error('This photo no longer exists on Pixabay.')
      err.statusCode = 404
      throw err
    }
    return normalizePixabayPhoto(hit)
  }

  /** The bytes of a normalised item, plus the record of where they came from. */
  async function download(item, maxBytes) {
    if (!item.file) {
      const err = new Error('No downloadable file for this photo.')
      err.statusCode = 404
      throw err
    }
    const buffer = await downloadStockFile(item.provider, item.file, {
      maxBytes,
      hosts: PHOTO_HOSTS,
      fetchImpl,
      guard,
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
    })
    return {
      buffer,
      spec: {
        name: item.title || `${STOCK_LABELS[item.provider]} ${item.id}`,
        width: item.width,
        height: item.height,
        provider: item.provider,
        credit: {
          source: item.provider,
          id: item.id,
          author: item.author,
          authorUrl: item.authorUrl,
          pageUrl: item.pageUrl,
        },
      },
    }
  }

  /** Fetch the photo a person — or a vision model — chose. */
  async function fetchPhoto(provider, id, { maxBytes }) {
    return download(await lookup(provider, id), maxBytes)
  }

  /**
   * The results of the longest query that finds anything, across the libraries
   * that have a key, minus the photos already used (`provider:id`). One library
   * down or out of quota is not the end: the other one answers. Throws only
   * when every library failed.
   */
  async function gather(query, { orientation, exclude = [], limit }) {
    const providers = configured()
    const skip = new Set((Array.isArray(exclude) ? exclude : []).map(String))
    let lastError = null
    let anyAnswered = false
    for (const q of queryLadder(query)) {
      const found = []
      for (const provider of providers) {
        try {
          const page = await searchRaw(provider, q, { orientation })
          anyAnswered = true
          for (const r of page.results) {
            if (found.length >= limit) break
            if (!skip.has(`${r.provider}:${r.id}`)) found.push(r)
          }
        } catch (err) {
          lastError = err
        }
        if (found.length >= limit) break
      }
      if (found.length) return { query: q, items: found }
    }
    if (!anyAnswered && lastError) throw lastError
    return { query: null, items: [] }
  }

  /**
   * Thumbnails to LOOK at, as data URLs: what a vision model is handed so it can
   * choose (src/lib/stockImages.ts). Fetched here rather than by the browser,
   * because the libraries' CDNs are not obliged to send CORS headers and the
   * model needs the bytes, not an address. A thumbnail that fails to download is
   * simply left out — seven candidates are as good as eight.
   */
  async function candidates(query, { orientation, exclude = [], count = CANDIDATES_DEFAULT } = {}) {
    const limit = Math.max(1, Math.min(CANDIDATES_MAX, Math.floor(Number(count) || CANDIDATES_DEFAULT)))
    const { query: used, items } = await gather(query, { orientation, exclude, limit })
    const withThumbs = await Promise.all(
      items.map(async (item) => {
        if (!item.thumbnail) return null
        try {
          const buf = await downloadStockFile(item.provider, item.thumbnail, {
            maxBytes: THUMB_MAX_BYTES,
            hosts: PHOTO_HOSTS,
            fetchImpl,
            guard,
            timeoutMs: THUMB_TIMEOUT_MS,
          })
          const mime = sniffImageMime(buf)
          if (!mime) return null
          return { ...forBrowser(item), thumb: `data:${mime};base64,${buf.toString('base64')}` }
        } catch {
          return null
        }
      }),
    )
    return { query: used, candidates: withThumbs.filter(Boolean) }
  }

  /**
   * Choose without looking, for a model that has no vision: the FIRST result of
   * the longest query that finds anything. The search engine's own ranking is
   * the best judgement available without eyes — the first version drew among
   * the top six at random, and every draw below the first was a worse match.
   *
   * Returns null when nothing matched anywhere. That is an answer, not an
   * error: the caller reports it and the screen is built without that picture.
   */
  async function pick(query, { orientation, exclude = [], maxBytes } = {}) {
    const { query: used, items } = await gather(query, { orientation, exclude, limit: 1 })
    if (!items.length) return null
    const out = await download(items[0], maxBytes)
    return { ...out, item: forBrowser(items[0]), query: used }
  }

  return { status, search, lookup, fetchPhoto, candidates, pick }
}
