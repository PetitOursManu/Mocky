import { describe, it, expect } from 'vitest'
import { createMcpPictures, MAX_PICTURE_BYTES } from './images.js'

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)])
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

/** A fetch that serves a map of URL → { status, headers, body }. */
function fakeFetch(routes) {
  const seen = []
  const impl = async (url) => {
    seen.push(url)
    const r = routes[url]
    if (!r) return new Response('nope', { status: 404 })
    return new Response(r.body ?? null, { status: r.status ?? 200, headers: r.headers ?? {} })
  }
  return { impl, seen }
}

function make({ routes = {}, guard = async (u) => (/127\.0\.0\.1|169\.254|localhost/.test(u) ? Promise.reject(new Error('blocked')) : undefined), budgetFull = false } = {}) {
  const stored = []
  const library = {
    ingestUpload: (buffer, spec) => (stored.push({ buffer, spec }), { hash: 'a'.repeat(64), fromCache: false }),
    ingestStock: () => ({ hash: 'b'.repeat(64), fromCache: false }),
    get: (h) => (h === 'c'.repeat(64) ? {} : null),
    ownedBy: (h, id) => h === 'c'.repeat(64) && id === 'u1',
  }
  const { impl, seen } = fakeFetch(routes)
  const pictures = createMcpPictures({
    library,
    stock: null,
    budget: { wouldExceed: () => budgetFull, add: () => {} },
    stockAccessFor: () => true,
    guard,
    fetchImpl: impl,
  })
  return { pictures, stored, seen }
}

const user = { id: 'u1' }

describe('a picture an assistant brings by address', () => {
  it('is downloaded, sniffed and stored as the person\'s upload', async () => {
    const { pictures, stored } = make({ routes: { 'https://img.example/a.png': { body: PNG } } })
    expect(await pictures.importUrl(user, 'https://img.example/a.png', 'hero')).toBe('a'.repeat(64))
    expect(stored[0].spec).toMatchObject({ owner: 'u1', mime: 'image/png', name: 'hero' })
  })

  it('never reaches an internal address, even through a redirect', async () => {
    const direct = make()
    await expect(direct.pictures.importUrl(user, 'http://169.254.169.254/latest', 'x')).rejects.toThrow(/blocked/)
    const hop = make({ routes: { 'https://img.example/r': { status: 302, headers: { location: 'http://127.0.0.1:8080/secret.png' } } } })
    await expect(hop.pictures.importUrl(user, 'https://img.example/r', 'x')).rejects.toThrow(/blocked/)
    expect(hop.seen).not.toContain('http://127.0.0.1:8080/secret.png')
  })

  it('refuses what is not a JPEG, PNG or WebP — an SVG above all', async () => {
    const { pictures } = make({ routes: { 'https://img.example/x.svg': { body: SVG, headers: { 'content-type': 'image/svg+xml' } } } })
    await expect(pictures.importUrl(user, 'https://img.example/x.svg', 'x')).rejects.toThrow(/not a JPEG, PNG or WebP/)
  })

  it('refuses a picture too large, by its header or by counting', async () => {
    const big = make({ routes: { 'https://img.example/big': { body: PNG, headers: { 'content-length': String(MAX_PICTURE_BYTES + 1) } } } })
    await expect(big.pictures.importUrl(user, 'https://img.example/big', 'x')).rejects.toThrow(/larger than 15 MB/)
  })

  it('refuses other schemes', async () => {
    const { pictures } = make()
    await expect(pictures.importUrl(user, 'file:///etc/passwd', 'x')).rejects.toThrow(/http\(s\)/)
  })

  it('stops before writing when the disk quota is full', async () => {
    const { pictures, stored } = make({ routes: { 'https://img.example/a.png': { body: PNG } }, budgetFull: true })
    await expect(pictures.importUrl(user, 'https://img.example/a.png', 'x')).rejects.toThrow(/quota/)
    expect(stored).toHaveLength(0)
  })
})

describe('the pictures a design may be given', () => {
  it('are this account\'s only', () => {
    const { pictures } = make()
    expect(pictures.owns(user, 'c'.repeat(64))).toBe(true)
    expect(pictures.owns({ id: 'u2' }, 'c'.repeat(64))).toBe(false)
    expect(pictures.owns(user, 'd'.repeat(64))).toBe(false)
    expect(pictures.owns(user, '../etc')).toBe(false)
  })

  it('free photos need a configured library and the account\'s access', () => {
    expect(make().pictures.freeAvailable(user)).toBe(false)
  })
})
