# Déploiement

## L'image Docker

`Dockerfile`, construction **multi-étages** sur `node:20-slim`.

### Étage 1 — construction

```dockerfile
FROM node:20-slim AS builder
COPY package.json package-lock.json ./
RUN npm ci                 # toutes les dépendances, devDeps comprises
COPY . .
RUN npm run build          # tsc && vite build → dist/
```

### Étage 2 — exécution

```dockerfile
FROM node:20-slim AS runtime
RUN npm ci --omit=dev && npm cache clean --force
```

Puis trois couches qui méritent chacune une explication.

**`ffmpeg` (~120 Mo), au mieux.** Il découpe un clip généré en séquence JPEG
(`server/videos/frames.js`). L'installation est enveloppée dans un `|| echo …` :
un hôte de build sans `apt` ne doit pas faire échouer toute l'image. Sans ffmpeg,
la vidéo au défilement **se déclare indisponible**, le dit dans le panneau Muse, et
rien d'autre ne change.

**Chromium + `fetcher-mcp` (~300 Mo), au mieux également.**

```dockerfile
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV FETCHER_MCP_VERSION=0.2.1
ENV PLAYWRIGHT_VERSION=1.49.1
RUN (npm install -g "fetcher-mcp@${FETCHER_MCP_VERSION}" \
     && npx --yes "playwright@${PLAYWRIGHT_VERSION}" install --with-deps chromium \
     && chmod -R a+rX /ms-playwright) \
    || (echo "…" && touch /app/.no-chromium)
```

Trois décisions y sont encodées :

- **Les versions sont épinglées.** `npx --yes playwright install` résolvait vers ce
  qui avait été publié ce jour-là : deux builds du même commit pouvaient livrer des
  navigateurs différents.
- **`PLAYWRIGHT_BROWSERS_PATH` est posé AVANT l'installation, et hors de `/root`.**
  Le conteneur ne tourne plus en root (voir `USER` plus bas) : un navigateur laissé
  dans `/root/.cache` serait illisible à l'exécution.
- **L'échec laisse une trace.** `/app/.no-chromium` est un marqueur que le serveur
  peut rapporter, au lieu d'une ligne de log que personne ne lit.

La dégradation à l'exécution reste en place quoi qu'il arrive (M3/M5) : sans
Chromium, Muse retombe sur `fetch` + Readability puis sur la bibliothèque de
patterns hors ligne. Embarquer le navigateur supprime l'installation au premier
lancement, pas le repli.

**Les copies depuis le builder.**

```dockerfile
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public
COPY --from=builder /app/mocky.mcp.json ./mocky.mcp.json
```

La dernière ligne n'est pas décorative. `server/muse/mcp/config.js` résout ce
fichier relativement à `ROOT_DIR` (`/app`). Sans lui, l'hôte MCP démarre **zéro
serveur** et l'inspiration live retombe silencieusement sur le dossier hors ligne —
pendant que la couche Chromium a bien été payée au build. C'est arrivé, et la CI le
vérifie désormais explicitement :

```yaml
- run: docker exec mocky-ci test -f /app/mocky.mcp.json
```

### Le reste

```dockerfile
RUN mkdir -p /app/server/data && chown -R node:node /app/server/data
ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787
VOLUME ["/app/server/data"]
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.MOCKY_PORT||process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
```

Le `chown` est fait **avant** `USER node` pour que l'utilisateur non privilégié
puisse écrire dans le répertoire de données — et pour que les fichiers du volume
monté n'appartiennent pas à root, ce qui rendait les sauvegardes et le Docker
rootless pénibles.

---

## `docker compose`

```yaml
services:
  mocky:
    build: .
    image: mocky:latest
    container_name: mocky
    ports:
      - "${MOCKY_BIND:-127.0.0.1}:8787:8787"
    volumes:
      - mocky-data:/app/server/data
    env_file:
      - path: .env
        required: false
    environment:
      NODE_ENV: production
      PORT: 8787
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      start_period: 15s
      retries: 3

volumes:
  mocky-data:
```

| Commande | Effet |
|---|---|
| `docker compose up -d --build` | Construit et démarre en arrière-plan |
| `docker compose logs -f` | Suit les journaux |
| `docker compose ps` | État, y compris la sonde de santé |
| `docker compose down` | Arrête et supprime le conteneur — **les données restent** |
| `docker compose down -v` | Arrête et **supprime toutes les données** (volume retiré) |

`env_file` avec `required: false` est ce qui fait que `.env` est **facultatif** :
sans cette section, rien de ce que contient `.env` n'atteindrait jamais le
conteneur.

