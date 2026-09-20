import { describe, it, expect } from 'vitest'
import { mediaTimeLabel } from './mediaTime'

/** A fixed afternoon, so every boundary below is arithmetic and not a wait. */
const NOW = new Date('2026-08-12T14:30:00').getTime()
const ago = (ms: number) => NOW - ms
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

describe('mediaTimeLabel — today is relative', () => {
  it('counts seconds, then minutes, then hours', () => {
    expect(mediaTimeLabel(ago(3 * SECOND), NOW)).toEqual({ kind: 'seconds', n: 3 })
    expect(mediaTimeLabel(ago(5 * MINUTE), NOW)).toEqual({ kind: 'minutes', n: 5 })
    expect(mediaTimeLabel(ago(3 * HOUR), NOW)).toEqual({ kind: 'hours', n: 3 })
  })

  it('switches unit exactly on the boundary, not a second early', () => {
    // 59 s is still seconds; 60 s is one minute. The off-by-one here reads as
    // "il y a 60 secondes", which is the kind of thing nobody reports and
    // everybody notices.
    expect(mediaTimeLabel(ago(59 * SECOND), NOW)).toEqual({ kind: 'seconds', n: 59 })
    expect(mediaTimeLabel(ago(MINUTE), NOW)).toEqual({ kind: 'minutes', n: 1 })
    expect(mediaTimeLabel(ago(59 * MINUTE), NOW)).toEqual({ kind: 'minutes', n: 59 })
    expect(mediaTimeLabel(ago(HOUR), NOW)).toEqual({ kind: 'hours', n: 1 })
  })

  it('says zero seconds for something made just now, never a negative', () => {
    expect(mediaTimeLabel(NOW, NOW)).toEqual({ kind: 'seconds', n: 0 })
    // A browser clock a second ahead of the server is ordinary, and
    // "il y a -1 seconde" is not.
    expect(mediaTimeLabel(NOW + 1500, NOW)).toEqual({ kind: 'seconds', n: 0 })
  })
})

describe('mediaTimeLabel — another day is absolute', () => {
  it('leaves the relative form at midnight, not at 24 hours', () => {
    // THE case this file exists for. At 00:30, something made at 23:00 the
    // night before is ninety minutes old — and belongs to yesterday. "il y a
    // 1 heure" is true and useless to somebody scanning for today's work.
    const justAfterMidnight = new Date('2026-08-12T00:30:00').getTime()
    const lastNight = new Date('2026-08-11T23:00:00').getTime()
    const label = mediaTimeLabel(lastNight, justAfterMidnight)
    expect(label?.kind).toBe('absolute')
    // Same instant, read from later the same day, is relative.
    expect(mediaTimeLabel(lastNight, new Date('2026-08-11T23:40:00').getTime())?.kind).toBe('minutes')
  })

  it('gives the day and the time, because a library is browsed by both', () => {
    const label = mediaTimeLabel(new Date('2026-08-09T18:05:00').getTime(), NOW, 'fr')
    expect(label?.kind).toBe('absolute')
    const text = (label as { text: string }).text
    expect(text).toMatch(/9/)
    expect(text).toMatch(/18[:h]05/)
  })

  it('follows the reader’s language rather than a hand-written month table', () => {
    const at = new Date('2026-08-09T18:05:00').getTime()
    const fr = (mediaTimeLabel(at, NOW, 'fr') as { text: string }).text
    const en = (mediaTimeLabel(at, NOW, 'en') as { text: string }).text
    expect(fr).not.toBe(en)
    expect(en).toMatch(/Aug/)
  })
})

describe('mediaTimeLabel — a record with no usable date', () => {
  it('shows nothing rather than 1970', () => {
    // Older library entries predate the field, and a partial write can leave it
    // undefined. "il y a 56 ans" under a thumbnail is worse than a blank line.
    for (const bad of [0, -1, NaN, undefined as unknown as number, null as unknown as number]) {
      expect(mediaTimeLabel(bad, NOW)).toBeNull()
    }
  })
})
