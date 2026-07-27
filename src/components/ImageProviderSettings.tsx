import { useEffect, useState } from 'react'
import { api, type ImagesConfig, type ImagesConfigPatch, type ImagesTestResult } from '../lib/api'

const LABELS: Record<string, string> = {
  pollinations: 'Pollinations — gratuit, sans clé (défaut)',
  fal: 'fal.ai — FLUX & co.',
  'openai-image': 'OpenAI / compatible — DALL·E, gpt-image',
  'cloudflare-workers-ai': 'Cloudflare Workers AI',
  'sd-webui': 'Automatic1111 / Forge — local (votre GPU)',
  none: 'Aucun — placeholders uniquement',
}

const HINTS: Record<string, string> = {
  pollinations: 'Aucune configuration requise. Limité à ~1 image / 15 s (les requêtes sont mises en file). Un jeton gratuit augmente la limite.',
  fal: 'Clé fal.ai + identifiant du modèle. Privilégiez un modèle rapide (schnell) : l’appel est synchrone. La graine est transmise, donc le cache prompt+seed fonctionne.',
  'openai-image': 'Tout endpoint exposant POST {URL}/v1/images/generations (OpenAI, LiteLLM, passerelle compatible…).',
  'cloudflare-workers-ai': 'Offre gratuite généreuse. Nécessite l’ID de compte et un jeton API avec la permission Workers AI.',
  'sd-webui': 'Votre instance locale (API activée : --api). Aucune clé, aucune limite, rien ne sort de votre machine.',
  none: 'La génération d’images est désactivée : Muse fonctionne toujours, les emplacements reçoivent un placeholder issu de la palette.',
}

/** Admin settings for the Muse image-generation provider. Secrets are stored
 *  server-side and never returned — the UI only knows whether one is set. */
