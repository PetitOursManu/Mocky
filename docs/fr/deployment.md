---
source_hash: 326acaf0b876
---

# Déploiement

## L'image Docker

`Dockerfile` est une construction **en plusieurs étages**, sur `node:22-slim`.

### Étage 1 — la construction

```dockerfile
FROM node:22-slim AS builder
COPY package.json package-lock.json .puppeteerrc.cjs ./
RUN npm ci                 # toutes les dépendances, y compris de développement
COPY . .
RUN npm run build          # tsc && vite build → dist/
```

### Étage 2 — l'exécution

```dockerfile
FROM node:22-slim AS runtime
COPY package.json package-lock.json .puppeteerrc.cjs ./
RUN npm ci --omit=dev --omit=optional && npm cache clean --force
```

`--omit=optional` a sa place **ici et nulle part ailleurs** : cet étage installe
les dépendances d'exécution et ne construit rien, donc il ne veut ni Puppeteer —
dépendance facultative d'`impeccable`, dont Mocky n'appelle jamais le moteur par
URL — ni le moindre binaire natif propre à une plateforme, alors que le même
drapeau posé dans un `.npmrc` s'appliquerait aussi à l'étage de construction, où
il retire `@rolldown/binding-*` et casse `npm run build`.

Puis trois couches qui demandent chacune une explication.

**`ffmpeg`, environ 120 Mo, au mieux.** Il découpe un clip généré en séquence
JPEG (`server/videos/frames.js`).

L'installation est enveloppée dans un `|| echo …` pour qu'une machine de
construction sans `apt` ne fasse pas échouer toute l'image. Sans ffmpeg, la vidéo
au défilement **se déclare indisponible**, le dit dans le panneau Muse, et rien
d'autre ne change.

**Chromium et `fetcher-mcp`, environ 300 Mo, également au mieux.**

```dockerfile
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV FETCHER_MCP_VERSION=0.2.1
ENV PLAYWRIGHT_VERSION=1.49.1
RUN (npm install -g "fetcher-mcp@${FETCHER_MCP_VERSION}" \
     && npx --yes "playwright@${PLAYWRIGHT_VERSION}" install --with-deps chromium \
     && chmod -R a+rX /ms-playwright) \
    || (echo "…" && touch /app/.no-chromium)
```

Trois décisions y sont inscrites :

- **Les versions sont fixées.** `npx --yes playwright install` prenait ce qui
  avait été publié ce jour-là, donc deux constructions du même commit pouvaient
  livrer des navigateurs différents.
- **`PLAYWRIGHT_BROWSERS_PATH` est posé avant l'installation, et en dehors de
  `/root`.** Le conteneur ne tourne plus en root (voir `USER` plus bas), donc un
  navigateur laissé dans `/root/.cache` serait illisible à l'exécution.
- **L'échec laisse une trace.** `/app/.no-chromium` est un marqueur que le
  serveur peut signaler, au lieu d'une ligne de journal que personne ne lit.

La dégradation à l'exécution reste en place dans tous les cas (M3 et M5). Sans
Chromium, Muse retombe sur `fetch` plus Readability, puis sur la bibliothèque de
patterns hors ligne. Embarquer le navigateur supprime l'installation au premier
lancement, pas le repli.

**Les copies depuis l'étage de construction.**

```dockerfile
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public
COPY --from=builder /app/mocky.mcp.json ./mocky.mcp.json
```

Cette dernière ligne n'est pas décorative. `server/muse/mcp/config.js` résout ce
fichier par rapport à `ROOT_DIR`, qui vaut `/app`.

Sans elle, l'hôte MCP démarre **zéro** serveur et l'inspiration en direct retombe
en silence sur le dossier hors ligne — alors que la couche Chromium a déjà été
payée à la construction. C'est arrivé, et l'intégration continue le vérifie
maintenant :

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

Le `chown` a lieu **avant** `USER node`, pour que l'utilisateur non privilégié
puisse écrire dans le répertoire de données — et pour que les fichiers d'un
volume monté n'appartiennent pas à root, ce qui rendait les sauvegardes et le
Docker sans root pénibles.

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
| `docker compose up -d --build` | Construire et démarrer en arrière-plan |
| `docker compose logs -f` | Suivre les journaux |
| `docker compose ps` | L'état, y compris la sonde de santé |
| `docker compose down` | Arrêter et supprimer le conteneur. **Les données sont conservées** |
| `docker compose down -v` | Arrêter et **supprimer toutes les données** (le volume est retiré) |

