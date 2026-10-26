---
description: Flyers, rapports, CV et posts pour les réseaux — des pages fixes que l’on télécharge en PDF, en présentation ou en images.
badge: Nouveau
source_hash: 11315c564bed
---

# Documents et posts pour les réseaux sociaux

L’essentiel de ce que fabrique Mocky est un **écran** : une page d’application
ou de site, mise en page pour une fenêtre et faite pour être cliquée. Un
**document** est l’autre sorte de chose qu’il sait faire — un flyer, un rapport,
un CV, un carrousel Instagram — et ce n’est pas un écran à une autre largeur.
C’est une pile de pages de **taille fixe**, composées une par une comme une
feuille dans un logiciel de mise en page, et il sort de Mocky sous forme de
fichier : un PDF, une présentation PowerPoint, des images, ou un PSD ou un SVG en calques.

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
- 50,3.6 **Ce que fait un type**: Il donne au modèle la structure de ce genre d’écran. Vos mots passent d’abord, et le style reste celui de votre direction.
- 50,19.1 **Documents à imprimer ou exporter**: Flyer, affiche, rapport, documentation, CV, facture ou devis, certificat, menu — des pages fixes. Voir [Documents](documents.md).
- 50,98 **Réseaux sociaux**: Des posts Instagram, Facebook et LinkedIn, aux tailles des plateformes.
- 50,130.4 **Écrans**: Tableau de bord, planning, kanban, tableau, page d’accueil, tarifs, produit, paiement, connexion, onboarding, paramètres, messagerie, réservation, article, portfolio.
:::

Le type reste armé après la génération, et un projet s’ouvre sur le type et le
format de son dernier écran : la demande suivante dans un projet de flyers est
aussi un flyer, pas une page web. La croix à côté de la puce (`Retirer le type
d’écran`) ramène aux écrans, et ce choix est retenu de la même façon.

Un document saute ce qui n’a de sens que pour un écran : le planificateur, Motion
Ultra, la vidéo au défilement et toute animation — une page s’imprime au repos.
Muse et la direction du projet s’appliquent toujours, pour qu’un flyer ressemble
au reste du projet.

La même annonce dans plusieurs formats à la fois — une affiche, un flyer, un
post, une story — est une **campagne** : un seul brief, chaque format composé pour
lui-même, les infos et les images partagées. Voir [Campagne](campaign.md).

---

## Les types

Chaque type donne au modèle la structure de ce genre de pièce. Vos mots
l’emportent en cas de conflit, et le style reste celui de votre direction.

