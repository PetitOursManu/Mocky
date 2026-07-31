/**
 * Translations for the "preview" area.
 *
 * One file per area so several people (or agents) can add strings at once
 * without ever touching the same file. `parts/index.ts` merges them all.
 *
 * Rules:
 *  - the key set of `fr` and `en` must match exactly — a test enforces it;
 *  - keys are `preview.something`, so an area can never collide with another;
 *  - placeholders are `{name}`.
 */
export const preview = {
  fr: {
    'preview.frameTitle': 'Aperçu de l’écran',
    'preview.timedOut': 'L’aperçu n’a pas répondu — le composant a mis trop de temps à s’afficher.',
    'preview.runtimeError': 'Erreur d’exécution dans le composant généré',
    'preview.linksInert': 'Les liens ne naviguent pas dans une maquette.',
  } as Record<string, string>,
  en: {
    'preview.frameTitle': 'Screen preview',
    'preview.timedOut': 'The preview timed out — the component took too long to render.',
    'preview.runtimeError': 'Runtime error in the generated component',
    'preview.linksInert': 'Links don’t navigate inside a mockup.',
  } as Record<string, string>,
}
