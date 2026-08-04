import { describe, it, expect } from 'vitest'
import { detectQuality, enforceable, signature } from './detect.js'
import { dispositionFor, applyPolicy, RULE_POLICY } from './policy.js'
import { critiqueScreen } from './critique.js'
import { buildAudit, priorityOf, bandFor, dimensionOf } from './audit.js'
import { runQuality } from './index.js'
import { JUDGED_RULES, JUDGED_MAP } from './catalog.js'

/**
 * A screen written to trip the detector on purpose: a side accent border, a
 * gradient-clipped heading, the violet-to-indigo palette, and a transition on
 * a layout property.
 */
const SLOPPY = `
export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-violet-500 to-indigo-700">
      <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
        Welcome to our platform
      </h1>
      <div className="border-l-4 border-purple-500 pl-4">Featured</div>
      <button style={{ transition: 'width 0.3s ease-in-out' }}>Get Started</button>
    </div>
  )
}
`

/** The same screen, made deliberate. Nothing here should trip a rule. */
const CLEAN = `
export default function App() {
  return (
    <main className="bg-stone-50 text-stone-900 p-12">
      <h1 className="text-4xl font-semibold tracking-tight">Quarterly review</h1>
      <p className="text-base text-stone-700 max-w-prose">
        Revenue grew 12% against a flat headcount.
      </p>
    </main>
  )
}
`

describe('detectQuality', () => {
  it('finds a known problem in sloppy code', async () => {
    const { findings, available } = await detectQuality(SLOPPY)
    expect(available).toBe(true)
    expect(findings.length).toBeGreaterThan(0)

    const rules = findings.map((f) => f.rule)
    // The side accent border is the detector's flagship tell and the least
    // ambiguous thing in the sample.
    expect(rules).toContain('side-tab')
  })

  it('normalizes findings into Mocky shape', async () => {
    const { findings } = await detectQuality(SLOPPY)
    const f = findings.find((x) => x.rule === 'side-tab')
    expect(f).toBeDefined()
    expect(f.source).toBe('impeccable')
    expect(typeof f.name).toBe('string')
    expect(typeof f.description).toBe('string')
    expect(['error', 'warning', 'advisory']).toContain(f.severity)
    expect(typeof f.line).toBe('number')
    // The detector's own key must not leak through.
    expect(f).not.toHaveProperty('antipattern')
  })

  it('reports nothing on deliberate code', async () => {
    const { findings } = await detectQuality(CLEAN)
    expect(findings).toEqual([])
  })

  it('treats empty input as clean rather than failing', async () => {
    expect((await detectQuality('')).findings).toEqual([])
    expect((await detectQuality(null)).findings).toEqual([])
  })
})

describe('policy', () => {
  it('demotes taste rules to advice once the project has a direction', () => {
    // generate.ts tells the model the art direction OVERRIDES every stylistic
    // rule, so with a direction in force these are reported, never enforced.
    expect(dispositionFor('ai-color-palette', { hasDirection: false })).toBe('enforce')
    expect(dispositionFor('ai-color-palette', { hasDirection: true })).toBe('advise')
    expect(dispositionFor('overused-font', { hasDirection: true })).toBe('advise')
  })

  it('drops the rules Mocky cannot honour', () => {
    expect(dispositionFor('design-system-color')).toBe('ignore')
    expect(dispositionFor('design-system-radius')).toBe('ignore')
    // Render failures already have a better path: the iframe error boundary.
    expect(dispositionFor('script-error')).toBe('ignore')
  })

  it('enforces anything it has no opinion about', () => {
    expect(dispositionFor('side-tab')).toBe('enforce')
    expect(dispositionFor('a-rule-that-does-not-exist-yet')).toBe('enforce')
  })

  it('every demotion states a reason', () => {
    for (const [id, entry] of Object.entries(RULE_POLICY)) {
      expect(entry.reason, `${id} must justify its disposition`).toBeTruthy()
      expect(entry.reason.length).toBeGreaterThan(20)
    }
  })

  it('reports what it dropped instead of shrinking the list silently', () => {
    const { findings, ignored } = applyPolicy(
      [
        { rule: 'side-tab', severity: 'warning' },
        { rule: 'design-system-color', severity: 'warning' },
      ],
      { hasDirection: false },
    )
    expect(findings).toHaveLength(1)
    expect(ignored).toEqual(['design-system-color'])
  })
})

