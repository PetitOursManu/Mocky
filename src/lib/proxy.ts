import { providerKind, type Settings } from './settings'

/**
 * All provider traffic goes through the Vite dev proxy (see vite.config.ts),
 * which rebuilds `${baseUrl}/<subpath>` server-side. This keeps us clear of
 * browser CORS restrictions and lets the base URL stay configurable.
 */
export const PROXY_PREFIX = '/__provider'

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
