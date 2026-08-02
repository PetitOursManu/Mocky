/**
 * A QR encoder written here rather than installed.
 *
 * WHY THIS IS NOT A DEPENDENCY
 *
 * Mocky vendors what it ships and runs offline under a strict CSP. A QR symbol
 * is a closed, published, entirely deterministic transform from a string to a
 * grid of black and white squares (ISO/IEC 18004): no network, no locale, no
 * platform behaviour, nothing that can drift between two runs or two machines.
 * Taking an npm package for that would widen the supply chain — install scripts,
 * transitive packages, a new thing to re-audit at every bump — in exchange for
 * an algorithm that is finished. The whole of it is below and can be read in one
 * sitting, which is the point.
 *
 * WHAT IT IS FOR, AND WHAT THAT LETS US DROP
 *
 * Showing a share link on screen so someone can point a phone at it. That single
 * caller decides every scope choice here. Byte mode only: a URL is bytes, and
 * the numeric and alphanumeric modes would only buy density for inputs we never
 * have. UTF-8 in, because share links carry accented project names. Versions 1
 * to 10, which top out at 271 bytes at level L and 213 at the default level M —
 * a link longer than that is not a link anyone scans, and the block tables for
 * versions 11 to 40 are thirty more rows of hand-copied numbers for capacity
 * this feature will never reach. Extending the range later means adding rows to
 * EC_BLOCKS and ALIGNMENT_POSITIONS; nothing else in this file assumes ten.
 */

/** Niveau de correction d'erreur. */
export type QrLevel = 'L' | 'M' | 'Q' | 'H'

/**
 * Error correction per version: [EC codewords per block, number of blocks],
 * indexed by version - 1. Everything else about the block layout — how many data
 * codewords, how they split into short and long blocks — is derived from these
 * two numbers and the version's total capacity, exactly as the standard defines
 * it, so there is no third table that could disagree with the first two.
 */
const EC_BLOCKS: Record<QrLevel, ReadonlyArray<readonly [number, number]>> = {
  L: [[7, 1], [10, 1], [15, 1], [20, 1], [26, 1], [18, 2], [20, 2], [24, 2], [30, 2], [18, 4]],
  M: [[10, 1], [16, 1], [26, 1], [18, 2], [24, 2], [16, 4], [18, 4], [22, 4], [22, 5], [26, 5]],
  Q: [[13, 1], [22, 1], [18, 2], [26, 2], [18, 4], [24, 4], [18, 6], [22, 6], [20, 8], [24, 8]],
  H: [[17, 1], [28, 1], [22, 2], [16, 4], [22, 4], [28, 4], [26, 5], [26, 6], [24, 8], [28, 8]],
}

/** Row/column centres of the alignment patterns, indexed by version - 1. */
const ALIGNMENT_POSITIONS: ReadonlyArray<ReadonlyArray<number>> = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
]

const MAX_VERSION = EC_BLOCKS.L.length

/** The two-bit code each level takes in the format information. Not the obvious order. */
const LEVEL_BITS: Record<QrLevel, number> = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 }

const MODE_BYTE = 0b0100

/** Alternating filler for the unused tail of the data area, fixed by the standard. */
const PAD_CODEWORDS = [0xec, 0x11]

// GF(256) built on the primitive polynomial the standard mandates, x^8 + x^4 +
// x^3 + x^2 + 1. The exponent table is doubled so a product of two logarithms
// can be looked up without a modulo.
const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)
for (let i = 0, x = 1; i < 255; i++) {
  GF_EXP[i] = x
  GF_LOG[x] = i
  x <<= 1
  if (x & 0x100) x ^= 0x11d
}
for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]

function gfMultiply(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

/** Polynomial product over GF(256), coefficients highest degree first. */
function polyMultiply(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length - 1)
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] ^= gfMultiply(a[i], b[j])
  }
  return out
}

