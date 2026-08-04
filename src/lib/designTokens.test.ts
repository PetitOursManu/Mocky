import { describe, it, expect } from 'vitest'
import { parseColors, parseDesignSystem, replaceTokenHex, roleForLabel } from './designTokens'

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
