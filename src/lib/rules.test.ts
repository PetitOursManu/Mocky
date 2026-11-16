import { describe, expect, it } from 'vitest'
import { appendRule, cleanRules, projectRulesSection, ruleList, rulesMuseLine, suggestRule } from './rules'

describe('cleanRules', () => {
  it('keeps one rule per line and nothing else', () => {
    expect(cleanRules('  Assiette   entièrement visible \r\n\n  Aucun visage  ')).toBe('Assiette entièrement visible\nAucun visage')
    expect(cleanRules('  \n ')).toBeUndefined()
    expect(cleanRules(42)).toBeUndefined()
    expect(ruleList(Array.from({ length: 30 }, (_, i) => `r${i}`).join('\n'))).toHaveLength(20)
  })
})

describe('appendRule', () => {
  it('adds a rule at the end, once, whatever its accents and case', () => {
    expect(appendRule(undefined, ' Aucun visage ')).toBe('Aucun visage')
    expect(appendRule('Aucun visage', 'Fond sobre')).toBe('Aucun visage\nFond sobre')
    expect(appendRule('Aucun visage\nFond sobre', 'fond SOBRE.')).toBe('Aucun visage\nFond sobre')
    expect(appendRule('Fond sobre', '   ')).toBe('Fond sobre')
  })
})

describe('suggestRule', () => {
  it('starts from the first sentence of the correction, without the politeness', () => {
    expect(suggestRule("s'il te plaît, montre l'assiette en entier. Et change le titre")).toBe("Montre l'assiette en entier")
    expect(suggestRule('pas de visage sur les photos merci !')).toBe('Pas de visage sur les photos')
    expect(suggestRule('x'.repeat(300))).toHaveLength(160)
  })
})

describe('projectRulesSection', () => {
  it('fences the rules as data and says a request wins', () => {
    const s = projectRulesSection('Aucun visage\nFond sobre')
    expect(s).toContain('<<<RULES\n- Aucun visage\n- Fond sobre\nRULES>>>')
    expect(s).toMatch(/the request wins/)
    expect(projectRulesSection(undefined)).toBe('')
    expect(rulesMuseLine('Aucun visage\nFond sobre')).toBe('Project rules to keep: Aucun visage; Fond sobre.')
    expect(rulesMuseLine('')).toBe('')
  })
})
