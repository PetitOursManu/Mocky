# Architecture — vue d'ensemble

## 1. Où vit chaque chose

Le fait le plus structurant du projet :

> **Le pipeline de génération tourne dans le navigateur.**

| Préoccupation | Emplacement | Fichiers |
|---|---|---|
| Sélection des capacités (déterministe) | **Navigateur** | `src/lib/capabilities/select.ts` |
| Planificateur (optionnel, sortie structurée) | **Navigateur** | `src/lib/plan.ts` |
| Génération / édition / réparation (flux) | **Navigateur** | `src/lib/generate.ts` |
| Orchestration du pipeline, phases | **Navigateur** (React) | `src/components/ProjectView.tsx` |
| Pont `DESIGN.md` (préambule, jetons, export) | **Navigateur** | `src/lib/design.ts`, `designTokens.ts`, `export/` |
| Rendu bac à sable (iframe origine nulle, Babel vendorisé) | **Navigateur** | `src/components/Preview.tsx`, `lib/capabilities/prelude.ts` |
| Persistance | **`localStorage`**, miroir serveur si connecté | `src/lib/project.ts`, `sync.ts`, `merge.ts` |
| Comptes, SSO, synchronisation JSON, proxy modèle | **Serveur** | `server/index.js`, `server/provider-proxy.js` |
| Muse : MCP, fetch, distillation, dossier | **Serveur** | `server/muse/` |
| Images, vidéos, bibliothèques | **Serveur** | `server/images/`, `server/videos/` |

Le backend est volontairement mince : **fichiers JSON sous `server/data/`, aucune
base de données, aucune dépendance native** (`express` + `cookie-parser`, plus
`@modelcontextprotocol/sdk` et `zod` pour Muse). Les écritures sont atomiques
(fichier temporaire puis `rename`) : un crash en cours d'écriture ne laisse jamais
de fichier à moitié écrit. Cette posture « pas de base, pas de natif » est un
invariant de fait, et l'image `node:20-slim` en dépend.

---

## 2. Le registre de capacités

Une **capacité** est ce que Mocky injecte dans l'aperçu pour qu'un composant
généré dispose de quelque chose qu'il n'a pas écrit lui-même. Trois formes,
déclarées dans `src/lib/capabilities/types.ts` :

```ts
export type CapabilityKind = 'cdn-script' | 'cdn-css' | 'snippet-pack'
```

- **`snippet-pack`** — du JSX brut, en chaîne, préfixé au code généré **avant**
  `Babel.transform`. C'est la forme dominante.
- **`cdn-css`** — une balise `<link>`.
- **`cdn-script`** — une balise `<script>` qui expose un global.

Les noms `cdn-*` sont historiques. **Aucune capacité ne pointe vers un tiers** :
`daisyui` charge `/vendor/daisyui.min.css` et `motion-lib` charge
`/vendor/motion.js`, tous deux servis par le serveur qui sert la page. C'est
l'[invariant I3](architecture/invariants.md), et il porte sur
la *dépendance*, pas sur la forme de la balise.

### Le registre livré

| id | Genre | Déclencheurs | Ce que ça donne |
|---|---|---|---|
| `icons` | snippet-pack | **baseline** — toujours | `Icon.*` — 42 icônes SVG en ligne (+ 3 alias `GitHub`/`LinkedIn`/`YouTube`) |
| `daisyui` | cdn-css | `daisy`, `semantic`, `btn`, `card component`… | Feuille de style vendorisée, classes sémantiques |
| `charts` | snippet-pack | `chart`, `graph`, `dashboard`, `analytics`, `sparkline`… | `BarChart`, `LineChart`, `DonutChart`, `Sparkline`, `ProgressRing` |
| `motion` | snippet-pack | **aucun** — `retired: true` | `FadeIn`, `Stagger`, `Marquee`, `Counter`, `Reveal`, `ShimmerButton`, `BentoGrid`, `BentoCard`, `BorderBeam`, `TextReveal`, `Meteors`, `AnimatedBeam` |
| `motion-lib` | cdn-script | **aucun** — tiré par `requires` | `window.Motion` depuis `/vendor/motion.js` |
| `animate` | snippet-pack | `animation`, `motion`, `hero`, `landing`, `parallax`… | `Animated`, `Ticker`, `CountUp` — `requires: ['motion-lib']` |
| `scrollvideo` | snippet-pack | **aucun** — ajouté à la main | `ScrollSequence` |

