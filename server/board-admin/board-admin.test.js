import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stopProcess, removeDir } from '../../tests/support/stop.js'
import { TEXTS, langOf } from './texts.js'
import { createJtiStore } from './index.js'

/**
 * Mocky's admin, from Kosmy Board (server/board-admin/, kosmy.board-admin.v1).
 *
 * The real server, against a fake Board on loopback that serves what the admin
 * protocol reads of it: the discovery document and the JWKS. The tokens are
 * signed here, as the Board signs them, so each check of docs/admin-api.md can
 * be broken one at a time. The accounts are seeded on disk, linked by `sub`,
 * the way "Relier à Kosmy Board" leaves them (server/kosmy-board.test.js
 * covers the link itself).
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const ADMIN = '/api/kosmy-board/admin'

function makeKey(kid) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  return { kid, privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' } }
}

function signJwt(payload, key, header = {}) {
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'kb-admin+jwt', kid: key.kid, ...header })).toString('base64url')
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), key.privateKey).toString('base64url')
  return `${h}.${p}.${sig}`
}

function fakeBoard() {
  const st = { key: makeKey('k1'), issuer: '', server: null }
  st.server = http.createServer((req, res) => {
    const json = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.url === '/oidc/.well-known/openid-configuration') {
      return json(200, {
        issuer: st.issuer,
        authorization_endpoint: `${st.issuer}/auth`,
        token_endpoint: `${st.issuer}/token`,
        jwks_uri: `${st.issuer}/jwks`,
      })
    }
    if (req.url === '/oidc/jwks') return json(200, { keys: [st.key.jwk] })
    json(404, { error: 'not_found' })
  })
  return new Promise((resolve) => {
    st.server.listen(0, '127.0.0.1', () => {
      st.issuer = `http://127.0.0.1:${st.server.address().port}/oidc`
      resolve(st)
    })
  })
}

async function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

describe('the texts', () => {
  it('has the same keys in French and English', () => {
    expect(Object.keys(TEXTS.en).sort()).toEqual(Object.keys(TEXTS.fr).sort())
  })
  it('answers in English only when asked', () => {
    expect(langOf({ headers: { 'accept-language': 'en' } })).toBe('en')
    expect(langOf({ headers: { 'accept-language': 'en-GB,en;q=0.9' } })).toBe('en')
    expect(langOf({ headers: { 'accept-language': 'fr' } })).toBe('fr')
    expect(langOf({ headers: {} })).toBe('fr')
  })
  it('remembers a jti until its token is dead', () => {
    let t = 1_000_000
    const jtis = createJtiStore({ now: () => t })
    expect(jtis.use('a', 1_000 + 60)).toBe(true)
    expect(jtis.use('a', 1_000 + 60)).toBe(false)
    t = (1_000 + 60) * 1000 + 31_000
    expect(jtis.use('b', 2_000)).toBe(true)
    expect(jtis.size).toBe(1)
  })
})

describe('Mocky admin from Kosmy Board, through the real server', () => {
  let proc, base, dataDir, board
  const clientId = 'mocky-client'

  /** A token as the Board makes one for `method path`, with `patch` over its claims. */
  function token(method, p, patch = {}, header = {}) {
    const now = Math.floor(Date.now() / 1000)
    return signJwt(
      {
        iss: board.issuer,
        aud: clientId,
        sub: 'board-admin',
        iat: now,
        exp: now + 60,
        jti: crypto.randomUUID(),
        htm: method,
        htu: `${base}${p}`,
        name: 'Alice',
        ...patch,
      },
      board.key,
      header,
    )
  }

  async function call(method, p, { tok, body, lang = 'fr' } = {}) {
    const res = await fetch(`${base}${p}`, {
      method,
      redirect: 'manual',
      headers: {
        'accept-language': lang,
        ...(tok ? { authorization: `Bearer ${tok}` } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      /* not JSON */
    }
    return { status: res.status, json, text, headers: res.headers }
  }
  const get = (p, opts = {}) => call('GET', p, { tok: token('GET', p), ...opts })
  const post = (p, body, opts = {}) => call('POST', p, { tok: token('POST', p), body, ...opts })

  beforeAll(async () => {
    board = await fakeBoard()
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-board-admin-'))
    const now = Date.now()
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.scryptSync('correct-horse-battery', salt, 64).toString('hex')
    fs.writeFileSync(
      path.join(dataDir, 'users.json'),
      JSON.stringify([
        { id: 'u-admin', username: 'owner', role: 'admin', email: null, dashySub: null, kosmySub: 'board-admin', salt, hash, createdAt: now },
        { id: 'u-member', username: 'member', role: 'user', email: null, dashySub: null, kosmySub: 'board-member', salt, hash, createdAt: now },
      ]),
    )
    fs.writeFileSync(
      path.join(dataDir, 'config.json'),
      JSON.stringify({ allowRegistration: false, kosmyBoard: { issuer: board.issuer, clientId, clientSecret: 'the-client-secret' } }),
    )
    const port = await freePort()
    base = `http://127.0.0.1:${port}`
    proc = spawn(process.execPath, [path.join(here, '..', 'index.js')], {
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

  it('answers the menu to a valid token, as JSON that is never cached nor shared cross-origin', async () => {
    const r = await get(ADMIN)
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toMatch(/^application\/json; charset=utf-8/)
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(r.headers.get('access-control-allow-origin')).toBe(null)
    expect(r.json).toMatchObject({ protocol: 'kosmy.board-admin.v1', app: { name: 'Mocky' }, user: { name: 'owner', role: 'Administrateur' } })
    const ids = r.json.sections.map((s) => s.id)
    expect(ids[0]).toBe('overview')
    expect(ids).toEqual(expect.arrayContaining(['users', 'sessions', 'access', 'maintenance', 'audit']))
    expect(ids.length).toBeLessThanOrEqual(20)
    expect(r.json.sections.find((s) => s.id === 'users').title).toBe('Utilisateurs')
    expect((await get(ADMIN, { lang: 'en' })).json.sections.find((s) => s.id === 'users').title).toBe('Users')
  })

  it('refuses no token, a bad signature, and an ID token (wrong typ)', async () => {
    expect((await call('GET', ADMIN)).json).toMatchObject({ error: 'invalid_token' })
    const forged = signJwt(
      { iss: board.issuer, aud: clientId, sub: 'board-admin', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60, jti: 'x', htm: 'GET', htu: `${base}${ADMIN}` },
      makeKey('k1'),
    )
    expect((await call('GET', ADMIN, { tok: forged })).status).toBe(401)
    // What an ID token looks like: same key, same issuer and audience, `typ: JWT`.
    const idToken = token('GET', ADMIN, { nonce: 'n', email: 'alice@example.com' }, { typ: 'JWT' })
    const r = await call('GET', ADMIN, { tok: idToken })
    expect(r.status).toBe(401)
    expect(r.json.error).toBe('invalid_token')
  })

  it('refuses a token for another client (aud)', async () => {
    const r = await call('GET', ADMIN, { tok: token('GET', ADMIN, { aud: 'another-app' }) })
    expect(r.status).toBe(401)
    expect(r.json.error).toBe('invalid_token')
  })

  it('refuses an expired token', async () => {
    const old = Math.floor(Date.now() / 1000) - 600
    const r = await call('GET', ADMIN, { tok: token('GET', ADMIN, { iat: old, exp: old + 60 }) })
    expect(r.status).toBe(401)
  })

  it('takes a token once (jti)', async () => {
    const tok = token('GET', ADMIN)
    expect((await call('GET', ADMIN, { tok })).status).toBe(200)
    const again = await call('GET', ADMIN, { tok })
    expect(again.status).toBe(401)
    expect(again.json.error).toBe('invalid_token')
  })

  it('binds a token to its method and its path (htm, htu)', async () => {
    const asPost = token('POST', ADMIN)
    expect((await call('GET', ADMIN, { tok: asPost })).status).toBe(401)
    const forUsers = token('GET', `${ADMIN}/users`)
    expect((await call('GET', `${ADMIN}/audit`, { tok: forUsers })).status).toBe(401)
    expect((await call('GET', ADMIN, { tok: token('GET', `${ADMIN}/users`) })).status).toBe(401)
    // Behind a proxy that adds a prefix, the path still ends with the one asked for.
    const prefixed = token('GET', ADMIN, { htu: `https://board-sees.example/mocky${ADMIN}` })
    expect((await call('GET', ADMIN, { tok: prefixed })).status).toBe(200)
  })

  it('says when the Board account is linked to nothing (not_linked)', async () => {
    const r = await call('GET', ADMIN, { tok: token('GET', ADMIN, { sub: 'nobody-here' }) })
    expect(r.status).toBe(403)
    expect(r.json.error).toBe('not_linked')
    expect(r.json.message).toMatch(/Relier à Kosmy Board/)
  })

  it('refuses a linked account that is not an administrator in Mocky (forbidden)', async () => {
    const r = await call('GET', ADMIN, { tok: token('GET', ADMIN, { sub: 'board-member' }), lang: 'en' })
    expect(r.status).toBe(403)
    expect(r.json).toEqual({ error: 'forbidden', message: 'Your Mocky account does not have administrator rights.' })
  })

  it('describes the accounts without a single secret', async () => {
    const r = await get(`${ADMIN}/users`)
    expect(r.status).toBe(200)
    expect(r.json.id).toBe('users')
    const table = r.json.blocks.find((b) => b.type === 'table')
    expect(table.rows.map((row) => row.id).sort()).toEqual(['u-admin', 'u-member'])
    const me = table.rows.find((row) => row.id === 'u-admin')
    expect(me.cells.name).toBe('owner (vous)')
    expect(me.actions).not.toContain('delete')
    expect(table.rows.find((row) => row.id === 'u-member').actions).toEqual(['plan-free', 'reset-password', 'signout', 'delete'])
    const users = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'))
    for (const secret of [users[0].hash, users[0].salt, 'the-client-secret']) expect(r.text).not.toContain(secret)
    const access = await get(`${ADMIN}/access`)
    expect(access.status).toBe(200)
    expect(access.text).not.toContain('the-client-secret')
  })

  it('serves every section it lists', async () => {
    const ids = (await get(ADMIN)).json.sections.map((s) => s.id)
    for (const id of ids) {
      const r = await get(`${ADMIN}/${id}`, { lang: 'en' })
      expect(r.status, id).toBe(200)
      expect(r.json.id).toBe(id)
      expect(Array.isArray(r.json.blocks)).toBe(true)
      expect(r.json.blocks.length).toBeLessThanOrEqual(30)
    }
  })

  it('creates an account from the Board: same rules, a password revealed once, the same audit line', async () => {
    const r = await post(`${ADMIN}/users`, { action: 'create', values: { username: 'bob', password: '', role: 'user', plan: 'standard', mustChange: false } })
    expect(r.status).toBe(200)
    expect(r.json.ok).toBe(true)
    expect(r.json.reveal.value).toMatch(/^[\w-]{16}$/)
    expect(r.json.section.blocks[0].rows.some((row) => row.cells.name === 'bob')).toBe(true)

    // The account works with the revealed password, and nothing stored it in clear.
    const login = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'bob', password: r.json.reveal.value }),
    })
    expect(login.status).toBe(200)
    expect(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8')).not.toContain(r.json.reveal.value)

    const audit = fs.readFileSync(path.join(dataDir, 'audit.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    const line = audit.find((e) => e.action === 'user.create' && e.target?.name === 'bob')
    expect(line).toMatchObject({ actor: { id: 'u-admin', name: 'owner' }, detail: { role: 'user', via: 'kosmy-board' } })

    // Admin's own rules hold: the name is taken now.
    const twice = await post(`${ADMIN}/users`, { action: 'create', values: { username: 'bob', password: 'another-long-one' } }, { lang: 'en' })
    expect(twice.status).toBe(409)
    expect(twice.json).toEqual({ error: 'invalid', message: 'This username is already taken.' })
    const short = await post(`${ADMIN}/users`, { action: 'create', values: { username: 'carol', password: 'short' } })
    expect(short.status).toBe(422)
  })

  it('applies a row action and a form, and refuses an unknown row or action', async () => {
    const plan = await post(`${ADMIN}/users`, { action: 'plan-free', row: 'u-member' })
    expect(plan.status).toBe(200)
    expect(JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8')).find((u) => u.id === 'u-member').plan).toBe('free')

    const self = await post(`${ADMIN}/users`, { action: 'delete', row: 'u-admin' })
    expect(self.status).toBe(422)

    const maint = await post(`${ADMIN}/maintenance`, { action: 'save-maintenance', values: { on: true, message: 'Back at 10' } })
    expect(maint.status).toBe(200)
    expect((await fetch(`${base}/api/config`).then((x) => x.json())).maintenance).toMatchObject({ on: true, message: 'Back at 10' })
    // The Board's actions are an administrator's: maintenance lets them through.
    const off = await post(`${ADMIN}/maintenance`, { action: 'save-maintenance', values: { on: false, message: '' } })
    expect(off.status).toBe(200)
    expect(off.json.section.blocks[0].tone).toBe('success')

    expect((await post(`${ADMIN}/users`, { action: 'plan-free', row: 'no-such-id' })).status).toBe(404)
    expect((await post(`${ADMIN}/users`, { action: 'explode', row: 'u-member' })).json.error).toBe('not_found')
    expect((await get(`${ADMIN}/no-such-section`)).json.error).toBe('not_found')
  })

  it('never lets the app shell answer below its path', async () => {
    const r = await get(`${ADMIN}/users/extra`)
    expect(r.status).toBe(404)
    expect(r.json.error).toBe('not_found')
    const bad = await call('GET', `${ADMIN}/Users`)
    expect(bad.status).toBe(401)
    expect(bad.headers.get('content-type')).toMatch(/json/)
  })
})
