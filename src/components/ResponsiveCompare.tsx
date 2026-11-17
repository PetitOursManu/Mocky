import { useEffect, useMemo, useRef, useState } from 'react'
import { Banner, Button, Checkbox, Icon, Modal, Spinner } from '../ui'
import { useT } from '../i18n'
import Preview, { type ScrollAnchor } from './Preview'
import type { Screen } from '../lib/project'
import {
  RESPONSIVE_VIEWS,
  overflowCount,
  readViewOverflow,
  reportClear,
  responsiveFindings,
  responsiveVerdict,
  totalOverflowPx,
  type OverflowItem,
  type ResponsiveReport,
  type ResponsiveVerdict,
  type ResponsiveView,
  type ResponsiveViewId,
  type ViewOverflow,
} from '../lib/responsive'

/** A frame that never answers has not rendered: past this it is said, not waited on. */
const MEASURE_TIMEOUT_MS = 25_000

type Reading = ViewOverflow | 'failed'

/** What the parent does with the model: the call, the U5 check, the locks. */
export type CorrectResult = { code: string } | { refused: string }

/**
 * One screen at a phone's, a tablet's and a desktop's width at once, what
 * overflows at each outlined, and one correction for the three (lib/responsive.ts
 * says why it is measured in the frames).
 *
 * The correction is checked the way the fit is: the model's answer is shown in
 * the same three frames and measured again, and it is written back only if it
 * is better without breaking a width that was clear. Rendering the answer here
 * rather than offscreen is what lets the person see the after BEFORE it is kept
 * — and the measurement is the one their eyes are checking.
 *
 * Animations are off in the three frames: an element sliding in from the side
 * is past the edge for half a second, and that is not what is being asked.
 */
