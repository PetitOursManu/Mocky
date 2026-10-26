import { useState } from 'react'
import { api, type AccountMcpView, type McpKey, type McpKeyLevel } from '../lib/api'
import { Button, Field, Input, Modal, Select } from '../ui'
import { useT, type TranslationKey } from '../i18n'

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string

/**
 * What a refused creation or revocation says, in the reader's language. Every
 * refusal the routes can send has its sentence here; the server's own words
 * (English, or the step-up's French) are only the last resort, for an answer
 * nobody planned.
 */
export function keyErrorMessage(e: unknown, t: Translate, limits: Pick<AccountMcpView, 'keysMax' | 'keyNameMax'>): string {
  const { code, status } = (e ?? {}) as { code?: unknown; status?: unknown }
  if (code === 'password') return t('mcp.keys.error.password')
  if (code === 'locked') return t('mcp.keys.error.locked')
  if (code === 'name') return t('mcp.keys.error.name', { max: limits.keyNameMax })
  if (code === 'level') return t('mcp.keys.error.level')
  if (code === 'expiry') return t('mcp.keys.error.expiry')
  if (code === 'limit') return t('mcp.keys.limit', { n: limits.keysMax })
  if (code === 'full') return t('mcp.keys.error.full')
  if (code === 'keys-off') return t('mcp.keys.off')
  // The shared limiter answers 429 with no code (server/index.js, authRateLimit).
  if (status === 429) return t('mcp.keys.error.tooMany')
  return e instanceof Error ? e.message : String(e)
}

/**
 * Settings → Connected assistants → Assistant keys (server/mcp/keys.js, X8).
 *
 * A fixed key for an assistant configured by hand, made by this account for
 * this account. Three things this component keeps that the server relies on:
 *
 *  - the key is shown ONCE, in the dialog that follows its creation, from
 *    component state that is emptied when the dialog closes — never written to
 *    localStorage, a URL or a log, never fetched again (the server could not
 *    give it back: it keeps only a hash);
 *  - the level has no hidden default on the server, so the form sends the one
 *    on screen, and that one starts at read-only;
 *  - the password is asked again, because what this hands out outlives the
 *    session (an SSO-only account has none, and the server lets it through).
 */
