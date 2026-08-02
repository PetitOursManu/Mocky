import type { ReactNode } from 'react'
import { Icon } from './Icon'

/** A small removable token — selected screens, pinned images, tags. */
export function Chip({
  children,
  onRemove,
  removeLabel = 'Retirer',
  tone = 'default',
}: {
  children: ReactNode
  onRemove?: () => void
  removeLabel?: string
  tone?: 'default' | 'accent' | 'muse'
}) {
  const look = {
    default: 'border-line-soft text-ink',
    accent: 'border-accent bg-accent text-on-accent',
    muse: 'border-muse text-muse-ink',
  }[tone]
  return (
    <span className={`inline-flex min-h-8 items-center gap-1.5 border px-2 text-body-sm ${look}`}>
      <span className="max-w-[14rem] truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="-mr-0.5 shrink-0 px-1 opacity-70 transition hover:opacity-100"
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </span>
  )
}

/**
 * Mutually exclusive modes, as one control.
 *
 * The canvas toolbar had four independent toggle buttons for Link / Modify /
 * Interact / Annotate, and the "turn the other two off" logic was copy-pasted
 * three times — which is how the Links panel and the Design System panel ended
 * up both openable, at `right-4 top-11`, overlapping to the pixel. One value in,
 * one value out, and the exclusivity is structural.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T | null
  onChange: (v: T | null) => void
  options: { value: T; label: string; icon?: string; title?: string }[]
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex border border-line-soft">
      {options.map((opt, i) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            title={opt.title ?? opt.label}
            // Clicking the active segment turns the mode off — otherwise there
            // is no way back to plain selection without picking another mode.
            onClick={() => onChange(active ? null : opt.value)}
            className={
              'inline-flex min-h-8 items-center gap-1.5 border-b-2 px-2.5 text-body-sm font-medium transition ' +
              (i > 0 ? 'border-l border-l-line-soft ' : '') +
              // The inversion carries the state; the accent rule underneath is
              // what makes it findable at a glance, the way a tab is underlined.
              (active
                ? 'border-b-accent bg-ink text-surface'
                : 'border-b-transparent text-ink-muted hover:text-ink')
            }
          >
            {opt.icon && <span aria-hidden>{opt.icon}</span>}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
