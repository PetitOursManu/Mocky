// Time-limited, account-free links to a SINGLE screen.
//
// The point is to open a mockup on a phone — scan a code, look at it, hand the
// phone back. Signing in on someone else's device to do that is absurd, and
// making the instance publicly readable to do it is worse. So a share is a
// capability: an unguessable URL that carries its own authority, opens exactly
// one screen, and stops working on its own.
//
// WHAT A SHARE IS NOT
//
// It is not a session. The token grants no API access, cannot list projects,
// cannot generate, cannot read the image library index. The only thing it
// unlocks is one stored snapshot.
//
// It is a SNAPSHOT, not a live view. The screen's code is copied at share time,
// so editing the screen afterwards does not silently change what a link you
// already handed out shows. That is the honest behaviour for something you
// showed someone: it keeps showing what you showed them.
//
// WHY A STORED TOKEN RATHER THAN A SIGNED PAYLOAD
//
// A signed URL would need no storage, but it cannot be revoked and it puts the
// screen's code in the address bar. A stored token can be withdrawn — which
// matters, because the failure mode here is "that link went further than I
// meant it to", and the answer to that has to be a button.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** How long a link may live, per option offered in the UI. */
export const TTL_CHOICES = {
  '1h': 60 * 60_000,
  '24h': 24 * 60 * 60_000,
  '7d': 7 * 24 * 60 * 60_000,
}
export const DEFAULT_TTL = '24h'

/**
 * Ceilings. A share is small — one component's source — and these exist so a
 * signed-in account cannot turn the share store into unbounded storage, nor
 * make the file expensive to read on every scan.
 */
export const MAX_CODE_BYTES = 512 * 1024
export const MAX_SHARES_PER_USER = 50
export const MAX_SHARES_TOTAL = 2000

/** 256 bits of randomness. The URL is the credential, so it must not be guessable. */
function newToken() {
  return crypto.randomBytes(32).toString('hex')
}

const TOKEN_RE = /^[a-f0-9]{64}$/
export const isShareToken = (t) => TOKEN_RE.test(String(t || ''))

export function createShareStore(dataDir, { now = () => Date.now() } = {}) {
  const file = path.join(dataDir, 'shares.json')

  function load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  function save(all) {
    const tmp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`
    // 0600 like every other store here: a share token IS a credential, and a
    // file of them readable by other accounts on the host defeats the point.
    fs.writeFileSync(tmp, JSON.stringify(all), { mode: 0o600 })
    fs.renameSync(tmp, file)
  }

  /** Drop everything past its expiry. Called on read paths, so it self-cleans. */
  function prune(all) {
    const t = now()
    let changed = false
    for (const [token, rec] of Object.entries(all)) {
      if (!rec || typeof rec.expiresAt !== 'number' || rec.expiresAt <= t) {
        delete all[token]
        changed = true
      }
    }
    return changed
  }

  return {
    /**
     * Mint a link for one screen.
     *
     * `snapshot` is trusted to be what the caller wants published — the route
     * above decides which fields travel. Deliberately absent: the prompt that
     * produced the screen. A brief is often the confidential part, and the
     * person looking at the mockup on a phone has no need of it.
     */
    create(userId, snapshot, ttlKey = DEFAULT_TTL) {
      const code = String(snapshot?.code || '')
      if (!code.trim()) throw Object.assign(new Error('Nothing to share: this screen has no code yet.'), { statusCode: 400 })
      if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
        throw Object.assign(new Error('This screen is too large to share.'), { statusCode: 413 })
      }

      const all = load()
      prune(all)

      const mine = Object.values(all).filter((r) => r.userId === userId)
      if (mine.length >= MAX_SHARES_PER_USER) {
        throw Object.assign(
          new Error(`You already have ${MAX_SHARES_PER_USER} active share links. Revoke one first.`),
          { statusCode: 429 },
        )
      }
      if (Object.keys(all).length >= MAX_SHARES_TOTAL) {
        throw Object.assign(new Error('This instance has too many active share links.'), { statusCode: 507 })
      }

      const ttl = TTL_CHOICES[ttlKey] ?? TTL_CHOICES[DEFAULT_TTL]
      const token = newToken()
      all[token] = {
        userId,
        createdAt: now(),
        expiresAt: now() + ttl,
        screenId: String(snapshot.screenId || ''),
        snapshot: {
          name: String(snapshot.name || '').slice(0, 120),
          code,
          componentName: String(snapshot.componentName || 'App').slice(0, 80),
          caps: Array.isArray(snapshot.caps) ? snapshot.caps.slice(0, 20).map(String) : [],
          w: Number(snapshot.w) || 1440,
          h: Number(snapshot.h) || 900,
          device: snapshot.device === 'iphone' ? 'iphone' : 'none',
          animations: snapshot.animations === false ? false : true,
        },
      }
      save(all)
      return { token, expiresAt: all[token].expiresAt }
    },

    /** The snapshot behind a token, or null when unknown or expired. */
    get(token) {
      if (!isShareToken(token)) return null
      const all = load()
      const changed = prune(all)
      const rec = all[token]
      if (changed) save(all)
      if (!rec) return null
      return { ...rec.snapshot, expiresAt: rec.expiresAt }
    },

    /** Everything this user currently has out, newest first. Never the code. */
    list(userId) {
      const all = load()
      if (prune(all)) save(all)
      return Object.entries(all)
        .filter(([, r]) => r.userId === userId)
        .map(([token, r]) => ({
          token,
          screenId: r.screenId,
          name: r.snapshot?.name || '',
          createdAt: r.createdAt,
          expiresAt: r.expiresAt,
        }))
        .sort((a, b) => b.createdAt - a.createdAt)
    },

    /**
     * Withdraw a link. Only its owner may — a token is a credential, and one
     * user must not be able to revoke another's by guessing nothing at all.
     */
    revoke(userId, token) {
      if (!isShareToken(token)) return false
      const all = load()
      prune(all)
      const rec = all[token]
      if (!rec || rec.userId !== userId) return false
      delete all[token]
      save(all)
      return true
    },

    /** Revoke everything a user has out — used when their account is deleted. */
    revokeAllFor(userId) {
      const all = load()
      let n = 0
      for (const [token, rec] of Object.entries(all)) {
        if (rec.userId === userId) {
          delete all[token]
          n++
        }
      }
      if (n) save(all)
      return n
    },
  }
}
