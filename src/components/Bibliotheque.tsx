import { useCallback, useEffect, useState } from 'react'
import ImageLightbox from './ImageLightbox'
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
 * favorites), favorite, download, "Tout télécharger" (ZIP), delete, and — in
 * modal mode — PIN images to the next generation (pinning works across projects).
 *
 * Two shapes, one implementation:
 *   • variant="modal" — opened from the ✨ Muse panel inside a project (pinning).
 *   • variant="page"  — the standalone "Images" tab in the header (no pinning).
 *
 * Only Mocky-generated images are shown (served from /api/images) — never a
 * third-party image (M2).
 */
export default function Bibliotheque({
  variant = 'modal',
  projectId,
  projectNames,
  pinned = [],
  onTogglePin,
  onClose,
  onOpenImage,
}: {
  variant?: 'modal' | 'page'
  projectId?: string
  /** id → name, so a standalone page can show where an image is used. */
  projectNames?: Record<string, string>
  pinned?: PinnedImage[]
  onTogglePin?: (img: LibraryImage) => void
  onClose?: () => void
  /** Open an image full size. When absent, the page handles it itself. */
  onOpenImage?: (hash: string) => void
}) {
  const [images, setImages] = useState<LibraryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [onlyProject, setOnlyProject] = useState(false)
  const [onlyFav, setOnlyFav] = useState(false)

  const isPage = variant === 'page'
  const canPin = Boolean(onTogglePin)
  /** Standalone page has no parent to host the lightbox — it hosts its own. */
  const [ownLightbox, setOwnLightbox] = useState<string | null>(null)
  const openImage = (hash: string) => (onOpenImage ? onOpenImage(hash) : setOwnLightbox(hash))
  const lightbox = ownLightbox ? <ImageLightbox hash={ownLightbox} onClose={() => setOwnLightbox(null)} /> : null

  const filters: LibraryFilters = {
    q: q.trim() || undefined,
    project: onlyProject && projectId ? projectId : undefined,
    favorites: onlyFav || undefined,
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setImages(
        await listLibrary({
          q: q.trim() || undefined,
          project: onlyProject && projectId ? projectId : undefined,
          favorites: onlyFav || undefined,
        }),
      )
    } catch {
      // The library lives on the backend; in pure-localStorage mode it's absent.
      setError('Impossible de joindre la bibliothèque. Le backend Mocky doit tourner (npm run dev:all ou Docker).')
    } finally {
      setLoading(false)
    }
  }, [q, onlyProject, onlyFav, projectId])

  useEffect(() => {
    const t = setTimeout(refresh, 200) // debounce search
    return () => clearTimeout(t)
  }, [refresh])

  useEffect(() => {
    if (isPage || !onClose) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, isPage])

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

  /** Human-readable list of the projects using an image (page mode). */
  function usedBy(img: LibraryImage): string {
    if (!projectNames || !img.projects?.length) return ''
    const names = img.projects.map((id) => projectNames[id]).filter(Boolean)
    return names.length ? names.join(', ') : ''
  }

  const toolbar = (
    <>
      <input
        className="input h-8 flex-1 text-sm"
        placeholder="Rechercher (prompt, tags…)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={!isPage}
      />
      {projectId && (
        <label className="flex cursor-pointer items-center gap-1 whitespace-nowrap text-xs text-slate-300">
          <input type="checkbox" checked={onlyProject} onChange={(e) => setOnlyProject(e.target.checked)} /> Ce projet
        </label>
      )}
      <label className="flex cursor-pointer items-center gap-1 whitespace-nowrap text-xs text-slate-300">
        <input type="checkbox" checked={onlyFav} onChange={(e) => setOnlyFav(e.target.checked)} /> ⭐ Favoris
      </label>
    </>
  )

  const grid = loading ? (
    <div className="flex h-40 items-center justify-center text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-fuchsia-400" />
    </div>
  ) : error ? (
    <div className="rounded-lg border border-amber-700/50 bg-amber-900/20 p-3 text-sm text-amber-200">{error}</div>
  ) : images.length === 0 ? (
    <div className="flex h-40 flex-col items-center justify-center gap-1 text-sm text-slate-500">
      <span>{q || onlyFav || onlyProject ? 'Aucune image ne correspond à ces filtres.' : 'Aucune image pour l’instant.'}</span>
      <span className="text-xs">Génère un écran avec ✨ Muse pour remplir la bibliothèque.</span>
    </div>
  ) : (
    <div className={`grid gap-3 ${isPage ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'}`}>
      {images.map((img) => (
        <div
          key={img.hash}
          className={`group relative overflow-hidden rounded-xl border bg-slate-800 ${
            isPinned(img.hash) ? 'border-fuchsia-500 ring-2 ring-fuchsia-500/40' : 'border-slate-700'
          }`}
        >
          <button
            type="button"
            className="block aspect-[4/3] w-full overflow-hidden bg-slate-950"
            title="Ouvrir en grand"
            onClick={() => openImage(img.hash)}
          >
            <img
              src={imageUrl(img.hash)}
              alt={img.prompt}
              className="h-full w-full object-cover transition group-hover:scale-[1.03]"
              loading="lazy"
            />
          </button>
          <div className="p-1.5">
            <div className="truncate text-[11px] text-slate-300" title={img.prompt}>
              {img.prompt}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              {(img.tags || []).slice(0, 3).map((t) => (
                <span key={t} className="rounded bg-slate-700 px-1 text-[9px] text-slate-300">
                  {t}
                </span>
              ))}
              {isPage && img.provider && (
                <span className="rounded bg-slate-900 px-1 text-[9px] text-slate-500">{img.provider}</span>
              )}
            </div>
            {isPage && usedBy(img) && (
              <div className="mt-0.5 truncate text-[9px] text-slate-500" title={usedBy(img)}>
                📁 {usedBy(img)}
              </div>
            )}
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
          {canPin && (
            <button
              type="button"
              onClick={() => onTogglePin?.(img)}
              className={`absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition ${
                isPinned(img.hash) ? 'bg-fuchsia-500 text-white' : 'bg-black/60 text-slate-200 opacity-0 group-hover:opacity-100'
              }`}
              title="Épingler pour la prochaine génération (marche entre projets)"
            >
              {isPinned(img.hash) ? '📌 Épinglée' : '📌 Épingler'}
            </button>
          )}
          {img.favorite && !isPinned(img.hash) && <span className="absolute left-1 top-1 text-xs">⭐</span>}
        </div>
      ))}
    </div>
  )

  const zipLink = (
    <a href={libraryZipUrl(filters)} className="btn-ghost px-3 py-1 text-xs" title="Télécharger la sélection filtrée (ZIP + manifest)">
      Tout télécharger (.zip)
    </a>
  )

  // ---- Standalone page ----
  if (isPage) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-100">📚 Images générées</h2>
          <span className="text-xs text-slate-500">
            {images.length} image{images.length === 1 ? '' : 's'}
          </span>
          <div className="ml-auto">{zipLink}</div>
        </div>
        <p className="mb-4 text-sm text-slate-400">
          Toutes les images créées par ✨ Muse, tous projets confondus. Supprimer un projet ne supprime jamais ses images.
        </p>
        <div className="mb-4 flex flex-wrap items-center gap-3">{toolbar}</div>
        {grid}
        {lightbox}
      </main>
    )
  }

  // ---- Modal (inside a project, with pinning) ----
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto mt-8 flex h-[calc(100vh-4rem)] w-full max-w-5xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-700 p-3">
          <span className="whitespace-nowrap text-sm font-semibold text-fuchsia-200">📚 Bibliothèque d’images</span>
          {toolbar}
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={onClose} title="Fermer (Esc)">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">{grid}</div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-700 p-3 text-xs text-slate-400">
          <span>
            {images.length} image{images.length === 1 ? '' : 's'} · {pinned.length} épinglée{pinned.length === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            {zipLink}
            <button type="button" className="btn-primary px-3 py-1 text-xs" onClick={onClose}>
              Terminé
            </button>
          </div>
        </div>
      </div>
      {lightbox}
    </div>
  )
}
