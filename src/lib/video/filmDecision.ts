import type { AnimationMode } from '../animations'

/** What the Muse dossier decided about a film, as the server settled it. */
export interface DossierFilm {
  wanted: boolean
  kind?: string
  section?: string
  why?: string
}

/**
 * Whether the screen being generated gets a Motion film, and which.
 *
 * Decided by the composer's ANIMATION switch and by the request — there is no
 * Motion checkbox any more, because asking somebody who does not know what
 * Remotion is whether their page wants a rendered film is asking the wrong
 * person.
 *
 * - `off` ("sans animation"): no film, whatever the dossier would have said.
 * - `auto`: the Muse dossier's own answer, prudent by design
 *   (server/muse/inspire/film.js). Without Muse there is no call to ask, so no
 *   film: a render is too dear to spend on a guess.
 * - `on` ("forcées"): a film. The dossier picks the kind when Muse ran; without
 *   it, the first kind the account can render — `hero` when it is on offer.
 *
 * And never when Motion cannot run for this account: no question was asked, no
 * banner is shown, and the screen is the one it would have been anyway.
 */
export function decideFilm(opts: {
  mode: AnimationMode
  /** The ids `GET /api/video/status` offers this account; empty when Motion cannot run. */
  kinds: readonly string[]
  /** The dossier's answer when Muse ran and was asked; undefined otherwise. */
  dossier?: DossierFilm
}): { kind: string; section?: string; why?: string } | null {
  if (opts.mode === 'off' || opts.kinds.length === 0) return null
  const offered = (kind?: string) => (kind && opts.kinds.includes(kind) ? kind : undefined)
  if (opts.dossier) {
    const kind = offered(opts.dossier.kind)
    // The server already forced `wanted` under "on"; this only refuses a kind
    // the account cannot render, which a stale panel could still send back.
    if (opts.dossier.wanted && kind) {
      return {
        kind,
        ...(opts.dossier.section ? { section: opts.dossier.section } : {}),
        // The dossier's one sentence about why a film belongs here: the composer
        // reads it as WHERE the film goes, which is what bounds what it says.
        ...(opts.dossier.why ? { why: opts.dossier.why } : {}),
      }
    }
    if (opts.mode !== 'on') return null
  }
  if (opts.mode !== 'on') return null
  return { kind: offered('hero') ?? opts.kinds[0] }
}

/**
 * What the dossier call is asked, or nothing.
 *
 * Nothing under "sans animation" and nothing when Motion cannot run — the
 * dossier is then written exactly as it was before films existed.
 */
export function dossierMotionRequest(
  mode: AnimationMode,
  kinds: readonly string[],
): { mode: 'auto' | 'force'; kinds: string[] } | null {
  if (mode === 'off' || kinds.length === 0) return null
  return { mode: mode === 'on' ? 'force' : 'auto', kinds: [...kinds] }
}
