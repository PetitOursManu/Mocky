/**
 * Translations for the "auth" area.
 *
 * One file per area so several people (or agents) can add strings at once
 * without ever touching the same file. `parts/index.ts` merges them all.
 *
 * Rules:
 *  - the key set of `fr` and `en` must match exactly — a test enforces it;
 *  - keys are `auth.something`, so an area can never collide with another;
 *  - placeholders are `{name}`.
 */
export const auth = {
  fr: {
    // ---- sign-in modal ----
    'auth.or': 'ou',
    'auth.pleaseWait': 'Veuillez patienter…',
    'auth.noAccountYet': 'Pas encore de compte ? En créer un',
    'auth.haveAccount': 'Vous avez déjà un compte ? Se connecter',

    // ---- Dashy SSO failures ----
    'auth.sso.stateMismatch':
      'La connexion avec Dashy a échoué : le contrôle de sécurité n’a pas correspondu. Réessayez.',
    'auth.sso.sessionNotSet': 'La connexion avec Dashy n’a pas ouvert de session. Réessayez.',
    'auth.sso.tokenExpired': 'Le jeton de connexion Dashy a expiré. Réessayez.',
    'auth.sso.tokenUsed': 'Ce lien de connexion Dashy a déjà été utilisé. Réessayez.',
    'auth.sso.badSignature':
      'La signature du jeton Dashy est invalide. Vérifiez que SSO_SHARED_SECRET est identique des deux côtés.',
    'auth.sso.wrongAudience':
      'Le jeton ne visait pas cette instance Mocky. Vérifiez MOCKY_ORIGIN et SSO_ALLOWED_REDIRECTS.',
    'auth.sso.wrongIssuer': 'Le jeton n’a pas été émis par Dashy.',
    'auth.sso.unknown': 'La connexion avec Dashy a échoué pour une raison inconnue.',
    'auth.sso.disabled': 'Ce compte Mocky est désactivé : son accès a été retiré dans Kosmy Board. Adressez-vous à un administrateur.',

    // ---- Kosmy Board (OpenID Connect) — server/kosmy-board.js ----
    'auth.kosmy.signIn': 'Se connecter avec Kosmy Board',
    'auth.kosmy.reason.not_configured': 'La connexion avec Kosmy Board n’est pas réglée sur cette instance.',
    'auth.kosmy.reason.issuer': 'Ce Kosmy Board n’est pas celui que cette instance connaît.',
    'auth.kosmy.reason.expired': 'La connexion avec Kosmy Board a expiré ou a déjà servi. Réessayez.',
    'auth.kosmy.reason.denied': 'Kosmy Board a refusé l’accès : cet espace n’est pas dans votre Board.',
    'auth.kosmy.reason.failed': 'La connexion avec Kosmy Board a échoué. Réessayez.',
    'auth.kosmy.reason.unreachable': 'Kosmy Board ne répond pas. Réessayez dans un instant.',
    'auth.kosmy.reason.exchange': 'Kosmy Board a refusé le code de connexion. Vérifiez l’identifiant et le secret client dans Admin.',
    'auth.kosmy.reason.token': 'La réponse de Kosmy Board n’a pas pu être vérifiée.',
    'auth.kosmy.reason.not_linked': 'Ce compte Kosmy Board n’est relié à aucun compte Mocky. Connectez-vous avec votre mot de passe, puis reliez-le depuis Réglages.',
    'auth.kosmy.reason.maintenance': 'Maintenance en cours : aucun compte ne peut être créé pour le moment.',
    'auth.kosmy.reason.session': 'Votre session Mocky a changé pendant la liaison. Reconnectez-vous puis recommencez.',
    'auth.kosmy.reason.already_linked': 'Ce compte Kosmy Board est déjà relié à un autre compte Mocky.',
    'auth.kosmy.reason.other_linked': 'Ce compte Mocky est déjà relié à un autre compte Kosmy Board. Défaites d’abord ce lien.',
    'auth.kosmy.reason.disabled': 'Ce compte Mocky est désactivé : son accès a été retiré dans Kosmy Board. Adressez-vous à un administrateur.',
    'auth.kosmy.reason.access': 'L’accès donné par Kosmy Board n’a pas pu être appliqué à votre compte Mocky. Adressez-vous à un administrateur.',
    'auth.kosmy.sectionTitle': 'Kosmy Board',
    'auth.kosmy.linkBlurb': 'Reliez ce compte à votre Kosmy Board pour vous connecter d’un clic, depuis la page de connexion ou le bouton « Ouvrir » du Board.',
    'auth.kosmy.link': 'Relier à Kosmy Board',
    'auth.kosmy.linkedBlurb': 'Ce compte est relié à Kosmy Board : vous pouvez vous connecter avec lui.',
    'auth.kosmy.linkedNotice': 'Compte relié à Kosmy Board.',
    'auth.kosmy.linkFailed': 'Le compte n’a pas été relié',
    'auth.kosmy.unlink': 'Défaire le lien',
    'auth.kosmy.unlinkPassword': 'Mot de passe Mocky',
    'auth.kosmy.unlinkHint': 'Demandé pour défaire le lien.',
    'auth.kosmy.unlinkedNotice': 'Le lien avec Kosmy Board est défait.',
    'auth.kosmy.noPasswordNoUnlink': 'Ce compte n’a pas de mot de passe Mocky : Kosmy Board est sa seule connexion, le lien ne peut donc pas être défait ici. Demandez à un administrateur de lui donner un mot de passe.',
    'auth.kosmy.wrongPassword': 'Mot de passe incorrect.',
    'auth.kosmy.locked': 'Trop d’essais : réessayez dans quelques minutes.',
    'auth.kosmy.admin.title': 'Connexion avec Kosmy Board',
    'auth.kosmy.admin.on': 'Activée',
    'auth.kosmy.admin.off': 'Désactivée',
    'auth.kosmy.admin.blurb': 'Dans le Board, ouvrez l’espace Mocky → Modifier → Connexion unique, activez-la, puis collez ici les trois réglages affichés.',
    'auth.kosmy.admin.redirectUri': 'Adresse de retour (à donner au Board)',
    'auth.kosmy.admin.loginUri': 'Adresse de lancement (à donner au Board)',
    'auth.kosmy.admin.originHint': 'MOCKY_ORIGIN n’est pas réglé : ces adresses suivent celle par laquelle vous ouvrez Mocky. Réglez MOCKY_ORIGIN pour les fixer.',
    'auth.kosmy.admin.issuer': 'Émetteur',
    'auth.kosmy.admin.issuerHint': 'L’adresse de l’émetteur affichée par le Board, par exemple https://board.example.com/oidc.',
    'auth.kosmy.admin.clientId': 'Identifiant client',
    'auth.kosmy.admin.clientSecret': 'Secret client',
    'auth.kosmy.admin.secretKept': 'Un secret est enregistré. Laissez vide pour le garder, ou saisissez-en un nouveau pour le remplacer.',
    'auth.kosmy.admin.secretOnce': 'Le Board ne l’affiche qu’une fois. Il ne sera plus jamais affiché ici.',
    'auth.kosmy.admin.autoCreate': 'Créer un compte à la première connexion',
    'auth.kosmy.admin.autoCreateHelp': 'Désactivé, un compte Kosmy Board inconnu est refusé : la personne relie son compte depuis Réglages. Un compte créé ainsi n’est jamais administrateur.',
    'auth.kosmy.admin.save': 'Enregistrer',
    'auth.kosmy.admin.saved': 'Réglages enregistrés.',
    'auth.kosmy.admin.remove': 'Désactiver et effacer',
    'auth.kosmy.admin.removeConfirm': 'Désactiver la connexion avec Kosmy Board et effacer ses réglages ? Les comptes reliés gardent leur lien.',
    'auth.kosmy.admin.badIssuer': 'L’émetteur doit être une adresse http(s) complète.',
    'auth.kosmy.admin.copy': 'Copier',
    'auth.kosmy.admin.copied': 'Copié',

    // ---- sync indicator ----
    'auth.sync.savingTitle': 'Enregistrement sur le serveur…',

    // ---- crash screen ----
    'auth.error.kicker': 'Incident',
    'auth.error.goBack': 'Revenir en arrière',
    'auth.error.reloadMocky': 'Recharger Mocky',

    // ---- welcome / first screen ----
    'auth.welcome.kicker': 'Nouvel écran',
    'auth.welcome.title': 'Que voulez-vous dessiner ?',
    'auth.welcome.lead':
      'Décrivez un écran en langage courant — Mocky en fait un vrai composant React + Tailwind, avec un aperçu en direct.',
    'auth.welcome.placeholder':
      'Par exemple : une landing page SaaS épurée, avec un hero, trois cartes de fonctionnalités et un pied de page…',
    'auth.welcome.designTitle': 'Gérer le DESIGN.md',
    'auth.welcome.designOn': 'DESIGN.md actif',
    'auth.welcome.designOff': 'DESIGN.md inactif',
    'auth.welcome.museTitle': 'Muse — inspiration, direction artistique et vrais textes',
    'auth.welcome.museHint':
      'Essayez Muse : elle cherche des références, écrit une direction artistique et remplace le faux texte par de vrais contenus. Cliquez pour l’activer.',
    'auth.welcome.museOn': 'Muse activée',
    'auth.welcome.museOff': 'Muse désactivée',
    'auth.welcome.generatingAria': 'Génération en cours…',
    'auth.welcome.format': 'Format',
    'auth.welcome.pickStyle': 'Choisissez un style',
    'auth.welcome.pickStyleHint': '— optionnel, pour garder tous vos écrans cohérents',
    'auth.welcome.designSystemOn': '● Système de design actif — vos écrans le suivront.',
    'auth.welcome.designSystemEdit': 'modifier',
    'auth.welcome.examples': 'Ou essayez un exemple',
    'auth.welcome.generationFailed': 'La génération a échoué',
    'auth.welcome.openSettings': 'Ouvrir les réglages',
  } as Record<string, string>,
  en: {
    // ---- sign-in modal ----
    'auth.or': 'or',
    'auth.pleaseWait': 'Please wait…',
    'auth.noAccountYet': 'No account yet? Create one',
    'auth.haveAccount': 'Already have an account? Sign in',

    // ---- Dashy SSO failures ----
    'auth.sso.stateMismatch': 'Sign-in with Dashy failed: the security check did not match. Please try again.',
    'auth.sso.sessionNotSet': 'Sign-in with Dashy did not establish a session. Please try again.',
    'auth.sso.tokenExpired': 'The Dashy sign-in token expired. Please try again.',
    'auth.sso.tokenUsed': 'This Dashy sign-in link was already used. Please try again.',
    'auth.sso.badSignature':
      'The Dashy token signature was invalid. Check that SSO_SHARED_SECRET matches on both sides.',
    'auth.sso.wrongAudience':
      'The token was not meant for this Mocky instance. Check MOCKY_ORIGIN and SSO_ALLOWED_REDIRECTS.',
    'auth.sso.wrongIssuer': 'The token was not issued by Dashy.',
    'auth.sso.unknown': 'Sign-in with Dashy failed for an unknown reason.',
    'auth.sso.disabled': 'This Mocky account is disabled: its access was withdrawn in Kosmy Board. Ask an administrator.',

    // ---- Kosmy Board (OpenID Connect) — server/kosmy-board.js ----
    'auth.kosmy.signIn': 'Sign in with Kosmy Board',
    'auth.kosmy.reason.not_configured': 'Sign-in with Kosmy Board is not set up on this instance.',
    'auth.kosmy.reason.issuer': 'This Kosmy Board is not the one this instance knows.',
    'auth.kosmy.reason.expired': 'The Kosmy Board sign-in expired or was already used. Please try again.',
    'auth.kosmy.reason.denied': 'Kosmy Board refused access: this space is not in your Board.',
    'auth.kosmy.reason.failed': 'Sign-in with Kosmy Board failed. Please try again.',
    'auth.kosmy.reason.unreachable': 'Kosmy Board is not answering. Please try again in a moment.',
    'auth.kosmy.reason.exchange': 'Kosmy Board refused the sign-in code. Check the client ID and secret in Admin.',
    'auth.kosmy.reason.token': 'Kosmy Board’s answer could not be verified.',
    'auth.kosmy.reason.not_linked': 'This Kosmy Board account is not linked to any Mocky account. Sign in with your password, then link it from Settings.',
    'auth.kosmy.reason.maintenance': 'Maintenance in progress: no account can be created right now.',
    'auth.kosmy.reason.session': 'Your Mocky session changed while linking. Sign in again and retry.',
    'auth.kosmy.reason.already_linked': 'This Kosmy Board account is already linked to another Mocky account.',
    'auth.kosmy.reason.other_linked': 'This Mocky account is already linked to another Kosmy Board account. Unlink it first.',
    'auth.kosmy.reason.disabled': 'This Mocky account is disabled: its access was withdrawn in Kosmy Board. Ask an administrator.',
    'auth.kosmy.reason.access': 'The access given in Kosmy Board could not be applied to your Mocky account. Ask an administrator.',
    'auth.kosmy.sectionTitle': 'Kosmy Board',
    'auth.kosmy.linkBlurb': 'Link this account to your Kosmy Board to sign in with one click, from the sign-in page or the Board’s “Open” button.',
    'auth.kosmy.link': 'Link to Kosmy Board',
    'auth.kosmy.linkedBlurb': 'This account is linked to Kosmy Board: you can sign in with it.',
    'auth.kosmy.linkedNotice': 'Account linked to Kosmy Board.',
    'auth.kosmy.linkFailed': 'The account was not linked',
    'auth.kosmy.unlink': 'Unlink',
    'auth.kosmy.unlinkPassword': 'Mocky password',
    'auth.kosmy.unlinkHint': 'Required to unlink.',
    'auth.kosmy.unlinkedNotice': 'Kosmy Board is no longer linked.',
    'auth.kosmy.noPasswordNoUnlink': 'This account has no Mocky password: Kosmy Board is its only way in, so the link cannot be removed here. Ask an administrator to give it a password.',
    'auth.kosmy.wrongPassword': 'Wrong password.',
    'auth.kosmy.locked': 'Too many attempts: try again in a few minutes.',
    'auth.kosmy.admin.title': 'Sign in with Kosmy Board',
    'auth.kosmy.admin.on': 'On',
    'auth.kosmy.admin.off': 'Off',
    'auth.kosmy.admin.blurb': 'In the Board, open the Mocky space → Edit → Single sign-on, turn it on, then paste the three settings it shows here.',
    'auth.kosmy.admin.redirectUri': 'Redirect URI (give it to the Board)',
    'auth.kosmy.admin.loginUri': 'Initiate login URI (give it to the Board)',
    'auth.kosmy.admin.originHint': 'MOCKY_ORIGIN is not set: these addresses follow the one you opened Mocky with. Set MOCKY_ORIGIN to pin them.',
    'auth.kosmy.admin.issuer': 'Issuer',
    'auth.kosmy.admin.issuerHint': 'The issuer address the Board shows, e.g. https://board.example.com/oidc.',
    'auth.kosmy.admin.clientId': 'Client ID',
    'auth.kosmy.admin.clientSecret': 'Client secret',
    'auth.kosmy.admin.secretKept': 'A secret is saved. Leave empty to keep it, or type a new one to replace it.',
    'auth.kosmy.admin.secretOnce': 'The Board shows it only once. It will never be shown here again.',
    'auth.kosmy.admin.autoCreate': 'Create an account on first sign-in',
    'auth.kosmy.admin.autoCreateHelp': 'Off, an unknown Kosmy Board account is refused: its owner links their account from Settings. An account created this way is never an administrator.',
    'auth.kosmy.admin.save': 'Save',
    'auth.kosmy.admin.saved': 'Settings saved.',
    'auth.kosmy.admin.remove': 'Turn off and clear',
    'auth.kosmy.admin.removeConfirm': 'Turn off sign-in with Kosmy Board and clear its settings? Linked accounts keep their link.',
    'auth.kosmy.admin.badIssuer': 'The issuer must be a full http(s) address.',
    'auth.kosmy.admin.copy': 'Copy',
    'auth.kosmy.admin.copied': 'Copied',

    // ---- sync indicator ----
    'auth.sync.savingTitle': 'Saving to the server…',

    // ---- crash screen ----
    'auth.error.kicker': 'Incident',
    'auth.error.goBack': 'Go back',
    'auth.error.reloadMocky': 'Reload Mocky',

    // ---- welcome / first screen ----
    'auth.welcome.kicker': 'New screen',
    'auth.welcome.title': 'What do you want to design?',
    'auth.welcome.lead':
      'Describe a screen in plain language — Mocky turns it into a real React + Tailwind component with a live preview.',
    'auth.welcome.placeholder':
      'e.g. A clean SaaS landing page with a hero, three feature cards, and a footer…',
    'auth.welcome.designTitle': 'Manage DESIGN.md',
    'auth.welcome.designOn': 'DESIGN.md on',
    'auth.welcome.designOff': 'DESIGN.md off',
    'auth.welcome.museTitle': 'Muse — inspiration, art direction & real copy',
    'auth.welcome.museHint':
      'Try Muse: it finds references, writes an art direction, and replaces lorem ipsum with real copy. Click to turn it on.',
    'auth.welcome.museOn': 'Muse on',
    'auth.welcome.museOff': 'Muse off',
    'auth.welcome.generatingAria': 'Generating…',
    'auth.welcome.format': 'Format',
    'auth.welcome.pickStyle': 'Pick a style',
    'auth.welcome.pickStyleHint': '— optional, keeps every screen consistent',
    'auth.welcome.designSystemOn': '● Design system on — your screens will follow it.',
    'auth.welcome.designSystemEdit': 'edit',
    'auth.welcome.examples': 'Or try an example',
    'auth.welcome.generationFailed': 'Generation failed',
    'auth.welcome.openSettings': 'Open Settings',
  } as Record<string, string>,
}
