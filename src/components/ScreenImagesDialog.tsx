import { useCallback, useEffect, useState } from 'react'
import { imageUrl } from '../lib/imageLibrary'
import { findScreenImages, replaceScreenImage, type ImageSpan, type ScreenImage } from '../lib/screenImages'
import {
  filmMedia,
  mediaPoster,
  runningTime,
  sameMedia,
  sequenceMedia,
  viewAttached,
} from '../lib/screenMedia'
import type { AttachedMedia } from '../lib/project'
import { listVideoExports, type VideoExport } from '../lib/video/client'
import { listVideos, videoPosterUrl, type LibraryVideo } from '../lib/videoLibrary'
import { ImagePicker } from './ImagePicker'
import { Banner, Button, Modal, Spinner } from '../ui'
import { useT } from '../i18n'

/**
 * Change what a screen shows, in two sections that must never be one list.
 *
 * THE TWO RELATIONS. A screen and a media can be related in two ways, and the
 * word "replace" means something different in each.
 *
 *  1. AN IMAGE INSIDE THE CODE. `src/lib/screenImages.ts` finds
 *     `/api/images/HASH` in `Screen.code` and rewrites it by string substitution
 *     at offsets an AST vouched for. That is generated SOURCE being edited — no
 *     model is called, nothing is restyled, and "Revert" undoes it like any
 *     other edit. What it deliberately cannot do is ADD an image to a screen
 *     that has none, or remove one: both change the component's structure, which
 *     is a generation rather than a substitution.
 *
 *  2. A MEDIA ATTACHED TO THE SCREEN. `Screen.attachedMedia` — like `imageHash`
 *     and `design` — is metadata. It is nowhere in the code; the canvas draws it
 *     on a card beside the frame. A film can only ever be this: the generated
 *     component has no `<video>` tag, and injecting one would be a generation.
 *
 * They are two sections with two headings for that reason, and the headings say
 * which one touches the code. Mixed into a single list, "remplacer" would mean
 * "rewrite the source" on one row and "point the card elsewhere" on the next,
 * with nothing on screen to tell them apart.
 *
 * Its own dialog rather than a mode bolted onto Bibliothèque: that component
 * also deletes images and downloads the whole library as a ZIP, and neither
 * belongs one click away from "pick a replacement".
 */
