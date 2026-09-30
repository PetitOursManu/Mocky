---
description: Flyers, rapports, CV et posts pour les réseaux — des pages fixes que l’on télécharge en PDF, en présentation ou en images.
badge: Nouveau
source_hash: a53e43464795
---

# Documents et posts pour les réseaux sociaux

L’essentiel de ce que fabrique Mocky est un **écran** : une page d’application
ou de site, mise en page pour une fenêtre et faite pour être cliquée. Un
**document** est l’autre sorte de chose qu’il sait faire — un flyer, un rapport,
un CV, un carrousel Instagram — et ce n’est pas un écran à une autre largeur.
C’est une pile de pages de **taille fixe**, composées une par une comme une
feuille dans un logiciel de mise en page, et il sort de Mocky sous forme de
fichier : un PDF, une présentation PowerPoint ou des images.

Cette page décrit ce qui change quand ce que vous fabriquez est un document, et
les trois choses qu’on ne peut faire qu’avec lui : le télécharger, l’ajuster à
sa page, et le voir tenu en main ou publié dans un fil.

:::why
Un document construit comme une page web échoue d’une manière que personne ne
voit avant l’impression : un « flyer » mis en page sur 1 440 px de large est une
page d’accueil avec le mot flyer dans son titre, et un rapport qui défile n’a
aucun saut de page à mettre dans un PDF. Fixer d’abord la taille de la page est
ce qui met trois choses d’accord — ce que montre le canevas, ce que contient le
fichier, et l’endroit où un champ à remplir y tombe.
:::

---

## En faire un

:::steps id=make-document
1. **Choisissez un type.** Dans le composeur, ouvrez `Type d’écran` et prenez-en
   un dans `Documents à imprimer ou exporter` ou dans `Réseaux sociaux`.
2. **Vérifiez le format.** Les puces `Mobile` / `Ordinateur` / `Tablette` sont
   remplacées par des formats de page, celui du type étant sélectionné. Prenez-en
   un autre si besoin.
3. **Choisissez l’image.** Un document propose `Image` : `Sans image` (formes et
   couleurs seulement), `Générée` (une image par le modèle d’image) ou `Photo
   libre` (une vraie photo Pexels ou Pixabay, quand l’instance a une clé).
4. **Décrivez-le et générez.** Un champ vide reçoit un exemple pour le type ; vos
   propres mots ne sont jamais remplacés.
:::

:::hotspots src=../assets/ui/fr/types.webp alt="Le menu Type d’écran : documents, réseaux sociaux et écrans"
- 50,5.2 **Ce que fait un type**: Il donne au modèle la structure de ce genre d’écran. Vos mots passent d’abord, et le style reste celui de votre direction.
- 25.7,31.8 **Documents à imprimer ou exporter**: Flyer, affiche, rapport, documentation, CV, facture ou devis, certificat, menu — des pages fixes. Voir [Documents](documents.md).
- 25.7,89.7 **Réseaux sociaux**: Des posts Instagram, Facebook et LinkedIn, aux tailles des plateformes.
- 25.7,119.7 **Écrans**: Tableau de bord, planning, kanban, tableau, page d’accueil, tarifs, produit, paiement, connexion, onboarding, paramètres, messagerie, réservation, article, portfolio.
:::

Le type reste armé après la génération, et un projet s’ouvre sur le type et le
format de son dernier écran : la demande suivante dans un projet de flyers est
aussi un flyer, pas une page web. La croix à côté de la puce (`Retirer le type
d’écran`) ramène aux écrans, et ce choix est retenu de la même façon.

Un document saute ce qui n’a de sens que pour un écran : le planificateur, Motion
Ultra, la vidéo au défilement et toute animation — une page s’imprime au repos.
Muse et la direction du projet s’appliquent toujours, pour qu’un flyer ressemble
au reste du projet.

---

## Les types

Chaque type donne au modèle la structure de ce genre de pièce. Vos mots
l’emportent en cas de conflit, et le style reste celui de votre direction.

