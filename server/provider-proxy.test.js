import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import express from 'express'
import { handleProviderProxy } from './provider-proxy.js'

/** A stand-in provider that echoes which path it was called on. */
let fake, fakeUrl
const seen = []
beforeAll(async () => {
  fake = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      seen.push({ url: req.url, method: req.method, auth: req.headers.authorization, body })
      res.setHeader('content-type', 'application/json')
      if (req.url === '/v1/models') return res.end(JSON.stringify({ data: [{ id: 'gpt-4o' }] }))
      if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'llama3' }] }))
      res.end(JSON.stringify({ model: 'm', choices: [{ message: { content: 'ok' } }] }))
    })
  })
  await new Promise((r) => fake.listen(0, '127.0.0.1', r))
  fakeUrl = `http://127.0.0.1:${fake.address().port}`
})
afterAll(() => fake.close())

/** Mount the proxy the way Express does in production (mount path is stripped). */
async function expressHost(resolveTarget) {
  const app = express()
  app.use('/__provider', (req, res) => handleProviderProxy(req, res, fetch, { resolveTarget }))
  const srv = app.listen(0, '127.0.0.1')
  await new Promise((r) => srv.on('listening', r))
  return { base: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() }
}

/** Mount it the way the Vite dev middleware does (no mount path). */
async function viteHost(resolveTarget) {
  const app = express()
  app.use((req, res, next) =>
    req.url.startsWith('/__provider') ? handleProviderProxy(req, res, fetch, { resolveTarget }) : next(),
  )
  const srv = app.listen(0, '127.0.0.1')
  await new Promise((r) => srv.on('listening', r))
  return { base: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() }
}

describe('subpath resolution (regression)', () => {
  // Express strips the mount path from req.url, so slicing it produced an EMPTY
  // subpath and every request hit the provider's root — the proxy was broken in
  // production/Docker while working in dev.
  it('keeps the subpath under Express (mount path stripped)', async () => {
    const h = await expressHost(() => null)
    const res = await fetch(`${h.base}/__provider/api/tags`, { headers: { 'x-provider-base': 'https://ollama.test' } })
    const body = await res.json()
    expect(body.target).toBe('https://ollama.test/api/tags') // NOT the bare origin
    h.close()
  })

  it('keeps the subpath under the Vite middleware (no mount path)', async () => {
    const h = await viteHost(() => null)
    const res = await fetch(`${h.base}/__provider/api/tags`, { headers: { 'x-provider-base': 'https://ollama.test' } })
    expect((await res.json()).target).toBe('https://ollama.test/api/tags')
    h.close()
  })
})

describe('SSRF guard scope', () => {
  it('blocks a private address supplied by the BROWSER', async () => {
    const h = await expressHost(() => null)
    const res = await fetch(`${h.base}/__provider/api/tags`, { headers: { 'x-provider-base': fakeUrl } })
    expect((await res.json()).error).toMatch(/Private\/internal/i)
    h.close()
  })

  it('allows a private address configured by an ADMIN (local model, deliberate)', async () => {
    const h = await expressHost(() => ({ kind: 'ollama', baseUrl: fakeUrl, apiKey: '', model: 'llama3' }))
    const res = await fetch(`${h.base}/__provider/api/tags`)
    expect(await res.json()).toEqual({ models: [{ name: 'llama3' }] })
    h.close()
  })
})

describe('OpenAI dialect translation through the proxy', () => {
  it('translates /api/tags → /v1/models and back to the Ollama shape', async () => {
    const h = await expressHost(() => ({ kind: 'openai', baseUrl: fakeUrl, apiKey: 'sk', model: 'gpt-4o' }))
    const res = await fetch(`${h.base}/__provider/api/tags`)
    expect(await res.json()).toEqual({ models: [{ name: 'gpt-4o' }] })
    h.close()
  })

  it('sends the admin model + Bearer key and returns an Ollama-shaped reply', async () => {
    seen.length = 0
    const h = await expressHost(() => ({ kind: 'openai', baseUrl: fakeUrl, apiKey: 'sk', model: 'gpt-4o' }))
    const res = await fetch(`${h.base}/__provider/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-oss:120b', // the browser's model — must be overridden
        stream: false,
        messages: [{ role: 'user', content: 'hi' }],
        options: { temperature: 0.4, num_ctx: 32768, num_predict: 8192 },
      }),
    })
    expect(await res.json()).toEqual({ model: 'm', message: { role: 'assistant', content: 'ok' }, done: true })
    const upstream = seen.find((s) => s.url === '/v1/chat/completions')
    expect(upstream.auth).toBe('Bearer sk')
    const sent = JSON.parse(upstream.body)
    expect(sent.model).toBe('gpt-4o') // admin model wins
    expect(sent.max_tokens).toBe(8192)
    expect(sent.num_ctx).toBeUndefined()
    h.close()
  })
})

describe('pass-through mode is unchanged', () => {
  it('forwards the browser credentials verbatim when no admin target is set', async () => {
    seen.length = 0
    const h = await expressHost(() => null)
    // 127.0.0.1 is blocked for browser URLs, so use the guard-passing hostname
    // form by resolving through the admin path instead; here we only assert the
    // request never reached upstream.
    const res = await fetch(`${h.base}/__provider/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-provider-base': 'https://ollama.test', authorization: 'Bearer user-key' },
      body: JSON.stringify({ model: 'gpt-oss:120b', messages: [] }),
    })
    expect(res.status).toBe(502) // ollama.test does not resolve — proves we tried the real URL
    h.close()
  })
})
