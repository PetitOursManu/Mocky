# Animations

Le mouvement dans Mocky repose sur [Motion](https://motion.dev), et **le modèle
génératif n'en écrit jamais une ligne**. Il n'a aucun accès à l'API de la
bibliothèque : pas de `motion.div`, pas de transition, pas d'objet de variantes.
Il choisit un nom dans une liste fermée.

```jsx
<Animated preset="fade-up" delay={0.1} as="section">…</Animated>
<Ticker speed={24} pauseOnHover>{logos}</Ticker>
<CountUp to={1284} suffix="+" />
```

Tout le reste — variantes, ressorts, seuils d'intersection, repli CSS — est écrit
et testé une fois, dans `src/lib/capabilities/snippets/Animate.ts`.

---

## Pourquoi une liste fermée

C'est le choix central, et il n'est pas une question de goût.

Un modèle qui écrit du code d'animation à la main produit trois classes d'échec
qu'aucune revue automatique ne rattrape :

1. **Une API mal mémorisée.** Motion a changé de nom, de paquet et de surface
   (`framer-motion` → `motion/react`). Les modèles ont lu les trois époques. Un
   import faux ou une prop inexistante n'est pas une animation moins jolie : c'est
   un écran qui ne monte pas.
2. **Un état de repos invisible.** Une entrée qui part de `opacity: 0` et dont
   l'animation ne démarre jamais laisse une page **blanche**. Ce n'est pas une
   dégradation, c'est une perte de contenu.
3. **De l'imprévisible.** Chaque écran inventerait ses propres durées, ses propres
   courbes, ses propres distances — et un projet de douze écrans n'aurait aucun
   langage de mouvement commun.

Avec une liste fermée, le pire que le modèle puisse faire est de **nommer un preset
qui n'existe pas** — ce qui rend un élément ordinaire, non animé, avec son contenu.

C'est la même logique que le registre de capacités : réduire la surface que le
modèle peut se tromper à écrire, et déplacer la complexité dans du code testé.

---

## Les onze presets

| Catégorie | Preset | Effet |
|---|---|---|
| **Entrées** | `fade-in` | opacité 0 → 1, 400 ms |
| | `fade-up` | opacité + montée de 16 px, 400 ms, `easeOut` |
| | `scale-in` | ressort, `stiffness: 300`, `damping: 24` |
| | `slide-left` | entre depuis la gauche (−32 px), 450 ms |
| | `slide-right` | entre depuis la droite (+32 px), 450 ms |
| | `blur-in` | flou de 12 px qui se lève, 500 ms |
| | `stagger-list` | les enfants apparaissent l'un après l'autre (0,06 s) |
| **Survol** | `hover-lift` | se soulève de 4 px + ombre portée |
| | `hover-glow` | `scale(1.02)` + `brightness(1.08) saturate(1.08)` |
| **Défilement** | `parallax` | dérive plus lentement que la page (profondeur 0,25) |
| **Sortie** | `exit-slide` | entre par la gauche, sort par la droite quand l'élément est retiré |

Deux détails valent l'explication :

**`stagger-list` se pose sur la LISTE, pas sur chaque élément.** C'est dit
explicitement dans la description lue par le modèle, parce que l'erreur inverse est
naturelle et donne onze animations simultanées au lieu d'un échelonnement.

**`hover-glow` joue sur la lumière, pas sur la couleur.** L'écran généré a sa propre
palette et ce preset n'a pas à la deviner. `brightness` fonctionne sur n'importe
quel fond ; un halo coloré codé en dur se battrait avec la moitié des directions
artistiques.

Un nom absent de cette liste **n'est pas une erreur** : `MOCKY_PRESETS[name]` vaut
`undefined`, `animating` est faux, et le composant rend un élément ordinaire avec
son `className`, son `style` et ses enfants.

### La liste est déclarée deux fois, exprès

```ts
export const ANIMATE_PRESETS = ['fade-in', 'fade-up', /* … */] as const
export type AnimatePreset = (typeof ANIMATE_PRESETS)[number]
```

`ANIMATE_PRESETS` est écrite **à côté** de la source, pas dérivée d'elle. Ce qui
atteint réellement le modèle sont les métadonnées `components` du registre ; un nom
présent dans l'un et absent de l'autre est exactement la divergence que
`validatePack` existe pour attraper.

---

## Les trois composants

### `<Animated>`

Le seul emballage. `preset` est **obligatoire**. `delay` est en secondes, borné à
`[0, 2]`. `as` choisit la balise (`div` par défaut).

### `<Ticker>`

Une rangée qui défile indéfiniment — bandeaux de logos, témoignages, étiquettes.
La piste est **dupliquée automatiquement**, donc on passe les éléments **une seule
fois**. `speed` est le nombre de secondes par passe complète (plus haut = plus
lent), borné à `[4, 120]`. `reverse` inverse le sens. `pauseOnHover` est actif par
défaut.

La piste est translatée d'exactement **la moitié de sa largeur** : la couture est
invisible et le point de bouclage est identique au départ. Ce détail est aussi ce
qui lui fait survivre au mode « sans animation » — écraser l'animation en une
passe instantanée la pose à `-50%`, c'est-à-dire exactement la même image.

### `<CountUp>`

Un nombre qui compte à partir de zéro quand il entre dans le champ. `to` est
obligatoire. `duration` est borné à `[200, 6000]` ms, `decimals` à `[0, 3]`.
L'interpolation est un `easeOutCubic` — rapide d'abord, puis elle se pose sur le
nombre. Les milliers sont espacés automatiquement.

Il rend un `<span>` en ligne, à emballer soi-même dans un titre ou un paragraphe
pour le styler.

**Quand l'animation est coupée, il rend la valeur FINALE.** Une statistique bloquée
à 0 est pire qu'une statistique qui n'a pas bougé : elle est **fausse**.

---

## Deux moteurs, un seul contrat

Motion est vendorisé et chargé comme capacité, donc il est normalement là. Quand il
ne l'est pas — le script a échoué, ou l'écran a été généré avant l'existence de la
capacité — **les mêmes presets tournent sur un petit chemin
CSS + IntersectionObserver**. Le contrat du composant ne change pas ; seule la
douceur change.

| | Avec `window.Motion` | Sans |
|---|---|---|
| Entrées | variantes `hidden`/`visible` | classes CSS `from`/`to` + transition, révélées par IntersectionObserver |
| Survol | `whileHover` | `onMouseEnter`/`onMouseLeave` écrivant les styles à la main |
| `parallax` | **le même code** | **le même code** |
| Sortie | `AnimatePresence` | pas de sortie, l'élément disparaît |

`parallax` est **piloté par le défilement**, donc c'est le même chemin DOM dans les
deux moteurs — il n'y a rien qu'une variante puisse décrire. Un `requestAnimationFrame`
est planifié depuis un écouteur `scroll` passif, la position est calculée depuis le
centre de l'élément relativement au centre du viewport (−1 au-dessus, 0 centré, +1
en dessous) et bornée à ±80 px, ce qui le maintient près de sa position de mise en
page à toutes les hauteurs de défilement : il ne dérive jamais hors de sa propre
section.

