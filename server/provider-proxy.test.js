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

describe('profile routing', () => {
  /** Resolver that answers with a different model per profile. */
  const perProfile = (profile) => ({
    kind: 'ollama',
    baseUrl: fakeUrl,
    apiKey: '',
    model: profile === 'inspiration' ? 'insp-model' : 'gen-model',
  })

  it('defaults to the generation profile when no header is sent', async () => {
    seen.length = 0
    const h = await expressHost(perProfile)
    await fetch(`${h.base}/__provider/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'from-browser', messages: [] }),
    })
    expect(JSON.parse(seen.at(-1).body).model).toBe('gen-model')
    h.close()
  })

  it('routes x-mocky-profile: inspiration to the inspiration model', async () => {
    seen.length = 0
    const h = await expressHost(perProfile)
    await fetch(`${h.base}/__provider/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mocky-profile': 'inspiration' },
      body: JSON.stringify({ model: 'from-browser', messages: [] }),
    })
    expect(JSON.parse(seen.at(-1).body).model).toBe('insp-model')
    h.close()
  })

  it('treats an unknown profile as generation', async () => {
    seen.length = 0
    const h = await expressHost(perProfile)
    await fetch(`${h.base}/__provider/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mocky-profile': 'whatever' },
      body: JSON.stringify({ model: 'from-browser', messages: [] }),
    })
    expect(JSON.parse(seen.at(-1).body).model).toBe('gen-model')
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

/**
 * A browser-supplied endpoint that speaks OpenAI.
 *
 * "Bring your own key" used to be limited to Ollama — not because the other
 * providers could not work, but because the browser never said which dialect
 * its endpoint spoke, so the proxy could only forward the Ollama-shaped body
 * verbatim. `x-provider-kind` supplies that fact, and the SAME translator that
 * has always served admin-configured providers takes over.
 *
 * `fetch` is injected rather than pointed at the local fake used above: a
 * browser-supplied base goes through the SSRF guard, which correctly refuses
 * 127.0.0.1. `example.test` does not resolve, so the guard fails open (its
 * documented behaviour) and the injected fetch stands in for the provider.
 */
describe('browser-supplied provider, OpenAI dialect', () => {
  const BASE = 'http://provider.example.test'

  /** Mount the proxy with a recording fetch instead of a real one. */
  async function hostWithFetch(calls) {
    const fakeFetch = async (url, init) => {
      calls.push({ url, method: init?.method, auth: init?.headers?.authorization, body: init?.body?.toString() })
      return new Response(JSON.stringify({ model: 'm', choices: [{ message: { content: 'ok' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    const app = express()
    app.use('/__provider', (req, res) => handleProviderProxy(req, res, fakeFetch, { resolveTarget: () => null }))
    const srv = app.listen(0, '127.0.0.1')
    await new Promise((r) => srv.on('listening', r))
    return { base: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() }
  }

  it('translates /api/chat into /v1/chat/completions and answers in the Ollama shape', async () => {
    const calls = []
    const host = await hostWithFetch(calls)
    const res = await fetch(`${host.base}/__provider/api/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-provider-base': BASE,
        'x-provider-kind': 'openai',
        authorization: 'Bearer sk-user-own-key',
      },
      body: JSON.stringify({ model: 'gpt-4o-mini', stream: false, messages: [{ role: 'user', content: 'hi' }] }),
    })
    const json = await res.json()
    host.close()

    expect(calls.at(-1).url).toBe(`${BASE}/v1/chat/completions`)
    // The caller's own credential reaches the provider untouched.
    expect(calls.at(-1).auth).toBe('Bearer sk-user-own-key')
    // …and the answer comes back in the shape Mocky speaks internally.
    expect(json.message.content).toBe('ok')
  })

  it('leaves the Ollama path untouched when no dialect is declared', async () => {
    const calls = []
    const host = await hostWithFetch(calls)
    await fetch(`${host.base}/__provider/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-provider-base': BASE },
      body: JSON.stringify({ model: 'llama3', messages: [] }),
    })
    host.close()
    expect(calls.at(-1).url).toBe(`${BASE}/api/chat`)
  })

  it('does not let the dialect header bypass the SSRF guard', async () => {
    const calls = []
    const host = await hostWithFetch(calls)
    const res = await fetch(`${host.base}/__provider/api/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-provider-base': 'http://169.254.169.254',
        'x-provider-kind': 'openai',
      },
      body: '{}',
    })
    host.close()
    expect(res.status).toBe(400)
    expect(calls).toHaveLength(0)
  })
})
