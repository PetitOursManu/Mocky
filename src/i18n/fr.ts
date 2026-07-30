/**
 * French — the source of truth.
 *
 * Keys are `area.thing`. Add here first, then mirror in en.ts; a test checks the
 * two files declare exactly the same keys, so a forgotten translation fails the
 * build rather than silently falling back.
 *
 * Placeholders are `{name}`.
 */
export const fr = {
  // ---- navigation & chrome ----
  'nav.home': 'Accueil',
  'nav.design': 'DESIGN.md',
  'nav.images': 'Images',
  'nav.settings': 'Réglages',
  'nav.admin': 'Admin',
  'nav.tagline': 'Chat → UI · auto-hébergé',
  'nav.backHome': 'Accueil Mocky',

  'theme.toPaper': 'Passer au thème Papier',
  'theme.toInk': 'Passer au thème Encre',
  'theme.paper': 'Papier',
  'theme.ink': 'Encre',

  'lang.label': 'Langue',

  // ---- account ----
  'account.signIn': 'Se connecter',
  'account.signOut': 'Se déconnecter',
  'account.signedInAs': 'Connecté — cliquez pour vous déconnecter',
  'account.signOutConfirm': 'Se déconnecter de « {name} » ? Vos projets restent sur cet appareil.',
  'account.username': 'Nom d’utilisateur',
  'account.password': 'Mot de passe',
  'account.create': 'Créer un compte',
  'account.createAdmin': 'Créer le compte administrateur',
  'account.firstAccountIsAdmin':
    'C’est le premier compte de cette instance — il devient administrateur. Conservez les identifiants : lui seul pourra créer d’autres comptes ou configurer le modèle.',
  'account.required': 'Mocky nécessite un compte — vos projets et votre DESIGN.md y sont rattachés.',
  'account.syncBlurb':
    'Synchronisez vos projets et votre DESIGN.md sur cette instance, et retrouvez-les depuis n’importe quel appareil.',
  'account.signUpsDisabled': 'Les inscriptions sont fermées — demandez un compte à un administrateur.',
  'account.keyStaysLocal': 'Votre clé API reste dans ce navigateur et n’est jamais envoyée au serveur.',
  'account.withDashy': 'Se connecter avec Dashy',
  'account.backendDown': 'Le backend de Mocky ne répond pas.',
  'account.backendDownHelp':
    'Un compte est nécessaire, et les comptes vivent sur le backend. Si vous avez démarré Mocky avec « npm run dev », seule la partie web tourne — arrêtez-la et utilisez :',
  'account.backendDownDocker': 'Avec Docker, consultez « docker compose logs -f ».',

  // ---- sync ----
  'sync.saving': 'Enregistrement…',
  'sync.failed': 'Non enregistré',
  'sync.retrying': 'Nouvel essai…',
  'sync.failedHelp':
    'Vos modifications n’ont pas pu être enregistrées sur le serveur. Elles sont toujours dans ce navigateur. Cliquez pour réessayer.',
  'sync.quotaFull':
    'Le stockage de votre navigateur est plein — les modifications récentes n’ont pas pu être enregistrées localement.',

  // ---- projects ----
  'projects.title': 'Projets',
  'projects.new': 'Nouveau projet',
  'projects.empty': 'Créez un projet pour commencer à dessiner des écrans.',
  'projects.untitled': 'Projet sans titre',
  'projects.rename': 'Renommer le projet',
  'projects.delete': 'Supprimer le projet',
  'projects.deleteConfirm': 'Supprimer « {name} » et tous ses écrans ?',
  'projects.open': 'Ouvrir',
  'projects.screenCount': '{count} écran(s)',
  'projects.search': 'Rechercher un projet…',

  'projects.contents': "Sommaire",
  'projects.lead': "À la une",
  'projects.recent': "Les autres projets",
  'projects.empties': "Brouillons vides",
  'projects.emptiesHint': "Projets sans écran — supprimez-les si vous ne comptez pas les reprendre.",
  'projects.noMatch': "Aucun projet ne correspond à « {q} ».",
  'projects.updated': "mis à jour {when}",
  'projects.screens_one': "1 écran",
  'projects.screens_other': "{count} écrans",
  'projects.noScreens': "aucun écran",
  'projects.openProject': "Ouvrir « {name} »",
  'time.justNow': "à l’instant",
  'time.minutes': "il y a {n} min",
  'time.hours': "il y a {n} h",
  'time.days': "il y a {n} j",

  'projects.screensWord': "écrans",
  'projects.projectsWord': "projets",

  // ---- canvas & screens ----
  'canvas.rename': 'Renommer',
  'canvas.delete': 'Supprimer l’écran',
  'canvas.download': 'Télécharger le .tsx',
  'canvas.showPrompt': 'Voir la demande qui a créé cet écran',
  'canvas.more': 'Plus d’options (ou clic droit sur l’écran)',
  'canvas.duplicate': 'Dupliquer',
  'canvas.arrange': 'Réorganiser',
  'canvas.fit': 'Tout afficher',
  'canvas.zoomIn': 'Zoomer',
  'canvas.zoomOut': 'Dézoomer',
  'canvas.generating': 'Génération…',
  'canvas.rendering': 'Affichage…',
  'canvas.repairing': 'Réparation du composant…',
  'canvas.regenerating': 'Régénération…',

  // ---- toolbar modes ----
  'mode.link': 'Lier',
  'mode.modify': 'Modifier',
  'mode.interact': 'Interagir',
  'mode.annotate': 'Annoter',
  'mode.frame': 'Cadre',
  'mode.system': 'Système',
  'mode.demo': 'Démo',
  'mode.export': 'Exporter',

  // ---- composer ----
  'composer.placeholder': 'Décrivez un écran à ajouter à ce projet…',
  'composer.generate': 'Générer',
  'composer.update': 'Mettre à jour ({count})',
  'composer.generating': 'Génération…',
  'composer.stop': 'Arrêter',
  'composer.brief': 'Brief',
  'composer.briefExpand': 'Afficher le détail du brief',
  'composer.briefCollapse': 'Replier le brief',

  // ---- Muse ----
  'muse.title': 'Muse',
  'muse.dossier': 'Design Dossier',
  'muse.liveInspiration': 'Inspiration live',
  'muse.urls': 'URLs d’inspiration (Dribbble, Pinterest, un site…), une par ligne — optionnel',
  'muse.imageMode': 'Image générée',
  'muse.modeContent': 'Contenu',
  'muse.modeInspiration': 'Inspiration',
  'muse.modeBoth': 'Les deux',
  'muse.sources': 'Sources',
  'muse.writtenByModel': 'écrit par le modèle',
  'muse.library': 'Bibliothèque',

  // ---- library ----
  'library.title': 'Bibliothèque d’images',
  'library.search': 'Rechercher dans les prompts et les étiquettes…',
  'library.thisProject': 'Ce projet',
  'library.favorites': 'Favoris',
  'library.downloadAll': 'Tout télécharger',
  'library.favorite': 'Mettre en favori',
  'library.unfavorite': 'Retirer des favoris',
  'library.deleteImage': 'Supprimer l’image',
  'library.pin': 'Épingler',
  'library.unpin': 'Détacher',
  'library.empty': 'Aucune image pour l’instant. Générez un écran avec Muse activé.',

  // ---- design ----
  'design.title': 'Système de design',
  'design.kicker': 'Direction artistique',
  'design.include': 'Inclure dans les générations',
  'design.active': 'Actif',
  'design.inactive': 'Inactif',
  'design.load': 'Charger un .md',
  'design.download': 'Télécharger',
  'design.clear': 'Effacer',
  'design.styles': 'Styles prédéfinis',

  // ---- settings ----
  'settings.title': 'Réglages',
  'settings.kicker': 'Votre modèle',
  'settings.provider': 'Fournisseur',
  'settings.baseUrl': 'URL de base',
  'settings.apiKey': 'Clé API',
  'settings.model': 'Modèle',
  'settings.test': 'Tester la connexion',
  'settings.testing': 'Test en cours…',
  'settings.instanceModel': 'Modèle de l’instance',
  'settings.instanceManaged':
    'Un administrateur a configuré le modèle pour toute l’instance. Vous n’avez rien à renseigner ici.',

  // ---- admin ----
  'admin.title': 'Administration',
  'admin.users': 'Comptes',
  'admin.allowSignups': 'Autoriser les inscriptions',
  'admin.addUser': 'Ajouter un compte',
  'admin.deleteUser': 'Supprimer le compte',
  'admin.textProvider': 'Modèle de texte',
  'admin.imageProvider': 'Génération d’images',

  // ---- generic ----
  'common.save': 'Enregistrer',
  'common.cancel': 'Annuler',
  'common.close': 'Fermer',
  'common.delete': 'Supprimer',
  'common.retry': 'Réessayer',
  'common.loading': 'Chargement…',
  'common.error': 'Erreur',
  'common.copy': 'Copier',
  'common.copied': 'Copié',
  'common.revert': 'Revenir à la version précédente',
  'common.details': 'Détails techniques',
  'common.reload': 'Recharger',

  // ---- errors ----
  'error.crashed': 'Quelque chose s’est cassé',
  'error.crashedHelp': 'Mocky n’a pas réussi à afficher cet écran. Vos projets sont enregistrés — rien n’est perdu.',
  'error.backToProjects': 'Retour aux projets',
} as const
