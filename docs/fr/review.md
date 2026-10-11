---
description: Envoyer un projet à un client avec un lien sans compte ; il épingle des commentaires sur les écrans, puis l’approuve ou demande des modifications.
badge: Nouveau
source_hash: 9dabb9f252a0
---

# Envoyer un projet en validation

Un projet a un **statut** : `Brouillon`, `À valider`, `Modifications demandées`
ou `Approuvé`. Vous le changez en envoyant le projet à quelqu’un — un client, un
collègue — qui regarde les écrans, y **épingle des commentaires**, puis
**approuve** le projet ou **demande des modifications**. Il n’a besoin d’aucun
compte sur votre instance.

Ouvrez-le avec `Validation` dans la barre d’outils du projet.

## Envoyer

:::steps id=send-for-approval
1. **Choisissez la durée du lien** : 7, 30 ou 90 jours.
2. **Appuyez sur `Envoyer en validation`.** Le projet est enregistré comme une
   version, exactement tel qu’il est, et un lien est créé. Le statut passe à
   `À valider`.
3. **Envoyez le lien** — copiez-le, ou montrez son code QR.
:::

:::why
Ce que voit le client est **figé** : modifier le projet ensuite ne change rien à
sa page. Une approbation porte sur quelque chose de précis, et « il a approuvé
la version envoyée le 3 » est une phrase qu’on peut encore vérifier un an plus
tard — la version est dans le panneau [Versions](versions.md) comme les autres.
:::

## Ce que voit le client

Le lien ouvre une page avec les écrans du projet et rien d’autre de Mocky :

- `Naviguer` — les écrans fonctionnent comme un site ; les liens que vous avez
  tracés entre les écrans sont suivis.
- `Commenter` — un clic sur un écran pose une **épingle numérotée**, et le
  commentaire y est attaché. `Remarques générales` reçoit les commentaires sur
  l’ensemble du projet.
- `Approuver` ou `Demander des modifications`, en haut. Demander des
  modifications oblige à dire ce qui doit changer.

Le client signe avec un nom qu’il tape. Rien ne vérifie ce nom : le lien fait
autorité, envoyez-le donc seulement aux personnes qui doivent répondre.

:::why
La page ne reçoit jamais la demande d’un écran, sa direction enregistrée ni vos
notes privées : seulement ce qu’il faut pour le dessiner. Un brief est souvent la
partie confidentielle d’un projet.
:::

## Lire les réponses

Le statut s’affiche sur la carte du projet, à côté de son nom dans l’en-tête, et
sur le bouton `Validation` avec le **nombre de nouveaux retours**.

`Commentaires (N)` ouvre le même plateau que celui du client — mêmes écrans,
mêmes épingles. Vous pouvez **répondre** à un commentaire et le marquer
**traité** (`Marquer comme traité`).

## Les quatre statuts

| Statut | Signifie |
|---|---|
| `Brouillon` | Jamais envoyé, ou ramené avec `Repasser en brouillon`. Les brouillons n’affichent pas d’étiquette sur les cartes. |
| `À valider` | Un lien est parti et personne n’a encore décidé. |
| `Modifications demandées` | Le client a demandé des modifications. Faites-les, puis `Envoyer la nouvelle version`. |
| `Approuvé` | Le client a approuvé la version envoyée. |

`Envoyer la nouvelle version` enregistre l’état actuel et crée un **nouveau
lien** ; le précédent reste lisible mais ne prend plus de commentaire.
`Repasser en brouillon` clôt le lien actuel de la même façon. `Révoquer le lien`
le fait cesser de fonctionner immédiatement.

Le client peut changer d’avis tant que le lien est ouvert : chaque décision est
gardée, dans l’ordre.

## Limites

| | |
|---|---|
| Appels au modèle | Aucun. |
| Commentaires | 400 par lien, 2 000 caractères chacun. |
| Liens | 100 par compte. Une version montrée par un lien actif ne peut pas être supprimée — révoquez d’abord le lien. |

Supprimer un compte révoque ses liens.
