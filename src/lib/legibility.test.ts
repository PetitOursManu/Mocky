import { describe, it, expect } from 'vitest'
import { legibilityVerdict } from './legibility'

/** `n` pixels of ground, as the probe hands them over: ink already removed. */
function ground(px: number[] | ((i: number) => number[]), n = 400): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const c = typeof px === 'function' ? px(i) : px
    out.push(c[0], c[1], c[2], 255)
  }
  return out
}

/** A photograph-like ground: a gentle ramp between two tones. */
const ramp = (a: number[], b: number[]) => (i: number) => a.map((v, k) => Math.round(v + ((b[k] - v) * (i % 100)) / 99))

describe('legibilityVerdict', () => {
  it('passes white type on a dark photograph', () => {
    const v = legibilityVerdict(ground(ramp([20, 18, 16], [70, 64, 58])), [255, 255, 255], false)!
    expect(v.ratio).toBeGreaterThan(v.need)
  })

  /** The real case: a pale eyebrow on a sunlit wall. */
  it('fails pale type on a light wall', () => {
    const v = legibilityVerdict(ground(ramp([190, 180, 165], [236, 230, 220])), [240, 236, 228], false)!
    expect(v.ratio).toBeLessThan(v.need)
  })

  it('judges the WORST of a mixed ground, not its average', () => {
    const mixed = (i: number) => (i % 10 === 1 ? [235, 230, 220] : [25, 25, 25])
    const v = legibilityVerdict(ground(mixed), [250, 250, 250], false)!
    expect(v.ratio).toBeLessThan(v.need)
  })

  /** A flat colour is the accessibility audit's to measure, from the classes. */
  it('says nothing about a uniform ground, or a box too small to read', () => {
    expect(legibilityVerdict(ground([247, 246, 244]), [109, 131, 122], false)).toBeNull()
    expect(legibilityVerdict(ground([0, 0, 0], 10), [255, 255, 255], false)).toBeNull()
  })

  it('asks less of large type', () => {
    expect(legibilityVerdict(ground(ramp([100, 100, 100], [160, 160, 160])), [255, 255, 255], true)!.need).toBe(3)
  })

  /** It is injected into the capture frame as source, where nothing else exists. */
  it('is self-contained', () => {
    const rebuilt = new Function(`return (${legibilityVerdict.toString()})`)()
    const g = ground(ramp([20, 18, 16], [70, 64, 58]))
    expect(rebuilt(g, [255, 255, 255], false)).toEqual(legibilityVerdict(g, [255, 255, 255], false))
  })
})
