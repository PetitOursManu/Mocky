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
   la recette de chacune (un catalogue fermé de seize, dans
   `src/lib/ultra/recipes.ts`), des images à générer avec leur rôle — fond, objet
   isolé, scène, texture — et d'**une phrase de style commune à toutes**, pour
   qu'elles forment une série.
2. **Images.** Exactement le nombre choisi, deux à la fois, via la médiathèque.
   Une image qui échoue laisse sa section à un fond animé en CSS ; la page est
   quand même produite et un message dit ce qui s'est passé.
3. **Page.** Le prompt de génération reçoit le storyboard et les images, et la
   page est écrite avec le **kit Ultra** : les classes `u-*` (verre, typographie
   d'affichage, texte en dégradé, apparitions, parallaxe, grain…) et
   `<Backdrop>`, cinq fonds vivants dessinés en CSS.
4. **Contrôles.** Une image de la série absente de la page est signalée.

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

## Avec Muse et les films Motion

Muse écrit toujours la direction et les textes ; avec Motion Ultra actif, elle ne
génère pas d'image de héros à elle — la série la remplace.

Un film Motion n'est jamais placé dans l'ouverture construite par Motion Ultra.
Il va dans une autre section, sous un autre type de film, et il est composé à
partir des images de la série.

## Pourquoi c'est construit ainsi

Les règles derrière — pourquoi le modèle nomme des traitements au lieu d'écrire
du CSS, pourquoi le nombre d'images vous appartient, comment tout se dégrade —
sont les invariants **U1 à U5** dans [Invariants](architecture/invariants.md).
