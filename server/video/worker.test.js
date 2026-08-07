import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { createVideoWorker, collectImages } from './worker.js'
import { assertSafeTargetResolved } from '../provider-proxy.js'

const TIMELINE = {
  scenes: [
    { imageId: 'a'.repeat(64), durationMs: 2000 },
    { imageId: 'b'.repeat(64), durationMs: 2000 },
    { imageId: 'a'.repeat(64), durationMs: 1000 },
  ],
}

const configOf = (over = {}) => ({ get: () => ({ workerUrl: 'http://worker.test:3030', licenseKey: null, ...over }) })
const allow = async () => {}
const videoResponse = (bytes = [0, 0, 0, 24, 102, 116, 121, 112]) => ({
  ok: true,
  status: 200,
  headers: { get: () => 'video/mp4' },
  arrayBuffer: async () => new Uint8Array(bytes).buffer,
})

describe('health', () => {
  it('reports a live worker and its version', async () => {
    const w = createVideoWorker({
      config: configOf(),
      guard: allow,
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ version: '4.0.0' }) }),
    })
    expect(await w.health()).toEqual({ available: true, version: '4.0.0' })
  })

  /**
   * The worker is absent on most instances by design — it lives behind an opt-in
   * compose profile. "Not configured" is therefore the normal state, and it has
   * to be distinguishable from "configured and broken" or the admin goes looking
   * for a network problem that does not exist.
   */
  it('says not-configured rather than trying to fetch nothing', async () => {
    let called = false
    const w = createVideoWorker({
      config: configOf({ workerUrl: null }),
      guard: allow,
      fetchImpl: async () => {
        called = true
        return videoResponse()
      },
    })
    const state = await w.health()
    expect(state.available).toBe(false)
    expect(state.reason).toBe('not-configured')
    expect(called).toBe(false)
  })

  it('never throws, whatever the network does', async () => {
    for (const fetchImpl of [
      async () => {
        throw new Error('ECONNREFUSED')
      },
      async () => ({ ok: false, status: 502 }),
      async () => ({ ok: true, status: 200, json: async () => { throw new Error('not json') } }),
    ]) {
      const state = await createVideoWorker({ config: configOf(), guard: allow, fetchImpl }).health()
      expect(state.available === true || state.available === false).toBe(true)
    }
  })

  it('reports the status code when the worker answers badly', async () => {
    const w = createVideoWorker({ config: configOf(), guard: allow, fetchImpl: async () => ({ ok: false, status: 502 }) })
    const state = await w.health()
    expect(state).toMatchObject({ available: false, reason: 'http-error' })
    expect(state.detail).toMatch(/502/)
  })

  it('treats an unparseable body as a live worker of unknown version', async () => {
    const w = createVideoWorker({
      config: configOf(),
      guard: allow,
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new Error('not json') } }),
    })
    expect(await w.health()).toEqual({ available: true, version: undefined })
  })
})

