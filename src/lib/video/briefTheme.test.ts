import { describe, it, expect } from 'vitest'
import { briefColorPalette, mergeFilmTheme, themeFromBrief } from './briefTheme'
import { themeFromDesign } from './theme'
import { VideoThemeSchema, VideoTimelineSchema } from './timeline'

/** The project's own direction: a cream editorial page, states all four roles. */
const DOSSIER = `# Design Dossier — Untitled project

## Tokens

### Colors
- Papier: #fdfcf8  (background)
- Encre: #1a1a1a  (text)
- Signal: #c0392b  (accent)
- Carte: #ffffff  (surface)

### Typography
- Display: Cormorant Garamond
- Body: Instrument Sans
`

const project = () => themeFromDesign(DOSSIER)

describe('a brief states a colour by naming what it is for', () => {
  it('reads a role word in front of a colour name, in French', () => {
    expect(themeFromBrief('Un teaser de trois plans, fond noir et texte blanc.')).toEqual({
      colors: { background: '#000000', text: '#ffffff' },
    })
  })

  /*
   * English puts the noun after the colour, which is why the window looks both
   * ways: read backwards only, "black background, white text" painted the
   * ground white off the comma before it.
   */
  it('reads the same sentence in English, where the noun follows', () => {
    expect(themeFromBrief('Three shots, black background, white text, a red accent.')?.colors).toEqual({
      background: '#000000',
      text: '#ffffff',
      accent: '#c0392b',
    })
  })

  it('reads a preposition as naming the ground, in both languages', () => {
    expect(themeFromBrief('Du texte blanc sur noir.')?.colors).toEqual({
      text: '#ffffff',
      background: '#000000',
    })
    expect(themeFromBrief('White text on black.')?.colors).toEqual({
      text: '#ffffff',
      background: '#000000',
    })
  })

  it('reads a hex the user typed, with its own capitalisation', () => {
    expect(themeFromBrief('Le fond doit être #0B0B0F et l’accent #C0392B.')?.colors).toEqual({
      background: '#0B0B0F',
      accent: '#C0392B',
    })
  })

  it('reads the "X sur Y" idiom, which names two roles at once', () => {
    const theme = themeFromBrief('Un générique en vert foncé sur noir.')
    expect(theme?.colors?.background).toBe('#000000')
    // The modifier moves the named green toward black rather than picking a
    // second green out of a table nothing holds level with the first.
    expect(theme?.colors?.text).toBe('#0c5a29')
  })

  it('reads "sur fond X" without the idiom firing on the noun', () => {
    // "fond" is not a colour, so the idiom does not match — the role windows do,
    // and they get both halves right including the one the idiom would have
    // taken for the ink.
    expect(themeFromBrief('Un logo rouge sur un fond noir.')?.colors).toEqual({ background: '#000000' })
  })

  it('takes NOTHING from two colours with no roles — that is a guess, not a reading', () => {
    expect(themeFromBrief('Un film en rouge et noir, nerveux.')).toBe(null)
    expect(themeFromBrief('Something bold and red.')).toBe(null)
  })

  it('does not fire on a colour word inside another word', () => {
    expect(themeFromBrief('Un fond vertical, format vertical.')).toBe(null)
    expect(themeFromBrief('Le fond orangeade du plan trois.')).toBe(null)
  })

  it('does not read "or", which is a conjunction before it is a colour', () => {
    expect(themeFromBrief('Le fond reste sobre. Or, le rythme doit être vif.')).toBe(null)
  })

  it('does not reach across a full stop for a role word', () => {
    expect(themeFromBrief('Parlons du fond. Ensuite, un peu de vert.')).toBe(null)
  })

  it('keeps the first statement when a brief changes its mind', () => {
    expect(themeFromBrief('Fond noir, puis un fond blanc à la fin.')?.colors?.background).toBe('#000000')
  })

  it('refuses a hex that is not one', () => {
    expect(themeFromBrief('Le fond en #12345 et le texte en #1234567.')).toBe(null)
  })

  it('says nothing when the brief says nothing', () => {
    expect(themeFromBrief('')).toBe(null)
    expect(themeFromBrief(null)).toBe(null)
    expect(themeFromBrief(undefined)).toBe(null)
    expect(briefColorPalette('Trois plans, rythme rapide.')).toBe('')
  })

  it('emits the grammar `parseColors` was written for, and nothing else', () => {
    expect(briefColorPalette('fond noir, texte blanc')).toBe(
      '## Colors\n\n- Background: #000000\n- Text: #ffffff\n',
    )
  })

  /*
   * The schema is the guarantee, and it is the SAME schema on both sides: a
   * value a DESIGN.md could not state is a value a brief cannot state either.
   */
  it('produces nothing the render schema would refuse', () => {
    for (const brief of [
      'fond noir sur texte blanc',
      'un accent #c0392b',
      'dark green on black',
      'fond crème, carte blanche, accent doré',
    ]) {
      const theme = themeFromBrief(brief)
      if (theme) expect(VideoThemeSchema.safeParse(theme).success).toBe(true)
    }
  })
})

