import { describe, it, expect } from 'vitest'
import { FOLDER_MAX_LEN, listFolders, normalizeFolder } from './project'
import { mergeProjects } from './merge'
import type { Project } from './project'

function project(id: string, extra: Partial<Project> = {}): Project {
  return { id, name: id, createdAt: 0, updatedAt: 1, screens: [], ...extra }
}

describe('normalizeFolder', () => {
  it('treats nothing, whitespace and undefined alike', () => {
    for (const input of [undefined, null, '', '   ', '\n\t']) {
      expect(normalizeFolder(input)).toBeNull()
    }
  })

  it('collapses inner whitespace and trims the edges', () => {
    // " Client " and "Client" would otherwise be two folders that render
    // identically, and nobody would work out why their projects had split.
    expect(normalizeFolder('  Client  ')).toBe('Client')
    expect(normalizeFolder('Mes  essais')).toBe('Mes  essais'.replace(/\s+/g, ' '))
    expect(normalizeFolder('A   B')).toBe('A B')
  })

  it('caps the length so the filter bar stays one line', () => {
    const long = 'x'.repeat(FOLDER_MAX_LEN + 20)
    expect(normalizeFolder(long)).toHaveLength(FOLDER_MAX_LEN)
  })
})

describe('listFolders', () => {
  it('derives the folder list from the projects themselves', () => {
    const out = listFolders([
      project('a', { folder: 'Client' }),
      project('b', { folder: 'Client' }),
      project('c', { folder: 'Essais' }),
      project('d'),
    ])
    expect(out).toEqual([
      { name: 'Client', count: 2 },
      { name: 'Essais', count: 1 },
    ])
  })

  it('does not count a deleted project', () => {
    // A tombstone lingers for 30 days. Counting it would show a folder holding
    // three projects when two are visible, and would keep an emptied folder in
    // the bar for a month after the last project left it.
    const out = listFolders([
      project('a', { folder: 'Client' }),
      project('b', { folder: 'Client', deletedAt: 5 }),
    ])
    expect(out).toEqual([{ name: 'Client', count: 1 }])
  })

  it('ignores a folder that is only whitespace', () => {
    expect(listFolders([project('a', { folder: '   ' })])).toEqual([])
  })

  it('sorts by name, case- and accent-insensitively', () => {
    // A plain `<` puts "Zoo" before "essais" and "Études" after both, which
    // reads as random to anyone looking for a folder.
    const out = listFolders([
      project('a', { folder: 'Zoo' }),
      project('b', { folder: 'essais' }),
      project('c', { folder: 'Études' }),
    ])
    expect(out.map((f) => f.name)).toEqual(['essais', 'Études', 'Zoo'])
  })

  it('does not reorder when counts change', () => {
    // The bar is a filter. One that reshuffles itself as projects move between
    // folders is unusable, so the order must not depend on the counts.
    const few = listFolders([project('a', { folder: 'Bbb' }), project('b', { folder: 'Aaa' })])
    const many = listFolders([
      project('a', { folder: 'Bbb' }),
      project('c', { folder: 'Bbb' }),
      project('d', { folder: 'Bbb' }),
      project('b', { folder: 'Aaa' }),
    ])
    expect(few.map((f) => f.name)).toEqual(many.map((f) => f.name))
  })
})

describe('the folder survives a merge', () => {
  it('rides along on a project the other side does not know', () => {
    // This is the property the whole design rests on: the field lives on the
    // Project, the server keeps the projects blob as an opaque string, and
    // mergeProjects moves whole Project objects. A client that has never heard
    // of folders must not strip them.
    const local = [project('a', { folder: 'Client', updatedAt: 2 })]
    const remote = [project('a', { updatedAt: 1 })]
    const merged = mergeProjects(local, remote)
    expect(merged.find((p) => p.id === 'a')?.folder).toBe('Client')
  })

  it('lets the newer side win, folder included', () => {
    const local = [project('a', { folder: 'Client', updatedAt: 1 })]
    const remote = [project('a', { folder: 'Essais', updatedAt: 9 })]
    expect(mergeProjects(local, remote).find((p) => p.id === 'a')?.folder).toBe('Essais')
  })

  it('propagates taking a project out of a folder', () => {
    // Removal deletes the key rather than writing an empty string, so the newer
    // record simply has no folder. If merge preferred "a defined value" over
    // recency, unfiling would never travel to the other device.
    const local = [project('a', { updatedAt: 9 })]
    const remote = [project('a', { folder: 'Client', updatedAt: 1 })]
    expect(mergeProjects(local, remote).find((p) => p.id === 'a')?.folder).toBeUndefined()
  })
})
