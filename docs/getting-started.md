# Démarrage

## Prérequis

Docker, **ou** Node ≥ 20.19 (`.nvmrc` épingle la majeure 20, celle de l'image
`node:20-slim`). Rien d'autre : pas de base de données, pas de module natif.

`ffmpeg` est le seul binaire externe, et il ne sert qu'à la vidéo au défilement.
Sans lui, tout le reste fonctionne et la fonctionnalité se déclare indisponible
plutôt que d'échouer.

---

## Installation

### Docker (recommandé)

```bash
git clone https://github.com/PetitOursManu/Mocky.git
cd Mocky
docker compose up -d --build
```

Mocky écoute sur **http://localhost:8787**. Les données (comptes, sessions,
projets, images, séquences vidéo) persistent dans le volume nommé `mocky-data`.

Le port est publié sur `127.0.0.1` uniquement — c'est
`"${MOCKY_BIND:-127.0.0.1}:8787:8787"` dans `docker-compose.yml`. Plusieurs
routes dépensent vos crédits modèle, donc l'instance n'est pas jointe depuis le
réseau tant que vous ne le demandez pas explicitement. Voir
[Déploiement](deployment.md#exposer-linstance).

### Développement local

```bash
npm install
npm run dev:all        # Vite + backend ensemble — c'est celui-là qu'il faut
```

Puis **http://localhost:5173**.

`npm run dev` lance **le serveur web seul**. Comme Mocky exige un compte et que
les comptes vivent sur le backend, la boîte de connexion annoncera qu'elle ne
peut pas le joindre. Muse, la bibliothèque média et la synchronisation sont dans
le même cas.

En développement, Vite proxifie `/api` et `/sso` vers `http://localhost:8787`, et
sert lui-même `/__provider` via un middleware qui partage le code du backend
(`server/provider-proxy.js`) — voir `vite.config.ts`. Les deux environnements
appliquent donc exactement la même garde SSRF et la même liste blanche de
sous-chemins.

### Build de production

```bash
npm run build          # tsc && vite build  →  dist/
npm start              # le backend sert dist/ + l'API + le proxy sur :8787
```

`npm start` sans `npm run build` démarre bien, mais chaque page est un 404 nu.
Le serveur affiche un avertissement au démarrage, et `/api/health` répond `503`
avec `frontendBuilt: false` — c'est ce que la sonde du conteneur interroge.

---

## Première utilisation

1. Ouvrez Mocky. La boîte de connexion apparaît et **ne peut pas être fermée** :
   il n'existe pas de mode anonyme.
2. Créez le premier compte. **Il devient administrateur de l'instance**
   (`server/index.js` : `const isFirst = users.length === 0`). Il n'y a pas de
   flux « mot de passe oublié » ; promouvoir un autre compte se fait en éditant
   `server/data/users.json` à la main.
3. Configurez un modèle de texte (section suivante).
4. Décrivez un écran et générez.

Quelques règles de compte utiles à connaître :

| Règle | Valeur | Où |
|---|---|---|
| Longueur minimale du nom d'utilisateur | 3 | `POST /api/register` |
| Mot de passe à l'inscription publique | ≥ 6 | historique, jamais durci pour ne verrouiller personne |
| Mot de passe créé ou réinitialisé aujourd'hui | ≥ 8 | `MIN_NEW_PASSWORD` |
| Durée de session | 90 jours, glissante | `SESSION_TTL_MS` |
| Limitation des routes d'authentification | 8 tentatives / minute / IP | `authRateLimit(8)` |

Le hachage est `scrypt` (`node:crypto`), la comparaison est en temps constant, et
un changement de mot de passe **révoque toutes les sessions**, y compris la
courante — à laquelle un jeton neuf est immédiatement délivré.

---

## Configurer un modèle de texte

Deux modes, mutuellement exclusifs. Le mode instance gagne toujours sur le mode
navigateur.

### A. Par navigateur (défaut, la clé ne quitte pas la machine)

**Réglages** → fournisseur `Ollama Cloud`, URL de base `https://ollama.com`,
votre clé d'API, puis un modèle dans la liste et **Tester la connexion**.

La clé est conservée dans le `localStorage` de ce navigateur
(`mocky.settings.v1`) et n'est jamais écrite côté serveur. Elle transite par
`/__provider` en en-tête `Authorization`, le temps de la requête.

`src/lib/settings.ts` ne propose qu'un fournisseur dans ce mode : Ollama Cloud.
Le catalogue complet est réservé au mode instance.

### B. Instance entière (administrateur)

**Admin** → *Modèles de texte*. La clé est stockée côté serveur
(`server/data/text-config.json`), utilisée par tous les comptes, et les Réglages
personnels de chacun sont alors ignorés.

`server/text/config.js` déclare cinq fournisseurs :

| id | Dialecte | URL de base par défaut | Modèle par défaut |
|---|---|---|---|
| `ollama-cloud` | Ollama | `https://ollama.com` | `gpt-oss:120b` |
| `openai` | OpenAI | `https://api.openai.com` | `gpt-4o-mini` |
| `openrouter` | OpenAI | `https://openrouter.ai/api` | `openai/gpt-4o-mini` |
| `fal` | OpenAI, auth `Key` | `https://fal.run/openrouter/router/openai` | `openai/gpt-4o-mini` |
| `openai-compatible` | OpenAI | *(à saisir)* | *(à saisir)* |

`openai-compatible` couvre Groq, Together, DeepSeek, Mistral, LM Studio, vLLM —
tout ce qui expose `POST {baseUrl}/v1/chat/completions`.

#### OpenRouter, concrètement

1. **Admin** → *Modèles de texte* → profil **Génération** → fournisseur
   `OpenRouter`.
2. URL de base : `https://openrouter.ai/api` — **sans** `/v1`. La traduction de
   dialecte ajoute elle-même `/v1/chat/completions` ; un `/v1` en trop donne un
   404 sur `/v1/v1/chat/completions`.
3. Clé d'API : votre `sk-or-…`, envoyée en `Authorization: Bearer …`.
4. Modèle : l'identifiant OpenRouter complet, `vendor/model` — par exemple
   `openai/gpt-4o-mini`, `anthropic/claude-3.5-sonnet`,
   `google/gemini-2.5-flash`.
5. **Tester** envoie une vraie requête (« Reply with the single word: ok ») à
   travers la même traduction que l'application, et distingue trois échecs :
   HTTP non-2xx, réponse vide d'un modèle « reasoning » qui a dépensé son budget
   à réfléchir, et coupure par `finish_reason: length`.

Un HTTP 200 sans texte visible **n'est pas un succès** et le test le dit : ce
modèle produirait des écrans vides.

> **Piège fréquent.** Coller un identifiant de modèle d'**images** dans le champ
> texte. C'est facile avec fal, qui vend les deux sous une seule clé. Le
> fournisseur répond « is not a valid model ID », ce qui n'explique rien ;
> `looksLikeImageModel()` détecte le motif (`text-to-image`, `flux`, `seedream`,
> `sdxl`, `dall-e`, `veo`, `kling`…) et affiche un message qui nomme le problème.

#### Les deux profils de texte

| Profil | Rôle | Recevant l'image |
|---|---|---|
| `generation` | écrit les écrans, exécute le planificateur | oui — c'est lui qui est sondé pour la vision |
| `inspiration` | rédige le Dossier de design de Muse | seulement s'il est sondé explicitement |

Le profil voyage en en-tête `x-mocky-profile: inspiration` ; tout le reste,
en-tête absent compris, est `generation`. Laisser le profil `inspiration` vide le
fait retomber sur `generation`, ce qui est le comportement mono-modèle
d'origine. Le dossier n'écrit pas de code : un modèle moins cher y suffit
généralement.

Les configurations écrites avant l'introduction des profils sont un objet plat ;
`liftLegacy()` les remonte dans `generation` à la lecture, clés intactes.

### Ce que le proxy accepte

`/__provider` ne relaie que deux sous-chemins :

```js
export const ALLOWED_SUBPATHS = new Set(['/api/chat', '/api/tags'])
```

C'est une liste blanche, pas un filtre. Avant elle, un
`DELETE /__provider/api/delete` avec `{"name":"llama3"}` atteignait l'Ollama
configuré et **supprimait un modèle** : la réécriture de corps ne remplace que
`model`, donc `name` passait intact.

Les redirections ne sont pas suivies (`redirect: 'manual'`) : une cible qui passe
la garde SSRF puis répond `302 → http://169.254.169.254/…` contournerait
autrement toute la protection.

---

## Configurer la génération d'images (Muse)

**Admin** → *Génération d'images (Muse)*. Les clés sont stockées côté serveur et
ne repartent jamais vers le navigateur — `publicView()` les remplace par des
booléens `hasApiKey` / `hasToken`. Le bouton **Tester** génère réellement une
image jetable (une pomme rouge sur fond blanc, 1024×1024) et ne la range pas dans
la bibliothèque.

| Fournisseur | Clé ? | Notes |
|---|---|---|
| `pollinations` | ❌ | Défaut. Gratuit, basé sur URL, filigrane possible. Limite ≈ 1 requête / 15 s, donc les requêtes sont sérialisées côté serveur. Un jeton gratuit facultatif relève la limite. |
| `fal` | ✔ | [fal.ai](https://fal.ai) — FLUX & co. Endpoint synchrone : préférez un modèle rapide. Seul fournisseur capable de **vidéo**. |
| `openai-image` | ✔ | Tout endpoint exposant `POST {baseUrl}/v1/images/generations` (OpenAI, LiteLLM, passerelles compatibles). |
| `cloudflare-workers-ai` | ✔ | Palier gratuit généreux. Demande un identifiant de compte et un jeton avec la permission Workers AI. |
| `sd-webui` | ❌ | Votre propre Automatic1111 / Forge / SD.Next lancé avec `--api`. Rien ne sort de votre machine. |
| `none` | — | Muse tourne quand même ; les emplacements reçoivent des aplats issus de la palette. |

Deux profils d'images, pour deux métiers différents :

- **`content`** — les images réellement posées dans l'écran (héros, produits,
  fonds). Rapide et bon marché, plusieurs par écran. C'est le chemin historique,
  zéro configuration.
- **`inspiration`** — l'unique planche de direction artistique montrée au modèle.
  Elle doit convaincre, donc elle vaut un modèle plus lent et plus cher. Laisser
  son fournisseur vide la fait retomber sur `content`.

> `sd-webui` est appelé par le serveur de Mocky et pointe par construction vers
> une adresse locale : il **contourne délibérément** la garde SSRF appliquée aux
> URL non fiables. Seul un administrateur peut le régler.

## Vidéo au défilement

Deux prérequis indépendants, rapportés séparément dans **Admin → Génération
d'images → Vidéo** pour qu'on sache lequel manque — ils se réparent à des
endroits complètement différents :

| Prérequis | Détail |
|---|---|
| Un fournisseur vidéo | `fal` uniquement. Aucun autre fournisseur configuré n'a d'endpoint texte→vidéo. Modèle par défaut `fal-ai/ltx-video`. |
| `ffmpeg` | Fourni dans l'image Docker. Depuis les sources, à installer soi-même. |

`GET /api/videos/availability` renvoie `reason: 'no-provider' | 'no-key' |
'no-ffmpeg' | null`, ordonné par ce qu'il faut corriger en premier.

**Importer son propre clip ne demande que `ffmpeg`** — aucun fournisseur, aucune
clé, aucun coût. Une instance qui n'a jamais configuré fal peut donc utiliser
toute la fonctionnalité avec ses propres rushes.

---

## Serveurs MCP

Les serveurs MCP locaux sont déclarés dans `mocky.mcp.json` à la racine et lancés
par le backend en stdio. Le fichier livré ne déclare qu'un serveur :

```json
{
  "mcpServers": {
    "fetcher": {
      "command": "npx",
      "args": ["-y", "fetcher-mcp"],
      "autoStart": false,
      "role": "inspiration-fetch",
      "idleTimeoutMs": 300000
    }
  }
}
```

Le routeur associe des **rôles** sémantiques aux serveurs qui exposent un outil
correspondant, ce qui permet d'en changer sans toucher au code. Santé :
`GET /api/mcp/status`. Détails dans
[Moteur d'inspiration](muse/inspiration-engine.md#lhôte-mcp).

Un fichier absent ou invalide n'est jamais fatal : il donne une liste de serveurs
vide, et Muse retombe sur sa bibliothèque de patterns hors ligne.

---

## Entretien

```bash
npm run backup         # → backups/mocky-YYYY-MM-DD-HHmm.zip
npm run backup -- <dir>  # écrit ailleurs
npm run check:vendor   # vérifie les bundles vendorisés contre leurs empreintes
npm test               # vitest run — la suite complète
npm run test:watch
```

`npm run backup` est du Node pur (il réutilise l'écrivain ZIP sans dépendance du
dépôt) et se comporte identiquement sous Windows, macOS et Linux. Pour une
instance dockerisée, sortez d'abord les données du volume :

```bash
docker compose cp mocky:/app/server/data ./server/data
npm run backup
```

L'archive contient des empreintes de mots de passe et des jetons de session.
`backups/` est ignoré par git — qu'il le reste.

---

## Diagnostic

| Symptôme | Cause probable |
|---|---|
| Toutes les pages en 404, l'API répond | `npm start` sans `npm run build`. `/api/health` le dit : `frontendBuilt: false`. |
| « Sign in » ne joint pas le backend | `npm run dev` au lieu de `npm run dev:all`. |
| `EADDRINUSE` au démarrage | Un autre Mocky sur le port. `MOCKY_PORT=8788 npm start`. |
| Neuf échecs de connexion bloquent toute l'instance | Reverse proxy sans `TRUST_PROXY=1` : toutes les requêtes semblent venir de `127.0.0.1`, donc la limitation devient un seau unique. |
| HTTP 401/403 du fournisseur | Clé absente ou invalide. En mode instance, la clé du navigateur est ignorée — c'est celle de l'admin qui compte. |
| Écran coupé au milieu d'une chaîne | Le modèle a atteint son plafond de sortie. Mocky le détecte (`done_reason` / `finish_reason` `length`) et l'annonce au lieu de laisser une erreur de syntaxe cryptique. |
| Aperçu blanc, console pleine d'erreurs CORS `origin 'null'` | La maquette a tenté de naviguer hors d'elle-même. Le parent recharge le `srcdoc` et affiche « les liens sont inertes ». |
| Muse ne fait rien | Muse exige le backend. En mode `localStorage` pur, l'interrupteur est masqué. |
