import type { ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * A checkbox drawn in the theme: a rounded box on the raised surface that fills
 * with the accent and shows a check when ticked.
 *
 * The native box was Windows' grey square with a blue tick on a black and lime
 * interface — the one control on the page the theme did not reach. The input is
 * still there, hidden but focusable, so the keyboard, the screen reader and the
 * form semantics are the browser's own; only the drawing is ours. The label is
 * the whole hit area, sized for a thumb.
 */
export function Checkbox({
  checked,
  onChange,
  children,
  disabled,
  title,
  className = '',
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children?: ReactNode
  disabled?: boolean
  title?: string
  className?: string
}) {
  return (
    <label
      title={title}
      className={`tap-target inline-flex min-h-8 select-none items-center gap-1.5 text-caption ${
        checked ? 'text-ink' : 'text-ink-muted'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:text-ink'} ${className}`}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-field bg-raised text-transparent transition peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-focus-visible:outline-solid"
      >
        <Icon name="check" size={13} strokeWidth={2.5} />
      </span>
      {children}
    </label>
  )
}
