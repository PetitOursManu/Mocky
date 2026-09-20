import { describe, it, expect } from 'vitest'
import { parseColors, parseDesignSystem, replaceTokenHex, roleForLabel } from './designTokens'
import { isDarkColor } from './styles'

const MD = `# Design System
## Color tokens
- Background: #0f172a
- Surface: #1e293b
- Text: #e2e8f0
- Muted text: #94a3b8
- Primary: #6366f1
- Border: #334155
## Spacing & radius
- Radius: rounded-xl for cards
`

describe('roleForLabel', () => {
  it('maps common labels to roles', () => {
    expect(roleForLabel('Primary')).toBe('accent')
    expect(roleForLabel('Background')).toBe('bg')
    expect(roleForLabel('Surface')).toBe('surface')
    expect(roleForLabel('Muted text')).toBe('muted')
    expect(roleForLabel('Text')).toBe('text')
    expect(roleForLabel('Border')).toBe('border')
    expect(roleForLabel('On primary')).toBe('accentText')
    expect(roleForLabel('Success')).toBe('other')
  })
})

describe('parseColors', () => {
  it('captures hex, label, role and a usable source offset', () => {
    const cols = parseColors(MD)
    const primary = cols.find((c) => c.label === 'Primary')!
    expect(primary.hex).toBe('#6366f1')
    expect(primary.role).toBe('accent')
    // The offset must point exactly at the '#'
    expect(MD.slice(primary.index, primary.index + 7)).toBe('#6366f1')
  })

  it('dedupes repeated colors', () => {
    expect(parseColors('- A: #ffffff\n- B: #FFFFFF')).toHaveLength(1)
  })
})

describe('parseDesignSystem', () => {
  it('resolves roles from labels', () => {
    const ds = parseDesignSystem(MD)
    expect(ds.roles.accent).toBe('#6366f1')
    expect(ds.roles.bg).toBe('#0f172a')
    expect(ds.roles.text).toBe('#e2e8f0')
    expect(ds.roles.border).toBe('#334155')
    expect(ds.radius).toBe('14px') // rounded-xl
  })

  it('fills sensible fallbacks for a bare palette', () => {
    const ds = parseDesignSystem('brand #22d3ee')
    expect(ds.roles.accent).toBe('#22d3ee')
    // One unlabelled colour is a brand colour, not a page colour — no evidence
    // to infer a background from, so the dark default stands and text is light.
    expect(ds.roles.text).toBe('#e2e8f0')
    expect(ds.roles.accentText).toBe('#0f172a') // cyan is light → dark text on it
  })
})

/**
 * A Muse dossier does not label its colours "Background" and "Surface" — it is
 * asked for a coherent palette and it names it for the design: Paper, Bone,
 * Signal. None of those match any label pattern, so the parser found no
 * background and fell back to slate-900. Two cream editorial screens therefore
 * both previewed as the same dark navy dashboard, which is what the user saw:
 * "les prévisualisations ne sont pas bonnes par rapport au thème des Iframe".
 */
describe('a design that never says "background"', () => {
  const EDITORIAL = `# Design Dossier — Draftline
## Tokens
### Colors
- Sun: #f4c744
- Paper: #fdfbf4
- Ink: #101010
- Signal: #e8442f
- Bone: #d9d2c2
### Radius
- Radius: rounded-none
`

  it('reads the page colour off the palette instead of defaulting to navy', () => {
    const ds = parseDesignSystem(EDITORIAL)
    expect(ds.roles.text).toBe('#101010') // "Ink" is a text label
    // Furthest from the ink among the unassigned colours — the cream, not the
    // yellow and not the red.
    expect(ds.roles.bg).toBe('#fdfbf4')
    expect(ds.roles.bg).not.toBe('#0f172a')
  })

  it('honours a role stated in parentheses, as Muse writes it', () => {
    // colorLines() renders the dossier's own `role` field as "(background)".
    // Reading only the label threw that away.
    const md = '### Colors\n- Obsidian: #0b0b0f  (background)\n- Chalk: #f5f5f0  (text)\n'
    const ds = parseDesignSystem(md)
    expect(ds.roles.bg).toBe('#0b0b0f')
    expect(ds.roles.text).toBe('#f5f5f0')
  })

  it('lands on the dark end for a dark palette, not just the lightest colour', () => {
    // The contrast rule has to work in both directions, or it is just "pick the
    // lightest" wearing a disguise.
    const md = '### Colors\n- Void: #07090d\n- Haze: #e6edf3 (text)\n- Pulse: #3b82f6 (accent)\n'
    expect(parseDesignSystem(md).roles.bg).toBe('#07090d')
  })
})

