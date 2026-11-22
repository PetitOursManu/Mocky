/**
 * Translations for the administrator's decision-model setting
 * (`components/admin/DecisionModelSettings.tsx`, server/decision/config.js).
 * Same rules as every area: `fr` and `en` carry the same keys.
 */
export const decision = {
  fr: {
    'decision.admin.title': 'Modèle de décision',
    'decision.admin.blurb':
      'Un modèle qui n’écrit pas : il répond à des questions courtes et typées (oui/non, une note, un choix), vite, à bas coût, et en mesurant sa confiance. Muse s’en sert pour les nombreuses évaluations d’un audit de projet. Sans lui, le modèle de Muse répond aux mêmes questions.',
    'decision.admin.provider': 'Fournisseur',
    'decision.admin.none': 'Aucun — le modèle de Muse répond',
    'decision.admin.apiKey': 'Clé d’API',
    'decision.admin.keyKept': 'Une clé est enregistrée. Laissez vide pour la garder.',
    'decision.admin.keyHint': 'Créée sur console.typesafe.ai. Elle ne quitte jamais le serveur.',
    'decision.admin.model': 'Modèle',
    'decision.admin.baseUrl': 'Adresse de l’API',
    'decision.admin.images': 'Autoriser les images',
    'decision.admin.imagesHelp':
      'TypeSafe présente encore la lecture d’images comme non prête pour la production. L’audit de projet n’en envoie pas aujourd’hui.',
    'decision.admin.on': 'Actif',
    'decision.admin.off': 'Inactif',
    'decision.admin.save': 'Enregistrer',
    'decision.admin.saved': 'Enregistré.',
    'decision.admin.persistError': 'Appliqué, mais le fichier de réglages n’a pas pu être écrit : il sera perdu au redémarrage.',
    'decision.admin.test': 'Tester',
    'decision.admin.testOk': '{model} a répondu en {ms} ms.',
    'decision.admin.test.not-configured': 'Choisissez un fournisseur et enregistrez une clé, puis testez.',
    'decision.admin.test.auth': 'La clé a été refusée.',
    'decision.admin.test.busy': 'Le fournisseur limite les appels pour le moment : réessayez plus tard.',
    'decision.admin.test.other': 'Le fournisseur n’a pas répondu correctement : {error}',
    'decision.admin.free': 'Les comptes du plan gratuit et ceux qui utilisent leur propre clé n’y ont pas accès : il est facturé à l’instance.',
  },
  en: {
    'decision.admin.title': 'Decision model',
    'decision.admin.blurb':
      'A model that does not write: it answers short, typed questions (yes/no, a score, a choice), fast, cheaply, and measuring its confidence. Muse uses it for the many evaluations of a project audit. Without it, Muse’s model answers the same questions.',
    'decision.admin.provider': 'Provider',
    'decision.admin.none': 'None — Muse’s model answers',
    'decision.admin.apiKey': 'API key',
    'decision.admin.keyKept': 'A key is saved. Leave empty to keep it.',
    'decision.admin.keyHint': 'Created on console.typesafe.ai. It never leaves the server.',
    'decision.admin.model': 'Model',
    'decision.admin.baseUrl': 'API address',
    'decision.admin.images': 'Allow pictures',
    'decision.admin.imagesHelp':
      'TypeSafe still presents picture input as not ready for production. The project audit sends none today.',
    'decision.admin.on': 'On',
    'decision.admin.off': 'Off',
    'decision.admin.save': 'Save',
    'decision.admin.saved': 'Saved.',
    'decision.admin.persistError': 'Applied, but the settings file could not be written: it will be lost on restart.',
    'decision.admin.test': 'Test',
    'decision.admin.testOk': '{model} answered in {ms} ms.',
    'decision.admin.test.not-configured': 'Choose a provider and save a key, then test.',
    'decision.admin.test.auth': 'The key was refused.',
    'decision.admin.test.busy': 'The provider is rate-limiting calls for now: try again later.',
    'decision.admin.test.other': 'The provider did not answer correctly: {error}',
    'decision.admin.free': 'Accounts on the free plan and those on their own key do not reach it: it is billed to the instance.',
  },
}
