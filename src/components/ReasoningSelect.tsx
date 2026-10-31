import { useT } from '../i18n'
import { REASONING_LEVELS, type ReasoningLevel } from '../lib/reasoning'

/**
 * The level of thinking for one model — Admin's profiles and a person's own key
 * share it, so both say the same five words and the same caveat.
 */
export default function ReasoningSelect({
  value,
  onChange,
}: {
  value: ReasoningLevel
  onChange: (level: ReasoningLevel) => void
}) {
  const t = useT()
  return (
    <label className="block">
      <span className="mb-1 block text-body-sm font-medium text-ink">{t('settings.reasoning')}</span>
      <select className="input w-full" value={value} onChange={(e) => onChange(e.target.value as ReasoningLevel)}>
        {REASONING_LEVELS.map((l) => (
          <option key={l} value={l}>
            {t(`settings.reasoning.${l}`)}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-caption text-ink-faint">{t('settings.reasoningHint')}</span>
    </label>
  )
}
