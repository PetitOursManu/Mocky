---
description: Collez un texte, obtenez-en le schéma — étapes, cycle, frise, comparaison, chiffres clés ou graphique — dans le style du projet, modifiable et exportable.
badge: Nouveau
source_hash: f50a09d5d3e8
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
| Liste à cocher | Des choses à faire ou à avoir |
| Venn | Deux ou trois ensembles et ce qu’ils partagent |
| SWOT | Forces, faiblesses, opportunités, menaces |
| Avant / après | Un changement d’un état à l’autre |
| Arbre | Une hiérarchie qui se ramifie (organigramme, décomposition) |
| Oignon | Des couches autour d’un cœur |

## Illustrer un texte long

:::why
Un article ou une section de rapport contient plusieurs idées, et un seul schéma
ne peut pas toutes les dire. Le couper là où l’auteur l’a déjà coupé — aux
paragraphes — ne demande aucun modèle, et chaque morceau reçoit le visuel qui lui
convient.
:::

**Illustrer** dans la barre d’outils du canevas (ou **Illustrer un texte** sous
*Créer aussi*) ouvre un panneau. Collez le texte ou importez un fichier `.txt`,
`.md` ou `.docx` : il est lu dans votre navigateur, rien n’est envoyé. Le texte
est découpé en blocs :

- un paragraphe est un bloc, et un titre (`# …` en Markdown, un style Titre dans
  Word) nomme les blocs qui le suivent au lieu d’en être un ;
- une liste reste avec la phrase qui l’annonce (« Trois engagements : ») ;
- un fragment de quelques mots rejoint le bloc précédent.

Chaque bloc a **Faire le visuel** ; **Illustrer tout** fait ceux qui manquent,
dans l’ordre, à la taille choisie. Chaque visuel est un écran du projet comme les
autres. Un bloc déjà illustré propose **Voir** : l’écran retient les mots dont il
est issu, donc ajouter un paragraphe au-dessus ne mélange rien. Le texte est
gardé avec le projet.

## Des visuels dans les autres écrans

Un rapport, un guide utilisateur, un article et les posts Instagram, LinkedIn et
Facebook peuvent aussi dessiner un visuel pour la partie de leur contenu qui est
un processus, une comparaison ou quelques chiffres clés. Rien à activer : la
génération dispose des mêmes familles et décide. **Visuel…** fonctionne aussi sur
ces écrans.

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

Pour changer les mots, retouchez l’écran comme d’habitude : une phrase dans le
composeur (« ajoute une étape après les tests », « passe-le en frise ») réécrit le
contenu comme toute retouche, ou **Remplir…** change une valeur sans modèle.

## Les chiffres

:::why
Un visuel a l’air d’un fait. Un chiffre plausible que le texte n’a jamais donné —
un graphique d’un texte qui n’avait pas de nombres — y est pire que dans un
paragraphe.
:::

Un visuel ne montre que les chiffres de votre texte. Après la génération d’un
écran **Visuel**, chaque
chiffre du visuel est cherché dans votre texte, sous les formes qu’on lui donne
en écrivant (1 200 et 1,2 k, 12 % et 0,12). Celui qu’on ne trouve pas est retiré
du visuel, son élément gardé, et un avis le nomme. Les chiffres écrits en lettres
(« douze ») ne sont pas reconnus : écrivez-les en chiffres.

Cette vérification ne tourne ni sur un rapport ou un post qui dessine un visuel,
ni après une retouche : ces pages doivent inventer des chiffres d’exemple
réalistes quand vous n’en donnez pas, et vider leurs graphiques serait la
mauvaise réponse.

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
