import { describe, it, expect } from 'vitest'
import { extractDesignColors } from './design'

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
