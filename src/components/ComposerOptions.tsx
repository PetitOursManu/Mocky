import { haptic } from '../lib/touch'
import type { ReactNode } from 'react'
import { Icon, type IconName } from '../ui'

/** A switch felt in the hand on a phone, then the switch itself. */
const tapped = (fn: () => void) => () => {
  haptic()
  fn()
}

/**
 * The composer's options, as labelled groups of rows.
 *
 * They were chips — one small box per option, a hairline between "groups" —
 * and the line breaks of a 300px column decided where a group ended, so nothing
 * said which options belonged together, and an option's state was a colour on
 * a word. A row says three things at once: what the option is, what it does,
 * and whether it is on (the switch). The groups have names.
 */
export function OptionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <p className="kicker mb-1.5 px-1">{label}</p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </section>
  )
}

/** The look every row shares, for the controls that draw their own content. */
export const OPTION_ROW =
  'tap-target flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-50'

/** An on/off option: icon, name, one line of what it does, and a switch. */
export function OptionToggle({
  icon,
  label,
  hint,
  on,
  onClick,
  title,
  disabled,
  sweep = false,
}: {
  icon: IconName
  label: string
  hint?: string
  on: boolean
  onClick: () => void
  title?: string
  disabled?: boolean
  /** Muse's hint: the name washes in the accent while it is off (`.muse-sweep`). */
  sweep?: boolean
}) {
  return (
    <button type="button" onClick={tapped(onClick)} title={title} disabled={disabled} aria-pressed={on} className={OPTION_ROW}>
      <Icon name={icon} size={16} className={`shrink-0 ${on ? 'text-accent-ink' : sweep ? 'muse-sweep-icon' : 'text-ink-faint'}`} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-body-sm font-medium ${on ? 'text-ink' : 'text-ink-muted'}`}>
          <span className={sweep && !on ? 'muse-sweep' : undefined}>{label}</span>
        </span>
        {hint && <span className="block truncate text-caption text-ink-faint">{hint}</span>}
      </span>
      <Switch on={on} />
    </button>
  )
}

/** An option that opens something rather than toggling: a state word and a chevron. */
export function OptionAction({
  icon,
  label,
  hint,
  status,
  lit = false,
  onClick,
  title,
}: {
  icon: IconName
  label: string
  hint?: string
  /** What the row's state is, in a word ("on", "2 attached"). */
  status?: string
  lit?: boolean
  onClick: () => void
  title?: string
}) {
  return (
    <button type="button" onClick={onClick} title={title} className={OPTION_ROW}>
      <Icon name={icon} size={16} className={`shrink-0 ${lit ? 'text-accent-ink' : 'text-ink-faint'}`} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-body-sm font-medium ${lit ? 'text-ink' : 'text-ink-muted'}`}>{label}</span>
        {hint && <span className="block truncate text-caption text-ink-faint">{hint}</span>}
      </span>
      {status && <span className={`shrink-0 text-caption ${lit ? 'text-accent-ink' : 'text-ink-faint'}`}>{status}</span>}
      <Icon name="chevronRight" size={14} className="shrink-0 text-ink-faint" />
    </button>
  )
}

