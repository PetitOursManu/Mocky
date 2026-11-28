import { useEffect, useId, useState } from 'react'
import { useT } from '../i18n'

/**
 * The generation loader: the word "Mocky", written by hand, over and over.
 *
 * ── Written, not wiped ────────────────────────────────────────────────────────
 * Two earlier versions are why this one is generated. The first hand-drew
 * "Mocky" as one cursive stroke and came out reading "Mookn": authoring joined
 * letterforms blind, by typing bezier control points, does not work. The second
 * set real text in whatever script the system had (Segoe Script, Snell
 * Roundhand…) and swept a clip across it — legible, but a wipe, and a different
 * face on every machine.
 *
 * Now Tegaki (MIT) traces the letters of a real handwriting font, Parisienne,
 * stroke by stroke in a pen's order, and `scripts/build-loader-word.mjs` keeps
 * the result: a self-drawing SVG, paths and CSS keyframes, no font and no
 * script. It cannot be misspelled, it looks the same everywhere, and it follows
 * the theme through `currentColor`.
 *
 * ── Loaded beside the app, not in it ─────────────────────────────────────────
 * The two versions weigh about 150 KB of SVG, which the first screen of the app
 * has no use for. So they are a chunk of their own, asked for as soon as this
 * module is evaluated — long before anything is generated — and the box keeps
 * the word's proportions until it arrives, so nothing jumps.
 */

type Word = typeof import('./mockyLoaderWord')
let word: Word | null = null
const wordReady: Promise<Word> = import('./mockyLoaderWord').then((m) => (word = m))

/** The word's own box (its viewBox), so the space is held before it arrives. */
const ASPECT = '301.13 / 139.32'

/**
 * One SVG per loader, with names of its own.
 *
 * The SVG's keyframes, classes and mask ids all start with `tk-`, and inline SVG
 * shares the page's namespace: two loaders on one page — a screen generating
 * while the composer shows its own — would animate each other's strokes and
 * mask each other's letters. Renaming them per instance is what keeps them two.
 */
export function scopeTegakiSvg(svg: string, scope: string): string {
  return svg.replace(/\btk-/g, `tk-${scope}-`)
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function MockyLoader({
  size = 132,
  /**
   * The whole accessible name — the SVG is `aria-hidden`, so nothing else here
   * speaks. It defaulted to the literal `"Génération en cours…"`, French in an
   * English interface, which is the same defect Spinner and Panel carried.
   */
  label,
  className = '',
}: {
  /** Width in px. The height follows the word's proportions. */
  size?: number
  label?: string
  className?: string
}) {
  const t = useT()
  const scope = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [loaded, setLoaded] = useState<Word | null>(word)
  useEffect(() => {
    if (loaded) return
    let live = true
    void wordReady.then((m) => live && setLoaded(m))
    return () => {
      live = false
    }
  }, [loaded])

  // Read once per mount: under reduced motion the app collapses every animation
  // onto its last keyframe, and the last keyframe of the loop is the word faded
  // out — so that visitor gets the finished word instead.
  const [reduced] = useState(prefersReducedMotion)
  const svg = loaded ? scopeTegakiSvg(reduced ? loaded.MOCKY_WORD_STILL : loaded.MOCKY_WORD_LOOP, scope) : ''

  return (
    <span
      role="status"
      aria-label={label ?? t('common.generating')}
      className={`mocky-loader inline-block ${className}`}
      style={{ width: size }}
    >
      <span
        aria-hidden
        className="mocky-loader__word block"
        style={{ aspectRatio: ASPECT }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </span>
  )
}
