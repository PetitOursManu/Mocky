# Mocky

Mocky is a self-hosted screen generator. You describe an interface in plain
language and get a real **React + Tailwind** component, compiled and rendered live
on an infinite canvas.

These pages describe how the project is built and why the non-obvious decisions
were made. They assume you know React and TypeScript.

> The repository `README.md` is the product overview: what Mocky does and how to
> install it quickly. This documentation covers the internals.

![A project canvas: two generated screens, the mode toolbar, the composer](assets/13-canvas-project.png)

*A project open. Screens sit side by side on an infinite canvas; the bar at the top switches modes, and the composer at the bottom describes the next screen.*

---

## The stack

| Layer | What it is |
|---|---|
| Front end | React 18, TypeScript, Vite, Tailwind CSS |
| Back end | Node ≥ 22.12 with Express. JSON files on disk. No database, no native dependencies |
| Preview | An iframe sandboxed to an opaque origin. React, ReactDOM, Babel and Tailwind are vendored locally. JSX is compiled inside the iframe |
| Models | Mocky always speaks the Ollama dialect internally. A proxy translates to OpenAI-compatible APIs |
| External binary | `ffmpeg`, used only for scroll-driven video |
| Optional separate service | The Remotion render worker in `worker/video/`, behind the `video-export` compose profile. Absent from the default image, for [licensing reasons](video-export.md) |

---

## The one thing to know first

**The generation pipeline runs in the browser, not on the server.**

Capability selection, the planner, generation, editing, auto-repair and
persistence all live in `src/lib/`. The back end is deliberately thin: it serves
static files, handles accounts, syncs one JSON file per user, and proxies model
requests.

There is one exception. **Muse** has to spawn processes, drive a headless browser
and write files, so its stages live in `server/muse/`. It is the project's first
real server-side pipeline, and [ADR 001](adr/001-muse.md) explains the reasoning.

---

## Where to start

| If you want to… | Read |
|---|---|
| Install Mocky and configure a model | [Getting started](getting-started.md) |
| Understand the capability registry, the planner and the sandbox | [Architecture overview](architecture/overview.md) |
| Know which rules the code refuses to break, and why | [Invariants](architecture/invariants.md) |
| See what Muse adds to a generation | [Muse overview](muse/overview.md) |
| Follow Discover, Distill and Dossier in detail | [Inspiration engine](muse/inspiration-engine.md) |
| Understand the animation system | [Animations](muse/animations.md) |
| Check a generated screen, and correct what the check finds | [Quality pass](quality.md) |
| Turn a set of images into an `.mp4`, and know why its renderer ships separately | [Motion](video-export.md) |
| Deploy Mocky | [Deployment](deployment.md) |

---

## What happens when you generate a screen

Seven steps. Steps 1 and 3 are optional.

| # | Step | Where | Notes |
|---|---|---|---|
| 1 | **Muse** builds a design dossier | Server, via `POST /api/muse/dossier` | Optional. Produces an art direction, real copy and a generated image |
| 2 | **`selectCapabilities()`** picks a shortlist | Browser | Deterministic keyword matching. No model call |
| 3 | **`planScreen()`** refines the shortlist | Browser | Optional. Returns `null` on any failure, and the shortlist is used unchanged |
| 4 | **`applyAnimationMode()`** applies your motion preference | Browser | Three states: `auto`, `on`, `off` |
| 5 | **`generateComponent()`** streams the component | Browser, via `POST /__provider/api/chat` | NDJSON stream, sentinel-delimited output |
| 6 | **`stripForbiddenMotion()`** removes raw Motion code | Browser | Babel AST walk, never a regular expression |
| 7 | **`<Preview>`** renders it | Browser | Sandboxed iframe with a strict CSP |

Each step is covered in the [architecture overview](architecture/overview.md).

---

## Four properties worth knowing up front

They explain a lot of the code you will read.

