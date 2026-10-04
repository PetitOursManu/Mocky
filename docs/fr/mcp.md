---
source_hash: edbd9750ce24
---

# Connecter un assistant (MCP)

Mocky peut être un **serveur MCP** : Claude, ChatGPT ou un autre client MCP s'y
connecte et agit dans Mocky au nom d'un compte. La personne se connecte à Mocky,
dit oui une fois, et l'assistant peut ensuite travailler avec ses projets.

C'est **désactivé par défaut**, et désactivé veut dire absent : aucun point
d'accès, aucun document de découverte, rien qu'un scanner puisse trouver. Un
administrateur l'active, pour les comptes qu'il choisit, et seulement sur une
instance servie en HTTPS.

## Ce qu'un assistant peut faire

| Outil | Ce qu'il fait |
|---|---|
| `mocky_guide` | Le guide écrit pour l'assistant lui-même : les étapes d'une demande à un design, quel outil quand, les types d'écran, les images, ce qu'il ne doit jamais faire. Il a pour consigne de le lire avant son premier design ; aussi servi comme ressource `mocky://guide`. |
| `create_design` | Génère un nouvel écran à partir d'une description, toujours dans un **nouveau projet**, et renvoie **une image du résultat et un lien** vers lui dans Mocky. |
| `add_screen` | La même chose, dans un **projet existant** — où l'écran suit la direction artistique de ce projet. Seulement quand la personne nomme ce projet : un assistant ne doit jamais en choisir un parce qu'il semble proche, et la réponse dit dans quel projet l'écran est allé. |
| `get_design` | Attend un design encore en cours, puis renvoie la même chose. |
| `list_projects` | Les projets du compte, chacun avec un lien. |
| `get_project` | Les écrans d'un projet : nom, appareil, la demande qui l'a créé, un lien. |
| `get_screenshot` | Une image d'un écran qui existe déjà. |
| `search_free_images` | Des photos libres des banques auxquelles ce Mocky est relié (Pexels, Pixabay), en miniatures que l'assistant regarde. |
| `add_image` | Met une image dans la bibliothèque du compte pour un design : une photo libre choisie ci-dessus, une image de la conversation (générée par ChatGPT, ou jointe par la personne), ou une adresse publique. |
| `edit_design` | Modifie un écran existant comme la personne le demande — « mets l'en-tête en sombre » — en gardant le reste. Rend une image et le lien. |
| `polish_design` | La [passe de qualité](quality.md) de Mocky sur un écran : corrige ce qu'elle trouve et note l'écran sur 20. Dit ce qu'elle a corrigé et ce qui reste. |
| `audit_design` | Le [rapport SEO et accessibilité](seo-accessibility.md) d'un écran : deux notes et les constats nommés. Ne change rien ; `deep` ajoute les questions jugées par le modèle. |
| `fix_accessibility` | La correction propre à ce rapport : corrige le balisage, l'écran restant identique à l'œil. |

Et un prompt, **new-design** (le menu « / » de Claude), qui démarre un court
entretien avant de dessiner.

- **D'abord les questions.** L'assistant a pour consigne de savoir de quel écran
  il s'agit, pour qui et dans quel ton, et de poser au plus trois questions
  courtes quand la personne ne l'a pas dit. Si une demande arrive malgré tout
  presque vide (« un site »), Mocky ne devine pas : il rend à l'assistant trois
  questions, dans la langue de la personne, et génère une fois qu'elles ont une
  réponse.
