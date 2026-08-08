# Mocky

Mocky est un générateur d'écrans que vous hébergez vous-même. Vous décrivez une
interface en langage courant, et vous obtenez un vrai composant **React +
Tailwind**, compilé et affiché en direct sur un canevas infini.

Ces pages expliquent comment le projet est construit, et pourquoi les choix les
moins évidents ont été faits. Elles supposent que vous connaissez React et
TypeScript.

> Le `README.md` à la racine du dépôt présente le produit : ce que Mocky fait, et
> comment l'installer rapidement. Cette documentation décrit l'intérieur.

> **La version anglaise est la version de référence : [English documentation](/).**
> En cas de divergence entre les deux, c'est l'anglaise qui fait foi.

![Le canevas d'un projet : deux écrans générés, la barre de modes, le composer](../assets/13-canvas-project.png)

*Un projet ouvert. Les écrans vivent côte à côte sur un canevas infini ; la barre du haut change de mode, et le composer en bas décrit le suivant. L'interface est montrée en anglais dans toute la documentation, quelle que soit la langue de la page.*

---

## La pile technique

| Couche | Ce que c'est |
|---|---|
| Front | React 18, TypeScript, Vite, Tailwind CSS |
| Back | Node ≥ 22.12 avec Express. Des fichiers JSON sur disque. Pas de base de données, pas de dépendance native |
| Aperçu | Une iframe isolée, sans origine propre. React, ReactDOM, Babel et Tailwind sont copiés localement. Le JSX est compilé à l'intérieur de l'iframe |
| Modèles | Mocky parle toujours le dialecte Ollama en interne. Un proxy traduit vers les API compatibles OpenAI |
| Binaire externe | `ffmpeg`, uniquement pour la vidéo au défilement |
| Service séparé facultatif | Le worker de rendu Remotion, dans `worker/video/`, derrière le profil Compose `video-export`. Absent de l'image par défaut, pour des [raisons de licence](fr/video-export.md) |

---

## La chose à savoir en premier

**Le pipeline de génération tourne dans le navigateur, pas sur le serveur.**

La sélection des capacités, le planificateur, la génération, l'édition, la
réparation automatique et la persistance vivent tous dans `src/lib/`. Le serveur
est volontairement mince : il sert les fichiers statiques, gère les comptes,
synchronise un fichier JSON par utilisateur, et relaie les requêtes vers le
modèle.

Il y a une exception. **Muse** doit lancer des processus, piloter un navigateur
sans interface et écrire des fichiers. Ses étapes vivent donc dans
`server/muse/`. C'est le premier vrai pipeline serveur du projet, et
[l'ADR 001](adr/001-muse.md) en explique le raisonnement.

---

## Par où commencer

| Si vous voulez… | Lisez |
|---|---|
| Installer Mocky et configurer un modèle | [Démarrage](fr/getting-started.md) |
| Comprendre le registre de capacités, le planificateur et l'isolation de l'aperçu | [Vue d'ensemble de l'architecture](fr/architecture/overview.md) |
| Savoir quelles règles le code refuse d'enfreindre, et pourquoi | [Invariants](fr/architecture/invariants.md) |
| Voir ce que Muse ajoute à une génération | [Vue d'ensemble de Muse](fr/muse/overview.md) |
| Suivre Discover, Distill et Dossier en détail | [Moteur d'inspiration](fr/muse/inspiration-engine.md) |
| Comprendre le système d'animations | [Animations](fr/muse/animations.md) |
| Contrôler un écran généré, et corriger ce que le contrôle trouve | [Passe de qualité](fr/quality.md) |
| Transformer un ensemble d'images en `.mp4`, et savoir pourquoi son moteur de rendu est livré à part | [Motion](fr/video-export.md) |
| Déployer Mocky | [Déploiement](fr/deployment.md) |

---

## Ce qui se passe quand vous générez un écran

Sept étapes. Les étapes 1 et 3 sont facultatives.

| # | Étape | Où | Détail |
|---|---|---|---|
| 1 | **Muse** construit un dossier de design | Serveur, via `POST /api/muse/dossier` | Facultatif. Produit une direction artistique, de la vraie copie et une image |
| 2 | **`selectCapabilities()`** dresse une liste courte | Navigateur | Correspondance de mots-clés. Aucun appel au modèle |
| 3 | **`planScreen()`** affine cette liste | Navigateur | Facultatif. Renvoie `null` au moindre échec, et la liste courte est alors utilisée telle quelle |
| 4 | **`applyAnimationMode()`** applique votre préférence de mouvement | Navigateur | Trois états : `auto`, `on`, `off` |
| 5 | **`generateComponent()`** diffuse le composant | Navigateur, via `POST /__provider/api/chat` | Flux NDJSON, sortie délimitée par des sentinelles |
| 6 | **`stripForbiddenMotion()`** retire le code Motion brut | Navigateur | Parcours d'arbre syntaxique Babel, jamais une expression régulière |
| 7 | **`<Preview>`** l'affiche | Navigateur | Iframe isolée avec une politique de sécurité stricte |

Chaque étape est détaillée dans la
[vue d'ensemble de l'architecture](fr/architecture/overview.md).

---

## Quatre propriétés à connaître d'emblée

Elles expliquent une bonne partie du code que vous allez lire.

**Muse éteint, rien ne change.** Avec l'interrupteur sur off, la requête envoyée
au modèle est exactement celle d'avant l'existence de Muse. Le dossier entre par
`extraSystem`, le paramètre que `DESIGN.md` utilisait déjà.

**Aucune étape facultative n'a le droit de bloquer.** Le planificateur renvoie
`null` au moindre échec. Une étape Muse qui échoue dégrade, et la génération
continue.

**Une passe de qualité ne peut jamais faire échouer une génération.** C'est la
règle précédente, à nouveau, et elle pèse davantage ici à cause de l'endroit où
la passe se place. Muse tourne *avant* une génération : un échec de Muse donne
un écran construit avec moins. La passe de qualité tourne *après* une génération
déjà réussie, sur un écran que l'utilisateur a sous les yeux. Chaque étape
dégrade donc et renvoie un rapport, et aucune ne lève d'exception chez
l'appelant : échouer à **contrôler** un écran ne doit jamais ressembler à un
échec à le **fabriquer**. C'est l'invariant Q1.

**L'échec est statique, jamais cassé.** Un preset d'animation inconnu affiche un
élément ordinaire. Une bibliothèque absente retombe sur du CSS. Une capacité
retirée reste injectée pour les écrans qui l'utilisent.

---

## Comment cette documentation est servie

Les fichiers Markdown sont lus en direct depuis `docs/` sur la branche `main`. La
page que vous lisez est le fichier Markdown lui-même, sans étape de compilation.
Publier une correction, c'est pousser un commit.

Le lecteur est constitué de sept fichiers statiques dans `docs-site/` : quatre
écrits pour le projet, trois copies locales de Docsify. Il n'a aucune dépendance
npm et ne charge rien depuis un CDN. Voir [Déploiement](fr/deployment.md), qui
les liste un par un.

Pour lire le site en local avant d'y publier une modification :

```bash
npm run docs
```

Cela sert `docs-site/` sur `http://127.0.0.1:4173`. La prose continue d'être lue
depuis GitHub : ce que vous prévisualisez est donc le vrai site à sa vraie
longueur — avec une barre latérale assez longue pour défiler, ce qui est la
condition sous laquelle sa mise en page mérite d'être vérifiée. C'est faute de
toute prévisualisation locale que le sélecteur de thème a passé un moment au
milieu du menu sur tous les écrans étroits.

---

## Les autres documents du dépôt

Ils existaient avant cette documentation et restent la référence sur leurs
sujets. Les quatre existent désormais dans les deux langues.

| Document | Sujet | English | Français |
|---|---|---|---|
| README du dépôt | La présentation du produit : ce que Mocky fait, et comment l'installer rapidement | `README.md` | `README.fr.md` |
| ADR 001 — Muse | La décision d'architecture complète, avec la première mise par écrit des huit invariants d'origine | [001-muse.md](adr/001-muse.md) | [001-muse.fr.md](adr/001-muse.fr.md) |
| Système de design | Les jetons de l'interface de Mocky, les thèmes Papier et Encre, les primitives. À ne pas confondre avec le `DESIGN.md` que l'utilisateur fournit pour ses écrans générés | [DESIGN-SYSTEM.en.md](DESIGN-SYSTEM.en.md) | [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) |
| Audit 2026-07 | L'audit multi-agents et sa feuille de route, aujourd'hui appliquée en grande partie | [AUDIT-2026-07.en.md](AUDIT-2026-07.en.md) | [AUDIT-2026-07.md](AUDIT-2026-07.md) |

Chacun des huit fichiers porte un sélecteur de langue sur sa première ligne
utile, et `tests/docs-parity.test.js` tient les paires ensemble : même nombre de
titres, mêmes niveaux dans le même ordre, un bloc « pourquoi » sous chacun
d'eux, et jamais un bloc rédigé dans l'autre langue.

Ils n'ont longtemps existé que dans une seule langue, et on présentait cela
comme un choix : un ADR est un document daté, le traduire invite deux versions
qui finissent par se contredire. Ce que l'argument oubliait, c'est que
l'interface avait déjà connu exactement la même panne — une seule rangée de
boutons où se lisaient « Rename », « Voir le prompt qui a créé cet écran »,
« More options », « Delete screen ». Un système de design en français, un ADR en
anglais, un audit en français et un README en anglais, c'est cette rangée-là
étalée sur quatre fichiers, sans moyen de savoir à quel lecteur chacun
s'adressait. Le remède est celui que `src/i18n` avait déjà trouvé : un fichier
complet par langue, tenu au pas par un test.

D'où des noms de fichiers qui se lisent à l'envers du reste de `docs/`, où le
chemin nu porte l'anglais et où `fr/` porte la traduction. Ici, chaque document
a gardé le chemin et la langue qu'il avait déjà, et a reçu un jumeau suffixé de
l'autre : `DESIGN-SYSTEM.md` est la page **française** et `DESIGN-SYSTEM.en.md`
l'anglaise ; à l'inverse, `adr/001-muse.md` est la page **anglaise** et
`adr/001-muse.fr.md` la française. Les renommer casserait le tableau `DOCS` du
test de parité et tous les liens entrants, pour une symétrie que personne n'a
jamais réclamée.
