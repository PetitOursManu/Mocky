import { describe, expect, it } from 'vitest'
import {
  buildFolderTree,
  canMoveFolder,
  FOLDER_MAX_DEPTH,
  folderDropVerdict,
  folderStats,
  insertionIndex,
  legacyFolderId,
  parseFolders,
  placeOf,
  projectsDropVerdict,
  treeKeyAction,
  visibleRows,
  withLegacyFolders,
  type Folder,
} from './folderTree'
import type { Project } from './project'

const f = (id: string, parentId: string | null = null, extra: Partial<Folder> = {}): Folder => ({
  id,
  name: id,
  parentId,
  updatedAt: 1,
  ...extra,
})
const p = (id: string, extra: Partial<Project> = {}) =>
  ({ id, name: id, createdAt: 0, updatedAt: 0, screens: [], ...extra }) as Project

describe('reading a tree', () => {
  it('nests folders and sorts siblings by name', () => {
    const tree = buildFolderTree([f('b'), f('a'), f('c', 'a')])
    expect(tree.children(null).map((x) => x.id)).toEqual(['a', 'b'])
    expect(tree.children('a').map((x) => x.id)).toEqual(['c'])
    expect(tree.pathOf('c').map((x) => x.id)).toEqual(['a', 'c'])
  })

  it('shows a folder whose parent is gone at the top', () => {
    const tree = buildFolderTree([f('a', null, { deletedAt: 5 }), f('b', 'a'), f('c', 'nowhere')])
    expect(tree.children(null).map((x) => x.id)).toEqual(['b', 'c'])
    expect(tree.has('a')).toBe(false)
  })

  it('breaks a cycle the same way whatever order the records arrive in', () => {
    const one = buildFolderTree([f('a', 'b'), f('b', 'a'), f('c', 'b')])
    const two = buildFolderTree([f('c', 'b'), f('b', 'a'), f('a', 'b')])
    for (const tree of [one, two]) {
      expect(tree.children(null).map((x) => x.id)).toEqual(['a'])
      expect(tree.pathOf('c').map((x) => x.id)).toEqual(['a', 'b', 'c'])
    }
  })

  it('survives a self-reference', () => {
    expect(buildFolderTree([f('a', 'a')]).children(null).map((x) => x.id)).toEqual(['a'])
  })
})

describe('moving a folder', () => {
  const tree = buildFolderTree([f('a'), f('b', 'a'), f('c', 'b'), f('d')])

  it('refuses to go inside itself', () => {
    expect(canMoveFolder(tree, 'a', 'a')).toBe(false)
    expect(canMoveFolder(tree, 'a', 'c')).toBe(false)
  })

  it('allows anything else', () => {
    expect(canMoveFolder(tree, 'c', null)).toBe(true)
    expect(canMoveFolder(tree, 'a', 'd')).toBe(true)
  })

  it('refuses what would run past the depth bound', () => {
    const chain = Array.from({ length: FOLDER_MAX_DEPTH }, (_, i) => f(`n${i}`, i ? `n${i - 1}` : null))
    const deep = buildFolderTree([...chain, f('x')])
    expect(canMoveFolder(deep, 'x', `n${FOLDER_MAX_DEPTH - 2}`)).toBe(true)
    expect(canMoveFolder(deep, 'x', `n${FOLDER_MAX_DEPTH - 1}`)).toBe(false)
  })
})

describe('folders that were only a name', () => {
  it('become records every device names alike, without touching a project', () => {
    const projects = [p('1', { folder: ' Client ' }), p('2', { folder: 'Client' }), p('3')]
    const out = withLegacyFolders([], projects)
    expect(out).toEqual([{ id: legacyFolderId('Client'), name: 'Client', parentId: null, updatedAt: 0 }])
    expect(projects[0].folderId).toBeUndefined()
  })

  it('returns the same array when nothing is missing', () => {
    const folders = [f(legacyFolderId('A'))]
    expect(withLegacyFolders(folders, [p('1', { folder: 'A' })])).toBe(folders)
  })

  it('keeps a project filed under its old name in that folder', () => {
    const projects = [p('1', { folder: 'A' })]
    const tree = buildFolderTree(withLegacyFolders([], projects))
    expect(placeOf(projects[0], tree)).toBe(legacyFolderId('A'))
  })

  it('prefers the id once a project has been moved', () => {
    const tree = buildFolderTree([f('x'), f(legacyFolderId('A'))])
    expect(placeOf(p('1', { folder: 'A', folderId: 'x' }), tree)).toBe('x')
  })
})

describe('placeOf', () => {
  it('puts a project whose folder was deleted back at the top', () => {
    expect(placeOf(p('1', { folderId: 'gone' }), buildFolderTree([]))).toBeNull()
  })
})

describe('folderStats', () => {
  it('counts what is inside, subfolders included', () => {
    const screen = { id: 's', code: 'x' } as Project['screens'][number]
    const tree = buildFolderTree([f('a'), f('b', 'a')])
    const stats = folderStats(tree, [p('1', { folderId: 'b', screens: [screen] }), p('2', { folderId: 'a' })])
    expect(stats.get('a')).toMatchObject({ folders: 1, projects: 2 })
    expect(stats.get('a')?.covers).toHaveLength(1)
    expect(stats.get('b')).toMatchObject({ folders: 0, projects: 1 })
  })
})

