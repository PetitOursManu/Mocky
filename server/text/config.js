// Admin-configurable TEXT (LLM) provider, persisted as JSON under server/data.
//
// SECURITY NOTE — this is a deliberate change of trust model. Historically the
// model API key lived only in the browser's localStorage and never reached the
// server. An instance-wide provider means the key is stored server-side and is
// usable by every signed-in user of this Mocky instance. It is only ever
// writable by an admin, and `publicView()` never returns a secret. When no
// provider is configured here, Mocky falls back to the per-browser Settings, so
// the old behaviour (and the frontend-only mode) keeps working.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { KIND_OLLAMA, KIND_OPENAI } from './dialect.js'

/** Selectable providers, in the order shown in the Admin UI. */
export const TEXT_PROVIDERS = [
  { id: 'ollama-cloud', label: 'Ollama Cloud', kind: KIND_OLLAMA, baseUrl: 'https://ollama.com', model: 'gpt-oss:120b' },
  { id: 'openai', label: 'OpenAI', kind: KIND_OPENAI, baseUrl: 'https://api.openai.com', model: 'gpt-4o-mini' },
  { id: 'openrouter', label: 'OpenRouter', kind: KIND_OPENAI, baseUrl: 'https://openrouter.ai/api', model: 'openai/gpt-4o-mini' },
  { id: 'openai-compatible', label: 'Compatible OpenAI (Groq, Together, LM Studio, vLLM…)', kind: KIND_OPENAI, baseUrl: '', model: '' },
]
export const TEXT_PROVIDER_IDS = TEXT_PROVIDERS.map((p) => p.id)

const byId = (id) => TEXT_PROVIDERS.find((p) => p.id === id) || null

export function defaultTextConfig() {
  const cfg = { provider: '' } // '' = not configured → fall back to browser Settings
  for (const p of TEXT_PROVIDERS) {
    cfg[p.id] = { baseUrl: p.baseUrl, apiKey: '', model: p.model }
  }
  return cfg
}

const str = (v, fallback = '') => (typeof v === 'string' ? v.trim() : fallback)

export function mergeTextConfig(current, patch) {
  const base = { ...defaultTextConfig(), ...(current || {}) }
  const p = patch && typeof patch === 'object' ? patch : {}

  /** undefined/'' → keep; null → clear; string → set. */
  const secret = (next, prev) => {
    if (next === null) return ''
    if (next === undefined) return prev
    const s = str(next)
    return s === '' ? prev : s
  }

  const out = { provider: p.provider === '' || TEXT_PROVIDER_IDS.includes(p.provider) ? p.provider : base.provider }
  for (const def of TEXT_PROVIDERS) {
    const cur = base[def.id] || {}
    const next = p[def.id] || {}
    out[def.id] = {
      baseUrl: str(next.baseUrl, cur.baseUrl ?? def.baseUrl),
      model: str(next.model, cur.model ?? def.model),
      apiKey: secret(next.apiKey, cur.apiKey || ''),
    }
  }
  return out
}

/** Browser-safe projection: secrets replaced by booleans. */
export function publicTextConfig(cfg) {
  const c = { ...defaultTextConfig(), ...(cfg || {}) }
  const out = {
    provider: c.provider || '',
    providers: TEXT_PROVIDERS.map((p) => ({ id: p.id, label: p.label })),
  }
  for (const def of TEXT_PROVIDERS) {
    const v = c[def.id] || {}
    out[def.id] = { baseUrl: v.baseUrl || '', model: v.model || '', hasApiKey: Boolean(v.apiKey) }
  }
  return out
}

/**
 * Resolve the configured target, or null when the admin hasn't set one (the
 * caller then falls back to the credentials the browser sent).
 * @returns {{kind:string, baseUrl:string, apiKey:string, model:string}|null}
 */
export function resolveTextTarget(cfg) {
  const c = cfg || {}
  const def = byId(c.provider)
  if (!def) return null
  const v = c[def.id] || {}
  const baseUrl = str(v.baseUrl, def.baseUrl)
  const model = str(v.model, def.model)
  if (!baseUrl || !model) return null // incomplete → don't hijack the request
  return { kind: def.kind, baseUrl, apiKey: v.apiKey || '', model }
}

export class TextConfigStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'text-config.json')
    this.config = this._load()
  }

  _load() {
    try {
      return mergeTextConfig(defaultTextConfig(), JSON.parse(fs.readFileSync(this.file, 'utf8')))
    } catch {
      return defaultTextConfig()
    }
  }

  /** Re-read from disk — the Vite dev proxy shares the file with the backend. */
  reload() {
    this.config = this._load()
    return this.config
  }

  get() {
    return this.config
  }

  publicView() {
    return publicTextConfig(this.config)
  }

  /** The active target, or null to fall back to the browser's own credentials. */
  target() {
    return resolveTextTarget(this.config)
  }

  update(patch) {
    this.config = mergeTextConfig(this.config, patch)
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      const tmp = `${this.file}.${crypto.randomBytes(6).toString('hex')}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(this.config, null, 2))
      fs.renameSync(tmp, this.file)
    } catch {
      // Still applied in memory — never throw.
    }
    return this.config
  }
}
