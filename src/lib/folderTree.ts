import { hashCode } from './codeHash'
import type { Project, Screen } from './project'

/**
 * The folders of an account, as a tree.
 *
 * A folder used to be a name on a project, which made it free and flat: no
 * registry, and no folder that was not holding something. A tree needs what
 * that design ruled out on purpose — a parent to point at, and a folder that
 * exists before anything is in it — so a folder is now a record of its own,
 * travelling beside the projects in the same blob and merged by the same rule.
 *
 * Two devices can disagree about a tree in ways they cannot about a list: one
 * deletes a parent while the other files something in it, or each moves one of
 * two folders under the other. Nothing here repairs the records. `buildFolderTree`
 * READS them so that a missing parent is the root and a cycle has a way out, the
 * same answer on every device, and the next deliberate move writes the truth.
 */

export interface Folder {
  id: string
  name: string
  /** Null at the top. */
  parentId: string | null
  updatedAt: number
  /** Tombstone, like a project's. */
  deletedAt?: number
}

export const FOLDERS_KEY = 'mocky.folders.v1'
export const FOLDER_NAME_MAX = 60
/** Deep enough for any filing scheme; bounded so a path can always be drawn. */
export const FOLDER_MAX_DEPTH = 12
export const FOLDERS_MAX = 3000

/** The bound on a name from when folders were one line of chips. Legacy names only. */
export const FOLDER_MAX_LEN = 32

/** Tidies a legacy folder name, or returns null if there is nothing left. */
export function normalizeFolder(name: string | undefined | null): string | null {
  const clean = (name ?? '').replace(/\s+/g, ' ').trim().slice(0, FOLDER_MAX_LEN)
  return clean.length > 0 ? clean : null
}

export function cleanFolderName(name: string | undefined | null): string | null {
  const clean = (name ?? '').replace(/\s+/g, ' ').trim().slice(0, FOLDER_NAME_MAX)
  return clean.length > 0 ? clean : null
}

/** What storage or a server handed over, kept only where it is a folder. */
export function parseFolders(raw: string | null | undefined): Folder[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const out: Folder[] = []
  for (const f of parsed.slice(0, FOLDERS_MAX)) {
    if (!f || typeof f.id !== 'string' || typeof f.name !== 'string') continue
    const folder: Folder = {
      id: f.id,
      name: f.name,
      parentId: typeof f.parentId === 'string' ? f.parentId : null,
      updatedAt: typeof f.updatedAt === 'number' ? f.updatedAt : 0,
    }
    if (typeof f.deletedAt === 'number') folder.deletedAt = f.deletedAt
    out.push(folder)
  }
  return out
}

/**
 * The id a folder that was only a name gets. Derived from the name, so two
 * devices upgrading apart arrive at one folder instead of two with the same
 * label — and with no project rewritten, so nothing churns through a merge.
 */
export const legacyFolderId = (name: string) => `lg-${hashCode(name)}`

/** The folder a project says it is in. It may have been deleted elsewhere: see `placeOf`. */
export function folderIdOf(p: Pick<Project, 'folderId' | 'folder'>): string | null {
  if (p.folderId) return p.folderId
  const legacy = normalizeFolder(p.folder)
  return legacy ? legacyFolderId(legacy) : null
}

/**
 * `folders` plus a record for every old folder name still in use. The record is
 * stamped 0, so anything a person later does to that folder wins any merge.
 * Returns the same array when there is nothing to add.
 */
export function withLegacyFolders(folders: Folder[], projects: Project[]): Folder[] {
  const known = new Set(folders.map((f) => f.id))
  const added: Folder[] = []
  for (const p of projects) {
    if (p.deletedAt || p.folderId) continue
    const name = normalizeFolder(p.folder)
    if (!name) continue
    const id = legacyFolderId(name)
    if (known.has(id)) continue
    known.add(id)
    added.push({ id, name, parentId: null, updatedAt: 0 })
  }
  return added.length ? [...folders, ...added] : folders
}

const byName = (a: Folder, b: Folder) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

