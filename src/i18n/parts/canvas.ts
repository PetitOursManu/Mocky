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

    // ---- original prompt popover ----
    'canvas.originalPrompt': 'Demande d’origine',
    'canvas.copyPrompt': 'Copier la demande',
    'canvas.noPromptShort': 'Aucune demande enregistrée',
    'canvas.noPrompt':
      'Aucune demande enregistrée pour cet écran (créé avant cette fonctionnalité, ou importé).',

    // ---- Muse image beside a frame ----
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

    // ---- original prompt popover ----
    'canvas.originalPrompt': 'Original request',
    'canvas.copyPrompt': 'Copy the request',
    'canvas.noPromptShort': 'No request recorded',
    'canvas.noPrompt': 'No request was recorded for this screen (created before this feature, or imported).',

    // ---- Muse image beside a frame ----
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
