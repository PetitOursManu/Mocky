---
description: Un brief décliné en affiche, flyer, post et story — chaque création composée pour son format, avec les mêmes infos, la même direction artistique et les mêmes images.
badge: Nouveau
source_hash: 42f5f7b9f789
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

## Calendrier éditorial

:::why
Une campagne est une suite autant qu’un ensemble : l’affiche part un mois
avant, le post une semaine avant, la story le jour même. Une date gardée sur la
création — pas dans un planning à part — voyage avec elle : un écran annulé ou
une version restaurée porte sa propre date, et le calendrier n’est jamais en
décalage avec les créations.
:::

Sous les créations, le panneau donne à chacune une **date** et, quand elle
compte, une **heure**, et montre le mois avec une pastille par création
(cliquez dessus pour voir la création).

- `.ics` — un événement par création pour n’importe quel agenda (Google,
  Outlook, Apple). L’heure est celle de Paris ; une création sans heure est un
  événement sur la journée. Réimporter le fichier met les événements à jour au
  lieu de les doubler.
- `.csv` — la même liste pour un tableur, séparée par des points-virgules pour
  qu’Excel l’ouvre telle quelle. Ses colonnes portent les noms des champs de
  Calendy.
- `Envoyer dans Calendy` — relie votre Calendy une fois (son adresse et un
  jeton d’accès), puis envoie chaque **création sociale datée** comme **idée à
  valider**, avec ses pages en images : post et story Instagram vers Instagram,
  Facebook vers Facebook, LinkedIn vers LinkedIn. Les affiches et les flyers
  n’ont pas de réseau et restent dans Mocky. Un nouvel envoi met à jour la même
  idée — sa date, son heure et ses images — et ne touche jamais au texte écrit
  dans Calendy entre-temps.

:::why
Mocky ne valide, ne programme et ne publie jamais à votre place : c’est l’onglet
`À valider` de Calendy qui en décide. Les appels sont faits par le serveur de
Mocky, pas par votre navigateur — Calendy refuse une requête venue d’un autre
site, et le jeton, qui peut modifier votre calendrier, reste sur le serveur ; le
navigateur sait seulement quel Calendy est relié.
:::

## Pack de publication

:::why
Un visuel ne part jamais seul : il est publié avec une légende écrite pour son
réseau et un texte alternatif pour les personnes qui ne le voient pas. Écrits
dans un autre outil à partir du même brief, ces mots s’éloignent des images —
une date dans la légende que le visuel ne dit plus.
:::

En bas du panneau, `Écrire les légendes et les textes alternatifs` fait un appel
au modèle qui lit le brief, les infos clés et, avec l’analyseur, ce que chaque
création **affiche** — ses mots, et ses images telles que leur propre
description les dit. Il écrit :

- **trois légendes**, chacune pour son réseau : Instagram ouvre sur une accroche
  et finit par un appel à l’action, avec 8 à 12 hashtags ; Facebook est un peu
  plus pratique, avec 4 au plus ; LinkedIn est professionnel, avec 3 à 5. Les
  infos sont recopiées telles qu’elles sont écrites dans le panneau, et rien
  n’est inventé que le brief ne dise. Chaque légende affiche sa longueur face au
  plafond du réseau (2 200 caractères, 3 000 pour LinkedIn).
- **un texte alternatif par création**, une ou deux phrases qui disent ce que
  montre le visuel.

Tout se modifie sur place et a un bouton `Copier` qui copie la légende avec ses
hashtags, prête à coller. `Réécrire` réécrit le tout, en remplaçant vos
retouches.

- Quand une info change après l’écriture des légendes, le panneau la nomme : les
  légendes disent encore l’ancienne valeur.
- Quand une création change après l’écriture de son texte alternatif (une
  modification, une mise à jour), le texte signale qu’il décrit une version
  précédente.

`Télécharger le pack (.zip)` construit une seule archive :

| Dans l’archive | Ce que c’est |
|---|---|
| `visuels/` | Chaque création, numérotée dans l’ordre de la campagne : l’affiche et le flyer en PDF d’impression, chaque création sociale en un PNG par page (un carrousel en donne plusieurs). Les mêmes rendus que la fenêtre de téléchargement. |
| `legendes/instagram.txt`, `facebook.txt`, `linkedin.txt` | Chaque légende suivie de ses hashtags. |
| `textes-alternatifs.txt` | Le nom de chaque fichier et son texte alternatif. |
| `pack.csv` | Une ligne par fichier : format, réseau, date et heure de publication, texte alternatif et légende — séparés par des points-virgules, pour Excel. |

Une création qui ne peut pas être rendue est laissée hors de l’archive et
nommée ; le reste est téléchargé quand même.

Une fois les légendes écrites, `Envoyer dans Calendy` donne à chaque **nouvelle**
idée la légende et les hashtags de son réseau (celle d’Instagram pour un post ou
une story). Une idée qui existe déjà garde le texte écrit dans Calendy.

## Depuis un assistant

`create_campaign` fabrique la même campagne depuis Claude ou ChatGPT
([MCP](mcp.md)) : le brief, les formats, et les infos clés lues de la même façon.

## Ce que ça coûte

| | |
|---|---|
| Lire les infos | Un petit appel au modèle, quand vous le demandez (ou avant la première création). |
| Chaque création | Une génération, comme n’importe quel nouvel écran. |
| Images | Une au plus, faite par la première création, selon `Image`. |
| Une mise à jour | Gratuite quand elle est directe ; une modification par création qui a besoin du modèle. Mesurer la page ensuite n’appelle aucun modèle. |
| Le pack de publication | Un appel au modèle pour les trois légendes et tous les textes alternatifs, quand vous le demandez. Le .zip n’appelle aucun modèle. |

---

## Ce qui est gardé

Le brief, les infos et les formats cochés sont gardés sur le projet. Chaque
création garde les valeurs avec lesquelles elle a été écrite, ce qui permet au
panneau de savoir quelles créations un changement laisse en arrière — lu, jamais
stocké comme un drapeau, donc une version restaurée ou un écran annulé porte sa
propre réponse. La page de validation d’un client montre les créations comme
des écrans, et rien du brief.
La date de publication d’une création et l’idée Calendy
qu’elle est devenue sont gardées sur la création aussi, comme son texte
alternatif, avec une empreinte du code qu’il décrit ; les légendes sont gardées
sur la campagne, avec les infos avec lesquelles elles ont été écrites. Le jeton de Calendy
est gardé sur le serveur, par compte, et n’est jamais renvoyé au navigateur.
