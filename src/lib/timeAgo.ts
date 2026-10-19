import { useT } from '../i18n'

/**
 * "just now", "3 min ago", "2 h ago"… then a date. The projects page and the
 * project's recent history say how old something is the same way.
 */
export function useTimeAgo() {
  const t = useT()
  return (ts: number): string => {
    const s = Math.floor((Date.now() - ts) / 1000)
    if (s < 60) return t('time.justNow')
    const m = Math.floor(s / 60)
    if (m < 60) return t('time.minutes', { n: m })
    const h = Math.floor(m / 60)
    if (h < 24) return t('time.hours', { n: h })
    const d = Math.floor(h / 24)
    if (d < 7) return t('time.days', { n: d })
    return new Date(ts).toLocaleDateString()
  }
}
