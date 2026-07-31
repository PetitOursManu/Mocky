import { useId } from 'react'

/**
 * The generation loader: the word "Mocky", written out, over and over.
 *
 * ── Why this is real text and not a drawn path ───────────────────────────────
 * The first attempt hand-drew "Mocky" as one cursive stroke and animated it the
 * way the supplied Lottie does. It came out reading "Mookn": authoring joined
 * letterforms blind, by typing bezier control points, does not work — the
 * geometry was sound (right length, right direction, inside the box) and the
 * word was still wrong.
 *
 * So the letters are a `<text>` element set in the masthead's serif. It cannot
 * be misspelled, it matches the wordmark elsewhere in the app, and it follows
 * the theme through `currentColor`. The writing effect comes from a clip that
 * sweeps left to right — the same idea as the Lottie's Trim Path, applied to
 * real glyphs instead of a drawing of them.
 *
 * ── Why not the Lottie file itself ───────────────────────────────────────────
 *  1. It spells someone else's name — its layers are "Gosia Signature", and the
 *     paths are that signature's letterforms.
 *  2. Playing it needs lottie-web, ~250 KB of runtime. The preview pipeline was
 *     just cleaned of every CDN script and pinned to vendored bundles so it
 *     works offline under a strict CSP; adding a player would undo that.
 */
export function MockyLoader({
  size = 132,
  label = 'Génération en cours…',
  className = '',
}: {
  /** Width in px. The height follows the 200×62 viewBox. */
  size?: number
  label?: string
  className?: string
}) {
  // Two instances on one page would otherwise share a clip path id.
  const clipId = `mocky-write-${useId().replace(/:/g, '')}`

  return (
    <span
      role="status"
      aria-label={label}
      className={`mocky-loader inline-block ${className}`}
      style={{ width: size }}
    >
      <svg viewBox="0 -6 200 82" width="100%" aria-hidden focusable="false">
        <defs>
          <clipPath id={clipId}>
            {/* Swept by CSS: scaleX 0 → 1 from the left edge. */}
            <rect className="mocky-loader__wipe" x="0" y="-6" width="200" height="82" />
          </clipPath>
        </defs>
        <text
          x="2"
          y="46"
          clipPath={`url(#${clipId})`}
          className="mocky-loader__word"
          fill="currentColor"
        >
          Mocky
        </text>
      </svg>
    </span>
  )
}
