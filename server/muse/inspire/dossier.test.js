import { describe, it, expect, vi } from 'vitest'
import { buildDossier, buildFallbackDossier, dossierToMarkdown } from './dossier.js'
// The DESIGN.md bridge: the SAME parser the app + Vite export use. If the
// dossier's Tokens section ever drifts from DESIGN.md format, this breaks.
import { parseDesignSystem } from '../../../src/lib/designTokens'

const PATTERN = {
  id: 'x',
  name: 'Test Pattern',
  description: 'a distinctive direction',
  imageryStyle: 'clean editorial photography',
  tokenSeeds: {
    colors: [
      { label: 'Background', hex: '#0f172a' },
      { label: 'Surface', hex: '#1e293b' },
      { label: 'Text', hex: '#e2e8f0' },
      { label: 'Muted', hex: '#94a3b8' },
      { label: 'Accent', hex: '#4f46e5' },
      { label: 'Border', hex: '#334155' },
    ],
    radius: 'rounded-xl',
  },
}

const LLM_DOSSIER = {
  concept: 'A warm, editorial identity for a Lyon bakery.',
  references: [{ sourceUrl: 'https://awwwards.test/x', note: 'palette + serif display' }],
  tokens: {
    colors: [
      { label: 'Background', hex: '#faf7f2', role: 'bg' },
      { label: 'Accent', hex: '#b23a2e', role: 'accent' },
      { label: 'Text', hex: '#1a1a1a', role: 'text' },
    ],
    typography: { display: 'Playfair', body: 'Inter', scaleFeel: 'airy' },
    radius: 'rounded-md',
  },
  layoutGrammar: ['oversized serif hero'],
  motionLanguage: [{ name: 'Reveal', description: 'fade + rise' }],
  voice: {
    tone: 'warm',
    headline: 'Le pain, chaque matin',
    subheadline: 'Boulangerie artisanale à Lyon',
    valueProps: ['Farine locale', 'Cuisson au feu de bois', 'Ouvert dès 6h'],
    ctaLabels: ['Découvrir', 'Nous trouver'],
    footer: '© Boulangerie',
  },
  imageryPlan: [{ id: 'hero', slot: 'hero', subject: 'bakery storefront', prompt: 'bakery, warm light, high quality, no text, no watermark' }],
  forbidden: ['generic gradients'],
}

describe('buildDossier (LLM path)', () => {
  it('validates the model output and merges the blacklist + card avoids', async () => {
    const llm = vi.fn(async () => LLM_DOSSIER)
    const dossier = await buildDossier(llm, {
      prompt: 'bakery in Lyon',
      cards: [{ avoid: ['fake team stock photo'] }],
      patternHints: [PATTERN],
      blacklist: ['Lorem ipsum'],
    })
    expect(dossier.__source).toBe('llm')
    expect(dossier.concept).toMatch(/Lyon/)
    expect(dossier.voice.valueProps).toHaveLength(3)
    expect(dossier.forbidden).toEqual(expect.arrayContaining(['generic gradients', 'Lorem ipsum', 'fake team stock photo']))
  })

  it('tolerates real model key/shape drift (voiceCopy, tokens.palette, object ctaLabels, clichés…)', async () => {
    // The EXACT drift gpt-oss:120b produced live that used to strip fields and/or
    // force the fallback. It must now validate AND keep every field (source: 'llm').
    const drifted = {
      concept: 'Warm editorial bakery identity',
      references: { sourceUrl: 'https://x.test', note: 'palette' }, // object, not array
      tokens: {
        palette: [ // `palette`, not `colors`
          { label: 'background', hex: '#f6f0e8' },
          { label: 'accent', hex: '#c2703d' },
          { label: 'text', hex: '#3d3428' },
        ],
        radius: { card: 'rounded-xl', button: 'rounded-lg' }, // object, not string
      },
      motionLanguage: ['gentle fade on scroll'], // strings, not {name}
      voiceCopy: { // `voiceCopy`, not `voice`
        headline: 'Le goût du vrai pain',
        subheadline: 'Recettes familiales',
        valueProps: ['Pain au levain', 'Pâtisseries du jour', 'Livraison à vélo'],
        ctaLabels: { primary: 'Voir le menu', secondary: 'Commander' }, // object, not array
        footerLine: '© 2026 Boulangerie', // `footerLine`, not `footer`
      },
      imageryPlan: [{ slot: 'hero', prompt: 'bakery, high quality, no text, no watermark' }], // no id
      'clichés': ['generic gradients'], // `clichés`, not `forbidden`
    }
    const dossier = await buildDossier(vi.fn(async () => drifted), { prompt: 'bakery', patternHints: [PATTERN], blacklist: ['Lorem ipsum'] })
    expect(dossier.__source).toBe('llm') // used, not fallback
    expect(dossier.tokens.radius).toBe('rounded-xl')
    expect(dossier.tokens.colors.map((c) => c.hex)).toContain('#c2703d') // palette → colors
    expect(dossier.references[0].sourceUrl).toBe('https://x.test')
    expect(dossier.imageryPlan[0].id).toBe('hero') // synthesized from slot
    expect(dossier.motionLanguage[0].name).toMatch(/fade/)
    expect(dossier.voice.headline).toBe('Le goût du vrai pain') // voiceCopy → voice
    expect(dossier.voice.valueProps).toHaveLength(3)
    expect(dossier.voice.ctaLabels).toEqual(['Voir le menu', 'Commander']) // object → array
    expect(dossier.voice.footer).toMatch(/Boulangerie/) // footerLine → footer
    expect(dossier.forbidden).toEqual(expect.arrayContaining(['generic gradients', 'Lorem ipsum'])) // clichés merged
  })

  it('falls back to a pattern dossier when the LLM throws (M3)', async () => {
    const notices = []
    const llm = vi.fn(async () => { throw new Error('model down') })
    const dossier = await buildDossier(llm, { prompt: 'bakery', patternHints: [PATTERN], blacklist: [] }, { onNotice: (m) => notices.push(m) })
    expect(dossier.__source).toBe('fallback')
    expect(notices.join(' ')).toMatch(/fallback/i)
  })
})

