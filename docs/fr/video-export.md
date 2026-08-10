# Motion

Mocky transforme une liste d’images de la médiathèque en `.mp4`. Pas un écran,
pas une séquence au défilement : un film, monté à partir d’images que
l’utilisateur a choisies, rendu par [Remotion](https://www.remotion.dev/) dans un
conteneur absent d’une installation par défaut.

**La fonctionnalité s’appelle Motion ; le code s’appelle `video`.** Elle est
sortie sous le nom « Export vidéo », qui nommait un format de fichier plutôt que
ce qui est offert : toutes les chaînes que lit un utilisateur disent désormais
Motion. Rien en dessous n’a suivi — `server/video/`, `src/lib/video/`,
`/api/video/*`, le profil compose `video-export` et les clés de traduction
`video.*` gardent leurs noms. Les renommer toucherait les deux moitiés d’un
dictionnaire, tous les appels et les tests qui les épinglent, pour changer des
identifiants qu’aucune interface n’imprime — et casserait la distinction d’une
lettre ci-dessous, sur laquelle on trébuche déjà.

Cette page traite des décisions. Ce que fait chaque contrôle est dans
[l’interface](fr/interface.md) ; le contrat HTTP du worker lui-même est dans
`worker/video/README.fr.md`.

---

## Ce qu’il produit, et ce qu’il ne produit pas

Six sortes de films, montés à partir d’images que l’utilisateur a déjà choisies.

| Modèle | Ce que c’est |
|---|---|
| `slideshow` | Un diaporama : une image par scène, un mouvement de caméra, une transition, une légende facultative incrustée dans l’image |
| `overlay` | Une capture d’écran qui reste entière, dérivant sous un bandeau de texte au-dessus ou en dessous |
| `vertical` | Un montage 9:16 pour un fil de téléphone : plein cadre, scènes courtes |
| `titles` | Un titrage animé. Du texte seul — **aucune image** |
| `product` | Une image, une accroche, jusqu’à trois arguments et un appel à l’action |
| `composed` | Un fond et une pile de blocs typés — le modèle arrange lui-même l’image, à partir d’un catalogue fermé de vingt-sept |

Deux minutes au plus, 30 images par seconde, en `16:9`, `9:16` ou `1:1` — et
chaque modèle resserre le reste à ses propres nombres, parce qu’une scène de
diaporama peut durer une seconde là où une capture avec bandeau à une seconde
est un éclair, pas une lecture.

Il n’y a **aucun son** — ni musique, ni voix off, ni narration — et aucun champ
pour en demander. Cette absence est imposée, pas simplement non implémentée :
chaque objet du schéma est `.strict()`, donc un document portant une clé `audio`
est refusé en entier. Un schéma qui se contenterait de retirer les clés inconnues
accepterait la requête, rendrait du silence et annoncerait une réussite ;
l’utilisateur s’entendrait dire qu’il a obtenu ce qu’il demandait en regardant
autre chose.

Le même piège du singulier et du pluriel traverse le code, et il vaut d’être
appris une fois : **`server/video/` est le pipeline d’export, `server/videos/`
est la bibliothèque de clips** qui alimente les séquences au défilement d’une
maquette. Deux fonctionnalités, une lettre d’écart.

---

## La règle fondatrice : le modèle écrit du JSON, jamais du Remotion

Un modèle intervient exactement une fois, dans `server/video/compose.js`, et ce
qu’il renvoie est un unique objet JSON. Il **compose chaque scène à partir d’un
catalogue fermé — un fond et une pile de blocs typés — et en remplit les
paramètres**, sur des images que l’utilisateur a déjà choisies. Il ne choisit pas
les images, et il n’écrit jamais une ligne de code de rendu. Toutes les
compositions et tous les blocs de `worker/video/remotion/` sont écrits à la main.

**Nommer un bloc n’est pas choisir un rendu,** et tout le catalogue repose sur
cette distinction. Ce qui revient est un nom pris dans une énumération fermée —
un template sur six, un fond sur six, un bloc sur vingt-sept — et chacun de ces
noms est un composant écrit par quelqu’un et lu par un relecteur. Le modèle
obtient la variété ; il n’obtient jamais une chaîne qui devient du code, une mise
en page qu’il aurait décrite, ni un nom de fichier.

C’est la seule architecture tenable pour un produit auto-hébergé où n’importe qui
branche n’importe quel modèle. L’alternative — laisser le modèle émettre du
Remotion/React et l’exécuter — revient à faire tourner sur la machine de
quelqu’un du code arbitraire écrit par le fournisseur qu’il a configuré, dans un
conteneur qui contient un navigateur et un encodeur. Mocky exécute déjà du code
écrit par un modèle dans l’aperçu, et il s’en sort parce que ce code tourne dans
une iframe sans origine propre et sans accès à quoi que ce soit
([I2](fr/architecture/invariants.md)). Un worker de rendu n’a pas de cage
équivalente : c’est un processus Node dont le métier est de toucher au système de
fichiers et de lancer Chromium.

La frontière de confiance est donc déplacée. Toute la sortie du modèle est une
donnée confrontée à un schéma, et la seule chose qui transforme cette donnée en
pixels est du code écrit par une personne et couvert par un test.

### Le schéma est toute la surface

`src/lib/video/timeline.ts` est la définition à lire. Tout ce que le modèle peut
exprimer doit être quelque chose qu’une composition sait déjà rendre, et tout ce
qu’il ne peut pas exprimer est **hors d’atteinte plutôt que déconseillé** : il n’y
a pas de champ de fréquence d’images, donc pas de discussion sur les
fréquences ; pas de `src`, donc aucun moyen de nommer une image absente de la
bibliothèque.

`imageId` est un SHA-256 de 64 caractères minuscules — une adresse dans la
bibliothèque d’images de Mocky ([M8](fr/architecture/invariants.md)), jamais une
URL. Accepter un emplacement ici donnerait au modèle un moyen de tirer des octets
distants dans un fichier que Mocky hébergerait ensuite comme le sien, ce que
[M2](fr/architecture/invariants.md) existe précisément pour interdire. En
minuscules seulement, parce que `data/image-library/{hash}` est un chemin : `AB…`
et `ab…` seraient deux noms pour un fichier sur un volume sensible à la casse, et
un fichier à deux orthographes ailleurs — un échec de recherche qui ne se
reproduit que sous Linux.

### Le catalogue est une union, et c’est ce qui garde la règle intacte

La variété était la chose évidente à vouloir ensuite, et il n’y a que deux
façons de l’obtenir. La première consiste à laisser le modèle décrire son propre
rendu — un peu de mise en page, un peu de CSS, un nom de composant — et c’est la
règle fondatrice qui saute, un champ à la fois. La seconde est un **catalogue** :
cinq modèles discriminés sur `template`, chacun avec sa sorte de scène, ses
bornes et son `.strict()`, chacun rendu par une composition écrite par quelqu’un
et lue par un relecteur. Un sixième look est une pull request ordinaire. Ce n’est
jamais une chaîne qui devient du code.

Trois conséquences méritent d’être énoncées.

**Un document sans `template` est un diaporama.** Pas par politesse : des
montages composés avant l’existence du catalogue dorment dans des brouillons
enregistrés et dans le journal de la file, et chacun d’eux se serait mis à échouer
à la validation le jour de la livraison — le panneau refusant un montage que
l’utilisateur avait construit et qu’on lui avait montré, sans que rien nulle part
ne nomme le changement responsable. C’est un défaut au sens où `kenBurns` vaut
`zoom-in` par défaut et `move` `drift-up`, et il ne rattrape rien d’autre : un `product` sans accroche
est un product refusé, jamais rejugé comme le diaporama qui serait passé.

**Le plafond de 120 secondes est écrit une seule fois, sur l’union.** Des
plafonds par variante feraient cinq nombres à tenir sous l’unique
`JOB_TIMEOUT_MS` de la file, et le cinquième serait celui qu’on aurait raté.

**Un format peut être hors d’atteinte plutôt que déconseillé.** `vertical` type
son `aspectRatio` comme le littéral `9:16` : il n’y a donc pas de règle interdisant
de demander du 16:9, il n’y a aucun moyen de le demander. Une composition
verticale à qui l’on donne un cadre paysage ajouterait des bandes noires et
placerait ses légendes dans le mauvais tiers — un document légal rendant un film
que personne n’a décrit. Même astuce que l’absence totale de champ `fps`.

Le worker joue sa part en refusant ce qu’il ne sait pas dessiner.
`RENDERABLE_TEMPLATES`, dans `worker/video/validate.js`, est la liste de cette
image-là, et elle a le droit d’être en retard sur celle de Mocky : le worker est
un service séparé derrière un profil optionnel, donc un exploitant peut réellement
faire tourner la build du mois dernier. Un modèle pour lequel il n’a pas de
composition est refusé **par son nom**, avec une phrase qui dit de reconstruire,
plutôt que dessiné avec la composition la plus proche dont il dispose.

Ce retard est celui de deux *images déployées*, jamais celui de deux fichiers
d’un même commit : un test exige que `RENDERABLE_TEMPLATES` soit égal aux
`VIDEO_TEMPLATES` du schéma, parce qu’un modèle que Mocky sait composer sans
composition derrière lui, c’est un export qui échoue après qu’on a annoncé à
l’utilisateur qu’il était en file.

### La sixième entrée n’est pas un sixième look : c’est une pile de blocs

Cinq modèles monolithiques n’achètent la variété qu’à la poignée. Un brief entre
dans l’une des cinq mises en page ou il n’y entre pas, et l’interface en faisait
le problème de tout le monde : le premier contrôle du panneau était un sélecteur
de composition, si bien qu’on demandait à quelqu’un venu décrire un film de
choisir un rendu avant d’avoir écrit une phrase. La réponse à « comment
j’obtiens quelque chose d’original » était un bouton radio à cinq positions.

`composed` est la sixième entrée de l’union, et l’entrée d’un autre genre. Une
scène, c’est **un fond plus une pile de blocs typés** ; le modèle choisit quels
blocs, dans quel ordre, dans quelle zone et avec quels paramètres, et la variété
devient combinatoire au lieu d’être un choix parmi cinq.

**Cela ne rouvre pas la règle fondatrice, et cela vaut la peine de le dire parce
qu’on pourrait le croire.** Chaque `kind` est un nom pris dans une énumération
fermée de vingt-sept. Chacun de ces noms est un composant de
`worker/video/remotion/blocks/` que quelqu’un a écrit et qu’un relecteur a lu.
Chaque champ de chaque bloc est un entier borné, une énumération fermée ou une
`line(n)`, vérifiée par les trois lecteurs. Ce que le modèle a gagné, c’est de
l’*arithmétique* — des combinaisons plutôt que des cartes — pas le droit de
décrire son propre rendu.

| Famille | Blocs |
|---|---|
| Texte | `heading`, `kicker`, `quote`, `textHighlight`, `funTitle` |
| Texte animé | `typewriter`, `animatedList`, `counter`, `logoType` |
| Interface | `button`, `form`, `notification`, `lowerThird` |
| Données | `barChart`, `lineChart`, `equalizer`, `soundWave`, `map`, `globe`, `solidChart` |
| Média et temps | `imageFrame`, `gallery`, `carousel`, `clock`, `dateStamp` |
| Divers | `separator`, `progressBar` |
| Pièces d’apparat | `codeBlock`, `solidScene`, `extrudedType` |
| Champs en volume | `particleField`, `waveMesh`, `depthGrid` |
| Fonds | `solid`, `gradient`, `hairlines`, `gridPulse`, `particles`, `image` |

**Les cinq restent, entiers et rendables.** Les brouillons enregistrés et le
journal de la file en sont pleins, et un modèle retiré, ce sont tous ces
documents refusés à la validation sans que rien nulle part ne nomme le changement
qui l’a causé. Le sélecteur du panneau et l’enregistrement plat de `draft.ts`
sont indexés sur `EDITABLE_TEMPLATES`, les cinq qu’une personne peut remplir à la
main ; le schéma, le worker, les palettes et les mouvements le sont sur
`VIDEO_TEMPLATES`, qui en compte six désormais. Deux listes plutôt qu’une avec un
drapeau, parce que « est-ce que ça se rend » et « est-ce que ça se saisit » ne
sont pas la même question, et n’ont plus la même réponse depuis que les blocs
existent.

#### Deux blocs de données dessinés par un moteur : un globe, et un graphique en volume

La famille « données » du catalogue a gagné deux entrées dessinées en GL plutôt
qu’avec des div, et les deux viennent de la même demande : une carte du monde qui
ne soit pas plate, et un histogramme qui ait du poids. Ni l’une ni l’autre ne
rouvre la règle fondatrice — un document nomme `globe` ou `solidChart`, remplit
des entiers bornés et une énumération fermée, et chaque sommet, chaque caméra et
chaque couleur sont écrits à la main — mais chacune avait une question à trancher
avant de pouvoir être livrée.

**Un histogramme 3D est une décoration si la projection n’est pas parallèle, et
c’est toute la conception de `solidChart`.** Sous une caméra en perspective, deux
valeurs égales à deux profondeurs dessinent deux colonnes différentes : avec
l’objectif de ce catalogue, une barre placée une unité et demie plus près qu’une
autre se projette à 1,73 fois sa hauteur. C’est pourquoi l’histogramme 3D est un
anti-modèle de visualisation partout où il apparaît, et ce n’est pas un problème
de réglage — la seule chose à quoi sert un histogramme est exactement ce que le
point de fuite détruit. En projection orthographique, c’est faux : une verticale
de hauteur `h` se projette en `h·cos(élévation)` où qu’elle se tienne.
`chartProject` est cette arithmétique, longue d’une ligne, et `dataVolume.test.js`
la tient comme une égalité sur une grille de positions et de profondeurs plutôt
qu’à l’origine, parce que le défaut qu’elle refuse est exactement une colonne qui
se dessine autrement PARCE QU’elle est ailleurs.

L’occultation est l’autre moitié, et elle est bornée plutôt qu’évitée. Une boîte
de largeur `w` et de profondeur `d` tournée de `a` a une silhouette large de
`w·cos a + d·sin a`, et les centres des colonnes sont espacés de `p·cos a` : la
rangée est libre de recouvrement exactement quand `w + d·tan a ≤ p`. Avec l’air
que le graphique plat dépense déjà (`FIGURE_GAP_SHARE`) et une profondeur égale à
la largeur, cela borne le lacet à un peu plus de 23° ; `CHART_AZIMUTH` vaut 16, et
le test tient l’inégalité plutôt que l’angle. L’élévation n’a besoin d’aucune
borne, puisque toutes les colonnes sont à la même profondeur. Reste ce qui vaut un
moteur de rendu : deux faces éclairées par colonne, sur le segment de Lambert que
`solidShading` mesure déjà, et un socle là où le graphique plat a une ligne de
base — une plaque plutôt qu’un filet, car un trait dessiné dans l’espace est le
seul élément dont la projection est libre de changer l’épaisseur.

**Ses étiquettes sont du texte plat par-dessus le canevas, et c’est écrit plutôt
que supposé.** Du texte en GL, c’est soit une géométrie extrudée — qui demande un
fichier de police que ce conteneur ne porte pas — soit une texture, c’est-à-dire
des glyphes à une taille que personne n’a choisie dans une couleur que personne
n’a mesurée. Une légende est un RUN : elle appartient à l’échelle typographique
unique, elle est dimensionnée par `labelBand` contre la voie sous laquelle elle se
place, et elle disparaît plutôt que de déborder. Donc `blockCanvas` répond un
`frame` plus haut que son canevas et un `overlay`, la composition dessine la
moitié DOM par-dessus la moitié GL, et la voie sur laquelle une légende est
centrée est la PROJECTION de l’axe de sa colonne — une légende sous la mauvaise
colonne est pire que pas de légende du tout.

**Le globe, c’est le trait de côte de la carte plate posé sur une sphère, et c’est
la réponse à un problème de résolution plutôt qu’une deuxième carte.** `map` a
déjà renoncé une fois à ses sous-régions : un masque en plate-carrée assez fin
pour dessiner une frontière est un masque qui dessine la mauvaise frontière, donc
ce qu’il dessine est un littoral à l’échelle d’un continent. Une sphère n’a pas de
frontière à rater — ce qu’un œil lit, c’est la FORME des continents et le fait
qu’ils s’enroulent — et les deux survivent à n’importe quelle résolution que la
boîte peut porter. Il lit le même `LAND_ROWS`, parce qu’un globe dont l’Afrique
différerait de celle de la carte serait deux mondes dans un film, et il prend les
mêmes trois champs : `region` dit quelle face se tourne vers la caméra à
l’ouverture de la scène, `markers` est un compte, et les positions appartiennent à
la composition, puisqu’une latitude est une coordonnée sous un autre nom.

Son réseau de points est une spirale de Fibonacci, et c’est la partie qui mérite
d’être dite deux fois. L’équi-répartition est ce qu’elle achète — une grille
latitude/longitude échantillonnée à pas fixe met cinq fois plus de points par
unité de surface à 78° nord qu’à l’équateur, donc les pôles se lisent comme des
calottes brillantes — et le DÉTERMINISME est ce qu’elle ne coûte pas : le chemin
le plus court vers un champ de points « dispersé » est `Math.random`, et c’est ici
que la tentation est la plus forte. Chaque position vient d’un indice.

**Ce que les mesures ont changé, c’est l’essentiel du bloc.** Banc : l’image du
worker, `--cpus=2.0 --memory=4g`, 1080p/30, six secondes de film, les réglages
d’encodeur qu’`encoding.js` utilise vraiment. Un titre en display sert de témoin ;
une sphère `solidScene` plein cadre sert d’étalon, puisque ce document la chiffre
déjà à +0,9 s de rendu par seconde de film.

| Scène | rendu | Δ s/s (banc) | **Δ s/s (échelle de ce document)** | Sortie |
|---|---|---|---|---|
| témoin (un titre) | 12,9 s | — | — | 0,73 Mo |
| `solidScene`, sphère, plein cadre | 20,3 s | +1,23 | **+0,90** (l’étalon) | 0,79 Mo |
| `globe`, plein cadre | 19,4 s | +1,09 | **+0,80** | 3,90 Mo |
| `globe` + un titre | 21,2 s | +1,39 | **+1,01** | 3,53 Mo |
| `solidChart`, plein cadre | 17,3 s | +0,74 | **+0,54** | 0,64 Mo |
| `solidChart` + un surtitre | 20,8 s | +1,32 | **+0,96** | 0,62 Mo |
| huit `globe` dans une même zone | 21,0 s | +1,37 | **+1,00** | 1,72 Mo |
| ~~`globe` en COQUE complète de points~~ | 23,8 s | +2,08 | **+1,81** | 7,50 Mo — refusé |
| ~~la même, avec une sphère translucide~~ | 30,9 s | +3,26 | **+2,84** | 2,50 Mo — refusé |

L’échéance laisse environ 1,7 s/s de marge sur le film le plus long que le schéma
accepte : ces deux-là tiennent, et les deux versions refusées ne tenaient pas.
**Le premier globe dessinait une coque entière** — la terre en clair sur une mer
discrète, un seul réseau coupé en deux — et c’était l’échec du fil de fer qui
revenait par une autre géométrie : des milliers de points minuscules et contrastés
qui bougent à chaque image sont le détail que h264 ne sait pas prédire, et le
résultat est revenu à dix fois le débit d’un titre. Remplacer la mer par une
sphère translucide était pire encore, parce qu’un disque entier de fondu alpha à
chaque image est ce qu’un rastériseur logiciel fait le plus lentement. Ce qui est
livré, c’est `globeGraticule` : une douzaine de méridiens et sept parallèles de
points, ce qui suffit à dire « sphère » pour un vingtième du prix.

La seconde mesure a changé la façon dont le bloc est écrit. **Un nuage de points
coûte une quinzaine de millisecondes par image quoi qu’il contienne** — les
positions sont reconstruites à chacune des images d’une scène, donc la géométrie
derrière elles est détruite et recréée autant de fois, et la facture est par TAMPON
plutôt que par point. Le même globe à 7854 points et à 2827 a pris 23,8 s et
24,4 s ; retirer un nuage sur trois en a retiré 2,7. Les liaisons voyagent donc
dans le tampon de la terre, il y a deux nuages et non trois, et le nombre de points
est presque gratuit — c’est pourquoi `GLOBE_PITCH_PX` est choisi pour l’ENCODEUR et
non pour le rastériseur : les mêmes six secondes sont revenues à 7,5 Mo à un pas de
dix-huit et à 3,9 à trente.

La dernière ligne du tableau est celle qui dit que l’arithmétique des boîtes tient
toujours. Huit globes dans une zone coûtent ce qu’un seul coûte, parce que huit
boîtes sont huit huitièmes d’une zone sûre — `tests/video-composed-frame.test.js`
le prouve pour `solidScene` et la mesure le confirme ici. Une pièce d’apparat
entassée dans une pile ne devient pas chère ; elle devient petite.

Deux entrées de `FIELD_PAINTS` en découlent. Un `globe` ancré `full` peint
l’accent à deux opacités et rien d’autre, puisqu’il n’y a aucune lumière dans
cette scène ; un `solidChart` peint un `solid`, le même segment de Lambert que
`solidScene`, parce que ses colonnes sont éclairées. Ses étiquettes sont hors du
canevas et sont mesurées comme du texte courant ordinaire sur le fond.

##### Une coque n’est pas le dessin, et un bord de canevas est un couteau

Deux exports sont revenus avec la moitié droite du globe s’arrêtant sur une ligne
verticale nette au tiers du cadre — la seule classe de défaut qu’un spectateur lit
comme un logiciel cassé plutôt que comme un choix, et le rapport de l’utilisateur
disait seulement que « les rendus 3D ne sont pas toujours bien découpés ». C’est la
mesure qui a tranché entre les trois causes possibles : le canevas n’est pas plus
petit que sa boîte (il vaut `min(box.width, box.height)` au pixel près), et la
caméra n’est pas trop près (c’est l’objectif du catalogue). **L’objet est plus
grand que le volume de vue, et l’objet n’est pas la sphère.**

`GLOBE_RADIUS` vaut `SOLID_BOUND`, dont la phrase est « le rayon exact auquel une
boule centrée sur l’origine touche le bord de son canevas sans jamais le
franchir ». La boule ne l’a jamais franchi. Quatre choses que ce bloc accroche à
cette boule ne sont pas dessus :

| quoi | à quelle distance de la coque | en plein cadre 16:9 |
|---|---|---|
| une connexion, bombée de `GLOBE_ARC_LIFT` | `1,16 · R` | 64 px hors du canevas |
| un repère, une sphère centrée SUR la surface | `R + m` | 39 px |
| une onde, un anneau dans le plan tangent | `√(R² + (3m)²)` | 22 px |
| un point, un sprite de `dot` px | un demi-point | 7 px |

contre les 2 % d’arrondi que laisse `SOLID_MARGIN`. C’est un corpus rendu qui l’a
mesuré : sur un export 1920×1080, l’encre était collée à la dernière colonne du
canevas sur 93 lignes consécutives, à toutes les images — un faisceau d’arcs
partant d’un même repère se coupe comme une seule droite, ce qui est exactement ce
que décrit « sa moitié droite s’arrête sur une ligne verticale ». C’était
intermittent en `life`, parce que le globe tourne et qu’une bombure croise le limbe
pendant la scène ; c’est le « pas toujours ».

Le canevas ne peut pas grandir — un canevas plus grand que sa boîte peint sur la
zone d’à côté —, donc ce qui cède est le rayon auquel les points sont posés.
`globeShell` est cette borne, en forme close parce que chacune des quatre portées
est linéaire ou pythagoricienne en le rayon, et elle lit le BLOC : un globe sans
repère ni connexion garde le rayon qu’il a toujours eu, et on ne paie que ce qu’un
document a réellement dessiné. Rien ne change de ce que le bloc réclame du cadre —
`blockExtent` dit toujours qu’un globe dessine jusqu’au petit côté de sa boîte, et
c’est toujours vrai après. Ce qui change, c’est quelle partie du dessin touche le
bord.

Le même corpus, rendu à nouveau : la colonne extrême se déplace d’une image à
l’autre (1340, 1381, 1385, 1412 px) au lieu de rester à 1425 sur toutes, ce que
fait une silhouette et que ne fait pas une coupure. `dataVolume.test.js` tient la
garantie en unités de monde plutôt qu’en pixels — chaque point de chaque nuage,
plus son sprite, plus le bord de chaque repère et de chaque onde, à l’intérieur de
la boule que décrit `SOLID_BOUND` — parce qu’une garantie en pixels serait une
garantie sur la projection dont `SOLID_BOUND` est tiré.

Les huit autres blocs 3D ont été mesurés de la même façon, par l’encre d’un corpus
rendu, et aucun ne franchit son canevas : `solidScene` est normalisé sur sa propre
sphère englobante, `photoStage` et `photoRing` font tenir chaque coin par
`frustumScale`, `extrudedType` plafonne son canevas à ce que `blockExtent` annonce
et réserve son propre débattement, et les trois champs sont faits pour couvrir leur
boîte. `solidChart` remplit son canevas exactement — l’enveloppe projetée occupe
`[0, canvas.width]` au dixième de pixel près — ce qui est juste et ne laisse
aucune marge ; les arêtes verticales de 19 à 32 px à chaque bout de son socle sont
les faces d’about de la boîte et non une coupure, et il vaut mieux le savoir avant
de lire l’une pour l’autre.

#### Trois champs en volume : une poussière, une surface qui gonfle, un sol

La demande qui les nomme, c'est « le fond devrait être en 3D », et la réponse est
une famille plutôt que trois pièces d'apparat de plus. Une pièce d'apparat est une
scène entière et l'invite dit au modèle d'en dépenser au plus une par film ; un
CHAMP est ce dont une scène est faite — il est peint sous les neuf cellules, un
titre est censé s'y tenir debout, et un film peut en vouloir une scène sur deux.
Ce qu'il ne doit jamais faire, c'est partager une image avec un second champ, et
c'est la phrase que porte `FAMILY_TITLES.field` à la place.

| Bloc | Ce que c'est | Champs |
|---|---|---|
| `particleField` | une poussière suspendue dans l'espace, qui dérive | `count`, `drift` |
| `waveMesh` | une surface éclairée, qui gonfle | `swell`, `tilt` |
| `depthGrid` | des règles qui fuient vers l'horizon, en sol ou en tunnel | `lines`, `form`, `travel` |

Rien là-dedans n'est une couleur, une coordonnée, une vitesse ou une taille, et il
n'y a pas de GRAINE — le seul champ par lequel un document pourrait se rendre
différemment de lui-même, le même échec qu'un `Math.random`, arrivant par une clef
plutôt que par un appel. Toute position vient d'un INDICE et d'un numéro d'image,
par `noise` dans `worker/video/remotion/blocks/field.js` : un hachage entier, et
délibérément pas l'idiome `fract(sin(…))` que tous les tutoriels de shader
attrapent, parce que `Math.sin` est juste à un ulp près et que l'ulp en question
regarde le moteur. `field.test.js` prouve que deux appels rendent les mêmes
octets ; le magasin d'exports est adressé par contenu, donc un film qui diffère
d'un pixel entre deux rendus, ce sont deux films sur un seul budget de disque.

**Les mesures sont toute la conception de la famille.** Même banc que plus haut —
l'image du worker, `--cpus=2.0 --memory=4g`, 1080p/30, six secondes, les réglages
d'encodeur d'`encoding.js` — et chaque chiffre est un RAPPORT à un `solidScene`
plein cadre mesuré dans la même passe, puis ramené à l'échelle de ce document,
parce qu'une partie de ces bancs a tourné pendant qu'un autre travail tenait la
machine.

| Scène | Δ s/s (échelle de ce document) | Sortie |
|---|---|---|
| `solidScene`, sphère, plein cadre | **+0,90** (l'étalon) | 0,86 Mo |
| `particleField`, le compte que donne le silence | **+0,25** | 1,27 Mo |
| `particleField` au plafond du schéma | **+0,37** | 2,03 Mo |
| `waveMesh`, plein cadre, dans le budget de pixels | **+1,00** | 2,12 Mo |
| ~~`waveMesh` aux pixels propres de sa boîte~~ | **+1,70** — refusé | 2,81 Mo |
| `depthGrid` en `floor` | **+0,28** | 1,29 Mo |
| `depthGrid` en `tunnel` le plus dense | **+0,85** | 4,09 Mo |
| ~~le même tunnel sans brume et sans fondu~~ | **+1,15** — refusé | 5,98 Mo |

Deux de ces lignes sont les deux décisions.

**Un champ remplit sa boîte sur les deux axes**, ce qui plein cadre fait 2,4 fois
les pixels que couvre le plus grand canevas carré d'un `solidScene` — et une
surface éclairée à cette taille dépense la totalité des 1,7 s/s que l'échéance
proportionnée à la durée laisse de marge, pour un bloc d'une scène. Donc
`FIELD_PIXEL_BUDGET` borne ce qu'un champ a le droit de DESSINER, et
`ComposedSceneVideo` repeint le résultat par-dessus la boîte avec deux échelles,
une par axe, pour que l'arrondi d'une mémoire d'image entière ne laisse pas un
filet de fond le long du bord droit. Rogner encore d'un tiers ce budget achetait
+0,19 s/s pour un cinquième de la résolution linéaire, et c'est là que l'échange
cesse d'en valoir la peine. Un champ dans une CELLULE ne paie rien : un tiers de
zone est déjà sous le budget, `fieldCanvas` rend sa boîte telle quelle et le
dessin est net. C'est la seule famille dessinée plus petite que sa boîte, et elle
a le droit de l'être parce qu'aucun des trois n'a de détail plus fin que le
dégradé qui le traverse — ce qui est aussi pourquoi aucun d'eux ne compose jamais
de texte.

**Une grille en perspective converge, et là où elle converge elle coûte du
débit.** Le premier `depthGrid` est revenu à 6,0 Mo pour six secondes — les trois
quarts du chemin vers les 9,8 Mo qui ont fait refuser le fil de fer — sur une
bande de pixels alternés qui rampe vers le point de fuite. `GRID_FOG_DENSITY` le
corrige pour rien : la brume fond vers `palette.ground.color`, donc chaque pixel
du bloc reste entre le fond nu et l'accent, qui est exactement la paire que
`composedPalette` mesure pour ce champ. C'est aussi la bonne image, puisqu'un sol
dont le fond s'arrête net a une arête visible en travers du cadre. Les règles
elles-mêmes sont de longues BOÎTES fines et pas des `<lineSegments>`, et cela
aussi est mesuré : une primitive de ligne fait un pixel de large quelle que soit
sa profondeur, donc un sol qui en est fait n'a aucune perspective dans son propre
poids — et c'est la géométrie qui a fait refuser le fil de fer au départ.

Trois choses de plus qu'une image rendue a tranchées plutôt qu'une lecture.

*La vague était une dalle orange plate.* Une face de Lambert est éclairée par sa
NORMALE, et les premières houles avaient une pente maximale de dix-huit degrés,
ce qui contre une part ambiante d'un demi ne se voit pas. Le produit
`rise × wave` est proche de un à chaque houle désormais — environ quarante-cinq
degrés à la crête — et l'unique lumière directionnelle est sur le CÔTÉ plutôt que
par-dessus l'épaule de la caméra, là où `solidScene` met la sienne : un solide
tourne, donc n'importe quel angle trouve ses faces, tandis qu'une nappe qui ondule
sur place a besoin d'une lumière rasante pour être lue.

*Ensuite elle avait une encoche.* La nappe est déplacée le long de sa propre
normale, donc un creux au bord lointain la fait descendre sous le haut de l'image
et ouvre une bande de fond nu en travers du cadre. `WAVE_WIDTH` et `WAVE_DEPTH`
sont dérivés de la caméra et non choisis, et `field.test.js` tient l'inégalité en
lui retranchant deux fois la plus grande amplitude, aux deux inclinaisons.

*Et la poussière boucle hors champ.* Une particule qui monte revient par un
modulo, et un modulo à l'intérieur du tronc de vision, c'est une poussière qui se
téléporte au milieu de l'image — une fois par particule et par scène, sur la
dérive qu'un document silencieux obtient. `PARTICLE_RISE_SPAN` dépasse le tronc
de vision du côté lointain du monde, et le test est l'inégalité plutôt qu'un
paragraphe.

Les trois sont nommés dans `server/video/three-d.js` avec les blocs qui les
précèdent, pour que la permission 3D de l'administrateur les couvre ; un champ
ajouté au catalogue et oublié là-bas est un bloc offert à tous les comptes, ce qui
est précisément l'échec que rien n'en rendrait visible.

#### Trois blocs qui coûtent une dépendance, et ce que les mesures ont dit

On a demandé trois choses de plus au catalogue — de la vraie 3D, des titres
« fun » et une animation de code — et les trois ont derrière elles un paquet
évident que ce worker ne porte pas. `worker/video/` est un sous-projet séparé,
derrière un profil facultatif et exclu du contexte de construction de l’image
Docker de Mocky : une dépendance ajoutée là ne touche ni le manifeste racine, ni
le Dockerfile racine, ni le compose par défaut, et
`tests/video-worker-separation.test.js` est ce qui le dit. L’ajouter est donc
permis. Savoir si ça en vaut la peine est une mesure, et chacune a été prise sur
l’image qui part vraiment.

| | Installé | Image | Construction | Rendu | Licence | Verdict |
|---|---|---|---|---|---|---|
| `three` + `@react-three/fiber` + `@remotion/three` | +26,6 Mio | 1,57 → 1,60 Go (+32 Mo, +2,0 %) | 83 s → 87 s | +0,9 s par seconde de film | MIT, aucun binaire natif | **pris** |
| `@remotion/skia` + `@shopify/react-native-skia` + `canvaskit-wasm` | **+461 Mio** | +30 % de l’image entière | — | — | MIT / BSD-3, **binaires `.a` et `.so` précompilés pour quatre plateformes** | refusé |
| `shiki` / `prismjs` | +14,6 Mio / +2,1 Mio | négligeable | négligeable | — | MIT | refusé, et pas sur le coût |

**La 3D est prise, et le fil de fer qu’elle contient ne l’est pas.** WebGL
fonctionne dans ce conteneur sur le backend par défaut de Chromium — `swangle`,
le rastériseur logiciel — sans rien changer à `render.js` et sans
`chromiumOptions`. Ce que ça coûte a été mesuré en 1080p sur le worker à deux
cœurs : une sphère éclairée plein cadre a pris 14,9 s pour 6 s de film contre
9,2 s pour un titre nu, et 65,6 s contre 39,1 s pour 30 s — soit 0,9 s de rendu
*ajoutée* par seconde de film, linéaire sur toute la plage. L’échéance
proportionnelle à la durée accorde 6 s de rendu par seconde de film et le pire
cas mesuré est à 4,3 : 0,9 y tient, avec 0,8 de marge. Un tore en fil de fer,
non : 25,4 s pour les mêmes 6 s — 2,7 s/s — et 9,8 Mo de sortie contre 0,6 Mo,
parce qu’un maillage de lignes est exactement le détail haute fréquence que h264
ne compresse pas, et qu’il dépense toute l’allocation de débit sur laquelle
`worstCaseBytes` dimensionne le budget disque. `SOLIDS` a donc quatre solides et
aucun fil de fer, et cette absence est une mesure, pas un goût.

Tout le reste de `solidScene` est la règle fondatrice appliquée une fois de plus.
Un document nomme un solide et une rotation dans deux énumérations fermées ; la
géométrie, la caméra, l’éclairage et chaque couleur sont écrits à la main. Le
bloc n’importe ni `three` ni `@remotion/three` — ce qu’il retourne, ce sont des
intrinsèques react-three-fiber, des chaînes en minuscules que le réconciliateur
résout, et le canevas qui leur donne un sens est ouvert par `ComposedSceneVideo`.
Ce n’est pas du rangement : `blocks/index.js` est chargé dans la suite vitest de
Mocky pour prouver que le registre correspond au schéma dans les deux sens, et un
seul import d’un paquet qui ne vit que dans le worker sortirait le registre du
seul test qui le tient honnête.

La garantie de lisibilité a dû être étendue plutôt que réutilisée, parce que
c’est la seule chose du catalogue peinte à plus d’une luminosité. Une face
lambertienne vaut `matériau × (ambiante + directionnelle · n·l)` : toutes les
faces d’un solide sont donc sur le segment entre `matériau × ambiante` et
`matériau`. Le contraste contre une surface fixe est monotone en luminance de
chaque côté d’elle, et la luminance est monotone le long d’une rampe canal par
canal — mesurer les deux BOUTS mesure donc toutes les faces entre elles.
`solidShading` épingle un bout sur le run que la palette a déjà résolu et mesure
l’autre : sur un fond sombre elle éclaircit, sur du papier elle assombrit, et
dans les deux cas l’ombrage ne s’éloigne jamais que de la surface. Quand aucun
bout ne passe, le solide est peint à plat et garde sa perspective (Q1).
`composition.test.js` le balaie sur six fonds et une douzaine de directions
réelles.

**Le run sur lequel il est épinglé est celui de l’ORNEMENT, et c’était l’encre.**
C’est un film rendu qui l’a dit : un tore peint en `palette.display.color` sous un
titre peint en `palette.display.color`, c’est un objet et le mot posé dessus qui se
rencontrent à 1:1 partout où ils se recouvrent — la faute d’origine de toute cette
section, arrivée une composition plus loin. Un solide éclairé est une décoration,
et une décoration porte la couleur du projet (`accentRun`) : le matériau est donc
l’accent, et sur une direction dont l’accent ne se lit nulle part il retombe par
`accentFirst` sur l’encre comme tout autre ornement, parce qu’être lisible passe
avant être distinct ici comme ailleurs.

**Skia est refusé sur un chiffre qui n’est pas serré.** `@remotion/skia`, c’est
11 ko de colle ; ce dont il a besoin, c’est `@shopify/react-native-skia`, qui
installe 443 Mio à lui seul — `libskia.xcframework`, `libsvg.a` et le reste, des
binaires précompilés pour iOS, tvOS, macOS et Android, dont aucun ne peut
s’exécuter dans un conteneur Debian qui rend dans un navigateur sans tête. C’est
un tiers de l’image entière de ce worker ajouté pour des fichiers qu’il ne peut
pas lancer, dans un dépôt dont la règle écrite est qu’il n’a aucune dépendance
native. Et son jeu de pairs en 2.x réclame React 19, `react-native` et
`react-native-reanimated`, contre un worker en React 18. L’équivalent sans lui
est le bloc `funTitle` : cinq traitements — un arc, un rebond, un étirement, un
mot passé dans l’accent, une pile ombrée — chacun une transformation par lettre,
ce qu’un navigateur a toujours su faire. C’est moins que Skia. Ce n’est pas rien,
et ça coûte zéro octet.

**Un colorateur syntaxique est refusé, et pas au poids.** `prismjs` fait
2,1 Mio, ce qui face à 1,57 Go n’est rien du tout : la réponse n’est donc pas
celle que les chiffres suggèrent. Ce qu’un colorateur produit, c’est un *thème* :
vingt à quarante valeurs hexadécimales, une par type de jeton, dont aucune n’a
été mesurée contre la surface sur laquelle un film les peint. `composedPalette`
offre quatre runs mesurés sur un panneau. Ces trente couleurs n’ont donc que deux
endroits où aller — dans un bloc, en hexadécimal que personne n’a mesuré, ce qui
est le défaut qui a livré un titre vert foncé sur une image presque noire et que
`blocks.test.js` refuse net, ou rabattues sur des runs mesurés, auquel cas le
colorateur n’a rien fait qu’un rôle ne fasse. `codeBlock` porte donc un `role`
par ligne, le modèle dit ce qu’est chaque ligne, et aucun langage n’est deviné à
partir d’une chaîne. Ça évite aussi de faire tourner un moteur d’expressions
régulières sur du texte écrit par un modèle, dans un rendu sous échéance.

**Le quatrième de ces runs appartient à ce bloc, et c’est un plancher, pas une
nuance.** Un panneau portait le même trio que le fond — du display à 3:1, du
texte courant à 4,5:1 et assourdi, un ornement — parce que tous les panneaux du
catalogue étaient un titre, un sous-titre et une marque. Un listing n’a pas cette
forme : ses lignes `plain` sont la MAJORITÉ du panneau, elles sont du texte
courant au pas `body`, et elles allaient sur `panelDisplay` parce que c’était le
seul run restant qui ne fût pas l’assourdi. Vingt lignes de monospace à 21 px
partaient donc mesurées à 3:1, 3,19:1 au pire cas du balayage, sur un plancher que
l’audit accorde à la TAILLE — 24 px, ou 18,66 px en gras — et un mur de code n’est
ni l’un ni l’autre. Grossir le texte n’est pas l’issue : 64 caractères, le plafond
que le schéma pose sur une ligne, à 24 px font 921 px pour 906 px de mesure sûre
en `9:16`, et une ligne de code qui se replie est un autre programme à l’écran.
C’est donc le run qui a bougé. `panelText` est du texte courant à pleine force sur
le panneau, `panelBody` reste l’assourdi, et `plain`, `muted` et `accent` sont
trois rôles sur quatre runs plutôt que trois rôles ajustés à trois. Ça ne coûte
rien aux trois autres — un panneau opaque n’a pas de voile à partager — et il a
toujours une réponse là où `panelBody` en a une, puisqu’assourdir une encre la
mélange VERS la surface contre laquelle on la mesure.

Ces deux-là forment une famille à part, `setPiece`, et la famille n’est pas
décorative non plus : les six autres groupent les blocs par ce qu’ils SONT,
celle-ci les groupe par ce qu’ils COÛTENT. Ce dernier mot mérite d’être précis,
parce que la moitié de ce qu’il voulait dire est désormais bornée par
l’arithmétique. Le canevas d’un `solidScene` est une part de la boîte PROPRE du
bloc — voir plus bas — et une boîte est une part de la zone sûre : une scène qui
en nomme huit dessine ce que dessine une seule image, et
`tests/video-composed-frame.test.js` le prouve au lieu de le demander. La facture
de rendu est donc plafonnée quoi qu’un fournisseur fasse du conseil. Ce qui ne
l’est pas, et ce à quoi sert le prompt, c’est l’ATTENTION : chacun de ces deux
blocs est une scène entière, « au plus un dans tout le film » est donc une règle
éditoriale, et la fiche dit qu’un set piece entassé dans une pile ne devient pas
cher — il devient petit, ce qui est un moteur de rendu entier occupé à dessiner
une vignette.

#### L’image en perspective, et le pont entre la bibliothèque et un moteur de rendu

Tous les blocs 3D ci-dessus dessinent une FORME. `photoStage` et `photoRing`
dessinent une IMAGE — une image que l’utilisateur a choisie, posée sur un panneau
en perspective réelle, ou plusieurs sur un carrousel qui tourne devant la caméra.
C’est l’usage commercial de cette capacité et celui qui rentabilise le mieux son
coût : une photographie sur un panneau qui tourne, c’est ce dont un film produit
est fait, et c’est la seule paire de blocs du catalogue dont le sujet vient de la
bibliothèque d’images plutôt que d’une énumération fermée.

**Rien dans `blocks/` ne peut importer `three`, et une texture est un objet, pas
une balise.** Tous les autres blocs 3D renvoient des intrinsèques nues — `<mesh>`,
`<boxGeometry>` — que le réconciliateur résout à l’exécution, ce qui laisse le
registre entier chargeable dans la suite vitest de Mocky, où ni `three` ni Remotion
ne sont installés. Un `map` ne s’écrit pas ainsi : c’est une `THREE.Texture`, et il
faut bien que quelque chose la construise. Le chargement se fait donc là où le
canevas est déjà ouvert. `worker/video/remotion/textures.js` est le seul fichier du
moteur qui importe `three`, `ComposedSceneVideo` l’appelle une fois par scène, et
les images arrivent au bloc dans une prop `textures` exactement comme les chemins
préparés y arrivent déjà dans `images`.

**`delayRender` seul n’aurait pas suffi, et la raison est propre à un bloc 3D.** La
GÉOMÉTRIE du panneau est dérivée de la forme de l’image — la plaque prend le
rapport de la photographie, donc rien n’est recadré et rien n’est étiré — ce qui
veut dire qu’un composant rendu avant le décodage calcule ses dimensions sur une
valeur de repli. Libérer l’image à cet instant capture une image dont le matériau
est juste et dont la plaque a la mauvaise forme ; et Remotion rend beaucoup
d’images par page en concurrence, donc ce repli tomberait sur l’image par laquelle
une page a commencé : un film qui diffère entre deux rendus d’un même document, que
le magasin adressé par contenu range alors comme deux films. L’image est donc
libérée depuis un EFFET qui s’exécute après un rendu où les images sont présentes —
charger, marquer, re-rendre, continuer — et une scène sans image continue tout de
suite plutôt que d’attendre rien.

**L’ajustement est en forme close, parce que la seule chose qu’un bloc 3D rate sans
qu’aucun relecteur le voie, c’est la géométrie.** Un bloc plat qui déborde se voit
sur une capture ; un panneau qui fait passer son coin proche au-delà du frustum se
voit à l’image deux cent quatorze d’un mp4 que personne n’a regardé jusqu’au bout.
La caméra est en `(0, 0, d)`, donc un point est dedans quand
`|y| ≤ (d − z)·tan θ`, et mettre l’objet à l’échelle `s` donne
`s·(|y| + z·tan θ) ≤ d·tan θ` — linéaire en `s`, donc la plus grande échelle légale
est un minimum sur les coins, sans aucune recherche. `frustumScale` est ce minimum,
résolu sur TOUT le mouvement et non pour une pose (un panneau ajusté à la pose du
moment grandirait et rapetisserait au fil de sa scène), et `stage.test.js` redérive
la projection depuis sa définition et vérifie cent un instants contre un ajustement
échantillonné sur quarante et un.

L’objectif découle de la même inégalité. La part du cadre qu’un panneau peut
occuper vaut `|y| / (|y| + z·tan θ)`, qui MONTE quand l’objectif s’allonge — `z`
est de combien un coin tourné se penche vers la caméra et `tan θ` est ce que ce
penchement coûte. Au 45° de `solidScene`, une carte qui se retourne compose son
image à 45 % de son canevas ; à 30°, le même retournement compose à 60 %. Un grand
angle rendrait cette famille à la fois plus petite et plus laide, puisqu’il
transforme un rectangle en trapèze dont les deux bords verticaux sont visiblement
de longueurs différentes — c’est pour cela que tous les catalogues du monde
photographient leurs objets autour d’un 85 mm, et c’est pour cela qu’un
`photoStage` se voit à 30°. Un anneau en reçoit un plus long encore, 18°, pour une
raison qui lui est propre : le panneau de devant se tient un rayon entier plus près
de l’objectif que l’origine où le frustum a été mesuré, et à 30° cela seul mettait
un carrousel de six images au tiers de son canevas.

**Trois choses étaient fausses sur l’anneau et c’est une image rendue qui l’a dit,
dans cet ordre.** Dimensionné sur la PLUS LARGE de ses images, un carrousel de cinq
captures dont une bannière d’en-tête demandait un anneau presque deux fois plus
large que ce dont les autres avaient besoin, et revenait comme une rangée de points
dans un cadre noir — un anneau a donc UNE case, la médiane des formes des images
bornée dans une bande qu’un carrousel peut tenir, et une valeur aberrante coûte une
marge au lieu du bloc. Construits à cette case, les panneaux étaient cinq plaques
d’accent saturé avec une photographie encastrée dans chacune — le corps ÉPOUSE donc
sa propre image, et le liseré est l’ornement plutôt que le bloc. Et comme les
panneaux regardent vers l’extérieur, deux ou trois d’entre eux montrent leur dos à
la caméra à chaque instant, ce qui est encore l’accent à la taille d’un panneau —
l’image d’un anneau est donc dessinée aussi au revers, tournée d’un demi-tour
autour de son propre axe pour se lire à l’endroit et non en miroir. Ce sur quoi
l’ajustement est résolu, c’est la boîte qui contient réellement les panneaux et non
la case qui les borne : un anneau de trois bannières mis à l’échelle comme si
chacune était une carte pleine, ce sont trois barres fines au milieu d’un cadre
vide.

**Et une quatrième, que seul un cadre VERTICAL montre.** Un anneau est un cercle
horizontal : vu des sept degrés au-dessus qui séparent un carrousel d’une rangée de
panneaux qui glissent, il se projette en une ellipse plate — il dépense de la
mesure et laisse de la hauteur. C’est exactement juste dans un 16:9 et c’est le
petit élément dans un grand vide dans un 9:16 : un carrousel de trois, seul sur un
cadre vertical, dessinait 78 % de la largeur et **21 % de la hauteur**, une bande de
timbres au milieu d’une colonne de fond. La réparation est celle qu’un photographe
ferait et ce n’est pas un degré de liberté de plus : `ringTilt` lit la forme du
CANEVAS — un fait sur le cadre, jamais sur le film — et ouvre l’inclinaison à 26°
sur le rapport vertical, si bien que le cercle devient une ellipse plus haute et
que les panneaux du fond se tiennent au-dessus de ceux de devant au lieu de
derrière. Un canevas horizontal garde exactement l’inclinaison qu’il avait,
l’ajustement se résout à l’inclinaison qu’on lui donne, et la hauteur mesurée est
passée de 21 % à 30 % du cadre. C’est une amélioration et non une guérison : un
carrousel horizontal seul sur un cadre vertical reste un objet large dans une boîte
haute, et le conseil honnête y est un `photoStage`.

**Ce qu’ils coûtent, mesuré sur vingt secondes de film dans le conteneur à deux
cœurs, contre un titre simple.** Le meilleur temps de chaque série plutôt que la
moyenne, parce que la machine faisait autre chose en même temps : `solidScene`
ancre la colonne à +0,90, qui est le chiffre déjà écrit dans ce document, donc
tout le reste lui est comparable.


| scène | Δ secondes de rendu par seconde de film | sortie |
|---|---|---|
| contrôle — un titre simple | — | 1,75 Mo |
| `photoStage`, plein cadre, carte montée, en orbite | **+0,18** | 2,09 Mo |
| `photoStage`, plein cadre, dans un boîtier, qui se retourne | **+0,19** | 2,12 Mo |
| `gallery` plate de six, plein cadre | +0,26 | 4,58 Mo |
| `solidScene`, sphère éclairée plein cadre | +0,90 | 2,10 Mo |
| `photoRing` de six, plein cadre, sans borne | +2,24 | 6,98 Mo |
| `photoRing` de six, plein cadre, dans son budget | **+1,35** | 6,19 Mo |

Une scène produit est le bloc 3D le moins cher du catalogue — un cinquième d’un
solide — et un anneau de six en plein cadre est la chose la plus chère qui s’y
trouve. La `gallery` plate est la ligne qui a décidé quoi en faire : six captures
sur une image coûtent quatre mégaoctets et demi de h264, et toute cette facture
d’encodeur fait 0,26 s/s — les deux et quart d’un anneau ne sont donc pas les
images encodées mais les images ÉCHANTILLONNÉES : dix-huit quadrilatères texturés
aux angles rasants où un rastériseur logiciel est le plus lent. Ce coût baisse avec
la résolution à laquelle on le dessine : un anneau est donc dessiné dans
`RING_PIXEL_BUDGET` puis repeint sur sa boîte, exactement comme un champ ; il tombe
sur les mêmes six cent mille pixels que `field.js`, ce qui n’est pas une constante
partagée mais le même rastériseur dans le même conteneur atteignant le même
compromis depuis deux blocs différents. Il ne tombe pas à zéro — environ 0,9 s/s de
géométrie et d’encodage qu’aucun budget ne touche — c’est donc une borne et non un
remède, et la fiche dit que l’anneau est le bloc cher. Un anneau dans une CELLULE
est très en dessous du budget et se dessine à sa taille exacte, au pixel près.

**L’anisotropie est le seul réglage d’échantillonnage choisi en mesurant.** Un
panneau tourné loin de la caméra est exactement le cas qu’une texture mipmappée
sans elle rend comme une bavure floue sur un axe — le « mou » dont parle
`resolution.ts`, arrivant par un échantillonneur au lieu d’une source trop petite.
Ce n’est pas gratuit et le coût n’est pas là où on le croit : une scène en orbite
est dans le bruit à tous les réglages, tandis qu’une carte qui se RETOURNE balaie
les angles rasants où le nombre de prélèvements complet se déclenche, et a mesuré
20,1 s à seize prélèvements, 16,0 à quatre et 13,4 sans, contre un contrôle à
12,3 s. Quatre est l’endroit où cette courbe cesse d’en valoir la peine.

**Leur lisibilité est close des deux côtés, et le second est la raison d’être de
`picture`.** Le corps — le liseré, le montage, le boîtier, le dos d’une carte —
est `palette.solid` : le run de l’ornement résolu sur le fond nu et ombré le long
du segment de Lambert que mesure `solidShading`. L’autre moitié est la
PHOTOGRAPHIE, et `solid` seul disait « le corps du panneau » quand un titre se
tient sur l’IMAGE — le panneau est ce qui la porte. Un export réel de cette scène
exacte, un `heading` sur un `photoStage` ancré `full`, a livré du blanc sur du
bois clair à 1,68:1. `FIELD_PAINTS` nomme donc les deux blocs `solid` ET
`picture`, et la photographie est bornée au noir et au blanc, la densité de la
zone étant ce qui cède — voir la section lisibilité pour tout l’argument. Aucun des
deux blocs ne pose de texte sur une image : une légende appartient à un `kicker`
dans une zone à lui, sur une surface que quelqu’un a calculée.

#### Du type en trois dimensions, et les deux choses refusées pour l’obtenir

La troisième chose demandée à la 3D est la première que tout le monde en fait :
un titre extrudé, un logotype qui prend de l’épaisseur, des lettres qui arrivent
dans l’espace et se posent. `extrudedType` est ce bloc, et il est dans `setPiece`
avec les deux autres — une ligne de texte, vingt-quatre caractères au plus, posée
dans une vraie scène et qui y tourne.

**Il n’y a aucune géométrie de glyphe dans ce conteneur, et le paquet qui en
apporterait apporte aussi sa propre police.** La façon évidente d’extruder une
lettre est `ExtrudeGeometry` sur son contour, ce que fait `<Text3D>` de
`@react-three/drei`. Il a été mesuré avant d’être refusé, exactement comme Skia :
**+118,9 Mio installés et +59 paquets** sur une base de 185,9 Mio, soit une
installation 64 % plus lourde pour un bloc. C’est la moitié la moins chère de
l’objection. `Text3D` ne lit pas une police système — il lui faut un
`typeface.json`, un vidage de contours converti et cuit dans l’image — et ce
conteneur n’installe qu’UNE famille. Chaque bloc plat du catalogue nomme d’abord
la police DÉCLARÉE par la direction et retombe sur Liberation Sans, ce qui est la
façon dont « le projet a demandé du Cormorant Garamond » devient du texte lisible
dans un conteneur sans sortie réseau. Un jeu de contours cuit ne sait pas faire
cela : un titre 3D serait en Liberation Sans sur tous les thèmes du produit
pendant que le titre à côté de lui respecterait la direction artistique. Un film
en deux polices, c’est le jeton deviné que `theme.ts` refuse, arrivé par un
paquet.

Le texte est donc rastérisé par le navigateur qui dessine déjà l’image, dans la
pile de polices du projet, et la troisième dimension est de la vraie géométrie qui
le porte : un quad texturé par MOT pour la face, une copie dilatée derrière pour
l’épaisseur, une vraie caméra en perspective, une vraie rotation. `funTitle` est ce
que Skia est devenu sans le paquet ; ceci est ce que `Text3D` est devenu sans le
sien.

**Le second refus est la lettre, et c’est celui que les mesures ont fait.** La
première version empilait dix copies de chaque LETTRE, ce qui est la lecture
évidente de « des lettres qui arrivent dans l’espace ». Même banc que partout
ailleurs ici — l’image du worker, `--cpus=2.0 --memory=4g`, 1080p/30, six secondes
de film, les réglages d’encodeur d’`encoding.js` :

| Scène | rendu | Δ s/s (banc) | Sortie |
|---|---|---|---|
| contrôle (un titre plat) | 13,2 s | — | 0,65 Mo |
| `solidScene`, sphère, plein cadre | 20,8 s | +1,26 (l’étalon) | 0,88 Mo |
| ~~16 lettres × 10 copies = 176 objets~~ | 75,1 s | **+10,3** — refusé | 0,93 Mo |
| ~~16 lettres × 2 copies = 48 objets~~ | 32,1 s | **+3,1** — refusé | 0,99 Mo |

Deux points sur une droite passant par le nombre d’OBJETS : 0,084 s de rendu par
seconde de film et par objet, et un terme de remplissage qui se résout NÉGATIF —
dans un rastériseur logiciel la facture est le changement d’état par objet, pas
les pixels. Les 1,7 s/s que l’échéance proportionnée à la durée laisse libres font
environ 2,4 s/s sur ce banc, soit vingt-huit objets. Une ligne de seize lettres à
dix copies en fait 176, et une de vingt-quatre à deux copies en fait 72 : **la
géométrie par glyphe n’entre pas, et aucun nombre de copies ne l’y fait entrer.**
Elle est refusée avec son chiffre, exactement comme le fil de fer.

L’objet est donc un MOT — trois au plus, `SPATIAL_GROUPS` — et la couture entre
deux copies est fermée par une DILATATION plutôt que par le nombre : chaque copie
est tracée du pas qu’elle fait, si bien qu’une seule copie derrière la face donne
un flanc plein. Six objets, quoi que dise la ligne. Ce que cela rachète au passage
est le crénage dessiné avec la police, qu’une ligne posée lettre par lettre perd à
chaque paire.

| Scène | rendu | Δ s/s (banc) | **Δ s/s (échelle de ce document)** | Sortie |
|---|---|---|---|---|
| contrôle (un titre plat) | 12,1 s | — | — | 0,65 Mo |
| `solidScene`, sphère, plein cadre | 19,6 s | +1,25 | **+0,90** (l’étalon) | 0,88 Mo |
| `extrudedType`, plein cadre, `deep` | 18,9 s | +1,13 | **+0,81** | 0,97 Mo |
| quatre d’entre eux, un par coin | 23,5 s | +1,91 | **+1,37** | 1,63 Mo |
| le même bloc sur 30 s de film | 82,5 s | +0,93 | **+0,67** | 4,32 Mo |

**Environ +0,8 s/s**, soit 0,90 de ce que coûte un solide éclairé mesuré dans la
même passe, additif et linéaire en durée — la ligne à trente secondes est le même
nombre mesuré sur cinq fois plus d’images — et une fois et demie le débit d’un
titre là où le fil de fer refusé faisait seize fois son contrôle. Quatre d’entre
eux sur une image tiennent encore, ce que la mise en page donne gratuitement à
cette famille : un canevas est la BOÎTE du bloc, donc une scène chargée ne devient
pas chère, elle devient petite.

**Trois bornes font tout le bloc, et chacune est un défaut qu’une image rendue a
trouvé.**

Un objectif long, parce qu’un grand angle déforme une ligne de texte : à douze
degrés de champ, le bout proche d’un balancement de sept degrés revenait 14 % plus
grand que le bout lointain sur la ligne la plus large que le schéma accepte — un
mot composé à deux tailles, ce qui se lit comme une faute et non comme de la
profondeur. Le champ est de quatre degrés désormais, et au-delà le rendement
s’arrête : c’est donc la LIGNE longue qui se balance moins, exactement de ce qu’il
faut pour tenir la déformation à cinq pour cent, avec un plancher dessous parce
qu’un film où rien ne bouge ne doit pas être produisible par accident.

L’arrivée est une PROFONDEUR et jamais une opacité, et les mots viennent de
DERRIÈRE. Un mot qui arrive de devant le plan est grossi par la caméra sur ses
premières images et dessine hors de la boîte que la mise en page a donnée au bloc
— la leçon de `funTitleHeadroom` arrivée par une caméra plutôt que par un
rembourrage — et un fondu peindrait chaque mot, le temps qu’il dure, dans une
couleur composée de l’encre et du fond que personne n’a mesurée. Même argument que
`heading` pour son masque et `solidScene` pour son échelle. Le troisième des trois
mouvements est une profondeur pour la même famille de raisons et pour une autre :
tout ANGLE se paie dans le trait qui ferme la couture, et une rotation par mot de
quatorze degrés posait un anneau de neuf pour cent du cadratin autour de chaque
mot, ce qui bouche l’ouverture d’un `e`. `float` fait donc respirer les mots en
profondeur, et cela ne coûte rien à dessiner.

Et le bloc s’agrandit jusqu’à ce que `blockExtent` annonce pour lui. L’estimation
qui a résolu la taille arrondit chaque classe de glyphe vers le haut et ajoute six
pour cent par-dessus, ce qui sur une ligne qui se replie disparaît dans le repli et
ici ne le peut pas : une image rendue est revenue avec `MOTION EN RELIEF`
occupant 74 % de la mesure sur laquelle sa boîte avait été divisée, un quart du
cadre vide à côté d’un titre. C’est le petit élément dans un grand vide arrivé par
une estimation. La ligne est agrandie jusqu’à remplir l’annonce et jamais au-delà —
l’annonce est ce sur quoi `stackIn` a divisé la zone, donc cela récupère du mou et
ne prend jamais un pixel à un voisin.

Deux entrées ailleurs en découlent. `FIELD_PAINTS` gagne une troisième réponse,
`type` : ce bloc peint l’encre d’affichage sur la face de chaque mot et l’accent
derrière, donc un champ mesuré comme l’accent seul laisserait la plus grande encre
de l’image non mesurée, et un champ mesuré comme rien du tout est la rencontre à
1:1 que toute la section lisibilité existe pour avoir empêchée. Et
`blocks/canvases.js` est un fichier nouveau : quels blocs ont besoin d’un canevas
GL, sa taille et la caméra qui y regarde étaient une branche dans
`ComposedSceneVideo`, soit une branche par bloc 3D dans un fichier que chaque
auteur de bloc aurait alors à éditer.

#### Une zone, et un rang

Deux champs voyagent sur chaque bloc sans exception, et tous deux sont la règle
fondatrice appliquée à la mise en page.

**`anchor` est une zone**, l’une des neuf cases d’une grille 3×3, plus `full`.
Une coordonnée serait une mise en page décrite par le modèle : elle dépend d’une
taille d’image que le document ne voit pas, et elle n’a aucune réponse dans les
deux formats pour lesquels elle n’a pas été écrite. Deux blocs ancrés à la même
zone **s’empilent** dedans, dans l’ordre où le document les liste — c’est ce qui
permet à `anchor` de valoir `center` par défaut sans que rien ne se pose sur rien,
et c’est `ComposedSceneVideo` qui décide de l’empilement, jamais le document.

**`enter` est un rang, pas un délai.** Une milliseconde supposerait que le modèle
connaisse `cueFrames`, `MIN_CUE_TAIL_FRAMES` et la durée de la scène pour placer
une arrivée qui tombe à l’intérieur de sa scène, et il n’en connaît aucun des
trois. Un rang dit « ceci vient après cela », ce qui est la seule part du
minutage qui soit une décision éditoriale ; le rythme, c’est `layerCues`, c’est-
à-dire `cueFrames` sous un autre nom. Deux blocs de même rang arrivent ensemble :
un titre et son filet sont une seule arrivée, au prix d’un entier répété.

Un rang **absent** signifie « la position où il a été écrit », et ce défaut est
la leçon de `kenBurns: 'static'` répétée : un champ facultatif est un champ que le
modèle omet, donc le cas obtenu en ne disant rien doit être le bon. Zéro aurait
fait de chaque document silencieux un tas.

#### Une zone est une boîte, et la boîte est de l’arithmétique

`composedLayout` traduit ces zones en pixels, dans `composition.js` et non dans la
composition, pour la raison qui met tout le reste là-bas : un `padding: '6%'` sur
une grille CSS dessine une image plausible et ne peut pas répondre à la question
« est-ce que quelque chose a franchi la marge ». Trois choses en découlent.

**La marge est par axe, et une image portrait n’hérite pas de celle du paysage.**
Un pourcentage dans un `padding` CSS se résout sur la *largeur* pour les quatre
côtés, ce qui posait une marge de 65 px sur le bord de 1920 px d’une image 9:16 et
une de 115 px sur le bord de 1080 px d’une 16:9 — à l’envers dans les deux cas, à
partir d’un nombre qui avait l’air symétrique. Et 6 %, c’est une marge de
diffusion : la bonne réponse pour une image sur laquelle rien n’est dessiné, la
mauvaise pour le format qui existe pour être publié. Un export composé en 9:16
laisse libres les bandes du fil — `VERTICAL_SAFE_TOP_PERCENT`, `_BOTTOM_` et
`_SIDE_`, les nombres du gabarit vertical plutôt qu’un second jeu qui dériverait
d’eux — parce qu’un bloc `bottom-center` dans une marge de 6 % n’y est pas près du
bord, il est derrière un bouton. Le carré ne paie ni l’un ni l’autre : le 1:1 se
publie dans une grille, et un cinquième de sa hauteur cédé à une interface que
personne ne dessine, c’est un cinquième du film.

**Et la marge comprend la dérive, ce qui pendant deux passes n’était pas le cas.**
Une scène composée translate toute sa pile de `motion.drift × base`, de la moitié
de `COMPOSED_BLOCK_DRIFT` vers le bas à la première image d’une scène jusqu’à la
même distance vers le haut à la dernière. Les boîtes pavaient exactement la zone
sûre : le premier bloc de la bande haute franchissait donc le haut de la zone à la
fin de chaque scène, et un bloc ancré en bas franchissait le bas au début — 8,6 px
sur une image de 1080 lignes. C’est un corpus rendu qui l’a trouvé : l’encre de
quatre exports sur fond uni commençait 5 à 6 px au-dessus de la marge aux trois
quarts d’une scène, soit `(0,5 − 0,75) × 0,016 × 1080` au pixel près. Rien n’était
rogné pour autant, et ce n’est pas la question — 6 % d’une image paysage font
65 px — mais la marge est une promesse sur le logiciel de quelqu’un d’autre, et en
9:16 la bande du dessous est la rangée de légende du fil, pas de la surbalayage.
Donc `composedFrame` est la zone sûre moins `driftRoom(base)` sur chacun des deux
bords vers lesquels la pile bouge, et `composedLayout` compose là-dedans ;
`composedSafeArea` reste la promesse, pour qu’un test puisse dire « les boîtes sont
dans le cadre » et « le cadre plus la dérive est dans la promesse » en deux phrases.
C’est l’échange qu’`overlay` fait déjà avec sa propre amplitude : un mouvement a
droit à la place que la mise en page lui laisse.

**Et la dérive n’était pas tout le mouvement d’une scène.** Le même défaut, une
amplitude plus loin, trouvé de la même façon et sur un témoin sans aucun bloc 3D :
`imageFrame` sur `dateStamp` en 9:16, et l’encre du tampon passait sous le bas de
la zone sûre à chaque image où il arrivait encore. Tout bloc de ce catalogue qui
arrive arrive PAR LE BAS — `ENTER_RISE` vaut une demi-ligne de texte courant, 26 px
sur cette image, contre les 9 de la dérive — et personne n’avait acheté cette place.

`BLOCK_ENTER_TRAVEL` est l’amplitude, sous forme de table, parce que les cinq
familles qui ont une entrée la mesurent contre des choses différentes : une
demi-ligne pour les blocs média, un cinquième de la taille du RUN pour ceux de
texte, un vingtième de sa propre boîte pour une notification. Ce sont des miroirs
de constantes qui vivent sous `blocks/` — `composition.js` ne peut pas importer un
bloc, puisque `blocks/media.js` l’importe — et `composition.test.js` tient chaque
ligne contre son original, l’arrangement qu’ont déjà `contrast.js` et
`server/video/timeline.js`.

La réservation est celle de la SCÈNE et non de la bande, et l’écart se mesure :
prise sur la seule bande basse, une bande de 105 px en payait un quart et le tampon
revenait aux trois quarts de sa taille ; prise sur la grille, elle vaut 2 % de
l’image répartis sur toutes les rangées, ce que la dérive coûte déjà. Seule la
dernière bande occupée est mesurée, parce que c’est la seule qui finit sur le bas
du cadre, et seulement si aucun pied n’est réservé — la bande de légende qu’un
champ déclare est déjà entre les cellules et le bord. Une zone `full` paie la
sienne sur sa propre boîte, n’étant dans aucune bande. Ce qui est absent de la
table est aussi une décision : `funTitle` voyage vers le HAUT d’un tiers de son
type et a acheté la place dans son propre appétit (`funTitleHeadroom`), ce qui est
le meilleur correctif et appartient au bloc ; `heading`, `kicker` et `lowerThird`
révèlent leur type depuis derrière un masque, et tout le reste arrive par opacité
ou par échelle.

**Une rangée se partage entre les colonnes qui servent, et une bande entre les
rangées.** Une grille 3×3 de tiers égaux est la lecture évidente de « neuf zones »,
et elle rend illisible la scène la plus courante qui soit : `anchor` vaut `center`
par défaut, donc un document qui n’en nomme aucune met tout dans une seule case —
et un tiers d’une image 16:9 fait 563 px de large, soit cinq caractères de titrage
sur une ligne, et 295 px de haut, soit une pile dimensionnée pour un tiers d’image
avec les deux autres tiers vides. Une colonne occupée prend toute la mesure, deux
en prennent la moitié chacune, trois prennent des tiers, et la même arithmétique
descend sur l’autre axe. L’alignement continue de dire sur quel bord le contenu se
pose.

Les rangées étaient fixes au début, et l’asymétrie était délibérée : le bord ancré
d’une bande est déjà le bord sûr, donc une pile trop haute pour sa bande débordait
vers le milieu de l’image plutôt qu’au-delà du bord auquel elle était ancrée.
C’était un argument sur le DÉBORDEMENT, et il a cessé de valoir le jour où la
taille de texte d’une pile s’est résolue contre sa propre bande — une pile qui ne
peut pas être plus haute que sa bande n’a pas besoin qu’on garde deux tiers de
l’image vides au cas où. Ce qui en survit, c’est l’alignement, qui décide
maintenant de quel côté part le reste.

**Et les bandes se partagent selon la FAIM, pas également entre les rangées.**
`stackIn` partage une zone ainsi depuis qu’un `separator` au-dessus d’un `heading`
prenait la moitié d’une colonne pour trois pixels d’encre ; la grille, elle,
continuait de partager selon le nombre, ce qui est le même défaut un cran plus
haut. Un surtitre, un titre avec son filet et un logotype, c’est trois rangées
occupées et trois bandes égales — donc trois quarts de la bande du haut vides, et
le titre du film résolu contre un tiers d’image alors qu’il en restait deux. L’air
est la moindre moitié de ce que ça coûte : une pile remplit la boîte qu’on lui
donne, donc une bande trop grande est une unité typographique trop grande, et
l’export qui l’a montré avait un `logoType` dans la bande du bas à trois fois le
`heading` de celle du milieu. Le poids d’une rangée est celui de sa cellule la plus
AFFAMÉE et non leur somme, parce que les colonnes d’une rangée sont côte à côte.

La conséquence est celle qui simplifie tout le reste de cette section : des bandes
pondérées font que chaque zone lit la même unité *par construction*, puisque
chacune reçoit `hauteurSûre × (sa part de ce que la scène a demandé)`.
`harmoniseUnits` ci-dessous range alors un reste au lieu de sauver une image.

**Et une bande n’est jamais plus grande que ce que sa pile peut DESSINER, qui
n’est pas le même nombre que ce qu’elle veut.** Un appétit est une envie ;
`shapeCeiling` est l’endroit où une ligne de type cesse de grandir, parce qu’un mot
est borné par sa MESURE et non par sa boîte — `RELIEF` en titrage sur 906 px fait
195 px de type et il n’en existe aucune version plus haute qui garde le mot
entier. Pendant une passe les deux ont été lus comme un seul nombre : une pile
bornée par la mesure demandait une bande sur son appétit puis en dessinait un
cinquième, et les quatre cinquièmes étaient pris aux blocs d’à côté, qui en
avaient l’usage. `waterFill` plafonne chaque bande à ce que sa pile peut dessiner
et rend le surplus aux bandes qui savent le dépenser, avec les mêmes poids, en
répétant parce qu’en donner plus à une piste peut la faire passer à son tour
au-dessus de son propre plafond.

**Quand aucune bande ne peut le dépenser, l’image vide est celle du DOCUMENT.**
C’est le reste de la réponse au témoin 9:16 de cette passe : un `extrudedType`
portant le mot `RELIEF` seul sur une image portrait en dessine 7 % de la hauteur,
et aucun agencement de boîtes n’y change rien. Une ligne de type a un rapport de
forme — caractères × chasse de large, une interligne de haut — et une zone sûre en
9:16 en a un autre ; un seul des deux peut être rempli, et `fills: 'either'` dit
déjà quel axe appartient au contenu. Agrandir le type demande de couper le mot, ce
que `wordCeiling` refuse parce qu’une image rendue a montré à quoi cela ressemble,
ou de franchir la marge sur laquelle un fil dessine sa propre interface. Il n’y a
pas de troisième levier.

Ce que la mise en page doit n’est donc pas un sauvetage : c’est que personne ne
PAIE ce vide. La boîte du bloc est sa propre étendue, donc `BOX_FILL_FLOOR` se
mesure contre quelque chose de réel ; la bande est bornée par ce qu’on peut y
dessiner, donc aucun voisin ne paie ; et le cadre autour appartient au fond.
`composition.test.js` le dit en arithmétique plutôt qu’en prose — la même forme
résolue dans une boîte dix fois plus haute répond le même unit, ce qui prouve que
la hauteur n’a jamais été ce qui la bornait.

**`full`, c’est la zone sûre et non l’image**, et deux blocs `full` la partagent.
Un fond qui filerait jusqu’au bord de l’image, ce serait une carte rognée par la
surbalayage et une galerie dont la dernière rangée passe sous une zone de légende
— les deux échecs que la marge existe pour empêcher, arrivant par la seule ancre
qui s’en exempte. Il est peint en premier, sous les neuf cases, parce qu’une carte
ou une onde est ce sur quoi un élément *se pose*.

**Et un champ revendique toutes les bandes, parce que les pistes qu’un partage
supprime doivent être VIDES.** Un bloc seul prend toute la mesure parce que rien
n’est à côté de lui, et toute la hauteur parce que rien n’est au-dessus ; un bloc
ancré `full` rend la seconde moitié fausse, puisqu’il est peint sur toute la zone
sûre, sous les neuf cases. Il n’occupe aucune case, donc le partage ne le voyait
pas : une scène d’un `equalizer` et d’un `kicker` donnait au kicker la zone sûre
entière et rendait un surtitre en 200 px de capitales par-dessus le graphique dont
il était le surtitre — le plus petit rôle de la scène en plus gros élément de
l’image. Avec un champ sur l’image, les bandes sont les trois de la grille. Les
colonnes, elles, continuent de se partager, et cette asymétrie est la différence
entre les deux axes plutôt qu’un goût : la hauteur d’une boîte fixe la TAILLE du
texte et sa largeur fixe la MESURE, donc une ligne qui court sur toute la largeur
d’un champ fait ce qu’une ligne posée sur un champ doit faire, tandis qu’un bloc
qui prend toute la hauteur prétend être la scène — et la scène, c’était le champ.
Un champ qui est le SEUL bloc d’une scène prend toujours tout, et c’est le cas que
le correctif devait laisser intact.

`tests/video-composed-frame.test.js` est l’endroit où tout cela devient une
affirmation plutôt qu’un texte : sur le document le plus pauvre que le schéma
accepte et sur un autre qui utilise les dix zones, dans les trois formats, chaque
bloc est placé exactement une fois, chaque boîte — celle de la zone et celle de
chaque bloc dedans — tient dans le cadre sûr, chaque bloc est arrivé avant la fin
de sa scène, et la dernière image diffère de la première.

#### Un bloc habite la boîte qu’on lui donne

Six vrais exports ont été rendus et regardés, et ils montraient un seul défaut
sous trois costumes. Un bloc dessinait à une fraction fixe du CADRE et ignorait la
boîte qu’on lui donnait : `equalizer` faisait `base * 0.18` qu’il soit ancré
`center` ou `full`, donc un champ occupait 18 % de la hauteur d’une image dont on
lui avait donné la totalité. Un `typewriter` seul dans une scène était une petite
ligne de texte au milieu d’un cadre noir ; un `counter` seul occupait un huitième
de l’image. Chaque scène était un petit élément flottant dans un grand vide — ce
que l’utilisateur appelait « rudimentaire » depuis le premier export.

La règle est en tête de `composition.js` et tient en trois phrases. **Une boîte par
bloc**, publiée par `composedLayout` dans `zone.layers[i].box`, jamais celle de la
zone répétée — c’est à soi seul le troisième costume, puisque huit blocs
`solidScene` ancrés `full` donnaient huit toiles de 589 px, soit 4712 px de contenu
dans 950 px de hauteur sûre. **Toute taille dessinée par un bloc sort de cette
boîte.** Et le seul usage légitime de la dimension du cadre est une **grandeur
constante** : ce qui doit être identique d’une scène à l’autre parce que le
spectateur y lit le même objet. Il y en a exactement trois — l’épaisseur d’un
filet, un rayon d’angle, les gouttières de la grille —, elles sont nommées dans
`CONSTANT_METRICS`, et chacune est bornée au quart de la boîte où elle est
dessinée, parce qu’une exception sans plafond, c’est la règle qui ressort par la
fenêtre.

**Une zone se partage selon la faim, jamais selon le nombre.** Une pile verticale
de N blocs dans une zone de hauteur H ne se partage pas en H/N, parce qu’un titre
veut de la hauteur et qu’un filet n’en veut presque pas : à parts égales, un
`separator` au-dessus d’un `heading` prend la moitié de la colonne pour trois
pixels d’encre. `BLOCK_APPETITE` est la table unique qui dit de quoi chaque kind
est fait, en unités de la taille du texte courant — les passages de texte, qui
sont repliés contre la mesure que la zone s’est trouvée, et le mobilier qui n’est
pas du texte. Les paliers sont argumentés dans la table même, et la première
version leur a fait répondre à la mauvaise question. « En dessous de quelle hauteur
est-ce que ça cesse d’être ce que c’est » est un PLANCHER — quatre lignes pour un
motif de barres, six pour un tracé, neuf pour une image — et un plancher est le bon
nombre pour partager une colonne, pas pour posséder une image. La faim d’un champ
est aussi le taux de change entre une boîte et une taille de texte : un `barChart`
qui vaut 6,4 unités et remplit 950 px de zone sûre déclare qu’une ligne de texte
courant fait 130 px, donc ses propres étiquettes d’axe sortaient à 85 px — une
rangée de `L M M J V S D` composée aussi grand qu’un titre — et un `kicker` posé
dessus héritait de la même échelle. Trois exports réels l’ont montré, et le mot de
l’utilisateur pour les trois était « rudimentaire ».

Le palier des champs est donc ce qu’un champ vaut quand il EST la scène, et le
nombre derrière est une densité : **une image qui porte vingt lignes de texte
courant est une image, celle qui en porte dix est une affiche.** Vingt-deux unités
en travers d’une zone sûre, c’est une ligne de texte à environ 4 % du petit côté et
une légende à 2,7 % — le surtitre que la maison a toujours dessiné. L’ORDRE reste
celui des planchers, donc rien n’a changé dans la façon dont deux champs se
partagent une colonne : 10 à 13 pour une onde et un equalizer, 15 pour un carrousel
et un cadran, 16 pour un graphique, 22 pour une carte, une galerie, une image et un
solide éclairé.

**Et il y a une seule échelle typographique.** `headingSize`, le chiffre du
compteur, la ligne du typewriter et le logotype étaient quatre fractions de `base`
décidées par quatre auteurs, ce qui faisait sortir un `counter` et un `heading`
empilés dans la même zone à 0,13 et 0,042 du petit côté — le chiffre écrasant le
titre d’un facteur trois, dans une image où personne n’avait demandé cette emphase.
Un rôle est désormais un ÉCHELON sur une échelle unique (`TYPE_ROLES` : display,
title, body, caption, figure, dans les rapports que le catalogue avait déjà), et
l’unité que ces échelons multiplient se résout par PILE contre sa zone plutôt que
de se lire sur le cadre. Deux blocs d’une même zone lisent donc une seule unité, et
le rapport entre eux est un rapport entre deux échelons.

La résoudre demande de savoir où une ligne va se couper, une mesure qu’un bundle
Remotion ne peut pas faire avant d’avoir mis en page et qu’un test ne peut pas
faire du tout. Ce n’est pas nécessaire : le conteneur installe une seule famille de
police, donc la chasse moyenne d’un glyphe est un nombre connu — `MEAN_GLYPH_EM`,
0,52. Ce n’est pas non plus une constante nouvelle : c’est celle sur laquelle
`verticalCaptionSize` avait été calibré à la main, retrouvée par ses deux extrémités
et écrite une fois, avec le test qui tient les deux d’accord. La taille est ensuite
la plus grande dont les lignes repliées tiennent encore dans la boîte, ce qui est
la leçon de `verticalCaptionSize` généralisée : une taille réglée pour que la plus
longue légende légale tienne rend toutes les courtes à la taille qu’il fallait à
une longue, et c’est la boîte qui fait cette arithmétique maintenant, plutôt qu’une
rampe entre deux nombres de caractères.

#### Un mot ne se coupe pas en deux

Un export a été rendu et photographié : `NEUF SEIZIEMES`, en display sur un cadre
9:16, qui se lisait `NEUF S` / `EIZIEME` / `S`. C’est la pire chose que cette
fonctionnalité puisse mettre à l’écran — tous les autres défauts de ce document se
lisent comme un titre trop petit ou une image timide, celui-là se lit comme un
logiciel cassé.

**La cause, c’est que `word-break: break-word` a été pris pour le modèle de
repli.** `textLines` empile des caractères contre une mesure, parce que c’est le
seul repli qu’une estimation sans navigateur sache prédire, et la déclaration a été
posée dans chaque bloc pour qu’un navigateur fasse la même chose. Il ne la fait
pas : CSS met un mot trop long sur une ligne à LUI, et ne le coupe à l’intérieur
que s’il ne tient toujours pas. L’estimation a donc trouvé une taille où quatorze
caractères tiennent sur deux lignes, `SEIZIEMES` ne tenait pas sur l’une d’elles,
et le navigateur a fait la seule chose qui lui restait. La déclaration avait raison
sur ce que fait un navigateur et tort sur ce que lit un œil.

La règle typographique est l’inverse : **un mot ne se coupe pas, donc la taille
doit être assez petite pour que le plus long tienne dans la mesure.** C’est une
borne, exactement comme celle qu’une ligne insécable pose déjà sur une forme, et
c’est une seule borne dans `composition.js` (`wordCeiling`, repliée dans
`shapeCeiling`) plutôt qu’une règle dans vingt-sept composants. La famille des
cartes garde son propre appel, contre la largeur qui reste à une carte une fois sa
gouttière payée, et c’est la seule chose locale là-dedans.

**Deux choses ont dû bouger avec elle, et les deux étaient des défauts latents
plutôt que des concessions.** Une ligne était mesurée à la chasse moyenne d’une
phrase dès qu’elle se repliait, et `NEUF SEIZIEMES` se compose réellement à
0,73 em par glyphe — une borne calculée sur 0,52 aurait donc été une borne qui ne
change rien, et le nombre de lignes était faux des mêmes 40 % avant que quiconque
parle de mots. `runAdvanceEm` mesure désormais chaque ligne sur ses propres
glyphes ; `meanAdvanceEm` est planchée à `MEAN_GLYPH_EM`, donc une phrase ordinaire
répond exactement ce qu’elle répondait, et les seules lignes qui bougent sont
celles sur lesquelles la moyenne avait tort. Et `textLayout` mettait à l’échelle
son mobilier et son air sur l’unité qu’on lui DONNAIT tout en comptant ses lignes
sur l’unité que la forme pouvait DÉPENSER — identiques tant que les quatre blocs de
texte n’avaient pas de plafond, deux blocs différents dès qu’ils en ont eu un.

**Le plancher est là où cela s’arrête, et ce qui se passe en dessous est une
décision et non un repli.** Un mot peut être plus long que sa mesure à toute taille
qui vaille la peine d’être lue : une URL, un mot composé allemand, un identifiant,
ou soixante-dix caractères de titre sans espace, ce que le schéma autorise. La
réponse ne peut pas être une unité qui tend vers zéro. La borne s’arrête donc à
`WORD_FIT_FLOOR_PX` — c’est-à-dire `BOLD_LARGE_PX`, les mêmes 18,66 px où
`harmoniseUnits` plafonne sa propre descente, parce que c’est la même question :
`palette.accent` et `palette.display` sont résolus au plancher 3:1 que l’audit
autorise pour du gras au-delà de cette barre, et une borne qui passerait dessous
aurait acheté un mot entier avec la licence sous laquelle la couleur a été choisie.
Sous le plancher, la ligne n’est **pas bornée du tout** — le bloc continue de
remplir la boîte que sa zone lui a donnée et `word-break` coupe le mot, ce qui est
la raison pour laquelle chaque type qui se replie porte encore la déclaration et
`blocks.test.js` l’exige toujours. Payer de la typographie pour un mot qui se
couperait quand même, c’est la règle de `texturedGround` sur une décoration
appliquée à l’échelle : elle cède devant un mot, et elle ne cède jamais pour rien.

**Et `BOX_FILL_FLOOR` a dû être reformulé plutôt qu’abandonné.** Un bloc borné par
son propre mot remplit sa MESURE exactement — c’est ce que dit la borne — et ce
qu’il rend, c’est de la hauteur. Sur les types dont la ligne réclame les deux axes,
cela fait une boîte remplie à moins des trois quarts, et c’est une conséquence
honnête plutôt qu’une régression : l’autre terme du choix est le mot coupé en son
milieu. Le balayage du catalogue est inchangé pour tous les corpus écrits en mots ;
c’est le balayage dégénéré qui vérifie la reformulation, un bloc seul dans chacune
des douze boîtes des trois formats, chaque chaîne légale réécrite en un seul mot de
la même longueur.

`composition.test.js` tient l’ensemble : tout le catalogue aux deux bouts du schéma
dans les trois formats, où aucun mot dessiné ne dépasse sa mesure ; le corpus
dégénéré, où les trois branches — bornée, mesure remplie, planchée — sont atteintes
au moins une fois chacune, de sorte qu’aucune moitié ne puisse devenir vide ; et la
borne elle-même, où doubler une mesure la double, ce qui est la raison pour
laquelle elle ne prend aucune marge absolue pour l’arrondi de `typeSize`. Cette
marge, ce sont les six pour cent de `LINE_SAFETY`, et les tests les dépensent
explicitement au lieu de les supposer.

**Et un rôle est une notion de SCÈNE, pas de la pile où il a été résolu.** Par
pile, c’était le bon dénominateur et la mauvaise portée, et l’export suivant l’a
dit : sur une scène de huit blocs, `DENSE` — un `kicker` seul dans sa colonne,
dimensionné contre une colonne où il n’y avait rien d’autre — sortait trois fois
plus haut que le `heading` de la colonne voisine. Un surtitre trois fois plus grand
que son propre titre, c’est l’écrasement ci-dessus avec les deux blocs dans deux
zones au lieu d’une, et c’est ce que l’œil lit comme faux quelle que soit la
défense de chaque moitié de l’arithmétique.

La réparation n’est pas une unité unique pour toute la scène. Deux zones ont deux
mesures et deux hauteurs, et une colonne étroite DOIT pouvoir composer plus petit —
c’est ce que « un bloc habite la boîte qu’on lui donne » veut dire, et une unité de
scène serait la réponse de la plus petite zone imposée à toute l’image, c’est-à-dire
le vide que cette passe a supprimé revenant par l’échelle. Ce qui est partagé,
c’est l’ORDRE : `harmoniseUnits` abaisse une pile jusqu’à ce qu’elle y soit. Elle
ne fait que réduire, une pile seule est rendue exactement telle que
`solveTypeUnit` l’a répondue, et une pile déjà dans l’ordre ne paie rien.

Borner la TAILLE dessinée était la première version, et elle gardait la lettre de
l’ordre en en perdant le sens : une légende avait le droit d’être exactement aussi
grande qu’un titre ailleurs, et deux runs du MÊME rôle n’étaient jamais comparés.
Les deux sont revenus dans un même export — `DENSE` à la hauteur de capitale exacte
du titre voisin, et un `logoType` dans un coin à 140 px contre un `heading` à
41 px, deux runs `title` dans une image à trois fois et demie l’un de l’autre.
`TYPE_ROLES` dit en une ligne pourquoi le premier est faux : un surtitre qui n’est
pas plus petit que la ligne qu’il annonce n’est pas un surtitre. Il y a donc deux
bornes, et ce sont deux questions différentes :

- l’ORDRE, sur la taille dessinée, pour un rôle strictement supérieur. Elle doit
  rester, parce qu’un run supérieur retenu par sa propre mesure dessine quand même
  ce qu’il dessine ;
- l’ÉCHELLE, sur l’UNITÉ, pour un rôle au moins aussi haut. Une légende tombe
  alors à 0,65/1,55 de ce titre, là où l’échelle la met, et deux runs `title` d’une
  même image font une seule taille.

Deux clauses en découlent. **Un champ est la scène, donc les mots posés dessus
lisent à l’échelle du champ** : un bloc ancré `full` n’appartient à aucune bande,
ce qui laisse une zone de cellule se résoudre contre un tiers de la zone sûre sans
rien à quoi se comparer — le `SIGNAL` à 122 px sur un equalizer, encore une fois —
donc l’unité du champ plafonne tout ce qui est empilé dessus. Et **la baisse
s’arrête là où s’arrête la licence de l’ENCRE** : `palette.accent` et
`palette.display` sont résolus au plancher 3:1, que l’audit accorde au gras au-delà
de `BOLD_LARGE_PX` (18,66 px), donc la borne d’échelle a un plancher là. La borne
d’ordre n’en a pas — une inversion n’est pas une scène plus calme, c’est une scène
fausse — et aucune des deux ne peut remonter une pile au-dessus de ce que sa propre
boîte permettait.

Deux choses qu’elle ne fait délibérément pas. Elle compare une pile aux AUTRES
piles et jamais à elle-même, parce qu’une pile est déjà d’accord avec elle-même et
que la seule façon dont elle peut encore s’inverser à l’intérieur est un plafond de
mesure propre à un bloc — corriger cela voudrait dire abaisser une zone entière
sous ce que sa boîte permet, ce qui est la garantie pour laquelle l’arithmétique
des boîtes existe. Et elle ne peut pas laisser un bloc flotter dans son lot : la
boîte d’un bloc est ce qu’il DESSINE à l’unité que sa pile a finalement retenue,
donc abaisser une unité abaisse la boîte avec elle et le reste retourne à la zone,
où l’alignement le dépense.

Deux choses qu’un document peut encore demander plus petites, et elles sont
nommées : `solidScene.size` et `separator.extent`, deux énumérations fermées de
trois parts. Un solide `small` remplit 42 % de sa boîte parce que quelqu’un a écrit
`small`, et le refuser serait la mise en page passant par-dessus le document.

`composition.test.js` est ce qui en fait une règle plutôt qu’un paragraphe.
`blockExtent` est pure — une boîte en entrée, les dimensions qu’un bloc dessine en
sortie —, donc doubler une boîte doit doubler chacune d’elles, et le filet est la
seule chose qui ne bouge pas. Ce qu’elle dessine doit remplir au moins les trois
quarts de sa boîte sur l’axe que sa propre ligne revendique (`BOX_FILL_FLOOR`), et
ce nombre est mesuré plutôt que choisi : un balayage des vingt-sept kinds, chacun
aux deux extrémités de ce que le schéma autorise, sur douze formes de boîte dans
les trois formats, place le pire cas à 0,82 — et on ne peut pas faire mieux en
général, parce qu’un nombre de lignes est un entier. Enfin, la boîte donnée à un
bloc doit être exactement ce qu’il y dessine : deux calculs pris par les deux
bouts, `stackIn` qui résout une unité pour une pile et `blockExtent` qui répond
pour une boîte, ce qui est ce qui rattraperait une table de poids dérivant de
l’échelle typographique. L’ordre entre les rôles est tenu sur le même corpus un
cran au-dessus : des scènes couvrant les dix zones, d’une à huit couches, étalées
sur les cases, empilées à deux par zone et posées sur un champ, dans les trois
formats — aucun run plus grand qu’un run supérieur, et chaque boîte toujours
remplie, qui est justement la garantie qu’un plafond de scène est le genre de chose
à défaire en silence.

La seule exception à « tout se dimensionne sur la boîte » a une seule
implémentation, et elle en a eu trois : `constantMetric` était écrite dans
`interface.js`, dans `media.js` et une troisième fois dans `dataFigures.js`, à
partir d’un même paragraphe par trois auteurs. Les trois étaient d’accord sur
toutes les boîtes auxquelles quelqu’un avait pensé et en désaccord sur la boîte
dégénérée — l’une rendait 0, l’autre la valeur demandée sans borne, et un test
épinglait la seconde, si bien qu’une divergence que personne n’avait décidée se
lisait comme une décision que quelqu’un avait prise. Elle vit dans
`composition.js` maintenant et les trois familles la lisent ; une boîte 0×0 est une
boîte sans place plutôt qu’une permission, et une boîte ABSENTE est l’autre
question, celle sur laquelle `hairline` tranche pour la même raison.

#### Un sujet prend la scène, un meuble prend la part qui lui revient

« Un bloc seul est la scène » a été payé par toute la passe ci-dessus, et c’est
vrai d’une image, d’un graphique, d’un titre et d’une citation : moins que le cadre,
c’est le petit élément dans un grand vide qui revient. Une image rendue a montré les
sept kinds pour lesquels c’est faux. Un `lowerThird` seul sur une photographie est
devenu un **carton plein cadre masquant trois cinquièmes de l’image**. Un bandeau de
nom n’est pas une scène à propos d’un nom.

**La distinction n’est pas la quantité de texte : c’est d’où vient la taille.** Un
sujet se dimensionne sur ce qui l’entoure — donnez-lui plus de place et c’est une
version plus grande de lui-même, ce à quoi sert exactement l’arithmétique des
boîtes. Un meuble se dimensionne sur le FORMAT. Un tiers inférieur de reportage fait
un sixième du cadre parce que c’est *ce qu’est* un tiers inférieur, et un tiers
inférieur qui remplit le cadre n’est pas un tiers inférieur plus grand : c’est un
carton. Le critère est une phrase applicable à un vingt-huitième bloc : est-ce que
cette chose grandit quand la scène grandit, ou est-ce qu’elle ne fait que devenir
fausse ?

`BLOCK_FURNITURE` nomme les sept, et chaque classement tient en une phrase.
`lowerThird` est le cas qui a fait la règle : toute sa grammaire est qu’autre chose
se trouve derrière lui. `kicker` est un surtitre, donc le surtitre *de* quelque
chose — il était déjà 200 px de capitales sur un graphique, et le plafond du champ
ne fermait cela que lorsqu’un champ était sur le cadre. `dateStamp` est un tampon :
une ligne, petite, dans un coin. `separator` est un filet dont l’épaisseur est déjà
une métrique constante, si bien qu’un cadre entier de filet n’achète que de l’air.
`progressBar` est une jauge, et elle se lit comme une proportion de quelque chose
qui n’est jamais le cadre. `notification` est un bandeau surgi par-dessus ce qui
était là ; plein cadre, c’est un carton qui a perdu ce qu’il notifiait. `button` est
une commande dimensionnée pour être pressée ; une commande qui remplit le cadre est
un aplat coloré avec un mot dessus.

Ceux qu’on laisse dehors comptent autant, parce qu’une règle vaut ce qu’elle refuse
de couvrir : `heading`, `funTitle`, `quote`, `typewriter`, `counter`, `logoType`,
`form`, `codeBlock` et tous les champs restent des sujets. Un carton-titre, une
citation détachée, un nombre, un logotype et un formulaire sont autant de scènes que
quelqu’un a voulu faire. `logoType` mérite d’être nommé deux fois, puisqu’un
logotype dans un coin est du mobilier en tout sens ordinaire — mais un logotype seul
sur un cadre est un carton-titre, tandis qu’un bandeau de nom seul sur un cadre est
une erreur, et ce qui tient un logotype de coin à la taille de ses voisins est
`harmoniseUnits` et non cette table.

**Ce que cela coûte est une borne sur l’unité, et seulement là où rien d’autre n’est
dans la pile.** `furnitureCeiling` divise la hauteur sûre par `SCENE_UNITS` — 22,
qui n’est pas un nouveau nombre mais le palier « champ » de `BLOCK_APPETITE`, la
densité derrière « un cadre qui porte vingt lignes de texte courant est un cadre, et
un qui en porte dix est une affiche ». Un `lowerThird` qui vaut quatre de ces unités
dessine quatre vingt-deuxièmes du cadre, c’est-à-dire un bandeau. Trois propriétés
en font un rangement plutôt qu’un second moteur de mise en page :

- elle borne l’UNITÉ et non la boîte, pour la raison de `harmoniseUnits` — `stackIn`
  recalcule les hauteurs à l’unité qui arrive, donc le bloc *remplit* toujours la
  boîte qu’il obtient et le reste est dépensé par l’alignement de la zone ;
- elle se mesure sur la ZONE SÛRE et jamais sur la zone du bloc, parce que toute
  l’affirmation est qu’un meuble se dimensionne sur le format : un bandeau dans un
  tiers de cadre et un bandeau seul sur un cadre sont le même bandeau ;
- et elle s’applique à TOUTE une pile ou à aucune. L’unité appartient à la pile, si
  bien que l’abaisser pour un `kicker` posé sur un `heading` réglerait le titre à
  l’échelle d’un surtitre — et une zone mixte était déjà juste pour une autre
  raison, puisque `stackIn` la divise par appétit.

Deux clauses en découlent, et les deux sont la même phrase : **un bloc dimensionné
par le format ne donne d’échelle à personne.**

Un meuble ancré `full` **n’est pas un champ**. Le plafond du champ dans
`harmoniseUnits` dit « le champ donne l’échelle de la scène », et un `lowerThird`
ancré `full` qui plafonnerait tous les titres du cadre à l’unité d’un bandeau, c’est
cette phrase lue à l’envers. Il reste tenu à sa part, et il revendique toujours les
bandes, puisqu’il est toujours peint sous les neuf cases.

Et une pile de mobilier **n’est pas une preuve sur l’échelle**, donc la borne
d’ÉCHELLE de `harmoniseUnits` la saute. Cette borne — aucune pile ne lit une unité
plus grande qu’une pile portant un rôle au moins aussi haut — suppose que les deux
piles ont été dimensionnées par leurs boîtes, ce que `furnitureCeiling` casse
exprès : un `barChart` ancré `full` à côté d’un `kicker` est passé de 56 px à 43 et
dessinait trois quarts d’une zone sûre qu’il avait tout entière, c’est-à-dire le
vide que toute cette passe retire, arrivant par la seule porte qui existe pour tenir
les surtitres petits. La borne d’ORDRE, elle, s’applique toujours, et l’asymétrie
est la différence entre les deux questions : « deux piles d’une scène lisent une
échelle » parle d’une échelle à laquelle le mobilier ne participe pas, tandis que
« aucun run n’est dessiné plus grand qu’un run supérieur » parle de ce qu’un œil lit
sur le cadre, et une ligne de texte plus grande que le titre du bandeau d’à côté est
une inversion quoi qu’il ait rendu le bandeau petit.

#### Un champ n’est pas une surface uniforme : il déclare où il pose du texte

L’export suivant a posé un `kicker` ancré `bottom-center` sur un `barChart` ancré
`full`, et le surtitre est tombé **exactement sur la rangée d’étiquettes du
graphique** : deux textes dans la même bande, trois étiquettes illisibles. Les deux
étaient à la bonne taille — le plafond du champ et les bandes pondérées avaient fait
leur travail —, donc le conflit était purement positionnel et rien de ce qui touche
à l’échelle ne pouvait l’attraper. « Un bloc `full` est ce sur quoi un élément se
pose » était vrai de l’ordre de peinture et muet sur la géométrie.

**Le champ déclare, et la cellule ne bouge pas.** L’autre réparation possible était
de repousser une cellule posée sur un champ vers une bande que le champ laisse
libre. Elle est moins chère et elle est fausse deux fois : elle DÉPLACERAIT un bloc
que le document a ancré — `anchor` est la seule décision de composition qu’un
document prend, et un kicker en bas au centre relogé en haut est un film qui n’a pas
fait ce qu’on lui a dit — et elle doit deviner, puisque seul le bloc sait où va sa
propre légende. Une règle écrite dans la mise en page aurait raison sur `barChart`
par chance et sur le vingt-huitième kind pas du tout. Déclarer coûte une table et un
nombre par scène, et ce qu’on achète est de l’arithmétique : les cellules sont
disposées dans la zone sûre MOINS la bande que le champ a réservée, donc aucune
boîte de cellule ne peut y entrer.

`FIELD_FOOT` est cette table, et les trois entrées sont un PIED plutôt qu’un mélange
de bords. Une légende va sous ce qu’elle légende : `barChart` et `lineChart` posent
leurs étiquettes sous le tracé, `imageFrame` sa légende sous l’image — trois
composants écrits par trois mains, tous les trois avec le run en dernier dans une
colonne. Il y a donc un bord et non deux, et un kind qui poserait un jour du texte
en HAUT de sa boîte est une nouvelle question plutôt qu’une nouvelle ligne,
puisqu’il faudrait épingler la pile dans l’autre sens et qu’une pile ne s’épingle
pas par les deux bouts.

**La condition d’entrée est `fills: 'both'`, et `clock` est la raison de l’écrire.**
Un bloc ne peut promettre où est son pied que s’il remplit sa boîte sur cet axe. Un
cadran est rond : il remplit l’axe mineur et flotte au milieu de l’autre, si bien
qu’un `clock` plein cadre sur un export 9:16 fait 907 px de cadran dans 1305 px de
hauteur sûre, avec son étiquette à 175 px au-dessus du bas de sa propre boîte. Une
bande réservée au bord serait une bande réservée là où rien n’est dessiné.

Trois choses rendent la soustraction exacte plutôt que presque exacte. C’est le
**dernier** bloc de la pile `full` qui est mesuré, parce que c’est celui dont la
boîte se termine sur le bas sûr. L’unité est celle du champ, résolue avant
`harmoniseUnits`, qui ne fait jamais que l’abaisser — donc la bande réservée n’est
jamais plus courte que le texte qui s’y pose. Et le champ est **épinglé** au bord
qu’il a déclaré (`justify: 'flex-end'` au lieu du reste symétrique qu’une zone
`full` garde autrement), parce que centré, un champ dont l’unité a été abaissée
dessinerait sa légende au-dessus de la bande dont les cellules ont été tenues à
l’écart, et la réservation aurait déplacé le défaut au lieu de le retirer. Une
gouttière d’air s’y ajoute — celle de la grille, le même nombre qui sépare deux
zones quelconques —, ce qui couvre aussi la marge d’un bloc image sous sa légende,
`TILE_GUTTER` valant quatre dixièmes de cette gouttière.

**Le cas à ne pas casser est un champ sans texte**, et il est vérifié comme une
égalité plutôt que comme un nombre : un graphique dont le document n’a nommé aucune
étiquette, une galerie, un solide, un champ de particules ou une carte ne réservent
rien et se disposent exactement comme avant l’existence de la déclaration. La
réservation est bornée à un quart de la zone sûre (`FIELD_FOOT_CEILING`) pour la
raison qui borne les métriques constantes : une exception sans plafond est la règle
qui repasse par la fenêtre, et une cellule sans hauteur est une pile résolue à une
unité nulle (Q1). Elle sur-réserve dans deux directions exprès — `labelBand` rétrécit
les étiquettes d’un graphique pour tenir dans une colonne et supprime la rangée
entière sous `LABEL_FLOOR` — parce qu’une bande un peu plus haute que le texte qui
s’y pose coûte quelques pixels à une cellule, et qu’une bande trop courte est le
défaut qui revient.

**Et cela ne s’étend pas à un sujet au milieu**, qui est la lecture qu’invite
l’export suivant : un titre en travers de l’équateur d’un `globe` ancré `full`
ressemble à ce défaut d’un cran, un champ dont le SUJET gêne plutôt que dont la
LÉGENDE gêne. Trois propriétés du pied font marcher la soustraction, et un sujet
n’en a aucune. Un pied est sur un BORD, donc ce que reçoivent les cellules est une
plage contiguë et `split` y répartit les bandes ; un bloc `fills: 'minor'` occupe
le milieu de sa boîte sur les deux axes, donc le réserver laisse deux restes
disjoints, et une pile ne se dispose pas dans un trou. Un pied est déclaré par un
bloc qui REMPLIT l’axe sur lequel il réserve — la condition d’entrée écrite, et
`clock` est le cas déjà exclu pour exactement cette raison. Et un pied vaut un
vingtième du cadre, là où le carré d’un globe couvre les trois rangées d’une zone
sûre 16:9 : la réservation ne laisserait rien du tout aux cellules, ce qui est un
refus, quand cette fonctionnalité dégrade (Q1).

Trois réparations existent et deux sont déjà tranchées. Déplacer la CELLULE est
exclu — `anchor` est la seule décision de composition qu’un document prend.
Rétrécir le sujet n’achète rien, puisqu’il reste centré et qu’un globe plus petit
est un globe plus petit avec la même ligne en travers. Reste à déplacer le SUJET,
la seule qui n’enlève rien au document, parce que `full` est le seul ancrage qui ne
nomme aucune position ; elle reste ouverte, et sa condition est que les rangées de
la grille qu’aucune cellule n’occupe soient CONTIGUËS — ce qu’une cellule `center`
est précisément ce qui les empêche d’être. D’ici là, l’arrangement est celui pour
lequel `globe.jsx` dit avoir été écrit — « les mots qui appartiennent à un globe
sont un `kicker` ou un `heading` ancré par-dessus, mesuré contre une surface que
`composedPalette` a résolue avec le champ dedans » — et ce qui faisait lire l’image
rapportée comme cassée n’était pas le mot sur la sphère mais le faisceau d’arcs
tranché derrière lui, qui est le défaut de `globeShell` et se corrige là.

`composition.test.js` le tient contre les fonctions de mise en page DES BLOCS plutôt
que contre la réservation : `barChartLayout`, `lineChartLayout` et `imageFrameBox`
sont ce qui décide réellement où atterrit une légende, donc demander les deux
moitiés à `composition.js` aurait été un test d’accord avec lui-même.

#### Il n’y a toujours aucun son

`equalizer`, `soundWave` et tout rythme d’une scène composée sont des **motifs
visuels**. Il n’y a aucune piste audio dans cette fonctionnalité, aucun
`@remotion/media-utils`, aucun fichier son et rien qui soit écouté — et cette
absence est imposée, pas en attente, parce que chaque objet du schéma est
`.strict()` et qu’un document portant une clé `audio` est refusé en entier. Un
équaliseur dont les barres suivent une courbe déterministe est un équaliseur ; il
ne mentirait que si quelque chose prétendait entendre quoi que ce soit, et rien ne
le prétend.

La même règle fait que l’horloge et la date énoncent leurs propres valeurs.
`clock.time` est un `HH:MM` du document et `dateStamp.text` une ligne écrite par
le modèle — jamais l’horloge de la machine de rendu, qui inscrirait un fait sur la
*machine* dans le film de quelqu’un et ferait diverger deux rendus d’un même
montage, ce que le stockage adressé par contenu ne peut pas se permettre.

#### La garantie de lisibilité s’étend aux blocs, par une seule voie

Un bloc **ne choisit jamais une couleur**. Il lit une entrée de `composedPalette`
et peint avec, et c’est tout le contrat : on ne peut pas faire confiance à
vingt-sept composants pour mesurer chacun, et vingt-sept composants qui
mesurent, ce sont vingt-trois copies de la même recherche.

Trois surfaces, parce qu’un bloc peint sur exactement trois choses — le fond
(`display`, `body`, `accent`), un panneau (`panelDisplay`, `panelBody`,
`panelAccent`) et l’accent en aplat (`onFill`). Un panneau est le `theme.surface`
opaque, donc sa propre surface quel que soit le fond ; l’aplat est là où l’appel à
l’action de la fiche produit avait déjà fait la démonstration, en étant le seul
élément lisible de l’export qui a lancé toute la section lisibilité.

**Le fond est une plage, et deux des six le rendent tel.** `surfaceRange` avait
déjà le vocabulaire : un voile mesuré aux deux extrêmes qu’une image inconnue peut
lui composer, et une teinte mesurée à côté de sa base. Chaque fond est donc un cas
de `{ color, alpha, tint }` — une couleur opaque, une couleur plus la texture de
la maison, une couleur sous un voile posé sur une photographie, ou une **rampe**.

La rampe est celle qui a demandé une arithmétique nouvelle. Deux extrémités qui
passent 4,5:1 prouvent bien qu’une encre est en dehors de la bande qui les sépare,
puisque deux extrémités distantes de 4,5 dans chaque sens demanderaient une
luminance relative supérieure à 1. Au **plancher d’affichage de 3, cela ne prouve
rien** : une rampe du noir vers un gris pâle passe 3:1 aux deux bouts face à une
encre dont la luminance se situe entre les deux, et quelque part sur cette rampe
le contraste vaut 1:1. Chaque titre de ce répertoire prend 3. Un dégradé est donc
échantillonné sur sa longueur (`GRADIENT_RAMP`), et une encre cachée entre deux
échantillons voisins est à une fraction de l’un d’eux — et une fraction, ce n’est
pas trois.

Un fond animé est mesuré à sa densité **maximale** et ne s’anime que vers le bas.
`gridPulse` et `particles` s’estompent jusqu’à `PULSE_FLOOR` et jamais au-delà de
ce qui a été mesuré, ce qui est la même asymétrie que celle sur laquelle `vertical`
s’appuie en gardant un dégradé directionnel par-dessus un assombrissement
uniforme : une couche qui ne peut qu’ajouter de la lisibilité ne peut pas invalider
une garantie établie sans elle.

Et la teinte entière **cède**, exactement comme `texturedGround` la faisait déjà
céder pour les deux modèles à fond plat : un fond dont la texture — ou le dégradé
— est ce qui rend une ligne illisible est peint plat, et uniquement quand le fond
nu porte toutes les entrées. Une décoration cède devant un mot, et elle ne cède
jamais pour rien.

**Et un bloc `full` est un second fond.** Cette phrase manquait et un export l’a
trouvée : `equalizer` disait de lui-même qu’il « ne porte aucun texte, donc la
seule chose qu’il puisse rater est de dépenser du contraste dont autre chose avait
besoin — ce qu’il ne peut pas », ce qui est vrai d’un bloc dans une cellule et faux
d’un bloc ancré `full`, puisque celui-là est peint SOUS les neuf cellules, exprès.
Le film avait dix-huit barres d’accent en travers du cadre et un titre debout
dessus dont le dernier mot est dans l’accent par construction ; les deux se sont
rencontrés à 1:1, et chaque entrée de cette palette avait été mesurée contre un
fond sur lequel rien ne se tenait.

Une scène qui empile quelque chose sur un bloc `full` résout donc une palette
différente (`stackedField`), et le champ entre dans la mesure comme toute autre
couche décorative — en teinte, échantillonnée le long de sa propre densité pour la
raison de `GRADIENT_RAMP`, puisqu’un champ n’est pas d’une seule couleur. Ce qu’il
cède est la DENSITÉ : `FIELD_ALPHAS` commence à 1, donc une scène dont le titre
passe déjà sur un champ à pleine force ne paie rien, et le premier barreau qui
passe l’emporte. La texture n’est abandonnée qu’après que le champ a épuisé ses
barreaux — ce sont deux décorations, et l’une des deux est dans le document.

Deux conséquences, toutes deux porteuses. L’**entrée d’accent est mesurée sur le
fond nu quand le champ la LIT**, pas sur la surface champêtre : mesurée contre un
champ fait d’elle-même elle ne peut pas passer, retombe par `accentFirst` sur un
quasi-blanc — et comme `globe`, `equalizer`, `soundWave`, `map` et les deux
graphiques plats peignent `palette.accent` **elle-même**, republier cette entrée
dans l’encre de repli repeint le champ avec. La première version de ce correctif
est revenue avec des barres grises derrière un titre gris : lisible, la couleur du
projet disparue, et la surface mesurée n’était plus la surface peinte.

**C’est UN cas, et pendant deux passes le code en a fait le cas général.** Un
surtitre posé sur un champ que l’accent ne peint pas était mesuré sur le fond nu
lui aussi, et quatre images rendues disent ce que ça coûte : un `kicker` sur une
`gallery` à **1,03:1**, sur un `carousel` à 2,46:1, sur un `waveMesh` à 1,36:1, sur
le socle d’un `solidChart` à 1,27:1, contre un plancher de 3. L’ornement qu’une
scène publie est donc résolu une seconde fois, sur la surface qui a GAGNÉ — jamais
comme une requête dans l’échelle, qui ferait céder la densité pour qu’un surtitre
garde sa couleur, l’échange exact que le voile verrouillé d’`accentRun` refuse. Le
test est de savoir si le champ LIT l’entrée, pas s’il se trouve être de la même
couleur : `waveMesh`, `solidScene`, `solidChart` et les deux scènes à photographie
lisent `palette.solid`, dont le matériau est résolu depuis l’accent nu et n’est
jamais republié — il n’y a pas de boucle dont les protéger. La brèche qui reste est
la vraie : un TEXTE d’accent sur un champ peint en `palette.accent`. Et la densité
est une opacité sur la
**zone**, pas une couleur remise à cinq composants : `full` est la seule chose qui
fasse d’un bloc un champ, donc la règle vit là où `full` veut dire quelque chose et
le vingt-huitième bloc ne peut pas l’oublier. `palette.groundTint` est ce que la
composition peint et `palette.ground.tint` ce qui a été mesuré — ils diffèrent
exactement du champ, et lire le second dans `Ground` le peindrait deux fois et
prendrait l’extrémité lointaine d’un dégradé sur l’accent.

**Un champ est mesuré comme ce qu’il PEINT, et « l’accent » était une supposition
vraie pour cinq blocs sur six.** `equalizer`, `soundWave`, `map`, `lineChart` et
`barChart` peignent l’accent en run ou en aplat, ce que la version booléenne de
ceci mesurait au nom de tout le monde. `solidScene` peint un solide éclairé dans
une couleur à lui, à deux luminosités, et un export a montré les deux moitiés de
l’oubli d’un coup : `field.alpha` a descendu toute son échelle contre un accent que
rien à l’image ne portait, éteignant l’objet sans jamais aider le mot, et le cadre
est revenu en tore gris et plat derrière un titre. Donc `FIELD_PAINTS` associe à un
bloc `full` ce qu’il met à l’image, `fieldPaints` répond l’ENSEMBLE que peint une
scène — dédoublonné et dans un ordre fixe, parce que cette réponse est aussi la clé
du cache de palettes — et `composedPalette` échantillonne ces couleurs-là. Un
solide en vaut deux : toutes les faces lambertiennes sont entre `matériau` et
`matériau × ambiante`, donc les deux bouts mesurent toutes les faces, ce qui est la
preuve de `solidShading` réemployée une couche plus loin. Son matériau est résolu
sur le fond NU pour la raison qui vaut pour l’entrée d’accent : le champ est ce
qu’on mesure, et une couleur prise dans la passe qui l’inclut serait un point fixe
et non une réponse.

**UNE PHOTOGRAPHIE N’EST PAS UNE COULEUR : ON LA BORNE, ON NE LA MESURE JAMAIS.**
Le paragraphe qui était ici disait que la brèche restante « demande une image, pas
une ligne de table », et il se trompait de ligne. `gallery`, `carousel`,
`imageFrame`, `photoStage` et `photoRing` ancrés `full` peignent des
photographies, et une surface que personne ici n’a ouverte ne se mesure pas — mais
elle se BORNE, ce que ce fichier fait depuis le premier export. Un FOND `image`
est mesuré aux deux extrêmes auxquels un voile peut composer une image inconnue,
le noir et le blanc, et le voile monte jusqu’à ce que les deux bouts passent.
`picture`, c’est cette réponse déplacée d’une couche.

Un export l’a rendue urgente, et c’est la scène la plus banale du catalogue : un
`heading` sur un `photoStage` ancré `full` — ce qu’un modèle écrit le plus
souvent — mesurait le CORPS du panneau et jamais l’image qu’il porte, si bien que
du blanc traversant un bois clair est parti à 1,68:1 contre un plancher de 3.

Deux mécaniques, et chacune a d’abord été prise à l’envers. L’image entre comme
deux CALQUES de teinte — du noir à la densité du champ, du blanc à la même
densité — et non comme un alpha sur le fond : un `photoStage` met un corps éclairé
ET une photographie à l’image, côte à côte, donc retirer l’image de l’alpha du
fond voile aussi le corps à travers l’image, et la paire descendait d’un cran de
densité pour rien. Deux fonds dans une liste, c’est une union ; un alpha, c’est un
produit. Et aucun `FIELD_RAMP` dessus, contrairement à toutes les autres
peintures : une `map` dessine ses points à pleine force et ses liens à une
fraction, alors qu’une photographie est une image opaque à UNE opacité, dont le
contenu est déjà encadré par le noir et le blanc.

Ce qui cède, c’est la densité, et elle cède parce qu’une décoration cède devant un
mot — la phrase sous laquelle `FIELD_ALPHAS` a été écrit. Les deux façons de rater
cet arbitrage sont déjà dans ce document : céder la densité jusqu’au dernier
barreau FANTOMISE l’image, et un bandeau posé dessus pour porter les mots, c’est
le `lowerThird` revenu en carte cachant trois cinquièmes d’une photographie. Ce
qui tranche, c’est le barreau où l’échelle s’arrête vraiment, et c’est une mesure :
sur la douzaine de directions réelles que balaie `composition.test.js`, une pile
sur un champ d’images compose à 0,4 — PLUS de photographie que le même thème n’en
garde sur un FOND `image`, dont le voile monte de `COMPOSED_IMAGE_VEIL` à 0,7 pour
porter les deux mêmes runs. Cette fonctionnalité livre des photographies à trois
dixièmes depuis son premier export et personne ne les a appelées des fantômes.

Une clause n’est pas un détail : le voile est VERROUILLÉ pour un champ d’images.
Un bloc-image est peint AU-DESSUS du fond et du voile du fond, donc monter ce
voile n’achète rien à un run posé sur l’image, et `sharedSurface` publierait un
contraste que l’image n’a pas. Restent l’encre, que `legibleOn` parcourt en
entier, et la densité.

#### Et la garantie que rien ne reste immobile aussi

`tests/video-motion.test.js` pose sa question à la variante composée également,
sur le document le plus pauvre que le schéma accepte : un bloc, pas d’ancre, pas
de rang, et aucun fond du tout. Cette dernière omission est le cœur du sujet — le
silence vaut `hairlines`, le seul des six fonds qui **reste immobile**, donc la
scène doit bouger par sa pile et sa dérive seules. Une version de cette
fonctionnalité qui se serait appuyée sur un fond animé passerait tous les autres
cas et échouerait exactement là.

Ce qui bouge, c’est la pile et non le fond, pour la raison que `TITLE_BLOCK_DRIFT`
donne déjà : le fond est la surface contre laquelle chaque entrée a été mesurée, et
un fond qui glisserait sous une typographie fixe, ce serait du texte traversant une
surface que personne n’a mesurée.

Les termes annoncés sont `drift` et une progression `layers` par bloc, toujours —
plus `picture` seulement quand le fond est une photographie et `ground` seulement
quand le fond s’anime. Un terme est annoncé quand la composition le dessine et
jamais autrement, ce qui est la règle que le kicker a enseignée : un nombre qui
bouge sur une image qui ne bouge pas est exactement ce qu’un test « est-ce que
quelque chose a bougé » aurait accepté.

**`ground` est le terme pour lequel « la composition le dessine » n’est pas un
fait du document.** Les trois fonds animés bougent tous en bougeant la seconde
couche du fond, et cette couche CÈDE : `texturedGround` l’abandonne quand le fond
nu porte tous les runs et que le fond teinté ne les porte pas, et `fieldedGround`
l’abandonne une fois que le champ a épuisé ses échelons. Une décoration cède à un
mot — et l’image sur laquelle elle cède est un aplat, avec une progression
`ground` qui court de 0 à 1 dessus. Sa survie est une réponse de lisibilité, donc
il lui faut un thème, et `sceneMotion` n’en a jamais reçu : c’est la composition
qui fait descendre ce qu’elle peint réellement (`groundPainted`, que `Ground` lit
pour la même décision) plutôt que le mouvement qui devine. C’est théorique sur le
corpus d’aujourd’hui — six fonds sur une douzaine de directions réelles, et la
teinte survit à chacune — ce qui est une affirmation sur le corpus, pas sur la
prochaine direction que quelqu’un écrira.

**Il n’y a délibérément aucun kicker automatique.** Les cinq autres dessinent le
compteur du film parce que leur mise en page lui fait une place. La mise en page
d’une scène composée est celle du document, et un surtitre peint par-dessus une
pile que quelqu’un a arrangée est un élément que personne n’a demandé — un film qui
en veut un écrit un bloc `kicker`.

#### Un fichier par bloc, et un registre que personne d’autre n’édite

`worker/video/remotion/blocks/` contient un `.jsx` par sorte, nommé d’après elle,
plus `index.js` qui associe la sorte au composant. Deux règles font tenir cette
organisation, et `blocks.test.js` impose les deux :

- **Rien dans ce répertoire n’importe `remotion`.** Un bloc est du React ordinaire
  — l’image arrive sous forme de `progress` et de `life`, calculés par
  `sceneMotion` — donc il n’a nul besoin de `useCurrentFrame` et aucune excuse pour
  en avoir un. C’est ce qui permet de charger le registre dans la suite vitest de
  Mocky, où Remotion n’est pas installé et ne le sera jamais, et donc ce qui permet
  à un test de prouver que le registre est complet dans les deux sens.
- **Aucune couleur et aucune courbe d’accélération n’est écrite dans un bloc.** Une
  valeur hexadécimale dans un composant est une couleur que personne n’a mesurée,
  c’est-à-dire le défaut qui a livré un titre vert foncé sur une image presque
  noire ; une courbe serait une vingt-cinquième notion de la façon dont les choses
  bougent. Le test retire les commentaires avant de chercher, pour que la phrase
  qui explique pourquoi le code est juste ne fasse pas échouer la vérification qui
  le maintient juste.

`index.js` est délibérément une table et rien d’autre. Vingt-sept personnes
peuvent y posséder chacune un fichier sans jamais toucher la même ligne, ce qui
n’est vrai que tant qu’il ne contient aucune logique — tout ce qui est réellement
partagé appartient à `composition.js`, où un test peut l’atteindre sans React.

### Le prompt est un mode d’emploi des blocs, pas un menu de mises en page

`compose.js`, c’était cinq fiches suivies d’une table associant une intention à
un nom — des mots seuls vers `titles`, un téléphone vers `vertical`, et ainsi de
suite jusqu’à `slideshow`. Il n’y a plus de nom auquel arriver. **L’appel
ordinaire ne propose que `composed`**, et le tour système est le mode d’emploi
d’un catalogue : six fonds, vingt-sept blocs en six familles, et les deux
champs que porte chaque bloc. Les cinq compositions à remplir à la main restent
atteignables, mais seulement par leur NOM — un appelant qui a un formulaire pour
l’une d’elles reçoit cette fiche et aucun bloc — parce qu’une fiche plus
vingt-sept blocs, c’est un prompt qui porte deux consignes contradictoires.

Chaque bloc a droit à trois phrases et une forme : ce qu’il est, quand il est le
bon, et **comment il rate**. C’est la troisième qui mérite sa place. Un modèle à
qui l’on montre vingt-sept blocs les utilise tous les vingt-sept, et un
catalogue est la seule chose qui puisse plaider contre ses propres entrées — donc
`counter` dit qu’un chiffre que personne ne vous a donné est une affirmation dans
le film de quelqu’un d’autre, `separator` dit que la mise en page espace déjà les
choses, et `equalizer` dit qu’il n’y a rien à écouter.

Autour d’eux, deux sections font ce qu’aucune fiche ne peut faire. **THE STACK**
énonce la discipline : une scène porte UNE idée, deux ou trois blocs est la scène
ordinaire, une scène d’un seul bloc est souvent la meilleure du film, et la
variété appartient au film, pas au cadre. **STACKS THAT WORK** énonce
l’ambition, parce qu’un modèle à qui l’on dit seulement ce qu’il faut éviter
écrit un titre par scène et s’arrête : un dégradé sous un kicker et un titre qui
partagent un rang, une grille qui pulse derrière un compteur, un lower third et
une barre de progression sur une photographie. Cinq exemples, chacun d’une scène,
chacun de deux ou trois blocs.

**Aucun nombre et aucun vocabulaire n’est tapé dans cette prose.** Chaque borne,
chaque énumération et chaque défaut d’une fiche est dérivé de l’objet zod contre
lequel la réponse sera validée : `signature()` parcourt le schéma et écrit `≤70`,
`display|title|subtitle = title`, `[2–6 × …]`, et la légende en tête de prompt
explique cette notation une fois. C’est la règle de CLAUDE.md appliquée là où
elle a déjà fait mal — un plancher recopié à la main dérive du validateur, et la
dérive est du genre coûteux, puisque l’appel est dépensé quand le refus cite un
nombre dont le modèle n’a jamais entendu parler. Avec vingt-sept blocs la
surface est vingt-sept fois plus grande, donc la vérification est à double
sens : la suite exige que les bornes imprimées soient celles de `BLOCK_LIMITS`
**et** qu’aucune ligne de prose du catalogue ne contienne un chiffre.

Le même parcours construit l’indice du décodeur, ce qui interdit aux deux de se
contredire. Un type de nœud que le parcours n’a jamais vu écrit `(unrecognised)`
au lieu de lever — Q1 : une proposition ne doit pas échouer sur une description —
et la suite tombe sur ce marqueur, ce qui fait trouver un champ d’un type
nouveau avant qu’un utilisateur ne le trouve. Deux choses sont redites dans
l’indice que la version à cinq fiches laissait de côté, et les deux sont mesurées
plutôt que stylistiques : **les bornes de tableau**, parce que llama.cpp compile
`minItems` dans sa grammaire et qu’une `gallery` annoncée comme acceptant un seul
id produit exactement le document que `min(2)` refuse ; et **`anchor`,
`background` et `transitionOut` sont marqués requis** bien que le schéma les
remplisse tous les trois, pour la raison qui rend `move` requis sur une scène
`overlay` — le défaut est une réponse légale, et une grammaire qui autorise à
sauter le champ met tous les blocs de tous les films au milieu du cadre, sur le
même fond, avec la même transition : la variété que cette variante existe pour
produire, jetée par un indice. `enter` n’est délibérément pas requis : son
absence veut dire « dans l’ordre où je les ai écrits », ce qui est le bon défaut.

**La sélection rétrécit le catalogue plutôt que d’ajouter une règle à son
sujet.** Trois blocs et un fond mettent une image à l’écran, et le nombre
d’images qu’ils réclament est lu dans le schéma — `gallery` en veut deux parce
que son tableau dit `min(2)`. Une sélection vide se voit donc offrir vingt et un
blocs et cinq fonds, une image ajoute `imageFrame` et le fond `image`, et deux
ouvrent le catalogue. C’est un indice et jamais la barrière : un fournisseur qui
ignore la sortie structurée répond avec une galerie d’ids qu’il a inventés, et le
refus **nomme ce qui reste possible** — `imageFrame, gallery, carousel` et le
fond `image` sont les seules parties qui exigent une image, et les vingt et une
autres dessinent du texte, des nombres et des motifs. Un « non » sec renverrait
quelqu’un reformuler un brief qui n’était pas le problème, et « une image n’était
pas dans votre sélection » aussi, quand la sélection est vide.

Corollaire : `POST /api/video/compose` accepte une sélection vide. La route
répondait `400`, ce qui était juste jusqu’au jour où un brief de mots est devenu
la demande la plus ordinaire qui soit.

**Un document qui ne nomme aucun template, sur ce chemin, est un `composed`.**
`template` y est une constante — le prompt l’énonce, l’indice l’épingle sur une
énumération à une valeur — et un champ constant est le champ qu’un modèle omet.
Laissé tel quel, le défaut de compatibilité du schéma lit une pile de blocs comme
un diaporama et la refuse avec une demi-douzaine de problèmes portant sur des
clés que personne n’a écrites. C’est un défaut, pas la réparation que cette
fonctionnalité interdit : il n’ajoute rien que le document ne disait déjà, il
s’applique avant la validation et non pour masquer un échec, et un document qui
nomme vraiment un template le garde.

**Une réponse qui a rempli l’une des cinq à la place est acceptée, avec une
remarque.** L’asymétrie avec le refus ci-dessus tient à qui perd quoi : là,
l’utilisateur avait réglé un formulaire et charger une autre composition le
déplacerait sous lui ; ici, il a demandé un film et il en a un — validé, rendable,
plus plat. Refuser rendrait néant contre une réponse qui marche (Q1). Se taire
serait pire, puisque tout l’intérêt de composer est que le film ne soit pas l’une
des cinq fiches.

**Une image laissée de côté est une remarque, et la remarque dit laquelle des
deux choses s’est produite.** Un film qui n’en montre aucune — un `composed` de
texte et de motifs, ou une carte `titles` par construction — n’est pas un oubli
que redemander corrigerait, et une remarque qui se lirait comme tel enverrait
quelqu’un essayer. Un plafond par modèle est l’autre cas : un film `product`
tient six scènes, donc dix images sélectionnées en laissent quatre dehors quelle
que soit la qualité de la proposition.

### Le panneau choisit aussi, et son défaut est de ne pas choisir

Le sélecteur de composition est le premier contrôle du panneau Motion, et il
s’ouvre sur **`Automatique`** — le modèle lit le brief et choisit. Ce défaut est
l’argument du catalogue redit sous forme de décision d’interface : un formulaire
qui ouvrirait sur `slideshow` ferait des quatre autres une option que l’on
découvre par accident, alors que le catalogue n’existe que pour que le film
corresponde à ce qui a été demandé.

Automatique est un état réel, pas un synonyme de diaporama. Il n’y a pas de
timeline tant qu’une composition n’est pas décidée : `toTimelineInput` répond
`null` et le bouton de rendu nomme `no-template` comme la raison pour laquelle il
ne partira pas. Assembler le diaporama qui serait passé, c’est la réparation que
cette fonctionnalité refuse partout ailleurs, atteinte par la seule porte que
personne ne surveillait — elle rendrait un film dans une composition que
l’utilisateur n’a jamais choisie.

**Une composition choisie à la main réduit à une entrée le catalogue que lit le
modèle.** Le formulaire où la réponse atterrit a les champs de cette composition,
donc une proposition sur une autre — ou une pile de blocs dont il n’a aucune
ligne — est un appel dépensé pour un document que le panneau refuserait. Le nom
voyage dans un champ `template` de `POST /api/video/compose` et il est comparé à
`EDITABLE_TEMPLATES` ; tout le reste est ignoré et lu comme « compose », y
compris `composed` lui-même, qui est déjà ce qu’on obtient en demandant un film
plutôt qu’une mise en page. Le prompt laisse alors tomber tout le catalogue de
blocs et n’imprime que la fiche de cette composition : un mode d’emploi de
vingt-sept blocs trois lignes sous « la composition est déjà choisie », ce sont
deux consignes contradictoires, et un modèle répond avec celle qu’il a lue en
dernier.

Une réponse qui en nomme malgré tout une autre est **refusée**, jamais chargée.
Un indice n’est pas davantage le garde ici, et la charger déplacerait le
sélecteur sous quelqu’un qui venait de le régler — et tous les champs du
formulaire avec lui.

**C’est le formulaire qui a rendu les quatre autres exprimables.** Avant qu’il ne
les ait, l’éditeur était un diaporama et rien d’autre : un brief parlant de
téléphone revenait en `vertical`, le panneau le refusait d’une phrase, et l’appel
au modèle avait été dépensé pour rien. Chaque ligne dessine désormais les champs
de la composition choisie et d’aucune autre — une case de légende sur une fiche
produit serait une ligne que l’on écrit et que l’on ne voit jamais, puisque
`ProductSceneSchema` n’a pas de `textOverlay` et que le document serait refusé
pour l’avoir portée.

Le brouillon derrière ce formulaire est **un enregistrement plat portant les
champs de toutes les compositions**, ce qui a l’air du choix le plus négligé et
qui est le choix délibéré. Une union imposerait une conversion avec perte à
chaque changement de sélecteur, et changer est précisément ce qui arrive :
quelqu’un choisit `product` pour voir à quoi cela ressemble, revient en arrière,
et retrouve les quatre images qu’il avait choisies disparues. `toTimelineInput`
aiguille sur le modèle et n’émet que ce que cette composition lit, donc rien de
ce qui reste n’atteint un schéma qui refuserait le document entier pour cela.

Trois règles mineures en découlent, et les deux premières consistent à ne pas se
montrer serviable :

- **Un nombre de scènes au-dessus du plafond de la nouvelle composition ne jette
  rien.** Dix images passées sur une fiche produit à six scènes gardent dix
  lignes et signalent `too-many-scenes` ; l’utilisateur en retire quatre. Écarter
  les images de quelqu’un pour honorer un clic sur un bouton radio, c’est la
  serviabilité que cette fonctionnalité refuse.
- **Les durées sont ramenées dans la nouvelle fenêtre.** Celle-là EST une
  correction, et elle est licite pour la raison qui a toujours valu à
  `clampDuration` : elle s’applique à l’entrée, sur un curseur qui ne sait pas
  exprimer 15 s en `vertical`. Laisser la valeur mettrait le brouillon dans un
  état que le formulaire ne sait pas montrer et dont l’utilisateur ne sait pas
  sortir.
- **Une ligne qui a tout gardé sauf son image est nommée**, `image-missing`.
  C’est le prix de la première règle, et il était resté impayé : `titles` est la
  seule sorte de scène sans `imageId`, ses lignes portent donc `''`, et passer
  sur une composition qui met une image à l’écran les conserve. Le formulaire
  paraissait alors complet — aucune vignette n’est dessinée puisqu’il n’y en a
  pas, aucune case n’est vide — et le bouton envoyait un document que le schéma
  refuse pour un `imageId` vide, le 400 arrivant après le clic. C’est le seul
  manque qu’aucune case de la ligne ne comble, d’où la marche à suivre dans la
  phrase : retirer la ligne, la rajouter depuis la grille. Le bouton « proposer »
  compte les images et non les lignes pour la même raison, et parce que c’est
  cette liste-là que la requête transporte.

### Cinq compositions, et une sorte de scène chacune

`worker/video/remotion/` porte un composant par modèle — `ImageSequenceVideo`,
`OverlayBandVideo`, `VerticalStoryVideo`, `AnimatedTitlesVideo`,
`ProductSpotlightVideo` — et `COMPOSITIONS` associe un nom de modèle à celui qui
le dessine. `render.js` sélectionne par cet id et ne se rabat jamais : un
`product` n’est donc jamais dessiné par le diaporama, sans quoi le film
reviendrait sans ses arguments ni son appel à l’action, annoncé comme une
réussite.

Le refus va dans les deux sens, et c’est le validateur qui l’écrit. Chaque modèle
a son **propre lecteur de scène** plutôt qu’un lecteur permissif accompagné d’une
liste de clés, parce qu’un `band` accepté sur une scène de diaporama est un champ
que la composition ne lit pas — un film privé de ce qu’on lui a demandé, livré
comme un export. `slideshow` et `vertical` sont la seule paire dont les sortes de
scène sont réellement identiques ; ce qui les sépare, ce sont leurs bornes (8 s
contre 15 s) et le littéral de ratio, et le test le dit au lieu de faire
semblant.

**L’arithmétique est partagée, pas recopiée.** Cinq compositions ont une seule
notion de plan d’images, une seule entrée, une seule courbe d’accélération, un
seul Ken Burns et une seule échelle typographique, et toutes vivent dans
`composition.js` où un test peut les atteindre sans Remotion. Deux d’entre elles
sont plus récentes que le catalogue, et chacune existe à cause d’un défaut
précis :

- `frameBase` dérive toutes les tailles de texte du **petit** côté, qui vaut 1080
  dans les trois ratios. Le dériver de `height` faisait sortir un titre réglé sur
  un cadre 16:9 à 1920/1080 fois sa taille en `9:16`.
- `cueFrames` programme les éléments d’une cascade et comprime l’ensemble quand
  la scène est trop courte. Une scène produit peut durer 3000 ms et porter une
  accroche, trois arguments et un appel à l’action ; cinq repères à un rythme
  confortable placent le dernier après la fin de la scène. Un texte qui arrive
  après la fin de sa propre scène, c’est un film privé de la phrase pour laquelle
  il a été monté.

`VERTICAL_SAFE_TOP_PERCENT` et `VERTICAL_SAFE_BOTTOM_PERCENT` sont l’autre
constante qui mérite d’être nommée ici. Un export 9:16 existe pour être publié, et
une application de fil dessine sa propre interface **par-dessus** la vidéo : la
légende et la ligne du son en bas, la colonne d’actions à droite, les onglets en
haut. Un texte placé là n’est pas près d’un bord, il est derrière un bouton — la
composition garde donc la légende à 12 % du haut et 20 % du bas. Ce ne sont pas
les 6 % de marge du diaporama sous un autre nom : ceux-là parlent de recadrage de
diffusion, et les deux dériveraient pour des raisons différentes.

### Ce que chaque composition dessine, et pourquoi c’est plus qu’une mise en page

La première version du catalogue, c’étaient cinq mises en page qui fonctionnaient
chacune : une accroche qui apparaît et une barre en dessous, un bandeau pleine
largeur, une légende sur une image, une colonne de lignes à puces. Rien n’y était
faux et rien n’y était dessiné — une arrivée, un ornement, un aplat, et un
spectateur avec trois secondes et rien à regarder.

Ce qui manquait n’était pas des effets. C’étaient les dispositifs que l’interface
de Mocky emploie déjà, et ils sont partagés pour la raison qui vaut pour tout le
reste de `composition.js` : cinq compositions avec cinq notions de « un élément
arrive », c’est quatre d’entre elles qui dérivent.

- **`easeOutCubic`, sur chaque arrivée.** Tout ce que Mocky anime dans un
  navigateur est amorti — `Animate.ts` donne `ease: 'easeOut'` à chaque préréglage
  et `CountUp` parcourt un easeOutCubic — et tout ce que le worker rendait était
  linéaire, parce que `progressAt` avait été écrit pour une dérive Ken Burns puis
  réemployé pour des entrées. Un fondu linéaire entre et s’arrête à la vitesse à
  laquelle il a voyagé, ce que rien de physique ne fait ; c’est la chose qui fait
  le plus lire un mouvement comme « généré ».
- **`cueFrames(…, { tailGap })`.** Un temps de plus avant le dernier élément d’une
  cascade, mis à l’échelle avec le reste plutôt qu’ajouté par-dessus : une scène
  trop courte pour la pause perd la pause, jamais l’élément.
- **`EMPHASIS_ENTER_FRAMES`.** Un élément par scène peut arriver plus lentement
  que ses voisins — l’accent d’une cascade, et gratuit, puisque le repère ne
  bouge pas. Il est plafonné par `MIN_CUE_TAIL_FRAMES`, ce qui garantit qu’une
  entrée lente se termine tout de même avant la coupe.
- **`sceneLabel` et `ordinalLabel`.** Un surtitre est le dispositif le plus
  rentable du système de design, et il lui faut quelque chose à dire. **Aucun
  champ de schéma n’a été ajouté pour ça**, délibérément : un surtitre écrit par
  un modèle à propos d’un film qu’il ne voit pas est exactement le jeton deviné
  que `theme.ts` refuse, et ce serait une sixième chaîne à borner, traduire et
  valider. Un compteur, lui, est le montage qui se redit lui-même — juste par
  construction, et vide pour un film d’une seule scène, parce que `01 / 01` est un
  compteur qui avoue n’avoir rien à compter.
- **`hairlineTexture`.** Les filets d’1 px sont le vocabulaire de la maison, et un
  aplat derrière une accroche est le seul endroit où un film n’a strictement rien.
  Il est mesuré, et non peint par-dessus la mesure — voir la section sur la
  lisibilité.

Par-dessus, chaque modèle a reçu ce qui manquait à son format.

| | Ce que c’était | Ce que c’est |
|---|---|---|
| `titles` | Une accroche centrée, un fondu, une barre courte | Une marge à gauche sur laquelle tout s’aligne, un surtitre, chaque mot révélé derrière son propre masque en `stagger`, le **dernier mot en accent** et arrivant plus lentement, un filet double qui parcourt la justification, et un fond de filets |
| `overlay` | Un bandeau pleine largeur en travers du cadre | Un bloc qui **s’arrête où son texte s’arrête** (`bandInset`), un filet d’accent sur son bord d’attaque, un balayage depuis ce même bord, un surtitre, et un titre révélé derrière le bloc plutôt que fondu dessus |
| `vertical` | Le diaporama dans un cadre vertical | Un resserrement à chaque coupe (`punchTransform`), une taille de texte qui **suit la longueur de la légende** (`verticalCaptionSize`) au lieu d’être réglée sur la plus longue légale, une légende qui arrive mot à mot, et une barre de progression |
| `product` | Trois lignes derrière trois points | Des numéros qui comptent les arguments, chacun entrant par la marge et se refermant sur un filet, un filet d’accent dans la gouttière, une image qui dérive, et un appel à l’action qui arrive **après un temps**, en grandissant là où tout le reste s’est levé |

Deux d’entre eux méritent leur propre phrase.

**La barre de `vertical` est la seule chose du catalogue hors d’une `Sequence`.**
Il le faut : une barre qui redémarrerait à chaque coupe serait six barres, soit
l’inverse de ce à quoi elle sert. Six images plein cadre sans rien de constant
entre elles, ce sont six images, et l’œil doit retrouver sa place à chacune —
c’est pour cette raison qu’une application de fil dessine exactement cette barre.
`railSegments` remplit un segment entre son propre début et le début de la scène
**suivante** plutôt que sur sa propre durée, parce que les transitions se
chevauchent : mesurés sur les durées, deux segments seraient en mouvement pendant
chaque fondu et la barre contredirait l’image.

**Le bandeau d’`overlay` rend la capture.** Un bandeau pleine largeur qui touche
trois côtés est un tiers-inférieur de journal télévisé : il couvre la capture d’un
bord à l’autre quelle que soit la phrase posée dessus, et un titre de quatre mots
se retrouve au milieu d’une barre vide aux deux tiers. Rien ne change de la
promesse de lisibilité — même couleur, même densité, mesurée contre les deux
extrêmes de ce que la capture peut composer — le bloc couvre simplement moins.

### Rien ne reste immobile, et le silence ne demande jamais un arrêt sur image

Un utilisateur a regardé un export et a dit, d’un film de captures fixes avec des
titres posés dessus, que ce n’était pas un film. Il avait raison, et quatre
décisions distinctes se défendaient chacune sur le chemin qui y menait.

`kenBurns` valait `static` par défaut. Un champ facultatif est un champ qu’un
modèle omet : ce défaut n’était donc pas un cas limite, c’était ce que rendait
réellement chaque diaporama généré. Le prompt de composition décrivait ensuite
`static` comme « le choix calme, et le bon quand l’image porte du texte », et plus
bas affirmait que calme veut dire « des scènes longues, des plans fixes ou des
zooms lents » : un brief demandant de la retenue recevait de l’immobilité deux
fois plutôt qu’une. Le modèle `overlay` n’avait aucun champ de mouvement, et sa
fiche de catalogue disait « il n’y a aucun mouvement de caméra ici ». Et la
légende du diaporama était simplement présente, de la première image de la scène à
la dernière — un titre, sur une image, pendant quinze secondes.

Chacun de ces points est désormais inversé.

**Le défaut est un mouvement, et `static` se demande.** `DEFAULT_KEN_BURNS` vaut
`zoom-in` sur les deux modèles qui portent le champ. `static` reste dans l’énum :
une capture d’interface a de vraies raisons d’être immobile, et retirer une valeur
d’énum ferait refuser tous les brouillons enregistrés et toutes les entrées du
journal de la file qui la nomment. Ce qui change, c’est le cas qu’on obtient en se
taisant. `zoom-in` et pas un travelling, parce que la bibliothèque mélange
librement portraits et paysages — `cover` a déjà rogné une image verticale dans un
cadre horizontal, si bien qu’un travelling y fait glisser le recadrage sans rien
révéler, là où un zoom est le même mouvement sur tous les formats et tous les
sujets.

**L’`overlay` bouge, et la règle qu’il protégeait portait sur l’amplitude.** Un
travelling est refusé parce qu’il dépense 4 % de course sur un surdimensionnement
de 12 % : un huitième de l’interface rogné avant la première image, un vingtième
qui défile. Le nouveau champ `move` dépense 1,2 % sur 3 % — l’image est un
quarantième plus grande que le cadre, la course reste dans la marge que cela
laisse, et chaque pixel visible au repos est visible sur chaque image. Trois
valeurs, `drift-up`, `drift-down` et `settle`, et aucun `still` parmi elles :
`static` existe ailleurs parce qu’un travelling et un zoom peuvent réellement
détruire une capture et qu’un document doit pouvoir les refuser, et une dérive ne
détruit rien.

**Le mouvement des cinq compositions vit dans `composition.js`.** `sceneMotion`
renvoie toutes les quantités qui changent entre deux images d’une scène, et les
cinq fichiers `.jsx` la lisent au lieu de calculer leurs propres arrivées. C’est ce
qui fait de « cette scène bouge-t-elle » une question qu’un test peut trancher —
la même raison que pour le plan d’images et les palettes — et
`tests/video-motion.test.js` la pose : pour chaque modèle, sur un document où le
modèle n’a rempli aucun champ facultatif, la dernière image de chaque scène diffère
de la première, et pas d’un seul saut. Un terme n’est renvoyé que si la composition
le dessine, parce qu’une progression de `caption` sur une scène sans légende est un
nombre qui change pendant que l’image, elle, ne change pas — et le test l’aurait
acceptée. Cela ne concerne pas que ce que porte la scène : le surtitre existe quand
le FILM a plus d’une scène, donc son texte est calculé une seule fois, dans
`planTimeline`, et voyage sur l’entrée du plan. Calculé deux fois — une par le
mouvement, une par la composition — les deux divergeaient, et tout film d’une seule
scène annonçait l’arrivée d’un surtitre qu’aucune image ne contenait.

### Deux ornements qu’un corpus rendu a rattrapés

Ni l’un ni l’autre n’est un défaut de lisibilité, ni une borne que quoi que ce soit
aurait pu vérifier. Tous deux sont le genre de défaut qui n’existe que sur une
image, ce pour quoi on rend douze documents et on les regarde plutôt que de
raisonner dessus.

**Un filet suit le bord que le document a choisi.** Quatre blocs — `heading`,
`kicker`, `quote`, `textHighlight` — dessinent un filet sur toute leur boîte et le
révèlent par un `scaleX`, et les quatre avaient `transform-origin: left`. Dans une
zone `top-left` c’est le geste de la maison et il est juste. Dans une zone centrée
c’est un filet plaqué contre la marge gauche sous un texte posé au milieu de la
mesure — et sur la pile de trois (`kicker`, `heading`, `separator`, tous en
`center`) ce filet se retrouvait juste au-dessus d’un `separator` que la rangée
flex avait, elle, centré : deux ornements dans une colonne en désaccord sur
l’emplacement de la marge. La zone publie désormais sa réponse dans
`--mocky-rule-origin`, héritée, et c’est la valeur de `textAlign` elle-même plutôt
qu’une seconde table — `left`, `center` et `right` sont les trois valeurs que
produit `TEXT_OF` et les trois mots-clés qu’accepte `transform-origin`, et ils
répondent à la même question. Une propriété CSS personnalisée parce qu’un bloc ne
peut pas lire un `text-align` hérité depuis JavaScript, et l’héritage est ce qui
tient cela hors du contrat de props sous lequel chaque bloc est écrit. `quote`
garde `left` exprès et le dit : son filet part du guillemet posé à côté de lui
plutôt que d’une mesure vide, donc une origine prise sur la zone le détacherait du
glyphe auquel il est attaché.

**Une ombre a besoin d’une seconde couleur, et une direction n’en a aucune.** Le
traitement `stack` de `funTitle` dessine le mot deux fois, la copie de dessous en
`palette.accent`. Sur une direction qui déclare le même vert sombre pour `text` et
pour `accent` sur un fond presque noir, `legibleOn` résout les *deux* runs en
`#ffffff` — correctement, de son point de vue — et `MOTION` revenait en deux copies
blanches décalées de sept pour cent : un mot qui se lit comme une faute
d’impression et non comme un titre. `funTitleShadow` prend désormais les deux encres
et rend zéro quand elles n’en font qu’une. Le plancher, `STACK_SEPARATION`, est
juste au-dessus de « la même couleur » et volontairement loin d’une barre de
lisibilité : la copie ne porte aucun glyphe qu’on lit, un rapport de luminance ne
voit pas la différence de teinte qui rend évidente une ombre dorée derrière un mot
blanc (1,76:1 sur la direction éditoriale, et c’est juste), et un test à 3:1
supprimerait le traitement sur la plupart des thèmes qui le rendent parfaitement.
Un appelant qui ne nomme aucune encre garde la réponse qu’il a toujours eue.

### La police qu’un conteneur possède vraiment

Le Dockerfile installe `fonts-liberation`, et c’est toute la situation
typographique : rien dans Mocky ne charge une webfont, et cette image n’a aucune
sortie réseau pour en chercher une. Un conteneur sans famille correspondante rend
chaque glyphe en carré vide, gravé dans un mp4 que personne n’a prévisualisé.

Une famille déclarée est donc nommée **en premier** et Liberation Sans suit, dans
une seule pile `font-family` construite par `fontStack`. Le repli propre à CSS
fait ensuite le travail, glyphe par glyphe : une instance dont l’image porte
vraiment la police l’obtient, tous les autres obtiennent Liberation Sans, et
personne ne perd un export pour une décoration (Q1). Les guillemets autour du nom
de famille ne sont sûrs que parce que le jeu de caractères du schéma ne contient
ni guillemet, ni virgule, ni point-virgule, ni accolade — ce que `composition.js`
revérifie, puisque c’est le fichier qui aurait tort si le validateur était un jour
desserré.

Deux valeurs dérivées suivent la même forme « éviter une image illisible
précise ». `withAlpha` transforme un hexadécimal déclaré en le voile qui garde une
légende lisible sur une photo que personne n’a prévisualisée. `readableInk`
choisit le noir ou le blanc d’un appel à l’action à partir de la luminance
relative de l’accent — un libellé coloré pour un bleu nuit est invisible sur un
vert d’eau, et aucune direction ne déclare de jeton pour cela.

### Le look vient du projet, et le modèle ne le voit jamais

Un film porte un `theme` : quatre couleurs, deux familles de police et un rayon.
C’est ce qui fait qu’un export ressemble au produit dont il est tiré plutôt qu’à
un modèle générique, et il ne coûte aucun jeton, parce que **le modèle ne l’écrit
pas**.

`VideoTimelineSchema` — le schéma qui valide un document composé — n’a pas de
`theme` du tout. Chaque objet y est `.strict()`, donc un modèle qui en invente un
est refusé exactement comme un modèle qui invente une piste audio, avec le même
message et sans chemin de réparation. Le serveur attache le thème ensuite, via
`attachTheme`, sur `RenderTimelineSchema` : le même catalogue avec cette unique
clé en plus. Deux schémas plutôt qu’un champ facultatif, parce que ce qui les
sépare est *qui a le droit d’écrire quelle clé*, et qu’un schéma unique à thème
facultatif accepterait le modèle qui écrit le sien.

**Uniquement ce que la direction a DÉCLARÉ.** `parseDesignSystem` répond toujours
avec sept rôles remplis et un rayon, parce qu’une feuille de style doit bien
s’afficher ; la plupart de ces valeurs sont des inventions quand le document se
tait. `parseDesignSpec` retient lesquels ont été réellement énoncés, et
`src/lib/video/theme.ts` n’émet que ceux-là. Un accent deviné et incrusté dans un
film est un mensonge indétectable — la vidéo est simplement de la mauvaise
couleur, sans que rien ne le dise — alors qu’un accent absent laisse la
composition sur un défaut choisi exprès. Les 12px vers lesquels `parseRadius` se
rabat sont le même cas, et c’est pourquoi `readRadius` existe désormais pour dire
« le document n’en a pas parlé ».

(« La direction » est l’une des **deux** sources possibles d’une déclaration —
voir *Une couleur demandée dans le brief passe devant le dossier du projet*,
plus bas. Ce qui ne change jamais : une couleur que personne n’a énoncée
n’atteint rien.)

**Rien là-dedans ne peut devenir du CSS.** Les couleurs sont hexadécimales et
rien d’autre. Une police est UNE famille, dans un jeu de caractères fait de
lettres, chiffres, espaces et traits d’union — jamais une pile — parce que cette
valeur finit dans un `font-family`, où une virgule, une apostrophe, un
point-virgule ou une accolade fait la différence entre nommer une fonte et écrire
une déclaration ; la composition ajoute ses propres solutions de repli, ce qu’elle
doit faire de toute façon puisque rien ici ne charge de fonte web. Le rayon est un
entier de pixels : aucune unité à analyser, aucun `calc()` à faire passer.

**La lecture se fait dans le navigateur, l’attachement sur le serveur,** et ce
partage est structurel, pas stylistique : le serveur garde un projet comme un
blob opaque et ne pourrait de toute façon pas importer un module `.ts` au plancher
Node 22.12 — la contrainte même qui fait de `server/video/timeline.js` une copie
tenue à la main. Un navigateur remet donc un thème au serveur, ce qui est voulu :
le schéma est assez borné pour que le pire qu’un client modifié puisse faire soit
de rendre son propre film dans ses propres couleurs.

**Une direction illisible coûte les couleurs, jamais l’export.** L’utilisateur a
déjà attendu dans une file ; `POST /render` répond 202 avec une remarque nommant
ce qui a été abandonné ([Q1](fr/architecture/invariants.md)). Tout ou rien
cependant : ne retirer que le champ fautif serait la réparation que cette
fonctionnalité refuse partout ailleurs, et cela rendrait un film aux couleurs du
projet avec la typographie de quelqu’un d’autre.

**Et le panneau le dit.** Les jetons sont affichés sous les cartes de
composition — les pastilles et les noms de familles — parce que la lecture
inverse est la mauvaise : un panneau muet sur la couleur invite à croire qu’un
réglage de couleur attend plus bas, alors qu’il n’y en a aucun et qu’il ne peut
pas y en avoir. Affichés plutôt que résumés, aussi : « vos couleurs sont
appliquées » est invérifiable de l’extérieur, et l’échec que cette note existe
pour rendre visible est une direction qui déclare moins que son auteur ne le
croit — un projet dont l’accent a été deviné n’affiche ici aucun accent, ce qui
est toute la différence entre un film aux couleurs du projet et un film dans une
supposition. Trois états et non deux : une direction qui ne déclare rien que ce
schéma sache porter n’est ni « les couleurs de votre projet » ni « aucune
direction », et elle a sa propre phrase.

**Les deux portes l’attachent, et aucune ne le montre à un modèle.** `/compose`
exécute `attachTheme` sur le document devenu la réponse du modèle, une fois cette
réponse acceptée par le schéma — une proposition revient donc déjà aux couleurs
du projet, sans attendre un rendu pour le découvrir. C’est l’ordre qui rend la
chose sûre : le modèle est validé contre un schéma sans clé `theme`, et la clé
n’est écrite qu’ensuite. Rien de la direction n’atteint le prompt non plus. Une
couleur citée à un modèle est une couleur qu’il va « améliorer », elle coûte des
jetons à chaque appel, et ce n’est pas au modèle d’en décider.

### Une couleur demandée dans le brief passe devant le dossier du projet

La règle ci-dessus dit que le thème ne porte que ce qui a été **déclaré**, et
pendant un temps « déclaré » a voulu dire un seul document. C’est une erreur : la
distinction qu’elle faisait vraiment, c’est *l’utilisateur l’a énoncé* contre *le
modèle l’a deviné* — et un brief qui dit « texte blanc sur fond noir » est un
énoncé de la même personne que le DESIGN.md, plus récent, plus précis, et à
propos de CE film plutôt que du produit en général. `src/lib/video/briefTheme.ts`
lit donc le brief, et ce qu’il y trouve l’emporte.

**Jeton par jeton, jamais en bloc.** C’est ce que « priorité » veut dire ici : un
brief qui nomme un fond n’a rien dit de la typographie, et jeter celle du projet
ferait payer toutes les autres couleurs pour une seule demandée. `mergeFilmTheme`
superpose les couleurs du brief au thème de la direction et passe le résultat aux
deux portes sans rien changer d’autre — même champ `theme`, même `attachTheme`,
même `RenderTimelineSchema`. **Rien de la règle 9 ne bouge.** Le modèle ne peut
toujours pas écrire un thème, `VideoTimelineSchema` n’a toujours pas cette clé,
et rien de l’une ni de l’autre source n’atteint un prompt.

**L’extraction est celle du design system.** `designTokens.ts` sait déjà trouver
des couleurs dans de la prose, et il a déjà été corrigé deux fois par des
documents réels — un fond déduit d’un vivier vide, une regex d’étiquette mangée
par les emphases Markdown. Un second lecteur ici aurait été un sixième miroir
tenu à la main dans un module qui en a déjà cinq ; `briefTheme.ts` fait donc la
seule chose que l’existant ne sait pas faire : il traduit la prose française et
anglaise dans la grammaire `- Étiquette : #hex` pour laquelle `parseColors` a été
écrit, puis appelle `themeFromDesign` dessus. La résolution des rôles est
`roleForLabel`, le jeu de caractères hexadécimal est `ThemeColorSchema`,
« déclaré » est `parseDesignSpec.stated`. Une implémentation, une porte.

**Un nom est une déclaration ; la nuance est celle de Mocky, une fois, dans le
code.** Personne ne tape `#c0392b` dans un brief — on tape « en rouge et noir » —
donc une table fermée associe un mot de couleur à un hex, bilingue, avec les
formes féminines dedans parce que l’accord n’est pas facultatif en français. Cet
hex est un choix, et c’est le même genre de choix que `THEME_FALLBACK.accent` :
fait une fois, dans un fichier relu, et visible dans le résultat. « or » est
délibérément absent alors que « doré » est présent : seul, c’est l’une des
conjonctions les plus courantes du français écrit, et une table qui s’y
déclencherait peindrait un film en doré à cause d’une phrase qui parle d’autre
chose. Un modificateur — « foncé », « dark » — déplace la couleur nommée vers le
noir ou le blanc d’une constante unique plutôt que par une seconde table d’hex,
pour que « vert » et « vert foncé » ne puissent pas dériver vers deux verts sans
rapport.

**Un rôle n’est jamais deviné.** « En rouge et noir » énonce deux couleurs et
aucun rôle, et rien n’en est retenu : laquelle des deux est le fond, c’est
exactement la supposition qui grave dans un film une couleur qu’on ne peut pas
voir à travers. Une couleur ne compte que si le brief dit aussi à quoi elle sert
— un mot de rôle à trois mots derrière elle ou deux devant (« fond noir »,
« white text »), le mot `sur`/`on` immédiatement avant, ou l’idiome « X sur Y »
qui nomme les deux d’un coup. La fenêtre s’arrête à une frontière de proposition,
virgule comprise : « black background, white text » plaçait un mot de rôle à un
mot derrière une couleur qui appartient au groupe suivant, et lu en arrière il
peignait le fond en blanc. Le deux-points n’est pas une frontière, parce que
« Fond : noir » est quelqu’un qui énonce un jeton.

**Et le panneau dit quels rôles il a compris**, dans la ligne sous les pastilles.
Ce n’est pas une politesse : une lecture que personne ne voit ne se distingue pas
d’une demande ignorée, et tout l’intérêt de ne rien retenir d’une phrase ambiguë
est que son auteur puisse la corriger en une modification. La phrase nomme les
rôles et montre comment en demander un ; les pastilles au-dessus disent déjà la
couleur.

**Le fond d’un brief peut rencontrer l’encre d’un dossier, et c’est sûr plutôt
que chanceux.** Le quasi-noir d’une direction crème sur un fond noir qu’on vient
de demander est un appariement qu’aucun document de design n’a modéré. C’est
précisément le cas dont traite la section suivante : `resolveTheme` apparie ce
qui reste non déclaré, chaque texte est mesuré contre la surface sur laquelle il
est réellement peint, et celui qui ne peut pas franchir son plancher est dégradé
plutôt que de faire échouer l’export ([Q1](architecture/invariants.md)). Le
corpus de `composition.test.js` porte cette demande exacte — un vert foncé sur
noir — pour que la garantie soit balayée sur les cinq palettes plutôt
qu’argumentée.

### Aucun texte illisible, et c’est l’arithmétique qui le dit

Deux exports réels ont tranché la question. Un film `titles` a mis « Gemini 3 »
en vert foncé sur une image quasi noire, et son sous-titre en gris foncé sur la
même ; un film `product` a fait pareil à « Porsche 911 » et à ses trois
arguments. Dans les deux cas, l’appel à l’action était la seule chose lisible à
l’écran — parce que la pastille était le seul élément du catalogue qui choisissait
déjà son encre en mesurant.

La cause n’était pas une couleur. C’était un **appariement** : `theme.ts` n’émet
que les jetons qu’une direction a réellement déclarés, `composition.js` remplissait
le reste depuis un repli, et une direction écrite pour une page déclare une encre
et laisse le fond tacite. Les deux couleurs se sont rencontrées pour la première
fois à l’intérieur d’un mp4, sans avoir jamais coexisté dans le design d’où elles
venaient toutes les deux.

**Le fond suit l’encre, puis tout est mesuré quand même.** Les deux moitiés sont
nécessaires, et l’ordre est le sujet :

- `resolveTheme` résout fond, encre et surface comme une **paire**. Une encre
  foncée déclarée obtient du papier, une encre claire garde le fond sombre, un
  fond déclaré obtient une encre mesurée contre lui, et une direction qui a
  déclaré les deux n’est jamais contredite. C’est la moitié qui respecte le
  design : une direction avec un vert foncé voulait ce vert sur du papier, et
  repeindre son texte en blanc aurait produit un film lisible qui n’est pas le
  film du projet — le mensonge même que `theme.ts` refuse quand il renonce à
  deviner un jeton.
- Chaque bloc de texte est ensuite tenu contre la surface sur laquelle il est
  **réellement** peint, par `legibleOn`, et corrigé s’il ne franchit pas son
  seuil. La dérivation rend le cas courant juste ; la mesure rend tous les cas
  sûrs, y compris les deux que l’appariement n’atteint pas — une direction qui a
  déclaré les deux couleurs mal, et les surfaces (`surface`, `accent`, les voiles
  posés sur les photographies) qu’aucune règle d’appariement ne touche.

**Les seuils sont ceux de l’audit**, 4,5:1 et 3:1, pour qu’un film ne puisse pas
livrer un contraste que le panneau d’accessibilité signalerait comme un défaut
sur l’écran dont il a été monté. Lequel des deux s’applique est décidé par le
rôle typographique de la composition, jamais par un nombre de pixels : les titres
et les libellés gras prennent 3 — `rules.ts` dirait la même chose, son seuil étant
24 px, ou 18 px en gras — et le texte courant prend 4,5 alors que cette même règle
le classerait aussi comme grand. Chaque glyphe d’une image 1080p dépasse 24 px, et
le seuil indulgent accordé à tout est un sous-titre illisible sur une image
regardée depuis un canapé.

**Ce qui cède, et dans quel ordre.** Quand l’encre déclarée ne franchit pas son
seuil, `legibleOn` parcourt une liste ordonnée de tentatives et retient la
première qui passe : le voile s’épaissit d’abord (la réparation la moins visible
qui existe, et elle garde la couleur du projet), puis l’encre cesse d’être
atténuée, puis les autres couleurs du thème sont essayées à leur tour, et le noir
ou le blanc seulement ensuite. Une direction à deux verts rend un vert lisible ;
un blanc générique franchirait tous les seuils et effacerait la direction
artistique, ce que cet ordre existe précisément pour empêcher. Quand rien ne
passe — une palette mi-ton sur une surface mi-ton peut réellement n’avoir aucune
réponse — la paire la plus lisible trouvée est utilisée et l’export part quand
même ([Q1](architecture/invariants.md)).

La liste se termine sur le noir pur (`INK_FLOOR`) et non sur le presque-noir que
les compositions préfèrent, et cette dernière entrée relève de l’arithmétique et
non du goût. Le noir et le blanc se croisent à 4,58:1, donc une surface opaque a
toujours une encre qui franchit 4,5 — alors que `INK_DARK`, un `#101014` choisi,
porte un cinquième de point de moins et déplace ce croisement à 4,36:1. Un
balayage de quarante mille directions aléatoires a placé 4 164 séries dans la
bande entre les deux : deux tiers de tous les échecs signalés par la recherche,
chacun à un dixième de son plancher, la réponse étant un candidat plus loin.
`#101014` reste essayé en premier, donc rien du rendu n’a changé.

**Une photographie n’est pas dans le thème**, donc un texte posé dessus est mesuré
contre le voile aux DEUX extrémités de ce que l’image peut en composer : sur un
fond entièrement noir et sur un fond entièrement blanc. Le coût est un voile plus
dense qu’une photographie sombre n’en demande, et c’est le prix d’une garantie
donnée sans ouvrir l’image. C’est aussi pourquoi `vertical` ne repose plus sur un
dégradé ancré à un bord : ce qui se trouve sous un glyphe dans une rampe dépend de
l’endroit où la ligne s’est coupée, et une légende positionnée `center` atterrissait
sur la photographie brute, le voile déjà évanoui. Un assombrissement uniforme a une
seule valeur partout et devient donc calculable ; la rampe directionnelle reste
par-dessus comme cadrage, où elle ne fait jamais qu’ajouter de la densité.

**Un ornement est mesuré lui aussi, et il paie de sa poche.** Un surtitre, un
numéro à côté d’un argument, le filet sous une accroche : ces éléments existent
pour porter la couleur du projet, ils entrent donc dans la même recherche à un
autre endroit — `accentFirst` place l’accent devant la liste ordinaire de
candidats, inchangée par ailleurs, si bien qu’un accent illisible retombe malgré
tout sur quelque chose de lisible. Ils sont aussi résolus avec le voile
**verrouillé** (`lockVeil`), et c’est toute la différence entre un ornement et une
légende : monter un bandeau à 0,94 pour qu’un surtitre indigo reste indigo cache
la capture que ce modèle existe précisément pour montrer. Verrouillée, la
recherche change l’encre plutôt que l’image. Elle ne peut pas échouer là où le
texte a réussi, parce que `accentFirst` est un sur-ensemble de `inkCandidates` et
que toute surface partagée porte déjà une série au plancher d’affichage résolue
depuis cette liste — `composition.test.js` mesure les deux, et c’est ce qui garde
la phrase vraie. La barre de progression verticale est la seule exception, et le
code dit pourquoi : sa piste ne porte aucune autre série, donc aucune densité
n’a déjà été prouvée par quelqu’un d’autre, et elle a le droit d’épaissir parce
qu’elle coûte une barre de trois pixels.

**Une texture fait partie de la surface, pas d’une couche par-dessus.** Les deux
modèles à fond plat sont dessinés sur un champ de filets d’1 px, et un fond est la
seule chose décorative capable de défaire toute cette section sans en toucher une
ligne : un glyphe posé sur un champ de filets se trouve sur l’une de deux
couleurs, et une palette qui n’en mesurerait qu’une passerait au vert sur une
texture assez dense pour manger la marge d’une accroche. Ici les deux couleurs
sont **connues**, contrairement à une photographie : `surfaceRange` accepte donc
un `tint` et mesure les deux — et la composition peint la texture en relisant ce
même objet dans la palette, si bien qu’une densité retouchée dans un composant ne
peut pas laisser la mesure derrière elle.

La mesurer n’était que la moitié de la réponse. Tous les autres calques d’ici
peuvent bouger — un voile monte, une encre atténuée revient à pleine force, une
encre est remplacée — et la texture était le seul à ne pas le pouvoir : figée à
4 %, donc capable de dépenser un contraste que rien ne pouvait regagner, sur un
fond mi-ton qui avait une réponse à 4,5 nu et plus aucune une fois le champ
partagé en deux couleurs. Elle cède donc. `texturedGround` résout la palette avec
la texture, et si une série échoue alors que le fond nu les porterait toutes, le
`tint` est abandonné et la composition ne peint aucun champ. Uniquement pour une
série qui **passe** ensuite — un fond où aucune des deux versions ne marche garde
sa texture, puisque renoncer au design n’y achète rien.

**Et la formule de contraste est un miroir tenu à la main.** `worker/video/remotion/contrast.js`
recopie la moitié WCAG de `src/lib/audit/colors.ts`, parce qu’un bundle Remotion ne
peut pas importer du TypeScript — le même mur qui fait de `server/video/timeline.js`
une copie de `timeline.ts`, et la même discipline : `contrast.test.js` passe un
corpus dans les deux et exige des réponses identiques, entrées illisibles comprises.

### Un document refusé est refusé, jamais réparé

Aucune scène de quarante secondes n’est ramenée à quinze, aucune légende de 200
caractères n’est tronquée, aucune vingt-et-unième scène n’est écartée. La
tentation est réelle, car chacune de ces réparations transforme un appel de
modèle raté en vidéo livrée. C’est aussi exactement la faille que le schéma a été
écrit pour fermer.

Deux raisons, et la seconde est celle qui tranche :

- Un document réparé est un document que personne n’a validé. Ramener une scène
  de 40 s à 15 s ne produit pas le film demandé, mais un autre film licite, et
  l’utilisateur ne peut pas savoir lequel il regarde.
- La réparation est l’endroit où meurt le plafond de durée totale. Corrigez
  chaque scène indépendamment, et vingt d’entre elles font toujours cinq minutes.

Le même refus vaut pour un `imageId` que l’utilisateur n’a pas sélectionné. Il
est refusé, pas remplacé par le plus proche — une substitution serviable met dans
le film de quelqu’un une image qu’il n’a jamais choisie. Une image *oubliée* par
la proposition n’est en revanche qu’une remarque, car la différence est de savoir
qui paie : un identifiant étranger ajoute quelque chose, un identifiant manquant
rend seulement la proposition plus courte que la sélection, et remettre la scène
tient en un clic dans un éditeur que l’utilisateur a déjà sous les yeux.

Et il vaut pour la composition elle-même. Un `product` refusé pour une scène de
2000 ms est refusé en tant que product, jamais rejugé comme le diaporama dont le
plancher est à 1000 ms et qui serait passé — cela rendrait un autre film que
celui qui a été proposé, sans que rien ne le dise. Le seul refus qui porte plus
qu’un « non » est celui d’une composition qui exige une image alors que rien
n’est sélectionné : là, la remarque nomme `titles`, parce que celui-là,
l’utilisateur ne peut le corriger en reformulant quoi que ce soit.

Une proposition qui n’a rien produit répond **`200` avec `timeline: null` et des
remarques**, jamais une erreur 4xx. L’utilisateur dispose toujours de l’éditeur
manuel avec lequel il a ouvert la fenêtre, et une proposition ratée n’est pas une
requête ratée ([Q1](fr/architecture/invariants.md)).

### Deux copies du schéma, tenues ensemble par un test

`server/video/timeline.js` recopie le TypeScript à la main. C’est une duplication
délibérée, pour la même raison que `server/images/zip.js` duplique
`src/lib/zip.ts` : `package.json` déclare `"node": ">=22.12"`, et à ce plancher
`node server/index.js` lève `ERR_UNKNOWN_FILE_EXTENSION` sur un import `.ts`.
Faire dépendre la seule validation de l’API de la version mineure de Node que
l’administrateur exécute est un bien plus mauvais marché qu’un fichier recopié.

`timeline.test.js` passe un corpus de documents dans les deux schémas et exige
des réponses identiques, valeurs par défaut comprises. Modifiez un seul côté et
la suite échoue — ce qui compte surtout dans la direction dangereuse : une borne
relâchée du seul côté serveur donne une API qui accepte ce que rien en aval ne
sait rendre.

**Il existe une troisième copie, et c’est elle qui a mis au jour un désaccord
réel.** `worker/video/validate.js` n’est pas un portage du schéma — il demande si
la composition sait dessiner le document — mais il applique les mêmes bornes, et
`validate.test.js` fait passer son propre corpus dans les deux. C’est là que
`" "` est apparu : `min(1)` compte des caractères, donc une légende blanche
satisfaisait zod, tandis que `readText` côté worker a toujours refusé une chaîne
qui se réduit à rien une fois rognée. Mocky validait un document que son propre
moteur de rendu renvoie — le montage passe, le travail est mis en file,
l’utilisateur attend un rendu, et le refus arrive au bout à propos d’une légende
qu’il a sous les yeux. Chaque champ texte du schéma passe désormais par `line()`,
soit `min(1).max(n)` plus `/\S/`. Un `regex` et non un `refine`, parce qu’un
raffinement enveloppe la chaîne dans un `ZodEffects` et que `draft.ts` lit
`TextOverlaySchema.shape.content.maxLength` sur le schéma précisément pour qu’un
attribut `maxLength` ne dérive pas de la règle. Et refusé plutôt que rogné :
rogner est une réparation, et l’appelant est un modèle à qui l’on peut le dire.

---

## La licence Remotion, et le service séparé

Remotion est gratuit pour les particuliers, pour les organisations à but non
lucratif et pour les sociétés jusqu’à trois salariés. Au-delà de ce seuil, il
exige une Company License payante, achetée par siège. Et sa licence ne tranche
pas le cas dans lequel Mocky se trouverait autrement : **la redistribution au
sein d’un produit auto-hébergé**.

Remotion n’est donc pas dans le `package.json` de Mocky, pas dans son
`Dockerfile`, et pas dans le `docker-compose.yml` par défaut. Il vit dans
`worker/video/`, derrière `profiles: ["video-export"]` :

```bash
docker compose --profile video-export up -d --build
```

Sans ce drapeau, le service n’est ni construit, ni créé, ni démarré, et
`docker compose up -d` se comporte exactement comme avant l’existence du
répertoire. **Rien de l’export vidéo n’existe sur une instance qui ne l’a pas
construit** — et c’est le fond du sujet. Tenir Remotion hors de l’arbre de
dépendances fait que la question de licence *n’existe pas* pour tous ceux qui
n’activeront jamais la fonctionnalité, c’est-à-dire presque tout le monde.
Construire cette image est le moment où la question devient la vôtre.

Deux raisons plus petites suivent, et n’auraient pas suffi seules : Remotion
apporte une compilation de Chrome et une chaîne webpack, soit plusieurs centaines
de mégaoctets ajoutés à une image dont l’argument est de tourner sur une petite
machine ; et un rendu, c’est un navigateur et un encodeur cloués sur un cœur
pendant une minute, ce qui, dans son propre conteneur avec ses propres limites,
est un export en échec plutôt qu’une panne générale.

La séparation est tenue par `tests/video-worker-separation.test.js`, et c’est le
point sur lequel il faut insister : quatre documents expliquent cette règle, et
un document ne peut pas faire échouer une compilation.

### Le seuil des trois salariés compte des salariés, pas des comptes

Mocky ne peut pas savoir combien de personnes votre organisation emploie. Le
nombre qu’il *peut* compter, ce sont les comptes de l’instance, et ce ne sont pas
les mêmes chiffres — une société d’une personne peut faire tourner une instance à
quarante comptes, et une société de quarante personnes une instance à un seul
identifiant.

Chaque phrase du panneau d’administration est donc écrite pour énoncer la règle
et laisser l’administrateur l’appliquer, jamais pour affirmer qu’il a franchi la
ligne. L’avertissement cite explicitement le nombre de comptes comme n’étant
*pas* la réponse. Un avertissement faux une fois sur deux est un avertissement
qu’on apprend à écarter, y compris les fois où il a raison.

La clé de licence est stockée côté serveur et n’est jamais renvoyée au
navigateur : `publicView()` la remplace par un booléen `hasLicenseKey`, la même
discipline que pour toutes les clés de fournisseur. Elle voyage vers le worker
dans la requête de rendu, parce que c’est le worker qui rend.

**Une clé change la posture réseau du worker, et cela se voit.** À partir de
Remotion 5.0, la télémétrie est obligatoire pour un rendu sous licence : une clé
configurée mais incapable de joindre Remotion est une clé qui ne fonctionne pas.
Le réseau Compose sur lequel le worker vit est déclaré `internal: true` — Docker
le crée sans passerelle, donc sans clé le conteneur n’a aucune sortie réseau.
Donner l’accès dont la télémétrie a besoin tient en une ligne, `internal: true` →
`internal: false`, et cela appartient à qui a saisi la clé. Le panneau le dit au
moment de la saisie, plutôt que d’ouvrir la sortie réseau en silence.

---

## L’URL du worker et le garde SSRF

L’URL du worker de rendu est la **troisième dérogation réservée à
l’administrateur** au garde SSRF de Mocky, à côté de la cible texte
administrateur et de l’URL de base sd-webui. Elle est énumérée avec elles dans
[les invariants](fr/architecture/invariants.md), et tout le raisonnement y vit
plutôt que d’être répété ici — cette liste est courte et complète à dessein, et
une dérogation défendue dans une page de fonctionnalité plutôt que dans les
invariants est une dérogation que quelqu’un finit par retirer.

En bref : gardée, la fonctionnalité n’avait **aucune configuration
fonctionnelle**. Le worker est livré sur un pont `internal: true` sans port
publié, si bien que sa seule adresse est un nom de service qui résout dans
`172.16/12`. Ce qui reste vérifié figure dans la même entrée.

---

## L’arithmétique des transitions

Une transition **mord** sur ses voisines. Elle mange la fin de la scène qui part
et le début de celle qui arrive ; elle n’est jamais ajoutée à la durée totale.

C’est ce qui rend honnête le plafond de deux minutes. Si une transition ajoutait
sa propre durée, vingt scènes en porteraient dix-neuf, et un montage validé à
exactement 120 000 ms rendrait 129,5 s — au-delà du plafond du schéma, et
au-delà du délai de 120 secondes de la file elle-même, qui se mettrait alors à
tuer des exports qui avaient pourtant validé proprement.

`msToFrames` arrondit **vers le bas**, et c’est l’autre moitié de la même
garantie. Arrondir au plus proche laisse vingt scènes atteindre 3610 images,
c’est-à-dire 120,33 s. La partie entière inférieure est sous-additive — la somme
des parties ne peut jamais dépasser la partie entière du tout — et cela coûte au
plus une image par scène.

| Constante | Valeur | Pourquoi |
|---|---|---|
| `FPS` | 30 | Non configurable. Le schéma n’a pas de champ de fréquence, donc une option ici serait hors d’atteinte ; 60 images par seconde doublent les captures Chromium pour un diaporama d’images fixes |
| `TRANSITION_MS` | 500 → 15 images | Assez long pour se lire comme intentionnel, assez court pour ne pas devenir ce qu’on regarde |
| `MAX_TRANSITION_SHARE` | 3 | Une transition ne peut jamais manger plus d’un tiers de la plus courte des deux scènes qu’elle relie |
| `MAX_TOTAL_DURATION_MS` | 120 000 | 20 × 15 s autoriserait un rendu de cinq minutes — des minutes de processeur sur un worker que personne ne regarde |
| `JOB_TIMEOUT_MS` | 120 000 | Le PLANCHER sous l’échéance d’un travail, pas l’échéance. Voir ci-dessous |
| `JOB_BUDGET_BASE_MS` / `JOB_BUDGET_PER_FILM_MS` | 45 000 + 6× | Le temps réel accordé à un film d’une longueur donnée |

### L’échéance suit la longueur du film, parce qu’un rendu n’est pas du temps réel

`JOB_TIMEOUT_MS` était toute la réponse, justifié par « 120 s correspond à
`MAX_TOTAL_DURATION_MS` — un rendu qui a pris plus de temps que la durée de la
vidéo n’aboutira pas ». La phrase sonne juste et elle est fausse. Remotion met
en page et peint chaque image dans un navigateur sans écran, donc le 1080p rend
à environ un QUART du temps réel. Mesuré sur le worker à deux cœurs : 6 s de
film ont pris 22 s, 15,5 s en ont pris 66, 30,5 s en ont pris 130.

Le plafond fixe refusait donc tout film de plus d’une trentaine de secondes — un
film que le schéma accepte, que le panneau met en file, que l’utilisateur
regarde, et que l’horloge tue ensuite. Le mouvement de caméra devenu le défaut
rend ce régime plus fréquent, pas moins.

`jobBudgetMs(totalDurationMs)` vaut `max(120 s, 45 s + 6 × film)`. Le multiple
est 6 contre 4,3 mesuré, parce que la mesure vient d’une machine et que le
nombre qui compte est celui dont une machine plus lente a besoin. Rien de ce qui
tient aujourd’hui ne perd du temps : l’ancienne valeur fixe est le plancher.

Cette arithmétique existe désormais en **trois** exemplaires —
`server/video/queue.js`, `worker/video/server.js` (10 s plus bas, pour que le
worker abandonne le premier et puisse nommer la machine), et
`src/lib/video/timeline.ts` pour l’échéance de scrutation du panneau. Aucun des
trois ne peut importer les autres : un bundle ne peut pas lire le `.js` du
serveur, et `worker/` est exclu du contexte de construction de l’image Docker de
Mocky pour que la licence de Remotion reste hors de l’image par défaut.
`tests/video-render-budget.test.js` balaie toutes les durées que le schéma peut
produire et tient les trois à la même réponse.

L’exemplaire du panneau était le seul faux pour une deuxième raison : son
échéance de scrutation valait `MAX_TOTAL_DURATION_MS`, ce qui confondait deux
grandeurs qui se trouvaient valoir 120 s toutes les deux — la durée qu’un film
peut AVOIR et le temps que son rendu peut PRENDRE. Laissé tel quel, il aurait
annoncé un délai dépassé sur un film d’une minute pendant que le worker en était
tranquillement à la moitié, et l’export terminé serait apparu dans Média sans
plus aucun panneau pour le montrer.

Le plafond de partage est atteignable, pas théorique. La scène minimale du schéma
est de 1000 ms — 30 images — et une transition de 500 ms non plafonnée de chaque
côté n’en laisse aucune image debout toute seule : une vidéo dans laquelle aucune
image n’est jamais réellement montrée, produite à partir d’un montage que tous
les validateurs ont accepté.

Les noms des champs découlent de tout cela. `transitionOut` appartient à la scène
qui *part*, mais c’est la scène qui *arrive* qui s’anime, en fondu ou en balayage
par-dessus une devancière restée opaque. Un fondu à deux faces passe par le fond
à mi-parcours et cligne.

Tout cela vit dans `worker/video/remotion/composition.js`, en JavaScript nu, sans
React ni import Remotion, pour que `composition.test.js` puisse tourner dans la
suite vitest de Mocky, où Remotion n’est pas installé. Les comptes d’images, les
décalages et la géométrie sont là où sont les défauts, et ils sont la seule part
d’une vidéo vérifiable sans en produire une. Ne déplacez pas ce calcul dans le
JSX.

---

## Ce qu’on dit à l’encodeur

`renderMedia` était appelé avec un codec et rien d’autre, et tout le reste était
le défaut de Remotion. Le rapport qui l’a trouvé tenait en une phrase — *la
qualité des vidéos est vraiment mauvaise, tout est pixelisé* — de quelqu’un qui
venait d’exporter un film 1920×1080 fait de photographies de forêt.

Les défauts, à la version épinglée 4.0.507 :

| Option | Défaut | Ce que ça donnait ici |
|---|---|---|
| `imageFormat` | `jpeg` | chaque image sortait de Chromium en JPEG |
| `jpegQuality` | 80 | …quantifiée à 80, avant même que l’encodeur la voie |
| `crf` | 18 (h264), 9 (vp8) | la même image quantifiée une seconde fois |
| `pixelFormat` | `yuv420p` | correct, et subi plutôt que choisi |
| `scale`, `everyNthFrame` | 1, 1 | corrects, et rien à corriger |

Deux quantificateurs sur la même grille de 8×8, et le premier n’achetait rien :
les images ne touchent jamais un disque, elles reviennent par la socket devtools
et entrent directement dans l’encodeur. Sur un feuillage sombre et très détaillé,
cette première passe **est** le blocking du rapport.

**La capture reste en JPEG, à la qualité 100 — et désormais pour une raison
mesurée.** `imageFormat: 'png'` est la bonne réponse à « ne quantifie pas deux
fois », et elle a été refusée la première fois sur une estimation : qu’un PNG
1080p coûterait « un ordre de grandeur » de plus par image. Personne ne l’avait
mesuré. Le même diaporama de photographies de la bibliothèque, en 1920×1080,
rendu deux fois dans le conteneur du worker (`cpus: 2.0`, concurrency 2) :

| | jpeg 100 | png | contre |
|---|---|---|---|
| 465 images (15,5 s) | 66,2 s | 106,5 s | `RENDER_TIMEOUT_MS` = 110 s |
| 915 images (30,5 s) | 129,9 s | 212,8 s | |
| pic mémoire du conteneur | 3081 Mo | 4096 Mo | `mem_limit: 4g` |
| PSNR contre une référence sans perte | 43,15 dB | 44,32 dB | capture png, crf 1 |

Pas un ordre de grandeur — environ 60 %. Et un refus quand même, pour une raison
plus nette que l’estimation ne pouvait en donner : un film de quinze secondes
finit 3,5 s avant l’échéance, et celui de trente secondes prend deux fois
l’échéance en touchant exactement la limite mémoire. Le PNG n’achète pas un
export plus net ; il achète un 504 sur le prochain film à peine plus long, et un
OOM kill qui arrive à l’utilisateur sous la forme « le worker n’a pas pu être
joint ».

Ce qui tranche, c’est la dernière ligne. Tout le gain du PNG vaut **+1,17 dB**,
et +1,00 dB était posé dans le plafond de débit ci-dessous — pour **+0,3 %** de
temps de rendu. La capture n’a jamais été l’endroit où vivait la perte
restante ; elle en avait seulement l’air. La qualité 100 aplatit les tables de
quantification de libjpeg : la luminance arrive intacte. Ce qu’elle ne récupère
pas, c’est la résolution de chrominance — et c’est pour cela que c’est
l’essentiel du chemin plutôt qu’un compromis, puisque la sortie est en 4:2:0 de
toute façon.

**`yuv420p` est écrit, pas subi, et c’est délibérément le défaut.** L’instinct,
pour un film fait de typographie sur photographies, est `yuv444p` — et c’est le
mauvais geste : h264 en 4:4:4 est le profil High 4:4:4 Predictive, que les
navigateurs ne décodent pas, et l’onglet Média de Mocky lit ces films dans une
balise `<video>`. L’export « net » serait celui que personne ne peut regarder.
L’écrire signifie qu’une version de Remotion qui change son propre défaut ne peut
pas changer ce dans quoi un export Mocky s’ouvre — v4 → v5 a déjà déplacé le
défaut de `colorSpace`.

**h264 reçoit un CRF 14 et un plafond qui dépend de la longueur du film ; vp8
reçoit un débit.** Ce n’est pas le même réglage écrit autrement :

- un CRF n’a aucune borne de taille, et le film revient entier dans une réponse
  HTTP, traverse `server/video/worker.js` en un seul Buffer et est écrit contre
  le même `diskBudget` que les bibliothèques d’images et de clips. Le CRF voyage
  donc avec `encodingMaxRate` et `encodingBufferSize` — un plafond de **244 Mo
  pour le film le plus long que le schéma autorise**, quarante d’entre eux contre
  le budget par défaut de 10 Go, et chaque film réel une fraction de cela ;
- vp8 reçoit `videoBitrate: '8M'` et pas de CRF, parce que Remotion émet `-crf`
  et jamais `-b:v 0`. libvpx lit un CRF comme une qualité *contrainte*, bornée
  par le débit cible — et sans `-b:v`, ce cible est le défaut de ffmpeg pour un
  encodeur vidéo : 200 kbit/s. Le chemin webm ne subissait pas seulement un
  défaut : le défaut qu’il subissait plafonnait un film 1080p à un débit prévu
  pour une vignette.

**Le plafond était devenu un réglage de qualité, et personne ne pouvait le
voir.** Il valait 16 Mbit/s, justifiés comme étant « au-dessus du débit que le
CRF 18 dépense, donc il ne peut rien coûter à un film ». Vrai du CRF 18 —
13,1 Mbit/s mesurés — et faux dès l’instant où le CRF est passé à 16, qui en
dépense 16,9. Un encodage écrêté ne signale aucune erreur : chaque export depuis
perdait un décibel en silence. Mesuré, par CRF, plafond levé : 18 → 13,1 Mbit/s,
16 → 16,9, 14 → 21,8, 12 → 28,3.

Ce qui est borné, c’est donc désormais le **fichier** et non le débit — le
magasin, le Buffer et la réponse comptent tous en octets — et le débit est ce
qu’un film de cette longueur peut se payer dans un budget de 244 Mo, jusqu’à un
plafond de 28 Mbit/s et jamais sous les 16 d’avant. Un débit qui dépend de la
longueur est un vrai choix : deux minutes de 1080p et huit secondes de 1080p ne
sont pas le même objet, et le plafond plat était la seule chose qui les rendait
égaux. Aux 120 s du schéma la formule répond exactement 16, donc le pire cas est
**inchangé** et strictement plus petit à toutes les autres longueurs ;
`encoding.test.js` balaie chaque durée et tient la borne.

28 plutôt que 24 parce que `maxrate` borne une crête quand le débit d’un CRF est
une moyenne, et que passer la moyenne n’est pas passer le plafond : contre le
même encodage sans aucun plafond (45,24 dB), un plafond à 24 coûtait 0,42 dB et
28 en coûte 0,10. 28 est le plus petit plafond qui ne soit pas un réglage de
qualité.

**Ce que valent les deux changements, bout en bout**, sur des documents
identiques :

| | PSNR | SSIM | poids (3 s) | temps de rendu |
|---|---|---|---|---|
| avant — jpeg 100, crf 16, 16 Mbit/s | 43,15 dB | 0,9863 | 5594 ko | 168,0 ms/image |
| **après — jpeg 100, crf 14, 28 Mbit/s** | **45,14 dB** | **0,9895** | 8137 ko | 172,4 ms/image |
| la capture PNG qui a été écartée | 44,32 dB | 0,9884 | 5303 ko | 249,8 ms/image |

**+1,98 dB pour +2,6 % de temps de rendu** — contre +1,17 dB pour +48,7 %. Et
`x264Preset` reste absent, là aussi pour une raison mesurée maintenant : `slow`
a rendu 43,14 dB contre les 43,15 de `medium` au même CRF, un fichier 1,5 % plus
petit, pour 17 % de temps en plus. Un preset échange du poids contre du CPU à
qualité constante ; il n’y a jamais eu un décibel dedans.

**`concurrency` est déclaré aussi, et c’est le seul défaut qu’un conteneur rend
activement faux.** Remotion ouvre la moitié des threads CPU qu’il *voit*. Or
`cpus: 2.0` dans le fichier compose est un quota CFS, pas un masque d’affinité :
rien de ce que le worker peut appeler ne répond deux — ni `os.cpus()` ni
`os.availableParallelism()`. Il lit les threads de l’hôte, et sur une machine de
build ordinaire à seize threads le rendu ouvre huit onglets Chromium pour se
partager deux cœurs. En gaspillage ce n’est qu’un moins bon marché face à une
échéance de 110 s ; ça cesse d’être anodin dès que la capture monte, parce que
`concurrency` est le nombre d’images capturées en vol au même instant et qu’une
image en qualité 100 pèse plusieurs fois une image en qualité 80. Monter la
capture en laissant le multiplicateur à l’hôte sur lequel l’image tourne, c’est
ainsi qu’un worker qui rend parfaitement sur une machine se fait tuer par l’OOM
sur une plus grosse — contre `mem_limit: 4g`, sans rien dans le job d’autre que
« le worker n’a pas pu être joint ». `RENDER_CONCURRENCY` est donc dans le
fichier compose à côté du `cpus` qu’il doit suivre, vaut 2 par défaut dans le
code, et `encoding.test.js` lit les deux nombres dans `docker-compose.yml` — de
sorte qu’en monter un et oublier l’autre casse un build, pas un rendu.

Tout cela vit dans `worker/video/encoding.js`, sans import Remotion, pour la même
raison que `composition.js` n’en a pas : `render.js` ne peut être chargé par
aucun test de ce dépôt, et la construction de l’appel est la seule part d’un
rendu vérifiable sans en produire un. `encoding.test.js` garde les défauts de
Remotion en littéraux — un test qui les lirait dans le module testé serait
d’accord avec n’importe quoi — et vérifie que chaque codec reçoit les clés qu’il
lit et aucune qu’il ignorerait, que les cinq modèles rendent à une seule qualité,
et que le plafond de 244 Mo est de l’arithmétique et pas une phrase. Il porte
aussi le débit mesuré de chaque CRF, de sorte qu’un plafond descendu sous le CRF
qu’il est censé garder casse un build au lieu de coûter un décibel à chaque
export, en silence.

---

## Ce que l’encodeur ne peut pas atteindre : une image plus petite que le cadre

Le même rapport d’une phrase avait une seconde cause, en amont de tout réglage
d’encodeur. Le trajet a été suivi de bout en bout, et il ne perd rien jusqu’à la
dernière étape :

| Étape | Ce qui arrive aux pixels |
|---|---|
| `server/images/library.js` | les octets du fournisseur, entiers, dans `data/image-library/<hash>.jpg`. Pas de vignette, pas de seconde copie, pas de ré-encodage — le `.jpg` est une convention de nommage et `mime` dit ce que le fichier est vraiment |
| `collectImages` (`server/video/worker.js`) | le fichier est lu et encodé en base64. Dédupliqué, jamais retaillé |
| `POST /render` du worker | un plafond de corps à 80 Mo. Il **refuse** ; rien là n’ajuste une image pour la faire entrer |
| `stageImages` (`worker/video/staging.js`) | les mêmes octets, écrits à côté du bundle |
| la composition | `object-fit: cover`, et c’est là que ça se perd |

La bibliothèque d’images de Mocky produit **1024×1024** par défaut. Un export
`16:9` fait **1920×1080**. `cover` remplit les deux bords : l’image est donc
agrandie **×1,88** et 44 % en est rognée au passage — et un mouvement Ken Burns
en demande 12 % de plus, un pan pendant toute la scène, un zoom à l’une de ses
extrémités. À ×2,1 une photographie de feuillage sombre est de la bouillie, et
aucun `crf`, aucun `jpegQuality`, aucun débit ne rend une définition qui n’a
jamais été dans le fichier.

D’où deux changements, et le premier vaut plus qu’il n’en a l’air.

**Une image faite POUR un film est demandée au format du film.** « Partir d’une
image » n’envoyait aucune dimension, donc le carré par défaut de la bibliothèque
pour tous les exports. Elle envoie désormais `SOURCE_DIMENSIONS` — 1344×768 en
`16:9`, 768×1344 en `9:16`, 1024×1024 en `1:1`. L’appel au fournisseur coûte
exactement pareil et les deux moitiés de la perte diminuent d’un coup : la forme
correspond, donc `cover` cesse de jeter près de la moitié de l’image, et le grand
côté fait 1344 au lieu de 1024, donc ce qui reste est agrandi ×1,43 au lieu de
×1,88. `makeVariants` recopie la géométrie de la source : chaque variante en
hérite sans qu’on ait à le lui dire.

Ce ne sont **pas les dimensions du cadre**, et c’est délibéré. Un générateur
n’est pas un redimensionneur : les modèles de diffusion sont entraînés sur une
poignée de formats et dérivent nettement quand on s’en éloigne — un sd-webui
auto-hébergé à qui l’on demande 1920×1080 rend un sujet dupliqué, lentement,
plutôt qu’une image plus nette. 1344×768 et 768×1344 sont les paliers de SDXL ;
Pollinations et fal les prennent tels quels, et le `snapSize` d’OpenAI lit le
ratio et répond 1536×1024, ce qui est encore mieux.

**Ce qui ne peut pas être corrigé est signalé, avant le rendu et pas après.**
1,43 n’est pas 1, un import est ce que l’utilisateur possède, et une bibliothèque
pleine d’images carrées est antérieure à tout ceci — alors le panneau mesure
chaque image contre la boîte où elle sera réellement peinte, et le dit. Chaque
ligne de scène concernée porte son propre `1024×1024 · agrandie ×1,9`, et une
ligne dans le pied de page épinglé, à côté du budget et sous le bouton, donne le
compte et le pire facteur.

Quatre choses de ce contrôle sont des décisions, pas des détails :

- **Il tourne dans le navigateur, en direct.** `/compose` et `/render` répondent
  tous deux avec des notices et sont tous deux la mauvaise porte : un montage
  assemblé à la main depuis le sélecteur ne passe jamais par `/compose`, et quand
  `/render` répond le job est déjà en file. La réponse change avec le format, la
  composition et chaque mouvement de caméra du panneau, et elle doit être à
  l’écran tant que ce sont encore des choix.
- **Il mesure le fichier, pas l’index.** Les `width`/`height` de la bibliothèque
  enregistrent ce qui a été *demandé* à un fournisseur : OpenAI ramène une
  demande à son propre palier, un import dont les dimensions n’ont pas pu être
  lues est stocké en 0×0, et les entrées antérieures au champ n’ont rien. Le
  panneau décode l’image qu’il affiche déjà — un accès au cache, pas une requête
  — et lit `naturalWidth`. Une image non mesurable est ignorée plutôt que
  devinée.
- **Il sait quelle composition est montée.** `product` pose son image sur la
  moitié d’un cadre paysage : la même photo grossière dans un diaporama y est
  nette ; `titles` ne peint aucune image et reste muet. En `auto` la composition
  n’est pas décidée, alors le rapport est le **plancher** — aucun mouvement de
  caméra compté — parce qu’une alerte qui crie au loup est une alerte qu’on
  apprend à ignorer, y compris la fois où elle avait raison.
- **Il ne désactive jamais rien.** Une image molle est un film que des gens
  publient sciemment. Le plancher est 1,25 — un quart de pixels de plus que
  l’image n’en a, strictement supérieur, si bien que 1536×1024 dans un film
  paysage, le mieux que rendent les modèles d’OpenAI, passe.

La géométrie du cadre est un quatrième miroir tenu à la main :
`src/lib/video/resolution.ts` recopie `DIMENSIONS`, les deux surdimensionnements
et `PICTURE_SHARE` depuis `worker/video/remotion/composition.js`, qu’un bundle
Vite ne peut pas importer. `tests/video-frame-geometry.test.js` les tient
ensemble, parce que cette copie dérive dans le sens silencieux : passez la sortie
du worker en 4K et le panneau continue de mesurer contre du 1080p, donc il cesse
de signaler précisément les films qui ont empiré. `PICTURE_SHARE` a quitté
`ProductSpotlightVideo.jsx` pour `composition.js` afin de rendre cela possible —
ce que la règle inscrite en tête de ce fichier demandait déjà.

Le plafond des 80 Mo a reçu le même traitement au passage. C’est un refus et
jamais un redimensionnement, et il était rencontré au bout de la file : job
accepté, minutes d’attente, *le worker de rendu a répondu 413*. `POST /render`
additionne désormais les images sur le disque, applique le quatre-pour-trois du
base64, et refuse avant la mise en file quand les images **seules** dépassent
déjà — un plancher sur le corps réel, jamais une estimation, si bien que rien de
ce qui aurait rendu n’est écarté et qu’un corps qui passe rencontre toujours le
413 du worker exactement comme avant.

---

## Où atterrit un film terminé

Dans `server/video/store.js`, sous `data/video-exports/`. **Jamais** dans la
bibliothèque de clips, et la raison tient aux appelants existants de cette
bibliothèque plutôt qu’à un goût pour les fichiers neufs.

Une entrée de `VideoLibrary` est une *séquence au défilement*. Son `ingest` lance
ffmpeg pour découper jusqu’à 150 images fixes, `list()` promet
`{ frames, width, fps }`, `GET /api/videos/library` transmet cela tel quel au
front, et `VideoPlayer.tsx` y parcourt `/f/1.jpg … /f/<frames>.jpg`. Un film n’a
rien de tout cela. Y ranger un export paierait le découpage, puis mettrait dans
cette liste des lignes sans images à jouer, un bouton « Redécouper » qui ferait
tourner ffmpeg sur un film de deux minutes pour produire des vues fixes que
personne n’affichera, et un parcours de `usage.js` qui attend un répertoire.
Chacune de ces fonctions aurait gagné une condition pour un cas dont elle n’a
jamais parlé, ce qui est la définition de les faire mentir.

Ce que le magasin d’exports *reprend* de ses voisins, parce que cela a mérité sa
place :

- **l’adressage par contenu** — le fichier porte le nom du SHA-256 de ses octets,
  donc deux personnes qui rendent des montages identiques partagent un fichier ;
- **`owners` comme ensemble**, exactement comme
  [M8](fr/architecture/invariants.md) l’exige : le magasin déduplique, donc la
  deuxième personne arrivée ne doit pas effacer la première, et `server/usage.js`
  répartit l’empreinte entre elles ;
- **des écritures atomiques** — fichier temporaire puis renommage, dans le même
  répertoire, pour qu’un plantage au milieu d’une écriture de 80 Mo ne puisse pas
  laisser un fichier tronqué sous un hash qui promet son propre contenu ;
- **il refuse avant d’écrire.** Un volume plein fait échouer ses écritures en
  silence à peu près partout dans ce dépôt, donc l’endroit honnête où s’arrêter
  est le seul qui sache encore combien d’octets sont sur le point d’être dépensés.
  Il partage le même `diskBudget` que les bibliothèques d’images et de clips.

Deux absences délibérées. Il n’y a **pas de vignette** : en découper une exige
ffmpeg, et ffmpeg est la seule dépendance que ce chemin n’a pas — un export qui
en aurait besoin échouerait sur toutes les instances qui en sont dépourvues, et
un film que le navigateur sait lire est sa propre vignette. Et **rien n’expire** :
le `videoHash` d’un job est un lien que quelqu’un peut suivre des jours plus
tard, et un magasin qui s’élaguerait tout seul en ferait un bouton de
téléchargement qui ne mène nulle part. C’est le budget disque qui borne le
répertoire, en refusant le rendu suivant avec un message disant quoi supprimer.

Le montage n’est **pas** recopié dans l’index. Il porte le texte incrusté que
quelqu’un a écrit, et cet index est lu par le rapport d’usage administrateur ; un
rapport a besoin de la forme d’un rendu, pas de son contenu.

---

## Le retrouver ensuite

Tout ce qui précède dit où vont les octets. Rien n’y répondait à la question que
l’utilisateur pose vraiment, et la fonctionnalité est partie sans cette réponse :
*où est la vidéo que je viens de faire ?*

Le magasin est adressé par contenu : un hash dit ce que contient un fichier, et
rien sur qui l’a voulu. Le seul lien vers un rendu terminé était le job — et
`VideoQueue._trim` ne garde que les cinquante derniers jobs achevés, tandis que
le navigateur ne tient l’identifiant que le temps de l’onglet. Le bouton de
téléchargement du panneau d’export était donc tout ce qu’il y avait : fermez le
panneau, et un fichier posé sur le serveur devenait inaccessible. **Un export
qu’on ne retrouve pas n’est pas un export.**

Trois choses referment cela, et ce sont les trois que la bibliothèque d’images a
déjà.

**Un film est rattaché au projet où il a été monté.** `projects` dans les
métadonnées du magasin, une **liste** et non un champ — exactement pour la raison
qui fait d’`owners` un ensemble (M8) : le magasin déduplique, donc deux projets
qui composent des montages identiques octet pour octet arrivent sur une seule
entrée, et le second ne doit pas effacer le premier. L’identifiant circule de
`POST /api/video/render` vers `VideoQueue.enqueue`, puis la fonction de rendu,
puis `store.put` — parce que cette fonction est le dernier endroit qui le sait
encore. Il voyage **à côté** du montage et jamais dedans : le schéma est
`.strict()`, et un champ que le worker ne rend pas n’a rien à faire dans le
document.

Un rendu lancé hors d’un projet est classé sous aucun. `null`, jamais une
supposition — le corollaire d’honnêteté que M8 énonce pour les images dont le
propriétaire est inconnu.

**`GET /api/video/exports` liste ce que ce compte a rendu.** Uniquement ses
films, et le filtre vit dans `store.list({ owner })` plutôt que dans la route,
pour qu’il ne puisse pas diverger d’`ownedBy` juste à côté : `GET
/api/video/:hash` refuse un hash que le compte n’a pas rendu — avant même de
regarder si le fichier existe, délibérément, pour que la route ne serve pas
d’oracle — et une liste nommant les exports des autres rendrait précisément ce
que ce contrôle retient. `owners` est retiré en sortie, comme dans toutes les
listes de ce dépôt.

**Média gagne un troisième onglet, « Motion ».** Son propre onglet, pas une ligne
dans « Vidéos », et la raison est celle qui a fait naître le magasin. Une entrée
`videos` est une séquence au défilement : vignette, nombre d’images, bouton
« Redécouper », lue en parcourant `/f/1.jpg … /f/N.jpg`. Un film n’a rien de
cela, et `VideoPlayer.tsx` à qui on en confierait un demanderait au serveur des
images que personne n’a découpées — un 404 par position du curseur. Un film est
un mp4 ; il se lit dans une balise `<video>` pointée sur `/api/video/:hash`, qui
répond désormais **en lecture** sauf si `?download=1` est demandé, exactement
comme `GET /api/images/:hash` l’écrit déjà. Le servir en pièce jointe et compter
sur les navigateurs pour ignorer `Content-Disposition` sur une sous-ressource
fonctionne par chance, et personne ne l’a promis.

Téléchargement et suppression sont sur la carte, comme pour une image. La
suppression est explicite et reste la seule chose qui efface un fichier (M8) ;
elle nomme les projets qui pointaient encore sur le film, parce qu’un magasin
dédupliqué signifie que le retirer d’un projet le retire de tous.

Enfin, le panneau d’export **dit où le film est parti**, au lieu de seulement
offrir un lien qui disparaît avec lui. Deux phrases, parce que la promesse n’est
pas la même : un film monté dans un projet est classé sous ce projet, un film
monté depuis la page Média n’est classé sous aucun — et prétendre le contraire
serait un mensonge simple sur la bibliothèque de quelqu’un.

---

## Attacher un montage à un écran

Un montage rangé dans Média est retrouvable. Il n’est toujours pas *dans le
travail* : un projet est un plateau d’écrans, et un montage posé dans un onglet
à côté reste un fichier, pas une pièce du design. Un écran peut donc en porter
un.

**Il y a deux relations entre un écran et un média, et elles ne se mélangent
pas.** Tout le reste de cette fonctionnalité en découle.

1. **Un média dans le code.** `src/lib/screenImages.ts` trouve les
   `/api/images/HASH` dans `Screen.code` et les remplace par substitution de
   chaîne, aux offsets qu’un AST a validés. C’est du **code généré** qu’on
   réécrit — aucun appel au modèle, rien de restylé, et « Revenir en arrière »
   l’annule comme n’importe quelle édition. Ce chemin ne sait délibérément pas
   AJOUTER une image à un écran qui n’en a pas : cela change la structure du
   composant, donc c’est une génération.

   `src/lib/screenSequences.ts` fait la même chose pour une **séquence de
   défilement**, et c’est un module distinct parce qu’une séquence n’est pas
   désignée par une URL. Elle est désignée par un **couple** —
   `<ScrollSequence base="…/api/videos/HASH" frames={60}>` — et les deux moitiés
   doivent bouger ensemble, pour la raison qui justifie `Screen.videoFrames` : le
   composant parcourt 1…total, donc une nouvelle adresse sous un ancien compte
   soit s’arrête trop tôt et tient sa dernière image pendant tout le reste du
   défilement, soit demande des images qui répondent 404 et tient la dernière qui
   a répondu. Aucune de ces pannes ne lève d’erreur, aucune ne se voit dans la vue
   Code, et les deux ressemblent à un remplacement réussi. `replaceScreenSequence`
   réécrit donc l’adresse et les chiffres du compte en un seul appel, et un
   élément dont le compte est une expression et non un littéral —
   `frames={total}` — n’est pas signalé du tout, parce que le réécrire
   supposerait de deviner ce que cette expression vaudra.

   La reconnaissance porte sur le couple d’attributs, jamais sur le nom de
   l’élément : un modèle qui a enveloppé `ScrollSequence` dans un composant à lui
   a quand même écrit un héros que l’utilisateur doit pouvoir repointer.

2. **Un média attaché à l’écran.** `Screen.attachedMedia` — comme `imageHash` et
   `design` — est une **métadonnée**. Rien n’en est dans le code ; le canevas le
   dessine sur la colonne de cartes à côté du cadre (`CARD_W`, en unités monde,
   non dessinée sous `CARD_MIN_SCALE`).

Un montage ne peut jamais être que du second type. Le composant généré ne
contient aucune balise `<video>`, et lui en injecter une serait une génération
et non une substitution — une autre opération, avec un appel au modèle, une
boucle de réparation et un annuler derrière.

C’est pourquoi **« Changer les médias » a deux sections et deux intitulés**,
dont l’un dit qu’il réécrit le code de l’écran et l’autre qu’il n’y touche pas.
En une seule liste, « remplacer » voudrait dire « réécrire la source » sur une
ligne et « pointer la carte ailleurs » sur la suivante, sans rien à l’écran pour
les distinguer.

**La section 1 liste des images et des séquences, aucun montage — et elle dit
pourquoi.** Une absence n’explique rien : quelqu’un qui veut son montage en héros
et ne le trouve que sous « attacher » mérite la raison plutôt que d’avoir à la
deviner. Une phrase la porte (`library.swapNoFilmInCode`) : le composant généré
n’a pas de balise vidéo, lui en ajouter une est une régénération, donc il faut la
demander au composeur. Une séquence a sa place dans cette liste parce qu’elle
*est déjà* un composant que le modèle a appris à écrire ; un montage, non.

**Une ligne de séquence, c’est une affiche plus un badge, jamais une vignette
nue.** Une affiche est une image extraite du clip : seule, elle se lit comme une
photo — alors que la seule chose que la ligne doit faire passer, c’est que cet
emplacement représente trois hauteurs de fenêtre de défilement épinglé. La ligne
affiche aussi le nombre d’images, parce que c’est la moitié de ce qu’un
remplacement réécrit.

**Remplacer le héros déplace `videoHash`/`videoFrames` avec lui**, et seulement
si l’enregistrement désignait le clip remplacé. Ces deux champs sont écrits à la
génération pour dire quelle séquence Muse a payée ; laissés en place après un
remplacement, ils décrivent un clip que l’écran n’affiche plus. Un écran qui
porte deux séquences n’a qu’un `videoHash` : le déplacer vers celle que
l’utilisateur a remplacée par hasard lui ferait dire quelque chose que personne
ne lui a demandé.

**Et « Revenir en arrière » doit le ramener, sinon le couple se disloque dans
l’autre sens.** Le retour arrière restaurait la source et laissait
l’enregistrement là où le remplacement l’avait mis : l’écran dessinait le clip A
pendant que `videoHash` nommait le B — le même défaut, atteint par le bouton
d’à côté. `onRevertScreen` retire donc le couple quand la source restaurée ne
contient plus cette adresse de contenu. Retiré et non recalculé : ce que
désignait l’ancienne source ne se sait pas sans analyse, et « absent » veut dire
« non enregistré », ce que dit déjà presque tout écran. Chercher une chaîne de 64
hex que Mocky a lui-même écrite n’est pas lire la structure d’un source généré
(I1) — aucun motif, aucune découverte de nom, et la réponse ne sert qu’à retirer
une affirmation.

**Le champ est dans la liste blanche.** `normalizeScreen` reconstruit chaque
écran depuis une liste fixe de champs : un champ absent de cette liste est perdu
en silence au rechargement suivant — il survit à toute la session qui l’a ajouté
et disparaît le lendemain matin. `attachedMedia.test.ts` pose la question
directement.

**Deux genres, un champ.** `{ kind: 'film' | 'sequence', hash, frames? }`. Une
séquence de défilement peut être attachée elle aussi, et elle emporte son nombre
d’images pour la raison qui justifie `Screen.videoFrames` : une séquence adressée
avec le mauvais compte dessine sa dernière image pendant tout le reste du
défilement. Un hash plus un drapeau disant dans quel magasin chercher
laisserait un appelant lire le hash d’un montage dans la bibliothèque de clips et
récolter un 404 qu’il ne sait pas expliquer.

**Aucune affiche n’est découpée.** Produire une image fixe depuis un .mp4 demande
ffmpeg, la seule dépendance que ce chemin n’a délibérément pas. La carte utilise
`<video preload="metadata">` et laisse le navigateur dessiner la première image,
à partir d’octets qu’une lecture aurait de toute façon demandés — le serveur ne
fait donc aucun travail supplémentaire, et la carte montre le montage plutôt
qu’un rectangle gris. Une séquence, elle, a une vraie affiche découpée à
l’ingestion : c’est une `<img>` — et elle emporte l’horodatage de re-découpe
quand l’appelant le connaît, parce que les affiches sont servies `immutable` pour
un an et que le hash vient de la SOURCE : sans cet horodatage, une séquence
re-découpée affiche l’ancienne image pendant un an. La modale le passait dans sa
grille de sélection et pas sur la vignette du média déjà attaché, à trois
centimètres au-dessus.

**Un hash inconnu ne casse rien** (Q1). Les bibliothèques sont des magasins
séparés et peuvent perdre un fichier à tout moment, et seule une suppression
explicite en retire un (M8) — donc un écran continue de pointer vers un média
disparu, la carte se dessine quand même, et la modale dit que le média n’est plus
là et propose de le détacher. Détacher est la seule chose qui vide le champ.

**Et la carte le dit aussi**, ce qui a demandé une seconde passe. « La carte se
dessine quand même » était vrai et insuffisant : ce qu’elle dessinait, c’était un
rectangle noir sous la légende habituelle — soit exactement ce que dessine un
montage qui commence sur une image noire. Un fichier disparu n’a aucun autre
signe : `GET /api/video/:hash` répond `403` pour un export supprimé, puisqu’il
vérifie la propriété avant l’existence délibérément, et ni un `403` ni un `404`
ne se voient dans une balise `<video>`. C’est donc l’événement `error` de
l’élément qui bascule la légende sur `Média introuvable`, et l’infobulle précise
qu’il reste attaché tant qu’on ne le détache pas. Rien n’est réessayé, rien n’est
détaché : seul un détachement explicite vide le champ.

Un clic sur la carte lit le montage, comme un clic sur la carte image ouvre la
visionneuse — `FilmLightbox`, partagé avec l’onglet Média pour qu’il y ait une
balise `<video>` pour un fichier. Ce composant a reçu le même gestionnaire au
même moment, pour une raison plus tranchante : l’onglet Média n’ouvre jamais
qu’un montage que la liste vient de nommer, tandis que la carte ouvre le hash que
porte l’écran, quel qu’il soit. Sans cela, un clic sur une carte morte répondait
par un rectangle noir, une barre de lecture et pas un mot. Une séquence renvoie
vers Média : elle se lit en scrubbant des images numérotées, ce que `VideoPlayer`
fait déjà correctement, et un second scrubber écrit pour une carte fait deux
lecteurs qui divergent.

---

## Partir d’une image

Le panneau Motion sait aussi fabriquer les images. On décrit un sujet, on
obtient une image modèle, on la garde ou on la régénère, puis on demande de deux
à six variantes et on coche celles qui méritent d’être montées.

**Ou l’on prend l’image modèle dans la médiathèque**, ce que ce chemin refusait
au départ : le seul accès aux variantes était de payer un fournisseur pour une
image, même avec exactement celle qu’on voulait déjà rangée dans la médiathèque.
C’est le même `ImagePicker` que la liste des scènes, pour que « choisir une
image » soit un composant dans ce panneau et non deux qui divergent.

Une image de la médiathèque **saute la première porte**, et c’est une décision,
pas un oubli. La porte 1 demande « gardez-vous CELLE-CI ? » à propos d’une image
qu’un fournisseur vient d’inventer, que personne n’a vue, et qui est arrivée
`pending` précisément pour cette raison. Une image de la médiathèque est
l’inverse sur les trois points : elle existe, elle est confirmée, et
l’utilisateur vient de la choisir dans une grille de ses propres vignettes. Une
confirmation sans question dedans est de celles qu’on apprend à cliquer sans
lire — et la porte qui compte, celle des variantes, est en aval de cette
habitude. Le panneau le dit en une phrase, parce qu’une confirmation manquante
sans explication est ce qu’on remet six mois plus tard.

L’étape suivante montre désormais l’image source en petit. Elle se trouvait juste
sous une porte qui l’affichait en pleine largeur, donc il n’y avait rien à dire ;
deux des trois entrées ne passent plus par cette porte, et « Produire 4
variantes » d’une image qu’on ne voit pas est un bouton que personne ne devrait
avoir à croire sur parole.

Les axes de variation sont un tableau figé — angle, cadrage, lumière, arrière-plan,
orientation — et **aucun modèle n’est chargé de les inventer**. Ce que vaut un
parcours en plusieurs étapes comme celui-ci, c’est la confirmation humaine à la
fin, pas la créativité d’une paraphrase : un appel de modèle ici coûterait des
jetons, ajouterait un mode d’échec à un chemin qui en a déjà un, et rendrait la
série irreproductible. La même image répondrait autrement le mardi, et « donne-moi
les trois autres » cesserait de vouloir dire quelque chose. Les graines sont
dérivées de l’identifiant source : redemander rend les mêmes images au lieu de
repayer le fournisseur.

### Le profil « edit » ne se rabat jamais

Mocky a trois profils d’image. `inspiration` sans fournisseur propre se rabat sur
`content` — sans dommage, puisque tous deux font une image à partir d’un texte, et
que le pire cas est une référence moins impressionnante.

**`edit` est facultatif dans l’autre sens.** Vide veut dire que l’image-vers-image
est éteinte sur cette instance, et rien n’est substitué. Un fournisseur
texte-vers-image à qui l’on tend une image source, soit refuse, soit — chez un
fournisseur qui laisse tomber les champs inconnus en silence — rend le texte seul
et renvoie une image dont on dit à l’utilisateur qu’elle dérive de la sienne. Rien
en aval ne peut distinguer cela d’une vraie édition. `resolveImageProfile` répond
donc `null`, ce que les appelants doivent traiter, plutôt que de répondre par un
fournisseur incapable de faire le travail.

C’est cette asymétrie qui fait que `/api/video/variants` rapporte `derived` dans
sa réponse, et que `/api/video/status` cite `variantsDerived` *avant* qu’on
appuie sur le bouton. Avec un profil « edit », les variantes sont celles de
l’image de l’utilisateur ; sans lui, ce sont des sœurs nées du même texte — même
sujet, autre photographie. Une interface qui montrerait les deux à l’identique
mentirait dans le cas qui ne coûte rien à détecter, et la réponse doit arriver
avant que six appels au fournisseur soient dépensés, pas après.

Sa liste de fournisseurs est plus courte que celle des autres, et le panneau dit
pourquoi : seuls `fal`, `openai-image`, `cloudflare-workers-ai` et `sd-webui`
acceptent une image d’entrée. Les *modèles* par défaut diffèrent aussi — hériter
de ceux du texte-vers-image livrerait un profil configuré pour échouer, puisque le
flux par défaut de Cloudflare ne sait pas prendre d’image d’entrée et que le point
d’accès schnell de fal n’a aucun champ pour cela.

### Les deux familles de champ chez fal

fal publie deux familles de modèles d’édition, et elles ne s’accordent pas sur le
nom du champ. Les points d’accès `image-to-image` prennent un **`image_url`**
unique ; les éditeurs pilotés par instruction — Seedream, nano-banana, Qwen et la
famille flux Kontext — prennent **`image_urls`**, un tableau, parce qu’ils sont
bâtis pour référencer plusieurs images à la fois.

Cela compte davantage qu’un détail de nommage, car **fal valide strictement : une
clé inconnue est un 422, pas un avertissement**. Envoyer les deux champs par
prudence casse celui des deux modèles qui ne connaît pas l’autre. C’est ainsi
qu’un `bytedance/seedream/v5/pro/edit` correctement configuré a rendu six appels
en échec pendant que le panneau se contentait de rapporter « aucune variante n’a
pu être produite ».

La famille est reconnue sur l’**identifiant** du modèle, et non déclarée par
fournisseur, parce que l’identifiant est la seule chose que Mocky connaisse :
c’est l’administrateur qui le saisit, fal en publie des centaines, et de nouveaux
apparaissent entre deux versions. Un modèle que le motif ne reconnaît pas reçoit
la forme au singulier, et si c’est faux, fal le dit — raison pour laquelle le
texte d’erreur du fournisseur remonte désormais jusqu’au panneau au lieu d’être
avalé.

### Un fournisseur incapable de dériver lève une erreur

`refuseInit()` lève toujours. C’est la règle sur laquelle repose toute la
fonctionnalité.

L’alternative tentante — abandonner l’image source et générer à partir du seul
texte — échoue de la seule manière que Mocky ne sait pas détecter. Le fournisseur
renvoie une image parfaitement correcte, de la bonne taille, avec le bon type de
contenu, annoncée comme une réussite, pendant que l’interface affirme avoir dérivé
l’image de l’utilisateur. Rien en aval ne peut distinguer les deux : le seul échec
honnête est donc un échec bruyant, et le message nomme le réglage qui le
corrigerait.

La direction de `strength` fait partie du même contrat : **1 s’éloigne le plus de
la source**. Un fournisseur dont le paramètre est documenté dans l’autre sens ne
doit surtout pas le traduire — une correspondance inversée donne une image dont
l’API se satisfait parfaitement et que l’utilisateur n’a jamais demandée, sans
aucune erreur à montrer. Il rapporte `strengthApplied: false` à la place, parce
que « j’ai dérivé votre image mais je n’ai pas pu régler à quelle distance » est
une phrase vraie.

---

## Le drapeau « pending »

Une image produite dans ce parcours est marquée `pending: true` et n’est pas
encore une image de la bibliothèque. Elle reste hors de l’onglet Médias, hors de
« Tout télécharger », hors du sélecteur — et hors de tout film. La confirmer
retire la marque ; la laisser décochée la laisse en attente, définitivement.

### Pourquoi « pending » et pas « confirmed »

L’orthographe évidente est `confirmed: boolean`, à faux par défaut. Elle est
fausse ici, et la raison tient à la *mise à jour* plutôt qu’au code.

La bibliothèque contient déjà toutes les images de l’instance, et aucune ne porte
le champ. `confirmed !== true` rendrait la totalité inéligible à l’instant où
cette version démarre : l’export vidéo fonctionne aujourd’hui, et il cesserait de
fonctionner à la mise à jour, pour tout le monde, sans aucun test en échec pour le
montrer. Le drapeau ferait exactement ce pour quoi il a été écrit, à un corpus
dont il n’a jamais parlé.

Le drapeau marque donc l’**exception** plutôt que la règle. `pending: true` est
posé en un seul endroit — le parcours des variantes, sur des images que personne
n’a encore vues — et son *absence* signifie éligible. Toute image antérieure au
champ est donc déjà correcte, et la migration n’en est pas une : il n’y a rien à
rattraper, et donc rien qui puisse être oublié.

`confirm()` **supprime** la clé au lieu de la mettre à faux, pour la même raison :
une image confirmée et une image d’avant la fonctionnalité doivent être
indiscernables, sinon « éligible » devient discrètement deux questions
différentes. L’opération est à sens unique et idempotente — il n’y a pas de
dé-confirmation, parce que le sens du drapeau est « personne n’a encore regardé
ceci », un fait passé qu’un appel ultérieur ne peut pas rendre faux. Une route
capable de le réarmer permettrait à un compte de cacher une image dont un autre
compte a déjà tiré un film.

### Pourquoi le garde vit sur le serveur

`refusedForPending()` dans `server/video/routes.js` est l’application de la
règle, et c’est tout son intérêt. Les deux portes de confirmation du parcours sont
de l’*interface* : on les contourne en fermant une fenêtre, avec un onglet
périmé, avec un client qui ne les a jamais eues, ou avec un hash et curl. Ce qui
rend vrai « l’utilisateur a choisi ces images » à propos d’un film, c’est que la
route qui transforme des images en film refuse celles qu’il n’a pas choisies.

Elle garde les **deux** points d’entrée, pas seulement `/render`. `/compose`
dépense un appel de modèle et rend un ordre de passage ; le laisser lire des
images non confirmées mettrait un rebut dans une proposition, l’appellerait scène
quatre, et laisserait `/render` rejeter le montage qu’on venait de montrer à
l’utilisateur — un refus qui arrive une étape après la décision qui l’a causé, à
propos d’une image qu’il croyait avoir jetée.

Le statut est **`409`**, pas `400` ni `404`. La requête est bien formée et tous
les fichiers sont sur le disque ; ce qui ne va pas, c’est l’*état* dans lequel ils
sont, et c’est un état que l’appelant peut changer — les confirmer, ou les retirer
de la sélection. C’est exactement ce que veut dire un conflit. Un `400` se lirait
« vous avez mal construit votre montage ».

---

## Qui a le droit d’exporter

Éteint par défaut, et par liste d’autorisation par défaut. Ces deux valeurs sont
les plus fermées disponibles, parce que le worker est un service Docker
facultatif : une instance qui ne l’a pas construit ne gagne rien à activer la
fonctionnalité, et une instance qui l’a construit dépense du processeur réel à
chaque rendu.

**Un administrateur n’est pas autorisé d’office.** C’est tentant — un
administrateur peut s’accorder le droit en un clic de toute façon — mais ce clic
est précisément le sujet. La liste d’autorisation est ce que compte le rapport
d’usage par compte, et un rôle qui accorderait l’accès implicitement ferait
apparaître des rendus au nom de personne. Un administrateur qui veut la
fonctionnalité s’ajoute à la liste, et le compte reste honnête. C’est la règle
comptable de [M8](fr/architecture/invariants.md) appliquée au processeur plutôt
qu’aux octets.

En aval, la propriété est vérifiée à la sortie. `GET /api/video/:hash` vérifie la
**propriété avant l’existence**, ce qui est l’inverse de la forme habituelle et
qui est délibéré : répondre `404` pour un hash inconnu et `403` pour celui d’un
autre ferait de cette route un oracle sur ce que les autres ont exporté. Vérifiée
dans cet ordre, elle dit la même chose dans les deux cas, et elle dit quelque
chose de vrai — un hash que vous n’avez pas rendu n’est pas le vôtre.

Deux sources s’accordent là-dessus, parce que chacune est incomplète seule. Le
journal de la file porte l’identifiant du compte mais ne garde que les cinquante
derniers jobs terminés : autoriser sur lui seul retirerait à un utilisateur son
propre export au cinquante et unième. L’ensemble `owners` du magasin n’est pas
élagué, mais il est borné à vingt comptes par fichier. L’une ou l’autre suffit à
dire oui.

### La 3D est une seconde permission, et elle restreint la première

Un administrateur peut aussi décider **qui a le droit de mettre un bloc 3D dans
un film**. Le réglage suit le gabarit ci-dessus plutôt que d’en inventer un — les
mêmes deux modes, le même « une liste est remplacée, jamais fusionnée », la même
absence de tout secret — et il vit à côté de lui dans `server/video/config.js`,
sous `threeDAccess` et `threeDAllowedUserIds`, avec `videoThreeDEnabledFor()`
pour poser la question.

**Il interroge `videoEnabledFor()` d’abord.** Cette ligne porte tout le reste :
une permission 3D accordée à un compte qui ne peut pas exporter du tout est un
droit sur rien, et deux listes lues indépendamment, c’est ainsi qu’une instance
se retrouve avec un « oui » dont personne ne peut rien faire et un administrateur
qui débogue la mauvaise case. Cela veut dire aussi que les deux règles gagnées
par la permission d’export sont héritées plutôt que rediscutées : l’interrupteur
maître ferme celle-ci également, et un administrateur n’est toujours pas autorisé
sur son seul rôle — les rendus 3D continuent donc d’apparaître au nom de
quelqu’un.

**Son défaut est `all`, et c’est le seul défaut de ce fichier qui ne soit pas le
plus fermé.** Le raisonnement est écrit dans `DEFAULT_THREE_D_ACCESS` et tient en
trois points. La porte fermée existe déjà un niveau au-dessus : « tout le monde »
signifie ici « tous ceux qu’un administrateur a déjà mis sur la liste de Motion »
et non « tout le monde » ; un second défaut fermé serait la même porte verrouillée
deux fois, et c’est le second verrou que personne ne connaît. Le coût est un
supplément, pas une facture nouvelle — un rendu dépense déjà environ 4,3 s de
temps réel par seconde de film, un solide éclairé y ajoute environ 0,9 s/s sur la
machine où ces tableaux ont été pris. Voir **Une scène porte au plus deux blocs
3D** ci-dessous : ce supplément est quatre fois plus grand sur une machine sans
accélération matérielle, et il est désormais borné par un contrôle et non par une
promesse. Enfin
`solidScene` est livré : un défaut fermé serait une mise à jour qui supprime en
silence un bloc de toutes les instances qui rendent déjà des films avec, et le
premier symptôme est un prompt de composition qui a discrètement cessé de le
proposer — ce qui se lit comme une régression, pas comme une politique.

### Une scène porte au plus deux blocs 3D

`MAX_THREE_D_LAYERS = 2`, vérifié à `POST /render`, à côté de la permission.

Le chiffre que donnent les tableaux ci-dessus — un solide éclairé ajoute environ
0,9 s de rendu par seconde de film — a été mesuré sur une machine au rastériseur
GL logiciel rapide, et c’est la phrase qui a laissé passer ce défaut. Mesuré à
nouveau dans le conteneur du worker, sur deux cœurs, sans accélération
matérielle :

| film | s de temps réel par seconde de film |
|---|---|
| plat | 1,78 |
| un bloc 3D à l’écran | ~3,4 |
| trois blocs 3D à l’écran | **6,68** |

`jobBudgetMs` en accorde 6. Un film dont les scènes empilent trois blocs 3D est
donc accepté par le schéma, mis en file, regardé, puis tué aux neuf dixièmes du
chemin — douze minutes passées devant un indicateur pour rien. Deux tiennent, et
l’ajustement est linéaire en nombre de blocs à l’écran : 1,78 + 2 × 1,63 = 5,04.

Trois choses sur la forme de la borne :

- **Par SCÈNE et non par film**, parce que le coût est par IMAGE. Huit scènes
  portant chacune un solide coûtent ce que coûte une scène portant un solide ;
  une scène qui en porte huit coûte huit fois plus. Une borne par film refuserait
  le film bon marché et laisserait passer le cher — c’est pourquoi le refus dit
  que les étaler ne coûte rien.
- **Pas dans le schéma.** La tridimensionnalité est un fait sur le RENDU d’un
  bloc, pas sur ce qui le valide — `three-d.js` l’argumente en tête de fichier,
  et le schéma est un miroir tenu à la main en trois exemplaires. L’exprimer là
  achèterait une quatrième copie de la liste 3D contre un contrôle que la seule
  porte par laquelle tout document passe peut déjà faire.
- **400, pas 403.** La permission répond *qui* ; ceci répond *combien*, et aucun
  réglage d’administrateur ne fait aboutir ce film. Les deux sont vérifiés dans
  cet ordre, pour qu’un compte sans permission n’apprenne rien de la borne.

La marge est mince, et mince du bon côté : elle est calculée sur la plus lente
des deux machines. Un exploitant avec accélération matérielle en a bien
davantage ; un plus lent encore reçoit le 504 du worker, qui nomme la machine.

### L’application est côté serveur, à deux portes

Cacher un bouton, c’est de la présentation. Ce qui rend la permission vraie d’un
film, c’est que les routes le refusent.

`POST /compose` **n’offre pas** ce que le compte n’a pas le droit de dépenser :
`three-d.js` nomme les blocs 3D, et `availableBlocks()` les retire du catalogue
et de l’indice de décodage exactement par le mécanisme qu’utilise une sélection
d’images vide. Le prompt l’énonce ensuite comme un fait sur l’instance —
« solidScene is not part of the catalogue on this instance » — et jamais comme
une règle, parce qu’un modèle à qui l’on dit qu’un bloc existe mais est interdit
tend la main dessus quand même, et le refus arrive alors une fois les jetons
dépensés.

`POST /render` **refuse le document**, et c’est là qu’est la porte. Un montage
arrive sur cette route depuis un brouillon enregistré la semaine dernière par un
compte retiré de la liste depuis, un onglet resté ouvert pendant qu’un
administrateur restreignait le réglage, l’éditeur manuel, ou curl — aucun n’est
passé par le compositeur. `threeDBlocksIn()` parcourt les scènes comme le fait
`timelineImageIds()`, la vérification se place juste après le schéma et avant que
quoi que ce soit ne touche au disque, et la réponse est `403` plutôt que `400`
parce que le document est bien formé : ce qui ne va pas, c’est qui demande.

Les deux refus **nomment ce qui reste possible**, ce qui est la règle de ce module
partout : `threeDRefusal()` dit quels blocs sont en cause, qu’un administrateur
accorde le droit par compte et ce que cela coûte à peu près, et à partir de
combien de blocs le film pourrait être composé à la place — un nombre lu sur le
catalogue, jamais saisi à la main. La personne qui lit n’a pas choisi le bloc :
un modèle l’a fait, dans un catalogue restreint après coup.

### Le bouton 3D, et ce qu’il n’est pas

Le bouton 3D du panneau est une **option de composition**, pas une permission :
il voyage en `forceThreeD: true` sur `POST /compose`, le serveur le valide contre
cette même permission, et il devient une instruction dans le prompt — au moins un
morceau de bravoure, placé dans une scène dont il est le sujet, un par film et
non un par scène. Un compte sans la permission qui l’envoie reçoit le même `403`
nommé, parce qu’un bouton qui ne fait rien en silence est la panne que les gens
rapportent comme « la 3D est cassée ». Demandé sur l’une des cinq compositions
toutes faites, il est refusé avant l’appel, puisqu’elles ne portent aucun bloc. Et
une demande forcée, autorisée, qui revient plate reçoit un **avis** et non un
refus : le film se rend, il n’est simplement pas celui que le bouton promettait,
et rendre le néant contre une réponse qui fonctionne est le mauvais échange (Q1).

### Ce qui garde la liste honnête

`server/video/three-d.js` nomme les blocs 3D à la main, et la liste est gardée
des deux côtés parce que la direction dangereuse n’est pas celle qu’on croit. Un
nom périmé ne garde rien ; la panne qui compte, c’est un **nouveau** bloc 3D
écrit, rendu, mis au catalogue — et jamais ajouté ici, de sorte que la permission
couvre un bloc sur deux et que rien n’échoue.

`tests/video-3d-permission.test.js` compare donc la liste au **worker**, là où la
tridimensionnalité habite vraiment : un bloc 3D est celui dont le composant
renvoie des intrinsèques react-three-fiber, ce qui est exactement la propriété
que `ComposedSceneVideo` utilise pour décider ce qu’il enveloppe dans un
`ThreeCanvas`, et exactement ce qui coûte le temps de rendu que l’on rationne. Les
fichiers sont lus comme du texte, comme dans
`tests/video-worker-separation.test.js`, pour que la vérification tourne sur une
copie qui n’est jamais entrée dans `worker/video/`.

La liste n’est délibérément **pas** dans `server/video/timeline.js`. Ce fichier
est un miroir tenu à la main du schéma TypeScript, et la tridimensionnalité n’est
pas un fait sur le schéma : chaque bloc 3D est validé par les mêmes entiers
bornés et les mêmes énumérations fermées qu’un titre, ce qui est la règle
fondatrice et la raison pour laquelle une capacité 3D ne lui coûte rien. Ce qui
rend un bloc tridimensionnel, c’est son rendu.

---

## Les fichiers

| Fichier | Ce qu’il contient |
|---|---|
| `src/lib/video/timeline.ts` | Le schéma zod — les cinq modèles, le thème, et le raisonnement derrière chaque borne. La définition à lire |
| `server/video/timeline.js` | Le même schéma, recopié à la main pour Node, plus `attachTheme`. `timeline.test.js` tient les deux ensemble |
| `src/lib/video/theme.ts` | La direction artistique du projet, lue en la poignée de jetons qu’un film peut porter. Les jetons déclarés seulement |
| `src/lib/video/briefTheme.ts` | Les couleurs demandées par l’UTILISATEUR, lues dans le brief. Elles battent le dossier jeton par jeton ; une couleur sans rôle énoncé à côté n’est pas lue |
| `src/lib/video/resolution.ts` | De combien une image va être agrandie, et ce qu’il faut demander à un fournisseur. Recopie la géométrie du cadre du worker ; `tests/video-frame-geometry.test.js` tient les deux ensemble |
| `server/video/compose.js` | Le seul appel de modèle : il compose une scène à partir du catalogue de blocs, il ne choisit jamais les images |
| `server/video/variants.js` | Les deux chemins de variantes, et le tableau figé des axes |
| `server/video/config.js` | Les réglages d’administration, les deux permissions. La clé de licence ne quitte jamais le serveur |
| `server/video/three-d.js` | Quels blocs sont dessinés en 3D, et le refus qui nomme ce qui reste possible |
| `server/video/queue.js` | File en mémoire, journal JSON atomique, une seule tâche à la fois. Jamais de Redis |
| `server/video/worker.js` | Le client HTTP du worker de rendu, et `assertWorkerTarget` |
| `server/video/store.js` | Le fichier terminé, gardé entier. **Pas** `server/videos/` |
| `server/video/routes.js` | `/api/video`, le garde des images en attente, et le routeur d’administration |
| `src/components/VideoExportDialog.tsx` | Le panneau Motion. Ouvert depuis la barre d’outils, jamais depuis un écran |
| `worker/video/` | Le worker Remotion : sous-projet séparé, image séparée, README séparé |
| `worker/video/encoding.js` | Le tableau des codecs et ce qu’on dit à chacun sur la qualité. Aucun import Remotion, pour que la seule part testable d’un rendu le soit |
| `worker/video/remotion/composition.js` | L’arithmétique partagée de toutes les compositions, leur thème et leurs palettes. Ni React ni Remotion, pour qu’un test puisse y accéder |
| `worker/video/remotion/ComposedSceneVideo.jsx` | Le moteur de mise en page de la variante composable : le fond, les neuf cases, et la pile qui dérive |
| `worker/video/remotion/blocks/` | Un composant par sorte de bloc, plus le registre. Aucun import de Remotion, aucune couleur, aucune courbe — `blocks.test.js` tient les trois |
| `worker/video/remotion/contrast.js` | Luminance et contraste WCAG, recopiés à la main depuis `src/lib/audit/colors.ts`. `contrast.test.js` tient les deux ensemble |
| `tests/video-worker-separation.test.js` | Ce qui tient réellement Remotion hors du manifeste de Mocky |
| `tests/video-3d-permission.test.js` | Ce qui tient la liste des blocs 3D en phase avec les composants qui dessinent en GL |
| `tests/video-frame-geometry.test.js` | La taille du cadre, les surdimensionnements et la part d’image, comparés entre le navigateur et le worker |

La file est en mémoire avec un journal JSON sur disque, et il n’y a ni Redis ni
table de tâches — même posture que le reste du magasin. Un Mocky auto-hébergé est
un seul processus ; une file d’attente réclamant un second démon pour survivre à
un redémarrage coûterait plus cher à exploiter que la fonctionnalité ne vaut. Le
journal n’existe que pour une chose : qu’un redémarrage puisse dire à
l’utilisateur ce qu’est devenu le rendu qu’il regardait. Rien n’est repris. Le
remettre en file tiendrait en une ligne, mais un rendu que personne n’a demandé
deux fois est du processeur dépensé dans son dos, et sur une instance qui
redémarre en boucle il est dépensé à chaque démarrage.

---

## Motion au début d’un projet : les types

Motion a commencé comme un panneau qu’on ouvre sur un projet qui existe déjà, au-
dessus d’images déjà choisies. La demande qui a produit cette section en est
l’autre bout : une case cochée à côté de Muse, au tout premier prompt, pour que
le film soit coupé dans le dossier au moment où le dossier s’écrit.

Trois choses devaient exister pour cela, et une quatrième qui a été demandée n’a
pas pu être construite. Elles sont séparées ci-dessous parce que la dernière est
une frontière de sécurité, et que la chose honnête à faire d’une frontière est de
la nommer plutôt que de la contourner.

### Un type est une porte d’entrée dans le catalogue, jamais un sixième modèle

« Des templates de création Motion » — un globe, un fond, un bouton, un héro. Lus
comme des modèles, ce sont quatre entrées de plus dans `VIDEO_TEMPLATES` : quatre
compositions à écrire, quatre branches dans le worker, et tout l’argument du
sixième modèle jeté. `composed` existe précisément pour qu’un look neuf soit une
COMBINAISON et non une carte que quelqu’un a écrite.

Un type est donc une **porte d’entrée**. `server/video/kinds.js` tient une
énumération fermée de huit — `hero`, `background`, `banner`, `showcase`,
`figure`, `globe`, `mark`, `story` — et chacune se résout en rien d’autre qu’un
sous-ensemble de `BLOCK_KINDS`, un sous-ensemble de `BACKGROUND_KINDS`, une
valeur d’`ASPECT_RATIOS` et une fenêtre à l’intérieur de
`TEMPLATE_LIMITS.composed`. Un film composé sous un type est un document
`composed` ordinaire : le worker n’apprend jamais que le type a existé,
`validate.js` n’est pas touché, et un brouillon enregistré avant cette version se
lit exactement comme avant.

Quatre conséquences valent d’être dites, parce que chacune est une décision.

**Un type RESSERRE ; il n’argumente jamais.** Le prompt ne dit pas « préférez ces
six blocs » — les vingt et un autres ne sont pas dans le catalogue qu’il imprime,
ni dans l’indice de décodage. C’est la leçon qu’`availableBlocks` a déjà apprise
deux fois, sur les images et sur la 3D : un modèle à qui l’on montre un bloc en
lui disant de ne pas s’en servir s’en sert, et le refus arrive une fois les
jetons dépensés. Un type ne peut pas non plus remettre un bloc que la sélection
ou la permission 3D avaient déjà retiré, ce qui serait une permission écrite deux
fois.

**`background` est le type qui prouve le mécanisme.** On ne lui offre aucun bloc
qui pose du texte, et pas le fond `image`. Non parce qu’une règle l’interdit : un
`heading` n’est simplement pas dans son catalogue. Le défaut que ce type existe
pour éviter, c’est un titre gravé dans un fond, en concurrence avec le titre que
la page pose par-dessus — à une taille choisie par le film, corrigible seulement
par un nouveau rendu.

**Un resserrement peut affamer un type, et cela se refuse par son nom.** `globe`
sur un compte sans la permission 3D laisse debout `map`, `heading` et `kicker` :
rien en aval ne le remarquerait, et ce qui reviendrait serait un film plat avec
une légende sur le monde, depuis un bouton qui disait globe. `starvedMotionKind`
pose donc la question aux blocs de SIGNATURE du type et non à leur nombre, et le
refus dit à quelle porte frapper. `showcase` sur une sélection vide est le même
cas avec l’autre cause.

**Et il se dégrade au lieu de disparaître.** Les trois blocs CHAMP sont dessinés
en GL, donc un `background` fait uniquement d’eux serait retiré à tout compte
sans 3D — le type dont une page se sert le plus, refusé pour une raison de moteur
de rendu. Il porte aussi `soundWave` et `equalizer` : une surface en mouvement
sans un seul glyphe, la même image dessinée à plat, et l’exemple travaillé du
prompt composé en ancre déjà un en `full` (Q1).

Chaque borne qu’un type énonce est lue dans l’entrée qui l’énonce, et
`kinds.test.js` tient trois affirmations là-dessus : chaque fenêtre est comprise
dans `TEMPLATE_LIMITS.composed`, `scenes.max` fois `sceneMs.max` reste sous le
plafond total, et aucune phrase de prose de la table ne contient de chiffre — la
même règle que `BLOCK_NOTES` suit un fichier plus loin.

### La liste est publiée plutôt que recopiée

Cette fonctionnalité tient cinq miroirs à la main et s’est fait mordre par quatre
d’entre eux. Le panneau a besoin des types pour dessiner un sélecteur, et un
sixième miroir est exactement ce que cela serait devenu.

`GET /api/video/status` les publie donc à côté de `limits`, ce qui est l’argument
que `maxScenes` fait déjà : citer une borne depuis sa source est ce qui empêche
le panneau et le schéma de dériver. Ce qui voyage, ce sont les identifiants et
les bornes — jamais la prose. Les trois phrases de `MOTION_KIND_SPECS` sont un
prompt écrit en anglais à l’adresse d’un modèle ; la phrase qu’une personne lit
est `muse.motionKind.<id>` dans les deux dictionnaires, et
`tests/video-motion-kinds.test.js` en exige une par identifiant dans chaque
langue, et aucune orpheline dans l’autre sens.

`motionKinds` est publié quoi que dise `enabled`, contrairement à `threeD` juste
à côté : c’est un fait sur la CONSTRUCTION et non sur le compte, et cela ne nomme
rien qu’un compte ne pourrait lire dans les sources.

### La direction atteint le modèle, et le thème toujours pas

Un thème fait porter à un film les couleurs du projet. Il ne peut pas faire
qu’un film RESSEMBLE au dossier, et c’était la moitié de la demande : retirez les
couleurs de deux films et il reste le même document — une direction qui dit
« éditorial, silence généreux, une idée par écran » et une qui dit « dense,
saturé, tout à la fois » composaient des scènes identiques.

`src/lib/video/directionBrief.ts` lit le même markdown que lit `theme.ts`, pour
l’autre moitié : les MOTS. Ils voyagent vers `/compose` sous `direction`,
atterrissent dans le tour UTILISATEUR sous un en-tête qui dit que ce sont des
données, et changent ce qui est composé — combien de scènes, une pile plus ou
moins chargée, un fond de filets ou un dégradé.

Deux règles l’empêchent de devenir un thème par la porte de derrière.

**Aucune couleur ne passe.** Chaque triplet hexadécimal est retiré, et ce n’est
pas de la propreté : les couleurs voyagent déjà, exactement, comme `theme`,
attachées par le serveur après que la réponse du modèle a été validée. Les
répéter en prose n’apporte rien qu’une composition puisse utiliser et fait la
seule chose qu’un paragraphe entier interdit ici — cela invite un modèle à écrire
une couleur, et un document qui en porte une est refusé EN ENTIER, une fois
l’appel payé.

**C’est de la prose, jamais un tableau.** Une ligne de jetons lue comme de la
prose est une liste de valeurs, et un modèle à qui l’on tend des valeurs remplit
des champs avec. Les blocs de code, les lignes de tableau, les liens nus et les
images intégrées sont retirés ; un titre dont toutes les lignes ont été retirées
part avec, au lieu d’arriver comme le mot « Tokens » pointant vers rien.

La règle 9 est inchangée et reste appliquée là où elle l’a toujours été :
`VideoTimelineSchema` n’a pas de clef `theme`, donc un modèle qui en invente une
est refusé comme une clef `audio`, et `attachTheme` l’écrit sur
`RenderTimelineSchema` après validation. N’extraire rien n’est pas un échec —
cela renvoie une chaîne vide, le bloc est omis, et le film est composé avec le
prompt qui existait avant ce module.

### Pourquoi le film ne peut pas se jouer dans la maquette

C’est la partie de la demande qui n’a pas pu être construite, et la raison est
une frontière de sécurité et non un oubli.

Un écran généré tourne dans une iframe en bac à sable avec `allow-scripts` et
**sans** `allow-same-origin`, donc son origine est opaque (I2). Deux choses
indépendantes en découlent, et chacune suffit à elle seule.

**La CSP bloque l’élément.** `cspMeta()` dans `src/components/Preview.tsx` pose
`default-src 'none'` puis nomme `script-src`, `style-src`, `img-src`, `font-src`,
`connect-src`, `form-action`, `frame-src`, `object-src` et `base-uri`. Il n’y a
pas de `media-src`, donc il retombe sur `default-src` et une balise `<video>` est
refusée d’emblée. `connect-src 'none'` ferme les autres voies en même temps :
pas de `fetch`, donc pas de WebCodecs, et une URL `blob:` fabriquée dans le
parent est liée à l’origine du parent et illisible depuis une origine opaque.

**Et de toute façon les octets ne seraient pas servis.** `GET /api/video/:hash`
est derrière `requireUser`, vérifie la propriété AVANT l’existence pour ne pas
devenir un oracle, et envoie `Cache-Control: private` sans
`Access-Control-Allow-Origin`. Le cookie de session est `SameSite=Lax` ; un
document d’origine opaque a un site-for-cookies nul, donc un chargement de
sous-ressource depuis l’aperçu ne porte aucune session et la route répond 403 —
correctement.

C’est pour cela qu’une séquence au défilement fonctionne et pas un film. Une
séquence est découpée en JPEG par ffmpeg à l’ingestion et servie par
`server/videos/routes.js`, délibérément non authentifiée avec
`Access-Control-Allow-Origin: *`, donc `<ScrollSequence>` a besoin d’`img-src` et
de rien d’autre. Un film est un seul `.mp4`, privé au compte qui l’a rendu, et il
n’y a pas de ffmpeg sur le chemin d’export pour le découper — ce qui est aussi
pourquoi `mediaPoster` pointe un `<video preload="metadata">` sur le fichier au
lieu de montrer une vignette.

Le faire jouer voudrait dire ajouter `media-src` à la CSP de l’aperçu, ou servir
les octets d’un film sans authentification par leur empreinte. Ce sont deux
modifications d’un contrôle qui existe pour une raison écrite, et ce n’est pas à
cette fonctionnalité de les décider seule.

Le film va donc là où un film va déjà : il est attaché à l’ÉCRAN comme un
`AttachedMedia` de type `film`, et dessiné sur le canevas à côté du cadre, dans
le document de même origine de Mocky où la session marche et où aucune CSP ne
gêne. `muse.motionCost` le dit avant que la case soit cochée plutôt qu’après le
rendu — quelqu’un qui attend un film dans la maquette et trouve une carte à côté
a été surpris par l’interface, et c’est le seul échec qu’une phrase peut empêcher
entièrement.

### Ce que cette passe n’a pas construit

Dit plutôt que laissé à découvrir.

- **Aucune capacité, et aucun composant `<MotionFilm>`.** Ce serait un composant
  incapable de dessiner son propre sujet, pour les deux raisons ci-dessus.
  L’entrée du registre est délibérément absente plutôt que présente et inerte :
  `scrollvideo` est le précédent, et tout son commentaire dit de ne jamais offrir
  un composant qui n’a rien à montrer.
- **Les types sont accessibles depuis le composer, pas encore depuis le panneau
  d’export.** `VideoExportDialog` propose toujours les cinq compositions
  éditables et `auto` ; un sélecteur `motionKind` là-bas est un incrément direct,
  laissé de côté dans cette passe plutôt qu’à moitié câblé.
- **Un film par écran, coupé une fois.** Rien ne recoupe un film quand la
  direction change, et rien n’en propose un second pour une autre section du même
  écran. `AttachedMedia` en tient un, ce qui est la forme qui a rendu la carte du
  canevas possible ; un écran qui voudrait un film de héro et un film de fond
  demande d’abord que ce champ devienne une liste, et les raisons pour lesquelles
  `owners` est un ensemble s’y appliquent.
- **Le rendu est attendu jusqu’au bout.** L’écran est terminé et sur le canevas
  avant que cela commence, donc rien n’est bloqué — mais fermer le composer
  interrompt l’attente, et le film est alors rendu, stocké et retrouvable dans
  Média sans être attaché à quoi que ce soit.
