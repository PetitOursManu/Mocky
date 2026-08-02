import { useEffect, useRef, useState } from 'react'
import {
  PROVIDERS,
  type Settings,
  loadSettings,
  saveSettings,
} from '../lib/settings'
import { listModels, testConnection, type TestResult } from '../lib/provider'
import { api, type AuthUser } from '../lib/api'
import { Banner, Button, Field, Icon, IconButton, Input, Segmented, Select } from '../ui'
import { LANGS, useLang, useT } from '../i18n'

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'done'; result: TestResult }

type ModelsState = 'idle' | 'loading' | 'loaded' | 'error'

/** Must match MIN_NEW_PASSWORD in server/index.js — the server is the authority. */
const MIN_PASSWORD = 8

export default function SettingsPanel() {
  const t = useT()
  const [lang, setLang] = useLang()
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [showKey, setShowKey] = useState(false)
  const [test, setTest] = useState<TestState>({ status: 'idle' })
  const [savedFlash, setSavedFlash] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [modelsState, setModelsState] = useState<ModelsState>('idle')
  const [modelsError, setModelsError] = useState<string | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  // Who is signed in — the password form needs an account, and a forced change
  // asked by an admin has to be announced here.
  const [account, setAccount] = useState<AuthUser | null>(null)
  useEffect(() => {
    api
      .me()
      .then(setAccount)
      .catch(() => setAccount(null))
  }, [])
  // When an admin set an instance-wide model, there is nothing to fill in here.
  const [managed, setManaged] = useState<{
    model: string | null
    provider: string | null
    inspirationModel?: string | null
  } | null>(null)
  useEffect(() => {
    api
      .config()
      .then((c) =>
        setManaged(
          c.textProvider?.configured
            ? {
                model: c.textProvider.model,
                provider: c.textProvider.provider,
                inspirationModel: c.textProvider.inspirationModel ?? null,
              }
            : null,
        ),
      )
      .catch(() => setManaged(null))
  }, [])

  // Persist on every change so the form is the source of truth in localStorage.
  useEffect(() => {
    saveSettings(settings)
    setSavedFlash(true)
    const timer = setTimeout(() => setSavedFlash(false), 1200)
    return () => clearTimeout(timer)
  }, [settings])

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: value }))
    setTest({ status: 'idle' })
  }

  const activeProvider = PROVIDERS.find((p) => p.id === settings.provider) ?? PROVIDERS[0]

  async function loadModels() {
    setModelsState('loading')
    setModelsError(null)
    const res = await listModels(settingsRef.current)
    if (res.ok) {
      setModels(res.models)
      setModelsState('loaded')
    } else {
      setModels([])
      setModelsState('error')
      setModelsError(res.error ?? t('settings.modelsLoadFailed'))
    }
  }

  // Auto-load the model list on first mount when we already have credentials.
  useEffect(() => {
    if (settingsRef.current.baseUrl.trim()) loadModels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onTest() {
    setTest({ status: 'testing' })
    const result = await testConnection(settings)
    setTest({ status: 'done', result })
    if (result.models && result.models.length) {
      setModels([...result.models].sort((a, b) => a.localeCompare(b)))
      setModelsState('loaded')
    }
  }

  const modelOptions = Array.from(new Set([settings.model, ...models].filter(Boolean)))

  return (
    <div className="border border-line bg-surface px-6 py-6">
      <header className="rule-double pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
          <div>
            <span className="kicker text-accent-ink">{t('settings.title')}</span>
            <h2 className="mt-1 text-h2 text-ink">{t('settings.heading')}</h2>
          </div>
          <span
            className={`flex items-center gap-1.5 text-body-sm text-ok transition-opacity ${savedFlash ? 'opacity-100' : 'opacity-0'}`}
          >
            <Icon name="check" size={16} />
            {t('settings.saved')}
          </span>
        </div>
      </header>

      {account?.mustChangePassword && (
        <Banner tone="warn" title={t('settings.pwChangeRequested')} className="mt-4">
          {t('settings.pwChangeRequestedHelp')}
        </Banner>
      )}

      <div className="mt-6 grid gap-x-12 gap-y-8 lg:grid-cols-2">
        {/* An admin can set one model for the whole instance. When they have,
            this page has nothing to ask for — it only says who is in charge. */}
        {managed ? (
          <section>
            <div className="section-head">
              <span className="kicker text-accent-ink">{t('settings.instanceModel')}</span>
            </div>
            <h3 className="text-h3 text-accent-ink">{managed.model || '—'}</h3>
            {managed.provider && <p className="kicker mt-1.5">{managed.provider}</p>}
            <p className="measure mt-3 text-body text-ink-muted">{t('settings.managedBlurb')}</p>
            {managed.inspirationModel && (
              <p className="mt-4 flex items-start gap-2 border-t border-line-soft pt-3 text-body-sm text-ink-muted">
                <Icon name="sparkle" size={16} />
                <span>
                  {t('settings.museDossierWith')}{' '}
                  <strong className="font-medium text-ink">{managed.inspirationModel}</strong>.
                </span>
              </p>
            )}
          </section>
        ) : (
          <section>
            <div className="section-head">
              <span className="kicker text-accent-ink">{t('settings.providerConnection')}</span>
            </div>
            <div className="space-y-4">
              <Field label={t('settings.provider')}>
                {(p) => (
                  <Select
                    {...p}
                    value={settings.provider}
                    onChange={(e) => {
                      const chosen =
                        PROVIDERS.find((x) => x.id === e.currentTarget.value) ?? PROVIDERS[0]
                      // The model travels with the provider. Now that the list
                      // spans several vendors, keeping the old id would leave
                      // an Ollama name like `gpt-oss:120b` pointed at OpenAI —
                      // a 400 with no obvious cause. An id the user typed
                      // themselves for THIS provider is left alone.
                      setSettings((s) => ({
                        ...s,
                        provider: chosen.id,
                        baseUrl: chosen.defaultBaseUrl,
                        model: chosen.defaultModel,
                        // Keys are per-vendor; carrying one across is never right.
                        apiKey: '',
                      }))
                      setTest({ status: 'idle' })
                    }}
                  >
                    {PROVIDERS.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field
                label={t('settings.baseUrl')}
                hint={t('settings.baseUrlHint', { url: activeProvider.defaultBaseUrl })}
              >
                {(p) => (
                  <Input
                    {...p}
                    type="text"
                    spellCheck={false}
                    value={settings.baseUrl}
                    placeholder={activeProvider.defaultBaseUrl}
                    onChange={(e) => update('baseUrl', e.currentTarget.value)}
                  />
                )}
              </Field>

              <Field
                label={t('settings.apiKey')}
                hint={t('settings.apiKeyHint')}
              >
                {(p) => (
                  <div className="flex gap-2">
                    <Input
                      {...p}
                      className="flex-1"
                      type={showKey ? 'text' : 'password'}
                      autoComplete="off"
                      spellCheck={false}
                      value={settings.apiKey}
                      placeholder="ollama-…"
                      onChange={(e) => update('apiKey', e.currentTarget.value)}
                    />
                    <Button variant="quiet" className="shrink-0" onClick={() => setShowKey((v) => !v)}>
                      {showKey ? t('settings.hide') : t('settings.show')}
                    </Button>
                  </div>
                )}
              </Field>

              <Field
                label={t('settings.model')}
                hint={t('settings.modelHint', { model: activeProvider.defaultModel })}
              >
                {(p) => (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Select
                        {...p}
                        className="flex-1"
                        value={modelOptions.includes(settings.model) ? settings.model : ''}
                        onChange={(e) => update('model', e.currentTarget.value)}
                      >
                        <option value="" disabled>
                          {modelsState === 'loading'
                            ? t('settings.modelsLoading')
                            : models.length
                              ? t('settings.modelsChoose')
                              : t('settings.modelsNone')}
                        </option>
                        {modelOptions.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </Select>
                      <IconButton
                        label={t('settings.modelsReload')}
                        onClick={loadModels}
                        disabled={modelsState === 'loading'}
                      >
                        <Icon name="refresh" size={16} />
                      </IconButton>
                    </div>

                    {modelsState === 'error' && (
                      <span className="block text-body-sm text-danger">{modelsError}</span>
                    )}
                    {modelsState === 'loaded' && (
                      <span className="block text-body-sm text-ink-muted">
                        <span className="font-mono text-accent-ink">{models.length}</span>{' '}
                        {t(models.length === 1 ? 'settings.modelsCount_one' : 'settings.modelsCount_other')}
                      </span>
                    )}

                    <Input
                      type="text"
                      spellCheck={false}
                      value={settings.model}
                      placeholder={t('settings.modelCustomPlaceholder', {
                        model: activeProvider.defaultModel,
                      })}
                      onChange={(e) => update('model', e.currentTarget.value)}
                      aria-label={t('settings.modelCustom')}
                    />
                  </div>
                )}
              </Field>
            </div>
          </section>
        )}

        <section className="space-y-8">
          {/* The planner applies whichever provider is in use — the user's own
              or the instance's. */}
          <div>
            <div className="section-head">
              <span className="kicker text-accent-ink">{t('settings.generation')}</span>
            </div>
            <label className="flex cursor-pointer items-start gap-3 border border-line-soft bg-ink/5 p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-accent"
                checked={settings.usePlanner}
                onChange={(e) => update('usePlanner', e.target.checked)}
              />
              <span>
                <span className="block text-body font-medium text-ink">
                  {t('settings.usePlanner')}
                </span>
                <span className="measure mt-0.5 block text-body-sm text-ink-muted">
                  {t('settings.usePlannerHelp')}
                </span>
              </span>
            </label>
          </div>

          {!managed && (
            <div>
              <div className="section-head">
                <span className="kicker text-accent-ink">{t('settings.test')}</span>
              </div>
              <Button variant="primary" onClick={onTest} disabled={test.status === 'testing'}>
                {test.status === 'testing' ? t('settings.testing') : t('settings.test')}
              </Button>
              {test.status === 'done' && <TestBanner result={test.result} onPick={(m) => update('model', m)} />}
            </div>
          )}
        </section>
      </div>

      <div className="mt-8 grid gap-x-12 gap-y-8 border-t border-line pt-8 lg:grid-cols-2">
        <AvatarSection account={account} onChanged={setAccount} />
        <PasswordSection account={account} onChanged={setAccount} />

        <section>
          <div className="section-head">
            <span className="kicker text-accent-ink">{t('lang.label')}</span>
          </div>
          <p className="measure mb-3 text-body text-ink-muted">{t('settings.langHelp')}</p>
          <Segmented
            label={t('lang.label')}
            value={lang}
            onChange={(v) => {
              // Segmented turns a mode off when its active item is clicked; a
              // language cannot be "off", so ignore that case.
              if (v) setLang(v)
            }}
            options={LANGS.map((l) => ({ value: l.id, label: l.label }))}
          />
        </section>
      </div>

      <p className="mt-8 border-t border-line-soft pt-3 text-body-sm text-ink-muted">
        {t('settings.footerNote')}
      </p>
    </div>
  )
}

/**
 * Change your own password.
 *
 * The server signs every other device out and re-issues this browser's cookie,
 * so a successful change does not log the user out of the tab they are in.
 */
function PasswordSection({
  account,
  onChanged,
}: {
  account: AuthUser | null
  onChanged: (u: AuthUser) => void
}) {
  const t = useT()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (!account) {
    return (
      <section>
        <div className="section-head">
          <span className="kicker text-accent-ink">{t('account.password')}</span>
        </div>
        <p className="measure text-body text-ink-muted">
          {t('settings.signInToChangePassword')}
        </p>
      </section>
    )
  }

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD
  const mismatch = confirm.length > 0 && confirm !== next
  const canSubmit =
    !busy && current.length > 0 && next.length >= MIN_PASSWORD && confirm === next

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)
    setBusy(true)
    try {
      const user = await api.changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setDone(true)
      onChanged(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="section-head">
        <span className="kicker text-accent-ink">{t('account.password')}</span>
      </div>
      <p className="measure mb-4 text-body text-ink-muted">
        {t('settings.accountIs')}{' '}
        <strong className="font-medium text-ink">{account.username}</strong>.{' '}
        {t('settings.passwordChangeSignsOut')}
      </p>

      <form onSubmit={submit} className="space-y-4">
        <Field label={t('settings.currentPassword')}>
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.currentTarget.value)}
            />
          )}
        </Field>

        <Field
          label={t('settings.newPassword')}
          hint={t('settings.minChars', { n: MIN_PASSWORD })}
          error={tooShort ? t('settings.minChars', { n: MIN_PASSWORD }) : null}
        >
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.currentTarget.value)}
            />
          )}
        </Field>

        <Field
          label={t('settings.confirmPassword')}
          error={mismatch ? t('settings.passwordMismatch') : null}
        >
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.currentTarget.value)}
            />
          )}
        </Field>

        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {busy ? t('settings.changingPassword') : t('settings.changePassword')}
        </Button>

        {error && (
          <Banner tone="danger" title={t('settings.passwordNotChanged')}>
            {error}
          </Banner>
        )}
        {done && !error && (
          <Banner tone="ok" title={t('settings.passwordChanged')}>
            {t('settings.otherDevicesSignedOut')}
          </Banner>
        )}
      </form>
    </section>
  )
}

