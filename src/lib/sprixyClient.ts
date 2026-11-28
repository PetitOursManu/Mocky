/**
 * The browser's half of Settings → Sprixy. The server (server/sprixy.js) keeps
 * the token and makes every call to Sprixy; the browser only ever learns
 * "connected to <host>" and which projects are shared.
 */

export interface SprixyLink {
  connected: boolean
  host?: string
  owner?: string
  projects?: SprixyProject[]
}

export interface SprixyProject {
  id: string
  name: string
  assetCount: number
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
  return body as T
}

const put = (body: unknown): RequestInit => ({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const getSprixyLink = () => call<SprixyLink>('/api/sprixy')
export const getSprixyCatalog = () => call<{ owner: string; projects: SprixyProject[] }>('/api/sprixy/catalog')
export const connectSprixy = (base: string, token: string) => call<SprixyLink>('/api/sprixy', put({ base, token }))
export const disconnectSprixy = () => call<SprixyLink>('/api/sprixy', put({ base: null }))
