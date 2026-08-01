// fal.ai image provider. Fal has its own API shape — NOT OpenAI-compatible:
//
//   POST https://queue.fal.run/{model}     e.g. fal-ai/flux/schnell
//                                          or   bytedance/seedream/v5/pro/text-to-image
//   Authorization: Key <FAL_KEY>           (note: "Key", not "Bearer")
//   { prompt, image_size: { width, height }, num_images, seed? }
//   → { images: [{ url, width, height, content_type }], seed }
//
// IMPORTANT — model ids are NOT all under "fal-ai/". Many are published under
// their own namespace (bytedance/…, etc.). Never assume a prefix.
//
// The QUEUE endpoint is used rather than the blocking one: fal explicitly
// recommends it for models with slow inference (Seedream Pro takes ~110s), and
// a two-minute HTTP connection is fragile behind proxies/keep-alive. We submit,
// then poll the status URL until COMPLETED, then read the response URL.
//
// The result is a URL on fal.media: we download it ONCE server-side and store
// the bytes locally, so the sandbox still only ever sees Mocky's own origin
// (M2/M6 — no third-party image is hotlinked or proxied at render time).

export const DEFAULT_FAL_MODEL = 'fal-ai/flux/schnell'
/**
 * Text-to-video default. A different job and a different price bracket from the
 * image models above: seconds of inference become minutes, and one clip costs
 * more than a page of images. LTX is the fast end of what fal publishes, which
 * is the right default for a mockup tool — the admin picks something heavier in
 * Admin → Génération d'images if the result matters more than the wait.
 */
export const DEFAULT_FAL_VIDEO_MODEL = 'fal-ai/ltx-video'
/** Overall deadline for a generation (submit + polling + download). */
const DEFAULT_TIMEOUT_MS = 300_000
const POLL_INTERVAL_MS = 2_000
/** Per-HTTP-call timeout — each individual request should be quick. */
const CALL_TIMEOUT_MS = 60_000

