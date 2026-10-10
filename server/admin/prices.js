// The price of a model, fetched from the provider that sells it — where the
// provider publishes one.
//
// The spending ledger (spend.js) believes a price reported WITH an answer
// (OpenRouter's `usage.cost`, xAI's `cost_in_usd_ticks`) and prices everything
// else from a table an administrator filled in by hand. Four providers publish
// their list prices in a machine-readable catalogue, and copying those by hand
// is a chore that goes stale; so "Fetch the providers' prices" reads them:
//
//   openrouter   GET openrouter.ai/api/v1/models             public; dollars per TOKEN, as strings
//   huggingface  GET router.huggingface.co/v1/models         public; per inference provider, $/M
//   together     GET <base>/models                           the account's key; $/M
//   xai          GET <base>/language-models                  the account's key; US cents per 100 M
//
// The others — OpenAI, Anthropic, Gemini, Mistral, DeepSeek, Groq, Fireworks,
// Cerebras, Moonshot, Ollama Cloud — publish no price through their API (their
// model listing has none), so their models stay in the table for a person to
// fill, and the import says so by name rather than leaving a blank that reads
// as "free".
//
// The units were checked against the live catalogues, and each one is guarded
// anyway: a price outside [0, MAX_PER_MILLION] is dropped as a misread unit
// rather than written into a total.
import { openAiRoot } from '../text/dialect.js'

/** The providers this module can read prices from. */
export const PRICE_SOURCES = ['openrouter', 'huggingface', 'together', 'xai']

/** Above this, a "price per million tokens" is a unit read wrong, not a price. */
const MAX_PER_MILLION = 1000
const TIMEOUT_MS = 15_000

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}
/** Six decimals of a dollar per million tokens: 0.17, not 0.16999999999999998. */
const round = (n) => Math.round(n * 1e6) / 1e6
const sane = (p) => p && p.in != null && p.out != null && p.in <= MAX_PER_MILLION && p.out <= MAX_PER_MILLION

/** One catalogue → Map(model id → {in, out} in dollars per million tokens). */
export const PARSERS = {
  openrouter(json) {
    const out = new Map()
    for (const m of Array.isArray(json?.data) ? json.data : []) {
      const i = num(m?.pricing?.prompt)
      const o = num(m?.pricing?.completion)
      if (m?.id && i != null && o != null) out.set(String(m.id), { in: round(i * 1e6), out: round(o * 1e6) })
    }
    return out
  },
  /**
   * A model is sold by several inference providers at several prices. The id
   * Mocky sends may name one (`org/model:novita`); without one, the router picks,
   * and the first live provider with a price is the one it lists first.
   */
  huggingface(json) {
    const out = new Map()
    for (const m of Array.isArray(json?.data) ? json.data : []) {
      if (!m?.id) continue
      const providers = (Array.isArray(m.providers) ? m.providers : []).filter((p) => p?.pricing && p.status !== 'error')
      const priced = providers
        .map((p) => ({ provider: String(p.provider || ''), in: num(p.pricing.input), out: num(p.pricing.output), speed: num(p.throughput) ?? 0 }))
        .filter((p) => p.in != null && p.out != null)
      if (!priced.length) continue
      const price = (p) => ({ in: p.in, out: p.out })
      out.set(String(m.id), price(priced[0]))
      // The router's two named policies, priced the way it chooses.
      out.set(`${m.id}:cheapest`, price(priced.reduce((a, b) => (b.in + b.out < a.in + a.out ? b : a))))
      out.set(`${m.id}:fastest`, price(priced.reduce((a, b) => (b.speed > a.speed ? b : a))))
      for (const p of priced) if (p.provider) out.set(`${m.id}:${p.provider}`, price(p))
    }
    return out
  },
  together(json) {
    const out = new Map()
    for (const m of Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []) {
      const i = num(m?.pricing?.input)
      const o = num(m?.pricing?.output)
      if (m?.id && i != null && o != null && (i > 0 || o > 0)) out.set(String(m.id), { in: i, out: o })
    }
    return out
  },
  /** US cents per 100 million tokens: ÷ 100 for dollars, × 1/100 for a million. */
  xai(json) {
    const out = new Map()
    const list = Array.isArray(json?.models) ? json.models : Array.isArray(json?.data) ? json.data : []
    for (const m of list) {
      const i = num(m?.prompt_text_token_price)
      const o = num(m?.completion_text_token_price)
      if (!m?.id || i == null || o == null) continue
      const price = { in: round(i / 10_000), out: round(o / 10_000) }
      out.set(String(m.id), price)
      for (const alias of Array.isArray(m.aliases) ? m.aliases : []) out.set(String(alias), price)
    }
    return out
  },
}

/** Where each catalogue lives — the public ones at a fixed address, the others behind the account's key. */
function catalogueUrl(provider, creds) {
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1/models'
  if (provider === 'huggingface') return 'https://router.huggingface.co/v1/models'
  const root = openAiRoot(String(creds?.baseUrl || '').replace(/\/+$/, ''))
  if (provider === 'together') return `${root}/models`
  if (provider === 'xai') return `${root}/language-models`
  return null
}

/**
 * Fetch the prices of `wanted` models from their providers.
 *
 * @param {object} args
 * @param {Array<{provider:string, model:string}>} args.wanted  the instance's models
 * @param {Map<string,{baseUrl:string, apiKey:string}>} args.credentials  per provider id
 * @param {typeof fetch} [args.fetchImpl]
 * @returns {Promise<{found: Record<string,{in:number,out:number,source:string}>, report: Array<{provider:string, model:string, status:string}>}>}
 *   `found` is keyed `provider::model`, the ledger's own key (spend.js `costOf`).
 *   A status is `imported`, `not-listed` (the catalogue has no such id),
 *   `no-api` (the provider publishes no price), `no-key` or `error`.
 */
export async function fetchPrices({ wanted, credentials, fetchImpl = fetch }) {
  const byProvider = new Map()
  for (const w of wanted) {
    if (!byProvider.has(w.provider)) byProvider.set(w.provider, new Set())
    byProvider.get(w.provider).add(w.model)
  }
  const found = {}
  const report = []
  await Promise.all(
    [...byProvider].map(async ([provider, models]) => {
      const say = (status) => {
        for (const model of models) report.push({ provider, model, status })
      }
      if (!PRICE_SOURCES.includes(provider)) return say('no-api')
      const creds = credentials.get(provider)
      const needsKey = provider === 'together' || provider === 'xai'
      if (needsKey && !creds?.apiKey) return say('no-key')
      const url = catalogueUrl(provider, creds)
      if (!url) return say('no-api')
      let catalogue
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
        const res = await fetchImpl(url, {
          headers: { accept: 'application/json', ...(needsKey ? { authorization: `Bearer ${creds.apiKey}` } : {}) },
          signal: ctrl.signal,
          // A catalogue never redirects; one that does is not followed (the SSRF rule's habit).
          redirect: 'manual',
        }).finally(() => clearTimeout(timer))
        if (!res.ok) return say('error')
        catalogue = PARSERS[provider](await res.json())
      } catch {
        return say('error')
      }
      for (const model of models) {
        const price = catalogue.get(model)
        if (!sane(price)) {
          report.push({ provider, model, status: 'not-listed' })
          continue
        }
        found[`${provider}::${model}`] = { in: price.in, out: price.out, source: provider }
        report.push({ provider, model, status: 'imported' })
      }
    }),
  )
  report.sort((a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model))
  return { found, report }
}
