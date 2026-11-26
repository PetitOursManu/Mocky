import { describe, expect, it } from 'vitest'
import { AVOID_MAX, avoidFrom } from './directions'

const md = (bg: string, accent: string, display = 'Playfair Display') => `# Design Dossier — X

## Tokens

### Colors
- Background: ${bg}
- Text: #111111
- Accent: ${accent}

### Typography
- Display: ${display}
- Body: Inter
`

describe('the ledger of what the account already looks like', () => {
  it('reads the other projects’ grounds, accents and faces, most recent first', () => {
    const out = avoidFrom(
      [
        { id: 'a', design: md('#faf7f2', '#b23a2e'), updatedAt: 1 },
        { id: 'b', design: md('#0b0d12', '#22d3ee', 'Space Grotesk'), updatedAt: 3 },
        { id: 'here', design: md('#ffffff', '#00ff00'), updatedAt: 9 },
        { id: 'c', updatedAt: 5 },
      ],
      'here',
    )
    expect(out.map((e) => e.colors.find((c) => c.label === 'Background')?.hex.toLowerCase())).toEqual(['#0b0d12', '#faf7f2'])
    expect(out[0].display).toBe('Space Grotesk')
    expect(out[1].colors.find((c) => c.label === 'Accent')?.hex.toLowerCase()).toBe('#b23a2e')
  })

  it('counts one direction once, and no more than the server keeps', () => {
    const same = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, design: md('#faf7f2', '#b23a2e') }))
    expect(avoidFrom(same)).toHaveLength(1)
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, design: md(`#${(i * 7 + 16).toString(16).padStart(2, '0')}0000`, '#00aa00') }))
    expect(avoidFrom(many)).toHaveLength(AVOID_MAX)
  })
})
