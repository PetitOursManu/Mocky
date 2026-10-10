import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import DesignWebPreview, { fontStack } from './DesignWebPreview'

const DOSSIER = `# Design Dossier — Untitled project

## Product
Cadence

## Concept
Une lecture éditoriale des chiffres.

## Tokens

### Colors
- Papier: #fdfcf8  (background)
- Encre: #1a1a1a  (text)
- Signal: #c0392b  (accent)

### Typography
- Display: Cormorant Garamond
- Body: Instrument Sans

## Layout Grammar
- Grille asymétrique, marges généreuses.
`

describe('the web preview of a DESIGN.md', () => {
  it('paints the page with the roles the document resolves, and says which were inferred', () => {
    const html = renderToStaticMarkup(<DesignWebPreview markdown={DOSSIER} title="DESIGN.md" />)
    expect(html).toContain('cadence.example')
    expect(html).toContain('Une lecture éditoriale des chiffres.')
    expect(html).toContain('Grille asymétrique, marges généreuses.')
    expect(html).toContain('background:#fdfcf8')
    expect(html).toContain('background:#c0392b')
    expect(html).toContain('&quot;Cormorant Garamond&quot;')
    // The surface was not stated: the legend must not pass the fallback off as the document's.
    expect(html).toMatch(/#f8fafc[^<]*·/)
  })

  it('keeps a declared face to a family name, so a document cannot write CSS through it', () => {
    expect(fontStack('Cormorant Garamond')).toBe('"Cormorant Garamond", ui-serif, Georgia, serif')
    expect(fontStack('Inter, 400/700')).toBe('"Inter", ui-sans-serif, system-ui, sans-serif')
    expect(fontStack('Space-Grotesk — geometric')).toBe('"Space-Grotesk", ui-sans-serif, system-ui, sans-serif')
    expect(fontStack('JetBrains Mono')).toContain('monospace')
    expect(fontStack('x"; background:url(//evil)')).toBe('ui-sans-serif, system-ui, sans-serif')
    expect(fontStack(undefined)).toBe('ui-sans-serif, system-ui, sans-serif')
  })
})
