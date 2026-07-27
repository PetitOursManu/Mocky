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

  cache.set(key, result)
  return result
}

/** Drop cached probes (model or credentials changed). */
export function resetVisionCache() {
  cache.clear()
}

export { TINY_PNG }
