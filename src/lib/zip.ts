/**
 * Minimal, dependency-free ZIP writer using the "stored" (no compression)
 * method. Produces a standard .zip that Windows Explorer, macOS, and `unzip`
 * all open. Good enough for bundling a handful of small .tsx files.
 *
 * It also carries BYTES, because a document export needs a package of pictures:
 * the PNG pages of a flyer, and a .pptx, which is a zip whose slides are XML and
 * whose backgrounds are JPEGs. Stored is right for both — a JPEG or a PNG is
 * already compressed, and OOXML readers (PowerPoint, Google Slides, Keynote)
 * accept stored parts. A string is still encoded as UTF-8, exactly as before.
 */

/** A text file — what the project export builds, and reads back as text in its tests. */
export interface ZipEntry {
  name: string
  content: string
}

/** Any entry the writer accepts: text, or bytes stored as they are. */
export interface ZipInput {
  name: string
  content: string | Uint8Array
}

function crc32(bytes: Uint8Array): number {
  let crc = ~0
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i]
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (~crc) >>> 0
}

const u16 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff])
const u32 = (n: number) =>
  new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff])

function concat(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((a, p) => a + p.length, 0)
  const out = new Uint8Array(len)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

export function makeZip(entries: readonly ZipInput[]): Blob {
  return new Blob([makeZipBytes(entries)] as BlobPart[], { type: 'application/zip' })
}

/**
 * The same archive as bytes. What a test can read back, and what the .pptx
 * writer wraps in a Blob of its own media type.
 */
export function makeZipBytes(entries: readonly ZipInput[]): Uint8Array {
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name)
    const data = typeof entry.content === 'string' ? enc.encode(entry.content) : entry.content
    const crc = crc32(data)

    const local = concat([
      u32(0x04034b50), // local file header signature
      u16(20), // version needed
      u16(0), // flags
      u16(0), // compression: stored
      u16(0), // mod time
      u16(0), // mod date
      u32(crc),
      u32(data.length), // compressed size
      u32(data.length), // uncompressed size
      u16(nameBytes.length),
      u16(0), // extra length
      nameBytes,
    ])
    chunks.push(local, data)

    const cd = concat([
      u32(0x02014b50), // central directory header signature
      u16(20), // version made by
      u16(20), // version needed
      u16(0), // flags
      u16(0), // compression
      u16(0), // mod time
      u16(0), // mod date
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0), // extra length
      u16(0), // comment length
      u16(0), // disk number start
      u16(0), // internal attrs
      u32(0), // external attrs
      u32(offset), // local header offset
      nameBytes,
    ])
    central.push(cd)
    offset += local.length + data.length
  }

  const centralStart = offset
  let centralSize = 0
  for (const c of central) {
    chunks.push(c)
    centralSize += c.length
  }

  const end = concat([
    u32(0x06054b50), // end of central directory signature
    u16(0), // disk number
    u16(0), // disk with central dir
    u16(entries.length),
    u16(entries.length),
    u32(centralSize),
    u32(centralStart),
    u16(0), // comment length
  ])
  chunks.push(end)

  return concat(chunks)
}
