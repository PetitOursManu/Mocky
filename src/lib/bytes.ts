/**
 * Byte sizes, split into a number and a unit the caller names.
 *
 * It returns the pair rather than a formatted string because the unit is a
 * translated word — "Mo" in French, "MB" in English — and a lib module that
 * reached into the dictionary would have to know which language is on, which
 * is a component's business and not arithmetic's.
 *
 * The thresholds deliberately match `formatBytes` in server/storage-quota.js.
 * The server prints the same numbers in the "this instance is full" message,
 * and an admin comparing that message against the usage table should not find
 * two different roundings of one measurement.
 */

export type ByteUnit = 'b' | 'kb' | 'mb' | 'gb'

const KB = 1024
const MB = 1024 * 1024
const GB = 1024 * 1024 * 1024

export function splitBytes(n: number): { value: number; unit: ByteUnit } {
  const b = Math.max(0, Number(n) || 0)
  // Gigabytes keep a decimal because the ceiling is set in them: "0 GB of 10
  // GB" is what a whole-number GB does to every real instance.
  if (b >= GB) return { value: Math.round((b / GB) * 10) / 10, unit: 'gb' }
  if (b >= MB) return { value: Math.round(b / MB), unit: 'mb' }
  if (b >= KB) return { value: Math.round(b / KB), unit: 'kb' }
  return { value: b, unit: 'b' }
}

/**
 * A share of a total, 0–100, or null when the total cannot answer.
 *
 * Null rather than 0 for an unlimited or empty instance: a zero bar reads as
 * "uses nothing", which is a different claim from "there is no ceiling to
 * measure against".
 */
export function shareOf(part: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0) return null
  return Math.min(100, Math.max(0, (Math.max(0, part) / total) * 100))
}
