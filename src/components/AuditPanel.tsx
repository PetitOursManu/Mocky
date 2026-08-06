import { useEffect, useMemo, useState } from 'react'
import type { Screen } from '../lib/project'
import { loadSettings } from '../lib/settings'
import type { QualityFinding } from '../lib/quality'
import { auditExport, auditScreen, type AuditReport, type DimensionScore, type FamilyScore } from '../lib/audit'
import { getThumb } from '../lib/thumbnails'
import { Banner, Button, Icon, Panel, Spinner } from '../ui'
import { getLang, useT } from '../i18n'

/**
 * Evaluate one screen for SEO and accessibility, then correct it.
 *
 * WHY A SCREEN AT A TIME
 *
 * Both disciplines are about a document, and a Mocky project is a pile of
 * components with no document around them — so "the project's SEO score" would
 * be an average of things that never share a page. What IS answerable is
 * whether THIS screen's markup is sound, which is why the panel opens on a
 * choice of screen and not on a total.
 *
 * WHY THE PICKER IS VISUAL
 *
 * A dropdown of screen names is what the Links panel does, and it works there
 * because a link has a name. Screens are named "Écran 3" until someone renames
 * them, so a list of names is a list of numbers. The thumbnails already exist —
 * captured after a screen settles — and cost nothing to read back.
 *
 * WHAT IT REFUSES TO SAY
 *
 * No conformance claim, ever. The analysis reads source and never renders, so
 * contrast, focus visibility, tap-target size and painted tab order are all
 * outside it (invariant Q4). The confidence note says exactly that, next to the
 * score rather than in a tooltip, because a number with a caveat nobody reads
 * is a number that will be quoted without it.
 */
