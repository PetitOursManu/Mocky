// InspirationFetcher — turns a list of URLs into distilled text, honoring the
// M7 limits: dedupe, cap at 6/run, robots.txt, honest User-Agent, 7-day
// text-only cache. Fetching itself is delegated to the `inspiration-fetch` MCP
// role (fetcher-mcp by default) via the router. Every failure degrades per-URL
// (M3): a bad or disallowed URL is skipped with a notice, the rest proceed.
import { assertSafeTargetResolved } from '../../provider-proxy.js'
import { robotsAllows } from './robots.js'

export const USER_AGENT = 'Mocky-Muse/0.1 (+https://github.com/PetitOursManu/Mocky)'
export const MAX_URLS_PER_RUN = 6
const FETCH_TIMEOUT_MS = 15000
/** Tool names fetcher-mcp (and friends) commonly expose, in preference order. */
const FETCH_TOOL_CANDIDATES = ['fetch_url', 'fetch', 'read_url', 'fetch_urls', 'read_urls']

/** Flatten an MCP tool result's content array into plain text. */
export function extractText(result) {
  if (!result) return ''
  const content = Array.isArray(result.content) ? result.content : []
  const parts = []
  for (const item of content) {
    if (item && item.type === 'text' && typeof item.text === 'string') parts.push(item.text)
    else if (typeof item === 'string') parts.push(item)
  }
  // Some servers return a top-level string or { text }.
  if (!parts.length && typeof result.text === 'string') parts.push(result.text)
  return parts.join('\n\n').trim()
}

function normalizeUrl(raw) {
  try {
    const u = new URL(String(raw).trim())
    u.hash = ''
    return u.toString()
  } catch {
    return null
  }
}

export class InspirationFetcher {
  /**
   * @param {import('../mcp/router.js').McpToolRouter} router
   * @param {import('./cache.js').MuseCache} cache
   * @param {object} [opts]
   * @param {string} [opts.userAgent]
   * @param {number} [opts.maxUrls]
   * @param {(url:string,ua:string,o?:object)=>Promise<boolean>} [opts.robots]
   */
  constructor(router, cache, opts = {}) {
    this.router = router
    this.cache = cache
    this.userAgent = opts.userAgent || USER_AGENT
    this.maxUrls = opts.maxUrls ?? MAX_URLS_PER_RUN
    this.robots = opts.robots || robotsAllows
    this.timeoutMs = opts.timeoutMs ?? FETCH_TIMEOUT_MS
  }

  /**
   * Fetch + distill a set of URLs.
   * @param {string[]} urls
   * @param {{onNotice?:(msg:string)=>void}} [opts]
   * @returns {Promise<Array<{url:string, markdown:string, fromCache:boolean}>>}
   */
  async fetch(urls, opts = {}) {
    const notice = opts.onNotice || (() => {})
    const seen = new Set()
    const targets = []
    for (const raw of urls || []) {
      const url = normalizeUrl(raw)
      if (!url || seen.has(url)) continue
      seen.add(url)
      targets.push(url)
      if (targets.length >= this.maxUrls) break
    }

    const out = []
    for (const url of targets) {
      try {
        // SSRF guard — never let a pasted URL reach an internal address.
        //
        // The RESOLVED guard, not the synchronous one. The literal-only half
        // sees `http://127.0.0.1.nip.io/` as an ordinary hostname, and every
        // wildcard-DNS service on the internet hands out that trick for free —
        // enough to read a NAS, a router admin page, or a cloud metadata
        // endpoint through the dossier this route returns to the caller.
        await assertSafeTargetResolved(url)

        const cached = this.cache.get(url)
        if (cached != null) {
          out.push({ url, markdown: cached, fromCache: true })
          continue
        }

        const allowed = await this.robots(url, this.userAgent, { timeoutMs: this.timeoutMs })
        if (!allowed) {
          notice(`Muse: robots.txt disallows ${url} — skipped`)
          continue
        }

        const result = await this.router.call(
          'inspiration-fetch',
          FETCH_TOOL_CANDIDATES,
          (toolName) => (toolName === 'fetch_urls' || toolName === 'read_urls' ? { urls: [url] } : { url }),
          { onNotice: notice },
        )
        if (!result) {
          notice(`Muse: no inspiration fetched for ${url}`)
          continue
        }

        const markdown = extractText(result)
        if (!markdown) {
          notice(`Muse: empty content for ${url}`)
          continue
        }

        this.cache.set(url, markdown)
        out.push({ url, markdown, fromCache: false })
      } catch (err) {
        notice(`Muse: fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return out
  }
}
