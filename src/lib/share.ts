/**
 * Time-limited links to one screen, for looking at a mockup on a phone.
 *
 * The server side is `server/share.js`; the shape of the bargain is described
 * there. What matters here: reading a share needs no session, which is why
 * `fetchShare` deliberately does NOT go through the authenticated helpers — the
 * whole point is that it works on a device that has never signed in.
 */

export type ShareTtl = '1h' | '24h' | '7d'

export interface ShareSnapshot {
  name: string
  code: string
  componentName: string
  caps: string[]
  w: number
  h: number
  device: 'iphone' | 'none'
  animations: boolean
  expiresAt: number
}

export interface ShareLink {
  token: string
  url: string
  expiresAt: number
}

export interface ShareSummary {
  token: string
  screenId: string
  name: string
  createdAt: number
  expiresAt: number
}

/**
 * The token in `/s/<token>`, or null when this is an ordinary Mocky page.
 *
 * Read from the path rather than a router: Mocky has no URL routing at all, and
 * adding one for a single read-only view would be a larger change than the
 * view. A 64-hex check keeps a stray `/s/anything` from mounting the viewer.
 */
export function shareTokenFromLocation(pathname = window.location.pathname): string | null {
  const m = /^\/s\/([a-f0-9]{64})\/?$/.exec(pathname)
  return m ? m[1] : null
}

/** Fetch a shared screen. No credentials — the URL is the whole authority. */
export async function fetchShare(token: string): Promise<ShareSnapshot> {
  const res = await fetch(`/api/share/${token}`, { credentials: 'omit' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'This link has expired or was revoked.')
  }
  return res.json()
}

export async function createShare(
  snapshot: {
    screenId: string
    name: string
    code: string
    componentName: string
    caps: string[]
    w: number
    h: number
    device: 'iphone' | 'none'
    animations?: boolean
  },
  ttl: ShareTtl = '24h',
): Promise<ShareLink> {
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...snapshot, ttl }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Could not create the link.')
  return body
}

export async function listShares(): Promise<ShareSummary[]> {
  const res = await fetch('/api/share')
  if (!res.ok) return []
  return (await res.json()).shares || []
}

export async function revokeShare(token: string): Promise<boolean> {
  const res = await fetch(`/api/share/${token}`, { method: 'DELETE' })
  if (!res.ok) return false
  return Boolean((await res.json()).revoked)
}

/** "expires in 3 h" as a plain count, for a label the viewer can trust. */
export function expiresInMinutes(expiresAt: number, now = Date.now()): number {
  return Math.max(0, Math.round((expiresAt - now) / 60_000))
}
