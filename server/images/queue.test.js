import { describe, it, expect } from 'vitest'
import { SpacedQueue } from './queue.js'

/** A virtual clock: delay(ms) advances time instantly and deterministically. */
function virtualClock() {
  let t = 0
  return {
    now: () => t,
    delay: async (ms) => {
      t += ms
    },
    advance: (ms) => {
      t += ms
    },
  }
}

describe('SpacedQueue', () => {
  it('spaces successive task starts by at least the interval', async () => {
    const clock = virtualClock()
    const q = new SpacedQueue(100, { now: clock.now, delay: clock.delay })
    const starts = []
    const p = [1, 2, 3].map((n) => q.add(async () => { starts.push(clock.now()); return n }))
    const results = await Promise.all(p)
    expect(results).toEqual([1, 2, 3])
    expect(starts).toEqual([0, 100, 200]) // first immediate, then spaced by 100
  })

  it('runs tasks strictly in enqueue order', async () => {
    const clock = virtualClock()
    const q = new SpacedQueue(0, { now: clock.now, delay: clock.delay })
    const order = []
    await Promise.all(['a', 'b', 'c'].map((x) => q.add(async () => { order.push(x) })))
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('keeps scheduling after a task rejects', async () => {
    const clock = virtualClock()
    const q = new SpacedQueue(50, { now: clock.now, delay: clock.delay })
    const bad = q.add(async () => { throw new Error('boom') })
    const good = q.add(async () => 'ok')
    await expect(bad).rejects.toThrow('boom')
    await expect(good).resolves.toBe('ok') // queue not stalled by the failure
  })

  it('does not wait when the interval has already elapsed', async () => {
    const clock = virtualClock()
    const q = new SpacedQueue(100, { now: clock.now, delay: clock.delay })
    await q.add(async () => {}) // starts at t=0
    clock.advance(500) // plenty of idle time passes
    const start = []
    await q.add(async () => start.push(clock.now()))
    expect(start[0]).toBe(500) // no extra wait added
  })
})
