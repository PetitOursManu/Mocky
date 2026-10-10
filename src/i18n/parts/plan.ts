/**
 * Translations for the free plan (server/plan.js): the account's own card in
 * Settings, the administrator's switches in Admin → Accounts, and the third
 * profile of Admin → Text model.
 *
 * Its own area so the free plan's words can change without touching the
 * settings file the provider forms live in. Same rules as every area: identical
 * key sets, keys under `plan.`.
 */
export const plan = {
  fr: {
    'plan.label': 'Forfait',
    'plan.free': 'Gratuit',
    'plan.standard': 'Standard',

    // Settings — the account's own card
    'plan.cardTitle': 'Forfait gratuit',
    'plan.cardBody':
      'Vos générations passent par un modèle gratuit, et vos images et vidéos viennent des banques libres (Pexels, Pixabay). Les images et vidéos générées par IA ne sont pas disponibles avec ce forfait.',
    'plan.model': 'Modèle : {model}',
    'plan.ownKey':
      'Cette instance n’a pas de modèle gratuit : renseignez votre propre fournisseur ci-dessous. Il est utilisé avec votre clé, sans plafond.',
    'plan.usage': '{used} sur {limit} générations aujourd’hui — le compteur repart à minuit.',
    'plan.unlimited': 'Générations illimitées.',
    'plan.askAdmin': 'Un administrateur peut passer votre compte au forfait standard.',

    // Admin → Accounts
    'plan.adminHeading': 'Forfait gratuit',
    'plan.adminBlurb':
      'Un compte gratuit ne coûte rien à l’instance : son texte passe par le modèle gratuit (Modèle de texte → ③), ses images et vidéos viennent des banques libres, et les générateurs payants lui sont fermés. Un administrateur reste au forfait standard, sauf pour le tester (ci-dessous).',
    'plan.newAccounts': 'Forfait des nouveaux comptes',
    'plan.newAccountsHelp':
      'Pour les inscriptions publiques, les comptes Dashy et, par défaut, les comptes créés ici. Les comptes existants ne changent pas.',
    'plan.dailyLimit': 'Générations par jour, par compte gratuit',
    'plan.dailyLimitHelp':
      '0 = illimité. Un nouvel écran, une modification, un polissage ou une correction d’accessibilité comptent chacun pour une. Remise à zéro à minuit, heure du serveur.',
    'plan.save': 'Enregistrer',
    'plan.saved': 'Forfait gratuit enregistré.',
    'plan.noModel':
      'Aucun modèle gratuit n’est configuré : les comptes gratuits utilisent leur propre clé (Réglages) et le plafond ne s’applique pas. Ils n’atteignent jamais le modèle payant.',
    'plan.setFree': 'Passer en gratuit',
    'plan.setStandard': 'Passer en standard',
    'plan.setFreeOf': 'Passer {name} au forfait gratuit',
    'plan.setStandardOf': 'Passer {name} au forfait standard',
    'plan.changed': '{name} est maintenant au forfait {plan}.',
    'plan.testHeading': 'Tester avec mon compte',
    'plan.testBlurb':
      'Votre compte se comporte comme un compte de ce forfait : même modèle de texte, même plafond du jour, images libres, générateurs payants fermés. Vous gardez l’administration, et c’est ici que vous revenez au forfait standard.',
    'plan.testLabel': 'Mon compte se comporte comme',
    'plan.testOn':
      'Test en cours : votre compte suit les règles d’un compte gratuit. Revenez au forfait standard une fois le test fini.',
    'plan.testSaved': 'Votre compte suit maintenant le forfait {plan}.',
    'plan.testBadge': 'Test gratuit',
    'plan.testBadgeTitle':
      'Votre compte administrateur se comporte comme un compte gratuit. Revenez au forfait standard dans Admin → Utilisateurs.',

    // Admin → Text model, third profile
    'plan.textProfile': '③ Forfait gratuit — tout ce que demandent les comptes gratuits',
    'plan.textProfileBlurb1': 'Écrit les écrans',
    'plan.textProfileBlurbAnd': 'et',
    'plan.textProfileBlurb2':
      'le Design Dossier des comptes au forfait gratuit. Choisissez un modèle qui ne coûte rien : un modèle « :free » d’OpenRouter avec une clé sans crédit, une clé Groq, Gemini ou Cerebras sans moyen de paiement, ou un modèle qui tourne sur ce serveur (Ollama, LM Studio).',
    'plan.textProfileNoFallback': 'Laissé vide, il n’emprunte jamais le modèle de génération.',
    'plan.textEmpty': 'Aucun — les comptes gratuits utilisent leur propre clé',
  },
  en: {
    'plan.label': 'Plan',
    'plan.free': 'Free',
    'plan.standard': 'Standard',

    'plan.cardTitle': 'Free plan',
    'plan.cardBody':
      'Your generations go through a free model, and your pictures and footage come from the free libraries (Pexels, Pixabay). AI-generated images and videos are not available on this plan.',
    'plan.model': 'Model: {model}',
    'plan.ownKey':
      'This instance has no free model: fill in your own provider below. It is used with your key, with no daily limit.',
    'plan.usage': '{used} of {limit} generations today — the count starts over at midnight.',
    'plan.unlimited': 'Unlimited generations.',
    'plan.askAdmin': 'An administrator can move your account to the standard plan.',

    'plan.adminHeading': 'Free plan',
    'plan.adminBlurb':
      'A free account costs the instance nothing: its text goes to the free model (Text model → ③), its pictures and footage come from the free libraries, and the paid generators are closed to it. An administrator stays on the standard plan, except to test it (below).',
    'plan.newAccounts': 'Plan for new accounts',
    'plan.newAccountsHelp':
      'For public sign-ups, Dashy accounts and, by default, accounts created here. Existing accounts do not change.',
    'plan.dailyLimit': 'Generations a day, per free account',
    'plan.dailyLimitHelp':
      '0 = unlimited. A new screen, an edit, a polish or an accessibility fix each count as one. Resets at midnight, server time.',
    'plan.save': 'Save',
    'plan.saved': 'Free plan saved.',
    'plan.noModel':
      'No free model is configured: free accounts use their own key (Settings) and the limit does not apply. They never reach the paid model.',
    'plan.setFree': 'Move to free',
    'plan.setStandard': 'Move to standard',
    'plan.setFreeOf': 'Move {name} to the free plan',
    'plan.setStandardOf': 'Move {name} to the standard plan',
    'plan.changed': '{name} is now on the {plan} plan.',
    'plan.testHeading': 'Test with my account',
    'plan.testBlurb':
      'Your account behaves like an account on this plan: same text model, same daily limit, free pictures, paid generators closed. You keep administration, and this is where you come back to the standard plan.',
    'plan.testLabel': 'My account behaves as',
    'plan.testOn':
      'Test running: your account follows the rules of a free account. Come back to the standard plan when you are done.',
    'plan.testSaved': 'Your account now follows the {plan} plan.',
    'plan.testBadge': 'Testing free',
    'plan.testBadgeTitle':
      'Your administrator account behaves like a free account. Come back to the standard plan in Admin → Users.',

    'plan.textProfile': '③ Free plan — everything free accounts ask for',
    'plan.textProfileBlurb1': 'Writes the screens',
    'plan.textProfileBlurbAnd': 'and',
    'plan.textProfileBlurb2':
      'the Design Dossier of accounts on the free plan. Pick a model that costs nothing: an OpenRouter ":free" model with a key that holds no credit, a Groq, Gemini or Cerebras key with no payment method, or a model running on this server (Ollama, LM Studio).',
    'plan.textProfileNoFallback': 'Left empty, it never borrows the generation model.',
    'plan.textEmpty': 'None — free accounts use their own key',
  },
}
