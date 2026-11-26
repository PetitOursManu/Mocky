---
description: Les projets libres et les services sur lesquels Mocky est construit, ce que chacun y fait, et sa licence.
source_hash: c0d4e7cea381
---

# Remerciements

Mocky est construit sur le travail de nombreux projets libres, et cette page les
remercie. Chacun reste sous sa propre licence. Les mentions que les licences
exigent sont conservées là où elles les demandent : dans
[`NOTICE`](https://github.com/PetitOursManu/Mocky/blob/main/NOTICE), dans
`public/vendor/VENDOR.md` et dans chaque fichier embarqué. La page
[Licence](license.md) explique comment elles s’articulent. La même liste figure au
bas de la page Réglages, pour les personnes qui utilisent une instance sans jamais
voir le dépôt.

## L’application {#app}

:::why
Ces projets tournent chaque fois que quelqu’un ouvre Mocky ou génère un écran.
Ceux dont le code est copié dans un écran ou un export le disent, parce que là, la
licence voyage avec le fichier.
:::

| Projet | Ce qu’il fait dans Mocky | Licence |
|---|---|---|
| [React](https://react.dev) | L’interface, et chaque écran généré | MIT |
| [Babel](https://babeljs.io) | Compile un écran dans son aperçu | MIT |
| [Tailwind CSS](https://tailwindcss.com) | Les styles de l’interface (v4) et des écrans générés (v3) | MIT |
| [daisyUI](https://daisyui.com) | Des composants que les écrans générés peuvent utiliser | MIT |
| [Motion](https://motion.dev) | Les animations des pages générées | MIT |
| [three.js](https://threejs.org) | Les scènes 3D des pages générées | MIT |
| [html2canvas](https://html2canvas.hertzen.com) | Les captures et les exports en image | MIT |
| [impeccable](https://github.com/pbakaus/impeccable), de Paul Bakaus | La détection déterministe des défauts de la [passe qualité](quality.md) | Apache-2.0 |
| [PDF.js](https://mozilla.github.io/pdf.js/) | La lecture d’un PDF importé | Apache-2.0 |
| [pdf-lib](https://pdf-lib.js.org) | Les exports PDF | MIT |
| [ag-psd](https://github.com/Agamnentzar/ag-psd) | Les exports PSD en calques | MIT |
| [Fontsource](https://fontsource.org) | Les quelque 200 [polices](fonts.md) servies aux écrans | OFL-1.1, Apache-2.0, UFL-1.0 (selon la famille) |
| [Magic UI](https://magicui.design) | Des composants copiés dans les exports | MIT |
| [Feather](https://feathericons.com) | Des icônes copiées dans les exports | MIT |
| [Express](https://expressjs.com) | Le serveur | MIT |
| [Model Context Protocol SDK](https://modelcontextprotocol.io) | Le [serveur MCP](mcp.md) auquel se connectent les assistants | MIT |
| [Playwright](https://playwright.dev) | Le navigateur qui exécute une génération demandée par un assistant | Apache-2.0 |
| [Zod](https://zod.dev) | La validation des documents de film | MIT |
| [Lumy](https://github.com/PetitOursManu/Lumy) | Ce site de documentation | MIT |

## Les films {#video}

:::why
Le worker vidéo est une image à part, que seul un administrateur qui active
l’[export vidéo](video-export.md) construit. Ses projets sont listés séparément
parce que l’un d’eux est la seule exception à la licence de Mocky.
:::

| Projet | Ce qu’il fait dans Mocky | Licence |
|---|---|---|
| [HyperFrames](https://github.com/heygen-com/hyperframes), de HeyGen | Le moteur qui dessine et encode un film | Apache-2.0 |
| [Remotion](https://www.remotion.dev) | Le même travail, comme moteur de repli | Licence Remotion, [permise dans `NOTICE`](license.md#remotion) |
| [React Three Fiber](https://github.com/pmndrs/react-three-fiber) | Les blocs 3D d’un film | MIT |
| [lottie-web](https://github.com/airbnb/lottie-web) | Les icônes animées des films | MIT |
| [useAnimations](https://useanimations.com) | Les animations de ces icônes | MIT |
| [esbuild](https://esbuild.github.io) | Compile un film pour HyperFrames | MIT |
| [FFmpeg](https://ffmpeg.org) | L’encodage vidéo, lancé comme un programme à part | LGPL-2.1+ |
| [Chromium](https://www.chromium.org) | Dessine chaque image, lancé comme un programme à part | BSD-3-Clause |

## Les services {#services}

:::why
Ce ne sont pas des logiciels que Mocky embarque, mais des sites auxquels il
demande des images, avec une clé fournie par l’administrateur. Leurs conditions
s’appliquent aux images qu’ils renvoient.
:::

| Service | Ce qu’il fait dans Mocky |
|---|---|
| [Pexels](https://www.pexels.com) | Des photos et vidéos libres de droits, pour les images et la médiathèque |
| [Pixabay](https://pixabay.com) | Des photos et vidéos libres de droits, pour les images et la médiathèque |
