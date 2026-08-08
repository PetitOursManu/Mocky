# L’interface

Mocky affiche énormément de contrôles, et presque aucun ne porte un verbe.
C’est délibéré — un outil de canevas qui expliquerait chaque bouton serait un mur
de texte — mais cela laisse un trou que cette page vient combler : **ce que fait
réellement chaque contrôle, lesquels se confondent entre eux, et lesquels
consomment des jetons.**

Ce n’est pas une visite guidée. On suppose que vous voyez le bouton ; on vous
dit ce que vous ne voyez pas.

---

## Comment lire cette page

Chaque icône ci-dessous est la vraie, tracée à partir des mêmes chemins que
l’interface qui tourne (`src/ui/Icon.tsx`). Si un bouton de votre fenêtre
ressemble à l’icône du tableau, c’est ce bouton-là.

Chaque libellé est cité tel quel depuis `src/i18n/fr.ts` et
`src/i18n/parts/*.ts`. L’interface anglaise n’est pas une traduction de la
française — les deux sont rédigées — donc si vous faites tourner Mocky en
anglais, lisez `interface.md` plutôt que de retraduire.

Le coût est la dernière colonne de chaque tableau :

| Coût | Ce que ça veut dire |
|---|---|
| **libre** | Rien ne sort du navigateur. Un état qui bascule, un calcul local, un fichier écrit de mémoire. |
| **serveur** | Un aller-retour vers le backend Mocky. Aucun modèle, aucun jeton — mais il faut que le backend réponde. |
| **modèle** | Consomme des jetons. Chacun est derrière un clic explicite ; aucun ne se déclenche tout seul. |
| **image** | Appelle le fournisseur d’images. Plus lent et plus cher qu’un appel de texte. |

