/**
 * Translations for the "audit" area — the SEO and accessibility panel.
 *
 * One file per area so several people (or agents) can add strings at once
 * without ever touching the same file. `parts/index.ts` merges them all.
 *
 * Rules:
 *  - the key set of `fr` and `en` must match exactly — a test enforces it;
 *  - keys are `audit.something`, so an area can never collide with another;
 *  - placeholders are `{name}`.
 *
 * The rule names and descriptions below are the ones `src/lib/audit/rules.ts`
 * points at by KEY rather than by sentence: the report is read in two languages,
 * so a finding cannot carry its own prose.
 */
export const audit = {
  fr: {
    // ---- the panel ----
    'audit.title': 'SEO et accessibilité',
    'audit.open': 'Évaluer le SEO et l’accessibilité',
    'audit.pickScreen': 'Choisir un écran',
    'audit.run': 'Évaluer',
    'audit.running': 'Analyse…',
    'audit.rerun': 'Réévaluer',
    'audit.deep': 'Analyse approfondie',
    'audit.deepHelp':
      'Pose en plus à un modèle les questions qu’une règle ne peut pas trancher : le texte alternatif décrit-il l’image, le titre décrit-il la section. Consomme des jetons.',
    'audit.seo': 'SEO',
    'audit.a11y': 'Accessibilité',
    'audit.noScreens': 'Ce projet n’a pas encore d’écran à évaluer.',
    'audit.notRun': 'Aucune évaluation pour cet écran. Cliquez sur « Évaluer ».',
    'audit.clean': 'Rien à signaler sur ce que cette analyse peut voir.',
    'audit.unparsed':
      'Le code de cet écran n’a pas pu être lu, donc rien n’a été vérifié. Corrigez l’erreur affichée sur l’écran, puis réessayez.',
    'audit.findings': 'Points relevés',
    'audit.advisoryNote': 'Indicatif — non corrigé automatiquement',
    'audit.judged': 'Jugé par le modèle',
    'audit.fixOne': 'Corriger',
    'audit.fixAll': 'Tout corriger',
    'audit.fixing': 'Correction…',
    'audit.fixedCount': '{n} point(s) corrigé(s).',
    'audit.fixedNone': 'La correction n’a rien changé. Réessayez, ou corrigez à la main.',
    'audit.fixFailed': 'La correction a échoué.',
    'audit.fixNothing': 'Rien de corrigeable automatiquement ici.',

    // ---- what the score does NOT cover (invariant Q4) ----
    'audit.confidence': 'Analyse du code seul',
    // Réécrit quand les règles de couleur et de cibles tactiles sont arrivées :
    // la phrase disait « le contraste n’est pas mesuré », ce qui est devenu faux
    // par endroits et resté vrai partout ailleurs. Une note d’honnêteté qui
    // sous-estime la couverture ment autant qu’une qui la surestime.
    'audit.confidenceNote':
      'Cette note porte sur le balisage et sur ce que les classes déclarent. Le contraste n’est vérifié que là où la couleur du texte ET celle du fond sont posées sur le même élément ; partout ailleurs il ne l’est pas. La hauteur des cibles tactiles est déduite des classes, jamais mesurée. La visibilité du focus et l’ordre de tabulation à l’écran dépendent du rendu et ne sont pas regardés. Une note de 100 ne signifie donc pas « conforme ».',

    // ---- rule families ----
    'audit.family.headings': 'Titres',
    'audit.family.images': 'Images',
    'audit.family.links': 'Liens et contrôles',
    'audit.family.forms': 'Formulaires',
    'audit.family.color': 'Couleur',
    'audit.family.typography': 'Typographie',
    'audit.family.targets': 'Cibles tactiles',
    'audit.family.landmarks': 'Structure',

    // ---- the breakdown by family ----
    'audit.families': 'Par famille',
    'audit.familiesBlurb':
      'Les mêmes points relevés, regroupés par sujet pour voir où intervenir. Ce détail s’ajoute aux deux notes ci-dessus, il ne les remplace pas.',
    'audit.family.failing': '{n} en défaut',
    // Deux mots différents pour deux faits différents, et aucun des deux n’est
    // une note de 100 : « sans objet » veut dire qu’il n’y avait rien à
    // examiner, « non mesuré » qu’il y avait quelque chose et que le code n’en
    // dit pas assez.
    'audit.family.notApplicable': 'sans objet',
    'audit.family.notMeasured': 'non mesuré',
    'audit.family.notApplicableNote':
      '« Sans objet » : cet écran ne contient rien que ces règles puissent examiner — aucune image, aucun formulaire. Il n’y a donc pas de note à donner, et surtout pas un 100.',
    'audit.family.notMeasuredNote':
      '« Non mesuré » : il y avait bien quelque chose à examiner, mais la source ne permet pas de conclure — un fond de couleur hérité d’un élément parent, par exemple. Là encore, pas de note, et surtout pas un 100.',
    'audit.family.confidence.high': 'Confiance élevée',
    'audit.family.confidence.medium': 'Confiance moyenne',
    'audit.family.confidence.low': 'Confiance basse',
    'audit.family.why.markup':
      'ce sont des faits de balisage, entièrement lisibles dans le source.',
    'audit.family.why.colorPairs':
      'seuls les éléments qui posent eux-mêmes leur couleur de texte ET leur fond ont pu être comparés ; ailleurs, rien n’est vérifié.',
    'audit.family.why.deduced':
      'déduit des classes déclarées — tailles, interlignes, padding — jamais mesuré sur un rendu.',

    // ---- the exported document ----
    'audit.exportSection': 'Document exporté',
    'audit.exportBlurb':
      'Un écran Mocky est un composant : il n’a ni titre, ni langue, ni description. Ces trois-là n’existent que dans le HTML produit par l’export, et valent pour tout le projet.',
    'audit.exportClean': 'Le HTML exporté déclare un titre, une langue et une description.',

    // ---- rule catalogue ----
    'audit.rule.imgAlt': 'Image sans texte alternatif',
    'audit.rule.imgAltDesc':
      'Ajoutez un attribut alt décrivant ce que montre l’image. Une image purement décorative prend alt="" — c’est une réponse correcte, pas un oubli.',
    'audit.rule.imgAltRedundant': 'Texte alternatif qui ne décrit rien',
    'audit.rule.imgAltRedundantDesc':
      'Un alt qui dit « image » ou « photo » répète ce que l’élément est déjà. Décrivez ce qu’on y voit.',
    'audit.rule.imgMeaningfulEmptyAlt': 'Image légendée avec un alt vide',
    'audit.rule.imgMeaningfulEmptyAltDesc':
      'alt="" annonce une image décorative, mais celle-ci est dans un figure ou porte une légende : elle fait donc partie du contenu. Décrivez ce qu’on y voit, sans recopier la légende.',
    'audit.rule.imgNoDimensions': 'Image sans dimensions déclarées',
    'audit.rule.imgNoDimensionsDesc':
      'Sans attributs width et height ni classe aspect-*, le navigateur ne réserve aucune place pour l’image et tout ce qui suit saute au chargement. Ajoutez width et height, ou une classe aspect-*.',
    'audit.rule.missingH1': 'Aucun titre de premier niveau',
    'audit.rule.missingH1Desc':
      'L’écran a des titres mais aucun h1. C’est le titre que les moteurs lisent en premier et celui par lequel un lecteur d’écran commence.',
    'audit.rule.multipleH1': 'Plusieurs titres de premier niveau',
    'audit.rule.multipleH1Desc': 'Un seul h1 par page : au-delà, plus rien n’indique de quoi la page parle.',
    'audit.rule.skippedHeading': 'Niveau de titre sauté',
    'audit.rule.skippedHeadingDesc':
      'La hiérarchie passe un niveau (h1 puis h3). Un lecteur d’écran l’annonce comme une section manquante. Changez le niveau, pas la taille : reportez les classes.',
    'audit.rule.emptyHeading': 'Titre vide',
    'audit.rule.emptyHeadingDesc': 'Un titre sans texte est annoncé comme un titre vide, et n’indexe rien.',
    'audit.rule.controlNoName': 'Bouton ou lien sans nom',
    'audit.rule.controlNoNameDesc':
      'Un contrôle qui n’affiche qu’une icône est annoncé « bouton », sans plus. Donnez-lui un aria-label.',
    'audit.rule.genericLink': 'Texte de lien qui ne dit pas où il mène',
    'audit.rule.genericLinkDesc':
      '« En savoir plus » ne dit rien à un moteur, ni à un lecteur d’écran qui liste les liens hors de leur phrase.',
    'audit.rule.inputNoLabel': 'Champ sans étiquette',
    'audit.rule.inputNoLabelDesc':
      'Un placeholder n’est pas une étiquette : il disparaît à la saisie. Associez un label, ou un aria-label.',
    'audit.rule.clickableDiv': 'Élément cliquable inaccessible au clavier',
    'audit.rule.clickableDivDesc':
      'Un div avec onClick n’est ni focusable ni annoncé. Utilisez un bouton, ou ajoutez role et tabIndex.',
    'audit.rule.positiveTabindex': 'tabIndex positif',
    'audit.rule.positiveTabindexDesc':
      'Un tabIndex supérieur à 0 sort l’élément de l’ordre naturel et désorganise la tabulation de toute la page.',
    'audit.rule.ariaHiddenInteractive': 'Contrôle masqué aux lecteurs d’écran',
    'audit.rule.ariaHiddenInteractiveDesc':
      'aria-hidden sur un élément focusable crée un contrôle qu’on peut atteindre au clavier sans jamais savoir ce qu’il est.',
    'audit.rule.duplicateId': 'Identifiant en double',
    'audit.rule.duplicateIdDesc': 'Deux éléments partagent un id ; les associations label/champ deviennent ambiguës.',
    'audit.rule.listStructure': 'Élément de liste hors liste',
    'audit.rule.listStructureDesc':
      'Un li doit être dans un ul ou un ol, sinon le nombre d’éléments n’est pas annoncé.',
    'audit.rule.noLandmarks': 'Aucun repère de structure',
    'audit.rule.noLandmarksDesc':
      'Ni main, ni nav, ni header, ni footer : rien ne permet de sauter directement au contenu.',
    'audit.rule.divNav': 'Navigation sans balise nav',
    'audit.rule.divNavDesc': 'Plusieurs liens groupés sans élément nav autour : le raccourci « aller à la navigation » ne les trouve pas.',
    'audit.rule.tableNoHeader': 'Tableau sans en-tête',
    'audit.rule.tableNoHeaderDesc': 'Sans th, une cellule ne peut pas être annoncée avec la colonne dont elle relève.',
    'audit.rule.autofocus': 'Focus automatique',
    'audit.rule.autofocusDesc':
      'autofocus déplace le curseur à l’ouverture et fait perdre le fil à qui navigue au clavier ou au lecteur d’écran.',
    'audit.rule.lowContrast': 'Contraste insuffisant entre le texte et son fond',
    'audit.rule.lowContrastDesc':
      'Cet élément pose lui-même sa couleur de texte et son fond, et le rapport entre les deux est sous 4,5:1 (3:1 pour un grand texte). Modifiez UNE des deux classes — foncer le texte ou éclaircir le fond — en restant dans la même famille de teinte.',
    'audit.rule.textTooSmall': 'Texte sous 12 px',
    'audit.rule.textTooSmallDesc':
      'Une taille inférieure à text-xs (12 px) demande un effort de lecture sur un écran ordinaire. Remontez à text-xs au minimum, sauf si la direction artistique fournie l’exige.',
    'audit.rule.leadingCramped': 'Interlignage trop serré sur du corps de texte',
    'audit.rule.leadingCrampedDesc':
      'Un paragraphe posé sur leading-none ou leading-3 colle ses lignes et l’œil perd la suivante. Réservez ces interlignages aux grands titres, et laissez le corps de texte sur leading-normal ou leading-relaxed.',
    'audit.rule.uppercaseBody': 'Capitales sur du corps de texte',
    'audit.rule.uppercaseBodyDesc':
      'Une phrase entière en capitales efface la silhouette des mots et ralentit la lecture. Gardez uppercase pour les étiquettes courtes et les surtitres.',
    'audit.rule.textJustify': 'Texte justifié',
    'audit.rule.textJustifyDesc':
      'La justification sans césure creuse des rivières blanches entre les mots, d’autant plus en colonne étroite. Repassez ce bloc en text-left.',
    'audit.rule.tapTargetSmall': 'Cible tactile plus petite que 44 px',
    'audit.rule.tapTargetSmallDesc':
      'La hauteur déduite des classes de ce contrôle (padding vertical plus interligne, ou h-*) est sous 44 px, la référence pour un doigt. Augmentez le padding vertical, ou ajoutez min-h-[44px]. Déduit du code, jamais mesuré à l’écran.',
    'audit.rule.targetsAdjacent': 'Contrôles voisins sans espacement',
    'audit.rule.targetsAdjacentDesc':
      'Plusieurs boutons ou liens partagent un conteneur flex ou grid qui ne déclare aucun gap : ils se touchent, et au doigt on atteint l’un pour l’autre. Ajoutez gap-2 ou plus sur le conteneur.',
    'audit.rule.exportTitle': 'Le HTML exporté n’a pas de titre',
    'audit.rule.exportTitleDesc': 'Le titre est la ligne la plus visible d’un résultat de recherche.',
    'audit.rule.exportDesc': 'Le HTML exporté n’a pas de description',
    'audit.rule.exportDescDesc':
      'Sans meta description, le moteur en invente une à partir de la page. Nommez le produit dans DESIGN.md pour qu’elle soit écrite.',
    'audit.rule.exportLang': 'Le HTML exporté ne déclare pas sa langue',
    'audit.rule.exportLangDesc':
      'L’attribut lang indique au lecteur d’écran comment prononcer la page. Il suit désormais la langue de l’interface.',

    // ---- questions posees au modele (passe approfondie) ----
    // Les libelles sont des ETIQUETTES FIXES, pas de la sortie de modele : ils
    // appartiennent au catalogue de server/muse/quality/audit-questions.js et
    // doivent se traduire comme les regles deterministes. Seule la `note` que
    // le modele redige reste dans sa langue — c'est de la prose, pas une cle.
    'audit.judged.altDescribesImage': 'Le texte alternatif decrit l’image',
    'audit.judged.altDescribesImageDesc':
      'Un alt doit dire ce que l’image MONTRE, pas ce qu’elle est. Une image purement decorative prend alt="".',
    'audit.judged.headingDescribesSection': 'Les titres decrivent leur section',
    'audit.judged.headingDescribesSectionDesc':
      'Un titre annonce le contenu qui le suit. Un slogan n’en est pas un : il ne dit pas de quoi parle la section.',
    'audit.judged.linkTextStandalone': 'Le texte des liens se suffit a lui-meme',
    'audit.judged.linkTextStandaloneDesc':
      'Un lecteur d’ecran peut lister les liens hors de leur contexte. « En savoir plus » n’y mene nulle part.',
    'audit.judged.h1MatchesPage': 'Le h1 dit ce qu’est la page',
    'audit.judged.h1MatchesPageDesc':
      'Le h1 est la premiere chose qu’un moteur lit. Une accroche publicitaire n’est pas un enonce de sujet.',
    'audit.judged.contentNotInImages': 'Du vrai texte, pas du texte en image',
    'audit.judged.contentNotInImagesDesc':
      'Le texte incruste dans une image n’est ni selectionnable, ni traduisible, ni indexable, ni lisible a la loupe.',
    'audit.judged.statusNotColourOnly': 'Le sens ne repose pas sur la seule couleur',
    'audit.judged.statusNotColourOnlyDesc':
      'Un etat signale uniquement par une couleur disparait pour qui ne la distingue pas. Ajoutez un mot ou une icone.',
    'audit.judged.readingOrderMatches': 'L’ordre du code suit l’ordre de lecture',
    'audit.judged.readingOrderMatchesDesc':
      'Le clavier et les lecteurs d’ecran suivent l’ordre du DOM, pas celui que le CSS donne a voir.',
    'audit.judged.formErrorsDescribed': 'Les erreurs de formulaire sont ecrites',
    'audit.judged.formErrorsDescribedDesc':
      'Un champ en rouge ne dit pas ce qui ne va pas. L’erreur doit etre un texte rattache au champ.',
  } as Record<string, string>,
  en: {
    // ---- the panel ----
    'audit.title': 'SEO and accessibility',
    'audit.open': 'Evaluate SEO and accessibility',
    'audit.pickScreen': 'Choose a screen',
    'audit.run': 'Evaluate',
    'audit.running': 'Analysing…',
    'audit.rerun': 'Evaluate again',
    'audit.deep': 'Deep analysis',
    'audit.deepHelp':
      'Additionally asks a model the questions a rule cannot settle: does the alt text describe the image, does the heading describe the section. Spends tokens.',
    'audit.seo': 'SEO',
    'audit.a11y': 'Accessibility',
    'audit.noScreens': 'This project has no screen to evaluate yet.',
    'audit.notRun': 'No evaluation for this screen. Press “Evaluate”.',
    'audit.clean': 'Nothing to report in what this analysis can see.',
    'audit.unparsed':
      'This screen’s code could not be read, so nothing was checked. Fix the error shown on the screen and try again.',
    'audit.findings': 'Findings',
    'audit.advisoryNote': 'Advisory — not corrected automatically',
    'audit.judged': 'Judged by the model',
    'audit.fixOne': 'Fix',
    'audit.fixAll': 'Fix all',
    'audit.fixing': 'Correcting…',
    'audit.fixedCount': '{n} finding(s) corrected.',
    'audit.fixedNone': 'The correction changed nothing. Try again, or fix it by hand.',
    'audit.fixFailed': 'The correction failed.',
    'audit.fixNothing': 'Nothing here can be corrected automatically.',

    // ---- what the score does NOT cover (invariant Q4) ----
    'audit.confidence': 'Source-only analysis',
    // Rewritten when the colour and tap-target rules arrived: the sentence said
    // "contrast is not measured", which became false in places and stayed true
    // everywhere else. An honesty note that under-claims its coverage lies
    // exactly as much as one that over-claims it.
    'audit.confidenceNote':
      'This score is about the markup and about what the classes declare. Contrast is checked only where the text colour AND the background are set on the same element; everywhere else it is not checked at all. Tap-target heights are deduced from classes, never measured. Focus visibility and on-screen tab order depend on the rendering and are not looked at. A score of 100 therefore does not mean “conformant”.',

    // ---- rule families ----
    'audit.family.headings': 'Headings',
    'audit.family.images': 'Images',
    'audit.family.links': 'Links and controls',
    'audit.family.forms': 'Forms',
    'audit.family.color': 'Colour',
    'audit.family.typography': 'Typography',
    'audit.family.targets': 'Tap targets',
    'audit.family.landmarks': 'Structure',

    // ---- the breakdown by family ----
    'audit.families': 'By family',
    'audit.familiesBlurb':
      'The same findings, grouped by subject so you can see where to work. This breakdown adds to the two scores above; it does not replace them.',
    'audit.family.failing': '{n} failing',
    // Two different words for two different facts, and neither of them is a
    // score of 100: "not applicable" means there was nothing to examine,
    // "not measured" that there was and the source does not say enough.
    'audit.family.notApplicable': 'not applicable',
    'audit.family.notMeasured': 'not measured',
    'audit.family.notApplicableNote':
      '“Not applicable”: this screen holds nothing these rules can examine — no image, no form. So there is no score to give, and certainly not a 100.',
    'audit.family.notMeasuredNote':
      '“Not measured”: there was something to examine, but the source cannot settle it — a background colour inherited from a parent element, for instance. Again no score, and again not a 100.',
    'audit.family.confidence.high': 'High confidence',
    'audit.family.confidence.medium': 'Medium confidence',
    'audit.family.confidence.low': 'Low confidence',
    'audit.family.why.markup': 'these are facts of the markup, entirely readable in the source.',
    'audit.family.why.colorPairs':
      'only the elements that set both their own text colour AND their own background could be compared; everywhere else, nothing is checked.',
    'audit.family.why.deduced':
      'deduced from the declared classes — sizes, leading, padding — never measured on a rendered page.',

    // ---- the exported document ----
    'audit.exportSection': 'Exported document',
    'audit.exportBlurb':
      'A Mocky screen is a component: it has no title, no language and no description. Those three exist only in the HTML the export writes, and they apply to the whole project.',
    'audit.exportClean': 'The exported HTML declares a title, a language and a description.',

    // ---- rule catalogue ----
    'audit.rule.imgAlt': 'Image with no alt text',
    'audit.rule.imgAltDesc':
      'Add an alt attribute describing what the image shows. A purely decorative image takes alt="" — that is a correct answer, not an omission.',
    'audit.rule.imgAltRedundant': 'Alt text that describes nothing',
    'audit.rule.imgAltRedundantDesc':
      'An alt reading “image” or “photo” repeats what the element already is. Describe what can be seen in it.',
    'audit.rule.imgMeaningfulEmptyAlt': 'Captioned image with an empty alt',
    'audit.rule.imgMeaningfulEmptyAltDesc':
      'alt="" declares a decorative image, but this one sits inside a <figure> or carries a caption, so it is part of the content. Write an alt describing what the image shows, without repeating the caption word for word.',
    'audit.rule.imgNoDimensions': 'Image with no declared dimensions',
    'audit.rule.imgNoDimensionsDesc':
      'With no width and height attributes and no aspect-* class, the browser reserves no space for this image and everything below it jumps when it loads. Add width and height attributes in the image’s own ratio, or an aspect-* class. Keep every other class as it is.',
    'audit.rule.missingH1': 'No top-level heading',
    'audit.rule.missingH1Desc':
      'The screen has headings but no h1. It is the heading search engines read first and the one a screen reader starts from.',
    'audit.rule.multipleH1': 'More than one top-level heading',
    'audit.rule.multipleH1Desc': 'One h1 per page: beyond that, nothing states what the page is about.',
    'audit.rule.skippedHeading': 'Skipped heading level',
    'audit.rule.skippedHeadingDesc':
      'The hierarchy jumps a level (h1 then h3). A screen reader announces that as a missing section. Change the level, not the size: carry the classes over.',
    'audit.rule.emptyHeading': 'Empty heading',
    'audit.rule.emptyHeadingDesc': 'A heading with no text is announced as an empty heading, and indexes nothing.',
    'audit.rule.controlNoName': 'Button or link with no name',
    'audit.rule.controlNoNameDesc':
      'A control showing only an icon is announced as “button” and nothing more. Give it an aria-label.',
    'audit.rule.genericLink': 'Link text that does not say where it goes',
    'audit.rule.genericLinkDesc':
      '“Read more” tells a search engine nothing, and nothing to a screen reader listing links out of their sentence.',
    'audit.rule.inputNoLabel': 'Field with no label',
    'audit.rule.inputNoLabelDesc':
      'A placeholder is not a label: it disappears as soon as you type. Associate a label, or an aria-label.',
    'audit.rule.clickableDiv': 'Clickable element a keyboard cannot reach',
    'audit.rule.clickableDivDesc':
      'A div with onClick is neither focusable nor announced. Use a button, or add role and tabIndex.',
    'audit.rule.positiveTabindex': 'Positive tabIndex',
    'audit.rule.positiveTabindexDesc':
      'A tabIndex above 0 lifts the element out of natural order and disrupts tabbing across the whole page.',
    'audit.rule.ariaHiddenInteractive': 'Control hidden from screen readers',
    'audit.rule.ariaHiddenInteractiveDesc':
      'aria-hidden on a focusable element creates a control you can reach by keyboard without ever learning what it is.',
    'audit.rule.duplicateId': 'Duplicate id',
    'audit.rule.duplicateIdDesc': 'Two elements share an id, which makes label/field associations ambiguous.',
    'audit.rule.listStructure': 'List item outside a list',
    'audit.rule.listStructureDesc': 'An li belongs in a ul or an ol, or the number of items is never announced.',
    'audit.rule.noLandmarks': 'No structural landmarks',
    'audit.rule.noLandmarksDesc':
      'No main, nav, header or footer: there is no way to skip straight to the content.',
    'audit.rule.divNav': 'Navigation with no nav element',
    'audit.rule.divNavDesc': 'Several links grouped with no nav around them: the “skip to navigation” shortcut cannot find them.',
    'audit.rule.tableNoHeader': 'Table with no header',
    'audit.rule.tableNoHeaderDesc': 'Without a th, a cell cannot be announced together with the column it belongs to.',
    'audit.rule.autofocus': 'Automatic focus',
    'audit.rule.autofocusDesc':
      'autofocus moves the cursor on open and loses the place of anyone navigating by keyboard or screen reader.',
    'audit.rule.lowContrast': 'Text and background do not contrast enough',
    'audit.rule.lowContrastDesc':
      'This element sets both its own text colour and its own background, and the ratio between them is under 4.5:1 (3:1 for text at 24px, or 18px bold). Change ONE of the two classes — darken the text or lighten the background — staying inside the same colour family so the screen keeps its look. Change nothing else.',
    'audit.rule.textTooSmall': 'Text below 12px',
    'audit.rule.textTooSmallDesc':
      'A size under text-xs (12px) takes an effort to read on an ordinary screen. Raise it to text-xs or above, unless the supplied art direction asks for it.',
    'audit.rule.leadingCramped': 'Body copy set on cramped leading',
    'audit.rule.leadingCrampedDesc':
      'A paragraph on leading-none or leading-3 has its lines touching, so the eye loses the next one. Keep those for display headings and set this block to leading-normal or leading-relaxed.',
    'audit.rule.uppercaseBody': 'Body copy in capitals',
    'audit.rule.uppercaseBodyDesc':
      'A whole sentence in capitals removes the shape of each word and slows reading down. Drop uppercase from this block and keep it for short labels and eyebrows.',
    'audit.rule.textJustify': 'Justified text',
    'audit.rule.textJustifyDesc':
      'Justification without hyphenation opens rivers of white space between the words, worst of all in a narrow column. Replace text-justify with text-left on this block.',
    'audit.rule.tapTargetSmall': 'Tap target under 44px tall',
    'audit.rule.tapTargetSmallDesc':
      'The height deduced from this control’s classes — vertical padding plus its line box, or an explicit h-* — is under 44px, the reference size for a finger. Raise the vertical padding, or add min-h-[44px]. Deduced from the classes, never measured on a rendered page.',
    'audit.rule.targetsAdjacent': 'Adjacent controls with no space between them',
    'audit.rule.targetsAdjacentDesc':
      'Several buttons or links share a flex or grid container that declares no gap, so they touch and a finger hits the wrong one. Add gap-2 or more to the container.',
    'audit.rule.exportTitle': 'The exported HTML has no title',
    'audit.rule.exportTitleDesc': 'The title is the most visible line of a search result.',
    'audit.rule.exportDesc': 'The exported HTML has no description',
    'audit.rule.exportDescDesc':
      'With no meta description, the search engine invents one from the page. Name the product in DESIGN.md so one gets written.',
    'audit.rule.exportLang': 'The exported HTML does not declare its language',
    'audit.rule.exportLangDesc':
      'The lang attribute tells a screen reader how to pronounce the page. It now follows the interface language.',

    // ---- questions asked of the model (deep pass) ----
    // These labels are FIXED strings from the catalogue in
    // server/muse/quality/audit-questions.js, not model output, so they belong
    // in the dictionary like every deterministic rule. Only the `note` the
    // model writes stays in its own language — that is prose, not a key.
    // The English descriptions are read by a model as well as by a person
    // (findingsToPrompt resolves keys to English): write them as instructions.
    'audit.judged.altDescribesImage': 'Alt text describes the picture',
    'audit.judged.altDescribesImageDesc':
      'An alt must say what the image SHOWS, not what it is. A purely decorative image takes alt="".',
    'audit.judged.headingDescribesSection': 'Headings describe their sections',
    'audit.judged.headingDescribesSectionDesc':
      'A heading announces the content beneath it. A slogan does not: it never says what the section is about.',
    'audit.judged.linkTextStandalone': 'Link text works out of context',
    'audit.judged.linkTextStandaloneDesc':
      'Screen readers can list links away from their surroundings. "Learn more" leads nowhere on its own.',
    'audit.judged.h1MatchesPage': 'The h1 states what the page is',
    'audit.judged.h1MatchesPageDesc':
      'The h1 is the first thing a search engine reads. A tagline is not a statement of subject.',
    'audit.judged.contentNotInImages': 'Real text, not text baked into pictures',
    'audit.judged.contentNotInImagesDesc':
      'Text inside an image cannot be selected, translated, indexed, or magnified. Set it as text.',
    'audit.judged.statusNotColourOnly': 'Meaning is not carried by colour alone',
    'audit.judged.statusNotColourOnlyDesc':
      'A state shown only by colour disappears for anyone who cannot tell those colours apart. Add a word or an icon.',
    'audit.judged.readingOrderMatches': 'Source order matches reading order',
    'audit.judged.readingOrderMatchesDesc':
      'Keyboards and screen readers follow DOM order, not the order CSS happens to display.',
    'audit.judged.formErrorsDescribed': 'Form errors are described in text',
    'audit.judged.formErrorsDescribedDesc':
      'A red border does not say what is wrong. The error must be text associated with the field.',
  } as Record<string, string>,
}
