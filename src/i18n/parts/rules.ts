/**
 * Translations for a project's rules and the offer to keep a correction as one
 * (`lib/rules.ts`, `components/RulesDialog.tsx`, ProjectView). Same rules as
 * every area: `fr` and `en` carry the same keys, placeholders are `{name}`.
 */
export const rules = {
  fr: {
    'rules.option': 'Règles',
    'rules.optionHint': 'Ce que ce projet doit toujours respecter',
    'rules.title': 'Règles du projet',
    'rules.help':
      'Une règle par ligne, envoyée à chaque création et à chaque retouche des écrans de ce projet. Une demande précise l’emporte sur une règle.',
    'rules.project': 'Règles de ce projet',
    'rules.placeholder': 'Assiette entièrement visible\nAucun visage\nFond sobre',
    'rules.brand': 'Règles de la marque « {name} »',
    'rules.brandNone': 'Cette marque n’a pas de règle.',
    'rules.brandWhere': 'Elles s’appliquent aussi, et se modifient dans Réglages → Mes marques.',
    'rules.offerToggle': 'Après une correction, proposer de la retenir comme règle',
    'rules.save': 'Enregistrer',
    'rules.offerTitle': 'Retenir cette correction pour les prochains écrans ?',
    'rules.offerRule': 'Règle à retenir',
    'rules.offerWhere': 'Où la retenir',
    'rules.forProject': 'Pour ce projet',
    'rules.forBrand': 'Pour la marque « {name} »',
    'rules.offerKeep': 'Retenir',
    'rules.offerNo': 'Non merci',
    'rules.offerNever': 'Ne plus proposer',
    'rules.keptProject': 'Règle retenue pour ce projet (Règles, dans les options du composeur).',
    'rules.keptBrand': 'Règle retenue pour la marque « {name} » (Réglages → Mes marques).',
  },
  en: {
    'rules.option': 'Rules',
    'rules.optionHint': 'What this project must always respect',
    'rules.title': 'Project rules',
    'rules.help':
      'One rule per line, sent with every new screen and every pass on the screens of this project. A specific request wins over a rule.',
    'rules.project': 'This project’s rules',
    'rules.placeholder': 'The plate fully visible\nNo faces\nA plain background',
    'rules.brand': 'Rules of the brand “{name}”',
    'rules.brandNone': 'This brand has no rule.',
    'rules.brandWhere': 'They apply too, and are changed in Settings → My brands.',
    'rules.offerToggle': 'After a correction, offer to keep it as a rule',
    'rules.save': 'Save',
    'rules.offerTitle': 'Keep this correction for the next screens?',
    'rules.offerRule': 'Rule to keep',
    'rules.offerWhere': 'Where to keep it',
    'rules.forProject': 'For this project',
    'rules.forBrand': 'For the brand “{name}”',
    'rules.offerKeep': 'Keep',
    'rules.offerNo': 'No thanks',
    'rules.offerNever': 'Don’t offer again',
    'rules.keptProject': 'Rule kept for this project (Rules, in the composer’s options).',
    'rules.keptBrand': 'Rule kept for the brand “{name}” (Settings → My brands).',
  },
}
