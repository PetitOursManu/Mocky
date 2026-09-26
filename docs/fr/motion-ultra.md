# Motion Ultra

Motion Ultra est un réglage de projet qui construit chaque nouvel écran comme une
page haut de gamme portée par le mouvement : un fond vivant, une typographie
d'affichage, des surfaces en verre dépoli, des apparitions liées au défilement —
et une **série d'images générées ensemble pour lui**.

Il porte le nom Motion comme l'export de films, exprès : Motion Ultra, c'est la
page ; Motion, c'est le film ; et les deux peuvent vivre sur le même écran.

---

## L'activer

Dans le composer, le contrôle **Motion Ultra** :

- **Éteint pour le projet** — une pastille discrète. Un clic active Motion Ultra
  pour tout le projet.
- **Actif** — la pastille est allumée, et **×3** / **×6** apparaît à côté : le
  nombre d'images de chaque nouvel écran. Le coût et le temps d'attente sont dans
  l'infobulle des boutons. Un clic sur la pastille **met en pause** Motion Ultra
  pour les prochaines générations de la session, sans toucher au réglage du
  projet.
- Le petit **✕** le désactive pour le projet.

Il est proposé sur tous les types d'écran. Un écran d'application (tableau de
bord, formulaire, réglages) a ses propres recettes : l'expression va dans le
cadre et un panneau, les données restent sur des surfaces opaques.

Motion Ultra ne s'applique qu'aux **nouveaux** écrans. Une retouche d'un écran
existant le garde tel qu'il est.

## Ce qui se passe à la génération

```
prompt → storyboard → série d'images → page → contrôles
```

1. **Storyboard.** Un appel au modèle décide du type d'écran, de ses sections, de
   la recette de chacune (un catalogue fermé de dix-huit, dans
   `src/lib/ultra/recipes.ts`), des images à générer avec leur rôle — fond, objet
   isolé, scène, texture — et d'**une phrase de style commune à toutes**, pour
   qu'elles forment une série.
2. **Images.** Exactement le nombre choisi, deux à la fois, via la médiathèque.
   Une image qui échoue laisse sa section à un fond animé en CSS ; la page est
   quand même produite et un message dit ce qui s'est passé.
3. **Page.** Le prompt de génération reçoit le storyboard et les images, et la
   page est écrite avec le **kit Ultra** : les classes `u-*` (verre, typographie
   d'affichage, texte en dégradé, apparitions, parallaxe, grain…) et
   `<Backdrop>`, six fonds vivants dessinés en CSS.
4. **Contrôles.** Signalés, jamais réparés en silence : une image de la série
   absente de la page ; une page qui anime trop à la fois ; et **un texte posé sur
   une image qui s'y lit mal** — mesuré sur les pixels rendus, encre retirée,
   puisqu'une photo n'a pas de couleur unique que l'audit d'accessibilité pourrait
   comparer. Environ une seconde, aucun appel au modèle.

Le composer indique où on en est : *storyboard*, *images 2/6*, puis la génération
habituelle.

## Modifier un écran Motion Ultra

Tout ce qu'on peut faire à un écran fonctionne toujours, et un écran Motion Ultra
le reste :

- **Les retouches par le chat, les réparations, Polish et la correction
  d'accessibilité** reçoivent le vocabulaire du kit, et le gardent au lieu de le
  « nettoyer ».
- **Polish** signale le verre, le texte en dégradé et les halos comme des
  conseils sur ces écrans, jamais comme des défauts à corriger — c'est pour ça
  que Motion Ultra a été activé.
- Une retouche qui **retire des images ou le style Motion Ultra** est signalée,
  avec « Revenir à la version précédente » dans le menu de l'écran.
- **Une image ratée ?** Menu de l'écran → *Changer les médias* → **Autre
  version** : même description, même format, une nouvelle prise, mise à sa place.
  Rien d'autre n'est régénéré.

## Fond vidéo

L'interrupteur **Fond vidéo**, à côté de ×3 / ×6, est **éteint par défaut**.
Allumé, une section de chaque nouvel écran reçoit un fond qui bouge :

- Le storyboard choisit la section — la première construite sur un fond plein
  cadre (une ouverture, un bandeau, un appel final, le panneau expressif d'une
  application ; jamais une grille de cartes, jamais la navigation d'une
  application).
- La page est écrite avec le `<Backdrop slot="film">` de cette section : un fond
  CSS vivant dès la première seconde.
- Un film Motion est ensuite composé à partir des images de la série et **rendu
  par votre propre machine** (le module Motion) — aucune vidéo n'est facturée ;
  le coût est un appel au modèle de texte et une à trois minutes. Le badge de
  l'écran dit où on en est.
- Le film est branché sur ce fond — un attribut, sans appel au modèle, sans
  réécrire la page. Il joue par-dessus les couches CSS, qui restent dessous pour
  la miniature, pour le mouvement réduit et si le film n'arrive jamais.

Fond vidéo actif, aucun autre film Motion n'est fabriqué pour le même écran.

## La série, après l'écran

- Sur le canevas, la carte d'image d'un écran Motion Ultra affiche des **cadres
  empilés** quand elle contient plusieurs images ; un clic ouvre la visionneuse
  sur **toute la série** — flèches, ← →, vignettes, « 2 / 3 ».
- Un écran généré **sans** Motion Ultra (en pause, ou désactivé) dans un projet
  qui a des images Motion Ultra **se les voit proposer** : le modèle peut en
  réutiliser une là où une image aide, sans jamais y être obligé. Rien n'est
  généré pour ça.
- Le contrôle de lisibilité (texte posé sur une image) tourne après **chaque**
  nouvel écran qui contient une image, celles de Muse et les images épinglées
  comprises — pas seulement Motion Ultra.

## Avec Muse et les films Motion

Muse écrit toujours la direction et les textes ; avec Motion Ultra actif, elle ne
génère pas d'image de héros à elle — la série la remplace.

Aucun film n'est fabriqué tout seul. Le seul film qu'une génération fabrique est
le `Fond vidéo` ci-dessus, quand il est allumé ; tout autre film vient du panneau
Motion, et les animations de page sont toujours actives — un écran se fige depuis
son propre menu.

## Pourquoi c'est construit ainsi

Les règles derrière — pourquoi le modèle nomme des traitements au lieu d'écrire
du CSS, pourquoi le nombre d'images vous appartient, comment tout se dégrade —
sont les invariants **U1 à U5** dans [Invariants](architecture/invariants.md).
