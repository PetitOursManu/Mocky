import { describe, it, expect, afterAll } from 'vitest'
import express from 'express'
import {
  ALLOWED_SUBPATHS,
  assertSafeIp,
  assertSafeTarget,
  assertSafeTargetResolved,
  handleProviderProxy,
  readRawBody,
} from './provider-proxy.js'
import { Readable } from 'node:stream'

/**
 * The guard used to be a set of string comparisons, and three families of
 * address walked straight through it. Each of these was verified by execution
 * against the old implementation before being fixed, so they are regression
 * tests, not hypotheticals.
 */

const blocked = [
  // --- bypasses that used to work ---
  ['IPv4-mapped IPv6 loopback', 'http://[::ffff:127.0.0.1]/api/chat'],
  ['IPv4-mapped IPv6 loopback, hex form', 'http://[::ffff:7f00:1]/api/chat'],
  ['0.0.0.0 (routes to localhost)', 'http://0.0.0.0/api/chat'],
  ['unspecified IPv6 address', 'http://[::]/api/chat'],
  ['carrier-grade NAT range', 'http://100.64.0.1/api/chat'],
  ['benchmarking range', 'http://198.18.0.1/api/chat'],
  // --- cases the original guard already caught; kept so a rewrite cannot regress ---
  ['loopback', 'http://127.0.0.1/api/chat'],
  ['loopback, alternate notation', 'http://127.1/api/chat'],
  ['loopback, octal', 'http://0177.0.0.1/api/chat'],
  ['loopback, decimal', 'http://2130706433/api/chat'],
  ['localhost by name', 'http://localhost/api/chat'],
  ['a .localhost subdomain', 'http://anything.localhost/api/chat'],
  ['IPv6 loopback', 'http://[::1]/api/chat'],
  ['cloud metadata endpoint', 'http://169.254.169.254/latest/meta-data/'],
  ['RFC1918 /16', 'http://192.168.1.10/api/chat'],
  ['RFC1918 /8', 'http://10.0.0.5/api/chat'],
  ['RFC1918 /12', 'http://172.20.0.1/api/chat'],
  ['unique-local IPv6', 'http://[fd00::1]/api/chat'],
  ['link-local IPv6', 'http://[fe80::1]/api/chat'],
  ['multicast', 'http://239.0.0.1/api/chat'],
  ['a non-http scheme', 'file:///etc/passwd'],
  ['gopher', 'gopher://example.com/'],
]

const allowed = [
  ['a public hostname', 'https://ollama.com/api/chat'],
  ['another public hostname', 'https://api.openai.com/v1/chat/completions'],
  ['a public IP literal', 'http://93.184.216.34/api/chat'],
]

describe('assertSafeTarget', () => {
  for (const [name, url] of blocked) {
    it(`blocks ${name}`, () => {
      expect(() => assertSafeTarget(url)).toThrow()
    })
  }
  for (const [name, url] of allowed) {
    it(`allows ${name}`, () => {
      expect(() => assertSafeTarget(url)).not.toThrow()
    })
  }
  it('rejects an unparseable URL', () => {
    expect(() => assertSafeTarget('not a url')).toThrow(/Invalid target URL/)
  })
})

describe('assertSafeIp', () => {
  it('accepts a public address', () => {
    expect(() => assertSafeIp('93.184.216.34')).not.toThrow()
    expect(() => assertSafeIp('2606:2800:220:1::')).not.toThrow()
  })
  it('rejects every private v4 family', () => {
    for (const ip of ['10.1.2.3', '172.16.0.1', '192.168.0.1', '127.0.0.1', '169.254.169.254', '0.0.0.0'])
      expect(() => assertSafeIp(ip), ip).toThrow()
  })
  it('tolerates bracketed IPv6, the form new URL() hands back', () => {
    expect(() => assertSafeIp('[::1]')).toThrow()
  })
})

describe('assertSafeTargetResolved', () => {
  it('still allows a real public host', async () => {
    await expect(assertSafeTargetResolved('https://ollama.com/api/chat')).resolves.toBeInstanceOf(URL)
  })

  it('blocks a hostname that resolves to loopback (DNS rebinding)', async () => {
    // localhost is the one name guaranteed to resolve to the loopback on every
    // machine, so it stands in for an attacker-controlled A record.
    await expect(assertSafeTargetResolved('http://localhost/api/chat')).rejects.toThrow()
  })

  it('does not turn an unresolvable host into a security error', async () => {
    // Failing DNS should fail later, on connect, with a message that says so.
    await expect(
      assertSafeTargetResolved('https://nonexistent.invalid/api/chat'),
    ).resolves.toBeInstanceOf(URL)
  })
})

describe('proxy subpath allow-list', () => {
  const servers = []
  afterAll(() => servers.forEach((s) => s.close()))

  /** Mount the proxy the way Express does in production. */
  async function host() {
    const app = express()
    app.use('/__provider', (req, res) => handleProviderProxy(req, res, fetch))
    const srv = app.listen(0, '127.0.0.1')
    servers.push(srv)
    await new Promise((r) => srv.once('listening', r))
    return `http://127.0.0.1:${srv.address().port}`
  }

  const call = (base, method, path) =>
    fetch(`${base}/__provider${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-provider-base': 'https://example.invalid' },
      body: method === 'GET' ? undefined : '{}',
    })

  it('refuses the model-management endpoints', async () => {
    const base = await host()
    // DELETE /api/delete {"name":"llama3"} used to reach the configured Ollama
    // and remove a model: only `model` is rewritten, `name` passed through.
    for (const [m, p] of [
      ['DELETE', '/api/delete'],
      ['POST', '/api/pull'],
      ['POST', '/api/create'],
      ['POST', '/api/push'],
      ['GET', '/'],
    ]) {
      const res = await call(base, m, p)
      expect(res.status, `${m} ${p}`).toBe(404)
    }
  })

  it('lets the two endpoints the app actually uses through the allow-list', async () => {
    const base = await host()
    // example.invalid does not resolve, so these fail at the fetch (502) rather
    // than at the allow-list (404) — which is exactly the distinction under test.
    for (const p of [...ALLOWED_SUBPATHS]) {
      const res = await call(base, 'POST', p)
      expect(res.status, p).not.toBe(404)
    }
  })

  it('is not fooled by a query string', async () => {
    const base = await host()
    expect((await call(base, 'POST', '/api/chat?x=1')).status).not.toBe(404)
    expect((await call(base, 'DELETE', '/api/delete?x=1')).status).toBe(404)
  })
})

describe('readRawBody', () => {
  it('reads a normal body', async () => {
    const req = Readable.from([Buffer.from('{"a":1}')])
    expect((await readRawBody(req)).toString()).toBe('{"a":1}')
  })

  it('rejects past the limit instead of buffering without bound', async () => {
    const req = Readable.from([Buffer.alloc(64), Buffer.alloc(64)])
    req.destroy = () => {}
    await expect(readRawBody(req, 100)).rejects.toThrow(/too large/)
  })
})
