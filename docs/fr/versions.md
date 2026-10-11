---
description: Enregistrer un projet ou un écran, comparer deux états côte à côte, revenir à n’importe lequel, et essayer une autre direction artistique sur une branche.
badge: Nouveau
source_hash: 5ac0e9bbc219
---

# Versions et branches

Un projet change sous vos yeux : une modification, un polissage, une nouvelle
direction artistique. Les versions permettent de **garder un état exprès**, de
regarder deux états **côte à côte**, et de **revenir** à n’importe lequel. Les
branches permettent d’essayer **une autre direction** sur le même projet sans
risquer celle que vous aviez.

Ouvrez-les avec `Versions` dans la barre d’outils du projet. L’historique propre
à un écran est dans son menu contextuel : `Versions de cet écran`.

## Enregistrer une version

Tapez un nom (facultatif) dans le panneau `Versions` et appuyez sur
`Enregistrer`. La version contient tous les écrans du projet — leur code, leur
demande, leurs images, leurs liens — et la direction artistique du projet
(DESIGN.md).

:::why
Les versions sont gardées sur le serveur, pas dans le navigateur. Le navigateur
garde la copie de travail dans un espace d’environ 5 Mo que le code des écrans
remplit déjà ; dix copies du projet à cet endroit seraient la première chose à
faire échouer l’enregistrement. Sur le serveur, un code partagé par deux
versions n’est écrit qu’une fois : la version d’un projet où un seul écran a
changé coûte cet écran-là.
:::

Un écran peut aussi être enregistré seul, depuis `Versions de cet écran`.

## Comparer

Cochez une version dans l’historique, puis :

- `Comparer avec l’état actuel` — cette version d’un côté, le canevas de l’autre ;
- cochez-en une seconde et `Comparer ces deux versions`.

La fenêtre de comparaison liste tous les écrans des deux côtés, marqués
**modifié**, **ajouté**, **retiré** ou **identique**, et montre celui que vous
choisissez côte à côte, chacun à sa taille. Elle signale aussi quand la
**direction artistique** diffère. Chaque côté peut passer à une autre version
depuis sa liste.

## Revenir en arrière

`Restaurer` sur une version de projet remet tout le projet comme il était :
écrans, direction artistique, écran de référence épinglé.

:::why
Avant de remplacer quoi que ce soit, l’état actuel est enregistré comme
**sauvegarde automatique** sur sa branche. Si cet enregistrement échoue — pas de
réseau, disque plein — rien n’est restauré. Revenir en arrière ne doit jamais
coûter l’état dans lequel on était.
:::

Le **nom** du projet n’est pas restauré : c’est le nom que vous donnez au
travail, pas un état de celui-ci. Restaurer une version enregistrée sur une
autre branche place le projet sur cette branche.

`Restaurer cet écran`, depuis la comparaison ou l’historique d’un écran, ramène
cet écran-là et rien d’autre. Il garde sa place sur le canevas et les notes
écrites dessus depuis. Le `Revenir à la version précédente` ordinaire de l’écran
l’annule, comme il annule une modification. Un écran supprimé entre-temps revient
comme un nouvel écran.

## Garder les deux

`Garder à côté`, depuis la comparaison ou l’historique d’un écran, ne restaure
rien : il ajoute cette version de l’écran sur le canevas, **à droite de l’écran
actuel**, nommée d’après la version (`Accueil — Claire`). Les deux restent, les
deux fonctionnent, et vous les comparez quand vous voulez — la façon habituelle
de peser deux directions artistiques, ou une branche contre la principale, avant
de choisir.

La copie est faite comme `Dupliquer` : sans les liens, les notes ni la route de
l’original, pour que la démo n’ait jamais deux écrans qui répondent à la même
page.

## Les branches

Une branche est une autre suite de versions du même projet. Le cas habituel :

:::steps id=try-a-direction
1. **La direction actuelle vous convient, et vous voulez en essayer une plus
   sombre.** Créez une branche « Direction sombre » depuis le panneau `Versions`.
2. **Changez ce que vous voulez dessus.** Modifiez le DESIGN.md, régénérez,
   polissez. Enregistrez des versions en chemin.
3. **Revenez sur la branche principale** avec `Ouvrir`. Le projet retrouve sa
   direction principale ; la sombre reste sur sa branche.
4. **Rouvrez la branche sombre** quand vous voulez. Supprimez-la une fois votre
   choix fait.
:::

Changer de branche enregistre l’état actuel sur la branche que vous quittez,
puis ouvre la version la plus récente de l’autre. Une branche existe tant
qu’elle a des versions ; la principale existe toujours. La branche sur laquelle
vous êtes ne peut pas être supprimée — changez d’abord.

## Ce que coûte une version

| | |
|---|---|
| Appels au modèle | Aucun. Enregistrer, comparer, restaurer et changer de branche n’appellent jamais un modèle. |
| Disque | Celui du serveur, compté dans la limite de stockage de l’instance (`MOCKY_MAX_STORAGE_MB`). Un code identique n’est stocké qu’une fois. |
| Limites | 200 versions par projet, 1 500 par compte, 80 écrans par version. Supprimez les anciennes versions depuis l’historique. |

Supprimer un compte supprime ses versions.
