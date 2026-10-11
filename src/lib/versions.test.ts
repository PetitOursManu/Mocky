import { describe, it, expect } from 'vitest'
import { placeBeside, type Project, type Screen } from './project'
import {
  branchesOf,
  currentBranch,
  diffVersions,
  MAIN_BRANCH,
  projectSnapshot,
  restoreProject,
  restoreScreenPatch,
  screenHistory,
  type VersionFull,
  type VersionSummary,
} from './versions'
import { mergeProjects } from './merge'

const screen = (id: string, code: string, over: Partial<Screen> = {}): Screen => ({
  id,
  name: `Écran ${id}`,
  prompt: '',
  code,
  componentName: 'App',
  createdAt: 1,
  x: 0,
  y: 0,
  w: 1440,
  h: 900,
  device: 'none',
  links: [],
  ...over,
})

const proj = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'Softly',
  createdAt: 1,
  updatedAt: 10,
  screens: [screen('a', 'A'), screen('b', 'B')],
  ...over,
})

const summary = (over: Partial<VersionSummary>): VersionSummary => ({
  id: 'v1',
  projectId: 'p1',
  branch: MAIN_BRANCH,
  label: '',
  kind: 'manual',
  scope: 'project',
  createdAt: 100,
  projectName: 'Softly',
  designHash: null,
  screens: [],
  ...over,
})

const full = (over: Partial<VersionFull>): VersionFull => ({
  ...summary({}),
  project: { name: 'Old name' },
  screens: [],
  ...over,
})

describe('restoring a project version', () => {
  it('brings the saved screens back and keeps the project name', () => {
    const v = full({ screens: [screen('a', 'A0')], project: { name: 'Old name', design: '# Dark' } })
    const next = restoreProject(proj({ design: '# Light' }), v, 500)
    expect(next.screens.map((s) => s.code)).toEqual(['A0'])
    expect(next.name).toBe('Softly')
    expect(next.design).toBe('# Dark')
    expect(next.updatedAt).toBe(500)
  })

  it('tombstones the screens the version does not hold, so the sync does not hand them back', () => {
    const v = full({ screens: [screen('a', 'A0')] })
    const restored = restoreProject(proj(), v, 500)
    expect(restored.removedScreens).toEqual({ b: 500 })
    // The server still has the old copy, with screen b, at an older stamp.
    const merged = mergeProjects([restored], [proj()])
    expect(merged[0].screens.map((s) => s.id)).toEqual(['a'])
  })

  it('takes a screen it brings back off the tombstone list', () => {
    const v = full({ screens: [screen('a', 'A'), screen('gone', 'G')] })
    const next = restoreProject(proj({ removedScreens: { gone: 3 } }), v, 500)
    expect(next.removedScreens?.gone).toBeUndefined()
    expect(next.screens.map((s) => s.id)).toContain('gone')
  })

  it('clears a direction the version did not have', () => {
    const next = restoreProject(proj({ design: '# Light', productName: 'X' }), full({ screens: [screen('a', 'A')] }), 1)
    expect(next.design).toBeUndefined()
    expect(next.productName).toBeUndefined()
  })

  it('puts the working copy on the version\'s branch', () => {
    expect(restoreProject(proj(), full({ branch: 'Sombre', screens: [] }), 1).branch).toBe('Sombre')
    expect(restoreProject(proj({ branch: 'Sombre' }), full({ screens: [] }), 1).branch).toBeUndefined()
  })

  it('unpins a reference screen that no longer exists', () => {
    const next = restoreProject(proj({ referenceScreenId: 'b' }), full({ screens: [screen('a', 'A')] }), 1)
    expect(next.referenceScreenId).toBeUndefined()
  })
})

describe('restoring a screen version', () => {
  it('brings back the content and keeps the place and the notes', () => {
    const now = screen('a', 'NEW', { x: 50, y: 60, userNotes: [{ id: 'n', text: 'later', createdAt: 9 }] })
    const patch = restoreScreenPatch(now, screen('a', 'OLD', { x: 0, y: 0, prompt: 'first' }))
    expect(patch.code).toBe('OLD')
    expect(patch.prompt).toBe('first')
    expect('x' in patch).toBe(false)
    expect('userNotes' in patch).toBe(false)
  })

  it('makes the current code the Revert target', () => {
    expect(restoreScreenPatch(screen('a', 'NEW'), screen('a', 'OLD')).previousCode).toBe('NEW')
  })
})

