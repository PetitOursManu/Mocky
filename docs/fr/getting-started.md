# Démarrage

## Prérequis

Docker, **ou** Node ≥ 22.12. Le fichier `.nvmrc` fixe la version 22.12, celle
qu'utilise l'image `node:22-slim`. Le plancher est passé de 20 à 22 avec la
passe de qualité : son détecteur exige Node 22.12+, et Node 20 est sorti du
support en avril 2026.

Il n'y a ni base de données, ni module natif à compiler.

`ffmpeg` est le seul binaire externe, et il ne sert qu'à la vidéo au défilement.
Sans lui, tout le reste fonctionne, et cette fonctionnalité-là se déclare
indisponible au lieu d'échouer.

---

## Installation

### Docker

```bash
git clone https://github.com/PetitOursManu/Mocky.git
cd Mocky
docker compose up -d --build
```

Mocky écoute sur **http://localhost:8787**. Les comptes, les projets, les images
et les séquences vidéo sont conservés dans le volume `mocky-data`.

Le port n'est publié que sur `127.0.0.1`. Plusieurs routes dépensent vos crédits
de modèle, donc l'instance n'est pas joignable depuis le réseau tant que vous ne
l'avez pas demandé. Voir [Déploiement](fr/deployment.md).

### Développement local

```bash
npm install
npm run dev:all
```

Puis ouvrez **http://localhost:5173**.

Utilisez `dev:all`, pas `dev`. `npm run dev` ne lance que le serveur web, sans le
back-end. Or Mocky exige un compte, et les comptes vivent sur le back-end : la
boîte de connexion annoncera qu'elle ne peut pas le joindre. Muse, la
bibliothèque média et la synchronisation sont indisponibles dans ce mode aussi.

En développement, Vite renvoie `/api` et `/sso` vers `http://localhost:8787`, et
sert lui-même `/__provider` par un middleware qui importe le module du back-end
(`server/provider-proxy.js`). Les deux environnements appliquent donc la même
protection contre le SSRF et la même liste de sous-chemins autorisés.

### Compilation de production

```bash
npm run build          # tsc && vite build  →  dist/
npm start              # Express sert dist/, l'API et le proxy sur :8787
```

`npm start` sans `npm run build` démarre bien, mais chaque page est un 404 nu. Le
serveur affiche un avertissement, et `/api/health` répond `503` avec
`frontendBuilt: false`. C'est ce que lit la sonde de santé du conteneur.

---

## Première utilisation

![La manchette de Mocky : navigation, thème, compte](../assets/01-header.png)

*La manchette est la même partout : les sections à droite, puis le thème et votre compte.*

1. Ouvrez Mocky. La boîte de connexion apparaît et **ne peut pas être fermée**.
   Il n'existe pas de mode anonyme.
2. Créez le premier compte. **Il devient l'administrateur de l'instance.** Il n'y
   a pas de procédure de mot de passe oublié, et promouvoir un autre compte se
   fait en éditant `server/data/users.json` à la main.
3. Configurez un modèle de texte. Voir la section suivante.
4. Décrivez un écran et générez-le.

![Le composer : format, design, Muse, animations, demande](../assets/09-composer.png)

*Le composer. Le format d’abord, puis les trois interrupteurs qui décident de ce que reçoit le modèle — la direction de design, Muse, et le mouvement.*

Un projet garde **une seule** direction de design, pour que ses écrans aient
l’air d’un produit et non de cinq esquisses. Elle est fixée par le premier écran
généré, puis laissée tranquille. **Nouvelle direction** est l’exception : cochez
la case et la demande que vous vous apprêtez à envoyer réécrit la direction pour
tous les écrans suivants. Elle se décoche toute seule une fois cet écran généré —
c’est un geste ponctuel, pas un mode.

Deux autres choses voyagent d’un écran à l’autre sans qu’on ait à le demander :
le **nom** du produit et son **logo**. Une direction décrit une palette et une
voix, donc rien en elle n’empêchait un deuxième écran d’inventer une deuxième
marque — c’est précisément ce qui arrivait, jusqu’à ce que le premier écran soit
montré au modèle comme l’identité à respecter. La navigation, les sections et la
mise en page restent libres ; épinglez un écran comme référence de mise en page
(clic droit sur un écran) si vous voulez les figer aussi.

