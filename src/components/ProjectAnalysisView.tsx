import { useEffect, useRef, useState } from 'react'
import type { Project, Screen } from '../lib/project'
import {
  confidenceBand,
  readAnalysis,
  runProjectAnalysis,
  staleness,
  withRun,
  type AnalysisGrid,
  type AnalysisRun,
  type ProjectAnalysis,
  type Score,
  type SynthesisItem,
} from '../lib/projectAnalysis'
import { Banner, Button, Field, Icon, Spinner, Textarea } from '../ui'
import { getLang, useT } from '../i18n'

/**
 * The audit of a whole project — the "Le projet" tab of the Audit panel.
 *
 * WHY A GRID FIRST
 *
 * A score means something only against a question somebody can read. So the
 * first run asks for the project's goal and the elements it must show, Muse
 * turns those into a grid, and every later run reuses that grid unless the
 * person asks for a new one: "redo the audit after my changes" is only a
 * comparison if the questions did not move.
 *
 * WHAT IT REFUSES TO SAY
 *
 * Observations and recommendations are two lists. A doubt is printed next to
 * the number, never in a tooltip. An element not found is "not found". And the
 * three limits — no rendering read, no proof of absence, no promise of results
 * — sit under the results every time, because they are true every time.
 */
export default function ProjectAnalysisView({
  project,
  screens,
  direction,
  onSave,
  onSelect,
}: {
  project: Project
  screens: Screen[]
  /** The direction the screens follow — the project's own, or the global DESIGN.md. */
  direction?: string
  onSave: (analysis: ProjectAnalysis | undefined) => void
  onSelect: (screenId: string) => void
}) {
  const t = useT()
  const lang = getLang() === 'en' ? 'en' : 'fr'
  const analysis = readAnalysis(project.analysis)
  const grid = analysis?.grid
  const last = analysis?.runs[0]
  const pages = screens.filter((s) => s.code?.trim())

  const [editing, setEditing] = useState(!grid)
  const [goal, setGoal] = useState(grid?.goal ?? '')
  const [expected, setExpected] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ctrl = useRef<AbortController | null>(null)

  // Closing the panel abandons the run: the server stops paying for answers.
  useEffect(() => () => ctrl.current?.abort(), [])

  async function run(fresh: boolean) {
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setRunning(true)
    setError(null)
    try {
      const result = await runProjectAnalysis(project, screens, {
        lang,
        direction,
        goal: fresh ? goal.trim() : undefined,
        expected: fresh ? expected.split('\n').map((l) => l.trim()).filter(Boolean) : undefined,
        newGrid: fresh,
        signal: c.signal,
      })
      if (c.signal.aborted) return
      onSave(withRun(fresh ? undefined : analysis, result))
      setEditing(false)
      setExpected('')
    } catch (err) {
      if (c.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return
      setError(t('analysis.failed', { error: err instanceof Error ? err.message : String(err) }))
    } finally {
      if (ctrl.current === c) {
        ctrl.current = null
        setRunning(false)
      }
    }
  }

  const nameOf = (id: string) => screens.find((s) => s.id === id)?.name ?? run_pageName(last, id) ?? id

  if (!pages.length) return <p className="p-3 text-body-sm text-ink-faint">{t('analysis.noScreens')}</p>

  return (
    <div>
      <div className="border-b border-line-soft p-3">
        <p className="measure text-body-sm text-ink-muted">{t('analysis.intro')}</p>

        {editing ? (
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void run(true)
            }}
          >
            <Field label={t('analysis.goal')} hint={t('analysis.goalHint')}>
              {(p) => (
                <Textarea {...p} rows={2} value={goal} placeholder={t('analysis.goalPlaceholder')} onChange={(e) => setGoal(e.currentTarget.value)} />
              )}
            </Field>
            <Field label={t('analysis.expected')} hint={t('analysis.expectedHint')}>
              {(p) => <Textarea {...p} rows={3} value={expected} onChange={(e) => setExpected(e.currentTarget.value)} />}
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" size="sm" disabled={running}>
                {t('analysis.run')}
              </Button>
              {grid && (
                <Button type="button" variant="ghost" size="sm" disabled={running} onClick={() => setEditing(false)}>
                  {t('analysis.keepGrid')}
                </Button>
              )}
            </div>
          </form>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" size="sm" disabled={running} onClick={() => void run(false)}>
              {t('analysis.rerun')}
            </Button>
            <Button variant="ghost" size="sm" disabled={running} onClick={() => setEditing(true)}>
              {t('analysis.newGrid')}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <Banner tone="danger" className="m-3">
          {error}
        </Banner>
      )}

      {running ? (
        <div className="flex items-center gap-3 p-4 text-body-sm text-ink-muted">
          <Spinner />
          <span>{t('analysis.running', { n: pages.length })}</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => ctrl.current?.abort()}>
            {t('analysis.cancel')}
          </Button>
        </div>
      ) : last && grid ? (
        <RunView run={last} grid={grid} screens={screens} nameOf={nameOf} onSelect={onSelect} />
      ) : null}

      {grid && !running && <GridView grid={grid} />}

      {analysis && analysis.runs.length > 1 && !running && (
        <div className="border-t border-line-soft p-3">
          <div className="kicker mb-2">{t('analysis.history')}</div>
          <ul className="space-y-1 text-body-sm">
            {analysis.runs.slice(1).map((r) => (
              <li key={r.at} className="flex justify-between gap-2 text-ink-muted">
                <span>{formatDate(r.at, lang)}</span>
                <span className="font-mono">{r.overall == null ? '—' : t('analysis.score', { v: fmt(r.overall, lang) })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis && !running && (
        <div className="border-t border-line-soft p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm(t('analysis.forgetConfirm'))) {
                onSave(undefined)
                setEditing(true)
                setGoal('')
              }
            }}
          >
            {t('analysis.forget')}
          </Button>
        </div>
      )}
    </div>
  )
}

