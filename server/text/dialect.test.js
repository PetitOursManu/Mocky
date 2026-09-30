import { describe, it, expect } from 'vitest'
import {
  toOpenAiRequest,
  fromOpenAiResponse,
  fromOpenAiModels,
  createSseTranslator,
  fromOpenAiResponse,
  boundsThinking,
  buildUpstream,
  base64ImageType,
  openAiRoot,
  quirksFor,
  applyQuirks,
  PROVIDER_QUIRKS,
  KIND_OLLAMA,
  KIND_OPENAI,
} from './dialect.js'
import { TEXT_PROVIDERS } from './config.js'

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

  it('labels a JPEG or WebP attachment by its bytes, not as PNG', () => {
    const out = toOpenAiRequest({ messages: [{ role: 'user', content: 'x', images: ['/9j/4AAQ', 'UklGRiQA'] }] })
    expect(out.messages[0].content[1].image_url.url).toBe('data:image/jpeg;base64,/9j/4AAQ')
    expect(out.messages[0].content[2].image_url.url).toBe('data:image/webp;base64,UklGRiQA')
    expect(base64ImageType('iVBORw0K')).toBe('image/png')
    expect(base64ImageType('????')).toBe('image/png')
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

/**
 * Every preset lands where its vendor documents it.
 *
 * The expected URLs are written out rather than derived: the point is that a
 * change to `openAiRoot` which moves any of them fails HERE, by name, before a
 * user meets the 404. The sources are on the presets in config.js.
 */
describe('the preset URLs', () => {
  const EXPECTED = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
    mistral: 'https://api.mistral.ai/v1',
    deepseek: 'https://api.deepseek.com',
    xai: 'https://api.x.ai/v1',
    moonshot: 'https://api.moonshot.ai/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    groq: 'https://api.groq.com/openai/v1',
    together: 'https://api.together.ai/v1',
    fireworks: 'https://api.fireworks.ai/inference/v1',
    cerebras: 'https://api.cerebras.ai/v1',
    huggingface: 'https://router.huggingface.co/v1',
    fal: 'https://fal.run/openrouter/router/openai/v1',
  }
  const presets = TEXT_PROVIDERS.filter((p) => p.kind === KIND_OPENAI && p.baseUrl)

  it('has an expectation for every OpenAI-kind preset, and no stale one', () => {
    expect(presets.map((p) => p.id).sort()).toEqual(Object.keys(EXPECTED).sort())
  })

  for (const [id, root] of Object.entries(EXPECTED)) {
    it(`${id}: chat and models`, () => {
      const p = presets.find((x) => x.id === id)
      const target = { kind: KIND_OPENAI, auth: p.auth, baseUrl: p.baseUrl, apiKey: 'k' }
      const chat = buildUpstream(target, '/api/chat', Buffer.from(JSON.stringify({ model: p.model, messages: [] })))
      const models = buildUpstream(target, '/api/tags', undefined)
      expect(chat.url).toBe(`${root}/chat/completions`)
      expect(models.url).toBe(`${root}/models`)
      // A trailing slash, as pasted from a docs page, changes nothing.
      expect(buildUpstream({ ...target, baseUrl: `${p.baseUrl}/` }, '/api/tags', undefined).url).toBe(`${root}/models`)
    })
  }

  it('leaves the native Ollama preset alone', () => {
    const ollama = TEXT_PROVIDERS.find((p) => p.id === 'ollama-cloud')
    expect(buildUpstream({ kind: KIND_OLLAMA, baseUrl: ollama.baseUrl }, '/api/tags', undefined).url).toBe(
      'https://ollama.com/api/tags',
    )
  })
})

describe('a base that already ends in a version', () => {
  it('is used as it is', () => {
    expect(openAiRoot('https://api.groq.com/openai/v1')).toBe('https://api.groq.com/openai/v1')
    expect(openAiRoot('https://generativelanguage.googleapis.com/v1beta/openai/')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai',
    )
    expect(openAiRoot('https://dashscope-intl.aliyuncs.com/compatible-mode/v1')).toBe(
      'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    )
    expect(openAiRoot('https://api.cohere.ai/compatibility/v1')).toBe('https://api.cohere.ai/compatibility/v1')
    expect(openAiRoot('https://example.com/openai/v2alpha1')).toBe('https://example.com/openai/v2alpha1')
  })

  it('gets /v1 otherwise — which is every URL that worked before', () => {
    // What the old rule produced for these, byte for byte.
    for (const base of [
      'https://api.openai.com',
      'https://openrouter.ai/api',
      'https://api.anthropic.com',
      'https://fal.run/openrouter/router/openai', // `openai` after a NON-version
      'http://127.0.0.1:1234',
      'https://api.groq.com/openai',
      'https://api.fireworks.ai/inference',
      'https://v1.example.com', // a version in the HOST is not in the path
      'not a url',
    ]) {
      expect(openAiRoot(base), base).toBe(`${base}/v1`)
    }
  })

  it('no longer doubles the /v1 a user pasted into "Compatible OpenAI"', () => {
    const plan = buildUpstream({ kind: KIND_OPENAI, baseUrl: 'https://api.groq.com/openai/v1' }, '/api/chat', Buffer.from('{}'))
    expect(plan.url).toBe('https://api.groq.com/openai/v1/chat/completions')
  })

  it('adds nothing at the root of a vendor documented there, and only at the root', () => {
    expect(openAiRoot('https://api.deepseek.com')).toBe('https://api.deepseek.com')
    expect(openAiRoot('https://api.deepseek.com/v1')).toBe('https://api.deepseek.com/v1')
    // A path someone chose is theirs: the usual rule applies to it.
    expect(openAiRoot('https://api.deepseek.com/proxy')).toBe('https://api.deepseek.com/proxy/v1')
  })
})

describe('provider quirks', () => {
  const GEN = { model: 'm', messages: [{ role: 'user', content: 'hi' }], stream: true, options: { temperature: 0.4, num_predict: 16384 }, format: { type: 'object' } }
  const bodyAt = (baseUrl, model = 'm') =>
    JSON.parse(buildUpstream({ kind: KIND_OPENAI, baseUrl, apiKey: 'k' }, '/api/chat', Buffer.from(JSON.stringify({ ...GEN, model }))).body)

  it('changes nothing for a host no row names — byte-identical to before', () => {
    for (const base of ['https://api.openai.com', 'https://api.anthropic.com', 'https://fal.run/openrouter/router/openai', 'https://api.groq.com/openai/v1']) {
      const plan = buildUpstream({ kind: KIND_OPENAI, baseUrl: base }, '/api/chat', Buffer.from(JSON.stringify(GEN)))
      expect(plan.body, base).toBe(JSON.stringify(toOpenAiRequest(GEN)))
      expect(plan.quirks).toBeNull()
    }
  })

  it('bounds Gemini’s thinking, on Gemini models only', () => {
    const base = 'https://generativelanguage.googleapis.com/v1beta/openai'
    expect(bodyAt(base, 'gemini-3.8-flash').reasoning_effort).toBe('low')
    expect(bodyAt(base, 'models/gemini-3.8-flash').reasoning_effort).toBe('low')
    expect(bodyAt(base, 'gemma-4-31b-it').reasoning_effort).toBeUndefined()
    expect(bodyAt(base, 'gemini-3.8-flash')).toMatchObject({ max_tokens: 16384, temperature: 0.4 })
    expect(bodyAt(base).response_format.type).toBe('json_schema')
  })

  it('downgrades structured output to JSON mode at DeepSeek', () => {
    const body = bodyAt('https://api.deepseek.com')
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.max_tokens).toBe(16384)
    // A plain request has no response_format to downgrade.
    const plain = JSON.parse(
      buildUpstream({ kind: KIND_OPENAI, baseUrl: 'https://api.deepseek.com' }, '/api/chat', Buffer.from(JSON.stringify({ model: 'm', messages: [] }))).body,
    )
    expect(plain.response_format).toBeUndefined()
  })

  it('never sends Kimi a temperature, and names the token field its way', () => {
    const body = bodyAt('https://api.moonshot.ai/v1', 'kimi-k3')
    expect(body.temperature).toBeUndefined()
    expect(body.max_tokens).toBeUndefined()
    expect(body.max_completion_tokens).toBe(16384)
    expect(body.reasoning_effort).toBe('low')
    expect(bodyAt('https://api.moonshot.ai/v1', 'kimi-k2.7-code').reasoning_effort).toBeUndefined()
  })

  it('uses xAI’s current token field', () => {
    const body = bodyAt('https://api.x.ai/v1', 'grok-4.7')
    expect(body).toMatchObject({ max_completion_tokens: 16384, temperature: 0.4 })
    expect(body.max_tokens).toBeUndefined()
  })

  it('matches the host and its subdomains, never a lookalike', () => {
    expect(quirksFor('https://api.x.ai/v1')?.hosts).toContain('api.x.ai')
    expect(quirksFor('https://eu.api.x.ai/v1')?.hosts).toContain('api.x.ai')
    expect(quirksFor('https://api.x.ai.evil.example/v1')).toBeNull()
    expect(quirksFor('https://example.com/api.deepseek.com')).toBeNull()
    expect(quirksFor('not a url')).toBeNull()
  })

  it('clamps max_tokens when a row says so, before renaming it', () => {
    expect(applyQuirks({ max_tokens: 16384 }, { hosts: [], maxTokens: 8192 })).toEqual({ max_tokens: 8192 })
    expect(applyQuirks({ max_tokens: 1024 }, { hosts: [], maxTokens: 8192 })).toEqual({ max_tokens: 1024 })
    expect(applyQuirks({ max_tokens: 16384 }, { hosts: [], maxTokens: 8192, maxTokensField: 'max_completion_tokens' })).toEqual({
      max_completion_tokens: 8192,
    })
    // Pure: the input is not touched.
    const input = { max_tokens: 16384, temperature: 1 }
    applyQuirks(input, { hosts: [], drop: ['temperature'], maxTokens: 1 })
    expect(input).toEqual({ max_tokens: 16384, temperature: 1 })
  })

  it('clamps Cohere per model, and downgrades its structured output', () => {
    const base = 'https://api.cohere.ai/compatibility/v1'
    expect(bodyAt(base, 'command-a-03-2025').max_tokens).toBe(8192)
    expect(bodyAt(base, 'command-a-vision-07-2025').max_tokens).toBe(8192)
    expect(bodyAt(base, 'command-r-plus-08-2024').max_tokens).toBe(4096)
    // The current models accept more than a generation asks for: left alone.
    expect(bodyAt(base, 'command-a-plus-05-2026').max_tokens).toBe(16384)
    expect(bodyAt(base, 'command-a-reasoning-08-2025').max_tokens).toBe(16384)
    expect(bodyAt(base, 'command-a-03-2025').response_format).toEqual({ type: 'json_object' })
    expect(bodyAt('https://api.cohere.com/compatibility/v1', 'command-r7b-12-2024').max_tokens).toBe(4096)
  })

  it('every row names its hosts in lower case and uses only known fields', () => {
    const KNOWN = new Set(['hosts', 'root', 'drop', 'maxTokens', 'maxTokensField', 'jsonSchema', 'effort', 'stripModelPrefix'])
    for (const row of PROVIDER_QUIRKS) {
      expect(row.hosts.length).toBeGreaterThan(0)
      for (const h of row.hosts) expect(h).toBe(h.toLowerCase())
      for (const key of Object.keys(row)) expect(KNOWN.has(key), key).toBe(true)
    }
  })
})

describe('model listings', () => {
  it('strips Gemini’s models/ prefix, since the bare id is what a request takes', () => {
    const plan = buildUpstream({ kind: KIND_OPENAI, baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' }, '/api/tags', undefined)
    const json = { object: 'list', data: [{ id: 'models/gemini-3.8-flash' }, { id: 'models/gemini-3.1-pro-preview' }] }
    expect(fromOpenAiModels(json, plan.quirks).models.map((m) => m.name)).toEqual(['gemini-3.8-flash', 'gemini-3.1-pro-preview'])
  })

  it('leaves every other listing as it was', () => {
    const json = { data: [{ id: 'models/x' }, { id: 'openai/gpt-oss-120b' }] }
    expect(fromOpenAiModels(json).models.map((m) => m.name)).toEqual(['models/x', 'openai/gpt-oss-120b'])
  })

  it('reads a listing that is a bare array (Together)', () => {
    expect(fromOpenAiModels([{ id: 'openai/gpt-oss-120b' }, { id: '' }]).models).toEqual([{ name: 'openai/gpt-oss-120b' }])
  })
})
