# Le système de design de Mocky

[English](DESIGN-SYSTEM.en.md) · **Français**

> **Pourquoi c'est ainsi —** Un outil qui sert à juger des maquettes et les maquettes elles-mêmes obéissent à des contraintes opposées : la coquille doit s'effacer, la maquette doit s'imposer — d'où deux systèmes distincts et deux documents. Les règles réelles vivent dans le code (`src/styles/tokens.css`, `tailwind.config.js`, `src/ui`) ; ce texte n'existe que pour en donner les raisons, sans lesquelles une contrainte ressemble à un caprice et se fait contourner à la première urgence.

> Il s'agit de l'interface de **Mocky elle-même**, pas des écrans qu'elle génère.
> Pour ces derniers, voir `DESIGN.md` et les presets de `src/lib/styles.ts`.

## La direction : éditorial contrasté

> **Pourquoi c'est ainsi —** L'œil ne juge jamais une couleur dans l'absolu : il la compare à ce qui l'entoure, si bien qu'un cadre teinté déplace la perception de tout ce qu'il encadre. Comme Mocky sert précisément à regarder des maquettes, sa coquille est achromatique par obligation professionnelle avant de l'être par goût — et c'est cette obligation, pas une mode graphique, qui dicte ensuite l'absence d'ombres et la rareté de l'accent.

Noir et blanc, filets de 1px, **aucun rayon, aucune ombre**, un seul aplat de couleur signature. Affiche suisse plutôt que tableau de bord.

Ce n'est pas seulement un parti pris esthétique. Mocky sert à **juger des couleurs** : des maquettes sont posées côte à côte sur un canvas, et le chrome les entoure. L'ancienne palette était `slate` — un gris nettement bleuté (`#64748b`). Une maquette chaude posée dessus paraît plus jaune qu'elle n'est ; une maquette bleue paraît fade. **Le chrome mentait sur les couleurs qu'il présentait**, ce qui est disqualifiant pour un outil de design. Une coquille achromatique est la seule qui ne déforme pas ce qu'elle encadre, et le noir/blanc en est la version la plus complète.

Deux conséquences assumées :

- **Les filets remplacent les ombres.** L'élévation se lit par la valeur (trois niveaux de surface) et par un filet, jamais par un flou.
- **L'accent est rare.** Une seule action primaire par vue le porte. Un onglet ou un mode actif ne prend pas l'accent : il **s'inverse** (`bg-ink text-surface`). C'est plus franc, et ça reste lisible dans les deux thèmes.

## Les jetons

> **Pourquoi c'est ainsi —** Une couleur nommée par son rôle (« la surface d'un panneau ») peut changer de valeur quand le thème change ; une couleur nommée par son apparence (« gris 800 ») ne le peut pas, puisque son nom est déjà la réponse. Les thèmes étaient auparavant obtenus en redéclarant les utilitaires de Tailwind un par un — 96 règles écrites face aux 109 classes de couleur réellement employées par les composants, donc 83 jamais traduites — et c'est ce trou que referme un jeu unique de variables que chaque thème réassigne.

Tout vit dans [`src/styles/tokens.css`](../src/styles/tokens.css), en canaux RGB bruts — c'est ce qui permet à Tailwind de composer l'opacité (`bg-surface/60` fonctionne).

| Jeton | Rôle |
|---|---|
| `--sunken` | le canvas, derrière les cadres |
| `--surface` | panneaux, cartes, en-tête, composer |
| `--raised` | popovers, menus, modales |
| `--line` | le filet **structurel** : bord extérieur d'une surface flottante, règle sous l'en-tête. Rare. |
| `--line-soft` | le filet **fin** : rangées d'une liste, bordures de champs, séparateurs. Le cas par défaut. |
| `--ink` / `--ink-muted` / `--ink-faint` | texte principal / secondaire / le plancher (jamais en dessous) |
| `--accent` / `--on-accent` | l'aplat signature (**#228477**) et son texte |
| `--accent-ink` | le **petit texte** en couleur d'accent — voir ci-dessous |
| `--danger` `--warn` `--ok` | statuts, désaturés d'un cran pour ne jamais crier plus fort qu'une maquette |
| `--muse` | la marque de Muse — un mode, pas un état |
| `--ring` | l'anneau de focus |

Deux thèmes, **Papier** et **Encre**, définis par les mêmes jetons. Ni l'un ni l'autre n'est une surcharge de l'autre.

