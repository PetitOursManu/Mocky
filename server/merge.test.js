import { describe, it, expect, vi, afterEach } from 'vitest'
import * as server from './merge.js'
import * as browser from '../src/lib/merge.ts'

/**
 * server/merge.js mirrors src/lib/merge.ts by hand (Node cannot import the
 * TypeScript at the 22.12 floor). This corpus is what keeps the mirror honest:
 * both sides get every pair and must answer the same, order included — the
 * order is what both sides then store, and two orders for one account is a
 * blob that differs on every push.
 */

const NOW = 1_800_000_000_000
const DAY = 24 * 60 * 60 * 1000

const p = (id, updatedAt, extra = {}) => ({ id, name: id, createdAt: 0, updatedAt, screens: [], ...extra })

/** [label, local, server] */
const corpus = [
  ['both empty', [], []],
  ['only local', [p('a', 1)], []],
  ['only server', [], [p('a', 1)]],
  ['local newer', [p('a', 200, { name: 'L' })], [p('a', 100, { name: 'S' })]],
  ['server newer', [p('a', 100, { name: 'L' })], [p('a', 200, { name: 'S' })]],
  ['a tie goes to local', [p('a', 100, { name: 'L' })], [p('a', 100, { name: 'S' })]],
  ['disjoint sets', [p('a', 3), p('b', 1)], [p('c', 2), p('d', 4)]],
  ['no updatedAt falls back to createdAt', [{ id: 'a', name: 'L', createdAt: 50, screens: [] }], [p('a', 40, { name: 'S' })]],
  ['no date at all is zero', [{ id: 'a', name: 'L', screens: [] }], [p('a', 0, { name: 'S' })]],
  ['a fresh tombstone travels', [p('a', NOW - DAY, { deletedAt: NOW - DAY })], [p('a', NOW - 2 * DAY)]],
  ['an old tombstone is forgotten', [p('a', NOW - 40 * DAY, { deletedAt: NOW - 40 * DAY })], []],
  ['an old tombstone loses to nothing newer', [], [p('a', NOW - 31 * DAY, { deletedAt: NOW - 31 * DAY })]],
  ['records without an id are dropped', [{ name: 'no id' }, null, p('a', 1)], [{ id: 7 }, p('b', 2)]],
  ['equal stamps keep insertion order', [p('x', 5), p('y', 5)], [p('z', 5), p('x', 5)]],
  ['many projects, mixed', [p('a', 10), p('b', 30), p('c', 20, { deletedAt: NOW - DAY })], [p('b', 40), p('c', 10), p('d', 25)]],
]

afterEach(() => vi.useRealTimers())

describe('server/merge.js mirrors src/lib/merge.ts', () => {
  it.each(corpus)('%s', (_label, local, srv) => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    expect(server.mergeProjects(local, srv)).toEqual(browser.mergeProjects(local, srv))
  })

  it('parses the same blobs the same way', () => {
    for (const raw of [null, undefined, '', 'not json', '{"projects":[]}', '[]', JSON.stringify([p('a', 1)])]) {
      expect(server.parseProjects(raw)).toEqual(browser.parseProjects(raw))
    }
  })

  it('keeps tombstones for the same time', () => {
    expect(server.TOMBSTONE_TTL_MS).toBe(browser.TOMBSTONE_TTL_MS)
  })
})

describe('mergeStoredProjects — what PUT /api/data stores', () => {
  it('keeps a project only the server knew, and tells the sender to read it back', () => {
    const out = server.mergeStoredProjects(JSON.stringify([p('mine', 2)]), JSON.stringify([p('from-mcp', 3), p('mine', 1)]))
    expect(JSON.parse(out.projects).map((x) => x.id)).toEqual(['from-mcp', 'mine'])
    expect(out.merged).toBe(true)
  })

  it('says nothing when the sender already had everything, whatever its order', () => {
    // The tab keeps its own order and the merge sorts by date: the strings
    // differ, the records do not, and no read-back is owed.
    const sent = JSON.stringify([p('old', 1), p('new', 9)])
    const out = server.mergeStoredProjects(sent, JSON.stringify([p('new', 9), p('old', 1)]))
    expect(out.merged).toBe(false)
    expect(out.projects).not.toBe(sent)
  })

  it('never lets an empty or missing field delete anything', () => {
    const stored = JSON.stringify([p('a', 1)])
    for (const sent of [null, undefined, '', '[]', 'garbage']) {
      const out = server.mergeStoredProjects(sent, stored)
      expect(JSON.parse(out.projects).map((x) => x.id)).toEqual(['a'])
      expect(out.merged).toBe(true)
    }
  })

  it('stores null when there is nothing on either side, as before', () => {
    expect(server.mergeStoredProjects(null, null)).toEqual({ projects: null, merged: false })
  })

  it('lets a deletion through as a tombstone', () => {
    const now = Date.now()
    const out = server.mergeStoredProjects(
      JSON.stringify([p('a', now, { deletedAt: now })]),
      JSON.stringify([p('a', now - 1)]),
    )
    expect(JSON.parse(out.projects)[0].deletedAt).toBe(now)
    expect(out.merged).toBe(false)
  })
})
