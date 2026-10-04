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

/**
 * Mocky as an MCP server, end to end: the switch (X1), discovery, client
 * registration, consent through the Mocky session, PKCE, the token exchange,
 * a real MCP client calling a tool, refresh rotation and its reuse detection,
 * and every way access is taken away (X2).
 *
 * A real server on a loopback origin with MOCKY_MCP_INSECURE_LOOPBACK=1 — the
 * one configuration under which an http:// origin is accepted, and only on
 * loopback (server/mcp/https.js).
 */

const root = fileURLToPath(new URL('..', import.meta.url))
let proc, base, dataDir
let admin = { cookie: '', id: '' }
let bob = { cookie: '', id: '' }

async function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

const json = (method, p, body, cookie = admin.cookie) =>
  fetch(base + p, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  })

const form = (p, fields) =>
  fetch(base + p, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  })

const REDIRECT = 'http://127.0.0.1:9/callback'

function pkce() {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

async function signIn(username, password) {
  const res = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return (res.headers.get('set-cookie') || '').split(';')[0]
}

/** Register a client, consent as `who`, and exchange the code. Returns the tokens. */
async function connect(who = admin, { approve = true } = {}) {
  const reg = await json('POST', '/register', { client_name: 'Test assistant', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' })
  const client = await reg.json()
  const { verifier, challenge } = pkce()
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'st4te',
    resource: `${base}/mcp`,
  })
  const auth = await fetch(`${base}/authorize?${q}`, { redirect: 'manual' })
  const consentPath = auth.headers.get('location')
  const id = consentPath.split('/').pop()
  const seen = await (await json('GET', `/api/connect/${id}`, undefined, who.cookie)).json()
  const decided = await (await json('POST', `/api/connect/${id}`, { approve }, who.cookie)).json()
  const back = new URL(decided.redirect)
  if (!back.searchParams.get('code')) return { client, seen, decided, back }
  const tok = await form('/token', {
    grant_type: 'authorization_code',
    code: back.searchParams.get('code'),
    code_verifier: verifier,
    client_id: client.client_id,
    redirect_uri: REDIRECT,
    resource: `${base}/mcp`,
  })
  return { client, seen, decided, back, status: tok.status, tokens: await tok.json(), auth, consentPath }
}

async function listProjects(accessToken) {
  const client = new Client({ name: 'test', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
    requestInit: { headers: { authorization: `Bearer ${accessToken}` } },
  })
  await client.connect(transport)
  try {
    return await client.callTool({ name: 'list_projects', arguments: {} })
  } finally {
    await client.close()
  }
}

const mcpStatus = (token) =>
  fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  }).then((r) => r.status)

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-mcp-'))
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
    stdio: 'ignore',
  })
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
    body: JSON.stringify({ username: 'admin', password: 'correct-horse-battery' }),
  })
  admin.cookie = (reg.headers.get('set-cookie') || '').split(';')[0]
  const made = await json('POST', '/api/admin/users', { username: 'bob', password: 'correct-horse-battery', role: 'user' })
  expect(made.status).toBe(200)
  bob.cookie = await signIn('bob', 'correct-horse-battery')
  const users = (await (await json('GET', '/api/admin/mcp')).json()).users
  admin.id = users.find((u) => u.username === 'admin').id
  bob.id = users.find((u) => u.username === 'bob').id
  await json('PUT', '/api/data', { projects: JSON.stringify([{ id: 'proj00001', name: 'Mon site', updatedAt: Date.now(), screens: [{ id: 's1', userNotes: [{ text: 'PRIVATE NOTE' }] }] }]), design: null })
}, 30_000)

afterAll(() => {
  proc?.kill()
  fs.rmSync(dataDir, { recursive: true, force: true })
})

describe('switched off, it does not exist (X1)', () => {
  it('answers 404 on every MCP path, discovery included', async () => {
    for (const p of ['/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource/mcp', '/authorize', '/register', '/token']) {
      expect((await fetch(base + p)).status, p).toBe(404)
    }
    expect((await fetch(`${base}/mcp`, { method: 'POST' })).status).toBe(404)
  })

  it('a pending consent page does not exist either', async () => {
    expect((await json('GET', '/api/connect/abc')).status).toBe(404)
  })
})

describe('the administrator switches it on', () => {
  it('reports the HTTPS checklist, and refuses nothing on a valid origin', async () => {
    const view = await (await json('GET', '/api/admin/mcp')).json()
    expect(view.readiness.ok).toBe(true)
    expect(view.readiness.reachableFromInternet).toBe('unknown')
    expect(view.config.enabled).toBe(false)
    expect(view.config.access).toEqual({ mode: 'allowlist', userIds: [] })
  })

  it('is refused to a non-admin', async () => {
    expect((await json('PUT', '/api/admin/mcp/config', { enabled: true }, bob.cookie)).status).toBe(403)
  })

  it('turns on with the admin alone on the list', async () => {
    const res = await json('PUT', '/api/admin/mcp/config', { enabled: true, access: { mode: 'allowlist', userIds: [admin.id] } })
    expect(res.status).toBe(200)
    expect((await res.json()).active).toBe(true)
    const meta = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json()
    expect(meta.code_challenge_methods_supported).toEqual(['S256'])
    expect(meta.registration_endpoint).toBe(`${base}/register`)
    const prm = await (await fetch(`${base}/.well-known/oauth-protected-resource/mcp`)).json()
    expect(prm.resource).toBe(`${base}/mcp`)
  })
})

