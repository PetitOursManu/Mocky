/**
 * A ZIP READER, for the one archive Mocky opens: a website a person attaches to
 * reproduce or redesign it (lib/siteSource.ts). `zip.ts` beside it only writes.
 *
 * Dependency-free on purpose: the browser inflates with `DecompressionStream`
 * ('deflate-raw'), so the two methods a real archive uses — stored and deflate —
 * cost nothing in the bundle. Anything else (zip64, encryption, bzip2) is
 * refused by name rather than half-read.
 *
 * The archive comes from somebody else, so it is read as hostile:
 * - entries are inflated LAZILY, only the ones the page actually references, so
 *   a 2 000-file node_modules costs its directory and nothing more;
 * - every byte inflated is counted against one budget, measured on the OUTPUT
 *   and not on the sizes the directory declares — a zip bomb lies there first;
 * - a name is normalised and one that climbs out of the root (`../`) is not a
 *   file of this archive at all. Nothing is ever written to a disk, but a lookup
 *   that resolves `../../x` to `x` would be a lookup the archive chose.
 */

/** Entries past this are not a website, they are a disk. */
export const ZIP_MAX_ENTRIES = 5000

/** Bytes inflated, all entries together. A page with its pictures is a few MB. */
export const ZIP_MAX_BYTES = 80 * 1024 * 1024

export class ZipError extends Error {
  constructor(public readonly reason: 'not-zip' | 'zip64' | 'encrypted' | 'method' | 'too-many' | 'too-large' | 'corrupt') {
    super(`zip: ${reason}`)
  }
}

export interface ZipArchive {
  /** Every file's normalised path, directories left out. */
  paths: string[]
  /** One file's bytes, inflated now — or null when the archive has no such file. */
  read(path: string): Promise<Uint8Array | null>
}

interface Entry {
  method: number
  compressed: number
  size: number
  local: number
}

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8)
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0

/**
 * An archive path made canonical: forward slashes, no leading `/` or `./`,
 * `..` resolved. Null for a name that leaves the root or names nothing.
 */
export function normalizeZipPath(name: string): string | null {
  const out: string[] = []
  for (const seg of name.replace(/\\/g, '/').split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') {
      if (!out.length) return null
      out.pop()
      continue
    }
    out.push(seg)
  }
  return out.length ? out.join('/') : null
}

/** Clutter every archiver adds and no page references. */
function isClutter(path: string): boolean {
  return path.startsWith('__MACOSX/') || /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/i.test(path)
}

async function inflate(data: Uint8Array, limit: number): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > limit) {
      await reader.cancel().catch(() => {})
      throw new ZipError('too-large')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out
}

export function openZip(bytes: Uint8Array): ZipArchive {
  // The end-of-central-directory record is in the last 22 bytes, unless a
  // comment (at most 65 535 bytes) follows it.
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (u32(bytes, i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new ZipError('not-zip')
  const count = u16(bytes, eocd + 10)
  const cdSize = u32(bytes, eocd + 12)
  const cdOffset = u32(bytes, eocd + 16)
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new ZipError('zip64')
  if (count > ZIP_MAX_ENTRIES) throw new ZipError('too-many')
  if (cdOffset + cdSize > bytes.length) throw new ZipError('corrupt')

  const entries = new Map<string, Entry>()
  const utf8 = new TextDecoder('utf-8')
  let p = cdOffset
  for (let i = 0; i < count; i++) {
    if (p + 46 > bytes.length || u32(bytes, p) !== 0x02014b50) throw new ZipError('corrupt')
    const flags = u16(bytes, p + 8)
    const method = u16(bytes, p + 10)
    const compressed = u32(bytes, p + 20)
    const size = u32(bytes, p + 24)
    const nameLen = u16(bytes, p + 28)
    const extraLen = u16(bytes, p + 30)
    const commentLen = u16(bytes, p + 32)
    const local = u32(bytes, p + 42)
    // Windows' own archiver writes names in the OEM code page without the UTF-8
    // flag; read as UTF-8 an accent is garbled, and only names it ever matters for.
    const raw = utf8.decode(bytes.subarray(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + extraLen + commentLen
    if (raw.endsWith('/')) continue
    const path = normalizeZipPath(raw)
    if (!path || isClutter(path)) continue
    if (flags & 1) throw new ZipError('encrypted')
    entries.set(path, { method, compressed, size, local })
  }

  let spent = 0
  return {
    paths: [...entries.keys()],
    async read(path) {
      const e = entries.get(path)
      if (!e) return null
      if (e.method !== 0 && e.method !== 8) throw new ZipError('method')
      if (e.local + 30 > bytes.length || u32(bytes, e.local) !== 0x04034b50) throw new ZipError('corrupt')
      // The local header's own name and extra lengths, not the directory's: the
      // two are allowed to differ, and the data starts after the LOCAL ones.
      const start = e.local + 30 + u16(bytes, e.local + 26) + u16(bytes, e.local + 28)
      if (start + e.compressed > bytes.length) throw new ZipError('corrupt')
      const data = bytes.subarray(start, start + e.compressed)
      const left = ZIP_MAX_BYTES - spent
      const out = e.method === 0 ? data.slice() : await inflate(data, left)
      if (out.length > left) throw new ZipError('too-large')
      spent += out.length
      return out
    },
  }
}
