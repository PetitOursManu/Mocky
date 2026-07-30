import { describe, it, expect, beforeEach, vi } from 'vitest'

// The test environment is plain Node (no jsdom in this project), so the two
// browser globals sync.ts touches are stubbed here. Both are installed before
// the module under test is imported.
class MemoryStorage {
  private map = new Map<string, string>()
  getItem(k: string) {
    return this.map.has(k) ? (this.map.get(k) as string) : null
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v))
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
  clear() {
    this.map.clear()
  }
}

const storage = new MemoryStorage()
vi.stubGlobal('localStorage', storage)
vi.stubGlobal('window', { setTimeout: setTimeout.bind(globalThis), clearTimeout: clearTimeout.bind(globalThis) })

const putData = vi.fn<(projects: string | null, design: string | null) => Promise<unknown>>()
const getData = vi.fn<() => Promise<{ projects: string | null; design: string | null; updatedAt?: number }>>()

vi.mock('./api', () => ({
  api: {
    putData: (projects: string | null, design: string | null) => putData(projects, design),
    getData: () => getData(),
  },
}))

const { enableSync, pushNow, reconcileOnLogin, getSyncState, onSyncState, scheduleSync, hasUnsyncedChanges } =
  await import('./sync')

const PROJECTS_KEY = 'mocky.projects.v1'
const DESIGN_KEY = 'mocky.design.v1'

function project(id: string, updatedAt: number, screens: unknown[] = []) {
  return { id, name: id, createdAt: 0, updatedAt, screens }
}

beforeEach(async () => {
  storage.clear()
  putData.mockReset().mockResolvedValue({ ok: true })
  getData.mockReset().mockResolvedValue({ projects: null, design: null })
  enableSync(true)
  // Drain any state left behind by a previous test's failing push.
  await pushNow().catch(() => {})
  putData.mockClear()
})

describe('reconcileOnLogin', () => {
  it('keeps the local copy when it is newer than the server (the data-loss bug)', async () => {
    // Local has a screen the server never received because the tab closed
    // before the debounced push fired.
    const local = [project('p1', 2_000, [{ id: 's1' }])]
    const server = [project('p1', 1_000, [])]
    storage.setItem(PROJECTS_KEY, JSON.stringify(local))
    getData.mockResolvedValue({ projects: JSON.stringify(server), design: null, updatedAt: 1_000 })

    await reconcileOnLogin()

    const kept = JSON.parse(storage.getItem(PROJECTS_KEY) as string)
    expect(kept[0].screens).toHaveLength(1)
    // …and the server is corrected rather than left holding the stale copy.
    expect(putData).toHaveBeenCalled()
  })

  it('adopts the server copy when the server is newer', async () => {
    storage.setItem(PROJECTS_KEY, JSON.stringify([project('p1', 1_000)]))
    getData.mockResolvedValue({
      projects: JSON.stringify([project('p1', 5_000, [{ id: 'fromOtherDevice' }])]),
      design: null,
      updatedAt: 5_000,
    })

    const changed = await reconcileOnLogin()

    expect(changed).toBe(true)
    expect(JSON.parse(storage.getItem(PROJECTS_KEY) as string)[0].screens).toHaveLength(1)
  })

  it('keeps projects that exist on only one side', async () => {
    storage.setItem(PROJECTS_KEY, JSON.stringify([project('local-only', 10)]))
    getData.mockResolvedValue({ projects: JSON.stringify([project('server-only', 20)]), design: null })

    await reconcileOnLogin()

    const ids = JSON.parse(storage.getItem(PROJECTS_KEY) as string).map((p: { id: string }) => p.id)
    expect(ids.sort()).toEqual(['local-only', 'server-only'])
  })

  it('pushes local data up for a brand-new account', async () => {
    storage.setItem(PROJECTS_KEY, JSON.stringify([project('p1', 1_000)]))
    getData.mockResolvedValue({ projects: null, design: null })

    await reconcileOnLogin()

    expect(putData).toHaveBeenCalledOnce()
    expect(JSON.parse(putData.mock.calls[0][0] as string)[0].id).toBe('p1')
  })

  it('does not touch storage when both sides already agree', async () => {
    const blob = JSON.stringify([project('p1', 1_000)])
    storage.setItem(PROJECTS_KEY, blob)
    getData.mockResolvedValue({ projects: blob, design: null, updatedAt: 1_000 })

    expect(await reconcileOnLogin()).toBe(false)
    expect(putData).not.toHaveBeenCalled()
  })

  it('keeps the local DESIGN.md when the server blob is older', async () => {
    storage.setItem(PROJECTS_KEY, JSON.stringify([project('p1', 9_000)]))
    storage.setItem(DESIGN_KEY, 'local design')
    getData.mockResolvedValue({ projects: JSON.stringify([project('p1', 9_000)]), design: 'old server design', updatedAt: 1_000 })

    await reconcileOnLogin()

    expect(storage.getItem(DESIGN_KEY)).toBe('local design')
  })
})

describe('pushNow', () => {
  it('re-pushes changes that landed while a push was in flight', async () => {
    storage.setItem(PROJECTS_KEY, 'v1')
    let release!: () => void
    putData.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ ok: true })
        }),
    )

    const first = pushNow()
    // A write arrives mid-flight. The old implementation coalesced it away and
    // it never reached the server.
    storage.setItem(PROJECTS_KEY, 'v2')
    scheduleSync()
    release()
    await first

    expect(putData).toHaveBeenCalledTimes(2)
    expect(putData.mock.calls[1][0]).toBe('v2')
  })

  it('reads storage again on each retry rather than pushing a stale snapshot', async () => {
    storage.setItem(PROJECTS_KEY, 'first')
    putData.mockRejectedValueOnce(new Error('network')).mockResolvedValue({ ok: true })

    const p = pushNow()
    storage.setItem(PROJECTS_KEY, 'second')
    await vi.waitFor(() => expect(putData).toHaveBeenCalledTimes(2), { timeout: 4_000 })
    await p

    expect(putData.mock.calls[1][0]).toBe('second')
  }, 10_000)

  it('reports failure through the status channel instead of throwing into the void', async () => {
    const seen: string[] = []
    const off = onSyncState((s) => seen.push(s))
    putData.mockRejectedValue(new Error('offline'))

    // Fake timers: the real path sleeps 1+2+4+8 s between attempts, which would
    // make this single test six times longer than the whole rest of the suite.
    vi.useFakeTimers()
    const rejects = expect(pushNow()).rejects.toThrow(/Sync failed/)
    await vi.runAllTimersAsync()
    await rejects
    vi.useRealTimers()

    expect(getSyncState()).toBe('failed')
    expect(seen).toContain('syncing')
    expect(seen).toContain('failed')
    expect(hasUnsyncedChanges()).toBe(true)
    expect(putData).toHaveBeenCalledTimes(5) // 5 attempts, then give up
    off()
  })

  it('does nothing while sync is disabled', async () => {
    enableSync(false)
    await pushNow()
    expect(putData).not.toHaveBeenCalled()
    enableSync(true)
  })
})
