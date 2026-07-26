// Pollinations image provider — the DEFAULT, zero-key path (prompt §4.1).
// URL-based API: https://image.pollinations.ai/prompt/{prompt}?width=&height=&seed=&model=flux
// A free token (Advanced settings) raises rate limits; without it the free tier
// may watermark — acceptable for mockups.
//
// Note: Pollinations has no negative-prompt parameter, so `negative` is folded
// into the prompt as a soft hint rather than a hard constraint.

const BASE = 'https://image.pollinations.ai'

export function createPollinations(opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch
  const token = opts.token || ''

  function buildUrl(req) {
    const promptText = req.negative
      ? `${req.prompt}. Avoid: ${req.negative}`
      : req.prompt
    const url = new URL(`${BASE}/prompt/${encodeURIComponent(promptText)}`)
    url.searchParams.set('width', String(req.width || 1024))
    url.searchParams.set('height', String(req.height || 1024))
    if (req.seed != null) url.searchParams.set('seed', String(req.seed))
    url.searchParams.set('model', req.model || 'flux')
    url.searchParams.set('nologo', token ? 'true' : 'false')
    if (token) url.searchParams.set('token', token)
    return url.toString()
  }

  return {
    id: 'pollinations',
    requiresKey: false,
    buildUrl,

    async healthy() {
      try {
        const res = await fetchImpl(`${BASE}/`, { method: 'GET' })
        return !!res && (res.ok || res.status === 405 || res.status === 404)
      } catch {
        return false
      }
    },

    async generate(req) {
      const url = buildUrl(req)
      const res = await fetchImpl(url, { method: 'GET' })
      if (!res || !res.ok) {
        throw new Error(`pollinations HTTP ${res ? res.status : 'no-response'}`)
      }
      const buffer = Buffer.from(await res.arrayBuffer())
      const contentType = (res.headers?.get && res.headers.get('content-type')) || 'image/jpeg'
      if (!buffer.length) throw new Error('pollinations returned empty image')
      return { buffer, contentType, provider: 'pollinations' }
    },
  }
}
