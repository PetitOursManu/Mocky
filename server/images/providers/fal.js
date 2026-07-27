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

  async function withTimeout(fn, what) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      return await fn(ctrl.signal)
    } catch (err) {
      // An abort here is almost always a wrong model id (fal holds the
      // connection instead of 404-ing) or a model too slow for the sync
      // endpoint. "This operation was aborted" tells the user nothing.
      if (err && (err.name === 'AbortError' || /abort/i.test(err.message || ''))) {
        throw new Error(
          `fal n'a pas répondu en ${Math.round(timeoutMs / 1000)}s (${what}). Vérifiez l'identifiant du modèle — il doit inclure le préfixe du propriétaire, ex. "fal-ai/flux/schnell" ou "fal-ai/bytedance/seedream/v4/text-to-image" — ou choisissez un modèle plus rapide.`,
        )
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  /** Model ids are "owner/app…" — a missing owner is the most common mistake. */
  function candidates() {
    return model.startsWith('fal-ai/') ? [model] : [model, `fal-ai/${model}`]
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

      // Try the id as given; if fal says "unknown app", retry once with the
      // "fal-ai/" owner prefix (the usual copy/paste omission).
      let res = null
      let lastError = ''
      for (const id of candidates()) {
        res = await withTimeout(
          (signal) =>
            fetchImpl(`https://fal.run/${id}`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: `Key ${apiKey}` },
              body: JSON.stringify(body),
              signal,
            }),
          `modèle "${id}"`,
        )
        if (res && res.ok) break
        let detail = ''
        try {
          detail = (await res.text()).slice(0, 200)
        } catch {
          /* ignore */
        }
        lastError = `fal HTTP ${res ? res.status : 'no-response'}${detail ? `: ${detail}` : ''}`
        // Only a "not found" is worth retrying with the prefix.
        if (!res || res.status !== 404) break
      }
      if (!res || !res.ok) throw new Error(lastError || 'fal request failed')

      const data = await res.json()
      const first = data?.images?.[0] ?? data?.image
      const url = typeof first === 'string' ? first : first?.url
      if (!url) throw new Error('fal returned no image')

      const img = await withTimeout((signal) => fetchImpl(url, { signal }), 'téléchargement du résultat')
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
