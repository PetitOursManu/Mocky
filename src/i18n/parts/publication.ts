/**
 * Translations for publications — magazines and books made as several sheets
 * under one direction of their own. See `lib/publication.ts`.
 *
 * Same rules as every area: `fr` and `en` carry the same keys, keys are
 * `publication.something`, placeholders are `{name}`.
 */
export const publication = {
  fr: {
    'publication.planning': 'Plan des feuilles…',
    'publication.making': 'Feuille {n} sur {total} : {name}',
    'publication.made': '« {title} » : {count} feuilles, une seule direction artistique. Générez à nouveau avec ce type pour ajouter une page.',
    'publication.adding': 'Nouvelle page pour « {title} »…',
    'publication.added': 'Page ajoutée à « {title} », avant la quatrième de couverture.',
  },
  en: {
    'publication.planning': 'Planning the sheets…',
    'publication.making': 'Sheet {n} of {total}: {name}',
    'publication.made': '“{title}”: {count} sheets, one art direction. Generate again with this type to add a page.',
    'publication.adding': 'New page for “{title}”…',
    'publication.added': 'Page added to “{title}”, before the back cover.',
  },
}
