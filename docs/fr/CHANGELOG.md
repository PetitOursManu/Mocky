# Journal des modifications

[English](../CHANGELOG.md) · **Français**

> **Pourquoi c’est ainsi —** Cette page est produite à partir de l’historique Git par `npm run changelog`. Les messages de commit de ce dépôt sont écrits en français : ils sont reproduits **tels quels**, sans traduction, parce qu’un intitulé traduit posé à côté d’une empreinte renvoie vers un commit dont le texte dit autre chose — et le lecteur ne peut alors chercher ni l’un ni l’autre.

## août 2026

**Fonctionnalités**

| Portée | Modification | Commit |
| --- | --- | --- |
| `header` | la marque à côté du nom, et la baseline qui lui cède la place | `9b71bc0` |
| `mobile` | des barres qui tiennent, des cibles qu'on peut viser, un canevas qui cède | `8cf0509` |
| `design` | le DESIGN.md devient une fiche, et se modifie | `2d8f0ba` |
| `canvas` | cinq retouches, dont deux vrais bugs | `93e8f8c` |
| `quality` | détecter, corriger, noter — et dire ce qui a changé | `2ad2f2a` |
| `plan` | le mode dit ce que le visiteur vient faire | `28b84e8` |
| `generate` | le nom du produit et son logo traversent les écrans | `53b517e` |
| `design` | une seule direction par projet, et un interrupteur pour en changer | `3d776d1` |
| `design` | une direction par projet — la fondation | `ad6b439` |
| `liens` | « Proposer des liens » — la fonctionnalité est visible | `2f69b10` |
| `liens` | l'aperçu sait maintenant lister ce qu'on peut lier | `ada0457` |
| `liens` | deviner quel bouton mène à quel écran | `7de45d9` |
| `demo` | un parcours qui n'exige pas d'avoir tout relié à la main | `91b73b0` |
| `video` | 24 fps et 1440 px, et un bouton pour redécouper l'existant | `277fe92` |
| `media` | les séquences se lisent enfin | `dc0334c` |
| `projets` | cocher plusieurs projets, et les ranger dans des dossiers | `9444c95` |
| `capture` | la clé API n'est plus à portée du code généré | `d777bdf` |
| `app` | du travail qui ne se perd plus, et une bibliothèque de designs | `976323a` |
| `server` | de quoi tenir sur le web public, et huit défauts qui mordaient | `6680fde` |
| — | un bouton Docs dans l'app, et le site de doc habillé comme Mocky | `a443d2d` |
| `motion` | cinq presets de plus, et deux composants retrouvés | `e7c851b` |
| `canvas` | les animations se règlent écran par écran, et le composer respire | `836f3ed` |
| `motion` | l'interrupteur d'animations, et le filet anti-contournement | `e23b0f3` |
| `ui` | brancher la vidéo, le média et le dossier au reste de l'application | `4323e1d` |
| `motion` | des animations par presets fermés, adossées à Motion | `71c8cc1` |
| `muse` | écrire le dossier de design À PARTIR du média de l'utilisateur | `022252d` |
| `media` | la page Média, et l'import de ses propres images et vidéos | `931a828` |
| `video` | une séquence vidéo que le visiteur fait défiler | `c56578f` |

**Correctifs**

| Portée | Modification | Commit |
| --- | --- | --- |
| `docs` | le sélecteur de thème retrouve le bas du menu | `b690b88` |
| `mobile` | la liste des projets cesse d'élargir la page | `dc7d301` |
| `deps` | fast-uri et hono, corrigés là où ils étaient déjà permis | `764e3d8` |
| `design` | les vignettes viennent de la palette, plus d'un bleu nuit par défaut | `85c16aa` |
| `capabilities` | charger ce que le code utilise, pas seulement ce que le prompt annonçait | `3a802fb` |
| `liens` | choisir l'écran dans le panneau, pas sur le canevas | `c0695cf` |
| `images` | la borne sur le prompt passait sous le trafic de Mocky | `808f13e` |
| `aperçu` | le chien de garde s'armait sur le code, pas sur le document | `f26a2e8` |
| `demo` | rendre le fil principal à la démo, et un hook remis à sa place | `269e892` |
| `demo` | l'aperçu s'accusait d'un dépassement qu'il n'avait pas | `7072db6` |
| `demo` | ne plus photographier les écrans pendant qu'une démo tourne | `b32a6cf` |
| `app` | le lien Docs passe dans la manchette | `72fbaa6` |
| `site` | versionner les ressources pour que le cache cesse de mentir | `6875f61` |
| `site` | le sélecteur de langue sort du sommaire | `db74b90` |
| `site` | l'onglet s'appelle « Doc Mocky », et la favicon est déclarée proprement | `6c51e41` |
| `motion` | couper les animations fige vraiment l'écran, et le menu montre les choix | `6cf9cec` |
| `motion` | l'interrupteur manquait au premier écran, et n'agissait pas sur l'existant | `b10128e` |
| `generate` | une balise de fin tronquée ne doit plus finir dans le code | `ab71f5d` |

