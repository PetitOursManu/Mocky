import type { Settings } from './settings'
import { proxyFetch, truncate } from './proxy'

export interface TestResult {
  ok: boolean
  message: string
  models?: string[]
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>
}

export interface ModelsResult {
  ok: boolean
  models: string[]
  error?: string
}

/** Fetches the list of models the provider can serve (GET /api/tags), sorted. */
export async function listModels(s: Settings): Promise<ModelsResult> {
  if (!s.baseUrl.trim()) return { ok: false, models: [], error: 'Base URL is empty.' }

  let res: Response
  try {
    res = await proxyFetch(s, '/api/tags', { method: 'GET' })
  } catch (err) {
    return { ok: false, models: [], error: `Network error: ${err instanceof Error ? err.message : String(err)}` }
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, models: [], error: `Authentication failed (HTTP ${res.status}). Check your API key.` }
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, models: [], error: `HTTP ${res.status} from provider. ${truncate(text, 150)}` }
  }

  let data: OllamaTagsResponse
  try {
    data = (await res.json()) as OllamaTagsResponse
  } catch {
    return { ok: false, models: [], error: 'Reached the provider but the response was not valid JSON.' }
  }

  const models = (data.models || [])
    .map((m) => m.name || m.model)
    .filter((n): n is string => Boolean(n))
    .sort((a, b) => a.localeCompare(b))
  return { ok: true, models }
}

/**
 * Pings the provider and confirms we can reach a model.
 * For Ollama (local or Cloud) we hit GET /api/tags, which lists the models
 * the account/host can serve. We then check whether the configured model is
 * among them.
 */
export async function testConnection(s: Settings): Promise<TestResult> {
  if (!s.baseUrl.trim()) {
    return { ok: false, message: 'Base URL is empty.' }
  }

  let res: Response
  try {
    res = await proxyFetch(s, '/api/tags', { method: 'GET' })
  } catch (err) {
    return { ok: false, message: `Network error: ${err instanceof Error ? err.message : String(err)}` }
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, message: `Authentication failed (HTTP ${res.status}). Check your API key.` }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, message: `HTTP ${res.status} from provider. ${truncate(text, 200)}` }
  }

  let data: OllamaTagsResponse
  try {
    data = (await res.json()) as OllamaTagsResponse
  } catch {
    return { ok: false, message: 'Reached the provider but the response was not valid JSON.' }
  }

  const models = (data.models || [])
    .map((m) => m.name || m.model)
    .filter((n): n is string => Boolean(n))

  if (models.length === 0) {
    return {
      ok: true,
      message: 'Connected, but the provider reported no available models.',
      models: [],
    }
  }

  const wanted = s.model.trim()
  const hasWanted = wanted
    ? models.some((m) => m === wanted || m.split(':')[0] === wanted.split(':')[0])
    : false

  return {
    ok: true,
    message: wanted
      ? hasWanted
        ? `Connected. Model "${wanted}" is available (${models.length} model${models.length === 1 ? '' : 's'} total).`
        : `Connected (${models.length} models), but "${wanted}" was not in the list. Pick one of the available models.`
      : `Connected. ${models.length} model${models.length === 1 ? '' : 's'} available.`,
    models,
  }
}
