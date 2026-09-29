export type ProviderId =
  | 'ollama-cloud'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'mistral'
  | 'deepseek'
  | 'xai'
  | 'moonshot'
  | 'openrouter'
  | 'groq'
  | 'together'
  | 'fireworks'
  | 'cerebras'
  | 'huggingface'
  | 'openai-compatible'

/**
 * Which wire format a provider speaks. Mocky always talks Ollama's `/api/chat`
 * shape internally; the server translates when the target speaks OpenAI's.
 */
export type ProviderKind = 'ollama' | 'openai'

/** What a person is choosing between — see `group` in server/text/config.js. */
export type ProviderGroup = 'vendor' | 'host' | 'custom'

export interface ProviderOption {
  id: ProviderId
  label: string
  group: ProviderGroup
  kind: ProviderKind
  defaultBaseUrl: string
  defaultModel: string
  /** Where a key for this provider is made — shown under the key field. */
  keyUrl?: string
}

/**
 * The providers a user can pick with their OWN key.
 *
 * This list used to hold exactly one entry, Ollama — not because the others
 * could not work, but because the browser never told the server which dialect
 * its endpoint spoke, so anything non-Ollama would have been forwarded in the
 * wrong shape. The translation itself already existed and was in daily use for
 * admin-configured providers. `kind` is that missing piece of information; it
 * rides along in a header (see lib/proxy.ts), the same way the Muse profile
 * already does, and the same server-side translator handles both paths.
 *
 * Deliberately mirrors TEXT_PROVIDERS in server/text/config.js so that "bring
 * your own key" and "the admin configured it" offer the same choices — ids,
 * kinds, base URLs and default models, held equal by
 * tests/text-providers-mirror.test.js. The sources for each vendor's URL and
 * model, and why Cohere and Qwen have no preset, are on that list. fal is
 * server-only: its `Key <id>:<secret>` scheme cannot ride the Bearer header
 * lib/proxy.ts sends.
 *
 * The first entry is the default for a fresh browser (`defaultSettings`), so
 * Ollama Cloud stays first; the UI groups the rest (lib/providerGroups.ts).
 */
export const PROVIDERS: ProviderOption[] = [
  {
    id: 'ollama-cloud',
    label: 'Ollama Cloud',
    group: 'host',
    kind: 'ollama',
    defaultBaseUrl: 'https://ollama.com',
    defaultModel: 'gpt-oss:120b',
    keyUrl: 'https://ollama.com/settings/keys',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    group: 'vendor',
    kind: 'openai',
    defaultBaseUrl: 'https://api.openai.com',
    defaultModel: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    group: 'vendor',
    kind: 'openai',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-5',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    group: 'vendor',
    kind: 'openai',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-3.8-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    group: 'vendor',
    kind: 'openai',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-medium-latest',
    keyUrl: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    group: 'vendor',
    kind: 'openai',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-flash',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    group: 'vendor',
    kind: 'openai',
    defaultBaseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-4.7',
    keyUrl: 'https://console.x.ai',
  },
  {
    id: 'moonshot',
    label: 'Moonshot AI (Kimi)',
    group: 'vendor',
    kind: 'openai',
    defaultBaseUrl: 'https://api.moonshot.ai/v1',
    defaultModel: 'kimi-k3',
    keyUrl: 'https://platform.kimi.ai',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    group: 'host',
    kind: 'openai',
    defaultBaseUrl: 'https://openrouter.ai/api',
    defaultModel: 'openai/gpt-4o-mini',
    keyUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'groq',
    label: 'Groq',
    group: 'host',
    kind: 'openai',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-120b',
    keyUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'together',
    label: 'Together AI',
    group: 'host',
    kind: 'openai',
    defaultBaseUrl: 'https://api.together.ai/v1',
    defaultModel: 'openai/gpt-oss-120b',
    keyUrl: 'https://api.together.ai/settings/api-keys',
  },
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    group: 'host',
    kind: 'openai',
    defaultBaseUrl: 'https://api.fireworks.ai/inference/v1',
    defaultModel: 'accounts/fireworks/models/gpt-oss-120b',
    keyUrl: 'https://fireworks.ai/account/api-keys',
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    group: 'host',
    kind: 'openai',
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
    defaultModel: 'gpt-oss-120b',
    keyUrl: 'https://cloud.cerebras.ai',
  },
  {
    id: 'huggingface',
    label: 'Hugging Face (Inference Providers)',
    group: 'host',
    kind: 'openai',
    defaultBaseUrl: 'https://router.huggingface.co/v1',
    defaultModel: 'openai/gpt-oss-120b',
    keyUrl: 'https://huggingface.co/settings/tokens',
  },
  // Last, always. Unlike the admin list it names no LM Studio: a browser-
  // supplied endpoint goes through the SSRF guard, so a model on localhost is
  // refused here by design (server/provider-proxy.js).
  {
    id: 'openai-compatible',
    label: 'Compatible OpenAI (Qwen, Cohere, vLLM…)',
    group: 'custom',
    kind: 'openai',
    defaultBaseUrl: '',
    defaultModel: '',
  },
]

/** The dialect for a stored provider id, defaulting to Ollama for old saves. */
export function providerKind(id: string): ProviderKind {
  return PROVIDERS.find((p) => p.id === id)?.kind ?? 'ollama'
}

export interface Settings {
  provider: ProviderId
  baseUrl: string
  apiKey: string
  model: string
  /** Run a cheap planner pass before generating (slower, better structure). */
  usePlanner: boolean
}

import { reportStorageFailure } from './sync'

const STORAGE_KEY = 'mocky.settings.v1'

export function defaultSettings(): Settings {
  const p = PROVIDERS[0]
  return {
    provider: p.id,
    baseUrl: p.defaultBaseUrl,
    apiKey: '',
    model: p.defaultModel,
    usePlanner: true,
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings()
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...defaultSettings(), ...parsed }
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(s: Settings): void {
  // Guarded for the same reason as saveDesign: SettingsPanel writes from a
  // useEffect, so a quota error here reached the root ErrorBoundary and typing
  // one character in Settings blanked the whole app.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch (err) {
    reportStorageFailure(err)
  }
}
