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
    'library.recut': 'Redécouper plus finement',
    'library.recutting': 'Redécoupage…',
    'library.recutHint':
      'Recalcule la séquence depuis le clip d’origine, conservé sur le serveur — sans appel au fournisseur.',
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

    // ---- replacing an image inside a screen ----
    'library.swapTitle': 'Images de « {name} »',
    'library.swapBlurb':
      'Les images utilisées par cet écran. Remplacer réécrit uniquement l’adresse de l’image dans le code — le reste de l’écran n’est pas retouché, et « Revenir en arrière » annule l’opération.',
    'library.swapNone': 'Cet écran n’utilise aucune image de la médiathèque.',
    'library.swapNoneHint':
      'Les écrans générés sans image utilisent des aplats et des SVG dessinés à la main. Pour en ajouter une, décrivez-la dans le composeur.',
    'library.swapUnparsed':
      'Le code de cet écran n’a pas pu être analysé, donc ses images sont introuvables. Corrigez l’erreur affichée sur l’écran, puis réessayez.',
    'library.swapUsedOnce': 'utilisée une fois',
    'library.swapUsedTimes': 'utilisée {n} fois',
    'library.swapAllOccurrences': 'Les {n} occurrences seront remplacées.',
    'library.swapNoAlt': 'sans texte alternatif',
    'library.swapReplace': 'Remplacer',
    'library.swapCancel': 'Garder celle-ci',
    'library.swapChoose': 'Choisir la nouvelle image',
    'library.swapSearch': 'Rechercher dans la médiathèque',
    'library.swapEmpty': 'Aucune image ne correspond.',
    'library.swapUpload': 'Importer un fichier',
    'library.swapGenerate': 'Générer',
    'library.swapGeneratePlaceholder': 'Décrivez l’image à générer…',
    'library.swapGenerating': 'Génération…',
    'library.swapGenerateSkipped':
      'Le fournisseur n’a produit aucune image. Réessayez, ou choisissez-en une dans la médiathèque.',
    'library.swapDone': 'Image remplacée.',
    'library.swapFailed': 'Le remplacement a échoué.',
    'library.swapSame': 'C’est déjà l’image utilisée.',
    'library.swapEverywhere': 'Partout ({n})',
    'library.swapEverywhereHint':
      'Remplace les {n} emplacements d’un coup — à choisir quand c’est une seule et même image affichée plusieurs fois.',
    'library.swapSlots': 'Ou un emplacement à la fois',
    'library.swapSlotsHint':
      'Muse ne produit qu’une image par écran, donc la même se retrouve à plusieurs endroits. Donnez-en une différente à chacun.',
    'library.swapSlot': 'Emplacement {n}',
    'library.swapSlotLine': 'ligne {n}',
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
    'library.recut': 'Re-cut it finer',
    'library.recutting': 'Re-cutting…',
    'library.recutHint':
      'Recomputes the sequence from the original clip, kept on the server — no provider call.',
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

    // ---- replacing an image inside a screen ----
    'library.swapTitle': 'Images in “{name}”',
    'library.swapBlurb':
      'The images this screen uses. Replacing rewrites only the image’s address in the code — nothing else about the screen is touched, and “Revert” undoes it.',
    'library.swapNone': 'This screen uses no images from the media library.',
    'library.swapNoneHint':
      'Screens generated without one use flat colour and hand-drawn SVG. To add an image, describe it in the composer.',
    'library.swapUnparsed':
      'This screen’s code could not be read, so its images cannot be found. Fix the error shown on the screen and try again.',
    'library.swapUsedOnce': 'used once',
    'library.swapUsedTimes': 'used {n} times',
    'library.swapAllOccurrences': 'All {n} occurrences will be replaced.',
    'library.swapNoAlt': 'no alt text',
    'library.swapReplace': 'Replace',
    'library.swapCancel': 'Keep this one',
    'library.swapChoose': 'Choose the new image',
    'library.swapSearch': 'Search the media library',
    'library.swapEmpty': 'No image matches.',
    'library.swapUpload': 'Upload a file',
    'library.swapGenerate': 'Generate',
    'library.swapGeneratePlaceholder': 'Describe the image to generate…',
    'library.swapGenerating': 'Generating…',
    'library.swapGenerateSkipped':
      'The provider produced no image. Try again, or pick one from the media library.',
    'library.swapDone': 'Image replaced.',
    'library.swapFailed': 'The replacement failed.',
    'library.swapSame': 'That is already the image in use.',
    'library.swapEverywhere': 'Everywhere ({n})',
    'library.swapEverywhereHint':
      'Replaces all {n} places at once — the right choice when it really is one picture shown several times.',
    'library.swapSlots': 'Or one place at a time',
    'library.swapSlotsHint':
      'Muse makes only one image per screen, so the same one lands in several places. Give each of them a different picture.',
    'library.swapSlot': 'Place {n}',
    'library.swapSlotLine': 'line {n}',
  } as Record<string, string>,
}
