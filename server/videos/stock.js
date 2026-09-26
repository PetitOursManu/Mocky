// Free stock footage: search Pexels and Pixabay, import one clip into the
// library as an ordinary sequence.
//
// WHY THIS IS NOT A THIRD-PARTY-CONTENT PROBLEM (invariant M2)
//
// M2 forbids storing a third-party picture, and it is about Muse: the pages Muse
// reads are somebody's work, published for people to look at, and learning from
// them must never turn into copying them. A stock library is the opposite
// contract. Its footage is published FOR reuse, under a licence that says so,
// and nothing here happens on a guess — a person searches, looks, and imports
// one clip they chose. That is the upload button with the download step done by
// the server, and it is stored exactly as an upload is, with its credit kept.
//
// WHY THE SERVER RE-READS THE CLIP BY ID
//
// The browser sends a provider and an id, never a URL. The file to fetch is read
// back from the provider's own API with the administrator's key, so the only
// addresses this module ever downloads are ones Pexels or Pixabay handed it —
// and each of them still passes the SSRF guard, redirects included, because a
// CDN that answers 302 is a CDN that could answer 302 to anywhere.
import { assertSafeTargetResolved } from '../provider-proxy.js'

export const STOCK_PROVIDERS = ['pexels', 'pixabay']

/** Names a person reads, for the credit line and the interface. */
export const STOCK_LABELS = { pexels: 'Pexels', pixabay: 'Pixabay' }

/**
 * Where a first download may point. The API is what hands these out; the list
 * is a second opinion on it, so a compromised or confused response cannot aim
 * the server at an arbitrary host. Redirects from there are only held to the
 * SSRF guard: Pexels' Vimeo links bounce through a CDN whose name changes.
 */
const FILE_HOSTS = {
  pexels: /(^|\.)(pexels\.com|vimeo\.com)$/i,
  pixabay: /(^|\.)pixabay\.com$/i,
}

/**
 * The widest file worth downloading. The cutter scales every clip down to the
 * configured frame width (1920 at most), so a 4K source is four times the
 * download for the same frames.
 */
const MAX_SOURCE_WIDTH = 1920

/**
 * Pixabay's terms ask for search results to be cached for 24 hours, and the two
 * free tiers are small (Pexels: 200 an hour). One cache serves both: the same
 * search typed twice while browsing costs nothing the second time.
 */
const CACHE_MS = 24 * 60 * 60 * 1000
const CACHE_MAX = 300

const PER_PAGE = 24
const API_TIMEOUT_MS = 15_000
const DOWNLOAD_TIMEOUT_MS = 180_000
const MAX_REDIRECTS = 4

