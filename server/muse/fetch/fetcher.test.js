import { describe, it, expect, vi } from 'vitest'
import { InspirationFetcher, extractText, MAX_URLS_PER_RUN } from './fetcher.js'

/** In-memory cache stub. */
function memCache(seed = {}) {
  const map = { ...seed }
  return {
    map,
    get: (k) => (k in map ? map[k] : null),
    set: (k, v) => { map[k] = v },
  }
}

/** Router stub whose call() returns canned Markdown and records invocations. */
function memRouter(text = '# fetched') {
  const calls = []
  return {
    calls,
    call: async (role, tools, args, opts) => {
      const toolName = tools[0]
      const finalArgs = typeof args === 'function' ? args(toolName) : args
      calls.push({ role, toolName, args: finalArgs })
      return { content: [{ type: 'text', text }] }
    },
  }
}

const allowAll = async () => true

describe('extractText', () => {
  it('flattens text content parts', () => {
    expect(extractText({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] })).toBe('a\n\nb')
  })
  it('handles a top-level text field and empty results', () => {
    expect(extractText({ text: 'x' })).toBe('x')
    expect(extractText(null)).toBe('')
    expect(extractText({ content: [] })).toBe('')
  })
})

describe('InspirationFetcher.fetch', () => {
  it('fetches, extracts, and caches new URLs', async () => {
    const cache = memCache()
    const router = memRouter('# hello world')
    const f = new InspirationFetcher(router, cache, { robots: allowAll })
    const out = await f.fetch(['https://example.com/a'])
    expect(out).toEqual([{ url: 'https://example.com/a', markdown: '# hello world', fromCache: false }])
    expect(cache.get('https://example.com/a')).toBe('# hello world')
  })

  it('returns cached text without calling the router', async () => {
    const cache = memCache({ 'https://example.com/a': '# cached' })
    const router = memRouter()
    const f = new InspirationFetcher(router, cache, { robots: allowAll })
    const out = await f.fetch(['https://example.com/a'])
    expect(out[0]).toEqual({ url: 'https://example.com/a', markdown: '# cached', fromCache: true })
    expect(router.calls).toHaveLength(0)
  })

  it('dedupes and caps at MAX_URLS_PER_RUN', async () => {
    const cache = memCache()
    const router = memRouter()
    const f = new InspirationFetcher(router, cache, { robots: allowAll })
    const many = Array.from({ length: 10 }, (_, i) => `https://example.com/p${i}`)
    const dupes = ['https://example.com/p0', 'https://example.com/p0', ...many]
    const out = await f.fetch(dupes)
    expect(out.length).toBe(MAX_URLS_PER_RUN)
  })

  it('skips URLs disallowed by robots.txt with a notice', async () => {
    const onNotice = vi.fn()
    const f = new InspirationFetcher(memRouter(), memCache(), { robots: async () => false })
    const out = await f.fetch(['https://example.com/a'], { onNotice })
    expect(out).toEqual([])
    expect(onNotice).toHaveBeenCalledWith(expect.stringMatching(/robots\.txt disallows/i))
  })

  it('skips (SSRF) private/internal targets with a notice', async () => {
    const onNotice = vi.fn()
    const f = new InspirationFetcher(memRouter(), memCache(), { robots: allowAll })
    const out = await f.fetch(['http://localhost:8787/secret', 'http://169.254.169.254/latest'], { onNotice })
    expect(out).toEqual([])
    expect(onNotice).toHaveBeenCalled()
  })

  it('skips a URL when the router degrades to null', async () => {
    const onNotice = vi.fn()
    const router = { call: async () => null }
    const f = new InspirationFetcher(router, memCache(), { robots: allowAll })
    const out = await f.fetch(['https://example.com/a'], { onNotice })
    expect(out).toEqual([])
    expect(onNotice).toHaveBeenCalledWith(expect.stringMatching(/no inspiration/i))
  })

  it('passes the right arg shape per tool (fetch_url vs fetch_urls)', async () => {
    const router = memRouter()
    const f = new InspirationFetcher(router, memCache(), { robots: allowAll })
    await f.fetch(['https://example.com/a'])
    // memRouter picks tools[0] which is 'fetch_url' (first candidate)
    expect(router.calls[0]).toMatchObject({ role: 'inspiration-fetch', toolName: 'fetch_url', args: { url: 'https://example.com/a' } })
  })
})
