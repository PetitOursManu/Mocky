import { describe, it, expect } from 'vitest'
import iconSource from '../ui/Icon.tsx?raw'
import { composer } from '../i18n/parts/composer'
import { PRESETS } from './presets'
import { normalizeScreen } from './project'
import {
  SCREEN_THEMES,
  SCREEN_THEME_IDS,
  getScreenTheme,
  promptForThemeChange,
  screenThemeBriefLine,
  screenThemeSection,
  projectScreenType,
  themeDocumentPage,
  withScreenTheme,
} from './screenThemes'

describe('the screen-type catalogue', () => {
  it('lists every id once, in the declared order', () => {
    expect(SCREEN_THEMES.map((th) => th.id)).toEqual([...SCREEN_THEME_IDS])
  })

  it('has the two the request named, and enough others to be worth a menu', () => {
    expect(SCREEN_THEME_IDS).toContain('dashboard')
    expect(SCREEN_THEME_IDS).toContain('planning')
    expect(SCREEN_THEMES.length).toBeGreaterThanOrEqual(12)
  })

  /*
   * The picker reads `composer.themes.<id>` by template string, which the
   * i18n parity test cannot see (it only follows `t('literal')`). A type added
   * here without its words would render its key as its label.
   */
  it('names, describes and starts every type in both languages', () => {
    const missing: string[] = []
    for (const { id } of SCREEN_THEMES) {
      for (const suffix of ['', '.desc', '.starter']) {
        const key = `composer.themes.${id}${suffix}`
        for (const [lang, dict] of Object.entries(composer) as [string, Record<string, string>][]) {
          if (!dict[key]?.trim()) missing.push(`${lang}: ${key}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('draws every type with an icon that exists', () => {
    // Read off the icon table itself: the type system already refuses an
    // unknown name, and this says so again for whoever edits the table.
    const unknown = SCREEN_THEMES.filter((th) => !new RegExp(`^\\s+${th.icon}:`, 'm').test(iconSource)).map((th) => th.icon)
    expect(unknown).toEqual([])
  })

  it('gives every type a substantial brief that says what KIND of screen it is', () => {
    for (const th of SCREEN_THEMES) {
      expect(th.brief.length, th.id).toBeGreaterThan(200)
      expect(th.name.trim(), th.id).not.toBe('')
    }
  })

  /*
   * The brief is structure. Look is the direction's: a type that named a colour
   * or a typeface would contradict DESIGN.md and Muse on every screen of that
   * type. Width is the preset's: the brief joins the form-factor hint, and a
   * pixel figure in it would be wrong on two of the three.
   */
  it('keeps look and width out of every brief', () => {
    for (const th of SCREEN_THEMES) {
      expect(th.brief, th.id).not.toMatch(/#[0-9a-f]{3,8}\b/i)
      expect(th.brief, th.id).not.toMatch(/\b(?:font|typeface|serif|sans-serif|gradient|dark mode|light mode)\b/i)
      expect(th.brief, th.id).not.toMatch(/\b\d{3,4}\s?px\b/i)
      expect(th.brief, th.id).not.toMatch(/\b(?:bg|text|border)-[a-z]+-\d{2,3}\b/)
    }
  })
})

describe('withScreenTheme', () => {
  it('returns the form-factor hint unchanged, byte for byte, when no type is chosen', () => {
    for (const p of PRESETS) {
      expect(withScreenTheme(p.hint, null)).toBe(p.hint)
      expect(withScreenTheme(p.hint, undefined)).toBe(p.hint)
      expect(withScreenTheme(p.hint, '')).toBe(p.hint)
    }
    // Regenerate passes hintForDevice(), which is empty off the phone.
    expect(withScreenTheme('', null)).toBe('')
  })

  it('treats an id it does not know (a stored screen from a later version) as none', () => {
    expect(withScreenTheme('HINT', 'hologram')).toBe('HINT')
    expect(getScreenTheme('hologram')).toBeUndefined()
  })

  it('appends the brief after the hint, so the width is read first', () => {
    const out = withScreenTheme('FORMAT: desktop.', 'dashboard')
    const brief = getScreenTheme('dashboard')!.brief
    expect(out.startsWith('FORMAT: desktop.\n\n')).toBe(true)
    expect(out).toContain(brief)
    expect(out).toContain('SCREEN TYPE')
    expect(out).toBe(`FORMAT: desktop.\n\n${screenThemeSection('dashboard')}`)
  })

  it('stands alone when there is no hint to join', () => {
    expect(withScreenTheme('', 'planning')).toBe(screenThemeSection('planning'))
  })

  it('tells the model that the person’s words win over the type', () => {
    expect(screenThemeSection('kanban')).toMatch(/their words win/i)
  })
})

describe('the Flyer, the first DOCUMENT type', () => {
  it('is a document that starts on A4, and the app types are not documents', () => {
    expect(getScreenTheme('flyer')?.document).toEqual({ page: 'a4' })
    expect(themeDocumentPage('flyer')).toBe('a4')
    expect(themeDocumentPage('landing')).toBeUndefined()
    expect(themeDocumentPage(null)).toBeUndefined()
    expect(SCREEN_THEMES.filter((th) => th.document).map((th) => th.id)).toEqual(['flyer'])
  })

  it('is introduced to the model as a printed piece, not a screen', () => {
    expect(screenThemeSection('flyer')).toMatch(/^DOCUMENT TYPE/)
    expect(screenThemeSection('flyer')).toMatch(/their words win/i)
    expect(screenThemeSection('dashboard')).toMatch(/^SCREEN TYPE/)
  })

  /*
   * What the person asked for, clause by clause: a striking one-page piece,
   * colourful and made of shapes, the facts scannable, a call to action that
   * can be printed, and a coupon of real fields only when it is a sign-up.
   */
  it('asks for the flyer the person described', () => {
    const b = getScreenTheme('flyer')!.brief
    expect(b).toMatch(/ONE <Page>/)
    expect(b).toMatch(/recto-verso/)
    expect(b).toMatch(/headline/i)
    expect(b).toMatch(/date, time, place, price/)
    expect(b).toMatch(/QR-code placeholder/)
    expect(b).toMatch(/logo slot/)
    expect(b).toMatch(/COLOURFUL/)
    expect(b).toMatch(/blobs, circles, arcs, waves, stripes/)
    expect(b).toMatch(/hero picture when pictures are supplied/)
    expect(b).toMatch(/safe margin/)
    expect(b).toMatch(/coupon[\s\S]*<Field>s/)
    expect(b).toMatch(/Only when the request implies signing up/)
    // Never a web button: a flyer's call to action is printed.
    expect(b).toMatch(/Never a web button/)
  })

  it('says nothing about a size, which is the page format’s to say', () => {
    const b = getScreenTheme('flyer')!.brief
    expect(b).not.toMatch(/\bA4\b|\bLetter\b|\b\d+\s?px\b|\bmm\b/)
  })

  it('tells Muse it is dressing a printed flyer', () => {
    expect(screenThemeBriefLine('flyer')).toBe('Screen type: printed flyer.')
  })
})

describe('screenThemeBriefLine', () => {
  it('names the type in one line for the Muse dossier, and nothing without a type', () => {
    expect(screenThemeBriefLine('dashboard')).toBe('Screen type: analytics dashboard.')
    expect(screenThemeBriefLine(null)).toBeUndefined()
    expect(screenThemeBriefLine('nope')).toBeUndefined()
  })
})

describe('promptForThemeChange', () => {
  const DASH = 'Un tableau de bord analytique'
  const PLAN = 'Un planning hebdomadaire'

  it('fills an empty field with the chosen type’s starter', () => {
    expect(promptForThemeChange('', undefined, DASH)).toBe(DASH)
    expect(promptForThemeChange('  ', undefined, DASH)).toBe(DASH)
  })

  it('swaps a starter the picker wrote when the type changes', () => {
    expect(promptForThemeChange(DASH, DASH, PLAN)).toBe(PLAN)
  })

  it('empties a picker-written starter when the type is cleared', () => {
    expect(promptForThemeChange(DASH, DASH, undefined)).toBe('')
  })

  it('never replaces words the person typed or edited', () => {
    expect(promptForThemeChange('mon CRM', undefined, DASH)).toBe('mon CRM')
    expect(promptForThemeChange(`${DASH} pour un café`, DASH, PLAN)).toBe(`${DASH} pour un café`)
    expect(promptForThemeChange('mon CRM', DASH, undefined)).toBe('mon CRM')
  })
})

describe('Screen.theme survives a reload', () => {
  // normalizeScreen rebuilds every stored screen field by field; a field it
  // does not name lives for one session and Regenerate forgets the type the
  // next morning.
  it('is kept by normalizeScreen, and absent stays absent', () => {
    expect(normalizeScreen({ id: 's', theme: 'dashboard' }, 0).theme).toBe('dashboard')
    expect(normalizeScreen({ id: 's' }, 0).theme).toBeUndefined()
    expect(normalizeScreen({ id: 's', theme: '' }, 0).theme).toBeUndefined()
    expect(normalizeScreen({ id: 's', theme: 42 as never }, 0).theme).toBeUndefined()
  })
})

describe('projectScreenType', () => {
  it('starts the composer on the type the latest screen was made with, and its page', () => {
    const screens = [
      { createdAt: 1, theme: 'dashboard' },
      { createdAt: 3, theme: 'flyer', page: 'a4-landscape' as const },
      { createdAt: 2, theme: 'pricing' },
    ]
    expect(projectScreenType(screens)).toEqual({ theme: 'flyer', page: 'a4-landscape' })
  })

  it('keeps "no type" when that is what the latest screen was made with', () => {
    expect(projectScreenType([{ createdAt: 1, theme: 'flyer', page: 'a4' as const }, { createdAt: 2 }])).toEqual({ theme: null, page: null })
  })

  it('starts on nothing in an empty project, and ignores a type this build does not know', () => {
    expect(projectScreenType([])).toEqual({ theme: null, page: null })
    expect(projectScreenType([{ createdAt: 1, theme: 'brochure-3d' }])).toEqual({ theme: null, page: null })
  })
})
