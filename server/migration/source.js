// The OLD server's side of a migration: it answers, it never initiates.
//
// Why the new server pulls rather than the old one pushing (the alternative the
// user first described): whichever side RECEIVES has to expose a route that
// writes accounts, password hashes and provider keys into its data directory —
// the most dangerous route the application could have. Pulling keeps that
// capability on the side the admin is sitting in front of, as an outbound
// download into a staging directory; this side only ever READS, and only a
// closed list of files. The old server is also the one that is already
// reachable — it serves the users — while the new one often is not until the
// DNS moves.
//
// Nothing here is reachable until an admin asks for a pairing code, and the
// pairing lives in memory only: a restart revokes it. No code, no key and no
// hash of either is ever written to disk.
import express from 'express'
import fs from 'node:fs'
import { deriveKeys, newPairingCode, parseAuthHeader, parsePairingCode, seal, verifyRequest, MAX_SKEW_MS } from './crypto.js'
import { createHashCache, listFiles, summarize } from './manifest.js'

/** A code is valid for a day: long enough for a first pass over a large library, short enough to forget. */
export const PAIRING_TTL_MS = 24 * 60 * 60_000
/** One chunk per request. Bounded memory on both sides, and a failure costs one chunk, not one file. */
export const CHUNK_BYTES = 4 * 1024 * 1024
/**
 * Bad signatures tolerated before the pairing revokes itself. 160 bits cannot be
 * guessed, so a stream of wrong signatures is not a brute force — it is a
 * destination with the wrong code, or somebody who should not be here. Either
 * way the admin should look, and making them generate a new code is how.
 */
export const MAX_FAILURES = 20

/**
 * @param {object} opts
 * @param {string} opts.dataDir
 * @param {(keys:object) => object} opts.facts  what this server says about itself, per pairing
 *   (the SSO secret is tagged under the pairing key, so the facts depend on it)
 * @param {(event:string, detail:object) => void} [opts.log]
 * @param {() => number} [opts.now]
 */