### Sélection : `selectCapabilities()`

Déterministe, sans LLM. Le prompt utilisateur et le `DESIGN.md` actif sont
concaténés, mis en minuscules, puis chaque capacité est retenue si **au moins un**
de ses mots-clés ou intentions apparaît en sous-chaîne. Ensuite :

1. les capacités `baseline` sont ajoutées d'office ;
2. `requires` est résolu transitivement (`animate` tire `motion-lib`) ;
3. `conflictsWith` retire les conflits.

C'est volontairement grossier. Le raffinement, quand il a lieu, vient du
planificateur — et le planificateur ne peut que **choisir dans cette liste**,
jamais l'élargir.

### Deux capacités sans déclencheurs, pour deux raisons opposées

**`motion` est retirée.** `<Animated>` l'a remplacée. La supprimer du registre
aurait été le geste évident et un bug : les identifiants de capacités sont
**persistés sur chaque écran** (`Screen.caps`), donc un écran généré la semaine
dernière demande encore `motion` au moment du rendu. Sans l'entrée, son prélude
n'est plus injecté, `FadeIn` et `Marquee` deviennent indéfinis, et chacun de ces
écrans lève une exception. Donc : aucun déclencheur (la présélection ne peut
jamais la choisir) et `retired: true`, qui la **retire de la documentation lue par
le modèle**. Les anciens écrans continuent de fonctionner exactement comme avant ;
les nouveaux ne voient jamais que `<Animated>`.

**`scrollvideo` n'est jamais devinée.** Le composant est inutile sans un `base` et
un nombre de `frames`, qui n'existent qu'une fois Muse ayant réellement payé un
clip. Il est ajouté à la génération quand une séquence a été produite, et
seulement là — un écran à qui l'on offrirait `<ScrollSequence>` sans rien à
montrer afficherait un rectangle noir haut de trois écrans.

### Validation au chargement du module

```js
validatePack(id, components, snippets)
```

s'exécute pour chaque `snippet-pack` à l'import du registre et **lève** dans les
deux sens : un composant documenté que le snippet n'exporte pas, ou un export
sans métadonnées de composant. La liste `exports` est écrite à la main, jamais
déduite du code source — c'est l'[invariant I1](architecture/invariants.md)
appliqué au prélude lui-même.

### Le prélude

`buildPrelude(caps)` concatène le helper `cn()` puis **la totalité** des sources
de chaque `snippet-pack` retenu. Les packs sont **atomiques** : jamais un
sous-ensemble, jamais un filtrage par composant. Chaque source passe par
`sanitizeSource()`.

---

## 3. Le planificateur

`src/lib/plan.ts` — une passe LLM **non diffusée**, bon marché, qui décide de la
structure de l'écran et des capacités réellement nécessaires, avant la génération.

```ts
options: { temperature: 0.2, num_ctx: 8192, num_predict: 1024 }
format: PLAN_SCHEMA     // sortie structurée Ollama
stream: false
```

Délai par défaut : **3 000 ms**.

Règle dure : **le planificateur ne doit jamais bloquer ni casser une génération.**
Erreur réseau, dépassement de délai, réponse non-JSON, mauvaise forme : tout
résout à `null`, et l'appelant retombe **silencieusement** sur la présélection
déterministe. C'est pour cela que ce module fait son propre `fetch` au lieu de
réutiliser `chat()`, qui lève.

`validatePlan()` filtre les identifiants de capacités retournés : seuls ceux qui
existent dans le registre **et** figurent dans la présélection survivent — les
hallucinations disparaissent. Les capacités `baseline` sont systématiquement
réinjectées, donc le planificateur ne peut pas les faire tomber.

