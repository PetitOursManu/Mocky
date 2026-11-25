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
const OWNER_KEY = 'mocky.owner.v1'
const ME = 'u-me'

function project(id: string, updatedAt: number, screens: unknown[] = []) {
  return { id, name: id, createdAt: 0, updatedAt, screens }
}

beforeEach(async () => {
  storage.clear()
  // The browser's copy is this account's, as after any sign-in since the owner existed.
  storage.setItem(OWNER_KEY, ME)
  putData.mockReset().mockResolvedValue({ ok: true })
  getData.mockReset().mockResolvedValue({ projects: null, design: null })
  enableSync(true, ME)
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

    await reconcileOnLogin(ME)

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

    const changed = await reconcileOnLogin(ME)

    expect(changed).toBe(true)
    expect(JSON.parse(storage.getItem(PROJECTS_KEY) as string)[0].screens).toHaveLength(1)
  })

  it('keeps projects that exist on only one side', async () => {
    storage.setItem(PROJECTS_KEY, JSON.stringify([project('local-only', 10)]))
    getData.mockResolvedValue({ projects: JSON.stringify([project('server-only', 20)]), design: null })

    await reconcileOnLogin(ME)

    const ids = JSON.parse(storage.getItem(PROJECTS_KEY) as string).map((p: { id: string }) => p.id)
    expect(ids.sort()).toEqual(['local-only', 'server-only'])
  })

  it('pushes local data up for a brand-new account', async () => {
    storage.setItem(PROJECTS_KEY, JSON.stringify([project('p1', 1_000)]))
    getData.mockResolvedValue({ projects: null, design: null })

    await reconcileOnLogin(ME)

    expect(putData).toHaveBeenCalledOnce()
    expect(JSON.parse(putData.mock.calls[0][0] as string)[0].id).toBe('p1')
  })

  it('does not touch storage when both sides already agree', async () => {
    const blob = JSON.stringify([project('p1', 1_000)])
    storage.setItem(PROJECTS_KEY, blob)
    getData.mockResolvedValue({ projects: blob, design: null, updatedAt: 1_000 })

    expect(await reconcileOnLogin(ME)).toBe(false)
    expect(putData).not.toHaveBeenCalled()
  })

  it('keeps the local DESIGN.md when the server blob is older', async () => {
    storage.setItem(PROJECTS_KEY, JSON.stringify([project('p1', 9_000)]))
    storage.setItem(DESIGN_KEY, 'local design')
    getData.mockResolvedValue({ projects: JSON.stringify([project('p1', 9_000)]), design: 'old server design', updatedAt: 1_000 })

    await reconcileOnLogin(ME)

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

describe('maintenance', () => {
  it('pauses on the first refusal instead of retrying, and pushes once maintenance ends', async () => {
    const { MaintenanceError, setMaintenance } = await import('./maintenance')
    setMaintenance({ on: true })
    putData.mockRejectedValueOnce(new MaintenanceError('closed'))
    storage.setItem(PROJECTS_KEY, 'during')

    await expect(pushNow()).rejects.toThrow('closed')
    // One call: the refusal is not transient, and five attempts would spend 15 s
    // reaching the same answer.
    expect(putData).toHaveBeenCalledTimes(1)
    expect(getSyncState()).toBe('paused')
    expect(hasUnsyncedChanges()).toBe(true)

    // A change made while paused is kept, not pushed into a refusal.
    storage.setItem(PROJECTS_KEY, 'later')
    scheduleSync()
    await new Promise((r) => setTimeout(r, 900))
    expect(putData).toHaveBeenCalledTimes(1)

    setMaintenance({ on: false })
    await vi.waitFor(() => expect(putData).toHaveBeenCalledTimes(2))
    expect(putData.mock.calls[1][0]).toBe('later')
    await vi.waitFor(() => expect(getSyncState()).toBe('idle'))
  })

  it('does not turn a refused reconcile into a sign-out', async () => {
    const { MaintenanceError, setMaintenance } = await import('./maintenance')
    setMaintenance({ on: true })
    storage.setItem(PROJECTS_KEY, JSON.stringify([project('p1', 2_000)]))
    getData.mockResolvedValue({ projects: null, design: null })
    putData.mockRejectedValueOnce(new MaintenanceError('closed'))
    await expect(reconcileOnLogin(ME)).resolves.toBeTypeOf('boolean')
    expect(getSyncState()).toBe('paused')
    setMaintenance({ on: false })
    await vi.waitFor(() => expect(getSyncState()).toBe('idle'))
  })
})

describe('a browser shared by two accounts', () => {
  const SETTINGS_KEY = 'mocky.settings.v1'

  it("forgets another account's copy instead of merging it into this one", async () => {
    storage.setItem(OWNER_KEY, 'u-other')
    storage.setItem(PROJECTS_KEY, JSON.stringify([project('theirs', 5_000)]))
    storage.setItem(DESIGN_KEY, '# Theirs')
    storage.setItem(SETTINGS_KEY, JSON.stringify({ apiKey: 'their-key' }))
    getData.mockResolvedValue({ projects: JSON.stringify([project('mine', 1_000)]), design: '# Mine', updatedAt: 1 })

    expect(await reconcileOnLogin(ME)).toBe('switched')

    expect(JSON.parse(storage.getItem(PROJECTS_KEY) as string).map((p: { id: string }) => p.id)).toEqual(['mine'])
    expect(storage.getItem(DESIGN_KEY)).toBe('# Mine')
    expect(storage.getItem(SETTINGS_KEY)).toBeNull()
    expect(storage.getItem(OWNER_KEY)).toBe(ME)
    for (const [projects, design] of putData.mock.calls) {
      expect(projects).not.toContain('theirs')
      expect(design).not.toBe('# Theirs')
    }
  })

  it('keeps, from a copy nobody claimed, only the projects the account already has', async () => {
    storage.removeItem(OWNER_KEY)
    storage.setItem(PROJECTS_KEY, JSON.stringify([project('mine', 9_000, [{ id: 'new-screen' }]), project('unknown', 9_000)]))
    storage.setItem(SETTINGS_KEY, JSON.stringify({ apiKey: 'k' }))
    getData.mockResolvedValue({ projects: JSON.stringify([project('mine', 1_000)]), design: null })

    await reconcileOnLogin(ME)

    const kept = JSON.parse(storage.getItem(PROJECTS_KEY) as string)
    expect(kept.map((p: { id: string }) => p.id)).toEqual(['mine'])
    // Its newer edit survives: it was certainly this account's.
    expect(kept[0].screens).toEqual([{ id: 'new-screen' }])
    expect(putData.mock.calls[putData.mock.calls.length - 1]?.[0]).not.toContain('unknown')
    expect(storage.getItem(SETTINGS_KEY)).not.toBeNull()
    expect(storage.getItem(OWNER_KEY)).toBe(ME)
  })

  it('does not push once the copy belongs to another account', async () => {
    storage.setItem(PROJECTS_KEY, JSON.stringify([project('p1', 1)]))
    storage.setItem(OWNER_KEY, 'u-other')
    await pushNow()
    expect(putData).not.toHaveBeenCalled()
    // And sync stays off: a later edit in this tab is not pushed either.
    scheduleSync()
    expect(hasUnsyncedChanges()).toBe(false)
  })
})

