---
source_hash: 59894892a715
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
| `create_design` | Génère un nouvel écran à partir d'une description, toujours dans un **nouveau projet**, et renvoie **une image du résultat et un lien** vers lui dans Mocky. |
| `add_screen` | La même chose, dans un **projet existant** — où l'écran suit la direction artistique de ce projet. Seulement quand la personne nomme ce projet : un assistant ne doit jamais en choisir un parce qu'il semble proche, et la réponse dit dans quel projet l'écran est allé. |
| `get_design` | Attend un design encore en cours, puis renvoie la même chose. |
| `list_projects` | Les projets du compte, chacun avec un lien. |
| `get_project` | Les écrans d'un projet : nom, appareil, la demande qui l'a créé, un lien. |
| `get_screenshot` | Une image d'un écran qui existe déjà. |
| `search_free_images` | Des photos libres des banques auxquelles ce Mocky est relié (Pexels, Pixabay), en miniatures que l'assistant regarde. |
| `add_image` | Met une image dans la bibliothèque du compte pour un design : une photo libre choisie ci-dessus, une image de la conversation (générée par ChatGPT, ou jointe par la personne), ou une adresse publique. |

Et un prompt, **new-design** (le menu « / » de Claude), qui démarre un court
entretien avant de dessiner.

- **D'abord les questions.** L'assistant a pour consigne de savoir de quel écran
  il s'agit, pour qui et dans quel ton, et de poser au plus trois questions
  courtes quand la personne ne l'a pas dit. Si une demande arrive malgré tout
  presque vide (« un site »), Mocky ne devine pas : il rend à l'assistant trois
  questions, dans la langue de la personne, et génère une fois qu'elles ont une
  réponse.
- **Le type d'écran.** L'assistant choisit l'un des types de Mocky (le « Type d'écran » du composer : tableau de bord, landing, flyer, CV, post Instagram…), qui décide du format — un flyer est une page A4, un post une image carrée. S'il ne le fait pas, Mocky lit le type, et l'appareil, dans les mots de la demande (« un flyer », « une appli mobile ») ; la réponse indique le type retenu.
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
- **Le même Mocky.** Le design est fait par l'exécuteur sans interface
  (ci-dessous), avec le même pipeline que l'interface, et enregistré dans le
  compte — dans un onglet déjà ouvert sur ce projet, le nouvel écran apparaît
  tout seul.
- **L'attente.** Une génération prend de trente secondes à quelques minutes. Un
  appel attend une quarantaine de secondes ; au-delà, l'assistant reçoit un
  identifiant de travail et appelle `get_design`, qui attend de nouveau.
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

## Pour la personne qui l'utilise

**Réglages → Assistants connectés** donne l'adresse du connecteur et liste les
assistants que ce compte a autorisés, chacun avec **Déconnecter**. Si la section
indique que la fonction est désactivée, ou que le compte n'est pas autorisé,
c'est une décision d'administrateur.

Pour se connecter :

1. **Claude** — ajoutez un connecteur personnalisé avec l'adresse. **ChatGPT** —
   créez un connecteur en mode développeur avec l'adresse.
2. L'assistant ouvre Mocky. Connectez-vous si on vous le demande.
3. Mocky indique quel assistant demande l'accès, au nom de quel compte il
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

Les règles sont écrites dans la [série X](architecture/invariants.md) des
invariants, X5 et X6 pour l'exécuteur.

## Développement

`MOCKY_MCP_INSECURE_LOOPBACK=1` accepte une origine `http://localhost` ou
`http://127.0.0.1`. Rien hors de la machine ne peut joindre une adresse locale :
cela ne sert qu'un client sur la même machine — Claude Code, par exemple — et le
test de bout en bout (`tests/mcp-oauth-e2e.test.js`). Jamais sur un serveur.