export interface FolderTree {
  has: (id: string | null | undefined) => boolean
  get: (id: string) => Folder | undefined
  children: (id: string | null) => Folder[]
  parentOf: (id: string) => string | null
  /** From the top down to this folder, itself included. */
  pathOf: (id: string) => Folder[]
  all: Folder[]
}

export function buildFolderTree(folders: Folder[]): FolderTree {
  const live = new Map<string, Folder>()
  for (const f of folders) if (!f.deletedAt) live.set(f.id, f)

  const parent = new Map<string, string | null>()
  for (const f of live.values()) parent.set(f.id, f.parentId && live.has(f.parentId) ? f.parentId : null)

  // A cycle is two honest moves on two devices. Its smallest id becomes a root:
  // any rule works so long as every device picks the same one.
  for (const f of live.values()) {
    const seen: string[] = []
    let at: string | null = f.id
    while (at && !seen.includes(at)) {
      seen.push(at)
      at = parent.get(at) ?? null
    }
    if (at) {
      const loop = seen.slice(seen.indexOf(at)).sort()
      parent.set(loop[0], null)
    }
  }

  const kids = new Map<string | null, Folder[]>()
  for (const f of live.values()) {
    const p = parent.get(f.id) ?? null
    const list = kids.get(p)
    if (list) list.push(f)
    else kids.set(p, [f])
  }
  for (const list of kids.values()) list.sort(byName)

  return {
    has: (id) => !!id && live.has(id),
    get: (id) => live.get(id),
    children: (id) => kids.get(id) ?? [],
    parentOf: (id) => parent.get(id) ?? null,
    pathOf: (id) => {
      const out: Folder[] = []
      let at: string | null = live.has(id) ? id : null
      while (at) {
        out.unshift(live.get(at) as Folder)
        at = parent.get(at) ?? null
      }
      return out
    },
    all: [...live.values()].sort(byName),
  }
}

/** Where a project is shown: its folder, or the top when that folder is gone. */
export function placeOf(p: Pick<Project, 'folderId' | 'folder'>, tree: FolderTree): string | null {
  const id = folderIdOf(p)
  return tree.has(id) ? id : null
}

function heightOf(tree: FolderTree, id: string): number {
  return 1 + Math.max(0, ...tree.children(id).map((c) => heightOf(tree, c.id)))
}

/** Moving `id` under `target` keeps a tree, and one that can still be drawn. */
export function canMoveFolder(tree: FolderTree, id: string, target: string | null): boolean {
  if (!tree.has(id) || id === target) return false
  if (target === null) return true
  if (!tree.has(target)) return false
  const path = tree.pathOf(target)
  if (path.some((f) => f.id === id)) return false
  return path.length + heightOf(tree, id) <= FOLDER_MAX_DEPTH
}

/**
 * What dropping on `target` would do. Three answers and not two, because "it is
 * already there" and "it cannot go there" look alike to a drop handler — both
 * refuse — and must not look alike to the person dragging: one is nothing to
 * do, the other is a rule they just ran into and deserve to see.
 */
export type DropVerdict = 'move' | 'here' | 'refused'

export function folderDropVerdict(tree: FolderTree, id: string, target: string | null): DropVerdict {
  if (!tree.has(id)) return 'refused'
  // On itself is where every drag from the tree starts: nothing to do, and
  // not a rule to flash red about before the pointer has even moved.
  if (id === target || tree.parentOf(id) === target) return 'here'
  return canMoveFolder(tree, id, target) ? 'move' : 'refused'
}

/** Projects go anywhere; dropping them where they all already are is nothing. */
export function projectsDropVerdict(places: (string | null)[], target: string | null): DropVerdict {
  return places.length > 0 && places.every((p) => p === target) ? 'here' : 'move'
}

/**
 * One line of the side tree, flattened. The root — "All projects" — is a row
 * too (`id: null`, depth 0, always open), so the keyboard walks one list from
 * the top of the shelf to its last open folder.
 */
export interface TreeRow {
  id: string | null
  depth: number
  hasKids: boolean
  open: boolean
  /** `undefined` for the root, which has no parent to go back to. */
  parent: string | null | undefined
}