/** The Reed-Solomon generator (x - a^0)(x - a^1)...(x - a^(degree-1)); subtraction is XOR here. */
function rsGeneratorPolynomial(degree: number): Uint8Array {
  let poly: Uint8Array = new Uint8Array([1])
  for (let i = 0; i < degree; i++) poly = polyMultiply(poly, new Uint8Array([1, GF_EXP[i]]))
  return poly
}

/**
 * The error correction codewords for one block: the remainder of the data,
 * shifted up by the generator's degree, divided by the generator. Long division
 * done in place, one input byte at a time, so nothing the size of the message is
 * ever allocated.
 */
function rsRemainder(data: Uint8Array, generator: Uint8Array): Uint8Array {
  const degree = generator.length - 1
  const remainder = new Uint8Array(degree)
  for (const byte of data) {
    const factor = byte ^ remainder[0]
    remainder.copyWithin(0, 1)
    remainder[degree - 1] = 0
    // generator[0] is the leading 1 that the shift above has already accounted for.
    for (let i = 0; i < degree; i++) remainder[i] ^= gfMultiply(generator[i + 1], factor)
  }
  return remainder
}

/**
 * BCH remainder, shared by the format information (degree 10 over 0x537) and the
 * version information (degree 12 over 0x1f25). Both are the same operation on
 * different constants, and writing it twice is how the two drift apart.
 */
function bchRemainder(value: number, degree: number, generator: number): number {
  let remainder = value
  for (let i = 0; i < degree; i++) {
    remainder = (remainder << 1) ^ ((remainder >>> (degree - 1)) * generator)
  }
  return remainder
}

/** Bit `index` of `value`, counting from the least significant. */
function bitAt(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0
}

interface QrFrame {
  size: number
  /** Module colours: true is dark. Function patterns are already drawn. */
  modules: boolean[][]
  /** true where a module belongs to a function pattern and must never carry data. */
  reserved: boolean[][]
}

function blankGrid(size: number): boolean[][] {
  return Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
}

/**
 * Where the fifteen format bits live, in both copies. Listed in one place because
 * these cells are reserved during construction and written after the mask is
 * chosen — two passes far apart in time that must agree exactly.
 */
function formatInfoCells(size: number): Array<{ x: number; y: number; bit: number }> {
  const cells: Array<{ x: number; y: number; bit: number }> = []
  for (let i = 0; i <= 5; i++) cells.push({ x: 8, y: i, bit: i })
  cells.push({ x: 8, y: 7, bit: 6 })
  cells.push({ x: 8, y: 8, bit: 7 })
  cells.push({ x: 7, y: 8, bit: 8 })
  for (let i = 9; i < 15; i++) cells.push({ x: 14 - i, y: 8, bit: i })
  for (let i = 0; i < 8; i++) cells.push({ x: size - 1 - i, y: 8, bit: i })
  for (let i = 8; i < 15; i++) cells.push({ x: 8, y: size - 15 + i, bit: i })
  return cells
}

/** Where the eighteen version bits live, in both copies. Versions 7 and up only. */
function versionInfoCells(size: number): Array<{ x: number; y: number; bit: number }> {
  const cells: Array<{ x: number; y: number; bit: number }> = []
  for (let bit = 0; bit < 18; bit++) {
    const far = size - 11 + (bit % 3)
    const near = Math.floor(bit / 3)
    cells.push({ x: far, y: near, bit })
    cells.push({ x: near, y: far, bit })
  }
  return cells
}

/**
 * Draw every function pattern and reserve every cell that data may not touch.
 * The order matters: timing patterns go down first and the finders overwrite
 * their ends, which is cheaper than computing the exact spans that survive.
 */
