# Modèles de DESIGN.md

[English](../design-presets.md) · **Français**

> **Pourquoi c’est ainsi —** Un DESIGN.md n’est pas un réglage, c’est un document : quelques jetons de couleur, une échelle typographique et des règles écrites en toutes lettres. Mocky en fournit 17 tout faits, appliquables en un clic depuis la page **DESIGN.md** de l’application. Ils sont montrés ici pour que la notion cesse d’être abstraite — chaque vignette est rendue avec les jetons du modèle qu’elle nomme, elle n’est pas une image de celui-ci.

## La galerie

<div data-mocky-widget="presets"></div>

## La liste

La même chose en texte — c’est cette table que la recherche du site indexe, et c’est ce que voit un lecteur sans JavaScript.

| Modèle | Intention | Palette |
| --- | --- | --- |
| **Minimal Light** | Clean, airy, lots of whitespace | `#ffffff` `#111827` `#4f46e5` `#f3f4f6` |
| **Bold Dark** | High-contrast dark UI, vivid accents | `#0b1020` `#e2e8f0` `#22d3ee` `#a855f7` |
| **Playful** | Rounded, colorful, friendly | `#fff7ed` `#7c3aed` `#f97316` `#10b981` |
| **Corporate** | Trustworthy, structured, blue | `#f8fafc` `#0f172a` `#2563eb` `#e2e8f0` |
| **Glassmorphism** | Frosted glass over gradients | `#1e1b4b` `#ffffff` `#818cf8` `#f0abfc` |
| **Neobrutalist** | Hard edges, thick borders, bold | `#fde047` `#000000` `#ffffff` `#2563eb` |
| **Warm Earth** | Natural tones, cozy, organic | `#faf6f0` `#3c2a1e` `#b45309` `#d6c3a5` |
| **Mint Fresh** | Cool greens, clean, refreshing | `#f0fdf4` `#064e3b` `#10b981` `#a7f3d0` |
| **Sunset** | Warm gradients, pink/orange energy | `#fff1f2` `#831843` `#f43f5e` `#fb923c` |
| **Midnight** | Deep blue-black, gold accents, elegant | `#020617` `#e2e8f0` `#fbbf24` `#1e3a5f` |
| **Constructivism** | Geometry, asymmetry, motion | `#1a1a1a` `#ffffff` `#dc2626` `#fbbf24` |
| **Swiss Style** | Grid, Helvetica, clarity | `#ffffff` `#000000` `#ef4444` `#f3f4f6` |
| **Editorial** | Magazine layout, serif headlines | `#faf9f6` `#1a1a1a` `#9333ea` `#e5e7eb` |
| **Hand-Drawn** | Sketchy, casual, imperfect | `#fefce8` `#3f3f46` `#f59e0b` `#84cc16` |
| **Retro** | Vintage, grainy, nostalgic | `#2d1b00` `#fef3c7` `#f97316` `#06b6d4` |
| **Flat** | No shadows, pastel, clean | `#fafafa` `#1f2937` `#3b82f6` `#f3f4f6` |
| **Bento** | Tidy tiles, modular, dense | `#0f0f0f` `#ffffff` `#a78bfa` `#f9a8d4` |

## D’où viennent ces données

Le site de documentation ne partage aucun graphe de modules avec l’application : il est statique, servi ailleurs, et sans étape de construction. Ces modèles existent donc en double. Ce double est **généré** par `npm run docs:data` depuis `src/lib/styles.ts`, et `npm run check:docs-data` fait échouer la construction quand les deux divergent. Cela ne supprime pas la seconde copie — rien ne le pourrait ici — mais cela transforme une dérive silencieuse en une erreur visible.