| Type | Démarre en | Ce qu’il demande |
|---|---|---|
| `Flyer` | A4 (A6 à A3, DL, carré) | À plat ou [plié](#flyers-tailles-et-plis). Une page frappante : un titre énorme, les infos clés (date, lieu, prix) en bloc à part, des points forts, un appel à l’action imprimé en toutes lettres à côté d’un emplacement de QR code, des formes colorées qui débordent des bords. Un coupon détachable fait de champs seulement quand la demande est une inscription. |
| `Affiche` | A3 | Une page lue à trois mètres : un seul élément dominant, les infos essentielles en un bloc, aucun texte courant. |
| `Rapport` | A4 | Une couverture, un sommaire, une synthèse de chiffres clés, des pages de corps aux sections numérotées, des graphiques et un tableau, des en-têtes courants et des numéros de page. Des chiffres cohérents d’une page à l’autre. |
| `Documentation` | A4 | Une page de titre avec une version, une table des matières, des sections numérotées, des procédures en étapes numérotées, des encadrés note / astuce / attention, un tableau de référence. |
| `CV` | A4 | Une page en deux colonnes : profil, expériences et réalisations, formation, compétences, langues. Sobre et lisible. |
| `Facture / devis` | A4 | L’émetteur, le client, un tableau de lignes avec TVA, des totaux qui tombent juste, les conditions de paiement. Un devis reçoit un bloc « bon pour accord » fait de champs à remplir. |
| `Certificat` | A4 paysage | Un cadre décoratif, le nom du lauréat comme texte le plus visible, des signatures et un sceau. Le nom et la date deviennent des champs quand vous demandez un modèle vierge. |
| `Menu` | A4 (A5 à A3, DL) | À plat ou [plié](#flyers-tailles-et-plis). Entrées, plats, desserts et boissons, prix alignés, pictogrammes de régime avec une légende, une formule mise en valeur. |
| `Magazine` | A4 (A5, Letter) | Une [publication](#magazines-et-livres) : première de couverture, deux pages intérieures, quatrième — puis des pages ajoutées une à une. Hiérarchie éditoriale, colonnes, citations en exergue, folios et titres courants. |
| `Livre` | A5 (A6, A4, Letter) | Une [publication](#magazines-et-livres) : première de couverture, deux pages intérieures, quatrième — puis des pages ajoutées une à une. Composition de livre, titres courants, folios pairs à gauche. |
| `Post Instagram` | 4:5 | Une grande idée par image ; un carrousel quand il y a plus à dire (la première image accroche, la dernière appelle à l’action). |
| `Post Facebook` | 1,91:1 | Le visuel d’une annonce ou d’un événement, peu de texte — le texte du post porte le détail. |
| `Post LinkedIn` | 1:1 | Une idée ou un résultat professionnel ; un carrousel exporté en PDF est le post document de LinkedIn. |

---

## Les formats de page

Les puces de format ne montrent que les formats de la famille du type : papier et
diapositives pour un document, tailles des réseaux pour un post — et un type qui a
ses propres tailles montre celles-là : un flyer se propose en A6, A5, A4, A3, DL,
carré de 21 cm et US Letter ; une affiche de l’A4 à l’A2. Un post mis en
page pour un téléphone n’est pas la même pièce en A4, donc le composeur ne propose
jamais le saut — et un format choisi pour un rapport ne vous suit pas jusqu’au
post Instagram tapé ensuite.

| Famille | Format | Taille de la page |
|---|---|---|
| Papier | `A4` · `A4 paysage` | 794 × 1 123 px (210 × 297 mm), et tournée |
| Papier | `A3` · `A3 paysage` | 1 123 × 1 587 px (297 × 420 mm), et tournée |
| Papier | `A2` | 1 587 × 2 245 px (420 × 594 mm), une affiche de vitrine |
| Papier | `A5` · `A5 paysage` | 559 × 794 px (148 × 210 mm), et tournée |
| Papier | `A6` | 397 × 559 px (105 × 148 mm), format carte postale |
| Papier | `DL` | 374 × 794 px (99 × 210 mm), le tiers d’A4 des présentoirs |
| Papier | `Carré 21` | 794 × 794 px (210 × 210 mm) |
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

## Flyers : tailles et plis

Un flyer (ou un menu) se choisit par deux choses dans le composeur : sa
**taille** — les puces — et son **pli**, le menu `Pli` à côté. `Feuille simple`
est une page unique, comme avant. Les plis :

| Pli | Volets | Proposé en |
|---|---|---|
| `Dépliant 2 volets` | 2 par face, plié en deux comme une carte | A5, A4, A3, Letter |
| `3 volets roulé` | 3 par face ; le volet qui rentre est 3 mm plus étroit | A4, A3, Letter |
| `3 volets accordéon` | 3 par face, en Z | A4, A3, Letter |
| `Pli fenêtre` | 2 volets qui se referment comme des portes sur un panneau central double | A4, A3, Letter |
| `4 volets accordéon` | 4 par face | A4, A3 |

La taille est celle de la **feuille à plat** : un A4 plié en trois est une
feuille A4 paysage de trois volets DL, imprimée recto-verso. Un dépliant a donc
toujours deux pages — la face extérieure et la face intérieure — et chaque page
est une rangée de volets, dessinés par le kit de page à leur largeur exacte,
avec les lignes de pli en pointillés sur le canevas (jamais dans un export).

:::why
Le volet qui finit en couverture est une affaire de géométrie, pas d’ordre de
lecture. Sur un pli roulé, la couverture est le volet de DROITE de la face
extérieure ; sur un pli fenêtre, elle est coupée en deux aux deux bouts, sa
moitié droite imprimée à gauche. Un modèle à qui l’on demande « un trois
volets » met la face extérieure en ordre de lecture — la couverture d’abord, à
gauche — et la feuille qui revient de l’imprimeur se plie avec son dos devant.
Mocky calcule donc l’ordre une fois (`lib/folds.ts`) et dit au modèle quel
emplacement est lequel, avec sa largeur.
:::

Des mots qui passent sur un pli sont signalés comme des mots qui dépassent de la
page, et **Ajuster à la page** les rattrape de la même façon. Le PDF contient
les deux faces à la taille de la feuille : le fichier qu’un imprimeur demande.

---

## Plusieurs pages à la suite : le Parcours

Le bouton `Parcours` du composeur concerne des écrans qui s’ouvrent les uns les
autres dans un prototype — et, sur un document, les **pages qui se suivent** :

- un **flyer ou un menu** reçoit un **recto et un verso** : le recto arrête le
  regard, le verso porte le détail, les infos pratiques et le coupon ;
- un **post** devient un **carrousel** — cinq images, sauf si votre demande en
  nomme un autre nombre : l’accroche, une idée par image, l’appel à l’action,
  avec un compteur de pages et la même signature sur chacune ;
- une **story** devient une suite de stories.

Un dépliant a déjà ses deux faces, une affiche n’a pas de dos, un rapport compte
plusieurs pages par son propre brief : là, le bouton ne change rien. Éteint, rien
n’est ajouté au prompt (invariant V7).

---

## Magazines et livres

`Magazine` et `Livre` ne sont pas un écran mais une **publication** : des
feuilles qui partagent **une direction artistique à elles**. Elle commence
petite — **quatre pages** :

1. Mocky planifie ce qu’elles disent (un appel au modèle) : la **première de
   couverture**, **deux pages intérieures** (un édito et l’ouverture d’un
   reportage pour un magazine, une page de titre et la première page d’un
   chapitre pour un livre), la **quatrième de couverture**.
2. La **première de couverture** lance Muse sur la demande de la publication ;
   son dossier devient la direction de la publication.
3. **Les trois autres** sont générées sous cette direction, Muse éteinte — même
   typographie, même palette, même grille, même folio et même titre courant.

Ensuite, vous la faites grandir **une page à la fois** : générez à nouveau avec
le même type (`Magazine` ou `Livre`) dans le même projet, en décrivant la page
voulue — elle s’ajoute comme page intérieure **avant la quatrième de
couverture**, sous la même direction, avec son numéro de page et tout le
sommaire.

:::why
Un seul composant de quarante pages mises en forme, c’est un appel qui manque de
jetons à la page onze et fait régénérer tout le numéro pour une double page
ratée. Une page est une partie qu’un modèle écrit bien d’un coup, et refait
seule — et quatre suffisent pour juger une allure avant de payer le reste. Et la direction est celle de la publication, pas du projet : le numéro
d’un magazine et le flyer de sa soirée de lancement vivent dans le même projet
sans que l’un change l’allure de l’autre.
:::

La ligne de progression dit quelle feuille est en cours. Chaque feuille est un
document ordinaire sur le canevas — modifiez-la, ajustez-la, téléchargez-la — et
ses pages s’impriment dans l’ordre avec les autres.

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
cinq boutons :

:::hotspots src=../assets/ui/fr/download.webp alt="Télécharger le document : PDF, PowerPoint / Google Slides / Canva, images PNG, PSD, SVG"
- 50,13.2 **Le format**: Le format de page du document. Le fichier se télécharge directement — sans fenêtre d’impression.
- 52.9,21.7 **PDF**: Pour imprimer ou envoyer. Le texte reste sélectionnable ; chaque champ devient un vrai champ de formulaire.
- 52.9,36.3 **PowerPoint / Google Slides / Canva**: Pour continuer à modifier : chaque texte en zone modifiable, chaque image dans une forme en cadre. Importez-le dans Canva, ou ouvrez-le dans Google Slides depuis Drive.
- 52.9,58.3 **Images PNG**: Pour publier : une image par page, dans un `.zip` s’il y en a plusieurs. Un post sort à ses pixels exacts.
- 52.9,71.4 **PSD**: Pour Photoshop ou Photopea : la page en un calque, chaque image dans une forme en calque à part.
- 52.9,86.9 **SVG**: Pour Figma, Illustrator ou Inkscape : chaque image dans une forme est un masque nommé qui la contient.
:::

| Bouton | Ce que vous obtenez | Pour |
|---|---|---|
| `PDF` / `PDF — champs à remplir` | Les pages telles que dessinées — à 500 dpi pour le papier, au triple pour une diapositive et au quadruple de ses pixels pour un post, pour rester nettes zoomées comme imprimées (sur iPhone ou iPad, aussi haut que Safari le permet, environ 350 dpi en A4) — avec le texte toujours sélectionnable et chaque champ remplissable. | Imprimer, envoyer. |
| `PowerPoint / Google Slides / Canva (.pptx) — textes et cadres modifiables` | Une diapositive par page : le dessin en une image sous tout le reste — l’arrière-plan de la diapositive quand la page a des images dans une forme, sinon une image que l’on peut sélectionner (Canva refusait cet arrière-plan sur une page qui n’en a aucune) — et chaque texte en zone de texte modifiable par-dessus. Chaque image dans une forme est une forme à part, remplie de son image : Canva l’importe comme un cadre où glisser une autre photo, PowerPoint et Google Slides comme une image à remplacer. Importez-le dans Canva, ou déposez-le sur Google Drive et choisissez « Ouvrir avec Google Slides ». | Continuer à modifier. |
| `Images PNG` | Une image par page, dans un `.zip` quand il y en a plusieurs. Un post sort exactement aux pixels de son format. | Publier. |
| `PSD — Photoshop, Photopea` | Un calque pour la page, puis un par image dans une forme, avec son contour, son ruban et son ombre en calques à part. Le texte fait partie de la page. | Terminer dans Photoshop. |
| `SVG — Figma, Illustrator, Inkscape` | La page, et chaque image dans une forme comme un groupe-masque nommé qui la contient, avec son contour et son ruban par-dessus. Le texte fait partie de la page. | Terminer dans Figma ou Illustrator. |

Le fichier est fabriqué dans votre navigateur, page par page, et se télécharge
tout seul. Un lien `Enregistrer « {file} »` reste dans la fenêtre, parce qu’un
navigateur peut bloquer un deuxième téléchargement automatique depuis la même page.

Quand quelque chose n’a pas pu être exporté parfaitement, la fenêtre le dit sous
le lien plutôt que de le cacher : du contenu coupé au bord de la page, un texte
tourné laissé dans l’image d’une diapositive, une page dessinée par le moteur de
secours, une image ou une police qui n’a pas pu être intégrée — et, à part et
avec son site, une image que la page charge depuis un autre site. Celles-là ne
voyagent jamais : un export n’emporte que les images de Mocky ; ajoutez-les à la
bibliothèque et placez-les dans le document.

### Les images dans une forme, dans les fichiers

:::why
Un post fait dans Mocky se termine souvent ailleurs, avec les vraies photos.
Chaque image dans une forme sort donc comme un élément à part, dans sa forme :
une autre photo prend sa place sans que personne ne redessine le cadre.
:::

Quand le document contient des images dans une forme (voir [Des images dans une forme](#des-images-dans-une-forme)),
chacune est nommée d'après sa place et sa forme (« Cadre 2 — Polaroid ») et
voyage à part :

| Fichier | L'image dans une forme est… | Pour la remplacer |
|---|---|---|
| PowerPoint / Google Slides / Canva | une forme remplie de son image, au-dessus de la page | Dans Canva, déposez une photo dessus : c'est un cadre. Dans PowerPoint ou Google Slides, changez l'image. |
| PSD | un calque de l'image, dans sa forme | Placez une photo au-dessus de ce calque, puis Alt + clic entre les deux : un masque d'écrêtage. |
| SVG | un groupe-masque nommé qui contient l'image | Remplacez l'image dans le groupe. |

Un cadre qui attend encore son image sort avec une image d'attente grise, prête
à être remplacée. Un document de plusieurs pages donne un PSD ou un SVG par
page, dans un `.zip`. Comme le PDF et le PowerPoint, ils sont dessinés au double
des pixels d'un post, pour rester nets quand un logiciel les affiche en grand.
Dans le PSD et le SVG, le texte fait partie de l'image de la page ; pour
modifier les mots, prenez le téléchargement PowerPoint.

---

## Quand le contenu dépasse de la page

Une page a une seule taille, et le modèle l’écrit sans la voir rendue : il peut
deviner une hauteur, et la deviner trop longue. Quand un texte ou un champ finit
au-delà du bord d’une page, Mocky le dit — une notice nomme le document et la page
— parce que sur papier ce contenu est tout simplement coupé.

:::hotspots src=../assets/ui/fr/docmenu.webp alt="Le menu contextuel d’un document"
- 50,4.4 **Modifier par message**: Sélectionne le document et place le curseur dans le composeur.
- 50,10.6 **Peaufiner**: Confronte le design à des règles nommées et corrige ce qu’il trouve.
- 50,16.7 **Régénérer une variante**: La même demande à nouveau, pour un autre design.
- 50,35.1 **Ajuster à la page**: Un document seulement : quand le contenu dépasse d’une page, le mesure et demande au modèle de regagner la place. Gardé seulement s’il tient mieux.
- 50,43 **Exporter ›**: `Télécharger…` — PDF à champs remplissables, PowerPoint / Google Slides / Canva, images PNG, PSD ou SVG — et le `.tsx`.
- 50,49.1 **Partager**: Un lien public temporaire et un QR code.
- 50,69.3 **Notes**: Des notes privées sur cet écran, jamais envoyées à un modèle.
- 50,95.6 **Supprimer l’écran**: Une confirmation, et il disparaît.
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

### Des images dans une forme

:::why
Un post, c'est surtout une image, et une image découpée en blob, en arche ou en
polaroid fait la moitié du style d'un post. Le modèle ne dessine aucune de ces
formes lui-même : un long tracé SVG écrit par un modèle se fait couper et casse
le rendu.
:::

Une image peut se placer dans un **cadre**, une forme qui la découpe comme un
masque d'écrêtage dans un logiciel de retouche. Demandez-le dans la consigne
(« la photo dans un blob », « un polaroid », « un collage de trois photos en
arches »). Les formats réseaux sociaux le proposent toujours au modèle ; sur les
autres pages, ce sont ces mots qui le proposent.

Il y a 42 cadres, en quatre familles :

| Famille | Cadres |
|---|---|
| Géométriques | cercle, rectangle arrondi, squircle, triangle, losange, pentagone, hexagone, octogone, étoile, éclat, cœur, arche, dôme, pilule, goutte, bouclier, croix, parallélogramme, fleur, feuille |
| Organiques | six blobs, tache, galet |
| Vagues et bords | vague en bas, vague en haut, vagues des deux côtés, festonné, zigzag, déchiré |
| Cadres photo | polaroid, timbre, pellicule, ticket, bulle, photo scotchée, tirage à bords déchirés, passe-partout ovale |

Un cadre garde en vue la partie importante de l'image (un visage en haut, par
exemple), et peut recevoir un contour, une ombre douce qui suit la forme et une
légère inclinaison. Sans image, la forme est dessinée en gris pour réserver la
place.

Pour changer un cadre ensuite, clic droit sur l'écran, puis `Cadres…` : la
forme, l'image, le cadrage et l'ombre d'un cadre, et `Mettre dans un cadre` pour
les images simples de l'écran. Le code de l'écran est modifié directement, sans
appel au modèle, et `Revenir à la version précédente` l'annule.

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
- 30.4,3.5 **Appareil**: Activé pour un document imprimé : il est tenu dans une main, du même trait que les appareils.
- 44,46.5 **La page**: Le vrai document, une page à la fois ; un sélecteur de page apparaît dessous s’il y en a plusieurs.
- 58.8,63.6 **La main**: Seul le pouce se pose sur la feuille, le long du bord ; le reste de la page reste cliquable.
- 50,95.3 **Légende**: Le format de page.
:::

Un carrousel, dans son fil :

:::hotspots src=../assets/ui/fr/demo-phone.webp alt="Le mode démo : un carrousel Instagram sur un téléphone, dans son fil"
- 40.7,23.1 **Ligne d’auteur**: Le fil dessiné autour du post : générique, à l’encre du téléphone — ni logo, ni interface copiée.
- 50,43.2 **Le post**: Sur toute la largeur de l’écran, là où la plateforme le place.
- 59,27.7 **Compteur du carrousel**: La page affichée et la longueur du carrousel.
- 40.4,62.9 **Actions et légende**: Sous l’image sur Instagram ; au-dessus sur Facebook et LinkedIn.
- 50,94.7 **Pages**: Tourne les pages du carrousel. Une story, elle, remplit l’écran.
:::

L’application dessinée est volontairement générique — aucun logo, aucune
interface copiée. Elle dit où l’image vivra et laisse l’œil sur l’image.