---

## L'échappatoire statique, et pourquoi elle n'est pas optionnelle

```js
var mockyMayAnimate = function () {
  try {
    if (window.__mockyAnimations === false) return false;
    if (document.hidden) return false;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  } catch (e) { return false; }
  return true;
};
```

Trois raisons de ne pas animer, plus la quatrième qu'est une exception, et **toutes
appartiennent à l'utilisateur**.

`document.hidden` est le cas mesuré et non évident : Motion maintient un élément à
son état `initial` jusqu'au démarrage de sa boucle d'images, et **les navigateurs
n'exécutent pas cette boucle dans un onglet d'arrière-plan**. Une maquette ouverte
dans un onglet inactif restait donc à `opacity: 0` indéfiniment — un écran blanc,
pas un écran retardé.

Dans tous ces cas, l'élément est rendu **dans son état final, immédiatement**. Une
maquette qui montre son contenu sans l'animer est une petite perte ; une maquette
qui ne montre rien est un bug.

### Le piège des hooks

La décision est prise **une fois, au montage**, et gelée dans une `ref` :

```js
var allowed = React.useRef(null);
if (allowed.current === null) allowed.current = mockyMayAnimate();
```

Et **tous les hooks s'exécutent à chaque rendu, inconditionnellement**. Ils se
trouvaient auparavant après le retour anticipé, ce qui est un bug à retardement :
`document.hidden` peut basculer pendant qu'une maquette est ouverte (on change
d'onglet, on revient), et le rendu suivant du parent aurait alors pris le chemin
court en appelant **moins** de hooks que le précédent — « Rendered fewer hooks than
expected », qui tue toute la frame.

Les effets ne font simplement rien quand il n'y a rien à faire.

---

## L'interrupteur

Trois états, pas deux. Ils vivent dans `src/lib/animations.ts` et sont **par
appareil et persistants**, comme le thème : c'est une préférence de travail, pas
une propriété du projet.

| État | Effet |
|---|---|
| `auto` *(défaut)* | La sélection existante s'applique — présélection par mots-clés, éventuellement affinée par le planificateur |
| `on` | `animate` et `motion-lib` sont ajoutés quoi qu'il arrive |
| `off` | `animate` et `motion-lib` sont retirés, et les écrans déjà générés sont figés |