Un récapitulatif de tout ce qui appelle un **modèle** se trouve
[en fin de page](#tout-ce-qui-consomme-des-jetons).

---

## La navigation principale

La barre en haut de toutes les routes. Rien ici ne touche au contenu d’un
projet : ce n’est que navigation, thème et compte.

| | Contrôle | Ce qu’il fait | Coût |
|---|---|---|---|
| | **Mocky** (marque) | `Accueil Mocky` — retour à la liste des projets. | libre |
| | Nom du projet (fil d’Ariane) | **Deux contrôles différents sous un seul libellé.** Hors du projet, c’est `Revenir au projet`. Dans le projet, il devient un champ : `Renommer le projet`. Entrée ou la perte du focus valide, Échap annule. | libre |
| | `Accueil` | La liste des projets. | libre |
| | `DESIGN.md` | L’éditeur pleine page de la direction artistique. | libre |
| | `Média` | La bibliothèque d’images en page plutôt qu’en modale. | libre |
| | `Réglages` | Fournisseur, clé, modèle. | libre |
| | `Admin` | Rendu seulement si votre compte est administrateur — et la route revérifie, si bien qu’une URL tapée à la main tombe sur `Réservé aux administrateurs.` et non sur le panneau. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg> | `Docs` | La seule entrée qui soit un vrai lien : elle ouvre `https://mocky-docs.emanuelvigreux.fr` dans un nouvel onglet. La petite flèche est là pour le dire. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg> <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg> | Thème | `Passer au thème Papier` / `Passer au thème Encre`. **L’icône est la destination, pas l’état courant** : un soleil veut dire « aller vers le clair », et il s’affiche pendant que vous êtes dans le thème sombre. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0"/></svg> | Compte | `Connecté — cliquez pour vous déconnecter`. Une confirmation est demandée d’abord, et la déconnexion laisse vos projets sur cet appareil. | libre |
| | `Se connecter` | Ouvre la modale d’authentification. `Connectez-vous pour retrouver vos projets sur tous vos appareils`. | libre |

**Quitter un projet n’est pas sans conséquence, même si le bouton l’est.**
`Accueil`, `DESIGN.md`, `Média`, `Réglages` et `Admin` démontent tous la vue
projet, et son nettoyage annule la génération en cours ainsi que toutes les
réparations en vol. Si Mocky est en train de fabriquer un écran, ce clic
l’annule.

### Le bandeau replié

Sous `md`, la rangée se réduit à trois contrôles : l’indicateur de
synchronisation, la bascule de thème, et <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M10.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M17.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0"/></svg> `Menu de navigation`, qui
ouvre un tiroir. Le tiroir rejoue les mêmes routes en lignes de 44 pixels,
ajoute `Docs` en lien, et suffixe la ligne de compte par `Se déconnecter` — le
seul libellé que l’en-tête large n’affiche pas, parce que là-bas le bouton de
compte *est* le bouton de déconnexion.

---

## La page des projets

### L’en-tête

| | Contrôle | Ce qu’il fait | Coût |
|---|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3"/></svg> | `Rechercher un projet…` | Filtre sur le nom du projet **et sur le nom et la demande de chacun de ses écrans**. Un projet dont vous ne vous rappelez pas le nom se retrouve par ce que vous aviez demandé dedans. Pas rendu du tout à cinq projets ou moins. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h4v16H4zM10 4h4v16h-4zM17.5 4.6l3.3 15.1"/></svg> | `Nouveau dossier` | Ouvre le dialogue de dossier. Caché tant qu’aucun projet n’a d’écran. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 6L20 5"/></svg> <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l14 14M19 5 5 19"/></svg> | `Sélectionner` / `Terminer` | Entre et sort du mode coche. En sortir vide la sélection. Caché s’il n’y a qu’un projet. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16M4 12h16"/></svg> | `Nouveau projet` | Crée le projet et l’ouvre aussitôt. | libre |

### La barre de sélection

Collante, et présente seulement en mode coche.

| | Contrôle | Ce qu’il fait | Coût |
|---|---|---|---|
| | `Tout cocher` / `Tout décocher` | **Coche ce qui est visible, pas ce qui existe.** Avec une recherche active, le lot est le résultat de la recherche — c’est ainsi qu’on supprime « tout ce qui s’appelle brouillon » sans cocher onze cases. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h4v16H4zM10 4h4v16h-4zM17.5 4.6l3.3 15.1"/></svg> | `Classer` | Ouvre le dialogue de classement pour les projets cochés. Désactivé si rien n’est coché. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg> | `Supprimer` | Confirmation à deux lignes : le nombre de projets, puis le nombre d’écrans qu’ils contiennent, quand ils en contiennent. Désactivé si rien n’est coché. | libre |

Les cases à cocher elles-mêmes sont dessinées, avec un vrai `<input>` dessous.
Ce n’est pas de la coquetterie : une case native peint la couleur d’accent du
système d’exploitation, la seule couleur de la page que le thème n’atteint pas.

### À la une, index, brouillons

| | Contrôle | Ce qu’il fait | Coût |
|---|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg> | `Ouvrir` | Ouvre le projet. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg> | `Supprimer le projet` | Une confirmation, qui nomme le projet. | libre |
| | Vignette de la une | Cliquable, mais délibérément **pas** un bouton : c’est un `div` marqué `aria-hidden`, parce qu’elle double le contrôle `Ouvrir` juste à côté. Un élément focusable et masqué aux technologies d’assistance est une faute, pas un raccourci. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l7 7 7-7"/></svg> <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg> | Plier une section | Replie un dossier, ou le groupe `Hors dossier`. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4ZM14 6l4 4"/></svg> | `Renommer le dossier` | Une invite du navigateur. Rendu seulement sur un vrai dossier — jamais sur `Hors dossier`, qui n’est pas un dossier mais l’absence de dossier. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h4v16H4zM10 4h4v16h-4zM17.5 4.6l3.3 15.1"/></svg> | `Classer « {name} »` | Classe ce projet-là seulement. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg> | `Tout vider` | Supprime tous les brouillons vides d’un coup, derrière une seule confirmation. | libre |

### Les deux dialogues de dossier

`Nouveau dossier` demande un nom (`Nom du dossier`, avec pour exemple
`Client, Essais, À revoir…`) et une liste de projets à y mettre.
**`Créer le dossier` reste désactivé tant que les deux ne sont pas remplis**,
parce qu’un dossier, dans Mocky, *est* ses projets : il n’existe aucune trace
d’un dossier vide à enregistrer.

`Classer` affiche les dossiers existants en puces, propose un champ pour en
créer un, et ajoute `Retirer du dossier` — mais seulement si au moins un des
projets choisis est actuellement classé, sans quoi le bouton ne déferait rien.

---

## La barre d’outils du projet

En haut à gauche du canevas, et l’endroit le plus dense du produit. Trois
défenses la maintiennent à l’écran : les libellés disparaissent sous `md`, tout
ce qui suit `Modifier` se replie dans `Plus`, et la rangée défile d’elle-même
plutôt que de pousser la page de côté.

### Les trois qui ne se replient jamais

| | Contrôle | Ce qu’il fait | Coût |
|---|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg> | `Retour` | Quitte le projet. Comme plus haut : cela annule la génération en cours. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg> | `Lier` | `Relier les écrans entre eux`. Cliquez un élément dans un écran, puis choisissez la destination. L’activer désactive `Modifier` et `Annoter` — et ferme `Système` ou `Audit`, car la liste des liens qu’il ouvre veut la même place qu’eux. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4ZM14 6l4 4"/></svg> | `Modifier` | `Cliquez un élément dans un écran, puis décrivez le changement — sans écrire de code`. Également exclusif des deux autres. | libre |

L’exclusivité est le fond du sujet : ces trois modes donnent trois sens
différents au même clic dans un écran, et deux à la fois n’en donneraient aucun.

### Les huit derrière « Plus »

Rendus en boutons à partir de `md`, en lignes de menu en dessous — depuis une
seule liste, pour que les deux ne puissent jamais diverger. <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M10.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M17.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0"/></svg> `Plus`
lui-même n’existe que sous `md`.

| | Contrôle | Ce qu’il fait | Coût |
|---|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1.5V4a1.5 1.5 0 0 1 3 0v7m0-1.5a1.5 1.5 0 0 1 3 0V13m-9 0a1.5 1.5 0 0 0-3 0v2a7 7 0 0 0 7 7h1a7 7 0 0 0 7-7v-4"/></svg> | `Interagir` | `Rendre tous les écrans interactifs (boutons cliquables, animations)`. Donne le pointeur à **tous** les aperçus d’un coup. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/></svg> | `Annoter` | `Découper une zone d’un écran et l’envoyer au chat comme référence numérotée`. Le rectangle que vous tracez devient une vignette jointe au composeur, et il part avec votre prochaine demande. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM10 18h4"/></svg> | `Cadre` | `Afficher ou masquer le cadre iPhone sur les écrans mobiles`. **Désactivé quand le projet n’a aucun écran mobile** — et la préférence n’est pas effacée pour autant, car elle vit dans une clé unique partagée par tous les projets. Désactiver le contrôle plutôt que remettre le réglage à zéro, c’est ce qui garde vos autres projets encadrés. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6"/></svg> | `Système` | `Système de design en direct — vos tokens DESIGN.md, et de quoi les recolorer`. Ferme `Audit`, ou le mode `Lier`, si l’un des deux était ouvert. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5l8-3Z"/></svg> | `Audit` | `Évaluer le SEO et l’accessibilité`. Ferme `Système`, ou le mode `Lier`, si l’un des deux était ouvert — les trois veulent la même place. **Ouvrir le panneau n’évalue rien.** | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h12v12H3zM15 10l6-4v12l-6-4z"/></svg> | `Motion` | `Monter une vidéo à partir des images de la médiathèque`. Ouvre le panneau Motion — voir plus bas. | libre à l’ouverture |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l14 8-14 8V4Z"/></svg> | `Démo` | `Lancer le prototype — suit les liens que vous avez posés`. Démarre sur l’écran sélectionné, ou sur le premier si rien ne l’est. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/></svg> | `Exporter` | `Exporter un projet Vite + React + Tailwind prêt à lancer`. Ouvre un menu de trois piles. | libre |

Le séparateur tombe avant `Démo`. Les deux derniers sont les deux façons de faire
**sortir** quelque chose d’un projet : une démo d’écrans qui existent déjà, une
archive de code qui existe déjà. `Motion` est de l’autre côté, avec les modes et
les panneaux, parce qu’il fait l’opération inverse — il fabrique ce qui n’existait
pas il y a une minute, à partir de la médiathèque, et il ouvre un panneau
exactement comme `Système` et `Audit`. À côté d’`Exporter`, il se lisait comme un
quatrième format de sortie, ce qu’il n’est justement pas.

Il reste **délibérément absent du menu contextuel d’un écran**. Le montage est
fait depuis la médiathèque ; il ne lit aucun écran et ne peut pas en être tiré.
L’accrocher à un écran promettrait une relation que le pipeline n’honore pas, et
la première chose que fait le panneau — demander quelles images utiliser — la
contredirait.

---

## Le canevas

### La barre de zoom

En bas à gauche du canevas à partir de `xl` ; en dessous, elle remonte en haut
et se glisse sous la barre d’outils. Question de géométrie, pas de goût : la
barre est calée sur la marge gauche et le composeur est un bloc de 672 px
centré, si bien que sept contrôles ne le dégagent qu’au-delà de 1200 px de
fenêtre environ. Plus étroit, le coin inférieur gauche passe derrière le
composeur, qui est opaque — et c’est ainsi que le seul contrôle de zoom du
produit était devenu invisible sur un portable.

| | Contrôle | Ce qu’il fait | Coût |
|---|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3M8 11h6"/></svg> | `Dézoomer` | Recule autour du centre de la fenêtre. | libre |
| | `100%` | L’échelle courante. Ce n’est pas un contrôle. | — |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3M11 8v6M8 11h6"/></svg> | `Zoomer` | Avance autour du centre de la fenêtre. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg> | `Tout afficher` | Cadre tous les écrans, et **continue** de le faire à mesure qu’il s’en ajoute, jusqu’à ce que vous bougiez la vue vous-même. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM12 2v3M12 19v3M2 12h3M19 12h3M13.4 12a1.4 1.4 0 1 0-2.8 0a1.4 1.4 0 1 0 2.8 0"/></svg> | `Zoomer sur le dernier écran` | Cadre l’écran le plus récent. Désactivé quand il n’y en a pas. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg> | `Réorganiser` | Range le plateau en respectant la taille réelle de chaque écran — un écran mobile n’obtient pas une case de bureau — puis cadre le résultat. | libre |

### Ce que fait la souris

L’indication en haut à droite le dit, et change avec le mode. Écrit une fois
pour toutes :

- **Glisser sur le vide** — sélection au lasso. Avec un modificateur, elle
  s’ajoute à la précédente.
- **Espace, ou glisser au clic-molette** — déplacer la vue.
- **Molette** — déplace la vue. **Ctrl ou ⌘ + molette** — zoome. Un pincement de
  trackpad arrive sous la seconde forme, et c’est pour cela qu’il zoome.
- **Double-clic sur un écran** — cet écran-là devient interactif, et le dit avec
  une pastille `Interactif — clic dehors pour sortir`. Ce n’est pas la même
  chose que le bouton `Interagir` de la barre d’outils, qui le fait pour tous.
- **Clic droit sur un écran** — le menu contextuel.

---

## Le cadre d’un écran sélectionné

Sélectionnez exactement un écran et une petite barre apparaît au-dessus.
Sélectionnez-en deux et elle disparaît — chacune de ses actions ne concerne
qu’un écran.

| | Contrôle | Ce qu’il fait | Coût |
|---|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4ZM14 6l4 4"/></svg> | `Renommer` | Édite le nom sur place. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z"/></svg> | `Voir la demande qui a créé cet écran` | Ouvre la demande d’origine, avec un bouton de copie. Sur un écran importé ou fabriqué avant que ce soit enregistré, le libellé devient `Aucune demande enregistrée`. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l14 8-14 8V4Z"/></svg> | Animations, cet écran | Fait tourner trois états, pas deux : suit le composeur / forcées / coupées. Un interrupteur à deux positions laisserait un écran coincé sur une exception qu’on ne pourrait plus lever. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M10.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M17.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0"/></svg> | `Plus d’options (ou clic droit sur l’écran)` | Le même menu contextuel que le clic droit. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg> | `Supprimer l’écran` | Une confirmation. | libre |

Tirez l’une des huit poignées pour redimensionner ; la taille en pixels
s’affiche sous le cadre tant qu’il est sélectionné.

### Les pastilles

Elles se posent à côté du nom, et deux d’entre elles restent visibles même quand
l’écran n’est pas sélectionné — un écran qui se comporte autrement que les
autres doit le dire sans qu’on ait à le cliquer.

| | Pastille | Ce qu’elle veut dire |
|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z"/></svg> | (épingle, avant le nom) | `Écran de référence pour la mise en page des nouveaux écrans`. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l14 8-14 8V4Z"/></svg> | `Figé` | Cet écran ne s’anime jamais, quoi que dise le composeur. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1.5V4a1.5 1.5 0 0 1 3 0v7m0-1.5a1.5 1.5 0 0 1 3 0V13m-9 0a1.5 1.5 0 0 0-3 0v2a7 7 0 0 0 7 7h1a7 7 0 0 0 7-7v-4"/></svg> | `Interactif — clic dehors pour sortir` | C’est celui-ci que vous avez double-cliqué. |

### Les cartes à côté du cadre

Quand un écran a été fabriqué avec une image Muse, cette image se range dans la
grille à droite du cadre — hors de ses limites, pour ne jamais recouvrir le
design. En dessous d’un certain zoom elle n’est pas dessinée du tout, au motif
qu’une carte illisible qui balaie ses voisines vaut moins que pas de carte.

La pastille sous l’image nomme son **rôle**, c’est-à-dire la chose qu’on ne peut
pas deviner en la regardant :

- `Insérée` — l’image est dans l’écran, comme une vraie `<img>`.
- `Inspiration` — l’image n’est **pas** dans l’écran. Elle a été montrée au
  modèle comme référence de direction artistique : palette, lumière,
  composition.
- `Insérée + réf.` — les deux.
- `Image Muse` — le rôle n’a jamais été noté. Ce n’est pas un quatrième rôle :
  c’est ce qu’affiche un écran généré avant que la distinction existe, plutôt
  que de deviner.

En dessous, le média **attaché** à l’écran, quand il y en a un — un montage
exporté, ou une séquence de défilement. Attaché, et non *utilisé* : rien de tout
cela n’est dans le code de l’écran, et c’est exactement la distinction que
`Changer les médias…` tient en deux sections. L’image fixe est dessinée par le
navigateur à partir du fichier lui-même, parce qu’aucune affiche n’est découpée
pour un montage — cela demanderait ffmpeg, la seule dépendance que Motion n’a
délibérément pas. Un clic lit le montage ; une séquence s’ouvre dans `Média`, où
vit déjà le lecteur image par image.

Un média que la médiathèque a perdu garde sa carte, et la carte **le dit** :
`Média introuvable`, et l’infobulle précise qu’il reste attaché tant qu’on ne le
détache pas. Cet état s’obtient par l’échec de chargement du fichier — une
suppression, ou un hash qui appartient à un autre compte — et il existe parce
que l’alternative était un rectangle noir sous la légende habituelle, ce que
dessine aussi un montage qui commence sur une image noire.

En dessous, le système de design dont cet écran est réellement issu. La carte
porte l’un des deux boutons, **jamais les deux** — et c’est bien pour cela
qu’on les confond : on ne voit jamais que celui qui s’applique, et l’autre est
ce que le même coin de l’écran affiche sur un autre écran.

| | Contrôle | Ce qu’il fait | Coût |
|---|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 6L20 5"/></svg> | `Reprendre ce design` | Affiché quand un design **a** été enregistré. Remet la copie enregistrée comme direction courante du projet, à l’octet près. Aucune relecture, aucun appel au modèle. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/></svg> | `En déduire un DESIGN.md` | Affiché quand rien n’a été enregistré, et seulement si l’écran a du code à lire. Demande à un modèle de lire l’écran et d’écrire le système de design qu’il suppose. | modèle |

Quand quelque chose a été enregistré, le petit rendu au-dessus des pastilles est
lui-même un bouton : il ouvre le document en grand, où le même
`Reprendre ce design` voisine avec `Enregistrer sous…`. Au zoom du canevas cette
carte est un timbre-poste, et un système de design se juge sur ses mots plutôt
que sur huit carrés de couleur.

---

## Le menu contextuel d’un écran

Clic droit sur un écran, ou <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M10.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M17.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0"/></svg> dans sa barre de nom.

| | Entrée | Ce qu’elle fait | Coût |
|---|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/></svg> | `Régénérer (nouvelle variante)` | Relance la demande d’origine de l’écran pour obtenir un autre résultat. Le code précédent est conservé, donc `Revenir à la version précédente` le défait. | modèle |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg> | `Peaufiner (détecter et corriger)` | La passe qualité : vérifier, corriger, revérifier. Voir [Passe de qualité](fr/quality.md). | modèle |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4ZM14 6l4 4"/></svg> | `Renommer` | Une invite du navigateur. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 9h11v11H9zM5 15H4V4h11v1"/></svg> | `Dupliquer` | Copie l’écran, nommé `{name} (copie)`, posé par la même règle que n’importe quel nouvel écran plutôt que sur l’original. **Les liens ne sont pas copiés** — un doublon arrive inerte, parce qu’une zone cliquable qui pointe là où pointait l’original est un parcours que personne n’a dessiné. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg> | `Partager (QR code)` | Crée un lien public temporaire vers cet écran seul, avec une durée que vous choisissez. C’est un instantané : le modifier ensuite ne changera pas ce que voit la personne. | serveur |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l-6-6 6-6M15 6l6 6-6 6"/></svg> | `Voir le code` | La source générée, en lecture seule. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z"/></svg> | `Épingler comme référence de mise en page` / `Ne plus utiliser comme référence` | Fait de cet écran la mise en page que les **prochaines** générations imitent. Il ne change pas cet écran-ci. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/></svg> | `Télécharger le .tsx` | Écrit le composant dans un fichier. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5"/></svg> | `Revenir à la version précédente` | Présent seulement s’il y a une version précédente. Toute réécriture du code en enregistre une — édition, réparation automatique, peaufinage, régénération, ajout d’animations, correction d’audit, et les deux gratuites : le remplacement d’image et la modification de texte immédiate. **Un seul niveau, et il s’efface** : revenir en arrière jette la version stockée, l’entrée disparaît et il n’y a pas de « rétablir ». | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/></svg> | `Faire de cet écran mon DESIGN.md` | Lit l’écran et en écrit la direction du projet. Demande confirmation quand une direction existe déjà. | modèle |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6"/></svg> | `Modifier DESIGN.md` | L’éditeur pleine page. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h4v16H4zM10 4h4v16h-4zM17.5 4.6l3.3 15.1"/></svg> | `Changer les médias…` | Liste les images réellement présentes dans le code et les remplace, à un endroit ou partout. Sources : la bibliothèque, un import, ou une génération. | libre / image |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg> | `Supprimer l’écran` | Une confirmation. | libre |

### Les trois groupes de petits boutons

En bas du menu, trois rangées qui se ressemblent et n’ont rien à voir.

**`Format d’affichage` — `Mobile` · `Tablette` · `Bureau` · `Complet`.**
Redimensionne le cadre et indique aux passes suivantes de quel appareil il
s’agit. `Complet` signifie hauteur complète, ajustée au contenu. Libre : aucun
code n’est réécrit.

**`Ajouter des animations` — `Subtiles` · `Modérées` · `Riches`.** Réécrit le
code pour y mettre du mouvement, en conservant contenu et mise en page. Coûte du
**modèle**, et se défait.

**`Lire les animations` — `Auto` · `Oui` · `Non`.** Décide si le mouvement déjà
présent dans le code s’exécute. Libre. Trois choix visibles plutôt qu’un libellé
qui tourne, parce que dans un menu, une entrée dont le texte change ne montre
jamais quels sont les autres états.

Celui du milieu consomme des jetons. Les deux qui l’encadrent, non.

---

## Le composeur

La barre flottante en bas. C’est le seul contrôle du produit qui change de verbe
selon ce qui est sélectionné.

### Les puces au-dessus du champ

| | Puce | Ce qu’elle fait | Coût |
|---|---|---|---|
| | `Nouvelle direction` | Ce prompt-ci écrira la direction artistique du projet, que tous les écrans suivants suivront. **La case se décoche toute seule après la génération.** Cachée pendant une édition — une édition retravaille ce qu’une direction a produit, et la laisser réécrire cette direction reviendrait à réattribuer tous les autres écrans du projet. | libre (arme la génération suivante) |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg> | `Muse` | Inspiration, direction artistique et vraie copie. L’activer change ce que coûte une génération — voir [Muse](fr/muse/overview.md). | libre (arme la génération suivante) |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l14 8-14 8V4Z"/></svg> | `✦ Animations auto` / `✦ Animations forcées` / `✦ Sans animation` | Trois états. `✦ Sans animation` immobilise aussi les écrans déjà posés sur le canevas, pour que le bouton et le plateau ne se contredisent pas. | libre |
| | `Format` | Le gabarit du prochain écran. Affiché seulement en création, pas en édition. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l7 7 7-7"/></svg> | Le brief | Plie et déplie le dossier Muse. Affiché seulement quand Muse est actif et que vous créez. `Afficher le détail du brief` / `Replier le brief`. | libre |

Au-dessus se posent les rangées passagères : les vignettes d’annotation
numérotées, chacune avec un bouton de retrait visible au repos plutôt qu’au
survol — le survol n’existe pas sur un téléphone, et un contrôle qui n’apparaît
qu’au survol n’y est pas difficile à trouver, il est inatteignable. Et, quand
des écrans sont sélectionnés, une puce par écran avec `Retirer de la sélection`,
plus `tout désélectionner`.

### Le champ et ses deux boutons

| Contrôle | Ce qu’il fait | Coût |
|---|---|---|
| Le champ de saisie | `Décrivez un écran à ajouter à ce projet…` quand rien n’est sélectionné ; `Décrivez le changement à appliquer à l’écran sélectionné…` quand quelque chose l’est. **Ctrl/⌘ + Entrée** envoie. | — |
| `Générer` | Crée un nouvel écran. | modèle |
| `Mettre à jour ({count})` | Le même bouton, quand des écrans sont sélectionnés : il modifie ces écrans au lieu d’en créer un. | modèle |
| `Arrêter` | Apparaît pendant le travail. Interrompt la requête. | libre |

Ce bouton qui fait deux métiers est la surprise la plus fréquente de Mocky : si
un écran est sélectionné, vous êtes en train de le modifier, et aucun nouvel
écran n’arrivera. `tout désélectionner`, à côté des puces, est la sortie.

---

## Les panneaux latéraux

Les trois s’ouvrent au même endroit, à droite, sous la barre d’outils.

### Liens

S’ouvre avec `Lier`. Liste tous les liens du projet, avec leur nombre.

| | Contrôle | Ce qu’il fait | Coût |
|---|---|---|---|
| | `Terminé` | `Quitter le mode Lier`. | libre |
| | `Depuis quel écran` | L’écran à lire. Il se choisit **ici** et pas sur le canevas, parce que le mode Lier fait qu’un clic dans un cadre désigne un élément et non le cadre. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/></svg> | `Proposer des liens` | Lit l’écran rendu et propose des liens. **Malgré la baguette, aucun modèle n’intervient** : il rapproche le `href` que le modèle a écrit, et les libellés qui reprennent les mots d’un autre écran. Le dialogue de proposition indique laquelle des deux raisons s’applique à chaque ligne, et rien n’est écrit tant que vous n’avez pas validé. | libre |
| | Une ligne de lien | Cliquez pour centrer le canevas dessus. | libre |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l14 14M19 5 5 19"/></svg> | `Supprimer le lien` | Retire ce lien-là. | libre |

### Système

S’ouvre avec `Système`. Les tokens de couleur de votre DESIGN.md, en palette et
en échantillon rendu.

| Contrôle | Ce qu’il fait | Coût |
|---|---|---|
| Une pastille de couleur | Sélectionne le token. Le panneau propose alors un champ hexadécimal et `Appliquer`. | libre |
| `Appliquer` | **Réécrit ce token dans le DESIGN.md.** Toutes les générations suivantes suivent le changement ; rien de ce qui est déjà sur le canevas ne bouge. | libre |
| `Modifier` | `Ouvrir l’éditeur complet du DESIGN.md`. | libre |

### Audit

S’ouvre avec `Audit`. Un écran à la fois, choisi parmi des vignettes — des
vignettes déjà capturées, jamais prises ici, parce qu’une capture demande une
iframe de même origine et qu’exécuter du code écrit par un modèle sur l’origine
de Mocky n’est pas une chose qu’un panneau doit faire en s’ouvrant.

| Contrôle | Ce qu’il fait | Coût |
|---|---|---|
| Une vignette | Choisit l’écran, et le cadre sur le canevas pour que le rapport parle de quelque chose que vous voyez. | libre |
| `Évaluer` / `Réévaluer` | Applique les règles déterministes à un AST, dans le navigateur. Fonctionne backend éteint. | libre |
| `Analyse approfondie` (case) | Ajoute les questions qu’une règle ne peut pas trancher — le `alt` décrit-il l’image, le titre décrit-il sa section. Décochée par défaut. | modèle, au moment de l’évaluation |
| `Corriger` | Corrige un point. | modèle |
| `Tout corriger` | Corrige tous les points corrigeables. | modèle |

Deux choses que le panneau dit à voix haute plutôt qu’en infobulle.
**`Analyse du code seul`** : la note porte sur le balisage et sur ce que les
classes déclarent, donc un 100 ne veut pas dire « conforme ». Et une ligne de
famille peut afficher `sans objet` ou `non mesuré` au lieu d’un chiffre — un
écran sans formulaire et un écran dont les formulaires sont parfaits produisent
la même liste vide, et un seul des deux a mérité une note.

Les points marqués `Indicatif — non corrigé automatiquement` n’ont pas de bouton
`Corriger`, et c’est voulu : ce sont des appréciations sur lesquelles la passe de
correction n’a pas le droit de dépenser une itération.

Le dernier bloc, `Document exporté`, ne parle pas du tout de l’écran choisi. Il
est calculé une fois pour le projet et répété sous chaque écran, parce qu’un
écran Mocky est un composant : il n’a ni titre, ni langue, ni description, et ces
trois-là n’existent que dans le HTML produit par l’export. Rien n’y porte non
plus de bouton `Corriger` — le défaut, quand il y en a un, est dans le nom du
projet ou dans son nom de produit, pas dans le balisage d’un écran.

---

## Le panneau Motion

S’ouvre avec `Motion`. Un diaporama monté à partir de la médiathèque : une image
par scène, avec sa durée, son mouvement et sa transition. **Le rendu tourne sur
le worker Remotion, pas dans ce navigateur** — et ce worker est un service Docker
séparé et facultatif, donc la première chose que fait le panneau est de dire s’il
est là. Pourquoi c’est bâti ainsi est dans [Motion](fr/video-export.md).

La fonctionnalité s’appelait « Export vidéo » et les fichiers s’appellent encore
ainsi. C’est délibéré, et expliqué sur la page ci-dessus : ce que lit un
utilisateur dit Motion, ce que cherche un développeur dit `video`.

Un compte pour lequel la fonctionnalité n’est pas activée reçoit une phrase
laconique et rien d’autre : il n’apprend rien de la configuration de l’instance,
ni de ce à quoi ressemble un montage valide.

Il y a **un seul formulaire**, et deux façons de le remplir — derrière un
interrupteur, une seule visible à la fois. Empilées, elles remplissaient à elles
deux une fenêtre de 900 pixels : les scènes, le total et le bouton de rendu
commençaient tous sous la ligne de flottaison d’un panneau que personne n’avait
encore touché. Ce sont des alternatives, pas des étapes, et deux formulaires
ouverts disaient le contraire. La position choisie survit tant que le panneau est
ouvert et n’est pas retenue ensuite : c’est un fait sur le montage du moment.

| Contrôle | Ce qu’il fait | Coût |
|---|---|---|
| `Décrivez la vidéo` → `Proposer un montage` | Envoie votre phrase et les images déjà choisies au modèle. Il **ordonne et règle** — durées, mouvements, transitions, textes. Il ne choisit pas les images et n’en ajoute aucune. | modèle |
| `Partir d’une image` → `Générer une image modèle` | Fabrique une image à partir d’un sujet que vous décrivez. Rien ne continue tant que vous n’avez pas choisi `Garder`, `Régénérer` ou `Abandonner`. | image |
| `Ou partir d’une image de la médiathèque` | Le même sélecteur que la liste des scènes. Une image de la médiathèque existe déjà et vous venez de la regarder pour la choisir : elle passe directement aux variantes, sans première confirmation. | libre |
| `Produire {n} variantes` | De deux à six prises de cette image, affichée en petit au-dessus du bouton pour qu’on voie de quoi elles dériveront. Vous cochez ensuite celles qui méritent d’être montées ; ce qui reste décoché reste en attente, définitivement. | image, un appel par variante |
| Une ligne de scène | Durée, mouvement, transition vers la suivante, et une ligne facultative de texte incrusté. Monter, descendre, retirer. | libre |
| `Sortie` | Format d’image (`16:9`, `9:16`, `1:1`) et conteneur (`mp4`, `webm`). | libre |
| `Lancer le rendu` | Met le job en file. Un seul rendu à la fois sur l’instance ; vous pouvez fermer le panneau et le retrouver en le rouvrant. | serveur (des minutes de processeur) |
| `Télécharger la vidéo` | Le fichier terminé. | libre |

**Une proposition est un pré-remplissage, pas un mode.** Ce qui revient est écrit
dans les mêmes contrôles, tous encore actifs, et remplacer un montage que vous
avez réglé à la main demande confirmation. Un aperçu en lecture seule devrait
être pris en entier ou jeté en entier, alors que la première chose que l’on veut
faire d’un ordre de passage proposé, c’est déplacer deux scènes. L’interrupteur
dit quelle assistance est à l’écran ; aucune des deux n’est un état du montage,
et changer de position ne perd rien — une phrase tapée, une image non confirmée
et un appel encore en vol y survivent tous.

Trois choses que le panneau énonce au lieu de les sous-entendre, parce que
chacune est un fait sur votre instance qui change ce que vous obtenez :

- **Si les variantes dériveront vraiment de votre image.** Avec un profil d’image
  « Édition » configuré, elles sortent d’un modèle image-vers-image nourri de
  votre propre image ; sans lui, elles naissent du même texte — même sujet, autre
  photographie. La phrase apparaît deux fois : avant le clic, d’après ce que le
  serveur promet, et après coup, d’après ce que la réponse a réellement fait.
- **`{used} s sur {max} s`.** Deux minutes au total, vingt scènes, et le bouton
  nomme la raison pour laquelle il ne partira pas plutôt que de rester grisé.
- **`Dernière scène : cette transition ne joue pas.`** Le champ existe sur toutes
  les scènes parce que le schéma est uniforme. Masquer le contrôle donnerait à
  une ligne une forme différente des autres, sans raison visible, dès qu’on
  réordonne.

Quand un rendu échoue, la bannière est un titre et une marche à suivre, jamais
« l’export a échoué ». Quatre situations arrivent sous la même forme d’erreur et
envoient chercher à quatre endroits différents : le volume est plein (ne
raccourcissez rien — voyez l’administrateur), le worker est injoignable (un
réglage d’instance, pas votre montage), les images ont quitté la médiathèque
(remplacez ces scènes), le rendu ne répond plus (rouvrez le panneau ; il a
peut-être abouti quand même). Une cinquième n’est pas un échec du tout : `Des
images attendent votre confirmation` veut dire que le serveur a refusé une image
que personne n’a regardée, ce qui est toute la raison pour laquelle ce garde vit
sur le serveur et non dans ce panneau.

**Où va le fichier terminé**, et le panneau le dit au lieu de laisser un lien de
téléchargement qui disparaît avec lui : dans `Média`, onglet **`Motion`** —
rattaché au projet où vous l’avez monté, ou à aucun projet quand vous l’avez
monté depuis la page Média autonome. Cet onglet porte le nom de la
fonctionnalité, pas celui de l’objet, parce que c’est là que le panneau vous
envoie et que les deux doivent se lire pareil. L’objet, lui, est un **montage**,
le mot que ce panneau emploie déjà dans `Proposer un montage` et `Nouveau
montage` ; une séquence de défilement, dans l’onglet `Vidéos`, est une
*séquence*, et appeler les deux « vidéo » est ce qui rendait un export
introuvable au départ.

---

## Les modales

Tout ce qui s’ouvre par-dessus le canevas. La première est un menu déroulant et
non un dialogue ; elle figure ici parce que c’est là que le choix d’export se
fait réellement.

| Modale | Ouverte par | Ce qu’il faut savoir | Coût |
|---|---|---|---|
| `Projet exécutable (.zip)` | `Exporter` | Trois piles : `Prêt pour shadcn`, `Tailwind seul`, `daisyUI`. L’archive est fabriquée dans le navigateur, et le HTML exporté porte la langue de l’interface — c’est ce qui rend une page française exportée lisible à voix haute. | libre |
| `Lien` → `vers quel écran ?` | Un clic sur un élément en mode Lier | Choisit la destination. `Annuler` ne laisse rien derrière. | libre |
| `Élément` | Un clic sur un élément en mode Modifier | Voir ci-dessous — elle réunit trois coûts dans une seule carte. | mixte |
| `Code` | `Voir le code` | Lecture seule. | libre |
| `Partager cet écran` | `Partager (QR code)` | Une durée de `1 heure`, `24 heures` ou `7 jours`, un QR code, et `Révoquer`. | serveur |
| `Médias de « {name} »` | `Changer les médias…` | **Deux sections, jamais une liste.** `Images dans le code de l’écran` : par image, `Remplacer`, ou `Partout ({n})` quand le même fichier apparaît plusieurs fois, ou un emplacement à la fois — cela **réécrit la source**, et `Revenir à la version précédente` l’annule. `Média attaché à l’écran (hors du code)` : un montage ou une séquence à poser sur la carte du canevas, et `Détacher` — cela **ne touche pas au code**. `Importer un fichier` est libre ; `Générer` appelle le fournisseur d’images. | libre / image |

La carte `Élément`, ouverte en cliquant quelque chose en mode `Modifier`, est le
seul endroit où trois coûts cohabitent dans un même dialogue :

- **`Texte` → `Mettre à jour`** — libre *quand le texte saisi correspond à une
  occurrence unique et littérale* dans la source : c’est alors une substitution
  de chaîne, immédiate. Quand c’est ambigu, l’action bascule sans le dire vers
  une édition par le modèle.
- **Les pastilles de `Recolorer`** — chacune est une édition de cet élément par
  le modèle. Elles se déclenchent d’un seul geste, et c’est justement pour cela
  qu’il faut le signaler : une pastille qui coûte des jetons ressemble
  exactement à une pastille qui n’en coûte pas, et le panneau d’à côté en a
  précisément qui n’en coûtent pas.
- **`Ou décrivez le changement` → `Appliquer`** — une édition ciblée par le
  modèle. **Ctrl/⌘ + Entrée** envoie.

La note en bas de cette carte dit la même chose en une ligne : les changements de
texte s’appliquent aussitôt quand ils sont uniques, les autres passent par le
modèle, tout est réversible depuis le menu de l’écran.

---

## Les contrôles qu’on confond

### Ceci, pas cela

| Ceci | Pas ceci | La différence |
|---|---|---|
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1.5V4a1.5 1.5 0 0 1 3 0v7m0-1.5a1.5 1.5 0 0 1 3 0V13m-9 0a1.5 1.5 0 0 0-3 0v2a7 7 0 0 0 7 7h1a7 7 0 0 0 7-7v-4"/></svg> `Interagir` (barre d’outils) | Double-cliquer un écran | Le bouton de la barre rend **tous** les aperçus cliquables d’un coup. Le double-clic n’en rend qu’un, et celui-là porte la pastille `Interactif — clic dehors pour sortir`. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l14 8-14 8V4Z"/></svg> `Ajouter des animations` (menu contextuel) | `Lire les animations` (menu contextuel) | Le premier **réécrit le code** pour y ajouter du mouvement : appel au modèle, réversible. Le second décide seulement si le mouvement déjà présent s’exécute. Ils sont à deux rangées d’écart dans le même menu. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l14 8-14 8V4Z"/></svg> L’interrupteur d’animation du composeur | <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l14 8-14 8V4Z"/></svg> Le bouton d’animation d’un écran | L’interrupteur du composeur est le réglage par défaut des écrans **générés à partir de maintenant**, et il immobilise aussi le plateau quand il est sur `✦ Sans animation`. Le bouton du cadre fait exception pour cet écran-là, en trois états, dont « revenir à ce que dit le composeur ». |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 6L20 5"/></svg> `Reprendre ce design` (à côté d’un cadre) | <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/></svg> `Faire de cet écran mon DESIGN.md` (menu contextuel) | Le premier restaure un document **enregistré**, à l’identique, gratuitement. Le second demande à un modèle de **lire l’écran et d’en écrire un nouveau**. Même intention, mécanique inverse, et un seul des deux coûte quelque chose. |
| `Appliquer` dans le panneau Système | Une pastille de `Recolorer` dans la carte Élément | Le panneau Système réécrit un token du DESIGN.md : libre, et cela ne change que les générations **futures**. La pastille de la carte Élément est une édition de **cet** élément par le modèle, tout de suite, et elle ne touche pas au DESIGN.md. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z"/></svg> `Épingler comme référence de mise en page` | `Reprendre ce design` | L’épingle gouverne la **mise en page** des prochains écrans. La carte de design gouverne la **direction artistique**. Un écran peut être l’un, l’autre, les deux ou aucun. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6"/></svg> `Système` | <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6"/></svg> `Modifier DESIGN.md` | Même icône, deux profondeurs : le panneau montre les tokens et les recolore ; la page est le document lui-même. `Modifier`, dans le panneau, est le pont entre les deux. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/></svg> `Régénérer (nouvelle variante)` | <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg> `Peaufiner (détecter et corriger)` | Le premier jette l’écran et redemande à partir de la même demande : un autre design. Le second garde le design et corrige des défauts nommés dedans. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5l8-3Z"/></svg> Les points de l’`Audit` | <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg> Les points de `Peaufiner (détecter et corriger)` | Deux catalogues, deux notes, deux prompts de correction. L’un porte sur le balisage, l’autre sur le goût. Aucune des deux notes ne s’écrit dans le champ de l’autre. |
| `Générer` | `Mettre à jour ({count})` | Le même bouton. Si un écran est sélectionné, vous modifiez, vous ne créez pas. |
| `Tout cocher` | « sélectionner tous les projets » | Il coche les projets **visibles**. Sous une recherche, c’est le résultat de la recherche. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/></svg> `Proposer des liens` | Tout ce qui ressemble à de l’IA | C’est déterministe. Il lit ce qui est déjà dans l’écran rendu ; il ne demande pas à un modèle d’imaginer un parcours. |
| <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg> Le bouton de thème | Le thème courant | L’icône dit où vous allez, pas où vous êtes. |

### Les trois boucles de correction

Mocky peut réécrire un écran pour trois raisons différentes, et les trois ne
sont pas interchangeables. Les fusionner est la refonte tentante, et elle les
casse toutes les trois.

| | Réparation | `Peaufiner (détecter et corriger)` | `Corriger` / `Tout corriger` |
|---|---|---|---|
| **Où** | Nulle part — aucun bouton | Menu contextuel d’un écran | Le panneau `Audit` |
| **Déclencheur** | L’iframe d’aperçu signale une erreur d’affichage ou de compilation | Vous le demandez | Vous le demandez |
| **Ce qu’on lui dit** | Corrige *seulement* l’erreur, ne restyle rien | Corrige ces points nommés, ne change rien d’autre | Corrige le balisage ; l’écran doit être identique ensuite |
| **Budget** | 2 tentatives | 2 itérations | 2 itérations |
| **Coût** | modèle, automatique | modèle | modèle |

Relisez la ligne du milieu : chaque consigne est mortelle pour les deux autres.

- Un point de qualité **est** un problème de style. Donnez-le à un modèle à qui
  l’on interdit de restyler et il rend l’écran inchangé, en ayant obéi.
- Une correction d’accessibilité qui restyle a **échoué même quand tous les
  points ont disparu**, parce qu’une correction de sémantique est revenue en
  refonte.
- Et une réparation qui se croirait libre de restyler répondrait à une erreur de
  compilation par un nouveau design, ce que personne ne demande en regardant un
  écran cassé.

Ce qu’elles partagent, c’est le transport, la boucle et ses quatre conditions
d’arrêt, et les conventions d’écriture — un contrôleur d’annulation, un
instantané du code revérifié avant d’écrire, et une version précédente pour que
`Revenir à la version précédente` fonctionne. C’est `runPolishLoop`, et il est
générique sur son type de rapport précisément pour cela : les règles d’arrêt
méritent d’être écrites une fois, et les vérifications qui les alimentent ne sont
pas la même vérification.

---

## Tout ce qui consomme des jetons

Rien dans Mocky n’appelle un modèle de sa propre initiative. Chaque entrée
ci-dessous est un clic, et la liste est complète.

| Contrôle | Où | Remarque |
|---|---|---|
| `Générer` | Composeur | Avec `Muse` actif, le même clic lance aussi la passe d’inspiration et peut appeler le fournisseur d’images. |
| `Mettre à jour ({count})` | Composeur | Un appel par écran sélectionné. |
| Réparation | Automatique, après un affichage raté | Le seul appel au modèle non sollicité — et il n’arrive qu’après qu’une génération que vous avez demandée a produit du code qui ne tourne pas. Plafonné à deux tentatives. |
| `Régénérer (nouvelle variante)` | Menu contextuel d’un écran | |
| `Peaufiner (détecter et corriger)` | Menu contextuel d’un écran | La vérification elle-même appelle un modèle pour les règles qu’une expression régulière ne tranche pas, puis jusqu’à deux corrections. |
| `Ajouter des animations` — `Subtiles` / `Modérées` / `Riches` | Menu contextuel d’un écran | |
| `Faire de cet écran mon DESIGN.md` | Menu contextuel d’un écran | |
| `En déduire un DESIGN.md` | Carte de design à côté d’un cadre | |
| `Texte` → `Mettre à jour` | Carte Élément | **Seulement** quand le texte ne correspond pas à une occurrence unique et littérale. Sinon, libre et immédiat. |
| Pastilles de `Recolorer`, hexadécimal → `OK` | Carte Élément | Chaque pastille est une édition par le modèle. |
| `Appliquer` | Carte Élément | |
| `Analyse approfondie` | Panneau Audit | Change ce que coûte `Évaluer`. Décochée par défaut. |
| `Corriger` / `Tout corriger` | Panneau Audit | |
| `Générer` (une image) | `Changer les médias…`, bibliothèque d’images | Appelle le fournisseur d’images, pas le modèle de texte. |
| `Proposer un montage` | Panneau Motion | Le seul appel au modèle de Motion. Il ordonne et règle les images que vous avez choisies ; il n’en choisit jamais une. |
| `Générer une image modèle`, `Produire {n} variantes` | Panneau Motion | Le fournisseur d’images, une fois par image. Six variantes, six appels. |
| `Lancer le rendu` | Panneau Motion | Ni modèle ni fournisseur — mais des minutes de processeur sur le worker de rendu, ce qui en fait le clic le plus cher du produit sur une petite machine. |

Et les absences notables — ce qui a l’air cher et ne l’est pas : `Évaluer` dans
le panneau Audit avec `Analyse approfondie` décochée, `Proposer des liens`,
`Reprendre ce design`, `Exporter`,
`Télécharger le .tsx`, `Dupliquer`, `Réorganiser`, tout le panneau `Système`,
l’ouverture du panneau `Motion`, et chacune des bascules de format, de cadre et de
lecture du produit.
