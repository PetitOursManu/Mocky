/**
 * Translations for the "design" area.
 *
 * One file per area so several people (or agents) can add strings at once
 * without ever touching the same file. `parts/index.ts` merges them all.
 *
 * Rules:
 *  - the key set of `fr` and `en` must match exactly — a test enforces it;
 *  - keys are `design.something`, so an area can never collide with another;
 *  - placeholders are `{name}`.
 */
export const design = {
  fr: {
    // DESIGN.md page
    'design.saved': 'Enregistré',
    'design.intro1':
      'Un système de design portable. Quand il est actif, tout son contenu est placé en tête de chaque demande de génération, pour que les écrans restent fidèles à votre marque. Du Markdown, rien de plus — collez-le, chargez un fichier',
    'design.intro2':
      ', partez du modèle de départ, ou choisissez un style prêt à l’emploi ci-dessous.',

    // Style presets
    'design.previewMode': 'Mode d’aperçu',
    'design.modeAuto': 'Auto',
    'design.modeLight': 'Clair',
    'design.modeDark': 'Sombre',
    'design.modeAutoHint': 'Aperçu et application des styles tels qu’ils ont été écrits',
    'design.modeLightHint': 'Aperçu et application des styles en mode clair',
    'design.modeDarkHint': 'Aperçu et application des styles en mode sombre',
    'design.applyNamed': 'Appliquer « {name} »',
    'design.previewLarger': 'Agrandir l’aperçu',
    'design.preview': 'Aperçu',
    'design.accent': 'Accent',
    'design.accentOriginal': 'Accent d’origine',
    'design.background': 'Fond',
    'design.backgroundOriginal': 'Fond d’origine',
    'design.stylePreset': 'Style prédéfini',
    'design.applyStyle': 'Appliquer ce style',

    // Mini-mockup shown inside each preset card
    'design.mockUsers': 'Visiteurs',
    'design.mockSales': 'Ventes',
    'design.mockRate': 'Taux',
    'design.mockLive': 'En ligne',
    'design.mockNew': 'Nouveau',
    'design.mockDraft': 'Brouillon',
    'design.mockCta': 'Commencer →',

    // Source column
    'design.source': 'Source',
    'design.charsUnit': 'signes',
    'design.sourcePlaceholder':
      '# Système de design\n\n## Couleurs\n- Primaire : #4f46e5\n…',
    'design.file': 'Fichier',
    'design.useTemplate': 'Partir du modèle',
    'design.clearConfirm': 'Effacer le contenu du DESIGN.md ?',
    'design.usage': 'Utilisation',

    // Design system panel (on the canvas)
    'design.edit': 'Modifier',
    'design.editHint': 'Ouvrir l’éditeur complet du DESIGN.md',
    'design.empty':
      'Aucun système de design pour l’instant. Choisissez un style sur un nouveau projet, ou',
    'design.editDesignMd': 'modifiez le DESIGN.md',
    'design.palette': 'Palette · cliquez pour recolorer',
    'design.swatchTitle': '{label} · {hex} — cliquez pour changer la couleur',
    'design.recolor': 'Recolorer',
    'design.apply': 'Appliquer',

    // Live sample rendered from the design system
    'design.sampleHeading': 'Portez ce vieux whisky',
    'design.sampleMuted': 'Un texte secondaire se pose juste sous le titre.',
    'design.samplePrimary': 'Principal',
    'design.sampleSecondary': 'Secondaire',
    'design.sampleCardTitle': 'Titre de la carte',
    'design.sampleCardBody': 'Un panneau posé sur le fond, avec une bordure.',
    'design.sampleInput': 'Champ de saisie…',
    // ---- la feuille de spécification (DesignSpecSheet) ----
    'design.spec.overview': 'Direction',
    'design.spec.colors': 'Couleurs',
    'design.spec.typography': 'Typographie',
    'design.spec.surfaces': 'Surfaces',
    'design.spec.components': 'Composants',
    'design.spec.rules': 'Règles',
    'design.spec.declared': 'Familles déclarées par le document',
    'design.spec.defaulted': 'par défaut',
    'design.spec.radius': 'Rayon',
    'design.spec.recolour': 'Modifier cette couleur',
    'design.spec.apply': 'Appliquer',
    'design.spec.edit': 'Modifier cette section',
    'design.spec.editShort': 'Modifier',
    'design.spec.doneShort': 'Terminé',
    'design.spec.done': 'Terminer la modification',
    'design.spec.editHint': 'Markdown brut de la section. Les modifications ne sont enregistrées qu’avec le bouton en haut.',
    'design.spec.save': 'Enregistrer',
    'design.spec.saveAndApply': 'Enregistrer et utiliser pour ce projet',
    'design.spec.revert': 'Annuler',
    'design.spec.unsaved': 'Modifications non enregistrées.',
    'design.spec.grammar': 'Grammaire',
    'design.spec.patterns': 'Motifs',
    'design.spec.forbidden': 'À proscrire',
    'design.spec.sampleAction': 'Action',
    'design.spec.sampleSecondary': 'Secondaire',
    'design.spec.samplePill': 'Étiquette',
    'design.spec.sampleCard': 'Carte',
    'design.spec.role.bg': 'fond',
    'design.spec.role.surface': 'surface',
    'design.spec.role.text': 'texte',
    'design.spec.role.muted': 'atténué',
    'design.spec.role.accent': 'accent',
    'design.spec.role.accentText': 'sur accent',
    'design.spec.role.border': 'filet',
  } as Record<string, string>,
  en: {
    // DESIGN.md page
    'design.saved': 'Saved',
    'design.intro1':
      'A portable design system. When it is on, its full content is prepended to every generation prompt so screens stay on-brand. Plain Markdown — paste it, load a',
    'design.intro2': ' file, start from the template, or pick a ready-made style below.',

    // Style presets
    'design.previewMode': 'Preview mode',
    'design.modeAuto': 'Auto',
    'design.modeLight': 'Light',
    'design.modeDark': 'Dark',
    'design.modeAutoHint': 'Preview and apply styles as they were authored',
    'design.modeLightHint': 'Preview and apply styles in light mode',
    'design.modeDarkHint': 'Preview and apply styles in dark mode',
    'design.applyNamed': 'Apply “{name}”',
    'design.previewLarger': 'Preview larger',
    'design.preview': 'Preview',
    'design.accent': 'Accent',
    'design.accentOriginal': 'Original accent',
    'design.background': 'Background',
    'design.backgroundOriginal': 'Original background',
    'design.stylePreset': 'Style preset',
    'design.applyStyle': 'Apply this style',

    // Mini-mockup shown inside each preset card
    'design.mockUsers': 'Users',
    'design.mockSales': 'Sales',
    'design.mockRate': 'Rate',
    'design.mockLive': 'Live',
    'design.mockNew': 'New',
    'design.mockDraft': 'Draft',
    'design.mockCta': 'Get started →',

    // Source column
    'design.source': 'Source',
    'design.charsUnit': 'chars',
    'design.sourcePlaceholder': '# Design System\n\n## Color tokens\n- Primary: #4f46e5\n…',
    'design.file': 'File',
    'design.useTemplate': 'Use the starter template',
    'design.clearConfirm': 'Clear the DESIGN.md content?',
    'design.usage': 'Usage',

    // Design system panel (on the canvas)
    'design.edit': 'Edit',
    'design.editHint': 'Open the full DESIGN.md editor',
    'design.empty': 'No design system yet. Pick a style on a new project, or',
    'design.editDesignMd': 'edit DESIGN.md',
    'design.palette': 'Palette · click to recolour',
    'design.swatchTitle': '{label} · {hex} — click to change the colour',
    'design.recolor': 'Recolour',
    'design.apply': 'Apply',

    // Live sample rendered from the design system
    'design.sampleHeading': 'The quick brown fox',
    'design.sampleMuted': 'Muted supporting copy sits beneath the heading.',
    'design.samplePrimary': 'Primary',
    'design.sampleSecondary': 'Secondary',
    'design.sampleCardTitle': 'Card title',
    'design.sampleCardBody': 'A surface panel with a border.',
    'design.sampleInput': 'Input field…',
    // ---- the specification sheet (DesignSpecSheet) ----
    'design.spec.overview': 'Direction',
    'design.spec.colors': 'Colours',
    'design.spec.typography': 'Typography',
    'design.spec.surfaces': 'Surfaces',
    'design.spec.components': 'Components',
    'design.spec.rules': 'Rules',
    'design.spec.declared': 'Families declared by the document',
    'design.spec.defaulted': 'defaulted',
    'design.spec.radius': 'Radius',
    'design.spec.recolour': 'Change this colour',
    'design.spec.apply': 'Apply',
    'design.spec.edit': 'Edit this section',
    'design.spec.editShort': 'Edit',
    'design.spec.doneShort': 'Done',
    'design.spec.done': 'Finish editing',
    'design.spec.editHint': 'The section’s raw Markdown. Changes are only stored with the button above.',
    'design.spec.save': 'Save',
    'design.spec.saveAndApply': 'Save and use for this project',
    'design.spec.revert': 'Discard',
    'design.spec.unsaved': 'Unsaved changes.',
    'design.spec.grammar': 'Grammar',
    'design.spec.patterns': 'Patterns',
    'design.spec.forbidden': 'Never',
    'design.spec.sampleAction': 'Action',
    'design.spec.sampleSecondary': 'Secondary',
    'design.spec.samplePill': 'Tag',
    'design.spec.sampleCard': 'Card',
    'design.spec.role.bg': 'background',
    'design.spec.role.surface': 'surface',
    'design.spec.role.text': 'text',
    'design.spec.role.muted': 'muted',
    'design.spec.role.accent': 'accent',
    'design.spec.role.accentText': 'on accent',
    'design.spec.role.border': 'border',
  } as Record<string, string>,
}
