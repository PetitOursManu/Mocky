import { useState, type ReactNode } from 'react'
import { Button, Icon, type ButtonVariant, type IconName } from '../ui'

/**
 * A button of the project's top bar that opens a menu under it — `Partager`
 * and `Exporter`, as the reference draws them.
 *
 * Exporting used to be split across six places (a toolbar menu for the .zip,
 * four entries scattered through a screen's menu, a document's own dialog) and
 * sharing across two (a screen's QR link in its menu, the approval round in the
 * toolbar). Each of these menus is now the one place its verb lives; a screen's
 * own menu keeps a shortcut to the same actions for that screen.
 *
 * The menu carries a backdrop rather than relying on Escape: opened by a
 * finger, it has no keyboard to close it.
 */
export function BarMenu({
  label,
  icon,
  variant = 'ghost',
  title,
  badge,
  children,
}: {
  label: string
  icon: IconName
  variant?: ButtonVariant
  title?: string
  /** Something waiting — unread approval comments. */
  badge?: ReactNode
  /** The menu's rows; `close` is passed so a row can close it as it acts. */
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <div className="relative">
      <Button
        variant={variant}
        size="sm"
        active={variant !== 'primary' && open}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title ?? label}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={icon} size={15} />
        {/* Icon-only below lg: on a 1024px window the labels squeezed the
            project's name out of the breadcrumb. The title still names it. */}
        <span className="hidden lg:inline">{label}</span>
        {badge}
        <Icon name="chevronDown" size={13} className="-mr-0.5 opacity-70" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-menu" onClick={close} />
          <div
            role="menu"
            className="menu-in absolute right-0 top-full z-menu mt-1.5 w-max min-w-[16rem] max-w-[min(22rem,calc(100vw-1rem))] rounded-lg border border-line bg-raised p-1 shadow-2xl"
            style={{ transformOrigin: 'top right' }}
          >
            {children(close)}
          </div>
        </>
      )}
    </div>
  )
}

/** A row of a top-bar menu, with an optional second line saying what it does. */
export function BarMenuItem({
  icon,
  label,
  hint,
  onClick,
  disabled,
}: {
  icon: IconName
  label: string
  hint?: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-start gap-2.5 rounded-md px-2.5 py-1.5 text-left text-body-sm text-ink transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
    >
      <Icon name={icon} size={15} className="mt-0.5 shrink-0 text-ink-muted" />
      <span className="min-w-0">
        <span className="block font-medium transition group-enabled:group-hover:text-accent-ink">{label}</span>
        {hint && <span className="block text-caption text-ink-faint">{hint}</span>}
      </span>
    </button>
  )
}

/** The small label above a group of rows. */
export function BarMenuLabel({ children }: { children: ReactNode }) {
  return <div className="kicker px-2.5 pb-1 pt-2 first:pt-1">{children}</div>
}

/** The rule between two groups. */
export function BarMenuRule() {
  return <div className="mx-1 my-1 border-t border-line-soft" />
}
