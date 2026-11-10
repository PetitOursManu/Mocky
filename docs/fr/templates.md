---
description: Démarrer un nouveau projet depuis une direction gardée, ou depuis un projet entier gardé comme modèle. Les deux sont dans Média, sous Design.
badge: Nouveau
source_hash: 500f8666e78f
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
(l’icône de copie), ou depuis `Exporter ▾ → Enregistrer comme modèle` dans le
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

## Limites

Un compte garde jusqu’à 30 modèles. Un modèle contient au plus 80 écrans, chacun
sous 512 Ko de code, et 6 Mo en tout. Les modèles comptent dans le budget disque
de l’instance comme les versions et la médiathèque, et ils sont supprimés avec le
compte. Créer un projet depuis un modèle n’appelle aucun modèle d’IA et ne coûte
rien, y compris sur l’offre gratuite.