/**
 * La carte « DOSSIER MUSE UTILISÉ », sur le canevas, affichait une maquette bleu
 * nuit à côté d'un projet éditorial vert — pendant que les pastilles de palette
 * juste en dessous, elles, étaient bien vertes et grises.
 *
 * Les deux lisent le MÊME document. Les pastilles viennent d'extractDesignColors,
 * qui ne cherche que des hex et n'a besoin d'aucun rôle ; la maquette vient de
 * parseDesignSystem, qui a besoin des sept. Une palette qui n'attribue jamais le
 * rôle « fond » retombait donc sur #0f172a, ce qui bascule darkBg et inverse
 * toute la cascade derrière — d'où l'encre foncée posée sur du bleu nuit.
 */
describe('une palette qui nomme tout SAUF sa page', () => {
  // Forme réelle d'un dossier Muse : les libellés sont poétiques, et le rôle est
  // une phrase d'usage. Aucune ne dit « fond ».
  const CIMES = `# Design Dossier — Cimes
## Tokens

### Colors
- Vert montagne: #2F5D50  (Couleur de marque, boutons et liens)
- Ardoise: #3A3A38  (Texte principal)
- Gris brume: #8A8A85  (Texte secondaire, légendes)
- Blanc glacier: #FBFBF8  (Surfaces des cartes)
- Trait: #E3E3DE  (Bordures et séparateurs)
`

  it('ne rend plus une direction claire en ardoise sombre', () => {
    const ds = parseDesignSystem(CIMES)
    // Le défaut exact que l'utilisateur voyait.
    expect(ds.roles.bg).not.toBe('#0f172a')
    // Clair, parce que le document le dit deux fois : une encre foncée et une
    // carte pâle.
    expect(isDarkColor(ds.roles.bg)).toBe(false)
  })

  it('ne fait pas de la carte la page, ce qui reviendrait à effacer les cartes', () => {
    // La première correction rendait la SURFACE comme fond. Le même hex se
    // retrouvait alors sur deux rôles, et PresetMockup peint chaque panneau
    // (barre latérale, trois cartes KPI, histogramme) en `cardBg` sur `bg` : la
    // maquette devenait un rectangle vide traversé de filets. Une couleur de
    // page fausse échangée contre une carte invisible n'est pas un correctif.
    const ds = parseDesignSystem(CIMES)
    expect(ds.roles.surface).toBe('#FBFBF8')
    expect(ds.roles.bg).not.toBe(ds.roles.surface)
  })

  it('garde l’encre déclarée lisible, au lieu de l’éclaircir pour un fond inventé', () => {
    // La vraie conséquence : bg décidait darkBg, donc un fond navy imposait une
    // encre pâle... sauf que l'encre était déclarée, et restait foncée. La
    // maquette montrait #3A3A38 sur #0f172a.
    const ds = parseDesignSystem(CIMES)
    expect(ds.roles.text).toBe('#3A3A38')
    expect(ds.roles.surface).toBe('#FBFBF8')
    expect(ds.roles.accent).toBe('#2F5D50')
  })

  it('déduit la polarité d’une carte sombre, pas seulement d’une carte claire', () => {
    // Le contrôle inverse : sans encre déclarée, une surface sombre dit que la
    // page est sombre. Sinon la règle « la page est blanche » n'est qu'un défaut
    // déguisé en déduction.
    const md = '### Colors\n- Panneau: #16181d  (surface)\n- Filet: #2a2d34  (bordures)\n'
    expect(isDarkColor(parseDesignSystem(md).roles.bg)).toBe(true)
  })

  it('déduit la page de l’encre quand il n’y a même pas de surface', () => {
    const md = '### Colors\n- Encre: #14261C  (texte)\n- Signal: #3F7D4F  (accent)\n'
    // Pas de candidat libre, pas de surface — mais une encre foncée dit que la
    // page est claire. Slate-900 derrière une encre foncée n'est pas approximatif.
    expect(parseDesignSystem(md).roles.bg).toBe('#ffffff')
  })

  it('ne devine toujours rien quand le document ne dit rien', () => {
    // La contrepartie : sans encre, sans surface et sans couleur libre étiquetée,
    // le défaut du lecteur tient. Une couleur seule est une couleur de marque.
    expect(parseDesignSystem('brand #22d3ee').roles.bg).toBe('#0f172a')
  })
})

