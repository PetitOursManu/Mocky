---
source_hash: 88b6ed9bd930
---

# Connecter un assistant (MCP)

Mocky peut être un **serveur MCP** : Claude, ChatGPT ou un autre client MCP s'y
connecte et agit dans Mocky au nom d'un compte. La personne se connecte à Mocky,
dit oui une fois, et l'assistant peut ensuite travailler avec ses projets.

C'est **désactivé par défaut**, et désactivé veut dire absent : aucun point
d'accès, aucun document de découverte, rien qu'un scanner puisse trouver. Un
administrateur l'active, pour les comptes qu'il choisit, et seulement sur une
instance servie en HTTPS.

Ce qu'un assistant peut faire aujourd'hui, c'est **lire la liste des projets** —
assez pour vérifier qu'une connexion fonctionne et qu'il s'agit du bon compte.
Créer et modifier des designs depuis la conversation arrive avec les étapes
suivantes du plan (`plans/mcp-serveur.md` dans le dépôt) : l'exécuteur sans
interface, qui génère sans onglet Mocky ouvert et renvoie une image du résultat
avec un lien vers le projet.

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

### Ce qui est enregistré

- `mcp-config.json` — les réglages ci-dessus.
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
invariants.

## Développement

`MOCKY_MCP_INSECURE_LOOPBACK=1` accepte une origine `http://localhost` ou
`http://127.0.0.1`. Rien hors de la machine ne peut joindre une adresse locale :
cela ne sert qu'un client sur la même machine — Claude Code, par exemple — et le
test de bout en bout (`tests/mcp-oauth-e2e.test.js`). Jamais sur un serveur.