Deux boutons de la barre de zoom naviguent à votre place. **Tout afficher** cadre
tous les écrans et — c’est la partie qui mérite d’être connue — *continue* de le
faire : ouvrez un panneau, redimensionnez la fenêtre, tournez une tablette, et le
plan se recadre tout seul. Jusqu’à ce que vous vous déplaciez ou zoomiez à la
main, geste qui vous rend la vue pour de bon. **Zoomer sur le dernier écran**
saute vers celui que vous venez de générer, qui n’est pas forcément celui que
vous avez sélectionné. Les deux sont dans
[L’interface](fr/interface.md#la-barre-de-zoom), avec le reste de la barre.

![L'accueil : la liste des projets](../assets/02-home-projects.png)

*L'accueil après une première génération. Le projet le plus récent est « à la une », avec sa vignette ; les projets sans écran sont regroupés en bas.*

### Les règles de compte

| Règle | Valeur |
|---|---|
| Longueur minimale du nom d'utilisateur | 3 caractères |
| Mot de passe à l'inscription publique | 8 caractères (`MIN_NEW_PASSWORD`) |
| Mot de passe créé ou réinitialisé aujourd'hui | 8 caractères (`MIN_NEW_PASSWORD`) |
| Durée d'une session | 90 jours, glissante |
| Limite sur les routes d'authentification | 8 tentatives par minute et par IP |

Les trois chemins exigent désormais la même longueur. L'inscription publique
acceptait six caractères — c'était le seul chemin qu'un attaquant peut atteindre
sans session, et sur une instance vierge le compte qu'il crée est
l'administrateur.

Les inscriptions publiques **se ferment d'elles-mêmes** une fois le premier
compte créé. Un administrateur les rouvre depuis l'écran Admin s'il veut inviter
quelqu'un.

Les mots de passe sont hachés avec `scrypt` (`node:crypto`) et comparés en temps
constant. Changer un mot de passe **révoque toutes les sessions**, y compris
celle en cours, qui reçoit immédiatement un jeton neuf.

---

## Configurer un modèle de texte

Il y a deux modes, et ils s'excluent. Le mode instance l'emporte toujours sur le
mode navigateur.

### Mode A — par navigateur (le défaut)

Allez dans **Réglages**, choisissez `Ollama Cloud`, mettez
`https://ollama.com` comme URL de base, collez votre clé d'API, choisissez un
modèle et cliquez sur **Tester la connexion**.

La clé est conservée dans le `localStorage` de ce navigateur, sous
`mocky.settings.v1`. Elle n'est jamais écrite côté serveur. Elle traverse
`/__provider` en en-tête `Authorization`, le temps de chaque requête.

![L'écran Réglages : fournisseur, URL de base, clé, modèle](../assets/05-settings.png)

*Réglages. C’est le mode par navigateur : la clé ne quitte pas cette machine.*

Ce mode proposait autrefois un seul fournisseur, Ollama Cloud — non pas parce
que les autres ne pouvaient pas fonctionner, mais parce que le navigateur ne
disait jamais au serveur quel dialecte parlait son endpoint. Il le dit
maintenant (en-tête `x-provider-kind`), et `src/lib/settings.ts` offre la même
liste que l'écran Admin.

### Mode B — pour toute l'instance (administrateur)

Allez dans **Admin → Modèles de texte**. La clé est stockée sur le serveur, dans
`server/data/text-config.json`. Elle est utilisée par tous les comptes, et les
Réglages personnels de chacun sont alors ignorés.

`server/text/config.js` déclare six fournisseurs.

![L'écran Admin : modèles de texte et d'images pour toute l'instance](../assets/07-admin.png)

*Admin. Un modèle défini ici sert à tous les comptes, et les Réglages personnels de chacun sont alors ignorés.*

| id | Dialecte | URL de base par défaut | Modèle par défaut |
|---|---|---|---|
| `ollama-cloud` | Ollama | `https://ollama.com` | `gpt-oss:120b` |
| `openai` | OpenAI | `https://api.openai.com` | `gpt-4o-mini` |
| `anthropic` | OpenAI | `https://api.anthropic.com` | `claude-sonnet-4-5` |
| `openrouter` | OpenAI | `https://openrouter.ai/api` | `openai/gpt-4o-mini` |
| `fal` | OpenAI, auth `Key` | `https://fal.run/openrouter/router/openai` | `openai/gpt-4o-mini` |
| `openai-compatible` | OpenAI | *(à vous de la saisir)* | *(à vous de le saisir)* |

`openai-compatible` couvre Groq, Together, DeepSeek, Mistral, LM Studio et
vLLM — tout ce qui expose `POST {baseUrl}/v1/chat/completions`.

### Le bloc Utilisation, sur le même écran

Sous les deux colonnes de modèles, en pleine largeur, se trouve
**Utilisation** — une ligne par compte, avec une barre. Pleine largeur plutôt que
glissé dans la liste des comptes, parce qu'une ligne avec une barre a besoin de
la largeur pour rester lisible aux tailles que la grille donne à une colonne.

Par compte : trois décomptes nommés — **Projets**, **Écrans**, **Médias** — et le
total sur disque, aligné à droite. La barre sous la ligne porte le détail en
infobulle : « {data} de projets · {media} de médias · {avatar} d'avatar ».

C'est une route à part, `GET /api/admin/usage`, et ce n'est pas un accident de
découpage. La produire suppose d'analyser le blob de projets de chaque
utilisateur — la seule chose que le serveur traite par ailleurs comme une chaîne
opaque — et de parcourir un répertoire par séquence de défilement. Repliée dans
la liste des comptes, elle ferait payer ce coût à quiconque ouvre l'onglet Admin,
qu'il la regarde ou non.

Trois lectures méritent d'être connues avant d'agir sur ce tableau :

- **« Données illisibles »** en face d'un compte, et un tiret cadratin là où
  seraient ses décomptes de projets et d'écrans. Un blob qui ne s'analyse pas n'a
  pas zéro projet, et un zéro affirmé enverrait un administrateur chasser un
  problème qui est le sien. Les octets restent comptés ; seul le détail manque.
- **« dont {n} supprimé(s) en attente de synchronisation »** sous un décompte de
  projets. Les pierres tombales restent dans le blob pour qu'une suppression
  puisse voyager jusqu'aux autres appareils de l'utilisateur. Elles coûtent du
  stockage sans être des projets, ce qui est exactement le genre d'écart qui fait
  paraître un total faux.
- **« Sans propriétaire »**, sur sa propre ligne en bas. Des médias déposés avant
  que la propriété ne soit enregistrée, ou appartenant à un compte supprimé. Ces
  octets sont réels et leur propriétaire est inconnu : ils sont donc rapportés à
  part, plutôt que devinés ou répartis sur tout le monde. Les médias étant
  dédupliqués, un fichier déposé par deux personnes est un seul fichier dont la
  taille est partagée entre elles — c'est ce qui fait que la colonne totalise ce
  que le volume contient réellement.

En haut à droite de l'en-tête de section, à côté du mot **Utilisation**, se
trouve le total de l'instance rapporté à `MOCKY_MAX_STORAGE_MB` — ou « sans
plafond » quand cette variable vaut `0`. Voir le
[Déploiement](fr/deployment.md).

### Configurer OpenRouter

1. **Admin → Modèles de texte → profil Génération → OpenRouter.**
2. URL de base : `https://openrouter.ai/api`. **N'ajoutez pas `/v1`.** La couche
   de traduction ajoute elle-même `/v1/chat/completions`, donc un `/v1` en trop
   produit un 404 sur `/v1/v1/chat/completions`.
3. Clé d'API : votre valeur `sk-or-…`, envoyée en `Authorization: Bearer …`.
4. Modèle : l'identifiant OpenRouter complet, sous la forme `vendeur/modèle`. Par
   exemple `openai/gpt-4o-mini`, `anthropic/claude-3.5-sonnet` ou
   `google/gemini-2.5-flash`.
5. Cliquez sur **Tester**. Une vraie requête part, par la même couche de
   traduction que celle qu'utilise l'application.

Le test distingue trois échecs :

- une réponse HTTP non-2xx ;
- une réponse vide d'un modèle « reasoning » qui a dépensé son budget de jetons à
  réfléchir ;
- une réponse coupée, signalée par `finish_reason: length`.

**Un HTTP 200 sans texte visible n'est pas un succès**, et le test le dit. Ce
modèle produirait des écrans vides.

> **Une erreur fréquente.** Coller un identifiant de modèle d'**images** dans le
> champ texte. C'est facile avec fal, qui vend les deux sous une seule clé. Le
> fournisseur répond « is not a valid model ID », ce qui n'explique rien.
> `looksLikeImageModel()` reconnaît le motif — `text-to-image`, `flux`,
> `seedream`, `sdxl`, `dall-e`, `veo`, `kling` et similaires — et affiche un
> message qui nomme le problème.

### Les deux profils de texte

| Profil | Son travail | Reçoit l'image d'inspiration |
|---|---|---|
| `generation` | Écrit les écrans et exécute le planificateur | Oui. C'est ce profil qu'on sonde pour savoir s'il gère la vision |
| `inspiration` | Écrit le dossier de design de Muse | Seulement si on le sonde explicitement |

Le profil voyage dans un en-tête `x-mocky-profile: inspiration`. Tout le reste, y
compris l'absence d'en-tête, vaut `generation`.

Laisser le profil `inspiration` vide le fait retomber sur `generation`, ce qui
est le comportement d'origine à un seul modèle. Le dossier n'écrit pas de code :
un modèle moins cher suffit généralement.

Les fichiers de configuration écrits avant l'existence des profils sont un objet
plat. `liftLegacy()` les remonte dans `generation` à la lecture, clés comprises.

### Ce que le proxy accepte

`/__provider` ne relaie que deux sous-chemins :

```js
export const ALLOWED_SUBPATHS = new Set(['/api/chat', '/api/tags'])
```

C'est une liste d'autorisation, pas un filtre. Avant qu'elle existe, un
`DELETE /__provider/api/delete` portant `{"name":"llama3"}` atteignait l'Ollama
configuré et **supprimait un modèle**. La réécriture du corps ne remplace que
`model`, donc `name` passait intact.

Les redirections sont signalées, pas suivies (`redirect: 'manual'`). Une cible
qui passe la protection SSRF puis répond `302 → http://169.254.169.254/…` la
contournerait sinon d'un seul pas.

---

## Configurer la génération d'images

Allez dans **Admin → Génération d'images (Muse)**. Les clés sont stockées sur le
serveur et ne repartent jamais vers le navigateur : `publicView()` remplace
chacune par un booléen `hasApiKey` ou `hasToken`.

Le bouton **Tester** génère réellement une image jetable — une pomme rouge sur
fond blanc, en 1024×1024 — et ne la range pas dans la bibliothèque.

| Fournisseur | Clé | Détails |
|---|---|---|
| `pollinations` | Non | Le défaut. Gratuit, basé sur des URL ; peut ajouter un filigrane. Limité à environ une requête toutes les 15 secondes, donc les requêtes sont mises en file côté serveur. Un jeton gratuit facultatif relève la limite |
| `fal` | Oui | [fal.ai](https://fal.ai), FLUX et compagnie. L'endpoint synchrone est utilisé : préférez un modèle rapide. Seul fournisseur capable de faire de la **vidéo** |
| `openai-image` | Oui | Tout endpoint exposant `POST {baseUrl}/v1/images/generations` : OpenAI, LiteLLM, passerelles compatibles |
| `cloudflare-workers-ai` | Oui | Palier gratuit généreux. Demande un identifiant de compte et un jeton ayant la permission Workers AI |
| `sd-webui` | Non | Votre propre instance Automatic1111, Forge ou SD.Next lancée avec `--api`. Rien ne sort de votre machine |
| `none` | — | Muse tourne quand même. Les emplacements d'image reçoivent des aplats issus de la palette |

### Deux profils d'images

Les deux métiers sont réellement différents, donc ils ont des réglages séparés.

**`content`** produit les images posées dans l'écran : visuel principal, produits,
fonds. Il peut y en avoir plusieurs par écran, donc ce profil doit être rapide et
bon marché. C'est le chemin d'origine, sans configuration, et Pollinations en est
le défaut.

**`inspiration`** produit l'unique planche de direction artistique montrée au
modèle. Elle doit convaincre, donc elle mérite un modèle plus lent et plus cher.
Laisser son fournisseur vide le fait retomber sur `content`.

> `sd-webui` est appelé par le serveur de Mocky et pointe par définition vers une
> adresse locale. Il **contourne donc volontairement** la protection SSRF
> appliquée aux URL non fiables. Seul un administrateur peut le régler.

---

## Vidéo au défilement

Deux prérequis indépendants. **Admin → Génération d'images → Vidéo** les signale
séparément, parce qu'ils se réparent à des endroits complètement différents.

| Prérequis | Détail |
|---|---|
| Un fournisseur vidéo | `fal` uniquement. Aucun autre fournisseur configuré n'a d'endpoint texte-vers-vidéo. Le modèle par défaut est `fal-ai/ltx-video` |
| `ffmpeg` | Fourni dans l'image Docker. Depuis les sources, à installer vous-même |

`GET /api/videos/availability` renvoie
`reason: 'no-provider' | 'no-key' | 'no-ffmpeg' | null`, ordonné par ce qu'il faut
corriger en premier.

**Importer votre propre clip ne demande que `ffmpeg`** : pas de fournisseur, pas
de clé, aucun coût. Une instance qui n'a jamais configuré fal peut donc utiliser
toute la fonctionnalité avec ses propres images.

---

## Serveurs MCP

Les serveurs MCP locaux sont déclarés dans `mocky.mcp.json`, à la racine du
dépôt, et lancés par le back-end en stdio. Le fichier livré en déclare un seul :

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

Le routeur associe des **rôles** sémantiques au serveur qui expose un outil
correspondant, ce qui permet d'en changer sans toucher au code. La santé est
rapportée par `GET /api/mcp/status`. Les détails sont dans la page
[moteur d'inspiration](fr/muse/inspiration-engine.md).

Un fichier absent ou invalide n'est jamais fatal. Il donne une liste de serveurs
vide, et Muse retombe sur sa bibliothèque de patterns hors ligne.

---

## Commandes d'entretien

```bash
npm run backup           # → backups/mocky-YYYY-MM-DD-HHmm.zip
npm run backup -- <dir>  # écrire ailleurs
npm run check:vendor     # vérifier les bundles copiés contre leurs empreintes
npm test                 # vitest run, la suite complète
npm run test:watch
```

`npm run backup` est du Node pur et réutilise l'écrivain ZIP sans dépendance du
dépôt. Il se comporte donc identiquement sous Windows, macOS et Linux.

Pour une instance Docker, sortez d'abord les données du volume :

```bash
docker compose cp mocky:/app/server/data ./server/data
npm run backup
```

L'archive contient des empreintes de mots de passe et des jetons de session.
`backups/` est ignoré par git ; qu'il le reste.

---

## Diagnostic

| Symptôme | Cause probable |
|---|---|
| Toutes les pages sont en 404 mais l'API répond | `npm start` sans `npm run build`. `/api/health` indique `frontendBuilt: false` |
| La connexion ne joint pas le back-end | Vous avez lancé `npm run dev` au lieu de `npm run dev:all` |
| `EADDRINUSE` au démarrage | Un autre Mocky occupe le port. Utilisez `MOCKY_PORT=8788 npm start` |
| Neuf échecs de connexion bloquent toute l'instance | Un reverse proxy sans `TRUST_PROXY=1`. Toutes les requêtes semblent venir de `127.0.0.1`, donc la limite devient un compteur unique partagé |
| HTTP 401 ou 403 du fournisseur | Clé absente ou invalide. En mode instance, la clé du navigateur est ignorée : c'est celle de l'administrateur qui compte |
| Un écran est coupé au milieu d'une chaîne | Le modèle a atteint son plafond de sortie. Mocky le détecte via `done_reason` ou `finish_reason` valant `length`, et le dit, au lieu de laisser une erreur de syntaxe incompréhensible |
| Aperçu blanc, console pleine d'erreurs CORS `origin 'null'` | La maquette a essayé de naviguer hors d'elle-même. Le parent recharge le `srcdoc` et affiche « les liens sont inertes » |
| Muse ne fait rien | Muse a besoin du back-end. En mode `localStorage` pur, l'interrupteur est masqué |
