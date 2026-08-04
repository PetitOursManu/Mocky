import { describe, it, expect } from 'vitest'
import { parseDesignSpec, replaceSectionBody, readSectionBody } from './designSpec'
import { replaceTokenHex } from './designTokens'

/**
 * A Muse dossier, in the exact grammar `dossierToMarkdown` emits. Trimmed, but
 * every heading and every line shape is the real one — if the server's renderer
 * drifts, this is where it should hurt.
 */
const DOSSIER = `# Design Dossier — Untitled project

## Product
Cadence

## Concept
Une lecture éditoriale des chiffres : grande serif pour les nombres, annotations rouges, grille imprimée.

## References
- https://fonts.google.com/specimen/DM+Serif+Display — Typographie d’affichage expressive.
- https://fonts.google.com/specimen/Inter — Sans fonctionnelle pour les libellés.

## Tokens

### Colors
- Papier: #fdfcf8  (background)
- Encre: #1a1a1a  (text)
- Signal: #c0392b  (accent)

### Typography
- Display: Cormorant Garamond
- Body: Instrument Sans
- Scale: Sauts éditoriaux marqués

### Radius
- rounded-xl

## Layout Grammar
- Grille asymétrique, marges généreuses.
- Regroupements narratifs plutôt qu’une rangée de cartes.

## Motion Language
- Apparitions sobres, jamais de rebond.

## Voice & Copy
- Headline: Le bon plan pour chaque rythme.

## Imagery Plan
- hero: un atelier, lumière rasante.

## Forbidden
- dégradés violet-bleu sur fond sombre
- trois cartes de fonctionnalités identiques
`

/** A derived DESIGN.md, in the section order DESIGN_EXTRACT_PROMPT fixes. */
const DESIGN_MD = `# Design System

## Product
Nimbus

## Color tokens
- Primary: #4f46e5 (indigo-600)
- Background: #0f172a
- Text: #e2e8f0

## Typography
- Display: Instrument Serif
- Body: Inter

## Spacing & radius
- Radius: rounded-lg

## Component patterns
- Boutons pleins pour l’action principale, contour pour le reste.
- Cartes séparées par un filet, jamais par une ombre.
`

describe('parseDesignSpec — le dossier', () => {
  const s = parseDesignSpec(DOSSIER)

  it('se reconnaît comme dossier et lit son identité', () => {
    expect(s.kind).toBe('dossier')
    expect(s.productName).toBe('Cadence')
    expect(s.heading).toBe('Design Dossier — Untitled project')
  })

  it('lit le concept, qui est la ligne de cap', () => {
    expect(s.concept).toContain('lecture éditoriale')
  })

  it('lit la typographie déclarée', () => {
    expect(s.typography.display).toBe('Cormorant Garamond')
    expect(s.typography.body).toBe('Instrument Sans')
    expect(s.typography.scale).toContain('éditoriaux')
  })

  it('prend la palette de la section Colors, avec ses rôles', () => {
    expect(s.colors.map((c) => c.label)).toEqual(['Papier', 'Encre', 'Signal'])
    expect(s.stated.bg).toBe(true)
    expect(s.stated.accent).toBe(true)
    // Rien dans ce document ne déclare une surface : le dire est le but même
    // du drapeau. parseDesignSystem en invente une pour pouvoir dessiner.
    expect(s.stated.surface).toBe(false)
  })

  it('compose les DO depuis la grammaire, les DON’T depuis Forbidden', () => {
    expect(s.dos).toHaveLength(3) // 2 de layout + 1 de motion
    expect(s.dos[0]).toContain('Grille asymétrique')
    expect(s.dosSource).toBe('layout-grammar')
    expect(s.donts).toEqual([
      'dégradés violet-bleu sur fond sombre',
      'trois cartes de fonctionnalités identiques',
    ])
  })

  it('garde les références comme provenance', () => {
    expect(s.references).toHaveLength(2)
    expect(s.references[0]).toContain('DM+Serif+Display')
  })
})

describe('parseDesignSpec — le DESIGN.md dérivé', () => {
  const s = parseDesignSpec(DESIGN_MD)

  it('se reconnaît, et n’a pas de concept', () => {
    expect(s.kind).toBe('design-md')
    expect(s.productName).toBe('Nimbus')
    // Le prompt d'extraction ne demande pas de concept. L'omettre est correct ;
    // le paraphraser depuis la palette serait de la fiction.
    expect(s.concept).toBeNull()
  })

  it('n’a pas de colonne DON’T, et n’en invente pas', () => {
    expect(s.donts).toEqual([])
    expect(s.dos).toHaveLength(2)
    // Étiqueté selon sa source : appeler une règle de composants une
    // « grammaire de mise en page » serait un petit mensonge de l'interface.
    expect(s.dosSource).toBe('component-patterns')
  })

  it('lit quand même sa typographie et sa palette', () => {
    expect(s.typography.display).toBe('Instrument Serif')
    expect(s.colors.map((c) => c.label)).toEqual(['Primary', 'Background', 'Text'])
    expect(s.system.radius).toBe('10px')
  })
})

