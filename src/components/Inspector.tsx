import type { ReactNode } from 'react'
import { useT } from '../i18n'
import { Icon, IconButton, PanelDock, type IconName } from '../ui'

export interface InspectorTab<Id extends string> {
  id: Id
  label: string
  icon: IconName
  /** A count from somebody else — unread approval comments. */
  badge?: number
}

/**
 * The project's right-hand side: a rail of panels that is always there, and the
 * panel it opens.
 *
 * It is the old "right slot" given a place of its own. Six panels used to take
 * turns floating over the canvas' top-right corner — `lib/rightSlot.ts` is why
 * only one could — and each drew its own frame, title and close button. Here
 * the column draws those once and the panels are its content, through
 * `PanelDock`; which one shows is still the single `RightSlot` value, so two
 * occupants remain a state the type cannot express.
 *
 * The RAIL is the answer to "sometimes it is there and sometimes it is gone":
 * a column of the six panels' icons that never leaves (from md), the open one
 * lit. Closing a panel folds it back into the rail instead of making the whole
 * thing vanish, and every panel is one click from anywhere — there is no
 * second, hidden list to know about. A tab row and a `⋯` menu did that job
 * before, and half the panels were behind the menu.
 *
 * The panel is a column beside the rail from `xl`; below it, it floats over the
 * canvas' right edge, beside the rail, because 300px on each side of a 1024px
 * window leaves the canvas less than half. Below md there is no rail — the
 * floating toolbar's "More" opens the panels — and the panel floats at the edge.
 */
export default function Inspector<Id extends string>({
  tabs,
  active,
  onSelect,
  onClose,
  docked,
  status,
  children,
}: {
  tabs: InspectorTab<Id>[]
  active: Id | null
  /** A rail icon clicked: open that panel, or fold it if it is the open one. */
  onSelect: (id: Id) => void
  onClose: () => void
  docked: boolean
  status: ReactNode
  children: ReactNode
}) {
  const t = useT()
  const current = tabs.find((x) => x.id === active) ?? null

  return (
    <div className="order-3 flex">
      {current && (
        <aside
          aria-label={t('workspace.inspector')}
          className={`flex min-h-0 w-[300px] flex-col border-l border-line-soft bg-surface ${
            docked ? 'relative' : 'absolute inset-y-0 right-0 z-overlay shadow-2xl md:right-12'
          }`}
        >
          <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-line-soft px-3">
            <span className="flex min-w-0 items-center gap-2">
              <Icon name={current.icon} size={16} className="shrink-0 text-accent-ink" />
              <span className="truncate text-body-sm font-semibold text-ink">{current.label}</span>
            </span>
            <IconButton label={t('workspace.inspectorClose')} variant="quiet" onClick={onClose}>
              <Icon name="close" size={16} />
            </IconButton>
          </div>

          <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
            <PanelDock.Provider value={true}>{children}</PanelDock.Provider>
          </div>

          <div className="flex h-8 shrink-0 items-center gap-3 border-t border-line-soft px-3 text-caption text-ink-faint">
            {status}
          </div>
        </aside>
      )}

      <nav
        aria-label={t('workspace.inspectorRail')}
        className="hidden w-12 shrink-0 flex-col items-center gap-1 border-l border-line-soft bg-surface py-2 md:flex"
      >
        {tabs.map((x) => (
          <span key={x.id} className="relative">
            <IconButton
              label={x.label}
              variant="toolbar"
              active={x.id === active}
              onClick={() => onSelect(x.id)}
              className="!h-9 !w-9"
            >
              <Icon name={x.icon} size={17} />
            </IconButton>
            {!!x.badge && (
              <span className="pointer-events-none absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-accent px-1 text-center font-mono text-caption leading-4 text-on-accent">
                {x.badge}
              </span>
            )}
          </span>
        ))}
      </nav>
    </div>
  )
}