**Muse off means nothing changes.** With the toggle off, the request sent to the
model is byte-for-byte what it was before Muse existed. The dossier enters through
`extraSystem`, the same parameter `DESIGN.md` already used.

**No optional step may block.** The planner resolves to `null` on any failure. A
Muse stage that fails degrades and the generation continues.

**A quality run can never fail a generation.** That is the rule above again, and
it matters more here because of where the pass sits. Muse runs *before* a
generation, so a Muse failure is a screen built with less; the quality pass runs
*after* one that already succeeded, on a screen the user is looking at. So every
stage degrades and returns a report, and none of them throws at the caller: a
failure to **check** a screen must never look like a failure to **make** one.
Invariant Q1.

**Failure is static, never broken.** An unknown animation preset renders a plain
element. A missing library falls back to CSS. A retired capability is still
injected for the screens that use it.

---

## How this documentation is served

The Markdown files are fetched live from `docs/` on the `main` branch. The page
you are reading is the Markdown file itself, with no build step. Publishing a
correction means pushing a commit.

The viewer is seven static files in `docs-site/` — four written for the project,
three vendored copies of Docsify. It has no npm dependencies and loads nothing
from a CDN. See [Deployment](deployment.md), which lists them one by one.

To read the site locally before publishing a change to it:

```bash
npm run docs
```

That serves `docs-site/` on `http://127.0.0.1:4173`. The prose still comes from
GitHub, so what you preview is the real site at its real length — including a
sidebar long enough to scroll, which is the condition under which its layout is
worth checking. Having no local preview at all is how the theme switch came to
spend a while sitting in the middle of the menu on every narrow screen.

**Ces pages existent aussi en français : [documentation française](fr/README.md).**

---

## Other documents in this repository

These predate this documentation and remain authoritative on their subjects.
Each of the four now exists in both languages.

| Document | Subject | English | Français |
|---|---|---|---|
| Repository README | The product overview: what Mocky does, and how to install it quickly | `README.md` | `README.fr.md` |
| ADR 001 — Muse | The full architecture decision record, including the first written statement of the eight original invariants | [001-muse.md](adr/001-muse.md) | [001-muse.fr.md](adr/001-muse.fr.md) |
| Design system | Mocky's own interface tokens, the Papier and Encre themes, the UI primitives. Not to be confused with the `DESIGN.md` a user supplies for generated screens | [DESIGN-SYSTEM.en.md](DESIGN-SYSTEM.en.md) | [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) |
| Audit 2026-07 | The multi-agent audit and its roadmap, most of which has since been applied | [AUDIT-2026-07.en.md](AUDIT-2026-07.en.md) | [AUDIT-2026-07.md](AUDIT-2026-07.md) |

Each of the eight files carries a language switch on its first useful line, and
`tests/docs-parity.test.js` holds the pairs together: the same number of
headings, the same levels in the same order, one "why" block under each of them,
and never a block in the other language.

They used to exist in one language each, and that was defended as deliberate —
an ADR is a dated record, so translating it invites two versions that disagree.
What the argument missed is that the interface had already been through the
identical failure: a single row of buttons reading "Rename", "Voir le prompt qui
a créé cet écran", "More options", "Delete screen". A French design system, an
English ADR, a French audit and an English README are that row spread over four
files, with no way to tell which reader each was written for. The fix is the one
`src/i18n` had already found — a complete file per language, kept in step by a
test.

Which is why the filenames read backwards next to the rest of `docs/`, where the
bare path is English and `fr/` holds the translation. Here each document kept the
path and the language it already had and gained a twin suffixed with the other
one, so `DESIGN-SYSTEM.md` is the **French** page and `DESIGN-SYSTEM.en.md` the
English; the other way round, `adr/001-muse.md` is the **English** page and
`adr/001-muse.fr.md` the French. Renaming them would break the `DOCS` array in
the parity test and every inbound link, for a symmetry no reader ever asked for.
