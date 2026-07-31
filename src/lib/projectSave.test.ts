import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * The debounced localStorage writer in project.ts, and the infinite reload loop
 * it caused.
 *
 * THE BUG, IN ORDER
 *
 *   1. `useProjects` mounts, reads localStorage, and queues a save of what it
 *      read. On a fresh origin — a Docker instance on another port, a new
 *      browser profile — what it read is `[]`.
 *   2. `reconcileOnLogin` fetches the server's copy (every project the account
 *      owns), merges, writes it to localStorage, and asks App.tsx to reload so
 *      the running stores pick it up.
 *   3. The reload fires `beforeunload`, where `flushProjectsNow` is registered
 *      with capture. It writes the queued `[]` back — over the merge.
 *   4. The next load reads `[]`, reconciles against the server again, finds the
 *      same difference again, and reloads again. Several times a second.
 *
 * The environment is plain Node (no jsdom in this project), so the browser
 * globals project.ts touches are stubbed before importing it.
 */

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
const listeners = new Map<string, Array<() => void>>()

vi.stubGlobal('localStorage', storage)
vi.stubGlobal('window', {
  // Lambdas, not .bind: fake timers replace the global, and a bound reference
  // would keep calling the real one.
  setTimeout: (fn: () => void, ms?: number) => setTimeout(fn, ms),
  clearTimeout: (id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>),
  addEventListener: (type: string, fn: () => void) => {
    const list = listeners.get(type) ?? []
    list.push(fn)
    listeners.set(type, list)
  },
  removeEventListener: (type: string, fn: () => void) => {
    listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn))
  },
})

const { saveProjects, discardPendingSave } = await import('./project')

const PROJECTS_KEY = 'mocky.projects.v1'

/** What reconcileOnLogin would have merged in from the server. */
const MERGED = JSON.stringify([{ id: 'p1', name: 'Projet', createdAt: 0, updatedAt: 1_000, screens: [] }])

/** Runs every beforeunload handler, as the browser does during a reload. */
function fireBeforeUnload() {
  for (const fn of listeners.get('beforeunload') ?? []) fn()
}

beforeEach(() => {
  storage.clear()
  discardPendingSave()
})

describe('the queued save vs. an outside write', () => {
  it('writes the pre-merge array back over the merge when nothing cancels it', () => {
    // This is the loop, reproduced: step 1 …
    saveProjects([])
    // … step 2 (reconcile merged the server's copy in) …
    storage.setItem(PROJECTS_KEY, MERGED)
    // … step 3.
    fireBeforeUnload()

    expect(storage.getItem(PROJECTS_KEY)).toBe('[]')
  })

  it('leaves the merge alone once the queued save is discarded', () => {
    saveProjects([])
    storage.setItem(PROJECTS_KEY, MERGED)

    discardPendingSave()
    fireBeforeUnload()

    expect(storage.getItem(PROJECTS_KEY)).toBe(MERGED)
  })

  it('also cancels the debounce timer, not just the unload flush', async () => {
    vi.useFakeTimers()
    try {
      saveProjects([])
      storage.setItem(PROJECTS_KEY, MERGED)
      discardPendingSave()
      await vi.advanceTimersByTimeAsync(1_000)
    } finally {
      vi.useRealTimers()
    }

    expect(storage.getItem(PROJECTS_KEY)).toBe(MERGED)
  })

  it('still persists a save that nothing discarded', async () => {
    vi.useFakeTimers()
    try {
      saveProjects([{ id: 'p2', name: 'Autre', createdAt: 0, updatedAt: 2_000, screens: [] }])
      await vi.advanceTimersByTimeAsync(400)
    } finally {
      vi.useRealTimers()
    }

    expect(JSON.parse(storage.getItem(PROJECTS_KEY) as string)[0].id).toBe('p2')
  })
})
