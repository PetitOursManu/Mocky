import { describe, expect, it } from 'vitest'
import { makeZipBytes } from './zip'

/** Reads back the local file headers — enough to prove what was stored, byte for byte. */
function readZip(bytes: Uint8Array): { name: string; crc: number; data: Uint8Array }[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out: { name: string; crc: number; data: Uint8Array }[] = []
  let o = 0
  while (view.getUint32(o, true) === 0x04034b50) {
    const crc = view.getUint32(o + 14, true)
    const size = view.getUint32(o + 18, true)
    const nameLen = view.getUint16(o + 26, true)
    const extra = view.getUint16(o + 28, true)
    const name = new TextDecoder().decode(bytes.subarray(o + 30, o + 30 + nameLen))
    const start = o + 30 + nameLen + extra
    out.push({ name, crc, data: bytes.subarray(start, start + size) })
    o = start + size
  }
  return out
}

describe('makeZipBytes', () => {
  it('stores a string as its UTF-8 bytes, as it always did', () => {
    const [e] = readZip(makeZipBytes([{ name: 'a.txt', content: 'héllo' }]))
    expect(e.name).toBe('a.txt')
    expect([...e.data]).toEqual([...new TextEncoder().encode('héllo')])
  })

  it('checksums with the standard CRC-32', () => {
    const [e] = readZip(makeZipBytes([{ name: 'h', content: 'hello' }]))
    expect(e.crc).toBe(0x3610a686)
  })

  it('stores bytes untouched — a PNG must not be re-encoded as text', () => {
    // 0x89 and 0xff are not valid UTF-8 on their own: encoding them as a string
    // would have doubled them into two-byte sequences.
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0x00, 0x80])
    const entries = readZip(makeZipBytes([{ name: 'p.png', content: png }, { name: 't.xml', content: '<a/>' }]))
    expect(entries.map((e) => e.name)).toEqual(['p.png', 't.xml'])
    expect([...entries[0].data]).toEqual([...png])
    expect(new TextDecoder().decode(entries[1].data)).toBe('<a/>')
  })

  it('ends with a central directory that counts every entry', () => {
    const bytes = makeZipBytes([
      { name: 'a', content: 'x' },
      { name: 'b', content: new Uint8Array([1, 2]) },
    ])
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const end = bytes.length - 22
    expect(view.getUint32(end, true)).toBe(0x06054b50)
    expect(view.getUint16(end + 10, true)).toBe(2)
  })
})
