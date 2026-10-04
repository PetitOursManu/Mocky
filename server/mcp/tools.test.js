import { describe, it, expect } from 'vitest'
import { briefLanguage, composeBrief, needsClarification, screenSummary, projectSummary, THIN_BRIEF_WORDS } from './tools.js'

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
