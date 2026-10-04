import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPageFormat } from './pageFormats'
import type { StockFinder } from './stockImages'

vi.mock('./imageLibrary', () => ({ generateImage: vi.fn(), imageUrl: (hash: string) => `/api/images/${hash}` }))
import { generateImage } from './imageLibrary'
import {
  buildDocumentPictureSection,
  documentImageChoices,
  documentPicturePrompt,
  documentPictureSectionFor,
  documentPictureSource,
  documentPictureWant,
  findDocumentPicture,
  imageGenerationAvailable,
  loadDocumentImageChoice,
  saveDocumentImageChoice,
  shownDocumentImageChoice,
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

  it('searches for the subject of a request written as an instruction', () => {
    // The two real briefs ChatGPT wrote for "un post Instagram sur la semaine du
    // goût": searched as they stood, the first asked a library for "créer
    // directement mocky visuel" and got a war grave.
    const a = documentPictureWant(
      'Créer directement dans Mocky le visuel final d’un post Instagram sur la semaine du goût, avec une image appétissante',
      getPageFormat('a4'),
    )
    expect(a.query).toBe('semaine goût')
    const b = documentPictureWant('Créer un visuel Instagram carré pour annoncer la Semaine du Goût du 12 au 18 octobre', getPageFormat('a4'))
    // The month stays: the query ladder drops trailing words when it finds nothing.
    expect(b.query).toBe('semaine goût octobre')
    expect(documentPictureWant('Make an Instagram post about the autumn food festival', getPageFormat('a4')).query).toBe('autumn food festival')
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

describe('the document picture is opt-in', () => {
  const all = { generation: true, stock: true }

  it('offers "no picture" always, and only the doors this account can open', () => {
    expect(documentImageChoices(all)).toEqual(['none', 'ai', 'stock'])
    expect(documentImageChoices({ generation: false, stock: true })).toEqual(['none', 'stock'])
    expect(documentImageChoices({ generation: true, stock: false })).toEqual(['none', 'ai'])
    // Not known yet is closed: an option offered before the answer could only fail.
    expect(documentImageChoices({ generation: null, stock: false })).toEqual(['none'])
  })

  it('finds a picture only when a source was chosen', () => {
    expect(documentPictureSource('none', all)).toBeNull()
    expect(documentPictureSource('ai', all)).toBe('ai')
    expect(documentPictureSource('stock', all)).toBe('stock')
  })

  it('never turns a closed door into the other one — above all not into a paid generation', () => {
    expect(documentPictureSource('stock', { generation: true, stock: false })).toBeNull()
    expect(documentPictureSource('ai', { generation: false, stock: true })).toBeNull()
    expect(documentPictureSource('ai', { generation: null, stock: true })).toBeNull()
    expect(shownDocumentImageChoice('stock', { generation: true, stock: false })).toBe('none')
    expect(shownDocumentImageChoice('stock', all)).toBe('stock')
  })

  it('defaults to "no picture", remembers a choice, and survives storage that throws', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    })
    expect(loadDocumentImageChoice()).toBe('none')
    // The general images key is NOT read: its "AI" default is what billed every flyer.
    store.set('mocky.imageSource.v1', 'ai')
    expect(loadDocumentImageChoice()).toBe('none')
    saveDocumentImageChoice('stock')
    expect(loadDocumentImageChoice()).toBe('stock')
    store.set('mocky.docImageSource.v1', 'garbage')
    expect(loadDocumentImageChoice()).toBe('none')
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    })
    expect(loadDocumentImageChoice()).toBe('none')
    expect(() => saveDocumentImageChoice('ai')).not.toThrow()
  })

  it('reads generation as available only when a real provider is configured', async () => {
    const answer = (body: unknown, ok = true) => vi.fn().mockResolvedValue({ ok, json: async () => body })
    vi.stubGlobal('fetch', answer({ providers: [{ id: 'pollinations' }, { id: 'none' }] }))
    await expect(imageGenerationAvailable()).resolves.toBe(true)
    vi.stubGlobal('fetch', answer({ providers: [{ id: 'none' }] }))
    await expect(imageGenerationAvailable()).resolves.toBe(false)
    vi.stubGlobal('fetch', answer({}, false))
    await expect(imageGenerationAvailable()).resolves.toBe(false)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(imageGenerationAvailable()).resolves.toBe(false)
  })
})

describe('documentPictureSectionFor (Regenerate)', () => {
  it('hands back the picture the document already has, as the same section', () => {
    vi.stubGlobal('window', { location: { origin: 'http://mocky.test' } })
    const prompt = 'Flyer pour une soirée jazz'
    const s = documentPictureSectionFor({ prompt, page: 'a4', imageHash: 'abc123', imageRole: 'content' })
    const want = documentPictureWant(prompt, getPageFormat('a4'))
    expect(s).toBe(buildDocumentPictureSection({ ...want, url: 'http://mocky.test/api/images/abc123' }))
  })

  it('gives nothing without a placed picture, or off a document', () => {
    expect(documentPictureSectionFor({ prompt: 'x', page: 'a4' })).toBe('')
    expect(documentPictureSectionFor({ prompt: 'x', page: 'a4', imageHash: 'h', imageRole: 'inspiration' })).toBe('')
    expect(documentPictureSectionFor({ prompt: 'x', imageHash: 'h', imageRole: 'content' })).toBe('')
  })
})