- **Le type d'écran.** L'assistant choisit l'un des types de Mocky (le « Type d'écran » du composer : tableau de bord, landing, flyer, CV, post Instagram…), qui décide du format — un flyer est une page A4, un post Instagram une image 4:5. Une taille nommée dans la demande (« en 1:1 », « une story », « A3 ») va dans `page_format`, ou est lue dans les mots quand l'assistant ne la passe pas : un post demandé en 1:1 est un jour revenu en carré dessiné dans une page 4:5, avec une bande blanche dessous. S'il ne le fait pas, Mocky lit le type, et l'appareil, dans les mots de la demande (« un flyer », « une appli mobile ») ; la réponse indique le type retenu.
- **Les images : c'est l'assistant qui choisit.** Pas le modèle de Mocky :
  l'assistant cherche dans les banques libres et regarde lui-même les
  miniatures, ou apporte une image qu'il a, l'ajoute avec `add_image`, et la
  passe au design avec son usage (« hero : la devanture »). La page a pour
  consigne d'utiliser chacune, par son adresse sur Mocky, et de n'en inventer
  aucune autre. Une image donnée par adresse est l'envoi de la personne, avec la
  même responsabilité sur ses droits ; son téléchargement passe le garde SSRF à
  chaque redirection, est plafonné à 15 Mo et ne garde qu'un JPEG, PNG ou WebP —
  jamais un SVG. Les photos libres suivent l'accès du compte (Admin →
  Fournisseurs). Claude ne génère pas d'images ; ChatGPT peut transmettre une
  image qu'il a faite, par les liens de fichiers de son Apps SDK.
- **Quand l'assistant n'en apporte pas.** Un post ou un document a quand même
  son image, comme le choix « Images » du composer lui en donne une :
  `picture_source` `auto` (par défaut) prend une photo libre quand le compte y a
  accès, une image générée sinon ; `free`, `generated` ou `none` le disent
  explicitement. La réponse dit toujours quelle image l'écran a reçue.
  L'assistant est invité à dire ce que cette image doit montrer
  (`picture_subject`, en anglais) : un sujet deviné à partir d'une demande
  rédigée comme une consigne (« créer directement dans Mocky le visuel… ») a
  donné un jour une tombe militaire pour une fête du goût. Et en `auto`, une
  photo libre n'est prise que si le modèle de Mocky peut regarder les
  candidates ; sinon l'image est générée.
- **Muse.** Activée par défaut dans `create_design` : le premier écran d'un
  nouveau projet fixe la direction que suivront les autres, et laissée au choix
  de l'assistant, Muse ne tournait presque jamais. Désactivée dans `add_screen`,
  où le projet a déjà sa direction ; `muse` l'active ou la coupe dans les deux
  cas. Le `picture_subject` arrive dans son dossier, qui prévoit l'image. Avec des
  images fournies, Muse regarde la première avant d'écrire son dossier et les
  place dans ses emplacements au lieu d'en créer — la palette est donc choisie
  avec la photo, pas à côté.
- **Une passe par outil.** `edit_design`, `polish_design` et
  `fix_accessibility` exécutent chacun UNE des passes de Mocky, avec sa propre
  consigne — une modification fait ce qu'on lui dit, un polissage peut
  retoucher le style, une correction d'accessibilité doit laisser l'écran
  identique à l'œil — si bien qu'en demander une n'en lance jamais une autre.
  Chacune garde la version précédente de l'écran : **Revenir à la version
  précédente**, dans le menu de l'écran, annule ce qu'a fait l'assistant. Un
  écran modifié dans un onglet pendant la passe est laissé tel quel, et la
  réponse le dit. Un audit ne change rien, fonctionne pendant la maintenance et
  n'est pas compté dans le quota quotidien.
- **Le même Mocky.** Le design est fait par l'exécuteur sans interface
  (ci-dessous), avec le même pipeline que l'interface, et enregistré dans le
  compte — dans un onglet déjà ouvert sur ce projet, le nouvel écran apparaît
  tout seul.
- **L'attente.** Une génération prend de trente secondes à quelques minutes. Un
  appel attend une quarantaine de secondes ; au-delà, l'assistant reçoit un
  identifiant de travail et appelle `get_design`, qui attend de nouveau.
- **L'aperçu vivant.** Dans un hôte qui affiche les MCP Apps (Claude, ChatGPT),
  la réponse est aussi le design lui-même, vivant dans la conversation : il
  défile, ses boutons et ses animations fonctionnent, et **Ouvrir dans Mocky**
  mène au projet. C'est une petite page (`ui://mocky/screen-v1.html`) qui
  encadre une adresse de Mocky, `/mcp-view/…`, signée et valable un jour comme
  le lien de l'image — et servie isolée, exactement comme l'aperçu de
  l'interface (X7). Un hôte sans MCP Apps affiche l'image, comme avant. La vue
  lit le résultat dans la notification standard et dans le canal propre à
  ChatGPT (`window.openai`), et déclare son unique domaine encadré dans les deux
  vocabulaires ; quand elle ne reçoit rien, elle le dit dans le cadre au lieu de
  rester vide.
