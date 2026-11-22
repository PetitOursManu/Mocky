// Admin-configurable DECISION model, persisted as JSON under server/data.
//
// A decision model does not write: it answers typed questions about a piece of
// content — a yes/no as a probability, a score on a scale given in words, one
// option out of a list — and it says how sure it is. Muse keeps everything that
// takes prose (the grid, the explanations, the synthesis); this model takes the
// many short, repetitive judgements an audit is made of (docs/decision-model.md).
//
// The first, and today the only, provider is TypeSafe's Jev
// (https://docs.typesafe.ai). Its API is its own — not OpenAI-shaped — which is
// why this is a store of its own and not a fourth text profile: a text profile
// is something `/__provider` and `museChat` can both speak to, and neither can
// speak to this.
//
// Same trust model as server/text/config.js: the key lives server-side, is only
// ever writable by an administrator, and `publicView()` never returns it. The
// base URL is an administrator's, so it is trusted past the SSRF guard like the
// text provider's — and like it, it is never anything a browser sent.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

/** The providers an administrator can choose. One for now; data, not code. */
export const DECISION_PROVIDERS = [
  {
    id: 'typesafe',
    label: 'TypeSafe (Jev)',
    baseUrl: 'https://api.typesafe.ai',
    model: 'jev-latest',
    // $42 per billion input tokens, output free (typesafe.ai pricing, 2026-11).
    // What the spending ledger prices a call at, since the API reports tokens
    // and not a price.
    inputPricePerToken: 42e-9,
  },
]
export const DECISION_PROVIDER_IDS = DECISION_PROVIDERS.map((p) => p.id)
const byId = (id) => DECISION_PROVIDERS.find((p) => p.id === id) || null

export function defaultDecisionConfig() {
  const def = DECISION_PROVIDERS[0]
  // `images` is OFF by default: TypeSafe labels its image input as not yet
  // ready for production (the `TypeSafe-Danger-Zone-Images` header). Mocky's
  // audit reads source and words, so nothing is lost by leaving it off.
  return { provider: '', baseUrl: def.baseUrl, model: def.model, apiKey: '', images: false }
}

const str = (v, fallback = '') => (typeof v === 'string' ? v.trim() : fallback)

/** undefined/'' → keep; null → clear; string → set. Same grammar as the text config. */
const secret = (next, prev) => {
  if (next === null) return ''
  if (next === undefined) return prev
  const s = str(next)
  return s === '' ? prev : s
}

export function mergeDecisionConfig(current, patch) {
  const base = { ...defaultDecisionConfig(), ...(current && typeof current === 'object' ? current : {}) }
  const p = patch && typeof patch === 'object' ? patch : {}
  const provider = p.provider === '' || DECISION_PROVIDER_IDS.includes(p.provider) ? p.provider : base.provider
  const def = byId(provider) || DECISION_PROVIDERS[0]
  return {
    provider: DECISION_PROVIDER_IDS.includes(provider) || provider === '' ? provider : '',
    baseUrl: str(p.baseUrl, base.baseUrl) || def.baseUrl,
    model: str(p.model, base.model) || def.model,
    apiKey: secret(p.apiKey, typeof base.apiKey === 'string' ? base.apiKey : ''),
    images: p.images !== undefined ? p.images === true : base.images === true,
  }
}

/** Browser-safe projection: the key replaced by a boolean. */
export function publicDecisionConfig(cfg) {
  const c = mergeDecisionConfig(cfg, {})
  return {
    providers: DECISION_PROVIDERS.map((p) => ({ id: p.id, label: p.label, baseUrl: p.baseUrl, model: p.model })),
    provider: c.provider,
    baseUrl: c.baseUrl,
    model: c.model,
    images: c.images,
    hasApiKey: Boolean(c.apiKey),
    configured: Boolean(resolveDecisionTarget(c)),
  }
}

/**
 * The target a call goes to, or null when no decision model is set up — and
 * null means the caller asks Muse's text model instead (decide.js). A provider
 * chosen with no key is not a target: TypeSafe refuses every unauthenticated
 * call, and a target that can only fail would turn every audit into a retry.
 */
export function resolveDecisionTarget(cfg) {
  const c = cfg || {}
  const def = byId(c.provider)
  if (!def) return null
  const baseUrl = str(c.baseUrl, def.baseUrl).replace(/\/+$/, '')
  const model = str(c.model, def.model)
  const apiKey = str(c.apiKey)
  if (!baseUrl || !model || !apiKey) return null
  return { id: def.id, baseUrl, model, apiKey, images: c.images === true, inputPricePerToken: def.inputPricePerToken }
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
      // 0600: the key is in clear text, as in text-config.json.
      fs.writeFileSync(tmp, JSON.stringify(this.config, null, 2), { mode: 0o600 })
      fs.renameSync(tmp, this.file)
    } catch (err) {
      this.lastPersistError = err.message
      console.error(`mocky: could not save decision-model config to ${this.file} — ${err.message}`)
    }
    return this.config
  }
}
