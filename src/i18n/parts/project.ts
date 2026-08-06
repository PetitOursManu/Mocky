/**
 * Translations for the "project" area.
 *
 * One file per area so several people (or agents) can add strings at once
 * without ever touching the same file. `parts/index.ts` merges them all.
 *
 * Rules:
 *  - the key set of `fr` and `en` must match exactly — a test enforces it;
 *  - keys are `project.something`, so an area can never collide with another;
 *  - placeholders are `{name}`.
 */
export const project = {
  fr: {
    // ---- toolbar ----
    'project.back': 'Retour',
    'project.linkTitle': 'Relier les écrans entre eux',
    'project.modifyTitle': 'Cliquez un élément dans un écran, puis décrivez le changement — sans écrire de code',
    'project.interactTitle': 'Rendre tous les écrans interactifs (boutons cliquables, animations)',
    'project.annotateTitle': 'Découper une zone d’un écran et l’envoyer au chat comme référence numérotée',
    'project.frameTitle': 'Afficher ou masquer le cadre iPhone sur les écrans mobiles',
    'project.frameNeedsMobile': 'Aucun écran mobile dans ce projet — le cadre iPhone n’a rien à entourer',
    'project.systemTitle': 'Système de design en direct — vos tokens DESIGN.md, et de quoi les recolorer',
    'project.demoTitle': 'Lancer le prototype — suit les liens que vous avez posés',
    // Le menu de débordement de la barre d'outils, sous md. Court par nécessité :
    // il partage la rangée avec trois boutons sur un écran de 390px.
    'project.moreTools': 'Plus',
    'project.moreToolsTitle': 'Les autres outils du canevas — interaction, annotation, cadre, système, démo, export',
    'project.autoLink': 'Proposer des liens',
    'project.autoLinkFrom': 'Depuis quel écran',
    'project.autoLinkWorking': 'Lecture de l’écran…',
    'project.autoLinkNeedsScreens': 'Il faut au moins deux écrans pour lier quoi que ce soit.',
    'project.autoLinkTitle': 'Liens proposés',
    'project.autoLinkBlurb': 'Décochez ce qui vous semble faux. Rien n’est écrit tant que vous n’avez pas validé.',
    'project.autoLinkApply': 'Créer les {count} liens',
    'project.autoLinkApplyOne': 'Créer le lien',
    'project.autoLinkNone': 'Aucun lien évident à proposer sur cet écran.',
    'project.autoLinkNoneWhy': 'Rien n’a été trouvé qui désigne un autre écran de façon nette — ni lien écrit par le modèle, ni libellé qui reprenne les mots d’un autre écran. Le mode Lien reste là pour les poser à la main.',
    'project.autoLinkUnnamed': 'élément sans libellé',
    'project.autoLinkWhyHref': 'le lien écrit dans l’écran désigne cette page',
    'project.autoLinkWhyPrompt': 'le libellé reprend les mots de l’écran cible',
    'project.autoLinkWhyContent': 'le libellé se retrouve dans le contenu de l’écran cible',
    'project.demoFlow': 'Dérouler',
    'project.demoFlowTitle': 'Parcourir les écrans dans l’ordre, sans avoir à les relier',
    'project.exportTitle': 'Exporter un projet Vite + React + Tailwind prêt à lancer',

    // ---- export menu ----
    'project.exportHeading': 'Projet exécutable (.zip)',
    'project.exportShadcn': 'Prêt pour shadcn',
    'project.exportShadcnHint': 'Tokens de thème issus de DESIGN.md ; « npx shadcn add » fonctionne',
    'project.exportPlain': 'Tailwind seul',
    'project.exportPlainHint': 'Tailwind + composants d’interface embarqués',
    'project.exportDaisy': 'daisyUI',
    'project.exportDaisyHint': 'Tailwind + le plugin daisyUI',

    // ---- links panel ----
    'project.links': 'Liens',
    'project.done': 'Terminé',
    'project.closeLinkMode': 'Quitter le mode Lier',
    'project.noLinks': 'Aucun lien pour l’instant. Cliquez un bouton dans un écran pour en créer un.',
    'project.centerOnLink': 'Centrer le canevas sur ce lien',
    'project.missingTarget': '(écran manquant)',
    'project.onScreen': 'sur {name}',
    'project.deleteLink': 'Supprimer le lien',
    'project.deleteLinkOn': 'Supprimer le lien sur {name}',

    // ---- link target picker ----
    'project.linkKicker': 'Lien',
    'project.linkElement': '« {label} »',
    'project.thisElement': 'Cet élément',
    'project.linkQuestion': 'vers quel écran ?',
    'project.linkHelp': 'En mode démo, un clic sur cet élément ouvre l’écran choisi.',
    'project.linkNoOther': 'Ajoutez un autre écran pour pouvoir créer un lien.',

    // ---- composer ----
    'project.format': 'Format',
    'project.designChip': 'Design',
    'project.designTitle': 'Gérer DESIGN.md',
    'project.redesignChip': 'Nouvelle direction',
    'project.redesignTitle':
      'Les écrans de ce projet suivent tous la même direction. Cochez pour que ce prompt en écrive une nouvelle — elle s’appliquera aux écrans suivants.',
    'project.redesignOnTitle':
      'Ce prompt va redéfinir la direction du projet. La case se décochera toute seule après la génération.',
    'project.museToggle': 'Muse — inspiration, direction artistique et vraie copie',
    'project.museHint':
      'Essayez Muse : elle cherche des références, écrit une direction artistique et remplace le faux texte par de vrais contenus. Cliquez pour l’activer.',
    'project.composerEdit_one': 'Décrivez le changement à appliquer à l’écran sélectionné…',
    'project.composerEdit_other': 'Décrivez le changement à appliquer aux {count} écrans sélectionnés…',
    'project.stopTitle': 'Arrêter la génération en cours',
    'project.clearSelection': 'tout désélectionner',
    'project.removeFromSelection': 'Retirer de la sélection',
    'project.removeFromSelectionOf': 'Retirer « {name} » de la sélection',

    // ---- annotation references ----
    'project.refAttached': 'Référence [{n}] — jointe au modèle',
    'project.refAlt': 'référence {n}',
    'project.removeRef': 'Retirer la référence',
    'project.removeRefN': 'Retirer la référence {n}',

    // ---- busy & brief ----
    'project.busyMuse': 'Muse…',
    'project.busyPlanning': 'Planification…',
    'project.busyDesign': 'Direction…',
    'project.museStageDossier': 'Inspiration & rédaction du dossier…',
    'project.museStageInspiration': 'Génération de l’image d’inspiration…',
    'project.museStageHero': 'Génération de l’image héro…',
    'project.museStageMedia': 'Lecture de votre média (palette, ambiance)…',

    // ---- animations (interrupteur à trois états) ----
    'project.animAuto': '✦ Animations auto',
    'project.animOn': '✦ Animations forcées',
    'project.animOff': '✦ Sans animation',
    'project.animHintAuto':
      'Mocky décide selon l’écran demandé — une landing page respire, un tableau d’administration reste immobile. Cliquez pour forcer.',
    'project.animHintOn': 'Chaque écran généré aura des animations. Cliquez pour les couper.',
    'project.animHintOff':
      'Aucune animation, même si l’écran s’y prêterait — utile pour une démo ou une capture. Cliquez pour revenir à l’automatique.',

    // ---- lire ou non les animations d'UN écran (menu contextuel) ----
    'project.playAnimations': 'Lire les animations',
    'project.playAuto': 'Auto',
    'project.playOn': 'Oui',
    'project.playOff': 'Non',
    'project.playAutoTitle': 'Suit l’interrupteur du composer.',
    'project.playOnTitle': 'Cet écran s’anime, même si le composer est sur « sans animation ».',
    'project.playOffTitle': 'Cet écran ne bouge pas, même si le composer autorise les animations.',
    'project.museStageVideo': 'Génération de la vidéo (30 s à 3 min)…',
    'project.museVideoFailed': 'La vidéo n’a pas pu être générée : {detail}. L’écran est produit sans séquence.',
    'project.museNoImage': 'le dossier n’a proposé aucune image',
    'project.briefImageFailed': 'Image non générée — {reason}',
    'project.briefBackend': 'Backend Mocky requis',
    'project.briefPinned_one': '1 image épinglée',
    'project.briefPinned_other': '{count} images épinglées',
    'project.briefDefault': 'Inspiration, direction artistique et copie réelle',

    // ---- element editor (Modify) ----
    'project.element': 'Élément',
    'project.elementWord': 'élément',
    'project.selectedWord': 'Sélection',
    'project.text': 'Texte',
    'project.textUpdate': 'Mettre à jour',
    'project.recolor': 'Recolorer',
    'project.fromYourDesign': 'Depuis votre design',
    'project.basics': 'Couleurs de base',
    'project.recolorTo': 'Recolorer en {name}',
    'project.recolorToHex': 'Recolorer en {name} ({hex})',
    'project.customHex': 'Couleur hexadécimale personnalisée',
    'project.applyHex': 'Appliquer cette couleur',
    'project.go': 'OK',
    'project.orDescribe': 'Ou décrivez le changement',
    'project.modifyPlaceholder':
      'ex. « agrandis-le et mets-le en gras », « ajoute une ombre », « arrondis les coins »…',
    'project.applyChange': 'Appliquer',
    'project.modifyNote':
      'Les changements de texte s’appliquent aussitôt quand ils sont uniques · les autres passent par le modèle · tout est réversible depuis le menu de l’écran',

    // ---- recolor swatches ----
    'project.colorInk': 'Encre',
    'project.colorWhite': 'Blanc',
    'project.colorRed': 'Rouge',
    'project.colorAmber': 'Ambre',
    'project.colorGreen': 'Vert',
    'project.colorBlue': 'Bleu',
    'project.colorIndigo': 'Indigo',
    'project.colorFuchsia': 'Fuchsia',

    // ---- screen context menu ----
    'project.regenerate': 'Régénérer (nouvelle variante)',
    'project.copyOf': '{name} (copie)',
    'project.screenNamePrompt': 'Nom de l’écran',
    'project.showCode': 'Voir le code',
    'project.pinReference': 'Épingler comme référence de mise en page',
    'project.unpinReference': 'Ne plus utiliser comme référence',
    'project.editDesign': 'Modifier DESIGN.md',
    'project.changeImages': 'Changer les images…',
    'project.deriveDesign': 'Faire de cet écran mon DESIGN.md',
    'project.applyDesignConfirm':
      'Faire du DESIGN.md enregistré avec « {name} » la direction de ce projet ? Les écrans suivants la suivront ; la direction actuelle reste accessible depuis les écrans qui l’ont utilisée.',
    'project.deriveDesignBusy': 'Lecture de l’écran…',
    'project.deriveDesignConfirm':
      'Faire du design de « {name} » la direction de ce projet ? Les écrans suivants la suivront ; la direction actuelle reste accessible depuis les écrans qui l’ont utilisée.',
    'project.deriveDesignEmpty': 'Cet écran n’a pas encore de code à analyser.',
    'project.deriveDesignEmptyResult': 'Le modèle n’a rien renvoyé. Réessayez, ou prenez un écran plus abouti.',
    'project.displayFormat': 'Format d’affichage',
    'project.formatMobile': 'Mobile',
    'project.formatTablet': 'Tablette',
    'project.formatDesktop': 'Bureau',
    'project.formatFull': 'Complet',
    'project.formatFullTitle': 'Hauteur complète (ajustée au contenu)',
    'project.formatOf': 'Format {name}',
    'project.addAnimations': 'Ajouter des animations',
    'project.animSubtle': 'Subtiles',
    'project.animModerate': 'Modérées',
    'project.animRich': 'Riches',
    'project.animTitle': 'Ajouter des animations {level} (contenu et mise en page conservés ; réversible)',
    'project.deleteScreenConfirm': 'Supprimer cet écran ?',

    // ---- code viewer ----
    'project.codeKicker': 'Code',
    'project.closeCode': 'Fermer le lecteur de code',

    // ---- in-flight labels ----
    'project.addingMotion': 'Ajout des animations…',
    'project.updating': 'Mise à jour…',

    // ---- errors ----
    'project.noModel': 'Aucun modèle configuré. Ouvrez les Réglages et choisissez un modèle.',
    'project.captureFailed': 'La capture a échoué — réessayez, ou sélectionnez une zone plus petite.',
    'project.exportEmpty': 'Ajoutez au moins un écran avant d’exporter.',
    'project.truncated':
      'Le modèle a atteint sa limite de tokens : l’écran est incomplet. Demandez un écran plus simple (moins de sections), ou utilisez un modèle avec une sortie plus longue.',
    'project.slop': 'Texte générique détecté ({list}). Régénérez pour un rendu propre.',
    // ---- passe qualité ----
    'project.polish': 'Peaufiner (détecter et corriger)',
    'project.polishing': 'Analyse de l’écran…',
    'project.polishingPass': 'Correction {i} — {n} point(s) à reprendre',
    'project.polishClean': 'Rien à reprendre — {score}/20.',
    'project.polishFixed': 'Écran peaufiné — {score}/20. Corrigé : {list}.',
    'project.polishResidual':
      'Reste à reprendre ({score}/20) : {list}. Relancez « Peaufiner » ou modifiez la direction.',
    'project.polishFailed':
      'La passe qualité n’a pas abouti. L’écran est intact — réessayez, ou vérifiez le modèle dans les réglages.',

    // ---- starter examples ----
    'project.example1': 'Une page de tarifs SaaS avec trois formules et une bascule mensuel/annuel',
    'project.example2': 'Un écran de connexion mobile avec e-mail, mot de passe et connexion via un réseau social',
    'project.example3':
      'Un tableau de bord analytique avec des cartes de chiffres, un graphique et une liste d’activité',
  } as Record<string, string>,
  en: {
    // ---- toolbar ----
    'project.back': 'Back',
    'project.linkTitle': 'Draw links between screens',
    'project.modifyTitle': 'Click an element in a screen, then describe a change — no code needed',
    'project.interactTitle': 'Make all screens interactive (clickable buttons, animations)',
    'project.annotateTitle': 'Snip a region of a screen into the chat as a numbered reference',
    'project.frameTitle': 'Show or hide the iPhone frame on mobile screens',
    'project.frameNeedsMobile': 'No mobile screen in this project — the iPhone frame has nothing to wrap',
    'project.systemTitle': 'Live design system — your DESIGN.md tokens, and a way to recolor them',
    'project.demoTitle': 'Play the prototype — follows the links you placed',
    'project.moreTools': 'More',
    'project.moreToolsTitle': 'The rest of the canvas tools — interact, annotate, frame, system, demo, export',
    'project.autoLink': 'Suggest links',
    'project.autoLinkFrom': 'From which screen',
    'project.autoLinkWorking': 'Reading the screen…',
    'project.autoLinkNeedsScreens': 'It takes at least two screens to link anything.',
    'project.autoLinkTitle': 'Suggested links',
    'project.autoLinkBlurb': 'Untick anything that looks wrong. Nothing is written until you confirm.',
    'project.autoLinkApply': 'Create the {count} links',
    'project.autoLinkApplyOne': 'Create the link',
    'project.autoLinkNone': 'Nothing obvious to suggest on this screen.',
    'project.autoLinkNoneWhy': 'Nothing here points clearly at another screen — no link written by the model, no label echoing another screen’s words. Link mode is still there to place them by hand.',
    'project.autoLinkUnnamed': 'unlabelled element',
    'project.autoLinkWhyHref': 'the link written in the screen points at this page',
    'project.autoLinkWhyPrompt': 'the label echoes the target screen’s words',
    'project.autoLinkWhyContent': 'the label appears in the target screen’s content',
    'project.demoFlow': 'Walk through',
    'project.demoFlowTitle': 'Step through the screens in order, with nothing to wire up',
    'project.exportTitle': 'Export a runnable Vite + React + Tailwind project',

    // ---- export menu ----
    'project.exportHeading': 'Runnable project (.zip)',
    'project.exportShadcn': 'shadcn-ready',
    'project.exportShadcnHint': 'Theme tokens from DESIGN.md; “npx shadcn add” works',
    'project.exportPlain': 'Plain Tailwind',
    'project.exportPlainHint': 'Tailwind + vendored UI components',
    'project.exportDaisy': 'daisyUI',
    'project.exportDaisyHint': 'Tailwind + the daisyUI plugin',

    // ---- links panel ----
    'project.links': 'Links',
    'project.done': 'Done',
    'project.closeLinkMode': 'Leave link mode',
    'project.noLinks': 'No links yet. Click a button inside a screen to create one.',
    'project.centerOnLink': 'Center the canvas on this link',
    'project.missingTarget': '(missing screen)',
    'project.onScreen': 'on {name}',
    'project.deleteLink': 'Delete link',
    'project.deleteLinkOn': 'Delete link on {name}',

    // ---- link target picker ----
    'project.linkKicker': 'Link',
    'project.linkElement': '“{label}”',
    'project.thisElement': 'This element',
    'project.linkQuestion': 'which screen?',
    'project.linkHelp': 'In demo mode, clicking this element opens the chosen screen.',
    'project.linkNoOther': 'Add another screen first to link to it.',

    // ---- composer ----
    'project.format': 'Format',
    'project.designChip': 'Design',
    'project.designTitle': 'Manage DESIGN.md',
    'project.redesignChip': 'New direction',
    'project.redesignTitle':
      'Every screen in this project follows the same design direction. Tick this and the prompt below writes a new one, which the screens after it will follow.',
    'project.redesignOnTitle':
      'This prompt will redefine the project’s direction. The box unticks itself once the screen is generated.',
    'project.museToggle': 'Muse — inspiration, art direction & real copy',
    'project.museHint':
      'Try Muse: it finds references, writes an art direction, and replaces lorem ipsum with real copy. Click to turn it on.',
    'project.composerEdit_one': 'Describe a change to apply to the selected screen…',
    'project.composerEdit_other': 'Describe a change to apply to the {count} selected screens…',
    'project.stopTitle': 'Stop the generation in progress',
    'project.clearSelection': 'clear',
    'project.removeFromSelection': 'Remove from selection',
    'project.removeFromSelectionOf': 'Remove “{name}” from the selection',

    // ---- annotation references ----
    'project.refAttached': 'Reference [{n}] — attached to the model',
    'project.refAlt': 'reference {n}',
    'project.removeRef': 'Remove reference',
    'project.removeRefN': 'Remove reference {n}',

    // ---- busy & brief ----
    'project.busyMuse': 'Muse…',
    'project.busyPlanning': 'Planning…',
    'project.busyDesign': 'Direction…',
    'project.museStageDossier': 'Gathering inspiration & writing the dossier…',
    'project.museStageInspiration': 'Generating the inspiration image…',
    'project.museStageHero': 'Generating the hero image…',
    'project.museStageMedia': 'Reading your media (palette, mood)…',

    // ---- animations (three-state override) ----
    'project.animAuto': '✦ Animations auto',
    'project.animOn': '✦ Animations forced',
    'project.animOff': '✦ No animation',
    'project.animHintAuto':
      'Mocky decides from the screen you asked for — a landing page breathes, an admin table holds still. Click to force.',
    'project.animHintOn': 'Every generated screen will be animated. Click to switch them off.',
    'project.animHintOff':
      'No animation, even where the screen would suit it — useful for a demo or a recording. Click to go back to automatic.',

    // ---- play ONE screen's animations, or not (context menu) ----
    'project.playAnimations': 'Play animations',
    'project.playAuto': 'Auto',
    'project.playOn': 'Yes',
    'project.playOff': 'No',
    'project.playAutoTitle': 'Follows the composer switch.',
    'project.playOnTitle': 'This screen animates, even when the composer says no animation.',
    'project.playOffTitle': 'This screen holds still, even when the composer allows animations.',
    'project.museStageVideo': 'Generating the video (30 s to 3 min)…',
    'project.museVideoFailed': 'The video could not be generated: {detail}. The screen is produced without a sequence.',
    'project.museNoImage': 'the dossier proposed no image',
    'project.briefImageFailed': 'No image generated — {reason}',
    'project.briefBackend': 'Mocky backend required',
    'project.briefPinned_one': '1 pinned image',
    'project.briefPinned_other': '{count} pinned images',
    'project.briefDefault': 'Inspiration, art direction and real copy',

    // ---- element editor (Modify) ----
    'project.element': 'Element',
    'project.elementWord': 'element',
    'project.selectedWord': 'Selected',
    'project.text': 'Text',
    'project.textUpdate': 'Update',
    'project.recolor': 'Recolor',
    'project.fromYourDesign': 'From your design',
    'project.basics': 'Basic colors',
    'project.recolorTo': 'Recolor to {name}',
    'project.recolorToHex': 'Recolor to {name} ({hex})',
    'project.customHex': 'Custom hex color',
    'project.applyHex': 'Apply this color',
    'project.go': 'Go',
    'project.orDescribe': 'Or describe any change',
    'project.modifyPlaceholder': 'e.g. “make it bigger and bold”, “add a shadow”, “round the corners”…',
    'project.applyChange': 'Apply change',
    'project.modifyNote':
      'Text changes apply instantly when they are unique · other changes go through the model · everything is revertable from the screen menu',

    // ---- recolor swatches ----
    'project.colorInk': 'Ink',
    'project.colorWhite': 'White',
    'project.colorRed': 'Red',
    'project.colorAmber': 'Amber',
    'project.colorGreen': 'Green',
    'project.colorBlue': 'Blue',
    'project.colorIndigo': 'Indigo',
    'project.colorFuchsia': 'Fuchsia',

    // ---- screen context menu ----
    'project.regenerate': 'Regenerate (new variant)',
    'project.copyOf': '{name} (copy)',
    'project.screenNamePrompt': 'Screen name',
    'project.showCode': 'Show code',
    'project.pinReference': 'Pin as layout reference',
    'project.unpinReference': 'Unpin as reference',
    'project.editDesign': 'Edit DESIGN.md',
    'project.changeImages': 'Change the images…',
    'project.deriveDesign': 'Make this screen my DESIGN.md',
    'project.applyDesignConfirm':
      'Make the DESIGN.md recorded with “{name}” this project’s direction? Later screens will follow it; the current direction stays reachable from the screens that used it.',
    'project.deriveDesignBusy': 'Reading the screen…',
    'project.deriveDesignConfirm':
      'Make the design of “{name}” this project’s direction? Later screens will follow it; the current direction stays reachable from the screens that used it.',
    'project.deriveDesignEmpty': 'This screen has no code to read yet.',
    'project.deriveDesignEmptyResult': 'The model returned nothing. Try again, or pick a more finished screen.',
    'project.displayFormat': 'Display format',
    'project.formatMobile': 'Mobile',
    'project.formatTablet': 'Tablet',
    'project.formatDesktop': 'Desktop',
    'project.formatFull': 'Full',
    'project.formatFullTitle': 'Full height (fit content)',
    'project.formatOf': '{name} format',
    'project.addAnimations': 'Add animations',
    'project.animSubtle': 'Subtle',
    'project.animModerate': 'Moderate',
    'project.animRich': 'Rich',
    'project.animTitle': 'Add {level} motion (keeps content & layout; revertable)',
    'project.deleteScreenConfirm': 'Delete this screen?',

    // ---- code viewer ----
    'project.codeKicker': 'Code',
    'project.closeCode': 'Close the code viewer',

    // ---- in-flight labels ----
    'project.addingMotion': 'Adding motion…',
    'project.updating': 'Updating…',

    // ---- errors ----
    'project.noModel': 'No model set. Open Settings and pick a model first.',
    'project.captureFailed': 'Screenshot failed — try again, or select a smaller area.',
    'project.exportEmpty': 'Add at least one screen before exporting.',
    'project.truncated':
      'The model hit its token limit: the screen is incomplete. Ask for a simpler screen (fewer sections), or use a model with a longer output.',
    'project.slop': 'Generic placeholder text detected ({list}). Regenerate for a clean result.',
    // ---- quality pass ----
    'project.polish': 'Polish (detect and correct)',
    'project.polishing': 'Checking the screen…',
    'project.polishingPass': 'Correction {i} — {n} issue(s) to address',
    'project.polishClean': 'Nothing to address — {score}/20.',
    'project.polishFixed': 'Screen polished — {score}/20. Fixed: {list}.',
    'project.polishResidual':
      'Still open ({score}/20): {list}. Run Polish again, or adjust the direction.',
    'project.polishFailed':
      'The quality pass did not complete. The screen is untouched — try again, or check the model in settings.',

    // ---- starter examples ----
    'project.example1': 'A SaaS pricing page with three tiers and a monthly/yearly toggle',
    'project.example2': 'A mobile login screen with email, password and social sign-in',
    'project.example3': 'An analytics dashboard with stat cards, a chart and an activity list',
  } as Record<string, string>,
}
