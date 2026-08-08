// The `none` provider — Muse still runs with imagery disabled; slots get styled
// placeholders (built from the dossier palette) instead of generated images
// (prompt §4.1). Always "healthy" so it's the guaranteed final fallback.

export function createNone() {
  return {
    id: 'none',
    requiresKey: false,
    /**
     * False, and yet the one provider that does NOT throw on an input image.
     *
     * The refusal rule exists because a text-to-image provider handed a source
     * image would return a picture made from the prompt alone, indistinguishable
     * from a real derivative. `none` returns no picture at all: `skipped` is
     * already the honest report, and there is nothing for the user to mistake
     * for an edit of their image. Making it throw would only turn "imagery is
     * off on this instance" into an error, which M3 spends a whole invariant
     * avoiding.
     */
    supportsInit: false,
    async healthy() {
      return true
    },
    async generate() {
      // Signals the caller to keep the placeholder rather than store a file.
      return { skipped: true, provider: 'none' }
    },
  }
}
