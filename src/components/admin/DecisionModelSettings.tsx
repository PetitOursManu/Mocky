import { useEffect, useState } from 'react'
import { api, type DecisionModelSettings as Settings } from '../../lib/api'
import { Banner, Button, Field, Input, Select } from '../../ui'
import { useT } from '../../i18n'

/**
 * Admin → Providers → Decision model (server/decision/config.js).
 *
 * A model that answers typed questions and writes nothing — TypeSafe's Jev
 * today. When one is set up, the project audit uses it for every evaluation;
 * when not, Muse's text model answers the same questions. The key is
 * write-only, like every other key on this page: never sent back, the field
 * stays empty, typing a new one replaces it.
 */
export default function DecisionModelSettings() {
  const t = useT()
  const [s, setS] = useState<Settings | null>(null)
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [images, setImages] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn' | 'danger'; text: string } | null>(null)

  function load(v: Settings) {
    setS(v)
    setProvider(v.provider)
    setModel(v.model)
    setBaseUrl(v.baseUrl)
    setImages(v.images)
    setApiKey('')
  }

  useEffect(() => {
    api.admin.decision
      .get()
      .then(load)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const v = await api.admin.decision.set({ provider, model, baseUrl, apiKey, images })
      load(v)
      setMessage(v.persistError ? { tone: 'warn', text: t('decision.admin.persistError') } : { tone: 'ok', text: t('decision.admin.saved') })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    setMessage(null)
    try {
      const r = await api.admin.decision.test()
      if (r.ok) setMessage({ tone: 'ok', text: t('decision.admin.testOk', { model: r.model ?? '', ms: r.ms ?? 0 }) })
      else {
        const known = r.code === 'not-configured' || r.code === 'auth' || r.code === 'busy'
        setMessage({
          tone: 'danger',
          text: known ? t(`decision.admin.test.${r.code}` as 'decision.admin.test.auth') : t('decision.admin.test.other', { error: r.error || r.code || '?' }),
        })
      }
    } catch (err) {
      setMessage({ tone: 'danger', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  if (!s) {
    return error ? (
      <Banner tone="danger" className="mt-4">
        {error}
      </Banner>
    ) : null
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="kicker">{t('decision.admin.title')}</h3>
        <span className={`text-caption ${s.configured ? 'text-ok' : 'text-ink-faint'}`}>
          {s.configured ? t('decision.admin.on') : t('decision.admin.off')}
        </span>
      </div>
      <p className="measure text-body-sm text-ink-muted">{t('decision.admin.blurb')}</p>

      <Field label={t('decision.admin.provider')}>
        {(p) => (
          <Select
            {...p}
            value={provider}
            onChange={(e) => {
              const id = (e.currentTarget as unknown as HTMLSelectElement).value
              setProvider(id)
              const def = s.providers.find((x) => x.id === id)
              if (def && !model) setModel(def.model)
              if (def && !baseUrl) setBaseUrl(def.baseUrl)
            }}
          >
            <option value="">{t('decision.admin.none')}</option>
            {s.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {provider && (
        <>
          <Field label={t('decision.admin.apiKey')} hint={s.hasApiKey ? t('decision.admin.keyKept') : t('decision.admin.keyHint')}>
            {(p) => (
              <Input
                {...p}
                type="password"
                autoComplete="off"
                placeholder={s.hasApiKey ? '••••••••' : ''}
                value={apiKey}
                onChange={(e) => setApiKey(e.currentTarget.value)}
              />
            )}
          </Field>
          <Field label={t('decision.admin.model')}>
            {(p) => <Input {...p} spellCheck={false} value={model} onChange={(e) => setModel(e.currentTarget.value)} />}
          </Field>
          <Field label={t('decision.admin.baseUrl')}>
            {(p) => <Input {...p} spellCheck={false} value={baseUrl} onChange={(e) => setBaseUrl(e.currentTarget.value)} />}
          </Field>
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block text-body-sm font-medium text-ink">{t('decision.admin.images')}</span>
              <span className="measure block text-caption text-ink-muted">{t('decision.admin.imagesHelp')}</span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-accent" checked={images} onChange={(e) => setImages(e.currentTarget.checked)} />
          </label>
          <p className="measure text-caption text-ink-faint">{t('decision.admin.free')}</p>
        </>
      )}

      {error && <Banner tone="danger">{error}</Banner>}
      {message && <Banner tone={message.tone}>{message.text}</Banner>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {t('decision.admin.save')}
        </Button>
        {s.provider && (
          <Button type="button" variant="ghost" disabled={busy} onClick={test}>
            {t('decision.admin.test')}
          </Button>
        )}
      </div>
    </form>
  )
}
