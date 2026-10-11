import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { stopProcess, removeDir } from '../tests/support/stop.js'

/**
 * Versions and review links, through real HTTP.
 *
 * The store tests prove the rules; this proves the ROUTES apply them — that
 * the public page receives the whitelist and not the version, that a version
 * id from another account mints nothing, and that a client's page cannot be
 * broken by deleting the version under it.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
let proc, base, dataDir
let owner = ''
let other = ''

async function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

const json = (method, p, body, cookie) =>
  fetch(base + p, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

async function account(username) {
  const res = await json('POST', '/api/register', { username, password: 'correct-horse-battery' })
  return (res.headers.get('set-cookie') || '').split(';')[0]
}

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-review-'))
  // Sign-ups close after the first account; reopen them for the second.
  const port = await freePort()
  proc = spawn(process.execPath, [path.join(here, 'index.js')], {
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
  owner = await account('owner')
  await json('PUT', '/api/admin/config', { allowRegistration: true }, owner)
  other = await account('other')
}, 30_000)

afterAll(async () => {
  await stopProcess(proc)
  try {
    removeDir(dataDir)
  } catch {
    /* best effort */
  }
})

const SCREEN = {
  id: 's1',
  name: 'Accueil',
  prompt: 'the confidential brief',
  code: 'function App(){return <div>Bonjour</div>}',
  componentName: 'App',
  createdAt: 1,
  x: 0,
  y: 0,
  w: 1024,
  h: 720,
  device: 'none',
  links: [],
  caps: [],
  userNotes: [{ id: 'n1', text: 'Paul hates this', createdAt: 1 }],
}

async function versionOf(cookie, projectId = 'p1') {
  const res = await json(
    'POST',
    '/api/versions',
    { projectId, scope: 'project', kind: 'review', project: { name: 'Softly' }, screens: [SCREEN] },
    cookie,
  )
  expect(res.status).toBe(200)
  return (await res.json()).version.id
}

describe('the routes need a session where they should', () => {
  for (const [method, p] of [
    ['GET', '/api/versions?projectId=p1'],
    ['POST', '/api/versions'],
    ['GET', '/api/reviews?projectId=p1'],
    ['GET', '/api/reviews/status'],
    ['POST', '/api/reviews'],
  ]) {
    it(`${method} ${p}`, async () => {
      expect((await json(method, p, method === 'GET' ? undefined : {})).status).toBe(401)
    })
  }
})

describe('a review link', () => {
  let token = ''
  let versionId = ''

  it('is minted on the caller\'s own version only', async () => {
    versionId = await versionOf(owner)
    const stolen = await json('POST', '/api/reviews', { projectId: 'p1', versionId }, other)
    expect(stolen.status).toBe(404)
    const res = await json('POST', '/api/reviews', { projectId: 'p1', versionId, ttl: '7d' }, owner)
    expect(res.status).toBe(200)
    const body = await res.json()
    token = body.token
    expect(body.url).toMatch(new RegExp(`/r/${token}$`))
  })

  it('shows the client the screens, and never the brief or the private notes', async () => {
    const res = await fetch(`${base}/api/review/${token}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const text = await res.text()
    expect(text).toContain('Bonjour')
    expect(text).not.toContain('confidential')
    expect(text).not.toContain('Paul hates')
  })

  it('takes a comment on a screen of the version, and refuses one on a screen it does not hold', async () => {
    const ok = await json('POST', `/api/review/${token}/comments`, { author: 'Claire', text: 'Super', screenId: 's1', x: 0.5, y: 0.5 })
    expect(ok.status).toBe(200)
    const bad = await json('POST', `/api/review/${token}/comments`, { author: 'Claire', text: 'x', screenId: 'nope' })
    expect(bad.status).toBe(400)
  })

  it('carries the client\'s decision to the owner\'s project status', async () => {
    const res = await json('POST', `/api/review/${token}/decision`, { author: 'Claire', verdict: 'changes_requested', message: 'Plus grand' })
    expect(res.status).toBe(200)
    const status = await (await json('GET', '/api/reviews/status', undefined, owner)).json()
    expect(status.projects.p1).toMatchObject({ status: 'changes_requested', unread: 2 })
    // Somebody else's account sees nothing of it.
    const theirs = await (await json('GET', '/api/reviews/status', undefined, other)).json()
    expect(theirs.projects).toEqual({})
  })

  it('protects the version it shows from deletion', async () => {
    const res = await json('DELETE', `/api/versions/${versionId}`, undefined, owner)
    expect(res.status).toBe(409)
  })

  it('stops working for everybody once revoked', async () => {
    expect((await json('DELETE', `/api/reviews/${token}`, undefined, other)).status).toBe(200)
    expect((await fetch(`${base}/api/review/${token}`)).status).toBe(200)
    await json('DELETE', `/api/reviews/${token}`, undefined, owner)
    expect((await fetch(`${base}/api/review/${token}`)).status).toBe(404)
    // And the version is free to go.
    expect((await json('DELETE', `/api/versions/${versionId}`, undefined, owner)).status).toBe(200)
  })
})