function TestBanner({ result, onPick }: { result: TestResult; onPick: (m: string) => void }) {
  const t = useT()
  return (
    <div
      className={`mt-4 border p-3 text-body ${
        result.ok ? 'border-ok/50 bg-ok/10 text-ok' : 'border-danger/50 bg-danger/10 text-danger'
      }`}
    >
      <div className="flex items-start gap-1.5 font-medium">
        <Icon name={result.ok ? 'check' : 'close'} size={16} className="mt-0.5" />
        <span>{result.message}</span>
      </div>
      {result.models && result.models.length > 0 && (
        <div className="mt-2">
          <div className="kicker mb-1.5">{t('settings.availableModels')}</div>
          <div className="flex flex-wrap gap-1.5">
            {result.models.map((m) => (
              <Button key={m} size="sm" onClick={() => onPick(m)} title={t('settings.useThisModel')}>
                {m}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * The account picture.
 *
 * Square, and that is a decision rather than an oversight: `rounded-full` is
 * the one exception the design system grants, and it grants it to status dots.
 * A circular avatar would be the only round thing on a page made of rules and
 * rectangles — the shell is meant to look printed.
 */
function AvatarSection({
  account,
  onChanged,
}: {
  account: AuthUser | null
  onChanged: (u: AuthUser) => void
}) {
  const t = useT()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!account) return null
  const url = api.avatarUrl(account)

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onChanged(await api.setAvatar(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-10">
      <div className="section-head">
        <span className="kicker text-accent-ink">{t('account.picture')}</span>
      </div>

      {error && (
        <div className="mb-3">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-line-soft bg-ink/5">
          {url ? (
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon name="user" size={24} className="text-ink-faint" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={14} />
              {account.avatar ? t('account.pictureReplace') : t('account.pictureAdd')}
            </Button>
            {account.avatar && (
              <Button
                variant="quiet"
                size="sm"
                className="text-danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    onChanged(await api.removeAvatar())
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <Icon name="trash" size={14} />
                {t('account.pictureRemove')}
              </Button>
            )}
          </div>
          <p className="measure mt-1.5 text-caption text-ink-faint">{t('account.pictureHint')}</p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={pick}
      />
    </section>
  )
}
