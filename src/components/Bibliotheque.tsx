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
import { Banner, Button, Icon, IconButton, Spinner } from '../ui'
import { useT } from '../i18n'

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
  const t = useT()
  const [images, setImages] = useState<LibraryImage[]>([])
  const [loading, setLoading] = useState(true)
  /** Holds a translation KEY, so the banner follows a language switch. */
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
      setError('library.backendDown')
    } finally {
      setLoading(false)
    }
  }, [q, onlyProject, onlyFav, projectId])

  useEffect(() => {
    const timer = setTimeout(refresh, 200) // debounce search
    return () => clearTimeout(timer)
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
      ? t('library.deleteSharedConfirm', { count: img.projects.length })
      : t('library.deleteConfirm')
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
        className="input h-8 flex-1 text-body"
        placeholder={t('library.search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={!isPage}
      />
      {projectId && (
        <label className="flex cursor-pointer items-center gap-1 whitespace-nowrap text-body-sm text-ink-muted">
          <input
            type="checkbox"
            className="accent-accent"
            checked={onlyProject}
            onChange={(e) => setOnlyProject(e.target.checked)}
          />{' '}
          {t('library.thisProject')}
        </label>
      )}
      <label className="flex cursor-pointer items-center gap-1 whitespace-nowrap text-body-sm text-ink-muted">
        <input
          type="checkbox"
          className="accent-accent"
          checked={onlyFav}
          onChange={(e) => setOnlyFav(e.target.checked)}
        />
        <Icon name="star" size={14} />
        {t('library.favorites')}
      </label>
    </>
  )

  const grid = loading ? (
    <div className="flex h-40 items-center justify-center text-muse">
      <Spinner className="h-5 w-5" />
    </div>
  ) : error ? (
    <Banner tone="warn">{t(error)}</Banner>
  ) : images.length === 0 ? (
    <div className="flex h-40 flex-col items-center justify-center gap-1 text-body text-ink-faint">
      <span>{q || onlyFav || onlyProject ? t('library.noMatch') : t('library.emptyTitle')}</span>
      <span className="text-body-sm">{t('library.emptyHint')}</span>
    </div>
  ) : (
    <div
      className={`grid gap-3 ${
        isPage
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
          : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
      }`}
    >
      {images.map((img) => (
        <div
          key={img.hash}
          className={`group relative overflow-hidden rounded-xl border bg-surface ${
            isPinned(img.hash) ? 'border-muse ring-2 ring-muse/40' : 'border-line-soft'
          }`}
        >
          <button
            type="button"
            className="block aspect-[4/3] w-full overflow-hidden bg-sunken"
            title={t('library.openFull')}
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
            <div className="truncate text-caption text-ink-muted transition group-hover:text-accent-ink" title={img.prompt}>
              {img.prompt}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              {(img.tags || []).slice(0, 3).map((tag) => (
                <span key={tag} className="rounded bg-ink/5 px-1 text-caption text-ink-muted">
                  {tag}
                </span>
              ))}
              {isPage && img.provider && (
                <span className="rounded border border-line-soft px-1 text-caption text-ink-faint">{img.provider}</span>
              )}
            </div>
            {isPage && usedBy(img) && (
              <div className="mt-0.5 truncate text-caption text-ink-faint" title={usedBy(img)}>
                {t('library.usedBy', { names: usedBy(img) })}
              </div>
            )}
          </div>

          {/* Actions — one plate over the image, so the rules read as a strip. */}
          <div className="absolute right-1 top-1 flex border border-line bg-raised opacity-0 transition group-hover:opacity-100">
            <IconButton
              label={t(img.favorite ? 'library.unfavorite' : 'library.favorite')}
              variant="quiet"
              active={img.favorite}
              onClick={() => onFav(img)}
            >
              <Icon name="star" size={16} />
            </IconButton>
            <a
              href={imageDownloadUrl(img.hash)}
              aria-label={t('library.download')}
              title={t('library.download')}
              className="inline-flex min-h-8 w-8 items-center justify-center text-ink-muted transition hover:text-ink"
            >
              <Icon name="download" size={16} />
            </a>
            <IconButton label={t('library.deleteImage')} variant="quiet" onClick={() => onDelete(img)}>
              <Icon name="trash" size={16} />
            </IconButton>
          </div>
          {canPin && (
            <button
              type="button"
              onClick={() => onTogglePin?.(img)}
              className={`kicker absolute bottom-1 left-1 flex items-center gap-1 px-1.5 py-1 transition ${
                isPinned(img.hash)
                  ? 'border border-muse bg-muse text-surface'
                  : 'border border-line bg-raised text-ink opacity-0 group-hover:opacity-100'
              }`}
              title={t('library.pinHint')}
            >
              <Icon name="pin" size={14} />
              {isPinned(img.hash) ? t('library.pinned') : t('library.pin')}
            </button>
          )}
          {img.favorite && !isPinned(img.hash) && (
            <span className="absolute left-1 top-1 flex border border-line bg-raised p-1 text-accent">
              <Icon name="star" size={14} />
            </span>
          )}
        </div>
      ))}
    </div>
  )

  const zipLink = (
    <a href={libraryZipUrl(filters)} className="btn-ghost px-3 py-1 text-body-sm" title={t('library.zipHint')}>
      {t('library.downloadAll')} (.zip)
    </a>
  )

  // ---- Standalone page ----
  if (isPage) {
    return (
      <main className="page-wide py-8">
        <div className="kicker text-accent-ink">{t('library.kicker')}</div>
        <div className="section-head flex-wrap">
          <h2 className="text-h3 text-ink">{t('library.generatedImages')}</h2>
          <span className="text-body-sm text-ink-faint">
            <span className="font-mono text-accent-ink">{images.length}</span>{' '}
            {t(images.length === 1 ? 'library.imageWord_one' : 'library.imageWord_other')}
          </span>
          <div className="ml-auto">{zipLink}</div>
        </div>
        <p className="measure mb-4 text-body text-ink-muted">{t('library.pageBlurb')}</p>
        <div className="mb-4 flex max-w-3xl flex-wrap items-center gap-3">{toolbar}</div>
        {grid}
        {lightbox}
      </main>
    )
  }

  // ---- Modal (inside a project, with pinning) ----
  return (
    <div className="fixed inset-0 z-modal flex flex-col bg-ink/60" onClick={onClose}>
      <div
        className="mx-auto mt-8 flex h-[calc(100vh-4rem)] w-full max-w-5xl flex-col rounded-2xl border border-line bg-raised shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line p-3">
          <span className="kicker flex items-center gap-1.5 whitespace-nowrap text-muse">
            <Icon name="library" size={16} />
            {t('library.title')}
          </span>
          {toolbar}
          <IconButton label={t('common.close')} variant="quiet" title={t('library.closeEsc')} onClick={onClose}>
            <Icon name="close" />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto p-3">{grid}</div>

        <div className="flex items-center justify-between gap-3 border-t border-line-soft p-3 text-body-sm text-ink-muted">
          <span>
            <span className="font-mono text-accent-ink">{images.length}</span>{' '}
            {t(images.length === 1 ? 'library.imageWord_one' : 'library.imageWord_other')} ·{' '}
            <span className="font-mono text-accent-ink">{pinned.length}</span>{' '}
            {t(pinned.length === 1 ? 'library.pinnedWord_one' : 'library.pinnedWord_other')}
          </span>
          <div className="flex items-center gap-2">
            {zipLink}
            <Button variant="primary" size="sm" onClick={onClose}>
              {t('library.done')}
            </Button>
          </div>
        </div>
      </div>
      {lightbox}
    </div>
  )
}
