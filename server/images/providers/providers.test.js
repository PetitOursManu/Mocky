import { describe, it, expect, vi } from 'vitest'
import { createProviderRegistry } from './index.js'
import { createPollinations } from './pollinations.js'
import { createNone } from './none.js'

describe('createProviderRegistry', () => {
  it('picks the first healthy provider in priority order', async () => {
    const a = { id: 'a', healthy: vi.fn(async () => false) }
    const b = { id: 'b', healthy: vi.fn(async () => true) }
    const reg = createProviderRegistry([a, b, createNone()])
    expect((await reg.pick()).id).toBe('b')
  })

  it('caches the health probe (one probe per session)', async () => {
    const a = { id: 'a', healthy: vi.fn(async () => true) }
    const reg = createProviderRegistry([a, createNone()])
    await reg.pick()
    await reg.pick()
    expect(a.healthy).toHaveBeenCalledTimes(1)
  })

  it('falls back to the last provider when none are healthy', async () => {
    const a = { id: 'a', healthy: async () => false }
    const none = createNone()
    const reg = createProviderRegistry([a, none])
    expect((await reg.pick()).id).toBe('none')
  })

  it('treats a throwing healthy() as unhealthy', async () => {
    const a = { id: 'a', healthy: async () => { throw new Error('down') } }
    const b = { id: 'b', healthy: async () => true }
    const reg = createProviderRegistry([a, b])
    expect((await reg.pick()).id).toBe('b')
  })

  it('lists providers with their key requirement', () => {
    const reg = createProviderRegistry([createPollinations(), createNone()])
    expect(reg.list()).toEqual([
      { id: 'pollinations', requiresKey: false },
      { id: 'none', requiresKey: false },
    ])
  })
})

describe('createNone', () => {
  it('is always healthy and skips generation', async () => {
    const none = createNone()
    expect(await none.healthy()).toBe(true)
    expect(await none.generate()).toEqual({ skipped: true, provider: 'none' })
  })
})

describe('createPollinations', () => {
  it('builds a URL with dimensions, seed, model and nologo', () => {
    const p = createPollinations()
    const url = p.buildUrl({ prompt: 'a bakery in Lyon', width: 800, height: 600, seed: 42 })
    expect(url).toMatch(/^https:\/\/image\.pollinations\.ai\/prompt\/a%20bakery%20in%20Lyon\?/)
    expect(url).toContain('width=800')
    expect(url).toContain('height=600')
    expect(url).toContain('seed=42')
    expect(url).toContain('model=flux')
    expect(url).toContain('nologo=false')
  })

  it('sets nologo=true and appends the token when configured', () => {
    const p = createPollinations({ token: 'tok123' })
    const url = p.buildUrl({ prompt: 'x', width: 100, height: 100 })
    expect(url).toContain('nologo=true')
    expect(url).toContain('token=tok123')
  })

  it('generate() returns the image buffer + content-type', async () => {
    const fetchImpl = async () => ({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      headers: { get: () => 'image/png' },
    })
    const p = createPollinations({ fetchImpl })
    const out = await p.generate({ prompt: 'x', width: 10, height: 10 })
    expect(out.provider).toBe('pollinations')
    expect(out.contentType).toBe('image/png')
    expect(Buffer.compare(out.buffer, Buffer.from([1, 2, 3, 4]))).toBe(0)
  })

  it('generate() throws on a non-OK response', async () => {
    const p = createPollinations({ fetchImpl: async () => ({ ok: false, status: 502 }) })
    await expect(p.generate({ prompt: 'x', width: 1, height: 1 })).rejects.toThrow(/502/)
  })

  it('healthy() is false when the probe throws', async () => {
    const p = createPollinations({ fetchImpl: async () => { throw new Error('net') } })
    expect(await p.healthy()).toBe(false)
  })
})
