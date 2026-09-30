import { PRESETS } from '../lib/presets'
import { pageFormatChips } from '../lib/documentMode'
import { getPageFormat, type PageFormatId } from '../lib/pageFormats'
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
  disabled = false,
  pageFormat = null,
  onPageFormatChange,
}: {
  value: string
  onChange: (id: string) => void
  className?: string
  /**
   * While a prompt is being rewritten. The rewrite was asked for THIS form
   * factor; switching mid-stream left a phone brief under the Desktop chip.
   */
  disabled?: boolean
  /**
   * Set while a DOCUMENT type is active (`composerPageFormat`): the chips offer
   * page formats instead of the app presets. Same row, same chips, same place —
   * a second row of chips beside the first would ask "which of these two sizes
   * wins?", and the answer is that only one of them means anything for a page.
   */
  pageFormat?: PageFormatId | null
  onPageFormatChange?: (id: PageFormatId) => void
}) {
  const t = useT()
  const chip = (key: string, active: boolean, label: string, title: string, onClick: () => void) => (
    /*
     * The token is a <Chip>, and the <button> is only the control around it.
     * These chips wrote their own box — `kicker border px-2.5 py-1.5` — which
     * came to 30px tall, below the height floor every primitive in src/ui/
     * agrees on, so raising that floor did not reach them. A component that
     * restates a primitive's geometry is a component that silently opts out
     * of it.
     *
     * `flex` rather than the default inline-block: an inline-flex child in an
     * inline-block parent sits on a line box, and the strut's descender would
     * leave a few px of dead space under the chip that the focus ring would
     * then draw around.
     */
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className="flex transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
      title={title}
    >
      <Chip tone={active ? 'accent' : 'default'}>{label}</Chip>
    </button>
  )

  if (pageFormat) {
    return (
      <div role="group" aria-label={t('composer.pageFormatsAria')} className={`flex flex-wrap items-center gap-1.5 ${className}`}>
        {pageFormatChips(pageFormat).map((c) => {
          const f = getPageFormat(c.id)
          return chip(c.id, c.id === pageFormat, t(c.short), `${t(c.full)} · ${f.w}×${f.h}`, () => onPageFormatChange?.(c.id))
        })}
      </div>
    )
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {PRESETS.map((p) => {
        const keys = PRESET_KEYS[p.id]
        const short = keys ? t(keys.short) : p.label
        const full = keys ? t(keys.full) : p.label
        return chip(p.id, p.id === value, short, `${full} · ${p.w}×${p.h}`, () => onChange(p.id))
      })}
    </div>
  )
}
