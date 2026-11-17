import { useEffect, useRef, useState } from 'react'
import { Banner, Button, Icon, type IconName } from '../ui'
import { useT } from '../i18n'
import type { Screen } from '../lib/project'
import { DEFAULT_PAGE_FORMAT, getPageFormat } from '../lib/pageFormats'
import type { CheckResult, PreflightNote, PreflightReport } from '../lib/docExport/preflight'

type State =
  | { step: 'idle' }
  | { step: 'running'; page: number; total: number }
  | { step: 'done'; report: PreflightReport }
  | { step: 'error' }

const STATUS: Record<CheckResult['status'], { icon: IconName; tone: string }> = {
  ok: { icon: 'check', tone: 'text-ok' },
  info: { icon: 'eye', tone: 'text-accent' },
  warn: { icon: 'warning', tone: 'text-warn' },
  na: { icon: 'more', tone: 'text-ink-faint' },
}

/**
 * "Contrôle avant export" (lib/docExport/preflight.ts), at the top of the
 * download dialog: the questions a print shop or a Canva import asks of the
 * file, answered on the rendered page before any file is made.
 *
 * On demand, not on opening: it renders the document offscreen, which costs
 * the seconds an export costs, and a person who downloads the same PNG for
 * the fifth time does not want to pay them every time. The report remembers
 * the code it was made from, so a fit or an edit since says "run it again"
 * rather than showing answers about a page that no longer exists.
 */
export default function DocumentPreflight({
  screen,
  disabled,
  onBusy,
  onFit,
}: {
  screen: Screen
  /** An export is running: one offscreen frame at a time. */
  disabled: boolean
  onBusy: (busy: boolean) => void
  onFit?: () => void
}) {
  const t = useT()
  const [state, setState] = useState<State>({ step: 'idle' })
  const abortRef = useRef<AbortController | null>(null)
  const print = getPageFormat(screen.page ?? DEFAULT_PAGE_FORMAT).kind === 'print'

  useEffect(() => () => abortRef.current?.abort(), [])

  async function run() {
    if (disabled || state.step === 'running') return
    const ctrl = new AbortController()
    abortRef.current = ctrl
    onBusy(true)
    setState({ step: 'running', page: 0, total: 0 })
    try {
      const { runPreflight } = await import('../lib/docExport/preflight')
      const report = await runPreflight(screen, {
        signal: ctrl.signal,
        onProgress: (page, total) => !ctrl.signal.aborted && setState({ step: 'running', page, total }),
        unnamed: (n) => t('docExport.check.picture', { n }),
      })
      if (!ctrl.signal.aborted) setState({ step: 'done', report })
    } catch (err) {
      if (ctrl.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return
      console.warn('mocky: preflight failed —', err)
      setState({ step: 'error' })
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null
      onBusy(false)
    }
  }

  function cancel() {
    abortRef.current?.abort()
    setState({ step: 'idle' })
  }

  const report = state.step === 'done' ? state.report : null

  return (
    <section aria-labelledby="doc-preflight-title" className="border border-line-soft px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p id="doc-preflight-title" className="text-body font-medium text-ink">
            {t('docExport.check.title')}
          </p>
          <p className="mt-0.5 text-body-sm text-ink-muted">{t('docExport.check.help')}</p>
        </div>
        {state.step === 'running' ? (
          <Button size="sm" variant="ghost" onClick={cancel}>
            {t('docExport.cancel')}
          </Button>
        ) : (
          <Button size="sm" onClick={run} disabled={!screen.code.trim()} aria-disabled={disabled || undefined}>
            <Icon name="search" size={14} />
            {t(report ? 'docExport.check.again' : 'docExport.check.run')}
          </Button>
        )}
      </div>
      <div aria-live="polite">
        {state.step === 'running' && (
          <p className="mt-2 text-body-sm text-ink-muted">
            {state.total ? t('docExport.check.progress', { page: state.page, total: state.total }) : t('docExport.progress.render')}
          </p>
        )}
        {state.step === 'error' && (
          <div className="mt-2">
            <Banner tone="danger">{t('docExport.check.error')}</Banner>
          </div>
        )}
        {report && <PreflightResults report={report} stale={report.code !== screen.code} print={print} onFit={onFit} />}
      </div>
    </section>
  )
}

/** The report, one line per check: what was found, or why there was nothing to find. */
export function PreflightResults({
  report,
  stale,
  print,
  onFit,
}: {
  report: PreflightReport
  stale: boolean
  print: boolean
  onFit?: () => void
}) {
  const t = useT()
  const toReview = report.checks.filter((c) => c.status === 'warn').length
  const noteText = (n: PreflightNote) =>
    t(`docExport.check.note.${n.code}`, { pages: n.pages.join(', '), items: n.items.join(' ; '), n: n.n ?? 0 })

  function row(c: CheckResult) {
    const s = STATUS[c.status]
    return (
      <li key={c.id} className="flex items-start gap-2.5 py-2">
        <Icon name={s.icon} size={16} className={`mt-0.5 shrink-0 ${s.tone}`} />
        <div className="min-w-0 flex-1">
          <p className="text-body-sm text-ink">
            <span className="font-medium">{t(`docExport.check.${c.id}`)}</span>
            <span className="text-ink-muted"> · {t(`docExport.check.status.${c.status}`)}</span>
          </p>
          {c.status === 'ok' && <p className="text-caption text-ink-muted">{t(`docExport.check.ok.${c.id}`)}</p>}
          {c.status === 'na' && <p className="text-caption text-ink-faint">{t(`docExport.check.na.${c.id}`)}</p>}
          {c.notes.map((n, i) => (
            <div key={i} className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className={`min-w-0 flex-1 text-caption ${n.level === 'warn' ? 'text-ink' : 'text-ink-muted'}`}>{noteText(n)}</p>
              {n.code === 'overflow' && onFit && (
                <Button size="sm" variant="quiet" onClick={onFit}>
                  {t('project.docFit')}
                </Button>
              )}
            </div>
          ))}
          {c.id === 'pictures' && c.notes.some((n) => n.code === 'lowRes' || n.code === 'softRes') && (
            <p className="text-caption text-ink-faint">{t(print ? 'docExport.check.target.print' : 'docExport.check.target.screen')}</p>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="mt-2">
      {stale && <Banner tone="info">{t('docExport.check.stale')}</Banner>}
      <p className="mt-1 text-body-sm font-medium text-ink">
        {toReview ? t('docExport.check.summary.warn', { n: toReview }) : t('docExport.check.summary.ok', { pages: report.pages })}
      </p>
      <ul className="divide-y divide-line-soft">{report.checks.map(row)}</ul>
    </div>
  )
}
