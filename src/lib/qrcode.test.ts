import { describe, it, expect } from 'vitest'
import { encodeQR, qrToSvg, type QrLevel } from './qrcode'

const LEVELS: QrLevel[] = ['L', 'M', 'Q', 'H']

/** The version a symbol of this size encodes. Size is 4v + 17 and nothing else. */
function versionOf(matrix: boolean[][]): number {
  return (matrix.length - 17) / 4
}

function region(matrix: boolean[][], top: number, left: number, height: number, width: number): boolean[][] {
  return Array.from({ length: height }, (_, y) => matrix[top + y].slice(left, left + width))
}

const FINDER = [
  '#######',
  '#     #',
  '# ### #',
  '# ### #',
  '# ### #',
  '#     #',
  '#######',
].map((row) => [...row].map((c) => c === '#'))

/**
 * A deliberately independent reader: it re-derives the layout from the standard
 * instead of importing anything the encoder uses. Sharing helpers with the
 * encoder would make this test agree with the encoder's bugs, which is the one
 * thing it exists to catch — everything downstream of the module grid (the
 * masking, the block split, the Reed-Solomon, the interleaving) is invisible to
 * a structural assertion and would survive being wrong.
 */
function readBack(matrix: boolean[][], level: QrLevel): { text: string; mask: number } {
  const size = matrix.length
  const version = versionOf(matrix)
  const dark = (x: number, y: number): number => (matrix[y][x] ? 1 : 0)

  let format = 0
  for (let i = 0; i <= 5; i++) format |= dark(8, i) << i
  format |= dark(8, 7) << 6
  format |= dark(8, 8) << 7
  format |= dark(7, 8) << 8
  for (let i = 9; i < 15; i++) format |= dark(14 - i, 8) << i

  let mirror = 0
  for (let i = 0; i < 8; i++) mirror |= dark(size - 1 - i, 8) << i
  for (let i = 8; i < 15; i++) mirror |= dark(8, size - 15 + i) << i
  expect(mirror, 'the two copies of the format information must agree').toBe(format)

  // The BCH(15,5) word must divide cleanly once the 0x5412 mask is removed.
  let syndrome = format ^ 0x5412
  for (let i = 14; i >= 10; i--) if ((syndrome >>> i) & 1) syndrome ^= 0x537 << (i - 10)
  expect(syndrome, 'format information fails its BCH check').toBe(0)

  const payload = (format ^ 0x5412) >>> 10
  const levelBits: Record<number, QrLevel> = { 0b01: 'L', 0b00: 'M', 0b11: 'Q', 0b10: 'H' }
  expect(levelBits[payload >>> 3], 'format information names the wrong level').toBe(level)
  const mask = payload & 0b111

  const alignment = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]][
    version - 1
  ] as number[]
  const reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const reserve = (x: number, y: number): void => {
    if (x >= 0 && x < size && y >= 0 && y < size) reserved[y][x] = true
  }
  for (let i = 0; i < size; i++) {
    reserve(6, i)
    reserve(i, 6)
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) reserve(cx + dx, cy + dy)
  }
  const last = alignment.length - 1
  for (let i = 0; i <= last; i++) {
    for (let j = 0; j <= last; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) reserve(alignment[i] + dx, alignment[j] + dy)
    }
  }
  reserve(8, size - 8)
  for (let i = 0; i <= 5; i++) reserve(8, i)
  reserve(8, 7)
  reserve(8, 8)
  reserve(7, 8)
  for (let i = 9; i < 15; i++) reserve(14 - i, 8)
  for (let i = 0; i < 8; i++) reserve(size - 1 - i, 8)
  for (let i = 8; i < 15; i++) reserve(8, size - 15 + i)
  if (version >= 7) {
    for (let b = 0; b < 18; b++) {
      reserve(size - 11 + (b % 3), Math.floor(b / 3))
      reserve(Math.floor(b / 3), size - 11 + (b % 3))
    }
  }

  const masks: Array<(r: number, c: number) => boolean> = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (_r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ]
  const condition = masks[mask]

  const bits: number[] = []
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vertical = 0; vertical < size; vertical++) {
      for (let column = 0; column < 2; column++) {
        const x = right - column
        const y = ((right + 1) & 2) === 0 ? size - 1 - vertical : vertical
        if (reserved[y][x]) continue
        bits.push(matrix[y][x] !== condition(y, x) ? 1 : 0)
      }
    }
  }

  const stream = new Uint8Array(bits.length >> 3)
  for (let i = 0; i < stream.length * 8; i++) stream[i >> 3] |= bits[i] << (7 - (i & 7))

  const blocks: Record<QrLevel, number[][]> = {
    L: [[7, 1], [10, 1], [15, 1], [20, 1], [26, 1], [18, 2], [20, 2], [24, 2], [30, 2], [18, 4]],
    M: [[10, 1], [16, 1], [26, 1], [18, 2], [24, 2], [16, 4], [18, 4], [22, 4], [22, 5], [26, 5]],
    Q: [[13, 1], [22, 1], [18, 2], [26, 2], [18, 4], [24, 4], [18, 6], [22, 6], [20, 8], [24, 8]],
    H: [[17, 1], [28, 1], [22, 2], [16, 4], [22, 4], [28, 4], [26, 5], [26, 6], [24, 8], [28, 8]],
  }
  const [ecPerBlock, blockCount] = blocks[level][version - 1]
  const dataTotal = stream.length - ecPerBlock * blockCount
  const shortLength = Math.floor(dataTotal / blockCount)
  const longBlocks = dataTotal % blockCount
  const dataBlocks: number[][] = Array.from({ length: blockCount }, () => [])
  const ecBlocks: number[][] = Array.from({ length: blockCount }, () => [])
  let at = 0
  for (let i = 0; i <= shortLength; i++) {
    for (let b = 0; b < blockCount; b++) {
      if (i < shortLength + (b >= blockCount - longBlocks ? 1 : 0)) dataBlocks[b].push(stream[at++])
    }
  }
  for (let i = 0; i < ecPerBlock; i++) for (let b = 0; b < blockCount; b++) ecBlocks[b].push(stream[at++])
  expect(at, 'de-interleaving must consume the whole codeword stream').toBe(stream.length)

  // Reed-Solomon check: each block's codeword polynomial must vanish at every
  // root of the generator. Non-zero syndromes mean a scanner would see errors.
  const exp = new Uint8Array(512)
  const log = new Uint8Array(256)
  for (let i = 0, x = 1; i < 255; i++) {
    exp[i] = x
    log[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255]
  const multiply = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : exp[log[a] + log[b]])
  for (let b = 0; b < blockCount; b++) {
    const codewords = dataBlocks[b].concat(ecBlocks[b])
    for (let root = 0; root < ecPerBlock; root++) {
      let accumulator = 0
      for (const byte of codewords) accumulator = multiply(accumulator, exp[root]) ^ byte
      expect(accumulator, `Reed-Solomon syndrome ${root} of block ${b} must be zero`).toBe(0)
    }
  }

  const data = dataBlocks.flat()
  let cursor = 0
  const take = (count: number): number => {
    let value = 0
    for (let i = 0; i < count; i++, cursor++) value = (value << 1) | ((data[cursor >> 3] >> (7 - (cursor & 7))) & 1)
    return value
  }
  expect(take(4), 'the payload must be in byte mode').toBe(0b0100)
  const length = take(version < 10 ? 8 : 16)
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) bytes[i] = take(8)
  return { text: new TextDecoder().decode(bytes), mask }
}

