import { describe, it, expect } from 'vitest'
import { briefLanguage, composeBrief, needsClarification, screenSummary, projectSummary, THIN_BRIEF_WORDS, SCREEN_TYPES, inferScreenType, inferDevice } from './tools.js'
import { SCREEN_THEME_IDS } from '../../src/lib/screenThemes.ts'
import { PAGE_FORMATS as FORMAT_LIST } from '../../src/lib/pageFormats.ts'
import { PAGE_FORMATS, inferPageFormat } from './screen-types.js'
import { buildGuide, GUIDED_TOOLS } from './guide.js'

describe('the guide for the assistant', () => {
  const guide = buildGuide()

  it('explains every tool and every screen type it may use', () => {
    for (const name of GUIDED_TOOLS) expect(guide, name).toContain(`\`${name}\``)
    for (const id of Object.keys(SCREEN_TYPES)) expect(guide, id).toContain(`\`${id}\``)
  })

  it('says the two things real tests got wrong', () => {
    // A new design went into an unrelated project; a post came back without the
    // picture that was asked for.
    expect(guide).toMatch(/Never\s+choose a project yourself/)
    expect(guide).toMatch(/ALWAYS when the\s+person asks for an image/)
  })
})

describe('the screen type an assistant picks', () => {
  it('offers exactly the composer\'s types (a mirror of SCREEN_THEME_IDS)', () => {
    expect(Object.keys(SCREEN_TYPES).sort()).toEqual([...SCREEN_THEME_IDS].sort())
  })

  it('is read from the request when the assistant did not pass one', () => {
    expect(inferScreenType('Un flyer pour la fête du quartier samedi')).toBe('flyer')
    expect(inferScreenType('Un post Instagram pour annoncer les soldes')).toBe('instagram')
    expect(inferScreenType('Mon CV de développeur')).toBe('resume')
    expect(inferScreenType('Un tableau de bord des ventes')).toBe('dashboard')
    expect(inferScreenType('La page de connexion de mon appli')).toBe('auth')
    expect(inferScreenType('La page d’accueil d’une boulangerie')).toBe('landing')
    // The most specific wins: a flyer for a restaurant is a flyer.
    expect(inferScreenType('Un flyer pour mon restaurant avec le menu du jour')).toBe('flyer')
  })

  it('does not guess from words that mean two things', () => {
    expect(inferScreenType('Un site avec un menu en haut')).toBeNull()
    expect(inferScreenType('Un écran pour signaler un bug (report)')).toBeNull()
  })

  it('reads the device the same way', () => {
    expect(inferDevice('Une appli mobile de covoiturage')).toBe('mobile')
    expect(inferDevice('L’écran d’accueil sur iPhone')).toBe('mobile')
    expect(inferDevice('Une version tablette du catalogue')).toBe('tablet')
    expect(inferDevice('Une landing page')).toBeNull()
  })
})

describe('the questions before a design', () => {
  it('asks when a brief says too little and nothing else says more', () => {
    expect(needsClarification({ brief: 'un site' })).toBe(true)
    expect(needsClarification({ brief: 'a dashboard' })).toBe(true)
  })

  it('does not ask when the person already said enough', () => {
    expect(needsClarification({ brief: 'Une landing page pour une appli de covoiturage entre voisins' })).toBe(false)
    expect(needsClarification({ brief: 'un site', kind: 'page d’accueil' })).toBe(false)
    expect(needsClarification({ brief: 'un site', audience: 'des boulangers' })).toBe(false)
    expect(needsClarification({ brief: 'un site', style: 'chaleureux' })).toBe(false)
    expect(needsClarification({ brief: Array(THIN_BRIEF_WORDS).fill('mot').join(' ') })).toBe(false)
  })

  it('answers in the language the person wrote in', () => {
    expect(briefLanguage('Une page d’accueil pour une boulangerie')).toBe('fr')
    expect(briefLanguage('A home page for a bakery')).toBe('en')
    expect(briefLanguage('Écran de connexion')).toBe('fr')
    // The short ones are the ones that get the questions.
    expect(briefLanguage('un site')).toBe('fr')
    expect(briefLanguage('a site')).toBe('en')
    expect(briefLanguage('landing page')).toBe('en')
    expect(briefLanguage('Le Petit Café website')).toBe('fr')
  })
})

describe('the brief the pipeline receives', () => {
  it('keeps the person’s words first and adds what the assistant learnt', () => {
    expect(composeBrief({ brief: 'Page d’accueil', kind: 'landing', audience: 'voisins', style: 'chaleureux' }, 'fr')).toBe(
      'Page d’accueil\nType d’écran : landing\nPublic : voisins\nStyle : chaleureux',
    )
    expect(composeBrief({ brief: 'Home page' }, 'en')).toBe('Home page')
  })

  it('is bounded', () => {
    expect(composeBrief({ brief: 'x'.repeat(5000) }, 'en').length).toBe(4000)
  })
})

describe('what an assistant sees of a project (X4)', () => {
  const link = (p, s) => `https://m.example/p/${p}${s ? `?screen=${s}` : ''}`

  it('a screen: never its notes, never its code', () => {
    const s = screenSummary(
      { id: 's1', name: 'Accueil', code: 'SECRET CODE', userNotes: [{ text: 'PRIVATE' }], previousCode: 'OLD', prompt: 'Une page', w: 1440, h: 900, device: 'none' },
      'p1',
      link,
    )
    expect(JSON.stringify(s)).not.toMatch(/PRIVATE|SECRET|OLD/)
    expect(s).toMatchObject({ id: 's1', name: 'Accueil', request: 'Une page', link: 'https://m.example/p/p1?screen=s1' })
  })

  it('a project: a count of screens, not the screens', () => {
    const p = projectSummary({ id: 'p1', name: 'Site', screens: [{ id: 's1', userNotes: [{ text: 'PRIVATE' }] }], design: '# secret direction' }, (id) => link(id))
    expect(p).toEqual({ id: 'p1', name: 'Site', screens: 1, folder: undefined, updatedAt: undefined, link: 'https://m.example/p/p1' })
  })
})

describe('page sizes', () => {
  it('offers exactly the composer\'s formats (a mirror of pageFormats.ts)', () => {
    expect(Object.keys(PAGE_FORMATS).sort()).toEqual(FORMAT_LIST.map((f) => f.id).sort())
  })

  it('reads a social size from the request — the 1:1 post that came back 4:5', () => {
    expect(inferPageFormat('Un post Instagram en 1:1 pour la fête de la science')).toBe('social-square')
    expect(inferPageFormat('un visuel carré')).toBe('social-square')
    expect(inferPageFormat('une story Instagram')).toBe('social-story')
    expect(inferPageFormat('format 9:16')).toBe('social-story')
    expect(inferPageFormat('un post 4:5')).toBe('social-portrait')
    expect(inferPageFormat('Un post Instagram pour la fête de la science')).toBeNull()
  })
})
