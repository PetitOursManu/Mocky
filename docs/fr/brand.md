---
description: Votre logo, vos couleurs, vos polices et votre ton gardés une fois dans votre compte et appliqués à un projet d’un bouton — et n’importe quel écran exporté en image ou en diapositives.
badge: Nouveau
source_hash: 72ee5f5037f5
---

# Ma marque, et exporter un écran

## Ma marque

**Réglages → Ma marque** garde l’identité de votre entreprise une fois pour votre
compte :

| Champ | Ce qu’il sert à faire |
|---|---|
| Logo | Posé là où va un logo — l’en-tête ou le pied d’une page, le coin d’un post, l’emplacement logo d’un document. Utilisé **tel quel** : jamais redessiné, recoloré ni recadré. Un PNG ou un WebP à fond transparent marche le mieux. |
| Nom, signature, site web | La marque en toutes lettres quand il n’y a pas de logo, la ligne de signature, l’adresse imprimée sur un flyer. |
| Couleurs | Principale, secondaire, accent, texte, fond — chacune facultative. |
| Polices | Une police de titres et une de texte, prises dans le [catalogue de polices](fonts.md) de Mocky (un nom hors catalogue n’est pas gardé). |
| Ton | Comment parle la marque : « chaleureux, tutoiement, phrases courtes ». |

:::why
On fabrique dans le même compte des écrans pour sa propre entreprise et pour des
clients. Une marque gardée par compte et activée par projet sert les deux :
l’identité se saisit une fois, et rien ne change dans le projet d’un client tant
que vous ne le dites pas.
:::

### L’utiliser dans un projet

Dans un projet, le composeur montre un bouton **Marque** à côté de **Parcours**
dès qu’une marque existe. Activé, chaque nouvel écran, document et post du
projet — et chaque modification d’un écran existant — reçoit la marque : son
logo par son adresse, ses couleurs, ses polices, son ton. Quand la direction
artistique du projet dit autre chose sur une couleur ou une police, **la marque
l’emporte**. Muse, quand elle tourne, écrit son dossier autour de la marque
plutôt qu’à côté.

Le réglage appartient au projet et reste avec lui. L’éteindre arrête d’envoyer
la marque aux prochaines générations ; les écrans déjà faits gardent ce qu’ils
ont reçu.

Depuis un assistant ([MCP](mcp.md)), `use_brand: true` sur `create_design`,
`create_campaign` ou `create_publication` crée le nouveau projet dans votre
marque.

### Où elle est gardée

La marque voyage avec les données DESIGN.md de votre compte : elle vous suit sur
chaque appareil où vous vous connectez. Le logo est une image de la
bibliothèque comme n’importe quel import : le retirer de la marque ne le
supprime pas de la bibliothèque, où des écrans l’affichent peut-être déjà.

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
