import { describe, it, expect } from 'vitest'
import {
  toOpenAiRequest,
  fromOpenAiResponse,
  fromOpenAiModels,
  createSseTranslator,
  fromOpenAiResponse,
  boundsThinking,
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

/**
 * Why a run produced nothing.
 *
 * A model switch (Luna → a "Flash" reasoning model on OpenRouter) produced
 * generation after generation with no output and one message: "the model
 * returned an empty response". It is true of every cause and useful for none —
 * the thinking that replaced the answer and the refusal the provider put in the
 * body of a 200 were both dropped by this translator, which read `content` and
 * nothing else.
 */
describe('what a silent stream was made of', () => {
  it('counts thinking without ever forwarding it as content', () => {
    const t = createSseTranslator()
    const out = t(
      'data: {"choices":[{"delta":{"reasoning":"Let me think about the layout…"}}]}\n\n' +
        'data: {"choices":[{"delta":{"reasoning_content":"still thinking"}}]}\n\n',
    )
    // Nothing is emitted: a component extracted from a chain of thought is not
    // a component.
    expect(out).toBe('')
    expect(t.state.reasoned).toBe('Let me think about the layout…'.length + 'still thinking'.length)
    expect(t.state.content).toBe(0)
  })

  it('reads a structured reasoning trace too', () => {
    const t = createSseTranslator()
    t('data: {"choices":[{"delta":{"reasoning_details":[{"text":"abcd"},{"text":"ef"}]}}]}\n\n')
    expect(t.state.reasoned).toBe(6)
  })

  it('states a refusal the provider put inside a 200', () => {
    const t = createSseTranslator()
    const out = t('data: {"error":{"message":"Insufficient credits","code":402}}\n\n')
    const line = JSON.parse(out.trim())
    expect(line.error).toBe('Insufficient credits (402)')
    expect(line.done).toBe(true)
    expect(t.state.error).toBe('Insufficient credits (402)')
  })

  it('still counts the content when the model does answer', () => {
    const t = createSseTranslator()
    t('data: {"choices":[{"delta":{"reasoning":"hmm"}}]}\n\ndata: {"choices":[{"delta":{"content":"export"}}]}\n\n')
    expect(t.state.content).toBe('export'.length)
    expect(t.state.reasoned).toBe(3)
  })
})

describe('fromOpenAiResponse, when there is nothing to show', () => {
  it('carries the thinking that replaced the answer', () => {
    const out = fromOpenAiResponse({
      choices: [{ message: { content: '', reasoning: '12345' }, finish_reason: 'length' }],
    })
    expect(out.message.content).toBe('')
    expect(out.reasoned).toBe(5)
    expect(out.done_reason).toBe('length')
  })

  it('carries a refusal that arrived with a 200', () => {
    expect(fromOpenAiResponse({ error: { message: 'Rate limited', code: 429 } }).error).toBe('Rate limited (429)')
    expect(fromOpenAiResponse({ error: 'plain string' }).error).toBe('plain string')
  })

  it('adds neither when the model simply answered', () => {
    const out = fromOpenAiResponse({ choices: [{ message: { content: 'hello' } }] })
    expect(out.reasoned).toBeUndefined()
    expect(out.error).toBeUndefined()
  })
})

/**
 * The thinking budget, asked of one vendor only.
 *
 * A reasoning model answered a real generation with 110 220 characters of
 * thinking and no code, while `max_tokens` bounded nothing — the vendor does
 * not count reasoning against it. `reasoning` is OpenRouter's parameter for
 * exactly that, and sending it anywhere else is how you 400 every OpenAI user
 * to fix one OpenRouter user.
 */
describe('a budget for thinking', () => {
  const bodyOf = (baseUrl) =>
    JSON.parse(
      buildUpstream(
        { kind: KIND_OPENAI, baseUrl, apiKey: 'k' },
        '/api/chat',
        Buffer.from(JSON.stringify({ model: 'm', messages: [], options: { num_predict: 16384 } })),
      ).body,
    )

  it('bounds it at OpenRouter, where the parameter is defined', () => {
    expect(bodyOf('https://openrouter.ai/api').reasoning).toEqual({ effort: 'low' })
    expect(bodyOf('https://OpenRouter.ai/api/').reasoning).toEqual({ effort: 'low' })
  })

  it('sends nothing of the kind anywhere else', () => {
    // api.openai.com answers 400 to a body key it does not know.
    expect(bodyOf('https://api.openai.com').reasoning).toBeUndefined()
    expect(bodyOf('https://api.groq.com/openai').reasoning).toBeUndefined()
    expect(bodyOf('http://localhost:1234/v1').reasoning).toBeUndefined()
    expect(bodyOf('not a url').reasoning).toBeUndefined()
  })

  it('leaves the rest of the request exactly as it was', () => {
    const body = bodyOf('https://openrouter.ai/api')
    expect(body).toMatchObject({ model: 'm', max_tokens: 16384 })
  })

  it('recognises the host and not a lookalike', () => {
    expect(boundsThinking('https://openrouter.ai')).toBe(true)
    expect(boundsThinking('https://gateway.openrouter.ai')).toBe(true)
    // The check is on the HOST: a path or a query saying "openrouter" is not it.
    expect(boundsThinking('https://example.com/openrouter.ai')).toBe(false)
    expect(boundsThinking('https://openrouter.ai.evil.example')).toBe(false)
  })
})
