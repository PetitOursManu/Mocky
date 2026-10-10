import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import express from 'express'
import { handleProviderProxy } from './provider-proxy.js'
import { buildUpstream, closedSchema } from './text/dialect.js'

/**
 * Two ways a real provider broke real generations, played by a fake one:
 * a compatibility layer that refuses the structured-output schema (400 on
 * every planner, Muse, picture-judge and storyboard call), and a model that
 * thinks longer than a reverse proxy waits for a first byte (Cloudflare's 524).
 */
let fake, fakeUrl
const calls = []
beforeAll(async () => {
  fake = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}')
      calls.push({ url: req.url, body: parsed })
      const answer = (content) => {
        if (parsed.stream) {
          res.setHeader('content-type', 'text/event-stream')
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
          return res.end('data: [DONE]\n\n')
        }
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }))
      }
      if (req.url.startsWith('/strict/')) {
        if (parsed.response_format) {
          res.statusCode = 400
          res.setHeader('content-type', 'application/json')
          return res.end(
            JSON.stringify({
              error: {
                type: 'invalid_request_error',
                message: "For 'object' type, 'additionalProperties' must be explicitly set to false",
              },
            }),
          )
        }
        return answer('{"a":1}')
      }
      if (req.url.startsWith('/torn/')) {
        // An Ollama stream whose chunk ends in the middle of a line, then goes quiet.
        res.setHeader('content-type', 'application/x-ndjson')
        res.write('{"message":{"role":"assistant","content":"a')
        return setTimeout(() => res.end('b"},"done":false}\n{"done":true}\n'), 300)
      }
      if (req.url.startsWith('/slow/')) return setTimeout(() => answer('late but here'), 350)
      if (req.url.startsWith('/slowfail/')) {
        return setTimeout(() => {
          res.statusCode = 400
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: { message: 'model not found' } }))
        }, 350)
      }
      answer('ok')
    })
  })
  await new Promise((r) => fake.listen(0, '127.0.0.1', r))
  fakeUrl = `http://127.0.0.1:${fake.address().port}`
})
afterAll(() => fake.close())

async function host(path, timing = {}, kind = 'openai') {
  const app = express()
  const target =
    kind === 'openai'
      ? { kind, baseUrl: `${fakeUrl}${path}/v1`, apiKey: 'k', model: 'claude-sonnet-5-5' }
      : { kind, baseUrl: `${fakeUrl}${path}`, apiKey: 'k', model: 'gpt-oss:120b' }
  app.use('/__provider', (req, res) => handleProviderProxy(req, res, fetch, { resolveTarget: () => target, ...timing }))
  const srv = app.listen(0, '127.0.0.1')
  await new Promise((r) => srv.on('listening', r))
  return { base: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() }
}

