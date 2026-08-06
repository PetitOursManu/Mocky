export interface AuthUser {
  username: string
  role: 'admin' | 'user'
  /**
   * An admin created (or reset) this account and asked for a new password at
   * the first sign-in. The server only raises the flag — refusing to serve the
   * app until it is cleared is the client's job.
   */
  mustChangePassword?: boolean
  /** This account has a picture. */
  avatar?: boolean
  /** When it last changed — used as a cache-buster in the avatar URL. */
  avatarAt?: number
}

export interface AdminUser {
  id: string
  username: string
  role: 'admin' | 'user'
  createdAt: number
  /** Still owes a password change (see AuthUser). */
  mustChangePassword?: boolean
  /** Signs in through Dashy and has no local password to reset. */
  sso?: boolean
}

/** One row of the usage report — see server/usage.js for how it is computed. */
export interface UsageRow {
  id: string
  username: string
  role: 'admin' | 'user'
  createdAt: number | null
  projects: number
  screens: number
  /** Tombstones: deleted projects that still occupy the blob so the deletion can sync. */
  deletedProjects: number
  /**
   * False when the projects blob would not parse. The counts above are then 0
   * because they are unknown, not because they are zero — the UI must say so
   * rather than show a confident nought.
   */
  readable: boolean
  /** How many library items name this user as an owner. */
  media: number
  bytes: { data: number; avatar: number; media: number; total: number }
}

export interface UsageReport {
  users: UsageRow[]
  /**
   * Media whose owner is unknown: everything that existed before ownership was
   * recorded, plus anything belonging to a deleted account. Its own line rather
   * than a share of everyone's.
   */
  unattributed: { bytes: number; count: number }
  /** The instance-wide disk budget, or null when the report could not be built. */
  instance: { bytes: number; maxBytes: number; ratio: number | null } | null
  /** Present only when the report failed; the rest of the Admin screen still works. */
  error?: string
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
  /**
   * When the server last accepted a write. The server has always stamped it
   * (PUT /api/data); the client simply never declared it, so every reconcile
   * had to guess which side was fresher — and guessed "server", which is how
   * local work got overwritten.
   */
  updatedAt?: number
}

/**
 * Two image profiles, because the jobs differ: 'content' makes the pictures
 * embedded in the screen (hero, produits — fast and cheap, several per screen),
 * 'inspiration' makes the single art-direction reference the model looks at
 * (must render a convincing layout — worth a stronger, slower model).
 * An empty 'inspiration' provider reuses 'content'.
 */
export type ImageProfile = 'content' | 'inspiration'

/** Admin view of one profile. Secrets are never sent back — only `has…`
 *  booleans, so the UI can show "key set" without exposing it. */
export interface ImagesProfileConfig {
  provider: string
  pollinations: { hasToken: boolean }
  fal: { model: string; hasApiKey: boolean; timeoutSec: number }
  openai: { baseUrl: string; model: string; hasApiKey: boolean }
  cloudflare: { accountId: string; model: string; hasApiToken: boolean }
  sdWebui: { baseUrl: string; steps: number }
}
/**
 * Scroll-sequence video. Its own shape rather than a third profile: one
 * provider instead of six, a timeout in minutes rather than seconds, and the
 * frame-cutting settings, which have no image equivalent.
 */
export interface ImagesVideoConfig {
  provider: string
  fal: { model: string; hasApiKey: boolean; timeoutSec: number }
  frames: { fps: number; width: number; max: number }
}

export interface ImagesConfig {
  providers: string[]
  profiles: ImageProfile[]
  content: ImagesProfileConfig
  inspiration: ImagesProfileConfig
  videoProviders: string[]
  video: ImagesVideoConfig
}

