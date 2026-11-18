import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stopProcess, removeDir } from '../tests/support/stop.js'
import {
  adminView,
  basicAuthHeader,
  codeChallenge,
  createFlowStore,
  createOidcClient,
  deriveUsername,
  linkAccount,
  mergeSettings,
  newKosmyUser,
  normalizeIssuer,
  resolveAccount,
  safeTarget,
  settingsOf,
} from './kosmy-board.js'

/**
 * "Se connecter avec Kosmy Board" (server/kosmy-board.js).
 *
 * Two halves. The helpers, one by one — the redirect rule, the account rules,
 * the ID token checks against a fake key. Then the real server, end to end,
 * against a fake Kosmy Board on loopback: a small OpenID Connect provider that
 * signs RS256 ID tokens and checks what a real one checks (PKCE, the client's
 * Basic credentials, the redirect URI). That half is what proves the flow
 * holds together: the cookie, the single-use state, the session it opens.
 */

const here = path.dirname(fileURLToPath(import.meta.url))

/* ---------- a fake Kosmy Board ---------- */

function makeKey(kid) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  return { kid, privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' } }
}

function signJwt(payload, key, header = {}) {
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: key.kid, ...header })).toString('base64url')
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), key.privateKey).toString('base64url')
  return `${h}.${p}.${sig}`
}

/**
 * The provider. `sub` is whoever is "signed in to the Board" right now; the
 * authorization endpoint answers at once with a code, as a Board with an open
 * session does. Every check a real Board makes on the token request is made.
 */
function fakeBoard() {
  const key = makeKey('k1')
  const st = { key, sub: 'board-user-1', name: 'Alice Martin', codes: new Map(), tokenCalls: 0, server: null, issuer: '', client: { id: 'mocky-client', secret: 's3cret value/+', redirect: '' } }
  st.server = http.createServer((req, res) => {
    const url = new URL(req.url, st.issuer)
    const json = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (url.pathname === '/oidc/.well-known/openid-configuration') {
      return json(200, {
        issuer: st.issuer,
        authorization_endpoint: `${st.issuer}/auth`,
        token_endpoint: `${st.issuer}/token`,
        jwks_uri: `${st.issuer}/jwks`,
      })
    }
    if (url.pathname === '/oidc/jwks') return json(200, { keys: [st.key.jwk] })
    if (url.pathname === '/oidc/auth') {
      const q = url.searchParams
      const back = new URL(q.get('redirect_uri'))
      if (q.get('client_id') !== st.client.id || q.get('redirect_uri') !== st.client.redirect) {
        back.searchParams.set('error', 'invalid_request')
      } else if (st.deny) {
        back.searchParams.set('error', 'access_denied')
      } else {
        const code = crypto.randomBytes(12).toString('hex')
        st.codes.set(code, { challenge: q.get('code_challenge'), method: q.get('code_challenge_method'), nonce: q.get('nonce'), redirect: q.get('redirect_uri'), sub: st.sub, scope: q.get('scope') })
        back.searchParams.set('code', code)
      }
      back.searchParams.set('state', q.get('state'))
      back.searchParams.set('iss', st.issuer)
      res.writeHead(303, { location: back.href })
      return res.end()
    }
    if (url.pathname === '/oidc/token' && req.method === 'POST') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        st.tokenCalls++
        const f = new URLSearchParams(body)
        if (req.headers.authorization !== basicAuthHeader(st.client.id, st.client.secret)) return json(401, { error: 'invalid_client' })
        const c = st.codes.get(f.get('code'))
        st.codes.delete(f.get('code'))
        if (!c || f.get('grant_type') !== 'authorization_code' || f.get('redirect_uri') !== c.redirect) return json(400, { error: 'invalid_grant' })
        if (c.method !== 'S256' || codeChallenge(f.get('code_verifier') || '') !== c.challenge) return json(400, { error: 'invalid_grant' })
        const now = Math.floor(Date.now() / 1000)
        const claims = { iss: st.issuer, sub: c.sub, aud: st.client.id, exp: now + 300, iat: now, nonce: c.nonce, name: st.name, email: 'alice@example.com', preferred_username: 'alice@example.com', email_verified: false, ...(st.tamper || {}) }
        json(200, { access_token: 'at', token_type: 'Bearer', id_token: signJwt(claims, st.key) })
      })
      return
    }
    json(404, { error: 'not_found' })
  })
  return new Promise((resolve) => {
    st.server.listen(0, '127.0.0.1', () => {
      st.issuer = `http://127.0.0.1:${st.server.address().port}/oidc`
      resolve(st)
    })
  })
}