> `docker-compose.override.yml` est ignoré par git — délibérément. Compose le
> charge par-dessus le fichier principal, donc un fichier commité suivrait
> silencieusement le dépôt jusqu'à un vrai déploiement ; celui utilisé en local
> épingle `MOCKY_ORIGIN` sur `http://localhost:8787`, ce qui est juste sur un
> portable et faux partout ailleurs.

---

## Variables d'environnement

**Toutes sont facultatives.** Mocky démarre sans aucune : les comptes se créent
depuis l'écran de connexion, et le fournisseur de modèle se configure dans
l'interface.

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `8787` | Port d'écoute d'Express |
| `MOCKY_PORT` | *(non défini)* | **Prend le pas sur `PORT`.** Utile en dev : un harnais qui injecte `PORT` pour configurer Vite ne doit pas pousser le backend sur le port de Vite. À laisser vide en production |
| `MOCKY_BIND` | `127.0.0.1` | **Docker uniquement** — l'interface hôte sur laquelle le port est publié |
| `MOCKY_DATA_DIR` | `server/data` | Où vit le magasin JSON. À pointer vers un volume monté ailleurs si besoin |
| `TRUST_PROXY` | *(non défini)* | `1`, un nombre de sauts, ou une valeur `trust proxy` d'Express. **Obligatoire derrière un reverse proxy** |
| `NODE_ENV` | `production` | Sert au mode de service. La sécurité du cookie n'en dépend **pas** |
| `SSO_SHARED_SECRET` | *(non défini)* | Secret HS256 partagé avec Dashy |
| `SSO_DASHY_URL` | *(non défini)* | Origine publique de l'instance Dashy |
| `MOCKY_ORIGIN` | *(auto-détectée)* | Origine publique de Mocky. **À poser explicitement dès que le SSO est actif** |

### Le chargeur `.env` maison

`server/index.js` lit `<repo>/.env` au démarrage, sans dépendance :

```js
const m = /^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line.trim())
if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
```

Il **n'écrase pas** une valeur déjà présente dans l'environnement. Une variable
posée par Docker, Coolify ou le shell gagne donc toujours sur `.env`.

### `TRUST_PROXY`, expliqué

Sans lui, derrière Nginx ou Caddy, **chaque requête paraît venir de
`127.0.0.1`** : la limitation de débit sur les routes d'authentification s'effondre
en un seau unique partagé par toute l'instance. Neuf échecs de connexion en une
minute — d'un seul utilisateur maladroit — et **plus personne ne peut se
connecter**.

```js
if (process.env.TRUST_PROXY) {
  const v = process.env.TRUST_PROXY
  app.set('trust proxy', /^\d+$/.test(v) ? Number(v) : v === 'true' || v === '1' ? 1 : v)
}
```

Il est **désactivé par défaut** parce que le défaut supposé est l'exposition
directe : faire confiance à `X-Forwarded-For` sans proxy devant permettrait à
n'importe qui de forger son IP et de contourner la limitation.

### Exposer l'instance

Le port est publié sur `127.0.0.1` par défaut. Plusieurs routes dépensent vos
crédits modèle : c'est le défaut sûr.

Pour exposer délibérément, `MOCKY_BIND=0.0.0.0` dans `.env` — et lisez d'abord la
section reverse proxy. La combinaison recommandée est l'inverse : garder
`127.0.0.1` et laisser le proxy joindre Mocky par la boucle locale.

---

## Santé

```bash
curl -s localhost:8787/api/health
```

```json
{ "ok": true, "checks": { "dataWritable": true, "frontendBuilt": true } }
```

Deux vérifications, choisies parce que ce sont **les deux choses qui cassent
réellement une instance en fonctionnement** :

- `dataWritable` — le répertoire de données est-il inscriptible ? Comptes, sessions
  et projets y vivent.
- `frontendBuilt` — `dist/` existe-t-il ? C'est-à-dire : a-t-on lancé `npm start`
  sans `npm run build` ?

En cas d'échec : `503`, plus un champ `detail` qui **nomme** le problème, pour
qu'un opérateur lisant la sortie de `docker inspect` sache quoi corriger.

> La sonde interrogeait auparavant `/api/config`, qui répond `200` depuis la
> mémoire dans les deux cas. Une instance inutilisable se déclarait donc
> parfaitement saine.

Mocky refuse aussi de **démarrer** si son répertoire de données n'est pas
inscriptible, avec un message qui explique quoi réparer, plutôt que d'échouer plus
tard sur la première écriture.

---

