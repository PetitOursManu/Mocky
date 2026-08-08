# Vue d'ensemble de l'architecture

## 1. Où vit chaque chose

Le fait le plus structurant du projet :

> **Le pipeline de génération tourne dans le navigateur.**

| Ce qui est fait | Tourne dans | Fichiers |
|---|---|---|
| Sélection des capacités | Navigateur | `src/lib/capabilities/select.ts` |
| Planificateur (facultatif) | Navigateur | `src/lib/plan.ts` |
| Génération, édition, réparation | Navigateur | `src/lib/generate.ts` |
| Passe de qualité : vérifier un écran, puis le corriger | Navigateur ; détection sur le serveur | `src/lib/quality.ts`, `polish.ts`, `server/muse/quality/` |
| Audit SEO / accessibilité : règles de balisage, puis correction | Navigateur ; la moitié jugée sur le serveur | `src/lib/audit/`, `server/muse/quality/audit-judge.js` |
| Orchestration du pipeline | Navigateur (React) | `src/components/ProjectView.tsx` |
| Pont `DESIGN.md` (préambule, jetons, fiche, export) | Navigateur | `src/lib/design.ts`, `designTokens.ts`, `designSpec.ts`, `export/` |
| Une direction lue comme une fiche de spécification, et modifiée comme telle | Navigateur | `src/lib/designSpec.ts`, `src/components/DesignSpecSheet.tsx` |
| Quelle direction gouverne une génération | Navigateur | `src/lib/direction.ts` |
| Affichage isolé de l'aperçu | Navigateur | `src/components/Preview.tsx`, `lib/capabilities/prelude.ts` |
| Persistance | `localStorage`, recopié sur le serveur si connecté | `src/lib/project.ts`, `sync.ts`, `merge.ts` |
| Comptes, SSO, synchronisation, proxy modèle | Serveur | `server/index.js`, `server/provider-proxy.js` |
| Utilisation par compte : projets, écrans, disque | Serveur | `server/usage.js` |
| Cadrage du canevas infini (tout afficher, focus, dernier écran) | Navigateur | `src/lib/framing.ts` |
| Trouver et remplacer les images d'un écran (AST, sans modèle) | Navigateur | `src/lib/screenImages.ts`, `src/components/ScreenImagesDialog.tsx` |
| Muse : MCP, récupération de pages, distillation, dossier | Serveur | `server/muse/` |
| Images, vidéos, bibliothèques | Serveur | `server/images/`, `server/videos/` |
| Export vidéo : schéma, l'unique appel de modèle, file, magasin | Serveur | `server/video/` — au **singulier** ; `server/videos/` est la bibliothèque de clips |
| Export vidéo : le rendu proprement dit | Un service Docker séparé et facultatif | `worker/video/` — Remotion, absent tant que `--profile video-export` n'a pas été construit |

Le back-end est volontairement petit : des fichiers JSON dans `server/data/`,
aucune base de données, aucune dépendance native. Les dépendances d'exécution
sont `express`, `cookie-parser`, `@modelcontextprotocol/sdk` et `zod` pour Muse,
et `impeccable` pour la passe de qualité.

Les écritures sont atomiques : on écrit dans un fichier temporaire, puis on le
renomme. Un plantage en cours d'écriture ne laisse donc jamais de fichier à
moitié écrit.

Cette posture « pas de base de données, pas de dépendance native » est un
invariant de fait, et l'image `node:22-slim` repose dessus. `impeccable` ne
l'affaiblit pas : ses six dépendances d'exécution sont toutes en JavaScript pur,
et le Puppeteer qu'il déclare est **optionnel**, pour un moteur d'analyse d'URL
que Mocky n'appelle jamais. Voir les [invariants](fr/architecture/invariants.md) pour savoir
pourquoi ce drapeau vit dans le Dockerfile et pas dans un `.npmrc`.

---

## 2. Le registre de capacités

Une **capacité** est ce que Mocky injecte dans l'aperçu pour qu'un composant
généré puisse utiliser du code qu'il n'a pas écrit lui-même. Il y en a trois
sortes, déclarées dans `src/lib/capabilities/types.ts` :

```ts
export type CapabilityKind = 'cdn-script' | 'cdn-css' | 'snippet-pack'
```

- **`snippet-pack`** — du JSX ordinaire, gardé sous forme de chaîne, ajouté
  devant le code généré *avant* `Babel.transform`. C'est la sorte dominante.
- **`cdn-css`** — une balise `<link>`.
- **`cdn-script`** — une balise `<script>` qui expose une variable globale.

Les noms `cdn-*` sont un héritage. **Aucune capacité ne pointe vers un tiers.**
`daisyui` charge `/vendor/daisyui.min.css` et `motion-lib` charge
`/vendor/motion.js` : les deux sont servis par le serveur qui a servi la page.
C'est [l'invariant I3](fr/architecture/invariants.md), et il porte sur la
*dépendance*, pas sur la forme de la balise.

### Ce qui est livré

| id | Sorte | Déclencheurs | Ce que ça fournit |
|---|---|---|---|
| `icons` | snippet-pack | toujours sélectionnée | `Icon.*` — 42 icônes SVG, plus 3 alias (`GitHub`, `LinkedIn`, `YouTube`) |
| `daisyui` | cdn-css | `daisy`, `semantic`, `btn`, `card component`… | Une feuille de style de classes sémantiques |
| `charts` | snippet-pack | `chart`, `graph`, `dashboard`, `analytics`, `sparkline`… | `BarChart`, `LineChart`, `DonutChart`, `Sparkline`, `ProgressRing` |
| `motion` | snippet-pack | aucun — `retired: true` | `FadeIn`, `Stagger`, `Marquee`, `Counter`, `Reveal`, `ShimmerButton`, `BentoGrid`, `BentoCard`, `BorderBeam`, `TextReveal`, `Meteors`, `AnimatedBeam` |
| `motion-lib` | cdn-script | aucun — tirée par `requires` | `window.Motion`, depuis `/vendor/motion.js` |
| `animate` | snippet-pack | `animation`, `motion`, `hero`, `landing`, `parallax`… | `Animated`, `Ticker`, `CountUp`. Déclare `requires: ['motion-lib']` |
| `scrollvideo` | snippet-pack | aucun — ajoutée explicitement | `ScrollSequence` |

### La sélection

`selectCapabilities()` est déterministe et n'appelle aucun modèle.

Elle assemble le prompt de l'utilisateur et la direction de design en vigueur
(`DESIGN.md`, ou celle du projet — ce que `resolveDirection` a renvoyé), met le
tout en minuscules, et retient une capacité si **au moins un** de ses mots-clés
apparaît dans ce texte. Ensuite :

1. les capacités de base sont ajoutées d'office ;
2. `requires` est résolu de proche en proche, donc `animate` tire `motion-lib` ;
3. `conflictsWith` retire les entrées en conflit.

C'est volontairement grossier. L'affinage, quand il a lieu, vient du
planificateur. Et le planificateur ne peut que **choisir dans cette liste**,
jamais l'élargir.

### Deux capacités sans déclencheur, pour des raisons opposées

**`motion` est retirée.** `<Animated>` l'a remplacée.

Supprimer son entrée du registre aurait été le geste évident, et aurait été un
bug. Les identifiants de capacités sont **enregistrés sur chaque écran**, dans
`Screen.caps`. Un écran généré la semaine dernière demande donc encore `motion`
au moment de l'affichage. Sans l'entrée, son prélude n'est plus injecté, `FadeIn`
et `Marquee` deviennent indéfinis, et chacun de ces écrans plante.

