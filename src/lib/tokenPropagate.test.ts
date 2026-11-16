import { describe, expect, it } from 'vitest'
import {
  colorUses,
  fontUses,
  nearMisses,
  planPropagation,
  propagateInto,
  replaceColor,
  replaceFont,
  tokenChanges,
} from './tokenPropagate'

const md = (accent: string, display = 'Playfair Display') => `# DESIGN.md

## Colors
- Background: #0B0B0C
- Accent: ${accent}
- Text: #F5F5F4

## Typography
- Display: ${display}, serif
- Body: Inter, 400/600
`

describe('tokenChanges', () => {
  it('pairs a colour by its label', () => {
    const changes = tokenChanges(md('#C6FF3D'), md('#7A5CFF'))
    expect(changes).toEqual([{ kind: 'color', label: 'Accent', from: '#c6ff3d', to: '#7a5cff' }])
  })

  it('reads a font change off the typography section', () => {
    const changes = tokenChanges(md('#C6FF3D'), md('#C6FF3D', 'Fraunces'))
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ kind: 'font', label: 'display' })
    if (changes[0].kind === 'font') {
      expect(changes[0].from.family).toBe('Playfair Display')
      expect(changes[0].to.family).toBe('Fraunces')
    }
  })

  it('says nothing when nothing moved', () => {
    expect(tokenChanges(md('#C6FF3D'), md('#c6ff3d'))).toEqual([])
    expect(tokenChanges(null, md('#C6FF3D'))).toEqual([])
  })
})

describe('replaceColor', () => {
  it('rewrites classes, styles, fills and constants, in the case they were written', () => {
    const code = [
      `const ACCENT = '#C6FF3D'`,
      `<div className="bg-[#C6FF3D] text-[#c6ff3d]/50 ring-[#C6FF3D]">`,
      `<svg><path fill="#c6ff3d" /></svg>`,
      `<span style={{ color: '#C6FF3D80' }}>x</span>`,
    ].join('\n')
    const out = replaceColor(code, '#c6ff3d', '#7a5cff')
    expect(out).toContain(`const ACCENT = '#7A5CFF'`)
    expect(out).toContain('bg-[#7A5CFF] text-[#7a5cff]/50 ring-[#7A5CFF]')
    expect(out).toContain('fill="#7a5cff"')
    expect(out).toContain(`'#7A5CFF80'`) // alpha kept
    expect(colorUses(out, '#c6ff3d')).toBe(0)
  })

  it('finds the short form of the same colour', () => {
    expect(replaceColor('bg-[#fff]', '#ffffff', '#000000')).toBe('bg-[#000000]')
  })

  it('leaves Tailwind shades and near colours alone, and counts them', () => {
    // lime-500 IS #84cc16 in Tailwind's table: same colour, but a decision
    // written as a shade, and the rewrite leaves it to whoever wrote it.
    const code = '<a className="bg-lime-500 text-[#85CD17] border-[#84CC16]">'
    const out = replaceColor(code, '#84CC16', '#7A5CFF')
    expect(out).toContain('bg-lime-500')
    expect(out).toContain('text-[#85CD17]')
    expect(out).toContain('border-[#7A5CFF]')
    expect(nearMisses(code, '#84CC16')).toBe(2)
  })

  it('never reads an HTML entity as a colour', () => {
    expect(replaceColor('<p>&#123; x</p>', '#112233', '#000000')).toBe('<p>&#123; x</p>')
    expect(colorUses('&#123;', '#112233')).toBe(0)
  })
})

describe('replaceFont', () => {
  it('renames a family where code names one, keeping underscores in a class', () => {
    const code = [
      `<h1 className="font-['Playfair_Display',serif]">Playfair Display, our font</h1>`,
      `<p style={{ fontFamily: "'Playfair Display', serif" }}>x</p>`,
      `const display = "Playfair Display, serif"`,
    ].join('\n')
    const out = replaceFont(code, 'Playfair Display', 'DM Serif Display')
    expect(out).toContain(`font-['DM_Serif_Display',serif]`)
    expect(out).toContain(`"'DM Serif Display', serif"`)
    expect(out).toContain(`"DM Serif Display, serif"`)
    // The sentence is words, not a family declaration.
    expect(out).toContain('>Playfair Display, our font<')
    expect(fontUses(out, 'Playfair Display')).toBe(0)
  })

  it('never touches a longer family that starts with the same name', () => {
    expect(replaceFont(`font-['Inter_Tight']`, 'Inter', 'Manrope')).toBe(`font-['Inter_Tight']`)
  })
})

describe('planPropagation and propagateInto', () => {
  const changes = tokenChanges(md('#C6FF3D'), md('#7A5CFF'))

  it('lists only the screens that write the old token', () => {
    const plan = planPropagation(
      [
        { id: 'a', code: 'export default function A(){return <div className="bg-[#C6FF3D]" />}' },
        { id: 'b', code: 'export default function B(){return <div className="bg-[#C7FF3E]" />}' },
        { id: 'c', code: '' },
      ],
      changes,
    )
    expect(plan.screenIds).toEqual(['a'])
    expect(plan.near).toBe(1)
  })

  it('returns the rewritten code, or null when there was nothing to do', async () => {
    const code = 'export default function A(){return <div className="bg-[#C6FF3D]" />}'
    expect(await propagateInto(code, changes)).toContain('bg-[#7A5CFF]')
    expect(await propagateInto('export default function B(){return null}', changes)).toBeNull()
  })
})
