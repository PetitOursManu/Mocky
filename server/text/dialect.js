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

/**
 * The media type of a bare base64 image, read off its first bytes.
 *
 * Ollama's dialect carries raw base64 with no type, and every image used to be
 * relabelled `image/png`. That was true of the only images sent then — canvas
 * snips — and false of a reference screenshot, which the browser re-encodes as
 * JPEG to keep a tall page under the request cap. Several providers check the
 * declared type against the bytes and refuse a mismatch, so the label is read
 * rather than assumed. PNG stays the answer for anything unrecognised: that is
 * the previous behaviour, not a new guess.
 */
export function base64ImageType(b64) {
  if (b64.startsWith('/9j/')) return 'image/jpeg'
  if (b64.startsWith('UklGR')) return 'image/webp'
  if (b64.startsWith('R0lGOD')) return 'image/gif'
  return 'image/png'
}

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
        image_url: { url: /^data:/.test(b64) ? b64 : `data:${base64ImageType(b64)};base64,${b64}` },
      })),
    ],
  }
}

/**
 * A BUDGET FOR THINKING, and why it is asked of one vendor only.
 *
 * A reasoning model answered a generation with 110 220 characters of thinking
 * and no code — measured, from a real run — while `max_tokens: 16384` bounded
 * nothing, because the vendor does not count reasoning against it. A model that
 * thinks until it is stopped and never writes is a model that produced nothing,
 * and no amount of prompting fixes a budget.
 *
 * `reasoning` is OpenRouter's own parameter: it normalises the thinking budget
 * across the vendors behind it (an effort level here becomes a token budget
 * there) and IGNORES it for a model that cannot reason. That is why it is keyed
 * on the host rather than sent to every OpenAI-compatible endpoint — api.openai
 * .com answers 400 to a body key it does not know, so a blind `reasoning` would
 * break every OpenAI, Groq and Together user to fix one OpenRouter one.
 *
 * "low" and not "none": the models worth using here do think, and a screen
 * composed after a short plan is better than one composed after none. What is
 * refused is thinking without end.
 */
const THINKING_EFFORT = 'low'

/** The one vendor whose API defines `reasoning` — see THINKING_EFFORT. */
export function boundsThinking(baseUrl) {
  try {
    const host = new URL(String(baseUrl)).hostname.toLowerCase()
    return host === 'openrouter.ai' || host.endsWith('.openrouter.ai')
  } catch {
    return false
  }
}