describe('parseDesignSpec — les documents pauvres', () => {
  it('ne s’effondre pas sur un document vide', () => {
    const s = parseDesignSpec('')
    expect(s.colors).toEqual([])
    expect(s.dos).toEqual([])
    expect(s.donts).toEqual([])
    expect(s.productName).toBeNull()
    expect(s.dosSource).toBeNull()
  })

  it('ne s’effondre pas sur un document sans aucune section connue', () => {
    const s = parseDesignSpec('# Design System\n\nDu texte, et rien de structuré.\n')
    expect(s.heading).toBe('Design System')
    expect(s.concept).toBeNull()
    expect(s.typography.display).toBeUndefined()
  })

  it('lit une section qui termine le document', () => {
    // Le piège déjà rencontré sur extractProductName : une section sans
    // successeur doit aller jusqu'à la fin du fichier.
    const s = parseDesignSpec('# Design Dossier — x\n\n## Forbidden\n- un seul interdit\n')
    expect(s.donts).toEqual(['un seul interdit'])
  })
})

describe('l’édition depuis la feuille', () => {
  // La feuille recolore via replaceTokenHex, en s'appuyant sur la position
  // source de chaque jeton. Ce test vérifie le contrat dont elle dépend : la
  // position pointe sur le hex de la PALETTE, même quand la même couleur est
  // citée ailleurs dans le document.
  const md = `# Design Dossier — Essai

## Concept
Le rouge #d9342b ne sert qu'aux décisions.

## Tokens

### Colors
- Papier: #f7f7f3  (Arrière-plan principal)
- Rouge décision: #d9342b  (Appels à l'action)
`

  it('recolore le jeton et laisse la prose intacte', () => {
    const spec = parseDesignSpec(md)
    const rouge = spec.colors.find((c) => c.label === 'Rouge décision')!
    const next = replaceTokenHex(md, rouge, '#1155ff')
    expect(next).toContain('- Rouge décision: #1155ff')
    // La phrase du concept cite la même couleur et ne doit pas bouger.
    expect(next).toContain("Le rouge #d9342b ne sert qu'aux décisions.")
  })

  it('relit le document modifié sans perdre les rôles', () => {
    const spec = parseDesignSpec(md)
    const papier = spec.colors.find((c) => c.label === 'Papier')!
    const after = parseDesignSpec(replaceTokenHex(md, papier, '#ffffff'))
    const relu = after.colors.find((c) => c.label === 'Papier')!
    expect(relu.hex).toBe('#ffffff')
    expect(relu.role).toBe('bg')
    expect(after.stated.bg).toBe(true)
  })
})

describe('replaceSectionBody', () => {
  it('remplace une section et ne touche à rien d’autre', () => {
    const next = replaceSectionBody(DOSSIER, 'grammar', '- Une seule règle, réécrite.')
    expect(next).toContain('- Une seule règle, réécrite.')
    expect(next).not.toContain('Grille asymétrique')
    // Les voisines immédiates survivent intactes.
    expect(next).toContain('## Motion Language')
    expect(next).toContain('- Apparitions sobres, jamais de rebond.')
    expect(next).toContain('## Forbidden')
    expect(next).toContain('- Signal: #c0392b')
  })

  it('relit correctement le document réécrit', () => {
    const next = replaceSectionBody(DOSSIER, 'forbidden', '- un seul interdit\n- et un deuxième')
    const s = parseDesignSpec(next)
    expect(s.donts).toEqual(['un seul interdit', 'et un deuxième'])
    // Le reste du dossier n'a pas bougé.
    expect(s.productName).toBe('Cadence')
    expect(s.colors).toHaveLength(3)
    expect(s.dos).toHaveLength(3)
  })

  it('laisse le document intact si la section n’existe pas', () => {
    // Un DESIGN.md dérivé n'a pas de Forbidden. Créer la section reviendrait à
    // mettre dans le fichier quelque chose qu'il n'a jamais eu.
    expect(replaceSectionBody(DESIGN_MD, 'forbidden', '- rien')).toBe(DESIGN_MD)
  })

  it('n’empile pas les lignes vides au fil des éditions', () => {
    let md = DOSSIER
    for (let i = 0; i < 4; i++) md = replaceSectionBody(md, 'concept', `Version ${i}.`)
    expect(md).not.toMatch(/\n{3,}/)
    expect(parseDesignSpec(md).concept).toBe('Version 3.')
  })

  it('lit le corps brut d’une section', () => {
    expect(readSectionBody(DOSSIER, 'typography')).toContain('- Display: Cormorant Garamond')
    expect(readSectionBody(DESIGN_MD, 'forbidden')).toBeNull()
  })
})
