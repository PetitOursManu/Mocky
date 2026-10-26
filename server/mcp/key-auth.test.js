import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js'
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import { createKeyAuth, bearerOf, KEY_LOG_NAME } from './key-auth.js'
import { createKeyStore, mintKey } from './keys.js'
import { createLockout } from '../auth-lockout.js'

/**
 * X8, the door: what /mcp does with a request carrying an assistant key — and
 * that every refusal is the OAuth refusal, to the byte, whatever its reason.
 * Plain request and response doubles; the store is the real one on a temp dir.
 */

const META = 'https://m.example/.well-known/oauth-protected-resource/mcp'
const dirs = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

function fakeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined }
  res.setHeader = (k, v) => ((res.headers[k.toLowerCase()] = String(v)), res)
  res.set = res.setHeader
  res.status = (n) => ((res.statusCode = n), res)
  res.json = (b) => ((res.body = b), res)
  return res
}
const reqWith = (token, ip = '203.0.113.7') => ({ headers: token === undefined ? {} : { authorization: `Bearer ${token}` }, ip })

function setup({ users, config, accountLocked = () => 0, lockouts } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-keyauth-'))
  dirs.push(dir)
  const keys = createKeyStore(dir)
  const people = users ?? { u1: { id: 'u1', username: 'helper' }, u2: { id: 'u2', username: 'bob' } }
  const cfg = config ?? { keys: true, access: { mode: 'allowlist', userIds: ['u1', 'u2'] } }
  const logAuth = vi.fn()
  const auth = createKeyAuth({
    keys,
    config: () => cfg,
    findUser: (id) => people[id],
    accountLocked,
    logAuth,
    clientIp: (req) => req.ip,
    resource: () => 'https://m.example/mcp',
    resourceMetadataUrl: META,
    ...(lockouts ? { lockouts } : {}),
  })
  async function call(token, ip) {
    const req = reqWith(token, ip)
    const res = fakeRes()
    const next = vi.fn()
    await auth.middleware(req, res, next)
    return { req, res, next, passed: next.mock.calls.length === 1 }
  }
  return { keys, cfg, people, logAuth, auth, call }
}

/** What the OAuth path answers an invalid token — the SDK's own middleware, the provider's own message. */
async function oauthRefusal() {
  const bearer = requireBearerAuth({
    verifier: {
      async verifyAccessToken() {
        throw new InvalidTokenError('Invalid or expired token.')
      },
    },
    resourceMetadataUrl: META,
  })
  const res = fakeRes()
  await bearer(reqWith('someOAuthLookingToken'), res, () => {})
  return res
}

const shape = (res) => ({ status: res.statusCode, body: res.body, www: res.headers['www-authenticate'] })

describe('which door a request takes', () => {
  it('takes the key path on the prefix alone; everything else stays OAuth', () => {
    const { auth } = setup()
    expect(auth.handles(reqWith(mintKey().token))).toBe(true)
    expect(auth.handles(reqWith('mocky_ak_whatever'))).toBe(true)
    expect(auth.handles(reqWith('abcDEF0123456789abcDEF0123456789abcDEF01234'))).toBe(false)
    expect(auth.handles(reqWith(undefined))).toBe(false)
    expect(auth.handles({ headers: { authorization: `Basic ${mintKey().token}` } })).toBe(false)
    // Split exactly like the SDK: a double space leaves the SDK's own refusal in charge.
    expect(bearerOf({ headers: { authorization: `Bearer  ${mintKey().token}` } })).toBeNull()
    expect(bearerOf({ headers: { authorization: `bearer ${'x'}` } })).toBe('x')
  })
})