function buildFrame(version: number): QrFrame {
  const size = 4 * version + 17
  const modules = blankGrid(size)
  const reserved = blankGrid(size)

  const set = (x: number, y: number, dark: boolean): void => {
    modules[y][x] = dark
    reserved[y][x] = true
  }

  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0)
    set(i, 6, i % 2 === 0)
  }

  // A finder and its separator are one shape under the Chebyshev distance from
  // the centre: dark except at rings 2 and 4, clipped at the symbol's edge.
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx
        const y = cy + dy
        if (x < 0 || x >= size || y < 0 || y >= size) continue
        const ring = Math.max(Math.abs(dx), Math.abs(dy))
        set(x, y, ring !== 2 && ring !== 4)
      }
    }
  }

  const centres = ALIGNMENT_POSITIONS[version - 1]
  const last = centres.length - 1
  for (let i = 0; i <= last; i++) {
    for (let j = 0; j <= last; j++) {
      // The three corners are already occupied by finder patterns.
      const isFinderCorner = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)
      if (isFinderCorner) continue
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          set(centres[i] + dx, centres[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
        }
      }
    }
  }

  // The dark module. It carries no information; it exists so that the region
  // below the top-left finder can never be read as a continuation of it.
  set(8, size - 8, true)

  for (const cell of formatInfoCells(size)) set(cell.x, cell.y, false)

  if (version >= 7) {
    const bits = (version << 12) | bchRemainder(version, 12, 0x1f25)
    for (const cell of versionInfoCells(size)) set(cell.x, cell.y, bitAt(bits, cell.bit))
  }

  return { size, modules, reserved }
}

const TOTAL_CODEWORDS_CACHE = new Map<number, number>()

/**
 * How many codewords a version holds, data and error correction together.
 *
 * Counted from the frame rather than tabulated. The standard publishes this
 * number, but a typo in a fourth table would surface as a symbol that scans on
 * no phone; deriving it from the very grid the data will be written into makes
 * the count and the placement incapable of disagreeing. The leftover modules —
 * up to seven of them — are the remainder bits, which stay light.
 */
function totalCodewords(version: number): number {
  const cached = TOTAL_CODEWORDS_CACHE.get(version)
  if (cached !== undefined) return cached
  const { reserved } = buildFrame(version)
  let free = 0
  for (const row of reserved) {
    for (const isFunction of row) if (!isFunction) free++
  }
  const total = free >> 3
  TOTAL_CODEWORDS_CACHE.set(version, total)
  return total
}

function ecBlocks(version: number, level: QrLevel): readonly [number, number] {
  return EC_BLOCKS[level][version - 1]
}

function dataCodewords(version: number, level: QrLevel): number {
  const [ecPerBlock, blocks] = ecBlocks(version, level)
  return totalCodewords(version) - ecPerBlock * blocks
}

/** Byte mode spends 8 bits on the character count below version 10, 16 from there on. */
function characterCountBits(version: number): number {
  return version < 10 ? 8 : 16
}

/** How many bytes of payload a version and level can carry, headers deducted. */
function byteCapacity(version: number, level: QrLevel): number {
  const usable = dataCodewords(version, level) * 8 - 4 - characterCountBits(version)
  return Math.max(0, usable >> 3)
}

function appendBits(bits: number[], value: number, count: number): void {
  for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1)
}

/**
 * The payload, headers and padding, as the version's full run of data codewords.
 */
function buildDataCodewords(bytes: Uint8Array, version: number, level: QrLevel): Uint8Array {
  const capacityBits = dataCodewords(version, level) * 8
  const bits: number[] = []
  appendBits(bits, MODE_BYTE, 4)
  appendBits(bits, bytes.length, characterCountBits(version))
  for (const byte of bytes) appendBits(bits, byte, 8)

  // The terminator is four zero bits, or fewer when the data ends that close to
  // the edge of the capacity.
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length))
  appendBits(bits, 0, (8 - (bits.length % 8)) % 8)
  for (let i = 0; bits.length < capacityBits; i++) appendBits(bits, PAD_CODEWORDS[i % 2], 8)

  const codewords = new Uint8Array(bits.length >> 3)
  for (let i = 0; i < bits.length; i++) codewords[i >> 3] |= bits[i] << (7 - (i & 7))
  return codewords
}

/**
 * Split into blocks, compute error correction for each, and interleave.
 *
 * The interleaving is the whole reason blocks exist: a scratch or a thumb over
 * the symbol damages a contiguous run of modules, and spreading each block's
 * codewords across the symbol turns that one big wound into a survivable
 * scratch in every block at once.
 */
