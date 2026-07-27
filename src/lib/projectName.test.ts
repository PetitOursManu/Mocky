import { describe, it, expect } from 'vitest'
import { deriveProjectName, DEFAULT_PROJECT_NAME } from './project'

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
