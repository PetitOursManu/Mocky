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
  hash: first,
  meta,
  series,
  onClose,
}: {
  hash: string
  meta?: LibraryImage | null
  /**
   * The whole series this picture belongs to — a Motion Ultra screen's
   * pictures. With more than one, the viewer steps through them (arrows, ← →,
   * the strip of thumbnails) instead of showing one and hiding the rest.
   */
  series?: string[]
  onClose: () => void
}) {
  const t = useT()
  const list = series && series.length > 1 ? series : [first]
  const [index, setIndex] = useState(() => Math.max(0, list.indexOf(first)))
  const hash = list[index] ?? first
  /** Library records by hash, so stepping back does not refetch. */
  const [infos, setInfos] = useState<Record<string, LibraryImage | null>>(() => (meta ? { [first]: meta } : {}))
  const info = infos[hash] ?? null
  const [copied, setCopied] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (hash in infos) return
    let alive = true
    listLibrary()
      .then((all) => {
        if (!alive) return
        const found: Record<string, LibraryImage | null> = {}
        for (const h of list) found[h] = all.find((i) => i.hash === h) ?? null
        setInfos((prev) => ({ ...found, ...prev }))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // `list` is derived from props that do not change while the viewer is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, infos])

  const step = (delta: number) => setIndex((i) => (i + delta + list.length) % list.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (list.length > 1 && e.key === 'ArrowRight') step(1)
      else if (list.length > 1 && e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, list.length])

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
        <div className="relative flex max-w-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {list.length > 1 && (
            <button
              type="button"
              onClick={() => step(-1)}
              className="absolute left-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-raised/90 text-ink shadow-lg transition hover:border-accent"
              aria-label={t('library.previousImage')}
            >
              <Icon name="chevronLeft" size={20} />
            </button>
          )}
          <img
            src={imageUrl(hash)}
            alt={info?.prompt || t('library.altGenerated')}
            className="max-h-[78vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
          />
          {list.length > 1 && (
            <button
              type="button"
              onClick={() => step(1)}
              className="absolute right-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-raised/90 text-ink shadow-lg transition hover:border-accent"
              aria-label={t('library.nextImage')}
            >
              <Icon name="chevronRight" size={20} />
            </button>
          )}
        </div>

        {list.length > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
            <span className="border border-line bg-raised px-2 py-1 font-mono text-caption text-ink-muted">
              {index + 1} / {list.length}
            </span>
            {list.map((h, i) => (
              <button
                key={h}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={t('library.showImage', { n: i + 1 })}
                aria-current={i === index}
                className={`overflow-hidden rounded border-2 transition ${i === index ? 'border-accent' : 'border-transparent opacity-70 hover:opacity-100'}`}
              >
                <img src={imageUrl(h)} alt="" className="block h-12 w-16 object-cover" />
              </button>
            ))}
          </div>
        )}

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
