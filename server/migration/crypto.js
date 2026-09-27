// The cryptography of a server-to-server transfer, and nothing else.
//
// What travels is everything an instance holds: password hashes, the provider
// keys stored in clear in `text-config.json`, the Remotion licence. So the
// design does not trust the transport at all. A migration between two machines
// on a LAN usually runs over plain HTTP, and one across the internet may cross a
// proxy that terminates TLS and logs bodies — either way, whatever carries the
// bytes must learn nothing from them and be unable to alter them.
//
// One secret does all of it: the PAIRING CODE the old server shows its admin
// once. 160 random bits, so it is a key rather than a password — no stretching,
// no salt per user, just HKDF into three independent values:
//
//   id      public; lets the source find the pairing without the code crossing
//           the wire, even as a header
//   auth    HMAC key for each REQUEST (method, path, time, nonce)
//   enc     AES-256-GCM key for each RESPONSE, bound to that request's nonce
//
// Binding the response to the request nonce is what stops a recorded answer —
// the manifest, say — from being replayed later to a destination asking a
// different question. A response that does not open under the right key and
// the right request is refused, which also means a URL pointing at the wrong
// host fails CLOSED: the destination can say "wrong address or wrong code" and
// nothing that host answered is ever parsed.
import crypto from 'node:crypto'

/** Crockford base32: no I, L, O or U, so a code read aloud cannot be misheard. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
/** 20 bytes = 160 bits = 32 characters. Far past anything worth guessing. */
const CODE_BYTES = 20
const SALT = Buffer.from('mocky-migration-v1')

/** How far a request's clock may drift from ours. Also the replay window. */
export const MAX_SKEW_MS = 5 * 60_000

function toBase32(buf) {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function fromBase32(str) {
  let bits = 0
  let value = 0
  const out = []
  for (const ch of str) {
    const idx = ALPHABET.indexOf(ch)
    if (idx < 0) return null
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** A fresh pairing code, grouped by four so a person can copy it without losing their place. */
export function newPairingCode() {
  const raw = toBase32(crypto.randomBytes(CODE_BYTES))
  return raw.match(/.{1,4}/g).join('-')
}

/**
 * The code as a person may have typed it: lower case, spaces, dashes, and the
 * letters Crockford folds into digits. Returns the raw bytes, or null when what
 * was typed cannot be a code at all — decided here so neither side ever derives
 * keys from a string that was not one.
 */
export function parsePairingCode(input) {
  const clean = String(input || '')
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
  if (clean.length !== 32) return null
  const bytes = fromBase32(clean)
  return bytes && bytes.length === CODE_BYTES ? bytes : null
}

/** The three values a code stands for. Deterministic: both servers derive the same ones. */
export function deriveKeys(codeBytes) {
  const derive = (info, len) => Buffer.from(crypto.hkdfSync('sha256', codeBytes, SALT, Buffer.from(info), len))
  return {
    id: derive('id', 16).toString('hex'),
    auth: derive('auth', 32),
    enc: derive('enc', 32),
  }
}

function signingInput(method, pathWithQuery, ts, nonce) {
  return `${method.toUpperCase()}\n${pathWithQuery}\n${ts}\n${nonce}`
}

/** The Authorization header a destination sends. */
export function signRequest(keys, method, pathWithQuery, now = Date.now()) {
  const nonce = crypto.randomBytes(16).toString('hex')
  const sig = crypto.createHmac('sha256', keys.auth).update(signingInput(method, pathWithQuery, now, nonce)).digest('hex')
  return { header: `MockyMigration id=${keys.id}, ts=${now}, nonce=${nonce}, sig=${sig}`, nonce }
}

/** Parses the header; null when it is not ours at all. Verification is `verifyRequest`. */
export function parseAuthHeader(header) {
  const m = /^MockyMigration\s+(.+)$/.exec(String(header || ''))
  if (!m) return null
  const fields = {}
  for (const part of m[1].split(',')) {
    const [k, v] = part.trim().split('=')
    if (k && v) fields[k] = v
  }
  const { id, ts, nonce, sig } = fields
  if (!/^[0-9a-f]{32}$/.test(id || '')) return null
  if (!/^\d{1,16}$/.test(ts || '')) return null
  if (!/^[0-9a-f]{32}$/.test(nonce || '')) return null
  if (!/^[0-9a-f]{64}$/.test(sig || '')) return null
  return { id, ts: Number(ts), nonce, sig }
}

/**
 * Is this signature right for this request, now? Pure: the replay cache is the
 * caller's, because it has to outlive a single call and belongs to a pairing.
 *
 * @returns {'ok'|'bad-signature'|'stale'}
 */
export function verifyRequest(keys, parsed, method, pathWithQuery, now = Date.now()) {
  const expected = crypto
    .createHmac('sha256', keys.auth)
    .update(signingInput(method, pathWithQuery, parsed.ts, parsed.nonce))
    .digest()
  const got = Buffer.from(parsed.sig, 'hex')
  // Signature first, then the clock: a forged request learns nothing about how
  // far off our clock is.
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return 'bad-signature'
  if (Math.abs(now - parsed.ts) > MAX_SKEW_MS) return 'stale'
  return 'ok'
}

function aadFor(pathWithQuery, requestNonce) {
  return Buffer.from(`${pathWithQuery}\n${requestNonce}`)
}

/** Encrypts one response body: 12-byte IV, ciphertext, 16-byte tag. */
export function seal(keys, pathWithQuery, requestNonce, plaintext) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', keys.enc, iv)
  cipher.setAAD(aadFor(pathWithQuery, requestNonce))
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return Buffer.concat([iv, body, cipher.getAuthTag()])
}

/** The inverse of `seal`. Throws on anything that was not sealed by that key for that request. */
export function open(keys, pathWithQuery, requestNonce, sealed) {
  if (!Buffer.isBuffer(sealed) || sealed.length < 28) throw new Error('Sealed body too short')
  const iv = sealed.subarray(0, 12)
  const tag = sealed.subarray(sealed.length - 16)
  const body = sealed.subarray(12, sealed.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', keys.enc, iv)
  decipher.setAAD(aadFor(pathWithQuery, requestNonce))
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(body), decipher.final()])
}

/**
 * A secret the two servers should share, compared without either sending it:
 * an HMAC under the pairing's own key. Useless to anyone without the code, and
 * different for every pairing, so it cannot be collected across migrations.
 */
export function secretTag(keys, label, secret) {
  if (!secret) return null
  return crypto.createHmac('sha256', keys.auth).update(`${label}\n${secret}`).digest('hex').slice(0, 32)
}