/* ---------- the helpers ---------- */

describe('kosmy-board helpers', () => {
  it('accepts only same-origin targets', () => {
    const base = 'http://mocky.test:8790'
    expect(safeTarget('http://mocky.test:8790/p/abc?screen=1', base)).toBe('/p/abc?screen=1')
    expect(safeTarget('/settings', base)).toBe('/settings')
    expect(safeTarget('https://evil.example/', base)).toBe('/')
    expect(safeTarget('//evil.example/x', base)).toBe('/')
    expect(safeTarget('http://mocky.test:9999/', base)).toBe('/')
    expect(safeTarget('javascript:alert(1)', base)).toBe('/')
    expect(safeTarget(null, base)).toBe('/')
  })

  it('normalises the issuer and refuses what is not an http(s) URL', () => {
    expect(normalizeIssuer(' https://board.example/oidc/ ')).toBe('https://board.example/oidc')
    expect(normalizeIssuer('ftp://x')).toBe(null)
    expect(normalizeIssuer('https://board.example/oidc?x=1')).toBe(null)
    expect(normalizeIssuer('')).toBe(null)
  })

  it('keeps the secret write-only', () => {
    const { next } = mergeSettings({}, { issuer: 'https://b.example/oidc', clientId: 'c', clientSecret: 'shh' })
    const again = mergeSettings(next, { issuer: 'https://b.example/oidc', clientId: 'c', clientSecret: '' })
    expect(again.next.clientSecret).toBe('shh')
    expect(again.changed).toEqual([])
    const view = adminView({ kosmyBoard: again.next }, 'http://m.test')
    expect(view).not.toHaveProperty('clientSecret')
    expect(view).toMatchObject({ hasSecret: true, enabled: true, autoCreate: false, redirectUri: 'http://m.test/auth/kosmy-board/callback', initiateLoginUri: 'http://m.test/auth/kosmy-board/login' })
    expect(mergeSettings({}, { issuer: 'not a url' }).error).toBe('issuer')
    expect(settingsOf({}).autoCreate).toBe(false)
  })

  it('finds accounts by sub only, never by e-mail', () => {
    const users = [{ id: 'a', username: 'alice', email: 'alice@example.com', role: 'admin' }]
    const claims = { sub: 'x', email: 'alice@example.com', preferred_username: 'alice@example.com', name: 'Alice' }
    expect(resolveAccount(users, claims, { autoCreate: false })).toEqual({ error: 'not_linked' })
    expect(resolveAccount(users, claims, { autoCreate: true })).toEqual({ create: true })
    users[0].kosmySub = 'x'
    expect(resolveAccount(users, claims, { autoCreate: false }).user.id).toBe('a')
  })

  it('creates plain users with a unique name and no password', () => {
    const users = [{ username: 'alice-martin' }]
    const u = newKosmyUser(users, { sub: 's', name: 'Alice Martin', email: 'a@x' })
    expect(u).toMatchObject({ role: 'user', kosmySub: 's', salt: null, hash: null, email: null, username: 'alice-martin2' })
    expect(deriveUsername([], { sub: 's', name: 'Zoé' })).toBe('zoe')
    expect(deriveUsername([], { sub: 's', email: 'jo@x' })).toBe('kosmy-user')
  })

  it('links once per sub', () => {
    const users = [{ id: 'a' }, { id: 'b', kosmySub: 'taken' }]
    expect(linkAccount(users, 'a', 'taken')).toEqual({ error: 'already_linked' })
    expect(linkAccount(users, 'a', 'mine').user.kosmySub).toBe('mine')
    expect(linkAccount(users, 'a', 'other')).toEqual({ error: 'other_linked' })
    expect(linkAccount(users, 'zz', 'x')).toEqual({ error: 'session' })
  })

  it('consumes a state once, and forgets it after its lifetime', () => {
    let t = 1000
    const flows = createFlowStore({ ttlMs: 100, now: () => t })
    const s = flows.create({ nonce: 'n' })
    expect(flows.take(s)).toMatchObject({ nonce: 'n' })
    expect(flows.take(s)).toBe(null)
    const s2 = flows.create({})
    t += 101
    expect(flows.take(s2)).toBe(null)
  })

  it('encodes Basic credentials the RFC 6749 way', () => {
    const h = basicAuthHeader('id with space', 'a:b/+')
    expect(Buffer.from(h.slice(6), 'base64').toString()).toBe('id+with+space:a%3Ab%2F%2B')
  })
})

