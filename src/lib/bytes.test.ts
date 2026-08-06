import { describe, expect, it } from 'vitest'
import { shareOf, splitBytes } from './bytes'

describe('splitBytes', () => {
  it('leaves small sizes in bytes', () => {
    expect(splitBytes(0)).toEqual({ value: 0, unit: 'b' })
    expect(splitBytes(1023)).toEqual({ value: 1023, unit: 'b' })
  })

  it('climbs a unit at each 1024', () => {
    expect(splitBytes(1024)).toEqual({ value: 1, unit: 'kb' })
    expect(splitBytes(1024 * 1024)).toEqual({ value: 1, unit: 'mb' })
    expect(splitBytes(1024 * 1024 * 1024)).toEqual({ value: 1, unit: 'gb' })
  })

  it('keeps a decimal on gigabytes only', () => {
    // The ceiling is set in GB, and whole-number GB prints "0 GB of 10 GB" for
    // every instance that is not yet in trouble.
    expect(splitBytes(1.5 * 1024 * 1024 * 1024)).toEqual({ value: 1.5, unit: 'gb' })
    expect(splitBytes(1.5 * 1024 * 1024)).toEqual({ value: 2, unit: 'mb' })
  })

  it('never reports a negative or a non-number as anything but zero', () => {
    expect(splitBytes(-500)).toEqual({ value: 0, unit: 'b' })
    expect(splitBytes(NaN)).toEqual({ value: 0, unit: 'b' })
  })
})

describe('shareOf', () => {
  it('is a percentage of the total', () => {
    expect(shareOf(50, 200)).toBe(25)
  })

  it('has no answer when there is no ceiling', () => {
    // Null, not 0: "uses nothing" and "there is nothing to measure against"
    // are different claims, and a zero bar makes the second look like the first.
    expect(shareOf(50, 0)).toBeNull()
    expect(shareOf(50, Infinity)).toBeNull()
  })

  it('clamps rather than overflowing its bar', () => {
    expect(shareOf(300, 200)).toBe(100)
    expect(shareOf(-5, 200)).toBe(0)
  })
})
