// Cloudflare Workers AI image provider (free tier available, needs an account
// id + API token). Endpoint:
//   POST https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/run/{model}
//
// Response shape depends on the model: flux-* returns JSON
// `{ result: { image: "<base64>" } }`, Stable-Diffusion models return raw PNG
// bytes. Both are handled.

const API_BASE = 'https://api.cloudflare.com/client/v4'
export const DEFAULT_CF_MODEL = '@cf/black-forest-labs/flux-1-schnell'

export function createCloudflareImages(opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch
  const accountId = String(opts.accountId || '').trim()
  const apiToken = String(opts.apiToken || '').trim()
  const model = opts.model || DEFAULT_CF_MODEL

  return {
    id: 'cloudflare-workers-ai',
    requiresKey: true,

    async healthy() {
      return Boolean(accountId && apiToken)
    },

    async generate(req) {
      const url = `${API_BASE}/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`
      const body = { prompt: req.prompt }
      if (req.negative) body.negative_prompt = req.negative
      if (req.seed != null) body.seed = Number(req.seed)
      // Flux (schnell) ignores width/height; SD models honour them.
      if (req.width) body.width = Number(req.width)
      if (req.height) body.height = Number(req.height)

      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiToken}` },
        body: JSON.stringify(body),
      })
      if (!res || !res.ok) {
        let detail = ''
        try {
          detail = (await res.text()).slice(0, 200)
        } catch {
          /* ignore */
        }
        throw new Error(`cloudflare-workers-ai HTTP ${res ? res.status : 'no-response'}${detail ? `: ${detail}` : ''}`)
      }

      const ct = (res.headers?.get && res.headers.get('content-type')) || ''
      if (ct.includes('application/json')) {
        const data = await res.json()
        const b64 = data?.result?.image
        if (!b64) throw new Error('cloudflare-workers-ai returned no image')
        return { buffer: Buffer.from(b64, 'base64'), contentType: 'image/jpeg', provider: 'cloudflare-workers-ai' }
      }
      const buffer = Buffer.from(await res.arrayBuffer())
      if (!buffer.length) throw new Error('cloudflare-workers-ai returned an empty image')
      return { buffer, contentType: ct || 'image/png', provider: 'cloudflare-workers-ai' }
    },
  }
}
