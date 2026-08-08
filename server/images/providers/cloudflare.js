import { fetchWithTimeout } from './timeout.js'
import { readInit, clampStrength } from './init.js'

// Cloudflare Workers AI image provider (free tier available, needs an account
// id + API token). Endpoint:
//   POST https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/run/{model}
//
// Response shape depends on the model: flux-* returns JSON
// `{ result: { image: "<base64>" } }`, Stable-Diffusion models return raw PNG
// bytes. Both are handled.

const API_BASE = 'https://api.cloudflare.com/client/v4'
export const DEFAULT_CF_MODEL = '@cf/black-forest-labs/flux-1-schnell'

/**
 * The image-to-image default, and it is a DIFFERENT model, not a different
 * setting. Workers AI publishes exactly two models that take an input image —
 * `stable-diffusion-v1-5-img2img` and its inpainting sibling — and
 * `flux-1-schnell`, the text-to-image default above, is not one of them. An
 * edit profile that inherited that default would be configured to fail.
 */
export const DEFAULT_CF_EDIT_MODEL = '@cf/runwayml/stable-diffusion-v1-5-img2img'

/**
 * Which model ids can actually take `image_b64`.
 *
 * A pattern rather than the two exact ids, so a future revision (…-img2img-v2)
 * keeps working without a release here. The trade is deliberate and one-sided:
 * a wrong refusal is a message an admin reads and acts on, while a wrong
 * acceptance is a picture drawn from the prompt alone and reported as a
 * derivative of the user's own image — the failure this whole feature is built
 * to make impossible.
 */
const EDIT_MODEL = /img2img|inpainting/i

export function createCloudflareImages(opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch
  const accountId = String(opts.accountId || '').trim()
  const apiToken = String(opts.apiToken || '').trim()
  const model = opts.model || DEFAULT_CF_MODEL

  return {
    id: 'cloudflare-workers-ai',
    requiresKey: true,
    /** True of the PROVIDER. Whether the configured model can is checked per
     *  call — see DEFAULT_CF_EDIT_MODEL. */
    supportsInit: true,

    async healthy() {
      return Boolean(accountId && apiToken)
    },

    async generate(req) {
      const init = readInit(req, 'cloudflare-workers-ai')
      const strength = clampStrength(req.strength)
      if (init && !EDIT_MODEL.test(model)) {
        throw new Error(
          `cloudflare-workers-ai : le modèle « ${model} » ne fait que du texte-vers-image. Workers AI ne publie l'image-to-image que sous ${DEFAULT_CF_EDIT_MODEL} (ou sa variante …-inpainting) — renseignez-le dans le profil « Édition ». Lui envoyer l'image source rendrait une image issue du seul texte, présentée comme une dérivée de la vôtre.`,
        )
      }
      const url = `${API_BASE}/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`
      const body = { prompt: req.prompt }
      if (req.negative) body.negative_prompt = req.negative
      if (req.seed != null) body.seed = Number(req.seed)
      if (init) {
        // `image_b64` rather than the `image[]` array of byte values the same
        // endpoint also accepts: an array of integers inflates the JSON body
        // roughly fourfold for identical pixels.
        body.image_b64 = init.buffer.toString('base64')
        // Cloudflare's `strength` shares the contract's direction (1 = furthest
        // from the source), so it travels unchanged. Width and height do NOT
        // travel: on img2img the source image sets the geometry, and passing the
        // slot's dimensions would stretch the user's own picture to fit them.
        if (strength != null) body.strength = strength
      } else {
        // Flux (schnell) ignores width/height; SD models honour them.
        if (req.width) body.width = Number(req.width)
        if (req.height) body.height = Number(req.height)
      }

      const res = await fetchWithTimeout(fetchImpl, url, {
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

      const edited = init ? { edited: true, strengthApplied: strength != null } : {}
      const ct = (res.headers?.get && res.headers.get('content-type')) || ''
      if (ct.includes('application/json')) {
        const data = await res.json()
        const b64 = data?.result?.image
        if (!b64) throw new Error('cloudflare-workers-ai returned no image')
        return {
          buffer: Buffer.from(b64, 'base64'),
          contentType: 'image/jpeg',
          provider: 'cloudflare-workers-ai',
          ...edited,
        }
      }
      const buffer = Buffer.from(await res.arrayBuffer())
      if (!buffer.length) throw new Error('cloudflare-workers-ai returned an empty image')
      return { buffer, contentType: ct || 'image/png', provider: 'cloudflare-workers-ai', ...edited }
    },
  }
}
