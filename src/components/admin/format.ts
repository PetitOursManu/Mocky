import { useMemo } from 'react'
import { splitBytes, type ByteUnit } from '../../lib/bytes'
import { useLang, useT } from '../../i18n'

const UNIT_KEY: Record<ByteUnit, string> = {
  b: 'admin.unitB',
  kb: 'admin.unitKB',
  mb: 'admin.unitMB',
  gb: 'admin.unitGB',
}

/**
 * The dashboard's numbers, in the interface language.
 *
 * One place, because the same figure appears in a tile, a chart axis, a tooltip
 * and a table row, and four hand-rolled roundings of one measurement is how a
 * tile says "1.2 GB" beside a tooltip saying "1 229 MB".
 */
export function useFmt() {
  const t = useT()
  const [lang] = useLang()
  return useMemo(() => {
    const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
    const num = (n: number, digits = 0) => n.toLocaleString(locale, { maximumFractionDigits: digits })
    const bytes = (n: number | null | undefined) => {
      if (n == null || !Number.isFinite(n)) return '—'
      const { value, unit } = splitBytes(n)
      return `${num(value, 1)} ${t(UNIT_KEY[unit])}`
    }
    const pct = (n: number | null | undefined, digits = 0) => (n == null || !Number.isFinite(n) ? '—' : `${num(n, digits)} %`)
    /** A duration a person reads: 850 ms · 4,2 s · 3 min 05 s · 2 h 10 min. */
    const duration = (ms: number | null | undefined) => {
      if (ms == null || !Number.isFinite(ms)) return '—'
      if (ms < 1000) return `${Math.round(ms)} ms`
      if (ms < 60_000) return `${num(ms / 1000, 1)} s`
      const s = Math.round(ms / 1000)
      if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`
      const m = Math.round(s / 60)
      if (m < 48 * 60) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
      return `${num(Math.floor(m / 1440))} j`
    }
    /** "il y a 3 min", reusing the words the projects list already uses. */
    const ago = (at: number | null | undefined, now = Date.now()) => {
      if (!at) return '—'
      const s = Math.max(0, Math.round((now - at) / 1000))
      if (s < 45) return t('time.justNow')
      const m = Math.round(s / 60)
      if (m < 60) return t('time.minutes', { n: m })
      const h = Math.round(m / 60)
      if (h < 48) return t('time.hours', { n: h })
      return t('time.days', { n: Math.round(h / 24) })
    }
    const clock = (at: number, seconds = false) =>
      new Date(at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: seconds ? '2-digit' : undefined })
    const date = (at: number) =>
      new Date(at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    return { num, bytes, pct, duration, ago, clock, date }
  }, [t, lang])
}

export type Fmt = ReturnType<typeof useFmt>
