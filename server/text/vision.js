// Vision capability probe.
//
// There is no reliable "does this model accept images?" endpoint across
// providers, so we ask the model directly: one request carrying a 1×1 PNG.
// A provider that cannot take images rejects it (OpenAI returns 400 for a
// text-only model; Ollama errors on a non-vision family).
//
// Honest caveat: a 200 means the request was ACCEPTED, not that the model
// truly reasons about pixels — some gateways silently drop the image. So the
// UI says "détectée / non détectée", never "garantie".
import { buildUpstream } from './dialect.js'

/** 1×1 transparent PNG — the smallest valid image we can send. */
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

/** Probe results are stable per (baseUrl, model) — cache them for the process. */
const cache = new Map()
const keyOf = (t) => `${t.kind}|${t.baseUrl}|${t.model}`

/**
 * @param {{kind:string, baseUrl:string, apiKey?:string, model:string}} target
 * @param {{fetchImpl?:Function, force?:boolean, timeoutMs?:number}} [opts]
 * @returns {Promise<{vision:boolean, error?:string}>}
 */
export async function probeVision(target, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch
  const key = keyOf(target)
  if (!opts.force && cache.has(key)) return cache.get(key)

  const body = Buffer.from(
    JSON.stringify({
      model: target.model,
      stream: false,
      messages: [
        {
          role: 'user',
          content: 'Answer with the single word: ok',
          images: [TINY_PNG], // the dialect layer converts this for OpenAI
        },
      ],
      options: { num_predict: 16, temperature: 0 },
    }),
  )

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30000)
  let result
  try {
    const plan = buildUpstream(target, '/api/chat', body)
    const res = await fetchImpl(plan.url, {
      method: 'POST',
      headers: plan.headers,
      body: plan.body,
      signal: ctrl.signal,
    })
    if (res && res.ok) {
      result = { vision: true }
    } else {
      let detail = ''
      try {
        detail = (await res.text()).slice(0, 200)
      } catch {
        /* ignore */
      }
      result = { vision: false, error: `HTTP ${res ? res.status : 'no-response'}${detail ? `: ${detail}` : ''}` }
    }
  } catch (err) {
    result = { vision: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    clearTimeout(timer)
  }

  cache.set(key, result)
  return result
}

/** Drop cached probes (model or credentials changed). */
export function resetVisionCache() {
  cache.clear()
}

export { TINY_PNG }
