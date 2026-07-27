// Local Stable-Diffusion provider using the Automatic1111 / Forge / SD.Next
// HTTP API (`POST {baseUrl}/sdapi/v1/txt2img`). For power users with their own
// GPU — no key, no cloud, no rate limit.
//
// NOTE (deliberate): the base URL here is set by an ADMIN and is expected to be
// a local address (e.g. http://127.0.0.1:7860). It therefore bypasses the SSRF
// guard used for untrusted URLs — that is the whole point of a "local endpoint"
// provider, and an admin already controls this server.

export function createSdWebUi(opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch
  const baseUrl = String(opts.baseUrl || 'http://127.0.0.1:7860').replace(/\/+$/, '')
  const steps = Number(opts.steps) > 0 ? Number(opts.steps) : 20

  return {
    id: 'sd-webui',
    requiresKey: false,

    async healthy() {
      try {
        const res = await fetchImpl(`${baseUrl}/sdapi/v1/options`, { method: 'GET' })
        return Boolean(res && res.ok)
      } catch {
        return false
      }
    },

    async generate(req) {
      const body = {
        prompt: req.prompt,
        negative_prompt: req.negative || '',
        width: Number(req.width) || 1024,
        height: Number(req.height) || 1024,
        steps,
        batch_size: 1,
      }
      if (req.seed != null) body.seed = Number(req.seed)

      const res = await fetchImpl(`${baseUrl}/sdapi/v1/txt2img`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res || !res.ok) {
        throw new Error(`sd-webui HTTP ${res ? res.status : 'no-response'}`)
      }
      const data = await res.json()
      const b64 = data?.images?.[0]
      if (!b64) throw new Error('sd-webui returned no image')
      // A1111 sometimes prefixes a data URL.
      const clean = String(b64).replace(/^data:image\/[a-z]+;base64,/, '')
      return { buffer: Buffer.from(clean, 'base64'), contentType: 'image/png', provider: 'sd-webui' }
    },
  }
}
