// OpenAI-compatible image provider. Works with OpenAI itself and with any
// gateway exposing `POST {baseUrl}/v1/images/generations` (LiteLLM, OpenRouter-
// style proxies, self-hosted shims…). Configured by an admin (base URL + key +
// model).
//
// Two response shapes are handled: `data[0].b64_json` (preferred) and
// `data[0].url` (fetched once, server-side — the image is then stored locally,
// so the sandbox still only ever sees Mocky's own origin, M6).

/** OpenAI image models only accept a fixed set of sizes — snap to the closest. */
export function snapSize(width, height) {
  const w = Number(width) || 1024
  const h = Number(height) || 1024
  const ratio = w / h
  if (ratio > 1.2) return '1536x1024' // landscape
  if (ratio < 0.83) return '1024x1536' // portrait
  return '1024x1024'
}

export function createOpenAiImages(opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch
  const baseUrl = String(opts.baseUrl || 'https://api.openai.com').replace(/\/+$/, '')
  const apiKey = opts.apiKey || ''
  const model = opts.model || 'gpt-image-1'

  async function call(req) {
    const body = {
      model,
      prompt: req.negative ? `${req.prompt}. Avoid: ${req.negative}` : req.prompt,
      n: 1,
      size: snapSize(req.width, req.height),
    }
    // `response_format` is supported by dall-e-*, rejected by gpt-image-1
    // (which always returns b64_json).
    if (/^dall-e/i.test(model)) body.response_format = 'b64_json'

    const res = await fetchImpl(`${baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    })
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

  return {
    id: 'openai-image',
    requiresKey: true,

    async healthy() {
      return Boolean(apiKey && baseUrl)
    },

    async generate(req) {
      const data = await call(req)
      const item = data?.data?.[0]
      if (!item) throw new Error('openai-image returned no image')
      if (item.b64_json) {
        return { buffer: Buffer.from(item.b64_json, 'base64'), contentType: 'image/png', provider: 'openai-image' }
      }
      if (item.url) {
        const img = await fetchImpl(item.url)
        if (!img || !img.ok) throw new Error('openai-image: could not download the result')
        return {
          buffer: Buffer.from(await img.arrayBuffer()),
          contentType: (img.headers?.get && img.headers.get('content-type')) || 'image/png',
          provider: 'openai-image',
        }
      }
      throw new Error('openai-image: unexpected response shape')
    },
  }
}
