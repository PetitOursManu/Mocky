/**
 * "Sign in with Dashy" — client-side helpers for the SSO redirect flow.
 *
 * The flow is:
 *   1. We store an opaque `state` in sessionStorage and redirect the browser
 *      to `${dashyUrl}/api/sso/authorize?redirect_uri=<callback>&state=<state>`.
 *   2. Dashy authenticates the user (respecting 2FA), signs a short-lived HS256
 *      token, and redirects back to `${ourOrigin}/sso/dashy/callback?token=…&state=…`.
 *   3. Our backend verifies the token, sets the session cookie, and redirects
 *      to `/?sso=ok&state=…`. App.tsx checks the state matches and reloads.
 *
 * The shared secret never touches the browser — verification is server-side.
 */

const STATE_KEY = 'mocky.sso.state.v1'
const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes (token lives 60s, but login may take longer)

interface StoredState {
  value: string
  expires: number
}

function loadStoredState(): StoredState | null {
  try {
    const raw = sessionStorage.getItem(STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredState
    if (Date.now() > parsed.expires) {
      sessionStorage.removeItem(STATE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function clearStoredState() {
  sessionStorage.removeItem(STATE_KEY)
}

/** The Mocky callback URL Dashy must redirect to (same-origin /sso/dashy/callback). */
function callbackUrl(): string {
  return `${window.location.origin}/sso/dashy/callback`
}

/**
 * Kick off the SSO flow by redirecting to Dashy's authorize endpoint.
 * `dashyUrl` is the public origin of the Dashy instance (from /api/config).
 */
export function startDashySso(dashyUrl: string): void {
  const state = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)
  const stored: StoredState = { value: state, expires: Date.now() + STATE_TTL_MS }
  sessionStorage.setItem(STATE_KEY, JSON.stringify(stored))

  const authorize = new URL(`${dashyUrl.replace(/\/+$/, '')}/api/sso/authorize`)
  authorize.searchParams.set('redirect_uri', callbackUrl())
  authorize.searchParams.set('state', state)
  window.location.assign(authorize.toString())
}

/**
 * On return from SSO (`?sso=ok&state=…`), validate the echoed state against
 * the one we stored. Returns true if it matches (and clears the stored value),
 * false otherwise. On error returns `{ error: reason }`.
 */
export function checkSsoReturn(): { ok: true } | { ok: false; error: string } {
  const params = new URLSearchParams(window.location.search)
  const status = params.get('sso')
  if (!status) return { ok: false, error: 'no-sso-param' }

  if (status === 'error') {
    clearStoredState()
    return { ok: false, error: params.get('reason') || 'unknown-error' }
  }

  if (status === 'ok') {
    const expected = loadStoredState()
    const returnedState = params.get('state') || ''
    clearStoredState()
    if (!expected || expected.value !== returnedState) {
      return { ok: false, error: 'state-mismatch' }
    }
    return { ok: true }
  }

  return { ok: false, error: 'unknown-status' }
}

/** Remove the SSO query params from the URL without reloading. */
export function cleanSsoQueryParams(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('sso')
  url.searchParams.delete('state')
  url.searchParams.delete('reason')
  window.history.replaceState({}, '', url.toString())
}