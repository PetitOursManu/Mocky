import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  checkQuality,
  enforceableFindings,
  findingsSignature,
  findingsToPrompt,
  type QualityFinding,
} from './quality'
import type { Settings } from './settings'

const SETTINGS: Settings = {
  provider: 'ollama-cloud',
  baseUrl: 'https://ollama.com',
  apiKey: 'k',
  model: 'gpt-oss:120b',
  usePlanner: true,
}

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

/** Stub the quality route with a canned server report. */
function stubServer(body: unknown, ok = true) {
  const spy = vi.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch
  globalThis.fetch = spy
  return spy
}

function serverReport(findings: QualityFinding[]) {
  return {
    findings,
    audit: {
      score: 20 - findings.length,
      max: 20,
      band: 'good',
      dimensions: {
        antiPatterns: { score: 4, max: 4, findings: 0, confidence: 'high', confidenceNote: 'n' },
      },
      counts: { P0: 0, P1: findings.length, P2: 0, P3: 0 },
      findings,
      coverage: { deterministic: true, judged: true },
    },
    notices: [],
    ignored: [],
  }
}

const IMPECCABLE_FINDING: QualityFinding = {
  rule: 'side-tab',
  source: 'impeccable',
  name: 'Side-tab accent border',
  description: 'Thick colored border on one side of a card.',
  severity: 'warning',
  category: 'slop',
  disposition: 'enforce',
  line: 12,
  snippet: 'border-l-4',
}

describe('checkQuality', () => {
  it('merges the local placeholder lint with the server findings', async () => {
    stubServer(serverReport([IMPECCABLE_FINDING]))
    const code = 'const t = "Lorem ipsum dolor sit amet"'
    const res = await checkQuality(code, { settings: SETTINGS })

    const rules = res.findings.map((f) => f.rule)
    expect(rules).toContain('lorem-ipsum')
    expect(rules).toContain('side-tab')
    const local = res.findings.find((f) => f.rule === 'lorem-ipsum')!
    expect(local.source).toBe('mocky')
    // Filler text is the one thing the generation prompt promises not to make.
    expect(local.severity).toBe('error')
  })

  it('folds local findings into the score rather than reporting one that ignores them', async () => {
    stubServer(serverReport([]))
    const clean = await checkQuality('const a = 1', { settings: SETTINGS })
    const dirty = await checkQuality('const t = "Lorem ipsum"', { settings: SETTINGS })

    expect(dirty.audit.score).toBeLessThan(clean.audit.score)
    expect(dirty.audit.counts.P0).toBe(1)
  })

  it('still reports local findings when the server half fails', async () => {
    stubServer({ error: 'boom' }, false)
    const res = await checkQuality('const t = "Lorem ipsum"', { settings: SETTINGS })

    expect(res.findings.map((f) => f.rule)).toEqual(['lorem-ipsum'])
    // "Clean" and "not checked" must stay distinguishable.
    expect(res.audit.coverage.deterministic).toBe(false)
    expect(res.notices.length).toBeGreaterThan(0)
  })

  it('never throws when the network throws', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    const res = await checkQuality('const a = 1', { settings: SETTINGS })
    expect(res.findings).toEqual([])
    expect(res.notices.join(' ')).toContain('offline')
  })

  it('stays silent about a cancelled check', async () => {
    globalThis.fetch = vi.fn(async () => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    }) as unknown as typeof fetch
    const res = await checkQuality('const a = 1', { settings: SETTINGS })
    // Cancelling is the user's doing, not a failure worth a banner.
    expect(res.notices).toEqual([])
  })

  it('forwards the provider dialect so non-Ollama targets work', async () => {
    const spy = stubServer(serverReport([]))
    await checkQuality('const a = 1', {
      settings: { ...SETTINGS, provider: 'openrouter', baseUrl: 'https://openrouter.ai/api' },
    })
    const init = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['x-provider-kind']).toBe('openai')
    expect(headers['x-provider-base']).toBe('https://openrouter.ai/api')
  })

  it('passes the direction flag through to the policy', async () => {
    const spy = stubServer(serverReport([]))
    await checkQuality('const a = 1', { settings: SETTINGS, hasDirection: true })
    const init = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string).hasDirection).toBe(true)
  })
})

describe('enforceableFindings', () => {
  it('keeps only what a correction pass may act on', () => {
    const findings: QualityFinding[] = [
      { ...IMPECCABLE_FINDING, disposition: 'enforce' },
      { ...IMPECCABLE_FINDING, rule: 'em-dash-overuse', disposition: 'advise' },
      { ...IMPECCABLE_FINDING, rule: 'no-disposition', disposition: undefined },
    ]
    expect(enforceableFindings(findings).map((f) => f.rule)).toEqual(['side-tab'])
  })
})

describe('findingsSignature', () => {
  it('ignores line movement', () => {
    const a: QualityFinding[] = [{ ...IMPECCABLE_FINDING, line: 4 }]
    const b: QualityFinding[] = [{ ...IMPECCABLE_FINDING, line: 400 }]
    expect(findingsSignature(a)).toBe(findingsSignature(b))
  })

  it('is order-independent and deduplicated', () => {
    const a: QualityFinding[] = [
      { ...IMPECCABLE_FINDING, rule: 'b' },
      { ...IMPECCABLE_FINDING, rule: 'a' },
      { ...IMPECCABLE_FINDING, rule: 'b' },
    ]
    expect(findingsSignature(a)).toBe('a,b')
  })
})

describe('findingsToPrompt', () => {
  it('points at findings that have a line and describes those that do not', () => {
    const block = findingsToPrompt([
      IMPECCABLE_FINDING,
      {
        rule: 'three-feature-cards',
        source: 'critique',
        name: 'Three identical feature cards',
        description: 'Three interchangeable cards in a row.',
        severity: 'warning',
        category: 'slop',
        disposition: 'enforce',
      },
    ])
    expect(block).toContain('[side-tab] (line 12, near `border-l-4`)')
    expect(block).toContain('[three-feature-cards] Three identical feature cards')
    // A judged finding has no line and must not claim one.
    expect(block).not.toContain('[three-feature-cards] (line')
  })
})

describe('findingsToPrompt', () => {
  const base = {
    rule: 'img-alt',
    source: 'mocky' as const,
    severity: 'error' as const,
    category: 'a11y',
    disposition: 'enforce' as const,
  }

  it('resolves audit rule keys to their English instruction', async () => {
    // The audit rules carry i18n keys so the panel can render them in the
    // reader's language. Sent raw, the model gets an identifier and nothing
    // it can act on — least of all that alt="" is the right answer for a
    // decorative image.
    const { findingsToPrompt } = await import('./quality')
    const out = findingsToPrompt([
      { ...base, name: 'audit.rule.imgAlt', description: 'audit.rule.imgAltDesc' },
    ])
    expect(out).not.toContain('audit.rule.')
    expect(out).toContain('Image with no alt text')
    expect(out).toContain('alt=""')
    // The id still leads the line: it is what progress is measured on (Q3).
    expect(out).toContain('[img-alt]')
  })

  it('leaves prose alone', async () => {
    // Quality-pass findings are already sentences, which is why this never
    // came up before the audit rules arrived.
    const { findingsToPrompt } = await import('./quality')
    const out = findingsToPrompt([
      { ...base, rule: 'generic-hero', name: 'Generic hero', description: 'Every landing page opens this way.' },
    ])
    expect(out).toContain('Generic hero: Every landing page opens this way.')
  })
})
