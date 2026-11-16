import { describe, expect, it } from 'vitest'
import { calendyDrafts, foldIcsLine, monthGrid, scheduledPieces, shiftMonth, toCsv, toIcs } from './campaignSchedule'
import { normalizeScreenCampaign } from './campaign'

const label = (f: string) => ({ instagram: 'Post Instagram', story: 'Story', facebook: 'Facebook', linkedin: 'LinkedIn', poster: 'Affiche', flyer: 'Flyer' })[f] ?? f

const screens = [
  { id: 'a', name: 'Post', campaign: { format: 'instagram' as const, facts: {}, publish: { date: '2026-12-03', time: '09:00' } } },
  { id: 'b', name: 'Visuel LI', campaign: { format: 'linkedin' as const, facts: {}, publish: { date: '2026-12-02', calendyId: 'po7' } } },
  { id: 'c', name: 'Affiche', campaign: { format: 'poster' as const, facts: {}, publish: { date: '2026-12-01' } } },
  { id: 'd', name: 'Pas daté', campaign: { format: 'facebook' as const, facts: {} } },
]

describe('the publication record', () => {
  it('keeps a valid date, time and Calendy id, and drops the rest', () => {
    expect(normalizeScreenCampaign({ format: 'story', facts: {}, publish: { date: '2026-12-03', time: '25:00', calendyId: 'po1' } })).toEqual({
      format: 'story',
      facts: {},
      publish: { date: '2026-12-03', calendyId: 'po1' },
    })
    expect(normalizeScreenCampaign({ format: 'story', facts: {}, publish: { date: '3 déc.' } })).toEqual({ format: 'story', facts: {} })
  })
})

describe('scheduledPieces and calendyDrafts', () => {
  it('orders the dated pieces and maps each to its network', () => {
    const pieces = scheduledPieces(screens)
    expect(pieces.map((p) => p.screenId)).toEqual(['c', 'b', 'a'])
    const { posts, skipped } = calendyDrafts(pieces, 'Portes ouvertes', label)
    expect(skipped.map((p) => p.screenId)).toEqual(['c'])
    expect(posts).toEqual([
      { screenId: 'b', date: '2026-12-02', titre: 'Portes ouvertes · LinkedIn', plateformes: ['LinkedIn'], slot: 'linkedin', imageIdee: 'Visuel LI', calendyId: 'po7' },
      { screenId: 'a', date: '2026-12-03', time: '09:00', titre: 'Portes ouvertes · Post Instagram', plateformes: ['Instagram'], slot: 'meta', imageIdee: 'Post' },
    ])
  })
})

describe('toIcs', () => {
  const ics = toIcs(scheduledPieces(screens), { campaign: 'Fête; été, 2026', formatLabel: label, now: new Date('2026-11-16T08:00:00Z') })

  it('writes a timed event in Paris time and an all-day one', () => {
    expect(ics).toContain('DTSTART;TZID=Europe/Paris:20261203T090000\r\nDTEND;TZID=Europe/Paris:20261203T091500')
    expect(ics).toContain('DTSTART;VALUE=DATE:20261202\r\nDTEND;VALUE=DATE:20261203')
    expect(ics).toContain('UID:a@mocky')
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
  })

  it('escapes text', () => {
    expect(ics).toContain('SUMMARY:Fête\\; été\\, 2026 · Post Instagram')
  })

  it('folds at 75 octets, counting accents as two', () => {
    const folded = foldIcsLine('SUMMARY:' + 'é'.repeat(60))
    for (const l of folded.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
    expect(folded.split('\r\n').slice(1).every((l) => l.startsWith(' '))).toBe(true)
  })
})

describe('toCsv', () => {
  it('names the columns after Calendy and quotes what needs it', () => {
    const csv = toCsv(scheduledPieces(screens), { campaign: 'A "B"; C', formatLabel: label })
    const lines = csv.replace('﻿', '').trim().split('\r\n')
    expect(lines[0]).toBe('datePublication;heure;plateformes;titre;format;ecran')
    expect(lines[3]).toBe('2026-12-03;09:00;Instagram;"A ""B""; C · Post Instagram";Post Instagram;Post')
    expect(csv.startsWith('﻿')).toBe(true)
  })
})

describe('the month', () => {
  it('starts weeks on Monday', () => {
    const weeks = monthGrid('2026-12') // 1 December 2026 is a Tuesday
    expect(weeks[0]).toEqual([null, '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06'])
    expect(weeks.flat().filter(Boolean)).toHaveLength(31)
  })

  it('moves across a year', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})
