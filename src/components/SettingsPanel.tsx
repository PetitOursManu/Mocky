import { useEffect, useRef, useState } from 'react'
import AssistantConnections from './AssistantConnections'
import {
  PROVIDERS,
  type Settings,
  loadSettings,
  saveSettings,
} from '../lib/settings'
import { listModels, testConnection, type TestResult } from '../lib/provider'
import { groupProviders, providerGroupKey } from '../lib/providerGroups'
import { api, type AccountPlan, type AuthUser } from '../lib/api'
import { Banner, Button, Field, Icon, IconButton, Input, Segmented, Select } from '../ui'
import { LANGS, useLang, useT } from '../i18n'
import ReasoningSelect from './ReasoningSelect'
import { readReasoning } from '../lib/reasoning'
import ChimeSetting from './ChimeSetting'
import BrandSection from './BrandSection'

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
  // The free plan, as this account sees it: which model answers, and how much
  // of the day is left. Null for a standard account, which has nothing to show.
  const [plan, setPlan] = useState<Extract<AccountPlan, { plan: 'free' }> | null>(null)
  useEffect(() => {
    api
      .plan()
      .then((p) => setPlan(p.plan === 'free' ? p : null))
      .catch(() => setPlan(null))
  }, [])
  // When an admin set an instance-wide model, there is nothing to fill in here
  // — unless this account chose its own key over it (server/own-text.js).
  const [managed, setManaged] = useState<{
    model: string | null
    provider: string | null
    inspirationModel?: string | null
  } | null>(null)
  /**
   * The choice between the instance's model and this account's own key. Null
   * when the instance has no model for this account: then the form below is
   * the only way to generate, and there is nothing to choose.
   */
  const [source, setSource] = useState<{
    own: boolean
    allowed: boolean
    instance: { model: string; provider: string }
  } | null>(null)
  const [sourceBusy, setSourceBusy] = useState(false)
  const [sourceError, setSourceError] = useState<string | null>(null)
  function loadSource() {
    return api
      .config()
      .then((c) => {
        const tp = c.textProvider
        setManaged(
          tp?.configured
            ? { model: tp.model, provider: tp.provider, inspirationModel: tp.inspirationModel ?? null }
            : null,
        )
        setSource(tp?.instance ? { own: Boolean(tp.own), allowed: tp.ownAllowed !== false, instance: tp.instance } : null)
      })
      .catch(() => {
        setManaged(null)
        setSource(null)
      })
  }
  useEffect(() => {
    loadSource()
  }, [])

  async function chooseSource(own: boolean) {
    setSourceBusy(true)
    setSourceError(null)
    try {
      const s = settingsRef.current
      await api.setTextSource(own ? { own: true, provider: s.provider, model: s.model } : { own: false })
      await loadSource()
      setTest({ status: 'idle' })
    } catch (e) {
      setSourceError(e instanceof Error ? e.message : String(e))
    } finally {
      setSourceBusy(false)
    }
  }

  // On its own key, the account keeps the administrator told WHICH provider and
  // model it uses (the badge in Admin → Users) — never the key. Debounced: the
  // model field is typed into.
  const own = source?.own === true
  useEffect(() => {
    if (!own) return
    const timer = setTimeout(() => {
      api.setTextSource({ own: true, provider: settings.provider, model: settings.model }).catch(() => {})
    }, 800)
    return () => clearTimeout(timer)
  }, [own, settings.provider, settings.model])

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
      // A provider with no listing is not a failure: the free-text field below
      // takes the id, and saying so beats a bare "HTTP 404".
      setModelsError(res.noListing ? t('settings.modelsNoListing') : (res.error ?? t('settings.modelsLoadFailed')))
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
    // `px-3` below sm, inside `.page`'s 12px gutter there: 24 + 24 left 277px
    // of a 375px phone for the forms, and every row read as squeezed.
    <div className="rounded-2xl border border-line bg-surface px-3 py-4 sm:px-6 sm:py-6">
      <header className="rule-double pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
          <div>
            <span className="kicker">{t('settings.title')}</span>
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

      {plan && (
        <Banner tone="info" title={t('plan.cardTitle')} className="mt-4">
          <span className="block">{t('plan.cardBody')}</span>
          <span className="mt-1 block">
            {plan.model ? t('plan.model', { model: plan.model }) : source?.own ? t('plan.ownChosen') : t('plan.ownKey')}
            {plan.model && (
              <>
                {' '}
                {plan.dailyLimit
                  ? t('plan.usage', { used: plan.used, limit: plan.dailyLimit })
                  : t('plan.unlimited')}
              </>
            )}
          </span>
          <span className="mt-1 block text-ink-faint">
            {account?.role === 'admin' ? t('plan.testBadgeTitle') : t('plan.askAdmin')}
          </span>
        </Banner>
      )}

      {source && (
        <section className="mt-6">
          <div className="section-head">
            <span className="kicker">{t('settings.textSource')}</span>
          </div>
          <div role="radiogroup" aria-label={t('settings.textSource')} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SourceChoice
              checked={!source.own}
              disabled={sourceBusy}
              onChoose={() => chooseSource(false)}
              title={t('settings.textSourceInstance')}
              detail={`${source.instance.model} · ${source.instance.provider}`}
            />
            <SourceChoice
              checked={source.own}
              disabled={sourceBusy || (!source.allowed && !source.own)}
              onChoose={() => chooseSource(true)}
              title={t('settings.textSourceOwn')}
              detail={source.allowed ? t('settings.textSourceOwnDetail') : t('settings.textSourceOwnClosed')}
            />
          </div>
          {source.own && (
            <p className="measure mt-3 flex items-start gap-2 text-body-sm text-ink-muted">
              <Icon name="key" size={16} />
              <span>{t('settings.textSourceOwnNote')}</span>
            </p>
          )}
          {sourceError && <p className="mt-2 text-body-sm text-danger">{sourceError}</p>}
        </section>
      )}

      {/* `grid-cols-1`, and on all three grids of this page, is the fix for the
          page being 621px wide on a 375px phone. A grid with no template below
          lg has one IMPLICIT column, sized `auto` — and an auto track is never
          narrower than the widest min-content in it. One section with an
          unbreakable line (the Claude Code command under "Assistants
          connectés", 550px of `whitespace-nowrap`) widened the column, and
          every section in the column — "Ma marque" first — was laid out at
          572px and cut by the screen's edge. `grid-cols-1` is
          `minmax(0, 1fr)`: the column is the card's width whatever is in it,
          so the next long line scrolls inside its own box instead. */}
      <div className="mt-6 grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-2">
        {/* An admin can set one model for the whole instance. When they have,
            this page has nothing to ask for — it only says who is in charge. */}
        {managed ? (
          <section>
            <div className="section-head">
              <span className="kicker">{t('settings.instanceModel')}</span>
            </div>
            <h3 className="text-h3 text-accent-ink">{managed.model || '—'}</h3>
            {managed.provider && <p className="kicker mt-1.5">{managed.provider}</p>}
            <p className="measure mt-3 text-body text-ink-muted">{t('settings.managedBlurb')}</p>
            {managed.inspirationModel && (
              <p className="mt-4 flex items-start gap-2 border-t border-line-soft pt-3 text-body-sm text-ink-muted">
                <Icon name="muse" size={16} />
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
              <span className="kicker">{t('settings.providerConnection')}</span>
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
                    {groupProviders(PROVIDERS).map((block) => (
                      <optgroup key={block.group} label={t(providerGroupKey(block.group))}>
                        {block.items.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.label}
                          </option>
                        ))}
                      </optgroup>
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
                hint={
                  activeProvider.keyUrl ? (
                    <>
                      {t('settings.apiKeyHint')} {t('settings.apiKeyWhere')}{' '}
                      <a
                        href={activeProvider.keyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-accent-ink underline underline-offset-2 hover:opacity-80"
                      >
                        {activeProvider.keyUrl.replace(/^https:\/\//, '')}
                      </a>
                    </>
                  ) : (
                    t('settings.apiKeyHint')
                  )
                }
              >
                {(p) => (
                  <div className="flex gap-2">
                    <Input
                      {...p}
                      className="min-w-0 flex-1"
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
                      {/* `min-w-0`: a select is as wide as its longest option,
                          and a model id like `accounts/fireworks/models/…` is
                          longer than a phone — as a flex item it refused to
                          shrink below it. */}
                      <Select
                        {...p}
                        className="min-w-0 flex-1"
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

              <ReasoningSelect value={readReasoning(settings.reasoning)} onChange={(l) => update('reasoning', l)} />
            </div>
          </section>
        )}

        <section className="space-y-8">
          {/* The planner applies whichever provider is in use — the user's own
              or the instance's. */}
          <div>
            <div className="section-head">
              <span className="kicker">{t('settings.generation')}</span>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line-soft bg-ink/5 p-3">
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
                <span className="kicker">{t('settings.test')}</span>
              </div>
              <Button variant="primary" onClick={onTest} disabled={test.status === 'testing'}>
                {test.status === 'testing' ? t('settings.testing') : t('settings.test')}
              </Button>
              {test.status === 'done' && <TestBanner result={test.result} onPick={(m) => update('model', m)} />}
            </div>
          )}
        </section>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-x-12 gap-y-8 border-t border-line pt-8 lg:grid-cols-2">
        {account && <BrandSection />}
        <AvatarSection account={account} onChanged={setAccount} />
        <PasswordSection account={account} onChanged={setAccount} />
        {account && <AssistantConnections />}

        <section>
          <div className="section-head">
            <span className="kicker">{t('lang.label')}</span>
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

        <ChimeSetting />
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
          <span className="kicker">{t('account.password')}</span>
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
        <span className="kicker">{t('account.password')}</span>
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
  // A 404 on the listing is a warning, not a failure: the provider may simply
  // publish no list, and generation works with a typed model id.
  const tone = result.ok
    ? 'border-ok/50 bg-ok/10 text-ok'
    : result.noListing
      ? 'border-warn/40 bg-warn/10 text-warn'
      : 'border-danger/50 bg-danger/10 text-danger'
  return (
    <div className={`mt-4 border p-3 text-body ${tone}`}>
      <div className="flex items-start gap-1.5 font-medium">
        <Icon name={result.ok ? 'check' : result.noListing ? 'warning' : 'close'} size={16} className="mt-0.5" />
        <span>{result.noListing ? t('settings.modelsNoListing') : result.message}</span>
      </div>
      {result.models && result.models.length > 0 && (
        <div className="mt-2">
          <div className="kicker mb-1.5">{t('settings.availableModels')}</div>
          <div className="flex flex-wrap gap-1.5">
            {result.models.map((m) => (
              // A model id has no space to wrap at; `break-all` lets one longer
              // than a phone break inside its own button.
              <Button key={m} size="sm" className="max-w-full break-all text-left" onClick={() => onPick(m)} title={t('settings.useThisModel')}>
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
        <span className="kicker">{t('account.picture')}</span>
      </div>

      {error && (
        <div className="mb-3">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-line-soft bg-ink/5">
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

/** One of the two answers to "which model generates for me", as a selectable card. */
function SourceChoice({
  checked,
  disabled,
  onChoose,
  title,
  detail,
}: {
  checked: boolean
  disabled?: boolean
  onChoose: () => void
  title: string
  detail: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled && !checked}
      onClick={() => !checked && onChoose()}
      className={`flex items-start gap-3 border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? 'border-accent bg-accent/5' : 'border-line-soft hover:border-line'
      }`}
    >
      <span
        aria-hidden
        className={`mt-1 block h-3.5 w-3.5 shrink-0 rounded-full border-2 ${checked ? 'border-accent bg-accent' : 'border-line'}`}
      />
      <span className="min-w-0">
        <span className="block text-body font-medium text-ink">{title}</span>
        <span className="mt-0.5 block break-words text-body-sm text-ink-muted">{detail}</span>
      </span>
    </button>
  )
}