describe('branches', () => {
  it('lists main first, then the branch worked on most recently', () => {
    const list = branchesOf(
      [
        summary({ id: '1', branch: 'Pastel', createdAt: 5 }),
        summary({ id: '2', branch: 'Sombre', createdAt: 9 }),
        summary({ id: '3', branch: MAIN_BRANCH, createdAt: 1 }),
      ],
      MAIN_BRANCH,
    )
    expect(list.map((b) => b.name)).toEqual([MAIN_BRANCH, 'Sombre', 'Pastel'])
    expect(list[1].head?.id).toBe('2')
  })

  it('includes the current branch even before it has a version', () => {
    expect(branchesOf([], 'Neuve').map((b) => b.name)).toEqual([MAIN_BRANCH, 'Neuve'])
  })

  it('does not count a screen version as a branch head', () => {
    const list = branchesOf([summary({ scope: 'screen', branch: 'Seul' })], MAIN_BRANCH)
    expect(list.map((b) => b.name)).toEqual([MAIN_BRANCH])
  })

  it('reads an absent or blank branch as main', () => {
    expect(currentBranch({})).toBe(MAIN_BRANCH)
    expect(currentBranch({ branch: '  ' })).toBe(MAIN_BRANCH)
  })

  it('sends the branch with a snapshot', () => {
    expect(projectSnapshot(proj({ branch: 'Sombre' })).branch).toBe('Sombre')
  })
})

describe('a screen\'s history', () => {
  it('has one entry per distinct code, at the moment it first appeared', () => {
    const vs = [
      summary({ id: 'v1', createdAt: 1, screens: [{ id: 'a', name: 'A', codeHash: 'h1' }] }),
      summary({ id: 'v2', createdAt: 2, screens: [{ id: 'a', name: 'A', codeHash: 'h1' }] }),
      summary({ id: 'v3', createdAt: 3, scope: 'screen', screenId: 'a', screens: [{ id: 'a', name: 'A', codeHash: 'h2' }] }),
      summary({ id: 'v4', createdAt: 4, screens: [{ id: 'b', name: 'B', codeHash: 'h9' }] }),
    ]
    const h = screenHistory(vs, 'a')
    expect(h.map((e) => e.version.id)).toEqual(['v3', 'v1'])
  })
})

describe('comparing', () => {
  it('sorts screens into added, removed, changed and the same', () => {
    const d = diffVersions(
      { designHash: 'd1', screens: [{ id: 'a', name: '', codeHash: '1' }, { id: 'b', name: '', codeHash: '2' }, { id: 'c', name: '', codeHash: '3' }] },
      { designHash: 'd2', screens: [{ id: 'a', name: '', codeHash: '1' }, { id: 'b', name: '', codeHash: 'X' }, { id: 'd', name: '', codeHash: '4' }] },
    )
    expect(d).toEqual({ added: ['d'], removed: ['c'], changed: ['b'], same: ['a'], designChanged: true })
  })
})

describe('a version kept beside its screen', () => {
  const box = (x: number, y: number, w = 1000, h = 700) => ({ x, y, w, h })

  it('goes right of the screen when that spot is free', () => {
    const anchor = box(0, 0)
    expect(placeBeside([anchor], anchor, 1000, 700)).toEqual({ x: 1400, y: 0 })
  })

  it('goes below when the right is taken, and somewhere free when both are', () => {
    const anchor = box(0, 0)
    const right = box(1400, 0)
    expect(placeBeside([anchor, right], anchor, 1000, 700)).toEqual({ x: 0, y: 780 })
    const below = box(0, 780)
    const at = placeBeside([anchor, right, below], anchor, 1000, 700)
    for (const b of [anchor, right, below]) {
      const overlaps = at.x < b.x + b.w && at.x + 1000 > b.x && at.y < b.y + b.h && at.y + 700 > b.y
      expect(overlaps).toBe(false)
    }
  })
})
