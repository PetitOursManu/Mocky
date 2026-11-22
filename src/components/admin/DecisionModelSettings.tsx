import { useEffect, useState } from 'react'
import { api, type DecisionModelSettings as Settings, type DecisionProviderRecord } from '../../lib/api'
import { Banner, Button, Field, Input, Select } from '../../ui'
import { useT } from '../../i18n'

/**
 * Admin → Providers → Decision model (server/decision/config.js).
 *
 * A model that answers typed questions and writes nothing — TypeSafe's Jev,
 * from TypeSafe itself or from a gateway that resells it (OpenRouter, Vercel AI
 * Gateway, Opper, or one typed by hand). When one is set up, the project audit,
 * Polish and the SEO deep pass use it; when not, Muse's text model answers the
 * same questions. Each provider keeps its own address, model and key, like the
 * text providers, so switching does not lose a key. Keys are write-only: never
 * sent back, the field stays empty, typing a new one replaces it.
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

  const recordOf = (v: Settings, id: string) => (v[id] as DecisionProviderRecord | undefined) ?? { baseUrl: '', model: '', hasApiKey: false }

  function show(v: Settings, id: string) {
    const r = recordOf(v, id)
    setProvider(id)
    setModel(r.model)
    setBaseUrl(r.baseUrl)
    setApiKey('')
  }

  function load(v: Settings) {
    setS(v)
    setImages(v.images)
    show(v, v.provider)
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
      const v = await api.admin.decision.set({
        provider,
        images,
        ...(provider ? { [provider]: { baseUrl, model, apiKey } } : {}),
      })
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
        const known = r.code === 'not-configured' || r.code === 'auth' || r.code === 'busy' || r.code === 'credits'
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

  const record = provider ? recordOf(s, provider) : null
  const custom = provider === 'systemone-compatible'
  // What is on screen differs from what is saved: testing would test the saved one.
  const dirty = provider !== s.provider || (record != null && (baseUrl !== record.baseUrl || model !== record.model || apiKey !== ''))

  return (
    <form data-admin-setting="decision-model" onSubmit={save} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="kicker">{t('decision.admin.title')}</h3>
        <span className={`text-caption ${s.configured ? 'text-ok' : 'text-ink-faint'}`}>
          {s.configured ? t('decision.admin.on') : t('decision.admin.off')}
        </span>
      </div>
      <p className="measure text-body-sm text-ink-muted">{t('decision.admin.blurb')}</p>

      <Field label={t('decision.admin.provider')} hint={t('decision.admin.providerHint')}>
        {(p) => (
          <Select {...p} value={provider} onChange={(e) => show(s, (e.currentTarget as unknown as HTMLSelectElement).value)}>
            <option value="">{t('decision.admin.none')}</option>
            {s.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === 'systemone-compatible' ? t('decision.admin.custom') : p.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {provider && record && (
        <>
          <Field
            label={t('decision.admin.apiKey')}
            hint={record.hasApiKey ? t('decision.admin.keyKept') : t(`decision.admin.keyHint.${provider}` as 'decision.admin.keyHint.typesafe')}
          >
            {(p) => (
              <Input
                {...p}
                type="password"
                autoComplete="off"
                placeholder={record.hasApiKey ? '••••••••' : ''}
                value={apiKey}
                onChange={(e) => setApiKey(e.currentTarget.value)}
              />
            )}
          </Field>
          <Field label={t('decision.admin.model')} hint={t('decision.admin.modelHint')}>
            {(p) => <Input {...p} spellCheck={false} value={model} onChange={(e) => setModel(e.currentTarget.value)} />}
          </Field>
          <Field label={t('decision.admin.baseUrl')} hint={custom ? t('decision.admin.baseUrlCustom') : undefined}>
            {(p) => (
              <Input
                {...p}
                spellCheck={false}
                value={baseUrl}
                placeholder={custom ? 'https://gateway.example.com/api' : undefined}
                onChange={(e) => setBaseUrl(e.currentTarget.value)}
              />
            )}
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

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {t('decision.admin.save')}
        </Button>
        {s.provider && (
          <Button type="button" variant="ghost" disabled={busy || dirty} onClick={test} title={dirty ? t('decision.admin.saveFirst') : undefined}>
            {t('decision.admin.test')}
          </Button>
        )}
        {dirty && s.provider && <span className="text-caption text-ink-faint">{t('decision.admin.saveFirst')}</span>}
      </div>
    </form>
  )
}
