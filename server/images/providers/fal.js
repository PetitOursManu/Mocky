// fal.ai image provider. Fal has its own API shape — NOT OpenAI-compatible:
//
//   POST https://fal.run/{model}          e.g. fal-ai/flux/schnell
//   Authorization: Key <FAL_KEY>          (note: "Key", not "Bearer")
//   { prompt, image_size: { width, height }, num_images, seed? }
//   → { images: [{ url, width, height, content_type }], seed }
//
// The result is a URL on fal.media: we download it ONCE server-side and store
// the bytes locally, so the sandbox still only ever sees Mocky's own origin
// (M2/M6 — no third-party image is hotlinked or proxied at render time).
//
// The synchronous endpoint is used (fast models like flux/schnell). A timeout
// guards against a slow model stalling the generation queue.

export const DEFAULT_FAL_MODEL = 'fal-ai/flux/schnell'
const DEFAULT_TIMEOUT_MS = 120_000

export function createFal(opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch
  const apiKey = String(opts.apiKey || '').trim()
  // Accept "fal-ai/flux/schnell" or a pasted full URL / leading slash.
  const model = String(opts.model || DEFAULT_FAL_MODEL)
    .trim()
    .replace(/^https?:\/\/(queue\.)?fal\.run\//, '')
    .replace(/^\/+|\/+$/g, '') || DEFAULT_FAL_MODEL
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : DEFAULT_TIMEOUT_MS

  async function withTimeout(fn) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      return await fn(ctrl.signal)
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    id: 'fal',
    requiresKey: true,

    async healthy() {
      return Boolean(apiKey)
    },

    async generate(req) {
      // Flux models have no negative_prompt field (and fal validates strictly),
      // so fold it into the prompt instead of sending an unknown key.
      const prompt = req.negative ? `${req.prompt}. Avoid: ${req.negative}` : req.prompt
      const body = {
        prompt,
        image_size: { width: Number(req.width) || 1024, height: Number(req.height) || 1024 },
        num_images: 1,
      }
      if (req.seed != null) body.seed = Number(req.seed)

      const res = await withTimeout((signal) =>
        fetchImpl(`https://fal.run/${model}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Key ${apiKey}` },
          body: JSON.stringify(body),
          signal,
        }),
      )
      if (!res || !res.ok) {
        let detail = ''
        try {
          detail = (await res.text()).slice(0, 200)
        } catch {
          /* ignore */
        }
        throw new Error(`fal HTTP ${res ? res.status : 'no-response'}${detail ? `: ${detail}` : ''}`)
      }

      const data = await res.json()
      const first = data?.images?.[0] ?? data?.image
      const url = typeof first === 'string' ? first : first?.url
      if (!url) throw new Error('fal returned no image')

      const img = await withTimeout((signal) => fetchImpl(url, { signal }))
      if (!img || !img.ok) throw new Error('fal: could not download the generated image')
      const buffer = Buffer.from(await img.arrayBuffer())
      if (!buffer.length) throw new Error('fal returned an empty image')
      return {
        buffer,
        contentType:
          (typeof first === 'object' && first?.content_type) ||
          (img.headers?.get && img.headers.get('content-type')) ||
          'image/jpeg',
        provider: 'fal',
      }
    },
  }
}