**Documentation**

| Portée | Modification | Commit |
| --- | --- | --- |
| `site` | la colonne s'élargit, la mesure se resserre | `5e10a3b` |
| — | un changelog, des pages vivantes, et ce qui manquait | `8e012c8` |
| — | CLAUDE.md, la série Q, et ce qu'on doit à Impeccable | `b055b9c` |
| — | la direction par projet, l'identité qui voyage, et deux phrases devenues fausses | `29b62a0` |
| — | les jumeaux de langue, et le « pourquoi » sous chaque titre | `f014d33` |
| — | des images nettes, en anglais, et qui chargent aussi en français | `9e31856` |
| — | six captures d'écran, et quatre affirmations remises d'aplomb | `352b61d` |
| `site` | un drapeau par langue, et l'icône de Mocky sur l'onglet | `404ee87` |
| — | l'anglais par défaut, le français réécrit, et plus aucun schéma ASCII | `f2b361d` |
| — | la documentation du projet, et une coquille Docsify pour la lire | `1e45992` |
| `readme` | les animations, la page Média, et trois affirmations devenues fausses | `681e7a3` |

**Maintenance**

| Portée | Modification | Commit |
| --- | --- | --- |
| `deps` | vite 7, et l'arbre de dépendances rétrécit | `59d5633` |
| — | Node 22.12, et un détecteur qui n'emporte pas Chrome avec lui | `ca33975` |
| — | repasser la capture à html2canvas | `ce0392b` |
| — | rendre Preview, DemoPlayer et ProjectView à l'état où tout marchait | `cd98f63` |
| `dossiers` | les dossiers deviennent les rubriques du sommaire | `4cd63d3` |

## juillet 2026

**Fonctionnalités**

