import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { useT } from '../i18n'

/** A small removable token — selected screens, pinned images, tags. */
export function Chip({
  children,
  onRemove,
  /**
   * The cross's accessible name. It defaulted to the literal `"Retirer"`, which
   * is the whole name of a button with nothing but an icon in it — so an English
   * interface announced a French word, and no caller could correct it without
   * writing the sentence itself. Overridable still, because "Retirer" alone says
   * nothing about what: `removeLabel={t('project.removeRefN', { n })}`.
   */
  removeLabel,
  tone = 'default',
}: {
  children: ReactNode
  onRemove?: () => void
  removeLabel?: string
  tone?: 'default' | 'accent' | 'muse'
}) {
  const t = useT()
  const look = {
    default: 'border-line bg-raised text-ink-muted',
    // The reference's selected chip: the lime on its own wash, not a solid block.
    accent: 'border-accent/40 bg-accent-wash/10 text-accent-ink',
    muse: 'border-muse/40 bg-muse/10 text-muse-ink',
  }[tone]
  return (
    <span className={`tap-target inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 text-body-sm ${look}`}>
      <span className="max-w-[14rem] truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? t('common.remove')}
          // A 14px cross with 4px of padding either side is a 22px target: the
          // smallest thing in the whole system, and the one most often reached
          // for with a thumb. It gets both axes of the coarse-pointer floor.
          // `inline-flex` so the icon stays centred once the box is 44 wide.
          className="tap-target tap-target-square -mr-0.5 inline-flex shrink-0 items-center justify-center px-1 opacity-70 transition hover:opacity-100"
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
    <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-lg border border-line bg-raised p-0.5">
      {options.map((opt) => {
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
              'tap-target inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-body-sm font-medium transition ' +
              // The reference's tool group: segments inside one raised tray,
              // the active one in the lime on its tinted ground.
              (active ? 'bg-selected text-on-selected' : 'text-ink-muted hover:bg-ink/5 hover:text-ink')
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
