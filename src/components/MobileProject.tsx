import { useEffect, useRef, useState } from 'react'
import type { Screen } from '../lib/project'
import Preview from './Preview'
import DeviceChrome, { SCREEN_RADIUS } from './DeviceChrome'
import { Icon, IconButton } from '../ui'
import { useT } from '../i18n'

/**
 * The project, on a phone.
 *
 * This replaces the infinite canvas below 768px on a coarse pointer, and the
 * reason is arithmetic rather than taste. `fitAll` sizes the board to hold
 * every screen: one 1440x900 mockup lands at scale 0.16 — 14px type rendered
 * at 2.2px — and two land at 0.077. Touch gestures would make that board
 * operable without making it legible, which is a magnifying glass over
 * something nobody can read. So the phone gets the one thing a phone is good
 * at: ONE screen, as large as the device allows, and a way to change which.
 *
 * It is deliberately not a new orchestrator. Every mutation — generate, edit,
 * polish, revert — stays in ProjectView with its AbortController, its
 * `codeAtStart` re-check and its `previousCode`. This owns a viewport and a
 * selection, nothing else. A second copy of those conventions would drift, and
 * the drift would be silent.
 *
 * What a phone cannot do is stated, not hidden. Comparing screens side by
 * side, marquee selection, link mode, annotation rectangles and frame resizing
 * all need a pointer and a board; an absence with no explanation reads as
 * breakage, and sends people looking for a control that is not there.
 */
export default function MobileProject({
  screens,
  selectedIds,
  onSelectionChange,
  generatingIds,
  regeneratingIds,
  fixingIds,
  regenLabel,
  onError,
  onOpenScreenMenu,
}: {
  screens: Screen[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  generatingIds?: Set<string>
  regeneratingIds?: Set<string>
  fixingIds?: Set<string>
  regenLabel?: string
  onError?: (id: string, message: string) => void
  /** Opens the same per-screen menu the canvas offers on right-click. */
  onOpenScreenMenu?: (screen: Screen, x: number, y: number) => void
}) {
  const t = useT()
  const areaRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  // The selection is the project's, not this component's: picking a screen here
  // is the same act as clicking one on the canvas, and the composer reads it to
  // decide between "generate a new screen" and "edit these".
  const activeId = selectedIds[0] ?? screens[0]?.id ?? null
  const active = screens.find((s) => s.id === activeId) ?? null

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  if (!screens.length) return null

  const phoneShaped = active?.device === 'iphone'
  // Fit inside the measured area, and never magnify: a 390px-wide mockup on a
  // 390px screen is already the right size, and scaling it up would only crop.
  const pad = 12
  const scale =
    active && size.w > 0
      ? Math.min((size.w - pad * 2) / active.w, (size.h - pad * 2) / Math.max(1, active.h), 1)
      : 0

  return (
    <div className="flex h-full w-full flex-col bg-sunken">
      {/*
        The strip of screens. A horizontal rail rather than a grid: it keeps the
        viewport below as tall as possible, which is the whole point of this
        view, and swiping a rail is the one canvas-like gesture a phone does
        natively and well.
      */}
      <div className="shrink-0 overflow-x-auto border-b border-line bg-surface">
        <div className="flex items-center gap-2 p-2">
          {screens.map((s, i) => {
            const on = s.id === activeId
            const busy = generatingIds?.has(s.id) || regeneratingIds?.has(s.id) || fixingIds?.has(s.id)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectionChange([s.id])}
                aria-current={on ? 'true' : undefined}
                className={`tap-target flex shrink-0 items-center gap-2 border px-3 py-2 text-body-sm transition ${
                  on ? 'border-accent bg-accent/10 text-accent-ink' : 'border-line-soft text-ink-muted'
                }`}
              >
                <span className="font-mono text-caption tabular-nums text-ink-faint">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="max-w-[9rem] truncate">{s.name}</span>
                {busy && <Icon name="sparkle" size={12} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* The screen itself, as large as the device allows and fully touchable. */}
      <div ref={areaRef} className="relative min-h-0 flex-1 overflow-hidden">
        {active && scale > 0 && (
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              width: active.w * scale,
              height: active.h * scale,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {phoneShaped ? (
              <DeviceChrome>
                <Preview
                  code={active.code}
                  caps={active.caps}
                  hideScrollbars
                  radius={SCREEN_RADIUS}
                  animations={active.animations}
                  generating={generatingIds?.has(active.id)}
                  onError={onError ? (m) => onError(active.id, m) : undefined}
                />
              </DeviceChrome>
            ) : (
              <div className="h-full w-full border border-line">
                <Preview
                  code={active.code}
                  caps={active.caps}
                  animations={active.animations}
                  generating={generatingIds?.has(active.id)}
                  onError={onError ? (m) => onError(active.id, m) : undefined}
                />
              </div>
            )}
          </div>
        )}

        {active && regenLabel && (regeneratingIds?.has(active.id) || fixingIds?.has(active.id)) && (
          <span className="absolute left-1/2 top-3 -translate-x-1/2 border border-line bg-raised px-2 py-1 text-caption text-ink-muted">
            {regenLabel}
          </span>
        )}

        {/* The per-screen menu, reached by a button because `contextmenu` does
            not fire from a long press on iOS Safari. */}
        {active && onOpenScreenMenu && (
          <IconButton
            variant="toolbar"
            label={t('canvas.more')}
            className="absolute right-3 top-3"
            onClick={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
              onOpenScreenMenu(active, r.left, r.bottom)
            }}
          >
            <Icon name="more" size={16} />
          </IconButton>
        )}
      </div>

      {/*
        What this view cannot offer, said once and plainly.
        Hiding it would read as breakage to anyone who knows Mocky on a desktop.
      */}
      <p className="shrink-0 border-t border-line-soft bg-surface px-3 py-2 text-caption text-ink-faint">
        {t('canvas.phoneLimits')}
      </p>
    </div>
  )
}