| Portée | Modification | Commit |
| --- | --- | --- |
| `ui` | page d'accueil en registre, miniatures, loader Mocky, mode Interact | `faa5403` |
| `account` | gestion des mots de passe, côté utilisateur et côté admin | `72951c3` |
| `i18n` | interface bilingue français / anglais | `64530c9` |
| `design` | editorial redesign — tokens, primitives, newspaper typography | `0fc90e1` |
| `muse` | separate image models for inspiration and for content | `82da4ef` |
| `admin` | add fal.ai as a text provider (usable for the inspiration profile) | `d43a4c5` |
| `admin` | separate models for generation and for inspiration | `cc8ed50` |
| `muse` | "both" image mode, image card on the canvas, full-size viewer | `11e52c8` |
| `muse` | image as content OR inspiration, gated by a real vision probe | `603ddb5` |
| `canvas` | show a screen's original prompt, and name projects from it | `c0cbb96` |
| `text` | admin-configurable LLM provider (OpenAI, OpenRouter, compatible) | `3b8128b` |
| `muse` | add a top-level "Images" page for the generated-image library | `d81740c` |
| `images` | add fal.ai as an image provider | `51faf2a` |
| `images` | admin-configurable image generation provider | `fb95027` |
| `muse` | Phase 5 — anti-slop lint, distinctiveness pass, docs & Docker | `6ba6537` |
| `muse` | Phase 4b — Bibliothèque (image library browser) + pin-to-run | `38546e5` |
| `muse` | Phase 4 core — ✨ toggle, dossier-driven generation, moodboard | `e14dafb` |
| `muse` | Phase 3 — Inspiration Engine (Discover → Distill → Dossier) | `1bf7578` |
| `muse` | Phase 2 — image providers, store & global Image Library | `dca079e` |
| `muse` | Phase 1 — MCP host core + inspiration fetch (ADR 001) | `28324b5` |
| `preview` | show a calm "Repairing…" state while auto-fix runs, not the red error | `9d2d2b6` |
| `canvas` | live Design-system frame with click-to-recolor tokens (Lot D.2) | `16373b0` |
| `welcome` | first-run style picker sets DESIGN.md before the first screen (Lot D.1) | `01ba132` |
| `canvas` | animated multicolor ring around a frame while it regenerates | `afcfaf7` |
| `modify` | quick text + recolor no-code edits; outline-only pick; freeze-on-regenerate (Lot C.2) | `54acbb2` |
| `canvas` | no-code "Modify" mode — click an element, describe a change (Lot C.1) | `4c674a6` |
| `canvas` | add animations to a screen at subtle/moderate/rich levels (Lot B) | `00e7ddd` |
| `canvas` | per-screen context menu (regenerate, formats, code, …) | `7d47a74` |
| `design` | 2x-larger preview cards + background-color picker | `3f1d121` |
| `design` | scalable previews + hover states + larger-preview modal | `8a8d3c4` |
| `design` | richer mini-dashboard previews + per-style accent variants | `f4f9f65` |
| `design` | light/dark toggle for style presets | `199e5bb` |
| `fix` | give the auto-repair a bounded second attempt | `257a54f` |
| `project` | pin a screen as shared-layout reference | `647d621` |
| `export` | runnable Vite project export with DESIGN.md theming | `9965978` |
| `plan` | cheap pre-generation planner stage | `485e157` |
| — | Docker deployment (Dockerfile, docker-compose, .env.example) | `f1414c1` |
| — | motion snippet-pack — CSS-only, no framer-motion | `0179155` |
| — | runtime capability registry (daisyui, motion, lucide, recharts, magicui) | `e313e6e` |
| — | sentinel protocol for streaming + num_ctx fix + vitest tests | `25b41aa` |
| — | bigger screen icons + Generating overlay during streaming | `3300e20` |
| — | add 7 Tilda design styles + bigger visual previews | `442b50d` |
| — | revert button, visual design previews, back button, 4 new designs | `5338c37` |
| — | auto-retry broken components — send code + error to model for fix | `1f82271` |
| — | stream generated code into preview live + pre-validate JSX + syntax check prompt | `a10b32e` |
| — | Dashy SSO, security hardening, performance optimizations, and production-ready UI prompts | `ec0505a` |

**Correctifs**

