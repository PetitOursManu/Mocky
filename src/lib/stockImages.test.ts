import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  cleanQuery,
  createStockFinder,
  judgeBrief,
  orientationOf,
  photoReferenceNote,
  pickStockSlotImages,
  stockQuery,
  stockUsable,
} from './stockImages'
import { generateUltraImages } from './ultra/images'
import { buildStoryboardSystem, validateStoryboard, type UltraStoryboard } from './ultra/storyboard'
import type { Settings } from './settings'

const SETTINGS = { baseUrl: 'http://x', apiKey: '', model: 'vision-model', usePlanner: false } as unknown as Settings

describe('stockQuery — the fallback search, for a plan with no query of its own', () => {
  it('keeps the subject and drops what describes the photograph', () => {
    expect(stockQuery('A cinematic photograph of a lone lighthouse on a rocky cliff at dusk, soft light, 8k')).toBe(
      'lone lighthouse rocky cliff dusk',
    )
  })

  it('reads past a first clause made only of style words', () => {
    expect(stockQuery('Cinematic, soft light, a red bicycle against a white wall')).toBe('red bicycle against white wall')
  })

  it('tidies a query the model wrote without rewriting it', () => {
    expect(cleanQuery('  Astronaut  Spacewalk!! ')).toBe('astronaut spacewalk')
    expect(cleanQuery(undefined)).toBe('')
  })
})

describe('orientationOf', () => {
  it('reads ratios and words', () => {
    expect(orientationOf('16:9')).toBe('landscape')
    expect(orientationOf('4/5')).toBe('portrait')
    expect(orientationOf('1:1')).toBe('square')
    expect(orientationOf(undefined)).toBeUndefined()
  })
})

describe('stockUsable', () => {
  it('needs the access AND at least one library', () => {
    expect(stockUsable({ allowed: true, providers: { pexels: true, pixabay: false } })).toBe(true)
    expect(stockUsable({ allowed: false, providers: { pexels: true, pixabay: true } })).toBe(false)
    expect(stockUsable(null)).toBe(false)
  })
})

describe('the judge brief', () => {
  it('says which images are candidates and which are already on the page', () => {
    const b = judgeBrief({ subject: 'a planet with rings', role: 'subject', brief: 'site ORBIT' }, 8, 2)
    expect(b).toContain('Candidates: images 1 to 8.')
    expect(b).toContain('images 9 to 10')
    expect(b).toContain('ONE object')
  })
})

/**
 * A fake server: candidates, the judge, the import and the blind pick. The
 * judge answers whatever `verdict` says, given how many images it was shown.
 */
function fakeServer(verdict: string | ((images: number) => string)) {
  const calls: { url: string; body: Record<string, unknown> }[] = []
  let imported = 0
  vi.stubGlobal('window', { location: { origin: 'http://mocky.test' } })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body || '{}'))
      calls.push({ url: String(url), body })
      const reply = (j: unknown) => new Response(JSON.stringify(j), { status: 200 })
      if (url === '/api/images/stock/candidates') {
        const base = (body.exclude as string[]).length * 10
        return reply({
          query: body.query,
          candidates: [1, 2, 3].map((i) => ({ provider: 'pexels', id: String(base + i), thumb: `data:image/jpeg;base64,T${base + i}` })),
        })
      }
      if (url === '/__provider/api/chat') {
        const images = body.messages[1].images as string[]
        return reply({ message: { content: typeof verdict === 'function' ? verdict(images.length) : verdict } })
      }
      if (url === '/api/images/stock/import') {
        imported++
        return reply({ hash: `h${imported}`, url: `/api/images/h${imported}`, meta: {} })
      }
      if (url === '/api/images/stock/pick') {
        return reply({ found: true, hash: 'blind', url: '/api/images/blind', stockId: 'pixabay:5' })
      }
      throw new Error(`unexpected ${url}`)
    }),
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

const chats = (calls: ReturnType<typeof fakeServer>) => calls.filter((c) => c.url === '/__provider/api/chat')
const imagesSeen = (call: { body: Record<string, unknown> }) =>
  (call.body.messages as Array<{ images?: string[] }>)[1].images ?? []

describe('the finder, with eyes', () => {
  it('imports the candidate the judge chose, and shows the next judge what was chosen', async () => {
    const calls = fakeServer((n) => (n === 3 ? '{"pick": 2, "reason": "clearest"}' : '```json\n{"pick": 1}\n```'))
    const finder = createStockFinder({ project: 'p', settings: SETTINGS, vision: true, brief: 'ORBIT' })
    const first = await finder.find({ subject: 'an astronaut', query: 'Astronaut spacewalk', role: 'scene', tags: ['ultra', 'scene'] })
    expect(first?.stockId).toBe('pexels:2')
    const second = await finder.find({ subject: 'a planet', query: 'planet rings', role: 'subject' })
    expect(second?.stockId).toBe('pexels:11')

    const candidates = calls.filter((c) => c.url.endsWith('/candidates'))
    expect(candidates[0].body.query).toBe('astronaut spacewalk')
    expect(candidates[1].body.exclude).toEqual(['pexels:2'])
    // The second judge sees its three candidates AND the photo already chosen.
    expect(imagesSeen(chats(calls)[1])).toEqual(['T11', 'T12', 'T13', 'T2'])
    const imports = calls.filter((c) => c.url.endsWith('/import'))
    expect(imports[0].body).toMatchObject({ provider: 'pexels', id: '2', tags: ['ultra', 'scene'] })
  })

  it('leaves the slot empty when the judge rejects them all, and says why', async () => {
    const calls = fakeServer('{"pick": 0, "reason": "none shows a planet"}')
    const finder = createStockFinder({ project: 'p', settings: SETTINGS, vision: true })
    expect(await finder.find({ subject: 'a planet', query: 'planet' })).toBeNull()
    expect(finder.lastMiss).toContain('none shows a planet')
    expect(calls.some((c) => c.url.endsWith('/import'))).toBe(false)
  })

  it('falls back on the first result when the judge cannot answer', async () => {
    fakeServer('I think the second one is nice')
    const finder = createStockFinder({ project: 'p', settings: SETTINGS, vision: true })
    expect((await finder.find({ subject: 'a planet', query: 'planet' }))?.stockId).toBe('pexels:1')
  })
})

