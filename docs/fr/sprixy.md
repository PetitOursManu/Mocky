---
description: Vos sprites, icônes et tuiles en pixel art venus de Sprixy, utilisés dans vos designs, en lecture seule et projet par projet.
badge: Nouveau
source_hash: 8fabb22a8739
---

# Vos assets de jeu Sprixy

[Sprixy](https://github.com/PetitOursManu/Sprixy) est un studio auto-hébergé d'assets 2D pour le jeu vidéo : sprites
en pixel art, personnages, icônes, tuiles et éléments d'interface. Reliez **votre** Sprixy à votre compte Mocky, et les
assets des projets que vous y choisissez de partager peuvent entrer dans vos designs — la page d'un jeu, une fiche de
boutique, une affiche de game jam.

:::why Pourquoi un jeton en lecture seule, et pourquoi le choix se fait dans Sprixy
Un jeton Sprixy à accès complet peut générer et dépenser votre crédit chez les fournisseurs. Mocky n'a besoin que de
regarder et de copier : il accepte un **jeton de catalogue en lecture seule** et refuse tout autre. Et ce qui peut
servir se décide là où vivent les assets : rien n'est visible tant que vous n'avez pas marqué un projet « Shared with
apps » dans Sprixy, et le retirer prend effet aussitôt.
:::

## Relier votre Sprixy

:::steps
1. **Dans Sprixy, partagez un projet.** Ouvrez le projet et cliquez sur **Share with apps** en haut. Faites-le pour
   chaque projet dont Mocky peut utiliser les assets.
2. **Dans Sprixy, créez un jeton de catalogue.** **Settings → API tokens**, choisissez **Read-only catalog**,
   nommez-le « Mocky » et copiez le jeton `spx_…` (il ne s'affiche qu'une fois).
3. **Dans Mocky, reliez.** **Réglages → Sprixy** : collez l'adresse de votre Sprixy et le jeton, puis
   **Relier Sprixy**. Mocky le vérifie auprès de Sprixy et liste les projets partagés.
:::

Le jeton est gardé sur le serveur pour votre compte seulement et n'est plus jamais affiché. **Délier** l'oublie ;
révoquer le jeton dans Sprixy coupe l'accès de ce côté-là.

## Utiliser les assets dans un design

Demandez un design à votre assistant (Claude, ChatGPT…, [connecté par MCP](mcp.md)) en mentionnant vos assets Sprixy —
« une page d'accueil pour mon jeu, avec mes sprites de gobelin et de chevalier ». Il les cherche avec
`search_sprixy_assets`, regarde les vignettes et ajoute celles qu'il choisit avec `add_image` (`sprixy_asset_id`).
Elles arrivent dans votre bibliothèque Média, créditées « Sprixy », et le design les utilise.

Les sprites sont du pixel art, et Mocky les traite comme tels :

- Sprixy envoie chacun **déjà agrandi** d'un nombre entier de fois (environ 512 px), aux pixels nets.
- Le design les montre **entiers** — jamais recadrés ni dans un masque rond — avec des pixels nets
  (`image-rendering: pixelated`) et une taille fixe, sur le fond de leur bloc.
- Une animation ou une planche de sprites donne sa **première image**.

## Ce que Mocky peut faire, et ne peut pas faire

| | |
| --- | --- |
| Chercher et voir les assets des projets partagés | Oui |
| Copier un asset choisi dans votre bibliothèque Mocky | Oui |
| Voir les projets que vous n'avez pas partagés | Non |
| Générer, modifier ou supprimer quoi que ce soit dans Sprixy | Non — le jeton est en lecture seule |
| Joindre un Sprixy sur un réseau privé ou `localhost` | Non — Mocky n'appelle que des adresses publiques |