## Reverse proxy et HTTPS

Derrière Nginx, Caddy ou Traefik :

1. **Poser `TRUST_PROXY=1`.**
2. **Poser `MOCKY_ORIGIN`** sur votre URL HTTPS publique — obligatoire si le SSO
   est actif.
3. **Garder `MOCKY_BIND=127.0.0.1`** et laisser le proxy joindre Mocky par la
   boucle locale.
4. **Terminer TLS au proxy.** Express ne le gère pas.

Caddy :

```
mocky.example.com {
    reverse_proxy localhost:8787
}
```

Nginx :

```nginx
server {
    listen 443 ssl;
    server_name mocky.example.com;

    location / {
        proxy_pass http://localhost:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Le cookie de session

```js
secure: Boolean(req?.secure)
```

Dérivé de la **connexion réelle**, pas de `NODE_ENV`. Une instance de production
jointe en HTTP simple sur un réseau local poserait autrement un cookie `Secure` que
le navigateur refuserait ensuite d'envoyer — et la connexion échouerait sans un
mot d'explication. C'est aussi une raison de plus de poser `TRUST_PROXY` : sans
lui, `req.secure` est faux derrière un proxy qui termine le TLS.

Le cookie est `httpOnly`, `sameSite: 'lax'`, avec un `maxAge` de 90 jours. Le
`maxAge` n'est qu'une indication pour le navigateur : l'expiration réelle est
appliquée côté serveur, et les sessions périmées sont purgées au démarrage.

### En-têtes de sécurité

```js
res.setHeader('X-Content-Type-Options', 'nosniff')
res.setHeader('X-Frame-Options', 'SAMEORIGIN')
res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
```

Pas de CSP sur l'application elle-même : les aperçus en bac à sable ont besoin de
scripts en ligne. La CSP stricte est **dans le `srcDoc`** de chaque aperçu, là où
tourne le code généré — voir
[Architecture — vue d'ensemble](architecture/overview.md).

`x-powered-by` est explicitement désactivé : annoncer le framework et sa version
offre gratuitement une liste d'exploits ciblés.

---

## Sauvegarde et restauration

```bash
docker compose cp mocky:/app/server/data ./server/data
npm run backup                 # → backups/mocky-YYYY-MM-DD-HHmm.zip
```

Restauration :

```bash
# arrêter Mocky, décompresser l'archive par-dessus server/data, puis :
docker compose cp ./server/data mocky:/app/server/data
docker compose restart
```

`scripts/backup.mjs` est du Node pur et réutilise l'écrivain ZIP sans dépendance du
dépôt : il se comporte identiquement sous Windows, macOS et Linux. La recette
précédente — `docker run -v $(pwd):/backup alpine tar …` — **ne fonctionne pas**
sous Windows : `$(pwd)` n'est pas de la syntaxe `cmd.exe`, et sous PowerShell il
s'étend en un chemin pouvant contenir des espaces, ce qui casse l'argument `-v`.

**L'archive contient des empreintes de mots de passe et des jetons de session.**
`backups/` est ignoré par git ; qu'il le reste.

Ce qui vit dans le volume `mocky-data` :

| Chemin | Contenu | Poids |
|---|---|---|
| `users.json`, `sessions.json`, `config.json`, `sso-jti.json` | comptes et sessions | minuscule |
| `data-<uuid>.json` | projets + `DESIGN.md` d'un utilisateur | petit |
| `text-config.json`, `images-config.json` | fournisseurs configurés — **secrets** | minuscule |
| `muse-cache.json` | distillations, TTL 7 jours, texte | petit |
| `image-library.json` + `image-library/` | la bibliothèque d'images | moyen |
| `video-library/` | séquences : un clip + jusqu'à 150 images chacune | **de loin le plus lourd** |

---

## SSO — « Sign in with Dashy »

Mocky peut déléguer l'authentification à une instance
[Dashy](https://github.com/PetitOursManu/Dashy). C'est un flux de redirection de
type OIDC ; **le secret partagé ne touche jamais le navigateur** (le JWT est
vérifié côté serveur). Il est **désactivé tant que `SSO_SHARED_SECRET` et
`SSO_DASHY_URL` ne sont pas tous deux définis**, et il n'interfère jamais avec la
connexion par mot de passe.

### Activer

Générer un secret sans `openssl` (absent du `PATH` Windows standard) :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Côté **Mocky** :

```bash
SSO_SHARED_SECRET=<la valeur générée>
SSO_DASHY_URL=https://dashy.example.com
MOCKY_ORIGIN=https://mocky.example.com        # production
# MOCKY_ORIGIN=http://localhost:5173          # dev — l'origine du SPA Vite, PAS :8787
```

Côté **Dashy** : le même `SSO_SHARED_SECRET`, et le rappel de Mocky dans la liste
blanche :

```bash
SSO_ALLOWED_REDIRECTS=https://mocky.example.com/sso/dashy/callback,http://localhost:5173/sso/dashy/callback
```

Le serveur annonce l'état au démarrage, donc une faute de frappe dans un nom de
variable se voit immédiatement :

```
Mocky backend on http://localhost:8787
SSO: disabled (set SSO_SHARED_SECRET and SSO_DASHY_URL in .env to enable)
```

### Le flux

1. L'écran de connexion affiche **Sign in with Dashy**, uniquement quand le SSO est
   actif.
2. Un `state` opaque est stocké en `sessionStorage`, puis redirection vers
   `${SSO_DASHY_URL}/api/sso/authorize?redirect_uri=<callback>&state=<state>`.
3. Dashy authentifie l'utilisateur — **2FA comprise** — signe un JWT HS256 de
   **60 secondes** et redirige vers
   `${MOCKY_ORIGIN}/sso/dashy/callback?token=<jwt>&state=<state>`.
4. Le backend vérifie la signature, `iss === "dashy"`, `aud === MOCKY_ORIGIN`,
   `exp`, et que le `jti` n'a jamais servi ; puis il **trouve-ou-crée** le compte
   lié à l'identité Dashy (par `sub`), pose le cookie et redirige vers
   `/?sso=ok&state=…`.
5. Le SPA vérifie que le `state` correspond, restaure la session et réconcilie les
   projets — comme une connexion ordinaire.

### Ce que la vérification contrôle vraiment

- L'en-tête doit déclarer `alg: HS256` — défense en profondeur contre la
  substitution d'algorithme.
- La signature est comparée en **temps constant** (`crypto.timingSafeEqual`), après
  contrôle de longueur.
- `iss`, `aud` et `exp` sont vérifiés séparément, avec des messages distincts.
- Le `jti` est consommé une seule fois : `sso-jti.json` conserve les identifiants
  utilisés et purge tout ce qui dépasse 10 minutes (le jeton vit 60 s, plus une
  marge).
- Un échec **ne rend pas une page blanche** : l'utilisateur est renvoyé vers
  l'application avec `?sso=error&reason=…`.

### Le contrat de jeton

Claims : `sub` (identifiant Dashy stable), `email`, `name?`, `role`,
`iss="dashy"`, `aud=<origine Mocky>`, `iat`, `exp`, `jti`. Le jeton **prouve une
identité, rien de plus** : il ne donne aucun accès à l'API de Dashy.

Les comptes créés par SSO n'ont **pas de mot de passe** et ne peuvent se connecter
que par Dashy. Un `admin` Dashy devient un `admin` Mocky. Les comptes Mocky
existants ne sont **jamais** liés automatiquement : le lien se fait uniquement par
`dashySub`, que seuls les comptes créés par SSO portent.

Un utilisateur SSO qui a aussi défini un mot de passe Mocky garde le nom
d'utilisateur qu'il a choisi ; seuls les comptes purement SSO suivent le nom
d'affichage de Dashy.

---

## Coolify

> **TODO: verify.** Le dépôt ne contient **aucun fichier de configuration
> Coolify** — pas de `nixpacks.toml`, pas de manifeste, aucune référence à Coolify
> dans le code ni dans la CI. Les ressources Coolify de ce projet ont été créées
> et configurées à la main, hors dépôt. Ce qui suit est donc la traduction du
> `Dockerfile` et du `docker-compose.yml` **réellement présents** vers ce que
> Coolify demande — à confirmer contre la configuration en place avant de s'y fier.

### Ressource 1 — l'application Mocky

| Réglage Coolify | Valeur | Pourquoi |
|---|---|---|
| Type de build | **Dockerfile** | L'image est déjà multi-étages et complète. Ne pas laisser Nixpacks deviner : il manquerait `ffmpeg` et Chromium |
| Dockerfile | `./Dockerfile` | |
| Port exposé | `8787` | `EXPOSE 8787`, et `PORT` vaut `8787` par défaut |
| Health check | `GET /api/health` | Répond `503` avec un `detail` quand quelque chose manque |
| Volume persistant | → `/app/server/data` | Comptes, projets, bibliothèques. **Sans lui, tout disparaît à chaque redéploiement** |
| Domaine | votre domaine HTTPS | Le proxy de Coolify termine le TLS |

Variables à poser dans Coolify :

```bash
TRUST_PROXY=1                              # le proxy de Coolify est devant
MOCKY_ORIGIN=https://mocky.example.com     # obligatoire dès que le SSO est actif
# SSO_SHARED_SECRET=…
# SSO_DASHY_URL=https://dashy.example.com
```

`MOCKY_BIND` **ne sert à rien ici** : c'est une variable de `docker-compose.yml`
qui décide de l'interface hôte de publication du port. Coolify gère la publication
lui-même.

Quatre points d'attention propres à cette image :

- **La taille.** Environ 300 Mo de Chromium plus environ 120 Mo de ffmpeg s'ajoutent
  à `node:20-slim`. Prévoyez le disque de build, et un premier build lent.
- **Le premier build peut échouer partiellement sans échouer.** Les deux couches
  sont volontairement « au mieux ». Si le réseau de build a flanché, l'image
  démarre quand même : la vidéo se déclare indisponible et Muse retombe sur ses
  patterns hors ligne. Vérifiez `GET /api/mcp/status` et
  `GET /api/videos/availability` après un déploiement.
- **Le conteneur tourne en `node`, pas en root.** Un volume monté doit être
  inscriptible par cet utilisateur, sinon Mocky refuse de démarrer — avec un
  message qui le dit.
- **L'arrêt gracieux compte.** `SIGTERM` déclenche la fermeture des serveurs MCP
  avant celle du serveur HTTP, avec un filet de 3 s. Laissez à Coolify un délai
  d'arrêt d'au moins ces 3 secondes, sinon des processus enfants peuvent survivre.

### Ressource 2 — la documentation

Voir la section suivante. C'est une ressource **statique**, entièrement séparée :
pas de build, pas de Node, pas de volume.

---

## La documentation

Deux dossiers, deux ressources, délibérément découplés.

```
docs/          le contenu — des fichiers Markdown, rien d'autre
docs-site/     le lecteur — quatre fichiers statiques
```

### Comment ça marche

`docs-site/index.html` charge Docsify depuis `./vendor/` et pose :

```js
basePath: 'https://raw.githubusercontent.com/PetitOursManu/Mocky/main/docs/'
```

Le lecteur va donc chercher le Markdown **directement sur GitHub, à chaque
affichage de page**. Conséquences :

- **Aucune étape de build, jamais.** Publier de la documentation, c'est pousser un
  `.md` sur `main`. Le site le sert à la requête suivante.
- **Le site n'a pas besoin d'être redéployé** quand le contenu change. Il ne bouge
  que pour une montée de version de Docsify.
- Le contenu doit rester **public** : `raw.githubusercontent.com` sur un dépôt privé
  demanderait un jeton, que l'on ne peut pas mettre dans une page statique.

### Déployer `docs-site/`

N'importe quel hébergement statique convient. Sur Coolify : une ressource
**statique**, répertoire de publication `docs-site/`, aucune commande de build,
aucun volume.

Les quatre fichiers :

```
docs-site/
  index.html
  vendor/
    docsify.min.js          docsify 4.13.1 — lib/docsify.min.js
    docsify-theme.css       docsify 4.13.1 — lib/themes/vue.css (patché)
    docsify-search.min.js   docsify 4.13.1 — lib/plugins/search.min.js
```

### Pourquoi Docsify est vendorisé

La même règle que `public/vendor/` côté application, pour la même raison. Le thème
amont commence par :

```css
@import url("https://fonts.googleapis.com/css?family=Roboto+Mono|Source+Sans+Pro:300,400,600");
```

C'est une requête à un CDN tiers à chaque chargement de page — exactement la
dépendance que la copie locale existe pour supprimer. La ligne a été retirée, et le
retrait est documenté en tête du fichier. Les deux familles déclarent déjà des
polices de repli locales dans les règles qui suivent, donc rien d'autre ne change.

**À réappliquer après toute montée de version de Docsify.**

### Ajouter une page

1. Créer le `.md` sous `docs/`.
2. L'ajouter à `docs/_sidebar.md`.
3. Pousser.

Deux règles pour que les liens fonctionnent :

- **Toujours écrire les chemins depuis la racine de `docs/`**, jamais relativement
  à la page courante. Depuis `architecture/overview.md`, on écrit
  `architecture/invariants.md`, pas `invariants.md` — Docsify résout tout depuis
  `basePath`.
- `docs/README.md` est la page d'accueil **obligatoire** de Docsify. Sans elle, le
  site affiche une erreur de chargement silencieuse au premier affichage.
