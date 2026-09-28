/**
 * The administrator's announcement, as far as this tab knows.
 *
 * Fed by the same once-a-minute poll of /api/config as the maintenance state
 * (MaintenanceBanner owns it), and by the dashboard when the admin publishes one
 * so their own tab shows it without waiting for the poll.
 *
 * A dismissal is remembered per announcement ID in localStorage: closing
 * today's notice must not hide tomorrow's, and the server mints a new id when
 * the text changes for exactly that reason.
 */
import type { Announcement } from './dashboard'

const DISMISSED_KEY = 'mocky.announcement.dismissed'

let state: Announcement | null = null
const listeners = new Set<(a: Announcement | null) => void>()

export function getAnnouncement(): Announcement | null {
  return state
}

export function onAnnouncement(cb: (a: Announcement | null) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function setAnnouncement(next: Announcement | null | undefined): void {
  const a = next && typeof next.message === 'string' && next.message ? next : null
  if (a?.id === state?.id && a?.message === state?.message && a?.tone === state?.tone) return
  state = a
  for (const cb of listeners) cb(state)
}

export function isDismissed(id: string): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === id
  } catch {
    return false
  }
}

export function dismiss(id: string): void {
  try {
    localStorage.setItem(DISMISSED_KEY, id)
  } catch {
    /* private mode: it comes back on the next load, which is the safe side */
  }
}
