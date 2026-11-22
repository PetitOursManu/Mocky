---
description: Décrivez une page que le visiteur manipule — une étagère à faire glisser, un produit qui voyage le long de la page, une galerie à parcourir —, apportez vos images, et obtenez-la qui fonctionne dès le premier aperçu.
badge: Nouveau
source_hash: 09d62c7fe63e
---

# Sites interactifs

Certaines pages ne se lisent pas, elles se manipulent. Une étagère de cassettes
qu’on fait glisser pour changer de film. Un produit choisi en haut de page qui
descend avec vous, se retourne pour montrer son dos et se pose sur sa propre
carte dans la boutique. Une galerie qu’on parcourt et dont on ouvre les œuvres.
Mocky peut les construire à partir d’une seule description, avec des
interactions qui fonctionnent dès le premier aperçu.

Rien à activer. Quand votre description parle de faire glisser, d’une étagère ou
d’un carrousel, de découpes dans une planche d’images, d’un curseur
personnalisé, d’un texte qui glisse dans un masque ou d’une vue qui grandit
depuis un élément, la génération reçoit le kit d’interaction. Une page ordinaire
est générée exactement comme avant.

## Apportez vos images

Écrivez les adresses de vos images dans la description, telles quelles. Mocky les
lit avant tout le reste :

- **Les images** sont utilisées à leur adresse exacte. Elles passent avant tout ce
  que Mocky aurait fabriqué : tant que votre description apporte des images, Muse
  n’en crée aucune et Motion Ultra ne fait pas de série.
- **Les planches** — une image qui contient plusieurs jaquettes, emballages ou
  affiches — restent un seul fichier. Donnez la taille de la planche et chaque
  découpe en `x, y, largeur, hauteur`, dans les pixels de la planche : la
  découpe reste juste quelle que soit la taille à laquelle la planche est servie.
- **Une vidéo hébergée ailleurs** ne peut pas être lue dans l’aperçu. Mocky vous
  dit laquelle ; importez-la dans la médiathèque pour l’utiliser.
- **Une bibliothèque hébergée ailleurs** (three.js depuis un CDN, par exemple) ne
  peut pas se charger. La page est construite avec les composants de Mocky, et
  Mocky le signale.

## Ce que la page sait faire

| Vous décrivez | Ce que la page utilise |
|---|---|
| Faire glisser, lancer, défiler ou utiliser les flèches pour parcourir des éléments | Une seule position partagée : à mi-geste, tous les éléments sont à mi-chemin |
| Une découpe dans une planche d’images | La découpe, prise dans la planche, à toute taille |
| Un titre qui change en glissant dans un masque | L’ancien texte sort, le nouveau entre |
| Une fiche qui grandit depuis la carte cliquée, et s’y referme | Mesurée sur la vraie carte, même si vous fermez pendant l’ouverture |
| Une affiche qui apparaît comme de l’encre qui s’étale | Des taches irrégulières qui se rejoignent |
| Une couleur qui s’étend depuis un point | Un cercle adouci qui recouvre l’ancienne couleur |
| Un curseur personnalisé qui change selon ce qu’il survole | Souris et pavé tactile seulement ; au doigt, rien ne change |
| Une boîte vue par sa tranche et sa jaquette, un produit vu de face et de dos | Une boîte en 3D éclairée, qui s’ombre en tournant |
| Un produit qui voyage de section en section et se pose sur sa carte | Un seul objet, jamais deux copies |
| Une galerie ou une salle à parcourir | Une caméra dans un espace 3D ; un clic ouvre l’œuvre réellement touchée |

La 3D est dessinée sans WebGL : elle ne consomme aucun contexte graphique et
fonctionne dans plusieurs aperçus à la fois. Un volume cliquable est aussi un
bouton au clavier.

## Après la génération

Mocky vérifie ce que la description imposait :

- une image nommée par votre description et absente de la page est listée ;
- une découpe qui sort de sa planche est nommée, avec ses coordonnées ;
- une description de gestes à laquelle la page répond sans le kit d’interaction
  est signalée.

Quand l’un de ces contrôles échoue sur une description qui apportait ses images,
Mocky fait **un** passage de correction — jamais plus — et ne le garde que s’il a
corrigé quelque chose sans rien casser. Sinon la première version reste, et les
messages disent ce qui manque encore.

Une retouche garde vos images, vos découpes, vos ancres et vos interactions. Si
une retouche en retire une, Mocky dit laquelle, et **Revenir** restaure la
version précédente.

## Ce que ça coûte

Une page qui utilise le kit coûte ce que coûte une page. Une description qui
apporte ses images économise la génération d’images de Muse et de Motion Ultra.
Le passage de correction, quand il a lieu, est un appel de modèle de plus, rangé
sous « correction du brief » dans l’activité de l’administrateur.

Chaque nouvel écran porte un identifiant de génération ; le compte qui l’a lancée
peut lire sa trace — appels, durées, jetons et prix — à `/api/runs/<id>`.

## Limites

- Les vignettes, captures et exports dessinent la 3D à plat : html2canvas ne rend
  pas la 3D CSS. L’aperçu fait foi.
- Les polices viennent du catalogue de Mocky. Pour les caractères japonais ou
  chinois, il propose Noto Sans JP et Noto Serif SC ([Polices](fonts.md)) ; une
  autre police CJK nommée dans une description est remplacée par l’une d’elles.
- L’export de la page en un seul fichier HTML autonome n’est pas encore
  disponible.
