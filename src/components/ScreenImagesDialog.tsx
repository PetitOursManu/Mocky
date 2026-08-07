import { useCallback, useEffect, useState } from 'react'
import { imageUrl } from '../lib/imageLibrary'
import { findScreenImages, replaceScreenImage, type ImageSpan, type ScreenImage } from '../lib/screenImages'
import { ImagePicker } from './ImagePicker'
import { Banner, Button, Modal, Spinner } from '../ui'
import { useT } from '../i18n'

/**
 * Change the pictures in a screen without regenerating it.
 *
 * Until this existed, an image entered a screen only at generation time — pin
 * it in the library, and the model copies its URL into the JSX. Changing your
 * mind therefore meant regenerating, and losing every other thing about the
 * screen along with the picture you disliked.
 *
 * The swap is a text substitution at offsets an AST vouched for (see
 * src/lib/screenImages.ts), so no model is called, nothing is restyled, and the
 * operation is instant. What it deliberately cannot do is ADD an image to a
 * screen that has none, or remove one: both change the component's structure,
 * which is a generation, not a substitution. The empty state says so rather
 * than offering a button that would quietly become a model call.
 *
 * Its own dialog rather than a mode bolted onto Bibliothèque: that component
 * also deletes images and downloads the whole library as a ZIP, and neither
 * belongs one click away from "pick a replacement".
 */
export default function ScreenImagesDialog({
  screenName,
  code,
  projectId,
  onReplace,
  onClose,
}: {
  screenName: string
  /** The screen's current source. Re-read on every change, so the list follows a swap. */
  code: string
  projectId?: string
  /** Hands the rewritten source back; the caller owns previousCode and Revert. */
  onReplace: (nextCode: string) => void
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
      <p className="measure text-body-sm text-ink-muted">{t('library.swapBlurb')}</p>

      {error && (
        <Banner tone="danger" title={t('library.swapFailed')} className="mt-3">
          {error}
        </Banner>
      )}
      {notice && !error && (
        <Banner tone="ok" className="mt-3">
          {notice}
        </Banner>
      )}

      {images === null ? (
        <div className="mt-6 flex justify-center">
          <Spinner />
        </div>
      ) : images.length === 0 ? (
        <div className="mt-6 border border-line-soft bg-ink/5 p-4">
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
    </Modal>
  )
}
