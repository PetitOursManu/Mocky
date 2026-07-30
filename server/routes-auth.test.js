import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'

/**
 * Which routes an anonymous caller may reach.
 *
 * This boundary is easy to break by accident and hard to notice: mounting a
 * guard on the '/api' prefix instead of on a route's own subpath silently put
 * the public image bytes behind auth, which would have blanked out every image
 * in every mockup. Nothing failed, nothing logged. Hence a real server, real
 * HTTP, and an exact expected status per route.
 *
 * The server boots against a throwaway MOCKY_DATA_DIR — never the developer's
 * own server/data.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
let proc, base, dataDir

/** A 64-hex name, matching the content-addressed images the library writes. */
const HASH = 'a'.repeat(64)

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
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-test-'))
  fs.mkdirSync(path.join(dataDir, 'image-library'), { recursive: true })
  // A real file so the public-bytes route can answer 200 rather than 404.
  fs.writeFileSync(path.join(dataDir, 'image-library', `${HASH}.jpg`), Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
  fs.writeFileSync(
    path.join(dataDir, 'image-library.json'),
    JSON.stringify({ [HASH]: { hash: HASH, prompt: 'test', createdAt: Date.now(), projects: [], tags: [] } }),
  )

  const port = await freePort()
  proc = spawn(process.execPath, [path.join(here, 'index.js')], {
    env: { ...process.env, MOCKY_DATA_DIR: dataDir, MOCKY_PORT: String(port), NODE_ENV: 'test' },
    stdio: 'ignore',
  })
  base = `http://127.0.0.1:${port}`

  // Wait for the port to answer rather than sleeping a fixed amount.
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

const PUBLIC = [
  ['GET', '/api/config', 'the sign-in screen needs it before any session exists'],
  ['GET', '/api/me', 'the SPA polls it on every load; 200 with null user'],
  [
    'GET',
    `/api/images/${HASH}`,
    'preview iframes are sandboxed to an opaque origin and send no cookie; exported ZIPs have no session at all',
  ],
  ['GET', `/api/images/${HASH}?download=1`, 'same bytes, same reasoning'],
]

const GUARDED = [
  ['GET', '/api/images/library', 'lists every prompt, i.e. every brief ever typed'],
  ['GET', '/api/images/library.zip', 'exfiltrates the whole library in one request'],
  ['GET', '/api/images/providers', ''],
  ['DELETE', `/api/images/${HASH}`, 'really unlinks the file — no trash'],
  ['POST', `/api/images/${HASH}/favorite`, ''],
  ['POST', '/api/images/generate', 'spends the instance’s image provider'],
  ['GET', '/api/images/deadbeef', 'a short hash is not a capability URL'],
  ['GET', '/api/mcp/status', ''],
  ['POST', '/api/muse/dossier', 'spends model tokens and can launch Chromium'],
  ['POST', '/api/text/vision', 'server-side fetch of a caller-supplied base URL'],
  ['GET', '/api/data', ''],
  ['PUT', '/api/data', ''],
  ['GET', '/api/admin/users', ''],
  ['GET', '/api/admin/config', ''],
  ['GET', '/api/admin/images/config', ''],
  ['GET', '/api/admin/text/config', ''],
]

const call = (method, p) =>
  fetch(base + p, {
    method,
    headers: { 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : '{}',
  })

describe('anonymous access boundary', () => {
  for (const [method, p, why] of PUBLIC) {
    it(`allows ${method} ${p}${why ? ` — ${why}` : ''}`, async () => {
      expect((await call(method, p)).status).toBe(200)
    })
  }

  for (const [method, p, why] of GUARDED) {
    it(`requires a session for ${method} ${p}${why ? ` — ${why}` : ''}`, async () => {
      expect((await call(method, p)).status).toBe(401)
    })
  }
})

describe('provider proxy', () => {
  const proxy = (method, p) =>
    fetch(`${base}/__provider${p}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-provider-base': 'https://example.invalid' },
      body: method === 'GET' ? undefined : '{}',
    })

  it('refuses model-management endpoints', async () => {
    for (const [m, p] of [
      ['DELETE', '/api/delete'],
      ['POST', '/api/pull'],
      ['POST', '/api/create'],
    ]) {
      expect((await proxy(m, p)).status, `${m} ${p}`).toBe(404)
    }
  })

  it('does not 404 the two endpoints the app uses', async () => {
    for (const p of ['/api/chat', '/api/tags']) {
      expect((await proxy('POST', p)).status, p).not.toBe(404)
    }
  })
})

describe('response headers', () => {
  it('does not advertise the framework', async () => {
    expect((await call('GET', '/api/config')).headers.get('x-powered-by')).toBeNull()
  })

  it('sets the baseline protection headers', async () => {
    const h = (await call('GET', '/api/config')).headers
    expect(h.get('x-content-type-options')).toBe('nosniff')
    expect(h.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
  })
})
