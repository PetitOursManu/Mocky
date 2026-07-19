export type ProviderId = 'ollama-cloud'

export interface ProviderOption {
  id: ProviderId
  label: string
  defaultBaseUrl: string
  defaultModel: string
}

export const PROVIDERS: ProviderOption[] = [
  {
    id: 'ollama-cloud',
    label: 'Ollama Cloud',
    defaultBaseUrl: 'https://ollama.com',
    defaultModel: 'gpt-oss:120b',
  },
]

export interface Settings {
  provider: ProviderId
  baseUrl: string
  apiKey: string
  model: string
  /** Run a cheap planner pass before generating (slower, better structure). */
  usePlanner: boolean
}

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}
