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
  ['POST', '/api/admin/text/models', 'makes the server call the provider with the instance key'],
  ['POST', '/api/share', 'minting a link is what DECIDES something becomes publicly readable'],
  ['GET', '/api/share', 'lists this account’s live links'],
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
  const proxy = (method, p, cookie) =>
    fetch(`${base}/__provider${p}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-provider-base': 'https://example.invalid',
        ...(cookie ? { cookie } : {}),
      },
      body: method === 'GET' ? undefined : '{}',
    })

  /** Session cookie for the instance's one account, created on first use. */
  let cookie = ''
  beforeAll(async () => {
    const res = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'proxytest', password: 'correct-horse' }),
    })
    cookie = (res.headers.get('set-cookie') || '').split(';')[0]
  })

  // The proxy makes the server issue an outbound request. Unauthenticated, that
  // is an open relay running from the host's IP on the host's credits — so the
  // session check comes before anything else, including the allow-list.
  it('refuses anonymous callers outright', async () => {
    for (const p of ['/api/chat', '/api/tags', '/api/delete']) {
      expect((await proxy('POST', p)).status, p).toBe(401)
    }
  })

  it('refuses model-management endpoints even with a session', async () => {
    for (const [m, p] of [
      ['DELETE', '/api/delete'],
      ['POST', '/api/pull'],
      ['POST', '/api/create'],
    ]) {
      expect((await proxy(m, p, cookie)).status, `${m} ${p}`).toBe(404)
    }
  })

  it('does not 404 the two endpoints the app uses', async () => {
    for (const p of ['/api/chat', '/api/tags']) {
      expect((await proxy('POST', p, cookie)).status, p).not.toBe(404)
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

describe('security headers for a publicly reachable instance', () => {
  it('declares a Permissions-Policy', async () => {
    const h = (await call('GET', '/api/config')).headers
    expect(h.get('permissions-policy')).toMatch(/camera=\(\)/)
  })

  it('does not send HSTS over plain HTTP', async () => {
    // Sending it from a LAN instance reached over http:// would pin browsers to
    // an https:// URL that does not answer — the classic way to lock yourself
    // out of your own tool.
    const h = (await call('GET', '/api/config')).headers
    expect(h.get('strict-transport-security')).toBeNull()
  })
})

/**
 * A share link is a capability: the URL is the whole authority. Two properties
 * decide whether that is safe, and both are pinned here — reading one needs no
 * account (that is the point), and an unknown token is indistinguishable from
 * an expired or revoked one (so probing the route teaches nothing).
 */
describe('share links', () => {
  it('reads without a session — the token IS the authority', async () => {
    // 404 rather than 401: the route is reachable, the token simply is not real.
    const res = await call('GET', `/api/share/${'a'.repeat(64)}`)
    expect(res.status).toBe(404)
  })

  it('answers the same for malformed, unknown and expired tokens', async () => {
    const codes = []
    for (const t of ['short', 'Z'.repeat(64), 'b'.repeat(64), '../../etc/passwd']) {
      codes.push((await call('GET', `/api/share/${encodeURIComponent(t)}`)).status)
    }
    // One answer for every kind of miss: anything else confirms which tokens
    // were once real.
    expect(new Set(codes).size).toBe(1)
    expect(codes[0]).toBe(404)
  })
})

describe('account picture', () => {
  it('needs a session to read, upload or remove', async () => {
    for (const [m, p] of [
      ['GET', '/api/account/avatar'],
      ['POST', '/api/account/avatar'],
      ['DELETE', '/api/account/avatar'],
    ]) {
      expect((await call(m, p)).status, `${m} ${p}`).toBe(401)
    }
  })
})
