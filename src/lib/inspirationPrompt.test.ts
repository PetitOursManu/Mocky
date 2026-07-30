import { describe, it, expect } from 'vitest'
import { buildInspirationPrompt, INSPIRATION_NEGATIVE, type MuseDossier } from './muse'

/**
 * An inspiration image used to be generated from the imagery plan's own prompt —
 * the same photographic subject as the hero, only routed to a different model.
 * So "Inspiration" mode handed the model a picture OF THE PRODUCT and asked it
 * to read palette and composition from it, which is why switching the mode on
 * so often changed nothing about the generated screen.
 *
 * A reference plate has no subject. These tests pin that down.
 */

const dossier: MuseDossier = {
  concept: 'A precise, instrument-grade feel; the calm of a well-made tool. Second sentence ignored.',
  tokens: {
    colors: [
      { label: 'ink', hex: '#111111' },
      { label: 'paper', hex: '#F4F1EA' },
      { label: 'signal', hex: '#CCFF00' },
    ],
  },
  imageryPlan: [{ id: 'hero', style: 'high-contrast studio photography', prompt: 'a SaaS team at a whiteboard' }],
}

describe('buildInspirationPrompt', () => {
  const prompt = buildInspirationPrompt(dossier)

  it('carries the dossier palette verbatim, so the model sees the real colours', () => {
    expect(prompt).toContain('#111111')
    expect(prompt).toContain('#F4F1EA')
    expect(prompt).toContain('#CCFF00')
    expect(prompt).toContain('signal')
  })

  it('keeps the art direction but drops the hero subject', () => {
    expect(prompt).toContain('high-contrast studio photography')
    // The whole point: the plate must not become a second hero photo.
    expect(prompt).not.toContain('whiteboard')
    expect(prompt).not.toContain('SaaS team')
  })

  it('uses only the first sentence of the concept, as a mood', () => {
    expect(prompt).toContain('instrument-grade')
    expect(prompt).not.toContain('Second sentence ignored')
  })

  it('says outright that it is a plate and not a scene', () => {
    expect(prompt).toMatch(/mood board plate/i)
    expect(prompt).toMatch(/no people/i)
  })

  it('forbids the fake-UI output an image model produces when asked for a screen', () => {
    // The user got a garbled illustration of three pricing tiers, complete with
    // fake labels — exactly what image generators make of a "UI" request.
    for (const banned of ['no user interface', 'no website', 'no app screen', 'no mockup', 'no text']) {
      expect(prompt.toLowerCase()).toContain(banned)
    }
  })

  it('survives a dossier with no tokens and no imagery plan', () => {
    const bare = buildInspirationPrompt({ concept: '' })
    expect(bare).toContain('art-direction reference plate')
    expect(bare).toContain('restrained, coherent palette')
    expect(() => buildInspirationPrompt({} as MuseDossier)).not.toThrow()
  })

  it('pairs with a negative prompt that repeats the interface ban', () => {
    for (const banned of ['user interface', 'app screen', 'mockup', 'screenshot', 'people'])
      expect(INSPIRATION_NEGATIVE).toContain(banned)
  })
})
