import { describe, it, expect, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'

/**
 * A whole migration between two real Mocky processes, over real HTTP.
 *
 * The unit tests in server/migration/ prove each half; this proves the thing
 * the admin will actually do, in the order they will do it — including the two
 * steps that live only in server/index.js: maintenance refusing a user's write
 * on the old server, and the new server restarting onto the imported accounts.
 * Neither has a unit to test in isolation.
 */

const serverEntry = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'index.js')
const procs = []
const dirs = []

async function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

async function boot(dataDir, port) {
  const proc = spawn(process.execPath, [serverEntry], {
    env: { ...process.env, MOCKY_DATA_DIR: dataDir, MOCKY_PORT: String(port), NODE_ENV: 'test' },
    stdio: 'ignore',
  })
  procs.push(proc)
  const base = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 15_000
  for (;;) {
    try {
      await fetch(`${base}/api/config`)
      return { proc, base }
    } catch {
      if (Date.now() > deadline) throw new Error('server did not start in time')
      await new Promise((r) => setTimeout(r, 100))
    }
  }
}

function client(base) {
  let cookie = ''
  return async (method, p, body) => {
    const res = await fetch(base + p, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0]
    return { status: res.status, body: await res.json().catch(() => ({})) }
  }
}

afterAll(() => {
  for (const p of procs) p.kill()
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true })
})

describe('migration between two servers', () => {
  it('moves accounts and projects, not sessions, and lands in maintenance', async () => {
    const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-src-'))
    const dstDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-dst-'))
    dirs.push(srcDir, dstDir)
    const src = await boot(srcDir, await freePort())
    const dstPort = await freePort()
    let dst = await boot(dstDir, dstPort)

    // --- the old server, in use
    const oldAdmin = client(src.base)
    expect((await oldAdmin('POST', '/api/register', { username: 'owner', password: 'old-password-1' })).status).toBe(200)
    expect((await oldAdmin('PUT', '/api/data', { projects: '[{"id":"p1","name":"Site"}]', design: '# D' })).status).toBe(200)
    expect(
      (await oldAdmin('POST', '/api/admin/users', { username: 'ada', password: 'ada-password-1', role: 'user' })).status,
    ).toBe(200)
    const ada = client(src.base)
    expect((await ada('POST', '/api/login', { username: 'ada', password: 'ada-password-1' })).status).toBe(200)

    // A code costs the admin's password, not just their session.
    expect((await oldAdmin('POST', '/api/admin/migration/source', { password: 'wrong' })).status).toBe(401)
    const minted = await oldAdmin('POST', '/api/admin/migration/source', { password: 'old-password-1' })
    expect(minted.status).toBe(200)
    const code = minted.body.code

    // --- the new server, empty but for the admin doing the import
    const newAdmin = client(dst.base)
    expect((await newAdmin('POST', '/api/register', { username: 'setup', password: 'new-password-1' })).status).toBe(200)
    const connected = await newAdmin('POST', '/api/admin/migration/import/connect', { url: src.base, code })
    expect(connected.status).toBe(200)
    expect(connected.body.preflight.blocking).toBe(false)
    expect(connected.body.summary.users).toBe(2)

    const runPass = async () => {
      expect((await newAdmin('POST', '/api/admin/migration/import/pass')).status).toBe(200)
      for (let i = 0; i < 200; i++) {
        const s = await newAdmin('GET', '/api/admin/migration/import')
        if (s.body.pass && !s.body.pass.running) return s.body
        await new Promise((r) => setTimeout(r, 50))
      }
      throw new Error('pass did not finish')
    }
    let s = await runPass()
    expect(s.pass.error).toBeNull()
    expect(s.ready).toBe(false)

    // --- maintenance on the old server: a user can read, not write
    expect((await oldAdmin('PUT', '/api/admin/maintenance', { on: true, message: 'Déménagement' })).status).toBe(200)
    const refused = await ada('PUT', '/api/data', { projects: '[]', design: null })
    expect(refused.status).toBe(503)
    expect(refused.body.code).toBe('maintenance')
    expect((await ada('GET', '/api/data')).status).toBe(200)
    expect((await fetch(`${src.base}/api/config`).then((r) => r.json())).maintenance.on).toBe(true)

    s = await runPass()
    expect(s.ready).toBe(true)

    // --- the swap, confirmed by the password of the admin doing it
    expect((await newAdmin('POST', '/api/admin/migration/import/finalize', { password: 'nope' })).status).toBe(401)
    const exited = new Promise((r) => dst.proc.once('exit', r))
    const fin = await newAdmin('POST', '/api/admin/migration/import/finalize', { password: 'new-password-1' })
    expect(fin.status).toBe(200)
    expect(fin.body.restarting).toBe(true)
    await exited
    dst = await boot(dstDir, dstPort)

    // --- the new server, after the restart
    const cfg = await fetch(`${dst.base}/api/config`).then((r) => r.json())
    expect(cfg.maintenance.on).toBe(true)
    const again = client(dst.base)
    expect((await again('POST', '/api/login', { username: 'setup', password: 'new-password-1' })).status).toBe(401)
    expect((await again('POST', '/api/login', { username: 'owner', password: 'old-password-1' })).status).toBe(200)
    const data = await again('GET', '/api/data')
    expect(data.body.projects).toContain('"p1"')
    expect(data.body.design).toBe('# D')
    // No session crossed: the new store starts empty but for the login above.
    const sessions = JSON.parse(fs.readFileSync(path.join(dstDir, 'sessions.json'), 'utf8'))
    expect(Object.keys(sessions)).toHaveLength(1)
  }, 60_000)
})
