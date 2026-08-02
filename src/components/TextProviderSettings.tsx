import { useEffect, useState } from 'react'
import {
  api,
  type TextConfig,
  type TextProfile,
  type TextProfileConfig,
  type TextProviderEntry,
  type TextTestResult,
} from '../lib/api'
import { Icon } from '../ui'
import { useT } from '../i18n'

/** Translation keys, resolved at render — `useT` only runs inside a component. */
const HINT_KEYS: Record<string, string> = {
  '': 'settings.textHintNone',
  'ollama-cloud': 'settings.textHintOllamaCloud',
  openai: 'settings.textHintOpenai',
  anthropic: 'settings.textHintAnthropic',
  openrouter: 'settings.textHintOpenrouter',
  fal: 'settings.textHintFal',
  'openai-compatible': 'settings.textHintOpenaiCompatible',
}

const MODEL_PLACEHOLDER: Record<string, string> = {
  'ollama-cloud': 'gpt-oss:120b',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-5',
  openrouter: 'openai/gpt-4o-mini',
  fal: 'openai/gpt-4o-mini',
  'openai-compatible': 'llama-3.3-70b-versatile',
}

/** fal keys are `<id>:<secret>` pairs, not `sk-…` tokens — don't mislead. */
const KEY_PLACEHOLDER: Record<string, string> = { fal: 'xxxxxxxx-…:xxxxxxxx…' }

/**
 * An IMAGE model id pasted into the TEXT model field. Easy to do with fal, which
 * sells images and LLMs under one key but on two different endpoints — the
 * provider then answers a bare "is not a valid model ID". Caught here, while the
 * user is still typing, rather than after a failed save.
 * Mirrors `looksLikeImageModel` in server/text/config.js.
 */
function looksLikeImageModel(id: string): boolean {
  return /(?:text|image)-to-(?:image|video)|\bseedream\b|\bflux\b|stable-?diffusion|\bsdxl\b|\bimagen\b|\bdall-?e\b|\bveo\b|\bkling\b/i.test(
    id || '',
  )
}

const EMPTY_ENTRY: TextProviderEntry = { baseUrl: '', model: '', hasApiKey: false }

/**
 * One profile's form. Two of these are rendered: the model that WRITES the
 * screens, and the (optional) model that powers Muse's art direction.
 */