/** A base URL's hostname, lower-cased, or '' for something that is not a URL. */
function hostOf(baseUrl) {
  try {
    return new URL(String(baseUrl)).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/**
 * WHERE A PROVIDER DIFFERS, AS DATA.
 *
 * "OpenAI-compatible" is a family resemblance, not a contract: each vendor
 * accepts the shape and then refuses one corner of it — a temperature it fixes,
 * a `response_format` it has not built, a token field it renamed. Before this
 * table the translator had exactly one such corner (`boundsThinking`, above,
 * whose tests pin its name) and the next vendor would have been a second `if`
 * on a hostname, then a third. One row per vendor, one source per row, and
 * `applyQuirks` is the only code that reads them.
 *
 * Keyed on the HOST and not on the preset id, because a browser-supplied
 * endpoint arrives with a base URL and a dialect and nothing else — a user who
 * pastes Gemini's address into "Compatible OpenAI" gets the same corrections as
 * one who picked the preset. A host no row names is left exactly as it was,
 * which is what keeps every existing configuration byte-identical.
 *
 * Fields, all optional:
 *  - `root: 'bare'` — the vendor documents its paths at the host root, with no
 *    version segment at all (see `openAiRoot`).
 *  - `drop` — body keys the vendor refuses.
 *  - `maxTokens` — a ceiling on `max_tokens`: a number, or a list of
 *    `{ models, value }` when the ceiling belongs to the MODEL rather than the
 *    vendor. No preset needs one — every default model was checked to accept
 *    the 16 384 a generation asks for — but a provider that caps lower answers
 *    400 rather than a shorter screen, and Cohere, reachable through
 *    "Compatible OpenAI", is exactly that case on its older models.
 *  - `maxTokensField` — the name the vendor now documents instead of `max_tokens`.
 *  - `jsonSchema: 'json_object'` — structured output is not implemented there;
 *    the caller gets plain JSON mode and validates the shape itself, which the
 *    planner already does for every answer (a wrong shape resolves to null).
 *  - `effort` — a `reasoning_effort` for the models matching `models`, for the
 *    reason THINKING_EFFORT gives: a default of "think as much as you like"
 *    spends the whole output budget before the first line of code.
 *  - `stripModelPrefix` — removed from the ids a model listing returns.
 */
export const PROVIDER_QUIRKS = [
  {
    // https://ai.google.dev/gemini-api/docs/openai — reasoning_effort maps to
    // Gemini's thinking level, and it "cannot be turned off for Gemini 2.5 Pro
    // or 3 models"; gemma models on the same host have no thinking config at
    // all, hence the model pattern. The listing names a model `models/gemini-…`,
    // the chat call takes the bare id, and the bare id is what a person reads.
    hosts: ['generativelanguage.googleapis.com'],
    effort: { value: THINKING_EFFORT, models: /^(?:models\/)?gemini-/i },
    stripModelPrefix: 'models/',
  },
  {
    // https://api-docs.deepseek.com/ and …/api/list-models document the paths at
    // the root (`https://api.deepseek.com/chat/completions`, `/models`);
    // https://api-docs.deepseek.com/api/create-chat-completion lists the
    // response_format types "text" and "json_object", and nothing else.
    hosts: ['api.deepseek.com'],
    root: 'bare',
    jsonSchema: 'json_object',
  },
  {
    // https://platform.kimi.ai/docs/api/models-overview — temperature is FIXED on
    // the current Kimi models and "passing any other value returns an error";
    // https://platform.kimi.ai/docs/api/chat documents max_completion_tokens, and
    // kimi-k3's reasoning_effort defaults to "max".
    hosts: ['api.moonshot.ai', 'api.moonshot.cn'],
    drop: ['temperature'],
    maxTokensField: 'max_completion_tokens',
    effort: { value: THINKING_EFFORT, models: /^kimi-k3/i },
  },
  {
    // https://docs.x.ai/developers/rest-api-reference/inference/chat-completions
    // — max_tokens is "[DEPRECATED] … in favor of `max_completion_tokens`".
    hosts: ['api.x.ai'],
    maxTokensField: 'max_completion_tokens',
  },
  {
    // Not a preset (no model listing — see config.js), but the "Compatible
    // OpenAI" label names it, so a pasted https://api.cohere.ai/compatibility/v1
    // must not fail every screen. https://docs.cohere.com/docs/models gives the
    // output ceilings PER MODEL: 64k on command-a-plus, 32k on the reasoning
    // model, 8k on command-a-03-2025 / translate / vision, 4k on the command-r
    // family — a flat vendor cap would halve the flagship for the old ones'
    // sake, and an unknown model is left alone. https://docs.cohere.com/docs/compatibility-api
    // shows `response_format` as `json_object` only.
    hosts: ['api.cohere.ai', 'api.cohere.com'],
    maxTokens: [
      { models: /^command-r/i, value: 4096 },
      { models: /^command-a-(?:03-2025|translate|vision)/i, value: 8192 },
    ],
    jsonSchema: 'json_object',
  },
]

/** The `max_tokens` ceiling a row sets for this model, or 0 for none. */
function ceilingFor(quirk, model) {
  const cap = quirk.maxTokens
  if (!cap) return 0
  if (typeof cap === 'number') return cap
  return cap.find((c) => c.models.test(String(model || '')))?.value || 0
}

/** The quirks row for a base URL, or null. Matches the host or a subdomain of it. */
export function quirksFor(baseUrl) {
  const host = hostOf(baseUrl)
  if (!host) return null
  return PROVIDER_QUIRKS.find((q) => q.hosts.some((h) => host === h || host.endsWith(`.${h}`))) || null
}

/** One quirks row applied to a translated chat body. Pure: returns a new object. */
export function applyQuirks(body, quirk) {
  if (!quirk) return body
  const out = { ...body }
  for (const key of quirk.drop || []) delete out[key]
  const ceiling = ceilingFor(quirk, out.model)
  if (ceiling && Number(out.max_tokens) > ceiling) out.max_tokens = ceiling
  if (quirk.maxTokensField && out.max_tokens != null) {
    out[quirk.maxTokensField] = out.max_tokens
    delete out.max_tokens
  }
  if (quirk.jsonSchema === 'json_object' && out.response_format?.type === 'json_schema') {
    out.response_format = { type: 'json_object' }
  }
  if (quirk.effort && quirk.effort.models.test(String(out.model || ''))) {
    out.reasoning_effort = quirk.effort.value
  }
  return out
}

/** `v1`, `v1beta`, `v2alpha1`… — how an OpenAI-compatible base URL ends when it is versioned. */
const VERSION_SEGMENT = /^v\d+[a-z0-9]*$/i

/**
 * Where `/chat/completions` and `/models` hang, for an OpenAI-compatible base.
 *
 * The translator always appended `/v1`, which is right for every base URL Mocky
 * shipped (api.openai.com, openrouter.ai/api, fal.run/…/openai) and wrong for a
 * vendor whose OpenAI surface lives elsewhere: Gemini's is `/v1beta/openai`,
 * Groq's `/openai/v1`, Qwen's `/compatible-mode/v1`. Those are exactly the URLs
 * their documentation tells people to paste, so a user who pasted Groq's into
 * "Compatible OpenAI" got `/openai/v1/v1/…` and a 404 that explained nothing.
 *
 * The rule: a base that already ENDS in a version — `…/v1`, or a version then
 * `openai` (`…/v1beta/openai`) — is used as it is. Anything else gets `/v1`,
 * as before, which is what keeps every working configuration on the URL it had;
 * fal's `…/router/openai` is `openai` after a NON-version and keeps its `/v1`.
 * A vendor documented at the bare root (`root: 'bare'`) gets nothing added,
 * but only for a base with no path at all: a path means someone chose it.
 */
export function openAiRoot(baseUrl, quirk = quirksFor(baseUrl)) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  let path = base
  try {
    path = new URL(base).pathname
  } catch {
    /* not a URL — read the string as the path; it fails upstream either way */
  }
  const segments = path.split('/').filter(Boolean)
  const last = segments[segments.length - 1] || ''
  const before = segments[segments.length - 2] || ''
  const versioned = VERSION_SEGMENT.test(last) || (last.toLowerCase() === 'openai' && VERSION_SEGMENT.test(before))
  if (versioned) return base
  if (quirk?.root === 'bare' && segments.length === 0) return base
  return `${base}/v1`
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

/**
 * OpenAI /v1/models listing → the Ollama /api/tags shape.
 *
 * `quirk` is the provider's row (`plan.quirks`), for the listings that name a
 * model differently from the way a request must. A bare ARRAY is accepted as
 * well as `{data: […]}`: Together answers its listing that way, and reading
 * only `data` turned a list of two hundred models into "no model returned".
 */
export function fromOpenAiModels(json, quirk = null) {
  const list = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []
  const prefix = quirk?.stripModelPrefix || ''
  const idOf = (m) => {
    const id = String(m?.id || m?.name || '')
    return prefix && id.startsWith(prefix) ? id.slice(prefix.length) : id
  }
  return { models: list.map((m) => ({ name: idOf(m) })).filter((m) => m.name) }
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
 * @returns {{url:string, headers:object, body:string|Buffer|undefined, translate:boolean, kind:string, isModels:boolean, quirks?:object|null}}
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

  // Where the vendor keeps its OpenAI surface, and what it refuses of it.
  const quirks = quirksFor(base)
  const root = openAiRoot(base, quirks)

  // Model listing: /api/tags → /v1/models
  if (subpath.startsWith('/api/tags')) {
    return {
      url: `${root}/models`,
      headers: { accept: 'application/json', ...auth },
      body: undefined,
      translate: true,
      kind: KIND_OPENAI,
      isModels: true,
      quirks,
    }
  }

  let parsed = {}
  try {
    parsed = rawBody && rawBody.length ? JSON.parse(rawBody.toString()) : {}
  } catch {
    parsed = {}
  }
  const out = toOpenAiRequest(parsed)
  // Only where the parameter exists — see `boundsThinking`.
  if (boundsThinking(base)) out.reasoning = { effort: THINKING_EFFORT }
  return {
    url: `${root}/chat/completions`,
    headers: { accept: 'application/json', 'content-type': 'application/json', ...auth },
    body: JSON.stringify(applyQuirks(out, quirks)),
    translate: true,
    kind: KIND_OPENAI,
    isModels: false,
    quirks,
  }
}