describe('a good key', () => {
  it('passes, as its account, at its level — and req.auth never holds the key', async () => {
    const { keys, call } = setup()
    const { token, key } = keys.create({ userId: 'u1', name: 'Helper', level: 'read' })
    const { req, passed } = await call(token)
    expect(passed).toBe(true)
    expect(req.auth.extra).toEqual({ userId: 'u1', keyId: key.id, level: 'read', via: 'key' })
    expect(req.auth.token).toBe('')
    expect(typeof req.auth.expiresAt).toBe('number')
    expect(req.auth.expiresAt).toBeGreaterThan(Date.now() / 1000)
    expect(JSON.stringify(req.auth)).not.toContain(token)
    expect(keys.get(key.id).lastUsedAt).not.toBeNull()
  })

  it('carries a write level as write', async () => {
    const { keys, call } = setup()
    const { token } = keys.create({ userId: 'u1', name: 'Helper', level: 'write' })
    expect((await call(token)).req.auth.extra.level).toBe('write')
  })
})

describe('every refusal is the same refusal', () => {
  it('unknown, wrong secret, malformed, expired, revoked, switched off: the OAuth 401, to the byte', async () => {
    const want = shape(await oauthRefusal())
    expect(want.status).toBe(401)
    expect(want.www).toContain(`resource_metadata="${META}"`)

    const s = setup()
    const live = s.keys.create({ userId: 'u1', name: 'live', level: 'read' })
    const gone = s.keys.create({ userId: 'u1', name: 'gone', level: 'read' })
    s.keys.revoke(gone.key.id)
    const wrong = live.token.slice(0, -2) + (live.token.endsWith('AA') ? 'BB' : 'AA')

    const answers = [
      await s.call(mintKey().token, '198.51.100.1'),
      await s.call(wrong, '198.51.100.2'),
      await s.call('mocky_ak_nope', '198.51.100.3'),
      await s.call(gone.token, '198.51.100.4'),
    ]
    s.cfg.keys = false
    answers.push(await s.call(live.token, '198.51.100.5'))
    s.cfg.keys = true

    // Expired: a store with its own clock.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-keyauth-'))
    dirs.push(dir)
    let t = Date.now()
    const store = createKeyStore(dir, { now: () => t })
    const soon = store.create({ userId: 'u1', name: 'soon', level: 'read', expiresInDays: 7 })
    t += 8 * 24 * 60 * 60 * 1000
    const expiredAuth = createKeyAuth({
      keys: store,
      config: () => s.cfg,
      findUser: (id) => s.people[id],
      resource: () => 'https://m.example/mcp',
      resourceMetadataUrl: META,
    })
    const res = fakeRes()
    const next = vi.fn()
    await expiredAuth.middleware(reqWith(soon.token, '198.51.100.6'), res, next)
    answers.push({ res, passed: next.mock.calls.length === 1 })

    for (const a of answers) {
      expect(a.passed).toBe(false)
      expect(shape(a.res)).toEqual(want)
    }
    // And the live key still works: none of that touched it.
    expect((await s.call(live.token)).passed).toBe(true)
  })
})

