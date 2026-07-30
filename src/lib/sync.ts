import { api } from './api'
import { mergeProjects, parseProjects } from './merge'

const PROJECTS_KEY = 'mocky.projects.v1'
const DESIGN_KEY = 'mocky.design.v1'

let enabled = false
let timer: number | null = null

/** Turn server-sync on/off (on when signed in). */
export function enableSync(on: boolean) {
  enabled = on
}

// ---- observable status -------------------------------------------------
// Previously this module reported failures by throwing into a bare setTimeout,
// which meant a sync that had given up after 30 seconds of retries was visible
// to nobody: not the user, not the console. The UI needs a channel it can
// subscribe to, so a failed sync becomes something you can see and retry.

export type SyncState = 'idle' | 'syncing' | 'failed'

let state: SyncState = 'idle'
const listeners = new Set<(s: SyncState) => void>()

/** Current sync state. */
export function getSyncState(): SyncState {
  return state
}

/** Subscribe to sync-state changes. Returns an unsubscribe function. */
export function onSyncState(cb: (s: SyncState) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function setState(next: SyncState) {
  if (state === next) return
  state = next
  for (const cb of listeners) cb(next)
}

/** True while local changes have not reached the server yet. */
export function hasUnsyncedChanges(): boolean {
  return enabled && (state === 'syncing' || state === 'failed' || dirty)
}

let storageError: string | null = null

/** The last localStorage write failure, if any (usually the quota being full). */
export function getStorageError(): string | null {
  return storageError
}

/**
 * Called when persisting to localStorage throws — the quota is finite (~5 MB)
 * and Mocky stores full component source per screen. This has to be visible:
 * silently failing to save is the worst possible outcome for a design tool.
 */
export function reportStorageFailure(err: unknown) {
  storageError =
    err instanceof Error && /quota/i.test(err.name + err.message)
      ? "Your browser's storage is full — recent changes could not be saved locally. Sign in so projects live on the server, or delete a project you no longer need."
      : `Could not save to browser storage: ${err instanceof Error ? err.message : String(err)}`
  setState('failed')
}

// ---- pushing -----------------------------------------------------------

let pending: Promise<void> | null = null
/**
 * Set by every scheduleSync() that lands while a push is already in flight.
 * Without it those writes were simply dropped: pushNow() returned the in-flight
 * promise, and that promise had already read localStorage — so anything typed
 * during a 15-second retry sequence never reached the server, and the next
 * reconcile would then hand the stale server copy back.
 */
let dirty = false

/** Debounced push of the local projects + design to the server. */
export function scheduleSync() {
  if (!enabled) return
  dirty = true
  if (timer) clearTimeout(timer)
  timer = window.setTimeout(() => {
    void pushNow().catch(() => {
      /* reported through the status channel */
    })
  }, 800)
}

export async function pushNow(): Promise<void> {
  if (!enabled) return
  if (pending) return pending // already in flight — coalesce, `dirty` re-runs it
  setState('syncing')
  pending = doPushWithRetry()
  try {
    await pending
    setState('idle')
  } catch (err) {
    setState('failed')
    throw err
  } finally {
    pending = null
  }
  // A write that arrived mid-flight was not included in what we just pushed.
  if (dirty) {
    await pushNow()
  }
}

async function doPushWithRetry(): Promise<void> {
  const maxAttempts = 5
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Read INSIDE the loop: a retry sequence can span ~15 seconds, and the user
    // keeps working during it. Reading once up front pushed a snapshot that was
    // already stale by the time it landed.
    dirty = false
    const projects = localStorage.getItem(PROJECTS_KEY)
    const design = localStorage.getItem(DESIGN_KEY)
    try {
      await api.putData(projects, design)
      return
    } catch {
      if (attempt === maxAttempts - 1) {
        // Mark dirty again so the next scheduleSync/pushNow retries from scratch
        // rather than assuming this payload made it.
        dirty = true
        throw new Error('Sync failed after retries')
      }
      // Backoff: 1s, 2s, 4s, 8s…
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
    }
  }
}

/**
 * Warn before closing the tab when a sync has actually failed. Deliberately not
 * armed for a merely in-flight push: the local copy is already written, so the
 * only genuinely risky case is "the server never got it and gave up trying".
 * Returns a teardown function.
 */
export function installUnloadGuard(): () => void {
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (state !== 'failed') return
    e.preventDefault()
    e.returnValue = ''
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  return () => window.removeEventListener('beforeunload', onBeforeUnload)
}

// ---- reconciling -------------------------------------------------------

/**
 * On sign-in (or startup while signed in), bring the local and server copies
 * into agreement.
 *
 * This used to be "if the server has anything, the server wins", which loses
 * work whenever the local copy is the fresher one — the common case being a tab
 * closed before the 800 ms debounce fired. It now merges by `updatedAt`
 * (see ./merge), so the newer side wins per project and neither side can drop a
 * project the other alone knows about.
 *
 * Returns true when localStorage changed (the caller reloads so the running
 * stores pick the new data up).
 */
export async function reconcileOnLogin(): Promise<boolean> {
  const server = await api.getData()
  const localRaw = localStorage.getItem(PROJECTS_KEY)
  const localDesign = localStorage.getItem(DESIGN_KEY)

  const merged = mergeProjects(parseProjects(localRaw), parseProjects(server.projects))
  const mergedRaw = JSON.stringify(merged)

  // DESIGN.md has no per-record timestamp, so it rides on the blob-level one the
  // server stamps at write time (server/index.js, PUT /api/data). Adopt the
  // server's only when it is genuinely newer than our newest local project;
  // otherwise the local one stands.
  const localNewest = merged.reduce((max, p) => Math.max(max, p.updatedAt || 0), 0)
  const serverIsNewer = typeof server.updatedAt === 'number' && server.updatedAt > localNewest
  const nextDesign = serverIsNewer && server.design != null ? server.design : localDesign

  const projectsChanged = mergedRaw !== (localRaw ?? '')
  const designChanged = (nextDesign ?? '') !== (localDesign ?? '')

  if (projectsChanged) localStorage.setItem(PROJECTS_KEY, mergedRaw)
  if (designChanged && nextDesign != null) localStorage.setItem(DESIGN_KEY, nextDesign)

  // Push whenever the merge produced something the server does not have yet —
  // typically because the local side contributed the newer copy.
  const serverIsStale =
    mergedRaw !== (server.projects ?? '') || (nextDesign ?? '') !== (server.design ?? '')
  if (serverIsStale) await api.putData(mergedRaw, nextDesign ?? null)

  return projectsChanged || designChanged
}
