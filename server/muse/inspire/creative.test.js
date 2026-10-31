import { describe, it, expect, vi } from 'vitest'
import { refineDistinctiveness } from './distinctiveness.js'
import { buildDossier, dossierTemperature } from './dossier.js'

// Créatif (src/lib/creative.ts) on Muse's side. Normal must ask exactly what it
// asked before, so most of these hold the Normal path still.

describe('Créatif — Muse', () => {
  it('samples the first dossier attempt wider, never the JSON retry', () => {
    expect(dossierTemperature(0, false)).toBe(0.7)
    expect(dossierTemperature(0, true)).toBe(0.9)
    expect(dossierTemperature(1, false)).toBe(0.4)
    expect(dossierTemperature(1, true)).toBe(0.4)
  })

  it('adds its prompt line only in Créatif', async () => {
    const seen = []
    const llm = vi.fn(async (req) => {
      seen.push(req)
      throw new Error('stop')
    })
    await buildDossier(llm, { prompt: 'a bakery', blacklist: [] })
    await buildDossier(llm, { prompt: 'a bakery', blacklist: [], creative: true })
    expect(seen[0].system).not.toMatch(/CREATIVE MODE/)
    expect(seen[0].options.temperature).toBe(0.7)
    const creative = seen.find((r) => /CREATIVE MODE/.test(r.system))
    expect(creative).toBeTruthy()
    expect(creative.options.temperature).toBe(0.9)
  })

  it('revises a 4/5 direction in Créatif, not in Normal', async () => {
    const dossier = () => ({ concept: 'c', tokens: { colors: [] }, voice: {} })
    const normal = vi.fn(async () => ({ score: 4, reason: 'ok' }))
    await refineDistinctiveness(normal, dossier(), { prompt: 'x' })
    expect(normal).toHaveBeenCalledTimes(1)

    const creative = vi.fn()
      .mockResolvedValueOnce({ score: 4, reason: 'ok' })
      .mockResolvedValueOnce({ concept: 'sharper', accentHex: '#e2231a' })
    const d = await refineDistinctiveness(creative, dossier(), { prompt: 'x', creative: true })
    expect(creative).toHaveBeenCalledTimes(2)
    expect(d.concept).toBe('sharper')
  })
})
