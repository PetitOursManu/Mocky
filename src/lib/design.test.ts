import { describe, it, expect } from 'vitest'
import { extractDesignColors, extractProductName } from './design'

describe('extractDesignColors', () => {
  it('extracts hex colors with their preceding labels', () => {
    const md = '## Color tokens\n- Primary: #4f46e5 (indigo-600)\n- Background: #0f172a'
    expect(extractDesignColors(md)).toEqual([
      { hex: '#4f46e5', label: 'Primary' },
      { hex: '#0f172a', label: 'Background' },
    ])
  })

  it('captures two labelled colors on one line', () => {
    const md = '- Success: #10b981  Danger: #f43f5e'
    expect(extractDesignColors(md)).toEqual([
      { hex: '#10b981', label: 'Success' },
      { hex: '#f43f5e', label: 'Danger' },
    ])
  })

  it('dedupes repeated colors, keeping the first', () => {
    const md = '- A: #ffffff\n- B: #FFFFFF'
    expect(extractDesignColors(md)).toEqual([{ hex: '#ffffff', label: 'A' }])
  })

  it('falls back to the hex as the label when unlabelled', () => {
    expect(extractDesignColors('palette #abc then more')).toEqual([{ hex: '#abc', label: '#abc' }])
  })

  it('returns an empty array when there are no hex colors', () => {
    expect(extractDesignColors('# Design\nNo colors here.')).toEqual([])
  })
})

describe('extractProductName', () => {
  it('reads the name from a ## Product section', () => {
    const md = `# Design System

## Product
Softly

## Color tokens
- Primary: #b8422e
`
    expect(extractProductName(md)).toBe('Softly')
  })

  it('returns null when the section is absent', () => {
    // Every DESIGN.md written before the section existed. The caller names the
    // document instead of inventing a product.
    expect(extractProductName('# Design System\n\n## Color tokens\n- Primary: #fff')).toBeNull()
    expect(extractProductName('')).toBeNull()
    expect(extractProductName(undefined)).toBeNull()
  })

  it("honours the prompt's own escape hatch", () => {
    expect(extractProductName('## Product\nnot established by this screen\n')).toBeNull()
  })

  it('strips list markers and emphasis the model adds anyway', () => {
    expect(extractProductName('## Product\n- **Nimbus**\n')).toBe('Nimbus')
  })

  it('keeps the name and drops the explanation', () => {
    // Models narrate despite being told not to.
    expect(extractProductName('## Product\nSoftly — a wellness app\n')).toBe('Softly')
    expect(extractProductName('## Product\nSoftly. The wordmark in the header.\n')).toBe('Softly')
  })

  it('refuses a sentence pretending to be a name', () => {
    const md = '## Product\nThis screen does not appear to belong to any particular named product\n'
    expect(extractProductName(md)).toBeNull()
  })

  it('stops at the next section', () => {
    expect(extractProductName('## Product\nSoftly\n\n## Typography\nInter\n')).toBe('Softly')
  })

  it('keeps multi-word names', () => {
    expect(extractProductName('## Product\nRaw Form\n')).toBe('Raw Form')
  })
})
