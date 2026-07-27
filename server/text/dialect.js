// Mocky speaks ONE dialect everywhere — Ollama's (`/api/chat`, `{message:
// {content}}`, NDJSON streaming). Rather than teach the generator, the planner
// and the Muse stages about every vendor, the proxy translates at the edge:
//
//   browser (Ollama dialect) → [translate] → OpenAI-compatible provider
//                            ← [translate] ←
//
// So OpenAI, OpenRouter, Groq, Together, Mistral, DeepSeek… all work with zero
// changes to the generation code, and the Ollama path stays byte-identical
// (kind 'ollama' is a pure pass-through).

/** Provider kinds. 'ollama' = native pass-through; 'openai' = /v1 compatible. */
export const KIND_OLLAMA = 'ollama'
export const KIND_OPENAI = 'openai'

/** Turn an Ollama message into an OpenAI one (handles vision attachments). */
function toOpenAiMessage(m) {
  const images = Array.isArray(m.images) ? m.images.filter(Boolean) : []
  if (!images.length) return { role: m.role, content: m.content ?? '' }
  return {
    role: m.role,
    content: [
      { type: 'text', text: m.content ?? '' },
      ...images.map((b64) => ({
        type: 'image_url',
        // Ollama takes raw base64; OpenAI wants a data URL.
        image_url: { url: /^data:/.test(b64) ? b64 : `data:image/png;base64,${b64}` },
      })),
    ],
  }
}

/** Ollama chat body → OpenAI chat.completions body. */
export function toOpenAiRequest(body) {
  const out = {
    model: body.model,
    messages: (body.messages || []).map(toOpenAiMessage),
    stream: body.stream === true,
  }
  const opt = body.options || {}
  if (opt.temperature != null) out.temperature = opt.temperature
  // Ollama's num_predict is OpenAI's max_tokens (must stay positive — I8).
  if (Number(opt.num_predict) > 0) out.max_tokens = Number(opt.num_predict)
  // Ollama's `format` (JSON schema or "json") → OpenAI response_format.
  if (body.format) {
    out.response_format =
      typeof body.format === 'object'
        ? { type: 'json_schema', json_schema: { name: 'result', schema: body.format, strict: false } }
        : { type: 'json_object' }
  }
  return out
}

/** OpenAI non-streamed response → the Ollama shape Mocky expects. */
export function fromOpenAiResponse(json) {
  const content = json?.choices?.[0]?.message?.content ?? ''
  return { model: json?.model, message: { role: 'assistant', content }, done: true }
}

/** OpenAI /v1/models listing → the Ollama /api/tags shape. */
export function fromOpenAiModels(json) {
  const list = Array.isArray(json?.data) ? json.data : []
  return { models: list.map((m) => ({ name: m.id || m.name })).filter((m) => m.name) }
}

/**
 * Stateful SSE → NDJSON translator. OpenAI streams `data: {...}\n\n` frames;
 * Mocky's reader parses one JSON object per line. Returns the NDJSON to write
 * for each incoming chunk (may be empty), buffering partial frames.
 */
export function createSseTranslator() {
  let buffer = ''
  return function translate(chunkText) {
    buffer += chunkText
    const frames = buffer.split('\n')
    buffer = frames.pop() || '' // keep the trailing partial line
    let out = ''
    for (const raw of frames) {
      const line = raw.trim()
      if (!line || !line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const obj = JSON.parse(payload)
        const delta = obj?.choices?.[0]?.delta?.content
        if (delta) out += JSON.stringify({ message: { content: delta }, done: false }) + '\n'
      } catch {
        // Partial/!JSON frame — skip; the next chunk completes it.
      }
    }
    return out
  }
}

/**
 * Build the upstream request for a target.
 * @param {{kind:string, baseUrl:string, apiKey?:string}} target
 * @param {string} subpath  the Ollama-style path the client asked for
 * @param {Buffer|undefined} rawBody
 * @returns {{url:string, headers:object, body:string|Buffer|undefined, translate:boolean, kind:string, isModels:boolean}}
 */
export function buildUpstream(target, subpath, rawBody) {
  const base = String(target.baseUrl || '').replace(/\/+$/, '')
  const auth = target.apiKey ? { authorization: `Bearer ${target.apiKey}` } : {}

  if (target.kind !== KIND_OPENAI) {
    // Native Ollama — pass everything through untouched.
    return {
      url: base + subpath,
      headers: { accept: 'application/json', ...auth },
      body: rawBody,
      translate: false,
      kind: KIND_OLLAMA,
      isModels: false,
    }
  }

  // Model listing: /api/tags → /v1/models
  if (subpath.startsWith('/api/tags')) {
    return {
      url: `${base}/v1/models`,
      headers: { accept: 'application/json', ...auth },
      body: undefined,
      translate: true,
      kind: KIND_OPENAI,
      isModels: true,
    }
  }

  let parsed = {}
  try {
    parsed = rawBody && rawBody.length ? JSON.parse(rawBody.toString()) : {}
  } catch {
    parsed = {}
  }
  return {
    url: `${base}/v1/chat/completions`,
    headers: { accept: 'application/json', 'content-type': 'application/json', ...auth },
    body: JSON.stringify(toOpenAiRequest(parsed)),
    translate: true,
    kind: KIND_OPENAI,
    isModels: false,
  }
}
