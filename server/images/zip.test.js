import { describe, it, expect } from 'vitest'
import { makeZip } from './zip.js'

// Minimal parser for STORED (uncompressed) zip entries: walk local file headers
// from offset 0 until the central directory signature.
function parseStoredZip(buf) {
  const out = {}
  let o = 0
  while (o + 4 <= buf.length && buf.readUInt32LE(o) === 0x04034b50) {
    const compSize = buf.readUInt32LE(o + 18)
    const nameLen = buf.readUInt16LE(o + 26)
    const extraLen = buf.readUInt16LE(o + 28)
    const name = buf.slice(o + 30, o + 30 + nameLen).toString('utf8')
    const dataStart = o + 30 + nameLen + extraLen
    out[name] = buf.slice(dataStart, dataStart + compSize)
    o = dataStart + compSize
  }
  return out
}

describe('makeZip', () => {
  it('produces a parseable archive with text + binary entries', () => {
    const bin = Buffer.from([0, 1, 2, 255, 254, 10, 13])
    const zip = makeZip([
      { name: 'manifest.json', data: JSON.stringify({ a: 1 }) },
      { name: 'hero-ab12cd34.jpg', data: bin },
    ])
    expect(zip.slice(0, 4).readUInt32LE(0)).toBe(0x04034b50) // starts with a local header
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50) // ends with EOCD

    const parsed = parseStoredZip(zip)
    expect(Object.keys(parsed).sort()).toEqual(['hero-ab12cd34.jpg', 'manifest.json'])
    expect(JSON.parse(parsed['manifest.json'].toString('utf8'))).toEqual({ a: 1 })
    expect(Buffer.compare(parsed['hero-ab12cd34.jpg'], bin)).toBe(0) // binary preserved byte-for-byte
  })

  it('records the correct entry count in the EOCD', () => {
    const zip = makeZip([
      { name: 'a.txt', data: 'a' },
      { name: 'b.txt', data: 'b' },
      { name: 'c.txt', data: 'c' },
    ])
    expect(zip.readUInt16LE(zip.length - 22 + 10)).toBe(3) // total entries field
  })
})
