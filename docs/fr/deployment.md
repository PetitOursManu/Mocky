# Déploiement

## L'image Docker

`Dockerfile` est une construction **en plusieurs étages**, sur `node:22-slim`.

### Étage 1 — la construction

```dockerfile
FROM node:22-slim AS builder
COPY package.json package-lock.json ./
RUN npm ci                 # toutes les dépendances, y compris de développement
COPY . .
RUN npm run build          # tsc && vite build → dist/
```

### Étage 2 — l'exécution

```dockerfile
FROM node:22-slim AS runtime
RUN npm ci --omit=dev && npm cache clean --force
```

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

---

## Les variables d'environnement

**Toutes sont facultatives.** Mocky démarre sans aucune : les comptes se créent
depuis l'écran de connexion, et le fournisseur de modèle se configure dans
l'interface.

| Variable | Défaut | À quoi elle sert |
|---|---|---|
| `PORT` | `8787` | Le port sur lequel Express écoute |
| `MOCKY_PORT` | *(non définie)* | **Prend le pas sur `PORT`.** Utile en développement : un outil qui injecte `PORT` pour configurer Vite ne doit pas pousser le back-end sur le port de Vite. À laisser vide en production |
| `MOCKY_BIND` | `127.0.0.1` | **Docker uniquement** — l'interface de l'hôte sur laquelle le port est publié |
| `MOCKY_DATA_DIR` | `server/data` | Où vit le magasin JSON. À pointer vers un volume monté si besoin |
| `TRUST_PROXY` | *(non définie)* | `1`, un nombre de sauts, ou une valeur `trust proxy` d'Express. **Obligatoire derrière un reverse proxy** |
| `NODE_ENV` | `production` | Influence le mode de service. La sécurité du cookie n'en dépend **pas** |
| `SSO_SHARED_SECRET` | *(non définie)* | Le secret HS256 partagé avec Dashy |
| `SSO_DASHY_URL` | *(non définie)* | L'origine publique de votre instance Dashy |
| `MOCKY_ORIGIN` | *(détectée)* | L'origine publique de Mocky. **À définir explicitement dès que le SSO est activé** |

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

Derrière Nginx, Caddy ou Traefik :

1. **Définissez `TRUST_PROXY=1`.**
2. **Définissez `MOCKY_ORIGIN`** avec votre URL HTTPS publique. Obligatoire si le
   SSO est activé.
3. **Gardez `MOCKY_BIND=127.0.0.1`** et laissez le proxy joindre Mocky par la
   boucle locale.
4. **Terminez le TLS au niveau du proxy.** Express ne le gère pas.

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
Voir la [vue d'ensemble de l'architecture](fr/architecture/overview.md).

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

Ce qui vit dans le volume `mocky-data` :

| Chemin | Contenu | Taille |
|---|---|---|
| `users.json`, `sessions.json`, `config.json`, `sso-jti.json` | Comptes et sessions | Minuscule |
| `data-<uuid>.json` | Les projets et le `DESIGN.md` d'un utilisateur | Petite |
| `text-config.json`, `images-config.json` | Les fournisseurs configurés — **secrets** | Minuscule |
| `muse-cache.json` | Les distillations, 7 jours, du texte | Petite |
| `image-library.json` et `image-library/` | La bibliothèque d'images | Moyenne |
| `video-library/` | Les séquences : un clip plus jusqu'à 150 images chacune | **De loin la plus grosse** |

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
SSO_DASHY_URL=https://dashy.example.com
MOCKY_ORIGIN=https://mocky.example.com        # production
# MOCKY_ORIGIN=http://localhost:5173          # dev — l'origine du SPA Vite, PAS :8787
```

Côté **Dashy** : le même `SSO_SHARED_SECRET`, plus le rappel de Mocky dans la
liste d'autorisation :

```bash
SSO_ALLOWED_REDIRECTS=https://mocky.example.com/sso/dashy/callback,http://localhost:5173/sso/dashy/callback
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
MOCKY_ORIGIN=https://mocky.example.com     # obligatoire dès que le SSO est activé
# SSO_SHARED_SECRET=…
# SSO_DASHY_URL=https://dashy.example.com
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