describe('drop verdicts', () => {
  const tree = buildFolderTree([f('a'), f('b', 'a'), f('c', 'b'), f('d')])

  it('tells "already there" from "not allowed"', () => {
    expect(folderDropVerdict(tree, 'b', 'a')).toBe('here')
    expect(folderDropVerdict(tree, 'a', null)).toBe('here')
    expect(folderDropVerdict(tree, 'a', 'c')).toBe('refused')
    expect(folderDropVerdict(tree, 'a', 'a')).toBe('here')
    expect(folderDropVerdict(tree, 'a', 'b')).toBe('refused')
    expect(folderDropVerdict(tree, 'b', 'd')).toBe('move')
    expect(folderDropVerdict(tree, 'c', null)).toBe('move')
    expect(folderDropVerdict(tree, 'gone', null)).toBe('refused')
  })

  it('lets projects go anywhere they are not all already', () => {
    expect(projectsDropVerdict(['a', 'a'], 'a')).toBe('here')
    expect(projectsDropVerdict(['a', null], 'a')).toBe('move')
    expect(projectsDropVerdict([null], null)).toBe('here')
    expect(projectsDropVerdict([], null)).toBe('move')
  })
})

describe('the side tree, flattened', () => {
  const tree = buildFolderTree([f('a'), f('b', 'a'), f('c', 'b'), f('d'), f('e', 'd')])
  const rowsWith = (open: string[]) => visibleRows(tree, (id) => open.includes(id))

  it('lists the root, then what is open, depth first and by name', () => {
    expect(rowsWith([]).map((r) => r.id)).toEqual([null, 'a', 'd'])
    expect(rowsWith(['a', 'b']).map((r) => [r.id, r.depth])).toEqual([
      [null, 0],
      ['a', 1],
      ['b', 2],
      ['c', 3],
      ['d', 1],
    ])
  })

  it('does not call a folder with nothing inside open', () => {
    expect(rowsWith(['c']).find((r) => r.id === 'c')).toBeUndefined()
    expect(rowsWith(['a', 'b', 'c']).find((r) => r.id === 'c')).toMatchObject({ hasKids: false, open: false })
  })

  it('walks with the arrow keys', () => {
    const rows = rowsWith(['a'])
    expect(treeKeyAction(rows, null, 'ArrowDown')).toEqual({ focus: 'a' })
    expect(treeKeyAction(rows, 'a', 'ArrowUp')).toEqual({ focus: null })
    expect(treeKeyAction(rows, null, 'ArrowUp')).toBeNull()
    expect(treeKeyAction(rows, 'b', 'End')).toEqual({ focus: 'd' })
    expect(treeKeyAction(rows, 'd', 'Home')).toEqual({ focus: null })
    expect(treeKeyAction(rows, 'b', 'Enter')).toEqual({ go: 'b' })
    expect(treeKeyAction(rows, null, 'Enter')).toEqual({ go: null })
  })

  it('opens, enters, closes and climbs', () => {
    const rows = rowsWith(['a'])
    expect(treeKeyAction(rows, 'b', 'ArrowRight')).toEqual({ open: 'b' })
    expect(treeKeyAction(rows, 'a', 'ArrowRight')).toEqual({ focus: 'b' })
    expect(treeKeyAction(rows, 'a', 'ArrowLeft')).toEqual({ close: 'a' })
    expect(treeKeyAction(rows, 'b', 'ArrowLeft')).toEqual({ focus: 'a' })
    expect(treeKeyAction(rows, 'a', 'ArrowLeft')).toEqual({ close: 'a' })
    expect(treeKeyAction(rowsWith([]), 'a', 'ArrowLeft')).toEqual({ focus: null })
    expect(treeKeyAction(rows, null, 'ArrowLeft')).toBeNull()
    expect(treeKeyAction(rows, null, 'ArrowRight')).toEqual({ focus: 'a' })
  })

  it('starts from the top when the focused row has gone', () => {
    expect(treeKeyAction(rowsWith([]), 'c', 'ArrowDown')).toEqual({ focus: null })
  })
})

describe('insertionIndex', () => {
  const tree = buildFolderTree([f('b'), f('d'), f('b1', 'b'), f('b3', 'b'), f('x', 'd')])

  it('places a dropped folder where the name order will put it', () => {
    const rows = visibleRows(tree, () => true) // root, b, b1, b3, d, x
    expect(insertionIndex(rows, tree, 'b', { id: 'x', name: 'b2' })).toBe(3)
    expect(insertionIndex(rows, tree, 'b', { id: 'x', name: 'a' })).toBe(2)
    // Last among the children: after the target's last descendant on show.
    expect(insertionIndex(rows, tree, 'b', { id: 'x', name: 'z' })).toBe(4)
    expect(insertionIndex(rows, tree, null, { id: 'x', name: 'c' })).toBe(4)
    expect(insertionIndex(rows, tree, null, { id: 'x', name: 'z' })).toBe(6)
  })

  it('has nowhere to show a folder dropped on a closed one', () => {
    const rows = visibleRows(tree, () => false)
    expect(insertionIndex(rows, tree, 'b', { id: 'x', name: 'b2' })).toBeNull()
  })

  it('does not count the moving folder among its new siblings', () => {
    const rows = visibleRows(tree, () => true)
    expect(insertionIndex(rows, tree, null, { id: 'b', name: 'c' })).toBe(4)
  })
})

describe('parseFolders', () => {
  it('tolerates garbage', () => {
    expect(parseFolders(null)).toEqual([])
    expect(parseFolders('nope')).toEqual([])
    expect(parseFolders('{"a":1}')).toEqual([])
    expect(parseFolders('[null,{"id":1},{"id":"a","name":"A","parentId":3}]')).toEqual([
      { id: 'a', name: 'A', parentId: null, updatedAt: 0 },
    ])
  })
})
