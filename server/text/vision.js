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
import crypto from 'node:crypto'
import zlib from 'node:zlib'
import { buildUpstream } from './dialect.js'
import { crc32 } from '../images/zip.js'

/** Build a PNG chunk (length + type + data + CRC32). */
function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typed))
  return Buffer.concat([len, typed, crc])
}

/**
 * A solid-colour PNG of a REAL size. A 1×1 pixel looks like the obvious probe
 * image, but several vision models reject it outright ("the image length and
 * width do not meet the requirements") — which reads as "no vision" when the
 * model actually supports images perfectly well. A solid 256² compresses to
 * about a kilobyte, so this stays cheap.
 */
function makeSolidPng(size = 256, rgb = [128, 128, 128]) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3).fill(Buffer.from(rgb))])
  const raw = Buffer.concat(Array.from({ length: size }, () => row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]).toString('base64')
}

const TINY_PNG = makeSolidPng()

/**
 * Some providers reject the probe image for reasons that PROVE they read it
 * (wrong dimensions, unsupported ratio…). That is a vision-capable model, not a
 * text-only one — never report those as "no vision".
 */
function errorProvesVision(detail) {
  return /image (?:length|width|height|size|dimension|resolution|ratio)|pixels?\b.*(?:small|large)|too (?:small|large)/i.test(
    detail || '',
  )
}

/**
 * Probe results are stable per (baseUrl, model, credential) — cache them for the
 * process.
 *
 * The credential is part of the key, as a short hash. Without it the first
 * answer for a preset was everybody's: a mistyped key cached its 401 for every
 * user of api.openai.com + gpt-4o-mini until a restart, together with the
 * provider's error text, which can quote a masked fragment of that key. It did
 * not matter while bring-your-own-key probes always went to <base>/api/chat and
 * 404'd whatever the key; since the probe reads the dialect, it reaches the real
 * authenticated endpoint.
 */
const cache = new Map()
const keyOf = (t) =>
  `${t.kind}|${t.baseUrl}|${t.model}|${t.apiKey ? crypto.createHash('sha256').update(t.apiKey).digest('hex').slice(0, 16) : ''}`

/**
 * Only an answer about the MODEL is worth remembering: it accepted the image, or
 * it refused it with a 400. An auth failure, a rate limit, a server error or a
 * network error says something about this minute, and caching it refused every
 * screenshot until a restart after the key was fixed.
 */
const definitive = (result, status) => result.vision === true || status === 400

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
  let status = 0
  try {
    const plan = buildUpstream(target, '/api/chat', body)
    const res = await fetchImpl(plan.url, {
      method: 'POST',
      headers: plan.headers,
      body: plan.body,
      signal: ctrl.signal,
      // Not followed, and never read. A browser-supplied base passes the SSRF
      // guard as a public host, and that host can answer 302 to a metadata
      // address or a LAN port; following it, then echoing the first 400
      // characters of whatever answered, made this route the readable port
      // scanner invariants.md says is closed. Same rule as handleProviderProxy.
      redirect: 'manual',
    })
    status = res ? res.status : 0
    if (res && (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400))) {
      result = { vision: false, error: 'redirect not followed' }
    } else if (res && res.ok) {
      result = { vision: true }
    } else {
      let detail = ''
      try {
        detail = (await res.text()).slice(0, 400)
      } catch {
        /* ignore */
      }
      // A complaint ABOUT the image means the model parsed it → it has vision.
      result = errorProvesVision(detail)
        ? { vision: true }
        : { vision: false, error: `HTTP ${res ? res.status : 'no-response'}${detail ? `: ${detail}` : ''}` }
    }
  } catch (err) {
    result = { vision: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    clearTimeout(timer)
  }

  if (definitive(result, status)) cache.set(key, result)
  return result
}

/**
 * The probe target for a browser-configured provider ("bring your own key"),
 * read off the same headers `/__provider` gets from src/lib/proxy.ts — or null
 * when there is no base URL or no model.
 *
 * The kind is read and not assumed: this route hard-coded `ollama` and so
 * posted to `<base>/api/chat` for every OpenAI-dialect provider in the picker,
 * got a 404, and reported "no vision" for Gemini, Grok or GPT-4o — after which
 * the inspiration image was dropped for a model that could see it.
 * `credsFromReq` in server/muse/llm.js fixed the same bug for Muse's routes.
 */
export function browserVisionTarget(req) {
  const baseUrl = String(req.headers['x-provider-base'] || '').replace(/\/+$/, '')
  const auth = String(req.headers['authorization'] || '')
  const model = String(req.body?.model || '')
  if (!baseUrl || !model) return null
  const kind = String(req.headers['x-provider-kind'] || '') === 'openai' ? 'openai' : 'ollama'
  return { kind, baseUrl, apiKey: auth.startsWith('Bearer ') ? auth.slice(7) : '', model }
}

/** Drop cached probes (model or credentials changed). */
export function resetVisionCache() {
  cache.clear()
}

export { TINY_PNG }
