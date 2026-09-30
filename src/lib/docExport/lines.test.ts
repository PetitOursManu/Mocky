import { describe, expect, it } from 'vitest'
import {
  alignOf,
  applyTextTransform,
  groupBlocks,
  groupLines,
  parseCssColor,
  primaryFontFamily,
  splitAcrossRects,
  toHex6,
  unionRect,
} from './lines'
import { style } from './fixtures'
import type { RunStyle, Word } from './types'

const word = (text: string, x: number, y: number, w: number, h = 20, block = 0, s: RunStyle = style(), space = true): Word => ({
  text,
  rect: { x, y, w, h },
  space,
  block,
  style: s,
})

describe('parseCssColor', () => {
  it('reads what getComputedStyle writes, and the other spellings', () => {
    expect(parseCssColor('rgb(15, 23, 42)')).toEqual({ r: 15, g: 23, b: 42, a: 1 })
    expect(parseCssColor('rgba(255, 0, 0, 0.5)')).toEqual({ r: 255, g: 0, b: 0, a: 0.5 })
    expect(parseCssColor('rgb(15 23 42 / 0.25)')).toEqual({ r: 15, g: 23, b: 42, a: 0.25 })
    expect(parseCssColor('#f06')).toEqual({ r: 255, g: 0, b: 102, a: 1 })
    expect(parseCssColor('transparent').a).toBe(0)
  })

  it('falls back to black instead of throwing', () => {
    expect(parseCssColor('oklch(0.7 0.1 200)')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    expect(parseCssColor('')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })

  it('writes OOXML hex', () => {
    expect(toHex6({ r: 255, g: 0, b: 102, a: 1 })).toBe('FF0066')
  })
})

describe('primaryFontFamily', () => {
  it('takes the first face and names the generics after a real one', () => {
    expect(primaryFontFamily('"Space Grotesk", ui-sans-serif, system-ui')).toBe('Space Grotesk')
    expect(primaryFontFamily('ui-sans-serif, system-ui, sans-serif')).toBe('Arial')
    expect(primaryFontFamily('system-ui')).toBe('Arial')
    expect(primaryFontFamily('Georgia, serif')).toBe('Georgia')
    expect(primaryFontFamily('serif')).toBe('Times New Roman')
    expect(primaryFontFamily('ui-monospace, monospace')).toBe('Courier New')
    expect(primaryFontFamily('')).toBe('Arial')
  })
})

describe('small readings', () => {
  it('applies the text transform the page shows', () => {
    expect(applyTextTransform('réservez vite', 'uppercase')).toBe('RÉSERVEZ VITE')
    expect(applyTextTransform('fête de la musique', 'capitalize')).toBe('Fête De La Musique')
    expect(applyTextTransform('Tel quel', 'none')).toBe('Tel quel')
  })

  it('maps text-align, logical values included', () => {
    expect(alignOf('start')).toBe('left')
    expect(alignOf('end')).toBe('right')
    expect(alignOf('start', 'rtl')).toBe('right')
    expect(alignOf('-webkit-center')).toBe('center')
    expect(alignOf('justify')).toBe('justify')
  })

  it('unions rects', () => {
    expect(unionRect([{ x: 10, y: 10, w: 10, h: 10 }, { x: 0, y: 15, w: 5, h: 20 }])).toEqual({ x: 0, y: 10, w: 20, h: 25 })
  })

  it('shares a broken word out across its rects', () => {
    const parts = splitAcrossRects('abcdefgh', [
      { x: 0, y: 0, w: 60, h: 10 },
      { x: 0, y: 12, w: 20, h: 10 },
    ])
    expect(parts.map((p) => p.text)).toEqual(['abcdef', 'gh'])
    expect(splitAcrossRects('x', [{ x: 0, y: 0, w: 0, h: 0 }])).toEqual([])
  })
})

describe('groupLines', () => {
  it('puts words on one band into one line, and a wrap into the next', () => {
    const lines = groupLines([word('Fête', 0, 0, 40), word('de', 45, 0, 20), word('la', 0, 24, 15), word('musique', 20, 24, 60)])
    expect(lines.map((l) => l.text)).toEqual(['Fête de', 'la musique'])
    expect(lines[0].rect).toEqual({ x: 0, y: 0, w: 65, h: 20 })
  })

  it('does not insert a space the source did not have', () => {
    const lines = groupLines([word('Hello', 0, 0, 40), word('World', 40, 0, 40, 20, 0, style({ fontWeight: 700 }), false)])
    expect(lines[0].text).toBe('HelloWorld')
    expect(lines[0].runs.map((r) => r.text)).toEqual(['Hello', 'World'])
  })

  it('reads a gap the layout drew as a space, even with no whitespace in the source', () => {
    // A flex row of spans with `gap-2`: "12 juin", not "12juin".
    const flex = groupLines([word('12', 0, 0, 20), word('juin', 28, 0, 40, 20, 0, style(), false)])
    expect(flex[0].text).toBe('12 juin')
    // Kerning-sized gaps stay glued: under a fifth of an em at 16 px.
    const kern = groupLines([word('Hello', 0, 0, 40), word('World', 43, 0, 40, 20, 0, style(), false)])
    expect(kern[0].text).toBe('HelloWorld')
  })

  it('merges runs of one style and splits on a change', () => {
    const bold = style({ fontWeight: 700 })
    const lines = groupLines([word('Un', 0, 0, 20), word('seul', 25, 0, 30, 20, 0, bold), word('mot', 60, 0, 30), word('gras', 95, 0, 30)])
    expect(lines[0].runs.map((r) => r.text)).toEqual(['Un ', 'seul ', 'mot gras'])
  })

  it('starts a new line on a new block even on the same band', () => {
    const lines = groupLines([word('Gauche', 0, 0, 50, 20, 0), word('Droite', 400, 0, 50, 20, 1)])
    expect(lines).toHaveLength(2)
  })

  it('treats words of different sizes on one baseline as one line', () => {
    const lines = groupLines([word('Grand', 0, 0, 100, 60, 0, style({ fontSize: 48 })), word('petit', 110, 30, 40, 20)])
    expect(lines).toHaveLength(1)
    expect(lines[0].fontSize).toBe(48)
  })
})

describe('groupBlocks', () => {
  const infos = [
    { align: 'center' as const, lineHeight: 30 },
    { align: 'left' as const, lineHeight: null },
  ]

  it('measures the pitch between lines, or reads line-height for a single one', () => {
    const lines = groupLines([word('a', 0, 0, 10), word('b', 0, 28, 10), word('c', 0, 56, 10)])
    const [b] = groupBlocks(lines, infos)
    expect(b.pitch).toBe(28)
    expect(b.align).toBe('center')
    const [single] = groupBlocks(groupLines([word('solo', 0, 0, 40)]), infos)
    expect(single.pitch).toBe(30)
  })

  it('splits a block interrupted by another one, so two boxes never overlap', () => {
    const lines = groupLines([word('Intro', 0, 0, 40, 20, 0), word('Para', 0, 30, 40, 20, 1), word('Outro', 0, 60, 40, 20, 0)])
    expect(groupBlocks(lines, infos).map((b) => b.lines.map((l) => l.text))).toEqual([['Intro'], ['Para'], ['Outro']])
  })
})
