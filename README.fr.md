<p align="center">
  <img src="public/favicon.svg" width="96" alt="Logo Mocky" />
</p>

<h1 align="center">Mocky</h1>

<p align="center">Un générateur d'interfaces auto-hébergé, piloté par la conversation — décrivez un écran en langage naturel et obtenez un vrai composant React + Tailwind, en direct, sur un canevas infini.</p>

<p align="center">
  <a href="https://github.com/PetitOursManu/Mocky/actions/workflows/ci.yml"><img src="https://github.com/PetitOursManu/Mocky/actions/workflows/ci.yml/badge.svg" alt="État de l'intégration continue" /></a>
</p>

<p align="center">
  <img src="docs/assets/mocky-welcome.png" width="900" alt="La vue « nouvel écran » de Mocky : un champ de prompt, le panneau ✨ Muse avec ses URL d'inspiration et son mode image, les préréglages de format, et une rangée de préréglages de style." />
</p>

<p align="center"><sub>Décrivez un écran, choisissez un format, et laissez ✨ Muse construire la direction artistique. — <a href="docs/DESIGN-SYSTEM.md">système de design</a></sub></p>

<p align="center"><a href="README.md">English</a> · <strong>Français</strong></p>

---

> **Pourquoi c'est ainsi —** Les outils qui transforment une conversation en interface tournent d'ordinaire sur les serveurs de quelqu'un d'autre, avec le modèle de quelqu'un d'autre : vos prompts, vos écrans et vos règles de marque quittent tous votre poste, et votre accès peut vous être retiré sans préavis. Mocky renverse ce dispositif : le point d'accès au modèle est une URL et une clé que vous fournissez, la direction artistique est un fichier Markdown que vous conservez, et l'application entière tourne depuis un conteneur que vous démarrez vous-même.

Mocky est une alternative auto-hébergée à des outils comme Google Stitch / openStitch, bâtie autour de deux idées :

- **Ollama Cloud comme fournisseur de premier plan** — une URL de base configurable (par défaut `https://ollama.com`) + une clé d'API envoyée en jeton Bearer, pour que vous restiez maître de votre accès au modèle.
- **Un système de design portable (`DESIGN.md`)** — du Markdown ordinaire (jetons de couleur, typographie, espacements, motifs de composants) que Mocky place en tête de chaque génération, pour que les écrans restent fidèles à la marque d'une session à l'autre. Chaque projet garde en plus une **direction qui lui est propre**, fixée une fois puis laissée tranquille, pour que ses écrans aient l'air d'un seul produit ; `DESIGN.md` est ce sur quoi un projet se rabat tant qu'il n'en a pas.
- **Une génération réglée pour de vraies interfaces** — le prompt système interdit les wireframes, les aplats gris de remplissage et le « Lorem ipsum » ; il réclame des composants finis et interactifs, avec de vrais textes, des états de survol et de focus, et un style Tailwind moderne.
- **Le SSO « Se connecter avec Dashy », en option** — laissez vos utilisateurs s'authentifier via une instance [Dashy](https://github.com/PetitOursManu/Dashy) et retrouver leurs projets Mocky sans un mot de passe de plus.

## Fonctionnalités

> **Pourquoi c'est ainsi —** Chaque entrée ci-dessous comble le même manque : un modèle sait écrire du JSX en quelques secondes, mais un écran ne devient utile qu'une fois qu'il a de vrais textes, de vraies couleurs, de vraies interactions et un endroit où vivre. Ce n'est donc pas un catalogue de gadgets indépendants — le canevas, les capacités d'exécution, Muse, les liens d'interaction et l'export sont les étapes successives qui conduisent une phrase de description jusqu'à quelque chose que l'on peut cliquer, montrer et transmettre.

