import { normalizeScreen, type Project, type Screen } from './project'

/**
 * Saved versions of a project or of one screen, and the branches they form.
 *
 * The store is `server/versions.js`, and its header says why versions live
 * there rather than in the projects blob: a version is a copy of every screen's
 * code, and the blob sits in a localStorage budget the working copy already
 * strains. What this module holds is the client's half — the calls, and the
 * pure rules for turning a saved version back into a working copy, which are the
 * part worth testing without a server.
 *
 * WHAT RESTORING DOES, AND DOES NOT, TOUCH
 *
 * A project version brings back the screens, the direction (DESIGN.md), the
 * product's name that rides with it, the pinned reference screen and Motion
 * Ultra — everything that IS the design. It does not bring back the project's
 * NAME: that is what the person calls the work, not a state of it, and a branch
 * switch that renamed the project every time would read as a bug.
 *
 * A screen version brings back that screen's content — code, prompt, design
 * record, pictures, size — and leaves where it sits on the canvas and the notes
 * written on it since: a restore is "this screen as it was", not "undo
 * everything I did around it". The current code becomes `previousCode`, so the
 * ordinary Revert undoes a restore like it undoes an edit.
 */

/** The branch a project is on when it never asked for another. Mirrors `MAIN_BRANCH` in server/versions.js. */
export const MAIN_BRANCH = 'main'

/** Longest a branch name may be. Mirrors `BRANCH_MAX` in server/versions.js. */
export const BRANCH_MAX = 40

/** Longest a version's label may be. Mirrors `LABEL_MAX`. */
export const VERSION_LABEL_MAX = 80

export type VersionKind = 'manual' | 'auto' | 'branch' | 'review'
export type VersionScope = 'project' | 'screen'

/** A version as the list shows it: no code, only hashes. */
export interface VersionSummary {
  id: string
  projectId: string
  branch: string
  label: string
  kind: VersionKind
  scope: VersionScope
  screenId?: string
  createdAt: number
  projectName: string
  /** Hash of the project's direction at the time, or null when it had none. */
  designHash: string | null
  screens: { id: string; name: string; codeHash: string; page?: string }[]
}

/**
 * A version with everything in it, as `GET /api/versions/:id` answers: its
 * screens are whole screen records, code included, and carry no hash.
 */
export interface VersionFull extends Omit<VersionSummary, 'screens'> {
  project: {
    name: string
    design?: string
    productName?: string
    referenceScreenId?: string
    ultra?: Project['ultra']
  } | null
  screens: (Partial<Screen> & { id: string })[]
  /** Screens whose code the server could no longer find. */
  missing?: string[]
}

/** Tidy a branch name, or null when nothing is left. Same rule as the server's. */
export function normalizeBranch(name: string | null | undefined): string | null {
  if (typeof name !== 'string') return null
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, BRANCH_MAX)
  return clean || null
}

/** The branch a project's working copy is on. */
export function currentBranch(project: Pick<Project, 'branch'>): string {
  return normalizeBranch(project.branch) || MAIN_BRANCH
}

/**
 * Every branch of a project, with its newest version.
 *
 * Derived from the versions, never stored — a branch is a name on versions, the
 * way a folder is a name on projects — plus the one the working copy is on,
 * which may have no version yet. The main branch first, then by most recent
 * activity, so the list does not reshuffle while someone is reading it… except
 * when they just worked on a branch, which is exactly when they look for it.
 */
export function branchesOf(
  versions: VersionSummary[],
  current: string,
): { name: string; head: VersionSummary | null; count: number }[] {
  const by = new Map<string, VersionSummary[]>()
  for (const v of versions) {
    if (v.scope !== 'project') continue
    const list = by.get(v.branch)
    if (list) list.push(v)
    else by.set(v.branch, [v])
  }
  if (!by.has(current)) by.set(current, [])
  if (!by.has(MAIN_BRANCH)) by.set(MAIN_BRANCH, [])
  return [...by.entries()]
    .map(([name, list]) => {
      const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt)
      return { name, head: sorted[0] ?? null, count: sorted.length }
    })
    .sort((a, b) => {
      if (a.name === MAIN_BRANCH) return -1
      if (b.name === MAIN_BRANCH) return 1
      return (b.head?.createdAt ?? Infinity) - (a.head?.createdAt ?? Infinity)
    })
}

/**
 * The past states of one screen, newest first, one entry per distinct code.
 *
 * Read off EVERY version that holds the screen — its own screen versions and
 * every project version — because a project saved ten times is ten moments of
 * each of its screens, and asking someone to have saved the screen on its own
 * to see its history would hide most of it. Two versions with the same code
 * are one state of the screen, kept at its earliest: that is when it began.
 */
export function screenHistory(
  versions: VersionSummary[],
  screenId: string,
): { version: VersionSummary; codeHash: string; name: string }[] {
  const seen = new Map<string, { version: VersionSummary; codeHash: string; name: string }>()
  const oldestFirst = [...versions].sort((a, b) => a.createdAt - b.createdAt)
  for (const v of oldestFirst) {
    const s = v.screens.find((x) => x.id === screenId)
    if (!s || seen.has(s.codeHash)) continue
    seen.set(s.codeHash, { version: v, codeHash: s.codeHash, name: s.name })
  }
  return [...seen.values()].sort((a, b) => b.version.createdAt - a.version.createdAt)
}

/** What changed between two versions, by screen, read off the hashes alone. */
export interface VersionDiff {
  added: string[]
  removed: string[]
  changed: string[]
  same: string[]
  designChanged: boolean
}

/**
 * `from` → `to`. Hashes only, so a comparison of two forty-screen versions
 * costs nothing until somebody opens a screen side by side.
 */
