import { useT } from '../i18n'
import { Icon } from '../ui'
import type { FoldId } from '../lib/folds'

/**
 * Flat sheet or folded leaflet — the second half of "what kind of flyer", the
 * size being the chip beside it. A <select> rather than a row of buttons: six
 * folds spelled out ("3 volets roulé", "fenêtre") would push the prompt field
 * off a phone, and a fold is chosen once per project, not per generation.
 *
 * `folds` is what the chosen SIZE can take (`foldsFor`): a four-panel accordion
 * on A5 is four postage stamps, so it is not offered there rather than offered
 * and then dropped. Drawn by the caller only for a type that folds
 * (`themeFolds`).
 */
export default function FoldControl({
  value,
  folds,
  onChange,
  size = 14,
  className = '',
}: {
  value: FoldId | null
  folds: FoldId[]
  onChange: (fold: FoldId | null) => void
  size?: number
  className?: string
}) {
  const t = useT()
  if (!folds.length) return null
  const shown = value && folds.includes(value) ? value : null
  return (
    <label className={`inline-flex items-center gap-1 ${className}`} title={t('composer.fold.title')}>
      <span className={`inline-flex items-center gap-1 ${shown ? 'text-accent-ink' : 'text-ink-muted'}`}>
        <Icon name="library" size={size} />
        {t('composer.fold')}
      </span>
      <select
        value={shown ?? ''}
        onChange={(e) => onChange((e.target.value || null) as FoldId | null)}
        className="rounded border border-line bg-transparent px-1.5 py-0.5 text-caption text-ink"
      >
        <option value="">{t('composer.fold.none')}</option>
        {folds.map((id) => (
          <option key={id} value={id} title={t(`composer.fold.${id}.title`)}>
            {t(`composer.fold.${id}`)}
          </option>
        ))}
      </select>
    </label>
  )
}
