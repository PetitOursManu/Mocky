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
