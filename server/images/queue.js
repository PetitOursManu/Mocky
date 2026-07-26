// SpacedQueue — serializes async tasks and guarantees a minimum interval between
// task STARTS. Pollinations' anonymous tier is ≈1 req / 15 s, so image
// generation must be paced server-side (prompt §4.1) while running in parallel
// with component generation. Clock + delay are injectable for deterministic tests.

export class SpacedQueue {
  /**
   * @param {number} intervalMs  minimum gap between successive task starts
   * @param {object} [opts]
   * @param {()=>number} [opts.now]
   * @param {(ms:number)=>Promise<void>} [opts.delay]
   */
  constructor(intervalMs, opts = {}) {
    this.intervalMs = intervalMs
    this.now = opts.now || (() => Date.now())
    this.delay = opts.delay || ((ms) => new Promise((r) => setTimeout(r, ms)))
    this.tail = Promise.resolve()
    this.lastStart = -Infinity
  }

  /**
   * Enqueue `fn`. Resolves/rejects with fn's result; a rejecting task never
   * stalls the queue (the next task still runs, spaced from this one's start).
   * @template T
   * @param {()=>Promise<T>} fn
   * @returns {Promise<T>}
   */
  add(fn) {
    const run = async () => {
      const wait = this.intervalMs - (this.now() - this.lastStart)
      if (wait > 0) await this.delay(wait)
      this.lastStart = this.now()
      return fn()
    }
    // Chain onto the tail so tasks are strictly serial; run regardless of a
    // previous task's outcome.
    const result = this.tail.then(run, run)
    // The scheduling tail must never reject, or it would swallow the next task.
    this.tail = result.then(
      () => {},
      () => {},
    )
    return result
  }
}