## Pourquoi deux jetons d'accent

> **Pourquoi c'est ainsi —** Les normes d'accessibilité n'exigent pas le même écart de luminosité pour un texte (4,5:1) et pour un aplat, un filet ou une icône (3:1) : une même couleur de marque peut donc être parfaitement lisible en fond de bouton et illisible en petits caractères, sur la même page. Plutôt que d'interdire cette couleur au texte, le système en décline deux variantes — assez proches pour être indiscernables à l'œil, assez distinctes pour franchir chacune son seuil.

`#228477` mesuré sur le papier (`#faf8f3`) :

| Usage | Contraste | Verdict |
|---|---|---|
| Blanc sur l'aplat (bouton) | **4,53:1** | passe AA |
| L'accent en **petit texte** sur le papier | **4,27:1** | **échoue** (AA = 4,5) |
| L'accent en aplat, filet, icône | 4,27:1 | passe (composant d'interface = 3:1) |

D'où `--accent-ink` (`#20796C`, **4,93:1**) : même teinte, un cheveu plus sombre, indiscernable à taille de texte. C'est ce qui permet d'utiliser la couleur **largement** sans livrer du texte illisible.

**La règle : `text-accent-ink` pour du texte, `bg-accent` / `border-accent` pour tout le reste.** `text-accent` n'est acceptable que sur un `text-h2` ou plus grand, et sur une icône. Le test de contraste vérifie les deux jetons séparément, avec deux seuils différents.

En thème Encre, les deux jetons valent la même valeur claire (8,4:1 sur la surface) — un seul suffit là-bas.

## Les dispositifs de presse

> **Pourquoi c'est ainsi —** Ce qui fait reconnaître une page imprimée tient à quelques signaux qui reviennent partout — un surtitre, des filets d'épaisseurs différentes, une largeur de colonne, un format fixe — bien plus qu'au dessin de chaque élément pris isolément. Reproduire ces signaux dans une poignée de classes réutilisables coûte moins cher que d'habiller les écrans un par un, et laisse une seule adresse à modifier le jour où le ton doit changer.

Quatre choses font presque tout le travail pour qu'un écran ait l'air imprimé. Elles sont dans `src/index.css`.

| Classe | Usage |
|---|---|
| `.masthead` | Le nom du journal, en serif. Une fois, en haut. |
| `.kicker` | **Le surtitre** — petit, capitales, très espacé. Le dispositif le plus rentable : titres de panneau, libellés de groupe, onglets. Utilisé 69 fois. |
| `.rule-double` | Le filet double (un gras + un fin) sous la manchette. |
| `.rule-thin` | Le filet de séparation entre sections. |
| `.section-head` | Tête de section : surtitre + filet. |
| `.measure` | 68ch — la largeur de lecture d'un paragraphe. **Pleine largeur ne veut pas dire lignes de 200 caractères** : c'est précisément pour ça que les journaux ont des colonnes. |
| `.page` | **Le format de la page** : 1440px max, centré, gouttière de 24px. |
| `.page-wide` | 1760px, réservé à la galerie d'images — une grille de vignettes n'a pas de largeur de lecture. |

### Le format de page

> **Pourquoi c'est ainsi —** Une mise en page est faite de rapports entre des éléments, et un rapport se défait au-delà d'une certaine distance : la largeur n'est donc pas une variable libre qu'on gagnerait à maximiser, c'est un format à choisir. Le format retenu est un plafond centré parce qu'il se comporte comme une pleine largeur sur les écrans courants et cesse simplement de grandir au-delà — une seule valeur, aucune règle particulière à écrire par écran.

Un journal a un format fixe, et c'est celui-là. Les pages étaient d'abord enfermées dans `max-w-4xl` (896px), ce qui gâchait la moitié d'un écran large. Les libérer complètement allait trop loin dans l'autre sens : sur un écran de 2000px le contenu allait d'un bord à l'autre, l'œil devait traverser toute la largeur pour relier un nom de projet à sa date, et plus rien n'encadrait la page.

Mesuré, contenu utile selon l'écran :

| Écran | Contenu | Occupation |
|---|---|---|
| 1280 | 1232px | 96% |
| 1440 | 1392px | 97% |
| 1920 | 1392px | 73% |
| 2000 | 1392px | 70% |

En dessous de 1440px le comportement est celui d'une pleine largeur ; au-delà, la page s'arrête. **Une seule valeur à régler**, dans `.page`.