describe('the finder, blind', () => {
  it('asks the server for its first result with the model-written query, and calls no model', async () => {
    const calls = fakeServer('{}')
    const finder = createStockFinder({ project: 'p', vision: false, ultra: 3 })
    const got = await finder.find({ subject: 'a lone lighthouse at dusk', query: 'lighthouse cliff', orientation: 'landscape' })
    expect(got?.stockId).toBe('pixabay:5')
    expect(calls[0].body).toMatchObject({ query: 'lighthouse cliff', orientation: 'landscape', ultra: 3 })
    expect(chats(calls)).toHaveLength(0)
  })
})

describe('where the queries come from', () => {
  it("Muse slots search with the dossier's searchQuery", async () => {
    const calls = fakeServer('{"pick": 1}')
    const finder = createStockFinder({ project: 'p', settings: SETTINGS, vision: true })
    const imgs = await pickStockSlotImages(
      [{ id: 'hero', slot: 'hero', subject: 'Un astronaute flottant', searchQuery: 'astronaut floating space', aspectRatio: '16:9' }],
      finder,
      { max: 3 },
    )
    expect(imgs).toHaveLength(1)
    expect(calls[0].body).toMatchObject({ query: 'astronaut floating space', orientation: 'landscape' })
  })

  it("a Motion Ultra series searches with each picture's query, in storyboard order", async () => {
    const calls = fakeServer('{"pick": 1}')
    const finder = createStockFinder({ project: 'p', settings: SETTINGS, vision: true, ultra: 3 })
    const board = {
      style: 'warm film grain',
      images: [
        { section: 'hero', role: 'backdrop', subject: 'une crête de montagne', query: 'misty mountain ridge' },
        { section: 'product', role: 'subject', subject: 'une bouteille en verre' },
      ],
    } as unknown as UltraStoryboard
    const made = await generateUltraImages(board, 'p', { series: 3, source: 'stock', finder })
    expect(made.map((m) => m.hash)).toEqual(['h1', 'h2'])
    const searched = calls.filter((c) => c.url.endsWith('/candidates')).map((c) => c.body)
    expect(searched[0]).toMatchObject({ query: 'misty mountain ridge', orientation: 'landscape' })
    // No query written: the subject is cut into one.
    expect(searched[1]).toMatchObject({ query: 'bouteille verre', orientation: 'square' })
    expect(calls.filter((c) => c.url.endsWith('/import')).every((c) => c.body.ultra === 3)).toBe(true)
  })

  it('the storyboard asks for a query only when the pictures will be found', () => {
    expect(buildStoryboardSystem(3, 'persuade')).not.toContain('`query`')
    expect(buildStoryboardSystem(3, 'persuade', undefined, true)).toContain('`query`')
    const board = validateStoryboard(
      {
        mode: 'persuade',
        style: 's',
        sections: [{ id: 'hero', recipe: 'aurora-hero', content: 'c' }],
        images: [{ section: 'hero', role: 'backdrop', subject: 'mountains', query: 'misty mountain ridge' }],
      },
      3,
    )
    expect(board?.images[0].query).toBe('misty mountain ridge')
  })
})

describe("the found photos, shown to the page's author", () => {
  it('the finder hands back the thumbnails it chose, in the order they were found', async () => {
    fakeServer('{"pick": 1}')
    const finder = createStockFinder({ project: 'p', settings: SETTINGS, vision: true })
    await finder.find({ subject: 'a', query: 'a' })
    await finder.find({ subject: 'b', query: 'b' })
    expect(finder.chosen()).toEqual(['data:image/jpeg;base64,T1', 'data:image/jpeg;base64,T11'])
  })

  it('a blind finder has nothing to show, because nothing was looked at', async () => {
    fakeServer('{}')
    const finder = createStockFinder({ project: 'p', vision: false })
    await finder.find({ subject: 'a', query: 'a' })
    expect(finder.chosen()).toEqual([])
  })

  it('the note counts from the END of the attachments, and says nothing for none', () => {
    expect(photoReferenceNote(0)).toBe('')
    expect(photoReferenceNote(1)).toContain('The LAST attached image is')
    expect(photoReferenceNote(3)).toContain('The LAST 3 attached images are')
    expect(photoReferenceNote(3)).toContain('Design the page AROUND them')
  })
})
