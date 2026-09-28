import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { setAnnouncement } from '../../lib/announcement'
import { momentToken, type MomentKind } from '../../lib/announcementText'
import { Banner, Button, Field, Input, Segmented, Select, Textarea } from '../../ui'
import { useT } from '../../i18n'
import AnnouncementMessage from '../AnnouncementMessage'
import { SectionHead } from './AdminDashboard'
import { useFmt } from './format'
import type { useDashboard } from './useDashboard'

type Live = ReturnType<typeof useDashboard>

/** Offered durations, in hours. `0` is "until I remove it". */
const DURATIONS = [0, 1, 4, 24, 72, 168] as const
const MAX = 500
const MOMENT_KINDS: MomentKind[] = ['datetime', 'date', 'time']

/**
 * `<input type="datetime-local">` speaks the browser's local clock with no zone:
 * "2026-09-29T03:22". This is the admin's clock, and `new Date(value)` reads it
 * back the same way, so the pair round-trips without ever naming a zone.
 */
function toLocalInput(at: number): string {
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** The next whole hour, at least 30 minutes away: a sensible first proposal. */
function nextHour(): number {
  const d = new Date(Date.now() + 30 * 60_000)
  d.setMinutes(0, 0, 0)
  return d.getTime() + 3600_000
}

/**
 * A message for everybody, shown under the masthead from its start until it
 * expires or is removed (server/admin/announcement.js). Signed-out visitors see
 * it too, on the sign-in screen: "Mocky will restart at 22:00" is for them as
 * well. One announcement at a time — scheduling one replaces the current one.
 */
export default function AnnouncementSection({ live }: { live: Live }) {
  const t = useT()
  const f = useFmt()
  const current = live.data?.announcement ?? null
  const [message, setMessage] = useState(current?.message ?? '')
  const [tone, setTone] = useState<'info' | 'warn'>(current?.tone ?? 'info')
  const [hours, setHours] = useState<number>(0)
  const [when, setWhen] = useState<'now' | 'later'>(current?.status === 'scheduled' ? 'later' : 'now')
  const [startLocal, setStartLocal] = useState(() =>
    toLocalInput(current?.status === 'scheduled' && current.startsAt ? current.startsAt : nextHour()),
  )
  const [momentLocal, setMomentLocal] = useState(() => toLocalInput(nextHour()))
  const [momentKind, setMomentKind] = useState<MomentKind>('datetime')
  /** Where the caret was last seen in the message, for "Insert". */
  const [caret, setCaret] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // The live stream may deliver the announcement after the first render.
  useEffect(() => {
    if (current && !message) {
      setMessage(current.message)
      setTone(current.tone)
      if (current.status === 'scheduled' && current.startsAt) {
        setWhen('later')
        setStartLocal(toLocalInput(current.startsAt))
      }
    }
    // Keyed on the id alone: re-running on `message` would refill the field
    // every time the admin emptied it to write something new.
  }, [current?.id])

  const startAt = when === 'later' ? new Date(startLocal).getTime() : null
  const startInvalid = when === 'later' && (!Number.isFinite(startAt) || (startAt as number) <= Date.now())

  function insertMoment() {
    const at = new Date(momentLocal)
    if (!Number.isFinite(at.getTime())) return
    const token = momentToken(momentKind, at)
    const i = caret ?? message.length
    const next = message.slice(0, i) + token + message.slice(i)
    if (next.length > MAX) {
      setError(t('dashboard.announce.tooLong'))
      return
    }
    setMessage(next)
    setCaret(i + token.length)
    setError(null)
  }

  async function publish() {
    if (startInvalid) {
      setError(t('dashboard.announce.startPast'))
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const a = await api.admin.dashboard.setAnnouncement(
        message.trim(),
        tone,
        hours || null,
        startAt != null ? new Date(startAt).toISOString() : null,
      )
      // This tab shows it now rather than at the next minute's poll — unless it
      // is scheduled, in which case the banner is exactly what must NOT show yet.
      setAnnouncement(a?.status === 'live' ? a : null)
      live.setData((prev) => (prev ? { ...prev, announcement: a } : prev))
      setNotice(t(a?.status === 'scheduled' ? 'dashboard.announce.scheduledNotice' : 'dashboard.announce.published'))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await api.admin.dashboard.clearAnnouncement()
      setAnnouncement(null)
      live.setData((prev) => (prev ? { ...prev, announcement: null } : prev))
      setNotice(t('dashboard.announce.removed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const text = message.trim()
  const endAt = hours ? (startAt ?? Date.now()) + hours * 3600_000 : null

  return (
    <section>
      <SectionHead kicker={t('dashboard.nav.announcement')} title={t('dashboard.announce.title')} blurb={t('dashboard.announce.blurb')} />

      {error && (
        <Banner tone="danger" title={t('common.error')} className="mb-4">
          {error}
        </Banner>
      )}
      {notice && !error && (
        <Banner tone="ok" className="mb-4">
          {notice}
        </Banner>
      )}

      <div className="grid gap-x-12 gap-y-8 xl:grid-cols-2">
        <div className="space-y-5">
          <div>
            <Field label={t('dashboard.announce.message')} hint={t('dashboard.announce.count', { n: message.length, max: MAX })}>
              {(p) => (
                <Textarea
                  {...p}
                  rows={4}
                  maxLength={MAX}
                  value={message}
                  placeholder={t('dashboard.announce.placeholder')}
                  onChange={(e) => {
                    setMessage(e.currentTarget.value)
                    setCaret(e.currentTarget.selectionStart)
                  }}
                  onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
                />
              )}
            </Field>

            {/* A date in the text is an instant: every reader sees it on their
                own clock (lib/announcementText.ts). */}
            <div className="mt-3 border border-line-soft bg-ink/5 p-3">
              <span className="block text-body-sm font-medium text-ink">{t('dashboard.announce.moment')}</span>
              <span className="measure mt-0.5 block text-caption text-ink-muted">{t('dashboard.announce.momentHelp')}</span>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="w-52">
                  <Input
                    type="datetime-local"
                    aria-label={t('dashboard.announce.momentWhen')}
                    value={momentLocal}
                    onChange={(e) => setMomentLocal(e.currentTarget.value)}
                  />
                </div>
                <div className="w-44">
                  <Select
                    aria-label={t('dashboard.announce.momentKind')}
                    value={momentKind}
                    onChange={(e) => setMomentKind(e.currentTarget.value as MomentKind)}
                  >
                    {MOMENT_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t(`dashboard.announce.kind.${k}`)}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button size="sm" onClick={insertMoment} disabled={!momentLocal}>
                  {t('dashboard.announce.insert')}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <div>
              <span className="mb-1 block text-body-sm font-medium text-ink">{t('dashboard.announce.tone')}</span>
              <Segmented
                label={t('dashboard.announce.tone')}
                value={tone}
                onChange={(v) => setTone(v ?? tone)}
                options={[
                  { value: 'info', label: t('dashboard.announce.toneInfo') },
                  { value: 'warn', label: t('dashboard.announce.toneWarn') },
                ]}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <div>
              <span className="mb-1 block text-body-sm font-medium text-ink">{t('dashboard.announce.start')}</span>
              <Segmented
                label={t('dashboard.announce.start')}
                value={when}
                onChange={(v) => setWhen(v ?? when)}
                options={[
                  { value: 'now', label: t('dashboard.announce.startNow') },
                  { value: 'later', label: t('dashboard.announce.startLater') },
                ]}
              />
            </div>
            {when === 'later' && (
              <div className="w-56">
                <Field
                  label={t('dashboard.announce.startAt')}
                  error={startInvalid ? t('dashboard.announce.startPast') : null}
                >
                  {(p) => (
                    <Input {...p} type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.currentTarget.value)} />
                  )}
                </Field>
              </div>
            )}
            <div className="w-56">
              <Field label={t('dashboard.announce.duration')} hint={when === 'later' ? t('dashboard.announce.durationFromStart') : undefined}>
                {(p) => (
                  <Select {...p} value={hours} onChange={(e) => setHours(Number(e.currentTarget.value))}>
                    {DURATIONS.map((h) => (
                      <option key={h} value={h}>
                        {t(`dashboard.announce.for.${h}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={busy || !text || startInvalid} onClick={publish}>
              {when === 'later'
                ? t('dashboard.announce.schedule')
                : current
                  ? t('dashboard.announce.update')
                  : t('dashboard.announce.publish')}
            </Button>
            {current && (
              <Button disabled={busy} onClick={remove}>
                {t('dashboard.announce.remove')}
              </Button>
            )}
          </div>
          {current && <p className="text-caption text-ink-muted">{t('dashboard.announce.oneAtATime')}</p>}
        </div>

        <div>
          <div className="section-head">
            <span className="kicker text-accent-ink">{t('dashboard.announce.preview')}</span>
          </div>
          {/* The same markup the banner uses, so the preview is not a promise. */}
          <div className={`border-b ${tone === 'warn' ? 'border-warn bg-warn/10' : 'border-accent bg-accent/10'}`}>
            <div className="flex items-center gap-3 px-3 py-1.5 text-body-sm">
              <span className={`kicker shrink-0 ${tone === 'warn' ? 'text-warn' : 'text-accent-ink'}`}>{t('dashboard.announce.kicker')}</span>
              <span className="min-w-0 flex-1 text-ink">
                {text ? <AnnouncementMessage message={text} /> : <span className="text-ink-faint">{t('dashboard.announce.placeholder')}</span>}
              </span>
            </div>
          </div>
          <p className="mt-2 text-caption text-ink-muted">{t('dashboard.announce.previewZone')}</p>
          <p className="mt-3 text-body-sm text-ink-muted">
            {when === 'later' && startAt && !startInvalid
              ? endAt
                ? t('dashboard.announce.willRunUntil', { start: f.date(startAt), end: f.date(endAt) })
                : t('dashboard.announce.willRun', { start: f.date(startAt) })
              : null}
          </p>

          <div className="section-head mt-6">
            <span className="kicker text-accent-ink">{t('dashboard.announce.current')}</span>
          </div>
          {!current ? (
            <p className="text-body-sm text-ink-muted">{t('dashboard.announce.none')}</p>
          ) : (
            <div className="space-y-1 text-body-sm">
              <p className="text-ink">
                {current.status === 'scheduled'
                  ? t('dashboard.announce.scheduledFor', { when: f.date(current.startsAt as number) })
                  : t('dashboard.announce.isLive')}
                {' · '}
                {current.expiresAt ? t('dashboard.announce.until', { when: f.date(current.expiresAt) }) : t('dashboard.announce.noEnd')}
              </p>
              <p className="text-ink-muted">
                <AnnouncementMessage message={current.message} />
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
