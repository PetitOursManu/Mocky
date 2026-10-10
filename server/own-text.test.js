import { describe, it, expect } from 'vitest'
import { cleanOwnText, ownKeysAllowed, ownTextView, usesOwnText } from './own-text.js'

describe('an account on its own key', () => {
  it('keeps the provider id and the model name, and nothing that could be a key', () => {
    const own = cleanOwnText({ provider: 'openrouter', model: 'openai/gpt-4o-mini', apiKey: 'sk-secret' }, 42)
    expect(own).toEqual({ provider: 'openrouter', model: 'openai/gpt-4o-mini', at: 42 })
    expect(JSON.stringify(own)).not.toContain('sk-secret')
  })

  it('refuses a provider a person cannot choose, and drops a model that is not an id', () => {
    expect(cleanOwnText({ provider: 'nope', model: 'x' })).toBeNull()
    // fal authenticates with `Key`: the browser transport cannot speak it.
    expect(cleanOwnText({ provider: 'fal', model: 'x' })).toBeNull()
    expect(cleanOwnText({ provider: 'ollama-cloud', model: '<script>' }).model).toBe('')
    expect(cleanOwnText({ provider: 'ollama-cloud', model: 'gpt-oss:120b' }).model).toBe('gpt-oss:120b')
  })

  it('is honoured only while the administrator allows personal keys', () => {
    const user = { ownText: { provider: 'openai', model: 'gpt-4o-mini', at: 1 } }
    expect(ownKeysAllowed({})).toBe(true)
    expect(usesOwnText(user, {})).toBe(true)
    expect(usesOwnText(user, { ownKeys: false })).toBe(false)
    expect(usesOwnText({}, {})).toBe(false)
    expect(ownTextView(user, {})).toEqual({ provider: 'openai', model: 'gpt-4o-mini' })
    expect(ownTextView(user, { ownKeys: false })).toBeNull()
  })
})
