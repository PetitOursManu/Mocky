import { afterEach, describe, it, expect, vi } from 'vitest'
import { listModels, testConnection } from './provider'
import type { Settings } from './settings'

const SETTINGS: Settings = {
  provider: 'fireworks',
  baseUrl: 'https://api.fireworks.ai/inference/v1',
  apiKey: 'k',
  model: 'accounts/fireworks/models/gpt-oss-120b',
  usePlanner: true,
}

afterEach(() => vi.unstubAllGlobals())

describe('listModels', () => {
  // A vendor with no listing must leave the model field usable, and the panel
  // says so in words instead of "HTTP 404 from provider".
  it('flags a 404 as "no listing" rather than as a failure to fix', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })))
    const r = await listModels(SETTINGS)
    expect(r).toMatchObject({ ok: false, models: [], noListing: true })
  })

  it('does not call any other error "no listing"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
    const r = await listModels(SETTINGS)
    expect(r.ok).toBe(false)
    expect(r.noListing).toBeUndefined()
  })

  it('returns the sorted ids of a listing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ models: [{ name: 'b' }, { name: 'a' }] }), { status: 200 })),
    )
    expect(await listModels(SETTINGS)).toEqual({ ok: true, models: ['a', 'b'] })
  })
})

describe('testConnection', () => {
  it('flags a 404 on the listing so the banner can say it in words', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })))
    expect(await testConnection(SETTINGS)).toMatchObject({ ok: false, noListing: true })
  })

  it('leaves other failures as they were', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
    const r = await testConnection(SETTINGS)
    expect(r.ok).toBe(false)
    expect(r.noListing).toBeUndefined()
  })
})
