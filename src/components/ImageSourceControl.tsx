import { useT } from '../i18n'
import { Icon } from '../ui'
import type { ImageSource } from '../lib/stockImages'
import type { DocumentImageChoice } from '../lib/documentPictures'

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
  const options: [ImageSource, string, string][] = [
    ['ai', 'project.imageSourceAi', 'project.imageSourceAiTitle'],
    ['stock', 'project.imageSourceStock', 'project.imageSourceStockTitle'],
  ]
  return <SourceChoices value={value} onChange={onChange} options={options} size={size} className={className} />
}

const DOCUMENT_OPTIONS: Record<DocumentImageChoice, [string, string]> = {
  none: ['project.docImageNone', 'project.docImageNoneTitle'],
  ai: ['project.docImageAi', 'project.docImageAiTitle'],
  stock: ['project.docImageStock', 'project.docImageStockTitle'],
}

/**
 * The same control for a DOCUMENT's one picture, with "no picture" as a real,
 * visible answer — and the default (`lib/documentPictures.ts`).
 *
 * Drawn whenever a page format is active, whatever else is on: this is where
 * a paid picture is decided, so it cannot be hidden behind the conditions that
 * gate the general control. `choices` holds only the doors this account can
 * open; a closed one is absent, never offered and then refused.
 */
export function DocumentImageControl({
  value,
  choices,
  onChange,
  size = 14,
  className = '',
}: {
  value: DocumentImageChoice
  choices: DocumentImageChoice[]
  onChange: (choice: DocumentImageChoice) => void
  size?: number
  className?: string
}) {
  const options = choices.map((id) => [id, ...DOCUMENT_OPTIONS[id]] as [DocumentImageChoice, string, string])
  return (
    <SourceChoices
      value={value}
      onChange={onChange}
      options={options}
      size={size}
      className={className}
      lit={value !== 'none'}
      label="project.docImage"
    />
  )
}

function SourceChoices<T extends string>({
  value,
  onChange,
  options,
  size,
  className,
  lit = value === 'stock',
  label = 'project.imageSource',
}: {
  value: T
  onChange: (v: T) => void
  options: [T, string, string][]
  size: number
  className: string
  /** Whether the label is drawn in the accent: the choice departs from the plain default. */
  lit?: boolean
  label?: string
}) {
  const t = useT()
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className={`inline-flex items-center gap-1 ${lit ? 'text-accent-ink' : 'text-ink-muted'}`}>
        <Icon name="image" size={size} />
        {t(label)}
      </span>
      <span role="group" aria-label={t(label)} className="inline-flex overflow-hidden rounded border border-line">
        {options.map(([id, optionLabel, title]) => (
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
            {t(optionLabel)}
          </button>
        ))}
      </span>
    </span>
  )
}