Voir la section suivante. C'est une ressource **statique**, entièrement
séparée : pas de construction, pas de Node, pas de volume.

---

## La documentation

Deux dossiers, deux ressources, volontairement découplés.

- **`docs/`** — le contenu. Des fichiers Markdown, rien d'autre.
- **`docs-site/`** — le lecteur. Quatre fichiers statiques.

### Comment ça marche

`docs-site/index.html` charge Docsify depuis `./vendor/` et définit :

```js
basePath: 'https://raw.githubusercontent.com/PetitOursManu/Mocky/main/docs/'
```

Le lecteur va donc chercher le Markdown **directement sur GitHub, à chaque
affichage de page**. Trois conséquences :

- **Il n'y a jamais d'étape de construction.** Publier de la documentation, c'est
  pousser un `.md` sur `main`. Le site le sert à la requête suivante.
- **Le site n'a pas besoin d'être redéployé** quand le contenu change.
- Le contenu doit rester **public**. `raw.githubusercontent.com` sur un dépôt
  privé demanderait un jeton, qu'une page statique ne peut pas porter.

> **La réciproque est le piège.** Tout ce qui est dans `docs-site/` —
> `index.html`, `mocky.css`, la favicon, les fichiers Docsify copiés — est servi
> par la ressource déployée, et non lu depuis GitHub. Pousser une modification de
> ces fichiers sur `main` ne change **rien** tant que la ressource statique n'a
> pas été **redéployée**.
>
> Autrement dit : une faute corrigée dans un `.md` apparaît au chargement
> suivant ; une nouvelle favicon, un titre modifié, une retouche de la feuille de
> style ou une montée de version de Docsify n'apparaissent qu'après un
> redéploiement.

### Anti-cache : incrémentez `?v=` dès que vous touchez à `docs-site/`

Chaque ressource locale d'`index.html` est demandée avec un marqueur de
version :

```html
<link rel="stylesheet" href="./mocky.css?v=2">
```

**Vous modifiez un fichier de `docs-site/` → incrémentez ce numéro sur toutes les
ressources.**

Sans lui, un redéploiement peut laisser un visiteur exécuter le **nouvel
`index.html` avec l'ancien `mocky.css`**. Les hébergements statiques servent les
feuilles de style avec une durée de cache longue, et un navigateur garde une
feuille de style bien plus longtemps que le HTML qui la référence.

Ce n'est pas théorique : c'est arrivé, et cela ne ressemblait pas à un problème
de cache. La page était toujours habillée — simplement avec les règles d'une
révision antérieure — donc cela se lisait comme un défaut de style dans du code
qui était en réalité déjà correct.

Il n'y a pas d'étape de construction ici pour signer les noms de fichiers, donc
le marqueur se tient à la main. C'est un seul nombre, dans un seul fichier.

### Déployer `docs-site/`

N'importe quel hébergement statique convient. Sur Coolify : une ressource
**statique**, répertoire de publication `docs-site/`, aucune commande de
construction, aucun volume.

Les fichiers :

| Fichier | Origine |
|---|---|
| `index.html` | Écrit pour ce projet |
| `mocky.css` | Écrit pour ce projet — l'aspect de Mocky, transposé de `src/styles/tokens.css` |
| `favicon.ico` | Copié depuis `public/favicon.ico` — l'icône de l'application |
| `logo.png` | Le même dessin, rendu une fois en 128 px pour le sommaire |
| `vendor/docsify.min.js` | docsify 4.13.1 — `lib/docsify.min.js` |
| `vendor/docsify-theme.css` | docsify 4.13.1 — `lib/themes/vue.css`, modifié |
| `vendor/docsify-search.min.js` | docsify 4.13.1 — `lib/plugins/search.min.js` |

