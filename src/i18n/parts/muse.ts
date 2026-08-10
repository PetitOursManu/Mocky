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
    // pinned references
    'muse.pinned': 'épinglées',
    'muse.unpinImage': 'Détacher {label}',

    // failures & availability
    'muse.imageFailed': 'Image non générée — {error}',
    'muse.imageFailedHelp': 'L’écran a quand même été généré. Vérifiez le fournisseur d’images dans Admin.',
    'muse.needsBackendPre': 'Muse a besoin du backend Mocky (lancez',
    'muse.needsBackendPost': 'ou l’app Docker). Indisponible en mode navigateur seul.',

    // inspiration
    'muse.liveInspirationHint':
      'Récupère l’inspiration en direct (installe un navigateur Playwright au 1er usage)',

    // image modes
    'muse.modeContentHint': 'L’image est insérée dans l’écran (photo héro, produit…)',
    'muse.modeInspirationHint':
      'L’image sert de référence de direction artistique au modèle (elle n’apparaît pas dans l’écran)',
    'muse.modeBothHint':
      'Le modèle VOIT l’image et l’insère : il compose l’écran autour d’elle (une seule image générée)',

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
    'muse.videoChosenTitle': 'Séquence choisie',
    'muse.videoChosenDetail': '{count} images — elle servira au défilement, aucune génération.',
    'muse.videoChosenDrop': 'Retirer',
    'muse.videoChosenDropHint': 'Ne plus utiliser cette séquence',

    // Motion — un film, pas une séquence au défilement. Les deux coûtent du
    // temps et de l'argent et n'arrivent pas au même endroit : la séquence
    // défile DANS la maquette, le film est attaché à l'écran et se regarde sur
    // le canevas. Le libellé le dit, parce que la maquette ne peut pas le jouer.
    'muse.motion': 'Film Motion',
    'muse.motionCost':
      'Un appel modèle et un rendu : compter 1 à 3 min de plus. Le film est attaché à l’écran et se regarde sur le canevas — il ne se joue pas dans la maquette.',
    'muse.motionUnavailable':
      'Motion n’est pas activé pour ce compte, ou le worker de rendu est injoignable.',
    'muse.motionKindLabel': 'Type de film',
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
    'muse.noVision': 'Vision non détectée sur ce modèle.',
    'muse.noVisionKeptPre': 'Votre choix « {mode} » est',
    'muse.noVisionKeptWord': 'conservé',
    'muse.noVisionKeptMid': ', mais cette génération se fera en',
    'muse.noVisionKeptPost':
      '. Choisissez un modèle avec vision dans Admin → Modèles de texte pour l’activer.',
    'muse.noVisionModes':
      'Les modes « {inspiration} » et « {both} » ont besoin d’un modèle capable de lire une image.',

    // dossier
    'muse.offlinePatterns': 'patterns (hors-ligne)',
    'muse.imageRoleInspiration': 'Référence de direction artistique — non insérée dans l’écran',
    'muse.imageRoleBoth': 'Insérée dans l’écran, et montrée au modèle',
    'muse.imageRoleContent': 'Insérée dans l’écran',
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
    // pinned references
    'muse.pinned': 'pinned',
    'muse.unpinImage': 'Unpin {label}',

    // failures & availability
    'muse.imageFailed': 'Image not generated — {error}',
    'muse.imageFailedHelp': 'The screen was generated anyway. Check the image provider in Admin.',
    'muse.needsBackendPre': 'Muse needs the Mocky backend (run',
    'muse.needsBackendPost': 'or the Docker app). Unavailable in browser-only mode.',

    // inspiration
    'muse.liveInspirationHint': 'Fetches inspiration live (installs a Playwright browser on first use)',

    // image modes
    'muse.modeContentHint': 'The image is placed inside the screen (hero photo, product shot…)',
    'muse.modeInspirationHint':
      'The image is an art-direction reference for the model (it does not appear in the screen)',
    'muse.modeBothHint':
      'The model SEES the image and places it: it composes the screen around it (one generated image)',

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
    'muse.videoChosenTitle': 'Chosen sequence',
    'muse.videoChosenDetail': '{count} frames — it will drive the scroll, nothing is generated.',
    'muse.videoChosenDrop': 'Remove',
    'muse.videoChosenDropHint': 'Stop using this sequence',

    // Motion — a film, not a scroll sequence. Both cost time and money and they
    // do not end up in the same place: a sequence scrolls INSIDE the mockup, a
    // film is attached to the screen and watched on the canvas. The label says
    // so, because the mockup cannot play it.
    'muse.motion': 'Motion film',
    'muse.motionCost':
      'One model call and one render: expect 1 to 3 min more. The film is attached to the screen and watched on the canvas — it does not play inside the mockup.',
    'muse.motionUnavailable': 'Motion is not enabled for this account, or the render worker is unreachable.',
    'muse.motionKindLabel': 'Kind of film',
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
    'muse.noVision': 'No vision detected on this model.',
    'muse.noVisionKeptPre': 'Your “{mode}” choice is',
    'muse.noVisionKeptWord': 'kept',
    'muse.noVisionKeptMid': ', but this generation will run as',
    'muse.noVisionKeptPost': '. Pick a model with vision in Admin → Text model to enable it.',
    'muse.noVisionModes':
      'The “{inspiration}” and “{both}” modes need a model that can read an image.',

    // dossier
    'muse.offlinePatterns': 'patterns (offline)',
    'muse.imageRoleInspiration': 'Art-direction reference — not placed in the screen',
    'muse.imageRoleBoth': 'Placed in the screen, and shown to the model',
    'muse.imageRoleContent': 'Placed in the screen',
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
