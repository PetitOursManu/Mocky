import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'

/**
 * The dashboard against a real server: real sessions, real cookies, a real
 * event stream. The pieces are unit-tested beside this file; what only a
 * running instance can show is that they are wired to the routes that feed them
 * — that a sign-in lands in the audit log, a heartbeat in the presence list, an
 * announcement in the public config — and that a session token never leaves.
 *
 * Throwaway MOCKY_DATA_DIR, like routes-auth.test.js.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
let proc, base, dataDir

async function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-dash-'))
  const port = await freePort()
  proc = spawn(process.execPath, [path.join(here, '..', 'index.js')], {
    env: { ...process.env, MOCKY_DATA_DIR: dataDir, MOCKY_PORT: String(port), NODE_ENV: 'test' },
    stdio: 'ignore',
  })
  base = `http://127.0.0.1:${port}`
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

afterAll(() => {
  proc?.kill()
  try {
    fs.rmSync(dataDir, { recursive: true, force: true })
  } catch {
    /* best effort */
  }
})

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0'

async function call(method, p, { cookie, body } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { 'content-type': 'application/json', 'user-agent': UA, ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, cookie: (res.headers.get('set-cookie') || '').split(';')[0], text }
}

/** Test credentials minted for this throwaway instance only. */
const ADMIN = { username: 'dash-admin', password: `pw-${Math.random().toString(36).slice(2)}` }
const USER = { username: 'dash-user', password: `pw-${Math.random().toString(36).slice(2)}` }

describe('admin dashboard, end to end', () => {
  let admin = ''
  let user = ''
  let userId = ''

  beforeAll(async () => {
    admin = (await call('POST', '/api/register', { body: ADMIN })).cookie
    const created = await call('POST', '/api/admin/users', { cookie: admin, body: { ...USER, role: 'user' } })
    userId = created.json.user.id
    user = (await call('POST', '/api/login', { body: USER })).cookie
    await call('POST', '/api/login', { body: { username: USER.username, password: 'wrong-password' } })
  })

  it('refuses a user who is not an admin', async () => {
    expect((await call('GET', '/api/admin/dashboard/overview', { cookie: user })).status).toBe(403)
  })

  it('shows who is here, from a heartbeat', async () => {
    expect(
      (await call('POST', '/api/presence', { cookie: user, body: { tab: 'tab-e2e-0001', area: 'project', visible: true } }))
        .status,
    ).toBe(204)
    const o = (await call('GET', '/api/admin/dashboard/overview', { cookie: admin })).json
    const row = o.people.find((p) => p.username === USER.username)
    expect(row).toMatchObject({ state: 'active', area: 'project', tabs: 1 })
    expect(o.counts.users).toBe(2)
    expect(o.metrics.length).toBeGreaterThan(0)
    expect(o.info.node).toBe(process.version)
  })

  it('audits sign-ins, failures and account creation', async () => {
    const { entries } = (await call('GET', '/api/admin/dashboard/audit', { cookie: admin })).json
    const actions = entries.map((e) => e.action)
    expect(actions).toEqual(expect.arrayContaining(['auth.register', 'user.create', 'auth.login', 'auth.login-failed']))
    // The failed attempt names the account tried, never the password tried.
    expect(JSON.stringify(entries)).not.toContain('wrong-password')
    expect(JSON.stringify(entries)).not.toContain(USER.password)
  })

  it('lists sessions by handle, never by token, and revokes one', async () => {
    const { sessions } = (await call('GET', '/api/admin/dashboard/sessions', { cookie: admin })).json
    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, 'sessions.json'), 'utf8'))
    for (const token of Object.keys(raw)) expect(JSON.stringify(sessions)).not.toContain(token)
    const mine = sessions.find((s) => s.current)
    expect(mine).toMatchObject({ username: ADMIN.username, device: 'Firefox 131 · Windows' })
    // Your own session is ended by signing out, not from here.
    expect((await call('DELETE', `/api/admin/dashboard/sessions/${mine.id}`, { cookie: admin })).status).toBe(400)

    const theirs = sessions.find((s) => s.username === USER.username)
    expect((await call('DELETE', `/api/admin/dashboard/sessions/${theirs.id}`, { cookie: admin })).status).toBe(200)
    expect((await call('GET', '/api/data', { cookie: user })).status).toBe(401)
  })

  it('signs an account out everywhere', async () => {
    const again = (await call('POST', '/api/login', { body: USER })).cookie
    const out = await call('POST', `/api/admin/dashboard/users/${userId}/signout`, { cookie: admin })
    expect(out.json).toMatchObject({ ok: true, revoked: 1 })
    expect((await call('GET', '/api/data', { cookie: again })).status).toBe(401)
  })

  it('publishes an announcement through the public config, and clears it', async () => {
    const put = await call('PUT', '/api/admin/dashboard/announcement', {
      cookie: admin,
      body: { message: 'Redémarrage à 22 h', tone: 'warn', expiresInHours: 2 },
    })
    expect(put.status).toBe(200)
    expect((await call('GET', '/api/config')).json.announcement).toMatchObject({ message: 'Redémarrage à 22 h', tone: 'warn' })
    await call('DELETE', '/api/admin/dashboard/announcement', { cookie: admin })
    expect((await call('GET', '/api/config')).json.announcement).toBeNull()
  })

  it('keeps a scheduled announcement from users until it starts', async () => {
    const startsAt = new Date(Date.now() + 2 * 3600_000).toISOString()
    const put = await call('PUT', '/api/admin/dashboard/announcement', {
      cookie: admin,
      body: { message: 'Mise à jour le {{datetime:2026-09-29T01:22:00Z}}', startsAt, expiresInHours: 1 },
    })
    expect(put.json.announcement).toMatchObject({ status: 'scheduled' })
    expect((await call('GET', '/api/config')).json.announcement).toBeNull()
    const o = (await call('GET', '/api/admin/dashboard/overview', { cookie: admin })).json
    expect(o.announcement).toMatchObject({ status: 'scheduled', message: 'Mise à jour le {{datetime:2026-09-29T01:22:00.000Z}}' })
    await call('DELETE', '/api/admin/dashboard/announcement', { cookie: admin })
  })

  it('streams ticks to an admin', async () => {
    const ctrl = new AbortController()
    const res = await fetch(`${base}/api/admin/dashboard/live`, { headers: { cookie: admin }, signal: ctrl.signal })
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/)
    const reader = res.body.getReader()
    let text = ''
    const deadline = Date.now() + 5000
    while (!text.includes('event: tick') && Date.now() < deadline) {
      const { value, done } = await reader.read()
      if (done) break
      text += new TextDecoder().decode(value)
    }
    ctrl.abort()
    expect(text).toContain('event: tick')
    const data = JSON.parse(/event: tick\ndata: (.*)\n/.exec(text)[1])
    expect(data.people.map((p) => p.username).sort()).toEqual([ADMIN.username, USER.username].sort())
  })
})
