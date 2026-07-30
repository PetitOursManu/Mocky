import { useEffect, useRef, useState } from 'react'
import {
  PROVIDERS,
  type Settings,
  loadSettings,
  saveSettings,
} from '../lib/settings'
import { listModels, testConnection, type TestResult } from '../lib/provider'
import { api } from '../lib/api'
import { Button, Icon, IconButton } from '../ui'

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'done'; result: TestResult }

type ModelsState = 'idle' | 'loading' | 'loaded' | 'error'

export default function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [showKey, setShowKey] = useState(false)
  const [test, setTest] = useState<TestState>({ status: 'idle' })
  const [savedFlash, setSavedFlash] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [modelsState, setModelsState] = useState<ModelsState>('idle')
  const [modelsError, setModelsError] = useState<string | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
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
    const t = setTimeout(() => setSavedFlash(false), 1200)
    return () => clearTimeout(t)
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
      setModelsError(res.error ?? 'Failed to load models.')
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
            <span className="kicker text-accent-ink">Settings</span>
            <h2 className="mt-1 text-h2 text-ink">Provider settings</h2>
          </div>
          <span
            className={`flex items-center gap-1.5 text-body-sm text-ok transition-opacity ${savedFlash ? 'opacity-100' : 'opacity-0'}`}
          >
            <Icon name="check" size={16} />
            Saved
          </span>
        </div>
      </header>

      <div className="mt-6 grid gap-x-12 gap-y-8 lg:grid-cols-2">
        {/* An admin can set one model for the whole instance. When they have,
            this page has nothing to ask for — it only says who is in charge. */}
        {managed ? (
          <section>
            <div className="section-head">
              <span className="kicker text-accent-ink">Modèle de l’instance</span>
            </div>
            <h3 className="text-h3 text-accent-ink">{managed.model || '—'}</h3>
            {managed.provider && <p className="kicker mt-1.5">{managed.provider}</p>}
            <p className="measure mt-3 text-body text-ink-muted">
              L’administrateur a choisi ce modèle pour tout le monde. Vous n’avez rien à renseigner
              ici : ni fournisseur, ni adresse, ni clé.
            </p>
            {managed.inspirationModel && (
              <p className="mt-4 flex items-start gap-2 border-t border-line-soft pt-3 text-body-sm text-ink-muted">
                <Icon name="sparkle" size={16} />
                <span>
                  Muse écrit son Design Dossier avec{' '}
                  <strong className="font-medium text-ink">{managed.inspirationModel}</strong>.
                </span>
              </p>
            )}
          </section>
        ) : (
          <section>
            <div className="section-head">
              <span className="kicker text-accent-ink">Connection</span>
            </div>
            <div className="space-y-4">
              <Field label="Provider">
                <select
                  className="input"
                  value={settings.provider}
                  onChange={(e) => {
                    const p = PROVIDERS.find((x) => x.id === e.target.value) ?? PROVIDERS[0]
                    setSettings((s) => ({ ...s, provider: p.id, baseUrl: p.defaultBaseUrl }))
                    setTest({ status: 'idle' })
                  }}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Base URL" hint={`Default: ${activeProvider.defaultBaseUrl}`}>
                <input
                  className="input"
                  type="text"
                  spellCheck={false}
                  value={settings.baseUrl}
                  placeholder={activeProvider.defaultBaseUrl}
                  onChange={(e) => update('baseUrl', e.target.value)}
                />
              </Field>

              <Field label="API key" hint="Sent as a Bearer token. Stored only in your browser's localStorage.">
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    type={showKey ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    value={settings.apiKey}
                    placeholder="ollama-…"
                    onChange={(e) => update('apiKey', e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-ghost shrink-0"
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </Field>

              <Field label="Model" hint={`e.g. ${activeProvider.defaultModel}`}>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      className="input flex-1"
                      value={modelOptions.includes(settings.model) ? settings.model : ''}
                      onChange={(e) => update('model', e.target.value)}
                    >
                      <option value="" disabled>
                        {modelsState === 'loading'
                          ? 'Loading models…'
                          : models.length
                            ? 'Select a model…'
                            : 'No models loaded — reload the list'}
                      </option>
                      {modelOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <IconButton
                      label="Load available models from the provider"
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
                      <span className="font-mono text-accent-ink">{models.length}</span> model
                      {models.length === 1 ? '' : 's'} available from this provider.
                    </span>
                  )}

                  <input
                    className="input"
                    type="text"
                    spellCheck={false}
                    value={settings.model}
                    placeholder={`or type a custom model, e.g. ${activeProvider.defaultModel}`}
                    onChange={(e) => update('model', e.target.value)}
                  />
                </div>
              </Field>
            </div>
          </section>
        )}

        <section className="space-y-8">
          {/* The planner applies whichever provider is in use — the user's own
              or the instance's. */}
          <div>
            <div className="section-head">
              <span className="kicker text-accent-ink">Generation</span>
            </div>
            <label className="flex cursor-pointer items-start gap-3 border border-line-soft bg-ink/5 p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-accent"
                checked={settings.usePlanner}
                onChange={(e) => update('usePlanner', e.target.checked)}
              />
              <span>
                <span className="block text-body font-medium text-ink">Use planner (slower, better structure)</span>
                <span className="measure mt-0.5 block text-body-sm text-ink-muted">
                  A quick pre-generation pass that plans the screen's layout, sections and content before the code is written. Adds a few seconds; falls back automatically if it fails or times out.
                </span>
              </span>
            </label>
          </div>

          {!managed && (
            <div>
              <div className="section-head">
                <span className="kicker text-accent-ink">Connection test</span>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={onTest}
                disabled={test.status === 'testing'}
              >
                {test.status === 'testing' ? 'Testing…' : 'Test connection'}
              </button>
              {test.status === 'done' && <TestBanner result={test.result} onPick={(m) => update('model', m)} />}
            </div>
          )}
        </section>
      </div>

      <p className="mt-8 border-t border-line-soft pt-3 text-body-sm text-ink-muted">
        Settings are stored in your browser. Head to Studio to generate a screen.
      </p>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-body-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-caption text-ink-muted">{hint}</span>}
    </label>
  )
}

function TestBanner({ result, onPick }: { result: TestResult; onPick: (m: string) => void }) {
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
          <div className="kicker mb-1.5">Available models</div>
          <div className="flex flex-wrap gap-1.5">
            {result.models.map((m) => (
              <Button key={m} size="sm" onClick={() => onPick(m)} title="Use this model">
                {m}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
