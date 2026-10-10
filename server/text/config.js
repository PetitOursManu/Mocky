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

/**
 * Selectable providers, in the order shown in the Admin UI.
 *
 * `group` sorts a list that grew to sixteen into what a person is choosing
 * between: a lab's own API (`vendor`), a host or router serving other people's
 * models (`host`), or an address typed by hand (`custom`). The UIs render it as
 * <optgroup>s (src/lib/providerGroups.ts).
 *
 * Mirrored by PROVIDERS in src/lib/settings.ts, minus fal (its `Key` auth
 * cannot ride the browser's Bearer header); tests/text-providers-mirror.test.js
 * holds the two together. Every preset added since Anthropic is `openai` kind
 * with Bearer auth, so each is data and nothing else: where a vendor refuses a
 * corner of the OpenAI shape, that is a row of PROVIDER_QUIRKS in dialect.js,
 * and where its surface is not at `<base>/v1`, `openAiRoot` reads that off the
 * documented base URL. Checked 2026-09-28 against each vendor's documentation
 * (the URL is on each entry). Left out on purpose:
 *  - Cohere: its compatibility API has no model listing, so a preset would
 *    open on a picker that cannot fill. Its older Command models also cap
 *    output under the 16 384 a screen asks for — PROVIDER_QUIRKS clamps those
 *    per model, which is what lets the "Compatible OpenAI" label name it.
 *  - Alibaba Qwen (DashScope): the international base URL now carries the
 *    account's workspace id, so there is no address a preset could hold.
 * Both work through "Compatible OpenAI" with the URL their docs give.
 */
