/**
 * Whether the instance is in maintenance, as far as this tab knows.
 *
 * Two sources feed it, because either alone leaves a gap: `/api/config` (read at
 * start and every minute — see App.tsx) tells a tab that has written nothing,
 * and a refused write (`api.ts` → `noteMaintenance`) tells a tab immediately,
 * without waiting for the next poll. The server is the authority either way;
 * this only decides what the banner says and when sync resumes.
 *
 * No import of `api.ts`: it imports this module, and a cycle between the two
 * would make whichever loads second see the other half-initialised.
 */

export interface MaintenanceState {
  on: boolean
  message: string
  since: number | null
}

let state: MaintenanceState = { on: false, message: '', since: null }
const listeners = new Set<(s: MaintenanceState) => void>()

export function getMaintenance(): MaintenanceState {
  return state
}

export function onMaintenance(cb: (s: MaintenanceState) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function setMaintenance(next: Partial<MaintenanceState> | null | undefined) {
  const merged: MaintenanceState = {
    on: Boolean(next?.on),
    message: typeof next?.message === 'string' ? next.message : '',
    since: typeof next?.since === 'number' ? next.since : null,
  }
  if (merged.on === state.on && merged.message === state.message && merged.since === state.since) return
  state = merged
  for (const cb of listeners) cb(state)
}

/** A write was refused for maintenance: the server said so, so the tab knows now. */
export function noteMaintenance(message?: string) {
  setMaintenance({ on: true, message: message ?? state.message, since: state.since })
}

/**
 * Thrown by `api.ts` for a refusal with `code: 'maintenance'`. Its own class so
 * sync can tell "the server is closed for writing" (pause, keep the local copy,
 * resume later) from "the server is unreachable" (retry, then report a failure).
 */
export class MaintenanceError extends Error {
  readonly maintenance = true
  constructor(message: string) {
    super(message)
    this.name = 'MaintenanceError'
  }
}

export function isMaintenanceError(err: unknown): err is MaintenanceError {
  return err instanceof MaintenanceError || (err as { maintenance?: boolean } | null)?.maintenance === true
}
