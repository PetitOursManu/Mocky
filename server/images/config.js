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

/**
 * Two independent image profiles, because the two jobs are genuinely different:
 *
 *  - 'content'     — the pictures embedded in the generated screen (hero,
 *    produits, backgrounds). Wanted fast and cheap; there can be several per
 *    screen. This is the historical, zero-config path (Pollinations by default).
 *  - 'inspiration' — the single art-direction reference Muse shows to the model.
 *    A different skill entirely: it must render a convincing web/app layout, so
 *    it is worth a slower, stronger (pricier) model.
 *
 * 'inspiration' is OPTIONAL: an empty provider makes it reuse 'content', which
 * is exactly the pre-split behaviour.
 */
export const IMAGE_PROFILES = ['content', 'inspiration']

/** One profile's settings. `provider: ''` means "not configured". */
export function defaultImageProfile(provider = '') {
  return {
    provider,
    pollinations: { token: '' },
    fal: { apiKey: '', model: DEFAULT_FAL_MODEL, timeoutSec: 300 },
    openai: { baseUrl: 'https://api.openai.com', apiKey: '', model: 'gpt-image-1' },
    cloudflare: { accountId: '', apiToken: '', model: DEFAULT_CF_MODEL },
    sdWebui: { baseUrl: 'http://127.0.0.1:7860', steps: 20 },
  }
}

export function defaultImagesConfig() {
  return { content: defaultImageProfile('pollinations'), inspiration: defaultImageProfile('') }
}

/**
 * Configs written before the split stored ONE profile at the root. Lift it into
 * 'content' so an existing instance keeps generating exactly as before, keys and
 * model intact.
 */
function liftLegacy(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.content || raw.inspiration) return raw // already the new shape
  if (typeof raw.provider !== 'string') return null
  return { content: raw, inspiration: defaultImageProfile('') }
}

const str = (v, fallback = '') => (typeof v === 'string' ? v.trim() : fallback)

/** undefined/'' → keep; null → clear; string → set. */
const secret = (next, prev) => {
  if (next === null) return ''
  if (next === undefined) return prev
  const s = str(next)
  return s === '' ? prev : s
}

/**
 * Merge one profile. `allowEmpty` lets the inspiration profile be cleared back
 * to "reuse content"; the content profile must always name a real provider.
 */
function mergeProfile(current, patch, allowEmpty) {
  const base = { ...defaultImageProfile(allowEmpty ? '' : 'pollinations'), ...(current || {}) }
  const p = patch && typeof patch === 'object' ? patch : {}

  const out = {
    provider:
      PROVIDER_IDS.includes(p.provider) || (allowEmpty && p.provider === '') ? p.provider : base.provider,
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

/**
 * Apply a partial update. A patch may target one or both profiles; a legacy
 * flat patch is treated as a 'content' patch.
 */
export function mergeImagesConfig(current, patch) {
  const base = liftLegacy(current) || { ...defaultImagesConfig(), ...(current || {}) }
  const p = liftLegacy(patch) || (patch && typeof patch === 'object' ? patch : {})
  return {
    content: mergeProfile(base.content, p.content, false),
    inspiration: mergeProfile(base.inspiration, p.inspiration, true),
  }
}

function publicProfile(prof, fallbackProvider) {
  const c = { ...defaultImageProfile(fallbackProvider), ...(prof || {}) }
  return {
    provider: c.provider || '',
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

/** Browser-safe projection: secrets replaced by booleans. */
export function publicImagesConfig(cfg) {
  const c = liftLegacy(cfg) || { ...defaultImagesConfig(), ...(cfg || {}) }
  return {
    providers: PROVIDER_IDS,
    profiles: IMAGE_PROFILES,
    content: publicProfile(c.content, 'pollinations'),
    inspiration: publicProfile(c.inspiration, ''),
  }
}

/**
 * The profile whose settings actually apply. 'inspiration' with no provider of
 * its own falls back to 'content' — the pre-split behaviour.
 */
export function resolveImageProfile(cfg, profile = 'content') {
  const c = liftLegacy(cfg) || cfg || defaultImagesConfig()
  if (profile === 'inspiration' && c.inspiration?.provider) return c.inspiration
  return c.content || defaultImageProfile('pollinations')
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

  /** Settings that apply for a profile ('inspiration' falls back to 'content'). */
  profile(name = 'content') {
    return resolveImageProfile(this.config, name)
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
