# Mocky

Générateur d'écrans auto-hébergé : on décrit une interface en langage naturel, on
obtient un composant **React + Tailwind** réel, compilé et rendu en direct sur un
canevas infini.

Cette documentation décrit le fonctionnement interne du projet — les décisions
d'architecture et les raisons derrière celles qui ne sont pas évidentes. Elle
suppose React et TypeScript connus ; elle ne les explique pas.

> Le `README.md` à la racine du dépôt reste la présentation produit (ce que Mocky
> fait, comment l'installer vite). Ici on décrit **comment c'est construit**.

---

## Ce que Mocky est, en une page

| | |
|---|---|
| **Front** | React 18 · TypeScript · Vite · Tailwind CSS |
| **Back** | Node ≥ 20.19 + Express — magasin de fichiers JSON, aucune base de données, aucune dépendance native |
| **Rendu** | iframe `sandbox="allow-scripts"` (origine opaque), React/ReactDOM/Babel/Tailwind vendorisés, compilation JSX *dans* l'iframe |
| **Modèles** | dialecte Ollama en interne, traduit vers les API compatibles OpenAI par le proxy `/__provider` |
| **Binaire externe** | `ffmpeg`, et uniquement pour la vidéo au défilement |

Le point le moins intuitif, et celui qui explique la moitié du code :

> **Le pipeline de génération tourne dans le navigateur, pas sur le serveur.**

Sélection des capacités, planificateur, génération, édition, réparation
automatique, persistance : tout est côté client (`src/lib/`). Le backend est
délibérément mince — fichiers statiques, comptes, synchronisation JSON par
utilisateur, et un proxy modèle protégé contre le SSRF.

La seule exception est **✨ Muse**, qui doit lancer des processus, piloter un
navigateur headless et écrire des fichiers : ces étapes-là vivent dans
`server/muse/`. C'est le premier vrai pipeline côté serveur du projet, et
[l'ADR 001](adr/001-muse.md) explique pourquoi.

---

## Par où commencer

| Vous voulez… | Allez à |
|---|---|
| Installer et lancer Mocky, configurer un modèle | [Démarrage](getting-started.md) |
| Comprendre le registre de capacités, le planificateur, le bac à sable | [Architecture — vue d'ensemble](architecture/overview.md) |
| Savoir quelles règles le code refuse de violer, et pourquoi | [Invariants](architecture/invariants.md) |
| Comprendre ce que Muse ajoute à une génération | [Muse — vue d'ensemble](muse/overview.md) |
| Le détail de Discover → Distill → Dossier, MCP, `sources.json` | [Moteur d'inspiration](muse/inspiration-engine.md) |
| Le système d'animations et sa liste fermée de presets | [Animations](muse/animations.md) |
| Déployer (Docker, Coolify, reverse proxy, sauvegardes) | [Déploiement](deployment.md) |

---

## Le trajet d'une génération

```
                    ┌──────────────────── NAVIGATEUR ────────────────────┐
 prompt ──────────► │                                                    │
                    │  1. Muse (optionnel) ──► POST /api/muse/dossier ───┼──► SERVEUR
                    │       Dossier de design + imagerie                 │     MCP · fetch
                    │                                                    │     LLM · images
                    │  2. selectCapabilities()  ── déterministe, sans LLM │
                    │                                                    │
                    │  3. planScreen()  ── optionnel, JSON structuré,     │
                    │       3 s de délai, `null` sur le moindre échec     │
                    │                                                    │
                    │  4. applyAnimationMode()  ── auto | on | off        │
                    │                                                    │
                    │  5. generateComponent() ─► POST /__provider/api/chat┼──► FOURNISSEUR
                    │       flux NDJSON, protocole sentinelle             │
                    │                                                    │
                    │  6. stripForbiddenMotion()  ── AST Babel            │
                    │                                                    │
                    │  7. <Preview> ── srcDoc + CSP + prélude + Babel      │
                    └────────────────────────────────────────────────────┘
```

Chaque étape est détaillée dans [Architecture — vue d'ensemble](architecture/overview.md).

Trois propriétés valent d'être notées tout de suite, parce qu'elles reviennent
partout dans le code :

- **Muse éteint ⇒ le pipeline est identique à l'octet près** à ce qu'il était
  avant Muse (invariant M1). Le dossier entre par `extraSystem`, exactement là où
  `DESIGN.md` entrait déjà.
- **Aucune étape optionnelle n'a le droit de bloquer.** Le planificateur renvoie
  `null` sur n'importe quelle défaillance ; une étape Muse qui échoue dégrade et
  la génération continue.
- **L'échec est statique, jamais cassé.** Un preset d'animation inconnu rend un
  élément ordinaire ; une bibliothèque absente retombe sur du CSS ; une capacité
  retirée continue d'être injectée pour les écrans qui l'utilisent.

---

## Comment lire cette documentation

Les fichiers sont servis **en direct** depuis `docs/` sur la branche `main` du
dépôt : la page que vous lisez est le fichier Markdown, sans étape de build.
Publier une correction, c'est pousser un commit.

Le lecteur — trois fichiers statiques Docsify, sans dépendance npm, sans CDN —
vit dans `docs-site/` et n'a besoin d'être touché que pour une montée de version.
Voir [Déploiement](deployment.md#la-documentation).

---

## Références internes

Ces documents vivaient déjà dans le dépôt et restent la source sur leurs sujets :

- [ADR 001 — Muse](adr/001-muse.md) — la décision d'architecture complète, y
  compris la codification des huit invariants historiques.
- [Système de design](DESIGN-SYSTEM.md) — les jetons, les thèmes Papier et Encre,
  les primitives d'interface de Mocky lui-même (à ne pas confondre avec le
  `DESIGN.md` que l'utilisateur fournit pour ses écrans générés).
- [Audit 2026-07](AUDIT-2026-07.md) — l'audit multi-agents et sa feuille de
  route, dont la plus grande partie est aujourd'hui appliquée.
