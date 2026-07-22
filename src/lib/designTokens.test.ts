import { describe, it, expect } from 'vitest'
import { parseColors, parseDesignSystem, replaceTokenHex, roleForLabel } from './designTokens'

const MD = `# Design System
## Color tokens
- Background: #0f172a
- Surface: #1e293b
- Text: #e2e8f0
- Muted text: #94a3b8
- Primary: #6366f1
- Border: #334155
## Spacing & radius
- Radius: rounded-xl for cards
`

describe('roleForLabel', () => {
  it('maps common labels to roles', () => {
    expect(roleForLabel('Primary')).toBe('accent')
    expect(roleForLabel('Background')).toBe('bg')
    expect(roleForLabel('Surface')).toBe('surface')
    expect(roleForLabel('Muted text')).toBe('muted')
    expect(roleForLabel('Text')).toBe('text')
    expect(roleForLabel('Border')).toBe('border')
    expect(roleForLabel('On primary')).toBe('accentText')
    expect(roleForLabel('Success')).toBe('other')
  })
})

describe('parseColors', () => {
  it('captures hex, label, role and a usable source offset', () => {
    const cols = parseColors(MD)
    const primary = cols.find((c) => c.label === 'Primary')!
    expect(primary.hex).toBe('#6366f1')
    expect(primary.role).toBe('accent')
    // The offset must point exactly at the '#'
    expect(MD.slice(primary.index, primary.index + 7)).toBe('#6366f1')
  })

  it('dedupes repeated colors', () => {
    expect(parseColors('- A: #ffffff\n- B: #FFFFFF')).toHaveLength(1)
  })
})

describe('parseDesignSystem', () => {
  it('resolves roles from labels', () => {
    const ds = parseDesignSystem(MD)
    expect(ds.roles.accent).toBe('#6366f1')
    expect(ds.roles.bg).toBe('#0f172a')
    expect(ds.roles.text).toBe('#e2e8f0')
    expect(ds.roles.border).toBe('#334155')
    expect(ds.radius).toBe('14px') // rounded-xl
  })

  it('fills sensible fallbacks for a bare palette', () => {
    const ds = parseDesignSystem('brand #22d3ee')
    expect(ds.roles.accent).toBe('#22d3ee')
    // no bg declared → dark default, so text is light
    expect(ds.roles.text).toBe('#e2e8f0')
    expect(ds.roles.accentText).toBe('#0f172a') // cyan is light → dark text on it
  })
})

describe('replaceTokenHex', () => {
  it('rewrites exactly one token in place', () => {
    const cols = parseColors(MD)
    const primary = cols.find((c) => c.label === 'Primary')!
    const out = replaceTokenHex(MD, primary, '#ff0000')
    expect(out).toContain('- Primary: #ff0000')
    expect(out).toContain('- Background: #0f172a') // untouched
    expect(parseColors(out).find((c) => c.label === 'Primary')!.hex).toBe('#ff0000')
  })
})
