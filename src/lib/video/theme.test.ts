import { describe, it, expect } from 'vitest'
import { themeFromDesign } from './theme'
import { VideoThemeSchema } from './timeline'

/** A Muse dossier, in the grammar `dossierToMarkdown` emits. */
const DOSSIER = `# Design Dossier — Untitled project

## Product
Cadence

## Tokens

### Colors
- Papier: #fdfcf8  (background)
- Encre: #1a1a1a  (text)
- Signal: #c0392b  (accent)

### Typography
- Display: Cormorant Garamond
- Body: Instrument Sans

### Radius
- rounded-xl
`

/** A derived DESIGN.md, in the section order DESIGN_EXTRACT_PROMPT fixes. */
const DESIGN_MD = `# Design System

## Color tokens
- Primary: #4f46e5
- Background: #0f172a
- Text: #e2e8f0

## Typography
- Display: Instrument Serif
- Body: Inter

## Spacing & radius
- Radius: rounded-lg
`

describe('themeFromDesign', () => {
  it('reads the colours and the two faces a dossier declares', () => {
    const theme = themeFromDesign(DOSSIER)
    expect(theme).toEqual({
      colors: { background: '#fdfcf8', text: '#1a1a1a', accent: '#c0392b' },
      fonts: { heading: 'Cormorant Garamond', body: 'Instrument Sans' },
    })
    /*
     * And no radius, although the dossier has a `### Radius` section.
     *
     * `readRadius` reads ONE line — `Radius: rounded-xl` — and a dossier puts
     * the value on the line after the heading, so `parseDesignSystem` has always
     * fallen back to its own 12px on this shape. Asserting the absence rather
     * than papering over it: widening that regex changes what the design-system
     * frame draws for every existing dossier, which is a decision for the module
     * that owns it and not a side effect of adding video themes.
     */
    expect(theme?.radiusPx).toBeUndefined()
  })

  it('reads a derived DESIGN.md the same way', () => {
    const theme = themeFromDesign(DESIGN_MD)
    expect(theme?.colors).toEqual({ background: '#0f172a', text: '#e2e8f0', accent: '#4f46e5' })
    expect(theme?.fonts).toEqual({ heading: 'Instrument Serif', body: 'Inter' })
    expect(theme?.radiusPx).toBe(10)
  })

  /**
   * The rule the whole block exists for.
   *
   * `parseDesignSystem` always returns seven filled roles and a radius, because a
   * style sheet has to render something; most of those are inventions when the
   * document is quiet. A guessed surface burnt into a film cannot be seen
   * through — the video is simply the wrong colour, with nothing saying so —
   * while an absent one leaves the composition on a default somebody chose on
   * purpose.
   */
  it('carries only what the document DECLARED, never what the parser filled in', () => {
    const sparse = `# Design System

## Color tokens
- Accent: #c0392b
`
    const theme = themeFromDesign(sparse)
    expect(theme).toEqual({ colors: { accent: '#c0392b' } })
    // parseDesignSystem answers all seven; none of the other six is a fact.
    expect(theme?.colors?.surface).toBeUndefined()
    expect(theme?.colors?.background).toBeUndefined()
    expect(theme?.colors?.text).toBeUndefined()
  })

  // Same rule, on the one token that is not a colour: `parseRadius` falls back
  // to 12px so a preview always renders, and 12px nobody chose has no business
  // in every corner of somebody's film.
  it('omits the radius when the document never mentions one', () => {
    const theme = themeFromDesign('# Design System\n\n## Color tokens\n- Accent: #c0392b\n')
    expect(theme?.radiusPx).toBeUndefined()
  })

  it('converts a declared radius to whole pixels, rem included', () => {
    expect(themeFromDesign('# D\n## Radius\n- Radius: 1.5rem\n- Accent: #c0392b\n')?.radiusPx).toBe(24)
    expect(themeFromDesign('# D\n## Radius\n- Radius: 20px\n- Accent: #c0392b\n')?.radiusPx).toBe(20)
    // rounded-full, which a pill really is and which the schema tops out at.
    expect(themeFromDesign('# D\n## Radius\n- Radius: rounded-full\n')?.radiusPx).toBe(9999)
  })

  /**
   * The defect this closes: a font name is the one theme field that could carry
   * CSS syntax, and design documents write stacks — `- Body: Inter, sans-serif`
   * is ordinary, and Mocky's own default DESIGN.md says `system-ui / Inter`.
   * The schema takes ONE family and the composition appends its fallbacks, so
   * the head of the list is what travels.
   */
  it('takes one family name out of a stack, and never the punctuation', () => {
    expect(themeFromDesign('# D\n## Typography\n- Body: Inter, sans-serif\n')?.fonts?.body).toBe('Inter')
    expect(themeFromDesign('# D\n## Typography\n- Display: system-ui / Inter\n')?.fonts?.heading).toBe('system-ui')
    expect(themeFromDesign('# D\n## Typography\n- Body: "Fira Sans", sans-serif\n')?.fonts?.body).toBe('Fira Sans')
  })

  // Dropped, not cleaned up: a sanitised typeface is a different typeface, and
  // the honest answer to "this direction names a font Mocky cannot express" is
  // the template's own face.
  it('drops a font it cannot express rather than repairing it', () => {
    const theme = themeFromDesign('# D\n## Typography\n- Display: url(http://evil.test/f.woff)\n- Body: Inter\n')
    expect(theme?.fonts).toEqual({ body: 'Inter' })
  })

  it('answers null when there is no direction, and when there is nothing in it', () => {
    expect(themeFromDesign('')).toBe(null)
    expect(themeFromDesign(null)).toBe(null)
    expect(themeFromDesign(undefined)).toBe(null)
    // A document with prose and no tokens states nothing this schema can carry.
    // `null` and not `{}`: "no direction" and "a direction asking for nothing"
    // are different facts, and `{}` is refused by the schema anyway.
    expect(themeFromDesign('# Design System\n\nUne page calme.\n')).toBe(null)
  })

  /**
   * Belt and braces, because `attachTheme` drops a refused theme WHOLE: one
   * unusable token would cost the project its colours too. Whatever this builder
   * emits has to be acceptable by construction.
   */
  it('only ever emits themes the schema accepts', () => {
    for (const md of [DOSSIER, DESIGN_MD, '# D\n## Colors\n- Accent: #C0392B\n', '# D\n## Radius\n- Radius: 0px\n']) {
      const theme = themeFromDesign(md)
      if (theme) expect(VideoThemeSchema.safeParse(theme).success, md.slice(0, 30)).toBe(true)
    }
  })

  // Upper-case hex is how half of these documents are written, and a colour is
  // not a path — unlike `imageId`, where two spellings are two files.
  it('keeps a colour exactly as the document wrote it, capitals included', () => {
    expect(themeFromDesign('# D\n## Colors\n- Accent: #C0392B\n')?.colors?.accent).toBe('#C0392B')
  })
})
