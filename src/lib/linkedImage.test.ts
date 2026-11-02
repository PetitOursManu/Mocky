import { describe, it, expect, vi, afterEach } from 'vitest'
import { probeLinkedImage, readLinkedReferences, type LinkedImageAnswer } from './linkedImage'

afterEach(() => vi.unstubAllGlobals())

function answer(status: number, body: BodyInit | null, type?: string) {
  const calls: Array<[string, RequestInit | undefined]> = []
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    calls.push([input, init])
    return new Response(body, { status, headers: type ? { 'content-type': type } : {} })
  })
  return calls
}

const FLYER = 'https://www.parfumdo.com/44258-large_default/carte-remerciement-flyer.jpg'

describe('a link given to Muse', () => {
  it('sends the address and nothing else, to the one route', async () => {
    const calls = answer(200, new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg')
    const got = await probeLinkedImage(FLYER)
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe('/api/muse/linked-image')
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({ url: FLYER })
    expect(got.kind).toBe('picture')
    if (got.kind === 'picture') expect(got.blob.size).toBe(3)
  })

  it('is left to the page fetcher when it is a page or cannot be read', async () => {
    answer(415, JSON.stringify({ code: 'not-image' }), 'application/json')
    expect(await probeLinkedImage('https://site.example/')).toEqual({ kind: 'page' })
    answer(502, JSON.stringify({ code: 'unreachable' }), 'application/json')
    expect(await probeLinkedImage('https://site.example/')).toEqual({ kind: 'page' })
    // A 200 that is not a picture is not trusted to be one.
    answer(200, '<html></html>', 'text/html')
    expect(await probeLinkedImage('https://site.example/')).toEqual({ kind: 'page' })
  })

  it('says so when it is a picture too large to use', async () => {
    answer(413, JSON.stringify({ code: 'too-large' }), 'application/json')
    expect(await probeLinkedImage(FLYER)).toEqual({ kind: 'refused', reason: 'project.museLinkTooLarge' })
  })

  it('degrades to a page when the network fails, and stops when aborted', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await probeLinkedImage(FLYER)).toEqual({ kind: 'page' })
    const ac = new AbortController()
    ac.abort()
    await expect(probeLinkedImage(FLYER, ac.signal)).rejects.toThrow()
  })
})

describe('the Inspiration field, sorted', () => {
  const blob = new Blob([new Uint8Array([1])], { type: 'image/jpeg' })
  const answers: Record<string, LinkedImageAnswer> = {
    [FLYER]: { kind: 'picture', blob },
    'https://img.example/second.png': { kind: 'picture', blob },
    'https://img.example/huge.jpg': { kind: 'refused', reason: 'project.museLinkTooLarge' },
  }
  const probe = async (url: string) => answers[url] ?? ({ kind: 'page' } as const)
  const toDataUrl = async () => 'data:image/jpeg;base64,AAAA'

  it('makes the first picture the reference and leaves the pages to the fetcher', async () => {
    const got = await readLinkedReferences(['https://site.example/', FLYER], { probe, toDataUrl })
    expect(got.picture).toEqual({ url: FLYER, dataUrl: 'data:image/jpeg;base64,AAAA' })
    expect(got.pages).toEqual(['https://site.example/'])
    expect(got.notices).toEqual([])
  })

  it('says when a second picture is not used, and when one cannot be', async () => {
    const got = await readLinkedReferences([FLYER, 'https://img.example/second.png', 'https://img.example/huge.jpg'], { probe, toDataUrl })
    expect(got.picture?.url).toBe(FLYER)
    expect(got.pages).toEqual([])
    expect(got.notices).toEqual(['project.museLinkOnlyFirst', 'project.museLinkTooLarge'])
  })

  it('reports a picture it cannot decode instead of dropping it in silence', async () => {
    const got = await readLinkedReferences([FLYER], {
      probe,
      toDataUrl: async () => {
        throw new Error('bad bytes')
      },
    })
    expect(got.picture).toBeNull()
    expect(got.notices).toEqual(['project.museLinkUnreadable'])
  })
})
