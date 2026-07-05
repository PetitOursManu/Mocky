import { api } from './api'

const PROJECTS_KEY = 'mocky.projects.v1'
const DESIGN_KEY = 'mocky.design.v1'

let enabled = false
let timer: number | null = null

/** Turn server-sync on/off (on when signed in). */
export function enableSync(on: boolean) {
  enabled = on
}

/** Debounced push of the local projects + design to the server. */
export function scheduleSync() {
  if (!enabled) return
  if (timer) clearTimeout(timer)
  timer = window.setTimeout(pushNow, 800)
}

/**
 * Push with a small exponential-backoff retry (up to ~30s). Surfaces transient
 * network failures instead of silently dropping the sync. The `pending`
 * promise lets the UI show a "syncing…" / "sync failed" indicator.
 */
let attempt = 0
let pending: Promise<void> | null = null

export function syncStatus(): Promise<void> | null {
  return pending
}

export async function pushNow(): Promise<void> {
  if (!enabled) return
  if (pending) return pending // already in flight — coalesce
  pending = doPushWithRetry()
  try {
    await pending
  } finally {
    pending = null
  }
}

async function doPushWithRetry(): Promise<void> {
  const projects = localStorage.getItem(PROJECTS_KEY)
  const design = localStorage.getItem(DESIGN_KEY)
  const maxAttempts = 5
  while (attempt < maxAttempts) {
    try {
      await api.putData(projects, design)
      attempt = 0
      return
    } catch {
      attempt++
      if (attempt >= maxAttempts) {
        // Give up — the next user action will schedule a fresh sync.
        attempt = 0
        throw new Error('Sync failed after retries')
      }
      // Backoff: 1s, 2s, 4s, 8s…
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)))
    }
  }
}

/**
 * On sign-in (or startup while signed in): if the server has data, adopt it
 * locally; otherwise push the current local data up (so a new account keeps
 * whatever you already made). Returns true when local storage was changed
 * (the caller should reload so the running stores pick it up).
 */
export async function reconcileOnLogin(): Promise<boolean> {
  const server = await api.getData()
  const localProjects = localStorage.getItem(PROJECTS_KEY)
  const localDesign = localStorage.getItem(DESIGN_KEY)
  const hasServerProjects = server.projects && server.projects !== 'null' && server.projects !== '[]'

  if (hasServerProjects) {
    const changed = server.projects !== localProjects || (server.design ?? '') !== (localDesign ?? '')
    if (server.projects != null) localStorage.setItem(PROJECTS_KEY, server.projects)
    if (server.design != null) localStorage.setItem(DESIGN_KEY, server.design)
    return changed
  }
  await api.putData(localProjects, localDesign)
  return false
}