export default function ResponsiveCompare({
  screen,
  busy,
  onCorrect,
  onApply,
  onClose,
}: {
  screen: Screen
  busy: boolean
  onCorrect: (code: string, findings: string, signal: AbortSignal) => Promise<CorrectResult>
  /** Write the answer back. False when the screen moved meanwhile: theirs stands. */
  onApply: (codeAtStart: string, code: string) => boolean
  onClose: () => void
}) {
  const t = useT()
  const [candidate, setCandidate] = useState<string | null>(null)
  const shown = candidate ?? screen.code
  // A new code in the frames is a new measurement, and the round is the
  // request's id. Derived during render, not in an effect: for one render the
  // frames would otherwise hold the answer's code while the readings still
  // held the original's, and the answer would be judged on them.
  const roundRef = useRef({ code: shown, n: 1 })
  if (roundRef.current.code !== shown) roundRef.current = { code: shown, n: roundRef.current.n + 1 }
  const round = roundRef.current.n
  const [measured, setMeasured] = useState<{ round: number; views: Partial<Record<ResponsiveViewId, Reading>> }>({ round: 0, views: {} })
  const readings = measured.round === round ? measured.views : {}
  const record = (r: number, id: ResponsiveViewId, reading: Reading) =>
    setMeasured((m) => ({ round: r, views: { ...(m.round === r ? m.views : {}), [id]: reading } }))
  const [phase, setPhase] = useState<'idle' | 'correcting' | 'checking'>('idle')
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn' | 'danger'; text: string } | null>(null)
  const [sync, setSync] = useState(true)
  const [scrollTargets, setScrollTargets] = useState<Partial<Record<ResponsiveViewId, ScrollAnchor & { nonce: number }>>>({})
  const before = useRef<{ code: string; report: ResponsiveReport } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const quietUntil = useRef<Partial<Record<ResponsiveViewId, number>>>({})
  const nonce = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setMeasured((m) => {
        const views = { ...(m.round === round ? m.views : {}) }
        for (const v of RESPONSIVE_VIEWS) if (!views[v.id]) views[v.id] = 'failed'
        return { round, views }
      })
    }, MEASURE_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [round])

  useEffect(() => () => abortRef.current?.abort(), [])

  const report = useMemo<ResponsiveReport | null>(() => {
    const out: Partial<ResponsiveReport> = {}
    for (const v of RESPONSIVE_VIEWS) {
      const r = readings[v.id]
      if (!r || r === 'failed') return null
      out[v.id] = r
    }
    return out as ResponsiveReport
  }, [readings])
  const failed = RESPONSIVE_VIEWS.some((v) => readings[v.id] === 'failed')
  const measuring = !report && !failed

  // The original's report is what an answer is judged against.
  useEffect(() => {
    if (report && candidate === null) before.current = { code: shown, report }
  }, [report, candidate, shown])

  // The answer has been measured: keep it or put the original back.
  useEffect(() => {
    if (phase !== 'checking') return
    if (failed) {
      setCandidate(null)
      setPhase('idle')
      setMessage({ tone: 'warn', text: t('responsive.rejectedRender') })
      return
    }
    if (!report || candidate === null || !before.current) return
    const verdict: ResponsiveVerdict = responsiveVerdict(before.current.report, report)
    const codeAtStart = before.current.code
    setPhase('idle')
    if (verdict === 'rejected') {
      setCandidate(null)
      setMessage({ tone: 'warn', text: t('responsive.rejected') })
      return
    }
    if (!onApply(codeAtStart, candidate)) {
      setCandidate(null)
      setMessage({ tone: 'warn', text: t('responsive.moved') })
      return
    }
    // The screen now holds the answer: the frames keep what they show.
    before.current = { code: candidate, report }
    setCandidate(null)
    setMessage(
      verdict === 'fits'
        ? { tone: 'ok', text: t('responsive.fits') }
        : { tone: 'ok', text: t('responsive.closer', { px: totalOverflowPx(report) }) },
    )
  }, [phase, report, failed, candidate, onApply, t])

  async function correct() {
    if (!report || reportClear(report) || phase !== 'idle') return
    const ac = new AbortController()
    abortRef.current = ac
    setPhase('correcting')
    setMessage(null)
    try {
      const res = await onCorrect(shown, responsiveFindings(report), ac.signal)
      if ('refused' in res) {
        setPhase('idle')
        setMessage({ tone: 'warn', text: res.refused })
        return
      }
      if (!res.code.trim() || res.code.trim() === shown.trim()) {
        setPhase('idle')
        setMessage({ tone: 'warn', text: t('responsive.unchanged') })
        return
      }
      setPhase('checking')
      setCandidate(res.code)
    } catch (err) {
      setPhase('idle')
      if (err instanceof Error && err.name === 'AbortError') return
      setMessage({ tone: 'danger', text: err instanceof Error ? err.message : String(err) })
    } finally {
      abortRef.current = null
    }
  }

  function followScroll(from: ResponsiveViewId, a: ScrollAnchor) {
    if (!sync || Date.now() < (quietUntil.current[from] ?? 0)) return
    const next: Partial<Record<ResponsiveViewId, ScrollAnchor & { nonce: number }>> = {}
    for (const v of RESPONSIVE_VIEWS) {
      if (v.id === from) continue
      quietUntil.current[v.id] = Date.now() + 350
      next[v.id] = { ...a, nonce: ++nonce.current }
    }
    setScrollTargets((m) => ({ ...m, ...next }))
  }

  const total = report ? RESPONSIVE_VIEWS.reduce((n, v) => n + overflowCount(report[v.id]), 0) : 0
  const working = phase !== 'idle'

  return (
    <Modal title={t('responsive.title', { name: screen.name })} size="full" onClose={onClose}>
      <div className="flex h-[78vh] flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-body-sm text-ink-muted">{t('responsive.help')}</p>
          <Checkbox checked={sync} onChange={setSync}>
            {t('responsive.sync')}
          </Checkbox>
        </div>
        <div className="flex min-h-0 flex-1 gap-3">
          {RESPONSIVE_VIEWS.map((v) => (
            <ViewColumn
              key={v.id}
              view={v}
              code={shown}
              caps={screen.caps ?? []}
              round={round}
              reading={readings[v.id]}
              candidate={candidate !== null}
              sync={sync}
              scrollTo={scrollTargets[v.id] ?? null}
              onReading={(r) => record(round, v.id, r)}
              onScrolled={(a) => followScroll(v.id, a)}
            />
          ))}
        </div>
        {message && <Banner tone={message.tone}>{message.text}</Banner>}
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-body-sm text-ink" aria-live="polite">
            {phase === 'correcting'
              ? t('responsive.correcting')
              : phase === 'checking'
                ? t('responsive.checking')
                : measuring
                  ? t('responsive.measuring')
                  : failed
                    ? t('responsive.failed')
                    : total === 0
                      ? t('responsive.allClear')
                      : t('responsive.summary', { n: total })}
          </p>
          {phase === 'correcting' ? (
            <Button onClick={() => abortRef.current?.abort()}>{t('responsive.stop')}</Button>
          ) : (
            <Button
              variant="primary"
              disabled={busy || working || !report || reportClear(report)}
              title={t('responsive.correctTitle')}
              onClick={() => void correct()}
            >
              {working ? <Spinner className="h-4 w-4" /> : <Icon name="sparkle" size={14} />}
              {t('responsive.correct')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

const VIEW_KEYS: Record<ResponsiveViewId, string> = {
  mobile: 'responsive.view.mobile',
  tablet: 'responsive.view.tablet',
  desktop: 'responsive.view.desktop',
}

function ViewColumn({
  view,
  code,
  caps,
  round,
  reading,
  candidate,
  sync,
  scrollTo,
  onReading,
  onScrolled,
}: {
  view: ResponsiveView
  code: string
  caps: string[]
  round: number
  reading: Reading | undefined
  candidate: boolean
  sync: boolean
  scrollTo: (ScrollAnchor & { nonce: number }) | null
  onReading: (r: Reading) => void
  onScrolled: (a: ScrollAnchor) => void
}) {
  const t = useT()
  const areaRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])
  // Laid out at the view's own width and scaled: a smaller box would be a
  // different breakpoint, which is the one thing this must not change.
  const scale = size.w > 0 && size.h > 0 ? Math.min(size.w / view.w, size.h / view.h, 1) : 0
  const items: OverflowItem[] = useMemo(() => (reading && reading !== 'failed' ? reading.items : []), [reading])
  const marks = useMemo(() => items.map((i) => i.selector), [items])

  return (
    // Weighted by the view's shape, so the three stand at one height.
    <section className="flex min-h-0 min-w-0 flex-col gap-2" style={{ flex: `${view.w / view.h} 1 0` }} aria-label={t(VIEW_KEYS[view.id])}>
      <header className="flex items-center gap-2">
        <h3 className="text-body-sm font-medium text-ink">{t(VIEW_KEYS[view.id])}</h3>
        <span className="text-caption text-ink-faint">{view.w} px</span>
        <span className="ml-auto text-caption">
          {!reading ? (
            <Spinner className="h-3.5 w-3.5" />
          ) : reading === 'failed' ? (
            <span className="text-warn">{t('responsive.viewFailed')}</span>
          ) : overflowCount(reading) === 0 ? (
            <span className="text-ok">{t('responsive.viewClear')}</span>
          ) : (
            <span className="text-danger">{t('responsive.viewOver', { n: overflowCount(reading) })}</span>
          )}
        </span>
      </header>
      <div ref={areaRef} className="relative min-h-0 flex-1 overflow-hidden bg-sunken" data-doc={`responsive-${view.id}`}>
        {scale > 0 && (
          <div className="relative mx-auto border border-line-soft" style={{ width: view.w * scale, height: view.h * scale }}>
            <div className="absolute left-0 top-0" style={{ width: view.w, height: view.h, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
              <Preview
                code={code}
                caps={caps}
                animations={false}
                pickMarks={marks}
                overflowRequest={round}
                onOverflow={(raw, id) => {
                  if (id !== round) return
                  onReading(readViewOverflow(raw) ?? 'failed')
                }}
                onError={() => onReading('failed')}
                scrollSync={sync}
                onScrolled={onScrolled}
                scrollTo={scrollTo}
              />
            </div>
            {candidate && (
              <span className="absolute left-2 top-2 rounded bg-accent px-1.5 py-0.5 text-caption text-on-accent">{t('responsive.proposal')}</span>
            )}
          </div>
        )}
      </div>
      {items.length > 0 && (
        <ul className="max-h-32 shrink-0 space-y-1 overflow-y-auto text-caption text-ink-muted">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 font-mono text-danger">+{it.px} px</span>
              <span className="min-w-0 truncate">
                {t(`responsive.kind.${it.kind}`)} · &lt;{it.tag}&gt;{it.text ? ` ${t('responsive.quoted', { text: it.text })}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