function ProfileForm({
  profile,
  title,
  blurb,
  emptyLabel,
  cfg,
  onConfig,
}: {
  profile: TextProfile
  title: string
  blurb: React.ReactNode
  emptyLabel: string
  cfg: TextConfig
  onConfig: (c: TextConfig) => void
}) {
  const t = useT()
  const section: TextProfileConfig = cfg[profile]

  const [provider, setProvider] = useState(section.provider || '')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<TextTestResult | null>(null)
  /** Model ids the saved key can reach — null until asked for. */
  const [models, setModels] = useState<string[] | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)

  const entry = (s: TextProfileConfig, id: string): TextProviderEntry =>
    (s[id] as TextProviderEntry) || EMPTY_ENTRY

  /** Load a provider's stored values into the form (called on mount + on switch). */
  function hydrate(s: TextProfileConfig, id: string) {
    setProvider(id)
    const e = id ? entry(s, id) : EMPTY_ENTRY
    setBaseUrl(e.baseUrl)
    setModel(e.model)
    setApiKey('')
  }

  useEffect(() => {
    hydrate(section, section.provider || '')
    // Re-hydrate only when the server view of THIS profile changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  async function push(patch: Record<string, unknown>, pick: string) {
    const fresh = await api.admin.setTextConfig({ [profile]: patch } as never)
    onConfig(fresh)
    hydrate(fresh[profile], pick)
    return fresh
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    setTest(null)
    try {
      const patch: Record<string, unknown> = { provider }
      if (provider) patch[provider] = { baseUrl, model, apiKey: apiKey || undefined }
      await push(patch, provider)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function clearKey() {
    if (!provider || !confirm(t('settings.clearKeyConfirm'))) return
    try {
      await push({ [provider]: { apiKey: null } }, provider)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function runTest() {
    setTesting(true)
    setTest(null)
    try {
      setTest(await api.admin.testTextProvider(profile))
    } catch (e) {
      setTest({ ok: false, error: e instanceof Error ? e.message : String(e) })
    } finally {
      setTesting(false)
    }
  }

  /**
   * Ask the provider what this key can reach.
   *
   * The model was a free-text field: choosing one meant leaving Mocky for the
   * provider's docs, and a typo came back as "is not a valid model ID". The
   * request carries no key — it runs against the saved configuration.
   */
  async function loadModels() {
    setLoadingModels(true)
    setModels(null)
    setModelsError(null)
    try {
      const r = await api.admin.listTextModels(profile)
      if (r.ok && r.models?.length) setModels(r.models)
      else setModelsError(r.error || t('settings.adminModelsNone'))
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingModels(false)
    }
  }

  const current = provider ? entry(section, provider) : null

  return (
    <div className="border border-line-soft bg-ink/5 p-4">
      <h4 className="kicker text-ink">{title}</h4>
      <p className="measure mb-3 mt-1.5 text-caption leading-relaxed text-ink-muted">{blurb}</p>

      {error && <div className="mb-3 border border-danger/50 bg-danger/10 p-2 text-body-sm text-danger">{error}</div>}

      <label className="block">
        <span className="mb-1 block text-body-sm font-medium text-ink">{t('settings.provider')}</span>
        <select className="input w-full" value={provider} onChange={(e) => hydrate(section, e.target.value)}>
          <option value="">{emptyLabel}</option>
          {cfg.providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-1.5 text-caption text-ink-faint">
        {HINT_KEYS[provider] ? t(HINT_KEYS[provider]) : ''}
      </p>

      {provider && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-body-sm font-medium text-ink">{t('settings.baseUrl')}</span>
            <input
              className="input w-full"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com"
              spellCheck={false}
            />
            <span className="mt-1 block text-caption text-ink-faint">
              {t('settings.noV1Before')} <code>/v1</code> {t('settings.noV1After')}
            </span>
          </label>
          <label className="block">
            <span className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-body-sm font-medium text-ink">{t('settings.model')}</span>
              {/* Asking the provider beats reading its docs in another tab, and
                  it is the same call for every provider — the dialect already
                  maps /api/tags to /v1/models. */}
              <button
                type="button"
                className="kicker text-accent-ink transition hover:opacity-80 disabled:opacity-50"
                onClick={loadModels}
                disabled={loadingModels}
              >
                {loadingModels ? t('settings.adminModelsLoading') : t('settings.adminModelsList')}
              </button>
            </span>
            <input
              className="input w-full"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={MODEL_PLACEHOLDER[provider] || ''}
              spellCheck={false}
              list={`models-${profile}`}
            />
            {/* A datalist rather than a replacement control: the field stays
                free text, because a provider that lists nothing must still be
                usable by typing an id in. */}
            {models && (
              <datalist id={`models-${profile}`}>
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            )}
            {models && (
              <span className="mt-1.5 block">
                <select
                  className="input w-full"
                  value={models.includes(model) ? model : ''}
                  onChange={(e) => e.target.value && setModel(e.target.value)}
                >
                  <option value="">{t('settings.adminModelsPick', { count: String(models.length) })}</option>
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </span>
            )}
            {modelsError && (
              <span className="mt-1.5 block text-caption text-warn">{modelsError}</span>
            )}
            {looksLikeImageModel(model) && (
              <span className="mt-1.5 flex items-start gap-2 border border-warn/40 bg-warn/10 px-2 py-1.5 text-caption text-warn">
                <Icon name="warning" size={16} />
                <span>
                  {t('settings.imageModelWarnLead', { model })}{' '}
                  <strong>{t('settings.imageModelWarnLLM')}</strong>{' '}
                  {t('settings.imageModelWarnExamples')} <code>openai/gpt-4o-mini</code>,{' '}
                  <code>google/gemini-2.5-flash</code>, <code>qwen/qwen3.5-flash-02-23</code>.{' '}
                  {t('settings.imageModelWarnWhere')}{' '}
                  <strong>{t('settings.imagesSectionTitle')}</strong>.
                </span>
              </span>
            )}
          </label>
          <label className="block">
            <span className="mb-1 block text-body-sm font-medium text-ink">{t('settings.apiKey')}</span>
            <input
              className="input w-full"
              type="password"
              autoComplete="off"
              placeholder={
                current?.hasApiKey
                  ? t('settings.keyStoredPlaceholder')
                  : KEY_PLACEHOLDER[provider] || 'sk-…'
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <div className="mt-1">
              {current?.hasApiKey ? (
                <span className="text-caption text-ok">
                  ● {t('settings.keyStored')} —{' '}
                  <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={clearKey}>
                    {t('settings.clearKey')}
                  </button>
                </span>
              ) : (
                <span className="text-caption text-ink-faint">{t('settings.noKeyStoredLocal')}</span>
              )}
            </div>
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? t('settings.saving') : t('common.save')}
        </button>
        {provider && (
          <button type="button" className="btn-ghost px-3 py-2 text-body-sm" onClick={runTest} disabled={testing}>
            {testing ? t('settings.testing') : t('settings.testShort')}
          </button>
        )}
        {saved && (
          <span className="flex items-center gap-1.5 text-body-sm text-ok">
            <Icon name="check" size={16} />
            {t('settings.savedLower')}
          </span>
        )}
        {test && (
          <span className={`flex items-center gap-1.5 text-body-sm ${test.ok ? 'text-ok' : 'text-danger'}`}>
            <Icon name={test.ok ? 'check' : 'close'} size={16} />
            {test.ok
              ? t('settings.testReply', { model: test.model ?? '', reply: test.reply ?? '' })
              : test.error}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Admin settings for the TEXT (LLM) providers. Two profiles:
 *  • génération — writes the screens and runs the planner.
 *  • inspiration — Muse's Design Dossier and the vision probe. Optional: left
 *    empty, Muse reuses the generation model (the historical behaviour).
 * Configuring a profile here makes it instance-wide; leaving both empty keeps the
 * per-browser Settings behaviour.
 */
export default function TextProviderSettings() {
  const t = useT()
  const [cfg, setCfg] = useState<TextConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.admin
      .getTextConfig()
      .then(setCfg)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  if (!cfg) {
    return (
      <section>
        <header className="rule-thin mb-4 border-accent/40 pb-2">
          <span className="kicker text-accent-ink">{t('settings.instance')}</span>
          <h3 className="mt-1 text-h3 text-ink">{t('settings.textModelsTitle')}</h3>
        </header>
        <p className="text-body text-ink-faint">{error || t('common.loading')}</p>
      </section>
    )
  }

  return (
    <section>
      <header className="rule-thin mb-4 border-accent/40 pb-2">
        <span className="kicker text-accent-ink">{t('settings.instance')}</span>
        <h3 className="mt-1 text-h3 text-ink">{t('settings.textModelsTitle')}</h3>
      </header>

      <p className="measure mb-3 text-body-sm text-ink-muted">
        {t('settings.textModelsBlurb1')} <strong>{t('settings.textModelsBlurbStrong1')}</strong>
        {t('settings.textModelsBlurb2')} <strong>{t('settings.textModelsBlurbStrong2')}</strong>{' '}
        {t('settings.textModelsBlurb3')}
      </p>
      <p className="mb-3 flex items-start gap-2 border border-line-soft bg-ink/5 px-2.5 py-2 text-caption text-ink-muted">
        <Icon name="image" size={16} />
        <span>
          <strong>{t('settings.imageNotHereLead')}</strong> {t('settings.imageNotHereBody1')}{' '}
          <em>{t('settings.imageNotHereMakes')}</em> {t('settings.imageNotHereBody2')}{' '}
          <strong>{t('settings.imagesSectionTitle')}</strong>
          {t('settings.imageFlow1')} <em>{t('settings.imageFlowLooks')}</em>{' '}
          {t('settings.imageFlow2')}
        </span>
      </p>

      <div className="mb-4 flex items-start gap-2 border border-warn/40 bg-warn/10 px-2.5 py-2 text-caption text-warn">
        <Icon name="warning" size={16} />
        <span>
          {t('settings.keyOnServer1')} <strong>{t('settings.keyOnServerStrong')}</strong>{' '}
          {t('settings.keyOnServer2')}
        </span>
      </div>

      <div className="space-y-4">
        <ProfileForm
          profile="generation"
          title={t('settings.textProfileGeneration')}
          blurb={t('settings.textProfileGenerationBlurb')}
          emptyLabel={t('settings.textEmptyGeneration')}
          cfg={cfg}
          onConfig={setCfg}
        />
        <ProfileForm
          profile="inspiration"
          title={t('settings.textProfileInspiration')}
          blurb={
            <>
              {t('settings.textInsp1')} <strong>{t('settings.textInspWrites')}</strong>{' '}
              {t('settings.textInsp2')} <strong>{t('settings.textInspLooks')}</strong>{' '}
              {t('settings.textInsp3')} <em>{t('muse.modeInspiration')}</em>{' '}
              {t('settings.textInsp4')} <strong>{t('settings.textInspVision')}</strong>.{' '}
              <span className="text-ink-faint">{t('settings.textInspFaint')}</span>
            </>
          }
          emptyLabel={t('settings.textEmptyInspiration')}
          cfg={cfg}
          onConfig={setCfg}
        />
      </div>
    </section>
  )
}