export function createFal(opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch
  const apiKey = String(opts.apiKey || '').trim()
  // Accept "owner/app", a pasted full URL, or a leading slash.
  const model =
    String(opts.model || DEFAULT_FAL_MODEL)
      .trim()
      .replace(/^https?:\/\/(queue\.)?fal\.run\//, '')
      .replace(/^\/+|\/+$/g, '') || DEFAULT_FAL_MODEL
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : DEFAULT_TIMEOUT_MS
  const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)))
  const now = opts.now || (() => Date.now())

  const headers = { 'content-type': 'application/json', authorization: `Key ${apiKey}` }

  /** One HTTP call with its own short timeout. */
  async function call(url, init, what) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS)
    try {
      return await fetchImpl(url, { ...init, signal: ctrl.signal })
    } catch (err) {
      if (err && (err.name === 'AbortError' || /abort/i.test(err.message || ''))) {
        throw new Error(`fal ne répond pas (${what}) — réseau injoignable ou service indisponible.`)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  async function detail(res) {
    try {
      return (await res.text()).slice(0, 200)
    } catch {
      return ''
    }
  }

  /** Submit to the queue; retries once with the "fal-ai/" prefix on a 404. */
  async function submit(body) {
    const ids = model.startsWith('fal-ai/') ? [model] : [model, `fal-ai/${model}`]
    let lastError = ''
    for (const id of ids) {
      const res = await call(
        `https://queue.fal.run/${id}`,
        { method: 'POST', headers, body: JSON.stringify(body) },
        `envoi vers "${id}"`,
      )
      if (res && res.ok) return res.json()
      const d = await detail(res)
      lastError = `fal HTTP ${res ? res.status : 'no-response'}${d ? `: ${d}` : ''}`
      // Only an unknown model is worth retrying under the fal-ai/ namespace;
      // a real error (bad key, invalid params) must surface as-is.
      if (!res || res.status !== 404) break
    }
    throw new Error(lastError || 'fal: submission failed')
  }

  /**
   * Waits for a queued job and returns its payload.
   *
   * Split out of generate() because video generation needs exactly the same
   * dance — submit, poll until COMPLETED, read the response URL — with a
   * deadline measured in minutes rather than seconds.
   */
  async function awaitResult(queued, deadline, what) {
    const statusUrl = queued?.status_url
    const responseUrl = queued?.response_url
    if (!statusUrl || !responseUrl) throw new Error('fal: unexpected queue response (no status_url)')
    for (;;) {
      if (now() > deadline) {
        throw new Error(
          `fal n'a pas terminé en ${Math.round(timeoutMs / 1000)}s pour le modèle "${model}". Ce modèle est lent : augmentez le délai dans Admin → Génération d'images, ou choisissez un modèle plus rapide.`,
        )
      }
      await sleep(POLL_INTERVAL_MS)
      const res = await call(statusUrl, { headers }, 'suivi de la file')
      if (!res || !res.ok) throw new Error(`fal HTTP ${res ? res.status : 'no-response'} (statut)`)
      const status = await res.json()
      const s = String(status?.status || '').toUpperCase()
      if (s === 'COMPLETED') break
      if (s && s !== 'IN_QUEUE' && s !== 'IN_PROGRESS') {
        throw new Error(`fal: génération ${s.toLowerCase()}`)
      }
    }
    const final = await call(responseUrl, { headers }, `récupération ${what}`)
    if (!final || !final.ok) {
      const d = await detail(final)
      throw new Error(`fal HTTP ${final ? final.status : 'no-response'}${d ? `: ${d}` : ''} (résultat)`)
    }
    return final.json()
  }

  return {
    id: 'fal',
    requiresKey: true,

    async healthy() {
      return Boolean(apiKey)
    },

    /**
     * Text-to-video. Returns the clip's bytes, exactly like generate() returns
     * an image's — the caller stores them locally, so the sandbox still only
     * ever sees Mocky's own origin.
     *
     * Only `prompt` is sent. fal validates request bodies strictly and every
     * video model names its options differently (`duration` vs `num_frames` vs
     * `seconds`, `aspect_ratio` vs `resolution`); sending a key the chosen model
     * does not know is a 422, not a warning. The model's own defaults are the
     * only settings that work across all of them, and the admin chooses the
     * model.
     */
    async generateVideo(req) {
      const prompt = req.negative ? `${req.prompt}. Avoid: ${req.negative}` : req.prompt
      const body = { prompt }
      if (req.seed != null) body.seed = Number(req.seed)

      const deadline = now() + timeoutMs
      const queued = await submit(body)
      const result = queued?.video || queued?.videos ? queued : await awaitResult(queued, deadline, 'de la vidéo')

      const first = result?.video ?? result?.videos?.[0] ?? result?.output
      const url = typeof first === 'string' ? first : first?.url
      if (!url) throw new Error('fal returned no video')

      const clip = await call(url, {}, 'téléchargement de la vidéo')
      if (!clip || !clip.ok) throw new Error('fal: could not download the generated video')
      const buffer = Buffer.from(await clip.arrayBuffer())
      if (!buffer.length) throw new Error('fal returned an empty video')
      return {
        buffer,
        contentType:
          (typeof first === 'object' && first?.content_type) ||
          (clip.headers?.get && clip.headers.get('content-type')) ||
          'video/mp4',
        provider: 'fal',
        model,
      }
    },

    async generate(req) {
      // Flux/Seedream have no negative_prompt field (and fal validates
      // strictly), so fold it into the prompt instead of sending an unknown key.
      const prompt = req.negative ? `${req.prompt}. Avoid: ${req.negative}` : req.prompt
      const body = {
        prompt,
        image_size: { width: Number(req.width) || 1024, height: Number(req.height) || 1024 },
        num_images: 1,
      }
      if (req.seed != null) body.seed = Number(req.seed)

      const deadline = now() + timeoutMs
      const queued = await submit(body)
      // Some models answer immediately with the payload (no queue round-trip).
      const result = queued?.images ? queued : await awaitResult(queued, deadline, 'du résultat')

      const first = result?.images?.[0] ?? result?.image
      const url = typeof first === 'string' ? first : first?.url
      if (!url) throw new Error('fal returned no image')

      const img = await call(url, {}, 'téléchargement du résultat')
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
