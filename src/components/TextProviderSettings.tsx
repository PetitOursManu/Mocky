import { useEffect, useState } from 'react'
import { api, type TextConfig, type TextProviderEntry, type TextTestResult } from '../lib/api'

const HINTS: Record<string, string> = {
  '': 'Aucun fournisseur défini pour l’instance : chaque utilisateur configure le sien dans Settings (la clé reste dans son navigateur).',
  'ollama-cloud': 'Ollama Cloud (ou une instance Ollama locale — indiquez son URL). Dialecte natif.',
  openai: 'API OpenAI officielle. Modèles : gpt-4o-mini, gpt-4o, o4-mini…',
  openrouter: 'Une clé, des centaines de modèles. Le modèle s’écrit « éditeur/modèle », ex. openai/gpt-4o-mini.',
  'openai-compatible': 'Tout endpoint exposant /v1/chat/completions : Groq, Together, DeepSeek, Mistral, LM Studio, vLLM… Indiquez l’URL de base (sans /v1).',
}

const MODEL_PLACEHOLDER: Record<string, string> = {
  'ollama-cloud': 'gpt-oss:120b',
  openai: 'gpt-4o-mini',
  openrouter: 'openai/gpt-4o-mini',
  'openai-compatible': 'llama-3.3-70b-versatile',
}

/**
 * Admin settings for the TEXT (LLM) provider used by generation, the planner
 * and Muse. Configuring one here makes it instance-wide; leaving it empty keeps
 * the historical per-browser Settings behaviour.
 */
export default function TextProviderSettings() {
  const [cfg, setCfg] = useState<TextConfig | null>(null)
  const [provider, setProvider] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<TextTestResult | null>(null)

  const entry = (c: TextConfig, id: string): TextProviderEntry =>
    (c[id] as TextProviderEntry) || { baseUrl: '', model: '', hasApiKey: false }

  function hydrate(c: TextConfig, pick?: string) {
    setCfg(c)
    const id = pick ?? c.provider ?? ''
    setProvider(id)
    const e = id ? entry(c, id) : { baseUrl: '', model: '', hasApiKey: false }
    setBaseUrl(e.baseUrl)
    setModel(e.model)
    setApiKey('')
  }

  useEffect(() => {
    api.admin
      .getTextConfig()
      .then((c) => hydrate(c))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  /** Switching provider loads that provider's stored values. */
  function pickProvider(id: string) {
    if (!cfg) return
    hydrate(cfg, id)
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    setTest(null)
    try {
      const patch: Record<string, unknown> = { provider }
      if (provider) patch[provider] = { baseUrl, model, apiKey: apiKey || undefined }
      hydrate(await api.admin.setTextConfig(patch as never), provider)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function clearKey() {
    if (!provider || !confirm('Effacer la clé enregistrée ?')) return
    try {
      hydrate(await api.admin.setTextConfig({ [provider]: { apiKey: null } } as never), provider)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function runTest() {
    setTesting(true)
    setTest(null)
    try {
      setTest(await api.admin.testTextProvider())
    } catch (e) {
      setTest({ ok: false, error: e instanceof Error ? e.message : String(e) })
    } finally {
      setTesting(false)
    }
  }

  if (!cfg) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6 shadow-xl">
        <div className="text-sm font-medium text-slate-200">Modèle de texte (génération)</div>
        <p className="mt-2 text-sm text-slate-500">{error || 'Chargement…'}</p>
      </div>
    )
  }

  const current = provider ? entry(cfg, provider) : null

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6 shadow-xl">
      <h3 className="mb-1 text-sm font-semibold text-slate-100">Modèle de texte (génération)</h3>
      <p className="mb-4 text-xs text-slate-400">
        Le modèle qui écrit les écrans, le planner et les dossiers Muse. Défini ici, il s’applique à{' '}
        <strong>toute l’instance</strong> et les utilisateurs n’ont plus rien à configurer.
      </p>

      <div className="mb-4 rounded-lg border border-amber-700/40 bg-amber-900/20 px-2.5 py-2 text-[11px] text-amber-200">
        ⚠ La clé est stockée <strong>sur ce serveur</strong> et utilisable par tous les comptes de l’instance. Laissez
        « Aucun » pour conserver le mode historique où chaque clé reste dans le navigateur de son utilisateur.
      </div>

      {error && <div className="mb-3 rounded-lg border border-rose-700/50 bg-rose-900/30 p-2 text-xs text-rose-200">{error}</div>}

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-300">Fournisseur</span>
        <select className="input w-full" value={provider} onChange={(e) => pickProvider(e.target.value)}>
          <option value="">Aucun — chaque utilisateur configure le sien</option>
          {cfg.providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-1.5 text-[11px] text-slate-500">{HINTS[provider] ?? ''}</p>

      {provider && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-300">URL de base</span>
            <input
              className="input w-full"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com"
              spellCheck={false}
            />
            <span className="mt-1 block text-[11px] text-slate-500">Sans <code>/v1</code> — Mocky l’ajoute.</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-300">Modèle</span>
            <input
              className="input w-full"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={MODEL_PLACEHOLDER[provider] || ''}
              spellCheck={false}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-300">Clé API</span>
            <input
              className="input w-full"
              type="password"
              autoComplete="off"
              placeholder={current?.hasApiKey ? '•••••••• (enregistrée)' : 'sk-…'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <div className="mt-1">
              {current?.hasApiKey ? (
                <span className="text-[11px] text-emerald-400">
                  ● clé enregistrée —{' '}
                  <button type="button" className="underline underline-offset-2 hover:text-emerald-300" onClick={clearKey}>
                    effacer
                  </button>
                </span>
              ) : (
                <span className="text-[11px] text-slate-500">aucune clé enregistrée (inutile pour un modèle local)</span>
              )}
            </div>
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {provider && (
          <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={runTest} disabled={testing}>
            {testing ? 'Test en cours…' : 'Tester'}
          </button>
        )}
        {saved && <span className="text-xs text-emerald-400">✓ enregistré</span>}
        {test && (
          <span className={`text-xs ${test.ok ? 'text-emerald-400' : 'text-rose-300'}`}>
            {test.ok ? `✓ ${test.model} répond : « ${test.reply} »` : `✕ ${test.error}`}
          </span>
        )}
      </div>
    </div>
  )
}
