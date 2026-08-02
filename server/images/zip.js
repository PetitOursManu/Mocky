// Dependency-free ZIP writer (stored / no-compression), ported from
// src/lib/zip.ts to Node Buffers so it can bundle BINARY image files (+ a text
// manifest) server-side. Keeps Mocky's "no heavy deps" promise — no `archiver`.
// Produces a standard .zip that Windows Explorer, macOS, and `unzip` all open.

function crc32(buf) {
  let crc = ~0
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (~crc) >>> 0
}

const u16 = (n) => Buffer.from([n & 0xff, (n >>> 8) & 0xff])
const u32 = (n) => Buffer.from([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff])

/**
 * @param {Array<{name:string, data:Buffer|string}>} entries
 * @returns {Buffer} the complete .zip
 */
export function makeZip(entries) {
  // The classic ZIP header fields are 16- and 32-bit, and u16()/u32() truncate
  // silently: past these limits the archive came out corrupt with nothing said,
  // which is worse than refusing. ZIP64 would lift them; refusing is honest and
  // costs nothing at the sizes Mocky actually produces.
  if (entries.length > 0xffff) {
    throw new Error(
      `Too many files for a ZIP archive (${entries.length}, max 65535). Filter the selection and try again.`,
    )
  }

  const chunks = []
  const central = []
  let offset = 0

  for (const entry of entries) {
    if (offset > 0xffffffff) {
      throw new Error('Archive is larger than 4 GB, which this ZIP format cannot address. Filter the selection.')
    }
    const nameBytes = Buffer.from(entry.name, 'utf8')
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8')
    const crc = crc32(data)

    const local = Buffer.concat([
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

    const cd = Buffer.concat([
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

  const end = Buffer.concat([
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

  return Buffer.concat(chunks)
}

export { crc32 }
