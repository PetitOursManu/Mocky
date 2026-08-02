/**
 * Translations for the "canvas" area.
 *
 * One file per area so several people (or agents) can add strings at once
 * without ever touching the same file. `parts/index.ts` merges them all.
 *
 * Rules:
 *  - the key set of `fr` and `en` must match exactly — a test enforces it;
 *  - keys are `canvas.something`, so an area can never collide with another;
 *  - placeholders are `{name}`.
 */
export const canvas = {
  fr: {
    // ---- frame label & badges ----
    'canvas.referenceScreen': 'Écran de référence pour la mise en page des nouveaux écrans',
    'canvas.interactive': 'Interactif — clic dehors pour sortir',
    // ---- animations, par écran ----
    'canvas.animFollow': 'Animations : suit le composer — cliquez pour forcer',
    'canvas.animOn': 'Animations forcées sur cet écran — cliquez pour les couper',
    'canvas.animOff': 'Cet écran ne s’anime pas — cliquez pour revenir au réglage du composer',
    'canvas.animOffBadge': 'Figé',

    // ---- original prompt popover ----
    'canvas.originalPrompt': 'Demande d’origine',
    'canvas.copyPrompt': 'Copier la demande',
    'canvas.noPromptShort': 'Aucune demande enregistrée',
    'canvas.noPrompt':
      'Aucune demande enregistrée pour cet écran (créé avant cette fonctionnalité, ou importé).',

    // ---- Muse image beside a frame ----
    'canvas.deriveDesign': 'En déduire un DESIGN.md',
    'canvas.designUsed': 'DESIGN.md utilisé',
    'canvas.dossierUsed': 'Dossier Muse utilisé',
    'canvas.applyDesign': 'Reprendre ce design',
    'canvas.applyDesignTitle':
      'Remettre ce DESIGN.md comme système courant, à l’identique. C’est la copie enregistrée au moment où cet écran a été généré — aucune relecture, aucun appel au modèle.',
    'canvas.deriveDesignBusy': 'Lecture…',
    'canvas.deriveDesignTitle':
      'Écrire le système de design de cet écran dans DESIGN.md, pour que les prochains écrans lui ressemblent. L’ancien texte restera récupérable.',
    'canvas.imageRole.contentLabel': 'Insérée',
    'canvas.imageRole.contentTitle':
      'Image de CONTENU — elle est placée dans l’écran comme une vraie <img>. Cliquer pour l’ouvrir en grand.',
    'canvas.imageRole.inspirationLabel': 'Inspiration',
    'canvas.imageRole.inspirationTitle':
      'Image d’INSPIRATION — elle n’est PAS dans l’écran : elle a été montrée au modèle comme référence d’art direction (palette, lumière, composition). Cliquer pour l’ouvrir en grand.',
    'canvas.imageRole.bothLabel': 'Insérée + réf.',
    'canvas.imageRole.bothTitle':
      'Image de CONTENU ET référence — elle est placée dans l’écran, et le modèle l’a vue pour composer autour. Cliquer pour l’ouvrir en grand.',
    'canvas.imageRole.unknownLabel': 'Image Muse',
    'canvas.imageRole.unknownTitle':
      'Image Muse — son rôle n’a pas été enregistré (écran généré avant cette distinction).',

    // ---- links ----
    'canvas.removeLink': 'Supprimer le lien',
    'canvas.missingScreen': '(écran manquant)',

    // ---- mode hints ----
    'canvas.hintLink':
      'Mode Lier — cliquez un bouton ou un élément dans un écran, puis choisissez l’écran de destination',
    'canvas.hintModify': 'Mode Modifier — cliquez un élément dans un écran, puis décrivez le changement',
    'canvas.hintAnnotate': 'Mode Annoter — tracez un rectangle sur un écran pour le joindre à la conversation',
    'canvas.hintDefault':
      'Glissez pour sélectionner · Espace ou clic-molette pour naviguer · molette pour zoomer · double-clic pour interagir avec un écran',

    // ---- demo player ----
    'canvas.demoExit': 'Quitter la démo',
    'canvas.demoBack': 'Retour',
    'canvas.demoRestart': 'Recommencer',
    'canvas.demoHint': 'Cliquez les zones liées pour naviguer · Échap pour sortir',
    'canvas.demoGoToScreen': 'Aller à l’écran lié',
  } as Record<string, string>,
  en: {
    // ---- frame label & badges ----
    'canvas.referenceScreen': 'Reference screen for the layout of new screens',
    'canvas.interactive': 'Interactive — click outside to leave',
    // ---- per-screen animations ----
    'canvas.animFollow': 'Animations: follows the composer — click to force',
    'canvas.animOn': 'Animations forced on this screen — click to switch them off',
    'canvas.animOff': 'This screen does not animate — click to follow the composer again',
    'canvas.animOffBadge': 'Still',

    // ---- original prompt popover ----
    'canvas.originalPrompt': 'Original request',
    'canvas.copyPrompt': 'Copy the request',
    'canvas.noPromptShort': 'No request recorded',
    'canvas.noPrompt': 'No request was recorded for this screen (created before this feature, or imported).',

    // ---- Muse image beside a frame ----
    'canvas.deriveDesign': 'Derive a DESIGN.md',
    'canvas.designUsed': 'DESIGN.md used',
    'canvas.dossierUsed': 'Muse dossier used',
    'canvas.applyDesign': 'Use this design',
    'canvas.applyDesignTitle':
      'Make this DESIGN.md the current one, exactly. It is the copy recorded when this screen was generated — no re-reading, no model call.',
    'canvas.deriveDesignBusy': 'Reading…',
    'canvas.deriveDesignTitle':
      'Write this screen’s design system into DESIGN.md, so the next screens look like it. The old text stays recoverable.',
    'canvas.imageRole.contentLabel': 'Placed',
    'canvas.imageRole.contentTitle':
      'CONTENT image — it sits in the screen as a real <img>. Click to open it full size.',
    'canvas.imageRole.inspirationLabel': 'Inspiration',
    'canvas.imageRole.inspirationTitle':
      'INSPIRATION image — it is NOT in the screen: it was shown to the model as an art-direction reference (palette, light, composition). Click to open it full size.',
    'canvas.imageRole.bothLabel': 'Placed + ref.',
    'canvas.imageRole.bothTitle':
      'CONTENT image and reference — it sits in the screen, and the model saw it to compose around it. Click to open it full size.',
    'canvas.imageRole.unknownLabel': 'Muse image',
    'canvas.imageRole.unknownTitle':
      'Muse image — its role was not recorded (screen generated before that distinction existed).',

    // ---- links ----
    'canvas.removeLink': 'Remove the link',
    'canvas.missingScreen': '(missing screen)',

    // ---- mode hints ----
    'canvas.hintLink': 'Link mode — click a button or an element in a screen, then pick the destination screen',
    'canvas.hintModify': 'Modify mode — click an element in a screen, then describe the change',
    'canvas.hintAnnotate': 'Annotate mode — drag a rectangle over a screen to attach it to the conversation',
    'canvas.hintDefault':
      'Drag to select · Space or middle-click to pan · scroll to zoom · double-click to interact with a screen',

    // ---- demo player ----
    'canvas.demoExit': 'Exit demo',
    'canvas.demoBack': 'Back',
    'canvas.demoRestart': 'Restart',
    'canvas.demoHint': 'Click linked areas to navigate · Esc to exit',
    'canvas.demoGoToScreen': 'Go to the linked screen',
  } as Record<string, string>,
}