describe('the administrator-configured target', () => {
  /**
   * The third administrator-only bypass of the SSRF guard, exercised so that
   * reinstating the guard is a decision somebody takes rather than a line
   * somebody restores.
   *
   * The defect it closes cost the whole feature: with `assertSafeTargetResolved`
   * on this path there was no working configuration at all. The worker sits on
   * an `internal: true` compose bridge with no published port, so its only
   * address is a service name resolving into 172.16/12 — refused — and the
   * panel's fallback advice was to publish an unauthenticated 80 MB-body
   * endpoint on the open internet instead.
   *
   * It is enumerated in docs/architecture/invariants.md with the other two.
   */
  it.each([
    ['a compose service name', 'http://video-worker:3030'],
    ['loopback, for a worker run outside Docker', 'http://127.0.0.1:3030'],
    ['a LAN address', 'http://192.168.1.20:3030'],
    ['a bridge address', 'http://10.0.0.5:3030'],
  ])('reaches %s', async (_label, workerUrl) => {
    let called = null
    const w = createVideoWorker({
      config: configOf({ workerUrl }),
      fetchImpl: async (url) => {
        called = url
        return { ok: true, status: 200, json: async () => ({ version: '4.0.0' }) }
      },
    })
    expect(await w.health()).toEqual({ available: true, version: '4.0.0' })
    expect(called).toBe(`${workerUrl}/health`)
  })

  /**
   * The bypass is injectable, not baked in. An operator running the worker on a
   * public host passes the full guard back and loses nothing — and this pins
   * that escape hatch down, because a bypass with no way out is not a bypass.
   */
  it('honours the full SSRF guard when an operator passes it back in', async () => {
    let called = false
    const w = createVideoWorker({
      config: configOf({ workerUrl: 'http://192.168.1.20:3030' }),
      guard: assertSafeTargetResolved,
      fetchImpl: async () => {
        called = true
        return videoResponse()
      },
    })
    const health = await w.health()
    expect(health).toMatchObject({ available: false, reason: 'blocked-target' })
    // Never dialled: a refusal that still opens the socket refuses nothing.
    expect(called).toBe(false)
  })

  /**
   * The scheme is the one check that stays. `file:` and `gopher:` are not
   * misconfigurations an admin recovers from by retrying, and the message has to
   * name the field — this string is printed under the input it came from.
   */
  it('refuses a non-http scheme and says so instead of throwing', async () => {
    let called = false
    const w = createVideoWorker({
      config: configOf({ workerUrl: 'file:///etc/passwd' }),
      fetchImpl: async () => {
        called = true
        return videoResponse()
      },
    })
    const state = await w.health()
    expect(state).toMatchObject({ available: false, reason: 'blocked-target' })
    expect(state.detail).toMatch(/must be http or https/)
    expect(called).toBe(false)
  })

  it('refuses a URL that does not parse, naming what it read', async () => {
    const w = createVideoWorker({ config: configOf({ workerUrl: 'not a url' }), fetchImpl: async () => videoResponse() })
    const state = await w.health()
    expect(state).toMatchObject({ available: false, reason: 'blocked-target' })
    expect(state.detail).toMatch(/could not be parsed/)
  })

  it('refuses to render towards a refused target, with the reason on the error', async () => {
    const w = createVideoWorker({ config: configOf({ workerUrl: 'ftp://worker.test' }), fetchImpl: async () => videoResponse() })
    await expect(w.render(TIMELINE, [])).rejects.toThrow(/must be http or https/)
  })

  /**
   * The bypass is a default, not a removal. An operator running the worker on a
   * public host can hand the full guard back in, and nothing else has to change.
   */
  it('takes a stricter guard when one is supplied', async () => {
    const w = createVideoWorker({
      config: configOf({ workerUrl: 'http://192.168.1.20:3030' }),
      guard: async () => {
        throw new Error('Private/internal IP targets are not allowed')
      },
      fetchImpl: async () => videoResponse(),
    })
    expect((await w.health()).detail).toMatch(/Private\/internal/)
  })

  /**
   * A redirect the fetch followed would walk around the bypass rather than use
   * it: the admin's own worker answers 302 towards 169.254.169.254 and Mocky
   * fetches the cloud metadata endpoint on its behalf.
   */
  it('never follows a redirect, on either call', async () => {
    const seen = []
    const w = createVideoWorker({
      config: configOf(),
      fetchImpl: async (_url, init) => {
        seen.push(init.redirect)
        return { ok: true, status: 200, json: async () => ({}), headers: { get: () => 'video/mp4' }, arrayBuffer: async () => new Uint8Array([1]).buffer }
      },
    })
    await w.health()
    await w.render(TIMELINE, [])
    expect(seen).toEqual(['manual', 'manual'])
  })
})

