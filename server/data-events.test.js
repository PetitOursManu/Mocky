import { describe, it, expect } from 'vitest'
import { EventEmitter } from 'node:events'
import { createDataEvents, MAX_STREAMS_PER_USER } from './data-events.js'

/** A response that records what was written to it. */
function fakeRes() {
  const res = new EventEmitter()
  res.chunks = []
  res.ended = false
  res.writeHead = (status, headers) => {
    res.status = status
    res.headers = headers
  }
  res.write = (s) => res.chunks.push(s)
  res.end = () => {
    res.ended = true
    res.emit('close')
  }
  res.events = () => res.chunks.filter((c) => c.startsWith('event:'))
  return res
}

/** Timers driven by hand. */
function manualTimers() {
  const fns = new Set()
  return {
    setInterval: (fn) => (fns.add(fn), fn),
    clearInterval: (fn) => fns.delete(fn),
    tick: () => [...fns].forEach((fn) => fn()),
    size: () => fns.size,
  }
}

const TAB_A = 'tab-aaaaaaaa'
const TAB_B = 'tab-bbbbbbbb'

describe('data events', () => {
  it('opens a real event stream that a proxy will not buffer', () => {
    const ev = createDataEvents(manualTimers())
    const res = fakeRes()
    ev.subscribe('u1', TAB_A, res)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/^text\/event-stream/)
    expect(res.headers['x-accel-buffering']).toBe('no')
  })

  it("tells the account's other tabs, not the one that wrote", () => {
    const ev = createDataEvents(manualTimers())
    const a = fakeRes()
    const b = fakeRes()
    ev.subscribe('u1', TAB_A, a)
    ev.subscribe('u1', TAB_B, b)
    expect(ev.notify('u1', TAB_A)).toBe(1)
    expect(a.events()).toEqual([])
    expect(b.events()).toEqual(['event: data-changed\ndata: {}\n\n'])
  })

  it('reaches every tab when the writer is not a tab (the MCP runner)', () => {
    const ev = createDataEvents(manualTimers())
    const a = fakeRes()
    const b = fakeRes()
    ev.subscribe('u1', TAB_A, a)
    ev.subscribe('u1', TAB_B, b)
    expect(ev.notify('u1', undefined)).toBe(2)
  })

  it('never tells another account', () => {
    const ev = createDataEvents(manualTimers())
    const other = fakeRes()
    ev.subscribe('u2', TAB_A, other)
    expect(ev.notify('u1')).toBe(0)
    expect(other.events()).toEqual([])
  })

  it('carries a name and never any content', () => {
    const ev = createDataEvents(manualTimers())
    const b = fakeRes()
    ev.subscribe('u1', TAB_B, b)
    ev.notify('u1')
    expect(b.events().join('')).not.toMatch(/project|screen|code/i)
  })

  it('does not trust a tab id it cannot read back', () => {
    const ev = createDataEvents(manualTimers())
    const odd = fakeRes()
    ev.subscribe('u1', 'x\n\nevent: evil', odd)
    // Stored as "no tab", so a writer naming that string does not skip it.
    expect(ev.notify('u1', 'x\n\nevent: evil')).toBe(1)
  })

  it('forgets a stream when its tab goes away', () => {
    const timers = manualTimers()
    const ev = createDataEvents(timers)
    const a = fakeRes()
    ev.subscribe('u1', TAB_A, a)
    a.emit('close')
    expect(ev.count('u1')).toBe(0)
    expect(timers.size()).toBe(0)
  })

  it('stops a stream whose session was revoked, at the next keepalive', () => {
    const timers = manualTimers()
    const ev = createDataEvents(timers)
    const a = fakeRes()
    let valid = true
    ev.subscribe('u1', TAB_A, a, { stillValid: () => valid })
    timers.tick()
    expect(a.ended).toBe(false)
    expect(a.chunks.at(-1)).toBe(': keepalive\n\n')
    valid = false
    timers.tick()
    expect(a.ended).toBe(true)
    expect(ev.count('u1')).toBe(0)
  })

  it('holds a bounded number of streams per account, closing the oldest', () => {
    const ev = createDataEvents(manualTimers())
    const all = Array.from({ length: MAX_STREAMS_PER_USER + 2 }, () => fakeRes())
    all.forEach((r, i) => ev.subscribe('u1', `tab-${String(i).padStart(8, '0')}`, r))
    expect(ev.count('u1')).toBe(MAX_STREAMS_PER_USER)
    expect(all[0].ended).toBe(true)
    expect(all[1].ended).toBe(true)
    expect(all.at(-1).ended).toBe(false)
  })
})
