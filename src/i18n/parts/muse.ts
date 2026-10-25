/**
 * Translations for the "muse" area.
 *
 * One file per area so several people (or agents) can add strings at once
 * without ever touching the same file. `parts/index.ts` merges them all.
 *
 * Rules:
 *  - the key set of `fr` and `en` must match exactly — a test enforces it;
 *  - keys are `muse.something`, so an area can never collide with another;
 *  - placeholders are `{name}`.
 */
export const muse = {
  fr: {
    'muse.unpinImage': 'Retirer {label}',

    // the panel, since 2026-10: rows that say what each thing does
    'muse.subtitle': 'Direction artistique, inspiration trouvée en direct sur le web, et images.',
    'muse.visionTitle': 'Le modèle de texte voit les images : il peut s’inspirer de vos références.',
    'muse.inspirationLabel': 'Inspiration',
    'muse.inspirationHint': 'Muse cherche toujours des références en direct. Ajoutez vos liens si vous en avez.',
    'muse.ownImages': 'Vos images',
    'muse.ownImagesHint': 'Choisies dans la bibliothèque. Cochez à quoi chacune sert.',
    'muse.ownImagesPick': 'Choisir dans la bibliothèque',
    'muse.ownImagesMore': 'Ajouter des images',
    'muse.ownImageUntitled': 'Image sans titre',
    'muse.useInsert': 'Dans le projet',
    'muse.useInspire': 'Inspiration',
    'muse.useInspireHint': 'Muse et le modèle s’en inspirent (couleurs, lumière, ambiance) sans l’insérer',
    'muse.contentImages': 'Images à créer',
    'muse.contentImagesHint': 'Combien d’images Muse ajoute dans l’écran, en plus des vôtres.',
    'muse.contentImagesHintPlate':
      'Combien d’images Muse ajoute dans l’écran. Il crée aussi une planche d’inspiration, jamais insérée.',
    'muse.contentImagesAuto': 'Auto',
    'muse.contentImagesAutoHint': 'Une image générée, ou jusqu’à trois photos libres — aucune si vous avez choisi les vôtres',
    'muse.noVisionPlate': 'Ce modèle ne voit pas les images : pas de planche d’inspiration ni de référence.',
    'muse.plateLabel': 'inspiration',
    'muse.videoSourceHint': 'Une séquence qui avance au défilement ou à la souris.',

    // failures & availability
    'muse.imageFailed': 'Image non générée — {error}',
    'muse.imageFailedHelp': 'L’écran a quand même été généré. Vérifiez le fournisseur d’images dans Admin.',
    'muse.needsBackendPre': 'Muse a besoin du backend Mocky (lancez',
    'muse.needsBackendPost': 'ou l’app Docker). Indisponible en mode navigateur seul.',

    // inspiration

    // image modes

    // vidéo au défilement
    'muse.video': 'Vidéo au défilement',
    'muse.videoHint':
      'Muse génère un plan vidéo pour le héro et l’écran le fait défiler image par image, à la vitesse de la molette',
    'muse.videoCost': 'Une seule séquence, sur le héro. Compter 30 s à 3 min de plus, et un coût par clip.',
    'muse.videoNoProvider':
      'Aucun fournisseur vidéo configuré — Admin → Génération d’images → Vidéo.',
    'muse.videoNoFfmpeg':
      'ffmpeg est absent de ce conteneur : impossible de découper le clip en images.',
    'muse.videoNoProviderButImport':
      'Aucun fournisseur vidéo configuré — mais vous pouvez importer votre propre clip dans Média et le choisir ici.',
    'muse.videoPickFromLibrary': 'ou choisir une séquence dans Média',
    'muse.videoSource': 'Vidéo',
    'muse.videoSourceOff': 'Aucune',
    'muse.videoSourceGenerated': 'Générée par IA',
    'muse.videoSourceGeneratedHint': 'Une vidéo créée pour cet écran par le fournisseur configuré — payante, 30 s à 3 min',
    'muse.videoSourceFree': 'Gratuite',
    'muse.videoSourceFreeHint': 'Une vidéo libre de droits (Pexels, Pixabay) ou l’une des vôtres, choisie dans Média — gratuit',
    'muse.videoSourceMine': 'Mes vidéos',
    'muse.videoSourceMineHint': 'Une vidéo que vous avez importée dans Média — gratuit',
    'muse.videoFreePick': 'Cherchez une vidéo gratuite (Pexels, Pixabay) dans Média, importez-la, puis cliquez sur « Utiliser ». Vous pouvez aussi prendre l’une des vôtres.',
    'muse.videoMinePick': 'Importez votre clip dans Média, puis cliquez sur « Utiliser » sous la vidéo.',
    'muse.videoFreeButton': 'Choisir une vidéo',
    'muse.videoGenerateOff': 'La génération vidéo n’est pas disponible sur cette instance.',
    'muse.videoChosenTitle': 'Séquence choisie',
    'muse.videoChosenDetail': '{count} images — elle servira au défilement, aucune génération.',
    'muse.videoChosenDetailPointer': '{count} images — elle suivra la souris, là où le prompt la place. Aucune génération.',
    'muse.videoDrive': 'Ce qui fait avancer la séquence',
    'muse.videoDriveScroll': 'Défilement',
    'muse.videoDriveScrollHint': "La séquence ouvre la page et avance quand on fait défiler",
    'muse.videoDrivePointer': 'Souris',
    'muse.videoDrivePointerHint':
      'La séquence suit le curseur et se place où le prompt le demande (pied de page, section, carte…)',
    'muse.videoChosenDrop': 'Retirer',
    'muse.videoChosenDropHint': 'Ne plus utiliser cette séquence',

    // Motion — un film rendu, décidé par le dossier Muse lui-même (voir
    // server/muse/inspire/film.js). La case ne fait qu'IMPOSER ce que le mode
    // automatique ne propose qu'avec prudence.
    'muse.motionKind.hero': 'Héro',
    'muse.motionKindHelp.hero': 'L’ouverture de la page : une seule idée, avant tout défilement.',
    'muse.motionKind.background': 'Fond de section',
    'muse.motionKindHelp.background':
      'Une surface en mouvement, sous du texte que la page compose elle-même. Aucun mot dans le film.',
    'muse.motionKind.banner': 'Bandeau',
    'muse.motionKindHelp.banner': 'Une bande large qui annonce une chose : un lancement, une date, un nom.',
    'muse.motionKind.showcase': 'Produit',
    'muse.motionKindHelp.showcase': 'Un objet, son nom, la raison de le vouloir. Il faut au moins une image.',
    'muse.motionKind.figure': 'Chiffre',
    'muse.motionKindHelp.figure': 'Le chiffre qui porte l’argument, qui arrive plutôt que d’être posé.',
    'muse.motionKind.globe': 'Globe',
    'muse.motionKindHelp.globe': 'Le monde en volume, qui tourne. Demande la 3D, accordée par un administrateur.',
    'muse.motionKind.mark': 'Logotype',
    'muse.motionKindHelp.mark': 'Un nom ou une marque qui se compose. Rien d’autre dans le cadre.',
    'muse.motionKind.story': 'Vertical',
    'muse.motionKindHelp.story': 'Un montage 9:16 pour un fil : plein cadre, temps courts.',

    // vision
    'muse.vision': 'vision',
    'muse.modeNeedsVision': 'Indisponible : ce modèle n’accepte pas les images',

    // dossier
    'muse.offlinePatterns': 'patterns (hors-ligne)',
    'muse.downloadImage': 'Télécharger l’image {slot}',

    // format presets
    'muse.presetMobile': 'Mobile',
    'muse.presetMobileFull': 'Mobile (iPhone)',
    'muse.presetDesktop': 'Ordinateur',
    'muse.presetDesktopFull': 'Ordinateur',
    'muse.presetTablet': 'Tablette',
    'muse.presetTabletFull': 'Tablette',
  } as Record<string, string>,
  en: {
    'muse.unpinImage': 'Remove {label}',

    // the panel, since 2026-10: rows that say what each thing does
    'muse.subtitle': 'Art direction, inspiration found live on the web, and pictures.',
    'muse.visionTitle': 'The text model can see images: it can draw on your references.',
    'muse.inspirationLabel': 'Inspiration',
    'muse.inspirationHint': 'Muse always looks for references live. Add your own links if you have some.',
    'muse.ownImages': 'Your pictures',
    'muse.ownImagesHint': 'Chosen from the library. Tick what each one is for.',
    'muse.ownImagesPick': 'Choose from the library',
    'muse.ownImagesMore': 'Add pictures',
    'muse.ownImageUntitled': 'Untitled picture',
    'muse.useInsert': 'In the project',
    'muse.useInspire': 'Inspiration',
    'muse.useInspireHint': 'Muse and the model take their cue from it (colours, light, mood) without placing it',
    'muse.contentImages': 'Pictures to create',
    'muse.contentImagesHint': 'How many pictures Muse adds to the screen, on top of yours.',
    'muse.contentImagesHintPlate':
      'How many pictures Muse adds to the screen. It also makes an inspiration plate, never placed.',
    'muse.contentImagesAuto': 'Auto',
    'muse.contentImagesAutoHint': 'One generated picture, or up to three free photos — none if you chose your own',
    'muse.noVisionPlate': 'This model cannot see images: no inspiration plate and no reference.',
    'muse.plateLabel': 'inspiration',
    'muse.videoSourceHint': 'A sequence that moves with the scroll or the mouse.',

    // failures & availability
    'muse.imageFailed': 'Image not generated — {error}',
    'muse.imageFailedHelp': 'The screen was generated anyway. Check the image provider in Admin.',
    'muse.needsBackendPre': 'Muse needs the Mocky backend (run',
    'muse.needsBackendPost': 'or the Docker app). Unavailable in browser-only mode.',

    // inspiration

    // image modes

    // scroll video
    'muse.video': 'Scroll-driven video',
    'muse.videoHint':
      'Muse generates a clip for the hero and the screen scrubs through it frame by frame, at the speed of the scroll wheel',
    'muse.videoCost': 'One sequence, on the hero. Expect 30 s to 3 min more, and a cost per clip.',
    'muse.videoNoProvider': 'No video provider configured — Admin → Image generation → Video.',
    'muse.videoNoFfmpeg': 'ffmpeg is missing from this container: the clip cannot be cut into frames.',
    'muse.videoNoProviderButImport':
      'No video provider configured — but you can import your own clip in Media and choose it here.',
    'muse.videoPickFromLibrary': 'or choose a sequence from Media',
    'muse.videoSource': 'Video',
    'muse.videoSourceOff': 'None',
    'muse.videoSourceGenerated': 'AI-generated',
    'muse.videoSourceGeneratedHint': 'A video made for this screen by the configured provider — paid, 30 s to 3 min',
    'muse.videoSourceFree': 'Free',
    'muse.videoSourceFreeHint': 'A free stock video (Pexels, Pixabay) or one of your own, chosen in Media — no cost',
    'muse.videoSourceMine': 'My videos',
    'muse.videoSourceMineHint': 'A video you imported into Media — no cost',
    'muse.videoFreePick': 'Search for a free video (Pexels, Pixabay) in Media, import it, then click “Use”. You can also take one of your own.',
    'muse.videoMinePick': 'Import your clip into Media, then click “Use” under the video.',
    'muse.videoFreeButton': 'Choose a video',
    'muse.videoGenerateOff': 'Video generation is not available on this instance.',
    'muse.videoChosenTitle': 'Chosen sequence',
    'muse.videoChosenDetail': '{count} frames — it will drive the scroll, nothing is generated.',
    'muse.videoChosenDetailPointer': '{count} frames — it will follow the mouse, wherever the prompt puts it. Nothing is generated.',
    'muse.videoDrive': 'What moves the sequence',
    'muse.videoDriveScroll': 'Scroll',
    'muse.videoDriveScrollHint': 'The sequence opens the page and advances as the visitor scrolls',
    'muse.videoDrivePointer': 'Mouse',
    'muse.videoDrivePointerHint':
      'The sequence follows the cursor and goes wherever the prompt asks (footer, section, card…)',
    'muse.videoChosenDrop': 'Remove',
    'muse.videoChosenDropHint': 'Stop using this sequence',

    // Motion — a rendered film, decided by the Muse dossier itself (see
    // server/muse/inspire/film.js). The box only IMPOSES what the automatic
    // mode proposes prudently.
    'muse.motionKind.hero': 'Hero',
    'muse.motionKindHelp.hero': 'The opening of the page: one idea, before anything is scrolled.',
    'muse.motionKind.background': 'Section background',
    'muse.motionKindHelp.background':
      'A moving surface, under type the page sets itself. No words inside the film.',
    'muse.motionKind.banner': 'Banner',
    'muse.motionKindHelp.banner': 'A wide strip announcing one thing: a launch, a date, a name.',
    'muse.motionKind.showcase': 'Product',
    'muse.motionKindHelp.showcase': 'One object, its name, the reason to want it. Needs at least one image.',
    'muse.motionKind.figure': 'Figure',
    'muse.motionKindHelp.figure': 'The number the page is about, arriving rather than sitting there.',
    'muse.motionKind.globe': 'Globe',
    'muse.motionKindHelp.globe': 'The world in volume, turning. Needs 3D, which an administrator grants.',
    'muse.motionKind.mark': 'Logotype',
    'muse.motionKindHelp.mark': 'A name or a mark assembling itself. Nothing else in the frame.',
    'muse.motionKind.story': 'Vertical',
    'muse.motionKindHelp.story': 'A 9:16 cut for a feed: full bleed, short beats.',

    // vision
    'muse.vision': 'vision',
    'muse.modeNeedsVision': 'Unavailable: this model does not accept images',

    // dossier
    'muse.offlinePatterns': 'patterns (offline)',
    'muse.downloadImage': 'Download the {slot} image',

    // format presets
    'muse.presetMobile': 'Mobile',
    'muse.presetMobileFull': 'Mobile (iPhone)',
    'muse.presetDesktop': 'Desktop',
    'muse.presetDesktopFull': 'Desktop',
    'muse.presetTablet': 'Tablet',
    'muse.presetTabletFull': 'Tablet',
  } as Record<string, string>,
}
