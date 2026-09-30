/**
 * Translations for the end-of-generation chime (settings panel).
 *
 * Its own area so the chime's strings never touch the settings file the
 * provider form lives in. Same rules as every area: identical key sets, keys
 * under `chime.`.
 */
export const chime = {
  fr: {
    'chime.heading': 'Notification',
    'chime.toggle': 'Son de fin de génération',
    'chime.help':
      'Un court carillon quand une génération se termine alors que Mocky n’est pas l’onglet affiché, et un autre, plus grave, si elle a échoué. Le titre de l’onglet affiche aussi ✓ ou ⚠ jusqu’à votre retour. Réglage conservé dans ce navigateur.',
    'chime.test': 'Tester',
    'chime.unavailable': 'Ce navigateur n’a pas pu jouer le son.',
  },
  en: {
    'chime.heading': 'Notification',
    'chime.toggle': 'Sound when a generation finishes',
    'chime.help':
      'A short chime when a generation finishes while Mocky is not the tab on screen, and a lower one if it failed. The tab’s title also shows ✓ or ⚠ until you come back. Kept in this browser.',
    'chime.test': 'Test',
    'chime.unavailable': 'This browser could not play the sound.',
  },
}
