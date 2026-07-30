import type { Project } from './project'

/**
 * Reconciling the browser's copy of the projects with the server's.
 *
 * The rule used to be "if the server has anything, the server wins". That loses
 * work in a completely ordinary situation: generate a screen, close the tab
 * within a second. The localStorage flush is immediate, the debounced push to
 * the server is not — so on the next load the server still holds the previous
 * version, and it silently overwrote the newer local one.
 *
 * What we do instead:
 *   - a project that exists on only one side is kept (a whole project is never
 *     dropped by a sync);
 *   - a project that exists on both sides is resolved by `updatedAt` — newest
 *     wins, as a whole;
 *   - deletions travel as tombstones (`deletedAt`), because with a union rule a
 *     project deleted on this device would otherwise be resurrected by the copy
 *     still sitting on the server.
 *
 * This is deliberately not a CRDT. Two devices editing the same project at the
 * same time still resolve to one of the two versions, not a merge of both — but
 * neither side can lose a project it alone knows about, and a stale server can
 * no longer overwrite fresher local work.
 */

/** How long a deleted project keeps its tombstone before being forgotten. */
export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Parse a persisted projects blob, tolerating null/garbage/legacy shapes. */
export function parseProjects(raw: string | null | undefined): Project[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Project[]) : []
  } catch {
    return []
  }
}

/** `updatedAt`, falling back to `createdAt` for records written before it existed. */
function stamp(p: Project): number {
  return typeof p.updatedAt === 'number' ? p.updatedAt : typeof p.createdAt === 'number' ? p.createdAt : 0
}

/**
 * Merge two sets of projects. Neither argument is mutated.
 *
 * `local` wins ties, so a device that is already up to date does not churn its
 * own storage (and `reconcile` can detect "nothing changed" by comparing the
 * serialised result).
 */
export function mergeProjects(local: Project[], server: Project[]): Project[] {
  const byId = new Map<string, Project>()

  for (const p of server) {
    if (p && typeof p.id === 'string') byId.set(p.id, p)
  }
  for (const p of local) {
    if (!p || typeof p.id !== 'string') continue
    const other = byId.get(p.id)
    // >= : ties go to local.
    byId.set(p.id, !other || stamp(p) >= stamp(other) ? p : other)
  }

  const now = Date.now()
  return [...byId.values()]
    // Drop tombstones once they are older than the TTL: by then every device has
    // had ample opportunity to learn about the deletion, and keeping them
    // forever would grow the blob without bound.
    .filter((p) => !(p.deletedAt && now - p.deletedAt > TOMBSTONE_TTL_MS))
    .sort((a, b) => stamp(b) - stamp(a))
}

/** The projects a user should actually see: everything that is not deleted. */
export function visibleProjects(projects: Project[]): Project[] {
  return projects.filter((p) => !p.deletedAt)
}
