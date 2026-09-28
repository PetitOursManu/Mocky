---
source_hash: 859e4d1af6b2
---

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
| Service séparé facultatif | Le worker de rendu Remotion, dans `worker/video/`, derrière le profil Compose `video-export`. Absent de l'image par défaut, pour des [raisons de licence](video-export.md) |

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
[l'ADR 001](../adr/001-muse.md) en explique le raisonnement.

---

## Par où commencer

| Si vous voulez… | Lisez |
|---|---|
| Installer Mocky et configurer un modèle | [Démarrage](getting-started.md) |
| Comprendre le registre de capacités, le planificateur et l'isolation de l'aperçu | [Vue d'ensemble de l'architecture](architecture/overview.md) |
| Savoir quelles règles le code refuse d'enfreindre, et pourquoi | [Invariants](architecture/invariants.md) |
| Voir ce que Muse ajoute à une génération | [Vue d'ensemble de Muse](muse/overview.md) |
| Suivre Discover, Distill et Dossier en détail | [Moteur d'inspiration](muse/inspiration-engine.md) |
| Comprendre le système d'animations | [Animations](muse/animations.md) |
| Contrôler un écran généré, et corriger ce que le contrôle trouve | [Passe de qualité](quality.md) |
| Composer un `.mp4` pour un écran à partir d'un catalogue de blocs, et savoir pourquoi son moteur de rendu est livré à part | [Motion Ultra](video-export.md) |
| Déployer Mocky | [Déploiement](deployment.md) |
| Passer l'instance en lecture seule, ou la déplacer vers un autre serveur | [Maintenance et migration](migration.md) |
| Voir qui est connecté, ce que fait la machine, et qui a changé quoi | [Tableau de bord d'administration](admin-dashboard.md) |

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
[vue d'ensemble de l'architecture](architecture/overview.md).

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

Les pages sont construites par [Lumy](https://github.com/PetitOursManu/Lumy), un
outil de documentation écrit pour Mocky et publié à part, en open source. Le
Markdown de `docs/` reste la source ; Lumy en fait un site avec une recherche,
les deux langues, un thème clair et un thème sombre, et des blocs avec lesquels
le lecteur peut interagir. `docs-site/` contient sa configuration et les widgets
propres à Mocky. Voir [Déploiement](deployment.md), qui explique comment le site
est construit et servi.

Pour lire le site en local avant d'y publier une modification :

```bash
npm run docs
```

Cela le sert sur `http://127.0.0.1:4173` et le reconstruit à chaque
enregistrement. `npm run docs:check` cherche les liens cassés et les blocs que
Lumy ne connaît pas, et l'intégration continue la lance à chaque push.

---

## Les autres documents du dépôt

Ils existaient avant cette documentation et restent la référence sur leurs
sujets. Les quatre existent désormais dans les deux langues.

| Document | Sujet | English | Français |
|---|---|---|---|
| README du dépôt | La présentation du produit : ce que Mocky fait, et comment l'installer rapidement | `README.md` | `README.fr.md` |
| ADR 001 — Muse | La décision d'architecture complète, avec la première mise par écrit des huit invariants d'origine | [adr/001-muse.md](../adr/001-muse.md) | [fr/adr/001-muse.md](adr/001-muse.md) |
| Système de design | Les jetons de l'interface de Mocky, les thèmes Papier et Encre, les primitives. À ne pas confondre avec le `DESIGN.md` que l'utilisateur fournit pour ses écrans générés | [DESIGN-SYSTEM.md](../DESIGN-SYSTEM.md) | [fr/DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) |
| Audit 2026-07 | L'audit multi-agents et sa feuille de route, aujourd'hui appliquée en grande partie | [AUDIT-2026-07.md](../AUDIT-2026-07.md) | [fr/AUDIT-2026-07.md](AUDIT-2026-07.md) |

`tests/docs-parity.test.js` tient chaque paire ensemble : même nombre de titres,
mêmes niveaux dans le même ordre et, pour les trois derniers, un bloc
« pourquoi » sous chaque titre, que le site replie tant qu'on ne le demande pas.

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

Ils ont d'abord reçu des jumeaux suffixés de l'autre langue : `DESIGN-SYSTEM.md`
était la page française et `DESIGN-SYSTEM.en.md` l'anglaise. Quand le site est
passé à Lumy, ils ont rejoint le reste de `docs/` : le chemin nu porte l'anglais,
et `fr/` porte la traduction, chemin pour chemin.