| Portée | Modification | Commit |
| --- | --- | --- |
| `preview` | un lien d’ancre ne doit plus emporter la maquette | `bd5ef41` |
| `muse` | balayage de gauche à droite, et deux extrémités propres | `d5fb3b4` |
| `muse` | montrer l’animation à ceux qui ont déjà essayé Muse | `852e62c` |
| `sync` | mettre fin à la boucle de rechargement infinie | `ed46575` |
| `muse` | les écrans suivent enfin la direction artistique | `c5399e1` |
| `preview` | vendoriser daisyUI, et sortir la capture du timeout | `9323d72` |
| `sync` | stop losing work | `eacc4a6` |
| `security` | close the anonymous routes, harden the SSRF guard, pin the vendored bundles | `6c63fc4` |
| `muse` | generate the image again, and show it on the canvas | `9aae371` |
| `images` | image first, scroll for the prompt | `60a19b0` |
| `admin` | stop calling two different settings "Inspiration Muse" | `f60ced2` |
| `admin` | explain when an image model id is pasted in a text model field | `c8affcb` |
| `vision` | probe with a real 256px image, not a 1×1 pixel | `6761308` |
| `generate` | report a truncated model response instead of a syntax error | `54774cc` |
| `text` | don't report an empty model reply as a successful test | `35cc372` |
| `images` | use fal's queue API and stop assuming a "fal-ai/" prefix | `8c09122` |
| `images` | make fal failures diagnosable instead of an opaque 502 | `b673d7b` |
| `muse` | make the Dossier tolerant of real model output (drift + truncation) | `b05a8b2` |
| `generate` | give the auto-fixer the capability list so it can repair React #130 | `e825b2f` |
| `icons` | add social/brand + contact icons to prevent footer React #130 | `5e1f9f4` |
| `modify` | precise element pick + freeze-on-edit; clearer selection | `12926d8` |
| `modify` | anchor edits on the element's class string; design + hex recolor | `71e554f` |
| `charts` | center DonutChart total; stop model duplicating it | `471ccfa` |
| `generate` | forbid redeclaring ANY prelude component, not just Icon | `18f2cf1` |
| `charts` | stop BarChart/LineChart distorting dots and labels | `920ede9` |
| `demo` | inject capability prelude in Demo mode | `4bc1c1e` |
| `icons` | add common auth/UI icons + forbid redeclaring Icon | `dd99416` |
| `preview` | report async render errors via a React error boundary | `f33b4bb` |
| `generate` | ban thinking/meta comments in generated code | `425b403` |
| `capabilities` | remove unused lucide cdn-script | `9cac25d` |
| `generate` | harden prompt against invalid dynamic JSX tags | `2c83bd5` |
| `server` | decouple backend port from generic PORT | `390a958` |
| `preview` | repair blob-injection rendering | `0d577ef` |
| — | sanitize invalid Unicode + Blob URL injection + line-level diagnostics | `876a50b` |
| — | one source of truth for capability names + render error reporting | `afd998a` |
| — | merge magicui into motion pack, eliminate duplicate declarations | `eb54aee` |
| — | add ChevronLeft + MoreHorizontal icons, strokeWidth prop, match spec | `ad7056a` |
| — | silence streaming console noise + icons snippet-pack to ban raw SVG paths | `853e76a` |
| — | remove false-positive prelude guard from iframe | `dbd2b04` |
| — | snippet-pack atomicity — explicit exports[], no source parsing | `ef563b6` |
| — | snippet-pack atomicity — inject ALL components, deduplicate sources | `0527e36` |
| — | remove crossorigin from iframe scripts — use need() guards instead | `98cb4bc` |
| — | crossorigin on scripts, readiness guard, charts snippet-pack, dev logging | `133ca7d` |
| — | robust import stripping + registry-driven global hoisting + prompt tightening | `a730de5` |
| — | replace num_predict:-1 with 8192 + readable error parsing | `0e47ace` |
| `generate` | preserve 'function' keyword in toPreviewModule | `37c8025` |
| `retry` | suppress auto-retry during streaming + ignore stale errors | `1711218` |
| `preview` | debounce Babel validation to prevent streaming races | `7a9dcc5` |
| `proxy` | only stream when request asks for stream:true, buffer regular JSON | `ea71b5b` |
| `proxy` | stream upstream response body through instead of buffering | `35ee8ef` |
| `preview` | correct createElement syntax in injected script.textContent | `51fe414` |
| `preview` | inject compiled JS via script.textContent instead of new Function | `2be611c` |
| `capture` | fallback to Babel-in-iframe when compiled JS fails | `0f047d7` |
| `preview` | compile JSX inside sandboxed iframe using Babel CDN | `8a39e98` |
| — | use proper UTF-8 base64 for iframe code injection | `ef832cb` |
| — | robust iframe code embedding + enforce authentication | `8d17842` |
| — | encode compiled JS as base64 before iframe injection | `0c922f6` |

**Documentation**

| Portée | Modification | Commit |
| --- | --- | --- |
| `readme` | document MOCKY_PORT env var | `869a4f2` |
| — | comprehensive README with Docker deployment guide | `99e3f15` |

**Maintenance**

| Portée | Modification | Commit |
| --- | --- | --- |
| — | installation, ops and docs | `2dcf9ae` |
| `canvas` | thicker, brighter regen ring for visibility | `b1f9c80` |
| — | add GitHub Actions workflow (build/test/smoke + docker build) | `3409487` |
| `capabilities` | dead-code sweep + registry invariant tests | `c728ba8` |
| `preview` | remove parent-side Babel validation, simplify rendering | `f07cd32` |
| — | Add self-hosted accounts backend + admin user management | `b788f3a` |
| — | Add screenshot annotations attached to (vision) generations | `7ae7619` |
| — | Initial commit: Mocky — self-hosted chat-to-UI generator | `a81de92` |