describe('un libellé en gras reste un libellé', () => {
  it('lit `- **Papier**: #hex`, que les modèles écrivent constamment', () => {
    // Le `**` fermant tombait entre le libellé et le deux-points : le groupe
    // optionnel échouait en entier, et le jeton ressortait SANS étiquette. Or
    // « sans étiquette » veut dire rôle 'other' ET exclusion d'inferBackground
    // (test `label !== hex`) — une paire d'astérisques rendait toutes les
    // couleurs d'un document invisibles à la résolution des rôles d'un coup.
    const md = '### Colors\n- **Papier**: #F6F4EE\n- **Encre**: #1B1B18\n- **Vert lichen**: #6F8F5B\n'
    const cols = parseColors(md)
    expect(cols.map((c) => c.label)).toEqual(['Papier', 'Encre', 'Vert lichen'])
    expect(cols.find((c) => c.label === 'Encre')!.role).toBe('text')
    const ds = parseDesignSystem(md)
    expect(ds.roles.bg).toBe('#F6F4EE')
    expect(ds.roles.text).toBe('#1B1B18')
  })

  it('accepte aussi l’italique et le code, et laisse l’offset exact', () => {
    const md = '## Color tokens\n- `Signal`: #c0392b\n- *Fond*: #fdfcf8\n'
    const cols = parseColors(md)
    expect(cols.map((c) => c.label)).toEqual(['Signal', 'Fond'])
    // L'offset sert au découpage de replaceTokenHex : il doit pointer sur le '#'.
    for (const c of cols) expect(md.slice(c.index, c.index + 7)).toBe(c.hex)
  })

  it('ne transforme pas une phrase emphatique en libellé', () => {
    // Le garde-fou inverse : « Bold **note** with #123456 » n'a pas de séparateur,
    // donc rien ne doit être capturé comme étiquette.
    const cols = parseColors('Bold **note** with #123456\n')
    expect(cols[0].label).toBe('#123456')
  })
})

/**
 * Le deux-points n'est pas le seul séparateur que les modèles écrivent.
 *
 * Corriger les astérisques et s'arrêter là laissait deux formes produire la
 * MÊME perte totale — aucune étiquette, donc aucun rôle, donc toute la cascade
 * ardoise — et ce sont deux formes ordinaires pour une consigne qui demande du
 * « Markdown simple » : la liste au tiret cadratin, et le tableau. Le symptôme
 * rapporté n'était pas une variante du leur : c'était exactement le même.
 */
describe('un libellé séparé de sa couleur autrement que par un deux-points', () => {
  it('lit `- **Papier** — `#hex``, tiret cadratin et hex en code', () => {
    const md = '## Color tokens\n- **Papier** — `#F6F4EE`\n- **Encre** — `#1B1B18`\n- **Vert lichen** — `#6F8F5B`\n'
    const cols = parseColors(md)
    expect(cols.map((c) => c.label)).toEqual(['Papier', 'Encre', 'Vert lichen'])
    const ds = parseDesignSystem(md)
    expect(ds.roles.bg).toBe('#F6F4EE')
    expect(ds.roles.text).toBe('#1B1B18')
    // L'offset doit toujours pointer sur le '#' et non sur le backtick : c'est
    // là que replaceTokenHex découpe.
    for (const c of cols) expect(md.slice(c.index, c.index + 7)).toBe(c.hex)
  })

  it('lit un tableau Markdown, que la consigne « Markdown simple » n’interdit pas', () => {
    const md = '## Color tokens\n\n| Token | Value |\n|---|---|\n| Papier | #F6F4EE |\n| Encre | #1B1B18 |\n| Lichen | #6F8F5B |\n'
    expect(parseColors(md).map((c) => c.label)).toEqual(['Papier', 'Encre', 'Lichen'])
    expect(parseDesignSystem(md).roles.bg).toBe('#F6F4EE')
  })

  it('refuse le tiret ASCII, qui ouvre chaque puce', () => {
    // La contrepartie du tiret cadratin : accepter `-` laisserait l'étiquette
    // d'une puce se lier à la couleur de la suivante.
    const cols = parseColors('### Colors\n- Encre\n- #1B1B18\n')
    expect(cols[0].label).toBe('#1B1B18')
  })
})