Elle garde donc zéro déclencheur, ce qui empêche la liste courte de la choisir,
plus `retired: true`, qui la retire de la documentation que lit le modèle. Les
anciens écrans continuent de s'afficher exactement comme avant ; les nouveaux ne
voient jamais que `<Animated>`.

**`scrollvideo` n'est jamais devinée.** Le composant est inutile sans une URL de
base et un nombre d'images, qui n'existent qu'une fois que Muse a réellement payé
un clip. Il est ajouté au moment de la génération quand une séquence a été
produite, et seulement à ce moment-là. Un écran à qui l'on offrirait
`<ScrollSequence>` sans rien à dessiner afficherait un rectangle noir haut de
trois écrans.

### La validation au chargement du module

```js
validatePack(id, components, snippets)
```

Cette fonction s'exécute pour chaque `snippet-pack` quand le registre est
importé, et elle lève dans les deux sens : un composant documenté qu'aucun
snippet n'exporte, ou un export sans métadonnées.

La liste `exports` est écrite à la main, jamais déduite du code source. C'est
[l'invariant I1](fr/architecture/invariants.md) appliqué au prélude lui-même.

### Le prélude

`buildPrelude(caps)` assemble le helper `cn()`, puis **toutes** les sources de
chaque pack sélectionné.

Les packs sont **indivisibles** : jamais un sous-ensemble, jamais un filtrage par
composant. Chaque source passe par `sanitizeSource()`.

---

## 3. Le planificateur

`src/lib/plan.ts` est un appel de modèle bon marché, non diffusé, qui décide de
la structure de l'écran, de son mode et des capacités réellement nécessaires,
avant la génération.

```ts
options: { temperature: 0.2, num_ctx: 8192, num_predict: 1024 }
format: PLAN_SCHEMA     // sortie structurée d'Ollama
stream: false
```

Le délai d'attente par défaut est de 3 000 ms.

**Le planificateur ne doit jamais bloquer ni casser une génération.** Une erreur
réseau, un dépassement de délai, une réponse qui n'est pas du JSON, une mauvaise
forme : tout cela donne `null`, et l'appelant retombe en silence sur la liste
courte. C'est pour cette raison que ce module fait son propre `fetch` au lieu de
réutiliser `chat()`, qui lève.

`validatePlan()` filtre les identifiants de capacités renvoyés. Seuls survivent
ceux qui existent dans le registre **et** figurent dans la liste courte : les
identifiants inventés disparaissent. Les capacités de base sont toujours remises,
donc le planificateur ne peut pas les faire tomber.

Le plan validé devient une section de texte ajoutée au message système. La sortie
structurée est sans risque ici parce que l'appel est petit et non diffusé. Elle
n'est **jamais** utilisée pour générer du code, ce qui casserait à la fois
l'aperçu en direct et le protocole à sentinelles.

Le planificateur est **sauté quand Muse a tourné**, parce que le dossier fournit
déjà la structure.

### Le mode

`PLAN_SCHEMA` porte une cinquième propriété, `mode`, limitée à quatre valeurs :

```ts
export type ScreenMode = 'persuade' | 'operate' | 'read' | 'experience'
```

Elle dit à quoi ressemble la réussite pour le visiteur de *cet* écran-là, et la
distinction porte sur la surface, pas sur le produit : un même projet en contient
couramment les quatre — une page d'accueil persuade, son tableau de bord fait
travailler, sa documentation se lit, sa galerie se traverse. Nommer le mode
permet au prompt de génération de demander la bonne chose, parce que la bonne
chose n'est pas la même dans les quatre cas. Une page d'accueil seulement lisible
a échoué ; une page de réglages expressive a échoué aussi.

`mode` est la seule propriété **volontairement absente de `required`**. Le prompt
la demande et le schéma la contraint, mais un modèle incapable de satisfaire
l'énumération doit quand même rendre un plan utilisable, plutôt que de faire
échouer la sortie structurée et d'emporter le choix des capacités avec elle.
`validatePlan()` tient la même ligne dans l'autre sens : un cinquième mode
inventé devient `undefined` au lieu de couler tout le plan pour une étiquette.

Reste à savoir d'où vient le mode sur les tours où il n'y a pas de plan — et
c'est presque tous, puisque le planificateur est sauté à chaque passage de Muse
et désactivé entièrement par un réglage. D'où l'ordre suivi dans la fonction de
génération de `ProjectView.tsx`, entre la liste courte déterministe et l'appel de
génération :

1. `inferMode(text)` — une devinette par mots-clés, volontairement grossière et
   volontairement penchée vers `operate` : l'interface applicative est le cas
   courant, et se tromper en devinant `persuade` coûte une page de réglages
   expressive, ce qui est pire que l'inverse.
2. Le planificateur, sur les rares tours où il s'exécute, remplace cette
   devinette par son propre `mode` — mais seulement s'il en a réellement renvoyé
   un.
3. `if (!planSection) planSection = modeToPromptSection(mode)`

C'est cette troisième ligne qui porte tout. Le mode est ajouté comme une section
de prompt à lui plutôt que fondu dans le plan, et c'est ce qui le fait arriver
jusqu'à la génération sur **tous** les chemins — y compris ceux où aucun plan n'a
jamais été produit.

---

## 4. La génération

![Un écran généré, rendu en pleine taille](../../assets/11-screen-hero.png)

*Ce qui sort : un composant React + Tailwind autonome, compilé dans le bac à sable et affiché en direct.*

### Le protocole à sentinelles

On demande au modèle d'encadrer sa sortie :

```
<<<MOCKY>>>
…le composant complet…
<<<END>>>
```

Pas de blocs Markdown. La raison est la diffusion en continu : on peut extraire
du code partiel dès qu'il arrive, sans attendre une clôture de bloc.

`extractCode()` essaie trois choses dans l'ordre : les sentinelles, un bloc de
code Markdown pour la compatibilité avec l'existant, puis le contenu brut.

#### Pourquoi la sentinelle de fin est reconnue de façon souple

La sentinelle de fin est acceptée **telle qu'elle arrive**, pas telle qu'on l'a
demandée. Un écran réel s'est terminé ainsi :

```
const __mockyDefault = App
<<<END>>ablytyped
```

Un `>` en moins, avec un bout de texte soudé derrière. `indexOf('<<<END>>>')` ne
trouvait rien, donc la fin était conservée **comme du code**, et chaque
compilation ultérieure de cet écran mourait sur « Unterminated JSX contents ».

`<<<` n'est valide nulle part en JavaScript, sauf dans une chaîne. Dès que cette
suite apparaît au début d'une sentinelle possible, le code est terminé.
`stripTrailingSentinel()` coupe là, à l'extraction **et** à l'affichage. Les
écrans déjà enregistrés avec une fin corrompue se réparent donc à leur prochain
chargement, au lieu d'échouer pour toujours.

### Les paramètres

```ts
options: { temperature: 0.4, num_ctx: 32768, num_predict: 16384 }
```

Un écran complet dépasse facilement 8 000 jetons. Quand le plafond est atteint,
le code est coupé au milieu d'une chaîne et l'aperçu affiche une erreur de
syntaxe incompréhensible : le budget est donc large. `num_predict` doit rester
strictement positif — voir [l'invariant I8](fr/architecture/invariants.md).

La coupure est détectée via `done_reason` ou `finish_reason` valant `length`, y
compris à travers `choices[0]`, et signalée à l'utilisateur en clair.

### La diffusion en continu

Le corps de la réponse est lu en NDJSON : un objet JSON par ligne. Une ligne
incomplète est gardée dans un tampon et complétée par le morceau suivant.

Chaque fragment de contenu appelle
`onChunk(extractCode(full, { streaming: true }))`, donc l'aperçu se reconstruit
en direct.

En mode diffusion, `extractCode` **ne coupe pas** sur une sentinelle de fin
approximative. Une sentinelle à moitié écrite n'est que les prochains caractères
en train d'arriver, et couper dessus tronquerait l'aperçu à chaque morceau. Une
fois la réponse complète, une sentinelle mal formée est tout ce qu'il y aura
jamais : là, elle coupe.

### Les cinq points d'appel

| Fonction | Sert à | Règles supplémentaires |
|---|---|---|
| `generateComponent()` | Créer un écran | `extraSystem` porte la direction de design du projet (`resolveDirection` — celle qui est établie, le dossier Muse de ce tour, ou `DESIGN.md`), le plus ancien écran comme référence d'identité, plus les capacités et le plan |
| `editComponent()` | Modifier les écrans sélectionnés | `EDIT_RULES` : conserver tout ce que l'utilisateur n'a pas demandé de changer, à l'octet près. Le composant complet est renvoyé, pas un diff |
| `fixComponent()` | Réparer automatiquement après une erreur d'affichage | Non diffusé. Reçoit **le même** prompt de capacités : sans la liste des variables globales existantes, le modèle ne peut pas savoir quel composant est indéfini, et échange une erreur React #130 contre une autre |
| `polishComponent()` | Corriger des défauts de qualité nommés | Non diffusé non plus : l'appelant revérifie le résultat, et un écran incomplet ne peut pas être vérifié. Reçoit lui aussi le prompt de capacités, et `POLISH_PROMPT` à la place de `FIX_PROMPT` |
| `auditFixComponent()` | Corriger des défauts de balisage SEO / accessibilité nommés | Non diffusé non plus. Reçoit `AUDIT_FIX_PROMPT`, dont la consigne centrale — *l'écran doit rester exactement le même* — est l'inverse de celle de `POLISH_PROMPT` |

`polishComponent` et `auditFixComponent` sont délibérément des **frères** de
`fixComponent`, jamais des variantes. Les trois partagent le transport, la fin
d'extraction et les conventions d'écriture de l'appelant, et rien d'autre, parce
que la consigne centrale de chacun est mortelle pour les deux autres.
`FIX_PROMPT` dit « corrige UNIQUEMENT l'erreur, ne restyle pas » : juste devant
un plantage, et exactement faux devant un défaut de bâclage, qui *est* un
problème de style — un modèle à qui l'on interdit de restyler rend l'écran
inchangé et brûle une itération. `POLISH_PROMPT` invite au changement visuel, ce
qui est juste là et faux pour une passe d'accessibilité : une correction de
sémantique rendue sous forme de refonte a échoué même si plus aucun défaut ne
subsiste. Voir [SEO et accessibilité](fr/seo-accessibility.md) pour la boucle
propre au troisième. Dans chaque cas, les défauts sont filtrés par l'appelant sur
ceux que la politique déclare à corriger : une passe n'est donc jamais dépensée
sur une règle que Mocky a décidé de ne pas imposer.

Les cinq se terminent sur la même expression —
`guardMotion(extractCode(content))` — et c'est là que la source générée complète
existe pour la première fois. D'où l'intérêt de garder juste le compte de ce
titre, et de le vérifier au grep plutôt que de le croire : il disait « trois »
jusqu'à l'arrivée de `polishComponent`, puis « quatre » jusqu'à celle
d'`auditFixComponent`. Une vérification post-génération branchée sur le seul
`generateComponent` ne voit ni une modification, ni une réparation, ni un
polissage, ni une correction d'accessibilité.

### Modifier sans appeler le modèle

`tryDirectTextReplace()` traite le cas courant. Si le texte visible de l'élément
cliqué apparaît **exactement une fois** dans la source, il est remplacé sur
place : instantané et gratuit.

Zéro occurrence ou plusieurs donnent `null`, et l'appelant bascule sur une
édition ciblée par le modèle. Ce n'est pas de la découverte de noms, donc cela
n'enfreint pas l'invariant I1 : on échange un littéral que l'utilisateur est en
train de regarder.

Quand il faut appeler le modèle, on s'appuie **d'abord sur le texte**. Le chemin
DOM (`nth-of-type`) ne se retrouve pas de façon fiable dans le JSX, alors que la
chaîne de classes exacte de l'élément apparaît telle quelle dans le JSX : c'est
le repère le plus solide. Le sélecteur n'est transmis qu'en dernier recours.

### Le garde-fou Motion

`guardMotion()` fait passer chaque sortie par `stripForbiddenMotion()`, un vrai
parcours d'arbre syntaxique Babel, pas une expression régulière. Voir
[Animations](fr/muse/animations.md).

---

## 5. Le cadrage du canevas

Avant le bac à sable, ce qui l'entoure. `src/lib/framing.ts` décide de ce que
montre le canevas infini, et il vit à l'écart de `Canvas.tsx` parce que c'est de
l'arithmétique — et parce que cette arithmétique était fausse.

**Le bug qui a justifié l'extraction.** « Tout afficher » calculait un
`{x, y, scale}` **une seule fois** et le laissait là : il cadrait donc le projet
pour le conteneur mesuré à l'instant du clic. Redimensionnez la fenêtre, ouvrez
un panneau latéral, tournez une tablette, et les nombres décrivaient encore un
conteneur qui n'existait plus. Le bouton avait l'air de fonctionner, puis cessait
discrètement d'être d'accord avec l'écran, sans rien sur quoi cliquer pour
comprendre pourquoi.

### Garder l'intention, jamais son résultat

La correction est un type :

```ts
export type Framing = { kind: 'all' } | { kind: 'screen'; id: string } | null
```

Ce **sur quoi** la vue est cadrée, et non les nombres que ce cadrage a produits.
Les nombres peuvent alors être recalculés depuis zéro chaque fois que le
conteneur change de taille, et c'est la seule façon de faire que la réponse reste
vraie.

`null` est la troisième valeur, et la plus importante. Tout déplacement ou tout
zoom manuel remet le cadrage à `null`, parce que réimposer le nôtre au prochain
redimensionnement serait exactement le même bug, retourné cette fois contre la
personne qui venait de le corriger à la main.

### L'observateur regarde le conteneur, pas le contenu

`Canvas.tsx` observe l'élément **conteneur** avec un `ResizeObserver`, et
`screens` n'est délibérément pas un déclencheur. Faire glisser un cadre change la
boîte englobante, et re-cadrer en plein glissement arracherait le plan sous le
pointeur. Seul le conteneur de la question a le droit d'invalider la réponse — ce
qui couvre plus que la fenêtre : un panneau latéral qui s'ouvre, la barre du
navigateur qui apparaît sur une tablette, le passage téléphone/bureau.

Le premier appel de l'observateur est ignoré volontairement. `ResizeObserver` se
déclenche une fois sur `observe()`, avant tout redimensionnement réel, et
re-cadrer là écraserait le premier cadrage demandé par l'appelant.

### Deux plafonds, et pourquoi ils diffèrent

| Constante | Valeur | Pourquoi |
|---|---|---|
| `FIT_MAX_SCALE` | 1 | Un plan agrandi au-delà de la taille réelle ne montre plus un agencement |
| `FOCUS_MAX_SCALE` | 0,9 | Un écran cadré garde un bord visible au lieu de déborder du conteneur |
| `MAX_SCALE` | 1,5 | Ni l'un ni l'autre : c'est le plafond auquel obéissent la molette et les boutons +/− |

### `contentBox()` — la colonne qui pend sur le côté

La colonne image/design d'un cadre est dessinée **hors** de la boîte de ce cadre :
borner le projet sur `x + w` le cadrait donc avec chaque carte tranchée en deux.
Seuls les écrans qui en dessinent une (`imageHash`) sont élargis ; ajouter la
largeur de la colonne sans condition relâcherait le cadrage d'un projet qui n'a
aucune carte, c'est-à-dire de la plupart d'entre eux.

`CARD_W = 320` et `CARD_GUTTER = 40` sont en unités **monde**, pas en pixels
d'écran. Tout ce qui est dimensionné contre le zoom occupe une empreinte qui
change avec lui, et un voisin qui se déplace quand on dézoome est la seule chose
qu'un canevas infini ne doit pas faire.

### `latestScreenOf()` trie sur `createdAt`

Ni la sélection, qui bouge dès que l'utilisateur clique quelque part. Ni la queue
du tableau : `addScreen` ne fait qu'ajouter à la fin, mais rien ne garantit que
l'ordre survive à un import ou à une fusion venue d'un autre appareil.
`createdAt` est celui des trois qui répond encore « le dernier généré » dans tous
ces cas.

Deux boutons de la barre de zoom exposent tout cela — « Tout afficher » et
« Zoomer sur le dernier écran ». Leurs libellés, leurs icônes et ce qu'ils
coûtent sont dans [L'interface](fr/interface.md#la-barre-de-zoom).

---

## 6. L'isolation de l'aperçu

![La barre d'outils d'un projet](../../assets/08-toolbar.png)

*Les dix verbes d'un projet, dans l'ordre de la barre : Lier, Modifier, Interagir, Annoter, Cadre, Système, Audit, Démo, Exporter, Vidéo. Les quatre premiers agissent à travers l'aperçu isolé ; les six derniers agissent autour de lui. La capture est antérieure à deux d'entre eux — « Audit », qui se place entre « Système » et « Démo », et « Vidéo », qui ferme la rangée — on voit donc ici huit verbes, pas dix.*

« Lier », « Système » et « Audit » **s'excluent mutuellement**, car les trois
ouvrent un panneau dans l'unique emplacement à `right-4 top-11`. C'était imposé
dans les gestionnaires de clic, et c'est précisément ainsi que la règle a cédé :
chaque bouton éteignait ceux auxquels son auteur pensait, « Audit » fermait
« Système » et aucun des deux ne fermait le mode « Lier » — le rapport d'audit et
la liste des liens se peignaient donc l'un sur l'autre, sans z-index pour
départager, et les boutons du dessous devenaient inatteignables.
`src/lib/rightSlot.ts` tient désormais une **valeur unique**, qui nomme
l'occupant : deux panneaux ouverts est un état que le type ne sait pas écrire, et
un quatrième panneau ne peut pas oublier une remise à zéro que personne n'a
écrite. C'est exactement le genre de détail qu'une légende doit porter, parce que
rien à l'écran n'explique pourquoi activer l'un désactive l'autre. Chaque
contrôle de cette barre est documenté, avec son libellé exact et ce qu'il coûte,
dans [L'interface](fr/interface.md#la-barre-doutils-du-projet).

`src/components/Preview.tsx` construit un document HTML autonome et l'injecte en
`srcDoc`.

### L'iframe

```html
<iframe sandbox="allow-scripts" srcDoc={srcDoc} />
```

`allow-scripts` et rien d'autre. Sans `allow-same-origin`, le document n'a pas
d'origine propre : pas de `localStorage`, pas de cookies, pas d'accès au DOM du
parent. Les URL `blob:` sont considérées de même origine que ce document, donc le
module compilé s'exécute sans CORS. C'est
[l'invariant I2](fr/architecture/invariants.md).

Un test lit le fichier source et exige l'**égalité exacte** de l'attribut, pas
une correspondance partielle. `"allow-scripts allow-same-origin"` contient
`"allow-scripts"` : une vérification par sous-chaîne serait passée pendant que
l'iframe exécutait du code généré avec l'origine de Mocky.

### La politique de sécurité du contenu

`allow-scripts` seul ne limite rien en sortie. Un composant généré pourrait
appeler `fetch()`, `sendBeacon()` ou `new Image().src = …` vers n'importe quel
serveur, depuis l'adresse IP de l'utilisateur, à chaque affichage.

```
default-src 'none'
script-src  <origine du parent> 'unsafe-inline' 'unsafe-eval' blob:
style-src   <origine du parent> 'unsafe-inline'
img-src     * data: blob:
font-src    * data:
connect-src 'none'
form-action 'none'
frame-src   'none'
object-src  'none'
base-uri    'none'
```

`'self'` serait un piège. Le document n'a pas d'origine propre, donc `'self'`
devient la chaîne `"null"` et bloquerait React, Babel et Tailwind. L'origine du
parent est donc nommée explicitement.

`img-src` reste permissif à dessein. Une image distante est un faible moyen de
pistage, mais c'est aussi ainsi qu'une maquette montre une photo, et les modèles
produisent légitimement des URL d'images.

`'unsafe-inline'` et `'unsafe-eval'` sont inévitables : toute la raison d'être de
ce document est d'exécuter du code compilé à la volée.

### Ce que le document charge

React, ReactDOM et Tailwind d'abord, puis les balises des capacités, puis Babel —
tous depuis `/vendor/`.

Chaque fichier est associé à son empreinte dans `public/vendor/VENDOR.md` et
vérifié par `npm run check:vendor`, qui tourne en intégration continue. Les
aperçus fonctionnent donc **hors ligne**, et une compromission de CDN ne peut pas
les atteindre.

Aucune balise ne porte `crossorigin`. Comme le document n'a pas d'origine, cet
attribut transformerait chaque script en requête CORS avec `Origin: null`, que le
serveur ne gère pas : le script échouerait à charger.

### Le chemin de compilation

1. La source est encodée en base64 dans un `<script type="text/plain">`. Cela
   élimine tout caractère qui pourrait casser le HTML ou le gabarit : accents
   graves, `${`, guillemets, retours à la ligne, `</script>`.
2. Le prélude est encodé de la même façon, quand il y en a un.
3. `Babel.transform(prélude + '\n' + source, { presets: [['react', { runtime: 'classic' }]] })`
   s'exécute **à l'intérieur de l'iframe**.
4. Le résultat est exécuté via une URL `blob:`, ce qui donne de vraies positions
   d'erreur.
5. Le composant est monté à l'intérieur d'une frontière d'erreur React.

Cette frontière est nécessaire parce que `createRoot` affiche de façon
**asynchrone**. Une erreur d'affichage survient après le retour du `try/catch`
synchrone, donc elle s'échapperait vers `window.onerror` sous la forme d'un
« Script error. » sans détail — le module vient d'une origine `blob:null`.

La frontière l'attrape avec le vrai message et la pile de composants, et la
transmet au parent. Cela alimente à la fois la boîte d'erreur et `fixComponent`.
Elle ne se déclenche que sur de vraies erreurs, c'est
[l'invariant I5](fr/architecture/invariants.md).

L'erreur React #130 est reformulée avant d'être signalée, parce que son message
minifié n'apprend rien :

> Element type is invalid (React #130) : un composant ou une icône que vous avez
> affiché est indéfini — probablement un nom absent ou mal orthographié.

### Le pont d'interaction

Un petit script à l'intérieur de l'iframe parle au parent par `postMessage`.

| Message | Sens | À quoi il sert |
|---|---|---|
| mode `pick` | Parent → iframe | Surligner l'élément survolé. Au clic, renvoyer un sélecteur CSS, le texte visible, la balise et la chaîne de classes |
| mode `demo` | Parent → iframe | Avec une liste de paires `{selector, target}`, un clic demande au parent de naviguer |
| `ok` | Iframe → parent | Le composant s'est monté correctement |
| `error` | Iframe → parent | Une erreur de compilation ou d'exécution, avec son vrai message |
| `size` | Iframe → parent | La hauteur du contenu affiché |

En mode `pick`, la sélection est exacte pour *Modifier*, et remonte jusqu'au plus
proche ancêtre cliquable pour *Lien*.

L'identité vient de **la fenêtre qui envoie**, jamais d'un champ à l'intérieur du
message. `frameId` est écrit en clair dans chaque `srcDoc` : un aperçu pourrait
donc lire l'identifiant d'un autre dans le DOM et forger des messages en son nom.
Et `e.origin` vaut l'inutile chaîne `"null"` pour toute iframe isolée.

```js
if (e.source !== iframeRef.current?.contentWindow) return   // côté parent
if (e.source !== window.parent) return                      // côté iframe
```

De façon symétrique, une iframe ne peut signaler un clic que si le mode `pick`
est réellement actif, et ne peut demander une navigation que si elle a des liens
de démo. Sans ces contrôles, un composant affiché pourrait piloter l'interface du
parent à volonté.

### Empêcher la maquette de quitter son propre document

Une iframe isolée a toujours le droit de **se** naviguer elle-même. Un
`<a href="/">`, un formulaire soumis, un `location.assign()` : n'importe lequel
fait abandonner le `srcDoc` à l'iframe, qui charge alors l'`index.html` de Mocky.
Comme elle n'a pas d'origine propre, tous les modules de l'application échouent
ensuite en CORS. Écran blanc, console saturée, et l'écran qu'on venait de générer
a disparu.

Quatre gardes, en profondeur :

1. **`window.open` est neutralisé** avant l'exécution de tout code généré.
   `window.location` n'est volontairement pas touché : c'est un accesseur non
   configurable, le redéfinir lève une exception et emporterait tout le pont.
2. **Un gestionnaire de clic en phase de capture annule tous les `<a href>` et
   `<area href>`**, y compris les ancres internes. Un document `srcdoc` hérite de
   l'URL du *parent* comme base, donc `#pricing` se résout en
   `http://localhost:8787/#pricing`, qui est un autre document. Le défilement que
   l'ancre devait produire est fait à la main avec `scrollIntoView`, pour que les
   ancres internes se comportent quand même comme des ancres.
3. **Les soumissions de formulaire sont annulées.** Un `<form>` sans `action`
   poste vers l'URL du document, c'est-à-dire vers la page de Mocky.
4. **Le parent compte les événements `load` de l'iframe.** Le premier est le
   `srcDoc` ; tout autre signifie qu'elle est partie ailleurs. Le parent
   réattribue alors `srcdoc`, un attribut qu'il possède quelle que soit l'origine
   de l'iframe, et affiche « les liens sont inertes » pendant trois secondes.

### Le rythme

Le `srcDoc` est reconstruit après **500 ms sans nouveau morceau**, pour qu'un
flux de jetons ne reconstruise pas l'iframe à chaque caractère.

Un **délai de 20 secondes** évite d'attendre indéfiniment si aucun message
n'arrive.

Pendant la génération, les erreurs sont ignorées : le code est incomplet par
construction. Une erreur dont le code source a changé depuis la construction du
`srcDoc` est écartée comme périmée.

### La capture : une exception qui n'en est plus une

`src/lib/capture.ts` montait une iframe **de même origine**, et ce document
expliquait longuement pourquoi c'était inévitable. Ça ne l'est plus.

La cause était html2canvas : il doit lire le document qu'il photographie, et il
le clone dans une iframe à lui — or une isolation sans `allow-same-origin` donne
à chaque descendant une **nouvelle** origine vide, si bien que l'iframe ne
pouvait plus lire son propre clone. Elle échouait avec « Blocked a frame with
origin null from accessing a cross-origin frame », aussi bien sur le chemin par
défaut qu'avec `foreignObjectRendering`.

Mocky capture désormais avec **snapdom**, qui sérialise le sous-arbre en un SVG
`<foreignObject>` où le style calculé de chaque nœud est inliné, puis rastérise
le tout via une URL `data:`. Rien dans ce chemin ne franchit de frontière
d'origine : l'iframe de capture ne porte plus que `allow-scripts`, exactement
comme un aperçu. Pendant la seconde que dure une capture, le code du modèle ne
s'exécute donc plus avec l'origine de Mocky — il ne peut plus lire la clé API
dans `localStorage`, ni atteindre `window.parent`.

Mesuré en origine opaque avant d'engager le changement : la capture aboutit,
`toDataURL()` ne lève rien (le canvas n'est pas teinté), les utilitaires injectés
par Tailwind sont respectés, et `rgb(var(--token) / 0.5)` se compose au pixel
exact. 113 ms par défaut, contre 111 ms pour html2canvas avec l'origine ouverte.

Deux conséquences à connaître :

- **`connect-src` a dû s'ouvrir à cette origine.** snapdom inline une image en
  récupérant ses octets ; sous `connect-src 'none'`, chaque requête était bloquée
  et chaque image devenait un aplat gris. `/api/images/:hash` répond donc aussi
  avec `Access-Control-Allow-Origin: *` — cette route est déjà publique par
  conception, un joker n'y expose rien. Toutes les autres directives sortantes
  restent fermées : il n'y a toujours nulle part où envoyer quoi que ce soit.
- **Un onglet masqué diffère la capture.** snapdom rastérise en attendant
  `img.decode()`, qui ne se résout jamais dans un document que le navigateur ne
  compose pas : en arrière-plan, la même capture prenait 39 s là où html2canvas
  en prenait 1. La coquille attend maintenant `visibilitychange` au lieu
  d'épuiser son chien de garde.

---

## 7. Un seul dialecte pour tous les modèles

Mocky parle toujours le dialecte Ollama en interne : `POST /api/chat`, avec
`options`, `num_ctx`, `num_predict`, `format`, et une diffusion en NDJSON.

`server/text/dialect.js` traduit vers et depuis les API compatibles OpenAI :
forme de la requête, `response_format`, pièces jointes de vision en `image_url`,
et conversion SSE vers NDJSON. La génération, le planificateur et Muse sont donc
indépendants du fournisseur, sans deuxième chemin de code.

Le proxy vit à deux endroits qui partagent le même module : un middleware Vite en
développement, et `app.use('/__provider', …)` dans Express en production.

Trois protections s'appliquent.

**Une liste de sous-chemins autorisés.** `/api/chat` et `/api/tags`, rien
d'autre.

**Une protection contre le SSRF.** `assertSafeTargetResolved()` n'accepte que
http et https, refuse `localhost`, les plages privées, les adresses de lien local
et `169.254.169.254` — puis **résout le nom de domaine et revérifie chaque
adresse renvoyée**. Sans cette deuxième étape, un nom de domaine contrôlé par
l'appelant (`evil.test` pointant sur 127.0.0.1) passait les tests de chaîne sans
encombre. Les formes IPv6 correspondant à de l'IPv4 sont couvertes explicitement,
dans leurs deux écritures : `::ffff:127.0.0.1` et son jumeau hexadécimal
`::ffff:7f00:1`.

**Un corps de requête borné.** `readRawBody()` s'arrête à 25 Mo. Sans borne, il
accumulait ce que le client envoyait puis appelait `Buffer.concat` dans
l'écouteur `end`. Un corps dépassant `buffer.constants.MAX_LENGTH` levait alors
en dehors de toute chaîne de promesses et, sans gestionnaire
`uncaughtException`, emportait tout le serveur.

Une cible **configurée par un administrateur** contourne volontairement la
protection SSRF. Pointer vers un modèle local — Ollama, LM Studio ou vLLM sur
`127.0.0.1` — est un montage prévu, et seul un administrateur peut le régler. La
protection reste entière pour toute URL venue d'un navigateur.

Quand un fournisseur d'instance est configuré, `/__provider` **exige une
session**. La requête dépense les crédits de l'hébergeur, donc elle doit
appartenir à quelqu'un. Sans fournisseur d'instance, l'appelant fournit sa propre
clé, et le mode « votre clé ne quitte pas votre navigateur » est préservé.

---

## 8. La persistance

### Dans le navigateur

| Clé `localStorage` | Contenu |
|---|---|
| `mocky.projects.v1` | Les projets, avec écrans, positions et liens — et la direction de design propre à chaque projet |
| `mocky.design.v1` | Le `DESIGN.md` global et son interrupteur — le repli d'un projet qui n'a pas de direction à lui |
| `mocky.settings.v1` | Fournisseur, URL de base, **clé d'API**, planificateur activé ou non |
| `mocky.muse.v1` | La configuration Muse : URL d'inspiration, mode image, vidéo, média épinglé |
| `mocky.animations.v1` | `auto`, `on` ou `off` |

### Sur le serveur

Un fichier par utilisateur, `server/data/data-<uuid>.json`, qui contient
`projects` et `design` sérialisés plus un horodatage `updatedAt`. Deux routes :
`GET /api/data` et `PUT /api/data`.

La synchronisation est **différée et observable**. `scheduleSync()` marque l'état
comme modifié, et un état `idle | syncing | failed` est diffusé aux abonnés, pour
qu'un échec soit visible dans l'interface. Auparavant, une synchronisation qui
abandonnait après trente secondes de tentatives n'était visible de personne, pas
même dans la console.

La réconciliation compare `updatedAt` des deux côtés au lieu de supposer que le
serveur est plus récent, ce qui écrasait le travail local. La fusion dans
`src/lib/merge.ts` utilise des marqueurs de suppression avec une durée de vie,
pour qu'une suppression faite sur un appareil ne revienne pas depuis un autre.

### Le magasin serveur

| Chemin sous `server/data/` | Contenu |
|---|---|
| `users.json` | Les comptes : sel et empreinte scrypt, rôle, `dashySub` |
| `sessions.json` | Jeton → `{ u: userId, t: horodatage }` |
| `config.json` | `{ allowRegistration }` |
| `sso-jti.json` | Les identifiants de jeton SSO déjà consommés, purgés après 10 minutes |
| `data-<uuid>.json` | Les projets et le design d'un utilisateur |
| `avatars/<userId>` | Un fichier par compte ayant envoyé une photo. Compté en `bytes.avatar` dans le rapport d'utilisation |
| `text-config.json` | Les fournisseurs de texte configurés par l'administrateur, secrets compris |
| `images-config.json` | Les fournisseurs d'images et les réglages de la vidéo au défilement, secrets compris |
| `video-config.json` | Les réglages de l'**export** vidéo : l'interrupteur maître, le mode d'accès et sa liste, l'URL du worker, et la clé de licence Remotion en clair — d'où le mode `0600`, et d'où `publicView()` qui la transforme en booléen `hasLicenseKey` avant que quoi que ce soit quitte le serveur |
| `muse-cache.json` | Les distillations, 7 jours de durée de vie, texte uniquement |
| `image-library.json` | Les métadonnées de la bibliothèque d'images — dont `owners`, les identifiants des comptes qui ont déposé chaque fichier, **borné à 20** |
| `image-library/<hash>` | Les octets des images |
| `video-library/` | Les séquences : clip, images et affiche. Leurs métadonnées portent `owners` sous la même borne |
| `video-exports.json` | Les films exportés : octets, conteneur, nombre de scènes, durée — et `owners` sous la même borne. Jamais le montage, qui porte le texte incrusté écrit par quelqu'un |
| `video-exports/<hash>.mp4\|.webm` | Le film terminé, entier. Un répertoire distinct de `video-library/` à dessein : celui-là contient des *séquences de défilement*, découpées en images par ffmpeg, et tout ce qui lit son `list()` attend des images qu'un film n'a pas |
| `video-jobs.json` | Le journal de la file de rendu : les 50 derniers jobs terminés, plus ceux en cours. Un job trouvé en cours au démarrage passe en erreur, jamais repris |

Les fichiers contenant des secrets sont écrits en mode `0600`. Le `0644` par
défaut les laissait lisibles par tous les autres comptes de la machine.

La borne sur `owners` est celle que portent déjà `tags` et `projects` juste à
côté, pour la même raison : ces index sont ré-sérialisés **en entier** à chaque
écriture, donc rien de ce qu'ils contiennent n'a le droit de grandir sans
plafond.

---

## 9. Les routes HTTP

| Méthode et route | Authentification | À quoi ça sert |
|---|---|---|
| `GET /api/health` | — | `dataWritable` et `frontendBuilt` ; `503` avec un `detail` qui nomme le problème |
| `GET /api/config` | — | Inscription ouverte ?, mode installation, SSO, modèle d'instance (sans secret) |
| `POST /api/register`, `/api/login` | limité | Le premier compte devient administrateur |
| `POST /api/logout`, `GET /api/me` | cookie | `/api/me` répond `200 { user: null }`, pas `401` |
| `POST /api/account/password` | session, limité | Révoque toutes les sessions et en délivre une neuve |
| `GET /sso/dashy/callback` | limité | Vérifie le jeton HS256, trouve ou crée le compte |
| `GET`/`PUT` `/api/admin/config`, `/users`, `…/password`, `DELETE /users/:id` | admin | Gestion de l'instance et des utilisateurs |
| `GET /api/admin/usage` | admin | Projets et disque par compte. Route à part parce qu'elle analyse le blob projets de chaque utilisateur et parcourt un répertoire par séquence vidéo ; répond `200` avec un champ `error` plutôt qu'un statut d'erreur, pour qu'un rapport en échec ne casse jamais l'écran Admin |
| `GET`/`PUT` `/api/admin/text/config`, `POST /api/admin/text/test` | admin | Le test envoie une vraie requête |
| `GET`/`PUT` `/api/admin/images/config`, `POST /api/admin/images/test` | admin | Le test génère une vraie image, non conservée |
| `POST /api/text/vision` | session | Sonde la vision du modèle. **Passe par la protection SSRF** |
| `GET`/`PUT` `/api/data` | session | Les projets et le design de l'utilisateur |
| `GET /api/mcp/status` | session | L'état de chaque serveur MCP déclaré |
| `POST /api/muse/dossier` | session | Discover → Distill → Dossier |
| `POST /api/muse/audit` | session | La moitié jugée du rapport SEO / accessibilité. `400` uniquement si `code` manque ; **`200` avec une liste vide et une notice quand il n'y a pas de modèle** |
| `POST /api/muse/quality` | session | `{ code, hasDirection, critique }` en entrée, un rapport en sortie. `400` uniquement si `code` manque ; **`200` même sans modèle configuré** — voir plus bas |
| `POST /api/images/generate`, `/upload` | session, 30/min | Générer est le verbe coûteux |
| `GET /api/images/library`, `/library.zip`, `POST /:hash/favorite`, `DELETE /:hash` | session | Gestion de la bibliothèque |
| `POST /api/images/:hash/confirm` | session, propriétaire | Retire la marque `pending` d'une image produite par le parcours de variantes. À sens unique et idempotent : il n'y a pas de dé-confirmation, parce que « personne n'a encore regardé ceci » est un fait passé |
| `GET /api/images/:hash` | **public** | Voir plus bas |
| `POST /api/videos/generate` (6/min), `/upload` (20/min) | session | Plafonds différents : générer coûte de l'argent, importer coûte du disque |
| `GET /api/videos/library`, `/:hash/meta`, `DELETE /:hash` | session | Gestion des séquences |
| `GET /api/videos/:hash/poster.jpg`, `/:hash/f/:n.jpg` | **public** | Voir plus bas |
| `GET /api/video/status` | session | L'export **vidéo** — noter le singulier. Accès, état du worker, et les bornes du schéma que le panneau cite |
| `POST /api/video/compose` (12/min) | session | Le seul appel modèle de la fonctionnalité. Propose un montage sur les images **que l'utilisateur a déjà choisies** : il ordonne et règle, il ne choisit jamais. Un `imageId` hors de la sélection est refusé, jamais substitué, et un document que le schéma rejette est refusé en entier plutôt que réparé. Répond **`200` avec `timeline: null` et des remarques** quand rien d'utilisable n'est revenu — une proposition qui n'a pas eu lieu n'est pas une requête ratée (Q1). `409` si la sélection contient encore une image que personne n'a confirmée : le même garde que `/render`, vérifié ici aussi pour qu'un rebut ne devienne pas la scène quatre |
| `POST /api/video/variants` (6/min) | session | De deux à six prises d'une image de la bibliothèque. Compté comme `/api/videos/generate` plutôt que comme `/compose`, parce que chaque variante est un appel au fournisseur. Répond `derived` : avec un profil d'image « edit » les images sortent de celle de l'utilisateur, sans lui ce sont des sœurs nées du même texte — et une interface qui montrerait les deux à l'identique mentirait |
| `POST /api/video/render` (6/min) | session | Valide le montage, puis met en file. `400` avec la liste des défauts, `404` en nommant les images absentes, `409` si la sélection contient encore une image que personne n'a confirmée, `507` si le volume est déjà plein |
| `GET /api/video/jobs/:id` | session | `403`, pas `404`, sur le job d'un autre : un job porte le montage, et un montage porte son texte incrusté |
| `GET /api/video/:hash` | session | Le film terminé. **Jamais public** — la propriété est vérifiée avant l'existence, donc un hash inconnu et celui d'un autre répondent pareil |
| `GET`/`PUT` `/api/admin/video/config`, `GET /api/admin/video/health` | admin | La clé de licence sort en `hasLicenseKey`, un booléen |
| `ALL /__provider/api/chat`, `/api/tags` | session **si** un modèle d'instance est configuré | Proxy et traduction de dialecte |

### Pourquoi les octets d'images et d'images vidéo sont publics

C'est volontaire, et c'est nécessaire.

Les iframes d'aperçu sont isolées **sans** `allow-same-origin`, donc elles n'ont
pas d'origine propre et leurs requêtes de sous-ressources **ne portent aucun
cookie SameSite**. Une route `/:hash` authentifiée viderait toutes les images de
toutes les maquettes.

Un ZIP exporté référence aussi ces URL depuis une machine sans session.

**L'URL est la clé d'accès** : une empreinte SHA-256 de 64 caractères
hexadécimaux, indevinable, et distribuée uniquement par une liste authentifiée.
Le motif est strict — `PUBLIC_IMAGE_PATH = /^\/[a-f0-9]{64}$/` — donc lister,
générer et supprimer restent derrière une session.

Cette garde est attachée aux **sous-chemins** que servent les routeurs, pas au
montage `/api`. Montée sur `/api`, elle s'exécutait pour toutes les routes
`/api/*` suivantes, ce qui plaçait en silence les octets publics derrière
l'authentification.

### Pourquoi `owners` n'atteint jamais un navigateur

L'autre moitié de la même question. `server/images/routes.js` et
`server/videos/routes.js` retirent tous deux `owners` de chaque listing avant
qu'il ne quitte le serveur, et c'est une décision de confidentialité, pas de
propreté.

Les médiathèques sont **à l'échelle de l'instance** : tout utilisateur connecté
liste toutes les images. Laissé dans la réponse, un compte ordinaire apprend son
propre identifiant dans le `meta` de son premier envoi, soustrait ses images de
la liste, et détient alors la bibliothèque globale partitionnée par auteur — qui
a produit combien, et quels prompts vont ensemble. C'est exactement pour cela que
`publicUser()`, dans `server/index.js`, omet `id`, et que seule
`GET /api/admin/users` en publie un.

Cela ne coûte rien à la fonctionnalité : rien sous `src/` ne lit `owners`. Le
rapport d'utilisation le consomme côté serveur, via `collectUsage`, qui lit
directement l'objet bibliothèque.

### Pourquoi la vérification de qualité répond 200 sans modèle

La route est derrière une session comme tout le reste de Muse —
`app.use('/api/muse', requireUser)` — et elle refuse une requête dans un seul
cas : il n'y a pas de `code` à regarder, et c'est un `400`. L'absence de modèle
n'est pas ce cas-là.

Un rapport a deux moitiés. Les règles déterministes n'ont besoin que de la
source ; la moitié jugée a besoin d'un modèle. Les identifiants suivent
exactement la route du dossier : un fournisseur configuré par l'administrateur
l'emporte, sinon ce sont les en-têtes du navigateur, ceux-là mêmes que lit
`/__provider`. Sans identifiants, la première moitié tourne quand même et la
seconde se déclare indisponible : il y a donc une vraie réponse à rendre — les
défauts trouvés, un audit qui dit quelles dimensions ont réellement été
examinées, et une note qui nomme ce qui n'a pas tourné. Un `4xx` dirait « cet
écran n'a pas pu être vérifié », ce qui est faux, et le navigateur le
remonterait comme un échec au-dessus d'un écran généré sans le moindre problème.
Dégrader, jamais échouer — [l'invariant Q1](fr/architecture/invariants.md).

---

## 10. L'export

`src/lib/export/project.ts` assemble un projet **Vite + React + Tailwind**
exécutable à partir des écrans, avec trois cibles.

| Cible | Contenu |
|---|---|
| `plain` | Tailwind plus les packs d'interface de Mocky, copiés dans le projet |
| `shadcn` | Ce qui précède, plus `components.json`, le `cn()` standard et le thème Tailwind de shadcn, pour que `npx shadcn add …` hérite de la marque via `globals.css` |
| `daisyui` | Tailwind plus le plugin daisyUI |

La réécriture de JSX vers ESM, dans `export/rewrite.ts`, passe par Babel, jamais
par une expression régulière. Elle transforme d'abord le JSX en
`React.createElement`, pour que chaque référence de composant devienne un
identifiant ordinaire, puis interroge la portée.

`export/theme.ts` transforme `DESIGN.md` en `globals.css`. Les expressions
régulières y sont autorisées, parce qu'elles lisent de la **prose Markdown**, pas
du code : c'est l'exception explicite de l'invariant I1.

Le ZIP est écrit par `src/lib/zip.ts`, sans aucune dépendance : méthode « store »
plus CRC32. Le même écrivain sert au « Tout télécharger » de la bibliothèque
d'images et à `npm run backup`.

**Ce n'est pas Motion**, avec lequel il ne partage que le mot. Celui-là
transforme des images de la médiathèque en `.mp4` sur un service Docker séparé et
facultatif, et ne touche jamais à un écran — voir
[Motion](fr/video-export.md).

---

## 11. Les tests

`npm test` exécute Vitest sur tout le dépôt. Cinq suites méritent d'être
connues, parce qu'elles lisent **ce qui est réellement livré**, pas une
abstraction.

**`tests/preview-sandbox.test.js`** verrouille la sécurité de l'aperçu en lisant
`Preview.tsx` et `capture.ts` : la valeur exacte de `sandbox`, l'absence de
balise externe, les directives de sécurité, la garde de navigation, le
comportement du mode « sans animation », et la validation du pont `postMessage`.

Elle existe parce que le seul test qui appliquait l'invariant I3 regardait le
**registre**, et ne voyait donc pas les balises `<script src="https://…">`
écrites en dur dans `buildSrcDoc`. Les deux fichiers avaient dérivé vers des CDN
sans que personne le remarque.

**`tests/tokens-contrast.test.js`** lit `src/styles/tokens.css` et vérifie que
chaque paire texte-sur-fond atteint le niveau WCAG AA. Mesuré sur les valeurs
livrées avant correction : `text-slate-500` donnait 2,09:1 sur le thème beige, et
le bouton actif de la barre d'outils mesurait 1,21:1 — son libellé était
invisible.

**`tests/i18n-parity.test.js`** exige que chaque clé existe en français et en
anglais, et qu'aucun composant ne contienne de phrase en dur. L'interface a été
bilingue **à l'intérieur d'un même composant** : cinq composants en français,
douze en anglais, deux mixtes.

**`tests/docs-parity.test.js`** fait la même chose pour la documentation. Quatre
paires — les deux README, le système de design, l'ADR 001 et l'audit de juillet —
doivent porter le même nombre de titres, aux mêmes niveaux, dans le même ordre ;
chaque fichier désigne son jumeau par un sélecteur de langue, et sous chaque
titre se trouve un bloc d'une ligne qui dit pourquoi la section est agencée
ainsi, dans la langue de ce fichier et jamais dans l'autre. Tenue à la main,
cette convention se défait là où personne ne regarde : un titre traduit d'un côté
et oublié de l'autre, un trait d'union ASCII là où le gabarit met un tiret
cadratin, un bloc anglais collé dans le fichier français. Les documents partaient
exactement où l'interface était déjà allée : un système de design en français, un
ADR en anglais, un audit en français, un README en anglais, et aucun moyen de
savoir à quel lecteur chacun s'adressait.

La même suite tient aussi l'**autre** famille de miroirs, celle qui porte
l'essentiel de cette documentation : `docs/` en anglais, `docs/fr/` en français,
chemin pour chemin. Rien ne la vérifiait jusqu'à ce qu'on en ait besoin — les
quatre jumeaux ci-dessus sont côte à côte avec un suffixe de langue, et les tests
écrits pour eux n'atteignaient pas un arbre mis en miroir par répertoire. Chaque
page doit donc exister des deux côtés, avec les mêmes titres aux mêmes niveaux,
et cela dans les deux sens. L'existence est la moitié bon marché, et c'est celle
qui attrape la vraie faute : ajouter une page sous `docs/` et s'arrêter là ne
fait échouer aucune compilation et laisse le sommaire français pointer vers rien.

**`tests/video-worker-separation.test.js`** tient Remotion hors de Mocky. Elle lit
`package.json` à la recherche d'un paquet Remotion dans **n'importe quel** champ
de dépendances — y compris `peerDependencies`, celui qui a l'air inoffensif parce
qu'il n'installe rien tout en mettant Remotion dans l'arbre de qui le résout —
puis l'arbre des sources pour un import, `.dockerignore` pour l'exclusion de
`worker/`, et `docker-compose.yml` pour le profil `video-export` et le réseau
interne.

Elle existe parce que cette séparation était défendue dans quatre documents et
gardée par aucun : la prose ne fait pas échouer une compilation. Un seul
`npm install remotion` à la racine du dépôt pour « juste essayer la composition
en local », et l'image par défaut livre Remotion à tous les exploitants qui ne
l'ont jamais demandé — ce qui est une régression de licence, pas de taille, et
qu'aucun test ultérieur ne peut dé-livrer. La même suite refuse un serveur de
file d'attente ou un pilote de base de données, car un exécuteur de tâches est
exactement la fonctionnalité pour laquelle on tend la main vers Redis. Voir
[Motion](fr/video-export.md).

À côté : `registry.test.ts` pour les invariants du registre au chargement,
`ssrf-guard.test.js`, `routes-auth.test.js`,
`server/muse/quality/quality.test.js` pour la détection, la politique, le
catalogue jugé et l'audit, `src/lib/quality.test.ts` pour la fusion du lint local
avec les défauts du serveur et pour la signature sur laquelle se mesure le
progrès, `src/lib/polish.test.ts` pour la boucle de correction — ses quatre
conditions d'arrêt sont éprouvées en injectant la vérification et la correction,
donc sans fournisseur ni serveur — `src/lib/designSpec.test.ts` pour les deux
formes que peut prendre une direction et pour les modifications faites depuis la
fiche, et les suites Muse, images et vidéos.

### L'intégration continue

`.github/workflows/ci.yml` exécute `build`, `test`, `check:vendor` et
`npm audit --omit=dev` sur Node 22 **et** 24. La 22 correspond au Dockerfile et
au `.nvmrc` ; la 24 est la prochaine LTS, gardée dans la matrice parce que les
deux ont déjà divergé. Node 20 a été abandonné à l'arrivée de la passe de
qualité : `impeccable` exige 22.12 ou plus, et Node 20 est sorti du support en
avril 2026.

Elle construit ensuite l'image Docker, la **démarre**, et attend qu'elle réponde.
Construire ne prouvait que la validité syntaxique du Dockerfile ; démarrer
attrape un `COPY` oublié, un `CMD` cassé, ou un répertoire de données non
inscriptible.

Une étape vérifie explicitement que `mocky.mcp.json` est bien dans l'image. Il
avait disparu une fois, et Muse démarrait alors zéro serveur MCP pendant que
l'image payait quand même ses 300 Mo de Chromium.
