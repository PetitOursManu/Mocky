import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'

/**
 * PUT /api/data merges instead of overwriting, and the account's other tabs
 * hear about it — against a real server, because the promise is about what
 * lands in the file and what goes down a socket, and neither is visible to a
 * unit test of server/merge.js.
 *
 * The scenario that made it necessary: something other than this tab (another
 * device, the MCP runner) adds a project; this tab, which never heard of it,
 * pushes its own copy. Before, the project was gone.
 */

const root = fileURLToPath(new URL('..', import.meta.url))
let proc, base, dataDir, cookie

async function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

const call = (method, p, body, headers = {}) =>
  fetch(base + p, {
    method,
    headers: { 'content-type': 'application/json', cookie, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const project = (id, updatedAt, extra = {}) => ({ id, name: id, createdAt: updatedAt, updatedAt, screens: [], ...extra })

/** Open the events stream as `tab` and collect event names until `close()`. */
async function listen(tab) {
  const ac = new AbortController()
  const res = await fetch(`${base}/api/data/events?tab=${tab}`, { headers: { cookie }, signal: ac.signal })
  const events = []
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const done = (async () => {
    let buf = ''
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        for (const m of buf.matchAll(/^event: (.+)$/gm)) events.push(m[1])
        buf = buf.slice(buf.lastIndexOf('\n') + 1)
      }
    } catch {
      /* aborted */
    }
  })()
  return {
    status: res.status,
    events,
    close: async () => {
      ac.abort()
      await done
    },
  }
}

const settle = () => new Promise((r) => setTimeout(r, 300))

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-merge-'))
  const port = await freePort()
  proc = spawn(process.execPath, [path.join(root, 'server/index.js')], {
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
      if (Date.now() > deadline) throw new Error('server did not start')
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  const res = await fetch(`${base}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'mergetest', password: 'correct-horse-battery' }),
  })
  cookie = (res.headers.get('set-cookie') || '').split(';')[0]
}, 30_000)

afterAll(() => {
  proc?.kill()
  fs.rmSync(dataDir, { recursive: true, force: true })
})

describe('PUT /api/data merges', () => {
  it('keeps a project a stale tab never heard of, and tells that tab to read back', async () => {
    const now = Date.now()
    // Another writer put two projects there.
    let res = await call('PUT', '/api/data', { projects: JSON.stringify([project('mine', now - 10), project('from-elsewhere', now)]), design: null })
    expect((await res.json()).merged).toBe(false)

    // This tab only knows its own project, and pushes it.
    res = await call('PUT', '/api/data', { projects: JSON.stringify([project('mine', now - 5, { name: 'edited' })]), design: '# D' })
    expect((await res.json()).merged).toBe(true)

    const stored = await (await call('GET', '/api/data')).json()
    const projects = JSON.parse(stored.projects)
    expect(projects.map((p) => p.id).sort()).toEqual(['from-elsewhere', 'mine'])
    expect(projects.find((p) => p.id === 'mine').name).toBe('edited')
    expect(stored.design).toBe('# D')
  })

  it('does not let an older copy win over a newer one', async () => {
    const now = Date.now() + 1000
    await call('PUT', '/api/data', { projects: JSON.stringify([project('race', now, { name: 'newer' })]), design: null })
    await call('PUT', '/api/data', { projects: JSON.stringify([project('race', now - 500, { name: 'older' })]), design: null })
    const projects = JSON.parse((await (await call('GET', '/api/data')).json()).projects)
    expect(projects.find((p) => p.id === 'race').name).toBe('newer')
  })

  it('leaves the global DESIGN.md alone when a writer does not send it', async () => {
    await call('PUT', '/api/data', { projects: JSON.stringify([]), design: '# Kept' })
    await call('PUT', '/api/data', { projects: JSON.stringify([project('runner-wrote', Date.now() + 9000)]) })
    expect((await (await call('GET', '/api/data')).json()).design).toBe('# Kept')
    // An explicit null still clears, as a browser's push always could.
    await call('PUT', '/api/data', { projects: '[]', design: null })
    expect((await (await call('GET', '/api/data')).json()).design).toBeNull()
  })

  it('keeps a screen another writer added to a project this tab is editing', async () => {
    const t0 = Date.now() + 20_000
    const shared = (updatedAt, screens) => project('shared', updatedAt, { screens })
    // The runner wrote a second screen…
    await call('PUT', '/api/data', { projects: JSON.stringify([shared(t0, [{ id: 'a' }, { id: 'mcp' }])]) })
    // …while the tab, newer, edited the first one without having heard of it.
    await call('PUT', '/api/data', { projects: JSON.stringify([shared(t0 + 5, [{ id: 'a', code: 'edited' }])]) })
    const got = JSON.parse((await (await call('GET', '/api/data')).json()).projects).find((p) => p.id === 'shared')
    expect(got.screens.map((s) => s.id)).toEqual(['a', 'mcp'])
    expect(got.screens[0].code).toBe('edited')
  })

  it('never empties an account because a request sent nothing', async () => {
    await call('PUT', '/api/data', { projects: '[]', design: null })
    await call('PUT', '/api/data', { projects: null, design: null })
    const projects = JSON.parse((await (await call('GET', '/api/data')).json()).projects)
    expect(projects.length).toBeGreaterThanOrEqual(2)
  })
})

describe('the account’s other tabs hear about a write', () => {
  it('tells the other tab and not the one that wrote', async () => {
    const a = await listen('tab-aaaaaaaa')
    const b = await listen('tab-bbbbbbbb')
    expect(a.status).toBe(200)
    await settle()

    const now = Date.now() + 5000
    await call('PUT', '/api/data', { projects: JSON.stringify([project('live', now)]), design: null }, { 'x-mocky-tab': 'tab-aaaaaaaa' })
    await settle()

    expect(a.events).toEqual([])
    expect(b.events).toEqual(['data-changed'])
    await a.close()
    await b.close()
  })

  it('stays quiet when a push changed nothing', async () => {
    const before = JSON.parse((await (await call('GET', '/api/data')).json()).projects)
    const b = await listen('tab-cccccccc')
    await settle()
    const design = (await (await call('GET', '/api/data')).json()).design
    await call('PUT', '/api/data', { projects: JSON.stringify(before), design }, { 'x-mocky-tab': 'tab-dddddddd' })
    await settle()
    expect(b.events).toEqual([])
    await b.close()
  })

  it('refuses a stream to nobody', async () => {
    const res = await fetch(`${base}/api/data/events?tab=tab-eeeeeeee`)
    expect(res.status).toBe(401)
  })
})
