import { useEffect, useState } from 'react'
import { imageUrl, imageDownloadUrl, listLibrary, type LibraryImage } from '../lib/imageLibrary'

/**
 * Full-size view of a generated image. Thumbnails alone made it impossible to
 * judge an image without downloading it, so every place that shows an image
 * (Bibliothèque grid, Images page, the canvas card) opens this.
 *
 * Metadata is looked up from the library when it isn't already at hand, so the
 * prompt that produced the image is always one click away.
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

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-950/90 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <img
        src={imageUrl(hash)}
        alt={info?.prompt || 'image générée'}
        className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      <div
        className="mt-4 w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900/95 p-3 text-xs text-slate-300"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="whitespace-pre-wrap break-words leading-snug">{info?.prompt || 'Chargement…'}</p>
        {info && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
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
        <div className="mt-3 flex items-center justify-end gap-2">
          <a href={imageDownloadUrl(hash)} className="btn-ghost px-3 py-1 text-xs">
            ⬇ Télécharger
          </a>
          <button type="button" className="btn-primary px-3 py-1 text-xs" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Échap ou clic à l’extérieur pour fermer</p>
    </div>
  )
}
