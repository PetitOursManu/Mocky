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
    'auth.welcome.designOn': '● DESIGN.md actif',
    'auth.welcome.designOff': '○ DESIGN.md inactif',
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
    'auth.welcome.designOn': '● DESIGN.md on',
    'auth.welcome.designOff': '○ DESIGN.md off',
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
