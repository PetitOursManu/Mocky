import { useEffect, useState } from 'react'
import { api, type KosmyBoardSettings as Settings } from '../../lib/api'
import { Banner, Button, Field, Icon, IconButton, Input } from '../../ui'
import { useT } from '../../i18n'

/**
 * Admin → Users → Kosmy Board: "Se connecter avec Kosmy Board" (OpenID Connect).
 *
 * The Board shows three values when its single sign-on is turned on for this
 * space — issuer, client ID, client secret — and they are pasted here. The
 * secret is write-only: once saved it is never sent back, the field stays
 * empty, and typing a new one replaces it. The two addresses to give the Board
 * are shown to copy (the Board fills them itself for an app of its catalogue).
 *
 * Creating an account on first sign-in is off by default: an unknown Kosmy
 * Board account is otherwise refused, and its owner links it from Settings.
 */
export default function KosmyBoardSettings() {
  const t = useT()
  const [s, setS] = useState<Settings | null>(null)
  const [issuer, setIssuer] = useState('')
  const [clientId, setClientId] = useState('')
  const [secret, setSecret] = useState('')
  const [autoCreate, setAutoCreate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  function load(v: Settings) {
    setS(v)
    setIssuer(v.issuer)
    setClientId(v.clientId)
    setAutoCreate(v.autoCreate)
    setSecret('')
  }

  useEffect(() => {
    api.admin.kosmyBoard
      .get()
      .then(load)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      load(await api.admin.kosmyBoard.set({ issuer, clientId, clientSecret: secret, autoCreate }))
      setSaved(true)
    } catch (err) {
      const code = (err as { code?: string }).code
      setError(code === 'issuer' ? t('auth.kosmy.admin.badIssuer') : err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(t('auth.kosmy.admin.removeConfirm'))) return
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      load(await api.admin.kosmyBoard.remove())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(value)
      window.setTimeout(() => setCopied((c) => (c === value ? null : c)), 1500)
    } catch {
      /* the field is selectable as well */
    }
  }

  if (!s) {
    return error ? (
      <Banner tone="danger" className="mt-4">
        {error}
      </Banner>
    ) : null
  }

  const copyRow = (label: string, value: string) => (
    <Field label={label}>
      {(p) => (
        <div className="flex items-center gap-2">
          <Input {...p} readOnly value={value} className="font-mono text-caption" onFocus={(e) => e.currentTarget.select()} />
          <IconButton
            type="button"
            label={copied === value ? t('auth.kosmy.admin.copied') : t('auth.kosmy.admin.copy')}
            onClick={() => copy(value)}
          >
            <Icon name={copied === value ? 'check' : 'copy'} size={16} />
          </IconButton>
        </div>
      )}
    </Field>
  )

  return (
    <form onSubmit={save} className="mt-4 space-y-3 rounded-lg border border-line-soft bg-ink/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="kicker">{t('auth.kosmy.admin.title')}</div>
        <span className={`text-caption ${s.enabled ? 'text-ok' : 'text-ink-faint'}`}>
          {s.enabled ? t('auth.kosmy.admin.on') : t('auth.kosmy.admin.off')}
        </span>
      </div>
      <p className="measure text-body-sm text-ink-muted">{t('auth.kosmy.admin.blurb')}</p>

      {copyRow(t('auth.kosmy.admin.redirectUri'), s.redirectUri)}
      {copyRow(t('auth.kosmy.admin.loginUri'), s.initiateLoginUri)}
      {!s.originSet && (
        <p className="measure text-caption text-warn">{t('auth.kosmy.admin.originHint')}</p>
      )}

      <Field label={t('auth.kosmy.admin.issuer')} hint={t('auth.kosmy.admin.issuerHint')}>
        {(p) => (
          <Input
            {...p}
            spellCheck={false}
            placeholder="https://board.example.com/oidc"
            value={issuer}
            onChange={(e) => setIssuer(e.currentTarget.value)}
          />
        )}
      </Field>
      <Field label={t('auth.kosmy.admin.clientId')}>
        {(p) => <Input {...p} spellCheck={false} value={clientId} onChange={(e) => setClientId(e.currentTarget.value)} />}
      </Field>
      <Field
        label={t('auth.kosmy.admin.clientSecret')}
        hint={s.hasSecret ? t('auth.kosmy.admin.secretKept') : t('auth.kosmy.admin.secretOnce')}
      >
        {(p) => (
          <Input
            {...p}
            type="password"
            autoComplete="off"
            placeholder={s.hasSecret ? '••••••••' : ''}
            value={secret}
            onChange={(e) => setSecret(e.currentTarget.value)}
          />
        )}
      </Field>

      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span>
          <span className="block text-body-sm font-medium text-ink">{t('auth.kosmy.admin.autoCreate')}</span>
          <span className="measure block text-caption text-ink-muted">{t('auth.kosmy.admin.autoCreateHelp')}</span>
        </span>
        <input
          type="checkbox"
          className="h-5 w-5 accent-accent"
          checked={autoCreate}
          onChange={(e) => setAutoCreate(e.currentTarget.checked)}
        />
      </label>

      {error && <Banner tone="danger">{error}</Banner>}
      {saved && !error && <Banner tone="ok">{t('auth.kosmy.admin.saved')}</Banner>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {t('auth.kosmy.admin.save')}
        </Button>
        {(s.issuer || s.clientId || s.hasSecret) && (
          <Button type="button" variant="ghost" onClick={remove} disabled={busy}>
            {t('auth.kosmy.admin.remove')}
          </Button>
        )}
      </div>
    </form>
  )
}
