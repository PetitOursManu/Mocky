import { describe, expect, it } from 'vitest'
import {
  buildFolderTree,
  canMoveFolder,
  FOLDER_MAX_DEPTH,
  folderStats,
  legacyFolderId,
  parseFolders,
  placeOf,
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