- **L'image** est un JPEG du haut de la page (2 000 px au plus) : la page entière
  est dans Mocky, derrière le lien. Pour un assistant dont l'interface n'affiche
  pas l'image d'un outil, la réponse porte aussi un **lien d'image** — ce JPEG
  seul, signé, valable un jour, et caduc après un redémarrage.
- **Le lien** ouvre le projet dans Mocky, centré sur le nouvel écran, pour une
  personne connectée à ce compte et personne d'autre.
- **Un seul design à la fois par compte** ; la maintenance refuse les nouveaux
  designs (les lectures restent possibles) ; le quota journalier facultatif les
  compte.
- **Dans Admin → Activité en direct et Utilisateurs**, un compte qui utilise
  Mocky par un assistant apparaît connecté, avec une marque **MCP** — y compris
  pendant qu'un design est fait pour lui.

## Pour l'administrateur

Tout se trouve dans **Admin → Assistants (MCP)**.

### Prérequis

La section est toujours visible et reste **verrouillée** tant que deux
conditions ne sont pas réunies. Elle les liste, avec une coche ou une croix :

1. **`MOCKY_ORIGIN` commence par `https://`.** Cette adresse devient l'émetteur
   OAuth et celle à laquelle les jetons sont liés (`${MOCKY_ORIGIN}/mcp`).
2. **Cette page d'administration vous est arrivée en HTTPS, sur cette adresse.**
   C'est la preuve que TLS et le reverse proxy fonctionnent, pas seulement que
   la variable est bien écrite. Derrière un proxy, Mocky lit
   `X-Forwarded-Proto` et `X-Forwarded-Host` ; réglez `TRUST_PROXY` comme
   l'indique la [page de déploiement](deployment.md).

Une troisième ligne n'est jamais cochée : **joignable depuis Internet** ne peut
pas se vérifier de l'intérieur — un test vers sa propre adresse publique échoue
derrière la plupart des NAT et réussit sur certaines installations qui ne sont
pas joignables de l'extérieur. Claude et ChatGPT se connectent depuis leurs
propres serveurs : la première connexion de l'un ou de l'autre est la seule
preuve. Un certificat auto-signé passe les deux vérifications et est refusé par
les deux assistants.

Le serveur applique la même règle de lui-même : l'activation est refusée (`409`)
tant qu'une vérification échoue, et si l'origine cesse d'être en HTTPS — variable
modifiée, proxy retiré — le serveur MCP est absent après le redémarrage suivant,
réglages et connexions conservés.

### L'activer

- **Autoriser la connexion d'assistants** — l'interrupteur. Le couper suspend
  toutes les connexions sans les supprimer ; elles reprennent si on le rallume.
- **Qui peut connecter un assistant** — tous les comptes, ou une liste. La liste
  commence **vide**, et un administrateur n'est **pas** autorisé par son seul
  rôle : ajoutez-vous si vous voulez l'utiliser, comme pour toutes les autres
  listes d'accès de Mocky.
- **Clients acceptés** — *Claude, ChatGPT et les clients sur la machine de la
  personne* (par défaut), ou *tout client MCP*. Décidé sur l'adresse où le
  client renvoie la personne après son accord : `claude.ai`, `claude.com`,
  `chatgpt.com`, ou une adresse locale.
- **Durées des jetons** — un jeton d'accès dure une heure par défaut ; une
  connexion inutilisée pendant trente jours expire.