- 🧠 **Génération d'interfaces par le dialogue** — décrivez un écran, obtenez un composant React + Tailwind autonome.
- ✨ **Muse — intelligence du design** — un seul interrupteur transforme un prompt en direction artistique singulière, avec de vrais textes, une palette cohérente et de véritables images générées (voir [✨ Muse](#-muse--intelligence-du-design) plus bas). Ancrée dans des références primées consultées en direct via des serveurs MCP locaux ; aucune clé requise.
- 🎨 **Un rendu prêt pour la production** — le prompt impose de vraies couleurs, des espacements, des angles arrondis, des ombres, des états interactifs et un contenu réaliste (pas de wireframes).
- 🔎 **Passe de qualité, à la demande** — clic droit sur un écran et Mocky confronte ce qu'il a généré à 59 règles déterministes et à une passe jugée, le note sur 20, et sait corriger ce qu'il a trouvé (voir [Passe de qualité](#passe-de-qualité) plus bas). Jamais automatique.
- 🖼️ **Canevas infini** — un plan pointillé façon Stitch ; déplacement et zoom, cadres redimensionnables à taille réelle, sélection multiple façon Windows (clic / Ctrl-clic / lasso), rangement en grille, **Tout afficher** et **Zoomer sur le dernier écran**. Le cadrage est conservé comme une intention et non comme des coordonnées : il se recalcule donc quand la fenêtre ou un panneau latéral change de taille — et vous rend la vue dès que vous vous déplacez ou zoomez à la main.
- ▶️ **Mode Interagir** — cliquez sur les boutons ; les états de survol et les animations s'exécutent en direct, à même la grille.
- ✦ **De vraies animations, sans danger** — onze préréglages d'animation et trois composants derrière un unique emballage `<Animated preset="…">`, propulsés par [Motion](https://motion.dev). Le modèle qui génère n'écrit jamais de code d'animation : il choisit un nom dans une liste fermée (voir [Animations](#animations) plus bas). Un seul interrupteur, par projet ou par écran, fige l'ensemble.
- 🎞️ **Vidéo au défilement** — Muse peut générer un clip (ou vous pouvez en importer un) et laisser le visiteur le parcourir à la molette, épinglé en pleine hauteur.
- 🖼️ **Bibliothèque de médias** — toutes les images et séquences générées au même endroit, plus **vos propres** images et clips. Muse construit sa direction artistique *à partir de* ce que vous sélectionnez.
- 🔗 **Liens d'interaction + mode Démo** — reliez un véritable élément d'un écran à un autre écran, puis jouez le prototype cliquable.
- 📱 **Préréglages de format et cadre d'appareil** — Mobile (iPhone) / Bureau / Tablette ; les écrans mobiles s'affichent dans un cadre d'iPhone en CSS (barre d'état, encoche, barre d'accueil).
- 🎨 **Système de design et préréglages de style** — chargez ou collez un `DESIGN.md`, ou choisissez un style visuel intégré (17 préréglages) ; il pilote chaque génération.
- 🧭 **Une direction par projet** — les écrans d'un projet partagent une seule direction de design, ainsi que le même nom de produit et le même logo, au lieu de réinventer les trois à chaque génération. **Nouvelle direction**, dans le composer, est la dérogation ponctuelle : la prochaine demande réécrit la direction, puis l'interrupteur se remet de lui-même.
- ✂️ **Annotations par capture** — découpez une zone d'un écran vers le dialogue sous forme de références numérotées, jointes aux générations (avec vision).
- 📦 **Projets et export** — plusieurs projets, téléchargement `.tsx` écran par écran, et un projet Vite exécutable en `.zip`.
- 👤 **Comptes et SSO en option** — connectez-vous à une instance Mocky et vos projets ainsi que votre DESIGN.md se synchronisent d'un appareil à l'autre (backend auto-hébergé, aucun cloud). Avec une instance [Dashy](https://github.com/PetitOursManu/Dashy), les utilisateurs peuvent aussi **« Se connecter avec Dashy »** et retrouver leurs projets. Sans compte, tout reste dans le `localStorage` de votre navigateur.
- 🌗 **Deux thèmes** — Papier et Encre, tous deux de plein droit : mêmes jetons, aucun des deux plaqué sur l'autre. Chaque association est vérifiée face au WCAG AA par un test qui lit le vrai fichier de jetons.

## Pile technique

> **Pourquoi c'est ainsi —** Tout ce qu'un auto-hébergeur doit installer à part — une base de données, un module natif, un service d'arrière-plan — est une chose de plus qui peut manquer, ne pas correspondre ou rester sans correctif sur sa machine, alors que Mocky doit démarrer d'une seule commande. Son état tient donc dans de simples fichiers sur le disque, son backend est un petit processus, et le seul programme qu'il s'attend à trouver en dehors de lui-même est celui qui traite la vidéo ; quand celui-ci est absent, une seule fonctionnalité se déclare indisponible et rien d'autre ne s'en aperçoit.

React 18 · TypeScript · Vite · Tailwind CSS côté interface, et un minuscule backend **Node + Express** (stockage en fichiers JSON, sans base de données) pour les comptes, la synchronisation des projets, la bibliothèque de médias, Muse, les séquences au défilement et le proxy vers le modèle. [Motion](https://motion.dev) est embarqué pour les aperçus, et `ffmpeg` est le seul binaire externe — il découpe une vidéo en images pour qu'une séquence au défilement puisse les parcourir, et tout le reste fonctionne sans lui.

## Démarrage rapide

> **Pourquoi c'est ainsi —** Plusieurs routes de Mocky dépensent de l'argent réel — appels au modèle, génération d'images, images extraites d'une vidéo — et son stockage contient le travail de personnes nommément identifiées ; l'instance identifie donc ses appelants avant de faire quoi que ce soit, et la toute première personne qui se présente est celle à qui elle confie les clés. Les deux prérequis ci-dessous sont des alternatives plutôt qu'une liste : l'image de conteneur arrive avec chaque brique optionnelle déjà à l'intérieur, tandis qu'une copie des sources attend de vous que vous fournissiez l'environnement d'exécution.

**Prérequis :** Docker, *ou* Node 22.12+ (voir `.nvmrc`). Rien d'autre — pas de base de données, pas de module natif. Ce plancher est fixé par le détecteur d'anti-motifs qui sert la [passe de qualité](#passe-de-qualité), et Node 20 est de toute façon sorti du support en avril 2026.

**Mocky exige un compte.** Le premier que vous créez devient l'administrateur de l'instance, et seul un administrateur peut ajouter d'autres utilisateurs ou configurer un modèle valable pour toute l'instance. Il n'y a pas de mode anonyme : les projets, la bibliothèque d'images et Muse vivent tous derrière une session.

### Docker (recommandé)

> **Pourquoi c'est ainsi —** L'image est la voie recommandée parce que chaque brique optionnelle s'y trouve déjà — l'outil vidéo, et le navigateur sans interface graphique dont Muse se sert pour regarder des références en direct — si bien que rien ne se dégrade en silence sur une machine qui en serait dépourvue. Sa liaison de port est le réglage par défaut le plus intéressant : un conteneur publié sur toutes les interfaces est joignable par n'importe quoi d'autre sur le réseau, et c'est ici une application dont les boutons coûtent de l'argent ; la publication commence donc sur l'adresse de bouclage, et l'élargir doit être écrit à dessein.

```bash
git clone https://github.com/PetitOursManu/Mocky.git
cd Mocky
docker compose up -d --build
```

Mocky tourne sur **http://localhost:8787**. Les données (comptes, projets, sessions, images générées) persistent dans le volume Docker `mocky-data`.

> Le port n'est publié que sur `127.0.0.1` : l'instance n'est donc pas joignable depuis votre réseau. Plusieurs routes dépensent vos crédits de modèle, c'est le réglage sûr par défaut. Pour l'exposer délibérément, mettez `MOCKY_BIND=0.0.0.0` dans `.env` — et lisez d'abord [Reverse proxy / HTTPS](#reverse-proxy--https).

| Commande | Description |
|---|---|
| `docker compose up -d --build` | Construire l'image et démarrer en arrière-plan |
| `docker compose logs -f` | Suivre les journaux |
| `docker compose ps` | État, y compris le contrôle de santé |
| `docker compose down` | Arrêter et supprimer le conteneur (les données sont conservées dans le volume) |
| `docker compose down -v` | Arrêter et **supprimer toutes les données** (le volume est détruit) |

### Développement local

> **Pourquoi c'est ainsi —** Deux processus coexistent parce qu'ils font des métiers sans rapport : l'un compile et recharge à chaud l'interface pendant que vous la modifiez, l'autre détient tout ce qui possède un état. N'exécuter que le premier produit donc une application qui s'affiche parfaitement et ne pourra jamais vous laisser entrer — d'où la commande combinée en recommandation, et non en simple confort.

```bash
npm install
npm run dev:all        # Vite + backend ensemble — c'est celle-là qu'il vous faut
```

Ouvrez ensuite **http://localhost:5173**.

> `npm run dev` ne démarre que le **serveur web**, sans backend. Comme Mocky réclame un compte et que les comptes vivent sur le backend, la boîte de connexion vous dira qu'elle n'arrive pas à le joindre. Utilisez `dev:all`, sauf si vous voulez précisément le frontend seul.

**Build de production :**

```bash
npm run build          # construit le frontend dans dist/
npm start              # le backend sert dist/ + l'API + le proxy modèle sur :8787
```

### Premier lancement

> **Pourquoi c'est ainsi —** Une instance sans aucun compte n'a personne qui puisse accorder ses droits au premier administrateur : la règle est donc positionnelle — celui qui s'inscrit en premier les reçoit — et rien en aval ne peut revenir dessus, ce qui explique que l'avertissement sur les identifiants ne soit pas décoratif. Une seule des deux configurations de modèle peut être en vigueur à la fois, et la raison tient à la comptabilité : une clé configurée par l'administrateur est dépensée par le serveur pour le compte de tous, si bien qu'une clé propre à un navigateur restée active à côté rendrait impossible de dire à qui appartiennent les crédits que vient de consommer une génération.

1. Ouvrez Mocky. La boîte de connexion apparaît et **ne peut pas être écartée** — c'est voulu.
2. Créez le premier compte. **Il devient l'administrateur.** Conservez les identifiants : il n'existe aucune procédure de réinitialisation de mot de passe, et promouvoir un autre compte suppose d'éditer `server/data/users.json` à la main.
3. Configurez un modèle — deux manières, mutuellement exclusives :

   - **Par navigateur** (par défaut) — **Réglages** → fournisseur `Ollama Cloud`, URL de base `https://ollama.com`, votre clé d'API, puis choisissez un modèle dans la liste et appuyez sur **Tester la connexion**. La clé est conservée dans le `localStorage` de ce navigateur et n'atteint jamais le serveur.
   - **Pour toute l'instance** (administrateur) — **Administration** → *Modèle de texte*. La clé est stockée côté serveur et sert à tout le monde ; les Réglages de chaque utilisateur sont alors grisés. Choisissez cette voie si vous préférez ne pas coller une clé dans chaque navigateur.

4. Décrivez un écran et générez. Activez ✨ **Muse** pour obtenir une direction artistique complète, avec de vrais textes et des images générées — voir [✨ Muse](#-muse--intelligence-du-design).

### Entretien

> **Pourquoi c'est ainsi —** Chacune de ces commandes remplace quelque chose qui était autrefois une ligne unique documentée et n'a pas survécu au contact du réel : une recette de sauvegarde en shell dont la syntaxe n'a pas d'équivalent sous Windows, et une politique du type « faites confiance aux bundles embarqués » que rien ne vérifiait. Transformer la première en script sans dépendance la fait se comporter à l'identique sur tous les systèmes d'exploitation, et la seconde recalcule l'empreinte de chaque fichier face à un manifeste enregistré — ces bundles sont minifiés, ils s'exécutent aux côtés de code produit par un modèle, et quelques octets modifiés dans l'un d'eux passeraient n'importe quelle relecture humaine.

```bash
npm run backup         # → backups/mocky-YYYY-MM-DD-HHmm.zip
npm run check:vendor   # vérifie les bundles navigateur embarqués face à leurs empreintes
npm test               # la suite complète
```

`npm run backup` est du Node ordinaire et fonctionne à l'identique sous Windows, macOS et Linux. Pour une instance dockerisée, sortez d'abord les données du volume :

```bash
docker compose cp mocky:/app/server/data ./server/data
npm run backup
```

## Déploiement Docker

> **Pourquoi c'est ainsi —** Une instance auto-hébergée n'est récupérable que dans la mesure où son état est facile à retrouver ; Mocky garde donc la totalité de cet état dans un unique répertoire accessible en écriture et traite le conteneur lui-même comme jetable : reconstruisez l'image quand bon vous semble, rattachez le même répertoire, rien n'est perdu. Tout ce chapitre découle de cette seule séparation entre une image que l'on peut jeter et un répertoire que l'on ne peut pas.

### Architecture

> **Pourquoi c'est ainsi —** Les outils qui transforment du code source typé en bundle pour navigateur sont volumineux, nombreux, et nécessaires exactement une fois. Un build en deux étapes permet à la première de les contenir tous pendant que la seconde n'hérite que de leur résultat : ce qui atterrit sur la machine en production, c'est l'interface compilée plus la poignée de paquets que le serveur appelle vraiment — une image plus légère à déplacer, et moins de code posé sur quelque chose que vous avez exposé à un réseau.

L'image Docker est un **build multi-étapes** basé sur `node:22-slim` :

- **Étape 1 (builder)** : installe toutes les dépendances, exécute `npm run build` → produit `dist/`
- **Étape 2 (runtime)** : n'installe que les dépendances de production, copie `dist/`, `server/` et `public/` depuis le builder. Exécute `node server/index.js`.

Le serveur Express sert le frontend construit, les points d'accès `/api` (authentification, synchronisation des données) et le proxy `/__provider` (reverse proxy protégé contre le SSRF vers le fournisseur de modèle).

### Variables d'environnement

> **Pourquoi c'est ainsi —** Un outil auto-hébergé qui exige d'être configuré avant de consentir à démarrer est un outil que la plupart des gens ne verront jamais tourner ; chaque réglage listé ici possède donc une valeur par défaut qui fonctionne, et les choix importants se font dans l'interface. Ce qui reste dans le tableau, ce sont les hypothèses que ces valeurs par défaut encodent en silence — où l'état est conservé, de quelle adresse une requête semble provenir, quelle est l'URL publique de Mocky — et chacune reste vraie jusqu'au moment précis où vous placez quelque chose d'autre devant le serveur.

Toutes les variables d'environnement sont **optionnelles**. Mocky tourne tel quel : les comptes se créent depuis l'écran de connexion et le fournisseur de modèle se configure dans l'interface.

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `8787` | Port sur lequel le serveur Express écoute |
| `MOCKY_PORT` | _(non défini)_ | Remplace `PORT` pour le backend. Utile en développement : un outil qui injecte `PORT` pour configurer Vite ne poussera pas le backend sur le port de Vite. Laissez-la non définie en production et utilisez `PORT` |
| `MOCKY_BIND` | `127.0.0.1` | **Docker uniquement** — l'interface de l'hôte sur laquelle le conteneur est publié. `0.0.0.0` expose Mocky à votre réseau ; ne le faites que sur un réseau de confiance, ou derrière un reverse proxy |
| `MOCKY_DATA_DIR` | `server/data` | Emplacement du stockage JSON. Pointez-la vers un volume monté pour garder l'état hors du répertoire de l'application |
| `TRUST_PROXY` | _(non défini)_ | À mettre à `1` (ou à un nombre de sauts, ou à une valeur `trust proxy` d'Express) **lorsque Mocky se trouve derrière un reverse proxy**. Sans elle, chaque requête semble venir de `127.0.0.1`, si bien que la limite de tentatives de connexion devient un seau unique partagé par toute l'instance — neuf échecs par minute et plus personne ne peut se connecter |
| `NODE_ENV` | `production` | Active un service optimisé. La sécurité des cookies est déduite de la connexion réelle, pas de cette variable |
| `SSO_SHARED_SECRET` | _(non défini)_ | Secret HS256 partagé avec Dashy pour le SSO. Doit correspondre au `SSO_SHARED_SECRET` de Dashy. Avec `SSO_DASHY_URL`, active « Se connecter avec Dashy » |
| `SSO_DASHY_URL` | _(non défini)_ | Origine publique de votre instance Dashy (par exemple `https://dashy.example.com`) |
| `MOCKY_ORIGIN` | _(détectée automatiquement)_ | L'origine publique de Mocky elle-même, utilisée comme revendication `aud` du jeton SSO et pour construire l'URL de rappel. **Définissez-la explicitement dès que le SSO est actif** — le repli fait confiance à l'en-tête `Host` de la requête |

**Définir les variables d'environnement dans Docker.** `docker-compose.yml` lit un fichier `.env` local :

```bash
cp .env.example .env
# éditez .env, puis :
docker compose up -d --build
```

Le serveur consigne aussi au démarrage si le SSO est bien monté, de sorte qu'une faute de frappe dans un nom de variable se voit immédiatement :

```
Mocky backend on http://localhost:8787
SSO: disabled (set SSO_SHARED_SECRET and SSO_DASHY_URL in .env to enable)
```

Vous pouvez tout aussi bien inscrire les valeurs en dur sous `environment:` dans `docker-compose.yml`.

### Volumes

> **Pourquoi c'est ainsi —** Tout ce qui est écrit à l'intérieur d'un conteneur disparaît à l'instant où ce conteneur est remplacé, et le remplacer est précisément ce que fait une reconstruction à chaque mise à jour. Un volume nommé est un répertoire qui vit en dehors de l'image et que l'on rattache à chaque nouveau conteneur : tout ce qu'un utilisateur pleurerait survit ainsi intact à une montée de version — et la planification de l'espace disque doit partir de l'entrée vidéo plutôt que du JSON, puisqu'une seule séquence stocke un clip accompagné de toute la série d'images qui en a été extraite.

| Volume | Point de montage | Description |
|---|---|---|
| `mocky-data` | `/app/server/data` | Stockage en fichiers JSON : comptes, sessions, projets par utilisateur, bibliothèque d'images et séquences au défilement (`video-library/`, de loin la plus lourde — chacune stocke un clip plus jusqu'à 150 images). Volume nommé dans docker-compose — persiste au fil des reconstructions du conteneur |

**Sauvegarder les données.** Sortez le contenu du volume, puis utilisez le script fourni — c'est du Node ordinaire, il se comporte donc à l'identique sous Windows, macOS et Linux :

```bash
docker compose cp mocky:/app/server/data ./server/data
npm run backup
```

Pour restaurer : arrêtez Mocky, décompressez l'archive par-dessus `server/data`, recopiez le tout et redémarrez.

```bash
docker compose cp ./server/data mocky:/app/server/data
docker compose restart
```

> L'ancienne recette `docker run -v $(pwd):/backup alpine tar …` ne fonctionne pas sous Windows : `$(pwd)` n'est pas de la syntaxe `cmd.exe`, et sous PowerShell elle se développe en un chemin qui peut contenir des espaces, ce qui casse l'argument `-v`.

L'archive contient des empreintes de mots de passe et des jetons de session — `backups/` est ignoré par git, gardez-le ainsi.

### Ports

> **Pourquoi c'est ainsi —** Tout ce dont le navigateur a besoin arrive d'un seul processus à l'écoute, ce qui relève moins du rangement que des origines : une page et les points d'accès qu'elle appelle qui partagent une même adresse n'ont besoin d'aucune négociation entre origines, d'aucune requête préalable, ni d'un second trou dans un pare-feu. Le port de l'hôte auquel vous l'associez est donc libre de changer — à l'intérieur du conteneur, le numéro, lui, ne bouge pas.

| Port | Protocole | Description |
|---|---|---|
| `8787` | HTTP | Serveur Express (frontend + API + proxy vers le fournisseur) |

Pour changer le port exposé, modifiez `ports` dans `docker-compose.yml` :

```yaml
ports:
  - "3000:8787"    # exposer sur le port 3000 de l'hôte
```

### Contrôle de santé

> **Pourquoi c'est ainsi —** Un contrôle de santé ne vaut la peine d'exister que s'il est capable d'échouer. Le conteneur interrogeait autrefois un point d'accès de configuration qui répond depuis la mémoire : une instance dont le disque était devenu accessible en lecture seule, ou qui avait été démarrée sans jamais avoir été construite, se déclarait en parfaite santé tout en étant totalement inutilisable. Sonder directement les deux conditions — et nommer celle qui a cédé — est ce qui rend la ligne d'état digne d'être lue.

`GET /api/health` rend compte des deux seules choses qui cassent réellement une instance en fonctionnement :

```json
{ "ok": true, "checks": { "dataWritable": true, "frontendBuilt": true } }
```

Il répond `503` avec une chaîne `detail` dès que l'une des deux échoue — un répertoire de données en lecture seule, ou un `npm start` sans `npm run build`. Le contrôle de santé du conteneur l'interroge toutes les 30 secondes.

```bash
docker compose ps     # affiche l'état de santé
curl -s localhost:8787/api/health
```

### Reverse proxy / HTTPS

> **Pourquoi c'est ainsi —** Un reverse proxy (un serveur placé devant l'application, qui relaie les requêtes en son nom) est le dernier saut avant l'application : sauf indication contraire, le serveur lit donc l'adresse du proxy comme étant celle de l'appelant — et un limiteur qui compte les échecs de connexion par adresse considère alors tous les visiteurs comme une seule et même personne. `TRUST_PROXY` lui fait lire l'adresse transmise à la place ; `MOCKY_ORIGIN` fournit l'URL publique que le serveur ne peut plus déduire seul dès lors qu'il n'est plus ce à quoi les navigateurs se connectent ; et le TLS se termine au proxy parce qu'il n'y a aucune gestion de certificat dans le serveur.

Derrière Nginx, Caddy ou Traefik :

- **Mettez `TRUST_PROXY=1`.** Sinon toutes les requêtes semblent provenir du proxy, et la limite de tentatives de connexion s'effondre en un seul seau partagé par tout le monde.
- **Définissez `MOCKY_ORIGIN`** avec votre URL publique en HTTPS — obligatoire si le SSO est activé.
- Gardez `MOCKY_BIND=127.0.0.1` (la valeur par défaut) et laissez le proxy joindre Mocky par l'interface de bouclage.
- Terminez le TLS au proxy. Le serveur Express ne s'en occupe pas.

Générez le secret partagé SSO sans avoir besoin d'`openssl` (qui n'est pas dans le `PATH` standard de Windows) :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Exemple de Caddyfile :

```
mocky.example.com {
    reverse_proxy localhost:8787
}
```

Exemple pour Nginx :

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

## Comment fonctionne la génération

> **Pourquoi c'est ainsi —** Intercaler un saut appartenant à Mocky entre la page et le modèle apporte trois choses à la fois : la requête quitte le navigateur en restant sur la même origine, la destination peut être examinée avant que quoi que ce soit ne soit appelé, et un seul chemin de code sert aussi bien une clé qui vit dans votre navigateur qu'une clé configurée pour toute l'instance. Les deux formes de requête ci-dessous ne diffèrent que par ce qu'elles transportent, car une consigne de modification qui omet le composant tel qu'il est aujourd'hui est une invitation ouverte, faite au modèle, à reconstruire l'écran de mémoire.

Tout le trafic passe par le `POST /api/chat` du fournisseur, à travers un reverse proxy :

- **Nouvel écran** — prompt système (règles de sortie + la direction de design du projet + indication de format) + votre description. Dès que le projet a un écran, le plus ancien voyage aussi, pour que le produit garde son nom et son logo ; épinglez un écran comme référence de mise en page et c'est toute la chrome partagée qui l'accompagne à la place.
- **Modification d'un écran sélectionné** — les mêmes règles **plus le code complet du composant actuel** et une consigne stricte du type « ne change que ce qui est demandé, préserve tout le reste ». Le modèle renvoie le composant complet mis à jour.

La réponse du modèle utilise un **protocole sentinelle** (`<<<MOCKY>>> ... <<<END>>>`) au lieu de clôtures markdown, de sorte que du code partiel peut être extrait pendant le flux, sans attendre une clôture finale. La requête utilise `num_ctx: 32768` pour éviter la troncature sur les gros composants.

### Capacités d'exécution

> **Pourquoi c'est ainsi —** Un modèle à qui l'on demande d'écrire à la main un jeu d'icônes ou un graphique en SVG brut dépense des centaines de jetons en géométrie, qui peut être coupée au milieu d'un attribut ; on lui donne donc des composants nommés à la place, et leur code source est collé dans l'aperçu avant ce qu'il a écrit. Ces fichiers résident sur le serveur de Mocky plutôt que sur un serveur public, et un test les y maintient : une maquette obligée d'atteindre l'hôte d'un inconnu avant de pouvoir afficher quoi que ce soit est une maquette qui cesse de fonctionner dès que cet hôte tombe, aussi solide que soit le code généré.

Mocky détecte automatiquement ce dont le prompt a besoin et injecte des capacités dans l'iframe d'aperçu sous bac à sable :

- **Icons** (socle, toujours chargé) : 26 icônes SVG en ligne sous l'espace de noms `Icon.*`. Le prompt interdit d'écrire à la main `<svg><path d="...">`, pour éviter la troncature.
- **Charts** (conditionnel) : 5 composants de graphique en SVG en ligne (BarChart, LineChart, DonutChart, Sparkline, ProgressRing). Aucune bibliothèque de graphiques externe.
- **Animate** (conditionnel) : l'emballage `<Animated>` plus `Ticker` et `CountUp`, appuyés sur Motion — voir [Animations](#animations).
- **ScrollVideo** (seulement quand une séquence existe) : `<ScrollSequence>`, le héros parcouru au défilement.
- **DaisyUI** (conditionnel) : une feuille de style embarquée pour les classes de composants sémantiques.

Les capacités sont des paquets d'extraits (du code JavaScript simple, embarqué, préfixé au code généré), des feuilles de style ou des scripts. **Rien n'est chargé depuis une autre origine.** C'est la règle, et elle est appliquée par un test : l'enjeu n'a jamais été la forme de la balise mais la dépendance — une requête peu fiable vers un tiers subordonnerait un aperçu par ailleurs valide à la disponibilité de quelqu'un d'autre. Un fichier placé sous `public/vendor/` est servi par le même serveur que la page, son empreinte est figée, et il ne peut pas tomber indépendamment d'elle.

> Une capacité retirée du service continue d'être *injectée* pour les écrans qui ont été générés avec elle, mais n'est plus jamais *documentée* auprès du modèle. C'est ainsi que l'ancien lot d'animations en CSS seul (FadeIn, Marquee, BentoGrid…) continue d'afficher les écrans qui l'utilisent alors qu'aucun nouvel écran ne peut y recourir — le supprimer purement et simplement aurait fait échouer chacun d'eux.

### Animations

> **Pourquoi c'est ainsi —** Une animation est la promesse qu'un élément finira quelque part ; quand la promesse est rompue, l'élément reste là où il a commencé, et pour un fondu cela veut dire invisible. C'est ce risque qui explique que le vocabulaire soit un ensemble fixe de noms plutôt que du code — un nom que rien ne reconnaît ne peut vouloir dire que « affiche ceci tel quel » — et que chaque repli ait été choisi pour aboutir à l'état de repos plutôt qu'à l'état de départ.

Propulsées par [Motion](https://motion.dev), et le modèle qui génère **n'en écrit jamais une ligne**. Il n'a aucun accès à l'API de la bibliothèque, n'écrit aucun `motion.div`, aucune transition, aucune variante. Il choisit un nom dans une liste fermée :

| | |
|---|---|
| **Entrées** | `fade-in` · `fade-up` · `scale-in` · `slide-left` · `slide-right` · `blur-in` · `stagger-list` |
| **Survol** | `hover-lift` · `hover-glow` |
| **Défilement** | `parallax` |
| **Sortie** | `exit-slide` |

```jsx
<Animated preset="fade-up" delay={0.1} as="section">…</Animated>
<Ticker speed={24} pauseOnHover>{logos}</Ticker>
<CountUp to={1284} suffix="+" />
```

**L'échec est toujours statique, jamais cassé.** Un préréglage inconnu produit un élément ordinaire avec son contenu. Une bibliothèque absente se replie sur les mêmes préréglages en CSS. Et une entrée n'est tentée que si le document est visible et que le lecteur n'a pas demandé un mouvement réduit — mesuré, car Motion maintient un élément à son état `initial` tant que sa boucle d'animation n'a pas démarré, et les navigateurs n'exécutent pas cette boucle dans un onglet en arrière-plan : une maquette serait restée à `opacity: 0` pour toujours. Dans tous les autres cas, l'élément s'affiche immédiatement dans son état **final**.

Un modèle qui déraperait et écrirait malgré tout `import { motion }` ou `<motion.div>` se les voit retirer avant le rendu — via l'AST de Babel, jamais par une expression régulière (invariant I1 : `motion.` apparaît aussi à l'intérieur de chaînes, dans des attributs, et au milieu du mot *promotion*). `<motion.section className="hero">` devient `<section className="hero">` en conservant son contenu, et le retrait est signalé dans la console plutôt qu'effectué en silence.

**L'interrupteur** se trouve dans le composeur, avec trois états — `auto` (Mocky décide d'après le prompt, c'est la valeur par défaut), forcé à l'arrêt, forcé en marche — et chaque écran peut passer outre depuis la barre au-dessus de son cadre ou depuis son menu contextuel. Couper l'interrupteur fige aussi les écrans *déjà générés*, en ramenant chaque animation à son image finale plutôt qu'en la supprimant : `animation: none` sur un fondu dont l'état de repos est `opacity: 0` laisserait une maquette blanche au lieu d'une maquette immobile.

Motion est figé à une version **exacte** et empaqueté par `scripts/build-vendor-motion.mjs` — voir [`public/vendor/VENDOR.md`](public/vendor/VENDOR.md). Une mise à jour a déjà été livrée qui a silencieusement cessé d'animer sans lever la moindre erreur : vérifiez donc les préréglages **visuellement** après chaque montée de version, et pas seulement « aucune erreur en console ».

### Passe de qualité

> **Pourquoi c'est ainsi —** On a beau dire à un modèle à quoi ressemble le bon travail, il rendra malgré tout trois cartes de fonctionnalités interchangeables et un héros sans idée propre, parce qu'un prompt est une consigne et non un contrôle. Le contrôle a donc lieu après coup, sur le code fini, et il est réparti selon ce que chaque moitié peut réellement trancher : une règle qui porte sur un nom de classe se décide de façon déterministe et ne coûte rien, une règle qui porte sur une composition réclame un lecteur et coûte un appel de modèle bon marché. Rien de tout cela ne se déclenche seul — un écran qui vous convient ne doit jamais être réécrit dans votre dos.

Clic droit sur un écran du canevas → **Peaufiner (détecter et corriger)**. Mocky examine ce qui a été généré et, là où quelque chose ne va pas, demande au modèle de le réparer — **deux passes de correction au maximum**, à la demande, jamais automatiquement. La détection tourne sur le backend : comme Muse, la passe ne fait rien en mode `localStorage` pur.

Trois choses regardent l'écran, et chacune a le droit de ne rien apporter :

- **Une détection déterministe** — 59 règles visant les marques visuelles d'une interface écrite par une machine, appliquées au JSX généré lu comme du texte. Chaque signalement porte une ligne et un extrait, ce qui est précisément ce qui rend la réparation possible : un défaut que le modèle sait localiser est un défaut qu'il sait corriger.
- **Une passe jugée** — un unique appel de modèle, bon marché et sans flux, qui répond à une liste fixe de questions par oui ou par non qu'aucune expression régulière ne tranche (« trois cartes de fonctionnalités interchangeables », « un héros sans idée propre »). Le code y entre comme *donnée*, jamais comme consigne — la même séparation que Muse applique à une page récupérée, et pour la même raison.
- **Un audit** — cinq dimensions (accessibilité, performance, thème, adaptabilité, anti-motifs), chacune notée de 0 à 4 pour un score de santé sur 20, avec des signalements étiquetés de P0 à P3.

**Chaque dimension annonce aussi un degré de confiance, et c'est là que se loge l'honnêteté du rapport.** Mocky lit le code source ; il n'affiche jamais la page. Cela couvre presque entièrement le thème et les marques de « slop », qui vivent dans des noms de classe qu'il peut voir — et cela ne touche presque pas à l'accessibilité ni à l'adaptabilité, parce que le contraste, la longueur des lignes et les débordements sont des propriétés d'une page déjà mise en page. Un 4/4 en accessibilité sur un écran que personne n'a affiché serait un mensonge, et le degré de confiance est ce qui empêche le rapport de le proférer.

**Le goût cesse d'être l'affaire de Mocky dès l'instant où vous l'avez tranché.** `src/lib/generate.ts` dit déjà au modèle qu'une direction artistique fournie prime sur chacune des règles de style du prompt ; lorsqu'un projet a une direction établie, les règles qui jugent la couleur et la typographie sont donc rétrogradées au rang de conseils : elles vous sont signalées, jamais transmises à la boucle de correction. Un écran qui respecte une direction violette est juste, pas bâclé.

**La boucle s'arrête à quatre conditions, dont une seule est le budget.** Plus rien à corriger. Les mêmes règles toujours en échec après une passe, puisque redemander donnerait la même réponse. Une passe qui a créé plus de problèmes qu'elle n'en a résolu — auquel cas c'est l'écran d'*avant* que vous conservez. Et, en dernier, les deux passes épuisées. **Revenir à la version précédente** annule un peaufinage exactement comme il annule une modification.

La détection déterministe s'appuie sur **[`impeccable`](https://github.com/pbakaus/impeccable)**, un paquet npm open source de Paul Bakaus, sous licence **Apache-2.0**. Mocky n'utilise que ce paquet et son catalogue public de règles, rien d'autre : un seul moteur, `detectText`, qui lit du code source sous forme de chaîne. Rien de la couche agentique du projet n'est utilisé — ni skills, ni commandes slash, ni Live Mode. Les questions de la passe jugée sont propres à Mocky, écrites pour ce pipeline.

## ✨ Muse — intelligence du design

> **Pourquoi c'est ainsi —** Un modèle à qui l'on demande « une page d'accueil pour une boulangerie » ressort le même dégradé indigo à chaque fois, parce que ce dégradé est à peu près ce à quoi ressemble la moyenne de ses données d'entraînement. La réponse de Muse consiste à trancher la direction artistique avant qu'aucun code n'existe — palette, grammaire de mise en page, textes rédigés, imagerie — puis à déposer cette décision exactement dans l'emplacement que le système de design occupait déjà dans le prompt. C'est ce placement, plutôt qu'un recâblage du générateur, qui rend la fonctionnalité facile à raisonner quand elle est active, et totalement inerte quand elle ne l'est pas.

Muse est une passe optionnelle qui hisse la génération au-dessus du « slop » générique
produit par les IA. Basculez l'interrupteur **✨ Muse** à côté du prompt et Mocky
va, avant de construire quoi que ce soit :

1. **Rassembler de l'inspiration** — apparier votre demande à un registre organisé de
   galeries faciles à consulter (Awwwards, land-book, …) et à toute URL que vous collez, puis
   les récupérer via un **serveur MCP local et gratuit** (`fetcher-mcp`, Playwright +
   Readability). Optionnel — inactif sauf si vous cochez **« Inspiration live »**.
2. **Distiller** chaque page en une *InspirationCard* structurée (palette, adjectifs
   de style, grammaire de mise en page, notes de mouvement, clichés à éviter) — du vocabulaire et
   de la grammaire seulement, jamais la copie d'un design particulier.
3. **Rédiger un Design Dossier** — un **sur-ensemble de `DESIGN.md`** avec un concept,
   une palette de jetons, une grammaire de mise en page, un langage de mouvement, **de vrais textes rédigés dans
   votre langue** (titre, sous-titre, arguments, libellés de boutons d'action, pied de page) et
   un plan d'imagerie. Il cite quelle référence a motivé quel choix, et une
   autocritique de singularité révise tout ce qui serait trop générique.
4. **Générer l'imagerie** — une image de héros via un fournisseur sans clé, injectée dans
   la maquette et servie depuis l'origine de Mocky elle-même.

Le Dossier pilote la génération en tant qu'autorité de design — mais pour le
**projet**, pas pour ce seul écran. Le premier rédigé devient la direction du
projet et est ensuite réutilisé tel quel ; les exécutions suivantes écrivent
toujours un dossier, pour le plan d'imagerie, et il ne décide plus de l'allure du
projet. Le réécrire est un geste explicite : **Nouvelle direction** dans le
composer, ou « Faire de cet écran mon DESIGN.md ». **Muse désactivé ⇒ la
génération est identique octet pour octet à ce qu'elle était avant.** Muse a
besoin du backend en fonctionnement (il ne fait rien en mode `localStorage` pur).

### Fournisseurs d'images

> **Pourquoi c'est ainsi —** Une clé d'images est un identifiant qui appartient à l'instance et non à une personne : un administrateur la saisit une fois et elle est conservée là où aucun navigateur ne peut la relire — ce qui laisse la vérification sans raccourci économique, puisque la seule preuve qu'une clé fonctionne est une image qu'elle a produite. Le tableau est mené par l'option qui ne demande aucun compte du tout, afin que la fonctionnalité ait un état opérationnel avant même que quiconque se soit inscrit où que ce soit, et un fournisseur qui échoue en cours de route vous coûte un emplacement plutôt que l'écran auquel il était destiné.

Choisissez le fournisseur dans **Administration → Génération d'images (Muse)**. Les clés sont stockées sur
le serveur et jamais renvoyées au navigateur ; un bouton **Test** génère réellement
une image jetable, pour que vous sachiez que cela fonctionne. Si un fournisseur échoue, Muse se rabat sur des
images de remplacement plutôt que d'interrompre la génération.

| Fournisseur | Clé ? | Notes |
|---|---|---|
| `pollinations` | ❌ aucune | Par défaut. Gratuit, piloté par URL ; peut apposer un filigrane. Limité en débit (~1 req/15 s), les requêtes sont donc mises en file d'attente côté serveur. Un jeton gratuit optionnel relève la limite. |
| `fal` | ✔ | [fal.ai](https://fal.ai) — FLUX et consorts. Choisissez n'importe quel identifiant de modèle (`fal-ai/flux/schnell`, `fal-ai/flux/dev`, `fal-ai/flux-pro/v1.1`…). Préférez un modèle rapide : c'est le point d'accès synchrone qui est utilisé. C'est aussi le seul fournisseur capable de produire de la **vidéo** — voir plus bas. |
| `openai-image` | ✔ | Tout point d'accès exposant `POST {baseUrl}/v1/images/generations` — OpenAI (`gpt-image-1`, `dall-e-3`), LiteLLM, passerelles compatibles. |
| `cloudflare-workers-ai` | ✔ | Palier gratuit généreux. Nécessite un identifiant de compte + un jeton d'API avec la permission Workers AI. |
| `sd-webui` | ❌ | Votre propre instance **Automatic1111 / Forge / SD.Next** (démarrée avec `--api`). Aucune clé, aucune limite de débit, rien ne quitte votre machine. |
| `none` | — | Muse s'exécute quand même ; les emplacements reçoivent des aplats issus de la palette. |

> L'URL de base de `sd-webui` est appelée par le serveur Mocky lui-même et est censée
> être une adresse locale : elle contourne donc délibérément la protection contre le SSRF
> appliquée aux URL non fiables. Seul un administrateur peut la définir — pointez-la vers une instance de confiance.

Chaque image générée est enregistrée dans une **bibliothèque globale** (`data/image-library/`),
dédoublonnée par empreinte de contenu, réutilisable d'un projet à l'autre. Parcourez-la depuis
l'onglet **Média** — images et séquences au défilement côte à côte : recherche, filtrage,
favoris, téléchargement, « Tout télécharger » (ZIP + `manifest.json`), et **épinglage**
d'images pour la génération suivante (les images épinglées remplissent les emplacements avant qu'aucune nouvelle image ne soit
générée). Supprimer un projet ne supprime jamais les médias de la bibliothèque ; seule une
suppression explicite le fait.

### Vos propres images et clips

> **Pourquoi c'est ainsi —** Tout ce que vous importez est ensuite redistribué par Mocky lui-même, ce qui signifie qu'un navigateur lui accorde la confiance qu'il réserve à l'application — d'où une liste des formats autorisés énumérée à l'avance plutôt qu'un filtrage après coup, et l'exclusion d'un format capable de s'exécuter, aussi ressemblant à une image soit-il. Envoyer les octets bruts en corps de requête, au lieu de les envelopper dans un formulaire, est ce qui permet à un seul contrôle d'accepter deux types de médias très différents sans que le serveur n'acquière de dépendance d'analyse pour l'un ou pour l'autre.

La même page **Média** importe les fichiers que vous possédez déjà. Un seul bouton accepte les deux
types et aiguille selon le type du fichier lui-même — le fichier *est* le corps de la requête, sans
multipart et sans dépendance d'envoi. Le SVG est refusé, comme tout ce qui ne figure pas
sur la liste d'autorisation : c'est une image, elle transporte du script, et elle serait redistribuée
depuis l'origine de Mocky elle-même.

Un clip importé n'a besoin **que de ffmpeg** — aucun fournisseur, aucune clé, aucun coût. Une
instance qui n'a jamais configuré fal peut donc utiliser toute la fonctionnalité de vidéo au
défilement avec ses propres images.

### Muse conçoit *à partir de* vos médias

> **Pourquoi c'est ainsi —** Cette section existe parce que l'échec que les gens rencontrent réellement consiste à choisir une image puis à voir le résultat l'ignorer, et cet échec a deux causes distinctes. La première est une question de capacité — une instance auto-hébergée peut très bien faire tourner un modèle dépourvu d'yeux — d'où des couleurs calculées arithmétiquement à partir du fichier plutôt que demandées avec des mots. La seconde est une question de déférence : un modèle à qui l'on remet à la fois votre image et une palette suggérée vous remerciera pour l'image et utilisera la palette, si bien que les valeurs mesurées doivent être déclarées comme primant sur tout le reste dans le prompt.

Sélectionner une image ou une séquence ne se contente pas de remplir un emplacement : le média est lu **avant**
que le Design Dossier ne soit rédigé, et le dossier est bâti autour de lui. Deux canaux,
parce qu'ils échouent différemment :

- la **palette est mesurée sur les pixels** — exacte, et cela fonctionne avec tous les
  modèles. Demander à un modèle de vision de décrire les couleurs échoue deux fois : la moitié
  des modèles que les gens auto-hébergent n'ont aucune vision, et ceux qui en ont renvoient
  des *noms* (« terracotta chaleureux ») qu'il faut ensuite deviner pour retrouver un hexadécimal.
- l'**image elle-même** n'est jointe que si le modèle peut voir, et elle transporte
  ce qu'un histogramme ne peut pas : le sujet, la composition, la densité, la lumière.

Les hexadécimaux mesurés sont déclarés comme **prioritaires** sur les palettes suggérées par
les motifs appariés et par les références. Sans cette phrase, le modèle prend poliment acte
de l'image puis utilise malgré tout l'indigo du motif — c'est-à-dire exactement l'échec que cette
fonctionnalité existe pour corriger.

### Vidéo au défilement

> **Pourquoi c'est ainsi —** Parcourir un clip au défilement lui demande un accès aléatoire, ce qui est précisément le point faible de la compression dans laquelle il est livré, et cela demande à l'aperçu de faire tourner un flux média, une permission dont ce cadre verrouillé n'a par ailleurs pas besoin. Transformer le clip en images fixes numérotées répond aux deux objections d'un coup, au prix de l'espace disque. L'option reste inactive par défaut parce que c'est la seule partie de Muse facturée à l'usage, et ses deux prérequis sont rapportés séparément pour qu'un refus vous dise lequel aller corriger.

Muse peut aussi générer un **clip pour le héros** et laisser le visiteur le parcourir
à la molette — le clip avance image par image, épinglé en pleine hauteur,
et repart en arrière quand on remonte. Cochez **Vidéo au défilement** dans le panneau
Muse ; l'option est inactive par défaut, car contrairement à toutes les autres options de Muse elle coûte
de l'argent à chaque usage et ajoute des minutes à une génération.

Deux prérequis, rapportés séparément dans **Administration → Génération d'images → Vidéo**
pour que vous sachiez lequel manque :

| | |
|---|---|
| Un fournisseur vidéo | `fal` uniquement, pour l'instant — aucun des autres fournisseurs configurés n'expose de point d'accès texte-vers-vidéo. N'importe quel identifiant de modèle fal fonctionne (`fal-ai/ltx-video` par défaut) ; les modèles plus lents donnent de meilleurs plans. |
| `ffmpeg` | Fourni dans l'image Docker. Depuis les sources, installez-le vous-même — sans lui l'option reste grisée et le dit. |

**Le clip n'est jamais lu comme une vidéo.** ffmpeg le découpe en une séquence de JPEG
(12 images/s, 960 px, plafonnée à 150 images) et l'écran les dessine sur un canvas.
Deux raisons : chercher une position dans un MP4 à compression inter-images depuis un gestionnaire de défilement
saccade beaucoup, et des images sont des *images* — l'aperçu sous bac à sable n'a donc besoin d'aucune source média
et sa CSP reste inchangée.

Les séquences vivent dans `data/video-library/`, adressées par le SHA-256 du clip, et
une requête identique réutilise la séquence au lieu de la payer deux fois. Seuls les octets des
images sont publics (un iframe d'aperçu a une origine opaque et n'envoie aucun cookie) ;
générer, lister et supprimer exigent tous une session.

### Serveurs MCP

> **Pourquoi c'est ainsi —** Lire une page de design en direct telle qu'une personne la voit exige un véritable moteur de rendu, et en souder un dans l'application ferait porter ce poids à chaque installation, que l'inspiration serve ou non. Le traiter comme un programme séparé, auquel on parle via un protocole standard, garde ce poids à l'extérieur — et demander au registre une capacité plutôt qu'un nom de programme est ce qui permet d'en substituer un autre en éditant un fichier. Quand rien ne répond, la génération se poursuit avec la matière que Mocky embarque déjà.

Les serveurs MCP locaux sont déclarés dans [`mocky.mcp.json`](mocky.mcp.json) et lancés
par le backend via stdio — tous locaux, gratuits, open source. Remplacez-y ou ajoutez-y des serveurs
sans toucher au code (le routeur apparie des *rôles* sémantiques au serveur qui expose
un outil correspondant). L'état de santé se trouve sur `GET /api/mcp/status`. L'image Docker
embarque `fetcher-mcp` + Chromium pour que l'inspiration en direct fonctionne d'emblée ;
si cette couche est écartée, Muse se rabat sur la bibliothèque hors ligne de motifs de prompt.

### Higgsfield (procédure manuelle)

> **Pourquoi c'est ainsi —** Chaque étape automatisée de Mocky passe par une interface qu'une instance auto-hébergée peut appeler d'elle-même, sans intervention humaine ; là où aucune interface de ce genre n'est offerte à des conditions gratuites, un bouton serait une promesse que le logiciel ne peut pas tenir. Prendre en charge la voie manuelle ne coûte rien de plus, parce que la bibliothèque de médias ne fait aucune différence entre un fichier produit par Mocky et un fichier que vous y avez apporté.

Higgsfield.ai n'a pas d'API gratuite, il n'est donc pas intégré. Pour l'utiliser : générez une
image sur Higgsfield, téléchargez-la, puis déposez-la dans la bibliothèque d'images de Mocky (ou dans un
projet) et épinglez-la — Muse s'en servira comme de n'importe quelle autre image.

### Éthique et conditions d'utilisation

> **Pourquoi c'est ainsi —** Apprendre du travail de design publié n'est défendable que si ce que l'on rapporte est de la compréhension et non de la matière : le traitement est donc conçu pour ne rien garder de ce qu'il a regardé — un plafond strict sur le nombre de pages qu'une génération peut consulter, un récupérateur qui décline son identité et obéit aux règles du site, et un cache qui ne peut contenir que des phrases. Le second principe n'a rien à voir avec le droit d'auteur et n'est pas moins ferme : une page tirée du web ouvert est le texte d'un auteur inconnu, elle parvient donc au modèle comme une pièce à résumer, jamais comme une consigne à exécuter.

Muse est conçu pour respecter les sites dont il s'inspire :

- **Aucune collecte de masse.** Il ne récupère que les pages du registre organisé et les URL que vous
  collez, plafonnées à **6 récupérations par génération**, en honorant **`robots.txt`**, avec un
  `User-Agent` honnête (`Mocky-Muse/…`) et un cache de 7 jours **contenant uniquement du texte**, pour maintenir
  la charge basse.
- **Aucune image tierce n'est jamais stockée, mise en cache, relayée ni affichée** —
  seules persistent les images générées par Mocky et les distillations textuelles.
- **Inspiration = jetons + vocabulaire + grammaire structurelle**, jamais la copie d'un
  design particulier.
- **Le contenu web récupéré est traité comme une donnée non fiable**, jamais comme une consigne.
- Toutes les URL sortantes passent une protection contre le SSRF ; le parcours par défaut ne demande **aucune clé d'API,
  aucun compte**.

> Note sur les dépendances : le SDK MCP entraîne quelques paquets transitifs faisant l'objet
> d'avis de sécurité (`hono`, `body-parser`, `shell-quote`, `esbuild`) — tous dans le transport
> serveur HTTP du SDK, que Mocky n'utilise **pas** (nous sommes un client stdio).

## SSO — « Se connecter avec Dashy »

> **Pourquoi c'est ainsi —** Le problème résolu n'est pas l'authentification mais la duplication : quelqu'un qui a déjà prouvé son identité à un service auto-hébergé ne devrait pas avoir à entretenir un second mot de passe pour le suivant. Dashy se charge donc de la preuve et émet une attestation courte et signée du résultat, que Mocky vérifie face à un secret que seuls les deux serveurs détiennent — c'est ce qui rend la copie qu'en garde le navigateur inutilisable pour qui la volerait. Exiger les deux moitiés de la configuration avant que tout cela ne s'active signifie qu'une installation à moitié faite se comporte exactement comme une instance sans SSO.

Mocky peut déléguer l'authentification à une instance [Dashy](https://github.com/PetitOursManu/Dashy), de sorte qu'un utilisateur connecté à Dashy peut se connecter à Mocky en un clic et retrouver ses projets — sans créer de compte Mocky distinct.

C'est un **flux de redirection standard, de type OIDC** ; le secret partagé ne touche jamais le navigateur (le JWT est vérifié côté serveur). Il est **désactivé tant que `SSO_SHARED_SECRET` et `SSO_DASHY_URL` ne sont pas tous deux définis**, et il n'interfère jamais avec la connexion par identifiant et mot de passe existante.

### L'activer

> **Pourquoi c'est ainsi —** Un secret partagé n'est secret que s'il est indevinable : il provient donc d'une source de nombres aléatoires plutôt que d'un clavier, et il est produit par un outil présent partout où l'application elle-même peut tourner — une instruction d'installation qui échoue sur un système d'exploitation est une instruction que l'on saute. Côté fournisseur d'identité, l'adresse de rappel doit être enregistrée à l'avance, sans quoi n'importe qui pourrait demander un jeton en désignant son propre site comme lieu de livraison.

Sur le backend **Mocky**, définissez :

Générez un secret (avec Node plutôt qu'avec `openssl`, qui n'est pas dans le `PATH` standard de Windows) :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Puis, sur le backend **Mocky**, définissez :

```bash
# Le même secret HS256 avec lequel Dashy signe les jetons SSO (doit correspondre au SSO_SHARED_SECRET de Dashy)
SSO_SHARED_SECRET=<la valeur que vous venez de générer>
# L'origine publique de votre instance Dashy
SSO_DASHY_URL=https://dashy.example.com
# L'origine publique de Mocky elle-même (revendication `aud` du jeton, et base de
# l'URL de rappel). En production : votre domaine Mocky. En dev : l'origine Vite.
MOCKY_ORIGIN=https://mocky.example.com        # production
# MOCKY_ORIGIN=http://localhost:5173          # dev (origine de la SPA Vite, PAS :8787)
```

Côté **Dashy** (voir le README de Dashy → *SSO — « Se connecter avec Dashy »*), définissez le même `SSO_SHARED_SECRET` et ajoutez l'adresse de rappel de Mocky à la liste d'autorisation :

```bash
SSO_SHARED_SECRET=<la même valeur que pour Mocky>
SSO_ALLOWED_REDIRECTS=https://mocky.example.com/sso/dashy/callback,http://localhost:5173/sso/dashy/callback
```

### Le déroulé

> **Pourquoi c'est ainsi —** Chaque étape numérotée existe pour rendre vérifiable une partie de l'échange. La valeur aléatoire que le navigateur stocke avant de partir est renvoyée telle quelle par le fournisseur d'identité et comparée au retour : c'est ainsi que la page distingue une connexion qu'elle a initiée d'une connexion qu'elle n'a pas initiée — un contrôle effectué dans le navigateur, après que le serveur a déjà vérifié le jeton et posé le cookie. La durée de vie très courte et l'usage unique font ensemble qu'un jeton recopié depuis un historique de navigation ou un journal de proxy est déjà mort. Et l'appariement sur l'identifiant d'utilisateur propre au fournisseur d'identité, plutôt que sur une adresse e-mail, est ce qui empêche une connexion SSO de s'emparer discrètement d'un compte Mocky qui partagerait la même adresse.

1. Sur l'écran de connexion, Mocky affiche un bouton **Se connecter avec Dashy** (uniquement lorsque le SSO est activé).
2. Un clic dessus stocke un `state` opaque dans le `sessionStorage` et redirige vers `${SSO_DASHY_URL}/api/sso/authorize?redirect_uri=<callback>&state=<state>`.
3. Dashy authentifie l'utilisateur (par sa connexion habituelle, **2FA comprise**), signe un JWT HS256 valable 60 secondes, et redirige vers `${MOCKY_ORIGIN}/sso/dashy/callback?token=<jwt>&state=<state>`.
4. Le backend de Mocky vérifie la signature, `iss === "dashy"`, `aud === MOCKY_ORIGIN`, `exp`, et que le `jti` n'a jamais servi, puis **retrouve ou crée** un compte Mocky lié à l'utilisateur Dashy (par `sub`), pose le cookie de session, et redirige vers `/?sso=ok&state=…`.
5. La SPA vérifie que le `state` renvoyé correspond, restaure la session, et réconcilie les projets avec le serveur — exactement comme lors d'une connexion normale.

Les comptes créés uniquement par SSO **n'ont pas de mot de passe** et ne peuvent se connecter que via Dashy. Les utilisateurs `admin` de Dashy deviennent `admin` sur Mocky. Les comptes Mocky existants ne sont jamais liés automatiquement (le lien ne se fait que par `dashySub`, que seuls les comptes créés par SSO portent).

### Contrat du jeton

> **Pourquoi c'est ainsi —** Les revendications sont publiées parce qu'un jeton ne vaut que ce que vaut l'accord sur ce qu'il doit contenir : chaque champ listé est un champ que le récepteur contrôle et sur lequel il peut refuser, ce qui est précisément ce qui empêche un jeton parfaitement valide, émis pour une autre application, d'être rejoué contre celle-ci. La durée de vie très courte applique la même idée au temps — la fenêtre pendant laquelle un jeton intercepté vaut quelque chose se compte en secondes.

Signé avec `SSO_SHARED_SECRET` (HS256), durée de vie de 60 s. Revendications : `sub` (identifiant Dashy stable de l'utilisateur), `email`, `name?`, `role`, `iss="dashy"`, `aud=<origine de Mocky>`, `iat`, `exp`, `jti`. Le jeton ne prouve que l'identité ; il n'accorde **aucun** accès à l'API de Dashy elle-même.

## Notes

> **Pourquoi c'est ainsi —** Ce sont les conséquences de décisions prises ailleurs dans le document, rassemblées ici parce que chacune répond à une question qui ne surgit qu'une fois la chose réellement en fonctionnement : quelle clé a payé une génération, quel modèle a vu votre image, pourquoi une adresse locale est laissée passer par une protection qui existe pour bloquer les adresses locales. Aucune ne change la manière d'utiliser Mocky ; toutes changent ce à quoi il faut s'attendre quand quelque chose se comporte d'une façon que vous n'aviez pas prévue.

- **Fournisseur de modèle — deux modes.** Par défaut, la clé d'API ne quitte jamais votre navigateur (Réglages propres à chaque utilisateur). En option, un **administrateur peut configurer des fournisseurs de texte pour toute l'instance** (Administration → *Modèles de texte*) : Ollama Cloud, OpenAI, OpenRouter, fal.ai, ou n'importe quel point d'accès compatible OpenAI (Groq, Together, DeepSeek, Mistral, LM Studio, vLLM…). Dans ce mode la clé est stockée **sur le serveur** et utilisée par tous les comptes de l'instance, et les Réglages propres à chaque utilisateur sont ignorés. Laissez le fournisseur sur *Aucun* pour conserver le comportement limité au navigateur.
- **Deux profils de texte.** *Génération* écrit les écrans et fait tourner le planificateur — c'est aussi le modèle qui reçoit l'image d'inspiration ✨, donc celui dont la vision est testée. *Inspiration* alimente le Design Dossier de Muse ; il n'écrit pas de code, un modèle moins coûteux suffit donc. Le laisser sur *Aucun* lui fait réutiliser le modèle de génération. En interne, le profil voyage dans un en-tête `x-mocky-profile`, si bien que les appelants non étiquetés obtiennent toujours *génération*.
- Mocky parle toujours le **dialecte Ollama** en interne ; le proxy vers le fournisseur traduit vers et depuis les API compatibles OpenAI (forme de la requête, `response_format`, pièces jointes pour la vision, et flux SSE → NDJSON), de sorte que la génération, le planificateur et Muse restent indépendants du fournisseur.
- Un point d'accès configuré par un administrateur peut légitimement être une adresse locale (un modèle sur `127.0.0.1`) : il contourne donc la protection contre le SSRF, qui reste appliquée à toute URL fournie par un navigateur.
- Le proxy vers le fournisseur tourne comme middleware Vite en développement et dans le backend Express en production (afin que le navigateur n'atteigne jamais le fournisseur depuis une autre origine). Les deux proxys partagent la même logique de transfert protégée contre le SSRF.
- Le stockage du backend vit dans `server/data/` (fichiers JSON, ignorés par git) — comptes et projets par utilisateur. Les écritures sont atomiques (fichier temporaire + renommage), de sorte qu'un plantage ne laisse jamais un fichier corrompu. C'est un stockage auto-hébergé léger ; pour un déploiement multi-utilisateur durci, on le remplacerait par une vraie base de données et on ajouterait HTTPS.
- Les secrets du SSO vivent dans un fichier `.env` (ignoré par git). `server/index.js` le lit automatiquement au démarrage, pour vous éviter une dépendance de plus.

---

<p align="center"><sub>Réalisé avec <a href="https://claude.com/claude-code">Claude Code</a>.</sub></p>
