# DESIGN.md presets

**English** · [Français](fr/design-presets.md)

> **Why it works this way —** A DESIGN.md is not a setting, it is a document: a few colour tokens, a type scale and rules written out in words. Mocky ships 17 ready-made ones, applied in a click from the application's **DESIGN.md** page. They are shown here so the idea stops being abstract — each specimen is rendered from the tokens of the preset it names, rather than being a picture of one.

## The gallery

<div data-mocky-widget="presets"></div>

## The list

The same thing as text — this table is what the site's own search indexes, and what a reader without JavaScript sees.

| Preset | Intent | Palette |
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

## Where this data comes from

The documentation site shares no module graph with the application: it is static, served elsewhere, and has no build step. So these presets exist twice. That second copy is **generated** by `npm run docs:data` from `src/lib/styles.ts`, and `npm run check:docs-data` fails the build when the two diverge. It does not remove the second copy — nothing here could — but it turns a silent drift into a visible error.
