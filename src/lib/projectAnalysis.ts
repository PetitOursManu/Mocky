/**
 * The audit of a whole project (docs/decision-model.md): the browser's half.
 *
 * The server does the work (server/decision/): Muse writes a grid, the decision
 * model — Jev when the administrator set one up, Muse's text model otherwise —
 * answers it page by page, and Muse writes the synthesis. What is HERE is what
 * the project keeps of it: the grid, so the next audit asks the same questions,
 * and the last few runs, so a person can see what their changes moved.
 *
 * On `Project.analysis` and not in the version store, because it is a few
 * kilobytes and belongs to the working copy — a restored version carries the
 * audits it had, as it carries its campaign. The grid is stored ONCE and the
 * runs without it: eight copies of the same thirty lines is the localStorage
 * budget spent on nothing (V3's reason, at a smaller scale).
 */
import type { Project, Screen } from './project'
import { loadSettings, type Settings } from './settings'
import { proxyHeaders } from './proxy'

export const MAX_RUNS = 8

export type Scope = 'screen' | 'project'

export interface AnalysisCriterion {
  id: string
  scope: Scope
  label: string
  question: string
  /** Five levels, worst first. */
  levels: string[]
}

export interface ExpectedElement {
  id: string
  label: string
  detail?: string
}

export interface AnalysisGrid {
  version: number
  lang: 'fr' | 'en'
  goal: string
  /** Tailored by Muse, or the default wording when no model could. */
  by: 'muse' | 'default'
  criteria: AnalysisCriterion[]
  expected: ExpectedElement[]
  label: { expected: string }
  /** What the grid asks, fingerprinted: two runs on one key compare. */
  key: string
}

/** A value on the 0–4 scale, and how sure the model was (null: not measured). */
export interface Score {
  v: number
  c: number | null
}

export interface ExpectedResult {
  id: string
  label: string
  /** true: found on `page`; false: not found; null: not answered. */
  found: boolean | null
  page: string | null
  /** The probability that no page shows it. Not a proof of absence. */
  pNone: number | null
  c: number | null
}

export interface SynthesisItem {
  text: string
  priority?: 'P1' | 'P2' | 'P3'
  pages: string[]
  criteria: string[]
}

export interface Synthesis {
  /** Written by Muse, derived from the scores in fixed words, or nothing to say. */
  by: 'muse' | 'rules' | 'none'
  strengths: SynthesisItem[]
  problems: SynthesisItem[]
  actions: SynthesisItem[]
}

export interface RunDelta {
  comparable: boolean
  at: number | null
  overall?: number | null
  criteria?: Record<string, number>
  nowFound?: string[]
  lost?: string[]
}

export interface AnalysisRun {
  at: number
  gridKey: string
  /** Who answered: the decision model, the text model, or both. */
  engines: Array<'jev' | 'llm'>
  pages: Array<{ id: string; name: string; scores: Record<string, Score> }>
  project: Record<string, Score>
  expected: ExpectedResult[]
  overall: number | null
  criteria?: Record<string, number>
  delta?: RunDelta | null
  synthesis: Synthesis
  notices: string[]
}

export interface ProjectAnalysis {
  grid: AnalysisGrid
  /** Newest first. */
  runs: AnalysisRun[]
}

/** How a confidence reads. `unmeasured` is the text model's: it has none to give. */
export function confidenceBand(c: number | null | undefined): 'high' | 'medium' | 'low' | 'unmeasured' {
  if (c == null) return 'unmeasured'
  return c >= 0.75 ? 'high' : c >= 0.5 ? 'medium' : 'low'
}

/** The elements a project is expected to show, before Muse adds its own: the campaign's facts. */
export function expectedFromProject(project: Pick<Project, 'campaign'>): Array<{ label: string; detail?: string }> {
  return (project.campaign?.facts || [])
    .filter((f) => f.label?.trim())
    .map((f) => ({ label: f.label.trim(), ...(f.value?.trim() ? { detail: f.value.trim() } : {}) }))
}

export interface RunOptions {
  /** The project's direction as the screens follow it (its own, or the global DESIGN.md). */
  direction?: string
  /** Asked for when there is no grid yet, or when `newGrid`. */
  goal?: string
  /** Lines the person added to the expected elements. */
  expected?: string[]
  /** Start over: a new grid, and this run compares with nothing. */
  newGrid?: boolean
  lang: 'fr' | 'en'
  settings?: Settings
  signal?: AbortSignal
}

/** What is sent: the project's words and the pages' code — never notes (I9), never pictures. */
export function analysisRequest(project: Project, screens: Screen[], opts: RunOptions) {
  const kept = project.analysis
  const fresh = opts.newGrid === true || !kept
  return {
    lang: opts.lang,
    project: {
      name: project.name,
      goal: opts.goal ?? kept?.grid.goal ?? '',
      direction: opts.direction || '',
      rules: project.rules || '',
    },
    pages: screens.filter((s) => s.code?.trim()).map((s) => ({ id: s.id, name: s.name, prompt: s.prompt, code: s.code })),
    ...(fresh
      ? { newGrid: true, expected: [...expectedFromProject(project), ...(opts.expected || [])] }
      : { grid: kept!.grid, previous: kept!.runs[0] ? { ...kept!.runs[0] } : undefined }),
  }
}

/** Run an audit. Throws on a refusal; the caller shows it. */
export async function runProjectAnalysis(
  project: Project,
  screens: Screen[],
  opts: RunOptions,
): Promise<AnalysisRun & { grid: AnalysisGrid }> {
  const s = opts.settings ?? loadSettings()
  const res = await fetch('/api/muse/project-audit', {
    method: 'POST',
    headers: proxyHeaders(s),
    body: JSON.stringify({ ...analysisRequest(project, screens, opts), model: s.model }),
    signal: opts.signal,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(typeof body?.error === 'string' ? body.error : `HTTP ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return (await res.json()) as AnalysisRun & { grid: AnalysisGrid }
}

/** The project's record with one more run: the grid replaced, the oldest run dropped. */
export function withRun(previous: ProjectAnalysis | undefined, result: AnalysisRun & { grid: AnalysisGrid }): ProjectAnalysis {
  const { grid, ...run } = result
  return { grid, runs: [run, ...(previous?.runs || [])].slice(0, MAX_RUNS) }
}

/** A stored record made safe to read: anything that is not one is no record at all. */
export function readAnalysis(raw: unknown): ProjectAnalysis | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Partial<ProjectAnalysis>
  if (!r.grid || !Array.isArray(r.grid.criteria) || !Array.isArray(r.runs)) return undefined
  return { grid: r.grid, runs: r.runs.filter((x) => x && typeof x.at === 'number').slice(0, MAX_RUNS) }
}

/** The pages a run scored that no longer exist, or changed since — the run is about older code. */
export function staleness(run: AnalysisRun, screens: Screen[]): { removed: number; added: number } {
  const ids = new Set(run.pages.map((p) => p.id))
  const now = new Set(screens.filter((s) => s.code?.trim()).map((s) => s.id))
  return {
    removed: [...ids].filter((id) => !now.has(id)).length,
    added: [...now].filter((id) => !ids.has(id)).length,
  }
}
