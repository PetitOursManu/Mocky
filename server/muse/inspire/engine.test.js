import { describe, it, expect, vi } from 'vitest'
import { runInspiration } from './engine.js'
import { createPatternLibrary } from '../prompt-patterns/index.js'

const patterns = createPatternLibrary()
const blacklist = ['Lorem ipsum', 'purple gradients']

// Fake fetcher returning canned "fetched pages".
function fakeFetcher(pages) {
  return { fetch: vi.fn(async () => pages) }
}

const CARD = {
  styleAdjectives: ['editorial'],
  palette: [{ hex: '#b23a2e', role: 'accent' }],
  layoutGrammar: ['serif hero'],
  contentTone: 'warm',
  avoid: ['stock photos'],
}
const DOSSIER = {
  concept: 'Editorial bakery identity',
  tokens: { colors: [{ label: 'Accent', hex: '#b23a2e' }], radius: 'rounded-md' },
  layoutGrammar: ['serif hero'],
  voice: { headline: 'Le pain', valueProps: ['a', 'b', 'c'], ctaLabels: ['Go'] },
  imageryPlan: [{ id: 'hero', prompt: 'bakery, high quality, no text, no watermark' }],
  forbidden: [],
}

describe('runInspiration', () => {
  it('runs the full pipeline (discover → distill → dossier) with progress', async () => {
    const progress = []
    // llm returns a card first (distill), then the dossier.
    const llm = vi.fn().mockResolvedValueOnce(CARD).mockResolvedValueOnce(DOSSIER)
    const res = await runInspiration(
      { prompt: 'artisan bakery landing page', urls: ['https://x.test/board'], useFetch: true },
      { fetcher: fakeFetcher([{ url: 'https://x.test/board', markdown: 'page text' }]), llm, patterns, blacklist, onProgress: (p) => progress.push(p) },
    )
    expect(res.cards).toHaveLength(1)
    expect(res.dossier.__source).toBe('llm')
    expect(res.markdown).toContain('## Tokens')
    expect(progress).toEqual(expect.arrayContaining(['discovering', 'distilling', 'dossier', 'done']))
    // forbidden merged blacklist + the card's avoid list
    expect(res.dossier.forbidden).toEqual(expect.arrayContaining(['Lorem ipsum', 'stock photos']))
  })

  it('works OFFLINE (no fetcher, no llm) via the pattern fallback', async () => {
    const res = await runInspiration(
      { prompt: 'a warm restaurant landing page', useFetch: false },
      { patterns, blacklist, llm: null },
    )
    expect(res.dossier.__source).toBe('fallback')
    expect(res.cards).toEqual([])
    expect(res.markdown).toContain('## Voice & Copy')
    expect(res.patterns.length).toBeGreaterThan(0) // matched pattern names returned
  })

  it('skips fetching when useFetch is false even if a fetcher exists', async () => {
    const fetcher = fakeFetcher([])
    const res = await runInspiration({ prompt: 'saas dashboard', useFetch: false }, { fetcher, patterns, blacklist, llm: null })
    expect(fetcher.fetch).not.toHaveBeenCalled()
    expect(res.dossier).toBeTruthy()
  })

  it('still builds a dossier when fetching yields nothing', async () => {
    const llm = vi.fn().mockResolvedValueOnce(DOSSIER) // only the dossier call (no cards to distill)
    const res = await runInspiration(
      { prompt: 'bakery', useFetch: true },
      { fetcher: fakeFetcher([]), llm, patterns, blacklist },
    )
    expect(res.cards).toEqual([])
    expect(res.dossier.concept).toBeTruthy()
  })
})
