---
description: Mocky est sous AGPL-3.0-or-later, avec deux exceptions — l’usage de Remotion par le worker vidéo, et tout ce que Mocky produit pour vous.
source_hash: 3ff1d9df3ed9
---

# Licence

Mocky est un logiciel libre, publié sous la **GNU Affero General Public License,
version 3 ou toute version ultérieure** (`AGPL-3.0-or-later`). Le texte de la
licence est le fichier
[`LICENSE`](https://github.com/PetitOursManu/Mocky/blob/main/LICENSE) à la racine
du dépôt ; l’avis de copyright et les deux permissions additionnelles sont dans
[`NOTICE`](https://github.com/PetitOursManu/Mocky/blob/main/NOTICE), qui est le
document qui fait foi. Cette page les explique ; elle ne constitue pas un conseil
juridique.

## En bref {#summary}

:::why
La plupart des gens qui croisent une licence copyleft se posent une seule
question — « qu’est-ce que je dois faire ? » — et la réponse est presque toujours
« rien ». Le tableau donne cette réponse d’abord, pour que les obligations
ressortent là où elles existent vraiment.
:::

| Vous… | Ce que la licence vous demande |
|---|---|
| Utilisez Mocky, non modifié, pour vous ou votre équipe | Rien |
| L’hébergez, non modifié, pour d’autres personnes | Rien de plus que laisser ses avis en place : le code source est déjà public |
| Le modifiez pour votre propre usage | Rien, tant que personne d’autre n’utilise la version modifiée |
| Exploitez une version **modifiée** que d’autres utilisent à travers le réseau | Proposer à ces utilisateurs le code source de votre version (section 13) |
| Le redistribuez, modifié ou non | Sous la même licence, avec son code source et ses avis |
| Publiez un site ou un document fait avec Mocky | Rien : [ce que Mocky produit est à vous](#output) |
| Construisez le worker vidéo | Rien de plus du côté de Mocky ; [la licence propre de Remotion](#remotion) s’applique à Remotion |

## Pourquoi l’AGPL {#why-agpl}

:::why
Mocky est un serveur qu’on utilise depuis un navigateur, et c’est exactement le
cas qu’une licence copyleft ordinaire n’atteint jamais : les obligations de la
GPL naissent quand une copie est distribuée, et un service hébergé ne distribue
rien.
:::

Sous GPL, quelqu’un pourrait modifier Mocky, l’exploiter comme service pour des
milliers de personnes et ne jamais publier une ligne de ses changements, puisque
aucune copie ne change de mains. L’AGPL ajoute une obligation, la section 13 :
quiconque laisse des utilisateurs interagir à travers le réseau avec une version
modifiée doit leur proposer le code source de cette version. Tout le reste —
utiliser, étudier, modifier, partager — est la même liberté que donne la GPL.

« Ou ultérieure » signifie qu’une future version de l’AGPL publiée par la Free
Software Foundation peut aussi être choisie par qui reçoit le code.

## Ce que Mocky produit est à vous {#output}

:::why
Un export transporte le code de Mocky à côté du vôtre. Sans exception explicite,
tout site publié à partir d’un export devrait lui aussi être sous AGPL — une
licence choisie pour protéger Mocky aurait débordé sur les projets de ses
utilisateurs.
:::

Le code qu’un modèle écrit pour vous n’a jamais appartenu à Mocky. Mais Mocky
ajoute ses propres fichiers à ce qu’il vous remet : un projet exporté transporte
les composants de `src/components/ui/` (icônes, graphiques, `<Animated>`,
`<Scene3D>`, le kit Motion Ultra…), les utilitaires de `src/lib/` et
l’échafaudage d’un projet Vite exécutable. Ces fichiers sont du code de Mocky,
écrit par ses auteurs.

`NOTICE` accorde donc une seconde permission additionnelle : **tout fichier que
Mocky produit pour qu’un utilisateur le télécharge ou l’exporte** — un projet
exporté, un écran téléchargé, un PDF, un `.pptx`, une image, un film — ainsi que
toute œuvre qui le contient, peut être utilisé, modifié et distribué aux
conditions de votre choix, sans les conditions de l’AGPL. Chaque projet exporté
le dit dans son propre `README.md`, pour que la permission voyage avec l’archive.

Trois limites :

- **Mocky lui-même n’est pas couvert.** Un Mocky modifié, ou un autre programme
  qui génère ou exporte des interfaces et se sert de ces fichiers pour le faire,
  reste sous AGPL. L’exception libère votre projet, pas un générateur concurrent.
- **Les avis tiers restent.** Un fichier qui porte son propre avis le garde :
  l’utilitaire `cn()` est du code MIT venu de MagicUI, et la géométrie des icônes
  vient de Feather, sous MIT.
- **L’exception ne parle qu’au nom des auteurs de Mocky.** Une photo de banque
  d’images garde sa licence Pexels ou Pixabay, et ce qu’écrit un modèle garde les
  conditions fixées par votre fournisseur.

## Le worker vidéo et Remotion {#remotion}

:::why
La licence de Remotion n’est pas compatible avec la GPL : sans permission écrite,
personne ne pourrait légalement redistribuer un worker construit depuis ce dépôt
— l’AGPL exigerait que toute la combinaison soit proposée sous ses conditions.
:::

La première permission additionnelle de `NOTICE`, au titre de la section 7 de
l’AGPL, autorise à combiner Mocky avec `remotion` et `@remotion/*`. En pratique,
cette combinaison n’existe que dans `worker/video/`, le worker de rendu
facultatif derrière le profil `video-export`.

La permission règle la part de Mocky et rien d’autre. Elle n’accorde aucun droit
sur Remotion : Remotion est gratuit pour les particuliers, les organisations à
but non lucratif et les sociétés jusqu’à trois salariés, et exige une licence
payante au-delà — c’est à qui construit l’image du worker de le vérifier.
[Motion Ultra](video-export.md) explique pourquoi le worker est un service
séparé.

## Dépendances {#dependencies}

:::why
Une licence copyleft ne tient que si tout ce qui est combiné avec le code lui est
compatible. L’inventaire a été dressé au changement de licence, et il est écrit
ici pour que la prochaine dépendance soit vérifiée contre lui plutôt que
supposée compatible.
:::

| Où | Licences | Compatible avec l’AGPL v3 |
|---|---|---|
| Dépendances npm de Mocky (444 paquets dans `package-lock.json`) | MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, CC0-1.0, MIT AND Zlib ; CC-BY-4.0 pour un paquet de données ; MPL-2.0 pour `lightningcss`, un outil de compilation | Oui |
| Bundles navigateur de `public/vendor/` | React, ReactDOM, Babel standalone, html2canvas, Tailwind, daisyUI, Motion, three.js — tous MIT | Oui |
| Détection de qualité | `impeccable`, Apache-2.0 | Oui : du code Apache-2.0 peut entrer dans une œuvre GPLv3 |
| Worker vidéo | `three`, `@react-three/fiber`, `express`, `lottie-web`, `react-useanimations` : MIT. Polices de `@fontsource` : OFL-1.1, livrées comme fichiers de police séparés | Oui |
| Worker vidéo | `remotion`, `@remotion/*` | Non — couvert par [la permission de la section 7](#remotion) |
| Programmes externes | `ffmpeg`, le Chrome headless avec lequel le worker rend | Pas combinés : ils tournent comme programmes séparés |

## Pour les contributeurs {#contributors}

:::why
Deux exceptions ne valent que si chaque ligne qu’elles couvrent appartient à ceux
qui les accordent. Une contribution qui changerait cela, ou une dépendance qui
casserait la compatibilité ci-dessus, déferait sans bruit ce que `NOTICE`
promet.
:::

- Une contribution est acceptée sous `AGPL-3.0-or-later`, y compris les deux
  permissions de `NOTICE` — la licence sous laquelle elle est lue, comme le
  prévoient déjà les conditions de GitHub.
- Une nouvelle dépendance doit être compatible avec la GPL v3. GPL-2.0-only,
  SSPL, BUSL, « Commons Clause » et les licences non commerciales ne le sont pas.
  Un second paquet incompatible a besoin de sa propre permission, décidée par les
  titulaires des droits, jamais ajoutée dans le code.
- Un composant copié dans les exports (`src/lib/capabilities/snippets/`) doit
  être du code propre à Mocky ou porter son propre avis permissif : l’exception
  de sortie ne peut accorder que ce que les auteurs de Mocky possèdent.
