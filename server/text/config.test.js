import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { TextConfigStore, mergeTextConfig, publicTextConfig, resolveTextTarget, defaultTextConfig } from './config.js'

let dir
beforeEach(() => {
  dir = path.join(os.tmpdir(), `mocky-textcfg-${crypto.randomBytes(6).toString('hex')}`)
  fs.mkdirSync(dir, { recursive: true })
})
afterEach(() => {
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
})

/** Shorthand: a patch aimed at the generation profile. */
const gen = (patch) => ({ generation: patch })

describe('mergeTextConfig', () => {
  it('defaults both profiles to "no instance provider" so per-browser Settings keep working', () => {
    expect(defaultTextConfig().generation.provider).toBe('')
    expect(defaultTextConfig().inspiration.provider).toBe('')
  })

  it('accepts a known provider, ignores an unknown one, and allows clearing', () => {
    expect(mergeTextConfig(null, gen({ provider: 'openrouter' })).generation.provider).toBe('openrouter')
    expect(mergeTextConfig(null, gen({ provider: 'evil' })).generation.provider).toBe('')
    const set = mergeTextConfig(null, gen({ provider: 'openai' }))
    expect(mergeTextConfig(set, gen({ provider: '' })).generation.provider).toBe('') // back to per-user
  })

  it('keeps a stored key on a partial update and clears it on null', () => {
    const withKey = mergeTextConfig(null, gen({ openai: { apiKey: 'sk-secret' } }))
    expect(mergeTextConfig(withKey, gen({ openai: { model: 'gpt-4o' } })).generation.openai.apiKey).toBe('sk-secret')
    expect(mergeTextConfig(withKey, gen({ openai: { apiKey: '' } })).generation.openai.apiKey).toBe('sk-secret')
    expect(mergeTextConfig(withKey, gen({ openai: { apiKey: null } })).generation.openai.apiKey).toBe('')
  })

  it('keeps each provider’s settings independent', () => {
    let c = mergeTextConfig(null, gen({ openai: { apiKey: 'sk-a', model: 'gpt-4o' } }))
    c = mergeTextConfig(c, gen({ openrouter: { apiKey: 'or-b', model: 'meta/llama' } }))
    expect(c.generation.openai.apiKey).toBe('sk-a')
    expect(c.generation.openrouter.model).toBe('meta/llama')
  })

  it('keeps the two profiles independent', () => {
    let c = mergeTextConfig(null, gen({ provider: 'openai', openai: { apiKey: 'sk-gen' } }))
    c = mergeTextConfig(c, { inspiration: { provider: 'openrouter', openrouter: { apiKey: 'or-insp', model: 'qwen/vl' } } })
    expect(c.generation.provider).toBe('openai')
    expect(c.generation.openai.apiKey).toBe('sk-gen')
    expect(c.inspiration.provider).toBe('openrouter')
    expect(c.inspiration.openrouter.apiKey).toBe('or-insp')
    // Writing one profile must not touch the other's key.
    expect(c.inspiration.openai.apiKey).toBe('')
  })

  it('lifts a legacy single-profile config into `generation`', () => {
    const legacy = { provider: 'openai', openai: { baseUrl: 'https://api.openai.com', model: 'gpt-4o', apiKey: 'sk-old' } }
    const c = mergeTextConfig(null, legacy)
    expect(c.generation.provider).toBe('openai')
    expect(c.generation.openai.apiKey).toBe('sk-old')
    expect(c.inspiration.provider).toBe('')
  })
})

describe('publicTextConfig', () => {
  it('never exposes a key, for either profile', () => {
    const cfg = mergeTextConfig(null, {
      generation: { provider: 'openai', openai: { apiKey: 'sk-secret' } },
      inspiration: { provider: 'openrouter', openrouter: { apiKey: 'or-secret' } },
    })
    const view = publicTextConfig(cfg)
    const s = JSON.stringify(view)
    expect(s).not.toContain('sk-secret')
    expect(s).not.toContain('or-secret')
    expect(view.generation.openai.hasApiKey).toBe(true)
    expect(view.inspiration.openrouter.hasApiKey).toBe(true)
    expect(view.generation.provider).toBe('openai')
    expect(view.inspiration.provider).toBe('openrouter')
    expect(view.providers.map((p) => p.id)).toContain('openrouter')
    expect(view.profiles).toEqual(['generation', 'inspiration'])
  })
})

