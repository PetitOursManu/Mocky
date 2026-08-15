/**
 * Work that would be lost by navigating away, and the one place that knows.
 *
 * ── Why a module and not a prop ───────────────────────────────────────────
 *
 * The work is started deep inside `ProjectView` (a Motion film: a model call,
 * then a render, then an edit pass that writes it into the screen). The exits
 * are everywhere else: the masthead logo, five header tabs, the folded mobile
 * menu, and the project's own Back button — nine `setRoute` calls in `App`, in
 * a component that knows nothing about films.
 *
 * Threading a callback from ProjectView up to App and back down to nine call
 * sites would put the same `if` in nine places, and the tenth navigation added
 * next month would silently not have it. A module-level flag is the smaller
 * lie: one setter, one reader, and a `navigate()` in App that every route
 * change already has to go through.
 *
 * The precedent is `lib/project.ts`, which keeps its debounce and its
 * `beforeunload` hook at module scope for the same reason — the thing being
 * guarded outlives any one component's render.
 *
 * ── Why a KEY and not a boolean ───────────────────────────────────────────
 *
 * The question a user is asked has to say what they are about to lose, and
 * that differs per job. Holding the translation key rather than the sentence
 * keeps this file free of language and lets the dialog follow a switch.
 *
 * ── What it does NOT do ───────────────────────────────────────────────────
 *
 * It does not block. Every caller may proceed after asking; this only ensures
 * the question is asked. A guard that refused would strand somebody whose
 * render is wedged, which is worse than the loss it prevents.
 */
let holdKey: string | null = null

/**
 * Claim the hold. Idempotent, and the last claim wins — two jobs at once is not
 * a case this app has, and if it ever does, the newest reason is the one the
 * user is looking at.
 */
export function holdNavigation(reasonKey: string): void {
  holdKey = reasonKey
}

/**
 * Release it.
 *
 * MUST run on every exit of the work, including failure, abort and unmount —
 * a hold left behind asks the user to confirm leaving a page where nothing is
 * happening, for as long as the tab stays open, which is the failure mode that
 * makes people stop reading dialogs.
 */
export function releaseNavigation(): void {
  holdKey = null
}

/** The reason, or null when nothing is in flight. */
export function navigationHold(): string | null {
  return holdKey
}