/** The switch itself: drawn, not a native checkbox — the row is the control. */
export function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition ${on ? 'bg-accent' : 'bg-ink/20'}`}
    >
      <span
        className={`absolute left-0.5 h-3 w-3 rounded-full transition-transform ${
          on ? 'translate-x-3 bg-on-accent' : 'translate-x-0 bg-ink-muted'
        }`}
      />
    </span>
  )
}

/**
 * The first composer's options, as TILES: equal boxes in one wrapping row, each
 * with its icon and its switch on top, its name, and what it does in full.
 *
 * Rows in three columns were tried there first and read badly: a 200px column
 * cut every explanation to "Inspiration, direction, v…", the columns ended at
 * three different heights, and a group of one option was mostly empty. A tile
 * has room for the whole sentence, and a grid of equal tiles has no ragged edge.
 */
export const OPTION_TILE =
  'flex min-h-[6.5rem] w-full min-w-0 flex-col gap-1.5 rounded-xl border p-3 text-left transition'

const tileLook = (on: boolean) =>
  on ? 'border-accent/40 bg-accent/5 hover:border-accent/60' : 'border-line bg-raised/40 hover:border-ink/25 hover:bg-ink/5'

/** An on/off tile: icon and switch, name, and the whole sentence of what it does. */
export function OptionTile({
  icon,
  label,
  hint,
  on,
  onClick,
  title,
  sweep = false,
  children,
}: {
  icon: IconName
  label: string
  hint: string
  on: boolean
  onClick: () => void
  title?: string
  sweep?: boolean
  /**
   * Settings shown once the option is on (Motion Ultra's), IN PLACE of the
   * sentence: appended under it they made the tile taller, and a taller tile
   * could give the page a scrollbar that narrowed the whole composer.
   */
  children?: ReactNode
}) {
  return (
    <div className={`${OPTION_TILE} ${tileLook(on)}`}>
      <button type="button" onClick={tapped(onClick)} title={title} aria-pressed={on} className="flex min-w-0 flex-1 flex-col gap-1.5 text-left">
        <span className="flex w-full items-center justify-between">
          <Icon name={icon} size={18} className={on ? 'text-accent-ink' : sweep ? 'muse-sweep-icon' : 'text-ink-faint'} />
          <Switch on={on} />
        </span>
        <span className={`text-body-sm font-semibold ${on ? 'text-ink' : 'text-ink-muted'}`}>
          <span className={sweep && !on ? 'muse-sweep' : undefined}>{label}</span>
        </span>
        {!children && <span className="text-caption leading-snug text-ink-faint">{hint}</span>}
      </button>
      {children}
    </div>
  )
}

/**
 * A tile whose control is a choice of several values (where pictures come
 * from): the same head as every other tile — icon, name, sentence — and the
 * choice at its foot. It held the control alone at first, with the tile's
 * remaining height empty under it.
 */
export function OptionTileChoice({
  icon,
  label,
  hint,
  lit = false,
  children,
}: {
  icon: IconName
  label: string
  hint: string
  lit?: boolean
  children: ReactNode
}) {
  return (
    <div className={`${OPTION_TILE} ${lit ? 'border-accent/40 bg-accent/5' : 'border-line bg-raised/40'}`}>
      <Icon name={icon} size={18} className={lit ? 'text-accent-ink' : 'text-ink-faint'} />
      <span className={`text-body-sm font-semibold ${lit ? 'text-ink' : 'text-ink-muted'}`}>{label}</span>
      <span className="text-caption leading-snug text-ink-faint">{hint}</span>
      <div className="mt-auto pt-1">{children}</div>
    </div>
  )
}

/** A tile that opens something: icon and a state word on top, name, sentence. */
export function OptionTileAction({
  icon,
  label,
  hint,
  status,
  lit = false,
  onClick,
  title,
}: {
  icon: IconName
  label: string
  hint: string
  status?: string
  lit?: boolean
  onClick: () => void
  title?: string
}) {
  return (
    <button type="button" onClick={onClick} title={title} className={`${OPTION_TILE} ${tileLook(lit)}`}>
      <span className="flex w-full items-center justify-between">
        <Icon name={icon} size={18} className={lit ? 'text-accent-ink' : 'text-ink-faint'} />
        <span className={`flex items-center gap-1 text-caption ${lit ? 'text-accent-ink' : 'text-ink-faint'}`}>
          {status}
          <Icon name="chevronRight" size={13} />
        </span>
      </span>
      <span className={`text-body-sm font-semibold ${lit ? 'text-ink' : 'text-ink-muted'}`}>{label}</span>
      <span className="text-caption leading-snug text-ink-faint">{hint}</span>
    </button>
  )
}
