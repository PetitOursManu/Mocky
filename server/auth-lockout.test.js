import { describe, it, expect } from 'vitest'
import { createLockout, LOCK_AFTER } from './auth-lockout.js'

/**
 * Tested here rather than over HTTP on purpose.
 *
 * Driving this through /api/login is impossible in one burst: the per-IP
 * limiter answers 429 at eight attempts, before the tenth account failure can
 * be recorded. A first attempt at an end-to-end test failed for exactly that
 * reason and looked like a broken lockout when the lockout was fine — the two
 * defences simply have different thresholds because they stop different things.
 */

/** A clock the test drives, so nothing here waits fifteen real minutes. */
function fakeClock(start = 1_000_000) {
  let t = start
  return { now: () => t, advance: (ms) => (t += ms) }
}

describe('account lockout', () => {
  it('lets a normal wrong password through without freezing anything', () => {
    const l = createLockout()
    l.fail('alice')
    expect(l.lockedFor('alice')).toBe(0)
  })

  it('freezes the account once the threshold is reached', () => {
    const l = createLockout()
    for (let i = 0; i < LOCK_AFTER; i++) l.fail('alice')
    expect(l.lockedFor('alice')).toBeGreaterThan(0)
  })

  it('freezes only the account that was attacked', () => {
    const l = createLockout()
    for (let i = 0; i < LOCK_AFTER; i++) l.fail('alice')
    expect(l.lockedFor('bob')).toBe(0)
  })

  it('treats an unknown username exactly like a real one', () => {
    // Otherwise the lockout answers "does this account exist?" for free, which
    // is half of what someone guessing credentials is trying to find out.
    const l = createLockout()
    for (let i = 0; i < LOCK_AFTER; i++) l.fail('does-not-exist')
    expect(l.lockedFor('does-not-exist')).toBeGreaterThan(0)
  })

  it('thaws once the freeze expires', () => {
    const c = fakeClock()
    const l = createLockout({ now: c.now })
    for (let i = 0; i < LOCK_AFTER; i++) l.fail('alice')
    expect(l.lockedFor('alice')).toBeGreaterThan(0)
    c.advance(15 * 60_000 + 1_000)
    expect(l.lockedFor('alice')).toBe(0)
  })

  it('does not accumulate failures spread beyond the window', () => {
    // Someone mistyping their password once a day must never be locked out.
    const c = fakeClock()
    const l = createLockout({ now: c.now })
    for (let i = 0; i < LOCK_AFTER * 3; i++) {
      l.fail('alice')
      c.advance(15 * 60_000 + 1_000)
    }
    expect(l.lockedFor('alice')).toBe(0)
  })

  it('a correct password clears the record', () => {
    const l = createLockout()
    for (let i = 0; i < LOCK_AFTER - 1; i++) l.fail('alice')
    l.succeed('alice')
    for (let i = 0; i < LOCK_AFTER - 1; i++) l.fail('alice')
    expect(l.lockedFor('alice')).toBe(0)
  })

  it('reports seconds remaining, for Retry-After', () => {
    const l = createLockout()
    for (let i = 0; i < LOCK_AFTER; i++) l.fail('alice')
    const secs = l.lockedFor('alice')
    expect(secs).toBeGreaterThan(0)
    expect(secs).toBeLessThanOrEqual(15 * 60)
  })

  it('does not grow without bound when usernames are cycled', () => {
    const c = fakeClock()
    const l = createLockout({ now: c.now })
    for (let i = 0; i < 6000; i++) {
      l.fail(`user${i}`)
      if (i % 1000 === 0) c.advance(15 * 60_000 + 1)
    }
    expect(l.size()).toBeLessThan(6000)
  })
})
