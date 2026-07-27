// Server-side LLM client for Muse's Distill / Dossier stages.
//
// Today all of Mocky's LLM calls originate in the BROWSER; Muse's inspiration
// stages must run server-side because they process untrusted fetched content.
// Per ADR decision D7, the provider base URL + API key are forwarded PER REQUEST
// (from the same browser settings the /__provider proxy already uses) and are
// used only for the lifetime of the call — never persisted.
//
// Non-streamed + Ollama structured output (`format`), mirroring src/lib/plan.ts.
// Never uses the <<<MOCKY>>> sentinel path (that's for streamed code gen only).
import { assertSafeTarget } from '../provider-proxy.js'
import { buildUpstream, fromOpenAiResponse, KIND_OPENAI } from '../text/dialect.js'

/**
 * @typedef {object} ProviderCreds
 * @property {string} baseUrl
 * @property {string} model
 * @property {string} [apiKey]
 * @property {string} [kind]     'openai' routes through the dialect translation.
 * @property {boolean} [trusted] Admin-configured target — skips the SSRF guard,
 *   like /__provider does, so a local model (127.0.0.1) stays usable.
 */

/**
 * One chat call. Returns the assistant text. Positive `num_predict` always
 * (invariant I8 — Ollama Cloud rejects -1). Throws on any transport/HTTP error.
 *
 * Mocky speaks the Ollama dialect here too; OpenAI-compatible targets go through
 * the same translation the /__provider gateway uses, so Muse works on OpenAI,
 * OpenRouter, Groq… without a second code path.
 *
 * @param {ProviderCreds} creds
 * @param {{system:string, user:string, schema?:object, options?:object, timeoutMs?:number, signal?:AbortSignal}} req
 */
export async function museChat(creds, req) {
  const base = String(creds?.baseUrl || '').replace(/\/+$/, '')
  if (!base) throw new Error('Missing provider base URL')
  if (!creds.model) throw new Error('Missing model')
  if (!creds.trusted) assertSafeTarget(`${base}/api/chat`) // same SSRF guard as /__provider

  const num_predict = Math.max(1, Math.floor(req.options?.num_predict ?? 2048)) // I8: must be positive
  const body = {
    model: creds.model,
    stream: false,
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.user },
    ],
    options: { temperature: 0.5, num_ctx: 8192, ...(req.options || {}), num_predict },
  }
  if (req.schema) body.format = req.schema // Ollama structured output

  const plan = buildUpstream(
    { kind: creds.kind === KIND_OPENAI ? KIND_OPENAI : 'ollama', baseUrl: base, apiKey: creds.apiKey },
    '/api/chat',
    Buffer.from(JSON.stringify(body)),
  )

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), req.timeoutMs ?? 40000)
  const onExternalAbort = () => ctrl.abort()
  req.signal?.addEventListener('abort', onExternalAbort)
  try {
    const res = await fetch(plan.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...plan.headers },
      body: plan.body,
      signal: ctrl.signal,
    })
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Provider auth failed (HTTP ${res.status}) — check the API key`)
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Provider HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
    }
    const raw = await res.json()
    const data = plan.translate ? fromOpenAiResponse(raw) : raw
    const content = data?.message?.content ?? raw?.choices?.[0]?.message?.content ?? ''
    if (!content || !content.trim()) throw new Error('Empty model response')
    return content
  } finally {
    clearTimeout(timer)
    req.signal?.removeEventListener('abort', onExternalAbort)
  }
}

/**
 * Chat call that expects strict JSON back (structured output). Parses and
 * returns the object. Throws on non-JSON so callers can retry/degrade.
 * @param {ProviderCreds} creds
 * @param {{system:string, user:string, schema:object, options?:object, timeoutMs?:number, signal?:AbortSignal}} req
 */
export async function museJson(creds, req) {
  const content = await museChat(creds, req)
  try {
    return JSON.parse(content)
  } catch {
    // Some models wrap JSON in prose/fences despite `format`; salvage the object.
    const m = content.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        return JSON.parse(m[0])
      } catch {
        /* fall through */
      }
    }
    throw new Error('Model did not return valid JSON')
  }
}

/**
 * Build an injectable `llm` function bound to a set of credentials, so the
 * inspiration stages depend on a tiny interface (easy to fake in tests).
 * @param {ProviderCreds} creds
 * @returns {(req:object)=>Promise<any>}
 */
export function makeLlm(creds) {
  return (req) => museJson(creds, req)
}
