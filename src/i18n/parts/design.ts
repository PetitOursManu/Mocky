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
  } as Record<string, string>,
}
