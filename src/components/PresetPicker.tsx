import { PRESETS } from '../lib/presets'

/** A preset badge leads with a pictogram; the chip is set in words alone. */
const LEADING_GLYPH = /^\P{L}+/u

export default function PresetPicker({
  value,
  onChange,
  className = '',
}: {
  value: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {PRESETS.map((p) => {
        const active = p.id === value
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            aria-pressed={active}
            className={`kicker border px-2.5 py-1.5 transition ${
              active
                ? 'border-accent bg-ink text-surface'
                : 'border-line-soft text-ink-muted hover:border-line hover:text-accent-ink'
            }`}
            title={`${p.label} · ${p.w}×${p.h}`}
          >
            {p.badge.replace(LEADING_GLYPH, '')}
          </button>
        )
      })}
    </div>
  )
}
