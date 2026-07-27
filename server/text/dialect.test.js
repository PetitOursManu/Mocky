import { describe, it, expect } from 'vitest'
import {
  toOpenAiRequest,
  fromOpenAiResponse,
  fromOpenAiModels,
  createSseTranslator,
  buildUpstream,
  KIND_OLLAMA,
  KIND_OPENAI,
} from './dialect.js'

describe('toOpenAiRequest', () => {
  it('maps Ollama options onto OpenAI fields', () => {
    const out = toOpenAiRequest({
      model: 'gpt-4o-mini',
      stream: true,
      messages: [{ role: 'user', content: 'hi' }],
      options: { temperature: 0.4, num_ctx: 32768, num_predict: 8192 },
    })
    expect(out).toMatchObject({ model: 'gpt-4o-mini', stream: true, temperature: 0.4, max_tokens: 8192 })
    expect(out.num_ctx).toBeUndefined() // Ollama-only knob is dropped, not forwarded
  })

  it('never sends a non-positive max_tokens (invariant I8 stays satisfied)', () => {
    expect(toOpenAiRequest({ options: { num_predict: -1 } }).max_tokens).toBeUndefined()
    expect(toOpenAiRequest({ options: { num_predict: 0 } }).max_tokens).toBeUndefined()
  })

  it('translates a JSON schema `format` into response_format', () => {
    const schema = { type: 'object', properties: { a: { type: 'string' } } }
    const out = toOpenAiRequest({ format: schema, messages: [] })
    expect(out.response_format.type).toBe('json_schema')
    expect(out.response_format.json_schema.schema).toEqual(schema)
    expect(toOpenAiRequest({ format: 'json', messages: [] }).response_format).toEqual({ type: 'json_object' })
  })

  it('converts Ollama vision images into an OpenAI content array', () => {
    const out = toOpenAiRequest({ messages: [{ role: 'user', content: 'look', images: ['QUJD'] }] })
    expect(out.messages[0].content).toEqual([
      { type: 'text', text: 'look' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } },
    ])
  })

  it('leaves a plain message untouched', () => {
    expect(toOpenAiRequest({ messages: [{ role: 'system', content: 's' }] }).messages[0]).toEqual({
      role: 'system',
      content: 's',
    })
  })
})

describe('response translation', () => {
  it('reshapes an OpenAI completion into the Ollama shape Mocky reads', () => {
    expect(fromOpenAiResponse({ model: 'm', choices: [{ message: { content: 'hello' } }] })).toEqual({
      model: 'm',
      message: { role: 'assistant', content: 'hello' },
      done: true,
    })
  })
  it('reshapes /v1/models into /api/tags', () => {
    expect(fromOpenAiModels({ data: [{ id: 'gpt-4o' }, { id: 'o4-mini' }] })).toEqual({
      models: [{ name: 'gpt-4o' }, { name: 'o4-mini' }],
    })
    expect(fromOpenAiModels({})).toEqual({ models: [] })
  })
})

describe('createSseTranslator', () => {
  it('turns SSE deltas into one Ollama JSON object per line', () => {
    const t = createSseTranslator()
    const out = t('data: {"choices":[{"delta":{"content":"He"}}]}\n\ndata: {"choices":[{"delta":{"content":"llo"}}]}\n\n')
    const lines = out.trim().split('\n').map((l) => JSON.parse(l))
    expect(lines.map((l) => l.message.content)).toEqual(['He', 'llo'])
  })

  it('buffers a frame split across chunks', () => {
    const t = createSseTranslator()
    expect(t('data: {"choices":[{"delta":{"co')).toBe('') // incomplete → nothing yet
    const out = t('ntent":"X"}}]}\n\n')
    expect(JSON.parse(out.trim()).message.content).toBe('X')
  })

  it('ignores [DONE] and keep-alive lines', () => {
    const t = createSseTranslator()
    expect(t('data: [DONE]\n\n')).toBe('')
    expect(t(': keep-alive\n\n')).toBe('')
  })
})

describe('buildUpstream', () => {
  it('passes an Ollama target straight through (no translation)', () => {
    const body = Buffer.from(JSON.stringify({ model: 'm', messages: [] }))
    const plan = buildUpstream({ kind: KIND_OLLAMA, baseUrl: 'https://ollama.com', apiKey: 'k' }, '/api/chat', body)
    expect(plan.url).toBe('https://ollama.com/api/chat')
    expect(plan.translate).toBe(false)
    expect(plan.body).toBe(body) // untouched
    expect(plan.headers.authorization).toBe('Bearer k')
  })

  it('routes an OpenAI target to /v1/chat/completions and translates the body', () => {
    const body = Buffer.from(JSON.stringify({ model: 'x', stream: true, messages: [{ role: 'user', content: 'hi' }], options: { num_predict: 100 } }))
    const plan = buildUpstream({ kind: KIND_OPENAI, baseUrl: 'https://api.openai.com/', apiKey: 'sk' }, '/api/chat', body)
    expect(plan.url).toBe('https://api.openai.com/v1/chat/completions')
    expect(plan.translate).toBe(true)
    expect(JSON.parse(plan.body)).toMatchObject({ stream: true, max_tokens: 100 })
  })

  it('maps the model listing to /v1/models as a GET', () => {
    const plan = buildUpstream({ kind: KIND_OPENAI, baseUrl: 'https://openrouter.ai/api', apiKey: 'k' }, '/api/tags', undefined)
    expect(plan.url).toBe('https://openrouter.ai/api/v1/models')
    expect(plan.isModels).toBe(true)
    expect(plan.body).toBeUndefined()
  })

  it('omits the Authorization header when there is no key (local models)', () => {
    const plan = buildUpstream({ kind: KIND_OPENAI, baseUrl: 'http://127.0.0.1:1234' }, '/api/chat', Buffer.from('{}'))
    expect(plan.headers.authorization).toBeUndefined()
  })

  // fal.ai reads a `Bearer` as a JWT and answers "Invalid token"; its API keys
  // are `<id>:<secret>` pairs sent with the `Key` scheme.
  it('uses the "Key" scheme for fal.ai and "Bearer" for everyone else', () => {
    const fal = buildUpstream(
      { kind: KIND_OPENAI, auth: 'key', baseUrl: 'https://fal.run/openrouter/router/openai', apiKey: 'id:secret' },
      '/api/chat',
      Buffer.from('{}'),
    )
    expect(fal.url).toBe('https://fal.run/openrouter/router/openai/v1/chat/completions')
    expect(fal.headers.authorization).toBe('Key id:secret')

    const other = buildUpstream({ kind: KIND_OPENAI, baseUrl: 'https://api.openai.com', apiKey: 'sk' }, '/api/chat', Buffer.from('{}'))
    expect(other.headers.authorization).toBe('Bearer sk')
  })
})
