import { useEffect, useState } from 'react'
import {
  api,
  type ImageProfile,
  type ImagesConfig,
  type ImagesProfileConfig,
  type ImagesProfilePatch,
  type ImagesTestResult,
} from '../lib/api'
import { checkVideoAvailability, type MuseVideoAvailability } from '../lib/muse'
import { Button, Field, Icon, Input, Select } from '../ui'
import { useT } from '../i18n'

/** Translation keys, resolved at render — `useT` only runs inside a component. */
const LABEL_KEYS: Record<string, string> = {
  pollinations: 'settings.imgLabelPollinations',
  fal: 'settings.imgLabelFal',
  'openai-image': 'settings.imgLabelOpenai',
  'cloudflare-workers-ai': 'settings.imgLabelCloudflare',
  'sd-webui': 'settings.imgLabelSdWebui',
  none: 'settings.imgLabelNone',
}

const HINT_KEYS: Record<string, string> = {
  '': 'settings.imgHintInherit',
  pollinations: 'settings.imgHintPollinations',
  fal: 'settings.imgHintFal',
  'openai-image': 'settings.imgHintOpenai',
  'cloudflare-workers-ai': 'settings.imgHintCloudflare',
  'sd-webui': 'settings.imgHintSdWebui',
  none: 'settings.imgHintNone',
}

type SecretName = 'pollinations' | 'fal' | 'openai' | 'cloudflare'

/**
 * One image profile's form. Rendered twice: the model that makes the pictures
 * embedded in the screen, and the (optional) model that makes the art-direction
 * reference Muse shows to the LLM.
 */
