import { describe, it, expect, vi } from 'vitest'
import { refineDistinctiveness } from './distinctiveness.js'

const baseDossier = () => ({
  concept: 'A modern clean professional site',
  tokens: { colors: [{ label: 'Accent', hex: '#4f46e5', role: 'accent' }] },
  voice: { headline: 'Welcome' },
})

describe('refineDistinctiveness', () => {
  it('leaves a distinctive dossier untouched (score > 3, no revise call)', async () => {
    const llm = vi.fn(async () => ({ score: 5, reason: 'very specific' }))
    const d = await refineDistinctiveness(llm, baseDossier(), { prompt: 'x' })
    expect(llm).toHaveBeenCalledTimes(1) // critique only
    expect(d.__distinctiveness).toBe(5)
    expect(d.__revised).toBeUndefined()
    expect(d.concept).toBe('A modern clean professional site')
  })

  it('revises concept + accent once when the score is ≤ 3', async () => {
    const llm = vi.fn()
      .mockResolvedValueOnce({ score: 2, reason: 'generic' })
      .mockResolvedValueOnce({ concept: 'A bold brutalist bakery with oversized type', accentHex: '#e2231a' })
    const d = await refineDistinctiveness(llm, baseDossier(), { prompt: 'bakery' })
    expect(llm).toHaveBeenCalledTimes(2) // critique + revise
    expect(d.__revised).toBe(true)
    expect(d.concept).toMatch(/brutalist/)
    expect(d.tokens.colors[0].hex).toBe('#e2231a') // accent updated
  })

  it('returns the dossier unchanged when no LLM is available', async () => {
    const d0 = baseDossier()
    const d = await refineDistinctiveness(null, d0, { prompt: 'x' })
    expect(d).toBe(d0)
  })

  it('never throws when the LLM fails (best-effort)', async () => {
    const llm = vi.fn(async () => { throw new Error('down') })
    const d = await refineDistinctiveness(llm, baseDossier(), { prompt: 'x' })
    expect(d.concept).toBe('A modern clean professional site') // unchanged
  })

  it('ignores an invalid accent hex from the revise step', async () => {
    const llm = vi.fn()
      .mockResolvedValueOnce({ score: 1 })
      .mockResolvedValueOnce({ concept: 'Sharper concept', accentHex: 'not-a-hex' })
    const d = await refineDistinctiveness(llm, baseDossier(), { prompt: 'x' })
    expect(d.concept).toBe('Sharper concept')
    expect(d.tokens.colors[0].hex).toBe('#4f46e5') // accent left alone
  })
})
