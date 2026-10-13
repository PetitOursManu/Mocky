---
description: Environ 200 polices, servies par Mocky lui-même, que chaque écran et chaque document généré peut utiliser par leur nom.
source_hash: 45a929cfcc78
---

# Polices

:::why
Une police, c’est la moitié de ce qui fait qu’un écran a l’air dessiné plutôt
que généré. Jusqu’ici un écran pouvait en NOMMER une — « titres en Playfair
Display » — et être affiché dans la police du système, parce que rien ne la
chargeait. Le catalogue comble cet écart : les polices sont servies par Mocky,
le modèle sait lesquelles existent, et un écran est dessiné dans celles que son
code nomme.
:::

Mocky fournit environ **200 familles**, en douze genres : sans empattement,
condensées, arrondies, à empattements pour le texte, à empattements pour le
titrage, égyptiennes (slab), titrage, rétro et décoratives, gothiques et
médiévales, manuscrites, scriptes et chasse fixe. Chaque page web, flyer, affiche
ou post généré peut les utiliser, et une direction artistique aussi.

## Utiliser une police {#using}

:::why
Le modèle choisit bien quand on lui donne le choix. Il reçoit la liste complète
à chaque génération, chaque modification et chaque polissage : il suffit qu’une
demande nomme une police — ou décrive une ambiance — pour obtenir la bonne.
:::

- **Dans une demande**, nommez la police : *« une affiche pour une soirée jazz,
  titre en Abril Fatface, texte en Lora »*. Ou décrivez-la — *« quelque chose
  d’écrit à la main »* — et le modèle choisit dans la liste.
- **Dans une modification**, cela marche aussi sur un écran existant :
  *« mets les titres en Bebas Neue »*.
- **Dans une direction**, la section `Typography` du DESIGN.md nomme les
  polices : `- Display: Fraunces` et `- Body: Inter`. Le dossier de Muse choisit
  désormais toujours les deux dans la liste.

Pour toutes les voir, ouvrez la **spécification** d’un design, section
*Typographie*, puis **Parcourir les polices** : chaque famille, composée dans sa
propre police, filtrable par genre, avec son nom prêt à copier. Quand les polices
d’une direction sont au catalogue, la spécification et l’aperçu web du design
sont dessinés avec elles.

## Ce que reçoit le modèle {#prompt}

:::why
Une police inventée par le modèle (« Satoshi », « Söhne ») est une police que
l’écran ne peut pas charger. Lui donner les noms exacts, et la façon exacte de
les écrire, c’est ce qui fait que son choix est celui qui s’affiche.
:::

La liste est envoyée au modèle en un bloc compact, une ligne par genre, avec
deux écritures à employer : une classe Tailwind,
`font-['Playfair_Display',serif]`, ou un style,
`fontFamily: "'Playfair Display', serif"`. Il lui est aussi demandé de s’en
tenir à deux ou trois familles par écran, et que les polices scriptes,
manuscrites, gothiques, rétro et de titrage sont pour les titres et les logos,
jamais pour les paragraphes.

La réparation, la correction d’accessibilité et l’ajustement des pages ne
reçoivent pas la liste : on leur demande de ne rien changer d’autre que ce
qu’on leur confie, et un écran qu’ils rendent nomme toujours les polices qu’il
nommait.

## Comment un écran reçoit ses polices {#delivery}

:::why
Un aperçu tourne dans un bac à sable qui ne peut rien charger depuis Internet :
une police de Google Fonts n’a jamais été possible. Servir les fichiers depuis
l’adresse de Mocky garde les aperçus fonctionnels hors ligne, et évite que le
navigateur de chaque visiteur dise à un tiers ce qu’il regarde.
:::

1. Les fichiers sont copiés depuis leurs paquets `@fontsource` vers
   `public/fonts/` par `npm run vendor:fonts` (lancé avant `dev`, `build` et
   `test`), et servis sous `/fonts/` par Mocky lui-même, avec un cache long.
2. Quand un écran est dessiné — sur le canevas, en vignette, en export PDF ou
   image, dans la vue en direct MCP — Mocky lit les familles que son code nomme
   et déclare celles-là, et seulement celles-là. Un écran qui nomme deux familles
   en télécharge deux ; un écran qui n’en nomme aucune est dessiné exactement
   comme avant.
3. Seuls les sous-ensembles latins sont livrés (`latin` et `latin-ext`, qui
   couvre les accents du français, du polonais, du tchèque, du turc…), et un
   navigateur ne télécharge le second que si le texte en a besoin.
4. Une capture attend les polices avant de dessiner : une vignette ou un flyer
   exporté n’est pas composé dans la police de secours.

## Licences {#licences}

:::why
Une police est un logiciel avec sa propre licence. Chacune est vérifiée au
moment de la copie, pas supposée : une police qu’on ne pourrait pas
redistribuer n’atteint jamais un serveur.
:::

Chaque famille est sous SIL Open Font License 1.1, Apache License 2.0 ou Ubuntu
Font Licence — le script lit la licence dans chaque paquet et refuse toute
autre. Les trois permettent de livrer les polices avec un logiciel ; la licence
de chaque famille est servie à côté des fichiers, dans `/fonts/LICENSES.txt`.
Voir [Licence](license.md).

Un **projet exporté** nomme les familles qu’il utilise mais n’embarque pas les
fichiers : installez-les dans ce projet (par exemple avec le même paquet
`@fontsource`) ou chargez-les comme votre site charge ses polices.

## Ajouter une famille {#adding}

:::why
La liste est décidée par une personne, pas tirée d’un index de paquets : une
direction artistique demande « une grotesque condensée » ou « une égyptienne »,
et seule une catégorie choisie par quelqu’un peut y répondre.
:::

1. Ajoutez le paquet en devDependency à version exacte :
   `npm install -D --save-exact @fontsource-variable/<id>` (ou `@fontsource/<id>`
   quand il n’existe pas de version variable).
2. Ajoutez `<id>` à son genre dans `FAMILIES`, en haut de
   `scripts/vendor-fonts.mjs`.
3. Lancez `npm run vendor:fonts` et committez `src/lib/fonts/catalogue.json` et
   `server/fonts/families.json`. `tests/fonts-catalogue.test.js` échoue quand le
   catalogue committé et les paquets installés ne concordent pas.