function ProfileForm({
  profile,
  title,
  blurb,
  emptyLabel,
  cfg,
  onConfig,
}: {
  profile: ImageProfile
  title: string
  blurb: React.ReactNode
  /** Non-empty only for the optional profile, which may inherit the other. */
  emptyLabel?: string
  cfg: ImagesConfig
  onConfig: (c: ImagesConfig) => void
}) {
  const t = useT()
  const section: ImagesProfileConfig = cfg[profile]

  const [provider, setProvider] = useState(section.provider)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<ImagesTestResult | null>(null)

  // Editable fields (secrets stay empty = "keep the stored value").
  const [poToken, setPoToken] = useState('')
  const [falKey, setFalKey] = useState('')
  const [falModel, setFalModel] = useState('')
  const [falTimeout, setFalTimeout] = useState(300)
  const [oaBase, setOaBase] = useState('')
  const [oaModel, setOaModel] = useState('')
  const [oaKey, setOaKey] = useState('')
  const [cfAccount, setCfAccount] = useState('')
  const [cfModel, setCfModel] = useState('')
  const [cfToken, setCfToken] = useState('')
  const [sdBase, setSdBase] = useState('')
  const [sdSteps, setSdSteps] = useState(20)

  function hydrate(s: ImagesProfileConfig) {
    setProvider(s.provider)
    setFalModel(s.fal.model)
    setFalTimeout(s.fal.timeoutSec ?? 300)
    setOaBase(s.openai.baseUrl)
    setOaModel(s.openai.model)
    setCfAccount(s.cloudflare.accountId)
    setCfModel(s.cloudflare.model)
    setSdBase(s.sdWebui.baseUrl)
    setSdSteps(s.sdWebui.steps)
    setPoToken('')
    setFalKey('')
    setOaKey('')
    setCfToken('')
  }

  useEffect(() => {
    hydrate(section)
    // Re-hydrate only when the server view of THIS profile changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  async function push(patch: ImagesProfilePatch) {
    const fresh = await api.admin.setImagesConfig({ [profile]: patch })
    onConfig(fresh)
    hydrate(fresh[profile])
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await push({
        provider,
        pollinations: { token: poToken || undefined },
        fal: { model: falModel, apiKey: falKey || undefined, timeoutSec: falTimeout },
        openai: { baseUrl: oaBase, model: oaModel, apiKey: oaKey || undefined },
        cloudflare: { accountId: cfAccount, model: cfModel, apiToken: cfToken || undefined },
        sdWebui: { baseUrl: sdBase, steps: sdSteps },
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function clearSecret(which: SecretName) {
    if (!confirm(t('settings.clearKeyConfirm'))) return
    const patch: ImagesProfilePatch =
      which === 'pollinations'
        ? { pollinations: { token: null } }
        : which === 'fal'
          ? { fal: { apiKey: null } }
          : which === 'openai'
            ? { openai: { apiKey: null } }
            : { cloudflare: { apiToken: null } }
    try {
      await push(patch)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function runTest() {
    setTesting(true)
    setTest(null)
    try {
      setTest(await api.admin.testImagesProvider(provider, profile))
    } catch (e) {
      setTest({ ok: false, provider, error: e instanceof Error ? e.message : String(e) })
    } finally {
      setTesting(false)
    }
  }

  const secretSet = (isSet: boolean, which: SecretName) =>
    isSet ? (
      <span className="text-caption text-ok">
        ● {t('settings.keyStored')} —{' '}
        <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => clearSecret(which)}>
          {t('settings.clearKey')}
        </button>
      </span>
    ) : (
      <span className="text-caption text-ink-faint">{t('settings.noKeyStored')}</span>
    )

  return (
    <div className="border border-line-soft bg-ink/5 p-4">
      <h4 className="kicker text-ink">{title}</h4>
      <p className="measure mb-3 mt-1.5 text-caption leading-relaxed text-ink-muted">{blurb}</p>

      {error && <div className="mb-3 border border-danger/50 bg-danger/10 p-2 text-body-sm text-danger">{error}</div>}

      <label className="block">
        <span className="mb-1 block text-body-sm font-medium text-ink">{t('settings.provider')}</span>
        <select className="input w-full" value={provider} onChange={(e) => setProvider(e.target.value)}>
          {emptyLabel && <option value="">{emptyLabel}</option>}
          {cfg.providers.map((id) => (
            <option key={id} value={id}>
              {LABEL_KEYS[id] ? t(LABEL_KEYS[id]) : id}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-1.5 text-caption text-ink-faint">
        {HINT_KEYS[provider] ? t(HINT_KEYS[provider]) : ''}
      </p>

      {/* Per-provider fields */}
      <div className="mt-4 space-y-3">
        {provider === 'pollinations' && (
          <label className="block">
            <span className="mb-1 block text-body-sm font-medium text-ink">{t('settings.tokenOptional')}</span>
            <input
              className="input w-full"
              type="password"
              placeholder={
                section.pollinations.hasToken
                  ? t('settings.tokenStoredPlaceholder')
                  : t('settings.pollinationsTokenPlaceholder')
              }
              value={poToken}
              onChange={(e) => setPoToken(e.target.value)}
            />
            <div className="mt-1">{secretSet(section.pollinations.hasToken, 'pollinations')}</div>
          </label>
        )}

        {provider === 'fal' && (
          <>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">{t('settings.model')}</span>
              <input
                className="input w-full"
                value={falModel}
                onChange={(e) => setFalModel(e.target.value)}
                placeholder="fal-ai/flux/schnell"
              />
              <span className="mt-1 block text-caption text-ink-faint">
                {t('settings.falModelHint1')} <code>fal-ai/</code>
                {t('settings.falModelHint2')} <code>fal-ai/flux/schnell</code>{' '}
                {t('settings.falModelHintFast')} <code>bytedance/seedream/v5/pro/text-to-image</code>{' '}
                {t('settings.falModelHintSlow')}
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">{t('settings.timeoutSeconds')}</span>
              <input
                className="input w-32"
                type="number"
                min={30}
                max={900}
                value={falTimeout}
                onChange={(e) => setFalTimeout(Number(e.target.value))}
              />
              <span className="mt-1 block text-caption text-ink-faint">
                {t('settings.timeoutHint')}
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">{t('settings.apiKey')}</span>
              <input
                className="input w-full"
                type="password"
                placeholder={
                  section.fal.hasApiKey
                    ? t('settings.keyStoredPlaceholder')
                    : t('settings.falKeyPlaceholder')
                }
                value={falKey}
                onChange={(e) => setFalKey(e.target.value)}
              />
              <div className="mt-1">{secretSet(section.fal.hasApiKey, 'fal')}</div>
            </label>
          </>
        )}

        {provider === 'openai-image' && (
          <>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">{t('settings.baseUrl')}</span>
              <input className="input w-full" value={oaBase} onChange={(e) => setOaBase(e.target.value)} placeholder="https://api.openai.com" />
            </label>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">{t('settings.model')}</span>
              <input className="input w-full" value={oaModel} onChange={(e) => setOaModel(e.target.value)} placeholder="gpt-image-1 / dall-e-3" />
            </label>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">{t('settings.apiKey')}</span>
              <input
                className="input w-full"
                type="password"
                placeholder={section.openai.hasApiKey ? t('settings.keyStoredPlaceholder') : 'sk-…'}
                value={oaKey}
                onChange={(e) => setOaKey(e.target.value)}
              />
              <div className="mt-1">{secretSet(section.openai.hasApiKey, 'openai')}</div>
            </label>
          </>
        )}

        {provider === 'cloudflare-workers-ai' && (
          <>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">{t('settings.cfAccountId')}</span>
              <input className="input w-full" value={cfAccount} onChange={(e) => setCfAccount(e.target.value)} placeholder="a1b2c3…" />
            </label>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">{t('settings.model')}</span>
              <input className="input w-full" value={cfModel} onChange={(e) => setCfModel(e.target.value)} placeholder="@cf/black-forest-labs/flux-1-schnell" />
            </label>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">{t('settings.apiToken')}</span>
              <input
                className="input w-full"
                type="password"
                placeholder={
                  section.cloudflare.hasApiToken
                    ? t('settings.tokenStoredPlaceholder')
                    : t('settings.cfTokenPlaceholder')
                }
                value={cfToken}
                onChange={(e) => setCfToken(e.target.value)}
              />
              <div className="mt-1">{secretSet(section.cloudflare.hasApiToken, 'cloudflare')}</div>
            </label>
          </>
        )}

        {provider === 'sd-webui' && (
          <>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">{t('settings.instanceUrl')}</span>
              <input className="input w-full" value={sdBase} onChange={(e) => setSdBase(e.target.value)} placeholder="http://127.0.0.1:7860" />
            </label>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">{t('settings.sdSteps')}</span>
              <input
                className="input w-32"
                type="number"
                min={1}
                max={150}
                value={sdSteps}
                onChange={(e) => setSdSteps(Number(e.target.value))}
              />
            </label>
            <p className="flex items-start gap-2 text-caption text-warn">
              <Icon name="warning" size={16} />
              <span>{t('settings.sdWebuiWarn')}</span>
            </p>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? t('settings.saving') : t('common.save')}
        </button>
        {provider && (
          <button type="button" className="btn-ghost px-3 py-2 text-body-sm" onClick={runTest} disabled={testing}>
            {testing ? t('settings.testing') : t('settings.testImage')}
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
              ? test.skipped
                ? t('settings.imgTestSkipped')
                : t('settings.imgTestOk', { kb: Math.round((test.bytes || 0) / 1024) })
              : test.error}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Scroll-sequence video settings.
 *
 * Separate from the image profiles because it has a second prerequisite none of
 * them has: ffmpeg, which lives in the container rather than in this form. The
 * status line reports both halves — a configured provider is useless without
 * the binary, and the admin needs to know which one is missing before going
 * looking.
 */
function VideoForm({ cfg, onConfig }: { cfg: ImagesConfig; onConfig: (c: ImagesConfig) => void }) {
  const t = useT()
  const section = cfg.video

  const [provider, setProvider] = useState(section.provider)
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [timeoutSec, setTimeoutSec] = useState(section.fal.timeoutSec)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<MuseVideoAvailability | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    setProvider(section.provider)
    setModel(section.fal.model)
    setTimeoutSec(section.fal.timeoutSec)
    setApiKey('')
  }, [section])

  useEffect(() => {
    checkVideoAvailability().then(setStatus)
  }, [])

  async function recheck() {
    setChecking(true)
    try {
      const res = await fetch('/api/videos/recheck', { method: 'POST' })
      if (res.ok) setStatus(await res.json())
    } catch {
      /* the status line simply stays as it was */
    } finally {
      setChecking(false)
    }
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const fresh = await api.admin.setImagesConfig({
        video: { provider, fal: { model, apiKey: apiKey || undefined, timeoutSec } },
      })
      onConfig(fresh)
      setApiKey('')
      setSaved(true)
      await recheck()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-line-soft p-4">
      <h4 className="text-h4 text-ink">{t('settings.videoTitle')}</h4>
      <p className="measure mt-1 text-body-sm text-ink-muted">{t('settings.videoBlurb')}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label={t('settings.videoProvider')}>
          {(p) => (
            <Select {...p} value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="">{t('settings.videoProviderOff')}</option>
              {cfg.videoProviders.map((id) => (
                <option key={id} value={id}>
                  {id === 'none' ? t('settings.imgLabelNone') : t('settings.imgLabelFal')}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('settings.videoModel')} hint={t('settings.videoModelHint')}>
          {(p) => (
            <Input
              {...p}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="fal-ai/ltx-video"
            />
          )}
        </Field>
        <Field label={t('settings.videoKey')} hint={section.fal.hasApiKey ? t('settings.keyStored') : undefined}>
          {(p) => (
            <Input
              {...p}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={section.fal.hasApiKey ? '••••••••' : ''}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label={t('settings.videoTimeout')} hint={t('settings.videoTimeoutHint')}>
          {(p) => (
            <Input
              {...p}
              type="number"
              min={60}
              max={1800}
              value={timeoutSec}
              onChange={(e) => setTimeoutSec(Number(e.target.value) || 600)}
            />
          )}
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="sm" onClick={save} disabled={saving}>
          {saving ? t('settings.saving') : t('common.save')}
        </Button>
        <Button variant="ghost" size="sm" onClick={recheck} disabled={checking}>
          <Icon name="refresh" size={15} />
          {t('settings.videoRecheck')}
        </Button>
        {saved && <span className="text-body-sm text-ok">{t('settings.saved')}</span>}
        {error && <span className="text-body-sm text-danger">{error}</span>}
      </div>

      {/* Both prerequisites, always both stated. */}
      {status && (
        <ul className="mt-3 space-y-1 text-caption">
          <li className={status.provider ? 'text-ok' : 'text-ink-faint'}>
            <Icon name={status.provider ? 'check' : 'close'} size={13} className="mr-1 inline-block" />
            {status.provider
              ? t('settings.videoStatusProviderOn', { model: status.model })
              : t('settings.videoStatusProviderOff')}
          </li>
          <li className={status.ffmpeg.available ? 'text-ok' : 'text-warn'}>
            <Icon name={status.ffmpeg.available ? 'check' : 'close'} size={13} className="mr-1 inline-block" />
            {status.ffmpeg.available
              ? status.ffmpeg.version || t('settings.videoStatusFfmpegOn')
              : t('settings.videoStatusFfmpegOff', { reason: status.ffmpeg.reason || '' })}
          </li>
        </ul>
      )}
    </div>
  )
}

/**
 * Admin settings for Muse's image generation. Two profiles, because the two jobs
 * need different models: the art-direction reference must render a convincing
 * site/app layout (slower, stronger model), while hero/product pictures want to
 * be fast and cheap. Secrets are stored server-side and never returned.
 */
export default function ImageProviderSettings() {
  const t = useT()
  const [cfg, setCfg] = useState<ImagesConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.admin
      .getImagesConfig()
      .then(setCfg)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  if (!cfg) {
    return (
      <section>
        <header className="rule-thin mb-4 border-accent/40 pb-2">
          <span className="kicker text-accent-ink">{t('settings.instance')}</span>
          <h3 className="mt-1 text-h3 text-ink">{t('settings.imagesSectionTitle')}</h3>
        </header>
        <p className="text-body text-ink-faint">{error || t('common.loading')}</p>
      </section>
    )
  }

  return (
    <section>
      <header className="rule-thin mb-4 border-accent/40 pb-2">
        <span className="kicker text-accent-ink">{t('settings.instance')}</span>
        <h3 className="mt-1 text-h3 text-ink">{t('settings.imagesSectionTitle')}</h3>
      </header>

      <p className="measure mb-4 text-body-sm text-ink-muted">
        {t('settings.imagesBlurb1')} <strong>{t('settings.imagesBlurbStrong')}</strong>
        {t('settings.imagesBlurb2')}
      </p>

      <div className="space-y-4">
        <ProfileForm
          profile="inspiration"
          title={t('settings.imgProfileInspiration')}
          blurb={
            <>
              {t('settings.imgInsp1')} <strong>{t('settings.imgInspRef')}</strong>{' '}
              {t('settings.imgInsp2')}{' '}
              <span className="text-ink-faint">{t('settings.imgInspFaint')}</span>
            </>
          }
          emptyLabel={t('settings.imgEmptyInspiration')}
          cfg={cfg}
          onConfig={setCfg}
        />
        <ProfileForm
          profile="content"
          title={t('settings.imgProfileContent')}
          blurb={
            <>
              {t('settings.imgContent1')} <strong>{t('settings.imgContentEmbedded')}</strong>
              {t('settings.imgContent2')} <strong>{t('settings.imgContentFastCheap')}</strong>.
            </>
          }
          cfg={cfg}
          onConfig={setCfg}
        />
        <VideoForm cfg={cfg} onConfig={setCfg} />
      </div>
    </section>
  )
}