export function diffVersions(
  from: Pick<VersionSummary, 'screens' | 'designHash'>,
  to: Pick<VersionSummary, 'screens' | 'designHash'>,
): VersionDiff {
  const a = new Map(from.screens.map((s) => [s.id, s.codeHash]))
  const b = new Map(to.screens.map((s) => [s.id, s.codeHash]))
  const out: VersionDiff = { added: [], removed: [], changed: [], same: [], designChanged: from.designHash !== to.designHash }
  for (const [id, hash] of b) {
    if (!a.has(id)) out.added.push(id)
    else if (a.get(id) !== hash) out.changed.push(id)
    else out.same.push(id)
  }
  for (const id of a.keys()) if (!b.has(id)) out.removed.push(id)
  return out
}

/** What `POST /api/versions` is sent for a project version. */
export function projectSnapshot(project: Project) {
  return {
    projectId: project.id,
    scope: 'project' as const,
    branch: currentBranch(project),
    project: {
      name: project.name,
      design: project.design,
      productName: project.productName,
      referenceScreenId: project.referenceScreenId,
      ultra: project.ultra,
    },
    screens: project.screens,
  }
}

/** What `POST /api/versions` is sent for one screen. */
export function screenSnapshot(project: Project, screenId: string) {
  return {
    projectId: project.id,
    scope: 'screen' as const,
    screenId,
    branch: currentBranch(project),
    screens: project.screens.filter((s) => s.id === screenId),
  }
}

/**
 * The working copy a project version turns back into.
 *
 * Screens the version does not hold are TOMBSTONED, not merely dropped: the
 * sync merges by union (`mergeProjects`), so a screen simply left out would be
 * handed back by the server's copy on the next read, and the restore would
 * undo itself a few seconds later. Screens the version does hold are taken
 * off the tombstone list, since restoring is exactly bringing them back.
 */
export function restoreProject(project: Project, version: VersionFull, now = Date.now()): Project {
  const screens = version.screens.map((s, i) => normalizeScreen(s, i))
  const keep = new Set(screens.map((s) => s.id))
  const removedScreens: Record<string, number> = { ...(project.removedScreens || {}) }
  for (const s of project.screens) if (!keep.has(s.id)) removedScreens[s.id] = now
  for (const id of keep) delete removedScreens[id]

  const next: Project = { ...project, screens, removedScreens, updatedAt: now }
  const branch = normalizeBranch(version.branch)
  if (branch && branch !== MAIN_BRANCH) next.branch = branch
  else delete next.branch

  const meta = version.project
  if (meta) {
    if (meta.design && meta.design.trim()) next.design = meta.design
    else delete next.design
    if (meta.productName) next.productName = meta.productName
    else delete next.productName
    if (meta.referenceScreenId && keep.has(meta.referenceScreenId)) next.referenceScreenId = meta.referenceScreenId
    else delete next.referenceScreenId
    if (meta.ultra) next.ultra = { count: meta.ultra.count === 6 ? 6 : 3, ...(meta.ultra.video ? { video: true } : {}) }
    else delete next.ultra
  } else if (next.referenceScreenId && !keep.has(next.referenceScreenId)) {
    delete next.referenceScreenId
  }
  return next
}

/**
 * The patch that turns a screen back into a saved state of itself. See the
 * module note for what is and is not part of "the screen as it was".
 */
export function restoreScreenPatch(current: Screen, saved: Partial<Screen>): Partial<Screen> {
  const s = normalizeScreen({ ...saved, id: current.id, x: current.x, y: current.y }, 0)
  return {
    code: s.code,
    componentName: s.componentName,
    prompt: s.prompt,
    caps: s.caps,
    design: s.design,
    imageHash: s.imageHash,
    imageRole: s.imageRole,
    videoHash: s.videoHash,
    videoFrames: s.videoFrames,
    attachedMedia: s.attachedMedia,
    animations: s.animations,
    theme: s.theme,
    page: s.page,
    quality: s.quality,
    ultra: s.ultra,
    w: s.w,
    h: s.h,
    device: s.device,
    links: s.links,
    previousCode: current.code,
  }
}

// ---------------------------------------------------------------------------
// Calls. Plain fetch, like `lib/share.ts`: the server answers JSON errors with
// an `error` field, and that sentence is what the person should read.

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
  return body as T
}

export async function listVersions(projectId: string): Promise<VersionSummary[]> {
  const out = await call<{ versions: VersionSummary[] }>(`/api/versions?projectId=${encodeURIComponent(projectId)}`)
  return Array.isArray(out.versions) ? out.versions : []
}

export async function saveVersion(
  input: (ReturnType<typeof projectSnapshot> | ReturnType<typeof screenSnapshot>) & { label?: string; kind?: VersionKind },
): Promise<{ version: VersionSummary; unchanged: boolean }> {
  return call('/api/versions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function getVersion(id: string): Promise<VersionFull> {
  return call(`/api/versions/${encodeURIComponent(id)}`)
}

export async function renameVersion(id: string, label: string): Promise<VersionSummary> {
  const out = await call<{ version: VersionSummary }>(`/api/versions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ label }),
  })
  return out.version
}

export async function deleteVersion(id: string): Promise<boolean> {
  const out = await call<{ removed: boolean }>(`/api/versions/${encodeURIComponent(id)}`, { method: 'DELETE' })
  return Boolean(out.removed)
}

export async function deleteBranch(projectId: string, branch: string): Promise<number> {
  const out = await call<{ removed: number }>(
    `/api/versions?projectId=${encodeURIComponent(projectId)}&branch=${encodeURIComponent(branch)}`,
    { method: 'DELETE' },
  )
  return Number(out.removed) || 0
}