export function visibleRows(tree: FolderTree, isOpen: (id: string) => boolean): TreeRow[] {
  const rows: TreeRow[] = [{ id: null, depth: 0, hasKids: tree.children(null).length > 0, open: true, parent: undefined }]
  const walk = (parent: string | null, depth: number) => {
    for (const f of tree.children(parent)) {
      const hasKids = tree.children(f.id).length > 0
      const open = hasKids && isOpen(f.id)
      rows.push({ id: f.id, depth, hasKids, open, parent })
      if (open) walk(f.id, depth + 1)
    }
  }
  walk(null, 1)
  return rows
}

/** What a key does on a tree row — the WAI-ARIA tree pattern, minus type-ahead. */
export type TreeKeyAction =
  | { focus: string | null }
  | { open: string }
  | { close: string }
  | { go: string | null }

export function treeKeyAction(rows: TreeRow[], current: string | null, key: string): TreeKeyAction | null {
  const i = rows.findIndex((r) => r.id === current)
  if (i < 0) return rows.length ? { focus: rows[0].id } : null
  const row = rows[i]
  switch (key) {
    case 'ArrowDown':
      return i + 1 < rows.length ? { focus: rows[i + 1].id } : null
    case 'ArrowUp':
      return i > 0 ? { focus: rows[i - 1].id } : null
    case 'Home':
      return { focus: rows[0].id }
    case 'End':
      return { focus: rows[rows.length - 1].id }
    case 'ArrowRight':
      if (!row.hasKids) return null
      if (!row.open && row.id !== null) return { open: row.id }
      return i + 1 < rows.length ? { focus: rows[i + 1].id } : null
    case 'ArrowLeft':
      if (row.open && row.id !== null) return { close: row.id }
      return row.parent === undefined ? null : { focus: row.parent }
    case 'Enter':
      return { go: row.id }
    default:
      return null
  }
}

/**
 * Where, in the flattened rows, a folder dropped on `target` would appear —
 * the index a placeholder row goes in front of — or null when the target's
 * children are not on show. Siblings are sorted by name, so the place is not a
 * choice the person makes, but it is one they should see before letting go:
 * a folder that vanishes into the middle of a long list reads as lost.
 */
export function insertionIndex(
  rows: TreeRow[],
  tree: FolderTree,
  target: string | null,
  moving: Pick<Folder, 'id' | 'name'>,
): number | null {
  const at = rows.findIndex((r) => r.id === target)
  if (at < 0 || !rows[at].open) return null
  const siblings = tree.children(target).filter((f) => f.id !== moving.id)
  const before = siblings.findIndex((s) => byName(s, moving as Folder) > 0)
  if (before >= 0) {
    const idx = rows.findIndex((r) => r.id === siblings[before].id)
    if (idx >= 0) return idx
  }
  // After the last descendant of the target on show.
  let end = at + 1
  while (end < rows.length && rows[end].depth > rows[at].depth) end++
  return end
}

export interface FolderStats {
  folders: number
  projects: number
  /** Up to three screens from inside, for the folder's picture. */
  covers: Screen[]
}

/** What each folder holds, its subfolders included. */
export function folderStats(tree: FolderTree, projects: Project[]): Map<string, FolderStats> {
  const direct = new Map<string, Project[]>()
  for (const p of projects) {
    const id = placeOf(p, tree)
    if (!id) continue
    const list = direct.get(id)
    if (list) list.push(p)
    else direct.set(id, [p])
  }
  const out = new Map<string, FolderStats>()
  const visit = (f: Folder): FolderStats => {
    const mine = direct.get(f.id) ?? []
    const stats: FolderStats = {
      folders: 0,
      projects: mine.length,
      covers: mine.map((p) => p.screens[0]).filter((s): s is Screen => !!s?.code?.trim()).slice(0, 3),
    }
    for (const child of tree.children(f.id)) {
      const sub = visit(child)
      stats.folders += 1 + sub.folders
      stats.projects += sub.projects
      if (stats.covers.length < 3) stats.covers = [...stats.covers, ...sub.covers].slice(0, 3)
    }
    out.set(f.id, stats)
    return stats
  }
  for (const root of tree.children(null)) visit(root)
  return out
}
