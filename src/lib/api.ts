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
  },
}
