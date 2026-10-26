import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { stopProcess, removeDir } from './support/stop.js'
import { READ_TOOLS } from '../server/mcp/levels.js'
import { KEY_RE } from '../server/mcp/keys.js'

/**
 * Assistant keys, end to end (X8, X9): a real server on a loopback origin, a
 * dedicated account "helper" that makes its own keys, a real MCP client using
 * them — and, through all of it, the OAuth path of tests/mcp-oauth-e2e.test.js
 * left exactly as it was.
 *
 * The server's stdout and stderr are kept, and the last test reads them, every
 * file of the data directory, the audit log and every listing for any key this
 * file was ever handed. A key is shown once and lives nowhere else.
 */

const root = fileURLToPath(new URL('..', import.meta.url))
const PW = 'correct-horse-battery'
const HELPER_PW = 'a-long-random-password-for-helper'
const REDIRECT = 'http://127.0.0.1:9/callback'

let proc, base, dataDir
let output = ''
const issued = [] // every key this file received
const refusals = [] // bodies of 401/429 answers, kept for the last test
const admin = { cookie: '', id: '' }
const helper = { cookie: '', id: '' }
const bob = { cookie: '', id: '' }

async function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

const json = (method, p, body, cookie = admin.cookie, headers = {}) =>
  fetch(base + p, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  })

async function signIn(username, password) {
  const res = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return (res.headers.get('set-cookie') || '').split(';')[0]
}

async function createKey(who, body) {
  const res = await json('POST', '/api/account/mcp-keys', body, who.cookie)
  const out = await res.json()
  if (out.token) issued.push(out.token)
  return { status: res.status, body: out, cacheControl: res.headers.get('cache-control') }
}

/** A raw tools/list on /mcp with this bearer value: status, headers, body. */
async function rawMcp(token, extra = {}) {
  const res = await fetch(`${base}/mcp${extra.query || ''}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  })
  const text = await res.text()
  if (res.status === 401 || res.status === 429) refusals.push(text, res.headers.get('www-authenticate') || '')
  return { status: res.status, text, www: res.headers.get('www-authenticate'), retryAfter: res.headers.get('retry-after') }
}

async function withClient(token, fn) {
  const client = new Client({ name: 'test', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
    requestInit: { headers: { authorization: `Bearer ${token}` } },
  })
  await client.connect(transport)
  try {
    return await fn(client)
  } finally {
    await client.close()
  }
}

function pkce() {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

/** An OAuth connection, exactly as tests/mcp-oauth-e2e.test.js makes one. */
async function oauthConnect(who) {
  const reg = await (await json('POST', '/register', { client_name: 'Test assistant', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' })).json()
  const { verifier, challenge } = pkce()
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: reg.client_id,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: `${base}/mcp`,
  })
  const id = (await fetch(`${base}/authorize?${q}`, { redirect: 'manual' })).headers.get('location').split('/').pop()
  const decided = await (await json('POST', `/api/connect/${id}`, { approve: true }, who.cookie)).json()
  const code = new URL(decided.redirect).searchParams.get('code')
  const tok = await fetch(`${base}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: reg.client_id, redirect_uri: REDIRECT, resource: `${base}/mcp` }).toString(),
  })
  return (await tok.json()).access_token
}

const setConfig = (patch) => json('PUT', '/api/admin/mcp/config', patch)

function filesUnder(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...filesUnder(p))
    else out.push(p)
  }
  return out
}