export default function ScreenImagesDialog({
  screenName,
  code,
  projectId,
  attached,
  onReplace,
  onAttach,
  onClose,
}: {
  screenName: string
  /** The screen's current source. Re-read on every change, so the list follows a swap. */
  code: string
  projectId?: string
  /** What is attached to the screen right now, if anything. Section 2's subject. */
  attached?: AttachedMedia
  /** Hands the rewritten source back; the caller owns previousCode and Revert. */
  onReplace: (nextCode: string) => void
  /** Attaches a media, or detaches with null. Never touches the code. */
  onAttach: (media: AttachedMedia | null) => void
  onClose: () => void
}) {
  const t = useT()
  const [images, setImages] = useState<ScreenImage[] | null>(null)
  /**
   * What is being replaced: a whole image, or one of its places.
   *
   * `spanIndex: null` means every occurrence moves together. A number means
   * only that one does — which is how a screen gets three different pictures
   * out of the one image Muse produced for it.
   */
  const [target, setTarget] = useState<{ hash: string; spanIndex: number | null } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Re-derived from `code`, never held in state across a swap: the parent
  // rewrites the source, hands it back down, and the list must describe THAT.
  useEffect(() => {
    let live = true
    findScreenImages(code)
      .then((found) => live && setImages(found))
      .catch(() => live && setImages([]))
    return () => {
      live = false
    }
  }, [code])

  const apply = useCallback(
    (image: ScreenImage, spans: ImageSpan[], nextHash: string) => {
      // Only a no-op when the WHOLE image is being re-pointed at itself.
      // Putting the same picture into one slot it already occupies is equally
      // pointless, but the user reaching for a different slot is not, and
      // refusing there would block the feature.
      if (nextHash === image.hash) {
        setNotice(t('library.swapSame'))
        setTarget(null)
        return
      }
      try {
        // The origin of the app, not of the iframe: the iframe's own origin is
        // opaque (I2), so an absolute URL written for it has to name Mocky.
        const next = replaceScreenImage(code, spans, nextHash, window.location.origin)
        if (next === code) {
          setError(t('library.swapFailed'))
          return
        }
        onReplace(next)
        setNotice(t('library.swapDone'))
        setError(null)
        setTarget(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [code, onReplace, t],
  )

  const targeted = images?.find((i) => i.hash === target?.hash) ?? null
  const isAll = (img: ScreenImage) => target?.hash === img.hash && target.spanIndex === null
  const isSlot = (img: ScreenImage, i: number) => target?.hash === img.hash && target.spanIndex === i
  /** Aim the picker at a whole image (null) or at one of its places, toggling off. */
  const aim = (hash: string, spanIndex: number | null) => {
    setNotice(null)
    setError(null)
    setTarget((prev) =>
      prev?.hash === hash && prev.spanIndex === spanIndex ? null : { hash, spanIndex },
    )
  }

  return (
    <Modal title={t('library.swapTitle', { name: screenName })} onClose={onClose} size="lg">
      {error && (
        <Banner tone="danger" title={t('library.swapFailed')} className="mb-3">
          {error}
        </Banner>
      )}
      {notice && !error && (
        <Banner tone="ok" className="mb-3">
          {notice}
        </Banner>
      )}

      {/* SECTION 1 — the code. The heading says so, and the sentence under it
          says what "replace" does here: rewrite one address in the source. */}
      <div className="section-head">
        <span className="kicker text-accent-ink">{t('library.swapCodeSection')}</span>
      </div>
      <p className="measure text-body-sm text-ink-muted">{t('library.swapBlurb')}</p>

      {images === null ? (
        <div className="mt-6 flex justify-center">
          <Spinner />
        </div>
      ) : images.length === 0 ? (
        <div className="mt-4 border border-line-soft bg-ink/5 p-4">
          {/* Two different situations, and they need different advice: a screen
              that has no images, and a screen whose source would not parse. The
              second is a bug the user can see on the canvas. */}
          <p className="text-body text-ink">
            {code.includes('/api/images/') ? t('library.swapUnparsed') : t('library.swapNone')}
          </p>
          {!code.includes('/api/images/') && (
            <p className="measure mt-1 text-body-sm text-ink-muted">{t('library.swapNoneHint')}</p>
          )}
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {images.map((img) => (
            <li key={img.hash} className="border border-line-soft bg-surface">
              <div className="flex items-center gap-3 p-2">
                <img
                  src={imageUrl(img.hash)}
                  alt=""
                  className="h-16 w-24 shrink-0 border border-line-soft object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body text-ink">
                    {img.alt || <span className="text-ink-faint">{t('library.swapNoAlt')}</span>}
                  </p>
                  <p className="font-mono text-caption text-ink-faint">
                    {img.hash.slice(0, 12)} ·{' '}
                    {img.spans.length === 1
                      ? t('library.swapUsedOnce')
                      : t('library.swapUsedTimes', { n: img.spans.length })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={isAll(img) ? 'primary' : 'ghost'}
                  title={img.spans.length > 1 ? t('library.swapEverywhereHint', { n: img.spans.length }) : undefined}
                  onClick={() => aim(img.hash, null)}
                >
                  {isAll(img)
                    ? t('library.swapCancel')
                    : img.spans.length > 1
                      ? t('library.swapEverywhere', { n: img.spans.length })
                      : t('library.swapReplace')}
                </Button>
              </div>

              {/* One row per place, but only when there IS more than one — a
                  single-slot image would just be its own summary repeated. */}
              {img.spans.length > 1 && (
                <div className="border-t border-line-soft px-2 py-2">
                  <p className="kicker text-accent-ink">{t('library.swapSlots')}</p>
                  <p className="measure mb-2 text-caption text-ink-faint">{t('library.swapSlotsHint')}</p>
                  <ul className="space-y-1">
                    {img.spans.map((span, i) => (
                      <li
                        key={span.start}
                        className="flex items-center gap-2 border border-line-soft bg-ink/5 px-2 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-sm text-ink">
                            {span.alt ||
                              span.context || (
                                <span className="text-ink-faint">{t('library.swapSlot', { n: i + 1 })}</span>
                              )}
                          </p>
                          <p className="font-mono text-caption text-ink-faint">
                            {t('library.swapSlotLine', { n: span.line })}
                            {span.alt && span.context ? ` · ${span.context}` : ''}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={isSlot(img, i) ? 'primary' : 'quiet'}
                          onClick={() => aim(img.hash, i)}
                        >
                          {isSlot(img, i) ? t('library.swapCancel') : t('library.swapReplace')}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {targeted?.hash === img.hash && (
                <div className="border-t border-line-soft bg-ink/5 p-3">
                  {target?.spanIndex === null && img.spans.length > 1 && (
                    <p className="mb-2 text-body-sm text-ink-muted">
                      {t('library.swapAllOccurrences', { n: img.spans.length })}
                    </p>
                  )}
                  <ImagePicker
                    projectId={projectId}
                    heading={t('library.swapChoose')}
                    selected={[img.hash]}
                    onPick={(hash) =>
                      apply(
                        img,
                        target?.spanIndex == null ? img.spans : [img.spans[target.spanIndex]],
                        hash,
                      )
                    }
                    onError={setError}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* SECTION 2 — everything that is NOT the code. */}
      <AttachedMediaSection
        attached={attached}
        onAttach={onAttach}
        /* The banner hides a notice while an error stands, so a failed swap in
           section 1 would silently swallow the confirmation of an attachment
           that worked. The two sections do not share a failure. */
        onNotice={(message) => {
          setError(null)
          setNotice(message)
        }}
      />
    </Modal>
  )
}

/**
 * The media attached to the screen — the card the canvas draws beside the frame.
 *
 * Nothing here writes a byte of the screen's source, and the heading and the
 * sentence under it are the only thing keeping "attacher" from being read as a
 * cousin of "remplacer" one section above.
 *
 * Both lists degrade on their own (Q1): the export store answering 404 on an
 * instance whose Motion feature was never turned on is a normal state, not a
 * failure of this dialog, and it must not take the sequence list down with it.
 */
function AttachedMediaSection({
  attached,
  onAttach,
  onNotice,
}: {
  attached?: AttachedMedia
  onAttach: (media: AttachedMedia | null) => void
  onNotice: (message: string) => void
}) {
  const t = useT()
  const [films, setFilms] = useState<VideoExport[]>([])
  const [sequences, setSequences] = useState<LibraryVideo[]>([])
  const [filmsFailed, setFilmsFailed] = useState(false)
  const [sequencesFailed, setSequencesFailed] = useState(false)
  const [loading, setLoading] = useState(true)

  /*
   * Every film and every sequence this account owns, not only this project's.
   *
   * A montage cut for one project is routinely the right thing to hang on a
   * screen of another — a brand film, a product loop — and the store is global
   * and content-addressed anyway (M8). Filtering to the project would have hidden
   * every film exported from the standalone Media page, which belongs to none.
   */
  useEffect(() => {
    const ctrl = new AbortController()
    let live = true
    Promise.allSettled([listVideoExports({ signal: ctrl.signal }), listVideos(undefined, ctrl.signal)])
      .then(([f, s]) => {
        if (!live || ctrl.signal.aborted) return
        if (f.status === 'fulfilled') setFilms(f.value)
        else setFilmsFailed(true)
        if (s.status === 'fulfilled') setSequences(s.value)
        else setSequencesFailed(true)
        setLoading(false)
      })
    return () => {
      live = false
      ctrl.abort()
    }
  }, [])

  const current = viewAttached(attached, films, sequences)

  function attach(media: AttachedMedia) {
    onAttach(media)
    onNotice(t('library.attachDone'))
  }

  return (
    <>
      <div className="section-head mt-6">
        <span className="kicker text-accent-ink">{t('library.attachSection')}</span>
      </div>
      <p className="measure text-body-sm text-ink-muted">{t('library.attachBlurb')}</p>

      {current ? (
        <div className="mt-3 flex items-center gap-3 border border-accent/50 bg-accent/5 p-2">
          {/* The re-cut stamp, when the entry is still there. The picker grid
              below passes it and this one did not, so a re-cut sequence showed
              its new still in the list and last year's still here — two pictures
              of one clip, three inches apart. */}
          <MediaThumb media={current.media} version={current.sequence?.recutAt} />
          <div className="min-w-0 flex-1">
            <p className="text-body text-ink">
              {t(current.media.kind === 'film' ? 'canvas.mediaFilm' : 'canvas.mediaSequence')}
            </p>
            <p className="font-mono text-caption text-ink-faint">{current.media.hash.slice(0, 12)}</p>
            {/* The hash outlives the file: only an explicit deletion removes a
                media (M8), and a screen pointing at one that is gone has to say
                so rather than silently look empty. */}
            {!current.present && (
              <p className="measure mt-0.5 text-caption text-ink-muted">{t('library.attachGone')}</p>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onAttach(null)
              onNotice(t('library.attachDetached'))
            }}
          >
            {t('library.attachDetach')}
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-body-sm text-ink-faint">{t('library.attachNone')}</p>
      )}

      {loading ? (
        <div className="mt-4 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <p className="kicker mt-4 text-accent-ink">{t('library.attachFilms')}</p>
          {filmsFailed ? (
            <Banner tone="warn" className="mt-1">
              {t('library.attachFilmsFailed')}
            </Banner>
          ) : films.length === 0 ? (
            <p className="mt-1 text-body-sm text-ink-faint">{t('library.attachNoFilms')}</p>
          ) : (
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {films.map((film) => {
                const media = filmMedia(film.hash)
                return (
                  <li key={film.hash}>
                    <button
                      type="button"
                      onClick={() => attach(media)}
                      className={`flex w-full items-center gap-2 border p-1.5 text-left transition ${
                        sameMedia(attached, media) ? 'border-accent bg-accent/10' : 'border-line-soft hover:border-line'
                      }`}
                    >
                      <MediaThumb media={media} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-caption text-ink-muted">
                          {runningTime(film.durationMs)}
                        </span>
                        <span className="block truncate text-caption text-ink-faint">
                          {t(film.scenes === 1 ? 'library.filmScenes_one' : 'library.filmScenes_other', {
                            count: film.scenes,
                          })}{' '}
                          · {film.aspectRatio}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <p className="kicker mt-4 text-accent-ink">{t('library.attachSequences')}</p>
          {sequencesFailed ? (
            <Banner tone="warn" className="mt-1">
              {t('library.attachSequencesFailed')}
            </Banner>
          ) : sequences.length === 0 ? (
            <p className="mt-1 text-body-sm text-ink-faint">{t('library.attachNoSequences')}</p>
          ) : (
            <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {sequences.map((v) => {
                const media = sequenceMedia(v.hash, v.frames)
                return (
                  <li key={v.hash}>
                    <button
                      type="button"
                      title={v.prompt}
                      onClick={() => attach(media)}
                      className={`block w-full overflow-hidden border transition ${
                        sameMedia(attached, media) ? 'border-accent' : 'border-line-soft hover:border-line'
                      }`}
                    >
                      <img
                        src={videoPosterUrl(v.hash, v.recutAt)}
                        alt=""
                        className="block aspect-[4/3] w-full object-cover"
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </>
  )
}

/**
 * A still for one attachment.
 *
 * The film branch is a `<video preload="metadata">` and not a poster, because no
 * poster exists: cutting one means ffmpeg, the single dependency the export path
 * does not have. The browser draws the first frame out of bytes it would have
 * fetched for a play anyway, so this costs the server nothing extra.
 */
function MediaThumb({ media, version }: { media: AttachedMedia; version?: number }) {
  const poster = mediaPoster(media, version)
  const box = 'h-12 w-20 shrink-0 border border-line-soft bg-ink object-cover'
  return poster.video ? (
    <video src={poster.video} preload="metadata" muted playsInline className={box} />
  ) : (
    <img src={poster.img} alt="" className={box} />
  )
}