/**
 * L'accent retombait sur `colors[0]`, et une palette liste sa page en premier.
 *
 * Le bouton d'appel à l'action, les barres du graphe et l'élément de nav actif
 * de PresetMockup sont tous peints en `accent` : avec `- **Papier**: #F6F4EE` en
 * tête du document, ils étaient peints couleur du papier sur du papier. Et les
 * pastilles juste en dessous restaient parfaitement justes, puisqu'elles ne
 * résolvent aucun rôle — la même asymétrie que pour le fond, un rôle plus loin.
 */
describe('un accent qui n’est pas la page', () => {
  const SILLAGE = `## Color tokens
- **Papier**: #F6F4EE
- **Encre**: #1B1B18
- **Vert lichen**: #6F8F5B
- **Filet**: #DED9CC
- **Gris doux**: #7A756A
`

  it('ne peint plus le CTA de la couleur du fond', () => {
    const ds = parseDesignSystem(SILLAGE)
    expect(ds.roles.accent).not.toBe(ds.roles.bg)
    // Ce qui reste après élimination : la seule couleur chromatique non assignée.
    expect(ds.roles.accent).toBe('#6F8F5B')
  })

  it('choisit la couleur, pas le gris le plus foncé', () => {
    // « Le plus loin du fond » à lui seul aurait pris #7A756A, un gris. Ce qui
    // distingue un accent d'un neutre, c'est la saturation.
    expect(parseDesignSystem(SILLAGE).roles.accent).not.toBe('#7A756A')
  })

  it('laisse une couleur seule être la couleur de marque', () => {
    // Le cas où `colors[0]` avait raison, et qui doit continuer de marcher : une
    // seule couleur dans un document de design EST la couleur de marque.
    expect(parseDesignSystem('brand #22d3ee').roles.accent).toBe('#22d3ee')
  })
})

describe('replaceTokenHex', () => {
  it('rewrites exactly one token in place', () => {
    const cols = parseColors(MD)
    const primary = cols.find((c) => c.label === 'Primary')!
    const out = replaceTokenHex(MD, primary, '#ff0000')
    expect(out).toContain('- Primary: #ff0000')
    expect(out).toContain('- Background: #0f172a') // untouched
    expect(parseColors(out).find((c) => c.label === 'Primary')!.hex).toBe('#ff0000')
  })
})

describe('parseColors — la prose ne vole plus les jetons', () => {
  const md = `# Design Dossier — Essai

## Concept
Un rouge signal #c0392b posé sur du papier, sans jamais crier.

## Tokens

### Colors
- Papier: #fdfcf8  (background)
- Signal: #c0392b  (accent)
`

  it('donne le libellé et le rôle du vrai jeton, pas de la phrase', () => {
    // Avant : la mention dans ## Concept gagnait, le jeton s'appelait "" et
    // n'avait aucun rôle. La palette déclarait pourtant les deux.
    const signal = parseColors(md).find((c) => c.hex.toLowerCase() === '#c0392b')!
    expect(signal.label).toBe('Signal')
    expect(signal.role).toBe('accent')
  })

  it("pointe sur le hex de la palette, pas sur celui de la prose", () => {
    // Le vrai enjeu : recolorer est un découpage à cette position. Pointer sur
    // la phrase réécrivait le concept au lieu du jeton.
    const signal = parseColors(md).find((c) => c.hex.toLowerCase() === '#c0392b')!
    expect(md.slice(signal.index, signal.index + 7)).toBe('#c0392b')
    expect(signal.index).toBeGreaterThan(md.indexOf('### Colors'))
    // Et le remplacement touche bien la palette, la phrase reste intacte.
    const after = replaceTokenHex(md, signal, '#0000ff')
    expect(after).toContain('Un rouge signal #c0392b posé')
    expect(after).toContain('- Signal: #0000ff')
  })

  it('garde les couleurs qui ne vivent que dans la prose', () => {
    const prose = '# Design System\n\nUn bleu #123456 et rien d’autre.\n'
    expect(parseColors(prose).map((c) => c.hex)).toEqual(['#123456'])
  })
})