export function createMigrationSource({ dataDir, facts, log = () => {}, now = Date.now }) {
  /** @type {null | {keys:object, createdAt:number, expiresAt:number, failures:number, nonces:Map<string,number>, lastSeen:number|null, lastIp:string|null, requests:number, bytes:number, by:string}} */
  let pairing = null
  const hashOf = createHashCache()
  /** The files the last manifest listed: the only paths `/file` will serve. */
  let served = new Map()

  function active() {
    if (pairing && now() > pairing.expiresAt) {
      log('expired', {})
      pairing = null
      served = new Map()
    }
    return pairing
  }

  function create(by) {
    const code = newPairingCode()
    const keys = deriveKeys(parsePairingCode(code))
    const t = now()
    pairing = {
      keys,
      createdAt: t,
      expiresAt: t + PAIRING_TTL_MS,
      failures: 0,
      nonces: new Map(),
      lastSeen: null,
      lastIp: null,
      requests: 0,
      bytes: 0,
      by,
    }
    served = new Map()
    log('created', { by })
    // Start hashing now, while the admin walks over to the other machine: on a
    // large library the first manifest is otherwise minutes of disk reads that
    // a reverse proxy in front of this server may not wait for.
    void (async () => {
      for (const f of listFiles(dataDir).files) {
        if (pairing?.keys !== keys) return
        await hashOf(f).catch(() => {})
      }
    })()
    // The one and only time the code exists outside the admin's clipboard.
    return { code, ...status() }
  }

  function revoke(by) {
    if (pairing) log('revoked', { by })
    pairing = null
    served = new Map()
  }

  function status() {
    const p = active()
    if (!p) return { active: false }
    return {
      active: true,
      createdAt: p.createdAt,
      expiresAt: p.expiresAt,
      lastSeen: p.lastSeen,
      lastIp: p.lastIp,
      requests: p.requests,
      bytes: p.bytes,
    }
  }

  /**
   * Authenticates one request. Every refusal is the same 401 with the same
   * body: which check failed is for the log, not for the caller.
   */
  function authenticate(req, res, next) {
    const p = active()
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    const refuse = (why) => {
      log('refused', { ip, why })
      res.status(401).json({ error: 'Migration refused.' })
    }
    if (!p) return refuse('no-pairing')
    const parsed = parseAuthHeader(req.headers.authorization)
    if (!parsed || parsed.id !== p.keys.id) return refuse('unknown-pairing')
    const verdict = verifyRequest(p.keys, parsed, req.method, req.originalUrl, now())
    if (verdict !== 'ok') {
      if (verdict === 'bad-signature' && ++p.failures >= MAX_FAILURES) {
        log('revoked', { by: 'too-many-failures', ip })
        pairing = null
        served = new Map()
      }
      return refuse(verdict)
    }
    // Replay: a nonce is accepted once within the window the clock check allows.
    const t = now()
    for (const [n, at] of p.nonces) if (t - at > 2 * MAX_SKEW_MS) p.nonces.delete(n)
    if (p.nonces.has(parsed.nonce)) return refuse('replay')
    p.nonces.set(parsed.nonce, t)

    p.lastSeen = t
    p.lastIp = ip
    p.requests++
    req.migration = { keys: p.keys, nonce: parsed.nonce, pairing: p }
    next()
  }

  function send(req, res, plaintext) {
    const { keys, nonce, pairing: p } = req.migration
    const body = seal(keys, req.originalUrl, nonce, plaintext)
    p.bytes += plaintext.length
    res.setHeader('Cache-Control', 'no-store')
    res.type('application/octet-stream').send(body)
  }

  const router = express.Router()

  router.get('/manifest', authenticate, async (req, res) => {
    try {
      const { files } = listFiles(dataDir)
      const entries = []
      const next = new Map()
      for (const f of files) {
        const sha256 = await hashOf(f)
        entries.push({ path: f.path, size: f.size, sha256 })
        next.set(f.path, f)
      }
      served = next
      const manifest = {
        v: 1,
        files: entries,
        summary: summarize(dataDir, files),
        facts: facts(req.migration.keys),
      }
      log('manifest', { files: entries.length })
      send(req, res, Buffer.from(JSON.stringify(manifest)))
    } catch (err) {
      console.error('mocky: migration manifest failed —', err?.message || err)
      res.status(500).json({ error: 'Manifest failed.' })
    }
  })

  router.get('/file', authenticate, (req, res) => {
    const rel = typeof req.query.path === 'string' ? req.query.path : ''
    const offset = Number(req.query.offset)
    // Only what the last manifest listed. The walk already refused symlinks and
    // unsafe names, so the destination cannot ask for anything the walk did not
    // see — `served` is the allowlist, not a cache.
    const file = served.get(rel)
    if (!file || !Number.isSafeInteger(offset) || offset < 0) {
      return res.status(404).json({ error: 'Not in the manifest.' })
    }
    let fd
    try {
      const st = fs.lstatSync(file.abs)
      if (!st.isFile()) return res.status(404).json({ error: 'Not in the manifest.' })
      if (offset > st.size) return res.status(416).json({ error: 'Offset past the end.' })
      const len = Math.min(CHUNK_BYTES, st.size - offset)
      const buf = Buffer.alloc(len)
      fd = fs.openSync(file.abs, 'r')
      const read = len > 0 ? fs.readSync(fd, buf, 0, len, offset) : 0
      send(req, res, buf.subarray(0, read))
    } catch {
      // Deleted or replaced since the manifest: the destination's hash check
      // will fail the file and the next pass will pick up the new one.
      res.status(404).json({ error: 'Not in the manifest.' })
    } finally {
      if (fd !== undefined) fs.closeSync(fd)
    }
  })

  return { router, create, revoke, status }
}
