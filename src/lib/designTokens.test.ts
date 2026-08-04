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
    // One unlabelled colour is a brand colour, not a page colour — no evidence
    // to infer a background from, so the dark default stands and text is light.
    expect(ds.roles.text).toBe('#e2e8f0')
    expect(ds.roles.accentText).toBe('#0f172a') // cyan is light → dark text on it
  })
})

/**
 * A Muse dossier does not label its colours "Background" and "Surface" — it is
 * asked for a coherent palette and it names it for the design: Paper, Bone,
 * Signal. None of those match any label pattern, so the parser found no
 * background and fell back to slate-900. Two cream editorial screens therefore
 * both previewed as the same dark navy dashboard, which is what the user saw:
 * "les prévisualisations ne sont pas bonnes par rapport au thème des Iframe".
 */
describe('a design that never says "background"', () => {
  const EDITORIAL = `# Design Dossier — Draftline
## Tokens
### Colors
- Sun: #f4c744
- Paper: #fdfbf4
- Ink: #101010
- Signal: #e8442f
- Bone: #d9d2c2
### Radius
- Radius: rounded-none
`

  it('reads the page colour off the palette instead of defaulting to navy', () => {
    const ds = parseDesignSystem(EDITORIAL)
    expect(ds.roles.text).toBe('#101010') // "Ink" is a text label
    // Furthest from the ink among the unassigned colours — the cream, not the
    // yellow and not the red.
    expect(ds.roles.bg).toBe('#fdfbf4')
    expect(ds.roles.bg).not.toBe('#0f172a')
  })

  it('honours a role stated in parentheses, as Muse writes it', () => {
    // colorLines() renders the dossier's own `role` field as "(background)".
    // Reading only the label threw that away.
    const md = '### Colors\n- Obsidian: #0b0b0f  (background)\n- Chalk: #f5f5f0  (text)\n'
    const ds = parseDesignSystem(md)
    expect(ds.roles.bg).toBe('#0b0b0f')
    expect(ds.roles.text).toBe('#f5f5f0')
  })

  it('lands on the dark end for a dark palette, not just the lightest colour', () => {
    // The contrast rule has to work in both directions, or it is just "pick the
    // lightest" wearing a disguise.
    const md = '### Colors\n- Void: #07090d\n- Haze: #e6edf3 (text)\n- Pulse: #3b82f6 (accent)\n'
    expect(parseDesignSystem(md).roles.bg).toBe('#07090d')
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
