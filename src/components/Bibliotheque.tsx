import { useCallback, useEffect, useState } from 'react'
import {
  listLibrary,
  toggleFavoriteImage,
  deleteImage,
  imageUrl,
  imageDownloadUrl,
  libraryZipUrl,
  type LibraryImage,
  type LibraryFilters,
  type PinnedImage,
} from '../lib/imageLibrary'

/**
 * The global Image Library browser (Muse §4.3 / §6). Browse every generated
 * image across ALL projects, search (prompt + tags), filter (this project /
 * favorites / slot), favorite, download, "Tout télécharger" (ZIP), delete, and
 * PIN images to the next generation (pinning works across projects).
 *
 * Only Mocky-generated images are shown (served from /api/images) — never a
 * third-party image (M2).
 */
export default function Bibliotheque({
  projectId,
  pinned,
  onTogglePin,
  onClose,
}: {
  projectId: string
  pinned: PinnedImage[]
  onTogglePin: (img: LibraryImage) => void
  onClose: () => void
}) {
  const [images, setImages] = useState<LibraryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [onlyProject, setOnlyProject] = useState(false)
  const [onlyFav, setOnlyFav] = useState(false)

  const filters: LibraryFilters = {
    q: q.trim() || undefined,
    project: onlyProject ? projectId : undefined,
    favorites: onlyFav || undefined,
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setImages(await listLibrary({ q: q.trim() || undefined, project: onlyProject ? projectId : undefined, favorites: onlyFav || undefined }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [q, onlyProject, onlyFav, projectId])

  useEffect(() => {
    const t = setTimeout(refresh, 200) // debounce search
    return () => clearTimeout(t)
  }, [refresh])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isPinned = (hash: string) => pinned.some((p) => p.hash === hash)

  async function onFav(img: LibraryImage) {
    try {
      const fav = await toggleFavoriteImage(img.hash)
      setImages((arr) => arr.map((i) => (i.hash === img.hash ? { ...i, favorite: fav } : i)))
    } catch {
      /* ignore */
    }
  }

  async function onDelete(img: LibraryImage) {
    const others = img.projects.filter((p) => p !== projectId)
    const msg = others.length
      ? `Cette image est utilisée par ${img.projects.length} projet(s). La supprimer la retire définitivement de la bibliothèque. Continuer ?`
      : 'Supprimer définitivement cette image de la bibliothèque ?'
    if (!window.confirm(msg)) return
    try {
      await deleteImage(img.hash)
      setImages((arr) => arr.filter((i) => i.hash !== img.hash))
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/80 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto mt-8 flex h-[calc(100vh-4rem)] w-full max-w-5xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-700 p-3">
          <span className="text-sm font-semibold text-fuchsia-200">📚 Bibliothèque d’images</span>
          <input
            className="input h-8 flex-1 text-sm"
            placeholder="Rechercher (prompt, tags…)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-300">
            <input type="checkbox" checked={onlyProject} onChange={(e) => setOnlyProject(e.target.checked)} /> Ce projet
          </label>
          <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-300">
            <input type="checkbox" checked={onlyFav} onChange={(e) => setOnlyFav(e.target.checked)} /> ⭐ Favoris
          </label>
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={onClose} title="Fermer (Esc)">
            ✕
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-slate-500">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-fuchsia-400" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-700/50 bg-rose-900/20 p-3 text-sm text-rose-200">{error}</div>
          ) : images.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-1 text-sm text-slate-500">
              <span>Aucune image pour l’instant.</span>
              <span className="text-xs">Génère un écran avec ✨ Muse pour remplir la bibliothèque.</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((img) => (
                <div
                  key={img.hash}
                  className={`group relative overflow-hidden rounded-xl border bg-slate-800 ${
                    isPinned(img.hash) ? 'border-fuchsia-500 ring-2 ring-fuchsia-500/40' : 'border-slate-700'
                  }`}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-slate-950">
                    <img src={imageUrl(img.hash)} alt={img.prompt} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="p-1.5">
                    <div className="truncate text-[11px] text-slate-300" title={img.prompt}>
                      {img.prompt}
                    </div>
                    {img.tags?.length ? (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {img.tags.slice(0, 3).map((t) => (
                          <span key={t} className="rounded bg-slate-700 px-1 text-[9px] text-slate-300">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {/* Actions */}
                  <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button type="button" onClick={() => onFav(img)} title="Favori" className="rounded bg-black/60 px-1 text-xs">
                      {img.favorite ? '⭐' : '☆'}
                    </button>
                    <a href={imageDownloadUrl(img.hash)} title="Télécharger" className="rounded bg-black/60 px-1 text-xs">
                      ⬇
                    </a>
                    <button type="button" onClick={() => onDelete(img)} title="Supprimer" className="rounded bg-black/60 px-1 text-xs">
                      🗑
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onTogglePin(img)}
                    className={`absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition ${
                      isPinned(img.hash) ? 'bg-fuchsia-500 text-white' : 'bg-black/60 text-slate-200 opacity-0 group-hover:opacity-100'
                    }`}
                    title="Épingler pour la prochaine génération (marche entre projets)"
                  >
                    {isPinned(img.hash) ? '📌 Épinglée' : '📌 Épingler'}
                  </button>
                  {img.favorite && !isPinned(img.hash) && <span className="absolute left-1 top-1 text-xs">⭐</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-700 p-3 text-xs text-slate-400">
          <span>
            {images.length} image{images.length === 1 ? '' : 's'} · {pinned.length} épinglée{pinned.length === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <a href={libraryZipUrl(filters)} className="btn-ghost px-3 py-1 text-xs" title="Télécharger la sélection filtrée (ZIP + manifest)">
              Tout télécharger (.zip)
            </a>
            <button type="button" className="btn-primary px-3 py-1 text-xs" onClick={onClose}>
              Terminé
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