describe('ID token verification', () => {
  const issuer = 'https://board.example/oidc'
  const doc = { issuer, authorization_endpoint: `${issuer}/auth`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks` }
  const key = makeKey('k1')
  const other = makeKey('k1')
  let jwks = [key.jwk]
  const fetchImpl = async (url) => {
    const body = String(url).endsWith('/jwks') ? { keys: jwks } : doc
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const client = createOidcClient({ fetchImpl })
  const now = Math.floor(Date.now() / 1000)
  const good = { iss: issuer, aud: 'cid', sub: 'u1', exp: now + 60, iat: now, nonce: 'n1', name: 'A' }
  const check = (token) => client.discover(issuer).then((d) => client.verifyIdToken(token, { issuer, doc: d, clientId: 'cid', nonce: 'n1' }))

  it('accepts a good token', async () => {
    await expect(check(signJwt(good, key))).resolves.toMatchObject({ sub: 'u1', name: 'A' })
  })
  it.each([
    ['wrong issuer', { iss: 'https://evil/oidc' }],
    ['wrong audience', { aud: 'someone-else' }],
    ['expired', { exp: now - 3600 }],
    ['wrong nonce', { nonce: 'n2' }],
    ['no sub', { sub: '' }],
  ])('refuses a token with %s', async (_, patch) => {
    await expect(check(signJwt({ ...good, ...patch }, key))).rejects.toMatchObject({ code: 'token' })
  })
  it('refuses a signature from another key', async () => {
    await expect(check(signJwt(good, other))).rejects.toMatchObject({ code: 'token' })
  })
  it('refuses alg none and HS256', async () => {
    const [, p] = signJwt(good, key).split('.')
    const none = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${p}.`
    await expect(check(none)).rejects.toMatchObject({ code: 'token' })
    const hs = signJwt(good, key, { alg: 'HS256' })
    await expect(check(hs)).rejects.toMatchObject({ code: 'token' })
  })
  it('follows a key rotation', async () => {
    const rotated = makeKey('k2')
    jwks = [rotated.jwk]
    client.clear()
    await expect(check(signJwt(good, rotated))).resolves.toMatchObject({ sub: 'u1' })
  })
})

/* ---------- the real server, end to end ---------- */

async function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

