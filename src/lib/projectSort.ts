import type { Project } from './project'

/**
 * How the projects of one folder are ordered on the home page.
 *
 * Folders are not part of this: they always come first, by name, so the way
 * down the tree stays where the eye left it whatever the projects below are
 * sorted by. Only the projects move.
 *
 * The choice is kept PER FOLDER (and for the top, `root`), per viewer. A client
 * folder sorted by name and an "in progress" folder sorted by last change are
 * two different questions asked of two different places; one global setting
 * would make the second visit to either undo the first.
 */
export type ProjectSortKey = 'updated' | 'created' | 'name' | 'screens'
export type SortDir = 'asc' | 'desc'
export type ProjectSort = { key: ProjectSortKey; dir: SortDir }

export const PROJECT_SORT_KEYS: readonly ProjectSortKey[] = ['updated', 'created', 'name', 'screens']

/** The order each key starts in: the newest first, the alphabet from A. */
export const NATURAL_DIR: Record<ProjectSortKey, SortDir> = {
  updated: 'desc',
  created: 'desc',
  name: 'asc',
  screens: 'desc',
}

/** What a folder nobody chose an order for is sorted by: what was there before. */
export const DEFAULT_SORT: ProjectSort = { key: 'updated', dir: 'desc' }

export const isDefaultSort = (s: ProjectSort) => s.key === DEFAULT_SORT.key && s.dir === DEFAULT_SORT.dir

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/**
 * A new array, ordered. Ties fall back to the last change, newest first, then
 * to the id: two projects made in the same millisecond (a template's import, a
 * migration) must not swap places on every render.
 */
export function sortProjects(projects: readonly Project[], sort: ProjectSort, untitled = ''): Project[] {
  const sign = sort.dir === 'asc' ? 1 : -1
  const nameOf = (p: Project) => (p.name || untitled).trim()
  const primary = (a: Project, b: Project): number => {
    switch (sort.key) {
      case 'name':
        return collator.compare(nameOf(a), nameOf(b))
      case 'created':
        return (a.createdAt || 0) - (b.createdAt || 0)
      case 'screens':
        return a.screens.length - b.screens.length
      default:
        return (a.updatedAt || 0) - (b.updatedAt || 0)
    }
  }
  return [...projects].sort(
    (a, b) =>
      sign * primary(a, b) ||
      (b.updatedAt || 0) - (a.updatedAt || 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
}

/** The remembered choices, by folder id (`root` for the top). Never trusted as stored. */
export function parseSorts(raw: unknown): Record<string, ProjectSort> {
  const out: Record<string, ProjectSort> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [place, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue
    const { key, dir } = v as { key?: unknown; dir?: unknown }
    if (!PROJECT_SORT_KEYS.includes(key as ProjectSortKey)) continue
    if (dir !== 'asc' && dir !== 'desc') continue
    out[place] = { key: key as ProjectSortKey, dir }
  }
  return out
}