describe('render', () => {
  it('posts the timeline and the images, and returns the bytes', async () => {
    let sent = null
    const w = createVideoWorker({
      config: configOf({ licenseKey: 'rmt-secret' }),
      guard: allow,
      fetchImpl: async (url, init) => {
        sent = { url, init, body: JSON.parse(init.body) }
        return videoResponse()
      },
    })
    const out = await w.render(TIMELINE, [{ id: 'a'.repeat(64), mime: 'image/jpeg', base64: 'AAA' }])

    expect(sent.url).toBe('http://worker.test:3030/render')
    expect(sent.init.method).toBe('POST')
    // A redirect that the fetch followed would walk straight around the guard —
    // the target passes, then answers 302 towards somewhere internal.
    expect(sent.init.redirect).toBe('manual')
    expect(sent.body.timeline).toEqual(TIMELINE)
    expect(sent.body.images).toHaveLength(1)
    // Sending the key is what opens the worker's outbound connection to
    // Remotion: from 5.0 telemetry is mandatory for a licensed render.
    expect(sent.body.licenseKey).toBe('rmt-secret')
    expect(out.bytes).toBe(8)
    expect(out.contentType).toBe('video/mp4')
  })

  it('sends no licence key when none is configured', async () => {
    let body = null
    const w = createVideoWorker({
      config: configOf(),
      guard: allow,
      fetchImpl: async (_url, init) => {
        body = JSON.parse(init.body)
        return videoResponse()
      },
    })
    await w.render(TIMELINE, [])
    expect('licenseKey' in body).toBe(false)
  })

  /**
   * Unlike health(), this one throws — it runs inside the queue, whose entire
   * job is to turn a rejection into a job marked `error` with the message on it.
   * Swallowing here would produce a job reported as done with nothing to show.
   */
  it('throws on a bad status, quoting what the worker said', async () => {
    const w = createVideoWorker({
      config: configOf(),
      guard: allow,
      fetchImpl: async () => ({ ok: false, status: 500, text: async () => 'composition not found' }),
    })
    await expect(w.render(TIMELINE, [])).rejects.toThrow(/500.*composition not found/)
  })

  /**
   * undici says "fetch failed" and nothing else, and that string lands on the
   * job as the entire explanation — which reads as a bug in Mocky rather than a
   * worker that was never started.
   */
  it('names the worker when the network fails, and keeps the URL out of it', async () => {
    const w = createVideoWorker({
      config: configOf(),
      guard: allow,
      fetchImpl: async () => {
        throw new Error('fetch failed')
      },
    })
    const err = await w.render(TIMELINE, []).catch((e) => e)
    expect(err.message).toMatch(/render worker could not be reached: fetch failed/)
    expect(err.message).not.toMatch(/worker\.test/)
  })

  /**
   * The queue's timeout aborts the signal and has already written a message
   * saying it gave up after 120 seconds. Rewriting that as a network failure
   * would describe something that did not happen.
   */
  it('lets an abort through unchanged', async () => {
    const w = createVideoWorker({
      config: configOf(),
      guard: allow,
      fetchImpl: async () => {
        const err = new Error('This operation was aborted')
        err.name = 'AbortError'
        throw err
      },
    })
    await expect(w.render(TIMELINE, [])).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('throws on an empty file rather than reporting a successful nothing', async () => {
    const w = createVideoWorker({ config: configOf(), guard: allow, fetchImpl: async () => videoResponse([]) })
    await expect(w.render(TIMELINE, [])).rejects.toThrow(/empty file/)
  })

  it('throws with a code when no worker is configured', async () => {
    const w = createVideoWorker({ config: configOf({ workerUrl: '' }), guard: allow, fetchImpl: async () => videoResponse() })
    await expect(w.render(TIMELINE, [])).rejects.toMatchObject({ code: 'not-configured' })
  })

  it('reads the URL at call time, so an admin fix applies without a restart', async () => {
    let url = 'http://first.test:3030'
    let seen = null
    const w = createVideoWorker({
      config: { get: () => ({ workerUrl: url }) },
      guard: allow,
      fetchImpl: async (u) => {
        seen = u
        return videoResponse()
      },
    })
    await w.render(TIMELINE, [])
    expect(seen).toBe('http://first.test:3030/render')
    url = 'http://second.test:3030/'
    await w.render(TIMELINE, [])
    // Trailing slash stripped, or the path becomes //render.
    expect(seen).toBe('http://second.test:3030/render')
  })
})

describe('collectImages', () => {
  let dir
  beforeEach(() => {
    dir = path.join(os.tmpdir(), `mocky-vidimg-${crypto.randomBytes(6).toString('hex')}`)
    fs.mkdirSync(dir, { recursive: true })
  })
  afterEach(() => {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  const libraryWith = (ids) => ({
    filePath: (id) => path.join(dir, `${id}.jpg`),
    fileExists: (id) => ids.includes(id),
    mimeFor: () => 'image/jpeg',
  })

  it('sends each image once, however many scenes use it', () => {
    for (const id of ['a'.repeat(64), 'b'.repeat(64)]) fs.writeFileSync(path.join(dir, `${id}.jpg`), Buffer.from([1, 2, 3]))
    const out = collectImages(libraryWith(['a'.repeat(64), 'b'.repeat(64)]), TIMELINE)
    expect(out.map((i) => i.id)).toEqual(['a'.repeat(64), 'b'.repeat(64)])
    expect(out[0]).toMatchObject({ mime: 'image/jpeg', base64: Buffer.from([1, 2, 3]).toString('base64') })
  })

  /**
   * The route checks existence when the job is queued, but the render happens
   * later. An image deleted in between must fail the job with a sentence naming
   * it, not produce a video with a blank frame nobody can explain.
   */
  it('names the image that disappeared between queueing and rendering', () => {
    fs.writeFileSync(path.join(dir, `${'a'.repeat(64)}.jpg`), Buffer.from([1]))
    expect(() => collectImages(libraryWith(['a'.repeat(64)]), TIMELINE)).toThrow(new RegExp('b'.repeat(64)))
  })
})
