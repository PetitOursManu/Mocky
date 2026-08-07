/**
 * Translations for the "video" area — the admin block that governs video export.
 *
 * Rules (see parts/preview.ts): the key sets of `fr` and `en` must match, every
 * key is prefixed `video.`, placeholders are `{name}`.
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
    'video.workerRecheck': 'Revérifier',
    'video.workerChecking': 'Vérification…',

    'video.licenseWarnTitle': 'Licence Remotion',
    'video.licenseWarnBody':
      'La licence Remotion est gratuite pour les particuliers, les organisations à but non lucratif et les sociétés commerciales jusqu’à 3 salariés ; au-delà, une Company License est requise. Ce seuil compte les salariés de votre organisation, pas les comptes de cette instance : {n} comptes pourront exporter, ce qui ne dit rien de votre situation. À vous de savoir dans quel cas vous vous trouvez.',
    'video.licenseWarnLink': 'Lire la licence sur remotion.dev',

    'video.unsaved': 'Modifications non enregistrées',
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
    'video.workerRecheck': 'Re-check',
    'video.workerChecking': 'Checking…',

    'video.licenseWarnTitle': 'Remotion licence',
    'video.licenseWarnBody':
      'Remotion’s licence is free for individuals, non-profit organisations and commercial companies with up to 3 employees; beyond that a Company License is required. That threshold counts your organisation’s employees, not this instance’s accounts: {n} accounts will be able to export, which says nothing about your situation. It is up to you to know which case you are in.',
    'video.licenseWarnLink': 'Read the licence on remotion.dev',

    'video.unsaved': 'Unsaved changes',
  } as Record<string, string>,
}
