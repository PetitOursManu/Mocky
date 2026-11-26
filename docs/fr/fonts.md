---
description: Environ 200 polices, servies par Mocky lui-même, que chaque écran et chaque document généré peut utiliser par leur nom.
source_hash: 2d4f87af5cbd
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
   navigateur ne télécharge le second que si le texte en a besoin. Deux familles
   font exception : **Noto Sans JP** et **Noto Serif SC** portent aussi les
   caractères japonais et chinois, découpés en une centaine de petits fichiers
   chacune, si bien qu’une page qui écrit quelques kanji ne télécharge que les
   quelques fichiers qui les contiennent. Placez-en une après la police latine —
   `'Inter Tight', 'Noto Sans JP', sans-serif` — et seuls les caractères absents
   de la police latine viennent d’elle.
4. Une capture attend les polices avant de dessiner : une vignette ou un flyer
   exporté n’est pas composé dans la police de secours.

## Écriture manuscrite {#handwriting}

:::why
Une police pose des lettres qui sont déjà là. Quelques mots qu’on voit s’écrire
— une signature, un « Merci », un prénom sur un faire-part — sont autre chose,
et les dessiner à la main dans le code du modèle donnait des mots qui
s’écrivaient de travers. Un écran les demande donc par leur nom, et une
bibliothèque les trace.
:::

`<Handwriting text="Merci !" font="parisienne" className="text-6xl text-rose-700" />`
écrit ses mots trait par trait, dans l’ordre d’une plume, quand ils arrivent à
l’écran. C’est [Tegaki](https://github.com/gkurt/tegaki) (MIT) qui les dessine,
servi depuis Mocky comme chaque script d’un aperçu (`public/vendor/tegaki.js`).

| `font` | Aspect |
|---|---|
| `parisienne` (par défaut) | Une écriture liée élégante |
| `caveat` | Un feutre décontracté |
| `italianno` | Une calligraphie soignée |
| `ems-allure` | Une écriture liée fine |
| `hershey-script` | Le trait unique d’une table traçante |

- **Les accents.** Caveat, Parisienne et Italianno n’ont que les lettres sans
  accent. Un texte avec une lettre absente de la police choisie (« Été »,
  « Noël ») est écrit en EMS Allure, qui les a, plutôt qu’avec un trou. Les
  apostrophes typographiques, les guillemets et le « œ » sont écrits comme le
  ferait une main (« oe », guillemets droits).
- **La taille et la couleur** viennent d’une classe de taille de texte et d’une
  couleur de texte (ou de `color`, un hexadécimal). `speed` (0,25–4, 2 par
  défaut) et `loop` règlent l’écriture.
- **Il reste immobile là où une page l’est** : avec « Sans animation », avec le
  mouvement réduit, et dans chaque capture et chaque export, les mots sont
  dessinés finis.
- **C’est du texte** pour un lecteur d’écran, et le dessin lui est masqué.
- **Un projet exporté** ne dépend du paquet `tegaki` que si l’un de ses écrans
  écrit à la main, et charge chaque police à sa première utilisation.

Les polices sont sous SIL OFL 1.1 (Hershey Script : les conditions propres aux
polices Hershey). Le mot « Mocky » qui s’écrit pendant la génération d’un écran
vient de la même bibliothèque, exécutée une fois à la construction de Mocky
(`npm run build:loader-word`) : l’application livre le dessin, pas la
bibliothèque.

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