describe('resolveTextTarget', () => {
  it('returns null when nothing is configured (fall back to the browser)', () => {
    expect(resolveTextTarget(defaultTextConfig())).toBeNull()
    expect(resolveTextTarget(defaultTextConfig(), 'inspiration')).toBeNull()
  })

  it('returns the ollama kind for Ollama Cloud', () => {
    const t = resolveTextTarget(mergeTextConfig(null, gen({ provider: 'ollama-cloud', 'ollama-cloud': { apiKey: 'k' } })))
    expect(t).toMatchObject({ id: 'ollama-cloud', kind: 'ollama', baseUrl: 'https://ollama.com', model: 'gpt-oss:120b', apiKey: 'k' })
  })

  it('returns the openai kind for OpenAI/OpenRouter/compatible', () => {
    expect(resolveTextTarget(mergeTextConfig(null, gen({ provider: 'openai' }))).kind).toBe('openai')
    expect(resolveTextTarget(mergeTextConfig(null, gen({ provider: 'openrouter' }))).baseUrl).toBe('https://openrouter.ai/api')
  })

  it('returns null when the selection is incomplete (never hijacks a request)', () => {
    // openai-compatible ships with no baseUrl/model — must not take over.
    expect(resolveTextTarget(mergeTextConfig(null, gen({ provider: 'openai-compatible' })))).toBeNull()
    const partial = mergeTextConfig(null, gen({ provider: 'openai-compatible', 'openai-compatible': { baseUrl: 'http://x' } }))
    expect(resolveTextTarget(partial)).toBeNull() // still no model
  })

  it('allows a keyless local endpoint', () => {
    const t = resolveTextTarget(
      mergeTextConfig(null, gen({ provider: 'openai-compatible', 'openai-compatible': { baseUrl: 'http://127.0.0.1:1234', model: 'local' } })),
    )
    expect(t).toMatchObject({ baseUrl: 'http://127.0.0.1:1234', model: 'local', apiKey: '' })
  })

  it('inspiration falls back to generation until it is configured', () => {
    const onlyGen = mergeTextConfig(null, gen({ provider: 'openai', openai: { model: 'gpt-4o' } }))
    expect(resolveTextTarget(onlyGen, 'inspiration')).toMatchObject({ model: 'gpt-4o' })

    const both = mergeTextConfig(onlyGen, { inspiration: { provider: 'openrouter', openrouter: { model: 'qwen/vl' } } })
    expect(resolveTextTarget(both, 'inspiration')).toMatchObject({ model: 'qwen/vl' })
    expect(resolveTextTarget(both, 'generation')).toMatchObject({ model: 'gpt-4o' }) // unchanged
  })

  it('an unknown profile name resolves as generation', () => {
    const c = mergeTextConfig(null, gen({ provider: 'openai', openai: { model: 'gpt-4o' } }))
    expect(resolveTextTarget(c, 'nope')).toMatchObject({ model: 'gpt-4o' })
  })
})

describe('TextConfigStore', () => {
  it('persists and reloads from disk', () => {
    const s1 = new TextConfigStore(dir)
    s1.update(gen({ provider: 'openai', openai: { apiKey: 'sk-1' } }))
    const s2 = new TextConfigStore(dir)
    expect(s2.get().generation.provider).toBe('openai')
    expect(s2.target()).toMatchObject({ kind: 'openai', apiKey: 'sk-1' })
  })

  it('keeps a pre-upgrade config file working (lifted into `generation`)', () => {
    fs.writeFileSync(
      path.join(dir, 'text-config.json'),
      JSON.stringify({ provider: 'openrouter', openrouter: { baseUrl: 'https://openrouter.ai/api', model: 'x/y', apiKey: 'k' } }),
    )
    const s = new TextConfigStore(dir)
    expect(s.target()).toMatchObject({ model: 'x/y', apiKey: 'k' })
    expect(s.target('inspiration')).toMatchObject({ model: 'x/y' }) // falls back
  })

  it('reload() picks up an external write (dev proxy shares the file)', () => {
    const s = new TextConfigStore(dir)
    expect(s.target()).toBeNull()
    fs.writeFileSync(path.join(dir, 'text-config.json'), JSON.stringify(gen({ provider: 'openai', openai: { baseUrl: 'https://api.openai.com', model: 'gpt-4o', apiKey: 'k' } })))
    s.reload()
    expect(s.target()).toMatchObject({ model: 'gpt-4o' })
  })

  it('resolves a separate inspiration model', () => {
    const s = new TextConfigStore(dir)
    s.update(gen({ provider: 'openai', openai: { model: 'gpt-4o', apiKey: 'sk-1' } }))
    s.update({ inspiration: { provider: 'openrouter', openrouter: { model: 'qwen/qwen3.5-flash', apiKey: 'or-1' } } })
    expect(s.target('generation')).toMatchObject({ model: 'gpt-4o', apiKey: 'sk-1' })
    expect(s.target('inspiration')).toMatchObject({ model: 'qwen/qwen3.5-flash', apiKey: 'or-1' })
  })

  it('never throws when the path is unwritable', () => {
    const asFile = path.join(dir, 'afile')
    fs.writeFileSync(asFile, 'x')
    const s = new TextConfigStore(asFile)
    expect(() => s.update(gen({ provider: 'openai' }))).not.toThrow()
    expect(s.get().generation.provider).toBe('openai')
  })
})
