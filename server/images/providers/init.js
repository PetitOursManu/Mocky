// The image-to-image half of the provider contract, in one file because the
// refusal has to read the same everywhere.
//
//   generate({ prompt, negative, seed, width, height, init?, strength? })
//
// `init` carries the BYTES of the source image — `{ buffer, contentType }` —
// and never a URL. Three of the four capable providers want bytes anyway
// (multipart for OpenAI, base64 for Cloudflare and sd-webui) and fal takes a
// data URI built from them in one line. A URL-shaped contract would serve fal
// alone and would additionally require Mocky's own origin to be reachable from
// the public internet: generated images live at `${origin}/api/images/:hash`
// (M6), which on a self-hosted instance is a LAN or localhost address. Making
// it fetchable by a third party means publishing the image store, and M2 exists
// to stop exactly that traffic in the other direction.
//
// `strength` is 0..1 and its DIRECTION is part of the contract: **1 drifts
// furthest from the source**. That is A1111's `denoising_strength` and
// Cloudflare's `strength`, so those two translate it unchanged. A provider
// whose own parameter is documented the other way round — or documented both
// ways, which is fal's situation today — must NOT translate it. An inverted
// mapping yields an image the API is perfectly happy with and the user never
// asked for, with no error anywhere to point at. It reports
// `strengthApplied: false` instead, because "I derived your image but could not
// set how far" is a true sentence and hiding it is not.
//
// A result produced from an `init` carries `edited: true`, so a caller can
// assert the bytes really are a derivative instead of taking a provider's word
// for it.

import zlib from 'node:zlib'

/**
 * The formats every capable provider accepts. gpt-image-1 takes exactly these
 * three and rejects the rest, so the narrowest of the four decides the set.
 * Mocky's store only ever holds provider output (M2), which is always one of
 * them — anything else arriving here is a bug upstream, not a limitation.
 */
const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/webp'])

/**
 * Base64 inflates a body by a third and fal wants the whole thing as one data
 * URI inside a JSON string, so a large source is held in memory several times
 * over. Mocky's own images are a few hundred kilobytes; this cap is only there
 * so a hand-crafted request cannot turn the edit path into a memory bomb.
 */
export const MAX_INIT_BYTES = 24 * 1024 * 1024

/**
 * Read and validate the source image, or `null` when the request has none.
 *
 * @param {object} req  a provider `generate()` request
 * @param {string} id   the provider id, so the message names who is refusing
 * @returns {{buffer: Buffer, contentType: string}|null}
 */
export function readInit(req, id) {
  const init = req && req.init
  if (init == null) return null
  const buffer = init.buffer
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error(`${id} : l'image source est vide — il n'y a rien à dériver.`)
  }
  if (buffer.length > MAX_INIT_BYTES) {
    throw new Error(
      `${id} : l'image source fait ${Math.round(buffer.length / 1024 / 1024)} Mo, au-delà de la limite de ${Math.round(MAX_INIT_BYTES / 1024 / 1024)} Mo.`,
    )
  }
  const contentType = String(init.contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (!ACCEPTED.has(contentType)) {
    throw new Error(
      `${id} : format d'image source non pris en charge (${contentType || 'inconnu'}). Formats acceptés : ${[...ACCEPTED].join(', ')}.`,
    )
  }
  return { buffer, contentType }
}

/**
 * Refuse an input image a provider cannot use. Always throws.
 *
 * This is the rule the whole feature turns on. The tempting alternative — drop
 * the image and generate from the prompt alone — fails in the one way Mocky
 * cannot detect: the provider returns a perfectly good picture, of the right
 * size, with the right content type, reported as a success, while the user is
 * looking at an interface that says it derived their own image. Nothing
 * downstream can tell the two apart, so the only honest failure is a loud one.
 *
 * @param {string} id   who is refusing
 * @param {string} why  one sentence, technical, so an admin can act on it
 */
export function refuseInit(id, why) {
  throw new Error(
    `Le fournisseur « ${id} » ne sait pas dériver une image d'une autre : ${why} Il rendrait une image issue du seul texte, présentée comme une dérivée de la vôtre — Mocky préfère refuser. Choisissez un autre fournisseur pour le profil « Édition ».`,
  )
}

/** Clamp a requested strength into the contract's 0..1, or `null` if absent. */
export function clampStrength(value) {
  const n = Number(value)
  if (value == null || !Number.isFinite(n)) return null
  return Math.min(1, Math.max(0, n))
}

/** `data:image/png;base64,…` — the one shape fal accepts without a CDN upload. */
export function toDataUri(init) {
  return `data:${init.contentType};base64,${init.buffer.toString('base64')}`
}

/** PNG chunk: length, type, payload, CRC-32 over type+payload. */
function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'latin1')
  data.copy(out, 8)
  out.writeUInt32BE(zlib.crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

/**
 * A small real PNG, for the admin panel's "Test" button on the edit profile.
 *
 * A text-to-image test proves nothing about an edit provider: it passes against
 * a model that cannot edit at all, which is precisely the configuration mistake
 * the button is there to catch (Cloudflare's default model is text-to-image
 * only, and fal's image-to-image endpoints live under different ids). So the
 * test sends a genuine source image and exercises the genuine endpoint.
 *
 * Encoded here rather than shipped as a file because "no native dependencies"
 * also means no image library: `node:zlib` is core, and a truecolour PNG is a
 * header, one deflate stream and two CRCs.
 */
export function sampleSourceImage(size = 512) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolour RGB
  const stride = 1 + size * 3
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    const row = y * stride // raw[row] stays 0: filter type "None"
    for (let x = 0; x < size; x++) {
      const p = row + 1 + x * 3
      raw[p] = 210
      raw[p + 1] = 70 + ((x + y) & 63)
      raw[p + 2] = 60
    }
  }
  return {
    buffer: Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
    contentType: 'image/png',
  }
}
