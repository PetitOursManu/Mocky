/**
 * Which design direction governs one generation — and whether this generation
 * is the one that sets it.
 *
 * The bug this closes: Muse wrote a fresh Design Dossier on EVERY generation, so
 * a project ended up with as many visual languages as it had screens. Nobody
 * ever asked for a new direction; there was simply nowhere to keep the old one,
 * DESIGN.md being global — one document per browser, shared by every project —
 * rather than per-project.
 *
 * Now there is somewhere (`Project.design`), so the rule can be stated in one
 * sentence: an established direction holds until the user explicitly replaces
 * it. Deliberately a pure function over four strings — it is the only part of
 * this that can be tested, the rest being a React tree and a model call.
 */

export interface DirectionInput {
  /** The direction this project already works under (`Project.design`). */
  established?: string
  /** The dossier Muse wrote for THIS run, if Muse ran at all. */
  fresh?: string
  /** The global DESIGN.md, when switched on and non-empty. */
  global?: string
  /** The user ticked "cette génération redéfinit la direction". */
  redesign?: boolean
}

export interface Direction {
  /** What the model must obey. Undefined means "no design preamble at all". */
  markdown?: string
  /** Set when this run must become the project's direction from here on. */
  establish?: string
}

/** Blank is not a value: a whitespace-only direction is no direction. */
function clean(s?: string): string | undefined {
  return s && s.trim() ? s : undefined
}

export function resolveDirection(input: DirectionInput): Direction {
  const established = clean(input.established)
  const fresh = clean(input.fresh)
  const global = clean(input.global)

  // The established direction is what holds a project together, so it is set
  // aside only when the user says so. This is the branch that fixes the bug:
  // Muse may well have just written a dossier, and it is discarded as an
  // authority. Its imagery plan is still this screen's, which is the one part
  // of a dossier that was ever legitimately per-screen.
  if (established && !input.redesign) return { markdown: established }

  // Muse ran and there is nothing to protect — the project's first generation,
  // or a redesign the user asked for. Its dossier becomes the direction and is
  // KEPT, which is what stops the next screen from re-rolling one.
  if (fresh) return { markdown: fresh, establish: fresh }

  // No dossier to keep. DESIGN.md governs, exactly as it did before any of this
  // existed. Nothing is established: freezing a copy of a document the user
  // still edits globally would quietly stop their edits from reaching the
  // project that copied it.
  //
  // On a redesign run with Muse off this is usually `undefined` — the prompt
  // alone dictates the look, which is precisely what the toggle promises. The
  // caller then reads the direction back off the generated code, since there is
  // no dossier to read it from.
  return { markdown: global }
}
