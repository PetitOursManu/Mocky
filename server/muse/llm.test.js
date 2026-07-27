import { describe, it, expect, vi, afterEach } from 'vitest'
import { museChat, museJson, makeLlm } from './llm.js'

const creds = { baseUrl: 'https://ollama.com', apiKey: 'k', model: 'gpt-oss:120b' }

function stubFetch(handler) {
  vi.stubGlobal('fetch', vi.fn(handler))
}
afterEach(() => vi.unstubAllGlobals())

describe('museChat', () => {
  it('POSTs to /api/chat with a positive num_predict (I8) and returns content', async () => {
    let seen
    stubFetch(async (url, init) => {
      seen = { url, body: JSON.parse(init.body), headers: init.headers }
      return { ok: true, status: 200, json: async () => ({ message: { content: 'hi' } }) }
    })
    const out = await museChat(creds, { system: 's', user: 'u', options: { num_predict: -1 } })
    expect(out).toBe('hi')
    expect(seen.url).toBe('https://ollama.com/api/chat')
    expect(seen.body.options.num_predict).toBeGreaterThan(0) // clamped from -1
    expect(seen.body.stream).toBe(false)
    expect(seen.headers.authorization).toBe('Bearer k')
  })

  it('sends the Ollama `format` schema for structured output', async () => {
    let body
    stubFetch(async (url, init) => {
      body = JSON.parse(init.body)
      return { ok: true, status: 200, json: async () => ({ message: { content: '{}' } }) }
    })
    await museChat(creds, { system: 's', user: 'u', schema: { type: 'object' } })
    expect(body.format).toEqual({ type: 'object' })
  })

  it('throws a clear error on auth failure', async () => {
    stubFetch(async () => ({ ok: false, status: 401, text: async () => 'nope' }))
    await expect(museChat(creds, { system: 's', user: 'u' })).rejects.toThrow(/auth failed/i)
  })

  it('rejects an SSRF target (localhost provider)', async () => {
    stubFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }))
    await expect(museChat({ ...creds, baseUrl: 'http://localhost:11434' }, { system: 's', user: 'u' })).rejects.toThrow()
  })

  it('requires baseUrl and model', async () => {
    await expect(museChat({ apiKey: 'k', model: 'm' }, { system: 's', user: 'u' })).rejects.toThrow(/base URL/i)
    await expect(museChat({ baseUrl: 'https://ollama.com' }, { system: 's', user: 'u' })).rejects.toThrow(/model/i)
  })

  // An admin can point the instance at OpenAI/OpenRouter; Muse must speak that
  // dialect too, otherwise its stages 404/403 while the rest of the app works.
  it('translates to the OpenAI dialect for an openai-kind target', async () => {
    let seen
    stubFetch(async (url, init) => {
      seen = { url, body: JSON.parse(init.body) }
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"a":1}' } }] }) }
    })
    const out = await museChat(
      { kind: 'openai', baseUrl: 'https://openrouter.ai/api', apiKey: 'or', model: 'x/y' },
      { system: 's', user: 'u', schema: { type: 'object' }, options: { num_predict: 4096 } },
    )
    expect(out).toBe('{"a":1}')
    expect(seen.url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(seen.body.max_tokens).toBe(4096) // num_predict → max_tokens
    expect(seen.body.response_format.type).toBe('json_schema') // format → response_format
    expect(seen.body.options).toBeUndefined()
  })

  it('sends fal.ai’s "Key" auth scheme rather than a Bearer token', async () => {
    let seen
    stubFetch(async (url, init) => {
      seen = { url, headers: init.headers }
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'hi' } }] }) }
    })
    await museChat(
      { kind: 'openai', auth: 'key', baseUrl: 'https://fal.run/openrouter/router/openai', apiKey: 'id:secret', model: 'openai/gpt-4o-mini', trusted: true },
      { system: 's', user: 'u' },
    )
    expect(seen.url).toBe('https://fal.run/openrouter/router/openai/v1/chat/completions')
    expect(seen.headers.authorization).toBe('Key id:secret')
  })

  it('trusts an admin-configured local endpoint (SSRF guard is for browser URLs)', async () => {
    stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ message: { content: 'hi' } }) }))
    const local = { baseUrl: 'http://127.0.0.1:11434', model: 'llama3', trusted: true }
    expect(await museChat(local, { system: 's', user: 'u' })).toBe('hi')
  })
})

describe('museJson', () => {
  it('parses a clean JSON response', async () => {
    stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ message: { content: '{"a":1}' } }) }))
    expect(await museJson(creds, { system: 's', user: 'u', schema: {} })).toEqual({ a: 1 })
  })

  it('salvages JSON wrapped in prose/fences', async () => {
    stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ message: { content: 'Sure!\n```json\n{"b":2}\n```' } }) }))
    expect(await museJson(creds, { system: 's', user: 'u', schema: {} })).toEqual({ b: 2 })
  })

  it('throws when the response is not JSON at all', async () => {
    stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ message: { content: 'not json' } }) }))
    await expect(museJson(creds, { system: 's', user: 'u', schema: {} })).rejects.toThrow(/valid JSON/i)
  })
})

describe('makeLlm', () => {
  it('binds credentials into a one-arg llm function', async () => {
    stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ message: { content: '{"ok":true}' } }) }))
    const llm = makeLlm(creds)
    expect(await llm({ system: 's', user: 'u', schema: {} })).toEqual({ ok: true })
  })
})
