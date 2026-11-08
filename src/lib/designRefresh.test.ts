import { describe, expect, it } from 'vitest'
import { designSyncOf, isDesignFresh, restoreLostSections } from './designRefresh'

const BEFORE = '# Design\n\n## Concept\nUn atelier.\n\n## Color tokens\n- Primary: #111111\n\n## Forbidden\n- pas de dégradé\n'

describe('restoreLostSections', () => {
  it('leaves a complete answer alone', () => {
    const after = '# Design\n\n## Concept\nUn atelier.\n\n## Color tokens\n- Primary: #222222\n\n## Forbidden\n- pas de dégradé'
    expect(restoreLostSections(BEFORE, after)).toBe(after)
  })

  it('puts back what the model dropped, word for word', () => {
    const out = restoreLostSections(BEFORE, '# Design\n\n## Color tokens\n- Primary: #222222')
    expect(out).toContain('- Primary: #222222')
    expect(out).toContain('## Concept\nUn atelier.')
    expect(out).toContain('## Forbidden\n- pas de dégradé')
  })

  it('does not count a heading twice because its case changed', () => {
    const after = '## CONCEPT\nX\n\n## color tokens\nY\n\n## forbidden\nZ'
    expect(restoreLostSections(BEFORE, after)).toBe(after)
  })
})

describe('isDesignFresh', () => {
  const screen = { id: 's1', code: 'function A(){return null}' }
  const sync = designSyncOf(screen, BEFORE)

  it('is fresh for the same screen and the same document', () => {
    expect(isDesignFresh(sync, screen, BEFORE)).toBe(true)
  })

  it('stops being fresh when the code, the screen or the document moves', () => {
    expect(isDesignFresh(sync, { ...screen, code: 'x' }, BEFORE)).toBe(false)
    expect(isDesignFresh(sync, { ...screen, id: 's2' }, BEFORE)).toBe(false)
    expect(isDesignFresh(sync, screen, BEFORE + 'more')).toBe(false)
  })

  it('never says so without a record or a document', () => {
    expect(isDesignFresh(undefined, screen, BEFORE)).toBe(false)
    expect(isDesignFresh(sync, screen, undefined)).toBe(false)
  })
})
