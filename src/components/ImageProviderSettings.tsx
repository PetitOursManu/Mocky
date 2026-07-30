import { useEffect, useState } from 'react'
import {
  api,
  type ImageProfile,
  type ImagesConfig,
  type ImagesProfileConfig,
  type ImagesProfilePatch,
  type ImagesTestResult,
} from '../lib/api'
import { Icon } from '../ui'

const LABELS: Record<string, string> = {
  pollinations: 'Pollinations — gratuit, sans clé (défaut)',
  fal: 'fal.ai — FLUX & co.',
  'openai-image': 'OpenAI / compatible — DALL·E, gpt-image',
  'cloudflare-workers-ai': 'Cloudflare Workers AI',
  'sd-webui': 'Automatic1111 / Forge — local (votre GPU)',
  none: 'Aucun — placeholders uniquement',
}

const HINTS: Record<string, string> = {
  '': 'Le même modèle que pour les images de contenu. Choisissez-en un autre si vous voulez une maquette d’inspiration plus soignée sans ralentir les photos hero/produits.',
  pollinations: 'Aucune configuration requise. Limité à ~1 image / 15 s (les requêtes sont mises en file). Un jeton gratuit augmente la limite.',
  fal: 'Clé fal.ai + identifiant du modèle, copié tel quel depuis la page du modèle (tous ne sont pas sous « fal-ai/ »). Mocky passe par la file d’attente fal, donc les modèles lents fonctionnent.',
  'openai-image': 'Tout endpoint exposant POST {URL}/v1/images/generations (OpenAI, LiteLLM, passerelle compatible…).',
  'cloudflare-workers-ai': 'Offre gratuite généreuse. Nécessite l’ID de compte et un jeton API avec la permission Workers AI.',
  'sd-webui': 'Votre instance locale (API activée : --api). Aucune clé, aucune limite, rien ne sort de votre machine.',
  none: 'La génération d’images est désactivée : Muse fonctionne toujours, les emplacements reçoivent un placeholder issu de la palette.',
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
    if (!confirm('Effacer la clé enregistrée ?')) return
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
        ● clé enregistrée —{' '}
        <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => clearSecret(which)}>
          effacer
        </button>
      </span>
    ) : (
      <span className="text-caption text-ink-faint">aucune clé enregistrée</span>
    )

  return (
    <div className="border border-line-soft bg-ink/5 p-4">
      <h4 className="kicker text-ink">{title}</h4>
      <p className="measure mb-3 mt-1.5 text-caption leading-relaxed text-ink-muted">{blurb}</p>

      {error && <div className="mb-3 border border-danger/50 bg-danger/10 p-2 text-body-sm text-danger">{error}</div>}

      <label className="block">
        <span className="mb-1 block text-body-sm font-medium text-ink">Fournisseur</span>
        <select className="input w-full" value={provider} onChange={(e) => setProvider(e.target.value)}>
          {emptyLabel && <option value="">{emptyLabel}</option>}
          {cfg.providers.map((id) => (
            <option key={id} value={id}>
              {LABELS[id] || id}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-1.5 text-caption text-ink-faint">{HINTS[provider]}</p>

      {/* Per-provider fields */}
      <div className="mt-4 space-y-3">
        {provider === 'pollinations' && (
          <label className="block">
            <span className="mb-1 block text-body-sm font-medium text-ink">Jeton (optionnel)</span>
            <input
              className="input w-full"
              type="password"
              placeholder={section.pollinations.hasToken ? '•••••••• (enregistré)' : 'jeton Pollinations — optionnel'}
              value={poToken}
              onChange={(e) => setPoToken(e.target.value)}
            />
            <div className="mt-1">{secretSet(section.pollinations.hasToken, 'pollinations')}</div>
          </label>
        )}

        {provider === 'fal' && (
          <>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">Modèle</span>
              <input
                className="input w-full"
                value={falModel}
                onChange={(e) => setFalModel(e.target.value)}
                placeholder="fal-ai/flux/schnell"
              />
              <span className="mt-1 block text-caption text-ink-faint">
                Copiez l’id exact depuis la page du modèle — tous ne sont pas sous <code>fal-ai/</code>. Ex.{' '}
                <code>fal-ai/flux/schnell</code> (rapide) ou <code>bytedance/seedream/v5/pro/text-to-image</code> (lent, ~2 min).
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">Délai max (secondes)</span>
              <input
                className="input w-32"
                type="number"
                min={30}
                max={900}
                value={falTimeout}
                onChange={(e) => setFalTimeout(Number(e.target.value))}
              />
              <span className="mt-1 block text-caption text-ink-faint">
                Augmentez-le pour un modèle lent (Seedream Pro ≈ 110 s).
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">Clé API</span>
              <input
                className="input w-full"
                type="password"
                placeholder={section.fal.hasApiKey ? '•••••••• (enregistrée)' : 'votre clé fal.ai'}
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
              <span className="mb-1 block text-body-sm font-medium text-ink">URL de base</span>
              <input className="input w-full" value={oaBase} onChange={(e) => setOaBase(e.target.value)} placeholder="https://api.openai.com" />
            </label>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">Modèle</span>
              <input className="input w-full" value={oaModel} onChange={(e) => setOaModel(e.target.value)} placeholder="gpt-image-1 / dall-e-3" />
            </label>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">Clé API</span>
              <input
                className="input w-full"
                type="password"
                placeholder={section.openai.hasApiKey ? '•••••••• (enregistrée)' : 'sk-…'}
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
              <span className="mb-1 block text-body-sm font-medium text-ink">Account ID</span>
              <input className="input w-full" value={cfAccount} onChange={(e) => setCfAccount(e.target.value)} placeholder="a1b2c3…" />
            </label>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">Modèle</span>
              <input className="input w-full" value={cfModel} onChange={(e) => setCfModel(e.target.value)} placeholder="@cf/black-forest-labs/flux-1-schnell" />
            </label>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">Jeton API</span>
              <input
                className="input w-full"
                type="password"
                placeholder={section.cloudflare.hasApiToken ? '•••••••• (enregistré)' : 'jeton avec la permission Workers AI'}
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
              <span className="mb-1 block text-body-sm font-medium text-ink">URL de l’instance</span>
              <input className="input w-full" value={sdBase} onChange={(e) => setSdBase(e.target.value)} placeholder="http://127.0.0.1:7860" />
            </label>
            <label className="block">
              <span className="mb-1 block text-body-sm font-medium text-ink">Steps</span>
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
              <span>
                Cette adresse est appelée par le serveur Mocky lui-même — utilisez uniquement une instance de confiance.
              </span>
            </p>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {provider && (
          <button type="button" className="btn-ghost px-3 py-2 text-body-sm" onClick={runTest} disabled={testing}>
            {testing ? 'Test en cours…' : 'Tester (génère une image)'}
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
            {test.ok
              ? test.skipped
                ? 'fournisseur « aucun » — placeholders'
                : `image générée (${Math.round((test.bytes || 0) / 1024)} Ko)`
              : test.error}
          </span>
        )}
      </div>
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
          <span className="kicker text-accent-ink">Instance</span>
          <h3 className="mt-1 text-h3 text-ink">Génération d’images (Muse)</h3>
        </header>
        <p className="text-body text-ink-faint">{error || 'Chargement…'}</p>
      </section>
    )
  }

  return (
    <section>
      <header className="rule-thin mb-4 border-accent/40 pb-2">
        <span className="kicker text-accent-ink">Instance</span>
        <h3 className="mt-1 text-h3 text-ink">Génération d’images (Muse)</h3>
      </header>

      <p className="measure mb-4 text-body-sm text-ink-muted">
        Muse génère <strong>deux sortes d’images</strong>, et peu de modèles sont bons aux deux. Vous pouvez donc en
        choisir un pour chacune. Les clés sont stockées sur ce serveur et ne sont jamais renvoyées au navigateur ; si un
        service échoue, Muse retombe sur des placeholders.
      </p>

      <div className="space-y-4">
        <ProfileForm
          profile="inspiration"
          title="Image d’inspiration"
          blurb={
            <>
              La <strong>maquette de référence</strong> montrée au LLM pour orienter la direction artistique (mode{' '}
              <em>Inspiration</em>). Une seule par écran : un modèle plus lent et plus cher se justifie, s’il rend bien
              une mise en page de site ou d’app.{' '}
              <span className="text-ink-faint">Laissez « Aucun » pour réutiliser le modèle de contenu.</span>
            </>
          }
          emptyLabel="Aucun — réutilise le modèle de contenu"
          cfg={cfg}
          onConfig={setCfg}
        />
        <ProfileForm
          profile="content"
          title="Images de contenu"
          blurb={
            <>
              Les photos <strong>intégrées dans l’écran</strong> : hero, produits, arrière-plans (modes{' '}
              <em>Contenu</em> et <em>Les deux</em>). Il peut y en avoir plusieurs par écran — privilégiez un modèle{' '}
              <strong>rapide et bon marché</strong>.
            </>
          }
          cfg={cfg}
          onConfig={setCfg}
        />
      </div>
    </section>
  )
}
