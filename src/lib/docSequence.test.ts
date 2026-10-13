import { describe, expect, it } from 'vitest'
import { CAROUSEL_PAGES, documentSequenceKind, documentSequenceSection } from './docSequence'

describe('Parcours on a document', () => {
  it('gives a two-sided type a recto and a verso', () => {
    expect(documentSequenceKind('flyer', 'a5')).toBe('recto-verso')
    expect(documentSequenceKind('menu', 'a4')).toBe('recto-verso')
    const s = documentSequenceSection('flyer', 'a5')!
    expect(s).toContain('exactly 2 <Page>s')
    expect(s).toMatch(/1\. RECTO/)
    expect(s).toMatch(/2\. VERSO/)
  })

  it('makes a post a carousel, and a story a sequence of stories', () => {
    expect(documentSequenceKind('instagram', 'social-portrait')).toBe('carousel')
    expect(documentSequenceKind('linkedin', 'social-square')).toBe('carousel')
    expect(documentSequenceKind('instagram', 'social-story')).toBe('stories')
    const s = documentSequenceSection('instagram', 'social-portrait')!
    expect(s).toContain(`write ${CAROUSEL_PAGES} <Page>s`)
    expect(s).toMatch(/unless the request names another number/)
    expect(s).toMatch(/continue on the left edge of the next/)
    expect(documentSequenceSection('instagram', 'social-story')).not.toMatch(/swipe/)
  })

  it('adds nothing where the pages already have their order', () => {
    // A folded leaflet's faces come from its fold.
    expect(documentSequenceSection('flyer', 'a4-landscape', 'roll')).toBeUndefined()
    // A poster has no back; a report runs to several pages by its own brief.
    expect(documentSequenceSection('poster', 'a3')).toBeUndefined()
    expect(documentSequenceSection('report', 'a4')).toBeUndefined()
    expect(documentSequenceSection('magazine', 'a4')).toBeUndefined()
    // Not a document at all.
    expect(documentSequenceSection('landing', null)).toBeUndefined()
    expect(documentSequenceSection('flyer', 'tabloid' as never)).toBeUndefined()
  })
})