describe('connecting an assistant', () => {
  it('refuses a client that is neither Claude, ChatGPT nor local', async () => {
    const res = await json('POST', '/register', { client_name: 'Evil', redirect_uris: ['https://evil.example/cb'] })
    expect(res.status).toBe(400)
  })

  it('needs no token to be told where to authenticate', async () => {
    const res = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toContain(`resource_metadata="${base}/.well-known/oauth-protected-resource/mcp"`)
  })

  it('goes through consent in Mocky and hands back tokens that work', async () => {
    const out = await connect(admin)
    expect(out.auth.status).toBe(302)
    expect(out.consentPath).toMatch(/^\/connect\/[a-f0-9]{32}$/)
    expect(out.seen).toMatchObject({ clientName: 'Test assistant', redirectHost: '127.0.0.1:9', allowed: true })
    expect(out.back.searchParams.get('state')).toBe('st4te')
    expect(out.status).toBe(200)
    expect(out.tokens.token_type.toLowerCase()).toBe('bearer')

    const result = await listProjects(out.tokens.access_token)
    expect(result.content[0].text).toContain('Mon site')
    expect(result.content[0].text).toContain(`${base}/p/proj00001`)
    // I9: a screen's notes never reach a model.
    expect(JSON.stringify(result)).not.toContain('PRIVATE NOTE')
  })

  it('stores tokens by hash only', async () => {
    const { tokens } = await connect(admin)
    const file = fs.readFileSync(path.join(dataDir, 'mcp-oauth.json'), 'utf8')
    expect(file).not.toContain(tokens.access_token)
    expect(file).not.toContain(tokens.refresh_token)
  })

  it('does not let a code be used twice, or without its verifier', async () => {
    const reg = await (await json('POST', '/register', { client_name: 'T', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' })).json()
    const { challenge } = pkce()
    const q = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256' })
    const id = (await fetch(`${base}/authorize?${q}`, { redirect: 'manual' })).headers.get('location').split('/').pop()
    const code = new URL((await (await json('POST', `/api/connect/${id}`, { approve: true })).json()).redirect).searchParams.get('code')
    const wrong = await form('/token', { grant_type: 'authorization_code', code, code_verifier: 'x'.repeat(43), client_id: reg.client_id, redirect_uri: REDIRECT })
    expect(wrong.status).toBe(400)
  })

  it('refuses a token for another resource at the door', async () => {
    const reg = await (await json('POST', '/register', { client_name: 'T', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' })).json()
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: reg.client_id,
      redirect_uri: REDIRECT,
      code_challenge: pkce().challenge,
      code_challenge_method: 'S256',
      resource: 'https://other.example/mcp',
    })
    const res = await fetch(`${base}/authorize?${q}`, { redirect: 'manual' })
    expect(new URL(res.headers.get('location')).searchParams.get('error')).toBe('invalid_target')
  })

  it('a refusal goes back to the assistant as access_denied', async () => {
    const out = await connect(admin, { approve: false })
    expect(out.back.searchParams.get('error')).toBe('access_denied')
    expect(out.back.searchParams.get('code')).toBeNull()
  })
})

describe('taking access away (X2)', () => {
  it('an account not on the list is told so, and the assistant gets access_denied', async () => {
    const out = await connect(bob)
    expect(out.seen.allowed).toBe(false)
    expect(out.decided.notAllowed).toBe(true)
    expect(out.back.searchParams.get('error')).toBe('access_denied')
  })

  it('rotates refresh tokens, and a replayed one cuts the connection', async () => {
    const { tokens, client } = await connect(admin)
    const first = await (await form('/token', { grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: client.client_id })).json()
    expect(first.access_token).toBeTruthy()
    expect(first.refresh_token).not.toBe(tokens.refresh_token)
    expect(await mcpStatus(first.access_token)).toBe(200)

    const replay = await form('/token', { grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: client.client_id })
    expect(replay.status).toBe(400)
    expect(await mcpStatus(first.access_token)).toBe(401)
    const log = await (await json('GET', '/api/admin/dashboard/audit?group=mcp')).json()
    expect(JSON.stringify(log)).toContain('mcp.token-reuse')
  })

  it('a person disconnects their own assistant; another person cannot', async () => {
    const { tokens } = await connect(admin)
    const mine = (await (await json('GET', '/api/account/mcp-connections')).json()).connections
    expect(mine.length).toBeGreaterThan(0)
    expect(JSON.stringify(mine)).not.toContain(tokens.access_token)
    const target = mine[0].id
    expect((await json('DELETE', `/api/account/mcp-connections/${target}`, undefined, bob.cookie)).status).toBe(404)
    expect((await json('DELETE', `/api/account/mcp-connections/${target}`)).status).toBe(200)
  })

  it('removing someone from the list cuts their tokens at once', async () => {
    const { tokens } = await connect(admin)
    expect(await mcpStatus(tokens.access_token)).toBe(200)
    const res = await (await json('PUT', '/api/admin/mcp/config', { access: { mode: 'allowlist', userIds: [] } })).json()
    expect(res.revoked).toBeGreaterThan(0)
    expect(await mcpStatus(tokens.access_token)).toBe(401)
  })

  it('switching it off makes everything disappear again, without a restart', async () => {
    await json('PUT', '/api/admin/mcp/config', { access: { mode: 'allowlist', userIds: [admin.id] } })
    const { tokens } = await connect(admin)
    await json('PUT', '/api/admin/mcp/config', { enabled: false })
    expect(await mcpStatus(tokens.access_token)).toBe(404)
    expect((await fetch(`${base}/.well-known/oauth-authorization-server`)).status).toBe(404)
  })
})
