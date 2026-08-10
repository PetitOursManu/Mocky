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

    // La 3D. Le réglage RESTREINT la portée ci-dessus, il ne l'élargit jamais :
    // c'est pour ça que son défaut est ouvert là où celui de Motion est fermé —
    // la porte fermée est la précédente. La phrase d'aide dit le coût plutôt que
    // « c'est lourd », parce qu'un administrateur qui arbitre du CPU a besoin
    // d'un ordre de grandeur, pas d'un avertissement.
    'video.threeDTitle': 'Portée de la 3D',
    'video.threeDHelp':
      'Un bloc en 3D coûte environ un cinquième de temps de rendu en plus sur un film. Ouvert par défaut à ceux qui exportent déjà ; restreindre ici si le worker manque de CPU.',
    'video.threeDAllowedTitle': 'Comptes autorisés à la 3D',
    'video.threeDAllowedEmpty': 'Aucun compte coché : personne ne rend en 3D, et les autres blocs restent disponibles.',
    'video.threeDAllowedAllNote':
      'Tous les comptes qui peuvent exporter peuvent aussi rendre en 3D. Cela ne concerne donc que les comptes autorisés ci-dessus.',
    'video.threeDNarrowsNote':
      'Ce réglage restreint la portée ci-dessus, il ne l’élargit pas : cocher un compte qui n’a pas Motion ne lui donne rien.',

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
    // Ce que le panneau demande, et ce qu'il ne demande plus. La deuxième phrase
    // est là parce que l'absence de réglages se lit sinon comme un panneau
    // inachevé : personne ne choisit de mise en scène ici, c'est le parti pris.
    'video.exportBlurb':
      'Un film écrit par le modèle : vous donnez le contexte et, si vous voulez, des images de départ. Il choisit le rythme, la mise en scène, les mouvements et les textes. Le rendu tourne sur le worker Remotion, pas dans ce navigateur.',

    // Volontairement laconique : un compte sans accès n’apprend rien de la
    // configuration de l’instance, ni de ce à quoi ressemble un montage valide.
    'video.notEnabled': 'Motion n’est pas activé pour ce compte.',
    'video.statusUnknown': 'Impossible de savoir si Motion est disponible pour ce compte.',

    'video.workerDown': 'Worker de rendu injoignable',
    'video.workerDownBody':
      'Le service de rendu ne répond pas. Rien ne peut être mis en file d’attente tant qu’il est absent ; c’est un réglage d’instance, pas un problème de montage.',

    // ---- le thème du projet ------------------------------------------------
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

    // Et les couleurs demandées dans le brief, qui passent devant le dossier.
    // Dite, parce qu'une lecture que personne ne voit ne se distingue pas d'une
    // demande ignorée : « en rouge et noir » ne donne rien — laquelle des deux
    // est le fond ? — et seule cette phrase transforme ce silence en une
    // correction d'une ligne au lieu d'un mystère. Elle nomme les rôles ; les
    // pastilles au-dessus disent déjà la couleur.
    'video.themeFromBrief':
      'Couleurs demandées dans le brief, reprises en priorité sur la direction du projet : {roles}. Pour en demander une, nommez son rôle — « fond noir », « texte blanc », « un accent #c0392b ».',
    'video.themeRoleBackground': 'le fond',
    'video.themeRoleText': 'le texte',
    'video.themeRoleAccent': 'l’accent',
    'video.themeRoleSurface': 'les cartes',

    // ---- les images de départ, et d'où elles viennent -----------------------
    // Sert deux fois : titre du bloc, et nom accessible du groupe de boutons.
    // « de départ » et « facultatif » font tout le travail : ces images sont ce
    // qu'on OFFRE au modèle, pas le montage — il peut n'en retenir aucune, et un
    // film de mots n'en demande pas.
    'video.sourceTitle': 'Images de départ (facultatif)',
    'video.sourceHint':
      'Ce que le modèle a le droit d’utiliser. Il choisit lesquelles il garde, dans quel ordre et comment il les cadre. Sans image, le film sera fait de texte, de formes et de mouvement.',
    'video.fromLibraryTitle': 'Depuis la médiathèque',
    'video.imageCount': '{n} sur {max}',
    'video.imagesFull': 'Maximum atteint : {max} images',
    'video.removeImage': 'Retirer cette image',
    // Dit en une phrase plutôt qu'en grille vide : une grille vide se lit comme
    // un chargement raté, et « aucune image » est ici un film légitime, pas un
    // formulaire inachevé.
    'video.noImages': 'Aucune image pour l’instant. Ce n’est pas un manque : le modèle sait faire un film sans.',

    // ── Fabriquer des images d'après le contexte ─────────────────────────────
    //
    // La troisième provenance possible d'une photo, et la seule qui ne demande
    // rien de neuf : le SUJET est le contexte déjà écrit plus haut. Redemander
    // « décrivez ce que vous voulez voir » à quelqu'un qui vient de décrire son
    // film, c'est le lui demander deux fois — d'où l'absence de champ ici, qui
    // est le point de ce chemin et non un oubli.
    //
    // Et ça coûte de l'argent : une génération est un appel payé. Le nombre est
    // donc écrit AVANT le clic, deux fois — dans la phrase et sur le bouton —
    // et les deux citent le même calcul.
    //
    // Les images arrivent « en attente » comme partout ailleurs : rien n'entre
    // dans la médiathèque ni dans un montage avant que quelqu'un les ait vues.
    'video.briefImagesToggle': 'Générer des images d’après ce contexte',
    'video.briefImagesHint':
      'Le contexte écrit plus haut sert de sujet : rien de plus à décrire. Les images produites vous seront montrées avant d’entrer où que ce soit.',
    'video.briefImagesCount': 'Combien d’images',
    'video.briefImagesCost':
      '{n} image(s) seront générées à partir du contexte ci-dessus, soit {n} appel(s) au fournisseur d’images.',
    'video.briefImagesMake': 'Générer {n} image(s)',
    'video.briefImagesMaking': 'Génération des images…',
    'video.briefImagesNothing':
      'Le fournisseur d’images n’a rien produit à partir de ce contexte. Réessayez, ou reformulez-le.',
    // Réussite partielle : ce qui est là est là, et on dit ce qui manque plutôt
    // que de laisser compter une grille plus courte que le nombre payé (Q1).
    'video.briefImagesMissed': '{n} image(s) demandée(s) n’ont pas pu être produites. Les autres sont ci-dessous.',
    'video.briefImagesGateTitle': 'Cochez les images à garder',
    'video.briefImagesGateBody':
      'Sélection multiple. Ce qui n’est pas coché reste en attente, définitivement : ces images ne pourront jamais être montées.',
    'video.briefImageNumber': 'Image {n}',
    'video.briefImagesAdd': 'Confirmer et ajouter à la sélection',
    'video.briefImagesDiscardNote': '{n} image(s) resteront en attente, définitivement.',
    'video.briefImagesConfirmFailed':
      '{n} image(s) n’ont pas pu être confirmées : elles ne sont pas entrées dans la sélection.',
    // Le refus renvoie à la case qui existe déjà, en haut du panneau — pas à un
    // champ de plus ici.
    'video.briefImagesNeedBrief': 'Écrivez d’abord le contexte du film : c’est lui qui sert de sujet aux images.',
    'video.briefImagesNoRoom': 'Plus de place dans la sélection : retirez une image pour en générer d’autres.',
    'video.briefImagesNeedChoice': 'Cochez au moins une image.',

    // ---- décrire, et rien régler -------------------------------------------
    // Le VERBE du bouton est « générer », le NOM du résultat reste « la
    // proposition ». Le bouton dit ce qu'on fait — le modèle écrit un film — et
    // le vocabulaire du résultat dit ce que ça n'est pas, à savoir un rendu écrit
    // à la main.
    //
    // « Générer le film » lance désormais le rendu du même geste, sans second
    // clic : c'est ce que l'utilisateur a demandé, après avoir jugé qu'un
    // deuxième bouton pour voir le résultat était un pas de trop. La phrase
    // d'aide le dit noir sur blanc plutôt que de prétendre le contraire — elle
    // disait autrefois que générer ne lançait PAS le rendu, ce qui serait
    // maintenant un mensonge.
    //
    // Un seul libellé et pas deux : c'est le MÊME bouton qui demande le premier
    // film et qui en redemande un autre, et « Générer » posé à côté d'un film
    // déjà là se lit comme un bouton qui n'a rien fait. Le verbe est donc commun
    // aux deux états et c'est le complément qui change.
    'video.composeTitle': 'Décrire le film',
    'video.composeBrief': 'Le contexte',
    'video.composeHint':
      'Dites de quoi il s’agit, pour qui, sur quel ton. Le modèle écrit le film entier : découpage, mise en scène, mouvements, textes et durées, puis le rendu démarre aussitôt la proposition reçue. Consomme des jetons, et du temps de rendu.',
    'video.composePlaceholder':
      'Le lancement de notre bouilloire : trois arguments, un ton calme, une trentaine de secondes, en français.',
    'video.briefCount': '{n} / {max}',
    'video.compose': 'Générer le film',
    'video.composeAgain': 'Générer autre chose',
    'video.composing': 'Génération du film…',
    'video.composeNeedBrief': 'Écrivez d’abord le contexte, en une phrase suffit.',

    // ── Le bouton 3D ────────────────────────────────────────────────────────
    //
    // Il n'apparaît que si le compte a la permission, et le serveur la revérifie
    // aux deux portes : l'invisible n'est pas un contrôle. Le libellé est « 3D »
    // dans les deux langues — c'est le même mot, et l'inventer autrement en
    // français ferait chercher un bouton qui n'existe pas.
    //
    // La phrase de coût est HONNÊTE plutôt que rassurante. Un rendu 3D est plus
    // long : l'échéance suit la durée du film, donc ce n'est pas un risque
    // d'échec, mais quelqu'un qui attend son film mérite de savoir pourquoi il
    // met plus de temps. Le chiffre est celui de la mesure, pas une impression.
    'video.threeDForce': '3D',
    'video.threeDForceLabel': 'Composer ce film en 3D — le rendu sera plus long',
    'video.threeDForceOn':
      'Le film portera au moins une scène en 3D. Comptez environ un cinquième de temps de rendu en plus : c’est plus long, ce n’est pas plus fragile — le délai d’attente suit la durée du film.',
    // Titre de la bannière des remarques. C'est aussi là qu'atterrit le cas où
    // le bouton 3D a été pressé et où le modèle a composé un film plat : le
    // serveur le dit plutôt que de refuser un film qui marche (Q1). Elles
    // arrivent aussi — et surtout —
    // quand rien n’a été proposé : le film déjà accepté reste alors tel quel, et
    // ces phrases sont la seule explication de ce qui ne s’est pas produit.
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
    'video.variantNoRoom': 'Trop de variantes cochées : il reste {room} place(s) dans la sélection.',
    'video.variantNotices': 'À propos de ces variantes',
    // Confirmation partielle : ce qui est passé entre dans le montage, ce qui a
    // échoué reste en attente. Le taire donnerait une sélection plus courte que
    // les cases cochées, sans rien pour l'expliquer.
    'video.variantConfirmFailed': '{n} variante(s) n’ont pas pu être confirmées : elles ne sont pas entrées dans le montage.',

    // ── Définition ──────────────────────────────────────────────────────────
    //
    // La moitié de « la vidéo est pixelisée » qu'aucun réglage d'encodeur
    // n'atteint : l'image est plus petite que le cadre, `object-fit: cover`
    // l'agrandit, et un mouvement de caméra en rajoute 12 %. La phrase dit donc
    // la mesure ET le seul remède — répondre « augmentez la qualité » enverrait
    // chercher un réglage qui n'existe pas et qui ne servirait à rien s'il
    // existait.
    'video.resFooter':
      '{n} image(s) plus petite(s) que le cadre {w}×{h} : agrandies jusqu’à ×{factor}, elles seront floues. Aucun encodage ne rend une définition absente — il faut une source plus grande.',

    'video.pickScene': 'Choisir une image de départ',

    'video.output': 'Sortie',
    'video.aspectRatio': 'Format d’image',
    'video.container': 'Conteneur',
    // Le seul cas où le sélecteur ne décide pas. Un montage vertical est typé
    // sur le seul litéral « 9:16 » : lui imposer un autre format ne l’élargirait
    // pas, cela ferait refuser le document. Dit comme un fait, plutôt qu’en
    // grisant la liste — ce qui laisserait chercher pourquoi elle ne répond plus.
    'video.aspectLockedVertical':
      'Ce film est monté en 9:16, imposé par sa mise en scène : le format choisi ci-dessus ne s’y applique pas.',

    // ---- le film proposé ----------------------------------------------------
    // La seule chose que ce panneau dit d’un film qu’il ne montre pas. Trois
    // nombres lus sur le document — jamais écrits par un modèle, ce qui en
    // ferait une affirmation plutôt qu’un fait — et pas un mot sur la mise en
    // scène : ni liste de scènes, ni nom de composition, sans quoi la question
    // suivante serait « comment je change la scène 3 ? », qui n’a plus de
    // réponse.
    'video.proposalTitle': 'Le film proposé',
    'video.proposalSummary': '{n} plan(s) · {s} s · {ratio}',
    'video.blockedNoProposal':
      'Rien à rendre pour l’instant : décrivez le film, puis générez-en un. C’est le modèle qui le monte.',
    // Le film reste valable, donc c’est une remarque et jamais un refus : ce
    // serait transformer une phrase utile en mur, alors que le recours — en
    // redemander un — est à un clic dans les deux cas.
    'video.proposalStale':
      'Le contexte ou les images ont changé depuis cette proposition : elle répond à la demande précédente. Redemandez-en une pour en tenir compte.',

    // Le rendu part maintenant tout seul dès qu'une proposition arrive — voir
    // `video.composeHint`. Ce bouton reste pour la seule reprise qu'il sert
    // encore : le rendu automatique a échoué (worker indisponible, quota) alors
    // que le film composé, lui, est resté bon, et redemander un rendu du MÊME
    // film coûte moins qu'en redemander un nouveau au modèle.
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
    'video.errMissingHint': 'Retirez-les de la sélection, puis redemandez une proposition.',
    // Le refus qui n’est pas un problème de montage : le document est valide et
    // tous les fichiers sont là. Ce qui bloque, c’est une image que personne n’a
    // regardée — et le garde vit sur le serveur précisément pour que fermer un
    // panneau ne suffise pas à la faire passer.
    'video.errPending': 'Des images attendent votre confirmation',
    'video.errPendingHint':
      'Le film utilise une image que personne n’a validée. Confirmez-la dans « Partir d’une image », ou retirez-la de la sélection.',
    'video.errNoProvider': 'Aucun fournisseur d’image',
    'video.errNoProviderHint':
      'Cette instance n’a aucun modèle d’image configuré. C’est un réglage d’administration, pas un problème de montage.',
    // Le document est valide, tous les fichiers sont là : ce qui coince, c'est
    // qui demande. Donc la phrase nomme le réglage ET ce qui reste possible —
    // un refus sec sur une permission est le plus tentant et le moins utile.
    'video.err3D': 'La 3D n’est pas autorisée pour ce compte',
    'video.err3DHint':
      'Ce film contient une scène dessinée en 3D, et ce compte n’a pas le droit d’en rendre sur cette instance. Demandez-le à un administrateur, ou générez un film sans 3D : tous les autres blocs restent disponibles.',
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

    // 3D. The setting NARROWS the scope above and never widens it, which is why
    // its default is open where Motion's is closed — the shut door is the one
    // before it. The help line quotes the cost rather than calling it heavy: an
    // administrator rationing CPU needs an order of magnitude, not a warning.
    'video.threeDTitle': '3D scope',
    'video.threeDHelp':
      'A 3D block costs about a fifth more render time on a film. Open by default to whoever already exports; narrow it here if the worker is short of CPU.',
    'video.threeDAllowedTitle': 'Accounts allowed 3D',
    'video.threeDAllowedEmpty': 'No account ticked: nobody renders in 3D, and every other block stays available.',
    'video.threeDAllowedAllNote':
      'Every account that can export can also render in 3D. That means the accounts allowed above, and nobody else.',
    'video.threeDNarrowsNote':
      'This setting narrows the scope above, it does not widen it: ticking an account that has no Motion grants it nothing.',

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
    // What the panel asks for, and what it no longer asks for. The second
    // sentence is there because the absence of settings otherwise reads as an
    // unfinished panel: nobody picks a layout here, and that is the point.
    'video.exportBlurb':
      'A film written by the model: you give the context and, if you want, some starting pictures. It decides the pacing, the staging, the motion and the words. The render runs on the Remotion worker, not in this browser.',

    // Deliberately terse: an account without access learns nothing about how the
    // instance is configured, nor about what a valid timeline looks like.
    'video.notEnabled': 'Motion is not enabled for this account.',
    'video.statusUnknown': 'Could not tell whether Motion is available for this account.',

    'video.workerDown': 'Render worker unreachable',
    'video.workerDownBody':
      'The render service is not answering. Nothing can be queued while it is away; this is an instance setting, not a problem with your cut.',

    // ---- the project's theme ------------------------------------------------
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

    // And the colours asked for in the brief, which come before the dossier.
    // Said out loud, because a reading nobody is shown is indistinguishable from
    // a request that was ignored: "in red and black" yields nothing — which of
    // the two is the ground? — and this sentence is the only thing that turns
    // that silence into a one-line edit rather than a mystery. It names the
    // roles; the swatches above already say the colour.
    'video.themeFromBrief':
      'Colours asked for in the brief, taken before the project’s direction: {roles}. To ask for one, name what it is for — “black background”, “white text”, “a #c0392b accent”.',
    'video.themeRoleBackground': 'the background',
    'video.themeRoleText': 'the text',
    'video.themeRoleAccent': 'the accent',
    'video.themeRoleSurface': 'the cards',

    // ---- the starting pictures, and where they come from ---------------------
    // Used twice: as the block's heading, and as the accessible name of the
    // button group. "starting" and "optional" carry the whole sentence: these
    // pictures are what the model is OFFERED, not the cut — it may keep none of
    // them, and a film of words asks for none.
    'video.sourceTitle': 'Starting pictures (optional)',
    'video.sourceHint':
      'What the model is allowed to use. It decides which ones it keeps, in what order and how they are framed. With none, the film is made of words, shapes and movement.',
    'video.fromLibraryTitle': 'From the media library',
    'video.imageCount': '{n} of {max}',
    'video.imagesFull': 'At the ceiling: {max} images',
    'video.removeImage': 'Remove this picture',
    // Said in a sentence rather than shown as an empty grid: an empty grid reads
    // as a listing that failed to load, and "no pictures" is a legitimate film
    // here rather than an unfinished form.
    'video.noImages': 'No pictures yet. That is not a gap: the model can make a film without any.',

    // ── Making pictures out of the context ──────────────────────────────────
    //
    // The third place a photograph can come from, and the only one that asks for
    // nothing new: the SUBJECT is the context already written above. Asking
    // "describe what you want to see" of somebody who has just described their
    // film is asking them twice — so there is no field here, and that absence is
    // the point of this path rather than an omission.
    //
    // And it costs money: a generation is a paid call. So the number is written
    // BEFORE the click, twice — in the sentence and on the button — and both
    // quote the same computation.
    //
    // The pictures arrive pending like everything else here: nothing enters the
    // media library or a cut before somebody has looked at it.
    'video.briefImagesToggle': 'Generate pictures from this context',
    'video.briefImagesHint':
      'The context written above is the subject: there is nothing more to describe. You will be shown what comes back before it enters anything.',
    'video.briefImagesCount': 'How many pictures',
    'video.briefImagesCost':
      '{n} picture(s) will be generated from the context above — {n} call(s) to the image provider.',
    'video.briefImagesMake': 'Generate {n} picture(s)',
    'video.briefImagesMaking': 'Generating the pictures…',
    'video.briefImagesNothing':
      'The image provider produced nothing from this context. Try again, or reword it.',
    // A partial success: what is there is there, and what is missing is said
    // rather than left to be counted off a grid shorter than the bill (Q1).
    'video.briefImagesMissed': '{n} of the requested picture(s) could not be produced. The rest are below.',
    'video.briefImagesGateTitle': 'Tick the pictures worth keeping',
    'video.briefImagesGateBody':
      'Several at a time. Anything left unticked stays pending, for good: those pictures can never join a cut.',
    'video.briefImageNumber': 'Picture {n}',
    'video.briefImagesAdd': 'Confirm and add to the selection',
    'video.briefImagesDiscardNote': '{n} picture(s) will stay pending, permanently.',
    'video.briefImagesConfirmFailed':
      '{n} picture(s) could not be confirmed, and did not join the selection.',
    // The refusal points back at the box that already exists, at the top of the
    // panel — not at one more field down here.
    'video.briefImagesNeedBrief': 'Write the film’s context first: it is what these pictures take as their subject.',
    'video.briefImagesNoRoom': 'No room left in the selection: remove a picture to generate more.',
    'video.briefImagesNeedChoice': 'Tick at least one picture.',

    // ---- describing, and dialling nothing -----------------------------------
    // The button's VERB is "generate"; the result is still "the proposal". The
    // button says what happens — the model writes a film — and the noun says
    // what it is not, namely a render written by hand.
    //
    // "Generate the film" now starts the render in the same gesture, no second
    // click: that is what the user asked for, having judged a second button just
    // to see the result one step too many. The hint says so outright rather than
    // claiming the opposite — it used to say generating did NOT start a render,
    // which would now be a lie.
    //
    // One label rather than two: the SAME button asks for the first film and
    // asks for another one, and "Generate" sitting beside a film that is already
    // there reads as a button that did nothing. So the verb is common to both
    // states and the object is what changes.
    'video.composeTitle': 'Describe the film',
    'video.composeBrief': 'The context',
    'video.composeHint':
      'Say what it is about, who it is for, in what tone. The model writes the whole film: how it is cut, how it is staged, how things move, what it says and how long it lasts — then the render starts as soon as the proposal arrives. Spends tokens, and render time.',
    'video.composePlaceholder':
      'Launching our kettle: three arguments, a calm tone, about thirty seconds, in English.',
    'video.briefCount': '{n} / {max}',
    'video.compose': 'Generate the film',
    'video.composeAgain': 'Generate something else',
    'video.composing': 'Generating the film…',
    'video.composeNeedBrief': 'Write the context first — one sentence is enough.',

    // ── The 3D button ───────────────────────────────────────────────────────
    //
    // It appears only for an account that has the permission, and the server
    // re-checks it at both doors: invisible is not a control. The label is "3D"
    // in both languages — it is the same word, and translating it would send a
    // French reader looking for a button that does not exist.
    //
    // The cost sentence is HONEST rather than reassuring. A 3D render takes
    // longer: the deadline scales with the film's duration, so this is not a
    // risk of failure — but somebody waiting for their film deserves to know why
    // it is taking longer. The figure is the measured one, not an impression.
    'video.threeDForce': '3D',
    'video.threeDForceLabel': 'Compose this film in 3D — the render will take longer',
    'video.threeDForceOn':
      'The film will carry at least one scene drawn in 3D. Expect about a fifth more render time: longer, not more fragile — the wait is scaled to the film’s duration.',
    // The heading of the notices banner. It is also where the case lands in
    // which the 3D button was pressed and the model composed a flat film: the
    // server says so rather than refusing a film that works (Q1). They also
    // arrive — mostly — when
    // nothing was proposed: the film already accepted is then left exactly as it
    // was, and these sentences are the only account of what did not happen.
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
    'video.variantNoRoom': 'Too many ticked: there is room for {room} more picture(s).',
    'video.variantNotices': 'About these variants',
    // A partial confirmation: what went through joins the cut, what failed stays
    // pending. Left unsaid it is a selection shorter than the ticked boxes, with
    // nothing to account for the difference.
    'video.variantConfirmFailed': '{n} variant(s) could not be confirmed, and did not join the cut.',

    // ── Definition ──────────────────────────────────────────────────────────
    //
    // The half of "the video is pixelated" that no encoder setting reaches: the
    // picture is smaller than the frame, `object-fit: cover` enlarges it, and a
    // camera move asks for 12% more. So the sentence states the measurement AND
    // the only remedy — "raise the quality" would send somebody hunting for a
    // setting that does not exist and would not help if it did.
    'video.resFooter':
      '{n} image(s) smaller than the {w}×{h} frame: enlarged up to ×{factor}, they will look soft. No encoder puts back detail the source never had — it needs a larger original.',

    'video.pickScene': 'Choose a starting picture',

    'video.output': 'Output',
    'video.aspectRatio': 'Aspect ratio',
    'video.container': 'Container',
    // The one case where the selector does not decide. A vertical cut is typed
    // on the single literal "9:16": forcing another ratio onto it would not
    // widen the film, it would have the document refused. Said as a fact rather
    // than by greying the select out, which would leave somebody wondering why
    // their ratio stopped answering.
    'video.aspectLockedVertical':
      'This film is cut at 9:16, fixed by its staging: the ratio chosen above does not apply to it.',

    // ---- the proposed film ---------------------------------------------------
    // The only thing this panel says about a film it does not show. Three
    // numbers read off the document — never written by a model, which would make
    // them a claim rather than a fact — and not one word about the staging:
    // no scene list and no composition name, or the next question would be "how
    // do I change scene 3?", which no longer has an answer.
    'video.proposalTitle': 'The proposed film',
    'video.proposalSummary': '{n} shot(s) · {s} s · {ratio}',
    'video.blockedNoProposal':
      'Nothing to render yet: describe the film, then generate one. The model is what cuts it.',
    // The film is still valid, so this is a remark and never a refusal: that
    // would turn a useful sentence into a wall, when the recourse — ask for
    // another — is one click away either way.
    'video.proposalStale':
      'The context or the pictures have changed since this proposal: it answers the previous request. Ask for another one to take that into account.',

    // The render now starts by itself as soon as a proposal arrives — see
    // `video.composeHint`. This button survives for the one recourse it still
    // serves: the automatic render failed (worker unreachable, quota) while the
    // composed film stayed good, and asking for a render of the SAME film costs
    // less than asking the model for a new one.
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
    'video.errMissingHint': 'Take them out of the selection, then ask for another proposal.',
    // The refusal that is not a problem with the cut: the document is valid and
    // every file is there. What blocks it is a picture nobody looked at — and
    // the guard lives on the server precisely so that closing a panel is not
    // enough to get one past it.
    'video.errPending': 'Some images are awaiting your confirmation',
    'video.errPendingHint':
      'The film uses a picture nobody has confirmed. Confirm it under “Start from an image”, or take it out of the selection.',
    'video.errNoProvider': 'No image provider',
    'video.errNoProviderHint':
      'This instance has no image model configured. That is an administration setting, not a problem with your cut.',
    // The document is valid and every file is there: what blocks it is who is
    // asking. So the sentence names the setting AND what is still possible — a
    // bare no is most tempting and least useful on a permission.
    'video.err3D': '3D is not enabled for this account',
    'video.err3DHint':
      'This film carries a scene drawn in 3D, and this account may not render one on this instance. Ask an administrator for it, or generate a film without 3D: every other block stays available.',
    'video.errInvalid': 'The cut was refused',
    'video.errNoAccess': 'Motion is no longer enabled for this account.',
    'video.errOffline': 'Server unreachable',
    'video.errOfflineHint': 'Nothing was queued.',
    'video.errJobGone': 'This render is no longer tracked',
    'video.errJobGoneHint':
      'The server keeps a bounded history and forgets it on restart. Start the cut again.',
  } as Record<string, string>,
}
