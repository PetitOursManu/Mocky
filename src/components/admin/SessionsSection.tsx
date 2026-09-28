import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import type { SessionRow } from '../../lib/dashboard'
import { Banner, Button, Input } from '../../ui'
import { useT } from '../../i18n'
import { SectionHead } from './AdminDashboard'
import { useFmt } from './format'

/**
 * Every device signed in to the instance, and a way to end any one of them.
 *
 * A row is a session, identified by a hash of its token — the token itself is
 * the credential and never reaches this screen (server/admin/sessions.js).
 * Revoking one leaves the account's other devices signed in; "sign out
 * everywhere" is on the Users screen, beside the account it belongs to.
 */
export default function SessionsSection() {
  const t = useT()
  const f = useFmt()
  const [rows, setRows] = useState<SessionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      setRows(await api.admin.dashboard.sessions())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  useEffect(() => {
    load()
  }, [])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!rows) return []
    if (!q) return rows
    return rows.filter((r) => [r.username, r.device, r.ip].some((x) => x?.toLowerCase().includes(q)))
  }, [rows, query])

  async function revoke(r: SessionRow) {
    if (!confirm(t('dashboard.sessions.revokeConfirm', { name: r.username, device: r.device || t('dashboard.sessions.unknownDevice') }))) return
    setBusy(r.id)
    setNotice(null)
    try {
      await api.admin.dashboard.revokeSession(r.id)
      setNotice(t('dashboard.sessions.revoked', { name: r.username }))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section>
      <SectionHead
        kicker={t('dashboard.nav.sessions')}
        title={t('dashboard.sessions.title')}
        blurb={t('dashboard.sessions.blurb')}
        actions={
          <Button size="sm" onClick={load}>
            {t('dashboard.refresh')}
          </Button>
        }
      />
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

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs">
          <Input
            type="search"
            value={query}
            aria-label={t('dashboard.sessions.search')}
            placeholder={t('dashboard.sessions.search')}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </div>
        {rows && (
          <span className="font-mono text-caption text-ink-muted">
            {t('dashboard.sessions.count', { n: shown.length, total: rows.length })}
          </span>
        )}
      </div>

      {!rows ? (
        <p className="text-body text-ink-faint">{t('common.loading')}</p>
      ) : shown.length === 0 ? (
        <p className="text-body text-ink-faint">{t('dashboard.sessions.none')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-body-sm">
            <thead>
              <tr className="border-b border-line-soft text-caption uppercase tracking-wide text-ink-muted">
                <th className="py-1.5 pr-3 font-semibold">{t('dashboard.activity.colUser')}</th>
                <th className="py-1.5 pr-3 font-semibold">{t('dashboard.sessions.colDevice')}</th>
                <th className="py-1.5 pr-3 font-semibold">{t('dashboard.sessions.colIp')}</th>
                <th className="py-1.5 pr-3 font-semibold">{t('dashboard.sessions.colOpened')}</th>
                <th className="py-1.5 pr-3 font-semibold">{t('dashboard.sessions.colUsed')}</th>
                <th className="py-1.5 font-semibold">
                  <span className="sr-only">{t('dashboard.sessions.colActions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b border-line-soft">
                  <td className="py-2 pr-3 text-ink">
                    {r.username}
                    {r.role === 'admin' && <span className="ml-2 text-caption uppercase text-accent-ink">{t('settings.roleAdminShort')}</span>}
                  </td>
                  <td className="py-2 pr-3 text-ink-muted">{r.device || t('dashboard.sessions.unknownDevice')}</td>
                  <td className="py-2 pr-3 font-mono text-caption text-ink-muted">{r.ip || '—'}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-ink-muted">
                    {r.createdAt ? f.date(r.createdAt) : t('dashboard.sessions.before')}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-ink-muted">{f.ago(r.lastUsedAt)}</td>
                  <td className="py-2 text-right">
                    {r.current ? (
                      <span className="text-caption font-semibold uppercase text-accent-ink">{t('dashboard.sessions.current')}</span>
                    ) : (
                      <Button size="sm" variant="quiet" disabled={busy === r.id} onClick={() => revoke(r)}>
                        {t('dashboard.sessions.revoke')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="measure mt-4 text-caption text-ink-muted">{t('dashboard.sessions.footnote')}</p>
    </section>
  )
}
