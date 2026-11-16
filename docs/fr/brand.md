---
description: Vos marques — logo, couleurs, polices, ton, règles et images — gardées une fois dans votre compte et appliquées à un projet d’un bouton ; et n’importe quel écran exporté en image ou en diapositives.
badge: Nouveau
source_hash: cd8696068c13
---

# Mes marques, et exporter un écran

## Mes marques

**Réglages → Mes marques** garde l’identité de chaque marque pour laquelle vous
faites des visuels — votre structure, son restaurant, un client — une fois pour
votre compte. Un onglet par marque, et `Nouvelle marque` à côté ; chacune a :

| Champ | Ce qu’il sert à faire |
|---|---|
| Logo | Posé là où va un logo — l’en-tête ou le pied d’une page, le coin d’un post, l’emplacement logo d’un document. Utilisé **tel quel** : jamais redessiné, recoloré ni recadré. Un PNG ou un WebP à fond transparent marche le mieux. |
| Nom, signature, site web | La marque en toutes lettres quand il n’y a pas de logo, la ligne de signature, l’adresse imprimée sur un flyer. |
| Couleurs | Principale, secondaire, accent, texte, fond — chacune facultative. |
| Polices | Une police de titres et une de texte, prises dans le [catalogue de polices](fonts.md) de Mocky (un nom hors catalogue n’est pas gardé). |
| Ton | Comment parle la marque : « chaleureux, tutoiement, phrases courtes ». |
| Règles | Une par ligne, suivies sur chaque visuel de la marque : « assiette entièrement visible », « aucun visage », « fond sobre et lumineux ». Une demande précise l’emporte toujours sur une règle. |
| Images de la marque | Photos et visuels de la médiathèque qui appartiennent à la marque. Ils sont proposés à chaque nouvel écran fait dans cette marque, pour être utilisés tels quels. |

:::why
On fabrique dans le même compte des écrans pour sa propre entreprise et pour des
clients. Une marque gardée par compte et activée par projet sert les deux :
l’identité se saisit une fois, et rien ne change dans le projet d’un client tant
que vous ne le dites pas.
:::

### L’utiliser dans un projet

Dans un projet, le composeur montre un bouton **Marque** à côté de **Parcours**
dès qu’une marque existe. Avec plusieurs marques, une liste dessous dit
**laquelle** utilise ce projet. Activé, chaque nouvel écran, document et post du
projet — et chaque modification d’un écran existant — reçoit la marque : son
logo par son adresse, ses couleurs, ses polices, son ton, ses règles et ses
images. Quand la direction
artistique du projet dit autre chose sur une couleur ou une police, **la marque
l’emporte**. Muse, quand elle tourne, écrit son dossier autour de la marque
plutôt qu’à côté.

Le réglage appartient au projet et reste avec lui, marque comprise. L’éteindre
arrête d’envoyer la marque aux prochaines générations ; les écrans déjà faits
gardent ce qu’ils ont reçu. Un projet dont vous **supprimez** la marque ne reçoit
plus aucune marque — jamais une autre à sa place — et sa liste le signale tant
que vous n’en choisissez pas une autre.

Depuis un assistant ([MCP](mcp.md)), `use_brand: true` sur `create_design`,
`create_campaign` ou `create_publication` crée le nouveau projet dans votre
marque principale, et `brand: "Chez Elisa30"` dans celle-là. Un nom que Mocky ne
connaît pas est refusé, avec la liste de vos marques.

### Les règles retenues de vos corrections

Une correction faite une fois ne devrait pas avoir à être refaite. Après une
modification — le composeur sur un écran sélectionné, ou les mots tapés dans la
carte de `Modifier` — Mocky propose, en haut du canevas, **Retenir cette
correction pour les prochains écrans ?**, avec vos propres mots prêts à être
raccourcis en règle (« Assiette entièrement visible »). Vous choisissez où elle
va :

- **Pour ce projet** — les règles du projet, dans les options du composeur sous
  **Règles**, où vous pouvez aussi les relire, les changer ou les retirer ;
- **Pour la marque** — quand le projet en utilise une : les règles de la marque,
  dans Réglages → Mes marques, suivies par tous les projets de cette marque.

Chaque règle est envoyée avec chaque nouvel écran et chaque retouche d’un écran
existant (modification, réparation, polissage, correction d’accessibilité,
ajustement à la page), et Muse écrit son dossier avec elles. Une demande précise
l’emporte toujours sur une règle : une règle « aucun visage » ne vous empêche pas
de demander un portrait sur une affiche. `Ne plus proposer` arrête la
proposition dans ce navigateur ; la case de la fenêtre Règles la remet. Aucun
modèle n’est appelé pour formuler la règle : elle est gardée telle que vous la
laissez.

### Où elle est gardée

Les marques voyagent avec les données DESIGN.md de votre compte : elles vous
suivent sur chaque appareil où vous vous connectez. La marque unique des
versions précédentes devient la première de la liste, et les projets qui
l’utilisaient la gardent. Le logo et les images de la marque sont des images de
la bibliothèque comme n’importe quel import : en retirer une d’une marque ne la
supprime pas de la bibliothèque, où des écrans l’affichent peut-être déjà. Un
compte garde jusqu’à 12 marques, chacune avec jusqu’à 24 images.

## Exporter un écran en image ou en diapositives

Les documents ont toujours eu le PNG et le PowerPoint. Un écran ordinaire — une
page de site ou d’application — les a maintenant aussi, dans son menu du clic
droit :

- **Exporter en image PNG (page entière)** — toute la page, de haut en bas, en
  une image à 1,5× sa taille.
- **Exporter en PowerPoint** — la page découpée en diapositives au format d’une
  présentation : 16:9 pour un écran large, 9:16 pour un téléphone. Le texte reste
  du texte, modifiable dans PowerPoint, Keynote ou Google Slides.

:::why
Une page entière est mise en page pour une fenêtre. Agrandie à la hauteur de son
contenu, un hero écrit « plein écran » grandirait avec elle, et l’image d’un
hero de 900 pixels revenait haute de plusieurs milliers. La page est donc d’abord
mise en page à la hauteur de l’écran, tout ce qui se règle sur cette hauteur est
tenu à la taille que vous voyez, et alors seulement la page est dessinée entière.
:::

Une diapositive ne coupe jamais un bloc de texte quand elle peut commencer à son
sommet : un titre apparaît entier sur la diapositive suivante plutôt qu’à moitié
sur deux. Une page de plus de 20 000 pixels est coupée à cette hauteur.
