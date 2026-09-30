import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPageFormat } from './pageFormats'
import type { StockFinder } from './stockImages'

vi.mock('./imageLibrary', () => ({ generateImage: vi.fn() }))
import { generateImage } from './imageLibrary'
import {
  buildDocumentPictureSection,
  documentPicturePrompt,
  documentPictureWant,
  findDocumentPicture,
} from './documentPictures'

afterEach(() => {
  vi.mocked(generateImage).mockReset()
  vi.unstubAllGlobals()
})

describe('documentPictureWant', () => {
  it('searches for the subject, never for the piece', () => {
    const w = documentPictureWant('Un flyer pour une soirée jazz au Bistrot, le 12 octobre', getPageFormat('a4'))
    expect(w.subject).toBe('soirée jazz au Bistrot, le 12 octobre')
    expect(w.query).toBe('soirée jazz bistrot')
    const en = documentPictureWant('A poster for the spring farmers market', getPageFormat('a4'))
    expect(en.query).toBe('spring farmers market')
  })

  it('keeps the whole request when there is nothing but the piece to strip', () => {
    const w = documentPictureWant('Flyer', getPageFormat('a4'))
    expect(w.subject).toBe('Flyer')
    expect(w.query).toBeUndefined()
  })

  it('asks a portrait page for a square picture and a landscape page or a slide for a wide one', () => {
    expect(documentPictureWant('x y', getPageFormat('a4'))).toMatchObject({ shape: 'square', orientation: 'square' })
    expect(documentPictureWant('x y', getPageFormat('a4-landscape'))).toMatchObject({ shape: 'wide', orientation: 'landscape' })
    expect(documentPictureWant('x y', getPageFormat('slides'))).toMatchObject({ shape: 'wide', orientation: 'landscape' })
  })

  it('paints a photograph with no lettering in it', () => {
    const p = documentPicturePrompt(documentPictureWant('Flyer pour un concert de jazz.', getPageFormat('a4')))
    expect(p).toContain('concert de jazz')
    expect(p).toMatch(/no text, no letters/)
    expect(p).toMatch(/never a flyer/)
  })

  it('hands the page one exact URL, as the hero', () => {
    const s = buildDocumentPictureSection({ url: 'http://x/api/images/abc', subject: 'jazz night', shape: 'square' })
    expect(s).toContain('http://x/api/images/abc')
    expect(s).toMatch(/hero picture/)
    expect(s).toMatch(/exactly this URL/)
  })
})

describe('findDocumentPicture', () => {
  const want = documentPictureWant('Flyer pour une soirée jazz', getPageFormat('a4'))

  it('asks the stock finder with the derived search, and says why when it finds nothing', async () => {
    const find = vi.fn().mockResolvedValueOnce({ hash: 'h1', url: 'http://x/h1', stockId: 'p:1', credit: null }).mockResolvedValueOnce(null)
    const finder = { find, lastMiss: 'Aucune photo.', chosen: () => [] } as unknown as StockFinder
    await expect(findDocumentPicture(want, { source: 'stock', project: 'p', finder })).resolves.toEqual({ hash: 'h1', url: 'http://x/h1' })
    expect(find.mock.calls[0][0]).toMatchObject({ subject: want.subject, query: want.query, orientation: 'square' })
    const onError = vi.fn()
    await expect(findDocumentPicture(want, { source: 'stock', project: 'p', finder, onError })).resolves.toBeNull()
    expect(onError).toHaveBeenCalledWith('Aucune photo.')
    expect(generateImage).not.toHaveBeenCalled()
  })

  it('generates one otherwise, and degrades on a failure instead of throwing', async () => {
    // The preview frame has an opaque origin, so the URL is absolute (M6).
    vi.stubGlobal('window', { location: { origin: 'http://mocky.test' } })
    vi.mocked(generateImage).mockResolvedValueOnce({ hash: 'g1' })
    const got = await findDocumentPicture(want, { source: 'ai', project: 'p' })
    expect(got?.hash).toBe('g1')
    expect(got?.url).toBe('http://mocky.test/api/images/g1')
    expect(vi.mocked(generateImage).mock.calls[0][1]).toMatchObject({ project: 'p', width: 1024, height: 1024 })

    vi.mocked(generateImage).mockRejectedValueOnce(new Error('provider down'))
    const onError = vi.fn()
    await expect(findDocumentPicture(want, { source: 'ai', project: 'p', onError })).resolves.toBeNull()
    expect(onError).toHaveBeenCalledWith('provider down')
  })

  it('lets a cancel through', async () => {
    const ac = new AbortController()
    ac.abort()
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    vi.mocked(generateImage).mockRejectedValueOnce(abort)
    await expect(findDocumentPicture(want, { source: 'ai', project: 'p', signal: ac.signal })).rejects.toBe(abort)
  })
})
