import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { AuditEntry } from '../../lib/dashboard'
import { Banner, Button } from '../../ui'
import { useT } from '../../i18n'
import { SectionHead } from './AdminDashboard'
import { useFmt } from './format'

/** The server's groups: the part of an action before the dot. */
const GROUPS = ['auth', 'account', 'user', 'session', 'config', 'maintenance', 'announcement', 'migration', 'mcp'] as const
const PAGE = 100

/**
 * Who did what, newest first: sign-ins and their failures, accounts, sessions,
 * settings, maintenance, announcements, migrations.
 *
 * Kept on disk (server/admin/audit.js) because it answers questions asked
 * after the fact. A settings change shows WHICH fields changed and never their
 * values — the value of a provider key field is the key.
 */
export default function AuditSection() {
  const t = useT()
  const f = useFmt()
  const [group, setGroup] = useState<string | null>(null)
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    async (before: string | null) => {
      setBusy(true)
      try {
        const page = await api.admin.dashboard.audit({ group, before, limit: PAGE })
        setEntries((prev) => (before && prev ? [...prev, ...page] : page))
        setMore(page.length === PAGE)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [group],
  )

  useEffect(() => {
    setEntries(null)
    load(null)
  }, [load])

  return (
    <section>
      <SectionHead
        kicker={t('dashboard.nav.audit')}
        title={t('dashboard.audit.title')}
        blurb={t('dashboard.audit.blurb')}
        actions={
          <Button size="sm" onClick={() => load(null)} disabled={busy}>
            {t('dashboard.refresh')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1" role="group" aria-label={t('dashboard.audit.filter')}>
        {[null, ...GROUPS].map((g) => {
          const on = g === group
          return (
            <button
              key={g ?? 'all'}
              type="button"
              aria-pressed={on}
              onClick={() => setGroup(g)}
              className={
                'tap-target min-h-8 border px-2.5 text-body-sm ' +
                (on ? 'border-line bg-ink text-surface' : 'border-line-soft text-ink-muted hover:text-ink')
              }
            >
              {t(`dashboard.audit.group.${g ?? 'all'}`)}
            </button>
          )
        })}
      </div>

      {error && (
        <Banner tone="danger" title={t('common.error')} className="mb-4">
          {error}
        </Banner>
      )}

      {!entries ? (
        <p className="text-body text-ink-faint">{t('common.loading')}</p>
      ) : entries.length === 0 ? (
        <p className="text-body text-ink-faint">{t('dashboard.audit.empty')}</p>
      ) : (
        <ol className="border-t border-line-soft">
          {entries.map((e) => (
            <li
              key={e.id}
              className="grid gap-x-4 gap-y-0.5 border-b border-line-soft py-2 text-body-sm sm:grid-cols-[9rem_minmax(0,1fr)_auto]"
            >
              <span className="font-mono text-caption text-ink-faint">{f.date(e.at)}</span>
              <span className="min-w-0">
                <span className={e.action === 'auth.login-failed' || e.action === 'auth.locked' ? 'text-warn' : 'text-ink'}>
                  {t(`dashboard.audit.action.${e.action}`, {
                    actor: e.actor?.name || t('dashboard.audit.someone'),
                    target: e.target?.name || '—',
                  })}
                </span>
                <Detail detail={e.detail} />
              </span>
              <span className="font-mono text-caption text-ink-faint">{e.ip || ''}</span>
            </li>
          ))}
        </ol>
      )}

      {more && (
        <div className="mt-4">
          <Button size="sm" disabled={busy} onClick={() => load(entries?.[entries.length - 1]?.id ?? null)}>
            {t('dashboard.audit.more')}
          </Button>
        </div>
      )}
    </section>
  )
}

/** The facts an entry carries, in words where there are words for them. */
function Detail({ detail }: { detail: AuditEntry['detail'] }) {
  const t = useT()
  if (!detail) return null
  const parts: string[] = []
  for (const [k, v] of Object.entries(detail)) {
    if (k === 'fields' && Array.isArray(v)) {
      parts.push(t('dashboard.audit.fields', { list: v.join(', ') }))
      continue
    }
    // A key the dictionary does not know is shown as itself: the log is
    // written by the server, and an entry from a newer version must still read.
    const labelKey = `dashboard.audit.detail.${k}`
    const label = t(labelKey) === labelKey ? k : t(labelKey)
    const value =
      typeof v === 'boolean'
        ? t(v ? 'dashboard.audit.yes' : 'dashboard.audit.no')
        : k === 'role'
          ? t(v === 'admin' ? 'settings.roleAdmin' : 'settings.roleUser')
          : (k === 'plan' || k === 'newAccounts') && (v === 'free' || v === 'standard')
            ? t(`plan.${v}`)
            : k === 'tone'
              ? t(v === 'warn' ? 'dashboard.announce.toneWarn' : 'dashboard.announce.toneInfo')
              : Array.isArray(v)
                ? v.join(', ')
                : String(v)
    parts.push(t('dashboard.audit.pair', { label, value }))
  }
  return <span className="mt-0.5 block text-caption text-ink-muted">{parts.join(' · ')}</span>
}
