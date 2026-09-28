import { describe, it, expect } from 'vitest'
import { createPresence, ONLINE_MS, ACTIVE_REQUEST_MS } from './presence.js'

function clock(start = 1_000_000) {
  let t = start
  return { now: () => t, advance: (ms) => (t += ms) }
}

const TAB = 'tab-aaaaaaaa'
const TAB2 = 'tab-bbbbbbbb'

describe('presence', () => {
  it('a visible tab is active, a hidden one idle, silence offline', () => {
    const c = clock()
    const p = createPresence({ now: c.now })
    p.beat('u1', { tab: TAB, area: 'project', visible: true })
    expect(p.snapshot()[0]).toMatchObject({ userId: 'u1', state: 'active', area: 'project', tabs: 1 })

    p.beat('u1', { tab: TAB, area: 'project', visible: false })
    // A beat is also not a request: nothing but the hidden tab speaks for them.
    expect(p.snapshot()[0].state).toBe('idle')

    c.advance(ONLINE_MS + 1)
    expect(p.snapshot()[0]).toMatchObject({ state: 'offline', tabs: 0 })
  })

  // A person reading their canvas sends no request for minutes, and one who
  // just generated something may have no tab reporting yet (an old client).
  it('a recent request counts as activity on its own', () => {
    const c = clock()
    const p = createPresence({ now: c.now })
    p.touch('u1')
    expect(p.snapshot()[0].state).toBe('active')
    c.advance(ACTIVE_REQUEST_MS + 1)
    expect(p.snapshot()[0].state).toBe('idle')
  })

  it('reports where the visible tab is, not the most recent hidden one', () => {
    const c = clock()
    const p = createPresence({ now: c.now })
    p.beat('u1', { tab: TAB, area: 'admin', visible: true })
    c.advance(1000)
    p.beat('u1', { tab: TAB2, area: 'media', visible: false })
    expect(p.snapshot()[0]).toMatchObject({ area: 'admin', tabs: 2 })
  })

  it('closing the last tab is offline at once, and a later request undoes it', () => {
    const c = clock()
    const p = createPresence({ now: c.now })
    p.touch('u1')
    p.beat('u1', { tab: TAB, visible: true })
    p.beat('u1', { tab: TAB2, visible: true })
    p.leave('u1', TAB)
    expect(p.snapshot()[0]).toMatchObject({ tabs: 1, state: 'active' })
    p.leave('u1', TAB2)
    expect(p.snapshot()[0]).toMatchObject({ tabs: 0, state: 'offline' })
    c.advance(10)
    p.touch('u1')
    expect(p.snapshot()[0].state).toBe('active')
  })

  // Sign-in reloads the page: the old page's goodbye can overtake its own
  // first beat, and the tab it names must not come back.
  it('ignores a late beat from a tab that already said goodbye', () => {
    const c = clock()
    const p = createPresence({ now: c.now })
    p.leave('u1', TAB)
    p.beat('u1', { tab: TAB, visible: true })
    p.beat('u1', { tab: TAB2, visible: true })
    expect(p.snapshot()[0].tabs).toBe(1)
  })

  it('refuses a malformed beat and an unknown area', () => {
    const p = createPresence()
    expect(p.beat('u1', { tab: 'x' })).toBe(false)
    expect(p.beat('u1', { tab: '<script>alert(1)</script>' })).toBe(false)
    expect(p.beat('u1', { tab: TAB, area: '../etc' })).toBe(true)
    expect(p.snapshot()[0].area).toBeNull()
  })

  it('keeps at most twenty tabs per account, dropping the stalest', () => {
    const c = clock()
    const p = createPresence({ now: c.now })
    for (let i = 0; i < 25; i++) {
      p.beat('u1', { tab: `tab-${String(i).padStart(8, '0')}`, visible: false })
      c.advance(10)
    }
    expect(p.snapshot()[0].tabs).toBe(20)
  })

  it('forgets an account', () => {
    const p = createPresence()
    p.touch('u1')
    p.forget('u1')
    expect(p.snapshot()).toEqual([])
  })
})
