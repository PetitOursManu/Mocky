import { describe, it, expect } from 'vitest'
import { browserVisionTarget, probeVision } from './vision.js'

const req = (headers, body = { model: 'gemini-3.8-flash' }) => ({ headers, body })

describe('browserVisionTarget', () => {
  it('reads the dialect off x-provider-kind, as /__provider does', () => {
    const t = browserVisionTarget(
      req({
        'x-provider-base': 'https://generativelanguage.googleapis.com/v1beta/openai/',
        'x-provider-kind': 'openai',
        authorization: 'Bearer k',
      }),
    )
    expect(t).toEqual({ kind: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: 'k', model: 'gemini-3.8-flash' })
  })

  it('stays Ollama when the kind is absent or unknown', () => {
    expect(browserVisionTarget(req({ 'x-provider-base': 'https://ollama.com' }))?.kind).toBe('ollama')
    expect(browserVisionTarget(req({ 'x-provider-base': 'https://ollama.com', 'x-provider-kind': 'weird' }))?.kind).toBe('ollama')
  })

  it('is null without a base URL or a model', () => {
    expect(browserVisionTarget(req({}))).toBeNull()
    expect(browserVisionTarget(req({ 'x-provider-base': 'https://ollama.com' }, {}))).toBeNull()
  })
})

describe('probeVision on a browser OpenAI-dialect target', () => {
  it('posts to <root>/chat/completions, not <base>/api/chat', async () => {
    const urls = []
    const target = browserVisionTarget(
      req({ 'x-provider-base': 'https://generativelanguage.googleapis.com/v1beta/openai', 'x-provider-kind': 'openai' }),
    )
    const res = await probeVision(target, {
      force: true,
      fetchImpl: async (url) => {
        urls.push(url)
        return { ok: true }
      },
    })
    expect(res).toEqual({ vision: true })
    expect(urls).toEqual(['https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'])
  })
})

describe('probeVision never follows a redirect, and caches only answers about the model', () => {
  const base = { kind: 'openai', baseUrl: 'https://probe.example', model: 'm' }

  it('asks fetch not to follow, and never echoes a redirect body', async () => {
    let init
    const res = await probeVision(
      { ...base, apiKey: 'redirect' },
      {
        force: true,
        fetchImpl: async (_url, i) => {
          init = i
          return { ok: false, status: 302, text: async () => 'SECRET FROM 169.254.169.254' }
        },
      },
    )
    expect(init.redirect).toBe('manual')
    expect(res).toEqual({ vision: false, error: 'redirect not followed' })
  })

  it('does not cache an auth failure, so a corrected key is probed again', async () => {
    let calls = 0
    const fetchImpl = async () => {
      calls++
      return calls === 1 ? { ok: false, status: 401, text: async () => 'bad key' } : { ok: true, status: 200 }
    }
    const t = { ...base, model: 'auth-retry', apiKey: 'k1' }
    expect((await probeVision(t, { fetchImpl })).vision).toBe(false)
    expect((await probeVision(t, { fetchImpl })).vision).toBe(true)
    expect(calls).toBe(2)
  })

  it('keeps one credential’s answer away from another credential', async () => {
    const seen = []
    const fetchImpl = async (_url, i) => {
      seen.push(i.headers.authorization)
      return { ok: false, status: 400, text: async () => 'model does not support images' }
    }
    await probeVision({ ...base, model: 'per-key', apiKey: 'a' }, { fetchImpl })
    await probeVision({ ...base, model: 'per-key', apiKey: 'a' }, { fetchImpl })
    await probeVision({ ...base, model: 'per-key', apiKey: 'b' }, { fetchImpl })
    expect(seen.length).toBe(2)
  })
})
