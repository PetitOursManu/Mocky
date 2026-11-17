/**
 * "Se connecter avec Kosmy Board" — the browser's side, which is small: the
 * whole OpenID Connect flow runs on the server (server/kosmy-board.js). The
 * page only starts it and reads how it ended from the address it comes back on:
 *
 *   /?kosmy=error&reason=<code>       sign-in refused (shown in the sign-in box)
 *   /?kosmy=linked                    "Relier à Kosmy Board" worked (Settings)
 *   /?kosmy=link-error&reason=<code>  linking refused (Settings)
 *
 * A successful sign-in carries no parameter: the session cookie is the answer.
 */

/** Where the server starts the flow. A plain navigation: the Board is another site. */
export const KOSMY_LOGIN_PATH = '/auth/kosmy-board/login'

export function startKosmyBoardLogin(): void {
  window.location.assign(KOSMY_LOGIN_PATH)
}

export type KosmyReturn =
  | { kind: 'error'; reason: string }
  | { kind: 'linked' }
  | { kind: 'link-error'; reason: string }

/** Read (and remove from the address) how a Kosmy Board round trip ended. Null when it was not one. */
export function takeKosmyReturn(): KosmyReturn | null {
  const url = new URL(window.location.href)
  const status = url.searchParams.get('kosmy')
  if (!status) return null
  const reason = (url.searchParams.get('reason') || 'failed').replace(/[^a-z_]/g, '').slice(0, 32) || 'failed'
  url.searchParams.delete('kosmy')
  url.searchParams.delete('reason')
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  if (status === 'linked') return { kind: 'linked' }
  if (status === 'link-error') return { kind: 'link-error', reason }
  return { kind: 'error', reason }
}

/** The codes the server sends back, each with a sentence in both languages. */
const REASONS = new Set([
  'not_configured',
  'issuer',
  'expired',
  'denied',
  'failed',
  'unreachable',
  'exchange',
  'token',
  'not_linked',
  'maintenance',
  'session',
  'already_linked',
  'other_linked',
])

/** The translation key for a reason code; unknown codes read as a generic failure. */
export function kosmyReasonKey(reason: string): string {
  return `auth.kosmy.reason.${REASONS.has(reason) ? reason : 'failed'}`
}

/**
 * The link outcome, kept from App's startup (which reads the address) until
 * Settings mounts and shows it. Module state on purpose: one tab, read once.
 */
let pendingLinkNotice: KosmyReturn | null = null
export function rememberLinkNotice(r: KosmyReturn): void {
  pendingLinkNotice = r
}
export function takeLinkNotice(): KosmyReturn | null {
  const r = pendingLinkNotice
  pendingLinkNotice = null
  return r
}
