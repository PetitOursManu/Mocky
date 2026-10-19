/**
 * Translations for the project's workspace: the top bar, the creation column on
 * the left and the inspector on the right (ProjectView, Inspector, ProjectBar).
 *
 * Same rules as every area: `fr` and `en` carry the same keys, keys are
 * `workspace.something`, placeholders are `{name}`.
 */
export const workspace = {
  fr: {
    'workspace.projects': 'Projets',
    'workspace.tools': 'Outils de la toile',
    'workspace.select': 'Sélectionner',
    'workspace.selectTitle': 'Sélection — aucun mode actif',

    'workspace.atelier': 'Atelier de création',
    'workspace.newScreen': 'Nouvel écran',
    'workspace.editOne': 'Modifier l’écran',
    'workspace.editMany': 'Modifier {count} écrans',
    'workspace.screens_one': '1 écran dans ce projet',
    'workspace.screens_other': '{count} écrans dans ce projet',
    'workspace.editHint': 'Votre message s’applique à la sélection.',
    'workspace.alsoMake': 'Créer aussi',
    'workspace.history': 'Historique récent',
    'workspace.historyTitle': 'Afficher cet écran sur la toile',

    'workspace.inspector': 'Inspecteur',
    'workspace.inspectorOpen': 'Afficher l’inspecteur',
    'workspace.inspectorClose': 'Masquer l’inspecteur',
    'workspace.inspectorMore': 'Autres panneaux',
    'workspace.style': 'Style',
    'workspace.ready': 'Prêt',
    'workspace.stack': 'React + Tailwind',

    'workspace.share': 'Partager',
    'workspace.shareScreen': 'Lien vers l’écran (QR code)',
    'workspace.shareScreenNeeds': 'Sélectionnez un seul écran pour le partager.',
    'workspace.shareReview': 'Envoyer en validation…',
    'workspace.shareReviewHint': 'Le projet entier : votre client commente et approuve.',

    'workspace.tabCanvas': 'Toile',
    'workspace.tabCode': 'Code',
    'workspace.tabCodeNeeds': 'Sélectionnez un écran pour voir son code.',
    'workspace.saved': 'Toutes les modifications enregistrées',
    'workspace.saving': 'Enregistrement…',
    'workspace.saveFailed': 'L’enregistrement a échoué',
    'workspace.savePaused': 'Enregistrement en pause',
    'workspace.screenTools': 'Actions de l’écran sélectionné',
    'workspace.screenExport': 'Exporter l’écran',
    'workspace.screenMore': 'Toutes les actions de l’écran',

    'workspace.exportProject': 'Le projet',
    'workspace.exportScreen': 'L’écran sélectionné',
    'workspace.exportScreenNeeds': 'Sélectionnez un seul écran pour l’exporter.',
    'workspace.exportMedia': 'Les médias',
    'workspace.mediaLibrary': 'Ouvrir la médiathèque',
  } as Record<string, string>,
  en: {
    'workspace.projects': 'Projects',
    'workspace.tools': 'Canvas tools',
    'workspace.select': 'Select',
    'workspace.selectTitle': 'Select — no mode on',

    'workspace.atelier': 'Creation workshop',
    'workspace.newScreen': 'New screen',
    'workspace.editOne': 'Edit the screen',
    'workspace.editMany': 'Edit {count} screens',
    'workspace.screens_one': '1 screen in this project',
    'workspace.screens_other': '{count} screens in this project',
    'workspace.editHint': 'Your message applies to the selection.',
    'workspace.alsoMake': 'Also make',
    'workspace.history': 'Recent history',
    'workspace.historyTitle': 'Show this screen on the canvas',

    'workspace.inspector': 'Inspector',
    'workspace.inspectorOpen': 'Show the inspector',
    'workspace.inspectorClose': 'Hide the inspector',
    'workspace.inspectorMore': 'More panels',
    'workspace.style': 'Style',
    'workspace.ready': 'Ready',
    'workspace.stack': 'React + Tailwind',

    'workspace.share': 'Share',
    'workspace.shareScreen': 'Link to the screen (QR code)',
    'workspace.shareScreenNeeds': 'Select one screen to share it.',
    'workspace.shareReview': 'Send for approval…',
    'workspace.shareReviewHint': 'The whole project: your client comments and approves.',

    'workspace.tabCanvas': 'Canvas',
    'workspace.tabCode': 'Code',
    'workspace.tabCodeNeeds': 'Select a screen to see its code.',
    'workspace.saved': 'All changes saved',
    'workspace.saving': 'Saving…',
    'workspace.saveFailed': 'Saving failed',
    'workspace.savePaused': 'Saving paused',
    'workspace.screenTools': 'Actions on the selected screen',
    'workspace.screenExport': 'Export the screen',
    'workspace.screenMore': 'All the screen’s actions',

    'workspace.exportProject': 'The project',
    'workspace.exportScreen': 'The selected screen',
    'workspace.exportScreenNeeds': 'Select one screen to export it.',
    'workspace.exportMedia': 'Media',
    'workspace.mediaLibrary': 'Open the media library',
  } as Record<string, string>,
}
