import { describe, it, expect } from 'vitest'
import { EventEmitter } from 'node:events'
import { classifyRequest, createActivity, createTracker, outcomeOf, cleanProvider } from './activity.js'

function clock(start = 10 * 60_000) {
  let t = start
  return { now: () => t, advance: (ms) => (t += ms) }
}

describe('classifyRequest', () => {
  const req = (method, originalUrl, headers = {}) => ({ method, originalUrl, headers })

  it('tells a page generation from Muse, images, clips and films', () => {
    expect(classifyRequest(req('POST', '/__provider/api/chat'))).toEqual({ kind: 'mocky', action: 'generate' })
    expect(classifyRequest(req('POST', '/api/muse/dossier'))).toEqual({ kind: 'muse', action: 'dossier' })
    expect(classifyRequest(req('POST', '/api/images/generate?x=1'))).toEqual({ kind: 'image', action: 'generate' })
    expect(classifyRequest(req('POST', '/api/videos/generate'))).toEqual({ kind: 'clip', action: 'generate' })
    expect(classifyRequest(req('POST', '/api/video/compose'))).toEqual({ kind: 'film', action: 'compose' })
  })

  it('reads the purpose the client declared, from a closed list', () => {
    expect(classifyRequest(req('POST', '/__provider/api/chat', { 'x-mocky-purpose': 'polish' })).action).toBe('polish')
    // Anything else is a generation: the header comes from a browser, and the
    // administrator's screen must not display words a caller chose.
    expect(classifyRequest(req('POST', '/__provider/api/chat', { 'x-mocky-purpose': 'hello admin' })).action).toBe(
      'generate',
    )
  })

  it('ignores reads, listings and everything that is not work', () => {
    expect(classifyRequest(req('GET', '/__provider/api/tags'))).toBeNull()
    expect(classifyRequest(req('POST', '/__provider/api/tags'))).toBeNull()
    expect(classifyRequest(req('GET', '/api/muse/dossier'))).toBeNull()
    expect(classifyRequest(req('PUT', '/api/data'))).toBeNull()
    expect(classifyRequest(req('POST', '/api/images/upload'))).toBeNull()
  })
})

describe('outcomeOf', () => {
  it('names an ending without keeping its message', () => {
    expect(outcomeOf(200, false)).toBe('ok')
    expect(outcomeOf(200, true)).toBe('aborted')
    expect(outcomeOf(429)).toBe('rate-limited')
    expect(outcomeOf(401)).toBe('refused')
    expect(outcomeOf(504)).toBe('timeout')
    expect(outcomeOf(400)).toBe('invalid')
    expect(outcomeOf(502)).toBe('failed')
    expect(outcomeOf(0)).toBe('failed')
  })

  it('keeps a provider label to a boring token', () => {
    expect(cleanProvider('openrouter')).toBe('openrouter')
    expect(cleanProvider('<b>evil</b> host')).toBe('bevilbhost')
    expect(cleanProvider('')).toBe('unknown')
  })
})

