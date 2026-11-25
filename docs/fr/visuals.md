---
description: Collez un texte, obtenez-en le schéma — étapes, cycle, frise, comparaison, chiffres clés ou graphique — dans le style du projet, modifiable et exportable.
badge: Nouveau
source_hash: 36b3d543b6eb
---

# Visuels

Un **visuel** est un texte mis en un seul schéma qui montre sa structure d’un
coup d’œil : les étapes d’une méthode, un cycle, les dates d’une histoire, deux
options côte à côte, quelques chiffres clés, un graphique. Vous écrivez ou collez
le texte ; Mocky choisit la forme et la dessine dans les couleurs et les polices
du projet.

## En faire un

1. Dans le composeur, choisissez le type d’écran **Visuel** (parmi les documents).
2. Collez ou écrivez votre texte. Rien d’autre n’est nécessaire : aucune consigne
   sur la façon de le dessiner. Vous pouvez tout de même dire « en frise » ou
   « en graphique ».
3. Choisissez une taille : diapositive 16:9 (par défaut), post carré, portrait
   ou paysage, ou page A4.

La génération lit le texte pour sa structure, choisit une famille et écrit le
contenu une seule fois : un titre, un sous-titre et un élément par idée, avec un
libellé court et une phrase de détail. Muse ne tourne pas pour un visuel, même
activé : un visuel est dessiné dans la direction du projet et n’a besoin d’aucune
image, le dossier serait un appel pour rien.

## Les familles

| Famille | Pour |
|---|---|
| Étapes | Un processus dans l’ordre |
| Cycle | Un processus qui revient à son début |
| Frise | Des dates ou des phases |
| Entonnoir | Ce qui se réduit d’étape en étape |
| Pyramide | Une hiérarchie, le sommet d’abord |
| Comparaison | Deux ou trois options point par point |
| Pour et contre | Avantages et inconvénients |
| Matrice | Une grille 2 × 2 et ses deux axes |
| Moyeu | Une idée centrale et ce qui l’entoure |
| Carte mentale | Un sujet, ses branches et leurs points |
| Logigramme | Des chemins, des choix, des retours |
| Chiffres clés | Quelques chiffres et ce qu’ils mesurent |
| Barres | Des quantités à comparer |
| Anneau | Les parts d’un tout |

## Changer de forme sans nouvelle génération

:::why
Le contenu ne dépend pas de la famille : les mêmes éléments se dessinent en étapes
ou en cycle. Changer, c’est donc écrire un mot dans le code de l’écran, ce qui ne
coûte rien et garde chacun de vos mots.
:::

Clic droit sur l’écran → **Visuel…**. Les familles proposées pour ce contenu
viennent en tête, les autres suivent. Une famille qui ne peut pas dessiner ce
contenu est grisée, avec la raison : un graphique demande un chiffre sur chaque
élément, une matrice exactement quatre éléments, une comparaison des sous-points
sous chaque option. Le même dialogue fait passer les cases de **Teintées** à
**Pleines** ou **Contour**. **Annuler** revient sur n’importe quel changement.

Pour changer les mots, retouchez l’écran comme d’habitude (le composeur, ou
**Remplir…**).

## Les chiffres

:::why
Un visuel a l’air d’un fait. Un chiffre plausible que le texte n’a jamais donné —
un graphique d’un texte qui n’avait pas de nombres — y est pire que dans un
paragraphe.
:::

Un visuel ne montre que les chiffres de votre texte. Après la génération, chaque
chiffre du visuel est cherché dans votre texte, sous les formes qu’on lui donne
en écrivant (1 200 et 1,2 k, 12 % et 0,12). Celui qu’on ne trouve pas est retiré
du visuel, son élément gardé, et un avis le nomme. Les chiffres écrits en lettres
(« douze ») ne sont pas reconnus : écrivez-les en chiffres.

## Comment il est dessiné

Le modèle ne dessine jamais le schéma. Il nomme une famille et écrit le contenu ;
la mise en page de Mocky calcule les cases, les liaisons et les tailles de texte,
de la même façon pour chaque visuel d’une famille :

- toutes les cases d’un visuel ont une seule taille de libellé, la plus grande à
  laquelle elles tiennent toutes, et un détail est toujours plus petit que son
  libellé ;
- un mot n’est jamais coupé en deux : le texte rapetisse plutôt, et les détails
  disparaissent avant les libellés quand la place manque ;
- chaque texte est mesuré contre la couleur sur laquelle il est posé et reste
  lisible, les couleurs de votre palette essayées en premier.

## Exporter

Un visuel est un document : il se télécharge en PNG, PDF, SVG ou PowerPoint comme
les autres ([Télécharger](documents.md#télécharger)). Ses cases sont dessinées
comme des éléments de la page, pas comme une seule image : **Tout en éléments
séparés** dans l’export PowerPoint rend chaque case en forme et chaque libellé en
zone de texte. Les liaisons et l’anneau sortent en images.

## Limites

- Un visuel par écran est l’usage prévu ; un écran peut en contenir plusieurs, et
  le dialogue les liste.
- La vérification des chiffres lit la demande que vous avez tapée. Un chiffre qui
  ne venait que d’une image ou d’un PDF joint n’est pas dans ce texte, et il est
  retiré.
- Une famille dessine un nombre fixe d’éléments au plus (dix sur une frise ou un
  graphique en barres, huit dans la plupart des autres) ; le reste n’est pas
  dessiné.
