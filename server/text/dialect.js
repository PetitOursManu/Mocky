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

/**
 * How much THINKING a message carries, in characters.
 *
 * A reasoning model answers in two channels: `reasoning` (or
 * `reasoning_content`, the name varies by provider) and `content`. Mocky wants
 * the second one and must never mistake the first for it — a component
 * extracted from a chain of thought is not a component. But when `content` is
 * empty, the size of the thinking is the whole diagnosis: a model that spent
 * its entire output budget reasoning is a model that answered nothing, and the
 * user should be told THAT rather than "empty response".
 */
export function reasoningLength(node) {
  const parts = [node?.reasoning, node?.reasoning_content]
  let n = 0
  for (const part of parts) if (typeof part === 'string') n += part.length
  // Some providers send structured traces instead of a string.
  const details = node?.reasoning_details
  if (Array.isArray(details)) {
    for (const d of details) if (typeof d?.text === 'string') n += d.text.length
  }
  return n
}

/**
 * The error a 200 can carry.
 *
 * OpenRouter answers 200 and then puts the refusal in the BODY — no credit for
 * this model, rate limited, the upstream provider declined — both in a plain
 * response and as a frame in the middle of a stream. Read as a chat answer it
 * has no `content`, so it used to arrive at the browser as "the model returned
 * an empty response": the one message that is true of every possible cause and
 * useful for none.
 */
export function errorText(json) {
  const err = json?.error
  if (!err) return ''
  if (typeof err === 'string') return err
  const message = typeof err.message === 'string' ? err.message : ''
  const code = err.code ?? err.type
  return message ? (code ? `${message} (${code})` : message) : JSON.stringify(err).slice(0, 300)
}

/** OpenAI non-streamed response → the Ollama shape Mocky expects.
 *  `finish_reason` is carried over as Ollama's `done_reason` so the caller can
 *  tell a truncated answer (hit the token cap) from a complete one. */
export function fromOpenAiResponse(json) {
  const choice = json?.choices?.[0]
  const content = choice?.message?.content ?? ''
  const out = { model: json?.model, message: { role: 'assistant', content }, done: true }
  if (choice?.finish_reason) out.done_reason = choice.finish_reason
  // Both only matter when there is nothing to show; carried always because the
  // caller decides, and a field it ignores costs nothing.
  const error = errorText(json)
  if (error) out.error = error
  const reasoned = reasoningLength(choice?.message)
  if (reasoned) out.reasoned = reasoned
  return out
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
  /**
   * What the stream contained besides the answer.
   *
   * Read by the proxy when the stream ends, so a run that produced no content
   * can say what it DID produce. A generation that fails must name its cause:
   * "the model thought for 4 000 characters and wrote nothing" and "OpenRouter
   * refused: insufficient credits" are two different problems, and both used to
   * arrive as "the model returned an empty response".
   */
  const state = { reasoned: 0, content: 0, error: '' }
  function translate(chunkText) {
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
        // A refusal inside a 200: stated, not swallowed. The stream stops being
        // interesting after it, but the caller is the one that decides.
        const failure = errorText(obj)
        if (failure) {
          state.error = failure
          out += JSON.stringify({ error: failure, done: true }) + '\n'
          continue
        }
        const choice = obj?.choices?.[0]
        const delta = choice?.delta?.content
        // Thinking is counted and never forwarded: a component extracted from a
        // chain of thought is not a component.
        state.reasoned += reasoningLength(choice?.delta)
        if (delta) {
          state.content += delta.length
          out += JSON.stringify({ message: { content: delta }, done: false }) + '\n'
        }
        // Surface WHY the stream ended: "length" means the model was cut off by
        // the token cap, which the caller reports instead of a cryptic syntax error.
        if (choice?.finish_reason) {
          out += JSON.stringify({ done: true, done_reason: choice.finish_reason }) + '\n'
        }
      } catch {
        // Partial/!JSON frame — skip; the next chunk completes it.
      }
    }
    return out
  }
  translate.state = state
  return translate
}

/**
 * Authorization header for a target. Almost everyone uses `Bearer`; fal.ai
 * expects `Key <id>:<secret>` (a `Bearer` there is read as a JWT and rejected).
 */
export function authHeader(target) {
  if (!target.apiKey) return {}
  const scheme = target.auth === 'key' ? 'Key' : 'Bearer'
  return { authorization: `${scheme} ${target.apiKey}` }
}

/**
 * Build the upstream request for a target.
 * @param {{kind:string, baseUrl:string, apiKey?:string, auth?:string}} target
 * @param {string} subpath  the Ollama-style path the client asked for
 * @param {Buffer|undefined} rawBody
 * @returns {{url:string, headers:object, body:string|Buffer|undefined, translate:boolean, kind:string, isModels:boolean}}
 */
export function buildUpstream(target, subpath, rawBody) {
  const base = String(target.baseUrl || '').replace(/\/+$/, '')
  const auth = authHeader(target)

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
