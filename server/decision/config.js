// Admin-configurable DECISION model, persisted as JSON under server/data.
//
// A decision model does not write: it answers typed questions about a piece of
// content — a yes/no as a probability, a score on a scale given in words, one
// option out of a list — and it says how sure it is. Muse keeps everything that
// takes prose (the grid, the explanations, the synthesis); this model takes the
// many short, repetitive judgements an audit is made of (docs/decision-model.md).
//
// The model today is TypeSafe's Jev, and it is served by TypeSafe itself and by
// gateways that resell it. Every gateway below implements TypeSafe's System
// One request and response shapes at `<baseUrl>/v1/systemone` — checked
// 2026-11-22 against each one's own documentation (the URL is on each entry) —
// so a provider here is DATA: an address, a model id, how it reports a price.
// Its API is not OpenAI-shaped, which is why this is a store of its own and not
// a fourth text profile: neither `/__provider` nor `museChat` can speak to it.
//
// Left out on purpose: Cloudflare AI Gateway (no official page for Jev found),
// and OpenRouter's and Vercel's native decision APIs (`/api/alpha/decisions`,
// `/v1/evaluate`) — each gateway's System One surface is the one shape all of
// them share, and a second dialect would buy nothing.
//
// Same trust model as server/text/config.js: keys live server-side, are only
// ever writable by an administrator, and `publicView()` never returns one. Each
// provider keeps its OWN record, so switching from TypeSafe to OpenRouter and
// back does not lose a key. The base URL is an administrator's, trusted past
// the SSRF guard like the text provider's, and never anything a browser sent.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

/**
 * The providers an administrator can choose, in the order shown.
 *
 * `price` is what the spending ledger charges per input token when the answer
 * carries no cost of its own (output is free on every one of them); `null`
 * means "the answer says". `cost` names where an answer carries its cost:
 * OpenRouter puts it in `usage.cost`, Vercel in `provider_metadata.gateway.cost`.
 */
export const DECISION_PROVIDERS = [
  // https://docs.typesafe.ai/api — the maker's own API. $42 per billion input tokens.
  { id: 'typesafe', label: 'TypeSafe (Jev)', baseUrl: 'https://api.typesafe.ai', model: 'jev-latest', price: 42e-9 },
  // https://openrouter.ai/docs/guides/community/typesafe-sdk — "implements
  // TypeSafe's request and response shapes"; an OpenRouter key; bare TypeSafe
  // ids are mapped, `~typesafe/jev-latest` follows the newest release.
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api', model: '~typesafe/jev-latest', price: 42e-9, cost: 'usage' },
  // https://vercel.com/docs/ai-gateway/sdks-and-apis/typesafe — an AI Gateway
  // key; the docs name the model `typesafe-ai/jev` and no version.
  { id: 'vercel', label: 'Vercel AI Gateway', baseUrl: 'https://ai-gateway.vercel.sh/typesafe', model: 'typesafe-ai/jev', price: 42e-9, cost: 'gateway' },
  // https://opper.ai/typesafe/jev-1-14-0 — its cURL example posts the TypeSafe
  // shape to /v3/compat/v1/systemone. $0.04 per million input tokens there.
  { id: 'opper', label: 'Opper', baseUrl: 'https://api.opper.ai/v3/compat', model: 'typesafe/jev-1.14.0', price: 40e-9 },
  // Last, always: another gateway that serves the System One shape, by hand.
  { id: 'systemone-compatible', label: 'Compatible System One (autre passerelle)', baseUrl: '', model: '', price: null },
]
export const DECISION_PROVIDER_IDS = DECISION_PROVIDERS.map((p) => p.id)
const byId = (id) => DECISION_PROVIDERS.find((p) => p.id === id) || null

export function defaultDecisionConfig() {
  // `images` is OFF by default: TypeSafe labels its image input as not yet
  // ready for production (the `TypeSafe-Danger-Zone-Images` header). Mocky's
  // audit reads source and words, so nothing is lost by leaving it off.
  const c = { provider: '', images: false }
  for (const def of DECISION_PROVIDERS) c[def.id] = { baseUrl: def.baseUrl, model: def.model, apiKey: '' }
  return c
}

const str = (v, fallback = '') => (typeof v === 'string' ? v.trim() : fallback)

