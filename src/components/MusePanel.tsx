import type { MuseConfig, MuseResult, GeneratedSlotImage } from '../lib/muse'
import { imageUrl, type PinnedImage } from '../lib/imageLibrary'
import { Button, Icon, Spinner } from '../ui'

/** Domain of a URL, for reference chips (we show text only — never a third-party image, M2). */
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * The ✨ Muse panel: inspiration URLs + live-fetch opt-in, streamed stage, and a
 * mini moodboard of the last Design Dossier (concept, palette, copy, references,
 * generated images). Rendered inside the composer when Muse is enabled.
 *
 * No third-party image is ever shown (M2) — reference cards are text + palette
 * chips; only Mocky-generated images (served from /api/images) are displayed.
 */
export default function MusePanel({
  config,
  onChange,
  available,
  result,
  images,
  stage,
  busy,
  onOpenLibrary,
  pinned,
  onUnpin,
  imageError,
  vision,
}: {
  config: MuseConfig
  onChange: (c: MuseConfig) => void
  available: boolean | null
  result: MuseResult | null
  images: GeneratedSlotImage[]
  stage: string | null
  busy: boolean
  onOpenLibrary: () => void
  pinned: PinnedImage[]
  onUnpin: (hash: string) => void
  /** Why an image slot stayed empty (bad model id, provider down, quota…). */
  imageError?: string | null
  /** null = not probed yet. false = the model refuses images. */
  vision?: boolean | null
}) {
  const d = result?.dossier
  return (
    <div className="mb-2 rounded-xl border border-muse/40 bg-muse/5 p-2.5 text-body-sm">
      {/* Library access + pinned images */}
      <div className="mb-2 flex items-center gap-2">
        <span className="kicker text-muse">Muse</span>
        <Button variant="ghost" size="sm" onClick={onOpenLibrary}>
          <Icon name="library" size={16} />
          Bibliothèque
        </Button>
        {pinned.length > 0 && (
          <div className="flex flex-1 flex-wrap items-center gap-1">
            <span className="kicker">épinglées</span>
            {pinned.map((p) => (
              <span key={p.hash} className="group relative h-7 w-9 overflow-hidden rounded border border-muse">
                <img src={imageUrl(p.hash)} alt={p.label} title={p.label} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onUnpin(p.hash)}
                  className="absolute inset-0 flex items-center justify-center bg-ink/60 text-surface opacity-0 transition group-hover:opacity-100"
                  aria-label={`Retirer ${p.label}`}
                  title="Retirer"
                >
                  <Icon name="close" size={14} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {imageError && (
        <div className="mb-2 rounded-lg border border-warn/40 bg-warn/10 px-2 py-1.5 text-warn">
          <span className="flex items-center gap-1.5">
            <Icon name="image" size={16} />
            Image non générée — {imageError}
          </span>
          <span className="block text-caption text-warn/70">
            L’écran a quand même été généré. Vérifiez le fournisseur d’images dans Admin.
          </span>
        </div>
      )}

      {available === false && (
        <div className="mb-2 rounded-lg border border-warn/40 bg-warn/10 px-2 py-1.5 text-warn">
          Muse a besoin du backend Mocky (lance <code>npm run dev:all</code> ou l'app Docker). Indisponible en mode navigateur seul.
        </div>
      )}

      {/* Inspiration URLs + live-fetch opt-in */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <textarea
          rows={2}
          className="input min-h-[38px] flex-1 resize-none text-body-sm"
          placeholder="URLs d'inspiration (Dribbble, Pinterest, un site…), une par ligne — optionnel"
          value={config.urls}
          onChange={(e) => onChange({ ...config, urls: e.target.value })}
          disabled={busy}
        />
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 pt-1 text-ink-muted" title="Récupère l'inspiration en direct (installe un navigateur Playwright au 1er usage)">
          <input
            type="checkbox"
            className="accent-accent"
            checked={config.useFetch}
            onChange={(e) => onChange({ ...config, useFetch: e.target.checked })}
            disabled={busy}
          />
          Inspiration live
        </label>
      </div>

      {/* What the generated image is for */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="kicker">Image générée</span>
        <span className="flex overflow-hidden border border-line-soft">
          <button
            type="button"
            onClick={() => onChange({ ...config, imageMode: 'content' })}
            disabled={busy}
            title="L’image est insérée dans l’écran (photo héro, produit…)"
            className={`kicker border-b-2 px-2.5 py-1 ${
              config.imageMode === 'content'
                ? 'border-b-accent bg-ink text-surface'
                : 'border-b-transparent text-ink-muted hover:bg-ink/5'
            }`}
          >
            Contenu
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...config, imageMode: 'inspiration' })}
            disabled={busy || vision === false}
            title={
              vision === false
                ? 'Indisponible : ce modèle n’accepte pas les images'
                : 'L’image sert de référence de direction artistique au modèle (elle n’apparaît pas dans l’écran)'
            }
            className={`kicker border-b-2 border-l border-l-line-soft px-2.5 py-1 ${
              config.imageMode === 'inspiration'
                ? 'border-b-accent bg-ink text-surface'
                : 'border-b-transparent text-ink-muted hover:bg-ink/5'
            } ${vision === false ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            Inspiration
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...config, imageMode: 'both' })}
            disabled={busy || vision === false}
            title={
              vision === false
                ? 'Indisponible : ce modèle n’accepte pas les images'
                : 'Le modèle VOIT l’image et l’insère : il compose l’écran autour d’elle (une seule image générée)'
            }
            className={`kicker border-b-2 border-l border-l-line-soft px-2.5 py-1 ${
              config.imageMode === 'both'
                ? 'border-b-accent bg-ink text-surface'
                : 'border-b-transparent text-ink-muted hover:bg-ink/5'
            } ${vision === false ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            Les deux
          </button>
        </span>
        {vision === true && (
          <span className="flex items-center gap-1 text-caption text-ok">
            <Icon name="check" size={14} />
            vision
          </span>
        )}
      </div>

      {/* The saved choice is never rewritten — say plainly that THIS run will
          fall back, so the setting isn't silently undone behind the user. */}
      {vision === false && (
        <div className="mt-1.5 rounded-lg border border-warn/40 bg-warn/10 px-2 py-1.5 text-caption text-warn">
          Vision non détectée sur ce modèle.
          {config.imageMode !== 'content' ? (
            <>
              {' '}
              Votre choix « {config.imageMode === 'both' ? 'Les deux' : 'Inspiration'} » est <strong>conservé</strong>,
              mais cette génération se fera en <strong>Contenu</strong>. Choisissez un modèle avec vision dans Admin →
              Modèles de texte pour l’activer.
            </>
          ) : (
            ' Les modes Inspiration et Les deux ont besoin d’un modèle capable de lire une image.'
          )}
        </div>
      )}

      {/* Streamed stage */}
      {busy && stage && (
        <div className="mt-2 flex items-center gap-2 text-muse">
          <Spinner label={stage} />
          {stage}
        </div>
      )}

      {/* Moodboard */}
      {d && (
        <div className="mt-2.5 space-y-2 border-t border-line-soft pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="kicker flex items-center gap-1.5 text-muse">
              <Icon name="sparkle" size={14} />
              Design Dossier
            </span>
            <span className={`rounded px-1.5 py-0.5 text-caption ${result?.source === 'llm' ? 'bg-ok/20 text-ok' : 'bg-ink/5 text-ink-muted'}`}>
              {result?.source === 'llm' ? 'écrit par le modèle' : 'patterns (hors-ligne)'}
            </span>
          </div>

          {d.concept && <p className="measure leading-snug text-ink">{d.concept}</p>}

          {/* Palette */}
          {d.tokens?.colors?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {d.tokens.colors.map((c, i) => (
                <span key={i} className="flex items-center gap-1 rounded-md border border-line-soft bg-surface py-0.5 pl-0.5 pr-1.5" title={`${c.label}: ${c.hex}`}>
                  <span className="h-4 w-4 rounded" style={{ backgroundColor: c.hex }} />
                  <span className="font-mono text-caption text-ink-muted">{c.hex}</span>
                </span>
              ))}
            </div>
          ) : null}

          {/* Copy */}
          {d.voice?.headline && (
            <div className="rounded-lg border border-line-soft bg-surface p-2">
              <div className="font-semibold text-ink">{d.voice.headline}</div>
              {d.voice.subheadline && <div className="text-ink-muted">{d.voice.subheadline}</div>}
              {d.voice.valueProps?.length ? (
                <ul className="mt-1 list-disc pl-4 text-ink-muted">
                  {d.voice.valueProps.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              ) : null}
              {d.voice.ctaLabels?.length ? (
                <div className="mt-1 flex gap-1.5">
                  {d.voice.ctaLabels.map((c, i) => (
                    <span key={i} className="rounded bg-ink px-2 py-0.5 text-caption font-medium text-surface">
                      {c}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* Generated images (Mocky-origin only) */}
          {images.length > 0 && (
            <div className="space-y-1.5">
              {/* What these images are FOR. Without it there is no way to tell a
                  reference the model only looked at from one placed in the
                  screen — and so no way to check the mode did anything. */}
              <p className="kicker text-accent-ink">
                {config.imageMode === 'inspiration'
                  ? 'Référence d’art direction — non insérée dans l’écran'
                  : config.imageMode === 'both'
                    ? 'Insérée dans l’écran, et montrée au modèle'
                    : 'Insérée dans l’écran'}
              </p>
              <div className="flex flex-wrap gap-2">
              {images.map((im) => (
                <div key={im.id} className="group relative h-16 w-24 overflow-hidden rounded-lg border border-line-soft bg-sunken">
                  <img src={im.url} alt={im.slot} className="h-full w-full object-cover" />
                  <span className="kicker absolute left-0 top-0 bg-ink/60 px-1 text-surface">{im.slot}</span>
                  <a
                    href={`${im.url}?download=1`}
                    className="absolute bottom-0 right-0 flex items-center bg-ink/60 p-1 text-surface opacity-0 transition group-hover:opacity-100"
                    aria-label={`Télécharger l’image ${im.slot}`}
                    title="Télécharger"
                  >
                    <Icon name="download" size={14} />
                  </a>
                </div>
              ))}
              </div>
            </div>
          )}

          {/* References (text only — M2) + notices */}
          {(result?.sources?.length || result?.patterns?.length) ? (
            <div className="flex flex-wrap items-center gap-1.5 text-caption text-ink-muted">
              <span className="kicker">Sources</span>
              {result?.sources?.map((s) => (
                <span key={s.id} className="bg-ink/5 px-1.5 py-0.5" title={s.url}>
                  {domainOf(s.url)}
                </span>
              ))}
              {result?.patterns?.map((p) => (
                <span key={p.id} className="border border-line-soft px-1.5 py-0.5">
                  {p.name}
                </span>
              ))}
            </div>
          ) : null}

          {result?.notices?.length ? (
            <div className="text-caption text-warn">{result.notices[result.notices.length - 1]}</div>
          ) : null}
        </div>
      )}
    </div>
  )
}
