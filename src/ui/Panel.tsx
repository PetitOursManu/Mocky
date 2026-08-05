import type { ReactNode } from 'react'
import { IconButton } from './Button'
import { Icon } from './Icon'

/**
 * A floating surface over the canvas — the Links list, the Design System
 * inspector, the context menu.
 *
 * Two of these used to be positioned identically (`absolute right-4 top-11`)
 * with no z-index, so opening one did not close the other and they overlapped
 * exactly. Placement is now the caller's job and stacking comes from the single
 * z scale in tailwind.config.js.
 */
export function Panel({
  title,
  onClose,
  children,
  footer,
  className = '',
}: {
  title: string
  onClose?: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <aside
      aria-label={title}
      className={`flex max-h-[70vh] flex-col border border-line bg-raised ${className}`}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        {/* A real heading, not a <span>: the floating panels titled themselves
            with plain text, so the page had no outline below <h1>. */}
        <h3 className="min-w-0 flex-1 truncate text-body-sm font-semibold uppercase tracking-wide text-accent-ink">
          {title}
        </h3>
        {onClose && (
          <IconButton label="Fermer le panneau" variant="quiet" onClick={onClose}>
            <Icon name="close" size={16} />
          </IconButton>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer && <div className="shrink-0 border-t border-line-soft px-3 py-2">{footer}</div>}
    </aside>
  )
}

/** A row inside a Panel. Actions stay visible on focus, not only on hover. */
export function PanelRow({
  children,
  onClick,
  actions,
  active = false,
}: {
  children: ReactNode
  onClick?: () => void
  actions?: ReactNode
  active?: boolean
}) {
  return (
    <div
      className={`group flex items-center gap-2 border-b border-l-2 border-b-line-soft px-3 py-2 last:border-b-0 ${
        // The left rule is always there, so nothing shifts when a row is picked.
        active ? 'border-l-accent bg-ink/5' : 'border-l-transparent'
      }`}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          // The row label is the whole hit area for opening a link or a screen,
          // and `py-2` around 13px of text leaves it at 35px. `tap-target`
          // raises the row itself under a finger — the actions beside it are
          // IconButtons, which already carry the floor.
          className="tap-target min-w-0 flex-1 truncate text-left text-body-sm text-ink transition group-hover:text-accent-ink"
        >
          {children}
        </button>
      ) : (
        <div className="min-w-0 flex-1 truncate text-body-sm text-ink">{children}</div>
      )}
      {actions && (
        // Destructive actions used to be hidden at opacity-0 until hover, with
        // no focus variant — so a keyboard user tabbed into an invisible
        // "delete" button, and on a touch screen it was simply unreachable.
        <div className="flex shrink-0 items-center gap-1 opacity-60 transition group-hover:opacity-100 group-focus-within:opacity-100">
          {actions}
        </div>
      )}
    </div>
  )
}
