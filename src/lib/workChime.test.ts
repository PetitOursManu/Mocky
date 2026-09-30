import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CHIME_SETTLE_MS, createWorkWatcher, markTitle, unmarkTitle, type ChimeKind } from './workChime'

/** A fake document: only visibility matters to the watcher. */
function setup() {
  const doc = { hidden: false }
  const finished: ChimeKind[] = []
  const onStart = vi.fn()
  const w = createWorkWatcher({
    isHidden: () => doc.hidden,
    onFinish: (k) => finished.push(k),
    onStart,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  })
  return { doc, finished, onStart, w }
}

describe('createWorkWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('plays "done" once the work has stayed idle, when the tab is hidden', () => {
    const { doc, finished, w } = setup()
    w.observe(true, null)
    doc.hidden = true
    w.observe(false, null)
    vi.advanceTimersByTime(CHIME_SETTLE_MS - 1)
    expect(finished).toEqual([])
    vi.advanceTimersByTime(1)
    expect(finished).toEqual(['done'])
  })

  it('plays nothing when the tab is visible at the end', () => {
    const { finished, w } = setup()
    w.observe(true, null)
    w.observe(false, null)
    vi.advanceTimersByTime(CHIME_SETTLE_MS * 2)
    expect(finished).toEqual([])
  })

  it('plays nothing when the user came back during the wait', () => {
    const { doc, finished, w } = setup()
    w.observe(true, null)
    doc.hidden = true
    w.observe(false, null)
    doc.hidden = false
    w.noteVisible()
    vi.advanceTimersByTime(CHIME_SETTLE_MS)
    expect(finished).toEqual([])
  })

  it('does not play for a look-and-leave during the wait either', () => {
    const { doc, finished, w } = setup()
    w.observe(true, null)
    doc.hidden = true
    w.observe(false, null)
    w.noteVisible() // looked…
    doc.hidden = true // …and left again
    vi.advanceTimersByTime(CHIME_SETTLE_MS)
    expect(finished).toEqual([])
  })

  it('merges a generation and the repair that follows into one chime', () => {
    const { doc, finished, onStart, w } = setup()
    doc.hidden = true
    w.observe(true, null) // generation
    w.observe(false, null)
    vi.advanceTimersByTime(1200) // preview compiles, reports an error
    w.observe(true, null) // automatic repair
    vi.advanceTimersByTime(4000)
    w.observe(false, null)
    vi.advanceTimersByTime(CHIME_SETTLE_MS)
    expect(finished).toEqual(['done'])
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('plays "failed" when an error appeared during the burst', () => {
    const { doc, finished, w } = setup()
    w.observe(true, null)
    doc.hidden = true
    w.observe(false, 'Provider said no') // batched with the end, as setError + setBusy are
    vi.advanceTimersByTime(CHIME_SETTLE_MS)
    expect(finished).toEqual(['failed'])
  })

  it('counts an error that arrives during the wait', () => {
    const { doc, finished, w } = setup()
    w.observe(true, null)
    doc.hidden = true
    w.observe(false, null)
    w.observe(false, 'late')
    vi.advanceTimersByTime(CHIME_SETTLE_MS)
    expect(finished).toEqual(['failed'])
  })

  it('ignores an error that was already on screen when the burst began', () => {
    const { doc, finished, w } = setup()
    w.observe(false, 'from an earlier run')
    w.observe(true, 'from an earlier run') // a repair does not clear the banner
    doc.hidden = true
    w.observe(false, 'from an earlier run')
    vi.advanceTimersByTime(CHIME_SETTLE_MS)
    expect(finished).toEqual(['done'])
  })

  it('ignores errors outside any burst', () => {
    const { doc, finished, w } = setup()
    doc.hidden = true
    w.observe(false, 'capture failed')
    vi.advanceTimersByTime(CHIME_SETTLE_MS)
    expect(finished).toEqual([])
  })

  it('forgets the failure once the burst is over', () => {
    const { doc, finished, w } = setup()
    doc.hidden = true
    w.observe(true, null)
    w.observe(false, 'boom')
    vi.advanceTimersByTime(CHIME_SETTLE_MS)
    w.observe(true, null)
    w.observe(false, null)
    vi.advanceTimersByTime(CHIME_SETTLE_MS)
    expect(finished).toEqual(['failed', 'done'])
  })

  it('repeated idle observations do not restart or add a chime', () => {
    const { doc, finished, w } = setup()
    doc.hidden = true
    w.observe(true, null)
    w.observe(false, null)
    vi.advanceTimersByTime(1000)
    w.observe(false, null)
    vi.advanceTimersByTime(CHIME_SETTLE_MS - 1000)
    expect(finished).toEqual(['done'])
    vi.advanceTimersByTime(CHIME_SETTLE_MS * 3)
    expect(finished).toEqual(['done'])
  })

  it('dispose cancels a pending chime', () => {
    const { doc, finished, w } = setup()
    doc.hidden = true
    w.observe(true, null)
    w.observe(false, null)
    w.dispose()
    vi.advanceTimersByTime(CHIME_SETTLE_MS)
    expect(finished).toEqual([])
  })

  it('plays "failed" when a repair gives up during the wait, with no banner', () => {
    // First generation, then its repair; the repair's result is still broken
    // and onScreenError's give-up branch bumps the counter after the repair
    // has already gone idle.
    const { doc, finished, w } = setup()
    w.observe(true, null, 0)
    doc.hidden = true
    w.observe(false, null, 0)
    w.observe(true, null, 0)
    w.observe(false, null, 0)
    vi.advanceTimersByTime(CHIME_SETTLE_MS / 2)
    w.observe(false, null, 1)
    vi.advanceTimersByTime(CHIME_SETTLE_MS)
    expect(finished).toEqual(['failed'])
  })

  it('ignores the starting value of the counter, and bumps outside a burst', () => {
    const { doc, finished, w } = setup()
    w.observe(false, null, 7)
    w.observe(false, null, 8)
    w.observe(true, null, 8)
    doc.hidden = true
    w.observe(false, null, 8)
    vi.advanceTimersByTime(CHIME_SETTLE_MS)
    expect(finished).toEqual(['done'])
  })

})

