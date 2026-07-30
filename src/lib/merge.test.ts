import { describe, it, expect } from 'vitest'
import { mergeProjects, parseProjects, visibleProjects, TOMBSTONE_TTL_MS } from './merge'
import type { Project } from './project'

function project(id: string, updatedAt: number, extra: Partial<Project> = {}): Project {
  return { id, name: id, createdAt: 0, updatedAt, screens: [], ...extra }
}

describe('parseProjects', () => {
  it('returns an empty list for null, empty, or malformed input', () => {
    expect(parseProjects(null)).toEqual([])
    expect(parseProjects('')).toEqual([])
    expect(parseProjects('not json')).toEqual([])
    // A stored object (rather than an array) must not blow up the whole load.
    expect(parseProjects('{"projects":[]}')).toEqual([])
  })

  it('parses a normal blob', () => {
    expect(parseProjects(JSON.stringify([project('a', 1)]))).toHaveLength(1)
  })
})

describe('mergeProjects', () => {
  it('keeps the newer side when a project exists on both', () => {
    const local = [project('a', 200, { name: 'newer' })]
    const server = [project('a', 100, { name: 'older' })]
    expect(mergeProjects(local, server)[0].name).toBe('newer')
    expect(mergeProjects(server, local)[0].name).toBe('newer')
  })

  it('adopts the server copy when the server is genuinely newer', () => {
    const local = [project('a', 100, { name: 'stale local' })]
    const server = [project('a', 300, { name: 'fresh server' })]
    expect(mergeProjects(local, server)[0].name).toBe('fresh server')
  })

  it('is the regression test for the close-the-tab-too-fast data loss', () => {
    // The exact scenario: a screen was added locally (so updatedAt moved) but the
    // debounced push never reached the server, which still holds the old copy.
    const local = [project('a', 2_000, { screens: [{ id: 's1' } as never] })]
    const server = [project('a', 1_000, { screens: [] })]
    expect(mergeProjects(local, server)[0].screens).toHaveLength(1)
  })

  it('never drops a project that only one side knows about', () => {
    const local = [project('only-local', 10)]
    const server = [project('only-server', 20)]
    const merged = mergeProjects(local, server)
    expect(merged.map((p) => p.id).sort()).toEqual(['only-local', 'only-server'])
  })

  it('lets local win a tie, so an up-to-date device does not churn', () => {
    const local = [project('a', 500, { name: 'local' })]
    const server = [project('a', 500, { name: 'server' })]
    expect(mergeProjects(local, server)[0].name).toBe('local')
  })

  it('honours a tombstone instead of resurrecting the project from the server', () => {
    // Tombstones must carry a real wall-clock time — they are aged against
    // Date.now(), so a synthetic small number reads as "deleted in 1970".
    const justNow = Date.now() - 1_000
    const local = [project('a', justNow, { deletedAt: justNow })]
    const server = [project('a', justNow - 60_000)]
    const merged = mergeProjects(local, server)
    expect(merged).toHaveLength(1) // the tombstone itself is still carried…
    expect(visibleProjects(merged)).toHaveLength(0) // …but nothing is shown
  })

  it('lets a newer edit win over an older tombstone', () => {
    // Deleted on one device, then edited later on another: the edit is newer, so
    // the project comes back. Last writer wins, and that writer said "keep it".
    const now = Date.now()
    const local = [project('a', now - 60_000, { deletedAt: now - 60_000 })]
    const server = [project('a', now, { name: 'edited after the delete' })]
    expect(visibleProjects(mergeProjects(local, server))).toHaveLength(1)
  })

  it('forgets tombstones past the TTL so the blob does not grow forever', () => {
    const old = Date.now() - TOMBSTONE_TTL_MS - 1
    expect(mergeProjects([project('a', old, { deletedAt: old })], [])).toHaveLength(0)
    const recent = Date.now() - 1000
    expect(mergeProjects([project('a', recent, { deletedAt: recent })], [])).toHaveLength(1)
  })

  it('falls back to createdAt for records written before updatedAt existed', () => {
    const legacy = { id: 'a', name: 'legacy', createdAt: 900, screens: [] } as unknown as Project
    const server = [project('a', 100, { name: 'server' })]
    expect(mergeProjects([legacy], server)[0].name).toBe('legacy')
  })

  it('ignores malformed entries rather than throwing', () => {
    const junk = [null, 42, { name: 'no id' }] as unknown as Project[]
    expect(mergeProjects(junk, [project('a', 1)])).toHaveLength(1)
  })

  it('mutates neither argument', () => {
    const local = [project('a', 200)]
    const server = [project('a', 100), project('b', 50)]
    const localCopy = JSON.parse(JSON.stringify(local))
    const serverCopy = JSON.parse(JSON.stringify(server))
    mergeProjects(local, server)
    expect(local).toEqual(localCopy)
    expect(server).toEqual(serverCopy)
  })

  it('returns newest first', () => {
    const merged = mergeProjects([project('a', 100), project('c', 300)], [project('b', 200)])
    expect(merged.map((p) => p.id)).toEqual(['c', 'b', 'a'])
  })
})