function run_pageName(run: AnalysisRun | undefined, id: string): string | undefined {
  return run?.pages.find((p) => p.id === id)?.name
}

const fmt = (n: number, lang: string) => n.toLocaleString(lang, { maximumFractionDigits: 1 })
const formatDate = (at: number, lang: string) =>
  new Date(at).toLocaleDateString(lang, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

function RunView({
  run,
  grid,
  screens,
  nameOf,
  onSelect,
}: {
  run: AnalysisRun
  grid: AnalysisGrid
  screens: Screen[]
  nameOf: (id: string) => string
  onSelect: (id: string) => void
}) {
  const t = useT()
  const lang = getLang()
  const engine = run.engines.length > 1 ? 'mixed' : run.engines[0] === 'jev' ? 'jev' : 'llm'
  const stale = staleness(run, screens)
  const delta = run.delta
  const labelOf = (id: string) => (id === 'expected' ? grid.label.expected : grid.criteria.find((c) => c.id === id)?.label ?? id)
  // A notice is a code (server/decision/); the ones with a page id or a cause
  // after their name share one sentence. A code with no sentence is not shown.
  const noticeKey = (n: string) =>
    n === 'decision-model:auth' ? n : n.startsWith('decision-model:') ? 'decision-model' : n.startsWith('page:failed') ? 'page:failed' : n
  const notices = [...new Set(run.notices.map((n) => t(`analysis.notice.${noticeKey(n)}`)))].filter((x) => !x.startsWith('analysis.notice.'))

  return (
    <div className="p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="kicker">{t('analysis.overall')}</span>
        <span className="font-mono text-heading text-ink">{run.overall == null ? '—' : t('analysis.score', { v: fmt(run.overall, lang) })}</span>
      </div>
      <p className="mt-1 text-caption text-ink-muted">{t('analysis.pagesCount', { n: run.pages.length, date: formatDate(run.at, lang) })}</p>
      {delta && delta.comparable && typeof delta.overall === 'number' && delta.at && (
        <p className={`text-caption ${delta.overall > 0 ? 'text-ok' : delta.overall < 0 ? 'text-warn' : 'text-ink-muted'}`}>
          {t('analysis.deltaSince', { d: signed(delta.overall, lang), date: formatDate(delta.at, lang) })}
        </p>
      )}
      {delta && !delta.comparable && <p className="text-caption text-ink-faint">{t('analysis.notComparable')}</p>}
      <p className="mt-1 text-caption text-ink-faint" title={engine === 'llm' ? t('analysis.engineHelp.llm') : undefined}>
        {t(`analysis.engine.${engine}`)}
      </p>
      {engine === 'llm' && <p className="measure mt-1 text-caption text-ink-faint">{t('analysis.engineHelp.llm')}</p>}
      {(stale.added > 0 || stale.removed > 0) && (
        <Banner tone="warn" className="mt-2">
          {t('analysis.stale')}
        </Banner>
      )}
      {notices.map((n) => (
        <Banner key={n} tone="warn" className="mt-2">
          {n}
        </Banner>
      ))}

      <Items title={t('analysis.problems')} items={run.synthesis.problems} labelOf={labelOf} nameOf={nameOf} onSelect={onSelect} />
      <Items title={t('analysis.actions')} items={run.synthesis.actions} labelOf={labelOf} nameOf={nameOf} onSelect={onSelect} />
      <Items title={t('analysis.strengths')} items={run.synthesis.strengths} labelOf={labelOf} nameOf={nameOf} onSelect={onSelect} />
      {run.synthesis.by === 'rules' && <p className="mt-2 text-caption text-ink-faint">{t('analysis.synthesisRules')}</p>}

      <section className="mt-4">
        <h3 className="kicker mb-2">{t('analysis.criteria')}</h3>
        <ul className="space-y-1.5">
          {[...grid.criteria.map((c) => c.id), 'expected'].map((id) => {
            const v = run.criteria?.[id]
            if (typeof v !== 'number') return null
            const d = delta?.comparable ? delta.criteria?.[id] : undefined
            const project = run.project[id]
            return (
              <li key={id} className="flex items-start justify-between gap-3 text-body-sm">
                <span className="text-ink">{labelOf(id)}</span>
                <span className="shrink-0 text-right font-mono text-ink">
                  {t('analysis.score', { v: fmt(v, lang) })}
                  {typeof d === 'number' && d !== 0 && (
                    <span className={`ml-1 text-caption ${d > 0 ? 'text-ok' : 'text-warn'}`}>{signed(d, lang)}</span>
                  )}
                  {project && <Confidence c={project.c} />}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {run.expected.length > 0 && (
        <section className="mt-4">
          <h3 className="kicker mb-2">{t('analysis.expectedResults')}</h3>
          <ul className="space-y-1.5">
            {run.expected.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 text-body-sm">
                <span className="text-ink">
                  {e.label}
                  {delta?.comparable && delta.nowFound?.includes(e.id) && <span className="ml-1 text-caption text-ok">· {t('analysis.nowFound')}</span>}
                  {delta?.comparable && delta.lost?.includes(e.id) && <span className="ml-1 text-caption text-warn">· {t('analysis.lost')}</span>}
                </span>
                <span className="shrink-0 text-right text-caption">
                  {e.found === true && e.page ? (
                    <button type="button" className="text-accent-ink hover:underline" onClick={() => onSelect(e.page!)}>
                      {t('analysis.found', { page: nameOf(e.page) })}
                    </button>
                  ) : e.found === false ? (
                    <span className="text-warn">{t('analysis.notFound')}</span>
                  ) : (
                    <span className="text-ink-faint">{t('analysis.notAnswered')}</span>
                  )}
                  <Confidence c={e.c} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4">
        <h3 className="kicker mb-2">{t('analysis.byPage')}</h3>
        <ul className="space-y-2">
          {run.pages.map((p) => (
            <li key={p.id} className="rounded border border-line-soft p-2">
              <button
                type="button"
                className="block truncate text-left text-body-sm font-medium text-ink hover:underline"
                title={t('analysis.goTo', { name: nameOf(p.id) })}
                onClick={() => onSelect(p.id)}
              >
                {nameOf(p.id)}
              </button>
              <ul className="mt-1 space-y-0.5">
                {grid.criteria
                  .filter((c) => c.scope === 'screen')
                  .map((c) => (
                    <li key={c.id} className="flex justify-between gap-2 text-caption text-ink-muted">
                      <span className="truncate">{c.label}</span>
                      <ScoreText s={p.scores[c.id]} />
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 border-l-2 border-line-soft pl-2">
        <h3 className="text-caption font-medium text-ink-muted">{t('analysis.limits')}</h3>
        <ul className="measure mt-1 list-disc space-y-0.5 pl-4 text-caption text-ink-faint">
          <li>{t('analysis.limit.source')}</li>
          <li>{t('analysis.limit.absence')}</li>
          <li>{t('analysis.limit.score')}</li>
        </ul>
      </section>
    </div>
  )
}

const signed = (d: number, lang: string) => `${d > 0 ? '+' : ''}${fmt(d, lang)}`

function ScoreText({ s }: { s?: Score }) {
  const t = useT()
  const lang = getLang()
  if (!s) return <span className="font-mono text-ink-faint">—</span>
  return (
    <span className="shrink-0 font-mono text-ink">
      {t('analysis.score', { v: fmt(s.v, lang) })}
      <Confidence c={s.c} />
    </span>
  )
}

/** Shown only when it changes how the number reads: a doubt, or no measure at all. */
function Confidence({ c }: { c: number | null }) {
  const t = useT()
  const band = confidenceBand(c)
  if (band === 'high' || band === 'medium') return null
  return <span className={`ml-1 font-sans text-caption ${band === 'low' ? 'text-warn' : 'text-ink-faint'}`}>· {t(`analysis.conf.${band}`)}</span>
}

function Items({
  title,
  items,
  labelOf,
  nameOf,
  onSelect,
}: {
  title: string
  items: SynthesisItem[]
  labelOf: (id: string) => string
  nameOf: (id: string) => string
  onSelect: (id: string) => void
}) {
  const t = useT()
  return (
    <section className="mt-4">
      <h3 className="kicker mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-body-sm text-ink-faint">{t('analysis.none')}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="text-body-sm text-ink">
              <div className="flex items-start gap-2">
                {it.priority && (
                  <span
                    className={`mt-0.5 shrink-0 rounded px-1 font-mono text-caption ${
                      it.priority === 'P1' ? 'bg-danger/15 text-danger' : it.priority === 'P2' ? 'bg-warn/15 text-warn' : 'bg-ink/5 text-ink-muted'
                    }`}
                  >
                    {it.priority}
                  </span>
                )}
                <span>{it.text}</span>
              </div>
              {(it.pages.length > 0 || it.criteria.length > 0) && (
                <div className="mt-1 flex flex-wrap gap-1 pl-0.5">
                  {it.pages.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelect(id)}
                      className="inline-flex items-center gap-1 rounded border border-line-soft px-1.5 text-caption text-ink-muted hover:border-line hover:text-ink"
                    >
                      <Icon name="image" size={11} />
                      {nameOf(id)}
                    </button>
                  ))}
                  {it.criteria.map((id) => (
                    <span key={id} className="rounded bg-ink/5 px-1.5 text-caption text-ink-faint">
                      {labelOf(id)}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function GridView({ grid }: { grid: AnalysisGrid }) {
  const t = useT()
  return (
    <details className="border-t border-line-soft p-3">
      <summary className="cursor-pointer text-body-sm font-medium text-ink">{t('analysis.grid')}</summary>
      <p className="mt-2 text-caption text-ink-faint">{grid.by === 'muse' ? t('analysis.gridByMuse') : t('analysis.gridDefault')}</p>
      {grid.goal && <p className="measure mt-2 text-body-sm text-ink-muted">{grid.goal}</p>}
      <ol className="mt-2 space-y-3">
        {grid.criteria.map((c) => (
          <li key={c.id}>
            <div className="text-body-sm font-medium text-ink">
              {c.label} <span className="font-normal text-ink-faint">· {t(`analysis.scope.${c.scope}`)}</span>
            </div>
            <p className="measure text-caption text-ink-muted">{c.question}</p>
            <ol start={0} className="mt-1 list-decimal space-y-0.5 pl-5 text-caption text-ink-faint">
              {c.levels.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
      {grid.expected.length > 0 && (
        <>
          <div className="mt-3 text-body-sm font-medium text-ink">{grid.label.expected}</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-caption text-ink-muted">
            {grid.expected.map((e) => (
              <li key={e.id}>
                {e.label}
                {e.detail ? ` — ${e.detail}` : ''}
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  )
}