describe('title marks', () => {
  it('prefixes, and never stacks', () => {
    expect(markTitle('Mocky', 'done')).toBe('✓ Mocky')
    expect(markTitle(markTitle('Mocky', 'done'), 'failed')).toBe('⚠ Mocky')
  })

  it('removes only its own prefix', () => {
    expect(unmarkTitle('⚠ Mocky')).toBe('Mocky')
    expect(unmarkTitle('✓ Mocky')).toBe('Mocky')
    expect(unmarkTitle('Mocky ✓ ')).toBe('Mocky ✓ ')
    expect(unmarkTitle('Mocky')).toBe('Mocky')
  })
})

describe('createWorkWatcher lets the audio device go', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function withIdle() {
    const doc = { hidden: false }
    const finished: ChimeKind[] = []
    const onIdle = vi.fn()
    const w = createWorkWatcher({
      isHidden: () => doc.hidden,
      onFinish: (k) => finished.push(k),
      onIdle,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    })
    return { doc, finished, onIdle, w }
  }

  it('calls onIdle when a burst ends with nothing to play, and reports busy until then', () => {
    const { onIdle, w } = withIdle()
    expect(w.busy()).toBe(false)
    w.observe(true, null)
    expect(w.busy()).toBe(true)
    w.observe(false, null)
    expect(w.busy()).toBe(true)
    vi.advanceTimersByTime(CHIME_SETTLE_MS)
    expect(w.busy()).toBe(false)
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('does not call onIdle when the burst plays — the sound releases itself', () => {
    const { doc, finished, onIdle, w } = withIdle()
    w.observe(true, null)
    doc.hidden = true
    w.observe(false, null)
    vi.advanceTimersByTime(CHIME_SETTLE_MS)
    expect(finished).toEqual(['done'])
    expect(onIdle).not.toHaveBeenCalled()
  })
})