export const TEXT_PROVIDERS = [
  { id: 'ollama-cloud', label: 'Ollama Cloud', group: 'host', kind: KIND_OLLAMA, baseUrl: 'https://ollama.com', model: 'gpt-oss:120b' },
  { id: 'openai', label: 'OpenAI', group: 'vendor', kind: KIND_OPENAI, baseUrl: 'https://api.openai.com', model: 'gpt-4o-mini' },
  // Anthropic publishes an OpenAI-compatible surface at /v1/chat/completions
  // with Bearer auth, so the existing translation covers it and no new dialect
  // code is needed — the entry is purely declarative, like every other preset.
  // Its models from 4.7 on refuse a temperature below 1: that is a row of
  // PROVIDER_QUIRKS (CLAUDE_TEMPERATURE_MODELS), not code here.
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    group: 'vendor',
    kind: KIND_OPENAI,
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
  },
  // https://ai.google.dev/gemini-api/docs/openai — the OpenAI surface is at
  // /v1beta/openai, not /v1 (see `openAiRoot`); model from …/docs/models.
  {
    id: 'gemini',
    label: 'Google Gemini',
    group: 'vendor',
    kind: KIND_OPENAI,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-3.8-flash',
  },
  // https://docs.mistral.ai/api/ — `-latest` follows the current Medium, which
  // Mistral describes as its frontier model for coding.
  { id: 'mistral', label: 'Mistral AI', group: 'vendor', kind: KIND_OPENAI, baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-medium-latest' },
  // https://api-docs.deepseek.com/ — documented at the bare root, no /v1.
  { id: 'deepseek', label: 'DeepSeek', group: 'vendor', kind: KIND_OPENAI, baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' },
  // https://docs.x.ai/docs/models — chat completions is xAI's "legacy" surface
  // but still served; the Responses API would be a second dialect.
  { id: 'xai', label: 'xAI (Grok)', group: 'vendor', kind: KIND_OPENAI, baseUrl: 'https://api.x.ai/v1', model: 'grok-4.7' },
  // https://platform.kimi.ai/docs/api/chat
  { id: 'moonshot', label: 'Moonshot AI (Kimi)', group: 'vendor', kind: KIND_OPENAI, baseUrl: 'https://api.moonshot.ai/v1', model: 'kimi-k3' },
  { id: 'openrouter', label: 'OpenRouter', group: 'host', kind: KIND_OPENAI, baseUrl: 'https://openrouter.ai/api', model: 'openai/gpt-4o-mini' },
  // https://console.groq.com/docs/openai; gpt-oss-120b allows 65 536 output
  // tokens (https://console.groq.com/docs/models).
  { id: 'groq', label: 'Groq', group: 'host', kind: KIND_OPENAI, baseUrl: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b' },
  // https://docs.together.ai/docs/openai-api-compatibility
  { id: 'together', label: 'Together AI', group: 'host', kind: KIND_OPENAI, baseUrl: 'https://api.together.ai/v1', model: 'openai/gpt-oss-120b' },
  // https://docs.fireworks.ai/tools-sdks/openai-compatibility
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    group: 'host',
    kind: KIND_OPENAI,
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    model: 'accounts/fireworks/models/gpt-oss-120b',
  },
  // https://inference-docs.cerebras.ai/api-reference/chat-completions; 32K of
  // output on the free tier (https://inference-docs.cerebras.ai/models/openai-oss).
  { id: 'cerebras', label: 'Cerebras', group: 'host', kind: KIND_OPENAI, baseUrl: 'https://api.cerebras.ai/v1', model: 'gpt-oss-120b' },
  // https://huggingface.co/docs/inference-providers/index — one HF token, the
  // router picks the backend (`:fastest` by default).
  {
    id: 'huggingface',
    label: 'Hugging Face (Inference Providers)',
    group: 'host',
    kind: KIND_OPENAI,
    baseUrl: 'https://router.huggingface.co/v1',
    model: 'openai/gpt-oss-120b',
  },
  // fal.ai exposes an OpenAI-compatible passthrough (routed via OpenRouter), so
  // the existing translation covers it — only the auth scheme differs: fal wants
  // `Key <id>:<secret>`, and reads a `Bearer` as a JWT ("Invalid token").
  {
    id: 'fal',
    label: 'fal.ai (Claude, GPT, Gemini, Qwen… via OpenRouter)',
    group: 'host',
    kind: KIND_OPENAI,
    auth: 'key',
    baseUrl: 'https://fal.run/openrouter/router/openai',
    model: 'openai/gpt-4o-mini',
  },
  // Last, always: the escape hatch. The names in the label are the ones with no
  // preset of their own; LM Studio is one here because an ADMIN endpoint is
  // trusted past the SSRF guard (a local model is a supported setup).
  { id: 'openai-compatible', label: 'Compatible OpenAI (Qwen, Cohere, LM Studio, vLLM…)', group: 'custom', kind: KIND_OPENAI, baseUrl: '', model: '' },
]
export const TEXT_PROVIDER_IDS = TEXT_PROVIDERS.map((p) => p.id)

const byId = (id) => TEXT_PROVIDERS.find((p) => p.id === id) || null

/**
 * Does this look like an IMAGE/VIDEO model id pasted into a TEXT model field?
 *
 * Easy mistake with fal, which sells both under one key: the image endpoint
 * (`queue.fal.run/<id>`) takes ids like `fal-ai/bytedance/seedream/v4.5/
 * text-to-image`, while the LLM endpoint is an OpenRouter passthrough that only
 * knows `vendor/model` chat ids. Pasting the former into the latter fails with a
 * bare `HTTP 400 … is not a valid model ID`, which explains nothing.
 *
 * Kept deliberately narrow — a false positive would nag about a legitimate
 * model. Mirrored in src/components/TextProviderSettings.tsx for the live hint.
 */
export function looksLikeImageModel(id) {
  return /(?:text|image)-to-(?:image|video)|\bseedream\b|\bflux\b|stable-?diffusion|\bsdxl\b|\bimagen\b|\bdall-?e\b|\bveo\b|\bkling\b/i.test(
    String(id || ''),
  )
}

/**
 * Three independent profiles:
 *  - 'generation'  — writes the screens (the classic path).
 *  - 'inspiration' — Muse's dossier/vision work. Often deserves a different
 *    model: vision-capable, or simply cheaper since it writes no code.
 *  - 'free'        — EVERYTHING an account on the free plan asks of a model,
 *    generation and inspiration alike (server/plan.js). A model that costs
 *    nothing: a free tier, or one running on the server itself.
 * The inspiration profile is OPTIONAL: leaving its provider empty makes Muse
 * reuse the generation model, which is the previous single-model behaviour.
 * The free profile is optional too, and it borrows NOTHING when empty — see
 * `resolveTextTarget`.
 */
export const TEXT_PROFILES = ['generation', 'inspiration', 'free']

function emptyProfile() {
  const p = { provider: '' } // '' = not configured
  for (const def of TEXT_PROVIDERS) {
    p[def.id] = { baseUrl: def.baseUrl, apiKey: '', model: def.model }
  }
  return p
}

export function defaultTextConfig() {
  return { generation: emptyProfile(), inspiration: emptyProfile(), free: emptyProfile() }
}

/**
 * Older configs stored ONE profile at the root. Lift it into `generation` so an
 * existing instance keeps working untouched after the upgrade.
 */
function liftLegacy(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.generation || raw.inspiration || raw.free) return raw // already the new shape
  if (typeof raw.provider !== 'string') return null
  return { generation: raw, inspiration: emptyProfile(), free: emptyProfile() }
}

