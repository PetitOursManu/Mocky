import { useCallback, useEffect, useRef, useState } from 'react'
import {
  api,
  type MigrationCheck,
  type MigrationImportStatus,
  type MigrationSourceStatus,
  type MigrationSummary,
  type MigrationVerifyResult,
} from '../lib/api'
import { setMaintenance as publishMaintenance, type MaintenanceState } from '../lib/maintenance'
import { splitBytes, type ByteUnit } from '../lib/bytes'
import { Banner, Button, Field, Input } from '../ui'
import { useT } from '../i18n'

const UNIT_KEY: Record<ByteUnit, string> = {
  b: 'admin.unitB',
  kb: 'admin.unitKB',
  mb: 'admin.unitMB',
  gb: 'admin.unitGB',
}

/** While a pass runs. Fast enough to read as progress, slow enough to cost nothing. */
const PASS_POLL_MS = 1000

/** The error a route answered with, keyed on its code when it has one (api.ts attaches it). */
function useErrorText() {
  const t = useT()
  return (e: unknown) => {
    const code = (e as { code?: string } | null)?.code
    if (code) {
      const key = `migration.error.${code}`
      const text = t(key)
      if (text !== key) return text
    }
    return e instanceof Error ? e.message : String(e)
  }
}

/**
 * Maintenance mode and the server-to-server migration, on one screen because
 * they are one procedure: the old server's final pass is only final while it is
 * read-only. The order on the page is the order of the steps. The reasoning
 * behind each is at the top of the server files it calls (server/maintenance.js,
 * server/migration/*) and in docs/migration.md.
 */
export default function MigrationSettings() {
  const t = useT()
  const size = (n: number) => {
    const { value, unit } = splitBytes(n)
    return `${value.toLocaleString()} ${t(UNIT_KEY[unit])}`
  }
  return (
    <section>
      <div className="section-head">
        <span className="kicker text-accent-ink">{t('migration.heading')}</span>
      </div>
      <p className="measure text-body text-ink-muted">{t('migration.blurb')}</p>

      <MaintenanceBlock />

      <div className="mt-8 grid gap-x-12 gap-y-10 lg:grid-cols-2">
        <SourceBlock size={size} />
        <ImportBlock size={size} />
      </div>
    </section>
  )
}