/** A browser, reduced to a cookie jar and manual redirects. */
function browser() {
  const jar = new Map()
  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  function keep(res) {
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';')
      const i = pair.indexOf('=')
      const k = pair.slice(0, i)
      const v = pair.slice(i + 1)
      if (!v || /max-age=0|expires=thu, 01 jan 1970/i.test(line)) jar.delete(k)
      else jar.set(k, v)
    }
  }
  async function call(method, url, body) {
    const res = await fetch(url, {
      method,
      redirect: 'manual',
      headers: { 'content-type': 'application/json', ...(jar.size ? { cookie: cookieHeader() } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    keep(res)
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      /* not JSON */
    }
    return { status: res.status, json, location: res.headers.get('location') }
  }
  /** Follow redirects (cookies included) until a page on `stopAt` answers. */
  async function go(url, stopAt) {
    let r = await call('GET', url)
    let hops = 0
    while (r.location && hops++ < 10) {
      const next = new URL(r.location, url).href
      if (stopAt && next.startsWith(stopAt) && !next.includes('/auth/kosmy-board/')) return { ...r, final: next }
      url = next
      r = await call('GET', url)
    }
    return { ...r, final: url }
  }
  return { call, go, jar }
}

describe('Kosmy Board sign-in, through the real server', () => {
  let proc, base, dataDir, board
  const admin = browser()

  beforeAll(async () => {
    board = await fakeBoard()
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-kosmy-'))
    const port = await freePort()
    base = `http://127.0.0.1:${port}`
    board.client.redirect = `${base}/auth/kosmy-board/callback`
    proc = spawn(process.execPath, [path.join(here, 'index.js')], {
      env: { ...process.env, MOCKY_DATA_DIR: dataDir, MOCKY_PORT: String(port), MOCKY_ORIGIN: base, NODE_ENV: 'test' },
      stdio: 'ignore',
    })
    const deadline = Date.now() + 15_000
    for (;;) {
      try {
        await fetch(`${base}/api/config`)
        break
      } catch {
        if (Date.now() > deadline) throw new Error('server did not start in time')
        await new Promise((r) => setTimeout(r, 100))
      }
    }
    expect((await admin.call('POST', `${base}/api/register`, { username: 'owner', password: 'correct-horse-battery' })).status).toBe(200)
  }, 30_000)

  afterAll(async () => {
    await stopProcess(proc)
    await new Promise((r) => board.server.close(r))
    try {
      removeDir(dataDir)
    } catch {
      /* best effort */
    }
  })

  it('is off until an administrator sets it up, and keeps the secret write-only', async () => {
    expect((await admin.call('GET', `${base}/api/config`)).json.kosmyBoard).toEqual({ enabled: false })
    const off = await browser().go(`${base}/auth/kosmy-board/login`, base)
    expect(off.final).toBe(`${base}/?kosmy=error&reason=not_configured`)

    const anon = await browser().call('PUT', `${base}/api/admin/kosmy-board`, { issuer: board.issuer })
    expect(anon.status).toBe(401)

    const r = await admin.call('PUT', `${base}/api/admin/kosmy-board`, { issuer: board.issuer, clientId: board.client.id, clientSecret: board.client.secret })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ enabled: true, hasSecret: true, autoCreate: false, redirectUri: board.client.redirect })
    expect(JSON.stringify(r.json)).not.toContain(board.client.secret)
    expect(JSON.stringify((await admin.call('GET', `${base}/api/admin/kosmy-board`)).json)).not.toContain(board.client.secret)
    expect((await admin.call('GET', `${base}/api/config`)).json.kosmyBoard).toEqual({ enabled: true })
  })

  it('refuses an unknown Kosmy Board account (no e-mail matching, no auto-creation by default)', async () => {
    const b = browser()
    const r = await b.go(`${base}/auth/kosmy-board/login`, base)
    expect(r.final).toBe(`${base}/?kosmy=error&reason=not_linked`)
    expect((await b.call('GET', `${base}/api/me`)).json.user).toBe(null)
  })

  it('links the signed-in account, then signs in with it', async () => {
    const start = await admin.call('POST', `${base}/api/account/kosmy-board/link`)
    expect(start.status).toBe(200)
    const auth = new URL(start.json.url)
    expect(auth.searchParams.get('code_challenge_method')).toBe('S256')
    expect(auth.searchParams.get('scope')).toBe('openid profile email')
    const done = await admin.go(start.json.url, base)
    expect(done.final).toBe(`${base}/?kosmy=linked`)
    expect((await admin.call('GET', `${base}/api/me`)).json.user).toMatchObject({ username: 'owner', kosmyBoard: true, hasPassword: true })

    // A fresh browser, through the Board's "Ouvrir" (third-party initiated login).
    const b = browser()
    const open = new URL(`${base}/auth/kosmy-board/login`)
    open.searchParams.set('iss', board.issuer)
    open.searchParams.set('target_link_uri', `${base}/p/demo?screen=2`)
    const r = await b.go(open.href, base)
    expect(r.final).toBe(`${base}/p/demo?screen=2`)
    expect((await b.call('GET', `${base}/api/me`)).json.user).toMatchObject({ username: 'owner', role: 'admin' })
  })

  it('refuses another issuer and never redirects off the instance', async () => {
    const b = browser()
    const bad = await b.go(`${base}/auth/kosmy-board/login?iss=${encodeURIComponent('https://evil.example/oidc')}`, base)
    expect(bad.final).toBe(`${base}/?kosmy=error&reason=issuer`)
    const r = await b.go(`${base}/auth/kosmy-board/login?target_link_uri=${encodeURIComponent('https://evil.example/')}`, base)
    expect(r.final).toBe(`${base}/`)
  })

  it('uses a state once, and only in the browser that started the flow', async () => {
    const b = browser()
    const start = await b.call('GET', `${base}/auth/kosmy-board/login`)
    const atBoard = await b.call('GET', start.location)
    const callback = atBoard.location
    // Another browser with the same answer: it has no flow cookie, so nothing opens.
    const thief = browser()
    expect((await thief.call('GET', callback)).location).toBe(`${base}/?kosmy=error&reason=expired`)
    expect((await thief.call('GET', `${base}/api/me`)).json.user).toBe(null)
    // The right browser completes it once…
    const flowCookie = b.jar.get('mocky_kb_flow')
    expect((await b.call('GET', callback)).location).toBe(`${base}/`)
    expect(b.jar.has('mocky_kb_flow')).toBe(false)
    // …and a replay, even with the cookie put back, finds the state spent.
    b.jar.set('mocky_kb_flow', flowCookie)
    expect((await b.call('GET', callback)).location).toBe(`${base}/?kosmy=error&reason=expired`)
  })

  it('reports a refusal from the Board', async () => {
    board.deny = true
    try {
      const r = await browser().go(`${base}/auth/kosmy-board/login`, base)
      expect(r.final).toBe(`${base}/?kosmy=error&reason=denied`)
    } finally {
      board.deny = false
    }
  })

  it('refuses an ID token for another client', async () => {
    board.tamper = { aud: 'someone-else' }
    try {
      const r = await browser().go(`${base}/auth/kosmy-board/login`, base)
      expect(r.final).toBe(`${base}/?kosmy=error&reason=token`)
    } finally {
      board.tamper = null
    }
  })

  it('creates a plain account when the administrator allows it, never an admin', async () => {
    await admin.call('PUT', `${base}/api/admin/kosmy-board`, { autoCreate: true })
    board.sub = 'board-user-2'
    board.name = 'Owner'
    try {
      const b = browser()
      const r = await b.go(`${base}/auth/kosmy-board/login`, base)
      expect(r.final).toBe(`${base}/`)
      const me = (await b.call('GET', `${base}/api/me`)).json.user
      expect(me).toMatchObject({ role: 'user', kosmyBoard: true, hasPassword: false })
      // "owner" exists: the derived name is made unique, never merged into it.
      expect(me.username).toBe('owner2')
      const unlink = await b.call('POST', `${base}/api/account/kosmy-board/unlink`, { password: 'x' })
      expect(unlink.json.code).toBe('no_password')
    } finally {
      board.sub = 'board-user-1'
      await admin.call('PUT', `${base}/api/admin/kosmy-board`, { autoCreate: false })
    }
  })

  it('unlinks only with the password', async () => {
    expect((await admin.call('POST', `${base}/api/account/kosmy-board/unlink`, { password: 'wrong-password' })).status).toBe(401)
    const ok = await admin.call('POST', `${base}/api/account/kosmy-board/unlink`, { password: 'correct-horse-battery' })
    expect(ok.status).toBe(200)
    expect(ok.json.user.kosmyBoard).toBe(false)
    const r = await browser().go(`${base}/auth/kosmy-board/login`, base)
    expect(r.final).toBe(`${base}/?kosmy=error&reason=not_linked`)
  })

  it('records it in the audit log', async () => {
    const log = fs.readFileSync(path.join(dataDir, 'audit.jsonl'), 'utf8')
    for (const a of ['config.kosmyBoard', 'account.kosmy-link', 'auth.kosmy-board', 'account.kosmy-unlink']) expect(log).toContain(`"${a}"`)
    expect(log).not.toContain(board.client.secret)
  })
})
