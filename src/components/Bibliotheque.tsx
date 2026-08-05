import { useCallback, useEffect, useRef, useState } from 'react'
import ImageLightbox from './ImageLightbox'
import {
  listLibrary,
  toggleFavoriteImage,
  deleteImage,
  uploadImage,
  imageUrl,
  imageDownloadUrl,
  libraryZipUrl,
  ACCEPTED_IMAGE_TYPES,
  type LibraryImage,
  type LibraryFilters,
  type PinnedImage,
} from '../lib/imageLibrary'
import {
  listVideos,
  deleteVideo,
  uploadVideo,
  videoPosterUrl,
  recutVideo,
  ACCEPTED_VIDEO_TYPES,
  type LibraryVideo,
  type PinnedVideo,
} from '../lib/videoLibrary'
import VideoPlayer from './VideoPlayer'
import { Banner, Button, Icon, IconButton, Spinner } from '../ui'
import { useT } from '../i18n'

type MediaTab = 'images' | 'videos'

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
  pinnedVideo = null,
  onPinVideo,
  onClose,
  onOpenImage,
}: {
  variant?: 'modal' | 'page'
  projectId?: string
  /** id → name, so a standalone page can show where an image is used. */
  projectNames?: Record<string, string>
  pinned?: PinnedImage[]
  onTogglePin?: (img: LibraryImage) => void
  /** The sequence chosen for the next run — at most one, it is the hero. */
  pinnedVideo?: PinnedVideo | null
  onPinVideo?: (v: LibraryVideo | null) => void
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

  const [tab, setTab] = useState<MediaTab>('images')
  const [videos, setVideos] = useState<LibraryVideo[]>([])
  const [videoError, setVideoError] = useState<string | null>(null)
  /** The clip whose player is open, if any. */
  const [playing, setPlaying] = useState<LibraryVideo | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const isPage = variant === 'page'
  const canPin = Boolean(onTogglePin)
  const canPinVideo = Boolean(onPinVideo)
  /** Standalone page has no parent to host the lightbox — it hosts its own. */
  const [ownLightbox, setOwnLightbox] = useState<string | null>(null)
  const openImage = (hash: string) => (onOpenImage ? onOpenImage(hash) : setOwnLightbox(hash))
  const lightbox = ownLightbox ? <ImageLightbox hash={ownLightbox} onClose={() => setOwnLightbox(null)} /> : null
  // Mounted in both branches, like the lightbox: the Media page and the Muse
  // modal render the same video grid, so a clip must play from either.
  const player = playing ? (
    <VideoPlayer
      video={playing}
      onClose={() => setPlaying(null)}
      onRecut={async (v) => {
        const next = await recutVideo(v.hash)
        // The frames changed under the SAME URLs, and they were served
        // immutable for a year. The new recutAt is the cache-buster that makes
        // the browser fetch the new sequence rather than replay the old one
        // from its cache — see videoFrameUrl.
        const merged = { ...v, ...next }
        setVideos((arr) => arr.map((x) => (x.hash === v.hash ? merged : x)))
        setPlaying(merged)
      }}
    />
  ) : null

  const filters: LibraryFilters = {
    q: q.trim() || undefined,
    project: onlyProject && projectId ? projectId : undefined,
    favorites: onlyFav || undefined,
  }

  // The signal matters: the debounce only cancelled the TIMER, never a request
  // already in flight. Typing "logo" then clearing it fast left two requests
  // racing, and if the older one answered last the grid showed results for a
  // query the field no longer contained.
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        const images = await listLibrary(
          {
            q: q.trim() || undefined,
            project: onlyProject && projectId ? projectId : undefined,
            favorites: onlyFav || undefined,
          },
          signal,
        )
        if (signal?.aborted) return
        setImages(images)
      } catch (err) {
        // Superseded by a newer keystroke — not a failure, and showing the
        // backend-down banner on every character would be nonsense.
        if ((err as Error)?.name === 'AbortError') return
        // The library lives on the backend; in pure-localStorage mode it's absent.
        setError('library.backendDown')
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [q, onlyProject, onlyFav, projectId],
  )

  useEffect(() => {
    const ac = new AbortController()
    const timer = setTimeout(() => void refresh(ac.signal), 200) // debounce search
    return () => {
      clearTimeout(timer)
      ac.abort()
    }
  }, [refresh])

  const refreshVideos = useCallback(async () => {
    setVideoError(null)
    try {
      setVideos(await listVideos(onlyProject && projectId ? projectId : undefined))
    } catch {
      setVideoError('library.backendDown')
    }
  }, [onlyProject, projectId])

  useEffect(() => {
    void refreshVideos()
  }, [refreshVideos])

  /**
   * One control for both kinds.
   *
   * The file picker accepts images and clips together and routes on the file's
   * own type, because "add my own media" is one intention — asking the user to
   * first declare which of the two they meant would be a question the file
   * already answers.
   */
  async function onFiles(list: FileList | null) {
    const files = Array.from(list || [])
    if (!files.length) return
    setUploading(true)
    setUploadError(null)
    let images = 0
    let clips = 0
    try {
      for (const file of files) {
        if (ACCEPTED_IMAGE_TYPES.includes(file.type)) {
          await uploadImage(file, { project: projectId })
          images++
        } else if (ACCEPTED_VIDEO_TYPES.includes(file.type)) {
          await uploadVideo(file, { project: projectId })
          clips++
        } else {
          throw new Error(t('library.uploadBadType', { name: file.name, type: file.type || '?' }))
        }
      }
      if (images) await refresh()
      if (clips) {
        await refreshVideos()
        setTab('videos')
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err))
      // Whatever landed before the failure is still worth showing.
      await refresh()
      await refreshVideos()
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onDeleteVideo(v: LibraryVideo) {
    if (!window.confirm(t('library.deleteVideoConfirm'))) return
    try {
      await deleteVideo(v.hash)
      setVideos((arr) => arr.filter((x) => x.hash !== v.hash))
      if (pinnedVideo?.hash === v.hash) onPinVideo?.(null)
      // Otherwise the player keeps running over frames the server has just
      // stopped serving, and the picture dies one 404 at a time.
      setPlaying((cur) => (cur?.hash === v.hash ? null : cur))
    } catch {
      /* ignore */
    }
  }

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

  const tabs = (
    <span className="flex shrink-0 overflow-hidden border border-line-soft">
      {(['images', 'videos'] as MediaTab[]).map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => setTab(id)}
          className={`kicker border-b-2 px-2.5 py-1 ${
            tab === id
              ? 'border-b-accent bg-ink text-surface'
              : 'border-b-transparent text-ink-muted hover:bg-ink/5'
          }`}
        >
          {t(id === 'images' ? 'library.tabImages' : 'library.tabVideos')}
          <span className="ml-1.5 font-mono opacity-70">{id === 'images' ? images.length : videos.length}</span>
        </button>
      ))}
    </span>
  )

  /**
   * What is currently selected, in words.
   *
   * Pinning an image or choosing a sequence changed a border colour and a small
   * badge on one card — in a grid of thirty, at the bottom of a scrolled list,
   * that is a change nobody sees. This says out loud what the next generation
   * will use, and it appears only when something is actually selected, so it is
   * never furniture.
   */
  const selectionNote =
    pinned.length || pinnedVideo ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-muse/40 bg-muse/5 px-2.5 py-1.5 text-body-sm text-ink-muted">
        <span className="flex items-center gap-1.5 text-muse-ink">
          <Icon name="pin" size={14} />
          {t('library.selectionTitle')}
        </span>
        {pinned.length > 0 && (
          <span>
            <span className="font-mono text-accent-ink">{pinned.length}</span>{' '}
            {t(pinned.length === 1 ? 'library.selectedImage_one' : 'library.selectedImage_other')}
          </span>
        )}
        {pinnedVideo && (
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate" title={pinnedVideo.label}>
              {t('library.selectedVideo', { name: pinnedVideo.label })}
            </span>
            <button
              type="button"
              onClick={() => onPinVideo?.(null)}
              className="shrink-0 text-ink-faint underline underline-offset-2 transition hover:text-danger"
            >
              {t('library.selectedClear')}
            </button>
          </span>
        )}
      </div>
    ) : null

  const uploader = (
    <>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(',')}
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        title={t('library.uploadHint')}
      >
        {uploading ? <Spinner className="h-4 w-4" /> : <Icon name="plus" size={15} />}
        {uploading ? t('library.uploading') : t('library.upload')}
      </Button>
    </>
  )

  const toolbar = (
    <>
      {/* `grow basis-40`, not `flex-1`. An input carries an intrinsic minimum
          width of about 170px, so `flex-1` alone refused to shrink and this row
          pushed the modal 280px past a 390px screen. `min-w-0` lifts that floor
          — but `flex-1` also means a flex-basis of 0, and an item 0px wide never
          counts as too wide to fit: the field then stayed glued to the header's
          first line and collapsed to a sliver beside the tabs. A 10rem basis is
          what makes it take the next line instead when 10rem is not there, and
          it still grows into whatever the line has spare. */}
      <input
        className="input h-8 min-w-0 grow basis-40 text-body"
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

          {/* Actions — one plate over the image, so the rules read as a strip.
              Damped to 60% rather than hidden at 0: there is no hover on a touch
              screen, so "download" and "delete" were simply unreachable on a
              phone, and a keyboard tabbed into invisible buttons. Same reasoning
              as PanelRow's actions. */}
          <div className="absolute right-1 top-1 flex border border-line bg-raised opacity-60 transition group-hover:opacity-100 group-focus-within:opacity-100">
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
              // Damped, never hidden: at opacity-0 the only way to discover that
              // an image could be pinned at all was to own a mouse.
              className={`kicker absolute bottom-1 left-1 flex items-center gap-1 px-1.5 py-1 transition ${
                isPinned(img.hash)
                  ? 'border border-muse bg-muse text-surface'
                  : 'border border-line bg-raised text-ink opacity-60 group-hover:opacity-100 focus-visible:opacity-100'
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

  const videoGrid = videoError ? (
    <Banner tone="warn">{t(videoError)}</Banner>
  ) : videos.length === 0 ? (
    <div className="flex h-40 flex-col items-center justify-center gap-1 text-body text-ink-faint">
      <span>{t('library.noVideos')}</span>
      <span className="text-body-sm">{t('library.noVideosHint')}</span>
    </div>
  ) : (
    <div
      className={`grid gap-3 ${
        isPage ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3'
      }`}
    >
      {videos.map((v) => {
        const chosen = pinnedVideo?.hash === v.hash
        return (
          <div
            key={v.hash}
            className={`group relative overflow-hidden rounded-xl border bg-surface ${
              chosen ? 'border-muse ring-2 ring-muse/40' : 'border-line-soft'
            }`}
          >
            {/* The poster was inert: a still of a clip nobody could watch. The
                whole tile is now the play control, which is what a picture of a
                video has always promised. */}
            <button
              type="button"
              onClick={() => setPlaying(v)}
              aria-label={t('library.playVideo')}
              className="relative block aspect-[16/9] w-full overflow-hidden bg-sunken"
            >
              <img src={videoPosterUrl(v.hash, v.recutAt)} alt="" className="h-full w-full object-cover" loading="lazy" />
              <span className="absolute inset-0 flex items-center justify-center bg-sunken/0 transition group-hover:bg-sunken/40">
                <span className="flex h-11 w-11 items-center justify-center border border-line bg-raised/90 text-ink opacity-0 transition group-hover:opacity-100">
                  <Icon name="play" size={18} />
                </span>
              </span>
              {/* The frame count is the honest measure of a sequence: it is what
                  the scroll is divided into. */}
              <span className="absolute bottom-1 right-1 flex items-center gap-1 border border-line bg-raised/90 px-1.5 py-0.5 font-mono text-caption text-ink-muted">
                <Icon name="play" size={11} />
                {t('library.frames', { count: v.frames })}
              </span>
            </button>
            <div className="p-1.5">
              <div className="truncate text-caption text-ink-muted" title={v.prompt}>
                {v.prompt}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                <span className="rounded border border-line-soft px-1 text-caption text-ink-faint">
                  {v.provider || 'upload'}
                </span>
                <span className="rounded bg-ink/5 px-1 text-caption text-ink-muted">
                  {v.width}px · {v.fps} fps
                </span>
              </div>
            </div>
            {/* Damped rather than hidden, like the image plate above: hover is
                not a thing a phone has. */}
            <div className="absolute right-1 top-1 flex border border-line bg-raised opacity-60 transition group-hover:opacity-100 group-focus-within:opacity-100">
              <IconButton label={t('library.deleteVideo')} variant="quiet" onClick={() => onDeleteVideo(v)}>
                <Icon name="trash" size={16} />
              </IconButton>
            </div>
            {canPinVideo && (
              <button
                type="button"
                onClick={() => onPinVideo?.(chosen ? null : v)}
                className={`kicker absolute bottom-1 left-1 flex items-center gap-1 px-1.5 py-1 transition ${
                  chosen
                    ? 'border border-muse bg-muse text-surface'
                    : 'border border-line bg-raised text-ink opacity-60 group-hover:opacity-100 focus-visible:opacity-100'
                }`}
                title={t('library.useVideoHint')}
              >
                <Icon name="pin" size={14} />
                {chosen ? t('library.videoChosen') : t('library.useVideo')}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )

  const activeGrid = tab === 'images' ? grid : videoGrid

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
          <h2 className="text-h3 text-ink">{t('library.mediaTitle')}</h2>
          <span className="text-body-sm text-ink-faint">
            <span className="font-mono text-accent-ink">{images.length}</span>{' '}
            {t(images.length === 1 ? 'library.imageWord_one' : 'library.imageWord_other')}
            {' · '}
            <span className="font-mono text-accent-ink">{videos.length}</span>{' '}
            {t(videos.length === 1 ? 'library.videoWord_one' : 'library.videoWord_other')}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {uploader}
            {tab === 'images' && zipLink}
          </div>
        </div>
        <p className="measure mb-4 text-body text-ink-muted">{t('library.pageBlurb')}</p>
        <div className="mb-4 flex max-w-3xl flex-wrap items-center gap-3">
          {tabs}
          {toolbar}
        </div>
        {uploadError && (
          <Banner tone="danger" className="mb-3">
            {uploadError}
          </Banner>
        )}
        {selectionNote && <div className="mb-4">{selectionNote}</div>}
        {activeGrid}
        {lightbox}
      {player}
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
        {/* This row used to be a single unwrapped line whose min-content was
            about 670px — inside a card that is `w-full`, so on a 390px phone the
            title, the tabs and the search field ran off the right edge, taking
            the close button with them, and the overlay behind the card was not
            reachable either. The dialog could then be dismissed only with a
            hardware Escape key, which a phone does not have. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line p-3">
          <span className="kicker flex min-w-0 items-center gap-1.5 text-muse-ink">
            <Icon name="library" size={16} />
            {/* "Bibliothèque d'images" is ~210px of letterspaced caps; nowrap
                made it a 210px wall that nothing else could wrap around. */}
            <span className="truncate">{t('library.title')}</span>
          </span>
          {tabs}
          {toolbar}
          {/* Last in the DOM so the desktop row still ends with it, but ordered
              first once things wrap: the way out of a dialog must be on the line
              you can see, not three wrapped rows down. */}
          <IconButton
            label={t('common.close')}
            variant="quiet"
            title={t('library.closeEsc')}
            onClick={onClose}
            className="order-first md:order-none"
          >
            <Icon name="close" />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {uploadError && (
            <Banner tone="danger" className="mb-3">
              {uploadError}
            </Banner>
          )}
          {selectionNote && <div className="mb-3">{selectionNote}</div>}
          {activeGrid}
        </div>

        {/* Wraps for the same reason as the header: "Importer", "Tout
            télécharger (.zip)" and "Terminé" set in French come to ~340px on
            their own, which is the whole width of the phone this has to fit. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line-soft p-3 text-body-sm text-ink-muted">
          <span>
            <span className="font-mono text-accent-ink">{images.length}</span>{' '}
            {t(images.length === 1 ? 'library.imageWord_one' : 'library.imageWord_other')} ·{' '}
            <span className="font-mono text-accent-ink">{pinned.length}</span>{' '}
            {t(pinned.length === 1 ? 'library.pinnedWord_one' : 'library.pinnedWord_other')}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {uploader}
            {tab === 'images' && zipLink}
            <Button variant="primary" size="sm" onClick={onClose}>
              {t('library.done')}
            </Button>
          </div>
        </div>
      </div>
      {lightbox}
      {player}
    </div>
  )
}
