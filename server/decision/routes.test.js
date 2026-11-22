import { describe, it, expect, afterEach } from 'vitest'
import express from 'express'
import { createDecisionRouter } from './routes.js'

// The route over real HTTP, with the decision model answered by a fake fetch:
// what reaches TypeSafe, what comes back, and what a free account gets.

let server
afterEach(() => server?.close())

async function start(deps) {
  const app = express()
  app.use(express.json({ limit: '5mb' }))
  app.use('/api', createDecisionRouter(deps))
  await new Promise((r) => (server = app.listen(0, r)))
  return `http://127.0.0.1:${server.address().port}`
}

const TARGET = { id: 'typesafe', baseUrl: 'https://api.typesafe.ai', model: 'jev-latest', apiKey: 'k', inputPricePerToken: 42e-9 }
const pages = [
  { id: 'home', name: 'Accueil', prompt: 'Accueil du festival', code: 'function A(){return <h1>Festival</h1>}' },
  { id: 'tix', name: 'Billets', prompt: 'Billets', code: 'function B(){return <p>5 €</p>}' },
]

/** Answers every System One question: scales at 3, every element on the second page. */
function fakeJev(calls) {
  return async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push({ url, body })
    const answers = {}
    for (const [id, q] of Object.entries(body.questions)) {
      if (q.type === 'score') answers[id] = { type: 'score', score: 3, confidence: 0.9, legend: {}, probabilities: { 3: 1 } }
      if (q.type === 'choice') answers[id] = { type: 'choice', choice: 'p2', confidence: 0.8, probabilities: { p2: 0.8, none: 0.2 } }
    }
    return new Response(JSON.stringify({ model: 'jev-1.14.0', answers, usage: { input_tokens: 500, output_tokens: 10 } }), { status: 200 })
  }
}

describe('POST /api/muse/project-audit', () => {
  it('asks the decision model, page by page and once for the project, and counts its tokens', async () => {
    const calls = []
    const spent = []
    const base = await start({
      resolveTarget: () => null,
      decisionTarget: () => TARGET,
      decisionMeter: () => (u) => spent.push(u),
      fetchImpl: fakeJev(calls),
    })
    const res = await fetch(`${base}/api/muse/project-audit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lang: 'fr', project: { name: 'Festival' }, pages, newGrid: true, expected: [{ label: 'Prix', detail: '5 €' }] }),
    })
    expect(res.status).toBe(200)
    const run = await res.json()
    // Two pages + the project: three calls, each to System One with the key.
    expect(calls).toHaveLength(3)
    expect(calls.every((c) => c.url === 'https://api.typesafe.ai/v1/systemone')).toBe(true)
    expect(run.engines).toEqual(['jev'])
    expect(run.pages.map((p) => p.scores.clarity)).toEqual([{ v: 3, c: 0.9 }, { v: 3, c: 0.9 }])
    expect(run.expected[0]).toMatchObject({ label: 'Prix', found: true, page: 'tix' })
    expect(run.grid.expected[0]).toMatchObject({ label: 'Prix', detail: '5 €' })
    expect(spent).toHaveLength(3)
    // No text model: the grid is the default one and the synthesis the rules'.
    expect(run.grid.by).toBe('default')
    expect(run.synthesis.by).toBe('rules')
  })

  it('answers with no decision model at all, and says nothing could evaluate', async () => {
    const base = await start({ resolveTarget: () => null, decisionTarget: () => null })
    const res = await fetch(`${base}/api/muse/project-audit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lang: 'en', project: { name: 'x' }, pages }),
    })
    const run = await res.json()
    expect(res.status).toBe(200)
    expect(run.overall).toBeNull()
    expect(run.notices).toContain('audit:no-model')
  })

  it('refuses a request with no page', async () => {
    const base = await start({ resolveTarget: () => null, decisionTarget: () => null })
    const res = await fetch(`${base}/api/muse/project-audit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    expect(res.status).toBe(400)
  })
})