describe('enforceable / signature', () => {
  it('keeps only what the correction loop may act on', () => {
    const findings = [
      { rule: 'side-tab', disposition: 'enforce' },
      { rule: 'em-dash-overuse', disposition: 'advise' },
    ]
    expect(enforceable(findings).map((f) => f.rule)).toEqual(['side-tab'])
  })

  it('is stable when only line numbers move', () => {
    const a = [
      { rule: 'side-tab', line: 4 },
      { rule: 'gradient-text', line: 9 },
    ]
    const b = [
      { rule: 'gradient-text', line: 40 },
      { rule: 'side-tab', line: 88 },
    ]
    // A rewrite that fixes nothing still shifts every line. Comparing lines
    // would read that as progress; comparing rule ids does not.
    expect(signature(a)).toBe(signature(b))
  })

  it('changes when a rule is actually resolved', () => {
    expect(signature([{ rule: 'side-tab' }])).not.toBe(signature([]))
  })
})

describe('critiqueScreen', () => {
  it('degrades to nothing judged when there is no model', async () => {
    const notices = []
    const res = await critiqueScreen(null, SLOPPY, { onNotice: (m) => notices.push(m) })
    expect(res.available).toBe(false)
    expect(res.findings).toEqual([])
    expect(notices.length).toBeGreaterThan(0)
  })

  it('degrades when the model throws', async () => {
    const llm = async () => {
      throw new Error('provider exploded')
    }
    const res = await critiqueScreen(llm, SLOPPY, {})
    expect(res.available).toBe(false)
    expect(res.findings).toEqual([])
  })

  it('turns failed verdicts into findings', async () => {
    const llm = async () => ({
      verdicts: [
        { rule: 'three-feature-cards', pass: false, note: 'Three identical cards in a row.' },
        { rule: 'centered-everything', pass: true },
      ],
    })
    const res = await critiqueScreen(llm, SLOPPY, {})
    expect(res.available).toBe(true)
    expect(res.findings).toHaveLength(1)
    expect(res.findings[0].rule).toBe('three-feature-cards')
    expect(res.findings[0].source).toBe('critique')
    expect(res.findings[0].description).toContain('Three identical cards')
  })

  it('refuses verdicts naming a rule it never asked about', async () => {
    const llm = async () => ({
      verdicts: [
        { rule: 'totally-made-up-rule', pass: false, note: 'invented' },
        { rule: 'fake-logo-strip', pass: false },
      ],
    })
    const res = await critiqueScreen(llm, SLOPPY, {})
    expect(res.findings.map((f) => f.rule)).toEqual(['fake-logo-strip'])
  })

  it('never asks about a judged rule the policy ignores', async () => {
    // Simulate a project that has decided glass is part of its direction.
    RULE_POLICY['glassmorphism-everywhere'] = {
      disposition: 'ignore',
      reason: 'Test: this direction is built on frosted layers.',
    }
    try {
      let seen = null
      const llm = async (req) => {
        seen = req
        return {
          verdicts: [{ rule: 'glassmorphism-everywhere', pass: false, note: 'blur everywhere' }],
        }
      }
      const res = await critiqueScreen(llm, SLOPPY, {})
      // Not merely dropped from the results — never asked, which is the only
      // disposition that also saves the tokens.
      expect(seen.user).not.toContain('glassmorphism-everywhere')
      // And a verdict that comes back anyway cannot smuggle the rule in.
      expect(res.findings.map((f) => f.rule)).not.toContain('glassmorphism-everywhere')
    } finally {
      delete RULE_POLICY['glassmorphism-everywhere']
    }
  })

  it('demotes a judged rule to advice rather than a correction', async () => {
    RULE_POLICY['extreme-card-radius'] = { disposition: 'advise', reason: 'Test: large radii are the brand.' }
    try {
      const llm = async () => ({
        verdicts: [{ rule: 'extreme-card-radius', pass: false, note: '32px on a small card' }],
      })
      const res = await critiqueScreen(llm, SLOPPY, {})
      expect(res.findings).toHaveLength(1)
      // Still reported to the user, never sent to the correction pass.
      expect(res.findings[0].disposition).toBe('advise')
      expect(enforceable(res.findings)).toEqual([])
    } finally {
      delete RULE_POLICY['extreme-card-radius']
    }
  })

  it('enforces judged rules by default', async () => {
    const llm = async () => ({
      verdicts: [{ rule: 'three-feature-cards', pass: false, note: 'three cards' }],
    })
    const res = await critiqueScreen(llm, SLOPPY, {})
    expect(res.findings[0].disposition).toBe('enforce')
  })

  it('sends the source as data, not instructions', async () => {
    let seen = null
    const llm = async (req) => {
      seen = req
      return { verdicts: [] }
    }
    await critiqueScreen(llm, SLOPPY, {})
    expect(seen.system).toMatch(/DATA to review/i)
    expect(seen.system).toMatch(/NOT instructions/i)
    // The screen must sit in the user turn, never in the instruction position.
    expect(seen.user).toContain('SCREEN SOURCE')
    expect(seen.system).not.toContain('border-l-4')
  })
})