export default function AssistantKeys({
  view,
  canCreate,
  onChanged,
}: {
  view: AccountMcpView
  /** MCP on and this account on the list: otherwise the keys are only listed, to be revoked. */
  canCreate: boolean
  onChanged: () => Promise<void>
}) {
  const t = useT()
  const [name, setName] = useState('')
  const [level, setLevel] = useState<McpKeyLevel>('read')
  const [days, setDays] = useState<string>('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ key: McpKey; token: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const date = (ms: number) => new Date(ms).toLocaleString()
  const full = view.keys.length >= view.keysMax

  const messageFor = (e: unknown) => keyErrorMessage(e, t, view)

  async function create() {
    setBusy(true)
    setError(null)
    try {
      const out = await api.mcpConnections.createKey({
        name,
        level,
        expiresInDays: days === '' ? null : Number(days),
        ...(view.keyNeedsPassword ? { password } : {}),
      })
      setCreated(out)
      setName('')
      setLevel('read')
      setDays('')
      await onChanged()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      // The password is not kept for the next key, whatever happened.
      setPassword('')
      setBusy(false)
    }
  }

  async function revoke(k: McpKey) {
    if (!window.confirm(t('mcp.keys.revokeConfirm', { name: k.name }))) return
    setError(null)
    try {
      await api.mcpConnections.revokeKey(k.id)
      await onChanged()
    } catch (e) {
      setError(messageFor(e))
    }
  }

  async function copy(what: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 1500)
    } catch {
      /* the key is on screen to select by hand */
    }
  }

  function closeCreated() {
    setCreated(null)
    setCopied(null)
  }

  const command = created && view.mcpUrl ? `claude mcp add --transport http --scope user mocky ${view.mcpUrl} --header "Authorization: Bearer ${created.token}"` : null

  return (
    <div className="mt-4 border-t border-line-soft pt-3">
      <span className="block text-body-sm font-medium text-ink">{t('mcp.keys.title')}</span>
      <p className="measure mt-0.5 text-caption text-ink-muted">{t('mcp.keys.blurb')}</p>
      {error && <p className="mt-2 text-body-sm text-danger">{error}</p>}

      {!canCreate ? null : !view.keysEnabled ? (
        <p className="mt-2 text-body-sm text-ink-muted">
          {t('mcp.keys.off')}
          {view.keys.length > 0 && <> {t('mcp.keys.suspended')}</>}
        </p>
      ) : (
        <form
          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <Field label={t('mcp.keys.name')}>
            {(p) => (
              <Input
                {...p}
                value={name}
                maxLength={view.keyNameMax}
                placeholder={t('mcp.keys.namePlaceholder')}
                autoComplete="off"
                onChange={(e) => setName(e.currentTarget.value)}
              />
            )}
          </Field>
          <Field label={t('mcp.keys.level')}>
            {(p) => (
              <Select {...p} value={level} onChange={(e) => setLevel(e.currentTarget.value as McpKeyLevel)}>
                <option value="read">{t('mcp.keys.level.read')}</option>
                <option value="write">{t('mcp.keys.level.write')}</option>
              </Select>
            )}
          </Field>
          <Field label={t('mcp.keys.expiry')}>
            {(p) => (
              <Select {...p} value={days} onChange={(e) => setDays(e.currentTarget.value)}>
                <option value="">{t('mcp.keys.expiry.never')}</option>
                {view.keyExpiryDays.map((n) => (
                  <option key={n} value={String(n)}>
                    {t('mcp.keys.expiry.days', { n })}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {view.keyNeedsPassword && (
            <Field label={t('mcp.keys.password')} hint={t('mcp.keys.passwordHelp')}>
              {(p) => (
                <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} />
              )}
            </Field>
          )}
          <p className="measure text-caption text-ink-muted sm:col-span-2">{t('mcp.keys.levelHelp')}</p>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" variant="primary" size="sm" disabled={busy || full || !name.trim() || (view.keyNeedsPassword && !password)}>
              {busy ? t('mcp.keys.creating') : t('mcp.keys.create')}
            </Button>
            {full && <span className="text-caption text-ink-muted">{t('mcp.keys.limit', { n: view.keysMax })}</span>}
          </div>
        </form>
      )}

      {view.keys.length > 0 ? (
        <ul className="mt-3 border-t border-line-soft">
          {view.keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft py-2">
              <span className="text-body text-ink">{k.name}</span>
              <span className="text-caption font-medium text-ink-muted">{t(k.level === 'write' ? 'mcp.keys.level.write' : 'mcp.keys.level.read')}</span>
              <span className="text-caption text-ink-muted">
                {t('mcp.keys.createdOn', { date: date(k.createdAt) })} ·{' '}
                {k.lastUsedAt ? t('mcp.keys.lastUsed', { date: date(k.lastUsedAt) }) : t('mcp.keys.neverUsed')} ·{' '}
                {k.expired ? (
                  <span className="text-danger">{t('mcp.keys.expired')}</span>
                ) : k.expiresAt ? (
                  t('mcp.keys.expires', { date: date(k.expiresAt) })
                ) : (
                  t('mcp.keys.noExpiry')
                )}
              </span>
              <span className="ml-auto">
                <Button size="sm" variant="danger" onClick={() => void revoke(k)}>
                  {t('mcp.keys.revoke')}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        canCreate && view.keysEnabled && <p className="mt-2 text-body-sm text-ink-muted">{t('mcp.keys.empty')}</p>
      )}

      {created && (
        <Modal
          title={t('mcp.keys.created.title')}
          onClose={closeCreated}
          footer={
            <Button variant="primary" onClick={closeCreated}>
              {t('mcp.keys.created.done')}
            </Button>
          }
        >
          <p className="measure mb-3 text-body-sm font-medium text-ink">{t('mcp.keys.created.warning')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap bg-ink/5 px-2 py-1.5 font-mono text-caption text-ink select-all">{created.token}</code>
            <Button size="sm" onClick={() => void copy('key', created.token)}>
              {copied === 'key' ? t('mcp.keys.created.copied') : t('mcp.keys.created.copy')}
            </Button>
          </div>
          {view.mcpUrl && <p className="measure mt-3 text-caption text-ink-muted">{t('mcp.keys.created.usage', { url: view.mcpUrl })}</p>}
          {command && (
            <div className="mt-3">
              <p className="text-caption text-ink-muted">{t('mcp.keys.created.code')}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap bg-ink/5 px-2 py-1.5 font-mono text-caption text-ink">{command}</code>
                <Button size="sm" onClick={() => void copy('command', command)}>
                  {copied === 'command' ? t('mcp.keys.created.copied') : t('mcp.keys.created.copyCommand')}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
