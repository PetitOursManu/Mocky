import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createShareStore, isShareToken, MAX_SHARES_PER_USER, TTL_CHOICES } from './share.js'

/**
 * A share token IS the credential — the URL is the whole authority. So the
 * properties worth pinning are the ones that decide who can see what: it must
 * be unguessable, it must stop working on time, it must open exactly one
 * screen, and its owner must be able to take it back.
 *
 * The clock is injected so expiry is tested by moving time rather than by
 * sleeping through it.
 */

let dir
let clock
const now = () => clock
const store = () => createShareStore(dir, { now })

const SNAP = {
  screenId: 's1',
  name: 'Landing',
  code: 'function App(){return <div/>}',
  componentName: 'App',
  caps: ['motion'],
  w: 1440,
  h: 900,
  device: 'none',
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-share-'))
  clock = 1_700_000_000_000
})
afterEach(() => {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    /* best effort */
  }
})

describe('token shape', () => {
  it('is 256 bits of hex — the URL has to be unguessable', () => {
    const { token } = store().create('u1', SNAP)
    expect(token).toMatch(/^[a-f0-9]{64}$/)
    expect(isShareToken(token)).toBe(true)
  })

  it('never repeats', () => {
    const s = store()
    const seen = new Set()
    for (let i = 0; i < 25; i++) seen.add(s.create('u1', SNAP).token)
    expect(seen.size).toBe(25)
  })

  it('rejects anything that is not a token, without touching the store', () => {
    const s = store()
    for (const bad of ['', 'x', '../../etc/passwd', 'A'.repeat(64), null, undefined]) {
      expect(s.get(bad)).toBeNull()
    }
  })
})

describe('what a share exposes', () => {
  it('returns the screen, and only the screen', () => {
    const s = store()
    const { token } = s.create('u1', { ...SNAP, prompt: 'confidential brief' })
    const got = s.get(token)
    expect(got.code).toBe(SNAP.code)
    expect(got.name).toBe('Landing')
    // The brief that produced a mockup is often the confidential half. Someone
    // looking at the screen on a phone has no need of it, so it never travels.
    expect(got.prompt).toBeUndefined()
    expect(got.userId).toBeUndefined()
  })

  it('is a snapshot: editing the screen afterwards does not change the link', () => {
    const s = store()
    const { token } = s.create('u1', SNAP)
    s.create('u1', { ...SNAP, code: 'function App(){return <p>changed</p>}' })
    expect(s.get(token).code).toBe(SNAP.code)
  })

  it('refuses a screen with no code rather than publishing a blank page', () => {
    expect(() => store().create('u1', { ...SNAP, code: '   ' })).toThrow(/no code/i)
  })

  it('refuses a screen too large to be a screen', () => {
    expect(() => store().create('u1', { ...SNAP, code: 'x'.repeat(600 * 1024) })).toThrow(/too large/i)
  })
})

describe('expiry', () => {
  it('stops working once the clock passes it', () => {
    const s = store()
    const { token } = s.create('u1', SNAP, '1h')
    expect(s.get(token)).not.toBeNull()
    clock += TTL_CHOICES['1h'] + 1
    expect(s.get(token)).toBeNull()
  })

  it('honours the chosen lifetime', () => {
    const s = store()
    const { expiresAt } = s.create('u1', SNAP, '7d')
    expect(expiresAt).toBe(clock + TTL_CHOICES['7d'])
  })

  it('falls back to the default lifetime on an unknown choice', () => {
    const s = store()
    const { expiresAt } = s.create('u1', SNAP, 'forever')
    expect(expiresAt).toBe(clock + TTL_CHOICES['24h'])
  })

  it('forgets expired records instead of accumulating them', () => {
    const s = store()
    s.create('u1', SNAP, '1h')
    clock += TTL_CHOICES['1h'] + 1
    s.get('0'.repeat(64)) // any read prunes
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'shares.json'), 'utf8'))).toEqual({})
  })
})

describe('revocation', () => {
  it('lets the owner take a link back', () => {
    const s = store()
    const { token } = s.create('u1', SNAP)
    expect(s.revoke('u1', token)).toBe(true)
    expect(s.get(token)).toBeNull()
  })

  it('does not let another account revoke it', () => {
    // A token is a credential; one user revoking another's would be a denial of
    // service that needs no guessing at all.
    const s = store()
    const { token } = s.create('u1', SNAP)
    expect(s.revoke('u2', token)).toBe(false)
    expect(s.get(token)).not.toBeNull()
  })

  it('clears everything for a deleted account', () => {
    const s = store()
    s.create('u1', SNAP)
    s.create('u1', SNAP)
    s.create('u2', SNAP)
    expect(s.revokeAllFor('u1')).toBe(2)
    expect(s.list('u1')).toHaveLength(0)
    expect(s.list('u2')).toHaveLength(1)
  })
})

describe('listing', () => {
  it('shows only your own links, and never the code', () => {
    const s = store()
    s.create('u1', SNAP)
    s.create('u2', SNAP)
    const mine = s.list('u1')
    expect(mine).toHaveLength(1)
    expect(mine[0].code).toBeUndefined()
    expect(mine[0].token).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is newest first', () => {
    const s = store()
    s.create('u1', { ...SNAP, name: 'old' })
    clock += 1000
    s.create('u1', { ...SNAP, name: 'new' })
    expect(s.list('u1').map((r) => r.name)).toEqual(['new', 'old'])
  })
})

describe('ceilings', () => {
  it('caps how many links one account can have out', () => {
    const s = store()
    for (let i = 0; i < MAX_SHARES_PER_USER; i++) s.create('u1', SNAP)
    expect(() => s.create('u1', SNAP)).toThrow(/revoke one first/i)
  })

  it('frees a slot when one is revoked', () => {
    const s = store()
    const first = s.create('u1', SNAP).token
    for (let i = 1; i < MAX_SHARES_PER_USER; i++) s.create('u1', SNAP)
    s.revoke('u1', first)
    expect(() => s.create('u1', SNAP)).not.toThrow()
  })

  it('does not count another account against your ceiling', () => {
    const s = store()
    for (let i = 0; i < MAX_SHARES_PER_USER; i++) s.create('u2', SNAP)
    expect(() => s.create('u1', SNAP)).not.toThrow()
  })
})

describe('durability', () => {
  it('survives a restart', () => {
    const { token } = store().create('u1', SNAP)
    // A brand-new store object, same directory — as after a container restart.
    expect(store().get(token).code).toBe(SNAP.code)
  })

  it('treats a corrupt store as empty rather than crashing the server', () => {
    fs.writeFileSync(path.join(dir, 'shares.json'), 'not json at all')
    const s = store()
    expect(s.list('u1')).toEqual([])
    expect(() => s.create('u1', SNAP)).not.toThrow()
  })
})
