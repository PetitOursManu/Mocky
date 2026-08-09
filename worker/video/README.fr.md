# Mocky — worker de rendu Remotion

> ### ⚠️ À lire avant de construire l'image
>
> Ce service produit de la vidéo avec **[Remotion](https://www.remotion.dev/)**,
> et Remotion **n'est pas gratuit pour tout le monde**.
>
> Sa licence est gratuite pour les **particuliers**, pour les **organisations à
> but non lucratif**, et pour les **sociétés jusqu'à trois salariés**. Au-delà de
> ce seuil, l'utiliser — y compris dans quelque chose que vous n'hébergez que
> pour vous — exige une **Company License** payante, achetée par siège auprès de
> Remotion.
>
> La licence ne tranche pas non plus le cas dans lequel Mocky se trouverait
> autrement : la **redistribution à l'intérieur d'un produit auto-hébergé**.
> C'est pourquoi Remotion n'est ni dans le `package.json` de Mocky, ni dans son
> image, ni dans le `docker-compose.yml` par défaut. Rien de l'export vidéo
> n'existe sur une instance qui n'a pas construit ce répertoire.
>
> **Construire cette image, c'est le moment où la question devient la vôtre.**
> Lisez <https://www.remotion.dev/> — les termes de la licence, et si votre
> organisation dépasse le seuil — avant de lancer la construction. Personne
> d'autre ne peut y répondre à votre place, et Mocky ne fait délibérément pas
> semblant du contraire.

---

## Pourquoi un service séparé

Trois raisons, dans l'ordre d'importance.

1. **La licence.** Le paragraphe ci-dessus. Garder Remotion hors de l'arbre de
   dépendances de Mocky, c'est ce qui fait que la question de licence *n'existe
   pas* pour ceux qui n'activent jamais l'export vidéo, c'est-à-dire presque
   tout le monde.
2. **La taille.** Remotion apporte un build de Chrome et une chaîne webpack.
   Cela fait plusieurs centaines de mégaoctets ajoutés à une image dont l'argument
   est justement de tourner sur une petite machine auto-hébergée.
3. **Le rayon de souffle.** Un rendu, c'est un navigateur plus un encodeur qui
   occupent un cœur pendant une minute. Dans son propre conteneur, avec ses
   propres limites de mémoire et de CPU, un rendu qui tourne mal est un export
   raté. Dans le conteneur de Mocky, c'est une panne.

La séparation est tenue à quatre endroits, et les quatre doivent tenir :

| Où | Ce que ça garantit |
|---|---|
| `worker/video/package.json` | Les paquets Remotion vivent ici, jamais dans le manifeste de Mocky |
| `worker/video/Dockerfile` | Une seconde image, construite seulement sur demande |
| `.dockerignore` (racine du dépôt) | `worker/` n'entre jamais dans le contexte de build de Mocky |
| `docker-compose.yml` | `profiles: ["video-export"]` — absent tant qu'on ne le demande pas |

Et tenue, plutôt que simplement écrite, par
`tests/video-worker-separation.test.js` dans le dépôt Mocky : la prose ne fait pas
échouer une compilation. L'autre versant — la moitié Mocky du pipeline, le
schéma, la file et le magasin — est documenté dans
[`docs/fr/video-export.md`](../../docs/fr/video-export.md).

---

## Ce qu'il rend

Cinq compositions, une par modèle, et c'est tout ce qu'un appelant peut
atteindre : `render.js` en sélectionne une par l'id que renvoie
`compositionIdFor`, donc une requête ne peut en nommer aucune autre.

| Modèle | Composition | Ce qu'elle dessine |
|---|---|---|
| `slideshow` | `ImageSequenceVideo` | Une image par scène, un effet Ken Burns, une légende facultative sur un panneau |
| `overlay` | `OverlayBandVideo` | Une capture d'écran qui dérive de ±1,2 %, avec un bandeau dont le titre et le sous-titre arrivent en cascade sur un voile presque opaque |
| `vertical` | `VerticalStoryVideo` | 9:16 plein cadre, gros titres, à l'intérieur des marges que les interfaces sociales recouvrent de leurs propres boutons |
| `titles` | `AnimatedTitlesVideo` | Des mots sur le fond du thème, soulignés par l'accent. **Aucune image** |
| `product` | `ProductSpotlightVideo` | Une image cadrée large, une accroche, un à trois arguments et un appel à l'action, énumérés |

**Le modèle n'écrit jamais de code Remotion.** Il écrit un objet JSON, validé par
`src/lib/video/timeline.ts`, et des compositions écrites à la main le consomment.
Toutes les compositions de `remotion/` sont écrites par une personne, et c'est la
règle fondatrice de la fonctionnalité, pas une étape qu'elle aurait traversée —
un sixième rendu, c'est un composant, une entrée dans `COMPOSITIONS`, un lecteur
dans `validate.js` et une revue de code ordinaire. Jamais une chaîne qu'un modèle
aurait transformée en code.

Lisez les props comme hostiles et le reste suit : rien de la timeline n'est jamais
interpolé dans du balisage, un nom de classe, une chaîne de style ou une URL.
Chaque chaîne est un enfant React — échappée par React, et par rien d'autre. Les
adresses d'images sont construites ici à partir d'une empreinte de 64 caractères
validée. `dangerouslySetInnerHTML` n'apparaît pas dans ce répertoire et ne doit
pas commencer.

### Le thème

Un film porte quatre couleurs, deux familles de polices et un rayon d'angle,
attachés par le serveur de Mocky et jamais écrits par le modèle. `resolveTheme`
remplit avec `THEME_FALLBACK` tout ce que le projet n'a pas déclaré — les seules
couleurs de ce répertoire qui ne viennent pas du document — et revérifie chaque
valeur reçue : de l'hexadécimal et rien d'autre, un seul nom de famille dans un
jeu de caractères sans syntaxe CSS, un rayon entier. Ce second verrou est ce qui
maintient vraie la promesse « rien d'un document ne devient du CSS » même si
quelqu'un desserre le validateur l'an prochain, puisque ces valeurs finissent
dans `linear-gradient()` et dans `rgba()`.

**Une police déclarée est nommée en premier, et `fonts-liberation` suit.** C'est
la seule famille que cette image installe ; rien dans Mocky ne charge une
webfont, et ce conteneur n'a aucune sortie réseau pour en chercher une. Une
direction qui demande du Cormorant Garamond obtient donc du Liberation Sans,
glyphe par glyphe, par le repli propre à CSS — jamais une rangée de carrés
vides, et jamais un export perdu pour une décoration.

Deux valeurs dérivées méritent d'être nommées, parce qu'elles évitent chacune une
image illisible précise : `withAlpha` transforme une couleur déclarée en le voile
qui garde une légende lisible sur une photo que personne n'a prévisualisée, et
`readableInk` choisit le noir ou le blanc d'un appel à l'action à partir de la
luminance relative de l'accent — un libellé coloré pour un bleu nuit est
invisible sur un vert d'eau, et aucune direction ne déclare de jeton pour cela.

### Une scène de diaporama

Une image affichée pendant `durationMs`, avec son effet Ken Burns et sa
transition vers celle qui suit.

| Champ | Ce qu'il fait |
|---|---|
| `kenBurns` | `zoom-in` / `zoom-out` dérivent entre 1.0 et 1.12 ; `pan-left` / `pan-right` déplacent de ±4 % une image surdimensionnée à 1.12 ; `static` ne fait rien. Volontairement discret — le modèle choisit l'effet sans jamais voir le résultat |
| `transitionOut` | `crossfade`, `wipe-left`, `wipe-right`, `none`. Le champ décrit comment une scène PART, et c'est l'arrivée de la suivante qui l'implémente : seule la scène entrante s'anime, par-dessus une sortante restée opaque, parce qu'un fondu à deux côtés passe par le fond à mi-parcours et clignote |
| `textOverlay` | Jusqu'à 120 caractères en `top` / `center` / `bottom`, sur un panneau semi-opaque avec une ombre — l'un sans l'autre perd, sur un ciel clair ou sur une photo sombre |
| `aspectRatio` | `16:9` → 1920×1080, `9:16` → 1080×1920, `1:1` → 1080×1080. 1080 sur le grand côté dans les trois cas, pour qu'un export vertical ne soit pas en silence l'option de moindre qualité |
| `outputFormat` | `mp4` (h264) ou `webm` (vp8, pas vp9 — plusieurs fois plus lent pour un gain que personne ne verra sur un diaporama, avec 110 s de budget et deux cœurs) |

Tout tourne à **30 i/s**, et ce n'est pas configurable : le schéma n'a pas de
champ fps, donc une option ici serait une option que personne ne peut atteindre.

**Une transition n'allonge jamais la vidéo.** Elle mord sur la fin de la scène
sortante et sur le début de l'entrante. Ajouter sa durée ferait mentir le
plafond de 120 secondes du schéma de jusqu'à dix-neuf demi-secondes, et le délai
de 120 secondes de la file de Mocky se mettrait à tuer des exports pourtant
valides. Elle est aussi plafonnée au tiers de la plus courte des deux scènes
qu'elle relie : la scène minimale du schéma dure une seconde, et une transition
d'une demi-seconde de chaque côté n'en laisserait rien voir seule.

`remotion/composition.js` porte toute cette arithmétique en JavaScript simple,
sans React ni import Remotion, pour que `composition.test.js` puisse la vérifier
dans la suite vitest de Mocky. Les comptes d'images, les décalages et la
géométrie sont là où sont les défauts, et c'est la seule partie d'une vidéo
vérifiable sans en produire une. Ne déplacez pas ces calculs dans le JSX.

Le catalogue a rendu cette règle mordante : `entranceStyle`, `kenBurnsTransform`
et `progressAt` y vivent aussi désormais — l'`interpolate` de Remotion était la
seule chose qui gardait une interpolation linéaire bornée à l'intérieur d'un
bundle. `cueFrames` est le plus récent des trois, et celui qui a un défaut
derrière lui : une scène produit peut durer trois secondes et porter une
accroche, trois arguments et un appel à l'action, et cinq repères à un rythme
confortable placent le dernier après la fin de la scène. Elle comprime donc toute
la cascade, pour que rien ne soit jamais programmé avec moins d'une demi-seconde
de scène restante — un texte qui arrive après la fin de sa propre scène, c'est un
film privé de la phrase pour laquelle il a été monté, rendu et annoncé comme une
réussite.

### Comment les images arrivent jusqu'à Chromium

Elles arrivent en base64 dans le corps de la requête, sont écrites dans un
répertoire `mocky-frames/` à l'intérieur du bundle servi, et sont supprimées à la
fin du rendu.

Ce chemin a été choisi par élimination. **Ce conteneur n'a aucune sortie
réseau**, donc aller chercher une image par URL n'est pas une option — et
l'origine de Mocky est souvent un nom qui ne se résout que sur un réseau local.
Les URL `file://` ne peuvent pas être chargées comme sous-ressources d'une page
`http://` : Chromium les refuse, et le seul contournement consiste à désactiver
la sécurité web dans un moteur de rendu qui affiche du contenu fourni par un
modèle. Les URL `data:` fonctionnent, mais elles signifient jusqu'à 80 Mo de
base64 sérialisés dans les props d'une page qui fait aussi tourner un encodeur.

Le répertoire est vidé au début de chaque rendu plutôt que nommé par requête,
pour qu'un rendu abandonné en route ne laisse pas d'images périmées dans un
bundle qui vit aussi longtemps que le conteneur. Et la composition utilise le
`<Img>` de Remotion, qui annule le rendu quand il ne peut pas charger une image :
une erreur de préparation est un travail en échec avec un message, jamais une
vidéo d'images noires annoncée comme réussie.

### Il ne fait pas confiance à son appelant

Mocky valide chaque timeline avec le schéma zod avant de mettre un travail en
file, donc `validate.js` ne refuse jamais rien sur une instance saine. C'est
justement pour cela qu'il existe : ceci est un service HTTP nu, sans
authentification propre, et le pont interne sur lequel il se trouve est un choix
de déploiement, pas une garantie.

Ce n'est délibérément pas une troisième copie du schéma — il vérifie si la
composition peut *rendre* le document, et `validate.test.js` exige que ses bornes
et ses énumérations correspondent à `server/video/timeline.js` sur un corpus,
valeurs par défaut comprises. Les clés inconnues sont refusées et nommées, ce qui
sert aussi de détecteur de décalage de version : un Mocky qui apprendrait à
envoyer `audio` échoue avec le mot dans le message au lieu de récupérer une vidéo
silencieuse.

---

## Construire et lancer

Depuis la racine du dépôt :

```bash
docker compose --profile video-export up -d --build
```

Sans `--profile video-export`, rien ici n'est construit, créé ni démarré.
`docker compose up -d` se comporte exactement comme avant l'existence de ce
répertoire.

Pour n'arrêter que le worker :

```bash
docker compose --profile video-export stop video-worker
```

En local, sans Docker (Node 22.12+ requis ; un build de Chrome est téléchargé au
premier lancement) :

```bash
cd worker/video
npm install
npm run ensure-browser   # facultatif : server.js le fait au démarrage
npm start                # écoute sur :3030
```

Vérification :

```bash
curl http://localhost:3030/health

# Une scène, un pixel. `imageId` doit faire 64 caractères hexadécimaux minuscules
# et ses octets doivent être dans la même requête — le worker ne va rien chercher.
ID=$(printf 'a%.0s' $(seq 64))
PIXEL=iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=
curl -X POST http://localhost:3030/render -H 'content-type: application/json' \
     -d "{\"timeline\":{\"scenes\":[{\"imageId\":\"$ID\",\"durationMs\":2000}]},
          \"images\":[{\"id\":\"$ID\",\"mime\":\"image/png\",\"base64\":\"$PIXEL\"}]}" \
     --output scene.mp4
```

---

## Le contrat HTTP

Deux routes. Le client, c'est `server/video/worker.js` dans le dépôt Mocky, et
ses attentes sont la spécification.

### `GET /health`

```json
{ "ok": true, "version": "0.1.0" }
```

Tout ce qui n'est pas un 200 signifie « indisponible » pour le panneau
d'administration de Mocky. `version` est la version de ce paquet, et elle est
affichée à l'administrateur.

### `POST /render`

```jsonc
{
  "timeline": { /* une VideoTimeline — revalidée ici, voir plus haut */ },
  "images":   [ { "id": "<sha256>", "mime": "image/png", "base64": "…" } ],
  "licenseKey": "…"   // facultatif ; voir plus bas
}
```

Répond `200` avec les octets de la vidéo, un content-type vidéo, et
`x-mocky-worker-composition` qui nomme la composition qui les a produits — c'est
aussi ainsi qu'un conteneur resté sur une image plus ancienne se trahit dans une
trace réseau. Les corps sont acceptés jusqu'à 80 Mo, parce que les images
voyagent dans la requête plutôt que sous forme d'URL vers Mocky : ce conteneur
n'a aucune garantie d'avoir une route de retour, ni de sortie réseau pour
l'emprunter.

Chaque `imageId` de scène doit avoir ses octets dans `images`. Il n'y a aucun
repli pour une image manquante : une vidéo avec une scène noire au milieu serait
annoncée comme un export réussi. Un document `titles` ne nomme aucune image et
n'en envoie aucune, et c'est le modèle lui-même, pas un cas limite.

**Chaque échec tient en une ligne de texte brut, ni JSON ni page HTML.** Mocky
recopie jusqu'à 300 caractères d'un corps non-2xx directement dans la phrase que
lit l'utilisateur, et des accolades ou une trace d'exécution au milieu de cette
phrase n'aident personne.

| Statut | Quand |
|---|---|
| `429` | Un rendu est déjà en cours. Le worker n'en fait qu'un à la fois |
| `504` | Le rendu a dépassé 110 s et a été abandonné — dix secondes sous le délai de 120 s de Mocky, pour que ce soit le worker qui explique |
| `500` | Le rendu a échoué, ou n'a produit aucun octet |
| `404` | Une route inexistante, en général un `workerUrl` avec un chemin en trop |
| `400` | Un corps refusé par Express (JSON invalide, trop gros), ou une timeline refusée par `validate.js`. Le message nomme le champ |

---

## Sortie réseau, et ce que change une clé de licence

**Sans clé de licence configurée, ce conteneur n'a aucun accès réseau sortant.**
Le réseau Compose sur lequel il se trouve est déclaré `internal: true`, donc
Docker le crée sans passerelle : le worker parle à Mocky, et à rien au-delà de
l'hôte.

C'est délibéré, et une clé de licence le change. **À partir de Remotion 5.0, la
télémétrie est obligatoire pour un rendu sous licence** — une clé configurée qui
ne peut pas joindre Remotion est une clé qui ne fonctionne pas. Donc :

1. Le panneau d'administration de Mocky le dit à l'endroit où la clé est saisie.
   Ce n'est jamais appliqué en silence.
2. La clé est stockée côté serveur, jamais renvoyée au navigateur, et voyage
   jusqu'à ce worker dans la requête de rendu.
3. Donner au conteneur l'accès dont la télémétrie a besoin tient en **une ligne
   visible** : `internal: true` → `internal: false` sur le réseau `video-worker`
   dans `docker-compose.yml`. Elle appartient à qui a saisi la clé.

Le worker ne journalise jamais la clé et ne la renvoie jamais dans une réponse ;
un test de `server.test.js` le tient.

---

## Comment Mocky l'atteint

Renseignez `http://video-worker:3030` dans le champ *URL du worker de rendu* du
panneau d'administration. C'est le nom du service Compose, sur le pont interne,
et c'est la configuration prévue — pas un contournement.

Il faut le dire parce que cela a l'air de ne pas devoir marcher. Mocky protège
toute URL que le serveur va chercher avec `assertSafeTargetResolved()`, qui
rejette les plages d'adresses privées — protection SSRF du proxy de fournisseur,
volontairement ouvert — et un nom de service Compose se résout en `172.16/12`.
**Cette URL est la troisième dérogation à ce garde réservée à l'administrateur**,
aux côtés de la cible texte et de l'URL de base sd-webui, et elle est écrite avec
elles dans `docs/architecture/invariants.md`.

Le raisonnement, parce qu'une dérogation qu'on n'argumente pas est une dérogation
que quelqu'un supprime : le garde existe pour empêcher un *navigateur* de choisir
où le serveur va chercher, et cette URL n'arrive que par
`PUT /api/admin/video/config`, derrière `requireAdmin`. Elle est locale par
définition — ce conteneur n'a aucun port publié ni aucune route sortante, par
construction. L'alternative qu'imposait le garde était pire dans la direction qui
compte : publier sur une adresse résolvable un point d'entrée non authentifié qui
accepte des corps de 80 Mo, ce que le panneau conseillait auparavant.

Ce qui reste vérifié : le schéma doit être `http` ou `https`, et aucun des deux
appels ne suit de redirection — un worker répondant `302` vers le point de
métadonnées ne peut donc pas transformer la dérogation en SSRF.
`createVideoWorker({ guard })` prend toujours le contrôle en paramètre : qui
exécute ceci sur un hôte public peut y remettre `assertSafeTargetResolved`.

---

## Organisation des fichiers

```
worker/video/
  README.md            la version anglaise — l'avertissement de licence en premier, exprès
  README.fr.md         ce fichier
  package.json         les paquets Remotion, épinglés exactement. Jamais fusionnés dans ceux de Mocky
  Dockerfile           node:22-bookworm-slim + les bibliothèques de Chromium + ffmpeg
  .dockerignore        ce répertoire est son propre contexte de build
  server.js            Express : GET /health, POST /render. N'importe aucun paquet Remotion
  server.test.js       le contrat HTTP, exécuté par la suite vitest de Mocky
  validate.js          ce que ce worker accepte de rendre, sans faire confiance à l'appelant
  validate.test.js     ce contrôle, et son accord avec server/video/timeline.js
  render.js            tout ce qui importe @remotion/*, derrière un import dynamique
  encoding.js          le tableau des codecs, et ce qu'on dit à chacun sur la qualité
  encoding.test.js     cet objet d'options — la seule part d'un rendu qu'un test vérifie
  remotion/
    index.js               registerRoot — bundlé, jamais exécuté par Node
    Root.jsx               la liste des compositions ; cinq entrées, un calculateMetadata
    ImageSequenceVideo.jsx     slideshow  ⎫
    OverlayBandVideo.jsx       overlay    ⎪ les compositions. Du React écrit à la
    VerticalStoryVideo.jsx     vertical   ⎬ main, une par modèle, chacune une revue
    AnimatedTitlesVideo.jsx    titles     ⎪ de code ordinaire et non une brèche
    ProductSpotlightVideo.jsx  product    ⎭
    composition.js         les ids, la géométrie, le thème et l'arithmétique d'images,
                           en JS simple pour que Node et le bundle les importent tous deux
    composition.test.js    cette arithmétique, sans produire de vidéo
```

Les tests s'exécutent depuis la racine du dépôt (`npm test`) bien que ceci soit
un sous-projet séparé, et chacun l'assume pour une raison précise.

`server.test.js` teste le fil entre deux moitiés qui ne se voient pas,
c'est-à-dire exactement l'endroit où un contrat dérive sans qu'on le remarque. Il
ne fonctionne que parce que `server.js` n'importe aucun paquet Remotion : si cela
cesse d'être vrai, le test cesse de tourner partout où le worker n'a pas été
construit, et c'est le signal qu'il faut remettre l'import derrière `render.js`.
La même règle garde `validate.js` et `remotion/composition.js` libres d'imports
Remotion.

`validate.test.js` importe `server/video/timeline.js`, le seul endroit où ce
sous-projet sort de lui-même. **Cet import est réservé aux tests et doit le
rester** : la construction Docker copie ce répertoire et rien d'autre, donc un
import à l'exécution de quoi que ce soit sous `server/` donnerait un conteneur
qui démarre puis échoue à chaque rendu sur un module introuvable.

## Versions

`@remotion/bundler`, `@remotion/renderer` et `remotion` sont épinglés à une
version exacte, pas à un intervalle. Aucun lockfile n'est versionné, parce que
le générer suppose d'installer Remotion dans le dépôt Mocky — la contamination
que ce sous-projet existe pour empêcher. Les épinglages exacts sont ce qui fait
que deux constructions du même commit embarquent le même moteur de rendu.

Mettre à jour est un geste délibéré : passer les trois à la même version,
reconstruire, et relire les termes de la licence pour cette version.
