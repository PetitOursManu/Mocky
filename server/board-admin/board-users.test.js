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
import { basicAuthHeader, codeChallenge } from '../kosmy-board.js'

/**
 * The users Kosmy Board manages (server/board-admin/users.js, kosmy.board-users.v1).
 *
 * The real server, against a fake Board on loopback that does both halves of
 * what the protocol reads of it: the admin tokens (`kb-admin+jwt`, signed here
 * as the Board signs them, so each check can be broken one at a time) and
 * sign-in — discovery, authorization, the token endpoint — whose ID token can
 * carry `kosmy_board_access`. The accounts are seeded on disk, linked by `sub`.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const USERS = '/api/kosmy-board/users'
const PASSWORD = 'correct-horse-battery'

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

/**
 * The Board. `person` is whoever is "signed in to the Board" right now; the
 * authorization endpoint answers at once with a code, as a Board with an open
 * session does, and the ID token carries `person.access` when there is one.
 */
function fakeBoard() {
  const st = {
    key: makeKey('k1'),
    issuer: '',
    server: null,
    codes: new Map(),
    person: { sub: 'board-admin', name: 'Owner', email: 'owner@example.com', access: null },
    client: { id: 'mocky-client', secret: 'the-client-secret', redirect: '' },
  }
  st.server = http.createServer((req, res) => {
    const url = new URL(req.url, st.issuer)
    const json = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (url.pathname === '/oidc/.well-known/openid-configuration') {
      return json(200, { issuer: st.issuer, authorization_endpoint: `${st.issuer}/auth`, token_endpoint: `${st.issuer}/token`, jwks_uri: `${st.issuer}/jwks` })
    }
    if (url.pathname === '/oidc/jwks') return json(200, { keys: [st.key.jwk] })
    if (url.pathname === '/oidc/auth') {
      const q = url.searchParams
      const back = new URL(q.get('redirect_uri'))
      const code = crypto.randomBytes(12).toString('hex')
      st.codes.set(code, { challenge: q.get('code_challenge'), nonce: q.get('nonce'), redirect: q.get('redirect_uri'), person: { ...st.person } })
      back.searchParams.set('code', code)
      back.searchParams.set('state', q.get('state'))
      back.searchParams.set('iss', st.issuer)
      res.writeHead(303, { location: back.href })
      return res.end()
    }
    if (url.pathname === '/oidc/token' && req.method === 'POST') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        const f = new URLSearchParams(body)
        if (req.headers.authorization !== basicAuthHeader(st.client.id, st.client.secret)) return json(401, { error: 'invalid_client' })
        const c = st.codes.get(f.get('code'))
        st.codes.delete(f.get('code'))
        if (!c || f.get('redirect_uri') !== c.redirect || codeChallenge(f.get('code_verifier') || '') !== c.challenge) return json(400, { error: 'invalid_grant' })
        const now = Math.floor(Date.now() / 1000)
        const p = c.person
        const claims = {
          iss: st.issuer,
          sub: p.sub,
          aud: st.client.id,
          exp: now + 300,
          iat: now,
          nonce: c.nonce,
          name: p.name,
          email: p.email,
          email_verified: false,
          ...(p.access ? { kosmy_board_access: p.access } : {}),
        }
        json(200, { access_token: 'at', token_type: 'Bearer', id_token: signJwt(claims, st.key, { typ: 'JWT' }) })
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
  async function call(method, url, body, headers = {}) {
    const res = await fetch(url, {
      method,
      redirect: 'manual',
      headers: { 'content-type': 'application/json', ...headers, ...(jar.size ? { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}) },
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
  /** Follow redirects until a page of `stopAt` outside the sign-in routes answers. */
  async function go(url, stopAt) {
    let r = await call('GET', url)
    let hops = 0
    while (r.location && hops++ < 10) {
      const next = new URL(r.location, url).href
      if (next.startsWith(stopAt) && !next.includes('/auth/kosmy-board/')) return { ...r, final: next }
      url = next
      r = await call('GET', url)
    }
    return { ...r, final: url }
  }
  return { call, go }
}

describe('users managed by Kosmy Board, through the real server', () => {
  let proc, base, dataDir, board

  const readUsers = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'))
  const account = (pred) => readUsers().find(pred)

  /** A token as the Board makes one for `method path`, with `patch` over its claims. */
  function token(method, p, patch = {}, header = {}) {
    const now = Math.floor(Date.now() / 1000)
    return signJwt(
      { iss: board.issuer, aud: board.client.id, sub: 'board-admin', iat: now, exp: now + 60, jti: crypto.randomUUID(), htm: method, htu: `${base}${p}`, ...patch },
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
  const list = (opts = {}) => call('GET', USERS, { tok: token('GET', USERS, opts.patch), ...opts })
  const put = (sub, body, opts = {}) => call('PUT', `${USERS}/${sub}`, { tok: token('PUT', `${USERS}/${sub}`, opts.patch), body, ...opts })
  const del = (sub, opts = {}) => call('DELETE', `${USERS}/${sub}`, { tok: token('DELETE', `${USERS}/${sub}`, opts.patch), ...opts })

  /** Sign in through the Board as `person`, in a fresh browser. */
  async function boardSignIn(person) {
    board.person = person
    const b = browser()
    const r = await b.go(`${base}/auth/kosmy-board/login`, base)
    const me = (await b.call('GET', `${base}/api/me`)).json.user
    return { final: r.final, me, b }
  }

  beforeAll(async () => {
    board = await fakeBoard()
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-board-users-'))
    const now = Date.now()
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.scryptSync(PASSWORD, salt, 64).toString('hex')
    const base0 = { email: null, dashySub: null, createdAt: now }
    fs.writeFileSync(
      path.join(dataDir, 'users.json'),
      JSON.stringify([
        { ...base0, id: 'u-admin', username: 'owner', role: 'admin', kosmySub: 'board-admin', salt, hash },
        { ...base0, id: 'u-admin2', username: 'second', role: 'admin', kosmySub: 'board-admin2', salt, hash },
        { ...base0, id: 'u-member', username: 'member', role: 'user', kosmySub: 'board-member', salt, hash },
        // From Dashy: an e-mail, no Board link — what a PUT may link by its address.
        { ...base0, id: 'u-carol', username: 'carol', role: 'user', email: 'carol@example.com', dashySub: 'dashy-carol', salt: null, hash: null },
        // Linked to another Board account, with an address a PUT must not take.
        { ...base0, id: 'u-dave', username: 'dave', role: 'user', email: 'dave@example.com', kosmySub: 'board-dave', salt, hash },
        // Unlinked with an e-mail: sign-in with a claim must NOT link it.
        { ...base0, id: 'u-erin', username: 'erin', role: 'user', email: 'erin@example.com', dashySub: 'dashy-erin', salt: null, hash: null },
      ]),
    )
    const port = await freePort()
    base = `http://127.0.0.1:${port}`
    board.client.redirect = `${base}/auth/kosmy-board/callback`
    fs.writeFileSync(
      path.join(dataDir, 'config.json'),
      JSON.stringify({
        allowRegistration: false,
        freePlan: { newAccounts: 'standard', dailyLimit: 20 },
        kosmyBoard: { issuer: board.issuer, clientId: board.client.id, clientSecret: board.client.secret },
      }),
    )
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

  it('describes the roles, the restrictions Mocky enforces and the linked accounts — no secret', async () => {
    const r = await list()
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toMatch(/^application\/json; charset=utf-8/)
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(r.json.protocol).toBe('kosmy.board-users.v1')
    expect(r.json.roles.map((x) => x.value)).toEqual(['admin', 'user'])
    expect(r.json.roles.find((x) => x.value === 'admin').admin).toBe(true)
    expect(r.json.roles.find((x) => x.value === 'user').admin).toBeUndefined()
    expect(r.json.defaultRole).toBe('user')
    // The plan (server/plan.js), users only; the assistants list, since it decides by default.
    const [plan, assistants] = r.json.fields
    expect(plan).toMatchObject({ name: 'plan', type: 'select', value: 'standard', roles: ['user'] })
    expect(plan.options.map((o) => o.value).sort()).toEqual(['free', 'standard'])
    expect(assistants).toMatchObject({ name: 'assistants', type: 'checkbox', value: false })
    expect(r.json.fields.some((f) => f.type === 'password')).toBe(false)
    // Only the accounts linked to the Board.
    expect(r.json.users.map((u) => u.sub).sort()).toEqual(['board-admin', 'board-admin2', 'board-dave', 'board-member'])
    expect(r.json.users.find((u) => u.sub === 'board-member')).toEqual({
      sub: 'board-member',
      role: 'user',
      values: { plan: 'standard', assistants: false },
      active: true,
      account: 'member',
    })
    expect(r.json.users.find((u) => u.sub === 'board-admin').values).toEqual({ assistants: false })
    for (const secret of [account((u) => u.id === 'u-admin').hash, account((u) => u.id === 'u-admin').salt, board.client.secret]) {
      expect(r.text).not.toContain(secret)
    }
    expect((await list({ lang: 'en' })).json.fields[0].label).toBe('Plan')
  })

  it('refuses a missing or forged token, an ID token, and a token made for another request (htm, htu)', async () => {
    expect((await call('GET', USERS)).json).toMatchObject({ error: 'invalid_token' })
    const forged = signJwt({ iss: board.issuer, aud: board.client.id, sub: 'board-admin', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60, jti: 'x', htm: 'GET', htu: `${base}${USERS}` }, makeKey('k1'))
    expect((await call('GET', USERS, { tok: forged })).status).toBe(401)
    expect((await call('GET', USERS, { tok: token('GET', USERS, {}, { typ: 'JWT' }) })).status).toBe(401)
    // The method…
    const asGet = token('GET', `${USERS}/board-member`)
    expect((await call('DELETE', `${USERS}/board-member`, { tok: asGet })).status).toBe(401)
    // …the person the address names…
    const forOther = token('PUT', `${USERS}/board-dave`)
    expect((await call('PUT', `${USERS}/board-member`, { tok: forOther, body: { role: 'user' } })).status).toBe(401)
    // …and the protocol: an admin-API token opens nothing here.
    expect((await call('GET', USERS, { tok: token('GET', '/api/kosmy-board/admin') })).status).toBe(401)
    // Once only.
    const once = token('GET', USERS)
    expect((await call('GET', USERS, { tok: once })).status).toBe(200)
    expect((await call('GET', USERS, { tok: once })).status).toBe(401)
    expect(account((u) => u.id === 'u-member').disabled).toBeUndefined()
  })

  it('acts only for an active administrator of Mocky', async () => {
    expect((await list({ patch: { sub: 'nobody' } })).json.error).toBe('not_linked')
    const r = await list({ patch: { sub: 'board-member' }, lang: 'en' })
    expect(r.status).toBe(403)
    expect(r.json).toEqual({ error: 'forbidden', message: 'Your Mocky account does not have administrator rights.' })
  })

  it('answers only the protocol’s methods and addresses', async () => {
    expect((await call('POST', USERS, { tok: token('POST', USERS), body: {} })).status).toBe(405)
    expect((await call('GET', `${USERS}/board-member`, { tok: token('GET', `${USERS}/board-member`) })).status).toBe(405)
    const bad = await call('PUT', `${USERS}/not_a_sub!`, { tok: token('PUT', `${USERS}/not_a_sub!`), body: { role: 'user' } })
    expect(bad.status).toBe(404)
    expect(bad.json.error).toBe('not_found')
  })

  it('creates an account without a password, linked to the sub, on the plan asked — and the same PUT twice changes nothing', async () => {
    const body = { name: 'Frank Ocean', email: 'Frank@Example.com', locale: 'fr', role: 'user', values: { plan: 'free', assistants: true } }
    const r = await put('board-frank', body)
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ ok: true, status: 'created', account: 'frank-ocean', message: 'Compte « frank-ocean » créé.' })
    const frank = account((u) => u.kosmySub === 'board-frank')
    expect(frank).toMatchObject({ username: 'frank-ocean', role: 'user', plan: 'free', email: 'frank@example.com', salt: null, hash: null })
    // On the assistants' list, in the MCP config itself.
    const mcp = JSON.parse(fs.readFileSync(path.join(dataDir, 'mcp-config.json'), 'utf8'))
    expect(mcp.access.userIds).toContain(frank.id)

    const again = await put('board-frank', body)
    expect(again.json.status).toBe('updated')
    expect(readUsers().filter((u) => u.kosmySub === 'board-frank')).toHaveLength(1)
    expect(account((u) => u.kosmySub === 'board-frank')).toEqual(frank)
    expect((await list()).json.users.find((u) => u.sub === 'board-frank')).toMatchObject({ role: 'user', values: { plan: 'free', assistants: true }, active: true })

    // Updated: standard, off the list; a field left out keeps its value.
    const up = await put('board-frank', { ...body, values: { plan: 'standard' } }, { lang: 'en' })
    expect(up.json).toMatchObject({ ok: true, status: 'updated', message: 'Account "frank-ocean" updated.' })
    expect(account((u) => u.kosmySub === 'board-frank').plan).toBeUndefined()
    expect(JSON.parse(fs.readFileSync(path.join(dataDir, 'mcp-config.json'), 'utf8')).access.userIds).toContain(frank.id)
    await put('board-frank', { ...body, values: { assistants: false } })
    expect(JSON.parse(fs.readFileSync(path.join(dataDir, 'mcp-config.json'), 'utf8')).access.userIds).not.toContain(frank.id)

    const audit = fs.readFileSync(path.join(dataDir, 'audit.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    expect(audit.find((e) => e.action === 'user.provision' && e.target?.name === 'frank-ocean')).toMatchObject({
      actor: { id: 'u-admin', name: 'owner' },
      detail: { status: 'created', role: 'user', plan: 'free', via: 'kosmy-board' },
    })
  })

  it('links an unlinked account by its e-mail, and refuses an address another Board account holds (409)', async () => {
    const r = await put('board-carol', { name: 'Carol', email: 'carol@example.com', role: 'user', values: { plan: 'standard' } })
    expect(r.json).toMatchObject({ ok: true, status: 'linked', account: 'carol' })
    expect(account((u) => u.id === 'u-carol').kosmySub).toBe('board-carol')
    expect(readUsers().filter((u) => u.email === 'carol@example.com')).toHaveLength(1)

    const taken = await put('board-someone', { name: 'Not Dave', email: 'dave@example.com', role: 'user' })
    expect(taken.status).toBe(409)
    expect(taken.json).toEqual({ error: 'conflict', message: 'Cette adresse e-mail appartient déjà à un autre compte Mocky relié à Kosmy Board.' })
    expect(account((u) => u.kosmySub === 'board-someone')).toBeUndefined()
    expect(account((u) => u.id === 'u-dave').kosmySub).toBe('board-dave')
  })

  it('refuses a value it cannot apply (422), and writes nothing', async () => {
    const before = fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8')
    for (const body of [
      { role: 'boss' },
      {},
      { role: 'user', values: { plan: 'gold' } },
      { role: 'user', values: 'free' },
      { role: 'user', values: { assistants: 'yes' } },
    ]) {
      const r = await put('board-grace', body)
      expect(r.status, JSON.stringify(body)).toBe(422)
      expect(r.json.error).toBe('invalid')
      expect(typeof r.json.message).toBe('string')
    }
    expect((await put('board-grace', { role: 'boss' }, { lang: 'en' })).json.message).toBe('Unknown role: "admin" or "user".')
    expect(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8')).toBe(before)
  })

  it('never lets an administrator cut their own access, nor leave Mocky without one', async () => {
    const demote = await put('board-admin', { name: 'Owner', role: 'user' })
    expect(demote.status).toBe(409)
    expect(demote.json.message).toBe('Vous ne pouvez pas vous retirer vos propres droits d’administration.')
    const self = await del('board-admin', { lang: 'en' })
    expect(self.status).toBe(409)
    expect(self.json).toEqual({ error: 'conflict', message: 'You cannot withdraw your own access.' })
    expect(account((u) => u.id === 'u-admin')).toMatchObject({ role: 'admin' })
    expect(account((u) => u.id === 'u-admin').disabled).toBeUndefined()

    // The other administrator may go — and then the owner is the last one:
    // the Board signing them in as a plain user is refused rather than applied.
    expect((await del('board-admin2')).status).toBe(200)
    const last = await boardSignIn({ sub: 'board-admin', name: 'Owner', email: 'owner@example.com', access: { role: 'user', values: {} } })
    expect(last.final).toBe(`${base}/?kosmy=error&reason=access`)
    expect(last.me).toBe(null)
    expect(account((u) => u.id === 'u-admin').role).toBe('admin')
    // A disabled administrator acts no more from the Board either.
    expect((await list({ patch: { sub: 'board-admin2' } })).json.error).toBe('forbidden')
    // Given back: an administrator again, able to act.
    expect((await put('board-admin2', { name: 'Second', role: 'admin' })).json.status).toBe('updated')
    expect((await list({ patch: { sub: 'board-admin2' } })).status).toBe(200)
  })

  it('disables an account everywhere — password, sessions, Board sign-in — and a PUT gives it back', async () => {
    const b = browser()
    expect((await b.call('POST', `${base}/api/login`, { username: 'member', password: PASSWORD })).status).toBe(200)
    expect((await b.call('GET', `${base}/api/me`)).json.user).toMatchObject({ username: 'member' })

    const r = await del('board-member')
    expect(r.json).toEqual({ ok: true, message: 'Compte « member » désactivé.' })
    expect(account((u) => u.id === 'u-member')).toMatchObject({ disabled: true, role: 'user' })
    // The open session is closed; its projects are not touched.
    expect((await b.call('GET', `${base}/api/me`)).json.user).toBe(null)
    expect((await b.call('GET', `${base}/api/data`)).status).toBe(401)
    // The password no longer opens it — said only to whoever knows it.
    const pw = await browser().call('POST', `${base}/api/login`, { username: 'member', password: PASSWORD }, { 'accept-language': 'en' })
    expect(pw.status).toBe(403)
    expect(pw.json.code).toBe('disabled')
    const wrong = await browser().call('POST', `${base}/api/login`, { username: 'member', password: 'not-the-password' })
    expect(wrong.status).toBe(401)
    // Nor the Board without its claim.
    const viaBoard = await boardSignIn({ sub: 'board-member', name: 'Member', email: null, access: null })
    expect(viaBoard.final).toBe(`${base}/?kosmy=error&reason=disabled`)
    expect(viaBoard.me).toBe(null)
    // The Board sees it as it is; a second DELETE is a no-op, an unknown sub too.
    expect((await list()).json.users.find((u) => u.sub === 'board-member').active).toBe(false)
    expect((await del('board-member')).json).toEqual({ ok: true })
    expect((await del('board-nobody')).json).toEqual({ ok: true })

    const back = await put('board-member', { name: 'Member', role: 'user', values: { plan: 'standard' } })
    expect(back.json.status).toBe('updated')
    expect(account((u) => u.id === 'u-member').disabled).toBeUndefined()
    expect((await browser().call('POST', `${base}/api/login`, { username: 'member', password: PASSWORD })).status).toBe(200)

    const audit = fs.readFileSync(path.join(dataDir, 'audit.jsonl'), 'utf8')
    expect(audit).toContain('"user.disable"')
  })

  it('applies kosmy_board_access at sign-in: creates the account, never links it by e-mail', async () => {
    const r = await boardSignIn({ sub: 'board-erin', name: 'Erin', email: 'erin@example.com', access: { role: 'user', values: { plan: 'free' } } })
    expect(r.final).toBe(`${base}/`)
    expect(r.me).toMatchObject({ role: 'user', plan: 'free', kosmyBoard: true, hasPassword: false })
    // The unlinked account with that address stays unlinked: a second account was made.
    expect(account((u) => u.id === 'u-erin').kosmySub).toBeUndefined()
    const made = account((u) => u.kosmySub === 'board-erin')
    expect(made.id).not.toBe('u-erin')
    expect(made.username).not.toBe('erin')

    // The next sign-in applies the values the Board holds now.
    const again = await boardSignIn({ sub: 'board-erin', name: 'Erin', email: 'erin@example.com', access: { role: 'user', values: { plan: 'standard' } } })
    expect(again.me).toMatchObject({ username: made.username, plan: 'standard' })
    expect(readUsers().filter((u) => u.kosmySub === 'board-erin')).toHaveLength(1)

    // A claim Mocky cannot apply refuses the sign-in instead of guessing.
    const bad = await boardSignIn({ sub: 'board-erin', name: 'Erin', email: 'erin@example.com', access: { role: 'root' } })
    expect(bad.final).toBe(`${base}/?kosmy=error&reason=access`)
    expect(bad.me).toBe(null)

    // Without the claim, nothing changes: an unknown sub is still refused.
    const plain = await boardSignIn({ sub: 'board-stranger', name: 'Stranger', email: 'x@example.com', access: null })
    expect(plain.final).toBe(`${base}/?kosmy=error&reason=not_linked`)
  })
})
