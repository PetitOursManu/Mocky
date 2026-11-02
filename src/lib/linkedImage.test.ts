import { describe, it, expect, vi, afterEach } from 'vitest'
import { linkName, probeLinkedImage, withoutLink } from './linkedImage'

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
    if (got.kind === 'picture') {
      expect(got.name).toBe('carte-remerciement-flyer.jpg')
      expect(got.blob.size).toBe(3)
    }
  })

  it('is left to Muse when it is a page or cannot be read', async () => {
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
    expect(await probeLinkedImage(FLYER)).toEqual({ kind: 'refused', reason: 'project.siteLinkTooLarge' })
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

describe('the field once a picture has left it', () => {
  it('keeps the other links, one per line', () => {
    expect(withoutLink(`https://a.test\n${FLYER}  https://b.test\n`, FLYER)).toBe('https://a.test\nhttps://b.test')
    expect(withoutLink(FLYER, FLYER)).toBe('')
  })

  it('names the thumbnail after the file, decoded', () => {
    expect(linkName('https://img.example/dir/caf%C3%A9.png?x=1')).toBe('café.png')
    expect(linkName('https://img.example/')).toBe('')
  })
})
