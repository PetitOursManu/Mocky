---
description: Démarrer un nouveau projet depuis une direction gardée, ou depuis un projet entier gardé comme modèle. Les deux sont dans Média, sous Design.
badge: Nouveau
source_hash: 28b89180a526
---

# Directions et modèles

Deux sortes de point de départ se réutilisent, et elles ne font pas la même chose :

| | Ce que c’est | Ce que cela donne à un projet |
|---|---|---|
| **Direction** | Un DESIGN.md gardé dans votre bibliothèque de design | L’apparence de ses prochains écrans. Aucun écran. |
| **Modèle** | Un projet entier, gardé comme point de départ | Ses écrans et leur code, sa direction et ses réglages. |

Les deux sont listés dans **Média → Design**, en deux sections.

## Directions

Ce sont les documents enregistrés depuis DESIGN.md avec `Enregistrer sous…`.
Chaque carte montre la palette, et se renomme ou se supprime.

- Sur la **page Média**, `Nouveau projet avec cette direction` crée un projet
  vide qui la suit déjà, dans le dossier qu’affichait la page des projets, et
  l’ouvre.
- Dans un projet (la médiathèque ouverte depuis un projet),
  `Appliquer à ce projet` en fait la direction de **ce projet**. Le DESIGN.md
  global, que suit tout projet sans direction propre, ne change pas.

## Modèles de projet

Enregistrez un projet comme modèle depuis sa carte sur la page des projets
(l’icône de signet), ou depuis `Exporter ▾ → Enregistrer comme modèle` dans le
projet. Vous le nommez, et Mocky en garde une copie sur le serveur, dans votre
compte. Personne d’autre sur l’instance ne la voit.

Un modèle garde :

- la **direction** du projet — la sienne, ou le DESIGN.md global qu’il suivait au
  moment de l’enregistrement, pour que le modèle veuille dire la même chose plus
  tard ;
- ses **réglages** : identité de marque, Créatif, Créations et Motion Ultra (avec
  son nombre d’images et son fond vidéo) ;
- chaque **écran** : son code, son nom et sa demande, son type, son format de page
  et son pli, son appareil, sa place sur le canevas, ses liens vers les autres
  écrans du modèle, et la référence de mise en page partagée.

Il ne garde pas les notes, les verdicts de qualité, les versions, les tours de
validation, la campagne, les publications, les scénarios de démo ni la branche :
c’est l’histoire d’un projet, pas un point de départ.

**Les images ne sont pas copiées.** Un écran désigne ses images par leur adresse
dans la médiathèque, et ces fichiers sont partagés par tous les projets qui les
utilisent. Une image supprimée plus tard de Média disparaît aussi du modèle,
comme de tous les projets qui l’affichent.

`Nouveau projet depuis ce modèle` (page Média) crée un projet avec de nouveaux
identifiants pour chaque écran et chaque lien, dans le dossier qu’affichait la
page des projets, et l’ouvre. Modifier le nouveau projet ne touche jamais au
modèle, et inversement.

## Depuis le premier composeur

Le premier composeur d’un projet vide montre, sous les styles prédéfinis, une
rangée **Depuis mes designs** avec vos modèles et vos directions :

- une **direction** devient la direction de ce projet ;
- un **modèle** remplit ce projet avec ses écrans, sa direction et ses réglages.
  Il n’est proposé que tant que le projet est vide : un modèle est un point de
  départ, pas quelque chose qu’on fusionne dans un travail existant.

## Écrans à remplir

Un menu de la semaine, une affiche d’événement, une liste de prix : le même design
à chaque fois, avec quelques mots et une photo qui changent. Clic droit sur
l’écran → **Remplir…**.

1. **Choisir les champs**, une fois. La fenêtre liste chaque texte qu’un lecteur
   voit et chaque image de la médiathèque, dans l’ordre où la page les dit.
   Cochez ceux qui changent — un plat, une date, un prix, une photo — et
   donnez un nom à chacun (« Plat du lundi »). Les mêmes mots écrits deux fois
   sont deux endroits : cochez celui que vous voulez.
2. **Remplir**, à chaque fois. Le formulaire demande chaque champ par son nom,
   déjà rempli de ce que dit l’écran ; une image se choisit dans la médiathèque.
   - `Créer une copie remplie` ajoute le résultat à droite de l’écran, qui ne
     change pas. La semaine suivante, remplissez depuis cette copie.
   - `Remplir cet écran` écrit dans l’écran lui-même ; Annuler le défait.

Les valeurs sont écrites à leur place dans le code, **sans appel au modèle** :
rien d’autre ne bouge sur la page, et cela ne coûte rien, y compris avec l’offre
gratuite. Une valeur qui ne peut pas aller là où on la demande (vide, ou un
`{ } < >` dans un texte) n’est pas écrite, et l’avis la nomme. Un texte beaucoup
plus long peut déborder : un document signale ses pages qui débordent, et
`Ajuster à la page` les corrige.

Un champ est retrouvé par ce qu’il dit. Si une modification ou un polissage
réécrit ses mots, le champ est signalé **introuvable** plutôt que deviné :
ouvrez `Choisir les champs` et cochez-le à nouveau. Les champs suivent l’écran
dans un modèle : un modèle de projet de menu se remplit dès qu’il est créé.

### Une série depuis un tableau

Fiches produits, invitations nominatives, un mois de menus : une ligne du
tableau, une copie de l’écran. Dans **Remplir…**, ouvrez l’onglet `Série`.

1. `Télécharger le tableau modèle (.csv)` donne un fichier avec une colonne par
   champ, à son nom, et une ligne avec ce que dit l’écran aujourd’hui.
   Remplissez-le dans un tableur, une ligne par copie.
2. Importez-le avec `Importer un CSV`, ou collez les lignes copiées du tableur,
   ligne de titres comprise. Points-virgules, virgules et tabulations sont lus.
3. Vérifiez quelle colonne remplit quel champ : Mocky les associe par leur nom,
   et vous pouvez changer chacune ou garder la valeur de l’écran pour un champ.
   `Nom des copies` choisit la colonne qui nomme les copies.
4. La fenêtre liste les copies qu’elle va créer. `Créer les copies` les ajoute
   en rang à droite de l’écran, qui ne change pas.

Chaque copie est remplie depuis l’original, sans appel au modèle, et garde ses
champs : elle se remplit ensuite toute seule. Une **case vide garde la valeur
de l’écran** ; une ligne qui ne change rien ne crée pas de copie. Une photo se
désigne par le nom du fichier importé dans la médiathèque (avec ou sans son
extension), ou par son adresse dans la médiathèque : importez d’abord les
photos, puis écrivez leur nom dans la colonne. Une photo que la médiathèque ne
connaît pas est laissée telle quelle, et la fenêtre la nomme. Au plus 50 copies
à la fois.

## Limites

Un compte garde jusqu’à 30 modèles. Un modèle contient au plus 80 écrans, chacun
sous 512 Ko de code, et 6 Mo en tout. Les modèles comptent dans le budget disque
de l’instance comme les versions et la médiathèque, et ils sont supprimés avec le
compte. Créer un projet depuis un modèle n’appelle aucun modèle d’IA et ne coûte
rien, y compris sur l’offre gratuite.
