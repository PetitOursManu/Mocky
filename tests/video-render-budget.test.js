// The FIFTH hand-kept mirror in the video module, and the one with the shortest
// body: how long a render is allowed to take.
//
// `worker/` is excluded from Mocky's Docker build context on purpose — that
// exclusion is what keeps Remotion's licence out of the default image — so
// `server/video/queue.js` cannot import the worker's constants and the worker
// cannot import Mocky's. Both therefore carry the same arithmetic, and this file
// is what stops them drifting, exactly as `contrast.test.js` does for the WCAG
// half of the audit and `timeline.test.js` for the schema.
//
// The invariant is not "the numbers are equal". It is that the WORKER gives up
// FIRST, by a margin big enough to be the reason a user sees a message naming
// the machine rather than a queue shrugging. Get that backwards and every
// timeout in the feature reports the least useful of the two explanations.
import { describe, it, expect } from 'vitest'
import { JOB_TIMEOUT_MS, jobBudgetMs } from '../server/video/queue.js'
import { RENDER_TIMEOUT_MS, renderBudgetMs } from '../worker/video/server.js'
import { MAX_TOTAL_DURATION_MS } from '../server/video/timeline.js'
import { jobBudgetMs as browserJobBudgetMs } from '../src/lib/video/timeline'

/** Every duration the schema can produce, at a resolution fine enough to catch a bad floor. */
const SWEEP = Array.from({ length: 1 + MAX_TOTAL_DURATION_MS / 250 }, (_, i) => i * 250)

describe('the render budget, on both sides of the wire', () => {
  it('always leaves the worker to give up first', () => {
    for (const film of SWEEP) {
      expect(renderBudgetMs(film), `film of ${film} ms`).toBeLessThan(jobBudgetMs(film))
    }
  })

  it('keeps the ten-second gap the two comments promise each other', () => {
    // Ten seconds is the smallest gap that survives a slow socket: the worker
    // has to fail, write a status line and have it travel back before Mocky's
    // own timer fires. A gap that shrank with the film would be a gap that
    // vanished on the longest renders, which are the ones most likely to need
    // it.
    for (const film of SWEEP) {
      expect(jobBudgetMs(film) - renderBudgetMs(film), `film of ${film} ms`).toBe(10_000)
    }
  })

  it('never gives a render less time than the flat ceiling used to', () => {
    // What makes this change safe to ship: no film that fits today loses time.
    // Only the ones that could not finish at all get more.
    for (const film of SWEEP) {
      expect(jobBudgetMs(film)).toBeGreaterThanOrEqual(JOB_TIMEOUT_MS)
      expect(renderBudgetMs(film)).toBeGreaterThanOrEqual(RENDER_TIMEOUT_MS)
    }
  })

  it('affords the measured cost of a render, with headroom', () => {
    // Measured on the two-core worker at 1080p with Ken Burns running, which is
    // now the DEFAULT rather than the exception: 6 s of film took 22 s, 15.5 s
    // took 66 s, 30.5 s took 130 s. The old flat 110 s ceiling refused the third
    // of those — a film the schema accepts, the panel queues, and the clock then
    // kills.
    const measured = [
      { film: 6_000, seconds: 22 },
      { film: 15_500, seconds: 66 },
      { film: 30_500, seconds: 130 },
    ]
    for (const { film, seconds } of measured) {
      expect(renderBudgetMs(film), `${film} ms of film`).toBeGreaterThan(seconds * 1000 * 1.5)
    }
  })

  it('affords the longest film the schema will accept', () => {
    // The bound that made this a defect rather than a tuning question: the
    // schema hands the queue documents of MAX_TOTAL_DURATION_MS, so a deadline
    // that cannot reach that length is a promise the feature does not keep.
    // 4.3x is the measured worst case; the budget must clear it outright.
    expect(renderBudgetMs(MAX_TOTAL_DURATION_MS)).toBeGreaterThan(MAX_TOTAL_DURATION_MS * 4.3)
  })

  it('gives the browser the same answer as the queue', () => {
    // The panel stops polling on its own deadline, so a browser copy that ran
    // short would report a timeout on a render still happily in progress — and
    // the finished film would then turn up in Media with no panel left to show
    // it. Equality, not an inequality: this pair has no reason to differ.
    for (const film of SWEEP) {
      expect(browserJobBudgetMs(film), `film of ${film} ms`).toBe(jobBudgetMs(film))
    }
  })

  it('reads a missing, empty or malformed timeline as zero rather than throwing', () => {
    // The queue calls this with whatever a journal entry carried across a
    // restart, and a deadline is the last thing that may fail to be computed:
    // a throw here leaves the job in `rendering` for ever, which is the exact
    // hang the timeout exists to prevent.
    for (const bad of [undefined, null, NaN, -1, 'soon', {}]) {
      expect(jobBudgetMs(bad)).toBe(JOB_TIMEOUT_MS)
      expect(renderBudgetMs(bad)).toBe(RENDER_TIMEOUT_MS)
      expect(browserJobBudgetMs(bad)).toBe(JOB_TIMEOUT_MS)
    }
  })

  it('grows with the film rather than in steps', () => {
    // Monotonic, so a longer film never gets a shorter deadline than a shorter
    // one — the kind of inversion a Math.min in the wrong place produces and
    // nothing else catches.
    for (let i = 1; i < SWEEP.length; i += 1) {
      expect(jobBudgetMs(SWEEP[i])).toBeGreaterThanOrEqual(jobBudgetMs(SWEEP[i - 1]))
      expect(renderBudgetMs(SWEEP[i])).toBeGreaterThanOrEqual(renderBudgetMs(SWEEP[i - 1]))
    }
  })
})
