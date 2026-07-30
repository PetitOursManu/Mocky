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

const HINTS: Record<string, string> = {
  '': 'Aucun fournisseur défini pour l’instance : chaque utilisateur configure le sien dans Settings (la clé reste dans son navigateur).',
  'ollama-cloud': 'Ollama Cloud (ou une instance Ollama locale — indiquez son URL). Dialecte natif.',
  openai: 'API OpenAI officielle. Modèles : gpt-4o-mini, gpt-4o, o4-mini…',
  openrouter: 'Une clé, des centaines de modèles. Le modèle s’écrit « éditeur/modèle », ex. openai/gpt-4o-mini.',
  fal: 'Votre clé fal.ai (la même que pour les images) donne aussi accès aux LLM. Ce champ n’est PAS pour un modèle d’images : fal expose ses LLM via OpenRouter, donc le modèle s’écrit « éditeur/modèle » — openai/gpt-4o-mini, google/gemini-2.5-flash, qwen/qwen3.5-flash-02-23… (un id du type fal-ai/…/text-to-image sera refusé). Pour le mode Inspiration, prenez un modèle qui voit les images.',
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
    <div className="border border-line-soft bg-ink/5 p-4">
      <h4 className="kicker text-ink">{title}</h4>
      <p className="measure mb-3 mt-1.5 text-caption leading-relaxed text-ink-muted">{blurb}</p>

      {error && <div className="mb-3 border border-danger/50 bg-danger/10 p-2 text-body-sm text-danger">{error}</div>}

      <label className="block">
        <span className="mb-1 block text-body-sm font-medium text-ink">Fournisseur</span>
        <select className="input w-full" value={provider} onChange={(e) => hydrate(section, e.target.value)}>
          <option value="">{emptyLabel}</option>
          {cfg.providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-1.5 text-caption text-ink-faint">{HINTS[provider] ?? ''}</p>

      {provider && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-body-sm font-medium text-ink">URL de base</span>
            <input
              className="input w-full"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com"
              spellCheck={false}
            />
            <span className="mt-1 block text-caption text-ink-faint">Sans <code>/v1</code> — Mocky l’ajoute.</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-body-sm font-medium text-ink">Modèle</span>
            <input
              className="input w-full"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={MODEL_PLACEHOLDER[provider] || ''}
              spellCheck={false}
            />
            {looksLikeImageModel(model) && (
              <span className="mt-1.5 flex items-start gap-2 border border-warn/40 bg-warn/10 px-2 py-1.5 text-caption text-warn">
                <Icon name="warning" size={16} />
                <span>
                  « {model} » ressemble à un modèle d’<strong>images</strong>. Ce champ attend un <strong>LLM</strong>{' '}
                  (texte) — ex. <code>openai/gpt-4o-mini</code>, <code>google/gemini-2.5-flash</code>,{' '}
                  <code>qwen/qwen3.5-flash-02-23</code>. Les modèles d’images se règlent dans{' '}
                  <strong>Génération d’images (Muse)</strong>.
                </span>
              </span>
            )}
          </label>
          <label className="block">
            <span className="mb-1 block text-body-sm font-medium text-ink">Clé API</span>
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
                <span className="text-caption text-ok">
                  ● clé enregistrée —{' '}
                  <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={clearKey}>
                    effacer
                  </button>
                </span>
              ) : (
                <span className="text-caption text-ink-faint">aucune clé enregistrée (inutile pour un modèle local)</span>
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
          <button type="button" className="btn-ghost px-3 py-2 text-body-sm" onClick={runTest} disabled={testing}>
            {testing ? 'Test en cours…' : 'Tester'}
          </button>
        )}
        {saved && (
          <span className="flex items-center gap-1.5 text-body-sm text-ok">
            <Icon name="check" size={16} />
            enregistré
          </span>
        )}
        {test && (
          <span className={`flex items-center gap-1.5 text-body-sm ${test.ok ? 'text-ok' : 'text-danger'}`}>
            <Icon name={test.ok ? 'check' : 'close'} size={16} />
            {test.ok ? `${test.model} répond : « ${test.reply} »` : test.error}
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
      <section>
        <header className="rule-thin mb-4 border-accent/40 pb-2">
          <span className="kicker text-accent-ink">Instance</span>
          <h3 className="mt-1 text-h3 text-ink">Modèles de texte (LLM)</h3>
        </header>
        <p className="text-body text-ink-faint">{error || 'Chargement…'}</p>
      </section>
    )
  }

  return (
    <section>
      <header className="rule-thin mb-4 border-accent/40 pb-2">
        <span className="kicker text-accent-ink">Instance</span>
        <h3 className="mt-1 text-h3 text-ink">Modèles de texte (LLM)</h3>
      </header>

      <p className="measure mb-3 text-body-sm text-ink-muted">
        Deux modèles <strong>qui écrivent du texte</strong>. Défini ici, un modèle s’applique à{' '}
        <strong>toute l’instance</strong> et les utilisateurs n’ont plus rien à configurer.
      </p>
      <p className="mb-3 flex items-start gap-2 border border-line-soft bg-ink/5 px-2.5 py-2 text-caption text-ink-muted">
        <Icon name="image" size={16} />
        <span>
          <strong>Ce n’est pas ici que l’image d’inspiration est générée.</strong> Le modèle qui <em>fabrique</em>{' '}
          l’image (Seedream, Flux, nano-banana…) se règle dans <strong>Génération d’images (Muse)</strong>.
          Muse enchaîne les deux : ② écrit le dossier et la description de l’image → le modèle d’images la fabrique →
          ② (ou ①) la <em>regarde</em> pour composer l’écran.
        </span>
      </p>

      <div className="mb-4 flex items-start gap-2 border border-warn/40 bg-warn/10 px-2.5 py-2 text-caption text-warn">
        <Icon name="warning" size={16} />
        <span>
          La clé est stockée <strong>sur ce serveur</strong> et utilisable par tous les comptes de l’instance. Laissez
          « Aucun » pour conserver le mode historique où chaque clé reste dans le navigateur de son utilisateur.
        </span>
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
          title="② Muse — texte du Design Dossier"
          blurb={
            <>
              Le modèle qui <strong>rédige</strong> le Design Dossier (concept, palette, vrais textes) et qui{' '}
              <strong>regarde</strong> l’image d’inspiration une fois qu’elle existe. Il n’écrit pas de code : un modèle
              moins cher suffit — mais le mode <em>Inspiration</em> exige la <strong>vision</strong>.{' '}
              <span className="text-ink-faint">
                Ce n’est pas lui qui fabrique l’image. Laissez « Aucun » pour réutiliser le modèle de génération.
              </span>
            </>
          }
          emptyLabel="Aucun — réutilise le modèle de génération"
          cfg={cfg}
          onConfig={setCfg}
        />
      </div>
    </section>
  )
}