/** Every key issued, whole and as its secret half, absent from `text`. */
function expectNoKeyIn(text, where) {
  for (const k of issued) {
    expect(text.includes(k), `${where} holds a key`).toBe(false)
    expect(text.includes(k.slice(22)), `${where} holds a key's secret`).toBe(false)
  }
}

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-mcpkeys-'))
  const port = await freePort()
  base = `http://127.0.0.1:${port}`
  proc = spawn(process.execPath, [path.join(root, 'server/index.js')], {
    env: {
      ...process.env,
      MOCKY_DATA_DIR: dataDir,
      MOCKY_PORT: String(port),
      MOCKY_ORIGIN: base,
      MOCKY_MCP_INSECURE_LOOPBACK: '1',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  proc.stdout.on('data', (b) => (output += b.toString()))
  proc.stderr.on('data', (b) => (output += b.toString()))
  const deadline = Date.now() + 15_000
  for (;;) {
    try {
      await fetch(`${base}/api/config`)
      break
    } catch {
      if (Date.now() > deadline) throw new Error('server did not start')
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  const reg = await fetch(`${base}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PW }),
  })
  admin.cookie = (reg.headers.get('set-cookie') || '').split(';')[0]
  expect((await json('POST', '/api/admin/users', { username: 'helper', password: HELPER_PW, role: 'user' })).status).toBe(200)
  expect((await json('POST', '/api/admin/users', { username: 'bob', password: PW, role: 'user' })).status).toBe(200)
  helper.cookie = await signIn('helper', HELPER_PW)
  bob.cookie = await signIn('bob', PW)
  const users = (await (await json('GET', '/api/admin/mcp')).json()).users
  admin.id = users.find((u) => u.username === 'admin').id
  helper.id = users.find((u) => u.username === 'helper').id
  bob.id = users.find((u) => u.username === 'bob').id
  await json(
    'PUT',
    '/api/data',
    { projects: JSON.stringify([{ id: 'proj00042', name: 'Site du compte', updatedAt: Date.now(), screens: [{ id: 's1', userNotes: [{ text: 'PRIVATE NOTE' }] }] }]), design: null },
    helper.cookie,
  )
}, 30_000)

afterAll(async () => {
  await stopProcess(proc)
  // After the shutdown flush too: the store wrote its last "last used".
  if (dataDir && fs.existsSync(dataDir)) {
    for (const f of filesUnder(dataDir)) expectNoKeyIn(fs.readFileSync(f, 'latin1'), f)
  }
  removeDir(dataDir)
})

describe('switched off, a key does not open anything (X1)', () => {
  it('/mcp is 404 with a key, and no key can be made', async () => {
    expect((await rawMcp(`mocky_ak_${'0'.repeat(12)}_${'A'.repeat(43)}`)).status).toBe(404)
    expect((await createKey(helper, { name: 'Helper', level: 'read', password: HELPER_PW })).status).toBe(404)
  })
})

let readKey, writeKey

describe('making a key', () => {
  it('needs MCP on, the account on the list AND the administrator’s keys switch', async () => {
    expect((await setConfig({ enabled: true, access: { mode: 'allowlist', userIds: [admin.id, helper.id] } })).status).toBe(200)
    const view = await (await json('GET', '/api/account/mcp-connections', undefined, helper.cookie)).json()
    expect(view.keysEnabled).toBe(false)
    expect(view.keyNeedsPassword).toBe(true)
    const off = await createKey(helper, { name: 'Helper', level: 'read', password: HELPER_PW })
    expect(off.status).toBe(409)
    expect(off.body.code).toBe('keys-off')

    const on = await (await setConfig({ keys: true })).json()
    expect(on.config.keys).toBe(true)
    // Not on the list: the door does not exist for this account.
    expect((await createKey(bob, { name: 'Bob', level: 'read', password: PW })).status).toBe(404)
  })

  it('asks the password again, and refuses a missing level instead of choosing one', async () => {
    const wrong = await createKey(helper, { name: 'Helper', level: 'read', password: 'nope' })
    expect(wrong.status).toBe(401)
    expect(wrong.body.code).toBe('password')
    const noLevel = await createKey(helper, { name: 'Helper', password: HELPER_PW })
    expect(noLevel.status).toBe(400)
    expect(noLevel.body.code).toBe('level')
    expect((await createKey(helper, { name: 'Helper', level: 'read', expiresInDays: 3, password: HELPER_PW })).body.code).toBe('expiry')
  })

  it('shows the key once, uncached, and lists it without its value', async () => {
    const r = await createKey(helper, { name: 'Helper lecture', level: 'read', expiresInDays: 90, password: HELPER_PW })
    expect(r.status).toBe(201)
    expect(r.cacheControl).toBe('no-store')
    expect(r.body.token).toMatch(KEY_RE)
    expect(r.body.key).toMatchObject({ name: 'Helper lecture', level: 'read', lastUsedAt: null, expired: false })
    readKey = r.body.token
    const w = await createKey(helper, { name: 'Helper écriture', level: 'write', password: HELPER_PW })
    expect(w.status).toBe(201)
    writeKey = w.body.token

    const view = await (await json('GET', '/api/account/mcp-connections', undefined, helper.cookie)).json()
    expect(view.keys.map((k) => k.name).sort()).toEqual(['Helper lecture', 'Helper écriture'])
    for (const k of view.keys) expect(Object.keys(k).sort()).toEqual(['createdAt', 'expired', 'expiresAt', 'id', 'lastUsedAt', 'level', 'name', 'userId'])
    const file = fs.readFileSync(path.join(dataDir, 'mcp-keys.json'), 'utf8')
    expect(file).not.toContain(readKey)
    expect(file).not.toContain(writeKey)
  })

  it('caps the keys of one account', async () => {
    const extra = []
    for (let i = 0; i < 3; i++) extra.push((await createKey(helper, { name: `spare ${i}`, level: 'read', password: HELPER_PW })).body.key.id)
    const sixth = await createKey(helper, { name: 'one too many', level: 'read', password: HELPER_PW })
    expect(sixth.status).toBe(409)
    expect(sixth.body.code).toBe('limit')
    for (const id of extra) expect((await json('DELETE', `/api/account/mcp-keys/${id}`, undefined, helper.cookie)).status).toBe(200)
  })
})

describe('a read key (X9)', () => {
  it('lists exactly the read tools, reads, and cannot call a tool that writes', async () => {
    await withClient(readKey, async (client) => {
      expect((await client.listTools()).tools.map((t) => t.name).sort()).toEqual([...READ_TOOLS].sort())
      expect(client.getServerCapabilities()?.prompts).toBeUndefined()
      const list = await client.callTool({ name: 'list_projects', arguments: {} })
      expect(list.content[0].text).toContain('Site du compte')
      // X4 holds for a key as for a token: a screen's notes never reach a model.
      expect(JSON.stringify(list)).not.toContain('PRIVATE NOTE')
      for (const name of ['create_design', 'add_screen', 'edit_design', 'add_image']) {
        const out = await client.callTool({ name, arguments: { brief: 'Une page d’accueil pour la boulangerie du quartier à Lyon' } })
        expect(out.isError, name).toBe(true)
        expect(out.content[0].text, name).toMatch(/not found/)
      }
    })
    const runner = (await (await json('GET', '/api/admin/mcp')).json()).runner
    expect(runner.running + runner.queued).toBe(0)
  })
})

describe('a write key', () => {
  it('reaches the tools that write, as its own account', async () => {
    await withClient(writeKey, async (client) => {
      const names = (await client.listTools()).tools.map((t) => t.name)
      expect(names).toEqual(expect.arrayContaining(['create_design', 'edit_design', 'add_image']))
      const out = await client.callTool({ name: 'create_design', arguments: { brief: 'un site' } })
      expect(out.structuredContent?.status).toBe('needs_clarification')
      expect(client.getInstructions()).toContain('You are connected as the Mocky account "helper"')
    })
    const view = await (await json('GET', '/api/account/mcp-connections', undefined, helper.cookie)).json()
    expect(view.keys.find((k) => k.level === 'write').lastUsedAt).toBeGreaterThan(0)
  })
})

describe('OAuth, untouched', () => {
  it('a connection still reaches every tool and the prompts', async () => {
    const access = await oauthConnect(admin)
    expect(access).not.toMatch(/^mocky_ak_/)
    await withClient(access, async (client) => {
      const names = (await client.listTools()).tools.map((t) => t.name)
      expect(names).toEqual(expect.arrayContaining(['create_design', 'fix_accessibility', 'list_projects']))
      expect((await client.listPrompts()).prompts.length).toBeGreaterThan(0)
    })
  })

  it('an unknown key is refused exactly like an unknown OAuth token', async () => {
    const asOAuth = await rawMcp(crypto.randomBytes(32).toString('base64url'))
    const asKey = await rawMcp(`mocky_ak_${crypto.randomBytes(6).toString('hex')}_${crypto.randomBytes(32).toString('base64url')}`)
    expect(asOAuth.status).toBe(401)
    expect(asKey).toEqual(asOAuth)
  })
})

describe('a key is not a session (X8)', () => {
  it('opens nothing outside /mcp, and is read from the header only', async () => {
    const bearer = { authorization: `Bearer ${readKey}` }
    expect((await json('GET', '/api/data', undefined, '', bearer)).status).toBe(401)
    expect((await json('GET', '/api/account/mcp-connections', undefined, '', bearer)).status).toBe(401)
    expect((await json('POST', '/api/account/mcp-keys', { name: 'x', level: 'write' }, '', bearer)).status).toBe(401)
    expect((await rawMcp(null, { query: `?key=${encodeURIComponent(readKey)}` })).status).toBe(401)
  })
})

describe('suspending and revoking', () => {
  it('the keys switch suspends a key; switched back on, the same key works', async () => {
    await setConfig({ keys: false })
    expect((await rawMcp(readKey)).status).toBe(401)
    await setConfig({ keys: true })
    expect((await rawMcp(readKey)).status).toBe(200)
  })

  it('MCP switched off is 404 for a key too; back on, it works', async () => {
    await setConfig({ enabled: false })
    expect((await rawMcp(readKey)).status).toBe(404)
    await setConfig({ enabled: true })
    expect((await rawMcp(readKey)).status).toBe(200)
  })

  it('the person revokes their own key; nobody else can', async () => {
    const r = await createKey(helper, { name: 'to revoke', level: 'read', password: HELPER_PW })
    expect((await rawMcp(r.body.token)).status).toBe(200)
    expect((await json('DELETE', `/api/account/mcp-keys/${r.body.key.id}`, undefined, bob.cookie)).status).toBe(404)
    expect((await json('DELETE', `/api/account/mcp-keys/${r.body.key.id}`, undefined, helper.cookie)).status).toBe(200)
    expect((await rawMcp(r.body.token)).status).toBe(401)
  })

  it('the administrator sees every key without its value, and revokes one', async () => {
    const r = await createKey(helper, { name: 'admin cuts', level: 'write', password: HELPER_PW })
    const view = await (await json('GET', '/api/admin/mcp')).json()
    const seen = view.keys.find((k) => k.id === r.body.key.id)
    expect(seen).toMatchObject({ username: 'helper', name: 'admin cuts', level: 'write' })
    expect(JSON.stringify(view)).not.toContain(r.body.token)
    expect((await json('DELETE', `/api/admin/mcp/keys/${seen.id}`)).status).toBe(200)
    expect((await rawMcp(r.body.token)).status).toBe(401)
    // A non-admin cannot use the admin route.
    expect((await json('DELETE', `/api/admin/mcp/keys/${seen.id}`, undefined, helper.cookie)).status).toBe(403)
    const log = JSON.stringify(await (await json('GET', '/api/admin/dashboard/audit?group=mcp')).json())
    expect(log).toContain('mcp.key-create')
    expect(log).toContain('mcp.key-revoke')
  })

  it('taking the account off the list deletes its keys at once', async () => {
    const r = await createKey(helper, { name: 'list', level: 'read', password: HELPER_PW })
    const out = await (await setConfig({ access: { mode: 'allowlist', userIds: [admin.id] } })).json()
    expect(out.keysRevoked).toBeGreaterThanOrEqual(3)
    expect(out.revoked).toBeGreaterThanOrEqual(out.keysRevoked)
    expect((await rawMcp(r.body.token)).status).toBe(401)
    expect((await rawMcp(readKey)).status).toBe(401)
    await setConfig({ access: { mode: 'allowlist', userIds: [admin.id, helper.id] } })
    // Back on the list, the old keys do not come back.
    expect((await rawMcp(readKey)).status).toBe(401)
    const fresh = await createKey(helper, { name: 'Helper lecture', level: 'read', password: HELPER_PW })
    readKey = fresh.body.token
    expect((await rawMcp(readKey)).status).toBe(200)
  })

  it('deleting the account deletes its keys', async () => {
    expect((await json('POST', '/api/admin/users', { username: 'temp', password: PW, role: 'user' })).status).toBe(200)
    const temp = { cookie: await signIn('temp', PW) }
    const id = (await (await json('GET', '/api/admin/mcp')).json()).users.find((u) => u.username === 'temp').id
    await setConfig({ access: { mode: 'allowlist', userIds: [admin.id, helper.id, id] } })
    const r = await createKey(temp, { name: 'temp', level: 'read', password: PW })
    expect((await rawMcp(r.body.token)).status).toBe(200)
    expect((await json('DELETE', `/api/admin/users/${id}`)).status).toBe(200)
    // The list BEFORE any call on /mcp: a call with the key would revoke it on
    // its own (key-auth.js finds no account), and hide a missing onUserDeleted.
    expect((await (await json('GET', '/api/admin/mcp')).json()).keys.some((k) => k.userId === id)).toBe(false)
    expect(Object.keys(JSON.parse(fs.readFileSync(path.join(dataDir, 'mcp-keys.json'), 'utf8')).keys)).not.toContain(r.body.key.id)
    expect((await rawMcp(r.body.token)).status).toBe(401)
  })

  it('an id every object inherits is no key: 404, and nothing revoked or audited', async () => {
    const audited = async () => (JSON.stringify(await (await json('GET', '/api/admin/dashboard/audit?group=mcp&limit=500')).json()).match(/mcp\.key-revoke/g) || []).length
    const before = await audited()
    const keysBefore = (await (await json('GET', '/api/admin/mcp')).json()).keys.length
    for (const id of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect((await json('DELETE', `/api/admin/mcp/keys/${id}`)).status, id).toBe(404)
      expect((await json('DELETE', `/api/account/mcp-keys/${id}`, undefined, helper.cookie)).status, id).toBe(404)
    }
    expect(await audited()).toBe(before)
    expect((await (await json('GET', '/api/admin/mcp')).json()).keys.length).toBe(keysBefore)
    expect((await rawMcp(readKey)).status).toBe(200)
  })
})

describe('guessing (last: it freezes this address for the key path)', () => {
  it('wrong keys freeze the address — the right key too — and OAuth is not affected', async () => {
    let status = 401
    let tries = 0
    while (status === 401 && tries < 12) {
      status = (await rawMcp(`mocky_ak_${crypto.randomBytes(6).toString('hex')}_${crypto.randomBytes(32).toString('base64url')}`)).status
      tries++
    }
    expect(status).toBe(429)
    expect(tries).toBeLessThanOrEqual(11)
    const frozen = await rawMcp(readKey)
    expect(frozen.status).toBe(429)
    expect(Number(frozen.retryAfter)).toBeGreaterThan(0)
    // The OAuth path counts nothing here and freezes nothing.
    const access = await oauthConnect(admin)
    expect((await rawMcp(access)).status).toBe(200)
    // And the failures are lines fail2ban already matches, naming no key.
    expect(output).toMatch(/mocky auth failure user="assistant-key" ip=\S+/)
    expect(output).toMatch(/mocky auth locked user="assistant-key" ip=\S+/)
  })
})

describe('the key lives nowhere else (X8)', () => {
  it('not in the server’s output, the data directory, the audit log, any listing or any refusal', async () => {
    expect(issued.length).toBeGreaterThanOrEqual(8)
    expectNoKeyIn(output, 'stdout/stderr')
    for (const f of filesUnder(dataDir)) expectNoKeyIn(fs.readFileSync(f, 'latin1'), f)
    expectNoKeyIn(JSON.stringify(await (await json('GET', '/api/admin/dashboard/audit?limit=500')).json()), 'audit')
    expectNoKeyIn(JSON.stringify(await (await json('GET', '/api/admin/mcp')).json()), 'admin view')
    expectNoKeyIn(JSON.stringify(await (await json('GET', '/api/account/mcp-connections', undefined, helper.cookie)).json()), 'account view')
    expectNoKeyIn(refusals.join('\n'), 'refusals')
  })
})
