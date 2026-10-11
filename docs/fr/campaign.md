---
description: Un brief décliné en affiche, flyer, post et story — chaque création composée pour son format, avec les mêmes infos, la même direction artistique et les mêmes images.
badge: Nouveau
source_hash: 4d130a9f1e79
---

# Campagne

Une campagne, c’est la même annonce à plusieurs endroits : une affiche au mur,
un flyer dans la main, un post dans le fil, une story sur le téléphone. La
Campagne les fait **à partir d’un seul brief**. Chaque format est **composé pour
lui-même** — sa propre mise en page, sa propre hiérarchie — tandis que les
**infos clés**, la **direction artistique** et les **images** sont communes.
Changez plus tard la date dans le brief, et vous choisissez les créations à
mettre à jour ; rien n’est régénéré.

Un projet est une campagne : ses créations sont des documents ordinaires sur le
canevas, et tout ce qui marche sur un document — le téléchargement, `Ajuster à
la page`, les versions, l’envoi en validation — marche sur elles.

---

## Lancer une campagne

:::steps id=start-campaign
1. **Ouvrez le panneau.** `Campagne` dans la barre d’outils du projet ; sur un
   projet vide, `Campagne` à côté de `Parcours`, sous le compositeur.
2. **Écrivez le brief.** Ce qui est annoncé, quand, où, à quel prix, et comment y
   participer — comme vous l’expliqueriez à un graphiste.
3. **Lisez les infos clés.** `Lire dans le brief` les liste : un titre, une date,
   un lieu, un prix, un appel à l’action. Corrigez une valeur, renommez une
   étiquette, retirez-en une ou ajoutez-en une à la main.
4. **Cochez les formats et choisissez l’image.** Les six sont cochés ; décochez
   ceux dont vous n’avez pas besoin. `Image` décide de l’unique image de la
   campagne : aucune, générée ou photo libre.
5. **Appuyez sur `Créer la campagne`.** Les créations sont faites l’une après
   l’autre et apparaissent sur le canevas à mesure qu’elles sont écrites.
   `Arrêter` termine la campagne là où elle en est ; ce qui est fait reste.
:::

Si vous appuyez sur `Créer` avant d’avoir lu les infos, elles sont lues
d’abord : les créations en ont besoin pour les écrire de la même façon.

---

## Les formats

| Format | Taille | Ce qu’il montre |
|---|---|---|
| `Affiche A3` | 1 123 × 1 587 px (297 × 420 mm) | Vue à trois mètres : le titre et le bloc des infos clés dominent. |
| `Flyer A4` | 794 × 1 123 px (210 × 297 mm) | Lu dans la main : toutes les infos, les points forts, l’appel à l’action. |
| `Post Instagram 4:5` | 1 080 × 1 350 px | Une accroche, la date, l’appel à l’action. |
| `Story 9:16` | 1 080 × 1 920 px | Plein écran pendant trois secondes : l’accroche, la date et l’appel à l’action, hors des bandes où l’application dessine ses barres. |
| `Visuel LinkedIn 1:1` | 1 080 × 1 080 px | Ton professionnel : le titre, l’info qui compte le plus, qui est derrière. |
| `Visuel Facebook 1.91:1` | 1 200 × 628 px | Un bandeau large à côté du texte du post : le titre et la date ou le lieu. |

:::why
Une story n’est pas une affiche recadrée. Ce qu’une création montre dépend de la
distance d’où on la lit et du temps qu’on la regarde — une affiche a trois mètres
et dix secondes, une story un pouce et trois secondes — donc une mise en page
redimensionnée est fausse dans tous les formats sauf le premier. Chaque création
est donc une génération à part entière, faite par le type de document qui
connaît déjà son format (l’affiche, le flyer, les posts Instagram, LinkedIn et
Facebook), qui sait qu’elle appartient à une campagne et quelles sont les
autres créations.
:::

---

## Ce que les créations partagent

- **Les infos.** Chaque création reçoit la même liste et doit écrire chaque
  valeur exactement telle quelle, d’un seul tenant. Le format décide lui-même des
  infos qui y tiennent : une story n’a pas la place pour une adresse.
- **La direction artistique.** La première création fixe la direction du projet
  s’il n’en a pas ; chacune des suivantes est faite d’après elle, et l’écran de
  référence du projet porte le style.
- **Les images.** Seule la première création peut faire une image — générée, une
  photo libre, ou celle de Muse quand Muse est activée. Chacune des suivantes se
  voit proposer les images du projet et doit les réutiliser.

:::why
Six créations faisant chacune leur image coûteraient six images et montreraient
six sujets différents. Un seul visuel clé, réutilisé et recadré par chaque
format, est ce qui fait qu’une campagne a l’air d’une seule — et qu’elle coûte
une seule image.
:::

---

## Changer une info

:::steps id=update-campaign
1. **Changez la valeur** dans `Infos clés` — la date, le lieu, le prix.
2. **Voyez quelles créations la disaient.** Chaque création écrite avec
   l’ancienne valeur est marquée `à mettre à jour`, avec le changement qu’il lui
   faut. Une création qui n’a jamais montré cette info n’est pas touchée.
3. **Choisissez.** Toutes les créations à mettre à jour sont cochées ; décochez
   celles à garder telles quelles.
4. **Appuyez sur `Mettre à jour`.** Chaque création choisie est mise à jour, et le
   panneau dit comment.
:::

La mise à jour est **directe chaque fois que c’est possible** : là où une
création écrit l’ancienne valeur telle quelle, le texte est remplacé sur place —
aucun appel au modèle, rien d’autre ne bouge, les majuscules gardées là où la
création les avait écrites. Là où ce n’est pas possible — la valeur est coupée
entre deux styles, ou une info a été vidée — une retouche ciblée demande au
modèle de changer ces infos et rien d’autre.

Une valeur plus longue peut pousser une ligne au-delà du bord de la page. Chaque
document mis à jour est mesuré ensuite, et une création qui dépasse de sa page
le dit dans le panneau, avec un bouton `Ajuster à la page` à côté. `Annuler` sur
un écran défait sa mise à jour, comme n’importe quelle modification.

:::why
« Changer la date » promet que rien d’autre ne change. Un modèle qui réécrit une
affiche terminée ne peut pas tenir cette promesse de façon sûre ; un
remplacement du texte à l’endroit exact où la date est écrite la tient par
construction. Le modèle n’est donc sollicité que pour ce qu’un remplacement ne
peut pas atteindre, et seulement pour ces infos-là.
:::

---

## Ajouter un format plus tard

Cochez un format qui n’a pas encore de création et appuyez sur `Créer les formats
manquants`. La nouvelle création est faite avec les infos actuelles, d’après la
direction du projet, et reprend les images de la campagne.

---

## Ce que ça coûte

| | |
|---|---|
| Lire les infos | Un petit appel au modèle, quand vous le demandez (ou avant la première création). |
| Chaque création | Une génération, comme n’importe quel nouvel écran. |
| Images | Une au plus, faite par la première création, selon `Image`. |
| Une mise à jour | Gratuite quand elle est directe ; une modification par création qui a besoin du modèle. Mesurer la page ensuite n’appelle aucun modèle. |

---

## Ce qui est gardé

Le brief, les infos et les formats cochés sont gardés sur le projet. Chaque
création garde les valeurs avec lesquelles elle a été écrite, ce qui permet au
panneau de savoir quelles créations un changement laisse en arrière — lu, jamais
stocké comme un drapeau, donc une version restaurée ou un écran annulé porte sa
propre réponse. La page de validation d’un client montre les créations comme
des écrans, et rien du brief.
