---
description: Des prototypes qui marchent — formulaires qui modifient les données, connexion simulée, vrais filtres, panier partagé entre les écrans — avec les écrans suivants créés pour vous, et des scénarios de démonstration.
badge: Nouveau
source_hash: 5778a0b66196
---

# Des prototypes qui fonctionnent

Avec `Parcours` activé dans le composeur (il l’est par défaut), un écran généré
n’est pas seulement l’image d’une page : c’est une page d’un **prototype qui
fonctionne** en [mode Démo](interface.md#le-mode-demo).

- **Les formulaires** vérifient ce qui est saisi et en font quelque chose.
- **La connexion** est simulée : n’importe quel e-mail bien formé avec un mot de
  passe de 4 caractères ou plus vous connecte, et l’écran suivant sait qui vous
  êtes.
- **Les filtres**, la recherche, les tris et les onglets changent vraiment ce
  qui est affiché.
- **Le panier** est partagé : ajoutez un produit sur un écran, le badge le
  compte sur tous les écrans, et l’écran du panier le liste.

Et les écrans vers lesquels mène un parcours sont **créés automatiquement**.

Sur un **document**, le même bouton désigne les pages qui se suivent — le recto
et le verso d’un flyer, le carrousel d’un post — voir
[Documents](documents.md#plusieurs-pages-a-la-suite-le-parcours).

## Les écrans créés pour vous

Demandez « une page de connexion pour une banque en ligne ». Le modèle écrit le
formulaire, et écrit qu’une connexion réussie ouvre la page appelée `account`.
Aucun écran du projet ne répond encore à `account` — alors Mocky le crée,
juste après, par une seconde génération : une page de compte qui accueille la
personne qui vient de se connecter.

:::why
C’est le modèle qui a écrit la connexion qui sait ce qui vient après — pas la
personne qui a demandé une connexion. Mocky lit donc le code du nouvel écran
pour trouver les pages qu’il ouvre, et crée celles qui n’existent pas encore, en
disant à chacune quelles données l’écran précédent a écrites : la page de compte
lit l’utilisateur que la page de connexion a enregistré, avec la même forme.
:::

Quelques règles gardent la mesure :

| | |
|---|---|
| Combien | **3 écrans au plus** par génération, en suivant le parcours sur deux niveaux (un panier, son paiement, sa confirmation). |
| Ce que ça coûte | Chaque écran créé est une **génération normale** avec votre modèle. Muse et Motion Ultra ne tournent pas pour eux : ils prennent la direction et l’apparence du projet. |
| Quand | Seulement pour un **nouvel** écran avec `Parcours` activé — jamais pour une modification, jamais pour un document. |
| Noms | Les pages habituelles reçoivent un nom dans votre langue (`Panier`, `Mon compte`, `Confirmation`…). |

Désactivez `Parcours` dans le composeur pour générer un écran seul, exactement
comme avant.

## L’essayer : le mode Démo

En `Démo`, les écrans partagent leurs données pendant que vous passez de l’un à
l’autre. Connectez-vous sur le premier écran, et l’écran du compte vous dit
bonjour ; ajoutez deux produits, et le panier les liste.

- `Données (N)` montre les données que les écrans partagent en ce moment —
  l’utilisateur connecté, le panier, les formulaires envoyés — et `Tout vider`
  les efface.
- `Recommencer` revient au premier écran avec les données de départ.
- Un bouton qui ouvre une page à laquelle aucun écran ne répond le dit dans la
  barre, au lieu de ne rien faire.

Sur le canevas, `Interagir` fait fonctionner un écran seul : son formulaire, ses
filtres. Passer à un autre écran, c’est le travail de la démo.

## Les scénarios

Un scénario est **une façon de commencer la démo** : un écran, et les données
telles qu’elles doivent être. « Un visiteur », « un client connecté avec deux
articles dans le panier ».

:::steps id=record-a-scenario
1. **Jouez la démo jusqu’à l’état voulu** — connectez-vous, remplissez le panier.
2. **Appuyez sur `+` à côté de la liste des scénarios**, et nommez-le.
3. **Choisissez-le dans la liste** chaque fois que vous montrez le prototype :
   la démo commence sur cet écran, avec ces données. `Recommencer` y revient.
:::

Les scénarios sont enregistrés avec le projet (20 au plus, 64 ko de données
chacun). La corbeille à côté de la liste supprime celui qui est choisi.

## La route d’un écran

Les écrans s’ouvrent les uns les autres par **route** — un nom court comme
`cart` ou `account`. Un écran créé pour un parcours porte sa route ; tout autre
écran répond à son nom (un écran appelé « Panier » répond à `panier`).

## Dans le lien de validation et l’export

Le client qui ouvre un [lien de validation](review.md) peut essayer le parcours
lui aussi : la connexion et le panier fonctionnent comme en démo.
Dans un [projet exporté](interface.md#la-barre-doutils-du-projet), les écrans
partagent les mêmes données et s’ouvrent par route.
