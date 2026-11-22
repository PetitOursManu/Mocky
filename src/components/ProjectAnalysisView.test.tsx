import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ProjectAnalysisView from './ProjectAnalysisView'
import { partsFr } from '../i18n/parts'
import type { Project, Screen } from '../lib/project'
import type { AnalysisGrid, AnalysisRun } from '../lib/projectAnalysis'

const screen = (id: string, name: string): Screen => ({ id, name, prompt: '', code: 'function A(){}', componentName: 'A', createdAt: 0 }) as Screen

const grid: AnalysisGrid = {
  version: 1,
  lang: 'fr',
  goal: 'Remplir la salle le 14 juin',
  by: 'muse',
  criteria: [
    { id: 'clarity', scope: 'screen', label: 'Clarté de l’offre', question: 'Q ?', levels: ['a', 'b', 'c', 'd', 'e'] },
    { id: 'coherence', scope: 'project', label: 'Cohérence', question: 'Q ?', levels: ['a', 'b', 'c', 'd', 'e'] },
  ],
  expected: [
    { id: 'e1', label: 'Prix' },
    { id: 'e2', label: 'Date' },
  ],
  label: { expected: 'Présence des éléments attendus' },
  key: 'k',
}

const run: AnalysisRun = {
  at: Date.UTC(2026, 10, 22),
  gridKey: 'k',
  engines: ['llm'],
  pages: [{ id: 'home', name: 'Accueil', scores: { clarity: { v: 1.2, c: null } } }],
  project: { coherence: { v: 3, c: 0.3 } },
  expected: [
    { id: 'e1', label: 'Prix', found: true, page: 'home', pNone: 0.1, c: 0.9 },
    { id: 'e2', label: 'Date', found: false, page: null, pNone: 0.8, c: 0.6 },
  ],
  overall: 2.1,
  criteria: { clarity: 1.2, coherence: 3, expected: 2 },
  synthesis: {
    by: 'muse',
    strengths: [],
    problems: [{ text: 'L’offre se perd', priority: 'P1', pages: ['home'], criteria: ['clarity'] }],
    actions: [{ text: 'Mettre le prix en tête', priority: 'P1', pages: ['home'], criteria: [] }],
  },
  notices: ['decision-model:busy', 'unknown:code'],
}

const project = (extra: Partial<Project> = {}) => ({ id: 'p', name: 'Festival', createdAt: 0, updatedAt: 0, screens: [], ...extra }) as Project
const render = (p: Project, screens = [screen('home', 'Accueil')]) =>
  renderToStaticMarkup(<ProjectAnalysisView project={p} screens={screens} onSave={() => {}} onSelect={() => {}} />)

describe('ProjectAnalysisView', () => {
  it('asks for the goal and the expected elements the first time', () => {
    const html = render(project())
    expect(html).toContain(partsFr['analysis.goal'])
    expect(html).toContain(partsFr['analysis.expected'])
    expect(html).toContain(partsFr['analysis.run'])
  })

  it('says there is nothing to audit on an empty project', () => {
    expect(render(project(), [])).toContain(partsFr['analysis.noScreens'])
  })

  it('shows the run: two separate lists, the doubts, "not found", the limits', () => {
    const html = render(project({ analysis: { grid, runs: [run] } }))
    expect(html).toContain(partsFr['analysis.rerun'])
    expect(html).toContain(partsFr['analysis.problems'])
    expect(html).toContain(partsFr['analysis.actions'])
    expect(html).toContain('L’offre se perd')
    expect(html).toContain('Mettre le prix en tête')
    // The text model's answer has no confidence, and says so; a low one is "uncertain".
    expect(html).toContain(partsFr['analysis.conf.unmeasured'])
    expect(html).toContain(partsFr['analysis.conf.low'])
    expect(html).toContain(partsFr['analysis.notFound'])
    expect(html).toContain(partsFr['analysis.engineHelp.llm'])
    expect(html).toContain(partsFr['analysis.limit.absence'])
    // A known notice is a sentence; an unknown code is not shown at all.
    expect(html).toContain(partsFr['analysis.notice.decision-model'])
    expect(html).not.toContain('unknown:code')
    expect(html).not.toContain('analysis.notice.')
  })
})
