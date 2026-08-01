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

---

## La pile technique

| Couche | Ce que c'est |
|---|---|
| Front | React 18, TypeScript, Vite, Tailwind CSS |
| Back | Node ≥ 20.19 avec Express. Des fichiers JSON sur disque. Pas de base de données, pas de dépendance native |
| Aperçu | Une iframe isolée, sans origine propre. React, ReactDOM, Babel et Tailwind sont copiés localement. Le JSX est compilé à l'intérieur de l'iframe |
| Modèles | Mocky parle toujours le dialecte Ollama en interne. Un proxy traduit vers les API compatibles OpenAI |
| Binaire externe | `ffmpeg`, uniquement pour la vidéo au défilement |

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

## Trois propriétés à connaître d'emblée

Elles expliquent une bonne partie du code que vous allez lire.

**Muse éteint, rien ne change.** Avec l'interrupteur sur off, la requête envoyée
au modèle est exactement celle d'avant l'existence de Muse. Le dossier entre par
`extraSystem`, le paramètre que `DESIGN.md` utilisait déjà.

**Aucune étape facultative n'a le droit de bloquer.** Le planificateur renvoie
`null` au moindre échec. Une étape Muse qui échoue dégrade, et la génération
continue.

**L'échec est statique, jamais cassé.** Un preset d'animation inconnu affiche un
élément ordinaire. Une bibliothèque absente retombe sur du CSS. Une capacité
retirée reste injectée pour les écrans qui l'utilisent.

---

## Comment cette documentation est servie

Les fichiers Markdown sont lus en direct depuis `docs/` sur la branche `main`. La
page que vous lisez est le fichier Markdown lui-même, sans étape de compilation.
Publier une correction, c'est pousser un commit.

Le lecteur est constitué de trois fichiers Docsify statiques dans `docs-site/`.
Il n'a aucune dépendance npm et ne charge rien depuis un CDN. Voir
[Déploiement](fr/deployment.md).

---

## Les autres documents du dépôt

Ils existaient avant cette documentation et restent la référence sur leurs
sujets.

| Document | Langue | Sujet |
|---|---|---|
| [ADR 001 — Muse](adr/001-muse.md) | Anglais | La décision d'architecture complète, avec la première mise par écrit des huit invariants d'origine |
| [Système de design](DESIGN-SYSTEM.md) | Français | Les jetons de l'interface de Mocky, les thèmes Papier et Encre, les primitives. À ne pas confondre avec le `DESIGN.md` que l'utilisateur fournit pour ses écrans générés |
| [Audit 2026-07](AUDIT-2026-07.md) | Français | L'audit multi-agents et sa feuille de route, aujourd'hui appliquée en grande partie |