| Type | Démarre en | Ce qu’il demande |
|---|---|---|
| `Flyer` | A4 | Une page frappante : un titre énorme, les infos clés (date, lieu, prix) en bloc à part, des points forts, un appel à l’action imprimé en toutes lettres à côté d’un emplacement de QR code, des formes colorées qui débordent des bords. Un coupon détachable fait de champs seulement quand la demande est une inscription. |
| `Affiche` | A3 | Une page lue à trois mètres : un seul élément dominant, les infos essentielles en un bloc, aucun texte courant. |
| `Rapport` | A4 | Une couverture, un sommaire, une synthèse de chiffres clés, des pages de corps aux sections numérotées, des graphiques et un tableau, des en-têtes courants et des numéros de page. Des chiffres cohérents d’une page à l’autre. |
| `Documentation` | A4 | Une page de titre avec une version, une table des matières, des sections numérotées, des procédures en étapes numérotées, des encadrés note / astuce / attention, un tableau de référence. |
| `CV` | A4 | Une page en deux colonnes : profil, expériences et réalisations, formation, compétences, langues. Sobre et lisible. |
| `Facture / devis` | A4 | L’émetteur, le client, un tableau de lignes avec TVA, des totaux qui tombent juste, les conditions de paiement. Un devis reçoit un bloc « bon pour accord » fait de champs à remplir. |
| `Certificat` | A4 paysage | Un cadre décoratif, le nom du lauréat comme texte le plus visible, des signatures et un sceau. Le nom et la date deviennent des champs quand vous demandez un modèle vierge. |
| `Menu` | A4 | Entrées, plats, desserts et boissons, prix alignés, pictogrammes de régime avec une légende, une formule mise en valeur. |
| `Post Instagram` | 4:5 | Une grande idée par image ; un carrousel quand il y a plus à dire (la première image accroche, la dernière appelle à l’action). |
| `Post Facebook` | 1,91:1 | Le visuel d’une annonce ou d’un événement, peu de texte — le texte du post porte le détail. |
| `Post LinkedIn` | 1:1 | Une idée ou un résultat professionnel ; un carrousel exporté en PDF est le post document de LinkedIn. |

---

## Les formats de page

Les puces de format ne montrent que les formats de la famille du type : papier et
diapositives pour un document, tailles des réseaux pour un post. Un post mis en
page pour un téléphone n’est pas la même pièce en A4, donc le composeur ne propose
jamais le saut — et un format choisi pour un rapport ne vous suit pas jusqu’au
post Instagram tapé ensuite.

| Famille | Format | Taille de la page |
|---|---|---|
| Papier | `A4` · `A4 paysage` | 794 × 1 123 px (210 × 297 mm), et tournée |
| Papier | `A3` | 1 123 × 1 587 px (297 × 420 mm) |
| Papier | `US Letter` · `US paysage` | 816 × 1 056 px (8,5 × 11 in), et tournée |
| Papier | `Présentation 16:9` | 1 280 × 720 px — le « Grand écran » de PowerPoint et Google Slides |
| Réseaux | `Carré 1:1` | 1 080 × 1 080 px |
| Réseaux | `Portrait 4:5` | 1 080 × 1 350 px, le plus haut qu’un fil affiche en entier |
| Réseaux | `Story 9:16` | 1 080 × 1 920 px |
| Réseaux | `Paysage 1,91:1` | 1 200 × 628 px, lien partagé, Facebook, LinkedIn |

Les tailles papier sont en pixels CSS à 96 par pouce, qui correspondent
exactement aux points PDF : une page s’exporte à sa vraie taille de papier. Les
tailles des réseaux sont les pixels des plateformes : l’image exportée est le
fichier qu’elles demandent, tel quel.

Le modèle connaît les marges à laisser libres : 40 px sur papier, au-delà de ce
qu’une imprimante de bureau n’atteint pas ; 64 px sur un post ; et sur une story,
les bandes du haut et du bas où l’application dessine ses propres barres.

---

## Les champs

Un blanc que quelqu’un remplit — un nom, une date, une case à cocher, un choix —
est un **champ**, pas une ligne dessinée. Sur le canevas il ressemble au reste du
dessin ; dans le PDF exporté il devient un vrai champ de formulaire, remplissable
dans n’importe quel lecteur PDF. Deux champs de même nom sur un recto-verso sont
renommés pour que chacun garde sa propre valeur.

