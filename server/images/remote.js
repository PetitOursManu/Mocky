/**
 * Download ONE picture a person pointed at, by its address — held like the
 * provider proxy, because that is what it is: a request the server makes on a
 * browser's say-so.
 *
 * Two callers, and the reason this is one module: an assistant's picture by
 * address (server/mcp/images.js, which then files it in the library) and a
 * picture link given to Muse (POST /api/muse/linked-image, which hands the bytes
 * back once and keeps nothing). They read different things off the bytes; what
 * it takes to GET them safely is the same, and two copies of it would be one
 * redirect rule apart within a release.
 *
 * The SSRF guard on every hop (DNS included), redirects followed by hand and
 * re-checked, a size cap counted while reading — a `content-length` is a claim —
 * and a page refused on its headers, before its body is read: an address that
 * answers `text/html` is a page, and reading fifteen megabytes of it to let the
 * sniffer say so costs the site and the server for nothing.
 */

export const MAX_PICTURE_BYTES = 15 * 1024 * 1024
const MAX_REDIRECTS = 3
const FETCH_TIMEOUT_MS = 20_000

/**
 * @param {string} url
 * @param {object} d
 * @param {(url: string) => Promise<unknown>} d.guard  throws for an address the server must not reach
 * @param {typeof fetch} [d.fetchImpl]
 * @param {number} [d.maxBytes]
 * @param {Record<string,string>} [d.headers]
 * @param {AbortSignal} [d.signal]
 * @returns {Promise<Buffer>}
 */
export async function downloadPicture(url, d) {
  const fetchImpl = d.fetchImpl || fetch
  const maxBytes = d.maxBytes ?? MAX_PICTURE_BYTES
  const mb = Math.round(maxBytes / (1024 * 1024))
  let target = String(url || '')
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!/^https?:\/\//i.test(target)) throw Object.assign(new Error('Only http(s) addresses can be read.'), { code: 'bad-url' })
    await d.guard(target)
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
    const onAbort = () => ac.abort()
    d.signal?.addEventListener('abort', onAbort)
    try {
      const res = await fetchImpl(target, { redirect: 'manual', signal: ac.signal, headers: d.headers })
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        target = new URL(res.headers.get('location'), target).href
        continue
      }
      if (!res.ok) throw Object.assign(new Error(`The address answered HTTP ${res.status}.`), { code: 'http', status: res.status })
      const type = String(res.headers.get('content-type') || '').toLowerCase()
      if (/^(text\/|application\/(xhtml|json|xml))/.test(type)) {
        ac.abort()
        throw Object.assign(new Error('That address is a page, not a picture.'), { code: 'not-image' })
      }
      const declared = Number(res.headers.get('content-length') || 0)
      if (declared > maxBytes) throw Object.assign(new Error(`The picture is larger than ${mb} MB.`), { code: 'too-large' })
      const chunks = []
      let size = 0
      for await (const chunk of res.body) {
        size += chunk.length
        if (size > maxBytes) throw Object.assign(new Error(`The picture is larger than ${mb} MB.`), { code: 'too-large' })
        chunks.push(chunk)
      }
      return Buffer.concat(chunks)
    } finally {
      clearTimeout(timer)
      d.signal?.removeEventListener('abort', onAbort)
    }
  }
  throw Object.assign(new Error('Too many redirects.'), { code: 'redirects' })
}