describe('guessing (X8)', () => {
  it('freezes an address after 10 failures — the right key included — and logs it for fail2ban', async () => {
    const s = setup()
    const { token } = s.keys.create({ userId: 'u1', name: 'Helper', level: 'read' })
    for (let i = 0; i < 10; i++) expect((await s.call(mintKey().token, '203.0.113.9')).res.statusCode).toBe(401)
    const frozen = await s.call(token, '203.0.113.9')
    expect(frozen.passed).toBe(false)
    expect(frozen.res.statusCode).toBe(429)
    expect(Number(frozen.res.headers['retry-after'])).toBeGreaterThan(0)
    // Another address with the right key is not affected.
    expect((await s.call(token, '203.0.113.10')).passed).toBe(true)
    const events = s.logAuth.mock.calls.map(([event, , name]) => `${event}:${name}`)
    expect(events.filter((e) => e === `failure:${KEY_LOG_NAME}`).length).toBe(10)
    expect(events).toContain(`locked:${KEY_LOG_NAME}`)
  })

  it('freezes one key guessed at from many addresses, without banning its holder', async () => {
    const s = setup()
    const { token } = s.keys.create({ userId: 'u1', name: 'Helper', level: 'read' })
    const wrong = token.slice(0, -3) + (token.endsWith('AAA') ? 'BBB' : 'AAA')
    for (let i = 0; i < 10; i++) await s.call(wrong, `192.0.2.${i + 1}`)
    const frozen = await s.call(token, '192.0.2.200')
    expect(frozen.res.statusCode).toBe(429)
    expect(s.logAuth.mock.calls.filter(([e]) => e === 'locked')).toEqual([])
  })

  it('counts an unknown key exactly like a known one: freezing says nothing about existence', async () => {
    const lockouts = { addr: createLockout(), key: createLockout() }
    const s = setup({ lockouts })
    const real = s.keys.create({ userId: 'u1', name: 'Helper', level: 'read' }).token
    const fake = mintKey().token
    const bad = (t) => t.slice(0, -3) + (t.endsWith('AAA') ? 'BBB' : 'AAA')
    for (let i = 0; i < 10; i++) {
      await s.call(bad(real), `10.0.0.${i}`)
      await s.call(bad(fake), `10.0.1.${i}`)
    }
    const a = await s.call(bad(real), '10.9.9.1')
    const b = await s.call(bad(fake), '10.9.9.2')
    expect(shape(a.res)).toEqual(shape(b.res))
    expect(a.res.statusCode).toBe(429)
  })

  it('a success clears that key’s counter', async () => {
    const s = setup()
    const { token } = s.keys.create({ userId: 'u1', name: 'Helper', level: 'read' })
    const wrong = token.slice(0, -3) + (token.endsWith('AAA') ? 'BBB' : 'AAA')
    for (let i = 0; i < 9; i++) await s.call(wrong, `172.16.0.${i}`)
    expect((await s.call(token, '172.16.1.1')).passed).toBe(true)
    for (let i = 0; i < 9; i++) await s.call(wrong, `172.16.2.${i}`)
    expect((await s.call(token, '172.16.1.1')).passed).toBe(true)
  })
})

describe('the account behind the key (X2)', () => {
  it('locked by failed sign-ins: 429, and no fail2ban line for the key’s holder', async () => {
    let locked = 0
    const s = setup({ accountLocked: (u) => (u === 'helper' ? locked : 0) })
    const { token } = s.keys.create({ userId: 'u1', name: 'Helper', level: 'read' })
    locked = 300
    const out = await s.call(token)
    expect(out.passed).toBe(false)
    expect(out.res.statusCode).toBe(429)
    expect(out.res.headers['retry-after']).toBe('300')
    expect(s.logAuth).not.toHaveBeenCalled()
    locked = 0
    expect((await s.call(token)).passed).toBe(true)
  })

  it('taken off the list: refused, and its keys go', async () => {
    const s = setup()
    const { token } = s.keys.create({ userId: 'u1', name: 'Helper', level: 'read' })
    const other = s.keys.create({ userId: 'u2', name: 'Bob', level: 'read' })
    s.cfg.access = { mode: 'allowlist', userIds: ['u2'] }
    const out = await s.call(token)
    expect(out.res.statusCode).toBe(401)
    expect(out.res.body.error_description).toBe('This account may no longer connect an assistant.')
    expect(s.keys.list('u1')).toEqual([])
    expect((await s.call(other.token)).passed).toBe(true)
    // Put back on the list, the old key does not come back.
    s.cfg.access = { mode: 'allowlist', userIds: ['u1', 'u2'] }
    expect((await s.call(token, '203.0.113.50')).res.statusCode).toBe(401)
  })

  it('a garbage access mode lets nobody in (scopeAllows fails closed)', async () => {
    const s = setup()
    const { token } = s.keys.create({ userId: 'u1', name: 'Helper', level: 'read' })
    s.cfg.access = { mode: 'everyone', userIds: [] }
    expect((await s.call(token)).passed).toBe(false)
  })

  it('deleted: refused, and its keys go', async () => {
    const s = setup()
    const { token } = s.keys.create({ userId: 'u1', name: 'Helper', level: 'read' })
    delete s.people.u1
    expect((await s.call(token)).res.statusCode).toBe(401)
    expect(s.keys.list()).toEqual([])
  })
})