Les types pour les réseaux n’en demandent aucun : personne ne remplit un post
Instagram.

---

## Télécharger

Le cadre d’un document porte une pastille `Télécharger`, et le menu contextuel de
l’écran une entrée `Télécharger…`. Les deux ouvrent `Télécharger le document`, avec
trois boutons :

:::hotspots src=../assets/ui/fr/download.webp alt="Télécharger le document : PDF, PowerPoint / Google Slides, images PNG"
- 50,22 **Le format**: Le format de page du document. Le fichier se télécharge directement — sans fenêtre d’impression.
- 50,38.9 **PDF**: Pour imprimer ou envoyer. Le texte reste sélectionnable ; chaque champ devient un vrai champ de formulaire.
- 50,50 **PowerPoint / Google Slides**: Pour continuer à modifier : le dessin en image, chaque texte en zone modifiable. Ouvrez-le dans Google Slides depuis Drive.
- 50,82.1 **Images PNG**: Pour publier : une image par page, dans un `.zip` s’il y en a plusieurs. Un post sort à ses pixels exacts.
:::

| Bouton | Ce que vous obtenez | Pour |
|---|---|---|
| `PDF` / `PDF — champs à remplir` | Les pages telles que dessinées — en résolution d’impression pour le papier, à ses propres pixels pour un post — avec le texte toujours sélectionnable et chaque champ remplissable. | Imprimer, envoyer. |
| `PowerPoint / Google Slides (.pptx) — textes modifiables` | Une diapositive par page : le dessin en image, et chaque texte en zone de texte modifiable par-dessus. Déposez-le sur Google Drive et choisissez « Ouvrir avec Google Slides ». | Continuer à modifier. |
| `Images PNG` | Une image par page, dans un `.zip` quand il y en a plusieurs. Un post sort exactement aux pixels de son format. | Publier. |

Le fichier est fabriqué dans votre navigateur, page par page, et se télécharge
tout seul. Un lien `Enregistrer « {file} »` reste dans la fenêtre, parce qu’un
navigateur peut bloquer un deuxième téléchargement automatique depuis la même page.

Quand quelque chose n’a pas pu être exporté parfaitement, la fenêtre le dit sous
le lien plutôt que de le cacher : du contenu coupé au bord de la page, un texte
tourné laissé dans l’image d’une diapositive, une page dessinée par le moteur de
secours, une image ou une police qui n’a pas pu être intégrée.

---

## Quand le contenu dépasse de la page

Une page a une seule taille, et le modèle l’écrit sans la voir rendue : il peut
deviner une hauteur, et la deviner trop longue. Quand un texte ou un champ finit
au-delà du bord d’une page, Mocky le dit — une notice nomme le document et la page
— parce que sur papier ce contenu est tout simplement coupé.

:::hotspots src=../assets/ui/fr/docmenu.webp alt="Le menu contextuel d’un document"
- 50,5.8 **Télécharger…**: Un document seulement : PDF à champs remplissables, PowerPoint / Google Slides, ou images PNG.
- 50,12.5 **Ajuster à la page**: Un document seulement : quand le contenu dépasse d’une page, le mesure et demande au modèle de regagner la place. Gardé seulement s’il tient mieux.
- 50,19.2 **Régénérer**: La même demande à nouveau, pour un autre design.
- 50,25.8 **Peaufiner**: Confronte le design à des règles nommées et corrige ce qu’il trouve.
- 50,39.1 **Notes**: Des notes privées sur cet écran, jamais envoyées à un modèle.
- 50,52.5 **Partager**: Un lien public temporaire et un QR code.
- 50,94.2 **Supprimer l’écran**: Une confirmation, et il disparaît.
:::

**Clic droit sur le document → `Ajuster à la page`** demande au modèle de regagner
la place. Ce n’est ni une modification ni un polissage :

1. Le document est rendu hors écran et mesuré comme l’export le lit : combien de
   pixels au-delà de quel bord, et quels mots sont dehors.
