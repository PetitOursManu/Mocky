import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SCREEN_THEMES, getScreenTheme, type ScreenThemeId } from '../lib/screenThemes'
import { Chip, Icon } from '../ui'
import { useT } from '../i18n'

/**
 * "Type d'écran" — one chip that opens the catalogue, beside the Format chips.
 *
 * One chip rather than fifteen: the Format row already holds three, and a row
 * of fifteen more would push the prompt field — the point of the composer — off
 * a laptop screen and wrap into four lines on a phone. The menu also has room
 * for what a chip cannot say: each type's one-line description, which is what
 * tells "Tableau" from "Tableau de bord" before anything is generated.
 *
 * The chip carries the state in the same two ways the Format chips do: the
 * accent flat when a type is active, and its name in place of the generic
 * label. Clearing is a separate cross beside it and never the chip itself — the
 * chip opens the menu, and a control that sometimes opens and sometimes clears
 * is one people learn by losing their choice.
 *
 * `placement` because the two composers sit at opposite ends of the screen: the
 * floating bar is pinned to the bottom (the menu opens upwards), Welcome's is in
 * the middle of a scrolling page (downwards).
 */
export default function ScreenThemePicker({
  value,
  onChange,
  placement = 'up',
  disabled = false,
  ignored = false,
}: {
  value: ScreenThemeId | null
  onChange: (id: ScreenThemeId | null) => void
  placement?: 'up' | 'down'
  disabled?: boolean
  /**
   * The next generation will not use the type (site captures in Reproduce mode:
   * the captures are the brief). The chip stays choosable but stops wearing the
   * accent, which was a promise the generation did not keep.
   */
  ignored?: boolean
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const chipRef = useRef<HTMLButtonElement>(null)
  const active = getScreenTheme(value)

  // Hung from the chip's left edge, the menu is wider than the room to its
  // right whenever the chip is not at the start of its row — the export menu
  // learned this at 390px, where it opened entirely past the edge. Measured and
  // pulled back inside a 16px gutter, before paint so it never flashes there.
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!open || !menu) return
    menu.style.left = ''
    // The left edge from the rect, the width from offsetWidth: the menu is
    // measured on its first frame, while `.menu-in` still scales it from its
    // left edge, so the rect's right side came up ~4.5% short and the pulled-back
    // menu still ran past the viewport. Offset sizes ignore transforms, and a
    // scale anchored on the left leaves the left edge where it will end up.
    const over = menu.getBoundingClientRect().left + menu.offsetWidth - (window.innerWidth - 16)
    if (over > 0) menu.style.left = `${-over}px`
  }, [open])

  // Focus lands on the chosen type (or the first one) so the keyboard starts
  // where the eye does, and Escape gives the focus back to the chip.
  useEffect(() => {
    if (!open) return
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')
    const current = menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
    ;(current ?? items?.[0])?.focus()
  }, [open])

  function close(refocus = true) {
    setOpen(false)
    if (refocus) chipRef.current?.focus()
  }

  function onMenuKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    // Tab leaves the menu, so the menu goes: left open behind the focus, its
    // full-screen backdrop swallowed the next click (the ARIA menu pattern).
    if (e.key === 'Tab') {
      close(false)
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])
    if (!items.length) return
    e.preventDefault()
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      e.key === 'Home' ? 0
        : e.key === 'End' ? items.length - 1
          : e.key === 'ArrowDown' ? (at + 1) % items.length
            : (at - 1 + items.length) % items.length
    items[next].focus()
  }

  const label = active ? t(`composer.themes.${active.id}`) : t('composer.themeLabel')

  return (
    <span className="relative inline-flex items-center gap-0.5">
      <button
        ref={chipRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        // The chip's words are the type's name once one is chosen; the
        // accessible name keeps saying what the control IS as well.
        aria-label={active ? t('composer.themeActiveAria', { name: label }) : label}
        title={
          active
            ? ignored
              ? t('composer.themeIgnored')
              : t(`composer.themes.${active.id}.desc`)
            : t('composer.themeTitle')
        }
        className="flex transition hover:opacity-80 disabled:opacity-50"
      >
        <Chip tone={active && !ignored ? 'accent' : 'default'}>
          <span className="inline-flex items-center gap-1.5">
            <Icon name={active?.icon ?? 'grid'} size={14} />
            <span className={active && ignored ? 'line-through' : undefined}>{label}</span>
            <Icon name="chevronDown" size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </Chip>
      </button>
      {active && (
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          aria-label={t('composer.themeClear')}
          title={t('composer.themeClear')}
          className="tap-target tap-target-square inline-flex min-h-8 w-8 items-center justify-center text-ink-faint transition hover:text-ink disabled:opacity-50"
        >
          <Icon name="close" size={14} />
        </button>
      )}

      {open && (
        <>
          {/* A backdrop rather than an outside-click listener, like the
              toolbar's menus: a finger has no Escape key. */}
          <div className="fixed inset-0 z-menu" onClick={() => close(false)} />
          <div
            ref={menuRef}
            role="menu"
            aria-label={t('composer.themeMenu')}
            onKeyDown={onMenuKey}
            // Grows out of the chip, from the side it opened on (see `.menu-in`).
            style={{ transformOrigin: placement === 'up' ? 'bottom left' : 'top left' }}
            className={`menu-in absolute left-0 z-menu w-[34rem] max-w-[calc(100vw-2rem)] border border-line bg-raised p-1 ${
              placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
            }`}
          >
            <p className="kicker px-2 pb-1 pt-1.5">{t('composer.themeMenu')}</p>
            <p className="measure px-2 pb-2 text-body-sm text-ink-muted">{t('composer.themeHint')}</p>
            {/* Capped and scrolled: fifteen rows opened upwards from a bar at
                the bottom of a short window would leave the top of the list
                above the viewport, where no scroll can reach it. */}
            <div className="grid max-h-[min(60vh,26rem)] grid-cols-1 overflow-y-auto border-t border-line-soft pt-1 sm:grid-cols-2">
              {SCREEN_THEMES.map((th) => {
                const checked = th.id === value
                return (
                  <button
                    key={th.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={checked}
                    onClick={() => {
                      onChange(th.id)
                      close()
                    }}
                    className={`flex min-h-11 w-full items-start gap-2.5 px-2.5 py-2 text-left transition ${
                      // Inverted, not tinted — how every active menu row reads here.
                      checked ? 'bg-ink text-surface' : 'text-ink hover:bg-ink/5'
                    }`}
                  >
                    <Icon name={th.icon} size={16} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-body-sm font-medium">{t(`composer.themes.${th.id}`)}</span>
                      <span className={`block text-caption ${checked ? 'text-surface/80' : 'text-ink-faint'}`}>
                        {t(`composer.themes.${th.id}.desc`)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </span>
  )
}
