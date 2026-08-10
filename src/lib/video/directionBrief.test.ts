import { describe, it, expect } from 'vitest'
import { directionBriefFrom, DIRECTION_BRIEF_MAX } from './directionBrief'

const DOSSIER = `# Art direction

## Concept
Editorial and high contrast. Generous silence, one idea per screen.

## Tokens
| Role | Value |
|---|---|
| Background | #0b0b0d |
| Accent | #d8ff3e |

- Ink: #f4f4f2 on near-black
- Radius: 2px

## Motion language
- Slow reveals, nothing bounces.
- Type arrives before anything else.

## Forbidden
- Drop shadows
- Gradients behind text

![a reference](https://example.com/a.jpg)
https://example.com/reference

\`\`\`css
:root { --accent: #d8ff3e }
\`\`\`
`

describe('the direction a film works from', () => {
  it('keeps the sentences that say how it FEELS', () => {
    const brief = directionBriefFrom(DOSSIER)
    expect(brief).toContain('Generous silence, one idea per screen.')
    expect(brief).toContain('Slow reveals, nothing bounces.')
  })

  it('carries the forbidden list, which is a composition instruction', () => {
    // A direction that forbids gradients is telling the composer which ground
    // not to reach for. It is the one list in these documents a film can act on.
    const brief = directionBriefFrom(DOSSIER)
    expect(brief).toContain('Gradients behind text')
  })

  it('lets no colour through at all', () => {
    // The colours already travel, exactly, as `theme` — attached by the server
    // after validation. Repeating them here adds nothing a composition can use
    // and invites the one refusal that costs a whole paid call.
    const brief = directionBriefFrom(DOSSIER)
    expect(brief).not.toMatch(/#[0-9a-fA-F]{3}/)
    expect(brief).not.toContain('Background')
  })

  it('drops fenced blocks, tables, images and bare links', () => {
    const brief = directionBriefFrom(DOSSIER)
    expect(brief).not.toContain('--accent')
    expect(brief).not.toContain('|')
    expect(brief).not.toContain('https://')
  })

  it('strips the markdown syntax rather than passing it on', () => {
    // It lands in a plain-text block beside a brief somebody typed. A run of
    // hashes there reads as emphasis nobody wrote.
    const brief = directionBriefFrom(DOSSIER)
    expect(brief).not.toContain('##')
    expect(brief).toContain('Motion language')
  })

  it('answers nothing for nothing, which the compose route reads as no block', () => {
    for (const input of ['', '   ', null, undefined]) {
      expect(directionBriefFrom(input)).toBe('')
    }
  })

  it('answers nothing rather than a fragment for a document of pure tokens', () => {
    expect(directionBriefFrom('# Tokens\n\n- bg: #101014\n- ink: #f0f0f0\n')).toBe('')
  })

  it('cuts on whole lines and never mid-sentence', () => {
    const long = Array.from({ length: 200 }, (_, i) => `Line ${i} says something about the rhythm.`).join('\n')
    const brief = directionBriefFrom(long)
    expect(brief.length).toBeLessThanOrEqual(DIRECTION_BRIEF_MAX)
    for (const line of brief.split('\n')) {
      expect(line).toMatch(/rhythm\.$/)
    }
  })

  it('says a repeated sentence once', () => {
    const brief = directionBriefFrom('Calm and spare.\n\n## Calm and spare\n\nCalm and spare.')
    expect(brief.split('\n')).toEqual(['Calm and spare.', 'Calm and spare'])
  })
})
