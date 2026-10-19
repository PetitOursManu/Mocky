import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createVersionStore,
  isVersionId,
  normalizeBranch,
  MAIN_BRANCH,
  MAX_CODE_BYTES,
  MAX_VERSIONS_PER_PROJECT,
  MAX_AUTO_SCREEN_VERSIONS,
} from './versions.js'
import { createDiskBudget } from './storage-quota.js'

/**
 * A version is a copy of somebody's project. The properties worth pinning are
 * the ones that decide whether the copy is faithful, whether it stays theirs,
 * and whether it costs what it should: two identical saves must not cost two
 * copies of the code, a restore must give back exactly what was saved, and one
 * account must never reach another's.
 */

let dir
let clock
const now = () => clock++
const store = (opts = {}) => createVersionStore(dir, { now, ...opts })

const screen = (id, code, extra = {}) => ({
  id,
  name: `Screen ${id}`,
  prompt: 'a landing page',
  code,
  componentName: 'App',
  createdAt: 1,
  x: 0,
  y: 0,
  w: 1440,
  h: 900,
  device: 'none',
  links: [],
  ...extra,
})

const project = (screens, extra = {}) => ({
  projectId: 'p1',
  scope: 'project',
  kind: 'manual',
  label: 'First',
  project: { name: 'Softly', design: '# Design\n- Primary: #112233' },
  screens,
  ...extra,
})

const blobCount = (user = 'u1') => {
  try {
    return fs.readdirSync(path.join(dir, 'versions', user, 'blobs')).length
  } catch {
    return 0
  }
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-versions-'))
  clock = 1_700_000_000_000
})
afterEach(() => {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    /* best effort */
  }
})

