---
description: Quand Mocky n’a pas le cadre, l’animation, la transition ou l’élément demandé, le modèle peut le créer. Chaque création est contrôlée avant d’être gardée.
badge: Nouveau
source_hash: b55f6fedaa87
---

# Créations

Les cadres, les animations et les composants de Mocky sont des catalogues écrits
à la main et testés une fois. Il arrive que ce que vous demandez n’y soit pas.
Avec **Créations** activé, le modèle peut fabriquer la pièce manquante, et vos
prochains écrans peuvent la réutiliser.

Cela s’active par projet, dans le composeur, parmi les aides à la génération. Cela
ajoute un appel au modèle par nouvel écran, et une relecture par création. La
plupart des écrans n’ont besoin de rien et ne créent rien.

## Ce qui peut être créé

| Type | Ce que le modèle écrit | Ce qui l’entoure |
|---|---|---|
| Cadre | Un tracé SVG | Le composant de Mocky, sous forme de masque |
| Animation | Des étapes, sous forme de données | Le composant de Mocky |
| Transition | Deux états, sous forme de données | Le composant de Mocky |
| Élément | Un composant React | Rien : c’est le seul type qui soit du code |

Les films ne sont pas concernés. Un film Motion Ultra se calcule sur le serveur,
et du code écrit par un modèle n’y est pas exécuté.

## Ce qui se passe avant d’en garder une

1. **Des règles, sans aucun modèle.** Un tracé ne peut contenir que des commandes
   de tracé, une valeur CSS ne peut ni contenir une adresse ni fermer sa règle. Un
   élément est lu par un analyseur et refusé s’il touche à quoi que ce soit hors
   d’une courte liste autorisée : ni réseau, ni cookies ou stockage, ni `eval`,
   ni accès à la page qui l’entoure.
2. **Un vrai rendu**, dans le même bac à sable qu’un aperçu. Il doit se monter sans
   erreur.
3. **Une relecture indépendante.** Un appel au modèle à part, sans rien de votre
   conversation ni de votre demande : seulement le code, débarrassé de ses
   commentaires, et la question de savoir s’il est malveillant ou défaillant.

Une création qui échoue à l’une de ces étapes est écartée, et l’écran est généré
sans elle. Une relecture en erreur, ou dont la réponse est illisible, vaut refus.

## Ce contre quoi cela protège, et ce contre quoi non

La protection, c’est le bac à sable de l’aperçu : le code généré ne peut ni lire
votre compte ni atteindre le réseau, qu’il ait été relu ou non. Les contrôles
ci-dessus sont une seconde couche, et ni des règles ni un modèle ne peuvent
prouver qu’un code est inoffensif.

Vos créations n’appartiennent qu’à vous : aucun autre compte de l’instance ne les
voit.

## Les retrouver

**Média → Créations** liste ce qui a été gardé, avec un aperçu, le code et l’avis
de la relecture. En supprimer une ne change pas les écrans qui l’utilisent déjà :
chaque écran garde sa propre copie.