- **Qui écrit le code d'un design** — le modèle de Mocky seulement (par
  défaut), au choix, ou le modèle de l'assistant seulement. Voir [Qui écrit le
  code](#qui-écrit-le-code).
- **Générations par compte et par jour** — vide veut dire illimité, comme dans
  l'interface. Quel que soit le réglage, une seule génération MCP à la fois par
  compte (à partir de l'exécuteur).

La page affiche l'**adresse à donner à l'assistant** — `${MOCKY_ORIGIN}/mcp` —
et la liste des **connexions actives** : compte, assistant, depuis quand,
dernier usage, et un bouton pour en couper une.

### L'exécuteur sans interface

Un design demandé depuis un assistant doit passer par le même pipeline que
l'interface — direction, Muse, planificateur, génération — et ce pipeline vit
dans le navigateur. Le serveur pilote donc **son propre Chromium** : il ouvre la
page `runner.html` de Mocky, qui exécute le pipeline, écrit le nouvel écran dans
le projet du compte et affiche son aperçu ; le serveur photographie ensuite cet
aperçu avec Chromium lui-même. Personne n'a besoin d'un onglet ouvert.

- **Prérequis.** Un Chromium — l'image Docker en installe un ; ailleurs, réglez
  `MOCKY_RUNNER_CHROMIUM` —, une interface construite (`npm run build`), et un
  `MOCKY_ORIGIN` en HTTPS. Un **fournisseur de génération configuré par
  l'administrateur** : l'exécuteur n'utilise jamais une clé gardée dans le
  navigateur de quelqu'un.
- **Vérifier l'exécuteur** (gratuit) : lance Chromium, charge la page de
  l'exécuteur, photographie un écran fixe. Aucun modèle n'est appelé.
- **Essai complet** (facturé comme toute génération) : une vraie génération dans
  *votre propre* compte, dans un projet nommé *Essai MCP*, avec son image et un
  lien vers lui.
- **Une seule génération à la fois par compte**, et `concurrency` en même temps
  pour l'instance (une par défaut).
- **Ce que son navigateur peut joindre.** Les requêtes vers l'adresse de Mocky
  sont servies par le serveur lui-même, en local, avec un jeton propre à ce
  travail — qui n'ouvre que les routes dont une génération a besoin (modèle,
  Muse, images, projets du compte) et meurt avec le travail. Tout le reste de ce
  que la page générée demande passe d'abord par le garde SSRF de Mocky : une
  police ou une image venue d'Internet passe, une adresse de votre réseau est
  refusée. Les WebSockets sont refusés.

### Ce qui est enregistré

- `mcp-config.json` — les réglages ci-dessus.
- `mcp-prefs.json` — le moteur par défaut de chaque personne, rien d'autre.
- `mcp-jobs.json` et `mcp-shots/` — les derniers travaux de l'exécuteur et les
  images qu'il a prises (les 200 dernières, une semaine au plus). Ni l'un ni
  l'autre ne voyage avec une migration.
- `mcp-oauth.json` — les clients enregistrés et les connexions, avec les jetons
  stockés **sous forme de hachage** (SHA-256) : une copie du fichier ne permet à
  personne d'appeler `/mcp`. Mode `0600`. Il ne **voyage pas** avec une
  [migration](migration.md) : comme les sessions, chaque assistant redemande
  l'accord une fois sur le nouveau serveur.
- Le **journal d'audit** gagne un groupe, *Assistants (MCP)* : un changement de
  réglages (noms des champs seulement), une connexion, une déconnexion, et un
  **jeton réutilisé** — deux parties qui détiennent le même jeton de
  rafraîchissement, ce qui coupe cette connexion.

Retirer un compte de la liste coupe ses connexions immédiatement ; supprimer un
compte les supprime.

## Qui écrit le code

Par défaut, c'est le modèle de Mocky qui écrit un design, avec le fournisseur de
l'instance. Un administrateur peut aussi laisser **le modèle de l'assistant**
l'écrire — celui de la conversation, sur l'abonnement de la personne — ou
n'autoriser que lui.

- **Ce que Mocky fait encore.** Tout ce qui n'est pas écrire le code : la
  direction, Muse, les images, le plan. Puis `create_design` (ou
  `add_screen`) répond **awaiting_code** avec les deux messages qu'aurait reçus
  le modèle de Mocky, mot pour mot — ses règles et la demande — et un
  identifiant de travail. L'assistant écrit le composant et l'envoie avec
  `submit_screen`.
- **Ce que Mocky vérifie.** Le code passe par la même extraction, le même
  nettoyage et la même garde des animations qu'un écran écrit par le modèle de
  Mocky, puis il est rendu. Une erreur de rendu — cette erreur seule — revient à
  l'assistant pour qu'il la corrige, deux fois au plus, comme la réparation de
  l'interface ; ensuite l'écran est gardé et la réponse dit qu'il ne s'affiche
  pas. Puis il est enregistré, photographié et lié comme n'importe quel design,
  et la réponse propose `polish_design`.
- **Qui paie quoi.** Les jetons du code sont pris sur l'abonnement de la
  personne ; Muse et les images restent à la charge de l'instance. Un modèle
  faible écrit un écran faible : c'est à cela que sert la passe de qualité
  proposée ensuite.
- **Qui choisit.** L'administrateur fixe les moteurs qui existent (**Qui écrit
  le code d'un design**). Quand les deux existent, chaque personne choisit le
  sien par défaut dans **Réglages → Assistants connectés**, et l'assistant peut
  demander l'autre pour une seule demande (`engine`). Un moteur non autorisé
  est refusé en le nommant, jamais remplacé par l'autre.
- **Les règles sont remises comme celles de Mocky**, et le dossier qu'elles
  contiennent est signalé comme un brief rédigé en partie à partir de sites web
  — de la matière, pas des consignes adressées à l'assistant. Les donner n'est
  pas une question de licence : Mocky est sous AGPL et elles sont dans ses
  sources.
- **Pendant que l'assistant écrit**, le travail occupe une place de l'exécuteur
  et l'unique travail du compte ; dix minutes sans code et il s'arrête.

Les modifications, le polissage et les audits utilisent toujours le modèle de
Mocky.

## Pour la personne qui l'utilise

**Réglages → Assistants connectés** donne l'adresse du connecteur et liste les
assistants que ce compte a autorisés, chacun avec **Déconnecter**. Quand
l'administrateur autorise les deux moteurs, elle demande aussi **qui écrit le
code de vos designs**. Si la section
indique que la fonction est désactivée, ou que le compte n'est pas autorisé,
c'est une décision d'administrateur.

Pour se connecter — la page donne à chaque assistant ses propres étapes,
l'adresse à copier, et la ligne unique quand elle existe :

| Assistant | Comment |
|---|---|
| **Claude** (claude.ai, bureau, mobile) | **Ouvrir les connecteurs de Claude** (claude.ai/customize/connectors) → **+** → *Ajouter un connecteur personnalisé* : nommez-le « Mocky », collez l'adresse. Ajouté une fois, il est disponible dans les trois. |
| **ChatGPT** | Réglages → Applications → Paramètres avancés : activez le *mode développeur*, puis *Créer une application* : nommez-la « Mocky », collez l'adresse, authentification OAuth. |
| **Claude Code** | Une ligne, puis `/mcp` dans Claude Code pour donner votre accord. |

```bash
claude mcp add --transport http --scope user mocky https://<votre-mocky>/mcp
```

Claude Code est le seul à accepter un connecteur en une ligne : claude.ai,
Claude Desktop et ChatGPT n'ont ni lien d'installation ni fichier pour un
connecteur distant, à dessein — la personne l'ajoute dans ses propres réglages.
(Une *skill* Claude ne le peut pas non plus : une skill apprend à Claude à faire
quelque chose, elle n'ajoute pas de connecteur. Bien utiliser Mocky, le
connecteur l'enseigne déjà lui-même, avec `mocky_guide`.) Pour Claude Desktop
avec un Mocky que les assistants ne peuvent pas joindre, voir
[Un Mocky que les assistants ne peuvent pas joindre](#un-mocky-que-les-assistants-ne-peuvent-pas-joindre).

Ensuite, dans tous les cas :

1. Demandez un design. La première fois, l'assistant ouvre Mocky.
   Connectez-vous si on vous le demande.
2. Mocky indique quel assistant demande l'accès, au nom de quel compte il
   agirait, et vers où vous serez renvoyé. **Autoriser** ou **Refuser** — un
   refus est transmis à l'assistant, qui cesse d'attendre.

## Comment c'est protégé

- **La session Mocky décide de qui vous êtes.** La page d'autorisation OAuth
  envoie le navigateur vers la page de consentement de Mocky ; aucun mot de
  passe n'est jamais saisi pour un assistant, et rien n'est accordé sans le clic.
- **OAuth 2.1 avec PKCE (S256)**, enregistrement dynamique des clients, et des
  jetons liés à une seule ressource (RFC 8707) : un jeton émis pour une autre
  adresse est refusé.
- **Les jetons de rafraîchissement tournent**, et un ancien présenté à nouveau
  révoque sa connexion — c'est à cela que ressemble un jeton volé.
- **L'accès est relu à chaque appel**, pas au moment où le jeton a été émis.
- **Rien de privé ne sort** : les notes d'un écran n'atteignent jamais un
  assistant, ni une clé, ni les données d'un autre compte ; un projet qui n'est
  pas le vôtre répond comme un projet qui n'existe pas.
- **Aucune requête sortante.** Le serveur MCP ne va jamais chercher ce qu'un
  client désigne : il n'ajoute rien à la surface du
  [garde SSRF](architecture/invariants.md).

- **Un écran servi seul reste isolé.** L'adresse de l'aperçu vivant sert du
  code écrit par un modèle depuis l'origine même de Mocky ; elle répond donc
  avec `Content-Security-Policy: sandbox allow-scripts` : une origine opaque,
  ni cookie ni stockage, quel que soit celui qui l'ouvre.

Les règles sont écrites dans la [série X](architecture/invariants.md) des
invariants, X5 et X6 pour l'exécuteur, X7 pour l'aperçu vivant.

## Un Mocky que les assistants ne peuvent pas joindre

Claude et ChatGPT se connectent depuis leurs propres serveurs : un Mocky sur un
réseau local, derrière un VPN, ou avec un certificat que seules vos machines
reconnaissent, leur est inaccessible. Un client qui tourne **sur votre
machine** — Claude Desktop, Claude Code — peut en revanche lancer un programme
local, et `bridge/mocky-mcp.js` est ce programme : il parle stdio au client et
HTTPS au `/mcp` de Mocky, et relaie chaque message sans le modifier. Mocky
reste le serveur : même interrupteur, même liste, même page de consentement.

- **Prérequis.** Le serveur MCP activé, ce qui demande toujours une origine
  `https://` — un certificat de votre propre autorité convient : donnez-le à
  Node avec `NODE_EXTRA_CA_CERTS`, jamais en désactivant les vérifications.
  Node 22.12+ sur la machine, et les fichiers du pont (le dossier `bridge/` de
  ce dépôt, avec `npm install` lancé dedans).
- **Claude Desktop** — dans `claude_desktop_config.json` :

  ```json
  {
    "mcpServers": {
      "mocky": {
        "command": "node",
        "args": ["/chemin/vers/mocky/bridge/mocky-mcp.js", "--url", "https://mocky.lan"],
        "env": { "NODE_EXTRA_CA_CERTS": "/chemin/vers/votre-ca.pem" }
      }
    }
  }
  ```

- **La première fois**, votre navigateur s'ouvre sur la page de consentement de
  Mocky : connectez-vous, **Autoriser**. La réponse revient sur `127.0.0.1`
  seulement (port 33418, ou `--port`), et la connexion est gardée dans
  `~/.mocky-mcp/`, lisible par vous seul. Mocky la liste comme *Mocky bridge*
  dans Réglages → Assistants connectés, où **Déconnecter** la coupe ; le
  démarrage suivant redemande alors l'accord.
- **Sur une machine sans navigateur**, `MOCKY_MCP_BROWSER=none` affiche
  l'adresse à ouvrir ; `MOCKY_MCP_HOME` déplace `~/.mocky-mcp`.

## Développement

`MOCKY_MCP_INSECURE_LOOPBACK=1` accepte une origine `http://localhost` ou
`http://127.0.0.1`. Rien hors de la machine ne peut joindre une adresse locale :
cela ne sert qu'un client sur la même machine — Claude Code, par exemple — et le
test de bout en bout (`tests/mcp-oauth-e2e.test.js`). Jamais sur un serveur.