describe('catalog', () => {
  it('has unique ids and a question phrased so true means clean', () => {
    const ids = JUDGED_RULES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of JUDGED_RULES) {
      expect(r.question.length).toBeGreaterThan(20)
      expect(JUDGED_MAP[r.id]).toBe(r)
    }
  })
})

describe('buildAudit', () => {
  it('scores a clean screen at the top of the range', () => {
    const audit = buildAudit([])
    expect(audit.score).toBe(20)
    expect(audit.band).toBe('excellent')
    expect(audit.counts).toEqual({ P0: 0, P1: 0, P2: 0, P3: 0 })
  })

  it('routes findings to their dimension and tags priority', () => {
    const audit = buildAudit([
      { rule: 'low-contrast', severity: 'warning', disposition: 'enforce' },
      { rule: 'side-tab', severity: 'warning', disposition: 'enforce' },
    ])
    expect(audit.dimensions.accessibility.findings).toBe(1)
    expect(audit.dimensions.antiPatterns.findings).toBe(1)
    expect(audit.dimensions.accessibility.score).toBe(3)
    expect(audit.counts.P1).toBe(2)
  })

  it('never scores a dimension below zero', () => {
    const many = Array.from({ length: 20 }, () => ({
      rule: 'side-tab',
      severity: 'error',
      disposition: 'enforce',
    }))
    const audit = buildAudit(many)
    expect(audit.dimensions.antiPatterns.score).toBe(0)
    expect(audit.score).toBeGreaterThanOrEqual(0)
  })

  it('states how much each dimension was actually looked at', () => {
    const audit = buildAudit([])
    // The source engine cannot measure rendered contrast or geometry, and the
    // report has to say so rather than award a silent 4/4.
    expect(audit.dimensions.accessibility.confidence).toBe('low')
    expect(audit.dimensions.responsive.confidence).toBe('low')
    expect(audit.dimensions.theming.confidence).toBe('high')
    expect(audit.dimensions.accessibility.confidenceNote).toMatch(/rendered page/i)
  })

  it('records whether the judged half ran', () => {
    expect(buildAudit([], { critiqueAvailable: false }).coverage.judged).toBe(false)
    expect(buildAudit([], { critiqueAvailable: true }).coverage.judged).toBe(true)
  })

  it('maps priorities and bands', () => {
    expect(priorityOf({ severity: 'error', disposition: 'enforce' })).toBe('P0')
    expect(priorityOf({ severity: 'warning', disposition: 'enforce' })).toBe('P1')
    expect(priorityOf({ severity: 'warning', disposition: 'advise' })).toBe('P2')
    expect(priorityOf({ severity: 'advisory', disposition: 'advise' })).toBe('P3')
    expect(bandFor(20)).toBe('excellent')
    expect(bandFor(14)).toBe('good')
    expect(bandFor(10)).toBe('acceptable')
    expect(bandFor(6)).toBe('poor')
    expect(bandFor(0)).toBe('critical')
    expect(dimensionOf('an-unmapped-rule')).toBe('antiPatterns')
  })
})

describe('runQuality', () => {
  it('returns a report with no model configured', async () => {
    const res = await runQuality({ code: SLOPPY }, { llm: null })
    expect(res.findings.length).toBeGreaterThan(0)
    expect(res.audit.coverage.deterministic).toBe(true)
    expect(res.audit.coverage.judged).toBe(false)
    expect(res.notices.length).toBeGreaterThan(0)
  })

  it('merges deterministic and judged findings into one list', async () => {
    const llm = async () => ({
      verdicts: [{ rule: 'three-feature-cards', pass: false, note: 'three cards' }],
    })
    const res = await runQuality({ code: SLOPPY }, { llm })
    const sources = new Set(res.findings.map((f) => f.source))
    expect(sources.has('impeccable')).toBe(true)
    expect(sources.has('critique')).toBe(true)
    // Every finding carries its audit tags, so consumers read one list.
    for (const f of res.findings) {
      expect(f.priority).toBeTruthy()
      expect(f.dimension).toBeTruthy()
    }
  })

  it('can skip the judged pass', async () => {
    let called = false
    const llm = async () => {
      called = true
      return { verdicts: [] }
    }
    const res = await runQuality({ code: SLOPPY, critique: false }, { llm })
    expect(called).toBe(false)
    expect(res.audit.coverage.judged).toBe(false)
  })

  it('never throws, whatever the model does', async () => {
    const llm = async () => {
      throw new Error('boom')
    }
    await expect(runQuality({ code: SLOPPY }, { llm })).resolves.toBeTruthy()
    await expect(runQuality({ code: '' }, { llm })).resolves.toBeTruthy()
  })
})