Les titres `h1/h2/h3` prennent le serif automatiquement, via une règle en couche `base`. C'est la ligne qui sépare « application monochrome » de « page imprimée » : un titre en grotesque se lit comme du chrome, un titre en serif comme un article.

Aucune police n'est téléchargée. La pile serif s'appuie sur des faces livrées avec le système (Iowan Old Style et Palatino sur macOS, Georgia sur Windows) — les aperçus doivent fonctionner hors-ligne et sous une CSP stricte.

## Les icônes

> **Pourquoi c'est ainsi —** Une icône doit prendre la couleur du texte qui l'accompagne et se dessiner pareil chez tout le monde ; un emoji ne peut ni l'un ni l'autre, parce que c'est une petite image en couleurs fournie par le système d'exploitation, différente sous Windows, macOS et Android. Un tracé vectoriel peint en `currentColor` — le mot-clé CSS qui reprend la couleur de texte en vigueur — hérite au contraire du thème sans qu'on ait à le lui dire, et se règle en taille comme un caractère.

`src/ui/Icon.tsx` — 38 icônes vectorielles en `currentColor`.

```tsx
import { Icon, IconButton } from '../ui'

<Icon name="link" />                                  {/* 20px par défaut */}
<IconButton label="Supprimer"><Icon name="trash" /></IconButton>
```

L'interface était construite en emoji. Ce sont des **bitmaps en couleur** : le thème ne peut pas les toucher, ils font autocollant sur une coquille noir et blanc, et ils s'affichent différemment sur chaque système (Segoe UI Emoji, Apple Color Emoji, Noto) — la barre d'outils n'était jamais deux fois la même. Ils rendaient aussi autour de 12px, trop petit pour se lire comme une icône.

`Icon` est `aria-hidden` par construction : le nom accessible appartient au bouton, et `IconButton` l'impose.

## Les règles

> **Pourquoi c'est ainsi —** Chacune de ces cinq lignes répond à une dérive constatée dans le code, pas à une préférence théorique : des dizaines de tailles de texte inventées au cas par cas, sept z-index improvisés auxquels s'ajoutaient deux panneaux flottants dépourvus de tout z-index et qui se recouvraient au pixel près, quatre déclarations de focus pour cent sept boutons. Une règle formulée court se contrôle en relecture, et parfois par un test, ce qu'un paragraphe d'intentions ne permet pas.

**1. Un composant décrit ce qu'un contrôle *est*, jamais sa couleur.**
`bg-surface`, `text-ink-muted`, `border-line` — oui. `bg-slate-800`, `text-indigo-400` — non : ça ne suivra pas le thème.

