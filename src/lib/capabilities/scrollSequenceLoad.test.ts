import { describe, it, expect } from 'vitest'
import { ScrollVideoSource } from './snippets/ScrollVideo'

/**
 * How a cut clip's frames are fetched. They were all asked for in the same
 * instant: a Motion film cut to 478 stills sent 478 requests to the instance,
 * and the other previews on the canvas — same host — waited behind them until
 * one hit its 20-second deadline. Now a few at a time, coarse to fine.
 */
const order = ScrollVideoSource.match(/function mockySeqOrder[\s\S]*?\n\}/)?.[0] ?? ''
const load = ScrollVideoSource.match(/function mockySeqLoad[\s\S]*?\n\}/)?.[0] ?? ''
const parallel = ScrollVideoSource.match(/var MOCKY_SEQ_PARALLEL = \d+;/)?.[0] ?? ''

const seqOrder = new Function(`${order}\nreturn mockySeqOrder`)() as (n: number) => number[]

/** A fake Image: records requests, and lets the test decide when one lands. */
function harness() {
  const pending: { onload?: () => void; src?: string }[] = []
  class FakeImage {
    onload?: () => void
    onerror?: () => void
    decoding = ''
    set src(v: string) {
      pending.push(this as unknown as { onload?: () => void; src?: string })
      ;(this as unknown as { _src: string })._src = v
    }
  }
  const seqLoad = new Function('Image', `${parallel}\n${order}\n${load}\nreturn mockySeqLoad`)(FakeImage) as (
    base: string,
    total: number,
    onFrame: (slot: number) => void,
  ) => { loaded: boolean[]; cancel: () => void }
  return { pending, seqLoad }
}

describe('the frames of a scroll sequence', () => {
  it('are asked for coarse to fine, each exactly once, ends included', () => {
    for (const n of [1, 2, 17, 150, 478]) {
      const o = seqOrder(n)
      expect(new Set(o).size, String(n)).toBe(n)
      expect([...o].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i))
      expect(o.includes(n - 1)).toBe(true)
    }
    // The first requests already span the whole clip.
    expect(Math.max(...seqOrder(478).slice(0, 30))).toBeGreaterThan(400)
  })

  it('keeps only a few in flight, and asks for the next as one lands', () => {
    const { pending, seqLoad } = harness()
    const landed: number[] = []
    const set = seqLoad('/api/videos/x', 478, (slot) => landed.push(slot))
    expect(pending).toHaveLength(6)
    pending[0].onload!()
    expect(pending).toHaveLength(7)
    expect(landed).toEqual([0])
    set.cancel()
    pending[1].onload!()
    expect(pending).toHaveLength(7) // a cancelled set asks for nothing more
    expect(landed).toEqual([0])
  })
})
