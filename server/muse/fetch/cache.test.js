import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { MuseCache } from './cache.js'

let file
beforeEach(() => {
  file = path.join(os.tmpdir(), `muse-cache-${crypto.randomBytes(6).toString('hex')}.json`)
})
afterEach(() => {
  try { fs.rmSync(file, { force: true }) } catch { /* ignore */ }
})

describe('MuseCache', () => {
  it('stores and returns text', () => {
    const c = new MuseCache(file)
    c.set('https://a.test', '# hello')
    expect(c.get('https://a.test')).toBe('# hello')
    expect(c.get('https://missing.test')).toBeNull()
  })

  it('rejects non-string values (text-only, M2)', () => {
    const c = new MuseCache(file)
    expect(() => c.set('k', { not: 'a string' })).toThrow(/text/i)
    expect(() => c.set('k', Buffer.from('x'))).toThrow()
  })

  it('expires entries past the TTL', () => {
    let t = 1000
    const c = new MuseCache(file, { ttlMs: 100, now: () => t })
    c.set('k', 'v')
    t = 1050
    expect(c.get('k')).toBe('v') // still fresh
    t = 2000
    expect(c.get('k')).toBeNull() // expired
  })

  it('persists across instances (survives a restart)', () => {
    const c1 = new MuseCache(file)
    c1.set('k', 'persisted')
    const c2 = new MuseCache(file)
    expect(c2.get('k')).toBe('persisted')
  })

  it('prune() drops expired entries', () => {
    let t = 0
    const c = new MuseCache(file, { ttlMs: 10, now: () => t })
    c.set('a', '1')
    t = 5
    c.set('b', '2')
    t = 12 // 'a' expired, 'b' fresh
    expect(c.prune()).toBe(1)
    expect(c.get('a')).toBeNull()
    expect(c.get('b')).toBe('2')
  })

  it('never throws when the target path is invalid (persist failure is swallowed)', () => {
    // Use an existing FILE as if it were a parent directory → mkdir/write fails
    // deterministically (ENOTDIR) on every platform; _persist must swallow it.
    const asFile = path.join(os.tmpdir(), `muse-file-${crypto.randomBytes(4).toString('hex')}`)
    fs.writeFileSync(asFile, 'x')
    try {
      const bad = path.join(asFile, 'child.json')
      const c = new MuseCache(bad)
      expect(() => c.set('k', 'v')).not.toThrow()
      expect(c.get('k')).toBe('v') // still works in-memory
    } finally {
      try { fs.rmSync(asFile, { force: true }) } catch { /* ignore */ }
    }
  })
})
