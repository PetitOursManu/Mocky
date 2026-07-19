import { useEffect, useRef, useState } from 'react'
import {
  PROVIDERS,
  type Settings,
  loadSettings,
  saveSettings,
} from '../lib/settings'
import { listModels, testConnection, type TestResult } from '../lib/provider'

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
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6 shadow-xl backdrop-blur">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Provider settings</h2>
          <span
            className={`text-xs text-emerald-400 transition-opacity ${savedFlash ? 'opacity-100' : 'opacity-0'}`}
          >
            Saved ✓
          </span>
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
                        : 'No models loaded — click ↻'}
                  </option>
                  {modelOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-ghost shrink-0"
                  onClick={loadModels}
                  disabled={modelsState === 'loading'}
                  title="Load available models from the provider"
                >
                  {modelsState === 'loading' ? '…' : '↻'}
                </button>
              </div>

              {modelsState === 'error' && (
                <span className="block text-xs text-rose-300">{modelsError}</span>
              )}
              {modelsState === 'loaded' && (
                <span className="block text-xs text-slate-500">
                  {models.length} model{models.length === 1 ? '' : 's'} available from this provider.
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

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/40 p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-indigo-500"
              checked={settings.usePlanner}
              onChange={(e) => update('usePlanner', e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-slate-200">Use planner (slower, better structure)</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                A quick pre-generation pass that plans the screen's layout, sections and content before the code is written. Adds a few seconds; falls back automatically if it fails or times out.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            onClick={onTest}
            disabled={test.status === 'testing'}
          >
            {test.status === 'testing' ? 'Testing…' : 'Test connection'}
          </button>
        </div>

        {test.status === 'done' && <TestBanner result={test.result} onPick={(m) => update('model', m)} />}
      </div>

      <p className="mt-4 text-center text-xs text-slate-500">
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
      <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

function TestBanner({ result, onPick }: { result: TestResult; onPick: (m: string) => void }) {
  return (
    <div
      className={`mt-4 rounded-xl border p-3 text-sm ${
        result.ok
          ? 'border-emerald-700/50 bg-emerald-900/30 text-emerald-200'
          : 'border-rose-700/50 bg-rose-900/30 text-rose-200'
      }`}
    >
      <div className="font-medium">{result.ok ? '✓ ' : '✗ '}{result.message}</div>
      {result.models && result.models.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Available models</div>
          <div className="flex flex-wrap gap-1.5">
            {result.models.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onPick(m)}
                className="rounded-md bg-slate-700/70 px-2 py-0.5 text-xs text-slate-200 hover:bg-slate-600"
                title="Use this model"
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
