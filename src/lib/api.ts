export interface AuthUser {
  username: string
  role: 'admin' | 'user'
}

export interface AdminUser {
  id: string
  username: string
  role: 'admin' | 'user'
  createdAt: number
}

async function req(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options?.headers || {}) },
    credentials: 'same-origin',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export interface ServerData {
  projects: string | null
  design: string | null
}

/** Admin view of the image-generation settings. Secrets are never sent back —
 *  only `has…` booleans, so the UI can show "key set" without exposing it. */
export interface ImagesConfig {
  provider: string
  providers: string[]
  pollinations: { hasToken: boolean }
  fal: { model: string; hasApiKey: boolean; timeoutSec: number }
  openai: { baseUrl: string; model: string; hasApiKey: boolean }
  cloudflare: { accountId: string; model: string; hasApiToken: boolean }
  sdWebui: { baseUrl: string; steps: number }
}

/** Partial update. Omit (or send '') a secret to keep it; send null to clear. */
export interface ImagesConfigPatch {
  provider?: string
  pollinations?: { token?: string | null }
  fal?: { model?: string; apiKey?: string | null; timeoutSec?: number }
  openai?: { baseUrl?: string; model?: string; apiKey?: string | null }
  cloudflare?: { accountId?: string; model?: string; apiToken?: string | null }
  sdWebui?: { baseUrl?: string; steps?: number }
}

/** Admin view of the text (LLM) provider. Secrets are never sent back. */
export interface TextProviderEntry {
  baseUrl: string
  model: string
  hasApiKey: boolean
}
/**
 * Two independent profiles: 'generation' writes the screens, 'inspiration'
 * powers Muse (dossier + vision). Leaving 'inspiration' empty makes it reuse the
 * generation model — the previous single-model behaviour.
 */
export type TextProfile = 'generation' | 'inspiration'
export interface TextProfileConfig {
  /** '' = not configured → each browser uses its own Settings. */
  provider: string
  [providerId: string]: unknown
}
export interface TextConfig {
  providers: { id: string; label: string }[]
  profiles: TextProfile[]
  generation: TextProfileConfig
  inspiration: TextProfileConfig
}
export interface TextProfilePatch {
  provider?: string
  [providerId: string]: unknown
}
export interface TextConfigPatch {
  generation?: TextProfilePatch
  inspiration?: TextProfilePatch
}
export interface TextTestResult {
  ok: boolean
  provider?: string
  profile?: TextProfile
  model?: string
  reply?: string
  error?: string
}

export interface ImagesTestResult {
  ok: boolean
  provider: string
  bytes?: number
  skipped?: boolean
  error?: string
}

export const api = {
  me: () => req('/api/me').then((d) => (d.user ? (d.user as AuthUser) : null)),
  register: (username: string, password: string) =>
    req('/api/register', { method: 'POST', body: JSON.stringify({ username, password }) }).then((d) => d.user as AuthUser),
  login: (username: string, password: string) =>
    req('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) }).then((d) => d.user as AuthUser),
  logout: () => req('/api/logout', { method: 'POST' }),
  getData: () => req('/api/data') as Promise<ServerData>,
  putData: (projects: string | null, design: string | null) =>
    req('/api/data', { method: 'PUT', body: JSON.stringify({ projects, design }) }),

  /** Public config for the sign-in screen. */
  config: () =>
    req('/api/config') as Promise<{
      allowRegistration: boolean
      setup: boolean
      sso: { enabled: boolean; dashyUrl: string | null }
      textProvider?: {
        configured: boolean
        model: string | null
        provider: string | null
        /** Set only when Muse runs on a different model than generation. */
        inspirationModel?: string | null
      }
    }>,

  admin: {
    getConfig: () => req('/api/admin/config') as Promise<{ allowRegistration: boolean }>,
    setAllowRegistration: (allowRegistration: boolean) =>
      req('/api/admin/config', { method: 'PUT', body: JSON.stringify({ allowRegistration }) }) as Promise<{
        allowRegistration: boolean
      }>,
    listUsers: () => req('/api/admin/users').then((d) => d.users as AdminUser[]),
    addUser: (username: string, password: string, role: 'admin' | 'user') =>
      req('/api/admin/users', { method: 'POST', body: JSON.stringify({ username, password, role }) }),
    deleteUser: (id: string) => req(`/api/admin/users/${id}`, { method: 'DELETE' }),

    /** Image-generation provider (Muse). */
    getImagesConfig: () => req('/api/admin/images/config') as Promise<ImagesConfig>,
    setImagesConfig: (patch: ImagesConfigPatch) =>
      req('/api/admin/images/config', { method: 'PUT', body: JSON.stringify(patch) }) as Promise<ImagesConfig>,
    testImagesProvider: (provider?: string) =>
      req('/api/admin/images/test', { method: 'POST', body: JSON.stringify({ provider }) }) as Promise<ImagesTestResult>,

    /** Text (LLM) provider. */
    getTextConfig: () => req('/api/admin/text/config') as Promise<TextConfig>,
    setTextConfig: (patch: TextConfigPatch) =>
      req('/api/admin/text/config', { method: 'PUT', body: JSON.stringify(patch) }) as Promise<TextConfig>,
    testTextProvider: (profile: TextProfile = 'generation') =>
      req('/api/admin/text/test', { method: 'POST', body: JSON.stringify({ profile }) }) as Promise<TextTestResult>,
  },
}
