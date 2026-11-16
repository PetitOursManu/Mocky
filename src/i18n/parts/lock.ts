/**
 * Translations for locked elements (`lib/locks.ts`, the Modify popup in
 * ProjectView). Same rules as every area: `fr` and `en` carry the same keys.
 */
export const lock = {
  fr: {
    'lock.lock': 'Verrouiller',
    'lock.unlock': 'Déverrouiller',
    'lock.lockHint': 'Les retouches de l’IA (modification, polissage, accessibilité, ajustement) laisseront cet élément tel quel.',
    'lock.lockedHere':
      'Cet élément est verrouillé : les retouches de l’IA le laissent tel quel, et une retouche qui le supprimerait est refusée. Déverrouille-le pour le modifier.',
    'lock.done': '{n} élément(s) verrouillé(s).',
    'lock.undone': '{n} élément(s) déverrouillé(s).',
    'lock.failed': 'Impossible de (dé)verrouiller cet élément : il n’a pas été retrouvé dans le code.',
    'lock.restored': 'Sur « {name} », la retouche avait changé un élément verrouillé ({names}) : il a été remis tel quel.',
    'lock.lost': 'Retouche refusée : elle supprimait un élément verrouillé ({names}). Déverrouille-le d’abord si c’est voulu.',
  },
  en: {
    'lock.lock': 'Lock',
    'lock.unlock': 'Unlock',
    'lock.lockHint': 'The AI’s passes (edit, polish, accessibility, fit) will leave this element as it is.',
    'lock.lockedHere':
      'This element is locked: the AI’s passes leave it as it is, and a pass that would remove it is refused. Unlock it to change it.',
    'lock.done': '{n} element(s) locked.',
    'lock.undone': '{n} element(s) unlocked.',
    'lock.failed': 'This element could not be (un)locked: it was not found in the code.',
    'lock.restored': 'On “{name}”, the pass had changed a locked element ({names}): it was put back as it was.',
    'lock.lost': 'Pass refused: it removed a locked element ({names}). Unlock it first if that is intended.',
  },
}