function interleaveBlocks(data: Uint8Array, version: number, level: QrLevel): Uint8Array {
  const [ecPerBlock, blockCount] = ecBlocks(version, level)
  const shortLength = Math.floor(data.length / blockCount)
  // The remainder is spread over the last blocks, one extra codeword each.
  const longBlocks = data.length % blockCount

  const generator = rsGeneratorPolynomial(ecPerBlock)
  const dataBlocks: Uint8Array[] = []
  const ecBlocksOut: Uint8Array[] = []
  let offset = 0
  for (let i = 0; i < blockCount; i++) {
    const length = shortLength + (i >= blockCount - longBlocks ? 1 : 0)
    const block = data.subarray(offset, offset + length)
    offset += length
    dataBlocks.push(block)
    ecBlocksOut.push(rsRemainder(block, generator))
  }

  const out = new Uint8Array(totalCodewords(version))
  let at = 0
  for (let i = 0; i <= shortLength; i++) {
    for (const block of dataBlocks) if (i < block.length) out[at++] = block[i]
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocksOut) out[at++] = block[i]
  }
  return out
}

/**
 * Write the codeword stream into the free modules, two columns at a time from
 * the bottom right, alternating direction. Column 6 is skipped whole because the
 * vertical timing pattern owns it and it would otherwise shift the pairing.
 */
function placeData(frame: QrFrame, codewords: Uint8Array): void {
  const { size, modules, reserved } = frame
  const totalBits = codewords.length * 8
  let bit = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vertical = 0; vertical < size; vertical++) {
      for (let column = 0; column < 2; column++) {
        const x = right - column
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vertical : vertical
        if (reserved[y][x] || bit >= totalBits) continue
        modules[y][x] = bitAt(codewords[bit >> 3], 7 - (bit & 7))
        bit++
      }
    }
  }
}

/** The eight mask conditions, in the standard's order. A true means invert. */
const MASK_CONDITIONS: ReadonlyArray<(row: number, column: number) => boolean> = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

/** XOR the mask over the data modules. Applying it twice restores the symbol. */
function applyMask(frame: QrFrame, mask: number): void {
  const condition = MASK_CONDITIONS[mask]
  const { size, modules, reserved } = frame
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!reserved[y][x] && condition(y, x)) modules[y][x] = !modules[y][x]
    }
  }
}

function drawFormatInfo(frame: QrFrame, level: QrLevel, mask: number): void {
  const data = (LEVEL_BITS[level] << 3) | mask
  const bits = ((data << 10) | bchRemainder(data, 10, 0x537)) ^ 0x5412
  for (const cell of formatInfoCells(frame.size)) {
    frame.modules[cell.y][cell.x] = bitAt(bits, cell.bit)
  }
}

/** Dark, light, dark ×3, light, dark, then four light — the finder's signature. */
const FINDER_LIKE: ReadonlyArray<boolean> = [
  true, false, true, true, true, false, true, false, false, false, false,
]

function matchesAt(line: boolean[], start: number, pattern: ReadonlyArray<boolean>, reversed: boolean): boolean {
  for (let i = 0; i < pattern.length; i++) {
    if (line[start + i] !== pattern[reversed ? pattern.length - 1 - i : i]) return false
  }
  return true
}

/** Rules 1 and 3, which both read a single row or column end to end. */
function linePenalty(line: boolean[]): number {
  let penalty = 0
  let runLength = 1
  for (let i = 1; i <= line.length; i++) {
    if (i < line.length && line[i] === line[i - 1]) {
      runLength++
      continue
    }
    if (runLength >= 5) penalty += 3 + (runLength - 5)
    runLength = 1
  }
  for (let i = 0; i + FINDER_LIKE.length <= line.length; i++) {
    if (matchesAt(line, i, FINDER_LIKE, false) || matchesAt(line, i, FINDER_LIKE, true)) penalty += 40
  }
  return penalty
}

