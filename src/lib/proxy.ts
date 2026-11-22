import { providerKind, type Settings } from './settings'

/**
 * All provider traffic goes through the Vite dev proxy (see vite.config.ts),
 * which rebuilds `${baseUrl}/<subpath>` server-side. This keeps us clear of
 * browser CORS restrictions and lets the base URL stay configurable.
 */
export const PROXY_PREFIX = '/__provider'

/**
 * The project the model calls of this page are made for — read by the
 * spending ledger (server/admin/spend.js) to file each call under it.
 *
 * Module state rather than an argument, because a call reaches the provider
 * from thirty places (generation, edits, the planner, Muse, polish, a film…)
 * and every one of them is made while ONE project is open: threading an id
 * through all of them would be thirty chances to forget it. It names, and
 * never authorises — the server checks a charset and nothing else.
 */
let usageProject: string | null = null

/** Set by the project view while it is open, and by the MCP runner for its job. */
export function setUsageProject(id: string | null): void {
  usageProject = id && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null
}

/**
 * The generation the calls of this page belong to, as a trace the server keeps
 * (server/admin/runs.js, `GET /api/runs/:id`): how many calls one prompt cost,
 * how long, how many tokens. Module state for the reason `usageProject` is —
 * thirty call sites — and with the same caveat: two generations started at
 * once in one page share the id of the later one.
 */
let usageRun: string | null = null

export function setUsageRun(id: string | null): void {
  usageRun = id && /^[A-Za-z0-9_-]{8,64}$/.test(id) ? id : null
}

export function currentUsageRun(): string | null {
  return usageRun
}

export function proxyHeaders(s: Settings): Record<string, string> {
  const headers: Record<string, string> = {
    'x-provider-base': s.baseUrl,
    // Which wire format this endpoint speaks. Without it the proxy could only
    // forward verbatim, which is why "bring your own key" was limited to Ollama
    // while the admin path could reach anything — the translator existed, it
    // just had no way to learn that a translation was wanted.
    'x-provider-kind': providerKind(s.provider),
    'content-type': 'application/json',
  }
  if (s.apiKey.trim()) headers['authorization'] = `Bearer ${s.apiKey.trim()}`
  if (usageProject) headers['x-mocky-project'] = usageProject
  if (usageRun) headers['x-mocky-run'] = usageRun
  // Only when chosen: `auto` sends nothing, so the request is the one it was.
  // The server reads it on the person's own key only (lib/reasoning.ts).
  if (s.reasoning && s.reasoning !== 'auto') headers['x-mocky-reasoning'] = s.reasoning
  return headers
}

export async function proxyFetch(
  s: Settings,
  subpath: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${PROXY_PREFIX}${subpath}`, {
    ...init,
    headers: { ...proxyHeaders(s), ...(init?.headers || {}) },
  })
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}