describe('encodeQR', () => {
  it('returns a square matrix whose side is 4 * version + 17', () => {
    for (const text of ['', 'a', 'x'.repeat(40), 'x'.repeat(120), 'x'.repeat(210)]) {
      const matrix = encodeQR(text)
      const version = versionOf(matrix)
      expect(Number.isInteger(version), `side ${matrix.length} is not a legal symbol size`).toBe(true)
      expect(version).toBeGreaterThanOrEqual(1)
      expect(version).toBeLessThanOrEqual(10)
      expect(matrix.length).toBe(4 * version + 17)
      for (const row of matrix) expect(row.length).toBe(matrix.length)
    }
  })

  it('places the three finder patterns with their separators', () => {
    const matrix = encodeQR('https://mocky.local/s/abc123')
    const size = matrix.length

    expect(region(matrix, 0, 0, 7, 7)).toEqual(FINDER)
    expect(region(matrix, 0, size - 7, 7, 7)).toEqual(FINDER)
    expect(region(matrix, size - 7, 0, 7, 7)).toEqual(FINDER)

    // The separator is the light band that keeps each finder from touching data.
    for (let i = 0; i <= 7; i++) {
      expect(matrix[7][i], `top-left separator row at ${i}`).toBe(false)
      expect(matrix[i][7], `top-left separator column at ${i}`).toBe(false)
      expect(matrix[7][size - 1 - i], `top-right separator row at ${i}`).toBe(false)
      expect(matrix[i][size - 8], `top-right separator column at ${i}`).toBe(false)
      expect(matrix[size - 8][i], `bottom-left separator row at ${i}`).toBe(false)
      expect(matrix[size - 1 - i][7], `bottom-left separator column at ${i}`).toBe(false)
    }
  })

  it('keeps the dark module dark at column 8, row 4 * version + 9', () => {
    // 115 bytes reaches version 10 at level H and version 4 at level L, so the
    // sweep covers small and large symbols at every level.
    for (const text of ['', 'x'.repeat(60), 'x'.repeat(115)]) {
      for (const level of LEVELS) {
        const matrix = encodeQR(text, level)
        const version = versionOf(matrix)
        expect(matrix[4 * version + 9][8], `version ${version}, level ${level}`).toBe(true)
      }
    }
  })

  it('alternates the timing patterns between the finders', () => {
    const matrix = encodeQR('x'.repeat(120))
    const size = matrix.length
    for (let i = 8; i < size - 8; i++) {
      expect(matrix[6][i], `horizontal timing at ${i}`).toBe(i % 2 === 0)
      expect(matrix[i][6], `vertical timing at ${i}`).toBe(i % 2 === 0)
    }
  })

  it('encodes an empty string', () => {
    const matrix = encodeQR('')
    expect(matrix.length).toBe(21)
    expect(readBack(matrix, 'M').text).toBe('')
  })

  it('encodes multi-byte UTF-8 and counts bytes, not characters', () => {
    const text = 'Café — 🎨 déjà vu ñ'
    expect(readBack(encodeQR(text), 'M').text).toBe(text)

    // Twenty emoji are eighty bytes; twenty letters are twenty. If the encoder
    // sized the symbol from string length it would silently truncate here.
    const emoji = encodeQR('🎨'.repeat(20))
    const letters = encodeQR('a'.repeat(20))
    expect(emoji.length).toBeGreaterThan(letters.length)
    expect(readBack(emoji, 'M').text).toBe('🎨'.repeat(20))
  })

  it('reads back the exact payload at every version and level', () => {
    const samples = ['', 'A', 'https://mocky.local/partager?p=42', 'x'.repeat(70), 'x'.repeat(115)]
    for (const level of LEVELS) {
      for (const text of samples) {
        expect(readBack(encodeQR(text, level), level).text, `${text.length} bytes at level ${level}`).toBe(text)
      }
    }
  })

  it('refuses a payload that does not fit, and says so', () => {
    expect(() => encodeQR('a'.repeat(300), 'H')).toThrow(/too long/i)
    expect(() => encodeQR('a'.repeat(300), 'H')).toThrow(/300 bytes/)
    expect(() => encodeQR('a'.repeat(300), 'H')).toThrow(/119 bytes/)

    // The boundary itself: the documented maximum fits, one byte more does not.
    const maximum: Record<QrLevel, number> = { L: 271, M: 213, Q: 151, H: 119 }
    for (const level of LEVELS) {
      expect(versionOf(encodeQR('a'.repeat(maximum[level]), level)), level).toBe(10)
      expect(() => encodeQR('a'.repeat(maximum[level] + 1), level), level).toThrow(/too long/i)
    }
  })

  it('is deterministic', () => {
    const text = 'https://mocky.local/s/9f2c1e — déterminisme'
    for (const level of LEVELS) {
      expect(encodeQR(text, level)).toEqual(encodeQR(text, level))
    }
    expect(qrToSvg(text)).toBe(qrToSvg(text))
  })

  it('grows the version as the payload grows', () => {
    const versions = [10, 40, 90, 150, 200].map((length) => versionOf(encodeQR('x'.repeat(length))))
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i], `versions must increase: ${versions.join(', ')}`).toBeGreaterThan(versions[i - 1])
    }
  })

  it('spends fewer bytes on data as the correction level rises', () => {
    // Same payload, stronger correction, so the symbol can only get bigger.
    const text = 'x'.repeat(100)
    const sizes = LEVELS.map((level) => encodeQR(text, level).length)
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1])
  })

  it('defaults to level M', () => {
    const text = 'https://mocky.local/s/default'
    expect(encodeQR(text)).toEqual(encodeQR(text, 'M'))
  })
})

