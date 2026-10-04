import { useEffect, useState } from 'react'
import { api, type AdminMcpView, type McpConfig, type VideoAccessMode } from '../../lib/api'
import { Banner, Button, Field, Icon, Input, Select } from '../../ui'
import { useT } from '../../i18n'
import { AccountScope } from '../VideoExportSettings'
import { SectionHead } from './AdminDashboard'
import RunnerPanel from './RunnerPanel'

/**
 * Admin → Assistants (MCP): whether Claude, ChatGPT and other MCP clients may
 * act in this Mocky on behalf of an account (server/mcp/).
 *
 * Always visible, LOCKED until HTTPS is valid. Mocky is installed by people
 * other than us, mostly on a LAN; a section that simply did not appear would
 * leave them looking for it, while one that lists what is missing tells them
 * what to fix. The server refuses the switch on its own as well
 * (`PUT /api/admin/mcp/config` → 409) — this page is not the guard.
 */
export default function AssistantsSection() {
  const t = useT()
  const [view, setView] = useState<AdminMcpView | null>(null)
  const [draft, setDraft] = useState<McpConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function load() {
    try {
      const v = await api.admin.mcp.get()
      setView(v)
      // Only the first time: a reload after the on/off switch must not throw
      // away edits to the form that were not saved yet.
      setDraft((d) => d ?? v.config)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function save(patch: Partial<McpConfig>) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const out = await api.admin.mcp.setConfig(patch)
      // The switch saves on its own; the rest of the form keeps what was typed.
      const onlySwitch = Object.keys(patch).length === 1 && 'enabled' in patch
      setDraft((d) => (onlySwitch && d ? { ...d, enabled: out.config.enabled } : out.config))
      setNotice(out.revoked ? t('mcp.admin.savedRevoked', { n: out.revoked }) : t('mcp.admin.saved'))
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg === 'https' ? t('mcp.admin.httpsRefused') : msg)
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    setError(null)
    try {
      await api.admin.mcp.revoke(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* the address stays visible and selectable */
    }
  }

  if (!view || !draft) {
    return (
      <section>
        <SectionHead kicker={t('dashboard.nav.assistants')} title={t('mcp.admin.title')} blurb={t('mcp.admin.blurb')} />
        {error && <Banner tone="danger">{error}</Banner>}
      </section>
    )
  }

  const r = view.readiness
  const locked = !r.ok && !view.config.enabled
  const date = (ms: number) => new Date(ms).toLocaleString()
  const checks: Array<[boolean, string]> = [
    [r.originHttps, 'mcp.admin.ready.origin'],
    [r.requestHttps, 'mcp.admin.ready.request'],
    [r.hostMatches, 'mcp.admin.ready.host'],
  ]

  return (
    <section>
      <SectionHead kicker={t('dashboard.nav.assistants')} title={t('mcp.admin.title')} blurb={t('mcp.admin.blurb')} />

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
        <div className="space-y-6">
          {/* The checklist, always: what holds, what does not, and what nobody can check from here. */}
          <div>
            <div className="section-head">
              <span className="kicker text-accent-ink">{t('mcp.admin.ready.title')}</span>
            </div>
            <ul className="space-y-2">
              {checks.map(([ok, key]) => (
                <li key={key} className="flex items-start gap-2 text-body-sm">
                  <span className={ok ? 'text-ok' : 'text-danger'}>
                    <Icon name={ok ? 'check' : 'close'} size={16} />
                  </span>
                  <span className={ok ? 'text-ink' : 'text-ink font-medium'}>{t(key)}</span>
                </li>
              ))}
              <li className="flex items-start gap-2 text-body-sm text-ink-muted">
                <Icon name="warning" size={16} />
                <span>{t('mcp.admin.ready.internet')}</span>
              </li>
            </ul>
            {r.insecureLoopback && <p className="measure mt-2 text-caption text-warn">{t('mcp.admin.ready.loopback')}</p>}
            {locked ? (
              <Banner tone="warn" className="mt-3">
                {t('mcp.admin.ready.locked')}
              </Banner>
            ) : (
              <p className="measure mt-2 text-caption text-ink-muted">{t('mcp.admin.ready.selfSigned')}</p>
            )}
          </div>

          <label className={`flex items-start gap-3 border border-line-soft bg-ink/5 p-3 ${locked ? 'opacity-60' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-accent"
              checked={draft.enabled}
              disabled={busy || locked}
              onChange={(e) => void save({ enabled: e.currentTarget.checked })}
            />
            <span>
              <span className="block text-body font-medium text-ink">{t('mcp.admin.enabled')}</span>
              <span className="measure mt-0.5 block text-body-sm text-ink-muted">{t('mcp.admin.enabledHelp')}</span>
            </span>
          </label>

          <RunnerPanel status={view.runner} onChanged={() => void load()} />

          {r.mcpUrl && (
            <Field label={t('mcp.admin.url')}>
              {(p) => (
                <div className="flex gap-2">
                  <Input {...p} readOnly value={r.mcpUrl ?? ''} onFocus={(e) => e.currentTarget.select()} />
                  <Button onClick={() => void copyUrl(r.mcpUrl as string)}>{copied ? t('mcp.admin.copied') : t('mcp.admin.copy')}</Button>
                </div>
              )}
            </Field>
          )}
        </div>

        <fieldset disabled={locked} className={`space-y-5 ${locked ? 'opacity-60' : ''}`}>
          <AccountScope
            modes={['all', 'allowlist']}
            access={draft.access.mode as VideoAccessMode}
            onAccess={(mode) => setDraft({ ...draft, access: { ...draft.access, mode } })}
            allowed={draft.access.userIds}
            onToggle={(id) =>
              setDraft({
                ...draft,
                access: {
                  ...draft.access,
                  userIds: draft.access.userIds.includes(id)
                    ? draft.access.userIds.filter((x) => x !== id)
                    : [...draft.access.userIds, id],
                },
              })
            }
            users={view.users}
            labels={{
              title: 'mcp.admin.access.title',
              help: 'mcp.admin.access.help',
              listTitle: 'mcp.admin.access.listTitle',
              empty: 'mcp.admin.access.empty',
              allNote: 'mcp.admin.access.allNote',
            }}
          />

          <Field label={t('mcp.admin.clients')} hint={t('mcp.admin.clientsHelp')}>
            {(p) => (
              <Select {...p} value={draft.clients} onChange={(e) => setDraft({ ...draft, clients: e.currentTarget.value as McpConfig['clients'] })}>
                <option value="known">{t('mcp.admin.clients.known')}</option>
                <option value="any">{t('mcp.admin.clients.any')}</option>
              </Select>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('mcp.admin.accessMin')}>
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min={5}
                  max={1440}
                  value={draft.tokenTtl.accessMin}
                  onChange={(e) => setDraft({ ...draft, tokenTtl: { ...draft.tokenTtl, accessMin: Number(e.currentTarget.value) } })}
                />
              )}
            </Field>
            <Field label={t('mcp.admin.refreshDays')}>
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min={1}
                  max={365}
                  value={draft.tokenTtl.refreshDays}
                  onChange={(e) => setDraft({ ...draft, tokenTtl: { ...draft.tokenTtl, refreshDays: Number(e.currentTarget.value) } })}
                />
              )}
            </Field>
          </div>

          {/* Who writes the code. One choice of three rather than two boxes:
              "neither" is not a state an MCP server that makes designs can be in,
              and the server refuses it anyway (config.js). */}
          <Field label={t('mcp.admin.engines')} hint={t('mcp.admin.enginesHelp')}>
            {(p) => (
              <Select
                {...p}
                value={draft.engines?.client ? (draft.engines.mocky ? 'both' : 'client') : 'mocky'}
                onChange={(e) => {
                  const v = e.currentTarget.value
                  setDraft({ ...draft, engines: { mocky: v !== 'client', client: v !== 'mocky' } })
                }}
              >
                <option value="mocky">{t('mcp.admin.engines.mocky')}</option>
                <option value="both">{t('mcp.admin.engines.both')}</option>
                <option value="client">{t('mcp.admin.engines.client')}</option>
              </Select>
            )}
          </Field>

          <Field label={t('mcp.admin.quota')} hint={t('mcp.admin.quotaHelp')}>
            {(p) => (
              <Input
                {...p}
                type="number"
                min={1}
                value={draft.dailyQuota ?? ''}
                onChange={(e) => setDraft({ ...draft, dailyQuota: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })}
              />
            )}
          </Field>

          <Button
            variant="primary"
            disabled={busy}
            onClick={() =>
              void save({ access: draft.access, clients: draft.clients, tokenTtl: draft.tokenTtl, dailyQuota: draft.dailyQuota, engines: draft.engines })
            }
          >
            {t('mcp.admin.save')}
          </Button>
        </fieldset>
      </div>

      <div className="mt-10">
        <div className="section-head">
          <span className="kicker text-accent-ink">{t('mcp.admin.connections')}</span>
          <span className="ml-auto font-mono text-caption text-accent-ink">{view.connections.length}</span>
        </div>
        {view.connections.length === 0 ? (
          <p className="text-body-sm text-ink-muted">{t('mcp.admin.connectionsEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead className="text-caption uppercase text-ink-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">{t('mcp.admin.col.account')}</th>
                  <th className="py-2 pr-4 font-medium">{t('mcp.admin.col.client')}</th>
                  <th className="py-2 pr-4 font-medium">{t('mcp.admin.col.since')}</th>
                  <th className="py-2 pr-4 font-medium">{t('mcp.admin.col.lastUsed')}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {view.connections.map((c) => (
                  <tr key={c.id} className="border-t border-line-soft">
                    <td className="py-2 pr-4 text-ink">{c.username ?? '—'}</td>
                    <td className="py-2 pr-4 text-ink">{c.clientName}</td>
                    <td className="py-2 pr-4 font-mono text-caption text-ink-muted">{date(c.createdAt)}</td>
                    <td className="py-2 pr-4 font-mono text-caption text-ink-muted">{date(c.lastUsedAt)}</td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="danger" onClick={() => void revoke(c.id)}>
                        {t('mcp.admin.revoke')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
