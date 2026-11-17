import { useEffect, useMemo, useRef, useState } from 'react'
import { Banner, Button, Icon, Spinner } from '../ui'
import { useT } from '../i18n'
import type { CampaignFormatId, CampaignPublish } from '../lib/campaign'
import type { Screen } from '../lib/project'
import { calendyDrafts, monthGrid, monthOf, scheduledPieces, shiftMonth, toCsv, toIcs } from '../lib/campaignSchedule'
import type { PackCaption, PackNetwork } from '../lib/publicationPack'
import { connectCalendy, disconnectCalendy, getCalendyLink, pushToCalendy, type CalendyLink } from '../lib/calendyClient'
import { downloadBlob, fileBaseName } from '../lib/docExport/files'

type Piece = Screen & { campaign: NonNullable<Screen['campaign']> }

/**
 * The campaign's editorial calendar, inside the Campaign panel: a date (and an
 * hour, when it matters) per piece, the month they fall in, two files for
 * other tools, and Calendy (lib/campaignSchedule.ts, server/calendy.js).
 *
 * It writes nothing but the pieces' `campaign.publish` — no code, so none of
 * the write-back conventions of a pass apply — and it runs its own sends: a
 * send renders pictures and talks to Calendy, and touches no screen's code.
 */
export default function CampaignCalendar({
  campaignName,
  pieces,
  locked,
  onPublish,
  onFocus,
  screenOf,
  captions,
}: {
  campaignName: string
  pieces: Piece[]
  /** Something else is running. */
  locked: boolean
  onPublish: (screenId: string, publish: CampaignPublish | undefined) => void
  onFocus: (screenId: string) => void
  screenOf: (id: string) => Screen | undefined
  /** The publication pack's captions: a NEW Calendy idea carries its network's. */
  captions?: Partial<Record<PackNetwork, PackCaption>>
}) {
  const t = useT()
  const label = (f: CampaignFormatId) => t(`campaign.format.${f}`)
  const scheduled = useMemo(() => scheduledPieces(pieces), [pieces])
  const [month, setMonth] = useState(() => monthOf(scheduled[0]?.publish.date))

  const [link, setLink] = useState<CalendyLink | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [base, setBase] = useState('')
  const [token, setToken] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const [report, setReport] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    let live = true
    getCalendyLink()
      .then((l) => live && setLink(l))
      // No server (dev without the API), or signed out: no Calendy, nothing else lost.
      .catch(() => live && setLink({ connected: false }))
    return () => {
      live = false
      abort.current?.abort()
    }
  }, [])

  const byDay = useMemo(() => {
    const m = new Map<string, typeof scheduled>()
    for (const p of scheduled) m.set(p.publish.date, [...(m.get(p.publish.date) ?? []), p])
    return m
  }, [scheduled])

  const setDate = (p: Piece, date: string) => {
    const was = p.campaign.publish
    if (!date) return onPublish(p.id, undefined)
    onPublish(p.id, { ...was, date })
  }
  const setTime = (p: Piece, time: string) => {
    const was = p.campaign.publish
    if (!was) return
    const { time: _t, ...rest } = was
    onPublish(p.id, time ? { ...rest, time } : rest)
  }

  const filename = (ext: string) => `${fileBaseName(campaignName, 'campagne')}-calendrier.${ext}`
  const download = (kind: 'ics' | 'csv') => {
    const opts = { campaign: campaignName, formatLabel: label }
    const text = kind === 'ics' ? toIcs(scheduled, opts) : toCsv(scheduled, opts)
    downloadBlob(new Blob([text], { type: kind === 'ics' ? 'text/calendar;charset=utf-8' : 'text/csv;charset=utf-8' }), filename(kind))
  }

  async function connect() {
    setConnecting(true)
    setReport(null)
    try {
      setLink(await connectCalendy(base, token))
      setToken('')
    } catch (e) {
      setReport({ tone: 'warn', text: t('campaign.calendy.connectFailed', { error: e instanceof Error ? e.message : String(e) }) })
    } finally {
      setConnecting(false)
    }
  }

  async function send() {
    const { posts, skipped } = calendyDrafts(scheduled, campaignName, label, captions)
    if (!posts.length) return
    const ac = new AbortController()
    abort.current = ac
    setReport(null)
    setSending(t('campaign.calendy.sending', { n: 0, total: posts.length }))
    try {
      const results = await pushToCalendy(posts, screenOf, {
        signal: ac.signal,
        onProgress: (n, total) => setSending(t('campaign.calendy.sending', { n, total })),
      })
      // The id each piece became, so the next send updates it.
      for (const r of results) {
        const s = screenOf(r.screenId)
        const pub = s?.campaign?.publish
        if (r.calendyId && pub && pub.calendyId !== r.calendyId) onPublish(r.screenId, { ...pub, calendyId: r.calendyId })
      }
      const failed = results.filter((r) => r.error)
      const created = results.filter((r) => r.created).length
      const parts = [t('campaign.calendy.sent', { n: results.length - failed.length, created })]
      if (skipped.length) parts.push(t('campaign.calendy.skipped', { names: skipped.map((p) => label(p.format)).join(', ') }))
      for (const f of failed) parts.push(t('campaign.calendy.failedOne', { name: screenOf(f.screenId)?.name ?? '?', error: f.error ?? '' }))
      setReport({ tone: failed.length ? 'warn' : 'ok', text: parts.join(' ') })
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        setReport({ tone: 'warn', text: e instanceof Error ? e.message : String(e) })
      }
    } finally {
      abort.current = null
      setSending(null)
    }
  }

  const sendable = calendyDrafts(scheduled, campaignName, label).posts.length
  const busy = locked || !!sending || connecting
  const weekdays = t('campaign.calendar.weekdays').split(',')

  return (
    <section className="space-y-2 border-t border-line-soft pt-3">
      <span className="kicker">{t('campaign.calendar.title')}</span>
      <p className="text-caption text-ink-faint">{t('campaign.calendar.help')}</p>

      <ul className="space-y-1">
        {pieces.map((p) => (
          <li key={p.id} className="flex items-center gap-1.5">
            {/* The same short mark as in the month below: a full format name
                does not fit beside a date and a time in this panel. */}
            <span
              className="w-7 shrink-0 rounded bg-ink/[0.06] py-0.5 text-center text-[10px] font-semibold text-ink"
              title={`${label(p.campaign.format)} — ${p.name}`}
            >
              {t(`campaign.short.${p.campaign.format}`)}
            </span>
            <input
              type="date"
              className="input min-w-0 flex-1 px-1.5 py-1 text-caption"
              value={p.campaign.publish?.date ?? ''}
              aria-label={t('campaign.calendar.dateOf', { name: p.name })}
              onChange={(e) => setDate(p, e.target.value)}
            />
            <input
              type="time"
              className="input w-[4.75rem] shrink-0 px-1.5 py-1 text-caption"
              value={p.campaign.publish?.time ?? ''}
              disabled={!p.campaign.publish}
              aria-label={t('campaign.calendar.timeOf', { name: p.name })}
              onChange={(e) => setTime(p, e.target.value)}
            />
          </li>
        ))}
      </ul>

      {/* The month. Compact on purpose: seven columns in a 22rem panel. */}
      <div className="rounded-lg border border-line-soft p-2">
        <div className="mb-1 flex items-center justify-between">
          <button type="button" className="btn-ghost px-1.5 py-0.5" aria-label={t('campaign.calendar.prev')} onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            <Icon name="chevronLeft" size={14} />
          </button>
          <span className="text-body-sm font-medium text-ink">
            {new Date(`${month}-15T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </span>
          <button type="button" className="btn-ghost px-1.5 py-0.5" aria-label={t('campaign.calendar.next')} onClick={() => setMonth((m) => shiftMonth(m, 1))}>
            <Icon name="chevronRight" size={14} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center" role="grid" aria-label={t('campaign.calendar.title')}>
          {weekdays.map((d, i) => (
            <span key={i} className="text-caption text-ink-faint">
              {d}
            </span>
          ))}
          {monthGrid(month)
            .flat()
            .map((day, i) => {
              const here = day ? byDay.get(day) ?? [] : []
              return (
                <div key={i} className={`min-h-[2.4rem] rounded px-0.5 py-0.5 ${day ? 'bg-ink/[0.03]' : ''}`}>
                  {day && <span className="block text-[10px] leading-none text-ink-faint">{Number(day.slice(8))}</span>}
                  <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                    {here.map((p) => (
                      <button
                        key={p.screenId}
                        type="button"
                        onClick={() => onFocus(p.screenId)}
                        title={`${label(p.format)}${p.publish.time ? ` · ${p.publish.time}` : ''} — ${p.name}`}
                        className="rounded bg-accent px-0.5 text-[9px] font-semibold leading-tight text-on-accent"
                      >
                        {t(`campaign.short.${p.format}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="quiet" disabled={!scheduled.length} onClick={() => download('ics')}>
          <Icon name="calendar" size={14} />
          .ics
        </Button>
        <Button size="sm" variant="quiet" disabled={!scheduled.length} onClick={() => download('csv')}>
          <Icon name="download" size={14} />
          .csv
        </Button>
      </div>

      {/* Calendy */}
      <div className="space-y-1.5 rounded-lg border border-line-soft p-2">
        <span className="kicker">Calendy</span>
        {report && <Banner tone={report.tone}>{report.text}</Banner>}
        {sending && (
          <div className="flex items-center gap-2 text-body-sm text-ink" role="status">
            <Spinner className="h-4 w-4" />
            {sending}
          </div>
        )}
        {link === null ? (
          <Spinner className="h-4 w-4" />
        ) : link.connected ? (
          <>
            <Button variant="primary" size="sm" className="w-full" disabled={busy || !sendable} onClick={() => void send()}>
              <Icon name="upload" size={14} />
              {t('campaign.calendy.send', { count: sendable })}
            </Button>
            <p className="text-caption text-ink-faint">{t('campaign.calendy.sendHelp')}</p>
            <p className="flex items-center justify-between gap-2 text-caption text-ink-faint">
              <span className="truncate">{t('campaign.calendy.connectedTo', { host: link.host ?? '' })}</span>
              <button
                type="button"
                className="shrink-0 underline hover:text-ink"
                disabled={busy}
                onClick={() => void disconnectCalendy().then(setLink).catch(() => undefined)}
              >
                {t('campaign.calendy.disconnect')}
              </button>
            </p>
          </>
        ) : (
          <form
            className="space-y-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              void connect()
            }}
          >
            <p className="text-caption text-ink-faint">{t('campaign.calendy.connectHelp')}</p>
            <input
              className="input w-full text-caption"
              type="url"
              placeholder="https://calendy.example.org"
              value={base}
              aria-label={t('campaign.calendy.address')}
              onChange={(e) => setBase(e.target.value)}
            />
            <input
              className="input w-full text-caption"
              type="password"
              autoComplete="off"
              placeholder={t('campaign.calendy.token')}
              value={token}
              aria-label={t('campaign.calendy.token')}
              onChange={(e) => setToken(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={busy || !base.trim() || !token.trim()}>
              {connecting ? <Spinner className="h-3.5 w-3.5" /> : <Icon name="plug" size={14} />}
              {t('campaign.calendy.connect')}
            </Button>
          </form>
        )}
      </div>
    </section>
  )
}