describe('parseColors — un rôle entre parenthèses qui ne dit rien', () => {
  it("ne prend pas le pas sur un libellé qui, lui, dit quelque chose", () => {
    // roleForLabel rend la CHAÎNE 'other', qui est truthy : « (warm cream) »
    // écrasait donc « Background » et le jeton ne résolvait plus rien.
    const md = '## Color tokens\n- Background: #fff7ed (warm cream)\n'
    expect(parseColors(md)[0].role).toBe('bg')
  })

  it('respecte un rôle entre parenthèses qui, lui, résout', () => {
    const md = '## Color tokens\n- Papier: #f7f3e8 (background)\n'
    expect(parseColors(md)[0].role).toBe('bg')
  })
})

describe('les palettes françaises, telles que Muse les écrit', () => {
  // Copié d'un vrai dossier : Muse écrit dans la langue de la demande, par
  // instruction, donc une demande française donne une palette française.
  const md = `### Colors
- Papier: #F7F7F3  (Arrière-plan principal)
- Surface claire: #FFFFFF  (Cartes tarifaires et zones de contenu)
- Encre: #171717  (Titres, prix et texte principal)
- Gris repère: #707070  (Descriptions secondaires et informations de facturation)
- Rouge décision: #D9342B  (Formule recommandée, états actifs et appels à l’action)
- Ligne: #D9D9D4  (Séparateurs et bordures fines)
`

  it("ne coupe plus les libellés au premier accent", () => {
    // La classe était [A-Za-z] : « Crème » ressortait « me », « Précision »
    // ressortait « cision ». Sur une install française, la plupart des jetons.
    const labels = parseColors(md).map((c) => c.label)
    expect(labels).toContain('Rouge décision')
    expect(labels).toContain('Gris repère')
    expect(parseColors('- Crème: #f7f3e8\n')[0].label).toBe('Crème')
  })

  it('reconnaît le vocabulaire français des rôles', () => {
    const byLabel = Object.fromEntries(parseColors(md).map((c) => [c.label, c.role]))
    expect(byLabel['Papier']).toBe('bg')
    expect(byLabel['Encre']).toBe('text')
    expect(byLabel['Ligne']).toBe('border')
    expect(byLabel['Surface claire']).toBe('surface')
  })

  it('résout la direction au lieu d’inventer de l’ardoise', () => {
    // Avant : un seul rôle déclaré, donc fond, texte et accent inventés en
    // gris ardoise — une direction crème rendue en tableau de bord gris.
    const ds = parseDesignSystem(md)
    expect(ds.roles.bg).toBe('#F7F7F3')
    expect(ds.roles.text).toBe('#171717')
    expect(ds.roles.accent).toBe('#D9342B')
  })
})

describe('la parenthèse est une description, pas un rôle', () => {
  it('ne laisse pas une phrase d’usage écraser un libellé qui parle', () => {
    // Cas réel : « (Fond discret de la formule mise en avant) » contient
    // « discret », et transformait l’accent rose en jeton atténué.
    const md = '### Colors\n- Rose signal: #F3DAD5  (Fond discret de la formule mise en avant)\n'
    expect(parseColors(md)[0].role).toBe('accent')
  })

  it('sert quand même de recours quand le libellé est poétique', () => {
    // « Obsidian » et « Chalk » ne disent rien ; seule la parenthèse tranche.
    const md = '### Colors\n- Obsidian: #0b0b0f  (background)\n- Chalk: #f5f5f0  (text)\n'
    const ds = parseDesignSystem(md)
    expect(ds.roles.bg).toBe('#0b0b0f')
    expect(ds.roles.text).toBe('#f5f5f0')
  })

  it('lit une description contenant des virgules', () => {
    // Le motif refusait la ponctuation, donc « Formule recommandée, états
    // actifs et appels à l’action » ne était tout simplement pas lu.
    const md = '### Colors\n- Rouge: #D9342B  (Formule recommandée, états actifs et appels à l’action)\n'
    expect(parseColors(md)[0].role).toBe('accent')
  })
})
