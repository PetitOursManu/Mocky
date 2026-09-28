import { describe, it, expect } from 'vitest'
import { formatMoment, momentToken, splitMoments, zoneOf } from './announcementText'

const AT = Date.parse('2026-09-29T01:22:00.000Z')

describe('splitMoments', () => {
  it('cuts the text into runs and moments', () => {
    expect(splitMoments('Mise à jour prévue le {{datetime:2026-09-29T01:22:00.000Z}}.')).toEqual([
      'Mise à jour prévue le ',
      { kind: 'datetime', at: AT },
      '.',
    ])
  })

  it('leaves a moment that does not parse as the text it is', () => {
    expect(splitMoments('Retour {{date:demain}}')).toEqual(['Retour {{date:demain}}'])
  })

  it('round-trips what the Insert button writes', () => {
    expect(splitMoments(momentToken('time', new Date(AT)))).toEqual([{ kind: 'time', at: AT }])
  })
})

describe('formatMoment', () => {
  // The user's own example, read from Paris (UTC+2 at the end of September).
  it('writes the instant in the reader’s zone, the French way', () => {
    const f = { lang: 'fr' as const, timeZone: 'Europe/Paris' }
    expect(formatMoment({ kind: 'datetime', at: AT }, f)).toBe('29/09/2026 à 03h22')
    expect(formatMoment({ kind: 'date', at: AT }, f)).toBe('29/09/2026')
    expect(formatMoment({ kind: 'time', at: AT }, f)).toBe('03h22')
  })

  // The same instant is the previous evening in Montréal — the point of storing an instant.
  it('gives another reader another clock for the same instant', () => {
    expect(formatMoment({ kind: 'datetime', at: AT }, { lang: 'fr', timeZone: 'America/Montreal' })).toBe(
      '28/09/2026 à 21h22',
    )
  })

  it('writes English with the browser’s English locale', () => {
    expect(formatMoment({ kind: 'datetime', at: AT }, { lang: 'en', timeZone: 'Europe/London' })).toBe(
      '29/09/2026 at 02:22',
    )
    expect(formatMoment({ kind: 'date', at: AT }, { lang: 'en', timeZone: 'America/New_York', locale: 'en-US' })).toBe(
      '09/28/2026',
    )
  })

  it('names the zone for the tooltip', () => {
    expect(zoneOf(AT, { lang: 'en', timeZone: 'Europe/Paris' })).toMatch(/Central European/)
  })
})
