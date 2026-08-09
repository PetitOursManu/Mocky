/**
 * Translations for the "video" area — the admin block that governs video
 * export, and the panel that composes one.
 *
 * THE AREA IS CALLED `video`; THE FEATURE IS CALLED **MOTION**. That is not an
 * oversight left half-finished. The user-facing name changed — "Export vidéo"
 * described a file format where the thing being offered is a way to put pictures
 * in motion — and the keys did not, because a key is not read by anybody: turning
 * `video.compose` into `motion.compose` would touch both halves of this
 * dictionary, every call site, and the tests that pin them, to change a string no
 * interface ever prints. The same reasoning keeps the file names, the routes and
 * the `server/video/` tree as they are. Only the values below say Motion.
 *
 * Rules (see parts/preview.ts): the key sets of `fr` and `en` must match, every
 * key is prefixed `video.`, placeholders are `{name}`.
 *
 * The failure strings are the second thing worth reading before editing. Four
 * situations arrive at the browser as an HTTP status and an English sentence —
 * the volume is full, the worker is unreachable, the pictures left the library,
 * the render never answered — and every one of them sends the person somewhere
 * different: shorten the cut, call the administrator, pick new images, wait.
 * "L’export a échoué" covers all four and helps with none, which is why each has
 * its own heading and its own next step.
 *
 * The licence strings are the reason this area is worth reading before editing.
 * Remotion's free tier is bounded by the number of SALARIÉS in the organisation,
 * which Mocky cannot know; the number it can count is accounts on the instance.
 * Every sentence here is written to state the rule and let the administrator
 * apply it — never to assert that they are over the line. A warning that is
 * wrong half the time is one people learn to dismiss, including the times it is
 * right.
 */
