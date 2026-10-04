import { useEffect, useState } from 'react'
import { api, type AccountMcpView } from '../lib/api'
import { Button, Input } from '../ui'
import { useT } from '../i18n'

/**
 * Settings → Connected assistants: the address to give Claude or ChatGPT, and
 * every assistant this account let in, each with a way out.
 *
 * Shown to everyone, and honest about why it does nothing when it does nothing:
 * switched off on this instance, or this account not on the administrator's
 * list. A section that vanished in those cases would read as "this Mocky cannot
 * do that", which is not always true.
 */
export default function AssistantConnections() {
  const t = useT()
  const [view, setView] = useState<AccountMcpView | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setView(await api.mcpConnections.list())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function revoke(id: string) {
    try {
      await api.mcpConnections.revoke(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const date = (ms: number) => new Date(ms).toLocaleString()

  return (
    <section>
      <div className="section-head">
        <span className="kicker text-accent-ink">{t('mcp.account.title')}</span>
      </div>
      <p className="measure mb-3 text-body text-ink-muted">{t('mcp.account.blurb')}</p>
      {error && <p className="mb-2 text-body-sm text-danger">{error}</p>}
      {view && !view.active && <p className="text-body-sm text-ink-muted">{t('mcp.account.notActive')}</p>}
      {view && view.active && !view.allowed && <p className="text-body-sm text-ink-muted">{t('mcp.account.notAllowed')}</p>}
      {view && view.active && view.allowed && view.mcpUrl && (
        <div className="mb-4">
          <label className="mb-1.5 block text-body-sm font-medium text-ink">{t('mcp.account.url')}</label>
          <Input readOnly value={view.mcpUrl} onFocus={(e) => e.currentTarget.select()} />
          <p className="measure mt-1.5 text-caption text-ink-muted">{t('mcp.account.howto')}</p>
        </div>
      )}
      {view && view.connections.length > 0 ? (
        <ul className="border-t border-line-soft">
          {view.connections.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft py-2">
              <span className="text-body text-ink">{c.clientName}</span>
              <span className="text-caption text-ink-muted">
                {t('mcp.account.since', { date: date(c.createdAt) })} · {t('mcp.account.lastUsed', { date: date(c.lastUsedAt) })}
              </span>
              <span className="ml-auto">
                <Button size="sm" variant="danger" onClick={() => void revoke(c.id)}>
                  {t('mcp.account.revoke')}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        view && view.active && view.allowed && <p className="text-body-sm text-ink-muted">{t('mcp.account.empty')}</p>
      )}
    </section>
  )
}
