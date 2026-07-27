import { useEffect, useRef, useState } from 'react'
import { imageUrl, imageDownloadUrl, listLibrary, type LibraryImage } from '../lib/imageLibrary'

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
      className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-slate-950/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Pinned actions — reachable no matter how long the prompt is. */}
      <div className="pointer-events-none sticky top-0 z-10 flex justify-end gap-2 p-3">
        <a
          href={imageDownloadUrl(hash)}
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-200 shadow-lg hover:bg-slate-800"
        >
          ⬇ Télécharger
        </a>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="pointer-events-auto rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-200 shadow-lg hover:bg-slate-800"
          title="Fermer (Échap)"
        >
          ✕ Fermer
        </button>
      </div>

      {/* Top-aligned, never centred: centring a taller-than-viewport column
          scrolls the top out of reach in most browsers. */}
      <div className="flex flex-col items-center gap-4 px-4 pb-10 -mt-2">
        <img
          src={imageUrl(hash)}
          alt={info?.prompt || 'image générée'}
          className="max-h-[78vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />

        {info && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
            <span>
              {info.width}×{info.height}
            </span>
            <span>· {info.provider}</span>
            {info.seed != null && <span>· seed {info.seed}</span>}
            {(info.tags || []).map((t) => (
              <span key={t} className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
                {t}
              </span>
            ))}
          </div>
        )}

        <div
          className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900/95 p-3 text-xs text-slate-300"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Prompt</span>
            {info?.prompt && (
              <button
                type="button"
                onClick={copyPrompt}
                className="rounded border border-slate-700 px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                {copied ? '✓ copié' : '⧉ copier'}
              </button>
            )}
          </div>
          <p className="whitespace-pre-wrap break-words leading-snug">{info?.prompt || 'Chargement…'}</p>
        </div>

        <p className="text-[11px] text-slate-500">Échap ou clic à l’extérieur pour fermer</p>
      </div>
    </div>
  )
}
