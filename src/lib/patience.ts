/**
 * How many times longer than usual the browser's own stages wait for the model
 * that serves this account — the planner, the Motion Ultra storyboard, the
 * photo judge. Chosen per text profile in Admin (server/text/config.js,
 * PATIENCE_FACTORS): a free model writes a few dozen tokens a second, and every
 * one of those deadlines was set against a paid one, so each stage gave up and
 * fell back before the answer came.
 *
 * Read off `/api/config` (`textProvider.patience`), which the app already polls
 * (MaintenanceBanner). 1 until it is known, and on a person's own key.
 */
let factor = 1

export function setModelPatience(v: unknown): void {
  const n = Number(v)
  factor = Number.isFinite(n) && n >= 1 && n <= 10 ? n : 1
}

/** `ms`, stretched for the model that answers. */
export function patient(ms: number): number {
  return ms * factor
}
