/**
 * Translations for the "video" area — the admin block that governs video
 * export, and the panel that composes one.
 *
 * Rules (see parts/preview.ts): the key sets of `fr` and `en` must match, every
 * key is prefixed `video.`, placeholders are `{name}`.
 *
 * The failure strings are the second thing worth reading before editing. Four
 * situations arrive at the browser as an HTTP status and an English sentence —
 * the volume is full, the worker is unreachable, the pictures left the library,
 * the render never answered — and every one of them sends the person somewhere
 * different: shorten the film, call the administrator, pick new images, wait.
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
    'video.sectionTitle': 'Export vidéo',
    'video.blurb':
      'Rend une suite d’images en .mp4 via un worker Remotion, service Docker séparé et facultatif (profil « video-export »). Désactivé par défaut : une instance qui n’a pas construit ce service ne gagne rien à l’activer.',

    'video.enable': 'Activer l’export vidéo',
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
    'video.toolbarLabel': 'Vidéo',
    'video.toolbarTitle': 'Monter une vidéo à partir des images de la médiathèque',

    'video.exportTitle': 'Export vidéo',
    'video.exportBlurb':
      'Un diaporama monté à partir de la médiathèque : une image par scène, sa durée, son mouvement et sa transition. Le rendu tourne sur le worker Remotion, pas dans ce navigateur.',

    // Volontairement laconique : un compte sans accès n’apprend rien de la
    // configuration de l’instance, ni de ce à quoi ressemble un montage valide.
    'video.notEnabled': 'L’export vidéo n’est pas activé pour ce compte.',
    'video.statusUnknown': 'Impossible de savoir si l’export vidéo est disponible pour ce compte.',

    'video.workerDown': 'Worker de rendu injoignable',
    'video.workerDownBody':
      'Le service de rendu ne répond pas. Rien ne peut être mis en file d’attente tant qu’il est absent ; c’est un réglage d’instance, pas un problème de montage.',

    'video.scenesTitle': 'Scènes',
    'video.sceneCount': '{n} sur {max}',
    'video.addSceneFull': 'Maximum atteint : {max} scènes',
    'video.pickScene': 'Choisir l’image de la scène',
    'video.noScenes': 'Aucune scène pour l’instant.',
    'video.noScenesHint': 'Choisissez une première image ci-dessous : elle ouvrira le film.',

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

    'video.output': 'Sortie',
    'video.aspectRatio': 'Format d’image',
    'video.container': 'Conteneur',

    'video.budget': 'Durée totale',
    'video.budgetValue': '{used} s sur {max} s',
    'video.budgetOver': 'Dépassement de {over} s : raccourcissez ou retirez des scènes.',
    'video.blockedEmpty': 'Ajoutez au moins une scène.',
    'video.blockedTooMany': 'Plus de {max} scènes.',
    'video.blockedOverlay': 'Un texte incrusté dépasse {max} caractères.',

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
    'video.errInvalid': 'Le montage a été refusé',
    'video.errNoAccess': 'L’export vidéo n’est plus activé pour ce compte.',
    'video.errOffline': 'Serveur injoignable',
    'video.errOfflineHint': 'Rien n’a été mis en file d’attente.',
    'video.errJobGone': 'Ce rendu n’est plus suivi',
    'video.errJobGoneHint':
      'Le serveur ne garde qu’un historique borné, et il l’oublie au redémarrage. Relancez le montage.',
  } as Record<string, string>,
  en: {
    'video.sectionTitle': 'Video export',
    'video.blurb':
      'Renders a sequence of images to .mp4 through a Remotion worker — a separate, optional Docker service (the “video-export” profile). Off by default: an instance that has not built that service gains nothing by turning this on.',

    'video.enable': 'Enable video export',
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
    'video.toolbarLabel': 'Video',
    'video.toolbarTitle': 'Cut a video from the media library',

    'video.exportTitle': 'Video export',
    'video.exportBlurb':
      'A slideshow cut from the media library: one image per scene, with its duration, its motion and its transition. The render runs on the Remotion worker, not in this browser.',

    // Deliberately terse: an account without access learns nothing about how the
    // instance is configured, nor about what a valid timeline looks like.
    'video.notEnabled': 'Video export is not enabled for this account.',
    'video.statusUnknown': 'Could not tell whether video export is available for this account.',

    'video.workerDown': 'Render worker unreachable',
    'video.workerDownBody':
      'The render service is not answering. Nothing can be queued while it is away; this is an instance setting, not a problem with your cut.',

    'video.scenesTitle': 'Scenes',
    'video.sceneCount': '{n} of {max}',
    'video.addSceneFull': 'At the ceiling: {max} scenes',
    'video.pickScene': 'Choose the image for this scene',
    'video.noScenes': 'No scenes yet.',
    'video.noScenesHint': 'Pick a first image below — it opens the film.',

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

    'video.output': 'Output',
    'video.aspectRatio': 'Aspect ratio',
    'video.container': 'Container',

    'video.budget': 'Total duration',
    'video.budgetValue': '{used} s of {max} s',
    'video.budgetOver': '{over} s over: shorten or remove scenes.',
    'video.blockedEmpty': 'Add at least one scene.',
    'video.blockedTooMany': 'More than {max} scenes.',
    'video.blockedOverlay': 'One burnt-in text is longer than {max} characters.',

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
    'video.errInvalid': 'The cut was refused',
    'video.errNoAccess': 'Video export is no longer enabled for this account.',
    'video.errOffline': 'Server unreachable',
    'video.errOfflineHint': 'Nothing was queued.',
    'video.errJobGone': 'This render is no longer tracked',
    'video.errJobGoneHint':
      'The server keeps a bounded history and forgets it on restart. Start the cut again.',
  } as Record<string, string>,
}