Le plan validé devient une section de texte brut (`planToPromptSection`) ajoutée
au message système. La sortie structurée est sûre ici parce que l'appel est petit
et non diffusé ; elle n'est **jamais** utilisée pour la génération de code, ce qui
casserait à la fois l'aperçu en direct et le protocole sentinelle.

Le planificateur est **sauté quand Muse a tourné** : le dossier fournit déjà la
structure.

---

## 4. Génération

### Le protocole sentinelle

Le modèle est prié d'encadrer sa sortie :

```
<<<MOCKY>>>
…le composant complet…
<<<END>>>
```

Pas de barrières Markdown. La raison est le streaming : on peut extraire du code
partiel dès qu'il arrive, sans attendre une fence fermante.

`extractCode()` gère trois cas, dans l'ordre : sentinelles, bloc de code
historique (compatibilité ascendante), contenu brut.

La sentinelle fermante est acceptée **telle qu'elle arrive**, pas telle qu'elle
est demandée. Un écran réel s'est terminé par :

```
const __mockyDefault = App
<<<END>>ablytyped
```

— un `>` manquant, avec un fragment de prose soudé. `indexOf('<<<END>>>')` ne
trouvait rien, la queue était conservée **comme du code**, et chaque compilation
ultérieure de cet écran mourait sur « Unterminated JSX contents ». `<<<` n'est
valide nulle part en JavaScript hors chaîne : dès qu'il apparaît en tête d'une
sentinelle possible, le code est fini. `stripTrailingSentinel()` coupe là, à
l'extraction **et** au rendu — les écrans déjà stockés avec une queue corrompue
guérissent à leur prochain chargement plutôt que d'échouer pour toujours.

### Paramètres

```ts
options: { temperature: 0.4, num_ctx: 32768, num_predict: 16384 }
```

Un écran complet dépasse facilement 8 k jetons ; quand le plafond tombe, le code
est coupé en pleine chaîne et l'aperçu affiche une erreur de syntaxe
incompréhensible. `num_predict` doit rester **strictement positif**
([invariant I8](architecture/invariants.md)).

La coupure est détectée (`done_reason` / `finish_reason` valant `length`,
y compris via `choices[0]`) et remontée à l'utilisateur en toutes lettres.

### Streaming

Le corps de la réponse est lu en NDJSON — un objet JSON par ligne. Une ligne
partielle est conservée dans un tampon et complétée au chunk suivant. Chaque
fragment de contenu déclenche `onChunk(extractCode(full, { streaming: true }))`,
donc l'aperçu se reconstruit en direct.

En mode streaming, `extractCode` **ne coupe pas** sur une sentinelle fermante
approximative : une sentinelle à moitié écrite n'est que les prochains caractères
qui arrivent, et couper dessus tronquerait l'aperçu à chaque chunk. Une fois la
réponse complète, une sentinelle malformée est tout ce qu'il y aura jamais — donc
on coupe.

### Les trois appels

| Fonction | Usage | Règles supplémentaires |
|---|---|---|
| `generateComponent()` | Nouvel écran | `extraSystem` (dossier Muse **ou** `DESIGN.md`) + capacités + plan |
| `editComponent()` | Modifier les écrans sélectionnés | `EDIT_RULES` : « préserver tout ce que l'utilisateur n'a pas demandé de changer », octet pour octet ; le composant complet est renvoyé, pas un diff |
| `fixComponent()` | Réparation automatique après erreur de rendu | Non diffusé. Reçoit le **même** prompt de capacités — sans la liste des globaux existants, le modèle ne peut pas savoir quel composant est indéfini et échange une erreur React #130 contre une autre |

### La modification sans LLM

`tryDirectTextReplace()` : si le texte visible de l'élément cliqué apparaît
**exactement une fois** verbatim dans la source, il est remplacé sur place —
instantané et gratuit. Zéro ou plusieurs occurrences : `null`, et l'appelant
bascule sur une édition LLM ciblée. Ce n'est pas une découverte de noms
(invariant I1) : c'est l'échange d'un littéral que l'utilisateur est en train de
regarder.

