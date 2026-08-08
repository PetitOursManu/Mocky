import { useEffect, useRef, type ReactNode } from 'react'
import { IconButton } from './Button'
import { Icon } from './Icon'
import { useT } from '../i18n'

/**
 * A dialog that behaves like one.
 *
 * The app had eight hand-rolled modals. Across all of `src/components`, the
 * string `aria-` appeared exactly once (inside code injected into the preview
 * iframe) and `role=` exactly once. So none of them announced themselves as a
 * dialog, none trapped focus, none restored focus on close, and Escape worked
 * on some but not others. They also used five different overlay tints and seven
 * ad-hoc z-index values — two of which placed panels on top of each other with
 * no defined winner.
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
  /** Width preset. Editorial layout: content sets the measure, not the frame. */
  size = 'md',
  /** False while the app genuinely requires an answer (e.g. sign-in). */
  dismissible = true,
  /**
   * The close button's accessible name, defaulting to the current language.
   * It was the literal string `"Fermer"`, so the only name this icon-only
   * button had in an English interface was a French word. See Panel.
   */
  closeLabel,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'full'
  dismissible?: boolean
  closeLabel?: string
}) {
  const t = useT()
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null

    // Move focus into the dialog, preferring the first real control.
    const panel = panelRef.current
    const focusable = panel?.querySelector<HTMLElement>(
      'input, textarea, select, button, a[href], [tabindex]:not([tabindex="-1"])',
    )
    ;(focusable ?? panel)?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      // Focus trap: without it, Tab walked straight out of the dialog and into
      // the page behind, which is still fully interactive.
      const items = [
        ...panel.querySelectorAll<HTMLElement>(
          'input, textarea, select, button, a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = prevOverflow
      restoreTo.current?.focus?.()
    }
  }, [onClose, dismissible])

  const width = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-3xl',
    full: 'max-w-[min(96vw,1400px)]',
  }[size]

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-ink/60 p-4"
      // The single overlay tint. No handler at all when the dialog is required:
      // a click that is silently ignored reads as a broken dialog.
      onClick={dismissible ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[90vh] w-full ${width} flex-col border border-line bg-raised outline-none`}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3">
          <h2 className="min-w-0 flex-1 truncate text-h3 text-ink">{title}</h2>
          {dismissible && (
            <IconButton label={closeLabel ?? t('common.close')} variant="quiet" onClick={onClose}>
              <Icon name="close" size={18} />
            </IconButton>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line-soft px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
