import { fetchWithTimeout } from './timeout.js'
import { readInit } from './init.js'

// OpenAI-compatible image provider. Works with OpenAI itself and with any
// gateway exposing `POST {baseUrl}/v1/images/generations` (LiteLLM, OpenRouter-
// style proxies, self-hosted shims…). Configured by an admin (base URL + key +
// model).
//
// Two response shapes are handled: `data[0].b64_json` (preferred) and
// `data[0].url` (fetched once, server-side — the image is then stored locally,
// so the sandbox still only ever sees Mocky's own origin, M6).
//
// Editing is the one path in this directory that changes TRANSPORT: JSON goes
// to /v1/images/generations, multipart/form-data goes to /v1/images/edits. No
// dependency is needed for it — FormData and Blob are globals at the Node 22.12
// floor — but the content-type header must be left alone, because the multipart
// boundary is computed by undici and a hand-written header replaces it with one
// that matches nothing.

/** OpenAI image models only accept a fixed set of sizes — snap to the closest. */
export function snapSize(width, height) {
  const w = Number(width) || 1024
  const h = Number(height) || 1024
  const ratio = w / h
  if (ratio > 1.2) return '1536x1024' // landscape
  if (ratio < 0.83) return '1024x1536' // portrait
  return '1024x1024'
}

/** The filename OpenAI reads the format from — it must agree with the mime. */
const EXTENSION = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

export function createOpenAiImages(opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch
  const baseUrl = String(opts.baseUrl || 'https://api.openai.com').replace(/\/+$/, '')
  const apiKey = opts.apiKey || ''
  const model = opts.model || 'gpt-image-1'

  const auth = () => (apiKey ? { authorization: `Bearer ${apiKey}` } : {})

  async function post(path, init) {
    const res = await fetchWithTimeout(fetchImpl, `${baseUrl}${path}`, { method: 'POST', ...init })
    if (!res || !res.ok) {
      let detail = ''
      try {
        detail = (await res.text()).slice(0, 200)
      } catch {
        /* ignore */
      }
      throw new Error(`openai-image HTTP ${res ? res.status : 'no-response'}${detail ? `: ${detail}` : ''}`)
    }
    return res.json()
  }

  function call(req) {
    const body = {
      model,
      prompt: req.negative ? `${req.prompt}. Avoid: ${req.negative}` : req.prompt,
      n: 1,
      size: snapSize(req.width, req.height),
    }
    // `response_format` is supported by dall-e-*, rejected by gpt-image-1
    // (which always returns b64_json).
    if (/^dall-e/i.test(model)) body.response_format = 'b64_json'

    return post('/v1/images/generations', {
      headers: { 'content-type': 'application/json', ...auth() },
      body: JSON.stringify(body),
    })
  }

  function callEdit(req, init) {
    const form = new FormData()
    form.append('model', model)
    form.append('prompt', req.negative ? `${req.prompt}. Avoid: ${req.negative}` : req.prompt)
    form.append('n', '1')
    form.append('size', snapSize(req.width, req.height))
    form.append('image', new Blob([init.buffer], { type: init.contentType }), `source.${EXTENSION[init.contentType]}`)
    if (/^dall-e/i.test(model)) form.append('response_format', 'b64_json')

    // `strength` is never forwarded. gpt-image-1 has no such parameter;
    // `input_fidelity: high|low` is a neighbouring axis — how much of the
    // original to preserve, in two steps, and absent from -mini — not the same
    // quantity as a 0..1 distance from the source. Mapping one onto the other
    // would put a number under a label it does not mean, which is a half-truth
    // rather than a translation. See the `strengthApplied: false` below.
    return post('/v1/images/edits', { headers: auth(), body: form })
  }

  return {
    id: 'openai-image',
    requiresKey: true,
    supportsInit: true,

    async healthy() {
      return Boolean(apiKey && baseUrl)
    },

    async generate(req) {
      const init = readInit(req, 'openai-image')
      const data = init ? await callEdit(req, init) : await call(req)
      const edited = init ? { edited: true, strengthApplied: false } : {}
      const item = data?.data?.[0]
      if (!item) throw new Error('openai-image returned no image')
      if (item.b64_json) {
        return {
          buffer: Buffer.from(item.b64_json, 'base64'),
          contentType: 'image/png',
          provider: 'openai-image',
          ...edited,
        }
      }
      if (item.url) {
        const img = await fetchWithTimeout(fetchImpl, item.url)
        if (!img || !img.ok) throw new Error('openai-image: could not download the result')
        return {
          buffer: Buffer.from(await img.arrayBuffer()),
          contentType: (img.headers?.get && img.headers.get('content-type')) || 'image/png',
          provider: 'openai-image',
          ...edited,
        }
      }
      throw new Error('openai-image: unexpected response shape')
    },
  }
}