`env_file` avec `required: false` est ce qui rend `.env` **facultatif**. Sans
cette section, rien de ce que contient `.env` n'atteindrait le conteneur.

> `docker-compose.override.yml` est ignoré par git, volontairement. Compose le
> charge par-dessus le fichier principal, donc un fichier versionné suivrait en
> silence le dépôt jusqu'à un vrai déploiement. Celui utilisé en local fixe
> `MOCKY_ORIGIN` à `http://localhost:8787`, ce qui est juste sur un portable et
> faux partout ailleurs.


### Le worker de rendu de Motion Ultra, sur un serveur

`docker-compose.yml` garde le worker derrière `profiles: ["video-export"]`, qui
est un drapeau de ligne de commande — et une plateforme qui déploie un fichier
compose depuis un dépôt n'a souvent aucune ligne de commande où le mettre. Il y
a donc un second fichier, `docker-compose.motion.yml` : le fichier livré avec
cette seule ligne de profil retirée, généré par `npm run compose:motion` et tenu
à sa source par un test. Le choisir est le même acte délibéré que taper le
drapeau, et la question de licence à laquelle il répond est la même.

Il est entier plutôt qu'un `include:` de son voisin, et c'est une cicatrice et
non un goût : Coolify — comme Dokploy et Portainer — ne donne pas le fichier à
Compose, il le lit, le réécrit avec ses propres étiquettes et réseaux, puis
déploie le résultat. Une clé `include:` ne veut rien dire pour cet analyseur :
la première version de ce fichier est arrivée sur le serveur comme un service
sans image ni build, et le déploiement a échoué sur `no service selected`. Ce
qui modifie `docker-compose.yml` doit être suivi de `npm run compose:motion` ;
`npm test` échoue tant que les deux ne concordent pas.

| Déploiement | Ce qu’il faut faire |
|---|---|
| `docker compose` sur la machine | `docker compose --profile video-export up -d --build` une fois, ou `COMPOSE_PROFILES=video-export` dans le `.env` à côté du fichier compose, puis `docker compose up -d --build` comme d’habitude |
| Une plateforme qui déploie un FICHIER compose (Coolify, Dokploy, Portainer) | Pointez la ressource sur `docker-compose.motion.yml` au lieu de `docker-compose.yml`, et redéployez. Certaines lisent aussi `COMPOSE_PROFILES` dans les variables d’environnement de la ressource, ce qui marche également — le fichier, lui, marche partout |
| Une plateforme qui construit un **Dockerfile** | Aucun fichier compose n’entre en jeu : le worker est alors une seconde ressource, construite depuis `worker/video/` |

Trois choses à vérifier après le premier déploiement, dans cet ordre :

1. **Le conteneur est là.** `docker ps` montre `mocky-video-worker`, et sa sonde
   de santé passe au vert en une minute et demie environ — il compile le bundle
   de rendu après s’être mis à écouter, ce à quoi sert `start_period`.
2. **Mocky le joint.** Administration → Motion Ultra l’affiche comme disponible.
   L’adresse est `http://video-worker:3030` — le nom du service sur le pont
   interne, pas une URL publique, et il n’en a jamais besoin.
3. **La machine le porte.** Le worker demande 4 Go de mémoire et 2 cœurs pendant
   un rendu, en plus de Mocky. Lancez le test du serveur dans Administration →
   Motion Ultra : il rend trois films de référence et dit ce que coûte réellement
   chaque niveau de rendu sur cette machine, puis en recommande un.

Le worker ne publie aucun port et son pont n’a aucune route vers l’extérieur :
rien là-dedans n’expose quoi que ce soit de nouveau. Une clé de licence Remotion
est la seule exception, et le fichier compose dit où la décommenter.

### La carte graphique dans Docker

