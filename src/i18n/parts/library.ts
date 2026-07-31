/**
 * Translations for the "library" area.
 *
 * One file per area so several people (or agents) can add strings at once
 * without ever touching the same file. `parts/index.ts` merges them all.
 *
 * Rules:
 *  - the key set of `fr` and `en` must match exactly — a test enforces it;
 *  - keys are `library.something`, so an area can never collide with another;
 *  - placeholders are `{name}`.
 */
export const library = {
  fr: {
    // ---- standalone Images page ----
    'library.kicker': 'Bibliothèque',
    'library.generatedImages': 'Images générées',
    'library.pageBlurb':
      'Toutes les images créées par Muse, tous projets confondus. Supprimer un projet ne supprime jamais ses images.',
    'library.usedBy': 'Projets : {names}',

    // ---- counts ----
    'library.imageWord_one': 'image',
    'library.imageWord_other': 'images',
    'library.pinnedWord_one': 'épinglée',
    'library.pinnedWord_other': 'épinglées',

    // ---- empty & error states ----
    'library.noMatch': 'Aucune image ne correspond à ces filtres.',
    'library.emptyTitle': 'Aucune image pour l’instant.',
    'library.emptyHint': 'Générez un écran avec Muse pour remplir la bibliothèque.',
    'library.backendDown':
      'Impossible de joindre la bibliothèque. Le backend Mocky doit tourner (npm run dev:all ou Docker).',

    // ---- actions on an image ----
    'library.openFull': 'Ouvrir en grand',
    'library.download': 'Télécharger',
    'library.deleteConfirm': 'Supprimer définitivement cette image de la bibliothèque ?',
    'library.deleteSharedConfirm':
      'Cette image est utilisée par {count} projet(s). La supprimer la retire définitivement de la bibliothèque. Continuer ?',
    'library.pinned': 'Épinglée',
    'library.pinHint': 'Épingler pour la prochaine génération (marche entre projets)',
    'library.zipHint': 'Télécharger la sélection filtrée (ZIP + manifeste)',
    'library.closeEsc': 'Fermer (Échap)',
    'library.done': 'Terminé',

    // ---- lightbox ----
    'library.altGenerated': 'image générée',
    'library.promptLabel': 'Prompt',
    'library.escHint': 'Échap ou clic à l’extérieur pour fermer',
  } as Record<string, string>,
  en: {
    // ---- standalone Images page ----
    'library.kicker': 'Library',
    'library.generatedImages': 'Generated images',
    'library.pageBlurb':
      'Every image Muse has made, across all your projects. Deleting a project never deletes its images.',
    'library.usedBy': 'Projects: {names}',

    // ---- counts ----
    'library.imageWord_one': 'image',
    'library.imageWord_other': 'images',
    'library.pinnedWord_one': 'pinned',
    'library.pinnedWord_other': 'pinned',

    // ---- empty & error states ----
    'library.noMatch': 'No image matches these filters.',
    'library.emptyTitle': 'No images yet.',
    'library.emptyHint': 'Generate a screen with Muse to fill the library.',
    'library.backendDown':
      'Could not reach the library. The Mocky backend has to be running (npm run dev:all, or Docker).',

    // ---- actions on an image ----
    'library.openFull': 'Open full size',
    'library.download': 'Download',
    'library.deleteConfirm': 'Permanently delete this image from the library?',
    'library.deleteSharedConfirm':
      'This image is used by {count} project(s). Deleting it removes it from the library for good. Continue?',
    'library.pinned': 'Pinned',
    'library.pinHint': 'Pin it for the next generation (works across projects)',
    'library.zipHint': 'Download the filtered selection (ZIP + manifest)',
    'library.closeEsc': 'Close (Esc)',
    'library.done': 'Done',

    // ---- lightbox ----
    'library.altGenerated': 'generated image',
    'library.promptLabel': 'Prompt',
    'library.escHint': 'Press Esc, or click outside, to close',
  } as Record<string, string>,
}