/** The words of a Pexels page slug: `/video/a-woman-on-a-beach-857251/`. */
export function pexelsTitle(pageUrl) {
  const m = /\/video\/([^/?#]+?)-\d+\/?(?:[?#]|$)/.exec(String(pageUrl || ''))
  return m ? m[1].replace(/-/g, ' ').trim() : ''
}

/**
 * Pick the file to download out of a clip's renditions: an mp4, the widest one
 * no wider than the cutter will keep, else the narrowest there is.
 *
 * @param {{ width: number, height?: number, link: string, type?: string, size?: number }[]} files
 */
export function pickRendition(files, maxWidth = MAX_SOURCE_WIDTH) {
  const mp4 = (files || []).filter(
    (f) => f && typeof f.link === 'string' && f.link && (!f.type || /mp4/i.test(f.type)) && Number(f.width) > 0,
  )
  if (!mp4.length) return null
  const fitting = mp4.filter((f) => Number(f.width) <= maxWidth).sort((a, b) => b.width - a.width)
  if (fitting.length) return fitting[0]
  return mp4.sort((a, b) => a.width - b.width)[0]
}

/** One Pexels video, in the shape the interface and the importer share. */
export function normalizePexels(v) {
  const files = (v?.video_files || []).map((f) => ({
    width: Number(f.width) || 0,
    height: Number(f.height) || 0,
    link: String(f.link || ''),
    type: String(f.file_type || ''),
  }))
  const preview = pickRendition(files, 640)
  return {
    provider: 'pexels',
    id: String(v?.id ?? ''),
    title: pexelsTitle(v?.url),
    thumbnail: String(v?.image || ''),
    preview: preview ? preview.link : '',
    duration: Number(v?.duration) || 0,
    width: Number(v?.width) || 0,
    height: Number(v?.height) || 0,
    author: String(v?.user?.name || ''),
    authorUrl: String(v?.user?.url || ''),
    pageUrl: String(v?.url || ''),
    files,
  }
}

/** One Pixabay video, same shape. */
export function normalizePixabay(v) {
  const sizes = ['large', 'medium', 'small', 'tiny']
  const files = sizes
    .map((k) => v?.videos?.[k])
    .filter((f) => f && f.url)
    .map((f) => ({
      width: Number(f.width) || 0,
      height: Number(f.height) || 0,
      link: String(f.url),
      size: Number(f.size) || 0,
    }))
  const preview = pickRendition(files, 640)
  const thumb =
    v?.videos?.medium?.thumbnail ||
    v?.videos?.small?.thumbnail ||
    v?.videos?.tiny?.thumbnail ||
    (v?.picture_id ? `https://i.vimeocdn.com/video/${v.picture_id}_640x360.jpg` : '')
  const user = String(v?.user || '')
  return {
    provider: 'pixabay',
    id: String(v?.id ?? ''),
    title: String(v?.tags || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 5).join(', '),
    thumbnail: String(thumb || ''),
    preview: preview ? preview.link : '',
    duration: Number(v?.duration) || 0,
    width: files[0]?.width || 0,
    height: files[0]?.height || 0,
    author: user,
    authorUrl: user && v?.user_id ? `https://pixabay.com/users/${encodeURIComponent(user)}-${v.user_id}/` : '',
    pageUrl: String(v?.pageURL || ''),
    files,
  }
}

/** What the browser is shown: everything but the list of files to download. */
function forBrowser(item) {
  const { files: _files, ...rest } = item
  return rest
}

/**
 * @param {object} deps
 * @param {() => { pexels?: { apiKey?: string }, pixabay?: { apiKey?: string } }} deps.keys
 *   read at call time, so a key saved in Admin applies without a restart
 * @param {typeof fetch} [deps.fetchImpl]
 * @param {(url: string) => Promise<URL>} [deps.guard]  the SSRF guard
 * @param {() => number} [deps.now]
 */
export function createStock({ keys, fetchImpl = fetch, guard = assertSafeTargetResolved, now = Date.now } = {}) {
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
      const err = new Error(`${STOCK_LABELS[provider]} is not configured on this instance (Admin → Videos (Muse) → Free stock videos).`)
      err.statusCode = 409
      err.code = 'no-key'
      throw err
    }
  }

  async function api(provider, url) {
    const cached = cache.get(url)
    if (cached && now() - cached.at < CACHE_MS) return cached.body
    const headers = provider === 'pexels' ? { Authorization: keyOf('pexels') } : {}
    const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(API_TIMEOUT_MS) })
    if (!res.ok) {
      // The two answers worth telling apart: a bad key is the administrator's
      // to fix, an exhausted quota is a matter of waiting.
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

  /**
   * One page of results. The key travels in a header for Pexels and in the
   * query for Pixabay, which is how each documents it; the Pixabay URL is
   * therefore a secret, and it only ever lives on this server.
   */
  async function search(provider, query, { page = 1 } = {}) {
    assertProvider(provider)
    const q = String(query || '').trim().slice(0, 100)
    if (!q) return { results: [], page: 1, hasMore: false }
    const p = Math.max(1, Math.min(50, Math.floor(Number(page) || 1)))
    if (provider === 'pexels') {
      const url = `https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(q)}&per_page=${PER_PAGE}&page=${p}`
      const body = await api(provider, url)
      const results = (body?.videos || []).map(normalizePexels).filter((v) => v.id && v.files.length)
      return { results: results.map(forBrowser), page: p, hasMore: Boolean(body?.next_page) }
    }
    const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(keyOf('pixabay'))}&q=${encodeURIComponent(q)}&per_page=${PER_PAGE}&page=${p}&safesearch=true`
    const body = await api(provider, url)
    const results = (body?.hits || []).map(normalizePixabay).filter((v) => v.id && v.files.length)
    return { results: results.map(forBrowser), page: p, hasMore: p * PER_PAGE < (Number(body?.totalHits) || 0) }
  }

  /** One clip by id, read back from the provider — never from the browser. */
  async function lookup(provider, id) {
    assertProvider(provider)
    const clean = String(id || '')
    if (!/^\d{1,20}$/.test(clean)) {
      const err = new Error('Invalid clip id.')
      err.statusCode = 400
      throw err
    }
    if (provider === 'pexels') {
      return normalizePexels(await api(provider, `https://api.pexels.com/v1/videos/videos/${clean}`))
    }
    const body = await api(provider, `https://pixabay.com/api/videos/?key=${encodeURIComponent(keyOf('pixabay'))}&id=${clean}`)
    const hit = body?.hits?.[0]
    if (!hit) {
      const err = new Error('This clip no longer exists on Pixabay.')
      err.statusCode = 404
      throw err
    }
    return normalizePixabay(hit)
  }

  /**
   * Download one file, bounded three ways: every hop through the SSRF guard,
   * a size limit enforced while READING (a missing or lying Content-Length
   * must not be what decides), and a timeout.
   */
  async function download(provider, link, maxBytes) {
    let url = new URL(link)
    if (url.protocol !== 'https:' || !FILE_HOSTS[provider].test(url.hostname)) {
      throw new Error(`Refusing to download from ${url.hostname}.`)
    }
    const signal = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await guard(url.href)
      const res = await fetchImpl(url.href, { redirect: 'manual', signal })
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get('location')
        if (!next) throw new Error('Redirect without a location.')
        url = new URL(next, url)
        if (url.protocol !== 'https:') throw new Error('Refusing a redirect away from https.')
        continue
      }
      if (!res.ok) throw new Error(`${STOCK_LABELS[provider]} file answered HTTP ${res.status}.`)
      const announced = Number(res.headers.get('content-length'))
      if (Number.isFinite(announced) && announced > maxBytes) throw tooLarge(maxBytes)
      const chunks = []
      let size = 0
      for await (const chunk of res.body) {
        size += chunk.length
        if (size > maxBytes) throw tooLarge(maxBytes)
        chunks.push(Buffer.from(chunk))
      }
      return Buffer.concat(chunks)
    }
    throw new Error('Too many redirects.')
  }

  /**
   * Fetch the clip a person chose, ready for the library: the bytes, and the
   * spec that records where it came from and who made it.
   */
  async function fetchClip(provider, id, { maxBytes }) {
    const item = await lookup(provider, id)
    const file = pickRendition(item.files)
    if (!file) {
      const err = new Error('No downloadable mp4 for this clip.')
      err.statusCode = 404
      throw err
    }
    if (file.size && file.size > maxBytes) throw tooLarge(maxBytes)
    const buffer = await download(provider, file.link, maxBytes)
    return {
      buffer,
      spec: {
        prompt: item.title || `${STOCK_LABELS[provider]} ${item.id}`,
        provider,
        model: '',
        credit: {
          source: provider,
          id: item.id,
          author: item.author,
          authorUrl: item.authorUrl,
          pageUrl: item.pageUrl,
        },
      },
    }
  }

  return { status, search, lookup, fetchClip }
}

function tooLarge(maxBytes) {
  const err = new Error(`This clip is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`)
  err.statusCode = 413
  return err
}
