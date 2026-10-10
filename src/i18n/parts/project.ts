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
    // ---- documents ----
    'project.docDownload': 'Télécharger…',
    'project.docOverflow':
      'Dans « {name} », le contenu dépasse de la page {pages} : il serait coupé à l’impression. Clic droit sur le document › « Ajuster à la page », ou demandez une page de plus.',
    'project.docOverflowMany':
      'Dans « {name} », le contenu dépasse des pages {pages} : il serait coupé à l’impression. Clic droit sur le document › « Ajuster à la page », ou demandez une page de plus.',
    'project.docFit': 'Ajuster à la page',
    'project.docFitting': 'Ajustement à la page…',
    'project.docFitMeasuring': 'Mesure du dépassement…',
    'project.docFitDone': '« {name} » tient maintenant dans sa page.',
    'project.docFitCloser':
      '« {name} » dépasse encore de {px} px (page {pages}). Relancez « Ajuster à la page » depuis le clic droit, ou raccourcissez le texte.',
    'project.docFitRejected':
      'L’ajustement n’a pas fait tenir « {name} » dans sa page : le document est resté tel quel. Raccourcissez le texte ou demandez une page de plus.',
    'project.docFitNothing': 'Rien ne dépasse de « {name} » : il n’y avait rien à ajuster.',
    'project.docFitFailed': 'L’ajustement de « {name} » a échoué : le document est resté tel quel.',
    'project.docUltraSkipped':
      'Motion Ultra ne s’applique pas aux documents : une page imprimée ne bouge pas. Le document est généré sans.',
    'project.docPictureMissing':
      'Aucune image n’a pu être trouvée pour ce document ({reason}) : une composition de formes en tient lieu.',
    'project.exportDocsOnly':
      'Ce projet ne contient que des documents : ils se téléchargent un par un, avec leur bouton « Télécharger ».',
    'project.exportDocsSkipped': 'Les documents ne sont pas inclus dans le projet React : utilisez leur bouton « Télécharger ».',
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
    // ---- composer: screenshots of an existing site ----
    'project.siteAttach': 'Joindre des captures d’un site',
    'project.siteAttachShort': 'Captures d’un site',
    'project.siteAttachTitle':
      'Joindre des captures d’un site existant, pour le reproduire ou en faire la refonte. Vous pouvez aussi les coller dans le champ ou les déposer sur la barre.',
    'project.sitePlaceholder': 'Précisez si besoin (quelle page, ce qui compte)… ou générez directement',
    'project.siteModeLabel': 'Que faire de ce site',
    'project.siteReproduce': 'Reproduire',
    'project.siteRedesign': 'Refonte',
    'project.siteReproduceHint':
      'Même mise en page, mêmes textes, mêmes couleurs. Muse et la direction du projet ne s’appliquent pas.',
    'project.siteRedesignHint':
      'Mêmes contenus, nouveau design : celui de la direction du projet, ou de Muse si elle est active.',
    'project.siteEditHint': 'Captures jointes comme références : dites ce qu’il faut en reprendre.',
    'project.siteShotN': 'Capture {n}',
    'project.siteShotParts': 'Page longue, découpée en {count} morceaux pour rester lisible',
    'project.siteRemove': 'Retirer cette capture',
    'project.siteRemoveN': 'Retirer la capture {n}',
    'project.siteReading': 'Lecture de la capture…',
    'project.siteDefaultReproduce': 'Reproduis ce site',
    'project.siteDefaultRedesign': 'Refonte graphique de ce site',
    'project.siteNotImage': 'Seules les images PNG, JPEG, WebP ou GIF peuvent servir de capture.',
    'project.siteTooLarge': 'Cette image dépasse 30 Mo : ce n’est sans doute pas une capture d’écran.',
    'project.siteFull': 'Assez de captures pour une demande : 4 au plus, et 8 morceaux de page en tout.',
    'project.siteUnreadable': 'Cette image n’a pas pu être lue.',
    'project.siteNoVision':
      'Le modèle actif ne lit pas les images : il ne pourrait pas voir les captures. Choisissez un modèle avec vision dans Réglages.',
    'project.siteUltraSkipped':
      'Motion Ultra n’est pas appliqué à un écran fait d’après un site : son storyboard inventerait des sections que le site a déjà.',
    'project.siteMuseSkipped':
      'Le contenu du site n’a pas pu être lu : Muse n’a pas tourné, pour ne pas inventer un autre produit. La refonte suit la direction du projet.',
    'project.sitePicturesMissing':
      '{missing} image(s) du site sur {total} sans remplaçante ({reason}) : un bloc de couleur tient leur place.',
    'project.siteRegenGone':
      'Cet écran a été fait d’après des captures qui ne sont plus en mémoire — elles ne sont jamais enregistrées. Joignez-les de nouveau au composer pour le refaire.',
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
    'project.busySite': 'Lecture du site…',
    'project.busySitePictures': 'Images du site…',
    'project.busyDocPicture': 'Image du document…',
    'project.busyDesign': 'Direction…',
    'project.museStageDossier': 'Inspiration & rédaction du dossier…',
    'project.museStageInspiration': 'Génération de l’image d’inspiration…',
    'project.museStageHero': 'Génération de l’image héro…',
    'project.museStageStock': 'Recherche de photos libres de droits…',
    'project.imageSource': 'Images',
    'project.imageSourceAi': 'IA',
    'project.imageSourceAiTitle': 'Les images de Muse et de Motion Ultra sont générées par le modèle d’image configuré',
    'project.imageSourceStock': 'Libres',
    'project.imageSourceStockTitle':
      'Les images de Muse et de Motion Ultra sont de vraies photos libres de droits (Pexels, Pixabay), trouvées d’après le sujet de chaque image — gratuites, rien n’est généré',
    'project.imageSourceNone': 'Aucune',
    'project.imageSourceNoneTitle':
      'Aucune nouvelle image : rien n’est généré ni pris dans les banques libres. Les images déjà utilisées dans le projet restent proposées à l’écran.',
    'project.docImage': 'Image',
    'project.docImageNone': 'Sans image',
    'project.docImageNoneTitle': 'Le document est composé de formes et de couleurs, sans photo — rien n’est cherché ni généré',
    'project.docImageAi': 'Générée',
    'project.docImageAiTitle': 'Une image est générée pour le document par le modèle d’image configuré (peut être payant)',
    'project.docImageStock': 'Photo libre',
    'project.docImageStockTitle': 'Une vraie photo libre de droits (Pexels, Pixabay) est trouvée d’après le sujet du document — gratuite, rien n’est généré',
    'project.museStageMedia': 'Lecture de votre média (palette, ambiance)…',

    // ---- Motion Ultra (réglage projet, pause dans le composer) ----
    'project.autoReverted': '« {name} » ne s’affichait plus après la dernière modification et la réparation automatique n’y est pas arrivée : l’écran a été remis à sa version précédente, sans appel supplémentaire. « Revenir à la version précédente » rouvre la version cassée si vous voulez repartir d’elle.',
    'project.ultraChip': 'Motion Ultra',
    'project.ultraPaused': 'en pause',
    'project.ultraEnableTitle':
      'Activer Motion Ultra pour ce projet : chaque nouvel écran est storyboardé, illustré par une série d’images générées ensemble et mis en mouvement (fonds vivants, verre, typographie géante).',
    'project.ultraActiveTitle':
      'Motion Ultra est actif pour ce projet. Cliquez pour le mettre en pause pour les prochaines générations.',
    'project.ultraPausedTitle':
      'Motion Ultra est en pause dans ce composer — les prochains écrans seront générés normalement. Cliquez pour le reprendre.',
    'project.ultraCountTitle': '{count} images générées par écran — environ {minutes} min d’attente en plus, et {count} images facturées par votre fournisseur.',
    'project.ultraDisable': 'Désactiver Motion Ultra pour ce projet',
    'project.ultraCost': '≈ +{minutes} min',
    'project.ultraVideo': 'Fond vidéo',
    'project.ultraVideoCost': '+1–3 min',
    'project.ultraVideoTitle': 'Une section de chaque nouvel écran reçoit un fond vidéo : un film Motion Ultra fabriqué par votre machine à partir des images de la série — aucune vidéo facturée, un appel au modèle de texte et 1 à 3 minutes de rendu en plus.',
    'project.ultraFilmStage': 'Motion Ultra — fond vidéo : {step}…',
    'project.ultraFilmCompose': 'composition',
    'project.ultraFilmRender': 'rendu (1 à 3 min)',
    'project.ultraFilmUnavailable': 'Motion Ultra : le rendu vidéo n’est pas disponible en ce moment (module Motion Ultra arrêté ou non activé pour votre compte) ; l’écran garde ses fonds animés.',
    'project.ultraFilmNoSection': 'Motion Ultra : aucune section de cet écran ne se prête à un fond vidéo, il n’a pas été fabriqué.',
    'project.ultraFilmNoSlot': 'Motion Ultra : le fond vidéo a été fabriqué mais la page ne lui a pas réservé de place ; il est attaché à l’écran (carte à côté du cadre).',
    'project.ultraFilmFailed': 'Motion Ultra : le fond vidéo n’a pas pu être fabriqué ({detail}). La section garde son fond animé.',
    'project.legibility': '{count} texte(s) posé(s) sur une image se lisent mal ({list}). « Modifier » peut ajouter un voile ou un fond derrière eux.',
    'project.ultraLegibility': 'Motion Ultra : {count} texte(s) posé(s) sur une image se lisent mal ({list}). « Modifier » peut ajouter un voile ou un fond derrière eux.',
    'project.ultraTooMuchMotion': 'Motion Ultra : cette page anime beaucoup à la fois ({backdrops} fond(s) animé(s) pour {maxBackdrops} conseillés, {loops} animation(s) en boucle pour {maxLoops}). Elle peut ramer sur le canevas ; « Modifier » peut en retirer.',
    'project.ultraStageStoryboard': 'Motion Ultra — storyboard…',
    'project.ultraStageImages': 'Motion Ultra — images {done}/{total}…',
    'project.ultraImagesMissing': 'Motion Ultra : {made} image(s) sur {total} ont pu être générées ({reason}). Les sections concernées utilisent un fond animé à la place.',
    'project.ultraUnusedImages': 'Motion Ultra : {count} image(s) sur {total} générées pour cet écran n’y apparaissent pas. Elles restent disponibles dans Média.',
    'project.ultraEditLoss': 'Cette modification a retiré {what} de « {name} ». « Revenir à la version précédente », dans le menu de l’écran, le rétablit.',
    'project.ultraLossImages': '{count} image(s) Motion Ultra',
    'project.ultraLossKit': 'le style Motion Ultra',
    'project.ultraLossAnd': ' et ',

    // ---- animations (interrupteur à trois états) ----

    // ---- lire ou non les animations d'UN écran (menu contextuel) ----
    'project.playAnimations': 'Lire les animations',
    'project.playOn': 'Oui',
    'project.playOff': 'Non',
    'project.playOnTitle': 'Cet écran s’anime (par défaut).',
    'project.playOffTitle': 'Cet écran ne bouge pas — utile pour une démo ou une capture.',
    'project.museStageVideo': 'Génération de la vidéo (30 s à 3 min)…',
    'project.museVideoFailed': 'La vidéo n’a pas pu être générée : {detail}. L’écran est produit sans séquence.',
    // Motion : deux étapes parce qu’elles ratent différemment. La composition
    // est un appel modèle qui peut refuser en une phrase ; le rendu est une
    // attente. Une seule ligne pour les deux laisserait l’utilisateur devant
    // « en cours » sans savoir laquelle il regarde.
    // Le type que le dossier a choisi, dit sur le badge : c'est la seule trace
    // visible d'une décision que personne n'a prise à la main.
    'project.motionStageRender': 'Film Motion Ultra — rendu, 1 à 3 min… ne quittez pas la page',
    'project.motionStageRevise': 'Film Motion Ultra — modification… ne quittez pas la page',
    'project.motionRevise': 'Modifier le film Motion Ultra…',
    'project.motionReviseTitle': 'Modifier le film Motion Ultra',
    'project.motionReviseBlurb':
      'Dites ce qui doit changer : le reste du film est gardé tel quel. Le nouveau rendu prend 1 à 3 minutes, puis remplace l’ancien film au même endroit — « Revenir à la version précédente » le remet.',
    'project.motionReviseLabel': 'Ce qui doit changer',
    'project.motionReviseHint':
      'Pour une couleur, dites à quoi elle sert : fond, texte ou accent. Ctrl + Entrée pour envoyer.',
    'project.motionRevisePlaceholder': 'Un fond bleu nuit, un titre plus court, un rythme plus lent…',
    'project.motionReviseSubmit': 'Modifier le film',
    'project.motionReviseUnchanged':
      'Le film est revenu identique, donc rien n’a été refait. Pour une couleur, précisez à quoi elle sert : « fond bleu », « texte blanc », « accent orange ».',
    'project.motionReviseDetached':
      'Le nouveau film est prêt et rattaché à l’écran, mais la page ne contient plus l’ancien film à remplacer : ajoutez-le depuis Médias.',
    'project.motionLeaveConfirm':
      'Un film Motion Ultra est en cours. Le rendu se termine côté serveur et le film sera dans Média, mais il ne sera PAS inséré dans l’écran si vous partez maintenant. Quitter quand même ?',
    'project.motionFailed':
      'Le film Motion Ultra n’a pas pu être produit : {detail}. L’écran est produit sans film.',
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
    // « Médias » et pas « images » : l'entrée de menu et le titre de la modale
    // doivent porter le même nom, et le mot d'ensemble de la médiathèque est
    // « média ». La clé reste `changeImages`, comme `video.*` reste `video` —
    // renommer une clé ne change rien à ce qui se lit.
    'project.changeImages': 'Changer les médias…',
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
    // ---- documents ----
    'project.docDownload': 'Download…',
    'project.docOverflow':
      'In “{name}”, the content runs past the edge of page {pages}: it would be cut off in print. Right-click the document › “Fit to page”, or ask for one more page.',
    'project.docOverflowMany':
      'In “{name}”, the content runs past the edge of pages {pages}: it would be cut off in print. Right-click the document › “Fit to page”, or ask for one more page.',
    'project.docFit': 'Fit to page',
    'project.docFitting': 'Fitting to the page…',
    'project.docFitMeasuring': 'Measuring the overflow…',
    'project.docFitDone': '“{name}” now fits its page.',
    'project.docFitCloser':
      '“{name}” still runs {px} px past the edge (page {pages}). Run “Fit to page” again from the right-click menu, or shorten the text.',
    'project.docFitRejected':
      'The fit did not make “{name}” fit its page: the document was left as it was. Shorten the text or ask for one more page.',
    'project.docFitNothing': 'Nothing runs past the edge of “{name}”: there was nothing to fit.',
    'project.docFitFailed': 'Fitting “{name}” failed: the document was left as it was.',
    'project.docUltraSkipped':
      'Motion Ultra does not apply to documents: a printed page does not move. The document is generated without it.',
    'project.docPictureMissing':
      'No picture could be found for this document ({reason}): a composition of shapes stands in.',
    'project.exportDocsOnly': 'This project only holds documents: download them one by one, with their “Download” button.',
    'project.exportDocsSkipped': 'Documents are not part of the React project: use their “Download” button.',
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
    // ---- composer: screenshots of an existing site ----
    'project.siteAttach': 'Attach screenshots of a site',
    'project.siteAttachShort': 'Site screenshots',
    'project.siteAttachTitle':
      'Attach screenshots of an existing site, to reproduce it or to redesign it. You can also paste them into the field or drop them on the bar.',
    'project.sitePlaceholder': 'Add details if needed (which page, what matters)… or just generate',
    'project.siteModeLabel': 'What to do with this site',
    'project.siteReproduce': 'Reproduce',
    'project.siteRedesign': 'Redesign',
    'project.siteReproduceHint':
      'Same layout, same copy, same colours. Muse and the project’s direction do not apply.',
    'project.siteRedesignHint':
      'Same content, new design: the project’s direction, or Muse’s when it is on.',
    'project.siteEditHint': 'Screenshots attached as references: say what to take from them.',
    'project.siteShotN': 'Screenshot {n}',
    'project.siteShotParts': 'Long page, cut into {count} parts to stay legible',
    'project.siteRemove': 'Remove this screenshot',
    'project.siteRemoveN': 'Remove screenshot {n}',
    'project.siteReading': 'Reading the screenshot…',
    'project.siteDefaultReproduce': 'Reproduce this site',
    'project.siteDefaultRedesign': 'Redesign this site',
    'project.siteNotImage': 'Only PNG, JPEG, WebP or GIF images can be used as screenshots.',
    'project.siteTooLarge': 'This image is over 30 MB — probably not a screenshot.',
    'project.siteFull': 'That is enough screenshots for one request: 4 at most, and 8 page parts in all.',
    'project.siteUnreadable': 'This image could not be read.',
    'project.siteNoVision':
      'The active model does not read images, so it could not see the screenshots. Pick a vision model in Settings.',
    'project.siteUltraSkipped':
      'Motion Ultra is not applied to a screen built from a site: its storyboard would invent sections the site already has.',
    'project.siteMuseSkipped':
      'The site’s content could not be read, so Muse did not run rather than invent another product. The redesign follows the project’s direction.',
    'project.sitePicturesMissing':
      '{missing} of the site’s {total} pictures got no replacement ({reason}): a colour block stands in.',
    'project.siteRegenGone':
      'This screen was built from screenshots that are no longer in memory — they are never saved. Attach them again in the composer to redo it.',
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
    'project.busySite': 'Reading the site…',
    'project.busySitePictures': 'Site pictures…',
    'project.busyDocPicture': 'Document picture…',
    'project.busyDesign': 'Direction…',
    'project.museStageDossier': 'Gathering inspiration & writing the dossier…',
    'project.museStageInspiration': 'Generating the inspiration image…',
    'project.museStageHero': 'Generating the hero image…',
    'project.museStageStock': 'Finding free stock photos…',
    'project.imageSource': 'Images',
    'project.imageSourceAi': 'AI',
    'project.imageSourceAiTitle': 'Muse and Motion Ultra pictures are generated by the configured image model',
    'project.imageSourceStock': 'Free',
    'project.imageSourceStockTitle':
      'Muse and Motion Ultra pictures are real free stock photos (Pexels, Pixabay), found from each picture’s subject — free of charge, nothing is generated',
    'project.imageSourceNone': 'None',
    'project.imageSourceNoneTitle':
      'No new picture: nothing is generated or taken from the free libraries. The pictures this project already uses are still offered to the screen.',
    'project.docImage': 'Picture',
    'project.docImageNone': 'No picture',
    'project.docImageNoneTitle': 'The document is composed of shapes and colour, with no photo — nothing is searched for or generated',
    'project.docImageAi': 'Generated',
    'project.docImageAiTitle': 'One picture is generated for the document by the configured image model (may be paid)',
    'project.docImageStock': 'Free photo',
    'project.docImageStockTitle': 'One real free stock photo (Pexels, Pixabay) is found from the document’s subject — free of charge, nothing is generated',
    'project.museStageMedia': 'Reading your media (palette, mood)…',

    // ---- Motion Ultra (project setting, paused from the composer) ----
    'project.autoReverted': '“{name}” stopped rendering after the last change and the automatic repair could not fix it: the screen was put back to its previous version, at no extra cost. “Revert to the previous version” reopens the broken one if you want to work from it.',
    'project.ultraChip': 'Motion Ultra',
    'project.ultraPaused': 'paused',
    'project.ultraEnableTitle':
      'Turn Motion Ultra on for this project: every new screen is storyboarded, illustrated with a series of pictures generated together, and set in motion (living backgrounds, glass, display type).',
    'project.ultraActiveTitle':
      'Motion Ultra is on for this project. Click to pause it for the next generations.',
    'project.ultraPausedTitle':
      'Motion Ultra is paused in this composer — the next screens are generated normally. Click to resume it.',
    'project.ultraCountTitle': '{count} pictures generated per screen — about {minutes} more minutes of waiting, and {count} pictures billed by your provider.',
    'project.ultraDisable': 'Turn Motion Ultra off for this project',
    'project.ultraCost': '≈ +{minutes} min',
    'project.ultraVideo': 'Video background',
    'project.ultraVideoCost': '+1–3 min',
    'project.ultraVideoTitle': 'One section of each new screen gets a video background: a Motion Ultra film made by your own machine from the series’ pictures — no video is billed, one text-model call and 1 to 3 minutes of rendering on top.',
    'project.ultraFilmStage': 'Motion Ultra — video background: {step}…',
    'project.ultraFilmCompose': 'composing',
    'project.ultraFilmRender': 'rendering (1 to 3 min)',
    'project.ultraFilmUnavailable': 'Motion Ultra: video rendering is not available right now (Motion Ultra worker stopped, or not enabled for your account); the screen keeps its animated backgrounds.',
    'project.ultraFilmNoSection': 'Motion Ultra: no section of this screen suits a video background, so none was made.',
    'project.ultraFilmNoSlot': 'Motion Ultra: the video background was made but the page kept no place for it; it is attached to the screen (card beside the frame).',
    'project.ultraFilmFailed': 'Motion Ultra: the video background could not be made ({detail}). The section keeps its animated background.',
    'project.legibility': '{count} piece(s) of text laid over a picture are hard to read ({list}). “Edit” can add a veil or a panel behind them.',
    'project.ultraLegibility': 'Motion Ultra: {count} piece(s) of text laid over a picture are hard to read ({list}). “Edit” can add a veil or a panel behind them.',
    'project.ultraTooMuchMotion': 'Motion Ultra: this page moves a lot at once ({backdrops} animated background(s) for {maxBackdrops} advised, {loops} looping animation(s) for {maxLoops}). It may stutter on the canvas; “Edit” can take some out.',
    'project.ultraStageStoryboard': 'Motion Ultra — storyboard…',
    'project.ultraStageImages': 'Motion Ultra — pictures {done}/{total}…',
    'project.ultraImagesMissing': 'Motion Ultra: {made} of {total} pictures could be generated ({reason}). The sections that wanted them use an animated background instead.',
    'project.ultraUnusedImages': 'Motion Ultra: {count} of the {total} pictures generated for this screen do not appear in it. They are still in Media.',
    'project.ultraEditLoss': 'This change removed {what} from “{name}”. “Revert to the previous version”, in the screen’s menu, brings it back.',
    'project.ultraLossImages': '{count} Motion Ultra picture(s)',
    'project.ultraLossKit': 'the Motion Ultra style',
    'project.ultraLossAnd': ' and ',

    // ---- animations (three-state override) ----

    // ---- play ONE screen's animations, or not (context menu) ----
    'project.playAnimations': 'Play animations',
    'project.playOn': 'Yes',
    'project.playOff': 'No',
    'project.playOnTitle': 'This screen animates (the default).',
    'project.playOffTitle': 'This screen holds still — useful for a demo or a recording.',
    'project.museStageVideo': 'Generating the video (30 s to 3 min)…',
    'project.museVideoFailed': 'The video could not be generated: {detail}. The screen is produced without a sequence.',
    // The kind the dossier chose, said on the badge: the only visible trace of a
    // decision nobody made by hand.
    'project.motionStageRender': 'Motion Ultra film — rendering, 1 to 3 min… do not leave the page',
    'project.motionStageRevise': 'Motion Ultra film — revising… do not leave the page',
    'project.motionRevise': 'Revise the Motion Ultra film…',
    'project.motionReviseTitle': 'Revise the Motion Ultra film',
    'project.motionReviseBlurb':
      'Say what should change: the rest of the film is kept as it is. The new render takes 1 to 3 minutes, then replaces the old film in the same place — “Revert to previous version” brings it back.',
    'project.motionReviseLabel': 'What should change',
    'project.motionReviseHint': 'For a colour, say what it is for: background, text or accent. Ctrl + Enter to send.',
    'project.motionRevisePlaceholder': 'A dark blue background, a shorter title, a slower pace…',
    'project.motionReviseSubmit': 'Revise the film',
    'project.motionReviseUnchanged':
      'The film came back identical, so nothing was rendered again. For a colour, say what it is for: “blue background”, “white text”, “orange accent”.',
    'project.motionReviseDetached':
      'The new film is ready and attached to the screen, but the page no longer contains the old film to replace: add it from Media.',
    'project.motionLeaveConfirm':
      'A Motion Ultra film is in progress. The render finishes on the server and the film will be in Media, but it will NOT be placed in the screen if you leave now. Leave anyway?',
    'project.motionFailed':
      'The Motion Ultra film could not be produced: {detail}. The screen is produced without a film.',
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
    // “Media”, not “images”: the menu entry and the dialog's own title have to
    // read the same, and the library's collective word is media. The key stays
    // `changeImages`, the way `video.*` stays `video` — renaming a key changes
    // nothing anybody reads.
    'project.changeImages': 'Change the media…',
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