describe('qrToSvg', () => {
  it('returns a self-contained SVG with a coherent viewBox', () => {
    const text = 'https://mocky.local/s/abc123'
    const modules = encodeQR(text).length
    const svg = qrToSvg(text)

    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    // Four modules of quiet zone on every side, by default.
    expect(svg).toContain(`viewBox="0 0 ${modules + 8} ${modules + 8}"`)
    expect(svg).toContain('width="256" height="256"')
    expect(svg).toContain('<rect width="')
    expect(svg).toMatch(/<path d="M[\d ]/)

    // Nothing that would need the network or a stylesheet to render.
    expect(svg).not.toMatch(/url\(|<image|href|@import|<style|font/i)
  })

  it('honours size, margin and level', () => {
    const text = 'https://mocky.local/s/abc123'
    const modules = encodeQR(text, 'H').length
    const svg = qrToSvg(text, { level: 'H', size: 512, margin: 0 })
    expect(svg).toContain('width="512" height="512"')
    expect(svg).toContain(`viewBox="0 0 ${modules} ${modules}"`)
    expect(qrToSvg(text, { margin: 8 })).toContain(`viewBox="0 0 ${encodeQR(text).length + 16}`)
  })

  it('never writes the input into the markup', () => {
    // The result is inserted into same-origin HTML, so a share link carrying
    // markup must not be able to become markup.
    const svg = qrToSvg('https://evil.test/?x=</svg><script>alert(1)</script>')
    expect(svg).not.toContain('script')
    expect(svg).not.toContain('evil.test')
    expect(svg.match(/</g)?.length).toBe(4)
  })

  it('rejects nothing that encodeQR accepts', () => {
    for (const level of LEVELS) {
      expect(qrToSvg('', { level }).startsWith('<svg')).toBe(true)
      expect(qrToSvg('🎨', { level }).startsWith('<svg')).toBe(true)
    }
  })
})
