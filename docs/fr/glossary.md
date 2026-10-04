---
source_hash: c6f986d8ec1b
---

# Glossaire

## Muse {#muse}

L’interrupteur d’intelligence du design. Il transforme une demande en direction artistique singulière, avec de vrais textes, une palette cohérente et de véritables images générées, ancrée dans des références primées consultées en direct par des serveurs MCP locaux.

## Direction de design {#direction}

Le style unique que garde un projet, pour que ses écrans aient l’air d’un produit et non de cinq esquisses. Le premier écran la fixe ; **Nouvelle direction** la réécrit pour les écrans suivants.

## DESIGN.md {#design-md}

Un système de design portable en Markdown ordinaire : jetons de couleur, typographie, espacements, motifs de composants. Mocky le place en tête de chaque génération, et un projet s’y rabat tant qu’il n’a pas de direction à lui.

## Composer {#composer}

La barre flottante en bas du canevas, où l’on décrit un écran. C’est le seul contrôle du produit qui change de verbe selon ce qui est sélectionné.

## Motion Ultra {#motion-ultra}

Un réglage de projet qui storyboarde chaque nouvel écran, génère pour lui une série de ×3 ou ×6 images dans un style commun, et l’écrit comme une page portée par le mouvement. Le même nom désigne les films `.mp4` composés pour un écran.

## Passe de qualité {#quality-pass}

À la demande, Mocky confronte un écran à 59 règles déterministes et à une passe jugée, le note sur 20, et sait corriger ce qu’il a trouvé. Elle ne se lance jamais toute seule.

## Capacité {#capability}

Du code que Mocky injecte dans l’aperçu pour qu’un composant généré puisse utiliser ce qu’il n’a pas écrit lui-même : icônes, graphiques, animations, scènes 3D.

## Invariant {#invariant}

Une règle que le code refuse d’enfreindre, chacune écrite après un bug précis. Cinq séries : I (cœur), M (Muse), Q (qualité), U (Motion Ultra), D (tableau de bord d’administration).

## Type d’écran {#screen-type}

Le genre de la prochaine génération — un tableau de bord, un planning, une page de tarifs — ou le genre de document. Choisi dans le composeur, il donne au modèle la structure qu’attend ce genre d’écran ; vos mots l’emportent toujours. Il reste armé pour les écrans suivants du projet.

## Document {#document}

Un écran fait de pages de taille fixe — un flyer, un rapport, un CV, un post pour les réseaux — plutôt qu’une page mise en page pour une fenêtre. Il se télécharge en PDF à champs remplissables, en `.pptx` aux textes modifiables, ou en images PNG. Voir [Documents et posts pour les réseaux sociaux](documents.md).

## Format de page {#page-format}

La taille des pages d’un document : A4, A3 ou US Letter en portrait ou en paysage, une diapositive 16:9, ou une taille des réseaux sociaux (1:1, 4:5, 9:16, 1,91:1). Il remplace les gabarits Mobile / Ordinateur / Tablette pour un document.

## Câble {#cable}

Un lien entre deux écrans tel que le canevas le dessine : une ligne de l’élément où il a été posé jusqu’à l’écran qu’il ouvre, à la manière d’une carte mentale. Pâle derrière les cadres hors du mode liens ; un contrôle qu’on peut supprimer ou rebrancher dedans.

## MCP {#mcp}

Le Model Context Protocol, qui permet à un modèle d’appeler des outils. Mocky le rencontre deux fois, en sens inverse : Muse **utilise** des serveurs MCP locaux pour lire des sites de référence, et Mocky **en est** un quand un administrateur autorise les assistants à se connecter — Claude ou ChatGPT conçoit alors dans Mocky pour un compte. Voir [Connecter un assistant](mcp.md).
