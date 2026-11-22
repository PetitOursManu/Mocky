import { describe, it, expect } from 'vitest'
import { decideVerdicts, explainFailures } from './verdicts.js'
import { critiqueScreen } from '../muse/quality/critique.js'
import { judgeAudit } from '../muse/quality/audit-judge.js'
import { JUDGED_RULES } from '../muse/quality/catalog.js'
import { AUDIT_QUESTIONS } from '../muse/quality/audit-questions.js'

const TARGET = { id: 'typesafe', baseUrl: 'https://api.typesafe.ai', model: 'jev-latest', apiKey: 'k' }
const CODE = 'function App(){ return <main><h1>Tarifs</h1><a href="#">Cliquez ici</a></main> }'

/** System One answering every yes/no as clean, except the ids in `failing`. */
function jev(failing, calls = []) {
  return async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push(body)
    const answers = Object.fromEntries(Object.keys(body.questions).map((id) => [id, { type: 'noul', noul: failing.includes(id) ? 0.1 : 0.95 }]))
    return new Response(JSON.stringify({ model: 'jev-1.14.0', answers, usage: { input_tokens: 10, output_tokens: 1 } }), { status: 200 })
  }
}
const down = async () => new Response('', { status: 503 })

describe('verdicts from the decision model', () => {
  it('asks one yes/no per question, phrased so yes means clean', async () => {
    const calls = []
    const v = await decideVerdicts({ target: TARGET, fetchImpl: jev(['a'], calls) }, { code: CODE, truncated: false, rules: [{ id: 'a', question: 'Is it fine?' }, { id: 'b', question: 'Is it fine?' }] })
    expect(v).toEqual([
      { rule: 'a', pass: false, confidence: expect.closeTo(0.8, 5) },
      { rule: 'b', pass: true, confidence: expect.closeTo(0.9, 5) },
    ])
    expect(calls[0].questions.a).toMatchObject({ type: 'noul', criteria: { true: expect.any(String), false: expect.any(String) } })
    expect(calls[0].state.source).toBe(CODE)
  })

  it('asks the text model about the failures only, and keeps only notes for them', async () => {
    let seen
    const notes = await explainFailures(async (req) => ((seen = req), { notes: [{ rule: 'a', note: 'The <a> says "Cliquez ici".' }, { rule: 'b', note: 'invented' }] }), {
      code: CODE,
      truncated: false,
      failed: [{ id: 'a', question: 'Q?' }],
      role: 'an auditor',
    })
    expect([...notes]).toEqual([['a', 'The <a> says "Cliquez ici".']])
    expect(seen.user).toContain('- a: Q? → NO')
    expect(seen.system).not.toContain(CODE)
  })

  it('costs no text model when nothing failed', async () => {
    let called = false
    const notes = await explainFailures(async () => ((called = true), {}), { code: CODE, truncated: false, failed: [], role: 'x' })
    expect(notes.size).toBe(0)
    expect(called).toBe(false)
  })
})

describe('Polish’s judged rules', () => {
  const failing = JUDGED_RULES[0].id

  it('take the decision model’s verdicts and the text model’s sentence', async () => {
    const llm = async () => ({ notes: [{ rule: failing, note: 'Three identical cards.' }] })
    const r = await critiqueScreen(llm, CODE, { decision: { target: TARGET, fetchImpl: jev([failing]) } })
    expect(r.judgedBy).toBe('decision')
    expect(r.findings.map((f) => [f.rule, f.description])).toEqual([[failing, 'Three identical cards.']])
    expect(r.verdicts.find((v) => v.rule === failing).confidence).toBeCloseTo(0.8, 5)
  })

  it('work with a decision model and no text model at all', async () => {
    const r = await critiqueScreen(null, CODE, { decision: { target: TARGET, fetchImpl: jev([failing]) } })
    expect(r.available).toBe(true)
    expect(r.findings[0].description).toBe(JUDGED_RULES[0].question)
  })

  it('fall back to the text-model pass when the decision model is down, and say so', async () => {
    const notices = []
    const llm = async () => ({ verdicts: [{ rule: failing, pass: false, note: 'seen' }] })
    const r = await critiqueScreen(llm, CODE, { decision: { target: TARGET, fetchImpl: down }, onNotice: (m) => notices.push(m) })
    expect(r.judgedBy).toBe('text')
    expect(r.findings.map((f) => f.rule)).toEqual([failing])
    expect(notices.join(' ')).toContain('decision model did not answer')
  })
})

describe('the SEO / accessibility deep pass', () => {
  const failing = AUDIT_QUESTIONS[0].id

  it('takes the decision model’s verdicts, with the catalogue’s family', async () => {
    const r = await judgeAudit(CODE, { llm: async () => ({ notes: [] }), decision: { target: TARGET, fetchImpl: jev([failing]) } })
    expect(r).toMatchObject({ judged: true, judgedBy: 'decision' })
    expect(r.findings).toEqual([expect.objectContaining({ rule: failing, family: AUDIT_QUESTIONS[0].family, description: '' })])
  })

  it('falls back to the text model when the decision model is down', async () => {
    const r = await judgeAudit(CODE, { llm: async () => ({ verdicts: [{ rule: failing, pass: false, note: 'vague link' }] }), decision: { target: TARGET, fetchImpl: down } })
    expect(r).toMatchObject({ judged: true, judgedBy: 'text' })
    expect(r.notices[0]).toContain('decision model did not answer')
  })

  it('is unchanged with no decision model', async () => {
    const r = await judgeAudit(CODE, { llm: null })
    expect(r).toMatchObject({ judged: false, findings: [] })
  })
})