describe('buildFallbackDossier (offline / no key)', () => {
  it('builds a valid dossier from the top pattern with real (non-lorem) copy', () => {
    const dossier = buildFallbackDossier({ prompt: 'artisan bakery', patternHints: [PATTERN], blacklist: ['Lorem ipsum'], cards: [{ avoid: ['stock photo'] }] })
    expect(dossier.__source).toBe('fallback')
    expect(dossier.tokens.colors).toHaveLength(6)
    expect(dossier.voice.headline.toLowerCase()).toContain('artisan bakery')
    // The visible COPY must never be lorem ("lorem ipsum" legitimately appears
    // in the forbidden/negative anti-slop directions, so check voice only).
    expect(JSON.stringify(dossier.voice).toLowerCase()).not.toContain('lorem ipsum')
    expect(dossier.forbidden).toEqual(expect.arrayContaining(['Lorem ipsum', 'stock photo']))
    expect(dossier.imageryPlan[0].prompt).toMatch(/no text, no watermark/)
  })
})

describe('dossierToMarkdown + DESIGN.md bridge', () => {
  it('renders all sections', () => {
    const md = dossierToMarkdown(buildFallbackDossier({ prompt: 'bakery', patternHints: [PATTERN], blacklist: ['Lorem ipsum'] }), { projectName: 'Boul' })
    expect(md).toMatch(/# Design Dossier — Boul/)
    for (const h of ['## Concept', '## Tokens', '### Colors', '## Voice & Copy', '## Imagery Plan', '## Forbidden']) {
      expect(md).toContain(h)
    }
  })

  it('emits a Tokens section the real DESIGN.md parser consumes (regression)', () => {
    const dossier = buildFallbackDossier({ prompt: 'bakery', patternHints: [PATTERN], blacklist: [] })
    const md = dossierToMarkdown(dossier)
    const ds = parseDesignSystem(md)
    expect(ds.roles.bg).toBe('#0f172a')
    expect(ds.roles.surface).toBe('#1e293b')
    expect(ds.roles.text).toBe('#e2e8f0')
    expect(ds.roles.accent).toBe('#4f46e5')
    expect(ds.roles.border).toBe('#334155')
    expect(ds.radius).toBe('14px') // rounded-xl → 14px via the token bridge
    expect(ds.colors.length).toBeGreaterThanOrEqual(6)
  })
})
