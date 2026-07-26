import { describe, it, expect, vi, afterEach } from 'vitest'
import { listLibrary, toggleFavoriteImage, deleteImage, imageUrl, imageDownloadUrl, libraryZipUrl } from './imageLibrary'

afterEach(() => vi.unstubAllGlobals())

describe('URL builders', () => {
  it('build image + download + zip URLs with filters', () => {
    expect(imageUrl('abc')).toBe('/api/images/abc')
    expect(imageDownloadUrl('abc')).toBe('/api/images/abc?download=1')
    expect(libraryZipUrl({})).toBe('/api/images/library.zip')
    expect(libraryZipUrl({ q: 'hero', favorites: true, project: 'p1', slot: 'hero' })).toBe(
      '/api/images/library.zip?q=hero&project=p1&favorites=1&slot=hero',
    )
  })
})

describe('listLibrary', () => {
  it('passes filters as query params and returns images', async () => {
    let seenUrl = ''
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      seenUrl = url
      return { ok: true, json: async () => ({ images: [{ hash: 'a', prompt: 'p' }] }) }
    }))
    const imgs = await listLibrary({ q: 'bakery', favorites: true })
    expect(seenUrl).toBe('/api/images/library?q=bakery&favorites=1')
    expect(imgs).toHaveLength(1)
  })

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))
    await expect(listLibrary()).rejects.toThrow(/HTTP 500/)
  })
})

describe('mutations', () => {
  it('toggleFavoriteImage returns the new flag', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ favorite: true }) })))
    expect(await toggleFavoriteImage('abc')).toBe(true)
  })
  it('deleteImage returns removal + usage info', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ removed: true, wasUsedBy: ['p1'] }) })))
    expect(await deleteImage('abc')).toEqual({ removed: true, wasUsedBy: ['p1'] })
  })
})
