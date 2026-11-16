/**
 * Translations for "Traduire…" (`components/TranslateDialog.tsx`,
 * `lib/translate.ts`). Same rules as every area: `fr` and `en` carry the same
 * keys, placeholders are `{name}`.
 */
export const translate = {
  fr: {
    'translate.menu': 'Traduire…',
    'translate.title': 'Traduire « {name} »',
    'translate.into': 'Langue de la copie',
    'translate.go': 'Traduire',
    'translate.how':
      'Une copie traduite est ajoutée à droite de l’écran ; l’original ne change pas. Seuls les mots sont envoyés au modèle et réécrits à leur place : la mise en page, les images et le code restent identiques.',
    'translate.working': 'Traduction de « {name} » en {lang}…',
    'translate.copyName': '{name} · {code}',
    'translate.done': '« {name} » traduit en {lang} : {n} texte(s), copie ajoutée à droite.',
    'translate.donePartial':
      '« {name} » traduit en {lang} : {n} texte(s) sur {total}. {kept} sont restés dans la langue d’origine (non traduits par le modèle, ou impossibles à écrire à leur place).',
    'translate.nothing': '« {name} » n’a aucun texte à traduire.',
    'translate.failed': 'La traduction de « {name} » a échoué : {error}',
    'translate.unparsable': 'le code de l’écran ne peut pas être lu',
  },
  en: {
    'translate.menu': 'Translate…',
    'translate.title': 'Translate “{name}”',
    'translate.into': 'Language of the copy',
    'translate.go': 'Translate',
    'translate.how':
      'A translated copy is added to the right of the screen; the original does not change. Only the words are sent to the model and written back in place: the layout, the pictures and the code stay identical.',
    'translate.working': 'Translating “{name}” into {lang}…',
    'translate.copyName': '{name} · {code}',
    'translate.done': '“{name}” translated into {lang}: {n} text(s), copy added on the right.',
    'translate.donePartial':
      '“{name}” translated into {lang}: {n} text(s) out of {total}. {kept} stayed in the original language (not translated by the model, or impossible to write in place).',
    'translate.nothing': '“{name}” has no text to translate.',
    'translate.failed': 'Translating “{name}” failed: {error}',
    'translate.unparsable': 'the screen’s code cannot be read',
  },
}
