import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cleanSource, cleanSources, createSourceStore, MAX_SOURCES } from './source-store.js'
import { loadSources, selectSources, TAG_VOCABULARY } from './sources.js'

describe('an inspiration source an administrator writes', () => {
  it('keeps a public web address and only the tags a request can produce', () => {
    const s = cleanSource({ url: 'https://www.example.com/gallery/', tags: ['saas', 'nonsense', 'LANDING'] })
    expect(s).toMatchObject({ url: 'https://www.example.com/gallery/', type: 'gallery', parser: 'generic', enabled: true })
    expect(s.tags).toEqual(['saas', 'landing'])
    expect(s.id).toBe('example-com-gallery')
    // A comma-separated string is what a text field sends.
    expect(cleanSource({ url: 'https://a.example', tags: 'blog, food' }).tags).toEqual(['blog', 'food'])
  })

  it('refuses what is not an http(s) page', () => {
    expect(cleanSource({ url: 'file:///etc/passwd' })).toBeNull()
    expect(cleanSource({ url: 'javascript:alert(1)' })).toBeNull()
    expect(cleanSource({ url: 'not a url' })).toBeNull()
    expect(cleanSource({ url: `https://a.example/${'x'.repeat(400)}` })).toBeNull()
    expect(cleanSource(null)).toBeNull()
  })

  it('drops duplicates, gives distinct ids and stops at the cap', () => {
    const list = cleanSources([
      { url: 'https://a.example/x' },
      { url: 'https://a.example/x' },
      { url: 'https://a.example/x/' },
      { url: 'ftp://nope.example' },
    ])
    expect(list.map((s) => s.url)).toEqual(['https://a.example/x', 'https://a.example/x/'])
    expect(new Set(list.map((s) => s.id)).size).toBe(2)
    const many = Array.from({ length: MAX_SOURCES + 5 }, (_, i) => ({ url: `https://s${i}.example/` }))
    expect(cleanSources(many)).toHaveLength(MAX_SOURCES)
  })

  it('is matched against the vocabulary the request classifier speaks', () => {
    expect(TAG_VOCABULARY).toContain('landing')
    expect(TAG_VOCABULARY).toContain('restaurant')
    expect(new Set(TAG_VOCABULARY).size).toBe(TAG_VOCABULARY.length)
  })
})

describe('the store', () => {
  let dir
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocky-sources-'))
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('serves the shipped list until an administrator saves one, and again after a reset', () => {
    const store = createSourceStore(dir)
    expect(store.view().custom).toBe(false)
    expect(store.view().sources.map((s) => s.url)).toEqual(loadSources().map((s) => s.url))

    store.save([
      { url: 'https://mine.example/', tags: ['restaurant'] },
      { url: 'https://off.example/', tags: ['restaurant'], enabled: false },
    ])
    expect(store.view().custom).toBe(true)
    expect(store.view().sources).toHaveLength(2)
    // Muse fetches from the enabled ones only.
    expect(store.active().map((s) => s.url)).toEqual(['https://mine.example/'])

    store.reset()
    expect(store.view().custom).toBe(false)
    expect(fs.existsSync(path.join(dir, 'muse-sources.json'))).toBe(false)
  })

  it('is what Muse chooses from, and an empty list chooses nothing', () => {
    const store = createSourceStore(dir)
    store.save([{ url: 'https://menus.example/', tags: ['restaurant'] }])
    expect(selectSources('a bakery website', { sources: store.active() }).map((s) => s.url)).toEqual(['https://menus.example/'])
    // No tag in common and no "landing" source: the first ones, not nothing.
    expect(selectSources('qqqq', { sources: store.active() })).toHaveLength(1)
    store.save([{ url: 'https://menus.example/', enabled: false }])
    expect(selectSources('a bakery website', { sources: store.active() })).toEqual([])
  })

  it('reads a damaged file as the shipped list rather than as nothing', () => {
    fs.writeFileSync(path.join(dir, 'muse-sources.json'), '{not json')
    expect(createSourceStore(dir).view().custom).toBe(false)
  })
})
