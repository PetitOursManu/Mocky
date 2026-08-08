# L’export vidéo

Mocky transforme une liste d’images de la médiathèque en `.mp4`. Pas un écran,
pas une séquence au défilement : un film, monté à partir d’images que
l’utilisateur a choisies, rendu par [Remotion](https://www.remotion.dev/) dans un
conteneur absent d’une installation par défaut.

Cette page traite des décisions. Ce que fait chaque contrôle est dans
[l’interface](fr/interface.md) ; le contrat HTTP du worker lui-même est dans
`worker/video/README.fr.md`.

---

## Ce qu’il produit, et ce qu’il ne produit pas

Un diaporama. Une image par scène, chacune avec sa durée, son mouvement de
caméra et sa transition vers la suivante, éventuellement légendée par une ligne
incrustée dans l’image. Vingt scènes au plus, deux minutes au plus, 30 images par
seconde, en `16:9`, `9:16` ou `1:1`.

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
qu’il renvoie est un unique objet JSON. Il **ordonne et règle** des images que
l’utilisateur a déjà choisies. Il ne choisit pas les images, et il n’écrit jamais
une ligne de code de rendu. Toutes les compositions de
`worker/video/remotion/` sont écrites à la main.

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
| `JOB_TIMEOUT_MS` | 120 000 | Aligné sur le plafond : un rendu qui a pris plus de temps que la durée de la vidéo n’aboutira pas |

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

## Partir d’une image

Le panneau d’export sait aussi fabriquer les images. On décrit un sujet, on
obtient une image modèle, on la garde ou on la régénère, puis on demande de deux
à six variantes et on coche celles qui méritent d’être montées.

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

---

## Les fichiers

| Fichier | Ce qu’il contient |
|---|---|
| `src/lib/video/timeline.ts` | Le schéma zod, et le raisonnement derrière chaque borne. La définition à lire |
| `server/video/timeline.js` | Le même schéma, recopié à la main pour Node. `timeline.test.js` tient les deux ensemble |
| `server/video/compose.js` | Le seul appel de modèle : il ordonne et règle, il ne choisit jamais |
| `server/video/variants.js` | Les deux chemins de variantes, et le tableau figé des axes |
| `server/video/config.js` | Les réglages d’administration. La clé de licence ne quitte jamais le serveur |
| `server/video/queue.js` | File en mémoire, journal JSON atomique, une seule tâche à la fois. Jamais de Redis |
| `server/video/worker.js` | Le client HTTP du worker de rendu, et `assertWorkerTarget` |
| `server/video/store.js` | Le fichier terminé, gardé entier. **Pas** `server/videos/` |
| `server/video/routes.js` | `/api/video`, le garde des images en attente, et le routeur d’administration |
| `src/components/VideoExportDialog.tsx` | Le panneau. Ouvert depuis la barre d’outils, jamais depuis un écran |
| `worker/video/` | Le worker Remotion : sous-projet séparé, image séparée, README séparé |
| `tests/video-worker-separation.test.js` | Ce qui tient réellement Remotion hors du manifeste de Mocky |

La file est en mémoire avec un journal JSON sur disque, et il n’y a ni Redis ni
table de tâches — même posture que le reste du magasin. Un Mocky auto-hébergé est
un seul processus ; une file d’attente réclamant un second démon pour survivre à
un redémarrage coûterait plus cher à exploiter que la fonctionnalité ne vaut. Le
journal n’existe que pour une chose : qu’un redémarrage puisse dire à
l’utilisateur ce qu’est devenu le rendu qu’il regardait. Rien n’est repris. Le
remettre en file tiendrait en une ligne, mais un rendu que personne n’a demandé
deux fois est du processeur dépensé dans son dos, et sur une instance qui
redémarre en boucle il est dépensé à chaque démarrage.
