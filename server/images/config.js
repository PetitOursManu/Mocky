// Admin-configurable image-generation settings, persisted as JSON under
// server/data (same "no database, no native deps" store as the rest of Mocky).
//
// Secrets (API keys/tokens) are stored here but NEVER returned to the browser:
// `publicView()` replaces each with a `has…` boolean. Updates are partial —
// omitting a secret (or sending "") keeps the stored value, so an admin never
// has to retype a key; sending `null` clears it.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { DEFAULT_CF_MODEL } from './providers/cloudflare.js'
import { DEFAULT_FAL_MODEL } from './providers/fal.js'

/** Selectable providers, in the order shown in the Admin UI. */
export const PROVIDER_IDS = ['pollinations', 'fal', 'openai-image', 'cloudflare-workers-ai', 'sd-webui', 'none']

export function defaultImagesConfig() {
  return {
    provider: 'pollinations',
    pollinations: { token: '' },
    fal: { apiKey: '', model: DEFAULT_FAL_MODEL, timeoutSec: 300 },
    openai: { baseUrl: 'https://api.openai.com', apiKey: '', model: 'gpt-image-1' },
    cloudflare: { accountId: '', apiToken: '', model: DEFAULT_CF_MODEL },
    sdWebui: { baseUrl: 'http://127.0.0.1:7860', steps: 20 },
  }
}

const str = (v, fallback = '') => (typeof v === 'string' ? v.trim() : fallback)

/**
 * Apply a partial update to a config object. Secret fields follow the
 * keep/clear rule described above.
 */
export function mergeImagesConfig(current, patch) {
  const base = { ...defaultImagesConfig(), ...(current || {}) }
  const p = patch && typeof patch === 'object' ? patch : {}

  /** undefined/'' → keep; null → clear; string → set. */
  const secret = (next, prev) => {
    if (next === null) return ''
    if (next === undefined) return prev
    const s = str(next)
    return s === '' ? prev : s
  }

  const out = {
    provider: PROVIDER_IDS.includes(p.provider) ? p.provider : base.provider,
    pollinations: {
      token: secret(p.pollinations?.token, base.pollinations?.token || ''),
    },
    fal: {
      model: str(p.fal?.model, base.fal?.model) || DEFAULT_FAL_MODEL,
      apiKey: secret(p.fal?.apiKey, base.fal?.apiKey || ''),
      // Some models (Seedream Pro…) take ~2 min; allow up to 15.
      timeoutSec:
        Number(p.fal?.timeoutSec) > 0
          ? Math.min(900, Math.round(Number(p.fal.timeoutSec)))
          : base.fal?.timeoutSec || 300,
    },
    openai: {
      baseUrl: str(p.openai?.baseUrl, base.openai?.baseUrl) || 'https://api.openai.com',
      model: str(p.openai?.model, base.openai?.model) || 'gpt-image-1',
      apiKey: secret(p.openai?.apiKey, base.openai?.apiKey || ''),
    },
    cloudflare: {
      accountId: str(p.cloudflare?.accountId, base.cloudflare?.accountId),
      model: str(p.cloudflare?.model, base.cloudflare?.model) || DEFAULT_CF_MODEL,
      apiToken: secret(p.cloudflare?.apiToken, base.cloudflare?.apiToken || ''),
    },
    sdWebui: {
      baseUrl: str(p.sdWebui?.baseUrl, base.sdWebui?.baseUrl) || 'http://127.0.0.1:7860',
      steps: Number(p.sdWebui?.steps) > 0 ? Math.min(150, Math.round(Number(p.sdWebui.steps))) : base.sdWebui?.steps || 20,
    },
  }
  return out
}

/** Browser-safe projection: secrets replaced by booleans. */
export function publicImagesConfig(cfg) {
  const c = { ...defaultImagesConfig(), ...(cfg || {}) }
  return {
    provider: c.provider,
    providers: PROVIDER_IDS,
    pollinations: { hasToken: Boolean(c.pollinations?.token) },
    fal: { model: c.fal?.model || '', hasApiKey: Boolean(c.fal?.apiKey), timeoutSec: c.fal?.timeoutSec ?? 300 },
    openai: { baseUrl: c.openai?.baseUrl || '', model: c.openai?.model || '', hasApiKey: Boolean(c.openai?.apiKey) },
    cloudflare: {
      accountId: c.cloudflare?.accountId || '',
      model: c.cloudflare?.model || '',
      hasApiToken: Boolean(c.cloudflare?.apiToken),
    },
    sdWebui: { baseUrl: c.sdWebui?.baseUrl || '', steps: c.sdWebui?.steps ?? 20 },
  }
}

export class ImagesConfigStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'images-config.json')
    this.config = this._load()
  }

  _load() {
    try {
      return mergeImagesConfig(defaultImagesConfig(), JSON.parse(fs.readFileSync(this.file, 'utf8')))
    } catch {
      return defaultImagesConfig()
    }
  }

  get() {
    return this.config
  }

  publicView() {
    return publicImagesConfig(this.config)
  }

  /** Merge a partial update, persist atomically, return the new config. */
  update(patch) {
    this.config = mergeImagesConfig(this.config, patch)
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      const tmp = `${this.file}.${crypto.randomBytes(6).toString('hex')}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(this.config, null, 2))
      fs.renameSync(tmp, this.file)
    } catch {
      // Config that can't persist is still applied in memory — never throw.
    }
    return this.config
  }
}
