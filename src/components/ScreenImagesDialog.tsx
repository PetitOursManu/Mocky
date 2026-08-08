import { useCallback, useEffect, useState } from 'react'
import { imageUrl } from '../lib/imageLibrary'
import { findScreenImages, replaceScreenImage, type ImageSpan, type ScreenImage } from '../lib/screenImages'
import {
  findScreenSequences,
  replaceScreenSequence,
  type ScreenSequence,
} from '../lib/screenSequences'
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
import { Banner, Button, Icon, Modal, Spinner } from '../ui'
import { useT } from '../i18n'

/**
 * Change what a screen shows, in two sections that must never be one list.
 *
 * THE TWO RELATIONS. A screen and a media can be related in two ways, and the
 * word "replace" means something different in each.
 *
 *  1. A MEDIA INSIDE THE CODE. `src/lib/screenImages.ts` finds
 *     `/api/images/HASH` in `Screen.code` and `src/lib/screenSequences.ts` finds
 *     the `base`/`frames` pair of a scroll sequence; both rewrite by string
 *     substitution at offsets an AST vouched for. That is generated SOURCE being
 *     edited — no model is called, nothing is restyled, and "Revert" undoes it
 *     like any other edit. What it deliberately cannot do is ADD a media to a
 *     screen that has none, or remove one: both change the component's
 *     structure, which is a generation rather than a substitution.
 *
 *  2. A MEDIA ATTACHED TO THE SCREEN. `Screen.attachedMedia` — like `imageHash`
 *     and `design` — is metadata. It is nowhere in the code; the canvas draws it
 *     on a card beside the frame. A film can only ever be this: the generated
 *     component has no `<video>` tag, and injecting one would be a generation.
 *     That is why section 1 lists sequences and not films, and says so in a
 *     sentence rather than leaving the absence to be puzzled over — a sequence
 *     already IS a component the model was taught to write, a film is not.
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
  videoHash,
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
  /**
   * The sequence `Screen.videoHash` records as backing this screen's hero.
   *
   * Read for one thing only: deciding whether a swap in the code invalidates
   * that record. The field is written at generation time and says which clip
   * Muse paid for; swapping the hero and leaving it behind makes it a note about
   * a clip the screen no longer shows.
   */
  videoHash?: string
  /**
   * Hands the rewritten source back; the caller owns previousCode and Revert.
   *
   * `sequence` travels with it when the swap re-pointed the hero the screen's
   * `videoHash`/`videoFrames` pair names — the pair moves as one, here as
   * everywhere else. Absent means the metadata was about some other clip, or
   * about none, and must not be touched.
   */
  onReplace: (nextCode: string, sequence?: { hash: string; frames: number }) => void
  /** Attaches a media, or detaches with null. Never touches the code. */
  onAttach: (media: AttachedMedia | null) => void
  onClose: () => void
}) {
  const t = useT()
  const [images, setImages] = useState<ScreenImage[] | null>(null)
  const [sequences, setSequences] = useState<ScreenSequence[] | null>(null)
  /** Which occurrence the sequence picker is open for, by index in `sequences`. */
  const [seqTarget, setSeqTarget] = useState<number | null>(null)
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
  // rewrites the source, hands it back down, and the lists must describe THAT.
  // Both offsets move on every edit, so a list kept across one would splice at
  // addresses that have shifted.
  useEffect(() => {
    let live = true
    setSeqTarget(null)
    Promise.all([findScreenImages(code), findScreenSequences(code)])
      .then(([foundImages, foundSequences]) => {
        if (!live) return
        setImages(foundImages)
        setSequences(foundSequences)
      })
      .catch(() => {
        if (!live) return
        setImages([])
        setSequences([])
      })
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

  /**
   * Re-point one scroll sequence at another clip.
   *
   * Takes the whole library entry rather than a hash, because the frame count is
   * half the identity: `replaceScreenSequence` rewrites the address and the count
   * in one splice, and a caller holding only a hash could not supply the second.
   */
  const applySequence = useCallback(
    (sequence: ScreenSequence, next: LibraryVideo) => {
      if (next.hash === sequence.hash && next.frames === sequence.frames) {
        setNotice(t('library.swapSeqSame'))
        setSeqTarget(null)
        return
      }
      try {
        // Mocky's origin, not the iframe's: the iframe's is opaque (I2).
        const out = replaceScreenSequence(
          code,
          sequence,
          { hash: next.hash, frames: next.frames },
          window.location.origin,
        )
        if (out === code) {
          setError(t('library.swapFailed'))
          return
        }
        onReplace(
          out,
          // Only when the record was about THIS clip. A screen with two
          // sequences has one `videoHash`, and moving it to whichever one the
          // user happened to swap would make the field say something nobody
          // asked it to say.
          videoHash && videoHash === sequence.hash
            ? { hash: next.hash, frames: next.frames }
            : undefined,
        )
        setNotice(t('library.swapSeqDone'))
        setError(null)
        setSeqTarget(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [code, onReplace, t, videoHash],
  )

  const targeted = images?.find((i) => i.hash === target?.hash) ?? null
  const isAll = (img: ScreenImage) => target?.hash === img.hash && target.spanIndex === null
  const isSlot = (img: ScreenImage, i: number) => target?.hash === img.hash && target.spanIndex === i
  /** Aim the picker at a whole image (null) or at one of its places, toggling off. */
  const aim = (hash: string, spanIndex: number | null) => {
    setNotice(null)
    setError(null)
    setSeqTarget(null)
    setTarget((prev) =>
      prev?.hash === hash && prev.spanIndex === spanIndex ? null : { hash, spanIndex },
    )
  }
  /** Same, for one sequence occurrence. The two pickers never stand open together. */
  const aimSequence = (index: number) => {
    setNotice(null)
    setError(null)
    setTarget(null)
    setSeqTarget((prev) => (prev === index ? null : index))
  }

  // Only once the walk has found something to draw a poster for.
  const clips = useClipLibrary(Boolean(sequences?.length))

  const scanning = images === null || sequences === null
  const nothingInCode = !scanning && images.length === 0 && sequences.length === 0
  /*
   * "No media here" and "this source would not parse" need different advice, and
   * the only signal separating them is that an address is plainly in the text
   * while the walk found nothing. `/api/videos/` counts for the same reason
   * `/api/images/` does: a hero sequence in a screen that no longer compiles is
   * exactly the case where the user reaches for this dialog.
   */
  const addressesInText = code.includes('/api/images/') || code.includes('/api/videos/')

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

      {scanning ? (
        <div className="mt-6 flex justify-center">
          <Spinner />
        </div>
      ) : nothingInCode ? (
        <div className="mt-4 border border-line-soft bg-ink/5 p-4">
          {/* Two different situations, and they need different advice: a screen
              that has no media, and a screen whose source would not parse. The
              second is a bug the user can see on the canvas. */}
          <p className="text-body text-ink">
            {addressesInText ? t('library.swapUnparsed') : t('library.swapNone')}
          </p>
          {!addressesInText && (
            <p className="measure mt-1 text-body-sm text-ink-muted">{t('library.swapNoneHint')}</p>
          )}
        </div>
      ) : images.length > 0 ? (
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
      ) : null}

      {/* The scroll sequences, in the same section because they are in the same
          place — the source — and visibly not photographs. A poster on its own
          IS a still from the clip and reads as one, so the badge is the only
          thing on the row saying that this slot is three viewport-heights of
          pinned scrolling rather than an <img>. */}
      {sequences && sequences.length > 0 && (
        <div className="mt-5">
          <p className="kicker text-accent-ink">{t('library.swapSequences')}</p>
          <p className="measure mb-2 text-caption text-ink-faint">{t('library.swapSequencesHint')}</p>
          <ul className="space-y-2">
            {sequences.map((seq, i) => (
              // Keyed on the offset, not the hash: the same clip can back two
              // sections, and two rows sharing a key would swap the open picker
              // onto the wrong one.
              <li key={`${seq.hash}:${seq.base.start}`} className="border border-line-soft bg-surface">
                <div className="flex items-center gap-3 p-2">
                  <span className="relative block h-16 w-24 shrink-0 border border-line-soft bg-ink">
                    {/* The re-cut stamp when the library entry is in hand — see
                        useClipLibrary. Without it this drew last year's still
                        while the picker below drew this year's. */}
                    <img
                      src={videoPosterUrl(
                        seq.hash,
                        clips.items?.find((v) => v.hash === seq.hash)?.recutAt,
                      )}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute bottom-0 left-0 flex items-center gap-1 bg-ink/80 px-1 py-0.5 text-caption text-surface">
                      <Icon name="film" size={11} />
                      {t('library.swapSeqBadge')}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body text-ink">{t('library.swapSeqLabel')}</p>
                    <p className="font-mono text-caption text-ink-faint">
                      {seq.hash.slice(0, 12)} ·{' '}
                      {t(seq.frames === 1 ? 'library.swapSeqFrames_one' : 'library.swapSeqFrames_other', {
                        n: seq.frames,
                      })}{' '}
                      · {t('library.swapSlotLine', { n: seq.line })}
                      {seq.element ? ` · <${seq.element}>` : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={seqTarget === i ? 'primary' : 'ghost'}
                    onClick={() => aimSequence(i)}
                  >
                    {seqTarget === i ? t('library.swapCancel') : t('library.swapReplace')}
                  </Button>
                </div>

                {seqTarget === i && (
                  <div className="border-t border-line-soft bg-ink/5 p-3">
                    <SequencePicker
                      heading={t('library.swapSeqChoose')}
                      currentHash={seq.hash}
                      items={clips.items}
                      failed={clips.failed}
                      onPick={(video) => applySequence(seq, video)}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Point C: why there is no film row above, answered where the question is
          asked rather than left to be inferred from an absence. */}
      {!scanning && (
        <p className="measure mt-3 text-caption text-ink-faint">{t('library.swapNoFilmInCode')}</p>
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
 * The clip library, fetched once for the whole of section 1.
 *
 * Shared between the sequence rows and the picker they open, deliberately. A row
 * draws the poster of the clip already in the code, and `videoPosterUrl` needs
 * that entry's `recutAt` to draw the CURRENT still: poster bytes are served
 * immutable for a year while the hash comes from the SOURCE, so a re-cut clip
 * keeps its URL and changes underneath. Fetched twice, the row and the picker
 * three inches below it would disagree about the same clip — which is the exact
 * defect the `recutAt` argument was added to fix, in this same dialog.
 *
 * Lazy: an instance that has never cut a sequence never asks. Failure is not
 * fatal (Q1) — the rows still draw, the picker says the list is unavailable, and
 * section 1's images are untouched by it.
 */
function useClipLibrary(enabled: boolean) {
  const [items, setItems] = useState<LibraryVideo[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const ctrl = new AbortController()
    let live = true
    listVideos(undefined, ctrl.signal)
      .then((v) => live && setItems(v))
      .catch(() => {
        if (!live || ctrl.signal.aborted) return
        setItems([])
        setFailed(true)
      })
    return () => {
      live = false
      ctrl.abort()
    }
  }, [enabled])

  return { items, failed }
}

/**
 * Pick one scroll sequence from the clip library.
 *
 * Hands back the whole entry, never a hash. The frame count is half of what
 * identifies a sequence, and a picker that reported only the address would push
 * the decision of where to find the count onto its caller — which is the shape
 * that produces a hero addressed with the previous clip's count.
 *
 * Not `ImagePicker` with a flag, and not a fourth way into the clip library: no
 * upload and no generate here on purpose. Both exist on the Media page, both
 * take minutes and money for a video, and neither belongs one click away from
 * "swap this hero for one you already have".
 */
function SequencePicker({
  heading,
  currentHash,
  items,
  failed,
  onPick,
}: {
  heading: string
  /** Marked in the grid as the one currently in the code. */
  currentHash: string
  items: LibraryVideo[] | null
  failed: boolean
  onPick: (video: LibraryVideo) => void
}) {
  const t = useT()

  return (
    <div>
      <div className="kicker mb-2 text-accent-ink">{heading}</div>
      {items === null ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : failed ? (
        <Banner tone="warn">{t('library.swapSeqListFailed')}</Banner>
      ) : items.length === 0 ? (
        <p className="py-2 text-body-sm text-ink-faint">{t('library.swapSeqEmpty')}</p>
      ) : (
        <ul className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {items.map((v) => (
            <li key={v.hash}>
              <button
                type="button"
                title={v.prompt}
                onClick={() => onPick(v)}
                className={`block w-full overflow-hidden border text-left transition ${
                  v.hash === currentHash ? 'border-accent' : 'border-line-soft hover:border-line'
                }`}
              >
                <img
                  src={videoPosterUrl(v.hash, v.recutAt)}
                  alt=""
                  className="block aspect-[4/3] w-full object-cover"
                />
                {/* The count is on the card because it is what the swap writes
                    into the code beside the address, not decoration. */}
                <span className="block px-1 py-0.5 font-mono text-caption text-ink-faint">
                  {t(v.frames === 1 ? 'library.swapSeqFrames_one' : 'library.swapSeqFrames_other', {
                    n: v.frames,
                  })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
