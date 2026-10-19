import { useState, type ReactNode } from 'react'
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
 * The project's right-hand column, as the reference draws it
 * (plans/refonte/modele-dark-glitch.html): a head, tabs, the panel, a status
 * line.
 *
 * It is the old "right slot" given a place of its own. Six panels used to take
 * turns floating over the canvas' top-right corner — `lib/rightSlot.ts` is why
 * only one could — and each drew its own frame, title and close button. Here
 * the column draws those once and the panels are its content, through
 * `PanelDock`; which one shows is still the single `RightSlot` value, so two
 * occupants remain a state the type cannot express.
 *
 * Three tabs are always offered (Style, Versions, Audit); the others (approval,
 * campaign, links) are reached from the `⋯` menu or from where they belong —
 * Share, the creation column, the Link tool — and appear as a fourth tab while
 * they are open, so what is on screen is always named.
 *
 * Docked from `xl`; below it the same column floats over the canvas' right
 * edge, because 300px on each side of a 1024px window leaves the canvas less
 * than half.
 */
export default function Inspector<Id extends string>({
  tabs,
  more,
  active,
  onSelect,
  onClose,
  docked,
  status,
  children,
}: {
  tabs: InspectorTab<Id>[]
  more: InspectorTab<Id>[]
  active: Id
  onSelect: (id: Id) => void
  onClose: () => void
  docked: boolean
  status: ReactNode
  children: ReactNode
}) {
  const t = useT()
  const [moreOpen, setMoreOpen] = useState(false)
  const extra = tabs.some((x) => x.id === active) ? null : more.find((x) => x.id === active) ?? null
  const shown = extra ? [...tabs, extra] : tabs

  return (
    <aside
      aria-label={t('workspace.inspector')}
      className={`order-3 flex min-h-0 w-[300px] shrink-0 flex-col border-l border-line-soft bg-surface ${
        docked ? 'relative' : 'absolute inset-y-0 right-0 z-overlay shadow-2xl'
      }`}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-line-soft px-3">
        <span className="text-body-sm font-semibold text-ink">{t('workspace.inspector')}</span>
        <div className="relative flex items-center gap-0.5">
          <IconButton
            label={t('workspace.inspectorMore')}
            variant="quiet"
            active={moreOpen}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <Icon name="more" size={16} />
          </IconButton>
          <IconButton label={t('workspace.inspectorClose')} variant="quiet" onClick={onClose}>
            <Icon name="close" size={16} />
          </IconButton>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-menu" onClick={() => setMoreOpen(false)} />
              <div
                role="menu"
                className="menu-in absolute right-0 top-full z-menu mt-1 w-56 rounded-lg border border-line bg-raised p-1 shadow-2xl"
              >
                {more.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={x.id === active}
                    onClick={() => {
                      setMoreOpen(false)
                      onSelect(x.id)
                    }}
                    className={`flex min-h-8 w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-body-sm transition ${
                      x.id === active ? 'bg-selected text-on-selected' : 'text-ink hover:bg-ink/5'
                    }`}
                  >
                    <Icon name={x.icon} size={15} className="shrink-0" />
                    <span className="flex-1">{x.label}</span>
                    {!!x.badge && <span className="font-mono text-caption text-accent-ink">{x.badge}</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Underlined tabs, as the reference draws them: the active one in the
          accent, the others grey, no box around any of them. */}
      <div role="tablist" className="flex shrink-0 border-b border-line-soft px-2">
        {shown.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={x.id === active}
            onClick={() => onSelect(x.id)}
            className={`-mb-px flex min-h-10 flex-1 items-center justify-center gap-1 border-b-2 px-1 text-body-sm transition ${
              x.id === active
                ? 'border-accent text-accent-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <span className="truncate">{x.label}</span>
            {!!x.badge && <span className="font-mono text-caption">{x.badge}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
        <PanelDock.Provider value={true}>{children}</PanelDock.Provider>
      </div>

      <div className="flex h-8 shrink-0 items-center gap-3 border-t border-line-soft px-3 text-caption text-ink-faint">
        {status}
      </div>
    </aside>
  )
}