Administration → Système affiche la carte graphique de la machine quand il y en a
une (voir [Le tableau de bord d’administration](admin-dashboard.md#la-carte-graphique)).
Mocky n’en a pas besoin ; la carte est affichée pour ce qui tourne d’autre sur la
machine. Hors de Docker, rien à faire. Dans un conteneur :

- **AMD, Intel** — le conteneur voit le `/sys/class/drm` de l’hôte : l’utilisation
  d’une carte AMD se lit sans rien configurer ; un iGPU Intel apparaît présent mais
  non mesurable.
- **NVIDIA** — le conteneur ne voit pas `nvidia-smi` tant que l’hôte n’a pas le
  [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
  et que le service ne demande pas la carte. `docker-compose.gpu.yml` est cette
  demande, par-dessus le fichier habituel :

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

C’est un fichier à part plutôt qu’une ligne de `docker-compose.yml`, parce qu’une
réservation de GPU fait REFUSER à Compose de démarrer le service sur un hôte sans
le toolkit — le fichier par défaut doit démarrer partout. Il ne demande que la
capacité `utility` : de quoi faire tourner `nvidia-smi`, rien qui permette au
conteneur de calculer sur la carte.

---

## Les variables d'environnement

**Toutes sont facultatives.** Mocky démarre sans aucune : les comptes se créent
depuis l'écran de connexion, et le fournisseur de modèle se configure dans
l'interface.

| Variable | Défaut | À quoi elle sert |
|---|---|---|
| `PORT` | `8787` | Le port sur lequel Express écoute |
| `MOCKY_PORT` | *(non définie)* | **Prend le pas sur `PORT`.** Utile en développement : un outil qui injecte `PORT` pour configurer Vite ne doit pas pousser le back-end sur le port de Vite. À laisser vide en production |
| `MOCKY_HOST` | `127.0.0.1` | **Installation depuis les sources** — l'interface sur laquelle le serveur lui-même écoute. La boucle locale par défaut, parce qu'`app.listen(PORT)` sans hôte écoute sur toutes les interfaces, ce qui posait sur le réseau local une instance aux inscriptions ouvertes, offerte au premier venu. L'image pose `0.0.0.0` ; n'y touchez pas, un conteneur qui écoute sur la boucle locale est injoignable par son port publié |
| `MOCKY_BIND` | `127.0.0.1` | **Docker uniquement** — l'interface de l'hôte sur laquelle le port est publié |
| `MOCKY_DATA_DIR` | `server/data` | Où vit le magasin JSON. À pointer vers un volume monté si besoin |
| `MOCKY_MAX_STORAGE_MB` | `10240` | Le plafond de tout ce qui vit sous le répertoire de données. `0` veut dire « sans limite », pour qui préfère surveiller son disque lui-même — le renoncement doit être explicite, parce que « sans limite par défaut » est précisément d'où venait le problème. C'est le nombre qu'affiche **Admin → Utilisation** dans son bandeau, sous la forme « Total de l'instance … / sans plafond » |
| `TRUST_PROXY` | *(non définie)* | `1`, un nombre de sauts, ou une valeur `trust proxy` d'Express. **Obligatoire derrière un reverse proxy** |
| `NODE_ENV` | `production` | Influence le mode de service. La sécurité du cookie n'en dépend **pas** |
| `SSO_SHARED_SECRET` | *(non définie)* | Le secret HS256 partagé avec Dashy |
| `SSO_DASHY_URL` | *(non définie)* | L'origine publique de votre instance Dashy |
| `MOCKY_ORIGIN` | *(détectée)* | L'origine publique de Mocky. **À définir explicitement dès que le SSO est activé**, et en `https://` pour les [assistants (MCP)](mcp.md) |
| `MOCKY_MCP_INSECURE_LOOPBACK` | *(non définie)* | `1` accepte une origine `http://localhost` pour le serveur MCP — développement et tests uniquement ([MCP](mcp.md)) |

### Le lecteur de `.env` intégré

`server/index.js` lit `<dépôt>/.env` au démarrage, sans aucune dépendance :

```js
const m = /^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line.trim())
if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
```

Il **n'écrase pas** une valeur déjà présente dans l'environnement. Une variable
définie par Docker, Coolify ou le shell l'emporte donc toujours sur `.env`.

### Pourquoi `TRUST_PROXY` compte

Sans elle, derrière Nginx ou Caddy, **toutes les requêtes semblent venir de
`127.0.0.1`**. La limite de débit sur les routes d'authentification devient alors
un compteur unique, partagé par toute l'instance.

Neuf échecs de connexion en une minute — venus d'un seul utilisateur maladroit —
et **plus personne ne peut se connecter**.

```js
if (process.env.TRUST_PROXY) {
  const v = process.env.TRUST_PROXY
  app.set('trust proxy', /^\d+$/.test(v) ? Number(v) : v === 'true' || v === '1' ? 1 : v)
}
```

Elle est **désactivée par défaut**, parce que le cas supposé par défaut est
l'exposition directe. Faire confiance à `X-Forwarded-For` sans proxy devant
permettrait à n'importe qui de falsifier son adresse IP et de contourner la
limite.

### Exposer l'instance

Le port n'est publié que sur `127.0.0.1` par défaut. Plusieurs routes dépensent
vos crédits de modèle : c'est le choix prudent.

Pour l'exposer volontairement, mettez `MOCKY_BIND=0.0.0.0` dans `.env` — et lisez
d'abord la section sur le reverse proxy. Le montage recommandé est l'inverse :
garder `127.0.0.1` et laisser le proxy joindre Mocky par la boucle locale.

---

## La santé

```bash
curl -s localhost:8787/api/health
```

```json
{ "ok": true, "checks": { "dataWritable": true, "frontendBuilt": true } }
```

Deux vérifications, choisies parce que ce sont **les deux choses qui cassent
réellement une instance en fonctionnement** :

- `dataWritable` — le répertoire de données est-il inscriptible ? Les comptes,
  les sessions et les projets y vivent.
- `frontendBuilt` — `dist/` existe-t-il ? Autrement dit, a-t-on lancé
  `npm start` sans `npm run build` ?

En cas d'échec, la réponse est `503`, avec un champ `detail` qui **nomme** le
problème, pour qu'un opérateur lisant la sortie de `docker inspect` sache quoi
corriger.

> La sonde interrogeait auparavant `/api/config`, qui répond `200` depuis la
> mémoire dans les deux cas. Une instance inutilisable se déclarait donc en
> parfaite santé.

Mocky refuse aussi de **démarrer** si son répertoire de données n'est pas
inscriptible, avec un message qui explique quoi corriger, plutôt que d'échouer
plus tard à la première écriture.

---

## Reverse proxy et HTTPS

:::vars
domain = mocky.example.com | Votre domaine
dashy = dashy.example.com | Le domaine de Dashy (SSO seulement)
:::

Derrière Nginx, Caddy ou Traefik :

1. **Définissez `TRUST_PROXY=1`.**
2. **Définissez `MOCKY_ORIGIN`** avec votre URL HTTPS publique. Obligatoire si le
   SSO est activé.
3. **Gardez `MOCKY_BIND=127.0.0.1`** et laissez le proxy joindre Mocky par la
   boucle locale.
4. **Terminez le TLS au niveau du proxy.** Express ne le gère pas.

Caddy :

```
{{domain}} {
    reverse_proxy localhost:8787
}
```

Nginx :

```nginx
server {
    listen 443 ssl;
    server_name {{domain}};

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

Dérivé de la **connexion réelle**, pas de `NODE_ENV`.

Une instance de production jointe en HTTP simple sur un réseau local poserait
sinon un cookie `Secure` que le navigateur refuserait ensuite d'envoyer, et la
connexion échouerait sans un mot d'explication. C'est une raison de plus de
définir `TRUST_PROXY` : sans elle, `req.secure` est faux derrière un proxy qui
termine le TLS.

Le cookie est `httpOnly`, `sameSite: 'lax'`, avec un `maxAge` de 90 jours. Ce
`maxAge` n'est qu'une indication pour le navigateur : l'expiration réelle est
appliquée côté serveur, et les sessions périmées sont purgées au démarrage.

### Les en-têtes de sécurité

```js
res.setHeader('X-Content-Type-Options', 'nosniff')
res.setHeader('X-Frame-Options', 'SAMEORIGIN')
res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
```

Il n'y a pas de politique de sécurité du contenu sur l'application elle-même :
les aperçus isolés ont besoin de scripts en ligne. La politique stricte vit
**dans le `srcDoc` de chaque aperçu**, là où le code généré s'exécute réellement.
Voir la [vue d'ensemble de l'architecture](architecture/overview.md).

`x-powered-by` est explicitement désactivé. Annoncer le framework et sa version
offre gratuitement une liste d'exploits ciblés.

---

## Sauvegarde et restauration

```bash
docker compose cp mocky:/app/server/data ./server/data
npm run backup                 # → backups/mocky-YYYY-MM-DD-HHmm.zip
```

Pour restaurer : arrêtez Mocky, décompressez l'archive par-dessus `server/data`,
puis

```bash
docker compose cp ./server/data mocky:/app/server/data
docker compose restart
```

`scripts/backup.mjs` est du Node pur et réutilise l'écrivain ZIP sans dépendance
du dépôt, donc il se comporte identiquement sous Windows, macOS et Linux.

L'ancienne recette — `docker run -v $(pwd):/backup alpine tar …` — **ne
fonctionne pas** sous Windows. `$(pwd)` n'est pas de la syntaxe `cmd.exe`, et
sous PowerShell il s'étend en un chemin pouvant contenir des espaces, ce qui
casse l'argument `-v`.

**L'archive contient des empreintes de mots de passe et des jetons de session.**
`backups/` est ignoré par git ; qu'il le reste.

Pour **déplacer** une instance vers un autre serveur plutôt que la restaurer sur
le même, passez plutôt par Admin → Maintenance et migration : la copie se fait
morceau par morceau, le nouveau serveur est vérifié d'abord, et les données ne
passent jamais par un fichier à transporter. Voir
[Maintenance et migration](migration.md).

Ce qui vit dans le volume `mocky-data` :

| Chemin | Contenu | Taille |
|---|---|---|
| `users.json`, `sessions.json`, `config.json`, `sso-jti.json` | Comptes et sessions | Minuscule |
| `data-<uuid>.json` | Les projets et le `DESIGN.md` d'un utilisateur | Petite |
| `text-config.json`, `images-config.json` | Les fournisseurs configurés — **secrets** | Minuscule |
| `muse-cache.json` | Les distillations, 7 jours, du texte | Petite |
| `image-library.json` et `image-library/` | La bibliothèque d'images | Moyenne |
| `video-library/` | Les séquences : un clip plus jusqu'à 150 images chacune | **De loin la plus grosse** |
| `video-config.json` | Les réglages de Motion Ultra — l'interrupteur maître, la liste d'accès à la 3D, le niveau de rendu et le dernier test du serveur, et **la clé de licence Remotion** | Minuscule |
| `video-exports.json` et `video-exports/` | Les films exportés, entiers. Rien ne les élague : le hash d'un job est un lien que quelqu'un peut suivre des jours plus tard, c'est donc le budget disque qui borne le répertoire | Moyenne à grosse |

**Combien de 3D le worker de rendu peut dépenser est un réglage, et le panneau
le mesure pour vous.** Sans carte graphique, Chromium sans écran dessine chaque
image WebGL sur le processeur : le coût d'un film est donc une propriété de la
machine et non de Mocky. Administration → Motion Ultra propose trois niveaux de rendu
— sans 3D, 3D limitée (le défaut), 3D complète — et un test du serveur qui rend
trois films de référence et donne, par niveau, la durée d'un film typique, le
nombre de films par heure et combien de personnes peuvent en lancer un au même
moment et tous l'avoir en moins de trois minutes. Il recommande un niveau ; vous
l'appliquez. Le test tient le créneau de rendu de la file pendant qu'il tourne,
donc le rendu d'un utilisateur attend au lieu d'être refusé.

---

## SSO — « Sign in with Dashy »

Mocky peut déléguer l'authentification à une instance
[Dashy](https://github.com/PetitOursManu/Dashy). C'est un flux de redirection du
genre OIDC, et **le secret partagé ne touche jamais le navigateur** : le JWT est
vérifié côté serveur.

Il est **désactivé tant que `SSO_SHARED_SECRET` et `SSO_DASHY_URL` ne sont pas
tous deux définis**, et il n'interfère jamais avec la connexion par mot de passe.

### L'activer

Générez un secret sans `openssl`, qui n'est pas dans le `PATH` Windows
standard :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Côté **Mocky** :

```bash
SSO_SHARED_SECRET=<la valeur que vous venez de générer>
SSO_DASHY_URL=https://{{dashy}}
MOCKY_ORIGIN=https://{{domain}}        # production
# MOCKY_ORIGIN=http://localhost:5173          # dev — l'origine du SPA Vite, PAS :8787
```

Côté **Dashy** : le même `SSO_SHARED_SECRET`, plus le rappel de Mocky dans la
liste d'autorisation :

```bash
SSO_ALLOWED_REDIRECTS=https://{{domain}}/sso/dashy/callback,http://localhost:5173/sso/dashy/callback
```

Le serveur annonce l'état au démarrage, donc une faute de frappe dans un nom de
variable se voit immédiatement :

```
Mocky backend on http://localhost:8787
SSO: disabled (set SSO_SHARED_SECRET and SSO_DASHY_URL in .env to enable)
```

### Le déroulement

1. L'écran de connexion affiche **Sign in with Dashy**, uniquement quand le SSO
   est activé.
2. Un `state` opaque est stocké dans `sessionStorage`, puis le navigateur est
   redirigé vers
   `${SSO_DASHY_URL}/api/sso/authorize?redirect_uri=<callback>&state=<state>`.
3. Dashy authentifie l'utilisateur — **2FA comprise** — signe un JWT HS256 valable
   60 secondes, et redirige vers
   `${MOCKY_ORIGIN}/sso/dashy/callback?token=<jwt>&state=<state>`.
4. Le back-end vérifie la signature, `iss === "dashy"`, `aud === MOCKY_ORIGIN`,
   `exp`, et que le `jti` n'a jamais servi. Il **trouve ou crée** ensuite le
   compte lié à l'identité Dashy par `sub`, pose le cookie, et redirige vers
   `/?sso=ok&state=…`.
5. Le SPA vérifie le `state` renvoyé, restaure la session, et réconcilie les
   projets — exactement comme une connexion ordinaire.

### Ce que la vérification contrôle réellement

- L'en-tête doit déclarer `alg: HS256` : défense en profondeur contre la
  substitution d'algorithme.
- La signature est comparée en **temps constant** avec `crypto.timingSafeEqual`,
  après un contrôle de longueur.
- `iss`, `aud` et `exp` sont vérifiés séparément, avec des messages distincts.
- Le `jti` n'est consommé qu'une fois. `sso-jti.json` conserve les identifiants
  utilisés et purge tout ce qui a plus de 10 minutes — le jeton vit 60 secondes,
  plus une marge.
- Un échec **ne produit pas une page blanche** : l'utilisateur est renvoyé vers
  l'application avec `?sso=error&reason=…`.

### Le contenu du jeton

Champs : `sub` (un identifiant Dashy stable), `email`, `name?`, `role`,
`iss="dashy"`, `aud=<origine de Mocky>`, `iat`, `exp`, `jti`.

Le jeton **prouve une identité, et rien de plus**. Il ne donne aucun accès à
l'API de Dashy.

Les comptes créés par SSO n'ont **pas de mot de passe** et ne peuvent se
connecter que par Dashy. Un `admin` Dashy devient un `admin` Mocky. Les comptes
Mocky existants ne sont **jamais** liés automatiquement : le lien se fait
uniquement par `dashySub`, que seuls les comptes créés par SSO portent.

Un utilisateur SSO qui a aussi défini un mot de passe Mocky garde le nom
d'utilisateur qu'il a choisi. Seuls les comptes uniquement SSO suivent le nom
d'affichage de Dashy.

---

## Coolify

> **TODO: verify.** Le dépôt ne contient **aucune configuration Coolify** : ni
> `nixpacks.toml`, ni manifeste, ni référence à Coolify dans le code ou dans
> l'intégration continue. Les ressources Coolify de ce projet ont été créées et
> configurées à la main, en dehors du dépôt.
>
> Ce qui suit est une traduction du `Dockerfile` et du `docker-compose.yml` qui,
> eux, **sont** présents, vers ce que Coolify demande. Vérifiez-la contre la
> configuration réelle avant de vous y fier.

### Ressource 1 — l'application Mocky

| Réglage Coolify | Valeur | Pourquoi |
|---|---|---|
| Type de construction | **Dockerfile** | L'image est déjà complète et en plusieurs étages. Ne laissez pas Nixpacks deviner : il oublierait `ffmpeg` et Chromium |
| Dockerfile | `./Dockerfile` | |
| Port exposé | `8787` | `EXPOSE 8787`, et `PORT` vaut `8787` par défaut |
| Sonde de santé | `GET /api/health` | Répond `503` avec un `detail` quand quelque chose manque |
| Volume persistant | monté sur `/app/server/data` | Comptes, projets, bibliothèques. **Sans lui, tout est perdu à chaque redéploiement** |
| Domaine | votre domaine HTTPS | Le proxy de Coolify termine le TLS |

Variables à définir dans Coolify :

```bash
TRUST_PROXY=1                              # le proxy de Coolify est devant
MOCKY_ORIGIN=https://{{domain}}     # obligatoire dès que le SSO est activé
# SSO_SHARED_SECRET=…
# SSO_DASHY_URL=https://{{dashy}}
```

`MOCKY_BIND` **ne sert pas ici**. C'est une variable de `docker-compose.yml` qui
décide de l'interface de l'hôte sur laquelle le port est publié ; Coolify s'en
charge lui-même.

Quatre points propres à cette image :

**La taille.** Environ 300 Mo de Chromium plus 120 Mo de ffmpeg s'ajoutent à
`node:22-slim`. Prévoyez le disque de construction, et une première construction
lente.

**La première construction peut échouer partiellement sans échouer.** Les deux
couches sont volontairement « au mieux ». Si le réseau a flanché pendant la
construction, l'image démarre quand même : la vidéo se déclare indisponible et
Muse retombe sur ses patterns hors ligne. Vérifiez `GET /api/mcp/status` et
`GET /api/videos/availability` après un déploiement.

**Le conteneur tourne en tant que `node`, pas root.** Un volume monté doit être
inscriptible par cet utilisateur, sinon Mocky refuse de démarrer — avec un
message qui le dit.

**L'arrêt propre compte.** `SIGTERM` déclenche la fermeture des serveurs MCP
avant celle du serveur HTTP, avec un filet de 3 secondes. Laissez à Coolify un
délai d'arrêt d'au moins ces 3 secondes, sinon des processus enfants peuvent
survivre.

### Ressource 2 — la documentation

Voir la section suivante. C'est une ressource **à part, et légère**, avec son
propre `Dockerfile` : ni Chromium, ni ffmpeg, et rien de partagé avec
l'application sinon le dépôt.

---

## La documentation

Deux dossiers, volontairement découplés.

- **`docs/`** — le contenu. Des fichiers Markdown, rien d'autre.
- **`docs-site/`** — le site autour : `lumy.config.json`, les widgets propres à
  Mocky, et le `Dockerfile` qui le sert.

Le site est construit par [Lumy](https://github.com/PetitOursManu/Lumy), un
outil de documentation écrit pour Mocky et publié à part, open source comme
Mocky. C'est la dépendance de développement `lumy-docs`, installée depuis la
version publiée sur GitHub : celle qui construit le site en production est donc
celle de `package-lock.json`.

### Comment ça marche

Lumy lit `docs/` et écrit un site statique : une page HTML par page et par
langue, un index de recherche, un `llms.txt` pour les modèles de langage, un
plan du site. Tout ce dont le site a besoin est dans la construction — pas de
CDN, pas de police tierce, aucune requête vers GitHub.

L'anglais vit à la racine de `docs/` ; le français vit sous `docs/fr/`, chemin
pour chemin. Une page française qui n'existe pas encore affiche l'anglaise, avec
un avis qui le dit, plutôt qu'une erreur.

`docs-site/lumy.config.json` contient tout ce qui n'est pas de la prose : les
deux langues, la navigation et le public de chaque groupe, les couleurs (le
turquoise du logo), les liens de l'en-tête. Les anciennes adresses de la forme
`/#/architecture/overview` mènent toujours à la bonne page (`legacyHashRoutes`),
si bien que les liens partagés avant le changement continuent de marcher.

> **Ce que le changement a modifié.** L'ancien lecteur allait chercher le
> Markdown sur GitHub à chaque affichage : un `.md` poussé apparaissait sans
> redéploiement. Le site est désormais construit, donc **le contenu arrive aux
> lecteurs quand la ressource est redéployée**. Avec le déploiement automatique à
> chaque push, qui est le réglage habituel de Coolify, cela revient au même
> quelques minutes plus tard. En échange, les pages ne dépendent plus de la
> réponse de GitHub, et elles portent la recherche, les deux langues et les blocs
> interactifs.

### Prévisualiser en local

```bash
npm run docs
```

Cela sert le site sur `http://127.0.0.1:4173` et le reconstruit à chaque
enregistrement, dans les deux langues. Avant de pousser une modification de la
documentation :

```bash
npm run docs:check
```

La commande échoue sur un lien cassé, une image qui n'existe pas, ou un bloc que
Lumy ne connaît pas. L'intégration continue la lance à chaque push. L'ancien
lecteur, lui, montrait ces erreurs aux lecteurs.

### Déployer le site

| Réglage Coolify | Valeur | Pourquoi |
|---|---|---|
| Type de build | **Dockerfile** | |
| Dockerfile | `./docs-site/Dockerfile`, contexte de build à la racine du dépôt | Il a besoin de `docs/` et de `docs-site/` |
| Port exposé | `4000` | |
| Sonde de santé | `GET /_lumy/api/health` | |
| Volume persistant | monté sur `/data` | Le compte du tableau de bord et les retours des lecteurs. Les pages elles-mêmes sont reconstruites à chaque démarrage |
| Domaine | `mocky-docs.emanuelvigreux.fr` | Le proxy de Coolify termine le TLS |

Variables à définir dans Coolify :

```bash
LUMY_TRUST_PROXY=1               # le proxy de Coolify est devant
LUMY_ADMIN_USER=…                # crée le compte du tableau de bord au premier démarrage
LUMY_ADMIN_PASSWORD=…
# LUMY_SECRET=…                  # facultatif : chiffre les clés d'API du tableau de
                                 # bord ; sans elle, une clé est créée dans /data
```

**Définissez les deux variables `LUMY_ADMIN_*` avant le premier déploiement.**
Comme dans Mocky, le premier compte créé devient l'administrateur ; sur un
domaine public, la première personne à ouvrir `/_lumy/setup` l'obtiendrait
sinon.

Lire ne demande aucun compte : le site est public et les inscriptions restent
fermées. Le compte ouvre seulement le tableau de bord, sur `/_lumy/admin`, où
arrivent les réponses à « Cette page vous a-t-elle aidé ? », chacune avec sa
page et, quand le lecteur l'a écrit, ce qui manquait. C'est aussi là que
l'assistant de lecture de Lumy pourra être activé plus tard, avec un Ollama
local ou un modèle hébergé.

Un hébergeur statique ordinaire convient aussi : `npm run docs:build` écrit le
site dans `docs-site/dist/`. Passez d'abord `"feedback": false` dans
`lumy.config.json`, puisqu'un hébergeur statique n'a nulle part où envoyer les
réponses.

### Les traductions

Chaque page française commence par un `source_hash` : l'empreinte de la page
anglaise qu'elle traduit. Quand la page anglaise change, l'empreinte ne
correspond plus, la page française prévient ses lecteurs qu'elle peut être en
retard, et `npm run docs:check` la signale.

Après avoir mis une traduction à jour, enregistrez-le :

```bash
npx lumy translations --root docs-site --stamp fr/deployment
```

`--stamp fr` enregistre toutes les pages françaises d'un coup — seulement après
les avoir toutes vérifiées. Le journal des modifications fait exception :
`scripts/build-changelog.mjs` écrit les deux langues à partir du même
historique, sa page française porte donc `generated: true` et n'est jamais
comptée comme en retard.

`tests/docs-parity.test.js` tient les deux arborescences au pas : les mêmes
pages, les mêmes titres aux mêmes niveaux, et un bloc `:::why` argumenté sous
chaque titre des trois documents qui expliquent leurs décisions.

### Les blocs propres à Mocky

Deux pages montrent les vraies données plutôt qu'une copie : `:::widget presets`
dessine la galerie des presets et `:::widget rules` les règles de qualité.
`docs-site/widgets.js` les déclare tous deux auprès de Lumy et lit
`docs-site/data/*.json`, que `scripts/build-docs-data.mjs` génère à partir des
sources de l'application. `npm run check:docs-data` échoue quand les deux
divergent.

Le texte à l'intérieur de chaque bloc sert de repli : c'est ce que la recherche
indexe, et ce que voit un lecteur sans JavaScript.

### Ajouter une page

1. Créez le fichier `.md` sous `docs/`, et sa traduction sous `docs/fr/` au même
   chemin.
2. Ajoutez son chemin, sans `.md`, à `nav` dans `docs-site/lumy.config.json`.
   Donnez-lui une `audience` si elle ne s'adresse qu'à un type de lecteur.
3. Lancez `npm run docs:check`, puis poussez.

Les liens sont des liens Markdown ordinaires, **relatifs au fichier courant**,
comme GitHub les lit : depuis `architecture/overview.md`, écrivez
`invariants.md` pour sa voisine et `../deployment.md` pour cette page. Un lien
qui sort de `docs/` — vers `src/` ou `server/` — ouvre le fichier sur GitHub.

`docs/README.md` est la page d'accueil, et `docs/fr/README.md` l'accueil
français.