export default function AuditPanel({
  screens,
  projectName,
  productName,
  selectedId,
  onSelect,
  onFix,
  onClose,
  className = '',
}: {
  screens: Screen[]
  projectName: string
  productName?: string
  /** The screen the canvas has selected, so the two stay in step. */
  selectedId: string | null
  onSelect: (id: string) => void
  /**
   * Correct named findings on a screen. Resolves to how many were resolved, or
   * null when the pass could not run — the caller owns the model call, the
   * AbortController and `previousCode`.
   */
  onFix: (screenId: string, findings: QualityFinding[]) => Promise<number | null>
  onClose: () => void
  className?: string
}) {
  const t = useT()
  /**
   * Reports, each kept beside the source it describes.
   *
   * The source and not just the screen id, because that is the only thing that
   * makes staleness detectable. An id-keyed map survives a regeneration, an
   * edit, a Revert and a sync from another device — all of which replace the
   * code under it — and would then show a score for markup that no longer
   * exists. Comparing the code is exact and needs no effect to maintain.
   */
  const [reports, setReports] = useState<Record<string, { code: string; report: AuditReport }>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [fixing, setFixing] = useState(false)
  const [deep, setDeep] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exportFindings, setExportFindings] = useState<QualityFinding[] | null>(null)

  const active = screens.find((s) => s.id === selectedId) ?? screens[0] ?? null
  const stored = active ? reports[active.id] : undefined
  // A stale score shown beside changed code is worse than no score, so a report
  // whose source has moved on is simply not a report any more.
  const report = stored && active && stored.code === active.code ? stored.report : undefined

  // Read only — this panel never takes a picture. A capture needs a
  // same-origin iframe, and running model-written code with Mocky's own origin
  // is not something a panel should do as a side effect of opening.
  const thumbs = useMemo(() => {
    const out: Record<string, string> = {}
    for (const s of screens) {
      const hit = s.code ? getThumb(s.id, s.code) : null
      if (hit) out[s.id] = hit
    }
    return out
  }, [screens])

  // The exported document is a project-level fact and identical for every
  // screen, so it is evaluated once rather than repeated on each of them.
  useEffect(() => {
    let live = true
    auditExport(projectName, {
      lang: getLang(),
      description: productName ? `${productName} — ${projectName}` : undefined,
    })
      .then((r) => live && setExportFindings(r.findings))
      .catch(() => live && setExportFindings([]))
    return () => {
      live = false
    }
  }, [projectName, productName])

  // Deleted screens, so the map does not grow for the life of the session.
  // Rewritten screens need no effect at all — see the note on `reports`.
  useEffect(() => {
    const live = new Set(screens.map((s) => s.id))
    setReports((prev) => {
      const kept = Object.fromEntries(Object.entries(prev).filter(([id]) => live.has(id)))
      return Object.keys(kept).length === Object.keys(prev).length ? prev : kept
    })
  }, [screens])

  async function run(screen: Screen) {
    setBusy(screen.id)
    setError(null)
    setNotice(null)
    try {
      // Read at call time, like every other model-backed path, so an admin
      // changing the instance provider applies without a reload.
      const next = await auditScreen(screen.code, { deep, settings: loadSettings() })
      // The code as it was WHEN CHECKED, not as it is now: a screen rewritten
      // while the deep pass was in flight must not adopt this report.
      setReports((prev) => ({ ...prev, [screen.id]: { code: screen.code, report: next } }))
    } catch (e) {
      // auditScreen is written not to throw (Q1). If it ever does, an
      // evaluation failing must not look like the screen failing.
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function fix(screen: Screen, findings: QualityFinding[]) {
    if (!findings.length) {
      setNotice(t('audit.fixNothing'))
      return
    }
    setFixing(true)
    setError(null)
    setNotice(null)
    try {
      const fixed = await onFix(screen.id, findings)
      if (fixed === null) setError(t('audit.fixFailed'))
      else setNotice(fixed > 0 ? t('audit.fixedCount', { n: fixed }) : t('audit.fixedNone'))
      // Nothing to discard here on purpose. A correction that rewrote the
      // screen invalidates its own report, because the report is kept beside
      // the source it describes — and a correction that changed nothing leaves
      // a report that is still exactly right, which the user is mid-way through
      // reading. Dropping it either way would throw away the accurate case.
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setFixing(false)
    }
  }

  /** Only enforceable findings may be spent a correction pass on (Q2). */
  const correctable = (report?.findings ?? []).filter((f) => f.disposition !== 'advise')

  return (
    <Panel title={t('audit.title')} onClose={onClose} className={className}>
      {screens.length === 0 ? (
        <p className="p-3 text-body-sm text-ink-faint">{t('audit.noScreens')}</p>
      ) : (
        <>
          <div className="border-b border-line-soft p-3">
            <div className="kicker mb-2 text-accent-ink">{t('audit.pickScreen')}</div>
            <ul className="grid grid-cols-3 gap-2">
              {screens.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    aria-pressed={s.id === active?.id}
                    title={s.name}
                    className={`block w-full overflow-hidden border text-left transition ${
                      s.id === active?.id ? 'border-accent' : 'border-line-soft hover:border-line'
                    }`}
                  >
                    {thumbs[s.id] ? (
                      <img src={thumbs[s.id]} alt="" className="block aspect-[4/3] w-full object-cover" />
                    ) : (
                      // A screen whose picture was never taken, or was taken
                      // before its code changed. Drawn rather than blank, so a
                      // missing thumbnail does not read as a broken screen.
                      <span className="flex aspect-[4/3] w-full items-center justify-center bg-ink/5 text-ink-faint">
                        <Icon name="image" size={18} />
                      </span>
                    )}
                    <span className="block truncate px-1.5 py-1 text-caption text-ink">{s.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-b border-line-soft p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={!active || busy !== null || fixing}
                onClick={() => active && run(active)}
              >
                {busy ? t('audit.running') : report ? t('audit.rerun') : t('audit.run')}
              </Button>
              <label className="flex cursor-pointer items-center gap-1.5 text-body-sm text-ink-muted" title={t('audit.deepHelp')}>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-accent"
                  checked={deep}
                  onChange={(e) => setDeep(e.target.checked)}
                />
                {t('audit.deep')}
              </label>
            </div>
            <p className="measure mt-1.5 text-caption text-ink-faint">{t('audit.deepHelp')}</p>
          </div>

          {error && (
            <Banner tone="danger" className="m-3">
              {error}
            </Banner>
          )}
          {notice && !error && (
            <Banner tone="ok" className="m-3">
              {notice}
            </Banner>
          )}

          {busy ? (
            <div className="flex justify-center p-6">
              <Spinner />
            </div>
          ) : !report ? (
            <p className="p-3 text-body-sm text-ink-faint">{t('audit.notRun')}</p>
          ) : !report.parsed ? (
            <Banner tone="warn" className="m-3">
              {t('audit.unparsed')}
            </Banner>
          ) : (
            <div className="p-3">
              <div className="grid grid-cols-2 gap-2">
                <ScoreCard label={t('audit.seo')} score={report.seo} />
                <ScoreCard label={t('audit.a11y')} score={report.a11y} />
              </div>

              {/* Beside the score, not in a tooltip: a number whose caveat
                  nobody reads is a number that gets quoted without it. */}
              <p className="measure mt-2 border-l-2 border-line-soft pl-2 text-caption text-ink-faint">
                <span className="font-medium text-ink-muted">{t('audit.confidence')} — </span>
                {t('audit.confidenceNote')}
              </p>

              <FamilyBreakdown families={report.families} />

              {report.notices.map((n) => (
                <Banner key={n} tone="warn" className="mt-3">
                  {n}
                </Banner>
              ))}

              {report.findings.length === 0 ? (
                <p className="mt-3 flex items-center gap-1.5 text-body-sm text-ok">
                  <Icon name="check" size={15} />
                  {t('audit.clean')}
                </p>
              ) : (
                <>
                  <div className="section-head mt-4">
                    <span className="kicker text-accent-ink">{t('audit.findings')}</span>
                    {correctable.length > 0 && active && (
                      <Button
                        size="sm"
                        className="ml-auto"
                        disabled={fixing}
                        onClick={() => fix(active, correctable)}
                      >
                        {fixing ? t('audit.fixing') : t('audit.fixAll')}
                      </Button>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {report.findings.map((f) => (
                      <Finding
                        key={f.rule}
                        finding={f}
                        busy={fixing}
                        onFix={active ? () => fix(active, [f]) : undefined}
                      />
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <div className="border-t border-line-soft p-3">
            <div className="kicker mb-1 text-accent-ink">{t('audit.exportSection')}</div>
            <p className="measure mb-2 text-caption text-ink-faint">{t('audit.exportBlurb')}</p>
            {exportFindings === null ? null : exportFindings.length === 0 ? (
              <p className="flex items-center gap-1.5 text-body-sm text-ok">
                <Icon name="check" size={15} />
                {t('audit.exportClean')}
              </p>
            ) : (
              <ul className="space-y-2">
                {exportFindings.map((f) => (
                  <Finding key={f.rule} finding={f} busy={false} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Panel>
  )
}

function ScoreCard({ label, score }: { label: string; score: DimensionScore }) {
  const tone =
    score.band === 'excellent' || score.band === 'good'
      ? 'text-ok'
      : score.band === 'acceptable'
        ? 'text-warn'
        : 'text-danger'
  return (
    <div className="border border-line-soft bg-ink/5 p-2">
      <div className="kicker text-ink-muted">{label}</div>
      <div className={`font-mono text-h2 leading-tight ${tone}`}>{score.score}</div>
      <div className="h-1 w-full bg-ink/10">
        <div
          className={score.band === 'poor' ? 'h-full bg-danger' : score.band === 'acceptable' ? 'h-full bg-warn' : 'h-full bg-ok'}
          style={{ width: `${score.score}%` }}
        />
      </div>
    </div>
  )
}

/** The i18n key naming a confidence level, for the row and for the legend. */
const CONFIDENCE_KEY: Record<FamilyScore['confidence'], string> = {
  high: 'audit.family.confidence.high',
  medium: 'audit.family.confidence.medium',
  low: 'audit.family.confidence.low',
}

/**
 * The same findings, cut by what they are about.
 *
 * WHY UNDER THE TWO SCORES AND NOT INSTEAD OF THEM
 *
 * "SEO" and "Accessibility" answer how the screen does; they are the numbers
 * someone has been watching since the panel shipped, and they are unchanged.
 * This answers where to go and fix it, which is a different question — an
 * unnamed control and a missing `alt` are both accessibility errors and have
 * nothing to do with each other, while every image rule is one afternoon in one
 * file.
 *
 * WHY A ROW CAN CARRY NO NUMBER
 *
 * Invariant Q4, one level further down than the panel's own caveat. A screen
 * with no form and a screen whose forms are perfect produce the same empty
 * finding list, and only one of them has earned a 100 — so a family with
 * nothing to examine prints "not applicable", and one whose subjects the source
 * does not describe well enough prints "not measured". Both words are explained
 * under the list rather than in a tooltip, for the same reason the confidence
 * note sits beside the score: a caveat nobody reads is a number quoted without
 * it.
 */
function FamilyBreakdown({ families }: { families: FamilyScore[] }) {
  const t = useT()
  // One legend line per confidence actually earned by a scored row. Three
  // sentences under an eight-row list is more caveat than list, and a legend
  // for a level nothing on this screen uses explains a column that is not there.
  const scored = families.filter((f) => f.state === 'scored')
  const legend = scored.filter((f, i) => scored.findIndex((g) => g.confidenceKey === f.confidenceKey) === i)

  return (
    <div className="mt-4">
      <div className="section-head">
        <span className="kicker text-accent-ink">{t('audit.families')}</span>
      </div>
      <p className="measure mb-1.5 text-caption text-ink-faint">{t('audit.familiesBlurb')}</p>
      <ul className="border-y border-line-soft">
        {families.map((f) => (
          <FamilyRow key={f.family} family={f} />
        ))}
      </ul>
      <div className="measure mt-1.5 space-y-1 text-caption text-ink-faint">
        {legend.map((f) => (
          <p key={f.confidenceKey}>
            <Confidence level={f.confidence} label={t(CONFIDENCE_KEY[f.confidence])} visible /> —{' '}
            {t(f.confidenceKey)}
          </p>
        ))}
        {families.some((f) => f.state === 'not-applicable') && <p>{t('audit.family.notApplicableNote')}</p>}
        {families.some((f) => f.state === 'not-measured') && <p>{t('audit.family.notMeasuredNote')}</p>}
      </div>
    </div>
  )
}

function FamilyRow({ family }: { family: FamilyScore }) {
  const t = useT()
  const tone =
    family.band === 'poor' ? 'text-danger' : family.band === 'acceptable' ? 'text-warn' : 'text-ok'
  return (
    <li className="flex items-center gap-2 border-b border-line-soft py-1 last:border-b-0">
      <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{t(family.labelKey)}</span>
      {family.state === 'scored' ? (
        <>
          {family.failing > 0 && (
            <span className="shrink-0 text-caption text-ink-faint">
              {t('audit.family.failing', { n: family.failing })}
            </span>
          )}
          <span className={`shrink-0 font-mono text-body-sm ${tone}`}>{family.score}</span>
        </>
      ) : (
        <span className="shrink-0 text-caption text-ink-faint">
          {t(family.state === 'not-measured' ? 'audit.family.notMeasured' : 'audit.family.notApplicable')}
        </span>
      )}
      <Confidence level={family.confidence} label={t(CONFIDENCE_KEY[family.confidence])} />
    </li>
  )
}

/**
 * Three dots, one to three of them filled.
 *
 * The word is always in the markup — visible in the legend, `sr-only` in a row.
 * A graphic-only indicator would be a defect this very panel reports, on the
 * screen that reports it.
 */
function Confidence({
  level,
  label,
  visible = false,
}: {
  level: FamilyScore['confidence']
  label: string
  visible?: boolean
}) {
  const filled = level === 'high' ? 3 : level === 'medium' ? 2 : 1
  return (
    // `inline-flex`, so the legend can set it in the middle of a sentence and
    // the dots never wrap away from the word they belong to.
    <span className="inline-flex shrink-0 items-center gap-0.5 align-middle">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${i < filled ? 'bg-ink-muted' : 'bg-ink/20'}`}
        />
      ))}
      <span className={visible ? 'ml-1 text-ink-muted' : 'sr-only'}>{label}</span>
    </span>
  )
}

/**
 * One finding.
 *
 * `name` and `description` are i18n KEYS for a catalogued rule and free prose
 * for a judged one. `t()` returns the key itself when it is not in the
 * dictionary — which is what makes one component able to render both without a
 * flag, and why the fallback in i18n/index.ts is "show the key" rather than
 * "show nothing".
 */
function Finding({
  finding,
  busy,
  onFix,
}: {
  finding: QualityFinding
  busy: boolean
  onFix?: () => void
}) {
  const t = useT()
  const advisory = finding.disposition === 'advise'
  const tone =
    finding.severity === 'error' ? 'text-danger' : finding.severity === 'warning' ? 'text-warn' : 'text-ink-muted'
  return (
    <li className="border border-line-soft bg-surface p-2">
      <div className="flex items-start gap-2">
        <Icon name={finding.severity === 'error' ? 'warning' : 'comment'} size={15} className={`mt-0.5 ${tone}`} />
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-medium text-ink">{t(finding.name)}</p>
          <p className="measure mt-0.5 text-caption text-ink-muted">{t(finding.description)}</p>
          {finding.snippet && (
            <p className="mt-1 truncate font-mono text-caption text-ink-faint">{finding.snippet}</p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-2 text-caption text-ink-faint">
            {finding.line ? <span className="font-mono">L{finding.line}</span> : null}
            {finding.source === 'critique' && <span>{t('audit.judged')}</span>}
            {advisory && <span>{t('audit.advisoryNote')}</span>}
          </p>
        </div>
        {onFix && !advisory && (
          <Button size="sm" disabled={busy} onClick={onFix}>
            {t('audit.fixOne')}
          </Button>
        )}
      </div>
    </li>
  )
}
