import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from '../../ui'
import { useLang, useT } from '../../i18n'
import { searchSettings, type AdminSetting } from './settingsIndex'

/**
 * The search bar of the Admin page: every setting, whatever section holds it.
 *
 * A combobox in the ARIA sense — the input owns a listbox, the arrows move the
 * active option, Enter opens it, Escape clears — because a list of results a
 * keyboard cannot walk is a list half the people who live in Admin will not
 * use. "/" anywhere on the page (outside a field) puts the cursor in it.
 *
 * Choosing a result is the parent's business (`onPick`): it opens the section
 * and brings the block into view.
 */
export default function AdminSearch({ onPick, compact = false }: { onPick: (s: AdminSetting) => void; compact?: boolean }) {
  const t = useT()
  const [lang] = useLang()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const hits = useMemo(() => searchSettings(query, lang), [query, lang])

  useEffect(() => setActive(0), [query])

  // "/" from anywhere but a field, the convention of every search-first page.
  // Only the visible bar answers: there are two (the phone's and the column's).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      if (!inputRef.current || inputRef.current.offsetParent === null) return
      e.preventDefault()
      inputRef.current.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function pick(i: number) {
    const hit = hits[i]
    if (!hit) return
    onPick(hit.setting)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  const showList = open && query.trim() !== ''

  return (
    <div className={`relative ${compact ? '' : 'px-3 pb-3'}`}>
      <label className="sr-only" htmlFor={`${listId}-input`}>
        {t('dashboard.search.label')}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-raised px-2.5 focus-within:border-accent">
        <Icon name="search" size={15} className="shrink-0 text-ink-faint" />
        <input
          id={`${listId}-input`}
          ref={inputRef}
          type="search"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-expanded={showList}
          aria-controls={`${listId}-list`}
          aria-activedescendant={showList && hits[active] ? `${listId}-${hits[active].setting.id}` : undefined}
          placeholder={t('dashboard.search.placeholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.currentTarget.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          // After a click on an option has had its turn: mousedown on an option
          // prevents the blur, so this only closes on a click elsewhere.
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setActive((i) => (hits.length ? (i + 1) % hits.length : 0))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => (hits.length ? (i - 1 + hits.length) % hits.length : 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              pick(active)
            } else if (e.key === 'Escape') {
              if (query) setQuery('')
              else inputRef.current?.blur()
            }
          }}
          className="min-h-9 w-full min-w-0 bg-transparent py-1.5 text-body-sm text-ink outline-none placeholder:text-ink-faint"
        />
        {!compact && !query && (
          <kbd className="hidden shrink-0 rounded border border-line-soft px-1 font-mono text-caption text-ink-faint md:inline">/</kbd>
        )}
      </div>
      {showList && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          aria-label={t('dashboard.search.label')}
          className={`absolute z-30 mt-1 max-h-[60dvh] overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-2xl ${
            compact ? 'inset-x-0' : 'left-3 right-3 md:right-auto md:w-[22rem]'
          }`}
        >
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-body-sm text-ink-faint">{t('dashboard.search.none')}</li>
          ) : (
            hits.map((h, i) => (
              <li
                key={h.setting.id}
                id={`${listId}-${h.setting.id}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={`cursor-pointer px-3 py-2 ${i === active ? 'bg-ink/5' : ''}`}
              >
                <span className="block text-body-sm text-ink">{h.label}</span>
                <span className="block text-caption text-ink-muted">{h.sectionLabel}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
