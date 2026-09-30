// The provider list exists twice, by hand, like the other mirrors in this
// repository: PROVIDERS in src/lib/settings.ts (a user's own key, in the
// browser) and TEXT_PROVIDERS in server/text/config.js (the admin's instance
// profile). `node server/index.js` cannot import a .ts file, so neither can be
// derived from the other — and the two drifting is not hypothetical: a preset
// that exists on one side only is a vendor the admin can pick and the user
// cannot, or one whose default model differs depending on who typed the key.
//
// fal is the one deliberate difference: its `Key <id>:<secret>` scheme cannot
// ride the Bearer header lib/proxy.ts sends, so it is server-only. Labels are
// not compared either: "Compatible OpenAI" names LM Studio for the admin (a
// trusted endpoint may be local) and not for the browser (the SSRF guard
// refuses localhost there).
import { describe, it, expect } from 'vitest'
import { TEXT_PROVIDERS } from '../server/text/config.js'
import { PROVIDERS } from '../src/lib/settings'

const SERVER_ONLY = new Set(['fal'])

const server = TEXT_PROVIDERS.filter((p) => !SERVER_ONLY.has(p.id)).map((p) => ({
  id: p.id,
  group: p.group,
  kind: p.kind,
  baseUrl: p.baseUrl,
  model: p.model,
}))
const browser = PROVIDERS.map((p) => ({
  id: p.id,
  group: p.group,
  kind: p.kind,
  baseUrl: p.defaultBaseUrl,
  model: p.defaultModel,
}))

describe('the two provider lists', () => {
  it('offer the same providers, in the same order, with the same defaults', () => {
    expect(browser).toEqual(server)
  })

  it('keep "Compatible OpenAI" last on both sides', () => {
    expect(PROVIDERS[PROVIDERS.length - 1].id).toBe('openai-compatible')
    expect(TEXT_PROVIDERS[TEXT_PROVIDERS.length - 1].id).toBe('openai-compatible')
  })

  it('keep Ollama Cloud first in the browser, where it is the fresh default', () => {
    expect(PROVIDERS[0].id).toBe('ollama-cloud')
  })

  it('only list server-only entries that exist', () => {
    for (const id of SERVER_ONLY) expect(TEXT_PROVIDERS.some((p) => p.id === id)).toBe(true)
  })

  it('give every browser preset but the hand-typed one a key page, over https', () => {
    for (const p of PROVIDERS) {
      if (p.id === 'openai-compatible') continue
      expect(p.keyUrl, p.id).toMatch(/^https:\/\//)
    }
  })
})
