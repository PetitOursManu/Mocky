import { describe, expect, it } from 'vitest'
import { makeZipBytes } from './zip'
import { ZIP_MAX_BYTES, ZipError, normalizeZipPath, openZip } from './zipRead'

const text = (b: Uint8Array | null) => (b ? new TextDecoder().decode(b) : null)

/**
 * A one-entry archive compressed with deflate — what every real archiver
 * writes, and what `makeZip` (stored only) never does. `declared` lets a test
 * lie in the directory the way a zip bomb does.
 */
async function deflatedZip(name: string, data: Uint8Array, declared = data.length, flags = 0): Promise<Uint8Array> {
  const body = new Uint8Array(await new Response(new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())
  const n = new TextEncoder().encode(name)
  const le = (v: number, size: number) => Array.from({ length: size }, (_, i) => (v >>> (8 * i)) & 0xff)
  const local = [...le(0x04034b50, 4), ...le(20, 2), ...le(flags, 2), ...le(8, 2), ...le(0, 4), ...le(0, 4), ...le(body.length, 4), ...le(declared, 4), ...le(n.length, 2), ...le(0, 2)]
  const central = [...le(0x02014b50, 4), ...le(20, 2), ...le(20, 2), ...le(flags, 2), ...le(8, 2), ...le(0, 4), ...le(0, 4), ...le(body.length, 4), ...le(declared, 4), ...le(n.length, 2), ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(0, 4), ...le(0, 4)]
  const cdOffset = local.length + n.length + body.length
  const eocd = [...le(0x06054b50, 4), ...le(0, 2), ...le(0, 2), ...le(1, 2), ...le(1, 2), ...le(central.length + n.length, 4), ...le(cdOffset, 4), ...le(0, 2)]
  const out = new Uint8Array(cdOffset + central.length + n.length + eocd.length)
  out.set(local, 0)
  out.set(n, local.length)
  out.set(body, local.length + n.length)
  out.set(central, cdOffset)
  out.set(n, cdOffset + central.length)
  out.set(eocd, cdOffset + central.length + n.length)
  return out
}

describe('normalizeZipPath', () => {
  it('makes a name canonical, and refuses one that climbs out of the root', () => {
    expect(normalizeZipPath('./site\\css//a.css')).toBe('site/css/a.css')
    expect(normalizeZipPath('/site/img/../a.png')).toBe('site/a.png')
    expect(normalizeZipPath('../../etc/passwd')).toBeNull()
    expect(normalizeZipPath('a/../../b')).toBeNull()
    expect(normalizeZipPath('./')).toBeNull()
  })
})

describe('openZip', () => {
  it('reads stored entries, leaving archiver clutter out', async () => {
    const zip = openZip(
      makeZipBytes([
        { name: 'site/index.html', content: '<h1>Hi</h1>' },
        { name: '__MACOSX/site/._index.html', content: 'junk' },
        { name: 'site/.DS_Store', content: 'junk' },
      ]),
    )
    expect(zip.paths).toEqual(['site/index.html'])
    expect(text(await zip.read('site/index.html'))).toBe('<h1>Hi</h1>')
    expect(await zip.read('site/missing.css')).toBeNull()
  })

  it('inflates deflate, which is what a real archive uses', async () => {
    const page = '<p>' + 'répété '.repeat(500) + '</p>'
    const zip = openZip(await deflatedZip('index.html', new TextEncoder().encode(page)))
    expect(text(await zip.read('index.html'))).toBe(page)
  })

  it('counts what it inflates, not what the directory declares', async () => {
    // Zeros compress a thousandfold: the budget must stop the OUTPUT.
    const bomb = await deflatedZip('index.html', new Uint8Array(ZIP_MAX_BYTES + 1024), 10)
    await expect(openZip(bomb).read('index.html')).rejects.toThrow(ZipError)
  })

  it('refuses what it cannot read honestly', async () => {
    expect(() => openZip(new TextEncoder().encode('not a zip at all'))).toThrow(/not-zip/)
    const encrypted = await deflatedZip('a.html', new Uint8Array(4), 4, 1)
    expect(() => openZip(encrypted)).toThrow(/encrypted/)
  })
})
