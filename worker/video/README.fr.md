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

---

## Ce qu'il fait aujourd'hui — phase 1

**Ce worker ignore la timeline et les images qu'on lui envoie, et renvoie une
mire de trois secondes.**

C'est l'objet de cette phase. La chaîne à prouver est longue — navigateur → API
Mocky → schéma de timeline → file en mémoire → HTTP → ce conteneur → Chromium →
mp4 → retour dans la bibliothèque vidéo — et chaque maillon peut casser d'une
façon qui ressemble à la panne d'un autre. Une composition fixe retire le moteur
de rendu de la liste des suspects.

Comme un plan de couleur unie est indiscernable d'un rendu cassé, la mire dit ce
qu'elle est de trois façons :

- l'image affiche *« test card — this is not your timeline »*, avec un compteur
  de secondes qui prouve que les images se sont bien succédé ;
- la réponse porte l'en-tête `x-mocky-worker-phase: test-card` ;
- le conteneur journalise un avertissement `PHASE 1` à chaque démarrage.

La phase 2 remplacera `renderTestCard` par une composition qui consomme une
`VideoTimeline`. Le contrat HTTP ne change pas.

**Le modèle n'écrit jamais de code Remotion.** Il écrit un objet JSON, validé par
`src/lib/video/timeline.ts`, et des compositions écrites à la main le consomment.
Toutes les compositions de `remotion/` sont écrites par une personne, et c'est la
règle fondatrice de la fonctionnalité, pas une commodité de phase 1.

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
curl -X POST http://localhost:3030/render -H 'content-type: application/json' \
     -d '{}' --output test-card.mp4
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
  "timeline": { /* une VideoTimeline validée — ignorée en phase 1 */ },
  "images":   [ { "id": "<sha256>", "mime": "image/png", "base64": "…" } ],
  "licenseKey": "…"   // facultatif ; voir plus bas
}
```

Répond `200` avec les octets de la vidéo et un content-type vidéo. Les corps sont
acceptés jusqu'à 80 Mo, parce que les images voyagent dans la requête plutôt que
sous forme d'URL vers Mocky : ce conteneur n'a aucune garantie d'avoir une route
de retour.

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
| `400` | Un corps refusé par Express : JSON invalide, ou trop gros |

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
  render.js            tout ce qui importe @remotion/*, derrière un import dynamique
  remotion/
    index.js           registerRoot — bundlé, jamais exécuté par Node
    Root.jsx           la liste des compositions ; une seule entrée en phase 1
    TestCard.jsx       la mire
    composition.js     son id et ses dimensions, en JS simple pour que render.js puisse les importer
```

`server.test.js` s'exécute depuis la racine du dépôt (`npm test`) bien que ceci
soit un sous-projet séparé. Il teste le fil entre deux moitiés qui ne se voient
pas, c'est-à-dire exactement l'endroit où un contrat dérive sans qu'on le
remarque — et il ne fonctionne que parce que `server.js` n'importe aucun paquet
Remotion. Si cela cesse d'être vrai, le test cesse de tourner partout où le
worker n'a pas été construit, et c'est le signal qu'il faut remettre l'import
derrière `render.js`.

## Versions

`@remotion/bundler`, `@remotion/renderer` et `remotion` sont épinglés à une
version exacte, pas à un intervalle. Aucun lockfile n'est versionné, parce que
le générer suppose d'installer Remotion dans le dépôt Mocky — la contamination
que ce sous-projet existe pour empêcher. Les épinglages exacts sont ce qui fait
que deux constructions du même commit embarquent le même moteur de rendu.

Mettre à jour est un geste délibéré : passer les trois à la même version,
reconstruire, et relire les termes de la licence pour cette version.