export default function ImageProviderSettings() {
  const [cfg, setCfg] = useState<ImagesConfig | null>(null)
  const [provider, setProvider] = useState('pollinations')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<ImagesTestResult | null>(null)

  // Editable fields (secrets stay empty = "keep the stored value").
  const [poToken, setPoToken] = useState('')
  const [falKey, setFalKey] = useState('')
  const [falModel, setFalModel] = useState('')
  const [oaBase, setOaBase] = useState('')
  const [oaModel, setOaModel] = useState('')
  const [oaKey, setOaKey] = useState('')
  const [cfAccount, setCfAccount] = useState('')
  const [cfModel, setCfModel] = useState('')
  const [cfToken, setCfToken] = useState('')
  const [sdBase, setSdBase] = useState('')
  const [sdSteps, setSdSteps] = useState(20)

  function hydrate(c: ImagesConfig) {
    setCfg(c)
    setProvider(c.provider)
    setFalModel(c.fal.model)
    setOaBase(c.openai.baseUrl)
    setOaModel(c.openai.model)
    setCfAccount(c.cloudflare.accountId)
    setCfModel(c.cloudflare.model)
    setSdBase(c.sdWebui.baseUrl)
    setSdSteps(c.sdWebui.steps)
    setPoToken('')
    setFalKey('')
    setOaKey('')
    setCfToken('')
  }

  useEffect(() => {
    api.admin
      .getImagesConfig()
      .then(hydrate)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const patch: ImagesConfigPatch = {
        provider,
        pollinations: { token: poToken || undefined },
        fal: { model: falModel, apiKey: falKey || undefined },
        openai: { baseUrl: oaBase, model: oaModel, apiKey: oaKey || undefined },
        cloudflare: { accountId: cfAccount, model: cfModel, apiToken: cfToken || undefined },
        sdWebui: { baseUrl: sdBase, steps: sdSteps },
      }
      hydrate(await api.admin.setImagesConfig(patch))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function clearSecret(which: 'pollinations' | 'fal' | 'openai' | 'cloudflare') {
    if (!confirm('Effacer la clé enregistrée ?')) return
    const patch: ImagesConfigPatch =
      which === 'pollinations'
        ? { pollinations: { token: null } }
        : which === 'fal'
          ? { fal: { apiKey: null } }
          : which === 'openai'
            ? { openai: { apiKey: null } }
            : { cloudflare: { apiToken: null } }
    try {
      hydrate(await api.admin.setImagesConfig(patch))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function runTest() {
    setTesting(true)
    setTest(null)
    try {
      setTest(await api.admin.testImagesProvider(provider))
    } catch (e) {
      setTest({ ok: false, provider, error: e instanceof Error ? e.message : String(e) })
    } finally {
      setTesting(false)
    }
  }

  if (!cfg) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6 shadow-xl">
        <div className="text-sm font-medium text-slate-200">Génération d’images (Muse)</div>
        <p className="mt-2 text-sm text-slate-500">{error || 'Chargement…'}</p>
      </div>
    )
  }

  const secretSet = (
    isSet: boolean,
    which: 'pollinations' | 'fal' | 'openai' | 'cloudflare',
  ) =>
    isSet ? (
      <span className="text-[11px] text-emerald-400">
        ● clé enregistrée —{' '}
        <button type="button" className="underline underline-offset-2 hover:text-emerald-300" onClick={() => clearSecret(which)}>
          effacer
        </button>
      </span>
    ) : (
      <span className="text-[11px] text-slate-500">aucune clé enregistrée</span>
    )

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6 shadow-xl">
      <h3 className="mb-1 text-sm font-semibold text-slate-100">Génération d’images (Muse)</h3>
      <p className="mb-4 text-xs text-slate-400">
        Choisissez le service qui génère les images de Muse. Les clés sont stockées sur ce serveur et ne sont jamais
        renvoyées au navigateur. Si un service échoue, Muse retombe automatiquement sur des placeholders.
      </p>

      {error && <div className="mb-3 rounded-lg border border-rose-700/50 bg-rose-900/30 p-2 text-xs text-rose-200">{error}</div>}

      {/* Provider choice */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-300">Fournisseur</span>
        <select className="input w-full" value={provider} onChange={(e) => setProvider(e.target.value)}>
          {cfg.providers.map((id) => (
            <option key={id} value={id}>
              {LABELS[id] || id}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-1.5 text-[11px] text-slate-500">{HINTS[provider]}</p>

      {/* Per-provider fields */}
      <div className="mt-4 space-y-3">
        {provider === 'pollinations' && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-300">Jeton (optionnel)</span>
            <input
              className="input w-full"
              type="password"
              placeholder={cfg.pollinations.hasToken ? '•••••••• (enregistré)' : 'jeton Pollinations — optionnel'}
              value={poToken}
              onChange={(e) => setPoToken(e.target.value)}
            />
            <div className="mt-1">{secretSet(cfg.pollinations.hasToken, 'pollinations')}</div>
          </label>
        )}

        {provider === 'fal' && (
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-300">Modèle</span>
              <input
                className="input w-full"
                value={falModel}
                onChange={(e) => setFalModel(e.target.value)}
                placeholder="fal-ai/flux/schnell"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                ex. <code>fal-ai/flux/schnell</code> (rapide), <code>fal-ai/flux/dev</code>, <code>fal-ai/flux-pro/v1.1</code>
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-300">Clé API</span>
              <input
                className="input w-full"
                type="password"
                placeholder={cfg.fal.hasApiKey ? '•••••••• (enregistrée)' : 'votre clé fal.ai'}
                value={falKey}
                onChange={(e) => setFalKey(e.target.value)}
              />
              <div className="mt-1">{secretSet(cfg.fal.hasApiKey, 'fal')}</div>
            </label>
          </>
        )}

        {provider === 'openai-image' && (
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-300">URL de base</span>
              <input className="input w-full" value={oaBase} onChange={(e) => setOaBase(e.target.value)} placeholder="https://api.openai.com" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-300">Modèle</span>
              <input className="input w-full" value={oaModel} onChange={(e) => setOaModel(e.target.value)} placeholder="gpt-image-1 / dall-e-3" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-300">Clé API</span>
              <input
                className="input w-full"
                type="password"
                placeholder={cfg.openai.hasApiKey ? '•••••••• (enregistrée)' : 'sk-…'}
                value={oaKey}
                onChange={(e) => setOaKey(e.target.value)}
              />
              <div className="mt-1">{secretSet(cfg.openai.hasApiKey, 'openai')}</div>
            </label>
          </>
        )}

        {provider === 'cloudflare-workers-ai' && (
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-300">Account ID</span>
              <input className="input w-full" value={cfAccount} onChange={(e) => setCfAccount(e.target.value)} placeholder="a1b2c3…" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-300">Modèle</span>
              <input className="input w-full" value={cfModel} onChange={(e) => setCfModel(e.target.value)} placeholder="@cf/black-forest-labs/flux-1-schnell" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-300">Jeton API</span>
              <input
                className="input w-full"
                type="password"
                placeholder={cfg.cloudflare.hasApiToken ? '•••••••• (enregistré)' : 'jeton avec la permission Workers AI'}
                value={cfToken}
                onChange={(e) => setCfToken(e.target.value)}
              />
              <div className="mt-1">{secretSet(cfg.cloudflare.hasApiToken, 'cloudflare')}</div>
            </label>
          </>
        )}

        {provider === 'sd-webui' && (
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-300">URL de l’instance</span>
              <input className="input w-full" value={sdBase} onChange={(e) => setSdBase(e.target.value)} placeholder="http://127.0.0.1:7860" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-300">Steps</span>
              <input
                className="input w-32"
                type="number"
                min={1}
                max={150}
                value={sdSteps}
                onChange={(e) => setSdSteps(Number(e.target.value))}
              />
            </label>
            <p className="text-[11px] text-amber-300/80">
              ⚠ Cette adresse est appelée par le serveur Mocky lui-même — utilisez uniquement une instance de confiance.
            </p>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={runTest} disabled={testing}>
          {testing ? 'Test en cours…' : 'Tester (génère une image)'}
        </button>
        {saved && <span className="text-xs text-emerald-400">✓ enregistré</span>}
        {test && (
          <span className={`text-xs ${test.ok ? 'text-emerald-400' : 'text-rose-300'}`}>
            {test.ok
              ? test.skipped
                ? '✓ fournisseur « aucun » — placeholders'
                : `✓ image générée (${Math.round((test.bytes || 0) / 1024)} Ko)`
              : `✕ ${test.error}`}
          </span>
        )}
      </div>
    </div>
  )
}