/** Partial update. Omit (or send '') a secret to keep it; send null to clear. */
export interface ImagesProfilePatch {
  provider?: string
  pollinations?: { token?: string | null }
  fal?: { model?: string; apiKey?: string | null; timeoutSec?: number }
  openai?: { baseUrl?: string; model?: string; apiKey?: string | null }
  cloudflare?: { accountId?: string; model?: string; apiToken?: string | null }
  sdWebui?: { baseUrl?: string; steps?: number }
}
export interface ImagesVideoPatch {
  provider?: string
  fal?: { model?: string; apiKey?: string | null; timeoutSec?: number }
  frames?: { fps?: number; width?: number; max?: number }
}
export interface ImagesConfigPatch {
  content?: ImagesProfilePatch
  inspiration?: ImagesProfilePatch
  video?: ImagesVideoPatch
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

/** What `POST /api/admin/text/models` answers: the ids this key can reach. */
export interface TextModelsResult {
  ok: boolean
  provider?: string
  profile?: TextProfile
  models?: string[]
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

  /**
   * Change your own password. The server signs every other device out and
   * re-issues this one's cookie, so the caller stays signed in.
   */
  changePassword: (current: string, next: string) =>
    req('/api/account/password', { method: 'POST', body: JSON.stringify({ current, next }) }).then(
      (d) => d.user as AuthUser,
    ),

  /**
   * Upload an account picture. The File is sent as the raw body, exactly like
   * the image library does — no multipart, no parser dependency, and the
   * browser already sets the right content type from the File itself.
   */
  setAvatar: async (file: File) => {
    const res = await fetch('/api/account/avatar', {
      method: 'POST',
      headers: { 'content-type': file.type },
      body: file,
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Upload failed.')
    return body.user as AuthUser
  },

  removeAvatar: async () => {
    const res = await fetch('/api/account/avatar', { method: 'DELETE' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Could not remove the picture.')
    return body.user as AuthUser
  },

  /** Where a signed-in account's own picture lives. Versioned, so it refreshes. */
  avatarUrl: (u: AuthUser | null) => (u?.avatar ? `/api/account/avatar?v=${u.avatarAt || 0}` : null),

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
    usage: () => req('/api/admin/usage') as Promise<UsageReport>,
    addUser: (
      username: string,
      password: string,
      role: 'admin' | 'user',
      mustChangePassword = false,
    ) =>
      req('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username, password, role, mustChangePassword }),
      }),
    /**
     * Reset someone's password. No admin re-authentication — an admin can
     * already delete the account outright. Signs the target out everywhere.
     */
    setUserPassword: (id: string, password: string, mustChange: boolean) =>
      req(`/api/admin/users/${id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password, mustChange }),
      }),
    deleteUser: (id: string) => req(`/api/admin/users/${id}`, { method: 'DELETE' }),

    /** Image-generation provider (Muse). */
    getImagesConfig: () => req('/api/admin/images/config') as Promise<ImagesConfig>,
    setImagesConfig: (patch: ImagesConfigPatch) =>
      req('/api/admin/images/config', { method: 'PUT', body: JSON.stringify(patch) }) as Promise<ImagesConfig>,
    testImagesProvider: (provider?: string, profile: ImageProfile = 'content') =>
      req('/api/admin/images/test', {
        method: 'POST',
        body: JSON.stringify({ provider, profile }),
      }) as Promise<ImagesTestResult>,

    /** Text (LLM) provider. */
    getTextConfig: () => req('/api/admin/text/config') as Promise<TextConfig>,
    setTextConfig: (patch: TextConfigPatch) =>
      req('/api/admin/text/config', { method: 'PUT', body: JSON.stringify(patch) }) as Promise<TextConfig>,
    testTextProvider: (profile: TextProfile = 'generation') =>
      req('/api/admin/text/test', { method: 'POST', body: JSON.stringify({ profile }) }) as Promise<TextTestResult>,
    listTextModels: (profile: TextProfile = 'generation') =>
      req('/api/admin/text/models', { method: 'POST', body: JSON.stringify({ profile }) }) as Promise<TextModelsResult>,
  },
}
