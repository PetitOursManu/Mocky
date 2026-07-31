import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildMusePreamble,
  parseUrls,
  absoluteUrl,
  loadMuseConfig,
  saveMuseConfig,
  defaultMuseConfig,
  runMuseDossier,
  generateSlotImages,
  museAvailable,
} from './muse'

function fakeStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => m.set(k, String(v)),
    removeItem: (k: string) => m.delete(k),
    clear: () => m.clear(),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
  vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } })
})
afterEach(() => vi.unstubAllGlobals())

describe('pure helpers', () => {
  it('parseUrls keeps only http(s) URLs', () => {
    expect(parseUrls('https://a.test\nnot-a-url\n  http://b.test  ')).toEqual(['https://a.test', 'http://b.test'])
  })

  it('absoluteUrl prefixes relative paths with the app origin (M6)', () => {
    expect(absoluteUrl('/api/images/abc')).toBe('http://localhost:5173/api/images/abc')
    expect(absoluteUrl('https://x/y')).toBe('https://x/y')
  })

  it('buildMusePreamble embeds the dossier and (optionally) image slot directives', () => {
    const noImg = buildMusePreamble('# Dossier\n## Tokens')
    expect(noImg).toContain('<DESIGN_DOSSIER>')
    expect(noImg).toContain('## Tokens')
    expect(noImg).not.toMatch(/GENERATED IMAGERY/)

    const withImg = buildMusePreamble('# Dossier', [{ slot: 'hero', id: 'hero', url: 'http://localhost:5173/api/images/abc' }])
    expect(withImg).toMatch(/GENERATED IMAGERY/)
    expect(withImg).toContain('src="http://localhost:5173/api/images/abc"')
  })

  it('in "both" mode the image is BOTH embedded and shown to the model', () => {
    const out = buildMusePreamble(
      '# Dossier',
      [{ slot: 'hero', id: 'hero', url: 'http://localhost:5173/api/images/abc' }],
      'both',
    )
    expect(out).toMatch(/GENERATED IMAGERY/) // embedded…
    expect(out).toContain('src="http://localhost:5173/api/images/abc"')
    expect(out).toMatch(/You can SEE the attached image/) // …and seen
  })

  it('in "inspiration" mode the image is a style reference, never embedded', () => {
    const out = buildMusePreamble(
      '# Dossier',
      [{ slot: 'hero', id: 'hero', url: 'http://localhost:5173/api/images/abc' }],
      'inspiration',
    )
    expect(out).toMatch(/VISUAL REFERENCE/)
    expect(out).toMatch(/ART-DIRECTION ONLY/)
    // The URL must NOT be handed to the model — it would embed it as content.
    expect(out).not.toContain('/api/images/abc')
    expect(out).not.toMatch(/GENERATED IMAGERY/)
  })
})

describe('config', () => {
  it('defaults to disabled', () => {
    expect(loadMuseConfig()).toEqual(defaultMuseConfig())
    expect(defaultMuseConfig().enabled).toBe(false)
  })
  it('round-trips through storage', () => {
    saveMuseConfig({ enabled: true, urls: 'https://x.test', useFetch: true, imageMode: 'inspiration' })
    expect(loadMuseConfig()).toEqual({ enabled: true, urls: 'https://x.test', useFetch: true, imageMode: 'inspiration' })
  })

  it('defaults the image mode to "content" (works without vision)', () => {
    expect(defaultMuseConfig().imageMode).toBe('content')
  })
})

describe('runMuseDossier', () => {
  it('sends provider creds as headers (D7) and the prompt/model in the body', async () => {
    localStorage.setItem('mocky.settings.v1', JSON.stringify({ baseUrl: 'https://ollama.com', apiKey: 'k', model: 'gpt-oss:120b' }))
    let seen: any
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      seen = { url, init, body: JSON.parse(init.body) }
      return { ok: true, status: 200, json: async () => ({ source: 'llm', dossier: {}, markdown: '', cards: [], sources: [], patterns: [], notices: [] }) }
    }))
    const res = await runMuseDossier('bakery in Lyon', { urls: ['https://x.test'], useFetch: true, projectName: 'B' })
    expect(seen.url).toBe('/api/muse/dossier')
    expect(seen.init.headers['x-provider-base']).toBe('https://ollama.com')
    expect(seen.init.headers['authorization']).toBe('Bearer k')
    expect(seen.body).toMatchObject({ prompt: 'bakery in Lyon', model: 'gpt-oss:120b', useFetch: true, urls: ['https://x.test'] })
    expect(res.source).toBe('llm')
  })

  it('throws on an HTTP error', async () => {
    localStorage.setItem('mocky.settings.v1', JSON.stringify({ baseUrl: 'https://ollama.com', apiKey: '', model: 'm' }))
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' })))
    await expect(runMuseDossier('x')).rejects.toThrow(/HTTP 500/)
  })
})

describe('generateSlotImages', () => {
  it('generates up to `max` images and returns absolute URLs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ hash: 'abc', url: '/api/images/abc' }) })))
    const slots = [
      { id: 'hero', slot: 'hero', prompt: 'p1' },
      { id: 'product-1', slot: 'product', prompt: 'p2' },
    ]
    const imgs = await generateSlotImages(slots, 'proj', { max: 1 })
    expect(imgs).toEqual([{ slot: 'hero', id: 'hero', url: 'http://localhost:5173/api/images/abc' }])
  })

  it('skips slots the provider declined and never throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ skipped: true }) })))
    expect(await generateSlotImages([{ id: 'hero', slot: 'hero', prompt: 'p' }], 'proj', { max: 1 })).toEqual([])
  })
})

describe('museAvailable', () => {
  it('is true when the backend responds', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))
    expect(await museAvailable()).toBe(true)
  })
  it('is false when the backend is absent (frontend-only mode)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await museAvailable()).toBe(false)
  })
})

describe('buildMusePreamble — palette fidelity', () => {
  const dossier = {
    concept: 'Instrument-grade clarity.',
    tokens: {
      colors: [
        { label: 'ink', hex: '#111111', role: 'text' },
        { label: 'signal', hex: '#CCFF00', role: 'accent' },
        { label: 'bad', hex: 'not-a-hex' },
      ],
      radius: 'rounded-none',
    },
  }

  it('restates every colour as a class the model can paste', () => {
    // The dossier already lists the hexes, in prose, inside a long markdown
    // block — and the screens still came out indigo-and-slate. Nothing told the
    // model HOW to apply a hex with Tailwind, while the base rules named
    // concrete families, which is a far more actionable instruction.
    const out = buildMusePreamble('# Dossier', [], 'content', dossier)
    expect(out).toContain('bg-[#111111]')
    expect(out).toContain('text-[#CCFF00]')
    expect(out).toContain('border-[#CCFF00]')
    expect(out).toMatch(/NON-NEGOTIABLE/)
  })

  it('drops values that are not real hex colours', () => {
    const out = buildMusePreamble('# Dossier', [], 'content', dossier)
    expect(out).not.toContain('not-a-hex')
  })

  it('carries the radius through, including when it means square', () => {
    const out = buildMusePreamble('# Dossier', [], 'content', dossier)
    expect(out).toContain('rounded-none')
    expect(out).toMatch(/square corners/i)
  })

  it('says nothing about a palette when the dossier has none', () => {
    const out = buildMusePreamble('# Dossier', [], 'content', { concept: '' })
    expect(out).not.toMatch(/NON-NEGOTIABLE/)
  })

  it('still works without a dossier at all — the old call shape', () => {
    expect(() => buildMusePreamble('# Dossier')).not.toThrow()
  })
})
