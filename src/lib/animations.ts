/**
 * Whether a generated screen is allowed to move.
 *
 * THREE STATES, NOT TWO
 *
 * Mocky already decides which capabilities a screen needs — a keyword shortlist
 * plus an optional planner pass — and that decision is usually right: a landing
 * page wants entrances, an admin table does not. A plain on/off switch would
 * throw that away and make the user answer the same question on every
 * generation.
 *
 * So the default is `auto`: the existing selection stands. The other two are
 * overrides for the times it guesses wrong — `on` when a screen the shortlist
 * read as static should still breathe, `off` when a demo has to hold still
 * (a screen recording, a slow machine, a client who hates motion).
 *
 * The choice is per-device and sticky, like the theme: it is a working
 * preference, not a property of the project.
 */

export type AnimationMode = 'auto' | 'on' | 'off'

const KEY = 'mocky.animations.v1'

export const ANIMATION_MODES: AnimationMode[] = ['auto', 'on', 'off']

export function loadAnimationMode(): AnimationMode {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'on' || v === 'off' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export function saveAnimationMode(mode: AnimationMode): void {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    /* A preference that cannot persist still applies for this session. */
  }
}

/** auto → on → off → auto. */
export function nextAnimationMode(mode: AnimationMode): AnimationMode {
  return mode === 'auto' ? 'on' : mode === 'on' ? 'off' : 'auto'
}

/** The capability ids the animation vocabulary needs. */
const ANIMATION_CAPS = ['animate', 'motion-lib']

/**
 * Apply the override to a capability shortlist.
 *
 * Pure, and deliberately the only place the three states turn into ids — the
 * generation path calls this once and stays unaware of the mode.
 *
 * `off` removes the library too: leaving `motion-lib` behind would load 129 kB
 * into a preview that has nothing to animate.
 */
export function applyAnimationMode(capIds: string[], mode: AnimationMode): string[] {
  if (mode === 'off') return capIds.filter((id) => !ANIMATION_CAPS.includes(id))
  if (mode === 'on') {
    const out = [...capIds]
    for (const id of ANIMATION_CAPS) if (!out.includes(id)) out.push(id)
    return out
  }
  return capIds
}
