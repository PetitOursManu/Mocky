import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createDiskBudget, dirSize, maxBytesFromEnv, formatBytes, DEFAULT_MAX_MB } from './storage-quota.js'

/**
 * There was no ceiling at all. `POST /api/videos/upload` takes 200 MB at a time,
 * twenty a minute, each clip kept whole PLUS up to 150 extracted frames — about
 * 4 GB a minute from one ordinary account. And a full volume is worse than it
 * sounds: every store swallows its own write errors, so accounts, sessions and
 * projects quietly stop being saved while the API still answers 200.
 */

function tmpTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-quota-'))
  fs.mkdirSync(path.join(root, 'images'), { recursive: true })
  fs.mkdirSync(path.join(root, 'videos', 'seq'), { recursive: true })
  fs.writeFileSync(path.join(root, 'images', 'a.jpg'), Buffer.alloc(1000))
  fs.writeFileSync(path.join(root, 'images', 'b.jpg'), Buffer.alloc(2000))
  fs.writeFileSync(path.join(root, 'videos', 'seq', 'f1.jpg'), Buffer.alloc(500))
  return root
}

describe('dirSize', () => {
  it('adds up nested files', () => {
    const root = tmpTree()
    expect(dirSize(path.join(root, 'images'))).toBe(3000)
    expect(dirSize(path.join(root, 'videos'))).toBe(500) // walks into seq/
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('treats a missing directory as empty rather than throwing', () => {
    // First boot: neither library exists yet, and that must not stop the server.
    expect(dirSize(path.join(os.tmpdir(), 'mocky-does-not-exist-' + Date.now()))).toBe(0)
  })
})

describe('maxBytesFromEnv', () => {
  it('defaults to a generous ceiling rather than none', () => {
    expect(maxBytesFromEnv({})).toBe(DEFAULT_MAX_MB * 1024 * 1024)
  })

  it('honours an explicit value', () => {
    expect(maxBytesFromEnv({ MOCKY_MAX_STORAGE_MB: '500' })).toBe(500 * 1024 * 1024)
  })

  it('treats 0 as unlimited — an explicit opt-out, never the default', () => {
    expect(maxBytesFromEnv({ MOCKY_MAX_STORAGE_MB: '0' })).toBe(0)
  })

  it('falls back to the default on nonsense', () => {
    for (const v of ['abc', '-5', '']) {
      expect(maxBytesFromEnv({ MOCKY_MAX_STORAGE_MB: v })).toBe(DEFAULT_MAX_MB * 1024 * 1024)
    }
  })
})

describe('disk budget', () => {
  it('seeds from what is already on disk', () => {
    const root = tmpTree()
    const b = createDiskBudget({ dirs: [path.join(root, 'images'), path.join(root, 'videos')], maxBytes: 10_000 })
    expect(b.seed()).toBe(3500)
    expect(b.usage().bytes).toBe(3500)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('refuses a write that would cross the ceiling', () => {
    const root = tmpTree()
    const b = createDiskBudget({ dirs: [path.join(root, 'images')], maxBytes: 4000 })
    expect(b.wouldExceed(500)).toBe(false) // 3000 + 500
    expect(b.wouldExceed(2000)).toBe(true) // 3000 + 2000
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('never refuses anything when unlimited', () => {
    const b = createDiskBudget({ dirs: [], maxBytes: 0 })
    expect(b.wouldExceed(Number.MAX_SAFE_INTEGER)).toBe(false)
    expect(b.usage().ratio).toBeNull()
  })

  it('frees space again on delete', () => {
    const b = createDiskBudget({ dirs: [], maxBytes: 1000 })
    b.seed()
    b.add(900)
    expect(b.wouldExceed(200)).toBe(true)
    b.remove(900)
    expect(b.wouldExceed(200)).toBe(false)
  })

  it('cannot be driven negative by over-crediting deletes', () => {
    // Otherwise a delete of something never charged for would mint free quota.
    const b = createDiskBudget({ dirs: [], maxBytes: 1000 })
    b.seed()
    b.remove(50_000)
    expect(b.usage().bytes).toBe(0)
  })

  it('seeds lazily so a caller never sees a zero it did not ask for', () => {
    const root = tmpTree()
    const b = createDiskBudget({ dirs: [path.join(root, 'images')], maxBytes: 10_000 })
    // No explicit seed() — usage() must still be truthful.
    expect(b.usage().bytes).toBe(3000)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('formatBytes', () => {
  it('does not print small ceilings as "0.0 GB"', () => {
    // The first version fixed on GB, so a 1 MB quota reported "0.0 GB of
    // 0.0 GB" — a message that reads as a bug rather than a limit.
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
    expect(formatBytes(700 * 1024)).toBe('700 kB')
    expect(formatBytes(0)).toBe('0 B')
  })

  it('switches to GB where GB is the readable unit', () => {
    expect(formatBytes(10 * 1024 * 1024 * 1024)).toBe('10.0 GB')
  })

  it('survives nonsense rather than printing NaN at the user', () => {
    expect(formatBytes(undefined)).toBe('0 B')
    expect(formatBytes(-5)).toBe('0 B')
  })
})