/**
 * The four penalty rules, summed. This picks the mask that a scanner will have
 * the easiest time with; it is a quality heuristic, not a correctness condition,
 * so where the standard's wording on rule 3 admits more than one reading, the
 * common one — an eleven-module window inside the symbol — is enough.
 */
function penaltyScore(frame: QrFrame): number {
  const { size, modules } = frame
  let penalty = 0
  let dark = 0

  for (let y = 0; y < size; y++) {
    penalty += linePenalty(modules[y])
    for (let x = 0; x < size; x++) if (modules[y][x]) dark++
  }
  const column = new Array<boolean>(size)
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) column[y] = modules[y][x]
    penalty += linePenalty(column)
  }

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const corner = modules[y][x]
      if (corner === modules[y][x + 1] && corner === modules[y + 1][x] && corner === modules[y + 1][x + 1]) {
        penalty += 3
      }
    }
  }

  const deviation = Math.abs((dark * 100) / (size * size) - 50)
  return penalty + Math.floor(deviation / 5) * 10
}

/** UTF-8, because share links carry accented project names and the odd emoji. */
function toUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function smallestVersion(byteLength: number, level: QrLevel): number {
  for (let version = 1; version <= MAX_VERSION; version++) {
    if (byteLength <= byteCapacity(version, level)) return version
  }
  throw new Error(
    `QR payload too long: ${byteLength} bytes in UTF-8, but level ${level} holds at most ` +
      `${byteCapacity(MAX_VERSION, level)} bytes at version ${MAX_VERSION}, the largest supported here.`,
  )
}

/** Matrice carrée de modules : true = sombre. */
export function encodeQR(text: string, level: QrLevel = 'M'): boolean[][] {
  if (!(level in EC_BLOCKS)) throw new Error(`Unknown QR error correction level: ${String(level)}`)

  const bytes = toUtf8(text)
  const version = smallestVersion(bytes.length, level)
  const frame = buildFrame(version)
  placeData(frame, interleaveBlocks(buildDataCodewords(bytes, version, level), version, level))

  // Every mask is scored on the finished symbol, format information included,
  // because those thirty modules count towards the penalty like any other.
  let bestMask = 0
  let bestPenalty = Number.POSITIVE_INFINITY
  for (let mask = 0; mask < MASK_CONDITIONS.length; mask++) {
    applyMask(frame, mask)
    drawFormatInfo(frame, level, mask)
    const penalty = penaltyScore(frame)
    if (penalty < bestPenalty) {
      bestPenalty = penalty
      bestMask = mask
    }
    applyMask(frame, mask)
  }
  applyMask(frame, bestMask)
  drawFormatInfo(frame, level, bestMask)

  return frame.modules
}

/** Le même QR rendu en SVG autonome (chaîne). `size` = côté en px. */
export function qrToSvg(text: string, opts: { level?: QrLevel; size?: number; margin?: number } = {}): string {
  const matrix = encodeQR(text, opts.level ?? 'M')
  const modules = matrix.length

  // The only values that reach the markup are these three integers and the
  // module coordinates derived from them. The input text is never written into
  // the SVG — not in a <title>, not in a comment — so a share link carrying
  // markup cannot become markup when the result is dropped into same-origin
  // HTML. Coercing the numbers keeps that true for JavaScript callers, who are
  // not held to the signature above.
  const pixels = Math.max(1, Math.round(Number(opts.size) || 256))
  const margin = Math.max(0, Math.round(Number(opts.margin ?? 4) || 0))
  const extent = modules + margin * 2

  let path = ''
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      if (matrix[y][x]) path += `M${x + margin} ${y + margin}h1v1h-1z`
    }
  }

  // No <title> and no role: an accessible name belongs to the element the caller
  // wraps this in, where it can be written in the user's language.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" ` +
    `viewBox="0 0 ${extent} ${extent}" shape-rendering="crispEdges">` +
    `<rect width="${extent}" height="${extent}" fill="#ffffff"/>` +
    `<path d="${path}" fill="#000000"/>` +
    `</svg>`
  )
}