Un interrupteur binaire aurait jeté une décision que Mocky prend déjà correctement
la plupart du temps : une landing page veut des entrées, une table
d'administration non. `auto` garde cette décision ; les deux autres états existent
pour les fois où elle se trompe — `on` quand un écran lu comme statique mérite de
respirer, `off` quand une démo doit tenir en place (un enregistrement d'écran, une
machine lente, un client qui déteste le mouvement).

```js
const ANIMATION_CAPS = ['animate', 'motion-lib']
```

`off` retire **aussi la bibliothèque** : laisser `motion-lib` chargerait 129 ko dans
un aperçu qui n'a rien à animer.

`applyAnimationMode()` est appliqué **une seule fois**, après que la présélection
et le planificateur ont dit ce qu'ils avaient à dire. Le reste du chemin de
génération ignore l'existence du mode.

### Par écran

Chaque écran peut passer outre depuis la barre au-dessus de sa vignette ou son
menu contextuel. `Screen.animations` vaut :

| Valeur | Sens |
|---|---|
| `undefined` *(le cas courant)* | suit le réglage global — ce que disent tous les écrans générés avant l'existence de l'option |
| `true` | cet écran anime |
| `false` | cet écran tient en place |

Résolution : `animations={s.animations ?? animations}`. C'est persisté et voyage
avec le projet, parce que « cet écran-là doit rester immobile pour la démo » est
une propriété de l'écran, pas de la session ouverte à ce moment-là.

### Ce que « couper » veut vraiment dire

Le drapeau `window.__mockyAnimations` ne peut atteindre que `<Animated>`. Un écran
animé par une classe Tailwind `animate-*`, un `@keyframes` écrit à la main, une
transition CSS ou le pack `motion` retiré continuerait de bouger — et du point de
vue de l'utilisateur, l'interrupteur **serait** cassé.

Alors les animations sont **menées à leur terme** plutôt que retirées :

```css
*,*::before,*::after{
  animation-duration:0.01ms !important;
  animation-delay:0ms !important;
  animation-iteration-count:1 !important;
  animation-fill-mode:forwards !important;
  transition-duration:0.01ms !important;
  transition-delay:0ms !important;
  scroll-behavior:auto !important
}
```

`animation: none` sur un fondu dont l'état de repos est `opacity: 0` laisserait le
contenu **invisible pour toujours** — une maquette blanche au lieu d'une maquette
figée. Écraser la durée et forcer l'image finale la pose à `opacity: 1`. C'est
exactement la recette que la feuille de style de Mocky elle-même utilise pour
`prefers-reduced-motion`, et pour la même raison.

Basculer l'interrupteur **reconstruit le document** : `animations` figure dans la
liste de dépendances de l'effet qui construit le `srcDoc`, sans quoi les écrans
déjà posés sur le canevas garderaient le réglage avec lequel ils ont été
construits. Un test verrouille les deux points :

```js
expect(preview).toContain('animation-fill-mode:forwards !important')
expect(preview).not.toMatch(/animation:\s*none\s*!important/)
expect(preview).toMatch(/\[code, frameId, hideScrollbars, resolvedCaps, animations\]/)
```

---

## Quand le modèle écrit du Motion quand même

Le modèle est prévenu qu'il n'y a pas de système de modules dans le bac à sable, et
ne voit jamais que `<Animated>`. Il glisse quand même : `import { motion } from
"motion/react"` et `<motion.div>` sont de la mémoire musculaire acquise sur tout
Internet, et l'un des deux dans un écran généré est un échec de rendu **dur**, pas
dégradé.

`stripForbiddenMotion()` (`src/lib/stripMotion.ts`) le retire — par **AST Babel**,
jamais par regex (invariant I1) :

```js
const MOTION_MODULE = /^(motion|framer-motion)(\/.*)?$/
```

- `ImportDeclaration` dont la source correspond → supprimée.
- `JSXMemberExpression` dont l'objet est l'identifiant `motion` →
  `<motion.section className="hero">` devient `<section className="hero">`.
  L'élément survit **avec ses enfants, sa `className` et son contenu**, et
  simplement n'anime pas. Même contrat que partout ailleurs dans cette
  fonctionnalité : dégrader vers la version statique, jamais vers une frame vide.

Ce qu'il ne touche **pas** : `<Animated>`, et un composant que l'utilisateur aurait
légitimement nommé `Motion` — seul l'espace de noms `motion` en minuscules, celui
sous lequel la bibliothèque est connue, est visé. Si la balise renommée ne commence
pas par une minuscule, elle retombe sur `div` (une balise JSX capitalisée est une
référence de composant, pas un élément HTML).

La fonction **ne lève jamais** : un fichier que Babel ne peut pas parser est
renvoyé intact, parce que le compilateur en aval signalera cette erreur de syntaxe
bien mieux qu'elle ne le pourrait, et qu'avaler le code ici transformerait une
erreur réparable en écran vide.

