---
source_hash: 93f091623d0d
---

# Maintenance et migration de serveur

Deux outils d'administration qui forment une seule procédure : le **mode
maintenance** passe l'instance en lecture seule, et la **migration** déplace une
instance entière — comptes, projets, clés des fournisseurs, images, séquences,
films — vers un autre serveur, morceau par morceau, en vérifiant le nouveau
serveur avant de remplacer quoi que ce soit.

Les deux se trouvent dans **Admin → Maintenance et migration**.

## Le mode maintenance

Quand il est actif, chaque utilisateur peut toujours se connecter, ouvrir ses
projets et parcourir ses médias, mais **rien ne peut être créé, modifié ni
supprimé** — génération comprise. Un bandeau l'annonce, avec le message écrit
par l'administrateur (une heure de retour, par exemple). Les administrateurs ne
sont pas bloqués.

### Pourquoi la lecture seule, et pas seulement « ni création ni suppression »

La demande initiale était d'interdire la création et la suppression en laissant
les modifications possibles. Cette règle ne peut pas être appliquée honnêtement :
les projets d'un utilisateur arrivent au serveur en **un seul bloc**
(`PUT /api/data`), si bien que le serveur ne distingue une modification d'une
suppression qu'en comparant chaque projet. Et la raison principale d'être de la
maintenance, c'est le passage final d'une migration — après lequel une
*modification* est perdue exactement comme une création.

La règle est donc un refus par défaut sur la méthode HTTP (`server/maintenance.js`) :
tout `POST`, `PUT`, `PATCH` et `DELETE` reçoit un `503` avec
`code: "maintenance"`, sauf la connexion et la déconnexion — et deux POST qui
n’écrivent rien : le battement de présence, et `/mcp`, dont les outils qui
écrivent vérifient eux-mêmes la maintenance ([MCP](mcp.md)). Une route ajoutée
l'an prochain est couverte sans que personne ne pense à l'ajouter. Le seul `GET`
qui écrit — le retour SSO Dashy qui crée un compte à la première connexion —
refuse d'en créer.

### Ce que voit un utilisateur

- le bandeau, rafraîchi chaque minute et immédiatement après une écriture refusée ;
- l'indicateur de synchronisation affiche **En pause** plutôt qu'un échec en
  rouge : les modifications restent dans le navigateur et partent dès la fin de
  la maintenance ;
- une génération échoue avec le message de maintenance.

### Pourquoi les administrateurs passent

Après un import, le nouveau serveur démarre **en maintenance** (le réglage voyage
avec `config.json`), et la personne qui le vérifie doit pouvoir ouvrir un projet
et essayer une génération avant de laisser entrer les autres. La contrepartie :
sur l'**ancien** serveur, ce qu'un administrateur modifie après le passage final
n'est pas transféré. Le bandeau le lui rappelle.

## Changer de serveur

### La procédure

1. **Nouveau serveur** : installez Mocky (même version ou plus récente),
   démarrez-le, créez le premier compte — il devient administrateur.
2. **Ancien serveur** : Admin → *Ce serveur est l'ancien* → votre mot de passe →
   **Générer un code de transfert**. Copiez-le : il n'est affiché qu'une fois.
3. **Nouveau serveur** : Admin → *Ce serveur est le nouveau* → l'adresse de
   l'ancien serveur et le code → **Se connecter et vérifier**. Lisez la liste de
   vérifications (plus bas).
4. **Premier passage**, pendant que l'ancien serveur est encore utilisé. C'est le
   plus long : toute la bibliothèque vidéo traverse.
5. **Ancien serveur** : activez la **maintenance**. Attendez la fin des rendus en
   cours.
6. **Nouveau serveur** : **Lancer un nouveau passage**. Il ne transfère que ce qui
   a changé : les utilisateurs sont bloqués quelques minutes, pas des heures.
7. **Nouveau serveur** : votre mot de passe → **Remplacer les données de ce
   serveur**. Mocky redémarre (tout seul sous Docker, `restart: unless-stopped` ;
   à la main sinon).
8. Connectez-vous au nouveau serveur **avec vos identifiants de l'ancien**,
   vérifiez, puis **désactivez** la maintenance. Basculez le DNS. Révoquez le code
   sur l'ancien serveur.

### Pourquoi le nouveau serveur tire les données

Le côté qui *reçoit* doit exposer de quoi écrire des comptes, des empreintes de
mots de passe et des clés de fournisseurs dans son dossier de données — la
capacité la plus dangereuse que l'application puisse avoir. En tirant les
données, cette capacité devient un téléchargement sortant vers une zone
d'attente, sur le serveur devant lequel l'administrateur est assis ; l'ancien
serveur ne fait jamais que **lire**, et seulement les fichiers que sa propre
liste nomme. L'ancien serveur est aussi celui qui est déjà joignable — il sert
les utilisateurs — alors que le nouveau ne l'est souvent pas avant la bascule du
DNS.

Les autres solutions, et pourquoi elles ont été écartées :

| | Pour | Contre |
|---|---|---|
| L'ancien serveur pousse | Simple à se représenter | Le nouveau expose une route d'écriture pour tout, et doit être joignable avant la bascule |
| Une archive chiffrée à télécharger puis téléverser | Aucun réseau entre les deux | Pas incrémental ; un envoi de plusieurs Go qu'un proxy peut refuser ; un échec fait tout recommencer |
| **Le nouveau serveur tire** (retenu) | Incrémental, reprend après coupure, n'écrit qu'en local, vérifié fichier par fichier | Plus de code ; un quatrième contournement du garde SSRF (plus bas) |

