import type { MuseConfig, MuseResult, GeneratedSlotImage } from '../lib/muse'
import { imageUrl, type PinnedImage } from '../lib/imageLibrary'

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
}) {
  const d = result?.dossier
  return (
    <div className="mb-2 rounded-xl border border-fuchsia-700/40 bg-fuchsia-950/20 p-2.5 text-xs">
      {/* Library access + pinned images */}
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenLibrary}
          className="rounded-md border border-fuchsia-700/50 bg-fuchsia-900/30 px-2 py-1 font-medium text-fuchsia-200 hover:bg-fuchsia-900/50"
        >
          📚 Bibliothèque
        </button>
        {pinned.length > 0 && (
          <div className="flex flex-1 flex-wrap items-center gap-1">
            <span className="text-[10px] text-slate-400">épinglées :</span>
            {pinned.map((p) => (
              <span key={p.hash} className="group relative h-7 w-9 overflow-hidden rounded border border-fuchsia-500">
                <img src={imageUrl(p.hash)} alt={p.label} title={p.label} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onUnpin(p.hash)}
                  className="absolute inset-0 flex items-center justify-center bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                  title="Retirer"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {imageError && (
        <div className="mb-2 rounded-lg border border-amber-700/40 bg-amber-900/20 px-2 py-1.5 text-amber-200">
          🖼 Image non générée — {imageError}
          <span className="block text-[10px] text-amber-300/70">
            L’écran a quand même été généré. Vérifiez le fournisseur d’images dans Admin.
          </span>
        </div>
      )}

      {available === false && (
        <div className="mb-2 rounded-lg border border-amber-700/40 bg-amber-900/20 px-2 py-1.5 text-amber-200">
          Muse a besoin du backend Mocky (lance <code>npm run dev:all</code> ou l'app Docker). Indisponible en mode navigateur seul.
        </div>
      )}

      {/* Inspiration URLs + live-fetch opt-in */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <textarea
          rows={2}
          className="input min-h-[38px] flex-1 resize-none text-xs"
          placeholder="URLs d'inspiration (Dribbble, Pinterest, un site…), une par ligne — optionnel"
          value={config.urls}
          onChange={(e) => onChange({ ...config, urls: e.target.value })}
          disabled={busy}
        />
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 pt-1 text-slate-300" title="Récupère l'inspiration en direct (installe un navigateur Playwright au 1er usage)">
          <input
            type="checkbox"
            checked={config.useFetch}
            onChange={(e) => onChange({ ...config, useFetch: e.target.checked })}
            disabled={busy}
          />
          Inspiration live
        </label>
      </div>

      {/* Streamed stage */}
      {busy && stage && (
        <div className="mt-2 flex items-center gap-2 text-fuchsia-200">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-fuchsia-300/40 border-t-fuchsia-300" />
          {stage}
        </div>
      )}

      {/* Moodboard */}
      {d && (
        <div className="mt-2.5 space-y-2 border-t border-fuchsia-800/30 pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-fuchsia-200">✨ Design Dossier</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${result?.source === 'llm' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-600/40 text-slate-300'}`}>
              {result?.source === 'llm' ? 'écrit par le modèle' : 'patterns (hors-ligne)'}
            </span>
          </div>

          {d.concept && <p className="leading-snug text-slate-200">{d.concept}</p>}

          {/* Palette */}
          {d.tokens?.colors?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {d.tokens.colors.map((c, i) => (
                <span key={i} className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/60 py-0.5 pl-0.5 pr-1.5" title={`${c.label}: ${c.hex}`}>
                  <span className="h-4 w-4 rounded" style={{ backgroundColor: c.hex }} />
                  <span className="text-[10px] text-slate-400">{c.hex}</span>
                </span>
              ))}
            </div>
          ) : null}

          {/* Copy */}
          {d.voice?.headline && (
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-2">
              <div className="font-semibold text-slate-100">{d.voice.headline}</div>
              {d.voice.subheadline && <div className="text-slate-400">{d.voice.subheadline}</div>}
              {d.voice.valueProps?.length ? (
                <ul className="mt-1 list-disc pl-4 text-slate-300">
                  {d.voice.valueProps.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              ) : null}
              {d.voice.ctaLabels?.length ? (
                <div className="mt-1 flex gap-1.5">
                  {d.voice.ctaLabels.map((c, i) => (
                    <span key={i} className="rounded bg-indigo-500 px-2 py-0.5 text-[10px] font-medium text-white">
                      {c}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* Generated images (Mocky-origin only) */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((im) => (
                <div key={im.id} className="group relative h-16 w-24 overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
                  <img src={im.url} alt={im.slot} className="h-full w-full object-cover" />
                  <span className="absolute left-0 top-0 rounded-br bg-black/60 px-1 text-[9px] text-white">{im.slot}</span>
                  <a
                    href={`${im.url}?download=1`}
                    className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
                    title="Télécharger"
                  >
                    ⬇
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* References (text only — M2) + notices */}
          {(result?.sources?.length || result?.patterns?.length) ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
              <span>Sources :</span>
              {result?.sources?.map((s) => (
                <span key={s.id} className="rounded bg-slate-800 px-1.5 py-0.5" title={s.url}>
                  🌐 {domainOf(s.url)}
                </span>
              ))}
              {result?.patterns?.map((p) => (
                <span key={p.id} className="rounded bg-slate-800 px-1.5 py-0.5">
                  ◈ {p.name}
                </span>
              ))}
            </div>
          ) : null}

          {result?.notices?.length ? (
            <div className="text-[10px] text-amber-300/80">{result.notices[result.notices.length - 1]}</div>
          ) : null}
        </div>
      )}
    </div>
  )
}
