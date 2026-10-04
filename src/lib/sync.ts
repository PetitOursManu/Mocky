import { api } from './api'
import { mergeProjects, parseProjects } from './merge'
import { isMaintenanceError, onMaintenance } from './maintenance'

const PROJECTS_KEY = 'mocky.projects.v1'
const DESIGN_KEY = 'mocky.design.v1'

let enabled = false
let timer: number | null = null

/**
 * This tab, as the server knows it: its writes carry it, and the events stream
 * it opens carries it, so the server does not tell a tab about its own write.
 * Random per load — it names a tab, not a person.
 */
export const TAB_ID = (() => {
  try {
    return crypto.randomUUID()
  } catch {
    return `tab-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  }
})()

/**
 * Turn server-sync on/off (on when signed in). On also opens the stream that
 * says when another writer changed the account (see `startDataEvents`).
 */
export function enableSync(on: boolean) {
  enabled = on
  if (on) startDataEvents()
  else stopDataEvents()
}

// ---- observable status -------------------------------------------------
// Previously this module reported failures by throwing into a bare setTimeout,
// which meant a sync that had given up after 30 seconds of retries was visible
// to nobody: not the user, not the console. The UI needs a channel it can
// subscribe to, so a failed sync becomes something you can see and retry.

/**
 * `paused`: the server refused the write for maintenance. Not a failure — the
 * local copy is intact and is pushed the moment maintenance ends — so it must
 * not arm the unload warning or read as an error in red.
 */
export type SyncState = 'idle' | 'syncing' | 'failed' | 'paused'

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
  return enabled && (state === 'syncing' || state === 'failed' || state === 'paused' || dirty)
}

/** A translatable reason, resolved by whoever displays it. */
export interface StorageError {
  key: string
  detail?: string
}

let storageError: StorageError | null = null

/** The last localStorage write failure, if any (usually the quota being full). */
export function getStorageError(): StorageError | null {
  return storageError
}

/**
 * Called when persisting to localStorage throws — the quota is finite (~5 MB)
 * and Mocky stores full component source per screen. This has to be visible:
 * silently failing to save is the worst possible outcome for a design tool.
 */
export function reportStorageFailure(err: unknown) {
  // Translated at the point it is shown, not here: this module has no React
  // context, and a message frozen in one language would stay in that language
  // after the user switched. The indicator resolves the key.
  storageError =
    err instanceof Error && /quota/i.test(err.name + err.message)
      ? { key: 'sync.quotaFull' }
      : { key: 'sync.storageFailed', detail: err instanceof Error ? err.message : String(err) }
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
  // Paused for maintenance: every push would be refused. The change is in
  // localStorage and `dirty` remembers it; the resume below sends it.
  if (state === 'paused') return
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
    setState(isMaintenanceError(err) ? 'paused' : 'failed')
    throw err
  } finally {
    pending = null
  }
  // A write that arrived mid-flight was not included in what we just pushed.
  if (dirty && state !== 'paused') {
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
      const answer = await api.putData(projects, design, TAB_ID)
      // The server kept something this copy did not have — a project another
      // device or the MCP runner wrote. Read it back so it appears here.
      if (answer?.merged) void pullNow()
      return
    } catch (err) {
      // Retrying a refusal the server will repeat until an admin lifts it only
      // spends fifteen seconds reaching the same answer. Kept dirty, pushed on
      // resume (below).
      if (isMaintenanceError(err)) {
        dirty = true
        throw err
      }
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
  if (serverIsStale) {
    try {
      await api.putData(mergedRaw, nextDesign ?? null, TAB_ID)
    } catch (err) {
      // During maintenance the merge still stands locally — throwing here would
      // read as "not signed in" to the caller — and it goes up on resume.
      if (!isMaintenanceError(err)) throw err
      dirty = true
      setState('paused')
    }
  }

  return projectsChanged || designChanged
}

// ---- reading back what another writer did --------------------------------

/**
 * Fired on `window` with the server's projects as `detail`. `useProjects`
 * merges them into its state the way it merges another tab's `storage` event —
 * per project, newest wins, nothing only one side knows is dropped — so a screen
 * being generated here survives a read-back that does not have it yet.
 */
export const SERVER_PROJECTS_EVENT = 'mocky:server-projects'

let pulling: Promise<void> | null = null
let pullAgain = false

/**
 * Read the account's projects from the server and hand them to the store.
 *
 * Not `reconcileOnLogin`: that one writes localStorage and asks for a reload,
 * which is right once at sign-in and wrong in a tab somebody is working in. A
 * read-back here goes through React state, and the store's own save writes
 * localStorage and pushes whatever this tab contributed.
 */
export async function pullNow(): Promise<void> {
  if (!enabled) return
  if (pulling) {
    // A second "changed" while the first read is in flight may describe a
    // write the first read missed.
    pullAgain = true
    return pulling
  }
  pulling = (async () => {
    try {
      const server = await api.getData()
      window.dispatchEvent(new CustomEvent(SERVER_PROJECTS_EVENT, { detail: parseProjects(server.projects) }))
    } catch {
      // The next event or the next push asks again; a failed read loses nothing.
    }
  })()
  try {
    await pulling
  } finally {
    pulling = null
  }
  if (pullAgain) {
    pullAgain = false
    await pullNow()
  }
}

let source: EventSource | null = null
let pullTimer: number | null = null

/** Several writes in a burst are one read. */
function schedulePull() {
  if (pullTimer) clearTimeout(pullTimer)
  pullTimer = window.setTimeout(() => {
    pullTimer = null
    void pullNow()
  }, 300)
}

/**
 * Listen for "your projects changed somewhere else" (server/data-events.js).
 *
 * The stream carries a name and nothing else; the data comes from
 * `GET /api/data` with this tab's own session. EventSource reconnects by itself
 * after a network cut or a server restart, and a reconnect reads once: whatever
 * was written while the stream was down was announced to nobody.
 */
function startDataEvents() {
  if (source || typeof EventSource === 'undefined') return
  let opened = false
  const es = new EventSource(`/api/data/events?tab=${encodeURIComponent(TAB_ID)}`)
  source = es
  es.addEventListener('data-changed', schedulePull)
  es.onopen = () => {
    if (opened) schedulePull()
    opened = true
  }
}

function stopDataEvents() {
  source?.close()
  source = null
  if (pullTimer) clearTimeout(pullTimer)
  pullTimer = null
}

// ---- resuming after maintenance -----------------------------------------
// Whatever was refused while the instance was read-only is still in
// localStorage; send it as soon as the instance says it is open again.
onMaintenance((m) => {
  if (m.on || state !== 'paused') return
  setState('idle')
  if (enabled && dirty) {
    void pushNow().catch(() => {
      /* reported through the status channel */
    })
  }
})