describe('createActivity', () => {
  it('moves a request from in flight to the feed, with its duration', () => {
    const c = clock()
    const a = createActivity({ now: c.now })
    const id = a.begin({ userId: 'u1', kind: 'mocky', action: 'edit', provider: 'openrouter' })
    expect(a.inflight()).toHaveLength(1)
    c.advance(1500)
    const ev = a.end(id, { status: 200, aborted: false, ttfb: 300 })
    expect(ev).toMatchObject({ userId: 'u1', kind: 'mocky', action: 'edit', ms: 1500, ttfb: 300, outcome: 'ok' })
    expect(a.inflight()).toHaveLength(0)
    expect(a.recent().map((e) => e.seq)).toEqual([ev.seq])
    expect(a.recent({ since: ev.seq })).toEqual([])
  })

  it('forgets what is older than the window', () => {
    const c = clock()
    const a = createActivity({ now: c.now, windowMs: 60_000 })
    a.end(a.begin({ userId: 'u1', kind: 'muse', action: 'dossier' }), { status: 200 })
    c.advance(61_000)
    expect(a.recent()).toEqual([])
  })

  it('ends a request lost for half an hour as a timeout', () => {
    const c = clock()
    const a = createActivity({ now: c.now })
    a.begin({ userId: 'u1', kind: 'mocky', action: 'generate' })
    c.advance(31 * 60_000)
    expect(a.inflight()).toEqual([])
    expect(a.recent()[0].outcome).toBe('timeout')
  })

  // A user pressing Stop is not an outage; a refusal answered in 40 ms is not
  // a fast provider.
  it('health counts errors without cancellations and times successes only', () => {
    const c = clock()
    const a = createActivity({ now: c.now })
    const run = (ms, status, aborted = false) => {
      const id = a.begin({ userId: 'u1', kind: 'image', action: 'generate', provider: 'fal' })
      c.advance(ms)
      a.end(id, { status, aborted })
    }
    run(1000, 200)
    run(3000, 200)
    run(40, 502)
    run(500, 200, true)
    // A malformed request is counted apart: it says nothing about the provider.
    run(2, 400)
    const [row] = a.health()
    expect(row).toMatchObject({ kind: 'image', provider: 'fal', count: 5, ok: 2, errors: 1, aborted: 1, invalid: 1 })
    expect(row.errorRate).toBeCloseTo(1 / 3)
    expect(row.p50).toBe(1000)
    expect(row.p95).toBe(3000)
    expect(row.lastError).toMatchObject({ outcome: 'failed', status: 502 })
  })

  it('buckets requests per minute, current minute last', () => {
    const c = clock()
    const a = createActivity({ now: c.now })
    a.end(a.begin({ userId: 'u1', kind: 'muse', action: 'dossier' }), { status: 200 })
    c.advance(60_000)
    a.begin({ userId: 'u1', kind: 'mocky', action: 'generate' })
    const b = a.perMinute(5)
    expect(b).toHaveLength(5)
    expect(b[3].muse).toBe(1)
    expect(b[4].mocky).toBe(1)
  })
})

describe('createTracker', () => {
  function fakeRes() {
    const res = new EventEmitter()
    res.statusCode = 200
    res.writableFinished = false
    res.writeHead = function () {
      return this
    }
    return res
  }

  it('times a tracked request and leaves the rest alone', () => {
    const c = clock()
    const activity = createActivity({ now: c.now })
    const track = createTracker({
      activity,
      userOf: () => ({ id: 'u1' }),
      providerOf: () => ({ provider: 'openrouter' }),
    })
    const res = fakeRes()
    let passed = 0
    track({ method: 'POST', originalUrl: '/__provider/api/chat', headers: {} }, res, () => passed++)
    expect(activity.inflight()).toHaveLength(1)
    c.advance(200)
    res.writeHead(200)
    c.advance(800)
    res.writableFinished = true
    res.emit('close')
    expect(activity.recent()[0]).toMatchObject({ ms: 1000, ttfb: 200, outcome: 'ok', provider: 'openrouter' })

    track({ method: 'GET', originalUrl: '/api/data', headers: {} }, fakeRes(), () => passed++)
    expect(passed).toBe(2)
    expect(activity.recent()).toHaveLength(1)
  })

  it('does not track an anonymous request, and never refuses it', () => {
    const activity = createActivity()
    const track = createTracker({ activity, userOf: () => null })
    let passed = false
    track({ method: 'POST', originalUrl: '/api/muse/dossier', headers: {} }, fakeRes(), () => (passed = true))
    expect(passed).toBe(true)
    expect(activity.inflight()).toEqual([])
  })

  it('counts a client that left before the end as aborted', () => {
    const activity = createActivity()
    const track = createTracker({ activity, userOf: () => ({ id: 'u1' }) })
    const res = fakeRes()
    track({ method: 'POST', originalUrl: '/api/muse/dossier', headers: {} }, res, () => {})
    res.emit('close')
    expect(activity.recent()[0].outcome).toBe('aborted')
  })
})
