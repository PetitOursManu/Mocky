import { useT } from '../i18n'
import { Icon } from '../ui'
import type { ImageSource } from '../lib/stockImages'

/**
 * Where a generation's pictures come from: made by the image model, or found
 * in the free libraries (Pexels, Pixabay). One control for both composers, like
 * UltraControl beside it, so the first screen and the next cannot disagree.
 *
 * Two visible choices rather than a checkbox: "free photos: off" does not say
 * what happens instead, and the answer — a generated picture, maybe paid — is
 * the thing worth seeing before pressing Generate.
 *
 * The caller decides whether to draw it at all. It is absent when the account
 * cannot use the libraries (no key on the instance, or the administrator did
 * not open them to it), and absent when neither Muse nor Motion Ultra is on —
 * those are the only two passes that put pictures in a screen, and a switch
 * that changes nothing is furniture.
 */
export default function ImageSourceControl({
  value,
  onChange,
  size = 14,
  className = '',
}: {
  value: ImageSource
  onChange: (source: ImageSource) => void
  size?: number
  className?: string
}) {
  const t = useT()
  const options: [ImageSource, string, string][] = [
    ['ai', 'project.imageSourceAi', 'project.imageSourceAiTitle'],
    ['stock', 'project.imageSourceStock', 'project.imageSourceStockTitle'],
  ]
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className={`inline-flex items-center gap-1 ${value === 'stock' ? 'text-accent-ink' : 'text-ink-muted'}`}>
        <Icon name="image" size={size} />
        {t('project.imageSource')}
      </span>
      <span role="group" aria-label={t('project.imageSource')} className="inline-flex overflow-hidden rounded border border-line">
        {options.map(([id, label, title]) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={value === id}
            title={t(title)}
            className={`px-1.5 py-0.5 text-caption transition ${
              value === id ? 'bg-accent text-on-accent' : 'text-ink-muted hover:bg-ink/5'
            }`}
          >
            {t(label)}
          </button>
        ))}
      </span>
    </span>
  )
}