Une suppression est **rapportée dans la console**, jamais faite en silence :

```
[mocky] raw Motion code removed from the generated screen (<motion.div>) —
animations come from <Animated preset="…"> only.
```

Réécrire la sortie de quelqu'un en secret est le genre de magie qui rend un outil
peu fiable.

---

## Motion, vendorisé

Motion est épinglé à une version **exacte** dans `package.json` — `"motion":
"12.43.0"`, sans `^` — et le bundle navigateur est produit par
`scripts/build-vendor-motion.mjs`.

**Pourquoi un script.** Tous les autres bundles de `public/vendor/` sont copiés
depuis `node_modules` parce qu'ils livrent déjà une version navigateur. Motion 12
ne publie qu'ESM et CJS, et l'iframe d'aperçu n'a aucune résolution de modules :
elle charge des scripts simples et lit des globaux sur `window`.

```js
stdin: { contents: `export { motion, AnimatePresence, useReducedMotion } from 'motion/react'` }
bundle: true, format: 'iife', globalName: 'Motion'
```

Seulement ce dont `<Animated>` a besoin. La surface complète de Motion n'est
délibérément pas exposée — c'est tout l'objet du registre de presets fermé — donc
il n'y a aucune raison de livrer les parties que personne n'appelle.

**React n'est pas embarqué.** Un plugin esbuild redirige `react` et `react-dom`
vers les globaux que la coquille d'aperçu a déjà posés :

```js
args.path === 'react' ? 'module.exports = window.React' : 'module.exports = window.ReactDOM'
```

Embarquer un second React donnerait à la page deux répartiteurs, et **chaque hook
lèverait « invalid hook call »** dès le premier rendu d'un composant Motion.

**Après une montée de version.** Relancer le script, recopier le SHA-256 imprimé
dans `public/vendor/VENDOR.md`, et **vérifier les presets visuellement**. Motion a
déjà livré une mise à jour qui a **silencieusement cessé d'animer sans lever
d'erreur** : « pas d'erreur console » ne prouve rien ici.

---

## Le pack retiré, et le seul chemin qui l'atteint encore

Avant `<Animated>`, il y avait une capacité `motion` : douze composants
CSS-uniquement (`FadeIn`, `Stagger`, `Marquee`, `Counter`, `Reveal`,
`ShimmerButton`, `BentoGrid`, `BentoCard`, `BorderBeam`, `TextReveal`, `Meteors`,
`AnimatedBeam`).

Elle est marquée `retired: true` : **injectée** pour les écrans qui la portent dans
leur `Screen.caps`, **jamais documentée** au modèle. Voir
[Architecture — vue d'ensemble](architecture/overview.md) pour la mécanique
complète.

Une action de l'interface la réactive volontairement : **« Ajouter des
animations »**, dans le menu d'un écran, qui superpose du mouvement à un écran
déjà généré à trois intensités (`subtle`, `moderate`, `rich`).

```js
const capIds = Array.from(new Set([...(screen.caps ?? []), 'motion']))
```

C'est un chemin d'**édition** : `EDIT_RULES` s'applique, donc le modèle ne peut
ajouter que du mouvement — contenu, copie, couleurs, mise en page et structure
restent identiques à l'octet près. L'instruction nomme les composants du pack pour
qu'il **emballe** le balisage existant au lieu d'écrire ses propres keyframes.

À noter : comme les capacités retirées sont sautées dans la boucle de documentation
de `buildCapabilitiesPrompt()`, ce sont l'instruction d'édition et le paragraphe
final « ANIMATION: use the components listed above (…) » — déclenché par la
présence de l'id `motion` — qui portent les noms jusqu'au modèle, et non les lignes
par composant du bloc CAPABILITIES.

Enfin, `applyAnimationMode('off')` ne retire **que** `animate` et `motion-lib`. Un
écran construit sur le pack retiré conserve donc ses composants — et c'est le CSS
d'écrasement décrit plus haut qui le fige, pas la sélection de capacités. C'est
précisément pour ce cas que l'écrasement existe.

---

## Le langage de mouvement de Muse

Un Design Dossier contient une section `## Motion Language` : une liste de noms
avec leur description. Elle n'est **pas** contraignante au sens du registre — c'est
de la direction artistique en prose, transmise au modèle dans le préambule.

Le lien mécanique est ailleurs : les jetons du dossier alimentent la présélection
de capacités existante (`selectCapabilities(text, museMarkdown || designMd)`), donc
un dossier qui parle de mouvement fait naturellement retenir la capacité `animate`
— exactement comme un prompt qui en parlerait. Aucun genre de capacité nouveau, et
aucun chemin nouveau.