Quand il faut bien passer par le modèle, l'ancrage est **textuel d'abord** : le
chemin DOM (`nth-of-type`) ne se remappe pas fiablement sur du JSX, alors que la
chaîne `class` exacte de l'élément apparaît verbatim dans le JSX et constitue
l'ancre la plus forte. Le sélecteur n'est passé qu'en indice de dernier recours.

### Le garde-fou Motion

`guardMotion()` passe chaque sortie par `stripForbiddenMotion()` — un vrai
parcours d'AST Babel, jamais une regex. Voir
[Animations](muse/animations.md).

---

## 5. Le bac à sable

`src/components/Preview.tsx` construit un document HTML autonome et l'injecte en
`srcDoc`.

### L'iframe

```html
<iframe sandbox="allow-scripts" srcDoc={srcDoc} />
```

`allow-scripts` **et rien d'autre**. Sans `allow-same-origin`, l'origine est
opaque : pas de `localStorage`, pas de cookies, pas d'accès au DOM parent. Les
URL `blob:` sont same-origin par rapport à cette origine nulle, donc le module
compilé s'exécute sans CORS
([invariant I2](architecture/invariants.md)).

Un test lit le fichier source et exige l'**égalité exacte** de l'attribut, pas une
sous-chaîne : `"allow-scripts allow-same-origin"` contient `"allow-scripts"`, donc
un `includes` serait passé pendant que la frame exécutait du code généré avec
l'origine de Mocky.

### La CSP

`allow-scripts` seul ne restreint **rien** en sortie : un composant généré pourrait
`fetch()`, `sendBeacon()` ou `new Image().src = …` vers n'importe quel hôte, depuis
l'IP de l'utilisateur, à chaque rendu.

```
default-src 'none'
script-src  <origine du parent> 'unsafe-inline' 'unsafe-eval' blob:
style-src   <origine du parent> 'unsafe-inline'
img-src     * data: blob:
font-src    * data:
connect-src 'none'
form-action 'none'
frame-src   'none'
object-src  'none'
base-uri    'none'
```

`'self'` serait un piège : le document n'a pas d'origine propre, `'self'` se
sérialise en `"null"` et bloquerait React, Babel et Tailwind. L'origine du parent
est donc nommée explicitement.

`img-src` reste permissif à dessein. Une image distante est un vecteur de pistage
faible, mais c'est aussi ainsi qu'une maquette montre une photo, et les modèles
émettent légitimement des URL d'images. `'unsafe-inline'` et `'unsafe-eval'` sont
inévitables : tout l'objet du document est d'exécuter du code compilé à la volée.

### Ce que le document charge

```html
<script src="/vendor/react.production.min.js"></script>
<script src="/vendor/react-dom.production.min.js"></script>
<script src="/vendor/tailwind.min.js"></script>
<!-- liens et scripts des capacités -->
<script src="/vendor/babel.min.js"></script>
```

Tout vient de `public/vendor/`, épinglé par empreinte SHA-256 dans
`public/vendor/VENDOR.md` et vérifié par `npm run check:vendor` — qui tourne en CI.
Les aperçus fonctionnent donc **hors ligne**, et une compromission de CDN ne peut
pas les atteindre.

Aucune balise ne porte `crossorigin` : l'origine étant nulle, cet attribut
transformerait chaque script en requête CORS avec `Origin: null`, que le serveur
ne gère pas — le script échouerait à charger.

### Le pipeline de compilation

1. Le code source est encodé en base64 et déposé dans un `<script type="text/plain">`.
   Cela élimine tout caractère susceptible de casser le HTML ou le template :
   backticks, `${`, guillemets, sauts de ligne, `</script>`.
2. Le prélude est encodé de la même façon, quand il y en a un.
3. `Babel.transform(prelude + '\n' + source, { presets: [['react', { runtime: 'classic' }]] })`
   s'exécute **dans l'iframe**.
4. Le résultat est exécuté via une URL `blob:`, ce qui donne de vraies positions
   d'erreur.
5. Le composant est monté dans une **frontière d'erreur React**.