### La liste de vérifications

À la connexion, puis avant chaque passage, le nouveau serveur se compare à ce que
l'ancien déclare. Quatre vérifications **bloquent**, parce que continuer
casserait quelque chose à coup sûr :

- **Node** inférieur à 22.12 ;
- **Mocky** plus ancien que celui de l'ancien serveur (une version plus ancienne
  perd, à la première écriture, les champs qu'elle ne connaît pas) ;
- **espace disque** inférieur à la taille totale plus 10 % ;
- un dossier de données **non accessible en écriture**.

Les autres avertissent, parce que l'administrateur s'apprête peut-être à les
corriger : une instance qui contient déjà des données (mises de côté, puis
remplacées) ; **ffmpeg** absent alors que l'ancien serveur a des séquences ; le
**worker de rendu** injoignable à l'adresse qu'utiliseront les réglages importés ;
le **SSO Dashy** absent ou différent (son secret est comparé par une empreinte
à clé, jamais envoyé) ; un **MOCKY_ORIGIN** différent ; **TRUST_PROXY** défini
d'un seul côté ; des horloges décalées de plus d'une minute (au-delà de quatre,
c'est bloquant, car les signatures cessent de fonctionner) ; l'ancien serveur pas
encore en maintenance ; des rendus en cours.

Après l'import, **Vérifier l'intégrité** recalcule l'empreinte de chaque fichier
importé et la compare à la liste d'origine.

### Ce qui part, et ce qui reste

Tout le dossier de données part, **sauf** :

- `sessions.json` — un jeton de session vaut un identifiant, et un jeton en
  transit est un endroit de plus d'où il peut fuiter. Chacun se reconnecte une
  fois ;
- `sso-jti.json` — un cache anti-rejeu pour des jetons de 60 secondes ;
- `mcp-oauth.json` — les jetons des assistants connectés ([MCP](mcp.md)), pour
  la raison qui fait rester les sessions : chaque assistant redemande l’accord
  une fois ;
- les fichiers temporaires et les liens symboliques.

La liste est « tout, moins ceux-là » plutôt qu'une énumération des stockages,
pour que le prochain stockage ajouté ne soit pas oublié en silence.

Les variables d'environnement (`.env`, compose) ne partent **pas** : elles
appartiennent à la machine. C'est la liste de vérifications qui dit lesquelles
comptent.

### Sécurité

- **Chiffrement de bout en bout.** Le code d'appairage fait 160 bits aléatoires.
  Les deux serveurs en dérivent (HKDF-SHA256) un identifiant public, une clé qui
  signe chaque requête (HMAC-SHA256 sur la méthode, le chemin, l'heure et un
  nonce) et une clé qui scelle chaque réponse (AES-256-GCM, liée au nonce de la
  requête). Du HTTP en clair sur un réseau local, ou un proxy qui journalise les
  corps, n'apprend rien et ne peut rien modifier.
- **Rejeu et force brute.** Une requête décalée de plus de cinq minutes, ou dont
  le nonce a déjà servi, est refusée. Après 20 signatures fausses, le code se
  révoque de lui-même.
- **En mémoire seulement.** Le code et les clés qui en dérivent ne sont jamais
  écrits sur disque, d'un côté comme de l'autre. Il expire au bout de 24 heures,
  se révoque d'un bouton, et à chaque redémarrage de l'ancien serveur.
- **Mot de passe redemandé.** Générer un code et remplacer les données
  redemandent le mot de passe de l'administrateur : un portable déverrouillé est
  une session. (Un administrateur uniquement SSO n'a pas de mot de passe Mocky ;
  Dashy s'est porté garant de lui à la connexion.)
- **Chemins fermés.** L'ancien serveur ne sert que les fichiers de sa dernière
  liste ; le nouveau refuse une liste contenant un chemin qu'il n'écrirait pas —
  `..`, séparateurs, lettres de lecteur, noms cachés — et vérifie encore que
  chaque chemin aboutit dans sa zone d'attente.
- **Deux temps.** Rien hors de `.migration/` ne change avant le remplacement, et
  le remplacement déplace le contenu précédent dans `.migration/previous-<heure>/`
  au lieu de le supprimer.
- **Journaux.** Chaque événement tient sur une ligne, `mocky migration <event> …`,
  au même format fixe que `mocky auth`.

L'adresse saisie sur le nouveau serveur est le **quatrième contournement du garde
SSRF réservé à l'administrateur** (voir [les invariants](architecture/invariants.md)) :
passer d'une machine à l'autre sur un même réseau local est le cas ordinaire, et
le garde refuse les adresses privées. Ce qu'il permettrait normalement — lire un
service interne — il ne le permet pas ici : une réponse n'est utilisée que si elle
s'ouvre avec la clé d'appairage.

### Si quelque chose tourne mal

- **Un passage échoue ou est coupé** : relancez-en un. Ce qui est déjà en zone
  d'attente avec la bonne empreinte n'est pas retéléchargé.
- **Le nouveau serveur a redémarré en cours de transfert** : saisissez à nouveau
  le code ; la zone d'attente est conservée.
- **L'ancien serveur a redémarré** : son code a disparu. Générez-en un nouveau et
  reconnectez-vous ; la zone d'attente est conservée.
- **L'import se révèle mauvais** : arrêtez Mocky, remettez le contenu de
  `.migration/previous-<heure>/` dans le dossier de données, redémarrez.
