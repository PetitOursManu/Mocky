import { describe, it, expect, vi, afterEach } from 'vitest'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createKeyStore,
  mintKey,
  parseKey,
  isKeyToken,
  cleanKeyName,
  hashKey,
  KeyError,
  KEY_RE,
  KEY_PREFIX,
  KEY_LENGTH,
  MAX_KEYS_PER_ACCOUNT,
  MAX_KEYS,
  EXPIRED_KEPT_MS,
} from './keys.js'
import { EXCLUDED_FILES } from '../migration/manifest.js'

/**
 * X8, the store half: a key is random, shown once, kept by hash, compared in
 * constant time, and listed by a whitelist that never holds it.
 */

const DAY = 24 * 60 * 60 * 1000
const dirs = []
function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-keys-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

function clock(start = 1_760_000_000_000) {
  let t = start
  return { now: () => t, advance: (ms) => (t += ms) }
}

const create = (store, over = {}) => store.create({ userId: 'u1', name: 'Helper', level: 'read', ...over })

describe('the key itself', () => {
  it('is 256 random bits behind a recognisable prefix', () => {
    const a = mintKey()
    const b = mintKey()
    expect(a.token).toMatch(KEY_RE)
    expect(a.token).not.toBe(b.token)
    expect(a.token.length).toBe(KEY_LENGTH)
    expect(Buffer.from(a.token.slice(KEY_PREFIX.length + 13), 'base64url').length).toBe(32)
    expect(a.token.startsWith(`${KEY_PREFIX}${a.lookup}_`)).toBe(true)
    // An OAuth token is 32 bytes of base64url — 43 characters, no prefix: never mistaken for a key.
    const oauth = crypto.randomBytes(32).toString('base64url')
    expect(isKeyToken(oauth)).toBe(false)
    expect(parseKey(oauth)).toBeNull()
  })

  it('is parsed strictly', () => {
    const { token, lookup } = mintKey()
    expect(parseKey(token)).toEqual({ lookup })
    for (const bad of [
      token.slice(KEY_PREFIX.length),
      `${token}x`,
      token.slice(0, -1),
      token.replace(KEY_PREFIX, 'mocky_ok_'),
      `${token.slice(0, -1)}=`,
      ` ${token}`,
      token.replace(/^(mocky_ak_)[0-9a-f]/, '$1Z'),
      null,
      undefined,
      42,
    ]) {
      expect(parseKey(bad), String(bad)).toBeNull()
    }
  })

  it('has a name of one short line, never one that looks like a key', () => {
    expect(cleanKeyName('  Helper\n(lecture)  ')).toBe('Helper (lecture)')
    expect(cleanKeyName('')).toBeNull()
    expect(cleanKeyName('   ')).toBeNull()
    expect(cleanKeyName('x'.repeat(61))).toBeNull()
    expect(cleanKeyName('x'.repeat(60))).toBe('x'.repeat(60))
    expect(cleanKeyName(mintKey().token)).toBeNull()
    expect(cleanKeyName(42)).toBeNull()
  })
})