### L'aspect

`mocky.css` est chargé après le `vue.css` copié localement, et le remplace. Les
valeurs ne sont pas inventées : elles sont transposées de
`src/styles/tokens.css` et de `tailwind.config.js`, pour que la documentation et
l'application soient d'accord.

Ce que cela donne, repris du fichier de jetons de l'application — *noir et
blanc, filets d'un pixel, aucun arrondi, aucune ombre, un seul aplat de
signature* :

| Élément | Traitement |
|---|---|
| Fond | Papier journal, pas blanc d'écran. Le `#fff` pur se lit comme « application » |
| Titres | La pile serif, resserrée. Aucune police n'est téléchargée — ces polices sont livrées avec Windows et macOS, donc la page n'a besoin d'aucune requête vers un tiers |
| Titres de groupe du sommaire | Un cavalier : 11 px, majuscules, interlettrage `0.14em`, avec un filet dessous |
| Liens du sommaire | Un chevron à gauche, et le vert de la maison sur la page active |
| Angles | `0` partout, comme dans l'application |
| Accent | Le vert du logo, seule couleur chromatique de l'habillage |

Une surprise de structure mérite d'être connue avant d'y toucher. Docsify rend
un groupe du sommaire sous la forme `<li>Architecture<ul>…</ul></li>` : **le
titre est un nœud texte nu**, pas un élément. La règle `.sidebar li > p` du
thème vue ne correspond donc à rien. La typographie est par conséquent posée sur
le `<li>`, chaque lien enfant la réinitialise, et le filet du groupe est dessiné
comme la bordure haute de la liste imbriquée — ce qui le place exactement sous le
titre.

### Le sélecteur de thème

Un bouton en bas du sommaire, et la préférence est retenue.

Le thème est appliqué par un script en ligne dans le `<head>`, de façon
synchrone, avant le premier affichage. C'est la même astuce et la même raison que
dans l'`index.html` de l'application : l'exécuter plus tard signifie que la
première image est déjà à l'écran, donc ouvrir la page en thème sombre provoque
un éclair de clair à chaque chargement.

Sans préférence enregistrée, il suit le système d'exploitation via
`prefers-color-scheme`. La clé est `mocky.docs.theme`, réservée à la
documentation : c'est une origine différente de celle de l'application, donc les
deux préférences ne peuvent de toute façon pas être partagées.

### La favicon

L'onglet de la documentation porte la même icône que l'onglet de l'application.
Le fichier est copié plutôt que lié, pour que `docs-site/` reste autonome et
n'aille rien chercher sur un autre serveur.

C'est le `.ico` et non le `.svg`, volontairement. `public/favicon.svg` est un PNG
de 1141×1107 enveloppé dans un élément SVG : 665 Ko, qu'une page de documentation
redemanderait à chaque navigation. Le `.ico` contient le même dessin en 16, 32 et
48 px pour 15 Ko, et tous les navigateurs le lisent.

Si l'icône de l'application change, recopiez-la :

```bash
cp public/favicon.ico docs-site/favicon.ico
```

Puis **redéployez la ressource statique** — voir l'avertissement plus haut. Une
favicon poussée sur `main` mais pas redéployée laisse l'onglet afficher l'icône
de document vierge du navigateur, ce qui est exactement l'aspect d'une favicon
absente.

Les navigateurs mettent aussi une favicon en cache de façon agressive, y compris
son *absence*. Après un redéploiement, vérifiez avec un rechargement forcé, ou en
ouvrant directement `<votre-domaine>/favicon.ico` : il doit répondre `200` avec
`image/x-icon`.

### Le titre de l'onglet

Docsify nomme l'onglet d'après le **premier lien du sommaire qui correspond à la
route courante**. Le bloc de langue est en tête du sommaire et son entrée
anglaise pointe vers `/` : la page d'accueil s'est donc retrouvée intitulée
« English », et l'accueil français « Français » — le nom de la langue, pas celui
de la page.

