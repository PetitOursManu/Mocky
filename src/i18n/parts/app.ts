/**
 * Translations for the "app" area.
 *
 * One file per area so several people (or agents) can add strings at once
 * without ever touching the same file. `parts/index.ts` merges them all.
 *
 * Rules:
 *  - the key set of `fr` and `en` must match exactly — a test enforces it;
 *  - keys are `app.something`, so an area can never collide with another;
 *  - placeholders are `{name}`.
 */
export const app = {
  fr: {
    'app.backToProject': 'Revenir au projet',
    // Named `app.` and not `nav.` on purpose: an area file may only declare keys
    // under its own prefix, and the parity test fails the build on any that
    // stray. Its `nav.` neighbours live in the core dictionary, not here.
    'app.navMenu': 'Menu de navigation',
    'app.signInHint': 'Connectez-vous pour retrouver vos projets sur tous vos appareils',
    'app.noProjectSelected': 'Aucun projet sélectionné.',
    'app.adminsOnly': 'Réservé aux administrateurs.',
  } as Record<string, string>,
  en: {
    'app.backToProject': 'Back to the project',
    'app.navMenu': 'Navigation menu',
    'app.signInHint': 'Sign in to keep your projects on every device',
    'app.noProjectSelected': 'No project selected.',
    'app.adminsOnly': 'Admins only.',
  } as Record<string, string>,
}
