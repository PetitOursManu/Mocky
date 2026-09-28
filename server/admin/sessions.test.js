import { describe, it, expect } from 'vitest'
import { describeUserAgent, listSessions, sessionId, tokenForId } from './sessions.js'
import { liveAnnouncement, makeAnnouncement, normalizeMoments, readAnnouncement } from './announcement.js'

describe('describeUserAgent', () => {
  it.each([
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
      'Edge 129 · Windows',
    ],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0', 'Firefox 131 · Windows'],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Safari 17 · iOS',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
      'Chrome 129 · Android',
    ],
    ['curl/8.5.0', 'curl 8'],
    ['', null],
    ['something else entirely', null],
  ])('%s → %s', (ua, want) => {
    expect(describeUserAgent(ua)).toBe(want)
  })
})

describe('listSessions', () => {
  const users = [
    { id: 'u1', username: 'alice', role: 'admin' },
    { id: 'u2', username: 'bob' },
  ]
  const sessions = {
    tokA: { u: 'u1', t: 100, c: 50, ua: 'Firefox 131 · Windows', ip: '10.0.0.2' },
    tokB: { u: 'u2', t: 300 },
    tokC: { u: 'ghost', t: 999 },
  }

  // The token IS the credential; the panel gets a hash to revoke by.
  it('never hands out a token', () => {
    const rows = listSessions(sessions, users)
    expect(JSON.stringify(rows)).not.toMatch(/tok[ABC]/)
    expect(rows.map((r) => r.id)).toEqual([sessionId('tokB'), sessionId('tokA')])
  })

  it('drops sessions of deleted accounts and marks the caller’s own', () => {
    const rows = listSessions(sessions, users, { currentToken: 'tokA' })
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.current).username).toBe('alice')
  })

  it('prefers the in-memory last use over the once-a-day stamp', () => {
    const rows = listSessions(sessions, users, { lastUse: new Map([[sessionId('tokA'), 5000]]) })
    expect(rows[0]).toMatchObject({ username: 'alice', lastUsedAt: 5000 })
  })

  it('says a legacy session’s creation is unknown rather than inventing one', () => {
    expect(listSessions(sessions, users).find((r) => r.username === 'bob').createdAt).toBeNull()
  })

  it('finds a token back from its handle, and refuses anything else', () => {
    expect(tokenForId(sessions, sessionId('tokB'))).toBe('tokB')
    expect(tokenForId(sessions, 'tokB')).toBeNull()
    expect(tokenForId(sessions, '0'.repeat(24))).toBeNull()
  })
})

describe('announcements', () => {
  it('keeps the id when only the expiry changes, and mints one when the text does', () => {
    const a = makeAnnouncement({ message: 'Redémarrage à 22 h', tone: 'warn' }, { now: 1000 })
    const b = makeAnnouncement({ message: 'Redémarrage à 22 h', tone: 'warn', expiresInHours: 2 }, { now: 2000, previous: a })
    expect(b.id).toBe(a.id)
    expect(b.expiresAt).toBe(2000 + 2 * 3600_000)
    const c = makeAnnouncement({ message: 'Redémarrage à 23 h', tone: 'warn' }, { now: 3000, previous: b })
    expect(c.id).not.toBe(a.id)
  })

  it('refuses an empty message and an absurd duration', () => {
    expect(() => makeAnnouncement({ message: '   ' })).toThrow()
    expect(() => makeAnnouncement({ message: 'x', expiresInHours: -1 })).toThrow()
    expect(() => makeAnnouncement({ message: 'x', expiresInHours: 99999 })).toThrow()
  })

  it('waits for a scheduled start, and runs the duration from it', () => {
    const H = 3600_000
    const a = makeAnnouncement({ message: 'Maintenance vendredi', startsAt: new Date(10 * H).toISOString(), expiresInHours: 4 }, { now: 0 })
    expect(a).toMatchObject({ startsAt: 10 * H, expiresAt: 14 * H })
    // Users see nothing before the start; the dashboard sees it as scheduled.
    expect(liveAnnouncement(a, 9 * H)).toBeNull()
    expect(readAnnouncement(a, 9 * H)).toMatchObject({ status: 'scheduled' })
    expect(liveAnnouncement(a, 11 * H)).toMatchObject({ status: 'live' })
    expect(readAnnouncement(a, 14 * H)).toBeNull()
  })

  it('treats a start in the past as now, and refuses one too far ahead', () => {
    expect(makeAnnouncement({ message: 'x', startsAt: 500 }, { now: 1000 }).startsAt).toBeNull()
    expect(() => makeAnnouncement({ message: 'x', startsAt: 'someday' })).toThrow()
    expect(() => makeAnnouncement({ message: 'x', startsAt: Date.now() + 400 * 24 * 3600_000 })).toThrow()
  })

  it('keeps the id when only the start moves', () => {
    const a = makeAnnouncement({ message: 'x', startsAt: 10_000_000 }, { now: 0 })
    expect(makeAnnouncement({ message: 'x', startsAt: 20_000_000 }, { now: 0, previous: a }).id).toBe(a.id)
  })

  // An instant in the text is stored in UTC; each browser writes it in its own zone.
  it('stores a moment in the text as ISO UTC, and refuses one that does not parse', () => {
    expect(normalizeMoments('Mise à jour le {{datetime:2026-09-29T03:22+02:00}}.')).toBe(
      'Mise à jour le {{datetime:2026-09-29T01:22:00.000Z}}.',
    )
    expect(normalizeMoments('{{date:2026-09-29T00:00Z}} et {{time:2026-09-29T01:22Z}}')).toBe(
      '{{date:2026-09-29T00:00:00.000Z}} et {{time:2026-09-29T01:22:00.000Z}}',
    )
    expect(() => makeAnnouncement({ message: 'Retour {{datetime:demain}}' })).toThrow(/illisible/)
    // Braces that are not a moment are plain text.
    expect(normalizeMoments('{{rien}} {date:x}')).toBe('{{rien}} {date:x}')
  })

  it('hides an expired announcement and cleans what it shows', () => {
    const a = makeAnnouncement({ message: 'hello\u0007 world', tone: 'nope', expiresInHours: 1 }, { now: 0 })
    expect(liveAnnouncement(a, 1000)).toMatchObject({ message: 'hello world', tone: 'info' })
    expect(liveAnnouncement(a, 3600_000)).toBeNull()
    expect(liveAnnouncement(null)).toBeNull()
  })
})