/** undefined/'' → keep; null → clear; string → set. Same grammar as the text config. */
const secret = (next, prev) => {
  if (next === null) return ''
  if (next === undefined) return prev
  const s = str(next)
  return s === '' ? prev : s
}

/**
 * The first version of this file kept ONE flat record, for TypeSafe — the only
 * provider then. Lift it into TypeSafe's own record so a saved key survives.
 */
function liftFlat(raw) {
  if (!raw || typeof raw !== 'object') return raw
  if (raw.typesafe || !('apiKey' in raw || 'baseUrl' in raw || 'model' in raw)) return raw
  const { baseUrl, model, apiKey, ...rest } = raw
  return { ...rest, typesafe: { baseUrl, model, apiKey } }
}

export function mergeDecisionConfig(current, patch) {
  const base = { ...defaultDecisionConfig(), ...(liftFlat(current) || {}) }
  const p = liftFlat(patch && typeof patch === 'object' ? patch : {}) || {}
  const out = {
    provider: p.provider === '' || DECISION_PROVIDER_IDS.includes(p.provider) ? p.provider : DECISION_PROVIDER_IDS.includes(base.provider) ? base.provider : '',
    images: p.images !== undefined ? p.images === true : base.images === true,
  }
  for (const def of DECISION_PROVIDERS) {
    const cur = base[def.id] && typeof base[def.id] === 'object' ? base[def.id] : {}
    const next = p[def.id] && typeof p[def.id] === 'object' ? p[def.id] : {}
    out[def.id] = {
      baseUrl: str(next.baseUrl, str(cur.baseUrl, def.baseUrl)),
      model: str(next.model, str(cur.model, def.model)),
      apiKey: secret(next.apiKey, typeof cur.apiKey === 'string' ? cur.apiKey : ''),
    }
  }
  return out
}

/** Browser-safe projection: keys replaced by booleans. */
export function publicDecisionConfig(cfg) {
  const c = mergeDecisionConfig(cfg, {})
  const out = {
    providers: DECISION_PROVIDERS.map((p) => ({ id: p.id, label: p.label, baseUrl: p.baseUrl, model: p.model })),
    provider: c.provider,
    images: c.images,
    configured: Boolean(resolveDecisionTarget(c)),
  }
  for (const def of DECISION_PROVIDERS) {
    out[def.id] = { baseUrl: c[def.id].baseUrl, model: c[def.id].model, hasApiKey: Boolean(c[def.id].apiKey) }
  }
  return out
}

/**
 * The target a call goes to, or null when no decision model is set up — and
 * null means the caller asks Muse's text model instead (decide.js). A provider
 * chosen with no key is not a target: every one of them refuses an
 * unauthenticated call, and a target that can only fail would turn every audit
 * into a retry.
 */
export function resolveDecisionTarget(cfg) {
  const c = liftFlat(cfg) || {}
  const def = byId(c.provider)
  if (!def) return null
  const v = c[def.id] && typeof c[def.id] === 'object' ? c[def.id] : {}
  const baseUrl = str(v.baseUrl, def.baseUrl).replace(/\/+$/, '')
  const model = str(v.model, def.model)
  const apiKey = str(v.apiKey)
  if (!baseUrl || !model || !apiKey) return null
  return { id: def.id, baseUrl, model, apiKey, images: c.images === true, inputPricePerToken: def.price, cost: def.cost || null }
}

export class DecisionConfigStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'decision-config.json')
    this.config = this._load()
  }

  _load() {
    try {
      return mergeDecisionConfig(defaultDecisionConfig(), JSON.parse(fs.readFileSync(this.file, 'utf8')))
    } catch {
      return defaultDecisionConfig()
    }
  }

  get() {
    return this.config
  }

  publicView() {
    return publicDecisionConfig(this.config)
  }

  target() {
    return resolveDecisionTarget(this.config)
  }

  update(patch) {
    this.config = mergeDecisionConfig(this.config, patch)
    this.lastPersistError = null
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      const tmp = `${this.file}.${crypto.randomBytes(6).toString('hex')}.tmp`
      // 0600: the keys are in clear text, as in text-config.json.
      fs.writeFileSync(tmp, JSON.stringify(this.config, null, 2), { mode: 0o600 })
      fs.renameSync(tmp, this.file)
    } catch (err) {
      this.lastPersistError = err.message
      console.error(`mocky: could not save decision-model config to ${this.file} — ${err.message}`)
    }
    return this.config
  }
}
