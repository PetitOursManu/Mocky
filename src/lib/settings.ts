export type ProviderId =
  | 'ollama-cloud'
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'openai-compatible'

/**
 * Which wire format a provider speaks. Mocky always talks Ollama's `/api/chat`
 * shape internally; the server translates when the target speaks OpenAI's.
 */
export type ProviderKind = 'ollama' | 'openai'

export interface ProviderOption {
  id: ProviderId
  label: string
  kind: ProviderKind
  defaultBaseUrl: string
  defaultModel: string
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
 * your own key" and "the admin configured it" offer the same choices.
 */
export const PROVIDERS: ProviderOption[] = [
  {
    id: 'ollama-cloud',
    label: 'Ollama Cloud',
    kind: 'ollama',
    defaultBaseUrl: 'https://ollama.com',
    defaultModel: 'gpt-oss:120b',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai',
    defaultBaseUrl: 'https://api.openai.com',
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    kind: 'openai',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-5',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai',
    defaultBaseUrl: 'https://openrouter.ai/api',
    defaultModel: 'openai/gpt-4o-mini',
  },
  {
    id: 'openai-compatible',
    label: 'Compatible OpenAI (Groq, Together, LM Studio, vLLM…)',
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