const chat = (base, extra = {}) =>
  fetch(`${base}/__provider/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'x', messages: [{ role: 'user', content: 'hi' }], stream: false, ...extra }),
  })

describe('a provider that refuses the structured-output schema', () => {
  it('is asked again without the schema, once, and the answer comes back', async () => {
    const h = await host('/strict')
    const before = calls.length
    const res = await chat(h.base, { format: { type: 'object', properties: { a: { type: 'number' } } } })
    expect(res.status).toBe(200)
    expect((await res.json()).message.content).toBe('{"a":1}')
    const mine = calls.slice(before)
    expect(mine).toHaveLength(2)
    expect(mine[0].body.response_format).toBeDefined()
    expect(mine[1].body.response_format).toBeUndefined()
    h.close()
  })

  it('is not asked twice for a request that had no schema', async () => {
    const h = await host('/slowfail')
    const before = calls.length
    const res = await chat(h.base)
    expect(res.status).toBe(400)
    expect(calls.length - before).toBe(1)
    h.close()
  })
})

describe('a slow answer behind a proxy that cuts silent requests', () => {
  it('answers 200 early and keeps a stream alive with lines the reader skips', async () => {
    const h = await host('/slow', { lateCommitMs: 80, keepAliveMs: 60 })
    const res = await chat(h.base, { stream: true })
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text.startsWith('\n')).toBe(true)
    const lines = text.split('\n').filter((l) => l.trim())
    expect(JSON.parse(lines[0]).message.content).toBe('late but here')
    h.close()
  })

  it('keeps a JSON answer alive with spaces, which JSON.parse skips', async () => {
    const h = await host('/slow', { lateCommitMs: 80, keepAliveMs: 60 })
    const res = await chat(h.base)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text.startsWith(' ')).toBe(true)
    expect(JSON.parse(text).message.content).toBe('late but here')
    h.close()
  })

  it('never writes its filler inside a line a raw stream left unfinished', async () => {
    const h = await host('/torn', { lateCommitMs: 2000, keepAliveMs: 40 }, 'ollama')
    const text = await (await chat(h.base, { stream: true })).text()
    const lines = text.split('\n').filter((l) => l.trim())
    expect(lines.map((l) => JSON.parse(l))).toEqual([{ message: { role: 'assistant', content: 'ab' }, done: false }, { done: true }])
    h.close()
  })

  it('carries a provider error that arrives after the status as the answer’s own error field', async () => {
    const h = await host('/slowfail', { lateCommitMs: 80, keepAliveMs: 60 })
    const streamed = await (await chat(h.base, { stream: true })).text()
    expect(JSON.parse(streamed.trim()).error).toMatch(/HTTP 400 from provider.*model not found/)
    const plain = await chat(h.base)
    expect(plain.status).toBe(200)
    expect((await plain.json()).error).toMatch(/model not found/)
    h.close()
  })

  it('changes nothing for an answer that comes in time', async () => {
    const h = await host('/fast')
    const res = await chat(h.base)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(JSON.stringify({ message: { role: 'assistant', content: 'ok' }, done: true, done_reason: 'stop' }))
    h.close()
  })
})

describe('a schema as Claude’s structured outputs take it', () => {
  it('closes every object and drops the bounds they refuse, keeping the shape', () => {
    const schema = {
      type: 'object',
      properties: {
        sections: { type: 'array', items: { type: 'string', maxLength: 80 }, minItems: 1, maxItems: 8 },
        pick: { type: 'integer', minimum: 0, maximum: 9 },
        nested: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] },
        either: { oneOf: [{ type: 'string' }, { type: 'object', properties: { y: { type: 'number' } } }] },
        free: { type: 'object' },
      },
      required: ['sections'],
    }
    expect(closedSchema(schema)).toEqual({
      type: 'object',
      properties: {
        sections: { type: 'array', items: { type: 'string' } },
        pick: { type: 'integer' },
        nested: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'], additionalProperties: false },
        either: { anyOf: [{ type: 'string' }, { type: 'object', properties: { y: { type: 'number' } }, additionalProperties: false }] },
        free: { type: 'object' },
      },
      required: ['sections'],
      additionalProperties: false,
    })
  })

  it('is what Anthropic is sent, and nobody else', () => {
    const body = Buffer.from(
      JSON.stringify({
        model: 'claude-sonnet-5-5',
        messages: [],
        format: { type: 'object', properties: { a: { type: 'string', maxLength: 3 } } },
      }),
    )
    const toClaude = JSON.parse(buildUpstream({ kind: 'openai', baseUrl: 'https://api.anthropic.com/v1' }, '/api/chat', body).body)
    expect(toClaude.response_format.json_schema.schema).toEqual({
      type: 'object',
      properties: { a: { type: 'string' } },
      additionalProperties: false,
    })
    const toOpenAi = JSON.parse(buildUpstream({ kind: 'openai', baseUrl: 'https://api.openai.com' }, '/api/chat', body).body)
    expect(toOpenAi.response_format.json_schema.schema.properties.a.maxLength).toBe(3)
  })
})
