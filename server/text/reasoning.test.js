import { describe, it, expect } from 'vitest'
import { applyReasoning, buildUpstream, readReasoning, reasoningSupported, withOllamaReasoning } from './dialect.js'
import { mergeTextConfig, publicTextConfig, resolveTextTarget } from './config.js'

const body = (b) => JSON.parse(b)

describe('a chosen level of thinking', () => {
  it('reads strictly: anything unknown is auto', () => {
    expect(readReasoning('high')).toBe('high')
    expect(readReasoning('max')).toBe('auto')
    expect(readReasoning(undefined)).toBe('auto')
  })

  it('auto changes nothing, on either dialect', () => {
    const raw = Buffer.from(JSON.stringify({ model: 'gpt-oss:120b', messages: [] }))
    expect(withOllamaReasoning(raw, '/api/chat', 'https://ollama.com', 'auto')).toBe(raw)
    const a = buildUpstream({ kind: 'openai', baseUrl: 'https://api.openai.com' }, '/api/chat', Buffer.from('{"model":"gpt-5"}'))
    expect(body(a.body).reasoning_effort).toBeUndefined()
  })

  it('Ollama: levels for gpt-oss, true/false elsewhere', () => {
    expect(applyReasoning({ model: 'gpt-oss:120b' }, 'ollama', '', 'high').think).toBe('high')
    expect(applyReasoning({ model: 'qwen3:32b' }, 'ollama', '', 'high').think).toBe(true)
    expect(applyReasoning({ model: 'qwen3:32b' }, 'ollama', '', 'off').think).toBe(false)
  })

  it('OpenAI-shaped: only on the models that reason, off becomes the least accepted', () => {
    const call = (baseUrl, model, level) =>
      body(buildUpstream({ kind: 'openai', baseUrl, reasoning: level }, '/api/chat', Buffer.from(JSON.stringify({ model }))).body)
    expect(call('https://api.openai.com', 'gpt-5', 'high').reasoning_effort).toBe('high')
    expect(call('https://api.openai.com', 'gpt-5', 'off').reasoning_effort).toBe('minimal')
    expect(call('https://api.openai.com', 'gpt-4o-mini', 'high').reasoning_effort).toBeUndefined()
    expect(call('https://generativelanguage.googleapis.com/v1beta/openai', 'gemini-3.8-flash', 'off').reasoning_effort).toBe('none')
    expect(call('https://generativelanguage.googleapis.com/v1beta/openai', 'gemini-3-pro', 'off').reasoning_effort).toBe('low')
    expect(call('https://openrouter.ai/api', 'x/y', 'medium').reasoning).toEqual({ effort: 'medium' })
    expect(call('https://openrouter.ai/api', 'x/y', 'off').reasoning).toEqual({ enabled: false })
    // Anthropic: not handled yet (decided with the user).
    expect(call('https://api.anthropic.com', 'claude-sonnet-5-5', 'high').reasoning_effort).toBeUndefined()
    expect(reasoningSupported('openai', 'https://api.anthropic.com', 'claude-sonnet-5-5')).toBe(false)
  })

  it('an admin profile keeps its level, and an older config reads as auto', () => {
    const old = mergeTextConfig({}, { generation: { provider: 'openai', openai: { apiKey: 'k' } } })
    expect(resolveTextTarget(old).reasoning).toBeUndefined()
    const cfg = mergeTextConfig(old, { generation: { reasoning: 'high' } })
    expect(resolveTextTarget(cfg).reasoning).toBe('high')
    expect(publicTextConfig(cfg).generation.reasoning).toBe('high')
    expect(mergeTextConfig(cfg, { generation: { provider: 'openai' } }).generation.reasoning).toBe('high')
  })
})