function MaintenanceBlock() {
  const t = useT()
  const errorText = useErrorText()
  const [state, setState] = useState<MaintenanceState | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.admin
      .getMaintenance()
      .then((m) => {
        setState(m)
        setMessage(m.message)
      })
      .catch((e) => setError(errorText(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save(on: boolean) {
    setBusy(true)
    setError(null)
    try {
      const m = await api.admin.setMaintenance(on, message)
      setState(m)
      // The banner on this very page, without waiting for its next poll.
      publishMaintenance(m)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 space-y-3 border border-line-soft bg-ink/5 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="kicker">{t('migration.maintenance.title')}</span>
        {state?.on && (
          <span className="rounded-full bg-warn/15 px-2 py-0.5 text-caption font-semibold uppercase text-warn">
            {t('migration.maintenance.activeSince', { time: state.since ? new Date(state.since).toLocaleString() : '—' })}
          </span>
        )}
      </div>
      <p className="measure text-body-sm text-ink-muted">{t('migration.maintenance.help')}</p>
      <Field label={t('migration.maintenance.messageLabel')} hint={t('migration.maintenance.messageHint')}>
        {(p) => (
          <Input
            {...p}
            value={message}
            maxLength={500}
            placeholder={t('migration.maintenance.messagePlaceholder')}
            onChange={(e) => setMessage(e.currentTarget.value)}
          />
        )}
      </Field>
      {error && <Banner tone="danger">{error}</Banner>}
      <div className="flex flex-wrap gap-2">
        {state?.on ? (
          <>
            <Button variant="primary" disabled={busy} onClick={() => save(false)}>
              {t('migration.maintenance.turnOff')}
            </Button>
            <Button disabled={busy || message === state.message} onClick={() => save(true)}>
              {t('migration.maintenance.saveMessage')}
            </Button>
          </>
        ) : (
          <Button variant="danger" disabled={busy || !state} onClick={() => save(true)}>
            {t('migration.maintenance.turnOn')}
          </Button>
        )}
      </div>
    </div>
  )
}

// ---- old server --------------------------------------------------------------

function SourceBlock({ size }: { size: (n: number) => string }) {
  const t = useT()
  const errorText = useErrorText()
  const [status, setStatus] = useState<MigrationSourceStatus | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(() => {
    api.admin
      .migrationSource()
      .then(setStatus)
      .catch((e) => setError(errorText(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    refresh()
    // The destination's progress shows up here as bytes served and last contact.
    const id = window.setInterval(refresh, 5000)
    return () => window.clearInterval(id)
  }, [refresh])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const out = await api.admin.createMigrationCode(password)
      setCode(out.code)
      setStatus(out)
      setPassword('')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    setBusy(true)
    try {
      setStatus(await api.admin.revokeMigrationCode())
      setCode(null)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h3 className="text-h3 text-ink">{t('migration.source.title')}</h3>
      <p className="measure mt-1 text-body-sm text-ink-muted">{t('migration.source.help')}</p>
      {error && (
        <Banner tone="danger" className="mt-3">
          {error}
        </Banner>
      )}

      {status?.active ? (
        <div className="mt-3 space-y-3 border border-line-soft bg-ink/5 p-3">
          {code ? (
            <>
              <p className="text-body-sm text-ink">{t('migration.source.codeOnce')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="select-all break-all border border-line-soft bg-surface px-3 py-2 font-mono text-body text-ink">
                  {code}
                </code>
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(code)
                      setCopied(true)
                      window.setTimeout(() => setCopied(false), 2000)
                    } catch {
                      /* the code is selectable anyway */
                    }
                  }}
                >
                  {copied ? t('migration.source.copied') : t('migration.source.copy')}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-body-sm text-ink-muted">{t('migration.source.codeHidden')}</p>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body-sm">
            <dt className="text-ink-muted">{t('migration.source.expires')}</dt>
            <dd className="text-ink">{status.expiresAt ? new Date(status.expiresAt).toLocaleString() : '—'}</dd>
            <dt className="text-ink-muted">{t('migration.source.lastSeen')}</dt>
            <dd className="text-ink">
              {status.lastSeen
                ? t('migration.source.lastSeenValue', {
                    time: new Date(status.lastSeen).toLocaleString(),
                    ip: status.lastIp || '?',
                  })
                : t('migration.source.never')}
            </dd>
            <dt className="text-ink-muted">{t('migration.source.served')}</dt>
            <dd className="font-mono text-ink">{size(status.bytes || 0)}</dd>
          </dl>
          <Button variant="danger" size="sm" disabled={busy} onClick={revoke}>
            {t('migration.source.revoke')}
          </Button>
        </div>
      ) : (
        <form onSubmit={create} className="mt-3 space-y-3 border border-line-soft bg-ink/5 p-3">
          <Banner tone="warn">{t('migration.source.warning')}</Banner>
          <Field label={t('migration.confirmPassword')} hint={t('migration.confirmPasswordHint')}>
            {(p) => (
              <Input
                {...p}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
              />
            )}
          </Field>
          <Button type="submit" variant="primary" disabled={busy}>
            {t('migration.source.create')}
          </Button>
        </form>
      )}
    </div>
  )
}

// ---- new server --------------------------------------------------------------

function ImportBlock({ size }: { size: (n: number) => string }) {
  const t = useT()
  const errorText = useErrorText()
  const [status, setStatus] = useState<MigrationImportStatus | null>(null)
  const [url, setUrl] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restarting, setRestarting] = useState(false)
  const [verify, setVerify] = useState<MigrationVerifyResult | null>(null)
  const pollRef = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.admin.migrationImport())
    } catch (e) {
      setError(errorText(e))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])

  const running = Boolean(status?.pass?.running)
  useEffect(() => {
    if (!running) return
    pollRef.current = window.setInterval(refresh, PASS_POLL_MS)
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [running, refresh])

  async function act(fn: () => Promise<MigrationImportStatus | unknown>) {
    setBusy(true)
    setError(null)
    try {
      const out = await fn()
      if (out && typeof out === 'object' && 'connected' in out) setStatus(out as MigrationImportStatus)
      else await refresh()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function finalize(e: React.FormEvent) {
    e.preventDefault()
    if (!window.confirm(t('migration.import.finalizeConfirm'))) return
    setBusy(true)
    setError(null)
    try {
      await api.admin.finalizeMigration(password)
      setPassword('')
      setRestarting(true)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (restarting) {
    return (
      <div>
        <h3 className="text-h3 text-ink">{t('migration.import.title')}</h3>
        <Banner tone="ok" title={t('migration.import.doneTitle')} className="mt-3">
          {t('migration.import.doneBody')}
        </Banner>
        <Button className="mt-3" variant="primary" onClick={() => window.location.reload()}>
          {t('migration.import.reload')}
        </Button>
      </div>
    )
  }

  const pass = status?.pass

  return (
    <div>
      <h3 className="text-h3 text-ink">{t('migration.import.title')}</h3>
      <p className="measure mt-1 text-body-sm text-ink-muted">{t('migration.import.help')}</p>
      {error && (
        <Banner tone="danger" className="mt-3">
          {error}
        </Banner>
      )}

      {status?.report && !status.connected && (
        <div className="mt-3 space-y-2 border border-line-soft bg-ink/5 p-3">
          <p className="text-body-sm text-ink">
            {t('migration.import.lastReport', {
              time: new Date(status.report.finishedAt).toLocaleString(),
              source: status.report.source,
            })}
          </p>
          <SummaryList summary={status.report.summary} size={size} />
          <Button size="sm" disabled={busy} onClick={() => act(async () => setVerify(await api.admin.verifyMigration()))}>
            {busy ? t('migration.import.verifying') : t('migration.import.verify')}
          </Button>
          {verify && (
            <Banner tone={verify.same === verify.total ? 'ok' : 'warn'}>
              {t('migration.import.verifyResult', {
                same: verify.same,
                total: verify.total,
                changed: verify.changedCount,
                missing: verify.missingCount,
              })}
            </Banner>
          )}
        </div>
      )}

      {!status?.connected ? (
        <form
          className="mt-3 space-y-3 border border-line-soft bg-ink/5 p-3"
          onSubmit={(e) => {
            e.preventDefault()
            void act(() => api.admin.connectMigration(url, code))
          }}
        >
          <Field label={t('migration.import.url')} hint={t('migration.import.urlHint')}>
            {(p) => (
              <Input
                {...p}
                value={url}
                inputMode="url"
                spellCheck={false}
                placeholder="https://mocky.ancien-serveur.fr"
                onChange={(e) => setUrl(e.currentTarget.value)}
              />
            )}
          </Field>
          <Field label={t('migration.import.code')}>
            {(p) => (
              <Input
                {...p}
                value={code}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                onChange={(e) => setCode(e.currentTarget.value)}
              />
            )}
          </Field>
          <Button type="submit" variant="primary" disabled={busy || !url.trim() || !code.trim()}>
            {busy ? t('migration.import.connecting') : t('migration.import.connect')}
          </Button>
        </form>
      ) : (
        <div className="mt-3 space-y-4 border border-line-soft bg-ink/5 p-3">
          <p className="text-body-sm text-ink">
            {t('migration.import.connectedTo', { source: status.source || '' })}
          </p>
          {status.summary && <SummaryList summary={status.summary} size={size} />}
          {status.preflight && <Checklist checks={status.preflight.checks} size={size} />}
          {status.preflight?.blocking && <Banner tone="danger">{t('migration.import.blocking')}</Banner>}

          {pass && (
            <div className="space-y-2">
              <div className="h-2 w-full bg-line-soft">
                <div
                  className="h-2 bg-accent transition-[width]"
                  style={{
                    width: `${pass.bytesTotal ? Math.min(100, Math.round((pass.bytesDone / pass.bytesTotal) * 100)) : pass.running ? 0 : 100}%`,
                  }}
                />
              </div>
              <p className="font-mono text-caption text-ink-muted">
                {t('migration.import.progress', {
                  files: pass.filesDone,
                  total: pass.filesTotal,
                  done: size(Math.max(0, pass.bytesDone)),
                  bytes: size(pass.bytesTotal),
                })}
                {pass.running && pass.current ? ` · ${pass.current}` : ''}
              </p>
              {!pass.running && pass.error && (
                <Banner tone="danger">{t(`migration.error.${pass.error}`)}</Banner>
              )}
              {!pass.running && !pass.error && pass.failedCount > 0 && (
                <Banner tone="warn" title={t('migration.import.failedFiles', { n: pass.failedCount })}>
                  <ul className="font-mono text-caption">
                    {pass.failed.map((f) => (
                      <li key={f.path}>{f.path}</li>
                    ))}
                  </ul>
                </Banner>
              )}
              {!pass.running && !pass.error && pass.failedCount === 0 && !status.ready && (
                <Banner tone="info">{t('migration.import.passNotFinal')}</Banner>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {running ? (
              <Button disabled={busy} onClick={() => act(() => api.admin.cancelMigrationPass())}>
                {t('migration.import.cancel')}
              </Button>
            ) : (
              <Button
                variant={status.ready ? 'ghost' : 'primary'}
                disabled={busy || Boolean(status.preflight?.blocking)}
                onClick={() => act(() => api.admin.startMigrationPass())}
              >
                {pass ? t('migration.import.passAgain') : t('migration.import.pass')}
              </Button>
            )}
            <Button variant="quiet" disabled={busy || running} onClick={() => act(() => api.admin.disconnectMigration())}>
              {t('migration.import.disconnect')}
            </Button>
          </div>

          {status.ready && (
            <form onSubmit={finalize} className="space-y-3 border-t border-line-soft pt-3">
              <Banner tone="warn" title={t('migration.import.finalizeTitle')}>
                {t('migration.import.finalizeBody')}
              </Banner>
              <Field label={t('migration.confirmPassword')} hint={t('migration.confirmPasswordHint')}>
                {(p) => (
                  <Input
                    {...p}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                  />
                )}
              </Field>
              <Button type="submit" variant="danger" disabled={busy}>
                {t('migration.import.finalize')}
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryList({ summary, size }: { summary: MigrationSummary; size: (n: number) => string }) {
  const t = useT()
  const rows: [string, string | number][] = [
    [t('migration.summary.users'), summary.users],
    [t('migration.summary.projects'), summary.projectFiles],
    [t('migration.summary.images'), summary.images],
    [t('migration.summary.clips'), summary.clips],
    [t('migration.summary.films'), summary.films],
    [t('migration.summary.total'), t('migration.summary.totalValue', { files: summary.files, bytes: size(summary.bytes) })],
  ]
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-muted">{k}</dt>
          <dd className="font-mono text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

const MARK: Record<MigrationCheck['status'], { glyph: string; ink: string }> = {
  ok: { glyph: '✓', ink: 'text-ok' },
  warn: { glyph: '!', ink: 'text-warn' },
  fail: { glyph: '✕', ink: 'text-danger' },
}

function Checklist({ checks, size }: { checks: MigrationCheck[]; size: (n: number) => string }) {
  const t = useT()
  return (
    <div>
      <div className="kicker mb-1">{t('migration.check.heading')}</div>
      <ul className="space-y-1">
        {checks.map((c) => {
          const params: Record<string, string | number> = { ...(c.params || {}) }
          // Bytes arrive as numbers and are shown in the reader's units.
          for (const k of ['needed', 'free']) if (typeof params[k] === 'number') params[k] = size(params[k] as number)
          const key =
            c.id === 'sso' && c.status === 'warn' ? `migration.check.sso.${params.reason}` : `migration.check.${c.id}.${c.status}`
          const mark = MARK[c.status]
          return (
            <li key={c.id} className="flex gap-2 text-body-sm">
              <span aria-hidden className={`w-4 shrink-0 text-center font-semibold ${mark.ink}`}>
                {mark.glyph}
              </span>
              <span className="sr-only">{t(`migration.status.${c.status}`)}</span>
              <span className={c.status === 'ok' ? 'text-ink-muted' : 'text-ink'}>{t(key, params)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
