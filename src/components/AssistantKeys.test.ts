import { afterEach, describe, expect, it, vi } from 'vitest'
import { keyErrorMessage } from './AssistantKeys'
import { api } from '../lib/api'
import { translate, type Lang, type TranslationKey } from '../i18n'

/**
 * A refused key is told in the reader's language. The routes answer with a
 * code (server/mcp/routes.js, keys.js's KeyError, the step-up) or, for the
 * shared rate limiter, a bare 429 — and three codes and the 429 used to reach
 * the page as the server's own English sentence.
 */

const limits = { keysMax: 5, keyNameMax: 42 }
const SERVER_WORDS = 'Refused: whatever the server said.'
const refusal = (code: string | undefined, status: number) => Object.assign(new Error(SERVER_WORDS), { code, status })

const REFUSALS: [string | undefined, number][] = [
  ['password', 401],
  ['locked', 429],
  ['name', 400],
  ['level', 400],
  ['expiry', 400],
  ['limit', 409],
  ['full', 409],
  ['keys-off', 409],
  [undefined, 429],
]

for (const lang of ['fr', 'en'] as Lang[]) {
  const t = (key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars)

  describe(`a refused key, in ${lang}`, () => {
    it('has a sentence of its own for every refusal the routes send', () => {
      const seen = new Set<string>()
      for (const [code, status] of REFUSALS) {
        const msg = keyErrorMessage(refusal(code, status), t, limits)
        expect(msg, String(code)).not.toBe(SERVER_WORDS)
        // A missing dictionary entry comes back as its key.
        expect(msg, String(code)).not.toMatch(/^mcp\./)
        seen.add(msg)
      }
      expect(seen.size).toBe(REFUSALS.length)
    })

    it('gives the name’s real length limit, not a number of its own', () => {
      const msg = keyErrorMessage(refusal('name', 400), t, limits)
      expect(msg).toContain('42')
      expect(msg).not.toContain('60')
      expect(keyErrorMessage(refusal('limit', 409), t, limits)).toContain('5')
    })

    it('keeps the server’s words only for an answer nobody planned', () => {
      expect(keyErrorMessage(refusal('user', 400), t, limits)).toBe(SERVER_WORDS)
      expect(keyErrorMessage(refusal(undefined, 404), t, limits)).toBe(SERVER_WORDS)
    })
  })
}

describe('the shared limiter’s bare 429, through the real request helper', () => {
  afterEach(() => vi.unstubAllGlobals())

  // The limiter answers with no code, so the page can only tell it by its
  // status — which only reaches keyErrorMessage if req() keeps it on the error.
  it('reaches the page as a 429 and is told in the reader’s language', async () => {
    vi.stubGlobal('fetch', async () =>
      new Response(JSON.stringify({ error: 'Too many attempts. Please try again in a minute.' }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const caught = await api.mcpConnections
      .createKey({ name: 'x', level: 'read', expiresInDays: null })
      .then(() => null, (e: unknown) => e)
    expect((caught as { status?: number } | null)?.status).toBe(429)
    for (const lang of ['fr', 'en'] as Lang[]) {
      const t = (key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars)
      expect(keyErrorMessage(caught, t, limits)).toBe(t('mcp.keys.error.tooMany'))
    }
  })
})
