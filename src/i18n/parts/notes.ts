/**
 * Translations for a screen's private notes. See `lib/screenNotes.ts`.
 *
 * Same rules as every area: `fr` and `en` carry the same keys, keys are
 * `notes.something`, placeholders are `{name}`.
 */
export const notes = {
  fr: {
    'notes.menu': 'Notes',
    'notes.menuCount': 'Notes ({count})',
    'notes.title': 'Notes — {name}',
    'notes.private':
      'Ces notes sont pour vous seul : elles ne sont jamais envoyées au modèle. Pour qu’une remarque influence la prochaine génération, recopiez-la dans le composeur.',
    'notes.empty': 'Aucune note sur cet écran pour l’instant.',
    'notes.placeholder': 'Ce qui marche, ce qui ne marche pas, l’idée à essayer ensuite…',
    'notes.addLabel': 'Nouvelle note',
    'notes.editLabel': 'Modifier la note',
    'notes.add': 'Ajouter',
    'notes.save': 'Enregistrer',
    'notes.edit': 'Modifier la note',
    'notes.delete': 'Supprimer la note',
    'notes.deleteConfirm': 'Supprimer cette note ?',
    'notes.edited': 'modifiée le {date}',
    'notes.shortcut': 'Ctrl + Entrée pour ajouter',
    'notes.badgeTitle': '{count} note(s) sur cet écran — cliquez pour les lire',
    'notes.open': 'Notes sur cet écran',
  } as Record<string, string>,
  en: {
    'notes.menu': 'Notes',
    'notes.menuCount': 'Notes ({count})',
    'notes.title': 'Notes — {name}',
    'notes.private':
      'These notes are for you alone: they are never sent to the model. For a remark to shape the next generation, copy it into the composer.',
    'notes.empty': 'No notes on this screen yet.',
    'notes.placeholder': 'What works, what does not, the idea to try next…',
    'notes.addLabel': 'New note',
    'notes.editLabel': 'Edit the note',
    'notes.add': 'Add',
    'notes.save': 'Save',
    'notes.edit': 'Edit the note',
    'notes.delete': 'Delete the note',
    'notes.deleteConfirm': 'Delete this note?',
    'notes.edited': 'edited {date}',
    'notes.shortcut': 'Ctrl + Enter to add',
    'notes.badgeTitle': '{count} note(s) on this screen — click to read them',
    'notes.open': 'Notes on this screen',
  } as Record<string, string>,
}