export const video = {
  fr: {
    'video.sectionTitle': 'Motion',
    'video.blurb':
      'Rend une suite d’images en .mp4 via un worker Remotion, service Docker séparé et facultatif (profil « video-export »). Désactivé par défaut : une instance qui n’a pas construit ce service ne gagne rien à l’activer.',

    'video.enable': 'Activer Motion',
    'video.enableHelp':
      'Interrupteur maître. Fermé, personne n’exporte, quelle que soit la portée réglée ci-dessous.',

    'video.accessTitle': 'Portée',
    'video.accessHelp':
      'Un administrateur n’est pas autorisé d’office : le rendu consomme du CPU et se compte par compte, donc l’accès s’accorde explicitement, y compris à soi-même.',
    'video.accessAll': 'Tout le monde',
    'video.accessAllowlist': 'Seulement certains comptes',

    'video.allowedTitle': 'Comptes autorisés',
    'video.allowedCount': '{n} sur {total}',
    'video.allowedEmpty': 'Aucun compte coché : personne ne peut exporter.',
    'video.allowedAllNote':
      'Tous les comptes de l’instance ({total}) peuvent exporter, y compris ceux créés plus tard.',

    'video.advanced': 'Réglages avancés',
    'video.workerUrl': 'URL du worker de rendu',
    'video.workerUrlHint':
      'C’est le serveur qui appelle cette adresse. Une adresse privée est acceptée — le worker vit sur un réseau Docker interne, sans port publié : http://video-worker:3030 est le cas normal. Vide = aucun worker.',

    'video.licenseKey': 'Clé de licence Remotion (facultative)',
    'video.licenseKeyHint':
      'Renseigner une clé active la télémétrie sortante exigée par la licence de Remotion à partir de la version 5.0 au moment du rendu : le conteneur du worker contactera Remotion à chaque export. Sans clé, il n’a aucune sortie réseau.',
    'video.licenseKeyStored': 'Une clé est enregistrée',
    'video.licenseKeyNone': 'Aucune clé enregistrée',
    'video.licenseKeyKeep': 'Laisser vide pour conserver la clé enregistrée.',
    'video.licenseKeyClear': 'Supprimer la clé',
    'video.licenseKeyClearConfirm':
      'Supprimer la clé de licence Remotion ? Le worker rendra alors sans licence, et sans télémétrie.',

    'video.workerStatus': 'État du worker',
    'video.workerAvailable': 'Disponible',
    'video.workerAvailableVersion': 'Disponible — version {version}',
    'video.workerUnreachable': 'Injoignable',
    'video.workerNotConfigured': 'Non configuré',
    'video.workerBlockedHint':
      'Adresse refusée avant tout appel : Mocky n’a pas essayé de la joindre, redémarrer le worker n’y changera rien. Seuls http:// et https:// sont acceptés.',
    'video.workerNotStartedHint':
      'Le worker Remotion est un service facultatif, absent du démarrage habituel : rien ne répond tant qu’il n’a pas été construit et lancé à part. Depuis le dossier du dépôt :',
    'video.workerRecheck': 'Revérifier',
    'video.workerChecking': 'Vérification…',

    'video.licenseWarnTitle': 'Licence Remotion',
    'video.licenseWarnBody':
      'La licence Remotion est gratuite pour les particuliers, les organisations à but non lucratif et les sociétés commerciales jusqu’à 3 salariés ; au-delà, une Company License est requise. Ce seuil compte les salariés de votre organisation, pas les comptes de cette instance : {n} comptes pourront exporter, ce qui ne dit rien de votre situation. À vous de savoir dans quel cas vous vous trouvez.',
    'video.licenseWarnLink': 'Lire la licence sur remotion.dev',

    'video.unsaved': 'Modifications non enregistrées',

    // ---- the export panel -------------------------------------------------
    'video.toolbarLabel': 'Motion',
    'video.toolbarTitle': 'Monter une vidéo à partir des images de la médiathèque',

    'video.exportTitle': 'Motion',
    'video.exportBlurb':
      'Un film monté à partir de la médiathèque. Cinq compositions au catalogue, et le modèle choisit la sienne si vous le laissez faire. Le rendu tourne sur le worker Remotion, pas dans ce navigateur.',

    // Volontairement laconique : un compte sans accès n’apprend rien de la
    // configuration de l’instance, ni de ce à quoi ressemble un montage valide.
    'video.notEnabled': 'Motion n’est pas activé pour ce compte.',
    'video.statusUnknown': 'Impossible de savoir si Motion est disponible pour ce compte.',

    'video.workerDown': 'Worker de rendu injoignable',
    'video.workerDownBody':
      'Le service de rendu ne répond pas. Rien ne peut être mis en file d’attente tant qu’il est absent ; c’est un réglage d’instance, pas un problème de montage.',

    // ---- le catalogue, et le thème du projet -------------------------------
    // Trois phrases par composition : son nom, ce qu'elle fabrique, et ce
    // qu'elle EXIGE. La troisième est celle dont on a besoin — « titrage animé »
    // ne dit pas qu'il n'utilise aucune image, et quelqu'un qui vient de passer
    // une minute à choisir des photos mérite de l'apprendre avant de cliquer,
    // pas après.
    //
    // Aucun nombre n'est écrit ici : les bornes viennent de TEMPLATE_LIMITS, via
    // templateBounds. Un plancher recopié dans un dictionnaire dérive du
    // validateur, et la dérive ne se voit que sous la forme d'un refus citant un
    // chiffre que personne n'a montré.
    'video.templateTitle': 'Composition',
    'video.templateHint':
      'Le type de film. Automatique par défaut : le modèle lit votre phrase et prend la composition faite pour elle. Choisie à la main, c’est elle qui décide des champs du formulaire ci-dessous.',
    'video.templateBounds': '{max} scènes au plus · {min} à {long} s',

    'video.tplAuto': 'Automatique',
    'video.tplAutoWhat': 'Le modèle choisit la composition d’après votre phrase.',
    'video.tplAutoNeeds': 'Exige : une phrase. Des images, selon ce qu’il choisit.',

    'video.tplSlideshow': 'Diaporama',
    'video.tplSlideshowWhat': 'Une image par scène, un mouvement lent, une légende facultative.',
    'video.tplSlideshowNeeds': 'Exige : des images. Le texte est facultatif.',

    'video.tplOverlay': 'Bandeau sur capture',
    'video.tplOverlayWhat':
      'Une capture d’écran qui garde sa place, avec un bandeau de texte au-dessus ou en dessous.',
    'video.tplOverlayNeeds': 'Exige : une capture et un titre de bandeau par scène.',

    'video.tplVertical': 'Format téléphone',
    'video.tplVerticalWhat': 'Un montage 9:16 plein cadre, scènes courtes, texte tenu à l’écart des bords.',
    'video.tplVerticalNeeds': 'Exige : des images. Le format 9:16 est imposé.',

    'video.tplTitles': 'Titrage animé',
    'video.tplTitlesWhat': 'Des mots sur un fond uni : une accroche, un sous-titre facultatif, une entrée animée.',
    'video.tplTitlesNeeds': 'Exige : du texte. Aucune image — celles que vous avez choisies n’y figureront pas.',

    'video.tplProduct': 'Mise en avant produit',
    'video.tplProductWhat': 'Une image, une accroche, jusqu’à trois arguments et un appel à l’action.',
    'video.tplProductNeeds': 'Exige : une image, une accroche et au moins un argument par scène.',

    // Le thème, dit plutôt que sous-entendu. Un panneau qui ne parle pas de
    // couleur laisse croire qu'un réglage de couleur attend plus bas ; il n'y en
    // a aucun, et il ne peut pas y en avoir : le schéma qu'un document composé
    // doit passer n'a pas de clé « theme », précisément pour qu'un modèle ne
    // puisse pas en écrire une. Trois états, pas deux — « une direction existe
    // mais ne déclare rien que Motion sache reprendre » n'est ni l'un ni l'autre.
    'video.themeFromProject':
      'Les couleurs et les polices viennent de la direction artistique de ce projet : il n’y a rien à régler ici, et le modèle n’en décide pas. Seuls les jetons que la direction déclare vraiment sont repris — pour le reste, la composition applique ses propres défauts.',
    'video.themeStatesNothing':
      'Ce projet a une direction artistique, mais elle ne déclare aucune couleur, police ou arrondi que Motion sache reprendre : chaque composition applique ses propres défauts.',
    'video.themeNone':
      'Aucune direction artistique ici : chaque composition applique ses propres défauts, choisis une fois pour toutes dans son code.',

    // ---- les deux chemins, derrière un interrupteur ------------------------
    // Sert deux fois : titre du bloc fusionné, et nom accessible du groupe de
    // boutons. Les deux positions se nomment elles-mêmes (composeTitle et
    // fromImageTitle), donc ce libellé dit ce que le bloc FAIT, pas ce qu'il
    // contient — sans quoi l'en-tête répéterait l'interrupteur placé à côté.
    'video.sourceTitle': 'Remplir le montage',

    // ---- décrire plutôt que régler ---------------------------------------
    // Le mot « proposer » est tenu partout : le modèle choisit une composition
    // et la règle, il ne valide rien et ne lance rien. Ce qui revient remplit le
    // formulaire du dessous, que l’on peut reprendre entièrement — c’est un
    // pré-remplissage, pas un second mode.
    'video.composeTitle': 'Décrire la vidéo',
    'video.composeBrief': 'Décrivez la vidéo',
    // La phrase dit aussi qui décide de la composition, parce que cela dépend du
    // sélecteur juste au-dessus : sur « Automatique » le modèle la choisit, sur
    // une composition choisie à la main il s’y tient — et une proposition qui en
    // nommerait une autre est refusée plutôt que chargée.
    'video.composeHint':
      'Le modèle monte les images que vous avez choisies : ordre, durées, mouvements, transitions et textes. Il ne choisit pas les images et n’en ajoute aucune. Sur « Automatique » il choisit aussi la composition ; sur une composition choisie à la main, il s’y tient. Rien n’est lancé, tout reste modifiable. Consomme des jetons.',
    'video.composePlaceholder':
      'Un diaporama calme de nos produits, une trentaine de secondes, sous-titré en français.',
    'video.briefCount': '{n} / {max}',
    'video.compose': 'Proposer un montage',
    'video.composing': 'Proposition en cours…',
    'video.composeNeedImages': 'Choisissez d’abord au moins une image : le montage est bâti sur votre sélection.',
    'video.composeNeedBrief': 'Décrivez la vidéo en une phrase.',
    'video.composeOverwriteConfirm':
      'Remplacer le montage que vous avez réglé à la main ? L’ordre, les durées, les mouvements, les transitions et les textes incrustés seront écrasés par la proposition.',
    // Titre de la bannière des remarques. Elles arrivent aussi — et surtout —
    // quand rien n’a été proposé : le formulaire reste alors tel quel, et ces
    // phrases sont la seule explication de ce qui ne s’est pas produit.
    'video.composeNotices': 'À propos de cette proposition',

    // ---- partir d’une image ------------------------------------------------
    // Les trois phrases « variantsAre… » sont le cœur honnête de ce chemin, et
    // elles servent DEUX FOIS : avant le clic, d’après ce que /status promet, et
    // après coup, d’après ce que la réponse a réellement fait. D’où le présent —
    // un futur mentirait dans la moitié des emplois. Le troisième cas existe
    // parce qu’un serveur qui ne dit rien ne dit pas « non » : l’inventer serait
    // affirmer un fait sur l’instance de quelqu’un d’autre, exactement là où
    // cette fonctionnalité a promis de ne pas le faire.
    'video.fromImageTitle': 'Partir d’une image',
    'video.fromImageHint':
      'Une image modèle, puis plusieurs variantes, et vous gardez celles qui vous conviennent. Chaque étape se confirme : rien n’entre dans le montage sans que vous l’ayez vu. Consomme des appels au fournisseur d’images.',
    'video.fromImageSubject': 'Décrivez le sujet',
    'video.fromImagePlaceholder': 'Une bouilloire noire mate posée sur du béton, lumière rasante.',
    'video.makeModel': 'Générer une image modèle',
    'video.makingModel': 'Génération…',
    // Le fournisseur a répondu sans rien produire. Ce n'est pas une erreur de
    // transport, et le dire autrement enverrait chercher une panne là où il n'y
    // en a pas.
    'video.modelSkipped': 'Le fournisseur d’images n’a rien produit. Réessayez, ou reformulez le sujet.',
    'video.variantNeedSubject': 'Décrivez d’abord le sujet en une phrase.',

    // Le second chemin d'entrée du même flux : une image qui existe déjà. Le
    // « ou » est là pour dire que c'est une alternative à la génération, pas une
    // étape de plus. La note dit pourquoi la première confirmation n'apparaît
    // pas — sans elle, son absence passe pour un oubli et quelqu'un la rajoute.
    'video.pickModelHeading': 'Ou partir d’une image de la médiathèque',
    'video.pickModelNote':
      'Une image de la médiathèque existe déjà et vous venez de la regarder pour la choisir : elle passe directement aux variantes, sans première confirmation.',

    'video.gateKeepTitle': 'Gardez-vous cette image ?',
    'video.gateKeepBody':
      'Rien ne continue tant que vous n’avez pas choisi. Abandonnée, elle reste dans la médiathèque sans pouvoir être montée : elle n’est pas supprimée.',
    'video.modelImageAlt': 'Image modèle proposée',
    'video.keep': 'Garder',
    'video.regenerate': 'Régénérer',
    'video.abandon': 'Abandonner',

    'video.variantsAreDerived':
      'Dérivation réelle : les variantes sortent d’un modèle image-vers-image nourri de VOTRE image.',
    'video.variantsAreSiblings':
      'Pas de dérivation : aucun profil « Édition » n’est configuré sur cette instance. Les variantes naissent du même texte, pas de votre image — même sujet, autre photo.',
    'video.variantsDerivationUnknown':
      'Ce serveur ne dit pas si les variantes dériveront de votre image. La réponse, elle, le précisera.',

    'video.variantCount': 'Nombre de variantes',
    'video.makeVariants': 'Produire {n} variantes',
    'video.makingVariants': 'Production des variantes…',

    'video.gateChooseTitle': 'Cochez les variantes à monter',
    'video.gateChooseBody':
      'Sélection multiple. Ce qui n’est pas coché reste en attente, définitivement : ces images ne pourront jamais être montées.',
    'video.variantNumber': 'Variante {n}',
    'video.variantChosen': '{n} cochée(s)',
    'video.variantDiscardNote': '{n} variante(s) resteront en attente, définitivement.',
    'video.addChosen': 'Confirmer et ajouter au montage',
    'video.adding': 'Ajout…',
    'video.variantNeedChoice': 'Cochez au moins une variante.',
    'video.variantNoRoom': 'Trop de variantes cochées : il reste {room} place(s) dans le montage.',
    'video.variantNotices': 'À propos de ces variantes',
    // Confirmation partielle : ce qui est passé entre dans le montage, ce qui a
    // échoué reste en attente. Le taire donnerait une sélection plus courte que
    // les cases cochées, sans rien pour l'expliquer.
    'video.variantConfirmFailed': '{n} variante(s) n’ont pas pu être confirmées : elles ne sont pas entrées dans le montage.',

    'video.scenesTitle': 'Scènes',
    'video.sceneCount': '{n} sur {max}',
    'video.addSceneFull': 'Maximum atteint : {max} scènes',
    'video.pickScene': 'Choisir l’image de la scène',
    'video.noScenes': 'Aucune scène pour l’instant.',
    'video.noScenesHint': 'Choisissez une première image ci-dessous : elle ouvrira le montage.',
    // Deux phrases parce que deux choses manquent. Une composition sans image ne
    // s’ouvre pas en choisissant une photo, et envoyer quelqu’un le faire, c’est
    // une minute passée à chercher un sélecteur volontairement absent.
    'video.noScenesHintText': 'Ajoutez un premier carton ci-dessous : il ouvrira le montage.',
    'video.addCard': 'Ajouter un carton',
    'video.addCardHint':
      'Le titrage animé n’utilise aucune image : ses scènes sont des cartons de texte, pas des photos.',

    'video.sceneNumber': 'Scène {n}',
    'video.moveUp': 'Monter cette scène',
    'video.moveDown': 'Descendre cette scène',
    'video.removeScene': 'Retirer cette scène',

    'video.duration': 'Durée',
    'video.seconds': '{n} s',
    'video.motion': 'Mouvement',
    'video.motionStatic': 'Fixe',
    'video.motionZoomIn': 'Zoom avant',
    'video.motionZoomOut': 'Zoom arrière',
    'video.motionPanLeft': 'Travelling gauche',
    'video.motionPanRight': 'Travelling droite',

    'video.transition': 'Transition vers la suivante',
    'video.transitionCrossfade': 'Fondu enchaîné',
    'video.transitionWipeLeft': 'Balayage vers la gauche',
    'video.transitionWipeRight': 'Balayage vers la droite',
    'video.transitionNone': 'Coupe franche',
    // Le champ existe sur toutes les scènes parce que le schéma est uniforme ;
    // sur la dernière il ne joue jamais. Le dire vaut mieux que de masquer le
    // contrôle, ce qui donnerait une ligne différente des autres sans raison
    // visible dès qu’on réordonne.
    'video.transitionLast': 'Dernière scène : cette transition ne joue pas.',

    'video.overlay': 'Texte incrusté (facultatif)',
    'video.overlayPlaceholder': 'Une ligne, incrustée dans l’image',
    'video.overlayCount': '{n} / {max}',
    'video.overlayPosition': 'Position',
    'video.overlayTop': 'En haut',
    'video.overlayCenter': 'Au centre',
    'video.overlayBottom': 'En bas',

    // ---- les champs des quatre autres compositions -------------------------
    // Le bandeau ne connaît que deux positions : le milieu, c’est justement là
    // que vit la capture qu’on veut pouvoir lire.
    'video.bandTitle': 'Titre du bandeau',
    'video.bandTitleHint': 'Obligatoire. {max} caractères au plus.',
    'video.bandTitlePlaceholder': 'Le tableau de bord, en un coup d’œil',
    'video.bandSubtitle': 'Sous-titre du bandeau (facultatif)',
    'video.bandSubtitlePlaceholder': 'Une ligne de plus, sous le titre',
    'video.bandPosition': 'Position du bandeau',
    'video.bandTop': 'Au-dessus de la capture',
    'video.bandBottom': 'En dessous de la capture',

    'video.headline': 'Accroche',
    'video.headlineHint': 'Obligatoire. {max} caractères au plus.',
    'video.headlinePlaceholder': 'Ce que cette scène annonce',
    'video.titleSubtitle': 'Sous-titre (facultatif)',
    'video.titleSubtitlePlaceholder': 'Une précision sous l’accroche',
    'video.animation': 'Entrée du texte',
    'video.animFade': 'Fondu',
    'video.animRise': 'Montée',
    'video.animStagger': 'Mot à mot',

    'video.cta': 'Appel à l’action (facultatif)',
    'video.ctaHint': '{max} caractères au plus.',
    'video.ctaPlaceholder': 'Commander',
    'video.bullets': 'Arguments ({max} au plus)',
    // Trois cases toujours, et les vides ne sont pas rendues. Le schéma accepte
    // un à trois arguments, jamais exactement trois : une carte à deux arguments
    // est une carte à deux arguments, pas une carte trouée.
    'video.bulletsHint':
      'Les cases laissées vides ne sont pas rendues. {max} caractères chacune.',
    'video.bulletNumber': 'Argument {n}',
    'video.bulletPlaceholder': 'Argument {n}',

    'video.output': 'Sortie',
    'video.aspectRatio': 'Format d’image',
    'video.container': 'Conteneur',
    // Le format EST la composition : le schéma type ce champ sur le seul litéral
    // « 9:16 ». Une liste offrant trois valeurs dont deux font refuser le
    // document est un contrôle qui n’existe que pour être mal réglé.
    'video.aspectLockedVertical':
      '9:16, imposé par la composition. Les deux autres formats sont hors d’atteinte, pas déconseillés.',

    'video.budget': 'Durée totale',
    'video.budgetValue': '{used} s sur {max} s',
    'video.budgetOver': 'Dépassement de {over} s : raccourcissez ou retirez des scènes.',
    // Une phrase par raison, jamais une phrase commune : chacune nomme une case
    // différente à aller remplir. Un formulaire de quatorze champs surmonté d’un
    // « il manque quelque chose » est une chasse au trésor.
    'video.blockedNoTemplate':
      'Composition sur « Automatique » : proposez un montage pour que le modèle la choisisse, ou choisissez-en une à la main.',
    'video.blockedEmpty': 'Ajoutez au moins une scène.',
    'video.blockedTooMany': 'Plus de {max} scènes pour cette composition.',
    // Le seul manque qu’aucune case de la ligne ne comble : une scène de
    // titrage n’a pas d’image, et passer le sélecteur sur une composition qui en
    // exige une garde la ligne telle quelle. D’où la marche à suivre dans la
    // phrase — les autres se contentent de nommer la case.
    'video.blockedImage': 'Une scène n’a pas d’image : retirez-la, puis rajoutez-la depuis la grille.',
    'video.blockedHeadline': 'Une scène n’a pas d’accroche.',
    'video.blockedBandTitle': 'Une scène n’a pas de titre de bandeau.',
    'video.blockedBullets': 'Une scène n’a aucun argument.',
    'video.blockedOverlay': 'Un texte incrusté dépasse {max} caractères.',
    'video.blockedTextLong': 'Un texte dépasse la longueur admise par cette composition.',

    'video.startRender': 'Lancer le rendu',
    'video.starting': 'Mise en file…',
    'video.newCut': 'Nouveau montage',

    'video.jobTitle': 'Rendu',
    'video.jobQueued': 'En file d’attente',
    'video.jobQueuedHint': 'Un seul rendu tourne à la fois sur cette instance.',
    'video.jobRendering': 'Rendu en cours',
    'video.jobRenderingHint': 'Vous pouvez fermer ce panneau : le rendu continue et se retrouve en le rouvrant.',
    'video.jobDone': 'Terminé',
    'video.jobFailed': 'Le rendu a échoué',
    'video.download': 'Télécharger la vidéo ({format})',
    // Où le montage se trouve MAINTENANT. Le défaut que ces deux phrases
    // réparent : le rendu produisait un fichier dont le seul chemin d'accès
    // était un lien de téléchargement qui disparaissait à la fermeture du
    // panneau. Deux phrases parce que la promesse diffère — un montage fait
    // depuis la page Média n'appartient à aucun projet, et le ranger dans un
    // serait faux.
    //
    // Le nom de l'onglet est cité tel quel : ces phrases sont un itinéraire, et
    // un itinéraire qui nomme un onglet autrement que la barre d'onglets envoie
    // chercher quelque chose qui n'existe pas.
    'video.savedInProject':
      'Le montage est enregistré dans Média, onglet « Motion », rattaché à ce projet. Vous le retrouverez là après avoir fermé ce panneau.',
    'video.savedInMedia':
      'Le montage est enregistré dans Média, onglet « Motion ». Vous le retrouverez là après avoir fermé ce panneau.',
    'video.openInMedia': 'Voir dans Média',
    // Rattacher le montage à un écran. La phrase dit explicitement que le code
    // n'est pas touché : « attacher à un écran » se lit sinon comme « mettre la
    // vidéo dans l'écran », et c'est justement l'opération que ce chemin ne fait
    // pas — le composant généré n'a pas de balise vidéo, lui en injecter une
    // serait une génération.
    'video.attachTitle': 'Attacher ce montage à un écran',
    'video.attachHint':
      'Le montage s’affichera sur une carte à côté de l’écran, dans le canevas — à côté de l’image Muse et du DESIGN.md. Le code de l’écran n’est pas modifié.',
    'video.attachedHere': 'Attaché ici',
    'video.attachNoProject':
      'Ce panneau a été ouvert depuis Média, hors d’un projet : il n’y a aucun écran auquel rattacher ce montage. Ouvrez un projet pour le faire.',
    'video.attachNoScreens': 'Ce projet n’a encore aucun écran.',
    'video.downloadGone':
      'Le rendu s’est terminé sans fichier stocké. Relancez-le ; si cela se répète, c’est le worker qu’il faut regarder.',
    'video.pollRetry': 'Le serveur n’a pas répondu à la dernière interrogation. Nouvelle tentative…',

    'video.errQuota': 'Plus de place sur ce serveur',
    'video.errQuotaHint':
      'Rien n’a été mis en file : le volume est déjà à son plafond, et un rendu de plusieurs minutes n’aurait nulle part où atterrir.',
    'video.errTimeout': 'Rendu sans réponse',
    'video.errTimeoutHint':
      'Mocky a cessé d’attendre après {n} s. Le rendu a peut-être abouti côté serveur : rouvrez ce panneau pour le vérifier.',
    'video.errMissing': 'Des images ont quitté la médiathèque',
    'video.errMissingHint': 'Remplacez les scènes concernées, puis relancez.',
    // Le refus qui n’est pas un problème de montage : le document est valide et
    // tous les fichiers sont là. Ce qui bloque, c’est une image que personne n’a
    // regardée — et le garde vit sur le serveur précisément pour que fermer un
    // panneau ne suffise pas à la faire passer.
    'video.errPending': 'Des images attendent votre confirmation',
    'video.errPendingHint':
      'Le montage refuse une image que personne n’a validée. Confirmez-la dans « Partir d’une image », ou retirez la scène concernée.',
    'video.errNoProvider': 'Aucun fournisseur d’image',
    'video.errNoProviderHint':
      'Cette instance n’a aucun modèle d’image configuré. C’est un réglage d’administration, pas un problème de montage.',
    'video.errInvalid': 'Le montage a été refusé',
    'video.errNoAccess': 'Motion n’est plus activé pour ce compte.',
    'video.errOffline': 'Serveur injoignable',
    'video.errOfflineHint': 'Rien n’a été mis en file d’attente.',
    'video.errJobGone': 'Ce rendu n’est plus suivi',
    'video.errJobGoneHint':
      'Le serveur ne garde qu’un historique borné, et il l’oublie au redémarrage. Relancez le montage.',
  } as Record<string, string>,
  en: {
    'video.sectionTitle': 'Motion',
    'video.blurb':
      'Renders a sequence of images to .mp4 through a Remotion worker — a separate, optional Docker service (the “video-export” profile). Off by default: an instance that has not built that service gains nothing by turning this on.',

    'video.enable': 'Enable Motion',
    'video.enableHelp': 'Master switch. Off, nobody exports, whatever the scope below is set to.',

    'video.accessTitle': 'Scope',
    'video.accessHelp':
      'An administrator is not allowed by default: a render costs CPU and is counted per account, so access is granted explicitly — to yourself included.',
    'video.accessAll': 'Everyone',
    'video.accessAllowlist': 'Only selected accounts',

    'video.allowedTitle': 'Allowed accounts',
    'video.allowedCount': '{n} of {total}',
    'video.allowedEmpty': 'No account ticked: nobody can export.',
    'video.allowedAllNote':
      'Every account on the instance ({total}) can export, including those created later.',

    'video.advanced': 'Advanced settings',
    'video.workerUrl': 'Render worker URL',
    'video.workerUrlHint':
      'The server is what calls this address. A private address is accepted — the worker lives on an internal Docker network with no published port, so http://video-worker:3030 is the normal case. Empty = no worker.',

    'video.licenseKey': 'Remotion licence key (optional)',
    'video.licenseKeyHint':
      'Entering a key turns on the outbound telemetry Remotion’s licence requires at render time from version 5.0 onwards: the worker container will contact Remotion on every export. With no key it has no network egress at all.',
    'video.licenseKeyStored': 'A key is stored',
    'video.licenseKeyNone': 'No key stored',
    'video.licenseKeyKeep': 'Leave empty to keep the stored key.',
    'video.licenseKeyClear': 'Remove the key',
    'video.licenseKeyClearConfirm':
      'Remove the Remotion licence key? The worker will then render unlicensed, and with no telemetry.',

    'video.workerStatus': 'Worker status',
    'video.workerAvailable': 'Available',
    'video.workerAvailableVersion': 'Available — version {version}',
    'video.workerUnreachable': 'Unreachable',
    'video.workerNotConfigured': 'Not configured',
    'video.workerBlockedHint':
      'The address was refused before any call was made: Mocky did not try to reach it, and restarting the worker will not change that. Only http:// and https:// are accepted.',
    'video.workerNotStartedHint':
      'The Remotion worker is an optional service, left out of the usual start-up: nothing answers until it has been built and started separately. From the repository folder:',
    'video.workerRecheck': 'Re-check',
    'video.workerChecking': 'Checking…',

    'video.licenseWarnTitle': 'Remotion licence',
    'video.licenseWarnBody':
      'Remotion’s licence is free for individuals, non-profit organisations and commercial companies with up to 3 employees; beyond that a Company License is required. That threshold counts your organisation’s employees, not this instance’s accounts: {n} accounts will be able to export, which says nothing about your situation. It is up to you to know which case you are in.',
    'video.licenseWarnLink': 'Read the licence on remotion.dev',

    'video.unsaved': 'Unsaved changes',

    // ---- the export panel -------------------------------------------------
    'video.toolbarLabel': 'Motion',
    'video.toolbarTitle': 'Cut a video from the media library',

    'video.exportTitle': 'Motion',
    'video.exportBlurb':
      'A film cut from the media library. Five compositions in the catalogue, and the model picks its own if you let it. The render runs on the Remotion worker, not in this browser.',

    // Deliberately terse: an account without access learns nothing about how the
    // instance is configured, nor about what a valid timeline looks like.
    'video.notEnabled': 'Motion is not enabled for this account.',
    'video.statusUnknown': 'Could not tell whether Motion is available for this account.',

    'video.workerDown': 'Render worker unreachable',
    'video.workerDownBody':
      'The render service is not answering. Nothing can be queued while it is away; this is an instance setting, not a problem with your cut.',

    // ---- the catalogue, and the project's theme -----------------------------
    // Three sentences per composition: its name, what it makes, and what it
    // REQUIRES. The third is the one people need — "animated titling" does not
    // say that it uses no picture at all, and somebody who has just spent a
    // minute choosing images deserves to learn that before the click, not after.
    //
    // No number is written here: the bounds come from TEMPLATE_LIMITS, through
    // templateBounds. A floor retyped into a dictionary drifts from the
    // validator, and the drift only ever shows as a refusal quoting a figure
    // nobody was shown.
    'video.templateTitle': 'Composition',
    'video.templateHint':
      'What kind of film this is. Automatic by default: the model reads your sentence and takes the composition built for it. Chosen by hand, it decides the fields of the form below.',
    'video.templateBounds': 'up to {max} scenes · {min} to {long} s',

    'video.tplAuto': 'Automatic',
    'video.tplAutoWhat': 'The model picks the composition from your sentence.',
    'video.tplAutoNeeds': 'Requires: a sentence. Images, depending on what it picks.',

    'video.tplSlideshow': 'Slideshow',
    'video.tplSlideshowWhat': 'One image per scene, a slow camera move, an optional caption.',
    'video.tplSlideshowNeeds': 'Requires: images. Text is optional.',

    'video.tplOverlay': 'Banded screenshot',
    'video.tplOverlayWhat': 'A screenshot that keeps its place, with a band of text above or below it.',
    'video.tplOverlayNeeds': 'Requires: a screenshot and a band title per scene.',

    'video.tplVertical': 'Phone format',
    'video.tplVerticalWhat': 'A full-bleed 9:16 cut, short beats, text kept clear of the edges.',
    'video.tplVerticalNeeds': 'Requires: images. The 9:16 ratio is fixed.',

    'video.tplTitles': 'Animated titling',
    'video.tplTitlesWhat': 'Words on a plain background: a headline, an optional subtitle, an animated entrance.',
    'video.tplTitlesNeeds': 'Requires: text. No image — the ones you picked will not appear in it.',

    'video.tplProduct': 'Product spotlight',
    'video.tplProductWhat': 'One picture, a headline, up to three arguments and a call to action.',
    'video.tplProductNeeds': 'Requires: a picture, a headline and at least one argument per scene.',

    // The theme, said rather than implied. A panel that says nothing about
    // colour invites the assumption that a colour control is waiting further
    // down; there is none, and there cannot be: the schema a composed document
    // is validated against has no `theme` key, precisely so a model cannot write
    // one either. Three states, not two — "a direction exists but states nothing
    // Motion can carry" is neither of the other two.
    'video.themeFromProject':
      'The colours and typefaces come from this project’s art direction: there is nothing to set here, and the model does not decide it. Only the tokens the direction actually states are carried over — for the rest, each composition uses its own defaults.',
    'video.themeStatesNothing':
      'This project has an art direction, but it states no colour, typeface or corner radius that Motion can carry: each composition uses its own defaults.',
    'video.themeNone':
      'No art direction here: each composition uses its own defaults, chosen once and for all in its code.',

    // ---- the two paths, behind one switch ----------------------------------
    // Used twice: as the merged block's heading, and as the accessible name of
    // the button group. Both positions already name themselves (composeTitle and
    // fromImageTitle), so this label says what the block is FOR rather than what
    // is in it — otherwise the heading would read back the switch beside it.
    'video.sourceTitle': 'Fill the cut',

    // ---- describing instead of dialling ------------------------------------
    // "Propose" is held to throughout: the model picks a composition and tunes
    // it, it approves nothing and starts nothing. What comes back fills the form
    // below, which stays entirely editable — a pre-fill, not a second mode.
    'video.composeTitle': 'Describe the video',
    'video.composeBrief': 'Describe the video',
    // The sentence also says who decides the composition, because that depends
    // on the selector just above it: on "Automatic" the model picks it, on a
    // composition chosen by hand it holds to it — and a proposal naming another
    // one is refused rather than loaded.
    'video.composeHint':
      'The model cuts the images you chose: order, durations, motion, transitions and text. It does not choose the pictures and cannot add any. On "Automatic" it picks the composition too; on one chosen by hand, it holds to it. Nothing is started, and everything stays editable. Spends tokens.',
    'video.composePlaceholder': 'A calm slideshow of our products, about thirty seconds, captioned in English.',
    'video.briefCount': '{n} / {max}',
    'video.compose': 'Propose a cut',
    'video.composing': 'Proposing…',
    'video.composeNeedImages': 'Pick at least one image first: the cut is built from your selection.',
    'video.composeNeedBrief': 'Describe the video in one sentence.',
    'video.composeOverwriteConfirm':
      'Replace the cut you arranged by hand? The order, the durations, the motion, the transitions and the burnt-in text will be overwritten by the proposal.',
    // The heading of the notices banner. They also arrive — mostly — when
    // nothing was proposed: the form is then left exactly as it was, and these
    // sentences are the only account of what did not happen.
    'video.composeNotices': 'About this proposal',

    // ---- starting from one image -------------------------------------------
    // The three "variantsAre…" sentences are the honest core of this path, and
    // each is used TWICE: before the click, from what /status promises, and
    // afterwards, from what the answer actually did. Hence the present tense — a
    // future one would be wrong in half its uses. The third case exists because
    // a server that says nothing is not saying "no": inventing that would assert
    // a fact about somebody else's instance, in the exact place this feature
    // promised not to.
    'video.fromImageTitle': 'Start from an image',
    'video.fromImageHint':
      'One model picture, then several variants, and you keep the ones that work. Every step is confirmed: nothing enters the cut before you have seen it. Spends image-provider calls.',
    'video.fromImageSubject': 'Describe the subject',
    'video.fromImagePlaceholder': 'A matte black kettle on concrete, raking light.',
    'video.makeModel': 'Generate a model image',
    'video.makingModel': 'Generating…',
    // The provider answered and produced nothing. That is not a transport
    // failure, and saying it as one sends somebody looking for a breakage that
    // is not there.
    'video.modelSkipped': 'The image provider produced nothing. Try again, or reword the subject.',
    'video.variantNeedSubject': 'Describe the subject in one sentence first.',

    // The same flow's other way in: a picture that already exists. "Or" is doing
    // the work — this is an alternative to generating one, not another step. The
    // note says why the first gate does not appear; without it, its absence
    // reads as an oversight and somebody adds a confirmation back.
    'video.pickModelHeading': 'Or start from a picture in the media library',
    'video.pickModelNote':
      'A picture from the library already exists, and you have just looked at it to pick it: it goes straight to the variants, with no first confirmation.',

    'video.gateKeepTitle': 'Keeping this one?',
    'video.gateKeepBody':
      'Nothing continues until you choose. Abandoned, it stays in the media library without being mountable — it is not deleted.',
    'video.modelImageAlt': 'The model image on offer',
    'video.keep': 'Keep',
    'video.regenerate': 'Regenerate',
    'video.abandon': 'Abandon',

    'video.variantsAreDerived':
      'A real derivation: the variants come out of an image-to-image model fed with YOUR picture.',
    'video.variantsAreSiblings':
      'No derivation: this instance has no “Edit” image profile. The variants are born of the same text, not of your picture — same subject, another photograph.',
    'video.variantsDerivationUnknown':
      'This server does not say whether the variants will derive from your picture. The answer itself will.',

    'video.variantCount': 'How many variants',
    'video.makeVariants': 'Produce {n} variants',
    'video.makingVariants': 'Producing the variants…',

    'video.gateChooseTitle': 'Tick the variants worth cutting',
    'video.gateChooseBody':
      'Several at a time. Anything left unticked stays pending, for good: those pictures can never join a cut.',
    'video.variantNumber': 'Variant {n}',
    'video.variantChosen': '{n} ticked',
    'video.variantDiscardNote': '{n} variant(s) will stay pending, permanently.',
    'video.addChosen': 'Confirm and add to the cut',
    'video.adding': 'Adding…',
    'video.variantNeedChoice': 'Tick at least one variant.',
    'video.variantNoRoom': 'Too many ticked: there is room for {room} more scene(s).',
    'video.variantNotices': 'About these variants',
    // A partial confirmation: what went through joins the cut, what failed stays
    // pending. Left unsaid it is a selection shorter than the ticked boxes, with
    // nothing to account for the difference.
    'video.variantConfirmFailed': '{n} variant(s) could not be confirmed, and did not join the cut.',

    'video.scenesTitle': 'Scenes',
    'video.sceneCount': '{n} of {max}',
    'video.addSceneFull': 'At the ceiling: {max} scenes',
    'video.pickScene': 'Choose the image for this scene',
    'video.noScenes': 'No scenes yet.',
    'video.noScenesHint': 'Pick a first image below — it opens the cut.',
    // Two sentences because two different things are missing. A composition with
    // no picture in it cannot be opened by choosing an image, and telling
    // somebody to do that is a minute spent hunting for a picker that is
    // deliberately absent.
    'video.noScenesHintText': 'Add a first card below — it opens the cut.',
    'video.addCard': 'Add a card',
    'video.addCardHint': 'Animated titling uses no image: its scenes are text cards, not photographs.',

    'video.sceneNumber': 'Scene {n}',
    'video.moveUp': 'Move this scene up',
    'video.moveDown': 'Move this scene down',
    'video.removeScene': 'Remove this scene',

    'video.duration': 'Duration',
    'video.seconds': '{n} s',
    'video.motion': 'Motion',
    'video.motionStatic': 'Still',
    'video.motionZoomIn': 'Zoom in',
    'video.motionZoomOut': 'Zoom out',
    'video.motionPanLeft': 'Pan left',
    'video.motionPanRight': 'Pan right',

    'video.transition': 'Transition to the next scene',
    'video.transitionCrossfade': 'Crossfade',
    'video.transitionWipeLeft': 'Wipe left',
    'video.transitionWipeRight': 'Wipe right',
    'video.transitionNone': 'Hard cut',
    // The field is on every scene because the schema is uniform; on the last one
    // it never plays. Saying so beats hiding the control, which would give one
    // row a different shape from the others for no visible reason the moment
    // anything is reordered.
    'video.transitionLast': 'Last scene: this transition never plays.',

    'video.overlay': 'Burnt-in text (optional)',
    'video.overlayPlaceholder': 'One line, burnt into the frame',
    'video.overlayCount': '{n} / {max}',
    'video.overlayPosition': 'Position',
    'video.overlayTop': 'Top',
    'video.overlayCenter': 'Centre',
    'video.overlayBottom': 'Bottom',

    // ---- the fields of the other four compositions --------------------------
    // A band has two positions and not three: the middle is exactly where the
    // capture being read lives.
    'video.bandTitle': 'Band title',
    'video.bandTitleHint': 'Required. {max} characters at most.',
    'video.bandTitlePlaceholder': 'The dashboard, at a glance',
    'video.bandSubtitle': 'Band subtitle (optional)',
    'video.bandSubtitlePlaceholder': 'One more line, under the title',
    'video.bandPosition': 'Band position',
    'video.bandTop': 'Above the screenshot',
    'video.bandBottom': 'Below the screenshot',

    'video.headline': 'Headline',
    'video.headlineHint': 'Required. {max} characters at most.',
    'video.headlinePlaceholder': 'What this scene announces',
    'video.titleSubtitle': 'Subtitle (optional)',
    'video.titleSubtitlePlaceholder': 'One detail under the headline',
    'video.animation': 'Text entrance',
    'video.animFade': 'Fade',
    'video.animRise': 'Rise',
    'video.animStagger': 'Word by word',

    'video.cta': 'Call to action (optional)',
    'video.ctaHint': '{max} characters at most.',
    'video.ctaPlaceholder': 'Order now',
    'video.bullets': 'Arguments (up to {max})',
    // Three boxes always, and the empty ones are not rendered. The schema takes
    // one to three arguments, never exactly three: a two-argument card is a
    // two-argument card, not one with a gap in it.
    'video.bulletsHint': 'Boxes left empty are not rendered. {max} characters each.',
    'video.bulletNumber': 'Argument {n}',
    'video.bulletPlaceholder': 'Argument {n}',

    'video.output': 'Output',
    'video.aspectRatio': 'Aspect ratio',
    'video.container': 'Container',
    // The ratio IS the composition: the schema types this field as the single
    // literal "9:16". A select offering three values, two of which refuse the
    // document, is a control that exists to be got wrong.
    'video.aspectLockedVertical':
      '9:16, fixed by the composition. The other two ratios are unreachable rather than discouraged.',

    'video.budget': 'Total duration',
    'video.budgetValue': '{used} s of {max} s',
    'video.budgetOver': '{over} s over: shorten or remove scenes.',
    // One sentence per reason and never a shared one: each names a different box
    // to go and fill in. A form with fourteen inputs under a "something is
    // missing" is a hunt.
    'video.blockedNoTemplate':
      'Composition is on "Automatic": propose a cut so the model picks one, or choose one by hand.',
    'video.blockedEmpty': 'Add at least one scene.',
    'video.blockedTooMany': 'More than {max} scenes for this composition.',
    // The one missing thing no box on that row can supply: a title card carries
    // no picture, and moving the selector to a composition that needs one keeps
    // the row as it was. Hence the next step in the sentence — the others only
    // name the box.
    'video.blockedImage': 'One scene has no picture: remove it, then add it back from the grid.',
    'video.blockedHeadline': 'One scene has no headline.',
    'video.blockedBandTitle': 'One scene has no band title.',
    'video.blockedBullets': 'One scene has no argument at all.',
    'video.blockedOverlay': 'One burnt-in text is longer than {max} characters.',
    'video.blockedTextLong': 'One text is longer than this composition allows.',

    'video.startRender': 'Start the render',
    'video.starting': 'Queueing…',
    'video.newCut': 'New cut',

    'video.jobTitle': 'Render',
    'video.jobQueued': 'Queued',
    'video.jobQueuedHint': 'One render at a time on this instance.',
    'video.jobRendering': 'Rendering',
    'video.jobRenderingHint': 'You can close this panel: the render carries on and you will find it again on reopening.',
    'video.jobDone': 'Done',
    'video.jobFailed': 'The render failed',
    'video.download': 'Download the video ({format})',
    // Where the cut is NOW. The defect these two sentences fix: a render
    // produced a file whose only route was a download link that vanished when
    // the panel closed. Two sentences because the promise differs — a cut made
    // from the standalone Media page belongs to no project, and filing it under
    // one would be untrue.
    //
    // The tab is quoted verbatim: these sentences are directions, and directions
    // that name a tab differently from the tab strip send somebody looking for
    // something that is not there.
    'video.savedInProject':
      'The cut is saved in Media, under “Motion”, attached to this project. It will be there after you close this panel.',
    'video.savedInMedia':
      'The cut is saved in Media, under “Motion”. It will be there after you close this panel.',
    'video.openInMedia': 'See it in Media',
    // Hanging the cut on a screen. The sentence says outright that the code is
    // untouched: "attach to a screen" otherwise reads as "put the video in the
    // screen", which is precisely the operation this path does NOT perform — the
    // generated component has no video tag, and injecting one would be a
    // generation rather than an attachment.
    'video.attachTitle': 'Attach this cut to a screen',
    'video.attachHint':
      'The cut will show on a card beside the screen, on the canvas — next to the Muse image and the DESIGN.md. The screen’s code is not modified.',
    'video.attachedHere': 'Attached here',
    'video.attachNoProject':
      'This panel was opened from Media, outside a project: there is no screen to attach the cut to. Open a project to do that.',
    'video.attachNoScreens': 'This project has no screen yet.',
    'video.downloadGone':
      'The render finished with no stored file. Start it again; if it repeats, the worker is what to look at.',
    'video.pollRetry': 'The server did not answer the last poll. Trying again…',

    'video.errQuota': 'No room left on this server',
    'video.errQuotaHint':
      'Nothing was queued: the volume is already at its ceiling, and a render costing minutes of CPU would have nowhere to land.',
    'video.errTimeout': 'The render stopped answering',
    'video.errTimeoutHint':
      'Mocky gave up waiting after {n} s. The render may still have finished on the server: reopen this panel to check.',
    'video.errMissing': 'Some images have left the media library',
    'video.errMissingHint': 'Replace the scenes concerned, then start again.',
    // The refusal that is not a problem with the cut: the document is valid and
    // every file is there. What blocks it is a picture nobody looked at — and
    // the guard lives on the server precisely so that closing a panel is not
    // enough to get one past it.
    'video.errPending': 'Some images are awaiting your confirmation',
    'video.errPendingHint':
      'The cut refuses a picture nobody has confirmed. Confirm it under “Start from an image”, or remove that scene.',
    'video.errNoProvider': 'No image provider',
    'video.errNoProviderHint':
      'This instance has no image model configured. That is an administration setting, not a problem with your cut.',
    'video.errInvalid': 'The cut was refused',
    'video.errNoAccess': 'Motion is no longer enabled for this account.',
    'video.errOffline': 'Server unreachable',
    'video.errOfflineHint': 'Nothing was queued.',
    'video.errJobGone': 'This render is no longer tracked',
    'video.errJobGoneHint':
      'The server keeps a bounded history and forgets it on restart. Start the cut again.',
  } as Record<string, string>,
}
