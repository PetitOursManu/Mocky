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
    'app.signInHint': 'Connectez-vous pour retrouver vos projets sur tous vos appareils',
    'app.noProjectSelected': 'Aucun projet sélectionné.',
    'app.adminsOnly': 'Réservé aux administrateurs.',
  } as Record<string, string>,
  en: {
    'app.backToProject': 'Back to the project',
    'app.signInHint': 'Sign in to keep your projects on every device',
    'app.noProjectSelected': 'No project selected.',
    'app.adminsOnly': 'Admins only.',
  } as Record<string, string>,
}
