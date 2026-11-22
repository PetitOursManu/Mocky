import { describe, it, expect } from 'vitest'
import { analysisRequest, confidenceBand, expectedFromProject, MAX_RUNS, readAnalysis, staleness, withRun, type AnalysisGrid, type AnalysisRun } from './projectAnalysis'
import type { Project, Screen } from './project'

const grid = { version: 1, lang: 'fr', goal: 'Remplir la salle', by: 'muse', criteria: [], expected: [], label: { expected: 'x' }, key: 'k1' } as AnalysisGrid
const run = (at: number): AnalysisRun => ({
  at,
  gridKey: 'k1',
  engines: ['jev'],
  pages: [{ id: 's1', name: 'Accueil', scores: {} }],
  project: {},
  expected: [],
  overall: 3,
  synthesis: { by: 'rules', strengths: [], problems: [], actions: [] },
  notices: [],
})
const screen = (id: string, code = 'function A(){}'): Screen => ({ id, name: id, prompt: `p-${id}`, code, componentName: 'A', createdAt: 0 }) as Screen
const project = (extra: Partial<Project> = {}): Project => ({ id: 'p', name: 'Festival', createdAt: 0, updatedAt: 0, screens: [], ...extra }) as Project

describe('the project’s audits', () => {
  it('keep the grid once and the newest runs first, up to MAX_RUNS', () => {
    let a = withRun(undefined, { ...run(1), grid })
    for (let i = 2; i <= MAX_RUNS + 2; i++) a = withRun(a, { ...run(i), grid })
    expect(a.runs).toHaveLength(MAX_RUNS)
    expect(a.runs[0].at).toBe(MAX_RUNS + 2)
    expect('grid' in a.runs[0]).toBe(false)
  })

  it('send the kept grid and the last run, or start over with the campaign’s facts', () => {
    const kept = project({ analysis: withRun(undefined, { ...run(5), grid }), campaign: { brief: '', formats: [], facts: [{ id: 'f', label: 'Date', value: '14 juin' }] } })
    const again = analysisRequest(kept, [screen('s1'), screen('s2', '  ')], { lang: 'fr' })
    expect(again).toMatchObject({ grid: { key: 'k1' }, previous: { at: 5 }, project: { goal: 'Remplir la salle' } })
    expect(again.pages.map((p) => p.id)).toEqual(['s1'])
    const fresh = analysisRequest(kept, [screen('s1')], { lang: 'fr', newGrid: true, expected: ['Prix'] })
    expect(fresh).toMatchObject({ newGrid: true, expected: [{ label: 'Date', detail: '14 juin' }, 'Prix'] })
    expect('previous' in fresh).toBe(false)
  })

  it('read a stored record defensively', () => {
    expect(readAnalysis({ grid: {}, runs: [] })).toBeUndefined()
    expect(readAnalysis({ grid, runs: [run(1), null, { at: 'x' }] })?.runs).toHaveLength(1)
  })

  it('say when the pages moved since a run', () => {
    expect(staleness(run(1), [screen('s1')])).toEqual({ removed: 0, added: 0 })
    expect(staleness(run(1), [screen('s2')])).toEqual({ removed: 1, added: 1 })
  })

  it('read a missing confidence as unmeasured, never as certain', () => {
    expect(confidenceBand(null)).toBe('unmeasured')
    expect(confidenceBand(0.3)).toBe('low')
    expect(confidenceBand(0.9)).toBe('high')
    expect(expectedFromProject({})).toEqual([])
  })
})