describe('the store', () => {
  it('returns the key once, and keeps only its hash', () => {
    const dir = tmp()
    const store = createKeyStore(dir)
    const { key, token } = create(store)
    expect(token).toMatch(KEY_RE)
    const file = fs.readFileSync(path.join(dir, 'mcp-keys.json'), 'utf8')
    expect(file).not.toContain(token)
    expect(file).not.toContain(token.slice(KEY_PREFIX.length + 13))
    expect(file).toContain(hashKey(token))
    // The view is a whitelist: never the key, its hash or its lookup.
    expect(Object.keys(key).sort()).toEqual(['createdAt', 'expired', 'expiresAt', 'id', 'lastUsedAt', 'level', 'name', 'userId'])
    const listed = JSON.stringify(store.list())
    expect(listed).not.toContain(token)
    expect(listed).not.toContain(hashKey(token))
    expect(listed).not.toContain(parseKey(token).lookup)
    expect(Object.keys(store.list()[0]).sort()).toEqual(Object.keys(key).sort())
    expect(JSON.stringify(store.get(key.id))).not.toContain(hashKey(token))
  })

  it('writes the file 0600', () => {
    if (process.platform === 'win32') return
    const dir = tmp()
    create(createKeyStore(dir))
    expect(fs.statSync(path.join(dir, 'mcp-keys.json')).mode & 0o777).toBe(0o600)
  })

  it('finds the key again after a restart, by hash', () => {
    const dir = tmp()
    const { token, key } = create(createKeyStore(dir), { level: 'write' })
    const again = createKeyStore(dir)
    expect(again.verify(token)).toMatchObject({ id: key.id, userId: 'u1', level: 'write' })
  })

  it('verifies the right key and nothing else, in constant time on both branches', () => {
    const store = createKeyStore(tmp())
    const { token, key } = create(store)
    const spy = vi.spyOn(crypto, 'timingSafeEqual')
    expect(store.verify(token)).toMatchObject({ id: key.id, userId: 'u1', level: 'read' })
    const wrongSecret = token.slice(0, -4) + (token.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(store.verify(wrongSecret)).toBeNull()
    const unknown = mintKey().token
    expect(store.verify(unknown)).toBeNull()
    expect(store.verify('not a key')).toBeNull()
    expect(store.verify(undefined)).toBeNull()
    // Known lookup, unknown lookup, malformed: the comparison runs every time.
    expect(spy).toHaveBeenCalledTimes(5)
    // What verify hands back is who and at which level — never the hash.
    expect(JSON.stringify(store.verify(token))).not.toContain(hashKey(token))
  })

  it('refuses a missing or unknown level instead of choosing one', () => {
    const store = createKeyStore(tmp())
    for (const level of [undefined, null, '', 'admin', 'READ']) {
      expect(() => create(store, { level }), String(level)).toThrow(KeyError)
      try {
        create(store, { level })
      } catch (err) {
        expect(err.code).toBe('level')
      }
    }
    expect(store.list()).toEqual([])
  })

  it('refuses a bad name and a lifetime off the list', () => {
    const store = createKeyStore(tmp())
    expect(() => create(store, { name: '' })).toThrow(expect.objectContaining({ code: 'name' }))
    expect(() => create(store, { name: 'x'.repeat(61) })).toThrow(expect.objectContaining({ code: 'name' }))
    expect(() => create(store, { expiresInDays: 3 })).toThrow(expect.objectContaining({ code: 'expiry' }))
    expect(() => create(store, { expiresInDays: '30' })).toThrow(expect.objectContaining({ code: 'expiry' }))
    expect(create(store, { expiresInDays: 30 }).key.expiresAt).toBeGreaterThan(Date.now())
    expect(create(store, { expiresInDays: null }).key.expiresAt).toBeNull()
  })

  it('expires, shows the key as expired for a while, then forgets it', () => {
    const c = clock()
    const store = createKeyStore(tmp(), { now: c.now })
    const { token, key } = create(store, { expiresInDays: 7 })
    expect(key.expiresAt).toBe(c.now() + 7 * DAY)
    expect(store.verify(token)).not.toBeNull()
    c.advance(7 * DAY)
    expect(store.verify(token)).toBeNull()
    expect(store.list()[0]).toMatchObject({ id: key.id, expired: true })
    c.advance(EXPIRED_KEPT_MS)
    expect(store.list()).toEqual([])
    expect(store.verify(token)).toBeNull()
  })

  it('revokes at once — one key, or every key of an account', () => {
    const store = createKeyStore(tmp())
    const a = create(store)
    const b = create(store, { name: 'Script' })
    const other = create(store, { userId: 'u2' })
    expect(store.revoke(a.key.id)).toBe(true)
    expect(store.verify(a.token)).toBeNull()
    expect(store.revoke(a.key.id)).toBe(false)
    expect(store.verify(b.token)).not.toBeNull()
    expect(store.revokeUser('u1')).toBe(1)
    expect(store.verify(b.token)).toBeNull()
    expect(store.verify(other.token)).not.toBeNull()
    expect(store.list('u1')).toEqual([])
  })

  it('knows only the ids it holds: a name every object inherits is not a key', () => {
    const dir = tmp()
    const store = createKeyStore(dir)
    const { key, token } = create(store)
    // An id arrives from a URL (DELETE /api/admin/mcp/keys/:id).
    for (const id of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf']) {
      expect(store.get(id), id).toBeNull()
      expect(store.revoke(id), id).toBe(false)
      store.touch(id)
    }
    expect(Object.hasOwn(Object, 'lastUsedAt')).toBe(false)
    expect(Object.hasOwn(Object.prototype, 'lastUsedAt')).toBe(false)
    expect(store.list().map((k) => k.id)).toEqual([key.id])
    expect(store.verify(token)).not.toBeNull()

    // Nor in the file: only own entries, each filed under its own id.
    const file = path.join(dir, 'mcp-keys.json')
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'))
    const rec = saved.keys[key.id]
    const other = crypto.randomBytes(16).toString('hex')
    fs.writeFileSync(
      file,
      `{"v":1,"keys":{"__proto__":${JSON.stringify(rec)},"constructor":${JSON.stringify(rec)},"${other}":${JSON.stringify(rec)},"${key.id}":${JSON.stringify(rec)}}}`,
    )
    const again = createKeyStore(dir)
    expect(again.list().map((k) => k.id)).toEqual([key.id])
    expect(again.get('constructor')).toBeNull()
    expect(again.get(other)).toBeNull()
    expect(again.verify(token)).toMatchObject({ id: key.id })
  })

  it('a failed "last used" write is reported, never thrown from its timer', () => {
    vi.useFakeTimers()
    const dir = tmp()
    const store = createKeyStore(dir)
    const { key } = create(store)
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw Object.assign(new Error('no space left'), { code: 'ENOSPC' })
    })
    store.touch(key.id)
    expect(() => vi.advanceTimersByTime(60_000)).not.toThrow()
    expect(err).toHaveBeenCalledWith(expect.stringContaining('ENOSPC'))
  })

  it('caps the keys per account and per instance', () => {
    const store = createKeyStore(tmp())
    for (let i = 0; i < MAX_KEYS_PER_ACCOUNT; i++) create(store, { name: `k${i}` })
    expect(() => create(store)).toThrow(expect.objectContaining({ code: 'limit' }))
    expect(store.countFor('u1')).toBe(MAX_KEYS_PER_ACCOUNT)
    // Another account still may.
    expect(create(store, { userId: 'u2' }).token).toMatch(KEY_RE)
  })

  it('caps the whole instance', () => {
    const dir = tmp()
    const keys = {}
    for (let i = 0; i < MAX_KEYS; i++) {
      const id = crypto.randomBytes(16).toString('hex')
      keys[id] = { id, lookup: crypto.randomBytes(6).toString('hex'), hash: hashKey(String(i)), userId: `user${i}`, name: 'k', level: 'read', createdAt: 1, lastUsedAt: null, expiresAt: null }
    }
    fs.writeFileSync(path.join(dir, 'mcp-keys.json'), JSON.stringify({ v: 1, keys }))
    expect(() => create(createKeyStore(dir), { userId: 'fresh' })).toThrow(expect.objectContaining({ code: 'full' }))
  })

  it('writes "last used" at most once a minute, and on flush', () => {
    vi.useFakeTimers()
    const dir = tmp()
    const store = createKeyStore(dir)
    const { key } = create(store)
    const onDisk = () => JSON.parse(fs.readFileSync(path.join(dir, 'mcp-keys.json'), 'utf8')).keys[key.id].lastUsedAt
    store.touch(key.id)
    expect(store.get(key.id).lastUsedAt).not.toBeNull()
    expect(onDisk()).toBeNull()
    vi.advanceTimersByTime(60_000)
    expect(onDisk()).not.toBeNull()
    store.touch(key.id)
    store.flush()
    expect(onDisk()).toBe(store.get(key.id).lastUsedAt)
  })

  it('reads a damaged file as no keys, and a forged level as read', () => {
    const dir = tmp()
    fs.writeFileSync(path.join(dir, 'mcp-keys.json'), '{not json')
    expect(createKeyStore(dir).list()).toEqual([])

    const { token, lookup } = mintKey()
    const id = crypto.randomBytes(16).toString('hex')
    fs.writeFileSync(
      path.join(dir, 'mcp-keys.json'),
      JSON.stringify({ v: 1, keys: { [id]: { id, lookup, hash: hashKey(token), userId: 'u1', name: 'k', level: 'admin', createdAt: 1 }, bad: { id: 'x' } } }),
    )
    const store = createKeyStore(dir)
    expect(store.list().length).toBe(1)
    expect(store.verify(token)).toMatchObject({ id, level: 'read' })
  })

  it('never travels with a migration', () => {
    expect(EXCLUDED_FILES.has('mcp-keys.json')).toBe(true)
  })
})
