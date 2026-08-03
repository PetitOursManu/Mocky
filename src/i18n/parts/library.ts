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

    // ---- média : onglets, import, vidéos ----
    'library.mediaTitle': 'Média',
    'library.tabImages': 'Images',
    'library.tabVideos': 'Vidéos',
    'library.videoWord_one': 'vidéo',
    'library.videoWord_other': 'vidéos',
    'library.upload': 'Importer',
    'library.uploading': 'Import…',
    'library.uploadHint':
      'Ajoutez vos propres images et vidéos. Elles rejoignent la bibliothèque et Muse peut s’en servir dans vos écrans.',
    'library.uploadBadType': '« {name} » : format non pris en charge ({type}).',
    'library.noVideos': 'Aucune séquence pour l’instant.',
    'library.noVideosHint':
      'Importez un clip, ou cochez « Vidéo au défilement » dans Muse pour en faire générer une.',
    'library.frames': '{count} images',
    // ---- lecture d'une séquence ----
    'library.playVideo': 'Lire la séquence',
    'library.playTitle': 'Lecture',
    'library.playOf': 'Séquence : {prompt}',
    'library.untitledClip': 'sans description',
    'library.play': 'Lire',
    'library.pause': 'Pause',
    'library.scrub': 'Se déplacer dans la séquence',
    'library.buffering': '{loaded} / {total} images chargées',
    'library.playFailed': 'Aucune image de cette séquence n’a pu être chargée.',
    'library.downloadPoster': 'Télécharger l’aperçu',
    'library.deleteVideo': 'Supprimer la séquence',
    'library.deleteVideoConfirm':
      'Supprimer définitivement cette séquence et toutes ses images ?',
    'library.useVideo': 'Utiliser',
    'library.videoChosen': 'Choisie',
    'library.useVideoHint':
      'Utiliser cette séquence pour le prochain écran, au lieu d’en générer une nouvelle',
    'library.selectionTitle': 'Sélection pour la prochaine génération',
    'library.selectedImage_one': 'image épinglée',
    'library.selectedImage_other': 'images épinglées',
    'library.selectedVideo': 'séquence : {name}',
    'library.selectedClear': 'retirer',

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

    // ---- media: tabs, uploads, videos ----
    'library.mediaTitle': 'Media',
    'library.tabImages': 'Images',
    'library.tabVideos': 'Videos',
    'library.videoWord_one': 'video',
    'library.videoWord_other': 'videos',
    'library.upload': 'Import',
    'library.uploading': 'Importing…',
    'library.uploadHint':
      'Add your own images and videos. They join the library and Muse can use them in your screens.',
    'library.uploadBadType': '“{name}”: unsupported format ({type}).',
    'library.noVideos': 'No sequences yet.',
    'library.noVideosHint': 'Import a clip, or tick “Scroll-driven video” in Muse to have one generated.',
    'library.frames': '{count} frames',
    // ---- playing a sequence ----
    'library.playVideo': 'Play the sequence',
    'library.playTitle': 'Playback',
    'library.playOf': 'Sequence: {prompt}',
    'library.untitledClip': 'no description',
    'library.play': 'Play',
    'library.pause': 'Pause',
    'library.scrub': 'Move through the sequence',
    'library.buffering': '{loaded} / {total} frames loaded',
    'library.playFailed': 'None of this sequence’s frames could be loaded.',
    'library.downloadPoster': 'Download the poster',
    'library.deleteVideo': 'Delete sequence',
    'library.deleteVideoConfirm': 'Permanently delete this sequence and all its frames?',
    'library.useVideo': 'Use',
    'library.videoChosen': 'Chosen',
    'library.useVideoHint': 'Use this sequence for the next screen, instead of generating a new one',
    'library.selectionTitle': 'Selected for the next generation',
    'library.selectedImage_one': 'pinned image',
    'library.selectedImage_other': 'pinned images',
    'library.selectedVideo': 'sequence: {name}',
    'library.selectedClear': 'remove',

    // ---- lightbox ----
    'library.altGenerated': 'generated image',
    'library.promptLabel': 'Prompt',
    'library.escHint': 'Press Esc, or click outside, to close',
  } as Record<string, string>,
}
