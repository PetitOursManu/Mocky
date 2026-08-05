import { PRESETS } from '../lib/presets'
import { Chip } from '../ui'
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
          /*
           * The token is a <Chip>, and the <button> is only the control around
           * it. These chips wrote their own box — `kicker border px-2.5 py-1.5`
           * — which came to 30px tall, below the height floor every primitive in
           * src/ui/ agrees on, so raising that floor did not reach them. A
           * component that restates a primitive's geometry is a component that
           * silently opts out of it.
           *
           * `flex` rather than the default inline-block: an inline-flex child in
           * an inline-block parent sits on a line box, and the strut's descender
           * would leave a few px of dead space under the chip that the focus
           * ring would then draw around.
           */
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            aria-pressed={active}
            className="flex transition hover:opacity-80"
            title={`${full} · ${p.w}×${p.h}`}
          >
            <Chip tone={active ? 'accent' : 'default'}>{short}</Chip>
          </button>
        )
      })}
    </div>
  )
}