describe('saving and reading back', () => {
  it('gives back exactly the screens it was given, minus previousCode', () => {
    const s = store()
    const a = screen('s1', 'function App(){return <div>A</div>}', { previousCode: 'old', userNotes: [{ id: 'n', text: 'hi', createdAt: 1 }] })
    const { version } = s.create('u1', project([a]))
    expect(isVersionId(version.id)).toBe(true)
    const full = s.get('u1', version.id)
    const back = full.screens[0]
    expect(back.code).toBe(a.code)
    expect(back.userNotes).toEqual(a.userNotes)
    expect(back.name).toBe('Screen s1')
    expect('previousCode' in back).toBe(false)
    expect(full.project).toEqual({ name: 'Softly', design: '# Design\n- Primary: #112233' })
  })

  it('lists newest first, and never with the code', () => {
    const s = store()
    s.create('u1', project([screen('s1', 'A')], { label: 'one' }))
    s.create('u1', project([screen('s1', 'B')], { label: 'two' }))
    const list = s.list('u1', 'p1')
    expect(list.map((v) => v.label)).toEqual(['two', 'one'])
    expect(JSON.stringify(list)).not.toContain('"code":"A"')
    expect(list[0].screens[0]).toMatchObject({ id: 's1', name: 'Screen s1' })
    expect(list[0].screens[0].codeHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('keeps one screen alone for a screen version', () => {
    const s = store()
    const { version } = s.create('u1', {
      projectId: 'p1',
      scope: 'screen',
      screenId: 's2',
      screens: [screen('s1', 'A'), screen('s2', 'B')],
    })
    expect(version.scope).toBe('screen')
    expect(version.screenId).toBe('s2')
    expect(s.get('u1', version.id).screens.map((x) => x.code)).toEqual(['B'])
    // No project fields on a screen version: restoring it must not rename the project.
    expect(s.get('u1', version.id).project).toBeNull()
  })

  it('refuses a screen version of a screen it was not given', () => {
    expect(() => store().create('u1', { projectId: 'p1', scope: 'screen', screenId: 'zz', screens: [screen('s1', 'A')] })).toThrow()
  })
})

describe('what a version costs', () => {
  it('writes each distinct code once', () => {
    const s = store()
    s.create('u1', project([screen('s1', 'A'), screen('s2', 'B')]))
    const after1 = blobCount()
    s.create('u1', project([screen('s1', 'A'), screen('s2', 'C')], { label: 'Second' }))
    // One new code ("C"); "A" and the design were already there.
    expect(blobCount()).toBe(after1 + 1)
  })

  it('answers "unchanged" to an automatic save of the same state, and writes nothing', () => {
    const s = store()
    const first = s.create('u1', project([screen('s1', 'A')], { kind: 'auto' }))
    const again = s.create('u1', project([screen('s1', 'A')], { kind: 'auto' }))
    expect(again.unchanged).toBe(true)
    expect(again.version.id).toBe(first.version.id)
    expect(s.list('u1', 'p1')).toHaveLength(1)
  })

  it('keeps two manual saves of the same state: the person meant two', () => {
    const s = store()
    s.create('u1', project([screen('s1', 'A')], { label: 'a' }))
    s.create('u1', project([screen('s1', 'A')], { label: 'b' }))
    expect(s.list('u1', 'p1')).toHaveLength(2)
  })

  it('does not call a save on another branch a twin', () => {
    const s = store()
    s.create('u1', project([screen('s1', 'A')], { kind: 'auto' }))
    const other = s.create('u1', project([screen('s1', 'A')], { kind: 'auto', branch: 'Sombre' }))
    expect(other.unchanged).toBe(false)
  })

  it('refuses a screen past the size ceiling, before writing anything', () => {
    const s = store()
    const big = 'x'.repeat(MAX_CODE_BYTES + 1)
    expect(() => s.create('u1', project([screen('s1', 'A'), screen('s2', big)]))).toThrow(/too large/)
    expect(blobCount()).toBe(0)
  })

  it('refuses before writing when the disk budget is spent', () => {
    const budget = createDiskBudget({ dirs: [], maxBytes: 10 })
    budget.seed()
    const s = store({ budget })
    expect(() => s.create('u1', project([screen('s1', 'more than ten bytes of code')]))).toThrow(/storage limit/)
    expect(blobCount()).toBe(0)
  })

  it('caps the versions of one project', () => {
    const s = store()
    for (let i = 0; i < MAX_VERSIONS_PER_PROJECT; i++) s.create('u1', project([screen('s1', 'A')], { label: String(i) }))
    expect(() => s.create('u1', project([screen('s1', 'A')]))).toThrow(/Delete some/)
  })
})

describe('automatic screen versions', () => {
  // Taken by the browser every time a screen's code settles after a change.
  const auto = (id, code) => ({ projectId: 'p1', scope: 'screen', kind: 'auto', screenId: id, screens: [screen(id, code)] })

  it('keeps the newest of one screen and drops the oldest, blobs included', () => {
    const s = store()
    for (let i = 0; i < MAX_AUTO_SCREEN_VERSIONS + 5; i++) s.create('u1', auto('s1', `code ${i}`))
    const kept = s.list('u1', 'p1')
    expect(kept).toHaveLength(MAX_AUTO_SCREEN_VERSIONS)
    // Newest first: the last five saves are there, the first five are gone.
    expect(s.get('u1', kept[0].id).screens[0].code).toBe(`code ${MAX_AUTO_SCREEN_VERSIONS + 4}`)
    expect(s.get('u1', kept.at(-1).id).screens[0].code).toBe('code 5')
    expect(blobCount()).toBe(MAX_AUTO_SCREEN_VERSIONS)
  })

  it('counts each screen apart, and never drops a version saved by hand', () => {
    const s = store()
    const manual = s.create('u1', { ...auto('s1', 'kept by hand'), kind: 'manual', label: 'Mine' }).version
    for (let i = 0; i < MAX_AUTO_SCREEN_VERSIONS + 3; i++) {
      s.create('u1', auto('s1', `a ${i}`))
      s.create('u1', auto('s2', `b ${i}`))
    }
    const all = s.list('u1', 'p1')
    expect(all.filter((v) => v.screenId === 's1' && v.kind === 'auto')).toHaveLength(MAX_AUTO_SCREEN_VERSIONS)
    expect(all.filter((v) => v.screenId === 's2' && v.kind === 'auto')).toHaveLength(MAX_AUTO_SCREEN_VERSIONS)
    expect(all.some((v) => v.id === manual.id)).toBe(true)
  })

  it('makes room under the project ceiling instead of refusing', () => {
    const s = store()
    const perScreen = MAX_AUTO_SCREEN_VERSIONS - 1
    let n = 0
    for (let screenNo = 0; n < MAX_VERSIONS_PER_PROJECT; screenNo++) {
      for (let i = 0; i < perScreen && n < MAX_VERSIONS_PER_PROJECT; i++, n++) s.create('u1', auto(`s${screenNo}`, `c ${screenNo} ${i}`))
    }
    expect(() => s.create('u1', auto('fresh', 'new'))).not.toThrow()
    expect(s.list('u1', 'p1')).toHaveLength(MAX_VERSIONS_PER_PROJECT)
  })

  it('drops nothing for a save that writes nothing', () => {
    const s = store()
    for (let i = 0; i < MAX_AUTO_SCREEN_VERSIONS; i++) s.create('u1', auto('s1', `code ${i}`))
    const before = s.list('u1', 'p1').map((v) => v.id)
    expect(s.create('u1', auto('s1', `code ${MAX_AUTO_SCREEN_VERSIONS - 1}`)).unchanged).toBe(true)
    expect(s.list('u1', 'p1').map((v) => v.id)).toEqual(before)
  })
})

describe('deleting', () => {
  it('drops the blobs only that version used', () => {
    const s = store()
    const a = s.create('u1', project([screen('s1', 'A')])).version
    const b = s.create('u1', project([screen('s1', 'B')])).version
    const before = blobCount()
    s.remove('u1', b.id)
    // "B" goes; "A" and the design are still named by the first version.
    expect(blobCount()).toBe(before - 1)
    expect(s.get('u1', a.id).screens[0].code).toBe('A')
  })

  it('removes a whole branch and nothing else', () => {
    const s = store()
    s.create('u1', project([screen('s1', 'A')]))
    s.create('u1', project([screen('s1', 'B')], { branch: 'Sombre' }))
    s.create('u1', project([screen('s1', 'C')], { branch: 'Sombre' }))
    expect(s.removeBranch('u1', 'p1', 'Sombre')).toBe(2)
    expect(s.list('u1', 'p1').map((v) => v.branch)).toEqual([MAIN_BRANCH])
  })

  it('removes everything an account had', () => {
    const s = store()
    s.create('u1', project([screen('s1', 'A')]))
    s.removeAllFor('u1')
    expect(fs.existsSync(path.join(dir, 'versions', 'u1'))).toBe(false)
    expect(s.list('u1', 'p1')).toEqual([])
  })
})

describe('whose versions they are', () => {
  it('never answers one account with another account\'s version', () => {
    const s = store()
    const { version } = s.create('u1', project([screen('s1', 'secret')]))
    expect(s.get('u2', version.id)).toBeNull()
    expect(s.list('u2', 'p1')).toEqual([])
    expect(s.remove('u2', version.id)).toBe(false)
    expect(s.rename('u2', version.id, 'mine now')).toBeNull()
  })

  it('refuses an account id that could leave the directory', () => {
    expect(() => store().create('../u1', project([screen('s1', 'A')]))).toThrow()
  })

  it('refuses a version id that is not one', () => {
    expect(store().get('u1', '../../users')).toBeNull()
  })
})

describe('branch names', () => {
  it('tidies spaces so two identical-looking branches are one', () => {
    expect(normalizeBranch('  Sombre   et  doux ')).toBe('Sombre et doux')
    expect(normalizeBranch('   ')).toBeNull()
    expect(normalizeBranch(42)).toBeNull()
  })

  it('files a version without a branch under the main one', () => {
    const { version } = store().create('u1', project([screen('s1', 'A')]))
    expect(version.branch).toBe(MAIN_BRANCH)
  })
})
