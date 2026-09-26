/**
 * Page animations are always offered.
 *
 * There used to be a three-state switch in the composer — auto, forced, none —
 * and it did two unrelated things under one name: it decided whether a screen
 * got the animation vocabulary, and whether a Motion FILM was rendered for it
 * ("forced" meant a text call and minutes of the worker on every screen). Both
 * halves are settled now:
 *
 * - the vocabulary (`<Animated>`, `<Ticker>`, `<CountUp>`) is always in scope.
 *   It costs nothing, a screen that does not need motion simply does not use it,
 *   and prefers-reduced-motion is honoured by the components themselves;
 * - a film is made only when asked for — Motion Ultra's video background, or
 *   the Motion panel — never on its own.
 *
 * Holding ONE screen still, for a demo or a recording, is that screen's own
 * setting (`Screen.animations === false`, in its menu).
 */

/** The capability ids the animation vocabulary needs. */
const ANIMATION_CAPS = ['animate', 'motion-lib']

/** A capability shortlist with the animation vocabulary in it. Pure. */
export function withAnimations(capIds: string[]): string[] {
  const out = [...capIds]
  for (const id of ANIMATION_CAPS) if (!out.includes(id)) out.push(id)
  return out
}
