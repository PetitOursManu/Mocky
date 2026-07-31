import { PRESETS } from '../lib/presets'
import { useT } from '../i18n'

/**
 * Preset ids map to dictionary keys, not to labels: the chip is set in words
 * alone (short), the tooltip spells the form factor out (full).
 */
const PRESET_KEYS: Record<string, { short: string; full: string }> = {
  mobile: { short: 'muse.presetMobile', full: 'muse.presetMobileFull' },
  desktop: { short: 'muse.presetDesktop', full: 'muse.presetDesktopFull' },
  tablet: { short: 'muse.presetTablet', full: 'muse.presetTabletFull' },
}

export default function PresetPicker({
  value,
  onChange,
  className = '',
}: {
  value: string
  onChange: (id: string) => void
  className?: string
}) {
  const t = useT()
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {PRESETS.map((p) => {
        const active = p.id === value
        const keys = PRESET_KEYS[p.id]
        const short = keys ? t(keys.short) : p.label
        const full = keys ? t(keys.full) : p.label
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
            title={`${full} · ${p.w}×${p.h}`}
          >
            {short}
          </button>
        )
      })}
    </div>
  )
}
