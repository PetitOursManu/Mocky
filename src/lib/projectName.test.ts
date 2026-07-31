import { describe, it, expect } from 'vitest'
import { deriveProjectName, headline, DEFAULT_PROJECT_NAME } from './project'

describe('headline', () => {
  it('drops the markup a pasted brief leaves in a project name', () => {
    // What the front page actually led with.
    expect(headline('<reference-prompt> # Summary A futuristic dashboard')).toBe(
      'Summary A futuristic dashboard',
    )
    expect(headline('</reference-prompt>')).toBe('</reference-prompt>')
  })

  it('strips markdown lead-ins and collapses whitespace', () => {
    expect(headline('## Loupy   v1 ?')).toBe('Loupy v1 ?')
    expect(headline('  - Mobile login screen\n\nwith email')).toBe('Mobile login screen with email')
  })

  it('leaves an ordinary name exactly as it is', () => {
    expect(headline('Boulangerie artisanale à Lyon')).toBe('Boulangerie artisanale à Lyon')
    expect(headline('SaaS pricing page with three tiers')).toBe('SaaS pricing page with three tiers')
  })

  it('never returns an empty headline', () => {
    // Stripping everything would leave a blank row on the front page; the raw
    // name is worse-looking but honest.
    expect(headline('<div></div>')).toBe('<div></div>')
    expect(headline('###')).toBe('###')
  })
})

describe('deriveProjectName', () => {
  it('keeps the subject and drops the "<kind> pour/for" preamble', () => {
    expect(deriveProjectName("Page d'accueil pour une boulangerie artisanale à Lyon")).toBe(
      'Boulangerie artisanale à Lyon',
    )
    expect(deriveProjectName('A landing page for an artisan bakery')).toBe('Artisan bakery')
    // "écran de" is boilerplate too — the subject alone makes the better title.
    expect(deriveProjectName('Un écran de connexion mobile')).toBe('Connexion mobile')
  })

  it('capitalises and strips trailing punctuation', () => {
    expect(deriveProjectName('tableau de bord analytics.')).toBe('Tableau de bord analytics')
  })

  it('cuts long prompts on a word boundary, never mid-word', () => {
    const name = deriveProjectName(
      'Un site immobilier présentant les écoles, les temps de trajet et le marché du quartier',
    )
    expect(name.length).toBeLessThanOrEqual(44)
    expect(name.endsWith('…')).toBe(true)
    expect(name).not.toMatch(/\s…$/) // no dangling space before the ellipsis
    // Every kept word must appear whole in the original prompt (no mid-word
    // cut). Compared lower-case: the first letter is intentionally capitalised.
    const original = 'un site immobilier présentant les écoles, les temps de trajet et le marché du quartier'
    for (const word of name.slice(0, -1).toLowerCase().replace(/,/g, '').split(' ')) {
      expect(original).toContain(word)
    }
  })

  it('falls back to the placeholder for an empty prompt', () => {
    expect(deriveProjectName('')).toBe(DEFAULT_PROJECT_NAME)
    expect(deriveProjectName('   ')).toBe(DEFAULT_PROJECT_NAME)
  })

  it('leaves a short plain subject untouched apart from casing', () => {
    expect(deriveProjectName('portfolio photo')).toBe('Portfolio photo')
  })
})
