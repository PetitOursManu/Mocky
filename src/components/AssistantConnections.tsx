import { useEffect, useState } from 'react'
import { api, type AccountMcpView, type McpEngine } from '../lib/api'
import { Button, ButtonLink, Input, Select } from '../ui'
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
/**
 * How to add Mocky to each assistant, as close to one step as each allows.
 *
 * Only Claude Code takes a connector in one line. claude.ai, Claude Desktop and
 * ChatGPT have no install link and no file for a REMOTE connector (checked
 * 2026-10): the person adds it in their own settings, by design. So the best
 * this page can do is take them to the right screen and hand them the exact
 * words to paste — the address, and the one line where there is one.
 */
function InstallSteps({ url }: { url: string }) {
  const t = useT()
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500)
    } catch {
      /* the text is on screen to select by hand */
    }
  }
  const command = `claude mcp add --transport http --scope user mocky ${url}`
  return (
    <div className="mt-3 grid gap-3">
      <div className="border border-line-soft p-3">
        <p className="text-body-sm font-medium text-ink">{t('mcp.install.claude')}</p>
        <p className="measure mt-1 text-caption text-ink-muted">{t('mcp.install.claudeSteps')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <ButtonLink size="sm" variant="primary" href="https://claude.ai/customize/connectors" target="_blank" rel="noopener noreferrer">
            {t('mcp.install.claudeOpen')}
          </ButtonLink>
          <Button size="sm" onClick={() => void copy('claude', url)}>
            {copied === 'claude' ? t('mcp.install.copied') : t('mcp.install.copyUrl')}
          </Button>
        </div>
      </div>
      <div className="border border-line-soft p-3">
        <p className="text-body-sm font-medium text-ink">{t('mcp.install.chatgpt')}</p>
        <p className="measure mt-1 text-caption text-ink-muted">{t('mcp.install.chatgptSteps')}</p>
        <div className="mt-2">
          <Button size="sm" onClick={() => void copy('chatgpt', url)}>
            {copied === 'chatgpt' ? t('mcp.install.copied') : t('mcp.install.copyUrl')}
          </Button>
        </div>
      </div>
      <div className="border border-line-soft p-3">
        <p className="text-body-sm font-medium text-ink">{t('mcp.install.code')}</p>
        <p className="measure mt-1 text-caption text-ink-muted">{t('mcp.install.codeSteps')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap bg-ink/5 px-2 py-1.5 font-mono text-caption text-ink">{command}</code>
          <Button size="sm" onClick={() => void copy('code', command)}>
            {copied === 'code' ? t('mcp.install.copied') : t('mcp.install.copyCommand')}
          </Button>
        </div>
      </div>
      <p className="measure text-caption text-ink-muted">{t('mcp.install.after')}</p>
    </div>
  )
}

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

  async function chooseEngine(engine: McpEngine) {
    try {
      const out = await api.mcpConnections.setEngine(engine)
      setView((v) => (v ? { ...v, engine: out.engine } : v))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const date = (ms: number) => new Date(ms).toLocaleString()
  // A choice only when there are two: with one engine allowed, the question
  // has an answer the person cannot change, and asking it would say otherwise.
  const canChoose = Boolean(view?.engines?.mocky && view.engines.client)

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
          <InstallSteps url={view.mcpUrl} />
          {canChoose && (
            <div className="mt-4">
              <label htmlFor="mcp-engine" className="mb-1.5 block text-body-sm font-medium text-ink">
                {t('mcp.account.engine')}
              </label>
              <Select id="mcp-engine" value={view.engine ?? 'mocky'} onChange={(e) => void chooseEngine(e.currentTarget.value as McpEngine)}>
                <option value="mocky">{t('mcp.account.engine.mocky')}</option>
                <option value="client">{t('mcp.account.engine.client')}</option>
              </Select>
              <p className="measure mt-1.5 text-caption text-ink-muted">{t('mcp.account.engineHelp')}</p>
            </div>
          )}
          {!canChoose && view.engine === 'client' && (
            <p className="measure mt-3 text-caption text-ink-muted">{t('mcp.account.engineClientOnly')}</p>
          )}
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
