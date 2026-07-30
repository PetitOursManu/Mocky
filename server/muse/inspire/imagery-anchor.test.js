import { describe, it, expect } from 'vitest'
import { anchorImageryToRequest, ensureHeroImagery } from './dossier.js'

/**
 * Regression: "a SaaS pricing page with three tiers and a monthly/yearly toggle"
 * matched the "Swiss / International" art-direction pattern, and the model
 * produced an image prompt for a Swiss WATCH DIAL. The hero on the canvas was a
 * wristwatch on a pricing page, and nothing anywhere reported a problem.
 *
 * The pattern names a typographic style. It is never the subject.
 */

const REQUEST = 'A SaaS pricing page with three tiers and a monthly/yearly toggle'

describe('anchorImageryToRequest', () => {
  it('rewrites a prompt that drifted onto the style name', () => {
    const d = {
      imageryPlan: [
        {
          id: 'hero',
          subject: 'Swiss mechanical watch dial',
          style: 'macro product photography',
          prompt: 'close-up of a Swiss mechanical watch dial, macro product photography, high quality, no text, no watermark',
        },
      ],
    }
    anchorImageryToRequest(d, { prompt: REQUEST })

    const slot = d.imageryPlan[0]
    expect(slot.driftCorrected).toBe(true)
    expect(slot.subject).toBe(REQUEST)
    expect(slot.prompt).toContain('SaaS')
    expect(slot.prompt).not.toMatch(/watch/i)
    // The look the model chose is kept — only the subject is corrected.
    expect(slot.prompt).toContain('macro product photography')
  })

  it('leaves a prompt that does mention the subject alone', () => {
    const prompt = 'a small SaaS team reviewing pricing tiers on a whiteboard, editorial photography, high quality, no text, no watermark'
    const d = { imageryPlan: [{ id: 'hero', prompt }] }
    anchorImageryToRequest(d, { prompt: REQUEST })
    expect(d.imageryPlan[0].prompt).toBe(prompt)
    expect(d.imageryPlan[0].driftCorrected).toBeUndefined()
  })

  it('matches on the subject field when the prompt paraphrases it', () => {
    const d = {
      imageryPlan: [{ id: 'hero', subject: 'SaaS workspace', prompt: 'an open laptop on a desk at dawn' }],
    }
    anchorImageryToRequest(d, { prompt: REQUEST })
    expect(d.imageryPlan[0].driftCorrected).toBeUndefined()
  })

  it('ignores filler words, so "page" alone is not a match', () => {
    // "page" is in both strings but carries no subject meaning — treating it as
    // a match would let almost any drifted prompt through.
    const d = { imageryPlan: [{ id: 'hero', prompt: 'a page of an old book, warm light' }] }
    anchorImageryToRequest(d, { prompt: REQUEST })
    expect(d.imageryPlan[0].driftCorrected).toBe(true)
  })

  it('works on a French request', () => {
    const d = { imageryPlan: [{ id: 'hero', prompt: 'a Swiss chalet in the snow' }] }
    anchorImageryToRequest(d, { prompt: 'une page de tarifs pour une boulangerie lyonnaise' })
    expect(d.imageryPlan[0].driftCorrected).toBe(true)
    expect(d.imageryPlan[0].prompt).toContain('boulangerie')
  })

  it('corrects every slot, not just the hero', () => {
    const d = {
      imageryPlan: [
        { id: 'hero', prompt: 'a SaaS dashboard team at work' },
        { id: 'aside', prompt: 'a Swiss railway clock on a wall' },
      ],
    }
    anchorImageryToRequest(d, { prompt: REQUEST })
    expect(d.imageryPlan[0].driftCorrected).toBeUndefined()
    expect(d.imageryPlan[1].driftCorrected).toBe(true)
  })

  it('does nothing without a request, and never throws on junk', () => {
    const d = { imageryPlan: [{ id: 'hero', prompt: 'anything' }] }
    expect(() => anchorImageryToRequest(d, {})).not.toThrow()
    expect(d.imageryPlan[0].driftCorrected).toBeUndefined()
    expect(() => anchorImageryToRequest({ imageryPlan: [null, 3, 'x'] }, { prompt: REQUEST })).not.toThrow()
    expect(() => anchorImageryToRequest({}, { prompt: REQUEST })).not.toThrow()
  })
})

describe('ensureHeroImagery', () => {
  it('synthesises a hero anchored on the request when the plan is empty', () => {
    const d = ensureHeroImagery({ imageryPlan: [] }, { prompt: REQUEST })
    expect(d.imageryPlan).toHaveLength(1)
    expect(d.imageryPlan[0].prompt).toContain('SaaS')
  })

  it('also anchors a plan the model did provide', () => {
    const d = ensureHeroImagery(
      { imageryPlan: [{ id: 'hero', prompt: 'a Swiss watch dial' }] },
      { prompt: REQUEST },
    )
    expect(d.imageryPlan[0].driftCorrected).toBe(true)
  })
})
