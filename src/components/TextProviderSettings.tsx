import { useEffect, useState } from 'react'
import {
  api,
  type TextConfig,
  type TextProfile,
  type TextProfileConfig,
  type TextProviderEntry,
  type TextTestResult,
} from '../lib/api'

const HINTS: Record<string, string> = {
  '': 'Aucun fournisseur défini pour l’instance : chaque utilisateur configure le sien dans Settings (la clé reste dans son navigateur).',
  'ollama-cloud': 'Ollama Cloud (ou une instance Ollama locale — indiquez son URL). Dialecte natif.',
  openai: 'API OpenAI officielle. Modèles : gpt-4o-mini, gpt-4o, o4-mini…',
  openrouter: 'Une clé, des centaines de modèles. Le modèle s’écrit « éditeur/modèle », ex. openai/gpt-4o-mini.',
  fal: 'Votre clé fal.ai (la même que pour les images) donne aussi accès aux LLM — Claude, GPT, Gemini, Qwen… Le modèle s’écrit « éditeur/modèle », comme sur OpenRouter. Pour le mode Inspiration, prenez un modèle qui voit les images (ex. openai/gpt-4o-mini, google/gemini-2.5-flash).',
  'openai-compatible': 'Tout endpoint exposant /v1/chat/completions : Groq, Together, DeepSeek, Mistral, LM Studio, vLLM… Indiquez l’URL de base (sans /v1).',
}

const MODEL_PLACEHOLDER: Record<string, string> = {
  'ollama-cloud': 'gpt-oss:120b',
  openai: 'gpt-4o-mini',
  openrouter: 'openai/gpt-4o-mini',
  fal: 'openai/gpt-4o-mini',
  'openai-compatible': 'llama-3.3-70b-versatile',
}

/** fal keys are `<id>:<secret>` pairs, not `sk-…` tokens — don't mislead. */
const KEY_PLACEHOLDER: Record<string, string> = { fal: 'xxxxxxxx-…:xxxxxxxx…' }

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
    if (!provider || !confirm('Effacer la clé enregistrée ?')) return
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

  const current = provider ? entry(section, provider) : null

  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">{title}</h4>
      <p className="mb-3 mt-1 text-[11px] leading-relaxed text-slate-400">{blurb}</p>

      {error && <div className="mb-3 rounded-lg border border-rose-700/50 bg-rose-900/30 p-2 text-xs text-rose-200">{error}</div>}

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-300">Fournisseur</span>
        <select className="input w-full" value={provider} onChange={(e) => hydrate(section, e.target.value)}>
          <option value="">{emptyLabel}</option>
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
              placeholder={current?.hasApiKey ? '•••••••• (enregistrée)' : KEY_PLACEHOLDER[provider] || 'sk-…'}
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

/**
 * Admin settings for the TEXT (LLM) providers. Two profiles:
 *  • génération — writes the screens and runs the planner.
 *  • inspiration — Muse's Design Dossier and the vision probe. Optional: left
 *    empty, Muse reuses the generation model (the historical behaviour).
 * Configuring a profile here makes it instance-wide; leaving both empty keeps the
 * per-browser Settings behaviour.
 */
export default function TextProviderSettings() {
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
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6 shadow-xl">
        <div className="text-sm font-medium text-slate-200">Modèles de texte</div>
        <p className="mt-2 text-sm text-slate-500">{error || 'Chargement…'}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6 shadow-xl">
      <h3 className="mb-1 text-sm font-semibold text-slate-100">Modèles de texte (LLM)</h3>
      <p className="mb-4 text-xs text-slate-400">
        Défini ici, un modèle s’applique à <strong>toute l’instance</strong> et les utilisateurs n’ont plus rien à
        configurer. Vous pouvez utiliser <strong>deux modèles différents</strong> : un pour écrire les écrans, un pour
        l’inspiration ✨.
      </p>

      <div className="mb-4 rounded-lg border border-amber-700/40 bg-amber-900/20 px-2.5 py-2 text-[11px] text-amber-200">
        ⚠ La clé est stockée <strong>sur ce serveur</strong> et utilisable par tous les comptes de l’instance. Laissez
        « Aucun » pour conserver le mode historique où chaque clé reste dans le navigateur de son utilisateur.
      </div>

      <div className="space-y-4">
        <ProfileForm
          profile="generation"
          title="① Génération des écrans"
          blurb="Le modèle qui écrit le code des écrans et fait tourner le planner. C’est le modèle principal."
          emptyLabel="Aucun — chaque utilisateur configure le sien"
          cfg={cfg}
          onConfig={setCfg}
        />
        <ProfileForm
          profile="inspiration"
          title="② Inspiration ✨ (Muse)"
          blurb={
            <>
              Le modèle qui rédige le Design Dossier et « regarde » l’image d’inspiration. Il n’écrit pas de code : un
              modèle moins cher suffit — mais le mode <em>Inspiration</em> exige la <strong>vision</strong>.{' '}
              <span className="text-slate-500">Laissez « Aucun » pour réutiliser le modèle de génération.</span>
            </>
          }
          emptyLabel="Aucun — réutilise le modèle de génération"
          cfg={cfg}
          onConfig={setCfg}
        />
      </div>
    </div>
  )
}