describe('a failure inside the check', () => {
  // Express 4 does not catch a rejected middleware: before this, each of these
  // was an unhandled rejection, and Node stops on one.
  const boom = (token) => Object.assign(new Error(`write failed for ${token}`), { code: 'ENOSPC' })

  it('a store that throws while revoking a deleted account’s keys: a neutral 500, never a rejection', async () => {
    const s = setup()
    const { token } = s.keys.create({ userId: 'u1', name: 'Helper', level: 'read' })
    delete s.people.u1
    vi.spyOn(s.keys, 'revokeUser').mockImplementation(() => {
      throw boom(token)
    })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = await s.call(token)
    expect(out.passed).toBe(false)
    expect(out.res.statusCode).toBe(500)
    expect(out.res.body).toEqual({ error: 'server_error', error_description: 'Internal Server Error' })
    expect(err).toHaveBeenCalledTimes(1)
    const logged = JSON.stringify(err.mock.calls)
    expect(logged).toContain('ENOSPC')
    expect(logged).not.toContain(token.slice(10))
    expect(JSON.stringify(out.res.body)).not.toContain(token.slice(10))
  })

  it('the same for any step: the comparison, the access list, the account lock', async () => {
    const s = setup()
    const { token } = s.keys.create({ userId: 'u1', name: 'Helper', level: 'read' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const verify = vi.spyOn(s.keys, 'verify').mockImplementation(() => {
      throw boom(token)
    })
    expect((await s.call(token)).res.statusCode).toBe(500)
    verify.mockRestore()

    const lockedAuth = createKeyAuth({
      keys: s.keys,
      config: () => s.cfg,
      findUser: (id) => s.people[id],
      accountLocked: () => {
        throw boom(token)
      },
      resource: () => 'https://m.example/mcp',
      resourceMetadataUrl: META,
    })
    const res = fakeRes()
    const next = vi.fn()
    await expect(lockedAuth.middleware(reqWith(token), res, next)).resolves.toBeUndefined()
    expect(res.statusCode).toBe(500)
    expect(next).not.toHaveBeenCalled()

    // And a request that answered already is not answered twice.
    const sent = fakeRes()
    sent.headersSent = true
    const statusSpy = vi.spyOn(sent, 'status')
    await lockedAuth.middleware(reqWith(token), sent, vi.fn())
    expect(statusSpy).not.toHaveBeenCalled()
  })
})

describe('nothing of the key in a log line (X8)', () => {
  it('logs a fixed name and the address, never the value', async () => {
    const s = setup()
    const { token } = s.keys.create({ userId: 'u1', name: 'Helper', level: 'read' })
    const spies = ['log', 'error', 'warn', 'info'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
    try {
      const wrong = token.slice(0, -3) + (token.endsWith('AAA') ? 'BBB' : 'AAA')
      for (let i = 0; i < 11; i++) await s.call(wrong, '203.0.113.77')
      await s.call(token, '203.0.113.78')
      const everything = JSON.stringify([...s.logAuth.mock.calls.map(([e, , n]) => [e, n]), ...spies.flatMap((sp) => sp.mock.calls)])
      expect(everything).not.toContain(token.slice(10))
      expect(everything).not.toContain(wrong.slice(10))
      for (const [, , name] of s.logAuth.mock.calls) expect(name).toBe(KEY_LOG_NAME)
    } finally {
      for (const sp of spies) sp.mockRestore()
    }
  })
})
