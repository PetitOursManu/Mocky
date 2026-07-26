// The `none` provider — Muse still runs with imagery disabled; slots get styled
// placeholders (built from the dossier palette) instead of generated images
// (prompt §4.1). Always "healthy" so it's the guaranteed final fallback.

export function createNone() {
  return {
    id: 'none',
    requiresKey: false,
    async healthy() {
      return true
    },
    async generate() {
      // Signals the caller to keep the placeholder rather than store a file.
      return { skipped: true, provider: 'none' }
    },
  }
}