**2. L'échelle typographique a six pas, et rien entre eux.**
`caption` 11px (badges uniquement) · `body-sm` 13px (contrôles, barre d'outils) · `body` 14px (**le défaut**) · `lead` 16px · `h3` 20px · `h2` 28px · `display` 44px.
Les tailles arbitraires (`text-[11px]`…) sont interdites. Les chiffres qui changent sous l'œil — zoom, dimensions, empreintes — prennent `font-mono` pour cesser de sautiller.

**3. Toute cible cliquable fait au moins 32px de haut.**
Les primitives l'imposent. Passer par elles suffit.

**4. Le focus est visible partout.**
Une règle unique en couche `base` dans `index.css`, posée en `:where()` pour rester à spécificité zéro. Ne l'annulez pas.

**5. Une seule échelle de z-index.**
`panel: 20` · `menu: 30` · `overlay: 40` · `modal: 50` · `top: 60`. Pas de `z-[70]`.

## Les primitives

> **Pourquoi c'est ainsi —** Les exigences qui se répètent — un nom prononçable par un lecteur d'écran sur un bouton sans texte, une étiquette réellement reliée à son champ, un piège de focus dans une boîte de dialogue, une cible d'au moins 32 pixels — se tiennent une fois pour toutes si elles vivent dans un composant, et se perdent une fois sur deux s'il faut y penser à chaque appel. Ces primitives existent donc pour rendre le comportement correct plus court à écrire que le comportement bâclé.

Importer depuis [`src/ui`](../src/ui) :

```tsx
import { Button, IconButton, Field, Input, Modal, Banner, Chip, Segmented, Panel } from '../ui'
```

| Primitive | À utiliser pour |
|---|---|
| `Button` | variantes `primary` (l'action de la vue) · `ghost` (le défaut) · `quiet` (tertiaire, sans filet) · `danger` · `toolbar`. `active` inverse. |
| `IconButton` | bouton à icône seule. **`label` est obligatoire.** |
| `Field` + `Input`/`Textarea`/`Select` | `Field` génère l'`id` et le câble au `<label>` — impossible d'oublier. |
| `Modal` | `role="dialog"`, `aria-modal`, piège de focus, Échap, restitution du focus, voile unique. |
| `Panel` / `PanelRow` | surfaces flottantes du canvas. Les actions d'une rangée restent visibles au focus, pas seulement au survol. |
| `Segmented` | modes mutuellement exclusifs. L'exclusivité est structurelle. |
| `Chip` | jetons retirables. |
| `Banner` | messages en ligne. `role="alert"` quand `tone="danger"`. |
| `Spinner` / `Skeleton` / `ScreenSkeleton` / `EmptyState` | états d'attente et de vide. |

## Les garde-fous

> **Pourquoi c'est ainsi —** Le contraste est l'une des rares qualités d'une interface qu'une machine peut trancher seule : c'est un nombre, calculé à partir de deux couleurs, comparé à un seuil publié. Il est branché sur le fichier livré, et non sur une copie de ses valeurs : une teinte retouchée à la main fait donc échouer la suite tout de suite, au lieu d'attendre qu'un utilisateur ne voie plus un libellé.

```bash
npx vitest run tokens-contrast
```

[`tests/tokens-contrast.test.js`](../tests/tokens-contrast.test.js) lit le vrai fichier de jetons et vérifie **chaque paire texte/fond** contre WCAG AA, dans les deux thèmes. Il vérifie aussi que les deux thèmes déclarent exactement les mêmes jetons — un jeton présent d'un côté seulement, c'est précisément comme une couleur retombe silencieusement sur la valeur de l'autre thème.

Ce test existe à cause de ce qui a été mesuré sur l'ancienne version :

| Ancien | Contraste réel |
|---|---|
| `text-slate-500` | 3,75:1 (sombre) · 2,09:1 (beige) · 2,34:1 (Mocky) |
| `text-slate-600` | 2,36:1 |
| bouton « Frame » actif (`bg-slate-700 text-white`) | **1,21:1** — le fond était remappé pour les thèmes clairs, le texte jamais. Le libellé du bouton actif était invisible. |

## Modifier le système

> **Pourquoi c'est ainsi —** Un système centralisé ne tient que si la manière de le modifier est écrite quelque part : sinon la première urgence le contourne et repose une couleur en dur dans un composant. Les trois gestes rappelés ici — déclarer la couleur dans les deux thèmes, l'exposer dans `tailwind.config.js`, ajouter sa paire au test de contraste — sont ceux que personne n'énonçait dans l'ancienne version, celle où 83 des 109 classes de couleur ne suivaient aucun thème.

- **Changer l'accent** : une variable, dans les deux blocs de thème. Rien d'autre.
- **Ajouter un thème** : dupliquer un bloc de jetons. Aucun composant à toucher.
- **Ajouter une couleur** : demandez-vous d'abord si c'est un *rôle* existant. Si oui, utilisez le jeton. Sinon, ajoutez le jeton **dans les deux thèmes**, exposez-le dans `tailwind.config.js`, et ajoutez sa paire au test de contraste.

## Ce qui n'a pas été fait, et pourquoi

> **Pourquoi c'est ainsi —** Une option écartée sans laisser de trace revient tous les six mois et se réévalue de zéro ; consignée avec sa raison, elle ne se rediscute que si la raison a changé. Celle-ci est particulière à un générateur : le vocabulaire de classes que Mocky écrit dans les maquettes est déjà parti chez les utilisateurs, dans des écrans qu'ils ont produits et exportés, et qu'aucune mise à jour de l'outil ne peut aller corriger.

**Pas de migration vers Tailwind 4.** Le gain principal (variables natives) est déjà obtenu en v3 par `rgb(var(--x) / <alpha-value>)`. La v4 impose `shadow-sm`→`shadow-xs`, `outline-none`→`outline-hidden`, change l'anneau par défaut, supprime la config JS au profit de `@theme`, déplace le CDN Play vers `@tailwindcss/browser` — et surtout **invaliderait les classes v3 des écrans déjà générés** ainsi que toute la chaîne d'export (`src/lib/export/`). Coût réel, bénéfice utilisateur nul.