Un petit plugin dans `index.html` fixe lui-même le titre à chaque route :
`Doc Mocky` sur les pages d'accueil, `Doc Mocky — <page>` ailleurs. Le nom du
site vient en premier parce qu'un onglet de navigateur est étroit, et que les
premiers caractères sont les seuls que l'on lise.

### Pourquoi Docsify est copié localement

La même règle que `public/vendor/` côté application, pour la même raison.

Le thème d'origine commence par :

```css
@import url("https://fonts.googleapis.com/css?family=Roboto+Mono|Source+Sans+Pro:300,400,600");
```

C'est une requête vers un CDN tiers à chaque chargement de page, c'est-à-dire
exactement la dépendance que la copie locale existe pour supprimer. La ligne a
été retirée, et ce retrait est documenté en tête du fichier. Les deux familles de
polices déclarent déjà des solutions de repli locales dans les règles qui
suivent, donc rien d'autre ne change.

**À refaire après toute montée de version de Docsify.**

### Les langues

L'anglais est la langue par défaut et vit à la racine de `docs/`. Le français vit
sous `docs/fr/`, avec son propre `_sidebar.md`.

`index.html` renvoie chaque demande de sommaire imbriqué vers le bon fichier :

```js
alias: {
  '/fr/.*_sidebar.md': '/fr/_sidebar.md',
  '/.*_sidebar.md': '/_sidebar.md',
}
```

L'ordre compte : la règle `/fr/` doit venir en premier, parce que Docsify renvoie
la première correspondance et que `/.*/_sidebar.md` correspondrait aussi à un
chemin français.

`fallbackLanguages: ['fr']` fait qu'une page française qui n'existe pas retombe
sur son équivalent anglais au lieu d'afficher une erreur.

### Le sélecteur de langue

Deux onglets sous la manchette, construits par un plugin dans `index.html` —
**et non** une entrée de `_sidebar.md`.

Cette distinction a été apprise à la dure. En tant que groupe du sommaire, le
lien anglais pointait vers `/`, c'est-à-dire la même route que « Home ». Or
Docsify marque comme page active le **premier** lien du sommaire correspondant à
la route courante, et accroche sous lui le sommaire de cette page. Sur la page
d'accueil, le bloc de langue devenait donc l'élément actif et avalait toute la
table des matières, avec « Français » échoué en dessous. Choisir une langue est
une préférence, comme le thème ; ce n'est pas une page de l'arborescence, et le
sommaire ne liste plus que des documents.

Chaque onglet porte un petit drapeau dessiné en **SVG en ligne**, et non en
emoji : les emoji d'indicateur régional (🇬🇧, 🇫🇷) s'affichent comme de simples
paires de lettres sous Windows, qui est la plateforme de développement de ce
projet. Chaque drapeau porte aussi un filet d'un pixel — sans lui, la bande
blanche du drapeau français disparaît sur le fond du sommaire et le drapeau se
lit comme deux rectangles séparés.

La langue courante est signalée par `aria-current`, et pas seulement par la
couleur.

### Ajouter une page

1. Créez le fichier `.md` sous `docs/`, et sa traduction sous `docs/fr/`.
2. Ajoutez-le à `docs/_sidebar.md` et à `docs/fr/_sidebar.md`.
3. Poussez.

Deux règles font que les liens fonctionnent :

**Écrivez toujours les chemins depuis la racine de `docs/`**, jamais par rapport
à la page courante. Depuis `architecture/overview.md`, écrivez
`architecture/invariants.md`, pas `invariants.md`. Docsify résout tout depuis
`basePath`.

**`docs/README.md` est la page d'accueil obligatoire de Docsify.** Sans elle, le
site affiche une erreur de chargement silencieuse au premier affichage. La même
règle vaut pour `docs/fr/README.md` côté français.
