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

describe('mergeTextConfig', () => {
  it('defaults to "no instance provider" so per-browser Settings keep working', () => {
    expect(defaultTextConfig().provider).toBe('')
  })

  it('accepts a known provider, ignores an unknown one, and allows clearing', () => {
    expect(mergeTextConfig(null, { provider: 'openrouter' }).provider).toBe('openrouter')
    expect(mergeTextConfig(null, { provider: 'evil' }).provider).toBe('')
    const set = mergeTextConfig(null, { provider: 'openai' })
    expect(mergeTextConfig(set, { provider: '' }).provider).toBe('') // back to per-user
  })

  it('keeps a stored key on a partial update and clears it on null', () => {
    const withKey = mergeTextConfig(null, { openai: { apiKey: 'sk-secret' } })
    expect(mergeTextConfig(withKey, { openai: { model: 'gpt-4o' } }).openai.apiKey).toBe('sk-secret')
    expect(mergeTextConfig(withKey, { openai: { apiKey: '' } }).openai.apiKey).toBe('sk-secret')
    expect(mergeTextConfig(withKey, { openai: { apiKey: null } }).openai.apiKey).toBe('')
  })

  it('keeps each provider’s settings independent', () => {
    let c = mergeTextConfig(null, { openai: { apiKey: 'sk-a', model: 'gpt-4o' } })
    c = mergeTextConfig(c, { openrouter: { apiKey: 'or-b', model: 'meta/llama' } })
    expect(c.openai.apiKey).toBe('sk-a')
    expect(c.openrouter.model).toBe('meta/llama')
  })
})

describe('publicTextConfig', () => {
  it('never exposes a key', () => {
    const cfg = mergeTextConfig(null, {
      provider: 'openai',
      openai: { apiKey: 'sk-secret' },
      openrouter: { apiKey: 'or-secret' },
    })
    const view = publicTextConfig(cfg)
    const s = JSON.stringify(view)
    expect(s).not.toContain('sk-secret')
    expect(s).not.toContain('or-secret')
    expect(view.openai.hasApiKey).toBe(true)
    expect(view.provider).toBe('openai')
    expect(view.providers.map((p) => p.id)).toContain('openrouter')
  })
})

describe('resolveTextTarget', () => {
  it('returns null when nothing is configured (fall back to the browser)', () => {
    expect(resolveTextTarget(defaultTextConfig())).toBeNull()
  })

  it('returns the ollama kind for Ollama Cloud', () => {
    const t = resolveTextTarget(mergeTextConfig(null, { provider: 'ollama-cloud', 'ollama-cloud': { apiKey: 'k' } }))
    expect(t).toMatchObject({ kind: 'ollama', baseUrl: 'https://ollama.com', model: 'gpt-oss:120b', apiKey: 'k' })
  })

  it('returns the openai kind for OpenAI/OpenRouter/compatible', () => {
    expect(resolveTextTarget(mergeTextConfig(null, { provider: 'openai' })).kind).toBe('openai')
    expect(resolveTextTarget(mergeTextConfig(null, { provider: 'openrouter' })).baseUrl).toBe('https://openrouter.ai/api')
  })

  it('returns null when the selection is incomplete (never hijacks a request)', () => {
    // openai-compatible ships with no baseUrl/model — must not take over.
    expect(resolveTextTarget(mergeTextConfig(null, { provider: 'openai-compatible' }))).toBeNull()
    const partial = mergeTextConfig(null, { provider: 'openai-compatible', 'openai-compatible': { baseUrl: 'http://x' } })
    expect(resolveTextTarget(partial)).toBeNull() // still no model
  })

  it('allows a keyless local endpoint', () => {
    const t = resolveTextTarget(
      mergeTextConfig(null, { provider: 'openai-compatible', 'openai-compatible': { baseUrl: 'http://127.0.0.1:1234', model: 'local' } }),
    )
    expect(t).toMatchObject({ baseUrl: 'http://127.0.0.1:1234', model: 'local', apiKey: '' })
  })
})

describe('TextConfigStore', () => {
  it('persists and reloads from disk', () => {
    const s1 = new TextConfigStore(dir)
    s1.update({ provider: 'openai', openai: { apiKey: 'sk-1' } })
    const s2 = new TextConfigStore(dir)
    expect(s2.get().provider).toBe('openai')
    expect(s2.target()).toMatchObject({ kind: 'openai', apiKey: 'sk-1' })
  })

  it('reload() picks up an external write (dev proxy shares the file)', () => {
    const s = new TextConfigStore(dir)
    expect(s.target()).toBeNull()
    fs.writeFileSync(path.join(dir, 'text-config.json'), JSON.stringify({ provider: 'openai', openai: { baseUrl: 'https://api.openai.com', model: 'gpt-4o', apiKey: 'k' } }))
    s.reload()
    expect(s.target()).toMatchObject({ model: 'gpt-4o' })
  })

  it('never throws when the path is unwritable', () => {
    const asFile = path.join(dir, 'afile')
    fs.writeFileSync(asFile, 'x')
    const s = new TextConfigStore(asFile)
    expect(() => s.update({ provider: 'openai' })).not.toThrow()
    expect(s.get().provider).toBe('openai')
  })
})