const str = (v, fallback = '') => (typeof v === 'string' ? v.trim() : fallback)

/** undefined/'' → keep; null → clear; string → set. */
const secret = (next, prev) => {
  if (next === null) return ''
  if (next === undefined) return prev
  const s = str(next)
  return s === '' ? prev : s
}

/** Merge one profile (the previous single-config logic). */
function mergeProfile(current, patch) {
  const base = { ...emptyProfile(), ...(current || {}) }
  const p = patch && typeof patch === 'object' ? patch : {}
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

export function mergeTextConfig(current, patch) {
  const base = liftLegacy(current) || { ...defaultTextConfig(), ...(current || {}) }
  const p = liftLegacy(patch) || (patch && typeof patch === 'object' ? patch : {})
  return {
    generation: mergeProfile(base.generation, p.generation),
    inspiration: mergeProfile(base.inspiration, p.inspiration),
    free: mergeProfile(base.free, p.free),
  }
}

function publicProfile(prof) {
  const c = { ...emptyProfile(), ...(prof || {}) }
  const out = { provider: c.provider || '' }
  for (const def of TEXT_PROVIDERS) {
    const v = c[def.id] || {}
    out[def.id] = { baseUrl: v.baseUrl || '', model: v.model || '', hasApiKey: Boolean(v.apiKey) }
  }
  return out
}

/** Browser-safe projection: secrets replaced by booleans. */
export function publicTextConfig(cfg) {
  const c = liftLegacy(cfg) || { ...defaultTextConfig(), ...(cfg || {}) }
  return {
    providers: TEXT_PROVIDERS.map((p) => ({ id: p.id, label: p.label, group: p.group })),
    profiles: TEXT_PROFILES,
    generation: publicProfile(c.generation),
    inspiration: publicProfile(c.inspiration),
    free: publicProfile(c.free),
  }
}

function resolveProfile(prof) {
  const c = prof || {}
  const def = byId(c.provider)
  if (!def) return null
  const v = c[def.id] || {}
  const baseUrl = str(v.baseUrl, def.baseUrl)
  const model = str(v.model, def.model)
  if (!baseUrl || !model) return null // incomplete → don't hijack the request
  return { id: def.id, kind: def.kind, auth: def.auth || 'bearer', baseUrl, apiKey: v.apiKey || '', model }
}

/**
 * Resolve the configured target for a profile, or null when the admin hasn't set
 * one (the caller then falls back to the credentials the browser sent).
 *
 * 'inspiration' falls back to 'generation' when left unconfigured, so a single
 * model keeps working exactly as before — the second profile is opt-in.
 *
 * 'free' falls back to NOTHING. Borrowing 'generation' the way 'inspiration'
 * does would send every account on the free plan to the paid model the moment
 * the free one was left empty — the one outcome the free plan exists to rule
 * out (server/plan.js).
 *
 * @returns {{kind:string, baseUrl:string, apiKey:string, model:string}|null}
 */
export function resolveTextTarget(cfg, profile = 'generation') {
  const c = liftLegacy(cfg) || cfg || {}
  if (profile === 'free') return resolveProfile(c.free)
  if (profile === 'inspiration') {
    return resolveProfile(c.inspiration) || resolveProfile(c.generation)
  }
  return resolveProfile(c.generation)
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

  /** The active target for a profile, or null to fall back to the browser's own credentials. */
  target(profile = 'generation') {
    return resolveTextTarget(this.config, profile)
  }

  update(patch) {
    this.config = mergeTextConfig(this.config, patch)
    this.lastPersistError = null
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      const tmp = `${this.file}.${crypto.randomBytes(6).toString('hex')}.tmp`
      // 0600: this file holds provider API keys in clear text. The default 0644
      // left the host's billable credentials readable by every other account on
      // the machine — the same reasoning already applied to users.json.
      fs.writeFileSync(tmp, JSON.stringify(this.config, null, 2), { mode: 0o600 })
      fs.renameSync(tmp, this.file)
    } catch (err) {
      // Still applied in memory — never throw. But say so: silently swallowing
      // this meant an admin pasted a key, saw it confirmed, generated happily,
      // and found it gone after a restart with not one line of log.
      this.lastPersistError = err.message
      console.error(`mocky: could not save text-provider config to ${this.file} — ${err.message}`)
    }
    return this.config
  }
}
