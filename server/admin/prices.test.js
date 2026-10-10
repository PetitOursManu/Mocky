import { describe, it, expect } from 'vitest'
import { fetchPrices, PARSERS, PRICE_SOURCES } from './prices.js'

// The shapes as the live catalogues answered (October 2026), trimmed.
const OPENROUTER = { data: [{ id: 'openai/gpt-oss-120b', pricing: { prompt: '0.000000037', completion: '0.00000017' } }, { id: 'broken', pricing: {} }] }
const HUGGINGFACE = {
  data: [
    {
      id: 'zai-org/GLM-5.3-Flash',
      providers: [
        { provider: 'novita', status: 'live', pricing: { input: 0.15, output: 0.5 }, throughput: 38 },
        { provider: 'together', status: 'live', pricing: { input: 0.1, output: 0.4 }, throughput: 90 },
        { provider: 'featherless-ai', status: 'live' },
      ],
    },
  ],
}
const TOGETHER = [{ id: 'openai/gpt-oss-120b', pricing: { hourly: 0, input: 0.15, output: 0.6, base: 0, finetune: 0 } }, { id: 'free-thing', pricing: { input: 0, output: 0 } }]
const XAI = { models: [{ id: 'grok-4.7', aliases: ['grok-latest'], prompt_text_token_price: 30000, completion_text_token_price: 150000 }] }

describe('reading a provider’s price catalogue', () => {
  it('turns every unit into dollars per million tokens', () => {
    expect(PARSERS.openrouter(OPENROUTER).get('openai/gpt-oss-120b')).toEqual({ in: 0.037, out: 0.17 })
    expect(PARSERS.openrouter(OPENROUTER).has('broken')).toBe(false)
    expect(PARSERS.together(TOGETHER).get('openai/gpt-oss-120b')).toEqual({ in: 0.15, out: 0.6 })
    // US cents per 100 M tokens: 30 000 is three dollars a million.
    expect(PARSERS.xai(XAI).get('grok-4.7')).toEqual({ in: 3, out: 15 })
    expect(PARSERS.xai(XAI).get('grok-latest')).toEqual({ in: 3, out: 15 })
  })

  it('prices a Hugging Face model the way the router chooses its provider', () => {
    const hf = PARSERS.huggingface(HUGGINGFACE)
    expect(hf.get('zai-org/GLM-5.3-Flash')).toEqual({ in: 0.15, out: 0.5 })
    expect(hf.get('zai-org/GLM-5.3-Flash:together')).toEqual({ in: 0.1, out: 0.4 })
    expect(hf.get('zai-org/GLM-5.3-Flash:cheapest')).toEqual({ in: 0.1, out: 0.4 })
    expect(hf.get('zai-org/GLM-5.3-Flash:fastest')).toEqual({ in: 0.1, out: 0.4 })
    expect(hf.has('zai-org/GLM-5.3-Flash:featherless-ai')).toBe(false)
  })
})

describe('fetching the instance’s prices', () => {
  const answers = { 'https://openrouter.ai/api/v1/models': OPENROUTER, 'https://api.together.ai/v1/models': TOGETHER, 'https://api.x.ai/v1/language-models': XAI }
  const fakeFetch = (seen) => async (url, init) => {
    seen.push({ url, auth: init?.headers?.authorization })
    if (!(url in answers)) return { ok: false, status: 500, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => answers[url] }
  }

  it('reads each catalogue once, with the key only where one is needed, and says what came of every model', async () => {
    const seen = []
    const { found, report } = await fetchPrices({
      wanted: [
        { provider: 'openrouter', model: 'openai/gpt-oss-120b' },
        { provider: 'openrouter', model: 'not/there' },
        { provider: 'together', model: 'openai/gpt-oss-120b' },
        { provider: 'xai', model: 'grok-4.7' },
        { provider: 'openai', model: 'gpt-4o-mini' },
      ],
      credentials: new Map([
        ['together', { baseUrl: 'https://api.together.ai/v1', apiKey: 'tg-key' }],
        ['xai', { baseUrl: 'https://api.x.ai/v1', apiKey: 'xai-key' }],
      ]),
      fetchImpl: fakeFetch(seen),
    })
    expect(Object.keys(found).sort()).toEqual(['openrouter::openai/gpt-oss-120b', 'together::openai/gpt-oss-120b', 'xai::grok-4.7'])
    expect(found['together::openai/gpt-oss-120b']).toEqual({ in: 0.15, out: 0.6, source: 'together' })
    expect(report.find((r) => r.model === 'not/there').status).toBe('not-listed')
    expect(report.find((r) => r.provider === 'openai').status).toBe('no-api')
    expect(seen.filter((s) => s.url.includes('openrouter'))).toHaveLength(1)
    expect(seen.find((s) => s.url.includes('openrouter')).auth).toBeUndefined()
    expect(seen.find((s) => s.url.includes('together')).auth).toBe('Bearer tg-key')
  })

  it('says when a key is missing or a catalogue fails, instead of guessing', async () => {
    const { report } = await fetchPrices({
      wanted: [
        { provider: 'together', model: 'x' },
        { provider: 'huggingface', model: 'y' },
      ],
      credentials: new Map(),
      fetchImpl: fakeFetch([]),
    })
    expect(report.find((r) => r.provider === 'together').status).toBe('no-key')
    expect(report.find((r) => r.provider === 'huggingface').status).toBe('error')
  })

  it('drops a price that can only be a misread unit', async () => {
    const { report, found } = await fetchPrices({
      wanted: [{ provider: 'openrouter', model: 'huge' }],
      credentials: new Map(),
      fetchImpl: async () => ({ ok: true, json: async () => ({ data: [{ id: 'huge', pricing: { prompt: '5', completion: '5' } }] }) }),
    })
    expect(found).toEqual({})
    expect(report[0].status).toBe('not-listed')
    expect(PRICE_SOURCES).toContain('huggingface')
  })
})
