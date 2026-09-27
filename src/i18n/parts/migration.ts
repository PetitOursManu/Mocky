/**
 * Translations for maintenance mode and the server-to-server migration.
 *
 * Rules: see settings.ts. Check ids (`migration.check.<id>.<status>`) and error
 * codes (`migration.error.<code>`) are the server's own — server/migration/
 * preflight.js and destination.js — so a key missing here shows as its name.
 */
export const migration = {
  fr: {
    // ---- maintenance ----
    'migration.maintenance.kicker': 'Maintenance',
    'migration.maintenance.banner':
      'Mocky est en maintenance. Vous pouvez consulter vos projets, mais rien ne peut être créé, modifié ni supprimé pour le moment.',
    'migration.maintenance.bannerAdmin':
      'Mode maintenance actif : les utilisateurs sont en lecture seule. Vous pouvez encore modifier, mais pendant une migration ce que vous changez après le passage final n’est pas transféré.',
    'migration.maintenance.refused': 'Mocky est en maintenance : rien ne peut être créé, modifié ni supprimé pour le moment.',
    'migration.maintenance.syncPaused': 'En pause',
    'migration.maintenance.syncPausedHelp':
      'Maintenance en cours : vos modifications sont gardées dans ce navigateur et seront envoyées dès la fin de la maintenance.',
    'migration.maintenance.ssoNewAccount':
      'Mocky est en maintenance : aucun nouveau compte ne peut être créé pour le moment. Réessayez plus tard.',
    'migration.maintenance.title': 'Mode maintenance',
    'migration.maintenance.activeSince': 'Actif depuis {time}',
    'migration.maintenance.help':
      'Passe l’instance en lecture seule pour tous les utilisateurs : ils peuvent se connecter et consulter, mais aucune création, modification ni suppression n’est acceptée, génération comprise. Les administrateurs ne sont pas bloqués.',
    'migration.maintenance.messageLabel': 'Message affiché aux utilisateurs',
    'migration.maintenance.messageHint': 'Facultatif, 500 caractères au plus. Par exemple l’heure de retour prévue.',
    'migration.maintenance.messagePlaceholder': 'Retour prévu vers 14 h',
    'migration.maintenance.turnOn': 'Activer la maintenance',
    'migration.maintenance.turnOff': 'Désactiver la maintenance',
    'migration.maintenance.saveMessage': 'Mettre à jour le message',

    // ---- migration: shared ----
    'migration.heading': 'Maintenance et migration',
    'migration.blurb':
      'Pour changer de serveur : générez un code sur l’ancien, saisissez-le sur le nouveau, faites un premier passage pendant que l’ancien tourne encore, activez la maintenance sur l’ancien, faites le passage final, puis remplacez. Tout ce qui circule est chiffré de bout en bout avec le code. Les sessions ne sont pas transférées : chacun se reconnecte une fois.',
    'migration.confirmPassword': 'Votre mot de passe',
    'migration.confirmPasswordHint': 'Demandé à nouveau : cette action concerne toute l’instance.',
    'migration.status.ok': 'OK',
    'migration.status.warn': 'Attention',
    'migration.status.fail': 'Bloquant',

    // ---- migration: old server ----
    'migration.source.title': 'Ce serveur est l’ancien',
    'migration.source.help':
      'Génère un code de transfert, valable 24 heures. Le nouveau serveur s’en sert pour récupérer les données de celui-ci. Un redémarrage de ce serveur annule le code.',
    'migration.source.warning':
      'Le code donne accès à TOUT : comptes, projets, médias et clés des fournisseurs. Ne le transmettez que par un canal sûr, et révoquez-le dès que le transfert est fini.',
    'migration.source.create': 'Générer un code de transfert',
    'migration.source.codeOnce': 'Copiez ce code maintenant : il ne sera plus jamais affiché.',
    'migration.source.codeHidden': 'Un code est actif. Il n’est plus affiché ; révoquez-le et générez-en un autre si vous l’avez perdu.',
    'migration.source.copy': 'Copier',
    'migration.source.copied': 'Copié',
    'migration.source.expires': 'Expire le',
    'migration.source.lastSeen': 'Dernier contact',
    'migration.source.lastSeenValue': '{time} depuis {ip}',
    'migration.source.never': 'jamais',
    'migration.source.served': 'Transmis',
    'migration.source.revoke': 'Révoquer le code',

    // ---- migration: new server ----
    'migration.import.title': 'Ce serveur est le nouveau',
    'migration.import.help':
      'Récupère les données de l’ancien serveur par petits morceaux, vérifiés un par un, dans une zone d’attente. Rien n’est remplacé tant que vous ne cliquez pas sur « Remplacer ».',
    'migration.import.url': 'Adresse de l’ancien serveur',
    'migration.import.urlHint': 'Celle qu’utilisent vos utilisateurs, ou son adresse sur le réseau local.',
    'migration.import.code': 'Code de transfert',
    'migration.import.connect': 'Se connecter et vérifier',
    'migration.import.connecting': 'Vérification…',
    'migration.import.connectedTo': 'Connecté à {source}',
    'migration.import.blocking': 'Au moins une vérification est bloquante : corrigez-la sur ce serveur, puis reconnectez-vous.',
    'migration.import.pass': 'Lancer le premier passage',
    'migration.import.passAgain': 'Lancer un nouveau passage',
    'migration.import.cancel': 'Interrompre',
    'migration.import.disconnect': 'Se déconnecter',
    'migration.import.progress': '{files} / {total} fichiers · {done} / {bytes}',
    'migration.import.failedFiles': '{n} fichier(s) non transférés',
    'migration.import.passNotFinal':
      'Passage terminé. Pour finir : activez la maintenance sur l’ancien serveur, attendez la fin des rendus en cours, puis lancez un nouveau passage. Il ne transférera que ce qui a changé.',
    'migration.import.finalizeTitle': 'Prêt à remplacer',
    'migration.import.finalizeBody':
      'Les données actuelles de ce serveur (dont votre compte actuel) seront mises de côté dans .migration/, puis remplacées par celles de l’ancien. Mocky redémarre ensuite. Connectez-vous avec vos identifiants de l’ancien serveur. Le nouveau démarre en maintenance : désactivez-la après vos vérifications.',
    'migration.import.finalize': 'Remplacer les données de ce serveur',
    'migration.import.finalizeConfirm': 'Remplacer toutes les données de ce serveur par celles de l’ancien ?',
    'migration.import.doneTitle': 'Transfert terminé',
    'migration.import.doneBody':
      'Mocky redémarre. Avec Docker, il revient seul en quelques secondes ; sinon, relancez-le. Connectez-vous ensuite avec vos identifiants de l’ancien serveur.',
    'migration.import.reload': 'Recharger',
    'migration.import.lastReport': 'Dernier import le {time}, depuis {source}.',
    'migration.import.verify': 'Vérifier l’intégrité',
    'migration.import.verifying': 'Vérification…',
    'migration.import.verifyResult':
      '{same} / {total} fichiers identiques à l’import. Modifiés depuis : {changed}. Manquants : {missing}.',

    'migration.summary.users': 'Comptes',
    'migration.summary.projects': 'Espaces de projets',
    'migration.summary.images': 'Images',
    'migration.summary.clips': 'Séquences vidéo',
    'migration.summary.films': 'Films exportés',
    'migration.summary.total': 'Total',
    'migration.summary.totalValue': '{files} fichiers, {bytes}',

    // ---- preflight ----
    'migration.check.heading': 'Ce serveur a-t-il tout ce qu’il faut ?',
    'migration.check.node.ok': 'Node {local}',
    'migration.check.node.fail': 'Node {local} est trop ancien : il faut {floor} au minimum.',
    'migration.check.version.ok': 'Même version de Mocky ({local})',
    'migration.check.version.warn': 'Mocky {local} ici, {source} sur l’ancien. Une version plus récente lit les anciennes données.',
    'migration.check.version.fail':
      'Mocky {local} ici est plus ancien que {source} sur l’ancien serveur : mettez celui-ci à jour d’abord.',
    'migration.check.disk.ok': 'Espace disque suffisant ({free} libres, {needed} nécessaires)',
    'migration.check.disk.warn': 'Espace libre inconnu : il faut environ {needed}.',
    'migration.check.disk.fail': 'Pas assez d’espace disque : {free} libres, {needed} nécessaires.',
    'migration.check.writable.ok': 'Dossier de données accessible en écriture',
    'migration.check.writable.fail': 'Le dossier de données n’est pas accessible en écriture.',
    'migration.check.empty.ok': 'Ce serveur est vide',
    'migration.check.empty.warn': 'Ce serveur contient déjà des données ({users} compte(s)). Elles seront mises de côté, puis remplacées.',
    'migration.check.ffmpeg.ok': 'ffmpeg est présent (séquences vidéo)',
    'migration.check.ffmpeg.warn':
      'ffmpeg est introuvable : les séquences existantes restent lisibles, mais on ne pourra plus en découper de nouvelles.',
    'migration.check.worker.ok': 'Worker de rendu joignable ({url})',
    'migration.check.worker.warn':
      'Worker de rendu injoignable à {url} : l’export de films ne marchera pas tant qu’il n’est pas démarré ici. {detail}',
    'migration.check.sso.ok': 'SSO Dashy configuré à l’identique',
    'migration.check.sso.missing':
      'L’ancien serveur utilise le SSO Dashy, pas celui-ci : les comptes sans mot de passe Mocky ne pourront pas se connecter. Reportez SSO_SHARED_SECRET, SSO_DASHY_URL et MOCKY_ORIGIN.',
    'migration.check.sso.secret': 'SSO_SHARED_SECRET est différent de celui de l’ancien serveur.',
    'migration.check.sso.dashy': 'SSO_DASHY_URL est différent de celui de l’ancien serveur.',
    'migration.check.origin.warn':
      'MOCKY_ORIGIN : « {source} » sur l’ancien, « {local} » ici. C’est normal si le domaine change ; pensez alors à mettre à jour Dashy.',
    'migration.check.proxy.warn': 'TRUST_PROXY est défini sur l’ancien serveur mais pas ici.',
    'migration.check.clock.ok': 'Horloges synchronisées',
    'migration.check.clock.warn': 'Les horloges diffèrent de {seconds} s.',
    'migration.check.clock.fail': 'Les horloges diffèrent de {seconds} s : synchronisez-les (NTP), sinon le transfert est refusé.',
    'migration.check.maintenance.warn':
      'L’ancien serveur n’est pas en maintenance. Un premier passage est possible, mais le passage final exigera la maintenance.',
    'migration.check.queue.warn': '{active} rendu(s) vidéo en cours sur l’ancien serveur.',

    // ---- errors ----
    'migration.error.url': 'Adresse invalide : elle doit commencer par http:// ou https://, sans identifiant.',
    'migration.error.code': 'Ce n’est pas un code de transfert valide (32 caractères).',
    'migration.error.refused': 'L’ancien serveur a refusé : code faux, expiré ou révoqué, ou ancien serveur redémarré depuis.',
    'migration.error.unreachable': 'Ancien serveur injoignable depuis celui-ci.',
    'migration.error.unreadable':
      'La réponse n’a pas pu être déchiffrée : mauvaise adresse, ou un intermédiaire a modifié les données.',
    'migration.error.http': 'L’ancien serveur a répondu par une erreur.',
    'migration.error.gone': 'Le fichier a disparu de l’ancien serveur entre-temps.',
    'migration.error.manifest': 'La liste de fichiers envoyée par l’ancien serveur contient des chemins refusés.',
    'migration.error.changed': 'Un fichier a changé pendant son transfert. Relancez un passage.',
    'migration.error.busy': 'Un passage est déjà en cours.',
    'migration.error.not-connected': 'Connectez-vous d’abord à l’ancien serveur.',
    'migration.error.preflight': 'Une vérification bloquante a échoué.',
    'migration.error.cancelled': 'Passage interrompu.',
    'migration.error.not-ready':
      'Pas encore prêt : il faut un passage complet, sans erreur, pendant que l’ancien serveur est en maintenance et sans rendu en cours.',
    'migration.error.staging': 'Un fichier de la zone d’attente est manquant ou incomplet. Relancez un passage.',
    'migration.error.swap': 'Le remplacement a échoué ; les données d’origine ont été remises en place.',
    'migration.error.no-report': 'Aucun import à vérifier.',
    'migration.error.password': 'Mot de passe incorrect.',
    'migration.error.locked': 'Trop d’essais : réessayez dans quelques minutes.',
    'migration.error.io': 'Erreur du serveur pendant la migration. Consultez ses journaux.',
  },
  en: {
    // ---- maintenance ----
    'migration.maintenance.kicker': 'Maintenance',
    'migration.maintenance.banner':
      'Mocky is under maintenance. You can browse your projects, but nothing can be created, changed or deleted for now.',
    'migration.maintenance.bannerAdmin':
      'Maintenance mode is on: users are read-only. You can still make changes, but during a migration anything you change after the final pass is not transferred.',
    'migration.maintenance.refused': 'Mocky is under maintenance: nothing can be created, changed or deleted for now.',
    'migration.maintenance.syncPaused': 'Paused',
    'migration.maintenance.syncPausedHelp':
      'Maintenance in progress: your changes are kept in this browser and will be sent as soon as maintenance ends.',
    'migration.maintenance.ssoNewAccount': 'Mocky is under maintenance: no new account can be created right now. Try again later.',
    'migration.maintenance.title': 'Maintenance mode',
    'migration.maintenance.activeSince': 'On since {time}',
    'migration.maintenance.help':
      'Makes the instance read-only for every user: they can sign in and browse, but no creation, change or deletion is accepted, generation included. Administrators are not blocked.',
    'migration.maintenance.messageLabel': 'Message shown to users',
    'migration.maintenance.messageHint': 'Optional, 500 characters at most. For instance when you expect to be back.',
    'migration.maintenance.messagePlaceholder': 'Back around 2 pm',
    'migration.maintenance.turnOn': 'Turn maintenance on',
    'migration.maintenance.turnOff': 'Turn maintenance off',
    'migration.maintenance.saveMessage': 'Update the message',

    // ---- migration: shared ----
    'migration.heading': 'Maintenance and migration',
    'migration.blurb':
      'To move to another server: create a code on the old one, enter it on the new one, run a first pass while the old one is still running, turn maintenance on on the old one, run the final pass, then replace. Everything in transit is end-to-end encrypted with the code. Sessions are not transferred: everyone signs in again once.',
    'migration.confirmPassword': 'Your password',
    'migration.confirmPasswordHint': 'Asked again: this action affects the whole instance.',
    'migration.status.ok': 'OK',
    'migration.status.warn': 'Warning',
    'migration.status.fail': 'Blocking',

    // ---- migration: old server ----
    'migration.source.title': 'This is the old server',
    'migration.source.help':
      'Creates a transfer code, valid for 24 hours. The new server uses it to fetch this server’s data. Restarting this server cancels the code.',
    'migration.source.warning':
      'The code gives access to EVERYTHING: accounts, projects, media and provider keys. Only share it over a safe channel, and revoke it as soon as the transfer is done.',
    'migration.source.create': 'Create a transfer code',
    'migration.source.codeOnce': 'Copy this code now: it will never be shown again.',
    'migration.source.codeHidden': 'A code is active. It is no longer shown; revoke it and create another if you lost it.',
    'migration.source.copy': 'Copy',
    'migration.source.copied': 'Copied',
    'migration.source.expires': 'Expires',
    'migration.source.lastSeen': 'Last contact',
    'migration.source.lastSeenValue': '{time} from {ip}',
    'migration.source.never': 'never',
    'migration.source.served': 'Sent',
    'migration.source.revoke': 'Revoke the code',

    // ---- migration: new server ----
    'migration.import.title': 'This is the new server',
    'migration.import.help':
      'Fetches the old server’s data in small pieces, each one checked, into a staging area. Nothing is replaced until you click “Replace”.',
    'migration.import.url': 'Old server address',
    'migration.import.urlHint': 'The one your users use, or its address on the local network.',
    'migration.import.code': 'Transfer code',
    'migration.import.connect': 'Connect and check',
    'migration.import.connecting': 'Checking…',
    'migration.import.connectedTo': 'Connected to {source}',
    'migration.import.blocking': 'At least one check is blocking: fix it on this server, then connect again.',
    'migration.import.pass': 'Run the first pass',
    'migration.import.passAgain': 'Run another pass',
    'migration.import.cancel': 'Stop',
    'migration.import.disconnect': 'Disconnect',
    'migration.import.progress': '{files} / {total} files · {done} / {bytes}',
    'migration.import.failedFiles': '{n} file(s) not transferred',
    'migration.import.passNotFinal':
      'Pass finished. To finish: turn maintenance on on the old server, wait for renders in progress to end, then run another pass. It only transfers what changed.',
    'migration.import.finalizeTitle': 'Ready to replace',
    'migration.import.finalizeBody':
      'This server’s current data (your current account included) will be set aside in .migration/, then replaced with the old server’s. Mocky then restarts. Sign in with your old server credentials. The new server starts in maintenance: turn it off once you have checked everything.',
    'migration.import.finalize': 'Replace this server’s data',
    'migration.import.finalizeConfirm': 'Replace all of this server’s data with the old server’s?',
    'migration.import.doneTitle': 'Transfer complete',
    'migration.import.doneBody':
      'Mocky is restarting. Under Docker it comes back by itself within seconds; otherwise, start it again. Then sign in with your old server credentials.',
    'migration.import.reload': 'Reload',
    'migration.import.lastReport': 'Last import on {time}, from {source}.',
    'migration.import.verify': 'Check integrity',
    'migration.import.verifying': 'Checking…',
    'migration.import.verifyResult': '{same} / {total} files identical to the import. Changed since: {changed}. Missing: {missing}.',

    'migration.summary.users': 'Accounts',
    'migration.summary.projects': 'Project spaces',
    'migration.summary.images': 'Images',
    'migration.summary.clips': 'Video sequences',
    'migration.summary.films': 'Exported films',
    'migration.summary.total': 'Total',
    'migration.summary.totalValue': '{files} files, {bytes}',

    // ---- preflight ----
    'migration.check.heading': 'Does this server have everything it needs?',
    'migration.check.node.ok': 'Node {local}',
    'migration.check.node.fail': 'Node {local} is too old: {floor} is the minimum.',
    'migration.check.version.ok': 'Same Mocky version ({local})',
    'migration.check.version.warn': 'Mocky {local} here, {source} on the old one. A newer version reads older data.',
    'migration.check.version.fail': 'Mocky {local} here is older than {source} on the old server: update this one first.',
    'migration.check.disk.ok': 'Enough disk space ({free} free, {needed} needed)',
    'migration.check.disk.warn': 'Free space unknown: about {needed} is needed.',
    'migration.check.disk.fail': 'Not enough disk space: {free} free, {needed} needed.',
    'migration.check.writable.ok': 'Data directory is writable',
    'migration.check.writable.fail': 'The data directory is not writable.',
    'migration.check.empty.ok': 'This server is empty',
    'migration.check.empty.warn': 'This server already holds data ({users} account(s)). It will be set aside, then replaced.',
    'migration.check.ffmpeg.ok': 'ffmpeg is present (video sequences)',
    'migration.check.ffmpeg.warn': 'ffmpeg is missing: existing sequences still play, but new ones cannot be cut.',
    'migration.check.worker.ok': 'Render worker reachable ({url})',
    'migration.check.worker.warn': 'Render worker unreachable at {url}: film export will not work until it runs here. {detail}',
    'migration.check.sso.ok': 'Dashy SSO configured identically',
    'migration.check.sso.missing':
      'The old server uses Dashy SSO, this one does not: accounts without a Mocky password will not be able to sign in. Carry over SSO_SHARED_SECRET, SSO_DASHY_URL and MOCKY_ORIGIN.',
    'migration.check.sso.secret': 'SSO_SHARED_SECRET differs from the old server’s.',
    'migration.check.sso.dashy': 'SSO_DASHY_URL differs from the old server’s.',
    'migration.check.origin.warn':
      'MOCKY_ORIGIN: “{source}” on the old one, “{local}” here. Expected if the domain changes; update Dashy if so.',
    'migration.check.proxy.warn': 'TRUST_PROXY is set on the old server but not here.',
    'migration.check.clock.ok': 'Clocks in sync',
    'migration.check.clock.warn': 'Clocks differ by {seconds} s.',
    'migration.check.clock.fail': 'Clocks differ by {seconds} s: synchronise them (NTP), or the transfer is refused.',
    'migration.check.maintenance.warn':
      'The old server is not in maintenance. A first pass is fine, but the final pass requires maintenance.',
    'migration.check.queue.warn': '{active} video render(s) in progress on the old server.',

    // ---- errors ----
    'migration.error.url': 'Invalid address: it must start with http:// or https://, with no credentials.',
    'migration.error.code': 'This is not a valid transfer code (32 characters).',
    'migration.error.refused': 'The old server refused: wrong, expired or revoked code, or the old server restarted since.',
    'migration.error.unreachable': 'The old server cannot be reached from this one.',
    'migration.error.unreadable': 'The answer could not be decrypted: wrong address, or something in between altered the data.',
    'migration.error.http': 'The old server answered with an error.',
    'migration.error.gone': 'The file disappeared from the old server in the meantime.',
    'migration.error.manifest': 'The file list sent by the old server contains refused paths.',
    'migration.error.changed': 'A file changed while being transferred. Run another pass.',
    'migration.error.busy': 'A pass is already running.',
    'migration.error.not-connected': 'Connect to the old server first.',
    'migration.error.preflight': 'A blocking check failed.',
    'migration.error.cancelled': 'Pass stopped.',
    'migration.error.not-ready':
      'Not ready yet: it takes a complete pass, with no error, while the old server is in maintenance with no render in progress.',
    'migration.error.staging': 'A file in the staging area is missing or incomplete. Run another pass.',
    'migration.error.swap': 'The replacement failed; the original data was put back.',
    'migration.error.no-report': 'No import to check.',
    'migration.error.password': 'Wrong password.',
    'migration.error.locked': 'Too many attempts: try again in a few minutes.',
    'migration.error.io': 'Server error during the migration. Check its logs.',
  },
}