2. Le modèle reçoit ces chiffres et une consigne stricte — resserrer les
   espacements, puis les images, puis les titres trop grands ; garder chaque
   section, le texte, la palette et le nombre de pages.
3. La réponse est rendue et mesurée à nouveau **avant** que rien ne soit écrit.

| Résultat | Ce qui se passe |
|---|---|
| Tout tient | La nouvelle version remplace l’ancienne. `Revenir à la version précédente` l’annule. |
| Plus près, mais encore au-delà | La nouvelle version est gardée, et la notice donne ce qui reste, en pixels. Vous pouvez l’ajuster à nouveau. |
| Pas mieux, pire, ou un autre nombre de pages | Rien ne change, et la notice le dit. |

Un appel au modèle par clic, jamais relancé tout seul. Ajouter une page fait un
autre document, donc c’est à vous de le demander, dans le composeur.

:::quiz
Vous lancez `Ajuster à la page`, et la réponse du modèle ne tient qu’en ajoutant une deuxième page. Que fait Mocky ?
- Il garde la version à deux pages, puisque tout tient désormais
- [x] Il garde l’original, et dit que l’ajustement n’a pas marché
- Il vous demande laquelle garder
> Un autre nombre de pages fait un autre document : la réponse est refusée, aussi bien tienne-t-elle. Demandez une deuxième page dans le composeur si c’est ce que vous voulez.
:::

---

## Les posts pour les réseaux sociaux

Un post est une image ou un **carrousel** de plusieurs : chaque `<Page>` est une
image, balayée une à une, et chacune doit tenir seule. Le téléchargement `Images
PNG` les donne numérotées, à la taille de la plateforme ; pour LinkedIn, le
téléchargement PDF est un post document tout prêt.

Une story fait 9:16, et le modèle garde le texte hors des bandes que l’application
couvre en haut (progression, nom) et en bas (champ de réponse).

---

## En mode démo

Avec `Appareil` activé, la démo montre un document comme il sera vu :

- **Un document imprimé** est tenu dans une main, dessinée du même trait que les
  cadres d’appareil, une page à la fois avec un sélecteur de page dessous.
- **Un post** s’affiche sur un téléphone, dans son fil : une ligne d’auteur,
  l’image sur toute la largeur de l’écran, les actions et la légende — sous
  l’image sur Instagram, au-dessus sur Facebook et LinkedIn — et le post suivant
  qui commence. Un carrousel montre son compteur et ses points ; les flèches sous
  le téléphone tournent les pages.
- **Une story** remplit l’écran du téléphone, avec ses segments de progression et
  le champ de réponse.
- **Une présentation** n’a pas de cadre : elle se projette, elle ne se tient pas.

Un flyer, tenu :

:::hotspots src=../assets/ui/fr/demo-hand.webp alt="Le mode démo : un flyer tenu dans une main"
- 29.7,3.1 **Appareil**: Activé pour un document imprimé : il est tenu dans une main, du même trait que les appareils.
- 17.4,26 **La page**: Le vrai document, une page à la fois ; un sélecteur de page apparaît dessous s’il y en a plusieurs.
- 66.1,82 **La main**: Seul le pouce se pose sur la feuille, le long du bord ; le reste de la page reste cliquable.
- 50,95.3 **Légende**: Le format de page.
:::

Un carrousel, dans son fil :

:::hotspots src=../assets/ui/fr/demo-phone.webp alt="Le mode démo : un carrousel Instagram sur un téléphone, dans son fil"
- 10.7,12.4 **Ligne d’auteur**: Le fil dessiné autour du post : générique, à l’encre du téléphone — ni logo, ni interface copiée.
- 17.4,24.9 **Le post**: Sur toute la largeur de l’écran, là où la plateforme le place.
- 27.1,16.2 **Compteur du carrousel**: La page affichée et la longueur du carrousel.
- 8,38.4 **Actions et légende**: Sous l’image sur Instagram ; au-dessus sur Facebook et LinkedIn.
- 50,94.7 **Pages**: Tourne les pages du carrousel. Une story, elle, remplit l’écran.
:::

L’application dessinée est volontairement générique — aucun logo, aucune
interface copiée. Elle dit où l’image vivra et laisse l’œil sur l’image.