La frontière est nécessaire parce que `createRoot` rend de façon **asynchrone** :
une erreur de rendu survient après le retour du `try/catch` synchrone et
s'échapperait vers `window.onerror` sous la forme d'un « Script error. » opaque
(origine `blob:null`). La frontière l'attrape avec le message réel et la pile de
composants, et la renvoie au parent — ce qui alimente à la fois la boîte d'erreur
et `fixComponent`. Elle ne se déclenche que sur de vraies erreurs
([invariant I5](architecture/invariants.md)).

L'erreur React #130 est reformulée avant d'être remontée, parce que son message
minifié n'apprend rien :

> Element type is invalid (React #130) : un composant ou une icône rendue est
> indéfini — probablement un nom absent ou mal orthographié.

### Le pont d'interaction

Un petit script installé dans la frame parle au parent par `postMessage` :

- **mode `pick`** — surligne l'élément survolé ; au clic, renvoie un sélecteur CSS,
  le texte visible, la balise et la chaîne `class`. En mode *Modifier* la
  sélection est exacte ; en mode *Lien* elle remonte jusqu'au plus proche ancêtre
  interactif.
- **mode `demo`** — pour une liste `[{selector, target}]`, un clic demande au
  parent de naviguer.
- **`ok`**, **`error`**, **`size`** — état du rendu et hauteur du contenu.

L'identité vient de **la fenêtre émettrice**, jamais d'un champ du message.
`frameId` est écrit en clair dans chaque `srcDoc`, donc un aperçu pourrait lire
l'identifiant d'un autre dans le DOM et forger des messages en son nom ; et
`e.origin` vaut l'inutile chaîne `"null"` pour toute frame bac à sable. D'où :

```js
if (e.source !== iframeRef.current?.contentWindow) return   // côté parent
if (e.source !== window.parent) return                      // côté frame
```

Symétriquement, une frame ne peut signaler un `pick` que si le mode est
effectivement actif, et ne peut demander une navigation que si elle a des liens de
démo — sans quoi un composant rendu piloterait l'interface du parent à volonté.

### La maquette ne doit jamais quitter son propre document

Une frame en bac à sable a toujours le droit de **se** naviguer. Un `<a href="/">`,
un formulaire soumis, un `location.assign()` : la frame abandonne le `srcDoc` et
charge l'`index.html` de Mocky. Son origine étant opaque, tous les modules de
l'application échouent alors en CORS — écran blanc, console saturée, et l'écran
qu'on venait de générer a disparu.

Quatre gardes, en profondeur :

1. `window.open` est neutralisé **avant** l'exécution du code généré.
   `window.location` n'est délibérément pas touché : c'est un accesseur non
   configurable, le redéfinir lève et emporterait tout le pont.
2. Un gestionnaire de clic en capture annule **tout** `<a href>` et `<area href>`,
   fragments compris. Un document `srcdoc` hérite de l'URL du **parent** comme
   base : `#pricing` se résout en `http://localhost:8787/#pricing`, un autre
   document. Le défilement qu'un fragment devait produire est donc fait à la main
   (`scrollIntoView`), pour que les ancres internes se comportent quand même comme
   des ancres.
3. Les soumissions de formulaire sont annulées — un `<form>` sans `action` poste
   vers l'URL du document, donc vers la page de Mocky.
4. Pour tout le reste (navigation programmatique), le parent **compte les
   événements `load`** de la frame : le premier est le `srcDoc`, tout suivant
   signifie qu'elle est partie ailleurs. Le parent réassigne alors `srcdoc` — un
   attribut qu'il possède quelle que soit l'origine de la frame — et affiche
   pendant trois secondes « les liens sont inertes ».

### Rythme et délais

Le `srcDoc` est reconstruit avec **500 ms de debounce**, pour qu'un flux de jetons
ne rebâtisse pas l'iframe à chaque caractère. Un **délai de 20 s** évite l'attente
infinie si aucun message n'arrive. Pendant la génération, les erreurs sont
ignorées (le code est incomplet) ; et une erreur dont le code source a changé
depuis la construction du `srcDoc` est écartée comme périmée.

### L'exception documentée : la capture

`src/lib/capture.ts` monte une iframe **same-origin**, et c'est assumé, mesuré et
verrouillé par un test qui explique pourquoi — pour que personne ne le
« corrige » à l'aveugle.

html2canvas clone le document dans une iframe à lui ; un bac à sable sans
`allow-same-origin` donne à chaque descendant une **nouvelle** origine opaque, si
bien que la frame ne peut plus lire son propre clone (« Blocked a frame with
origin null from accessing a cross-origin frame »), sur le chemin par défaut comme
avec `foreignObjectRendering`.

Ce qui est fermé à la place : la CSP de cette frame refuse `connect-src`,
`form-action`, `frame-src`, `object-src`, `base-uri`, et **limite `img-src` à
l'origine** — précisément parce qu'une image distante fait aussi office de balise
de traçage. Le composant peut lire, il n'a nulle part où envoyer.

Le vrai correctif est la **séparation d'origine** : servir la coquille de capture
depuis une origine distincte et conserver `allow-same-origin`. Cela demande une
route serveur et une origine de capture configurable, d'où son absence pour
l'instant.

---

## 6. Modèles : un seul dialecte

Mocky parle **toujours** le dialecte Ollama en interne : `POST /api/chat`, `options`,
`num_ctx`, `num_predict`, `format`, flux NDJSON.

`server/text/dialect.js` traduit vers et depuis les API compatibles OpenAI :
forme de requête, `response_format`, pièces jointes de vision (`image_url`), et
SSE → NDJSON. La génération, le planificateur et Muse sont donc **agnostiques du
fournisseur**, sans second chemin de code.

Le proxy vit à deux endroits qui partagent le même module :

- en développement, un middleware Vite (`vite.config.ts`) ;
- en production, `app.use('/__provider', …)` dans Express.

Trois protections y sont appliquées :

1. **Liste blanche de sous-chemins** — `/api/chat` et `/api/tags`, rien d'autre.
2. **Garde SSRF** — `assertSafeTargetResolved()` : schéma http(s) uniquement,
   refus de `localhost`, des plages privées, du lien-local et de
   `169.254.169.254`, puis **résolution DNS et nouvelle vérification de chaque
   adresse retournée**. Sans cette seconde étape, un nom de domaine contrôlé par
   l'appelant (`evil.test` → A 127.0.0.1) passait les tests de chaîne intact.
   Les formes IPv6 mappées (`::ffff:127.0.0.1` et son jumeau hexadécimal
   `::ffff:7f00:1`) sont couvertes explicitement.
3. **Corps borné** — `readRawBody()` s'arrête à 25 Mo. Non borné, il accumulait ce
   que le client envoyait puis appelait `Buffer.concat` dans l'écouteur `end` :
   un corps dépassant `buffer.constants.MAX_LENGTH` levait hors de toute chaîne de
   promesse et, sans gestionnaire `uncaughtException`, emportait le serveur.

Une cible **configurée par un administrateur** contourne délibérément la garde
SSRF : pointer vers un modèle local (Ollama, LM Studio, vLLM sur `127.0.0.1`) est
un montage supporté, et seul un administrateur peut le régler. La garde reste
entière pour toute URL venue du navigateur.

Quand un fournisseur d'instance est configuré, `/__provider` **exige une session** :
la requête dépense les crédits de l'hôte, donc elle doit appartenir à quelqu'un.
Sans fournisseur d'instance, l'appelant fournit sa propre clé et le mode
« la clé ne quitte pas votre navigateur » est préservé.

---

## 7. Persistance

### Côté navigateur

| Clé `localStorage` | Contenu |
|---|---|
| `mocky.projects.v1` | Les projets, avec écrans, positions, liens |
| `mocky.design.v1` | Le `DESIGN.md` actif et son interrupteur |
| `mocky.settings.v1` | Fournisseur, URL de base, **clé d'API**, planificateur oui/non |
| `mocky.muse.v1` | Configuration Muse (URL d'inspiration, mode image, vidéo, épingle) |
| `mocky.animations.v1` | `auto` \| `on` \| `off` |

### Côté serveur

Un fichier par utilisateur, `server/data/data-<uuid>.json`, contenant `projects`
et `design` sérialisés, plus `updatedAt`. Deux routes : `GET /api/data`,
`PUT /api/data`.

La synchronisation est **différée et observable** : `scheduleSync()` marque
l'état sale, un état `idle | syncing | failed` est diffusé à qui s'y abonne, et
l'échec est visible dans l'interface. Auparavant, un échec après trente secondes
de tentatives était visible de personne — ni de l'utilisateur, ni de la console.

La réconciliation compare `updatedAt` des deux côtés au lieu de supposer que le
serveur est plus frais, ce qui écrasait du travail local. La fusion
(`src/lib/merge.ts`) utilise des pierres tombales avec un TTL, pour qu'une
suppression sur un appareil ne « ressuscite » pas depuis un autre.

### Le magasin serveur

```
server/data/
  users.json              comptes (scrypt : salt + hash), rôles, dashySub
  sessions.json           jeton → { u: userId, t: horodatage }
  config.json             { allowRegistration }
  sso-jti.json            jti consommés (anti-rejeu), purgés au-delà de 10 min
  data-<uuid>.json        projets + design d'un utilisateur
  text-config.json        fournisseurs de texte configurés par l'admin (secrets)
  images-config.json      fournisseurs d'images + réglages vidéo (secrets)
  muse-cache.json         distillations, TTL 7 jours, texte uniquement
  image-library.json      métadonnées de la bibliothèque d'images
  image-library/<hash>    les octets des images
  video-library/          les séquences : clip + trames + poster
```

Les fichiers contenant des secrets sont écrits en `0600` — le `0644` par défaut
les laissait lisibles par tout autre compte de la machine.

---

## 8. Surface HTTP

| Méthode & route | Auth | Rôle |
|---|---|---|
| `GET /api/health` | — | `dataWritable` + `frontendBuilt` ; `503` avec un `detail` nommant ce qui manque |
| `GET /api/config` | — | Inscription ouverte ?, mode installation, SSO, modèle d'instance (sans secret) |
| `POST /api/register` · `/api/login` | limité | Le premier compte devient admin |
| `POST /api/logout` · `GET /api/me` | cookie | `/api/me` répond `200 { user: null }`, pas `401` |
| `POST /api/account/password` | session + limité | Révoque toutes les sessions, en délivre une neuve |
| `GET /sso/dashy/callback` | limité | Vérifie le JWT HS256, trouve-ou-crée le compte |
| `GET·PUT /api/admin/config` · `/users` · `…/password` · `DELETE /users/:id` | admin | |
| `GET·PUT /api/admin/text/config` · `POST /api/admin/text/test` | admin | Le test envoie une vraie requête |
| `GET·PUT /api/admin/images/config` · `POST /api/admin/images/test` | admin | Le test génère une vraie image, non stockée |
| `POST /api/text/vision` | session | Sonde la capacité vision du modèle ; **passe par la garde SSRF** |
| `GET·PUT /api/data` | session | Projets + design de l'utilisateur |
| `GET /api/mcp/status` | session | État de chaque serveur MCP déclaré |
| `POST /api/muse/dossier` | session | Discover → Distill → Dossier |
| `POST /api/images/generate` · `/upload` | session, limité | 30 requêtes/min |
| `GET /api/images/library` · `/library.zip` · `POST /:hash/favorite` · `DELETE /:hash` | session | |
| `GET /api/images/:hash` | **public** | Voir ci-dessous |
| `POST /api/videos/generate` (6/min) · `/upload` (20/min) | session, limité | |
| `GET /api/videos/library` · `/:hash/meta` · `DELETE /:hash` | session | |
| `GET /api/videos/:hash/poster.jpg` · `/:hash/f/:n.jpg` | **public** | Voir ci-dessous |
| `ALL /__provider/api/chat` · `/api/tags` | session **si** modèle d'instance | Proxy + traduction de dialecte |

### Pourquoi les octets d'images et de trames sont publics

C'est délibéré et porteur :

- les iframes d'aperçu sont en bac à sable **sans** `allow-same-origin`, donc leur
  origine est opaque et leurs sous-requêtes ne portent **aucun cookie SameSite** ;
  une route `/:hash` authentifiée viderait chaque image de chaque maquette ;
- un ZIP exporté référence ces URL depuis une machine sans session.

**L'URL est la capacité** : un SHA-256 de 64 caractères hexadécimaux du contenu,
qu'on ne devine pas, et qui n'est distribué que par un listing authentifié. Le
motif est exact — `PUBLIC_IMAGE_PATH = /^\/[a-f0-9]{64}$/` — donc le listing, la
génération et la suppression restent tous derrière une session.

Cette garde est attachée aux **sous-chemins** que les routeurs servent, pas au
montage `/api`. Montée sur `/api`, elle s'exécutait pour toutes les routes
`/api/*` suivantes et mettait silencieusement les octets publics derrière
l'authentification.

---

## 9. Export

`src/lib/export/project.ts` assemble un projet **Vite + React + Tailwind
exécutable** à partir des écrans, en trois cibles :

| Cible | Contenu |
|---|---|
| `plain` | Tailwind + les packs d'interface de Mocky, vendorisés dans le projet |
| `shadcn` | En plus : `components.json`, le `cn()` standard, le thème Tailwind shadcn, pour que `npx shadcn add …` hérite de la marque via `globals.css` |
| `daisyui` | Tailwind + le plugin daisyUI |

La réécriture JSX → ESM (`export/rewrite.ts`) passe par Babel, jamais par une
regex : elle transforme d'abord le JSX en `React.createElement` pour que chaque
référence de composant devienne un identifiant ordinaire, puis interroge la portée.

`export/theme.ts` transforme le `DESIGN.md` en `globals.css`. Les regex y sont
autorisées : elles balaient de la **prose Markdown**, pas du code — l'exemption
explicite de l'invariant I1.

Le ZIP est écrit par `src/lib/zip.ts`, sans dépendance (méthode « store » + CRC32).
Le même écrivain sert au « Tout télécharger » de la bibliothèque d'images et à
`npm run backup`.

---

## 10. Tests

`npm test` exécute Vitest sur tout le dépôt. Trois suites méritent d'être connues
parce qu'elles lisent **le code réellement livré**, pas une abstraction :

- **`tests/preview-sandbox.test.js`** — verrouille la posture de sécurité de
  l'aperçu en lisant `Preview.tsx` et `capture.ts` : valeur exacte de `sandbox`,
  absence de balise externe, directives CSP, garde de navigation, comportement du
  mode « sans animation », validation du pont `postMessage`. Elle existe parce que
  le seul test qui appliquait I3 regardait le **registre** — et ne voyait donc pas
  les balises `<script src="https://…">` écrites en dur dans `buildSrcDoc`, qui
  avaient dérivé vers des CDN sans que personne le remarque.
- **`tests/tokens-contrast.test.js`** — lit `src/styles/tokens.css` et vérifie que
  chaque paire texte/fond franchit le seuil WCAG AA. Mesuré avant :
  `text-slate-500` donnait 2,09:1 sur le thème beige, et le bouton actif de la
  barre d'outils affichait 1,21:1 — son libellé était invisible.
- **`tests/i18n-parity.test.js`** — chaque clé doit exister en français et en
  anglais, et aucun composant ne doit contenir de phrase en dur. L'interface a été
  bilingue **à l'intérieur d'un même composant** : cinq composants en français,
  douze en anglais, deux mixtes.

S'y ajoutent `registry.test.ts` (invariants de registre au chargement),
`ssrf-guard.test.js`, `routes-auth.test.js`, et les suites Muse / images / vidéos.

La CI (`.github/workflows/ci.yml`) exécute `build · test · check:vendor · npm
audit --omit=dev` sur Node 20 **et** 22, puis construit l'image Docker, la
**démarre** et attend qu'elle réponde — construire ne prouvait que la syntaxe du
Dockerfile ; démarrer attrape un `COPY` manquant, un `CMD` cassé, un répertoire de
données non inscriptible. Une étape vérifie explicitement que `mocky.mcp.json` est
bien dans l'image : il en avait disparu, et Muse démarrait zéro serveur MCP
pendant que l'image payait quand même ses ~300 Mo de Chromium.
