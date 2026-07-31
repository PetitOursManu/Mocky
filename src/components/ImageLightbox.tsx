import { useEffect, useRef, useState } from 'react'
import { imageUrl, imageDownloadUrl, listLibrary, type LibraryImage } from '../lib/imageLibrary'
import { Button, Icon } from '../ui'
import { useT } from '../i18n'

/**
 * Full-size view of a generated image. Thumbnails alone made it impossible to
 * judge an image without downloading it, so every place that shows an image
 * (Bibliothèque grid, Images page, the canvas card) opens this.
 *
 * Layout rule: the IMAGE comes first and stays visible; everything else scrolls
 * under it. Muse prompts routinely run to a hundred lines, and centring the
 * whole column pushed the image off the top of the viewport with no way to
 * scroll back to it — the overlay scrolls now, and the actions are pinned so
 * they never end up buried below the prompt.
 */
export default function ImageLightbox({
  hash,
  meta,
  onClose,
}: {
  hash: string
  meta?: LibraryImage | null
  onClose: () => void
}) {
  const t = useT()
  const [info, setInfo] = useState<LibraryImage | null>(meta ?? null)
  const [copied, setCopied] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (info) return
    let alive = true
    listLibrary()
      .then((all) => alive && setInfo(all.find((i) => i.hash === hash) ?? null))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [hash, info])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // A newly opened image must start at the top, whatever the previous one did.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [hash])

  async function copyPrompt() {
    if (!info?.prompt) return
    try {
      await navigator.clipboard.writeText(info.prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked — the text is selectable anyway */
    }
  }

  return (
    <div
      ref={scrollRef}
      className="fixed inset-0 z-top overflow-y-auto overscroll-contain bg-ink/60"
      onClick={onClose}
    >
      {/* Pinned actions — reachable no matter how long the prompt is. */}
      <div className="pointer-events-none sticky top-0 z-10 flex justify-end gap-2 p-3">
        <a
          href={imageDownloadUrl(hash)}
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto inline-flex items-center gap-1.5 border border-line bg-raised px-3 py-1.5 text-body-sm text-ink transition hover:border-accent hover:text-accent-ink"
        >
          <Icon name="download" size={16} />
          {t('library.download')}
        </a>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="pointer-events-auto inline-flex items-center gap-1.5 border border-line bg-raised px-3 py-1.5 text-body-sm text-ink transition hover:bg-ink/5"
          title={t('library.closeEsc')}
        >
          <Icon name="close" size={16} />
          {t('common.close')}
        </button>
      </div>

      {/* Top-aligned, never centred: centring a taller-than-viewport column
          scrolls the top out of reach in most browsers. */}
      <div className="flex flex-col items-center gap-4 px-4 pb-10 -mt-2">
        <img
          src={imageUrl(hash)}
          alt={info?.prompt || t('library.altGenerated')}
          className="max-h-[78vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />

        {info && (
          <div className="flex flex-wrap items-center justify-center gap-2 border border-line bg-raised px-3 py-1.5 text-caption text-ink-muted">
            <span className="font-mono">
              {info.width}×{info.height}
            </span>
            <span>· {info.provider}</span>
            {info.seed != null && (
              <span>
                · seed <span className="font-mono">{info.seed}</span>
              </span>
            )}
            {(info.tags || []).map((tag) => (
              <span key={tag} className="rounded bg-ink/5 px-1.5 py-0.5 text-ink-muted">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div
          className="measure w-full border border-line bg-raised p-3 text-body-sm text-ink-muted"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rule-thin mb-1.5 flex items-center justify-between gap-2 pb-1.5">
            <span className="kicker text-accent-ink">{t('library.promptLabel')}</span>
            {info?.prompt && (
              <Button variant="ghost" size="sm" onClick={copyPrompt}>
                <Icon name={copied ? 'check' : 'copy'} size={14} />
                {copied ? t('common.copied') : t('common.copy')}
              </Button>
            )}
          </div>
          <p className="whitespace-pre-wrap break-words leading-snug">{info?.prompt || t('common.loading')}</p>
        </div>

        <p className="border border-line-soft bg-raised px-2 py-1 text-caption text-ink-muted">
          {t('library.escHint')}
        </p>
      </div>
    </div>
  )
}
