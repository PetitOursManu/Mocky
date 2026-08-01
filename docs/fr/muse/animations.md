# Animations

Le mouvement dans Mocky repose sur [Motion](https://motion.dev), et **le modèle
qui génère n'en écrit jamais une ligne**. Il n'a aucun accès à l'API de la
bibliothèque : pas de `motion.div`, pas de transition, pas d'objet de variantes.
Il choisit un nom dans une liste fermée.

```jsx
<Animated preset="fade-up" delay={0.1} as="section">…</Animated>
<Ticker speed={24} pauseOnHover>{logos}</Ticker>
<CountUp to={1284} suffix="+" />
```

Tout le reste — les variantes, les ressorts, les seuils de détection, le repli en
CSS — est écrit et testé une fois, dans
`src/lib/capabilities/snippets/Animate.ts`.

---

## Pourquoi la liste est fermée

C'est la décision centrale, et ce n'est pas une question de goût.

Un modèle qui écrit du code d'animation à la main produit trois types d'échecs
qu'aucune relecture automatique n'attrape.

**Une API mal mémorisée.** Motion a changé de nom, de paquet et d'interface :
`framer-motion` est devenu `motion/react`. Les modèles ont lu les trois époques.
Un import faux ou une propriété qui n'existe pas ne donne pas une animation moins
jolie : cela donne un écran qui ne s'affiche pas.

**Un état de repos invisible.** Une entrée qui part de `opacity: 0` et dont
l'animation ne démarre jamais laisse une **page blanche**. Ce n'est pas une
dégradation, c'est du contenu perdu.

**L'imprévisibilité.** Chaque écran inventerait ses propres durées, ses propres
courbes et ses propres distances, et un projet de douze écrans n'aurait aucun
vocabulaire de mouvement commun.

Avec une liste fermée, le pire que le modèle puisse faire est de **nommer un
preset qui n'existe pas**, ce qui affiche un élément ordinaire, non animé, avec
son contenu intact.

C'est le même raisonnement que pour le registre de capacités : réduire la surface
sur laquelle le modèle peut se tromper, et déplacer la complexité dans du code
testé.

---

## Les onze presets

| Catégorie | Preset | Effet |
|---|---|---|
| **Entrées** | `fade-in` | Opacité de 0 à 1, 400 ms |
| | `fade-up` | Opacité plus une montée de 16 px, 400 ms, `easeOut` |
| | `scale-in` | Un ressort, `stiffness: 300`, `damping: 24` |
| | `slide-left` | Entre par la gauche (−32 px), 450 ms |
| | `slide-right` | Entre par la droite (+32 px), 450 ms |
| | `blur-in` | Un flou de 12 px qui se lève, 500 ms |
| | `stagger-list` | Les enfants apparaissent l'un après l'autre, à 0,06 s d'intervalle |
| **Survol** | `hover-lift` | Se soulève de 4 px avec une ombre |
| | `hover-glow` | `scale(1.02)` plus `brightness(1.08) saturate(1.08)` |
| **Défilement** | `parallax` | Dérive plus lentement que la page, profondeur 0,25 |
| **Sortie** | `exit-slide` | Entre par la gauche, sort par la droite quand l'élément est retiré |

Deux détails méritent une explication.

**`stagger-list` se pose sur la liste, pas sur chaque élément.** C'est dit
explicitement dans la description que lit le modèle, parce que l'erreur inverse
est naturelle et produit onze animations simultanées au lieu d'un décalage.

**`hover-glow` joue sur la lumière, pas sur la couleur.** L'écran généré a sa
propre palette, et ce preset ne doit pas la deviner. `brightness` fonctionne sur
n'importe quel fond, alors qu'un halo coloré codé en dur se battrait avec la
moitié des directions artistiques.

Un nom absent de cette liste **n'est pas une erreur**. `MOCKY_PRESETS[name]` vaut
`undefined`, `animating` est faux, et le composant affiche un élément ordinaire
avec son `className`, son `style` et ses enfants.

### La liste est déclarée deux fois, exprès

```ts
export const ANIMATE_PRESETS = ['fade-in', 'fade-up', /* … */] as const
export type AnimatePreset = (typeof ANIMATE_PRESETS)[number]
```

`ANIMATE_PRESETS` est écrite **à côté** de la source, et non déduite d'elle. Ce
qui atteint réellement le modèle, ce sont les métadonnées `components` du
registre. Un nom présent dans l'un et absent de l'autre est exactement l'écart
que `validatePack` existe pour attraper.

---

## Les trois composants

### `<Animated>`

Le seul emballage. `preset` est **obligatoire**. `delay` est en secondes, borné à
`[0, 2]`. `as` choisit la balise, `div` par défaut.

### `<Ticker>`

Une rangée qui défile indéfiniment : bandeaux de logos, témoignages, étiquettes.

La piste est **dupliquée automatiquement**, donc passez les éléments **une seule
fois**. `speed` est le nombre de secondes par passage complet — plus le nombre
est grand, plus c'est lent — borné à `[4, 120]`. `reverse` inverse le sens.
`pauseOnHover` est actif par défaut.

La piste est décalée d'exactement **la moitié de sa largeur**, donc la couture
est invisible et le point de bouclage ressemble exactement au départ. Ce détail
est aussi ce qui lui fait survivre au mode « sans animation » : ramener
l'animation à un passage instantané la pose à −50 %, ce qui donne la même image.

### `<CountUp>`

Un nombre qui compte quand il entre dans le champ de vision. `to` est
obligatoire. `duration` est borné à `[200, 6000]` ms et `decimals` à `[0, 3]`.
L'accélération est un `easeOutCubic` : rapide au début, puis il se pose sur le
nombre. Les milliers sont espacés automatiquement.

Il affiche un `<span>` en ligne, donc emballez-le vous-même dans un titre ou un
paragraphe pour le styler.

**Quand l'animation est coupée, il affiche la valeur finale.** Une statistique
bloquée à 0 est pire qu'une statistique qui n'a pas bougé : elle est **fausse**.

---

## Deux moteurs, un seul contrat

Motion est copié localement et chargé comme capacité, donc il est normalement là.
Quand il ne l'est pas — le script a échoué, ou l'écran a été généré avant que la
capacité existe — **les mêmes presets tournent sur un petit chemin en CSS et
IntersectionObserver**.

Le contrat du composant ne change pas. Seule la fluidité change.

| | Avec `window.Motion` | Sans |
|---|---|---|
| Entrées | Variantes `hidden`/`visible` | Classes CSS `from`/`to` et une transition, déclenchées par IntersectionObserver |
| Survol | `whileHover` | `onMouseEnter`/`onMouseLeave` qui écrivent les styles à la main |
| `parallax` | **le même code** | **le même code** |
| Sortie | `AnimatePresence` | Pas de sortie ; l'élément disparaît simplement |

`parallax` est **piloté par le défilement**, donc c'est le même code DOM dans les
deux moteurs : il n'y a rien qu'une variante puisse décrire.

Un `requestAnimationFrame` est planifié depuis un écouteur `scroll` passif. Le
décalage est calculé à partir du centre de l'élément par rapport au centre de la
fenêtre — −1 au-dessus, 0 centré, +1 en dessous — et borné à ±80 px. Cela
maintient le bloc près de sa position de mise en page à toutes les hauteurs de
défilement, donc il ne sort jamais de sa propre section.

---

## L'échappatoire statique

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

Trois raisons de ne pas animer, plus une quatrième qui sert de filet, et toutes
appartiennent à l'utilisateur.

`document.hidden` est celle qui a été mesurée et qui n'est pas évidente. Motion
maintient un élément dans son état `initial` jusqu'au démarrage de sa boucle
d'images, et **les navigateurs n'exécutent pas cette boucle dans un onglet en
arrière-plan**. Une maquette ouverte dans un onglet inactif restait donc à
`opacity: 0` indéfiniment : un écran blanc, pas un écran en retard.

Dans chacun de ces cas, l'élément s'affiche dans son **état final,
immédiatement**. Une maquette qui montre son contenu sans l'animer est une petite
perte ; une maquette qui ne montre rien est un bug.

### Le piège des hooks

La décision est prise **une fois, au montage**, et figée dans une référence :

```js
var allowed = React.useRef(null);
if (allowed.current === null) allowed.current = mockyMayAnimate();
```

Et **tous les hooks s'exécutent à chaque rendu, sans condition**.

Ils se trouvaient auparavant après le retour anticipé, ce qui est un bug qui
attend son heure. `document.hidden` peut basculer pendant qu'une maquette est
ouverte — vous changez d'onglet, puis revenez — et le rendu suivant du parent
prendrait alors le chemin court en appelant **moins** de hooks que le précédent.
C'est l'erreur « Rendered fewer hooks than expected », et elle tue tout le cadre.

Les effets ne font simplement rien quand il n'y a rien à faire.

---

## L'interrupteur

Trois états, pas deux. Ils vivent dans `src/lib/animations.ts` et sont **par
appareil et persistants**, comme le thème : c'est une préférence de travail, pas
une propriété du projet.

| État | Effet |
|---|---|
| `auto` *(défaut)* | La sélection existante s'applique : la liste courte par mots-clés, éventuellement affinée par le planificateur |
| `on` | `animate` et `motion-lib` sont ajoutés quoi qu'il arrive |
| `off` | `animate` et `motion-lib` sont retirés, et les écrans déjà générés sont figés |

Un interrupteur à deux positions aurait jeté une décision que Mocky prend déjà
correctement la plupart du temps : une landing page veut des entrées, une table
d'administration non.

`auto` conserve cette décision. Les deux autres états existent pour les fois où
elle se trompe : `on` quand un écran jugé statique mérite quand même de
respirer, `off` quand une démonstration doit rester immobile — un enregistrement
d'écran, une machine lente, un client qui déteste le mouvement.

```js
const ANIMATION_CAPS = ['animate', 'motion-lib']
```

`off` retire **aussi la bibliothèque**. Laisser `motion-lib` chargerait 129 ko
dans un aperçu qui n'a rien à animer.

`applyAnimationMode()` est appliqué **une seule fois**, après que la liste courte
et le planificateur ont dit ce qu'ils avaient à dire. Le reste du chemin de
génération ignore que ce mode existe.

### Par écran

Chaque écran peut passer outre le réglage global, depuis la barre au-dessus de sa
vignette ou depuis son menu contextuel. `Screen.animations` contient :

| Valeur | Signification |
|---|---|
| `undefined` *(le cas courant)* | Suivre le réglage global. C'est ce que dit chaque écran généré avant que l'option existe |
| `true` | Cet écran anime |
| `false` | Cet écran reste immobile |

La résolution est `animations={s.animations ?? animations}`. C'est enregistré et
cela voyage avec le projet, parce que « cet écran-là doit rester immobile pour la
démonstration » est une propriété de l'écran, pas de la session ouverte à ce
moment-là.

### Ce que « off » doit réellement faire

Le drapeau `window.__mockyAnimations` n'atteint que `<Animated>`.

Un écran animé par une classe Tailwind `animate-*`, un `@keyframes` écrit à la
main, une transition CSS ou le pack `motion` retiré continuerait de bouger — et
du point de vue de l'utilisateur, l'interrupteur **serait** cassé.

Les animations sont donc **menées à leur terme** plutôt que retirées :

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

`animation: none` sur un fondu dont l'état de repos est `opacity: 0` laisserait
le contenu **définitivement invisible** : une maquette blanche au lieu d'une
maquette immobile. Écraser la durée et forcer la dernière image la pose à
`opacity: 1`.

C'est la même recette que celle utilisée par la feuille de style de Mocky pour
`prefers-reduced-motion`, et pour exactement la même raison.

Basculer l'interrupteur **reconstruit le document** : `animations` figure dans la
liste de dépendances de l'effet qui construit le `srcDoc`, sinon les écrans déjà
posés sur le canevas garderaient le réglage avec lequel ils ont été construits.
Un test verrouille les deux points :

```js
expect(preview).toContain('animation-fill-mode:forwards !important')
expect(preview).not.toMatch(/animation:\s*none\s*!important/)
expect(preview).toMatch(/\[code, frameId, hideScrollbars, resolvedCaps, animations\]/)
```

---

## Quand le modèle écrit du Motion quand même

On dit au modèle qu'il n'y a pas de système de modules dans l'aperçu, et il ne
voit jamais que `<Animated>`. Il glisse quand même :
`import { motion } from "motion/react"` et `<motion.div>` sont des réflexes
acquis sur tout Internet, et l'un ou l'autre dans un écran généré est un échec
d'affichage **net**, pas une dégradation.

`stripForbiddenMotion()`, dans `src/lib/stripMotion.ts`, les retire par un
**parcours d'arbre syntaxique Babel**, jamais par une expression régulière
(invariant I1) :

```js
const MOTION_MODULE = /^(motion|framer-motion)(\/.*)?$/
```

Un `ImportDeclaration` dont la source correspond est supprimé.

Un `JSXMemberExpression` dont l'objet est l'identifiant `motion` est réécrit :
`<motion.section className="hero">` devient `<section className="hero">`.
L'élément survit **avec ses enfants, sa `className` et son contenu**, et
simplement il n'anime pas. C'est le même contrat que partout ailleurs dans cette
fonctionnalité : dégrader vers la version statique, jamais vers un cadre vide.

Ce qu'il ne touche **pas** : `<Animated>`, et un composant que l'utilisateur
aurait légitimement appelé `Motion`. Seul l'espace de noms `motion` en
minuscules, celui sous lequel la bibliothèque est connue, est visé. Si la balise
renommée ne commence pas par une minuscule, elle retombe sur `div` — une balise
JSX avec une majuscule est une référence de composant, pas un élément HTML.

La fonction **ne lève jamais**. Un fichier que Babel ne peut pas analyser est
renvoyé tel quel, parce que le compilateur en aval signalera cette erreur de
syntaxe bien mieux qu'elle ne le pourrait, et qu'avaler le code ici
transformerait une erreur réparable en écran vide.

Une suppression est **signalée dans la console**, jamais faite en silence :

```
[mocky] raw Motion code removed from the generated screen (<motion.div>) —
animations come from <Animated preset="…"> only.
```

Réécrire en secret la sortie de quelqu'un est le genre de magie qui rend un outil
peu fiable.

---

## Motion, copié localement

Motion est fixé à une version **exacte** dans `package.json` — `"motion":
"12.43.0"`, sans `^` — et le bundle navigateur est produit par
`scripts/build-vendor-motion.mjs`.

**Pourquoi un script.** Tous les autres bundles de `public/vendor/` sont copiés
depuis `node_modules`, parce qu'ils livrent déjà une version navigateur. Motion
12 ne publie que de l'ESM et du CJS, et l'iframe d'aperçu n'a aucune résolution
de modules : elle charge des scripts ordinaires et lit des variables globales sur
`window`.

```js
stdin: { contents: `export { motion, AnimatePresence, useReducedMotion } from 'motion/react'` }
bundle: true, format: 'iife', globalName: 'Motion'
```

Uniquement ce dont `<Animated>` a besoin. L'interface complète de Motion n'est
volontairement pas exposée — c'est toute la raison d'être du registre de presets
fermé — donc il n'y a aucune raison de livrer les parties que personne n'appelle.

**React n'est pas embarqué.** Un plugin esbuild redirige `react` et `react-dom`
vers les variables globales que la coquille d'aperçu a déjà posées :

```js
args.path === 'react' ? 'module.exports = window.React' : 'module.exports = window.ReactDOM'
```

Embarquer un second React donnerait deux répartiteurs à la page, et **chaque hook
lèverait « invalid hook call »** dès le premier affichage d'un composant Motion.

**Après une montée de version.** Relancez le script, recopiez l'empreinte SHA-256
affichée dans `public/vendor/VENDOR.md`, et **vérifiez les presets à l'œil**.
Motion a déjà livré une mise à jour qui a **cessé d'animer en silence, sans lever
la moindre erreur** : « pas d'erreur dans la console » ne prouve rien ici.

---

## Le pack retiré, et le seul chemin qui l'atteint encore

Avant `<Animated>`, il y avait une capacité `motion` : douze composants
uniquement en CSS — `FadeIn`, `Stagger`, `Marquee`, `Counter`, `Reveal`,
`ShimmerButton`, `BentoGrid`, `BentoCard`, `BorderBeam`, `TextReveal`,
`Meteors`, `AnimatedBeam`.

Elle est marquée `retired: true` : **injectée** pour les écrans qui la portent
dans `Screen.caps`, **jamais documentée** au modèle. Le mécanisme complet est
dans la [vue d'ensemble de l'architecture](fr/architecture/overview.md).

Une action de l'interface la réactive volontairement : **« Ajouter des
animations »**, dans le menu d'un écran, qui superpose du mouvement à un écran
déjà généré, à trois intensités (`subtle`, `moderate`, `rich`).

```js
const capIds = Array.from(new Set([...(screen.caps ?? []), 'motion']))
```

C'est un chemin d'**édition**, donc `EDIT_RULES` s'applique : le modèle ne peut
ajouter que du mouvement, et le contenu, le texte, les couleurs, la mise en page
et la structure restent identiques à l'octet près. L'instruction nomme les
composants du pack pour que le modèle **emballe** le balisage existant au lieu
d'écrire ses propres keyframes.

Une subtilité vaut d'être connue. Les capacités retirées sont sautées dans la
boucle de documentation de `buildCapabilitiesPrompt()`, donc les lignes par
composant ne sont pas produites. Les noms atteignent le modèle par deux autres
canaux : l'instruction d'édition elle-même, et le paragraphe final « ANIMATION:
use the components listed above (…) », déclenché par la présence de
l'identifiant `motion`.

Enfin, `applyAnimationMode('off')` ne retire **que** `animate` et `motion-lib`.
Un écran construit sur le pack retiré garde donc ses composants, et c'est le CSS
d'écrasement décrit plus haut qui le fige, pas la sélection de capacités. C'est
précisément pour ce cas que cet écrasement existe.

---

## Le vocabulaire de mouvement de Muse

Un dossier de design contient une section `## Motion Language` : une liste de
noms avec leurs descriptions. Elle n'est **pas** contraignante au sens du
registre — c'est de la direction artistique en prose, transmise au modèle dans le
préambule.

Le lien mécanique est ailleurs. Les jetons du dossier alimentent la liste courte
de capacités existante, via `selectCapabilities(text, museMarkdown || designMd)`.
Un dossier qui parle de mouvement fait donc naturellement retenir la capacité
`animate`, exactement comme le ferait un prompt qui en parlerait.

Aucune nouvelle sorte de capacité, et aucun nouveau chemin de code.
