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
    // ---- montages exportés ----
    // Un troisième onglet, et pas une ligne dans « Vidéos » : une séquence de
    // défilement se scrube image par image, un montage se lit. Le vocabulaire
    // suit — « séquence » pour l'une, « montage » pour l'autre — parce
    // qu'appeler les deux « vidéo » est exactement ce qui rendait l'export
    // introuvable.
    //
    // L'onglet porte le nom de la fonctionnalité, « Motion », et pas celui de
    // l'objet : c'est là que le panneau Motion dit d'aller chercher son résultat,
    // et l'onglet s'appelait « Films » pendant que tout le reste disait Motion.
    // L'objet, lui, garde le mot que le panneau emploie déjà pour lui —
    // « Monter », « Proposer un montage », « Nouveau montage » — parce qu'un
    // troisième mot pour la même chose est ce qu'on vient de retirer.
    'library.tabFilms': 'Motion',
    'library.filmWord_one': 'montage',
    'library.filmWord_other': 'montages',
    'library.noFilms': 'Aucun montage exporté pour l’instant.',
    'library.noFilmsHint':
      'Montez-en un depuis le panneau Motion d’un projet : il se retrouvera ici, rattaché à ce projet.',
    // Deux formes, comme « vidéo »/« vidéos » juste au-dessus : le dictionnaire
    // n'a pas de moteur de pluriel, il ne fait que substituer `{nom}`. Un
    // montage d'une seule scène est légal (le schéma accepte `min(1)`), donc
    // « 1 scènes » était atteignable.
    'library.filmScenes_one': '{count} scène',
    'library.filmScenes_other': '{count} scènes',
    'library.playFilm': 'Lire le montage',
    // La visionneuse s'ouvre depuis la médiathèque, qui vient de lister le
    // fichier, MAIS aussi depuis la carte du canevas, qui n'ouvre qu'un hash :
    // le hash survit au fichier, et un export supprimé répond 403 puisque la
    // route vérifie la propriété avant l'existence. Sans ces deux phrases, le
    // clic donnait un rectangle noir avec une barre de lecture et rien d'autre.
    'library.filmGone': 'Ce montage ne se lit plus.',
    'library.filmGoneHint':
      'Le fichier a été supprimé du serveur, ou il appartient à un autre compte. Rien n’a été retiré de l’écran : détachez-le depuis « Changer les médias… ».',
    'library.deleteFilm': 'Supprimer le montage',
    'library.deleteFilmConfirm':
      'Supprimer définitivement ce montage ? Le fichier est effacé du serveur ; les images qui l’ont composé restent dans la médiathèque.',
    'library.deleteFilmSharedConfirm':
      'Ce montage est rattaché à {count} projets. Le supprimer l’efface pour tous. Continuer ?',

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
    // Le titre dit « Médias », comme l'entrée de menu qui l'ouvre
    // (`project.changeImages`). Les phrases en dessous continuent de parler
    // d'images parce qu'elles décrivent ce que la modale sait faire — remplacer
    // une <img> à une adresse que l'AST a validée — et pas ce qu'elle s'appelle.
    'library.swapTitle': 'Médias de « {name} »',
    'library.swapBlurb':
      'Les images et les séquences de défilement utilisées par cet écran. Remplacer réécrit uniquement leur adresse dans le code — le reste de l’écran n’est pas retouché, et « Revenir en arrière » annule l’opération.',
    'library.swapNone': 'Cet écran n’utilise aucun média de la médiathèque.',
    'library.swapNoneHint':
      'Les écrans générés sans image utilisent des aplats et des SVG dessinés à la main. Pour en ajouter une, décrivez-la dans le composeur.',
    'library.swapUnparsed':
      'Le code de cet écran n’a pas pu être analysé, donc ses médias sont introuvables. Corrigez l’erreur affichée sur l’écran, puis réessayez.',
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

    // ---- séquences de défilement présentes dans le code ----
    // Une séquence n'est pas une image : elle est désignée par un COUPLE,
    // l'adresse et le nombre d'images. Les deux textes ci-dessous le disent,
    // parce que c'est ce qui explique pourquoi le remplacement impose une
    // séquence entière de la médiathèque et non un fichier quelconque.
    'library.swapSequences': 'Séquences de défilement dans le code',
    'library.swapSequencesHint':
      'Une séquence est désignée par un couple : son adresse et son nombre d’images. Le remplacement réécrit les deux ensemble — l’un sans l’autre laisse un défilement figé sur la dernière image.',
    'library.swapSeqBadge': 'Séquence',
    'library.swapSeqLabel': 'Séquence de défilement',
    // Découpée comme `filmScenes` : le compte est affiché sur chaque ligne et sur
    // chaque vignette du sélecteur, et une séquence d'une seule image est un cas
    // réel — `replaceScreenSequence` accepte 1, et un clip très court n'en donne
    // pas plus. « 1 images » sur toute une grille.
    'library.swapSeqFrames_one': '{n} image',
    'library.swapSeqFrames_other': '{n} images',
    'library.swapSeqChoose': 'Choisir la nouvelle séquence',
    'library.swapSeqEmpty':
      'Aucune séquence dans la médiathèque. Importez un clip ou générez-en une depuis Médias.',
    'library.swapSeqListFailed':
      'Impossible de lister les séquences de la médiathèque. Les images ci-dessus restent remplaçables.',
    'library.swapSeqDone': 'Séquence remplacée : adresse et nombre d’images réécrits ensemble.',
    'library.swapSeqSame': 'C’est déjà la séquence utilisée.',
    // Un montage ne peut pas entrer dans le code : le composant généré n'a pas
    // de balise vidéo, et lui en injecter une serait une génération, pas une
    // substitution. La seule voie honnête est de le redemander au composeur.
    'library.swapNoFilmInCode':
      'Un montage ne peut pas être placé dans le code : le composant généré n’a pas de balise vidéo, et lui en ajouter une serait une régénération. Pour un montage en héros, régénérez l’écran en le demandant dans le composeur — sinon, attachez-le ci-dessous.',

    // ---- les deux sections de la modale ----
    // Les intitulés portent toute la distinction : une section réécrit le code
    // de l'écran, l'autre non. Mélangées en une seule liste, « remplacer »
    // voudrait dire « réécrire la source » sur une ligne et « pointer la carte
    // ailleurs » sur la suivante, sans rien à l'écran pour les distinguer.
    'library.swapCodeSection': 'Médias dans le code de l’écran',
    'library.attachSection': 'Média attaché à l’écran (hors du code)',
    'library.attachBlurb':
      'Un montage ou une séquence rattaché à cet écran. Rien n’est écrit dans le code : le média s’affiche sur une carte à côté du cadre, dans le canevas, à côté de l’image Muse et du DESIGN.md.',
    'library.attachNone': 'Aucun média attaché à cet écran.',
    'library.attachDetach': 'Détacher',
    'library.attachDetached': 'Média détaché.',
    'library.attachDone': 'Média attaché.',
    // Le hash survit au fichier : seule une suppression explicite retire un
    // média de la médiathèque, et un écran qui pointe vers un fichier disparu
    // doit le dire plutôt que de paraître vide.
    'library.attachGone':
      'Ce média n’est plus dans la médiathèque. Il reste attaché tant que vous ne le détachez pas.',
    'library.attachFilms': 'Montages exportés',
    'library.attachSequences': 'Séquences de défilement',
    'library.attachNoFilms': 'Aucun montage exporté. Montez-en un depuis le panneau Motion.',
    'library.attachNoSequences': 'Aucune séquence dans la médiathèque.',
    'library.attachFilmsFailed':
      'Impossible de lister les montages. Les séquences ci-dessous restent utilisables.',
    'library.attachSequencesFailed':
      'Impossible de lister les séquences. Les montages ci-dessus restent utilisables.',
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

    // ---- exported cuts ----
    // A third tab, not a row in “Videos”: a scroll sequence is scrubbed frame by
    // frame, a cut is played. The vocabulary follows — “sequence” for one, “cut”
    // for the other — because calling both of them a video is exactly what made
    // an export impossible to find.
    //
    // The tab carries the feature's name, “Motion”, not the object's: it is
    // where the Motion panel tells people to go and collect the result, and the
    // tab read “Films” while everything else read Motion. The object keeps the
    // word the panel already uses for it — “Cut one”, “Propose a cut”, “New cut”
    // — because a third word for the same thing is what was just removed.
    'library.tabFilms': 'Motion',
    'library.filmWord_one': 'cut',
    'library.filmWord_other': 'cuts',
    'library.noFilms': 'No cuts exported yet.',
    'library.noFilmsHint': 'Cut one from a project’s Motion panel: it lands here, attached to that project.',
    // Two forms, like “video”/“videos” just above: this dictionary has no plural
    // engine, it only substitutes `{name}`. A one-scene cut is legal (the schema
    // accepts `min(1)`), so “1 scenes” was reachable.
    'library.filmScenes_one': '{count} scene',
    'library.filmScenes_other': '{count} scenes',
    'library.playFilm': 'Play the cut',
    // The viewer opens from the media library, which has just listed the file,
    // BUT also from the canvas card, which opens nothing but a hash: the hash
    // outlives the file, and a deleted export answers 403 because the route
    // checks ownership before existence. Without these two sentences the click
    // produced a black rectangle with a transport bar and nothing else.
    'library.filmGone': 'This cut no longer plays.',
    'library.filmGoneHint':
      'The file was deleted from the server, or it belongs to another account. Nothing was removed from the screen: detach it from “Change the media…”.',
    'library.deleteFilm': 'Delete cut',
    'library.deleteFilmConfirm':
      'Permanently delete this cut? The file is erased from the server; the images it was made from stay in the library.',
    'library.deleteFilmSharedConfirm':
      'This cut is attached to {count} projects. Deleting it removes it from all of them. Continue?',

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
    // The title reads “Media”, like the menu entry that opens it
    // (`project.changeImages`). The sentences below still say images, because
    // they describe what the dialog can do — swap an <img> at an address the AST
    // vouched for — and not what it is called.
    'library.swapTitle': 'Media in “{name}”',
    'library.swapBlurb':
      'The images and scroll sequences this screen uses. Replacing rewrites only their address in the code — nothing else about the screen is touched, and “Revert” undoes it.',
    'library.swapNone': 'This screen uses nothing from the media library.',
    'library.swapNoneHint':
      'Screens generated without one use flat colour and hand-drawn SVG. To add an image, describe it in the composer.',
    'library.swapUnparsed':
      'This screen’s code could not be read, so its media cannot be found. Fix the error shown on the screen and try again.',
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

    // ---- scroll sequences present in the code ----
    // A sequence is not an image: it is named by a PAIR, the address and the
    // frame count. Both sentences below say so, because that is what explains
    // why replacing one means picking a whole library sequence rather than any
    // file at all.
    'library.swapSequences': 'Scroll sequences in the code',
    'library.swapSequencesHint':
      'A sequence is named by a pair: its address and its frame count. Replacing rewrites both together — one without the other leaves a scroll frozen on the last frame.',
    'library.swapSeqBadge': 'Sequence',
    'library.swapSeqLabel': 'Scroll sequence',
    // Split like `filmScenes`: the count is printed on every row and on every
    // card of the picker, and a one-frame sequence is a real case —
    // `replaceScreenSequence` accepts 1, and a very short clip yields no more.
    'library.swapSeqFrames_one': '{n} frame',
    'library.swapSeqFrames_other': '{n} frames',
    'library.swapSeqChoose': 'Choose the new sequence',
    'library.swapSeqEmpty': 'No sequence in the library. Upload a clip, or generate one from Media.',
    'library.swapSeqListFailed':
      'Could not list the library’s sequences. The images above are still replaceable.',
    'library.swapSeqDone': 'Sequence replaced: address and frame count rewritten together.',
    'library.swapSeqSame': 'That is already the sequence in use.',
    // A cut cannot go into the code: the generated component has no video tag,
    // and injecting one would be a generation rather than a substitution. The
    // only honest way in is to ask the composer for it.
    'library.swapNoFilmInCode':
      'A cut cannot be placed in the code: the generated component has no video tag, and adding one would be a regeneration. For a cut as the hero, regenerate the screen and ask for it in the composer — otherwise, attach it below.',

    // ---- the dialog's two sections ----
    // The headings carry the whole distinction: one section rewrites the
    // screen's code, the other does not. Mixed into a single list, "replace"
    // would mean "rewrite the source" on one row and "point the card elsewhere"
    // on the next, with nothing on screen to tell them apart.
    'library.swapCodeSection': 'Media in the screen’s code',
    'library.attachSection': 'Media attached to the screen (not in the code)',
    'library.attachBlurb':
      'A cut or a sequence hung on this screen. Nothing is written into the code: the media shows on a card beside the frame, on the canvas, next to the Muse image and the DESIGN.md.',
    'library.attachNone': 'Nothing attached to this screen.',
    'library.attachDetach': 'Detach',
    'library.attachDetached': 'Media detached.',
    'library.attachDone': 'Media attached.',
    // The hash outlives the file: only an explicit deletion removes a media from
    // the library, and a screen pointing at one that is gone has to say so
    // rather than look empty.
    'library.attachGone':
      'This media is no longer in the library. It stays attached until you detach it.',
    'library.attachFilms': 'Exported cuts',
    'library.attachSequences': 'Scroll sequences',
    'library.attachNoFilms': 'No cut exported yet. Make one from a project’s Motion panel.',
    'library.attachNoSequences': 'No sequence in the library.',
    'library.attachFilmsFailed': 'Could not list the cuts. The sequences below still work.',
    'library.attachSequencesFailed': 'Could not list the sequences. The cuts above still work.',
  } as Record<string, string>,
}