describe('the brief beats the dossier, token by token', () => {
  it('overrides only what it states', () => {
    const { theme, fromBrief, fromProject } = mergeFilmTheme(project(), themeFromBrief('fond noir'))
    expect(theme?.colors).toEqual({
      // The brief's.
      background: '#000000',
      // The project's, untouched.
      text: '#1a1a1a',
      accent: '#c0392b',
      surface: '#ffffff',
    })
    // And the typefaces the brief never mentioned are still the project's: a
    // brief that names one colour must not cost every other token.
    expect(theme?.fonts).toEqual({ heading: 'Cormorant Garamond', body: 'Instrument Sans' })
    expect(fromBrief).toEqual(['background'])
    expect(fromProject).toBe(true)
  })

  it('leaves the dossier alone when the brief states no colour', () => {
    const { theme, fromBrief } = mergeFilmTheme(project(), themeFromBrief('Trois plans, ton sobre.'))
    expect(theme).toEqual(project())
    expect(fromBrief).toEqual([])
  })

  it('works with no dossier at all', () => {
    const { theme, fromBrief, fromProject } = mergeFilmTheme(null, themeFromBrief('fond noir, texte blanc'))
    expect(theme?.colors).toEqual({ background: '#000000', text: '#ffffff' })
    expect(fromBrief).toEqual(['background', 'text'])
    expect(fromProject).toBe(false)
  })

  it('is null when neither side states anything, and never `{}`', () => {
    expect(mergeFilmTheme(null, null)).toEqual({ theme: null, fromBrief: [], fromProject: false })
  })

  /*
   * The distinction this whole module turns on. A colour NOBODY declared still
   * reaches nothing — `parseDesignSystem` invents a surface, a muted and a
   * border so a style sheet always renders, and none of them is in the theme.
   */
  it('never carries a colour the dossier only inferred', () => {
    const quiet = themeFromDesign('# Design System\n\n## Color tokens\n- Accent: #c0392b\n')
    const { theme } = mergeFilmTheme(quiet, themeFromBrief('fond noir'))
    expect(theme?.colors).toEqual({ accent: '#c0392b', background: '#000000' })
  })

  /*
   * The rule this whole path had to leave standing, restated where the second
   * source lives: a colour the MODEL wrote is still refused, and the new door is
   * not a door into the timeline at all — a brief's theme goes where a dossier's
   * theme goes, onto `RenderTimelineSchema`, server-side, after validation.
   */
  it('changes nothing about a theme a model wrote — that is still refused', () => {
    const composed = {
      scenes: [{ imageId: 'a'.repeat(64), durationMs: 3000 }],
      theme: mergeFilmTheme(project(), themeFromBrief('fond noir')).theme,
    }
    const res = VideoTimelineSchema.safeParse(composed)
    expect(res.success).toBe(false)
    if (!res.success) expect(JSON.stringify(res.error.issues)).toContain('theme')
  })
})
