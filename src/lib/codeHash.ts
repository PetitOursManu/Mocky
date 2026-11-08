/**
 * Checksum of a screen's code. Deliberately not crypto: its only job is to
 * notice that the code changed since something was derived from it, so a stale
 * result is never shown. FNV-1a, with the length appended.
 */
export function hashCode(code: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i)
    // FNV prime (16777619) by shift-add, to stay inside 32 bits.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return (h >>> 0).toString(36) + '-' + code.length.toString(36)
}
