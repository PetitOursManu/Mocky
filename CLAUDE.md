# CLAUDE.md

> **Keep replies short.** Answer, then stop. No preamble, no restating the
> request, no recap of what you just did when the diff already says it, no table
> for two facts. Long replies cost tokens on every turn and bury the one sentence
> that mattered.

Notes for an agent working in this repository. Short on purpose: the real
documentation is in `docs/`, and this file's job is to point at it and to name
the handful of things that are easy to break without noticing.

## What Mocky is

A self-hosted chat-to-UI generator. You describe a screen, a model writes a
React + Tailwind component, and it renders in a sandboxed iframe on an infinite
canvas. **Muse** is the design-intelligence layer on top: a web-inspiration
scraper, an art-direction dossier, and now a quality pass.

Stack: React 18 + Vite + TypeScript on the front, Node + Express on the back.
**Node 22.12+** (`.nvmrc`, `package.json` engines, `node:22-slim` in the
Dockerfile).

## Read these before changing anything

| Document | Why |
|---|---|
| `docs/architecture/invariants.md` | The rules the code refuses to break. Three series: I1–I8 (core), M1–M8 (Muse), Q1–Q5 (quality). Each exists because a specific bug happened. |
| `docs/architecture/overview.md` | How the pieces fit. |
| `docs/adr/001-muse.md` | Why Muse is shaped the way it is. A historical record — do not "correct" it when the code moves on. |
| `docs/DESIGN-SYSTEM.md` | Mocky's own visual language. |

Every document under `docs/` has a French mirror under `docs/fr/`, and the two
READMEs are mirrors as well. **If you change one, change the other.** The UI
strings in `src/i18n/parts/` are also bilingual, and a test fails when the FR
and EN key sets diverge.

## The generation pipeline

Generation runs **in the browser**. The server only proxies the provider call
(`/__provider`), because the API key may live in the user's browser and because
providers do not send permissive CORS headers.

```
prompt → [direction] → [Muse dossier] → [planner] → generateComponent()
       → extractCode + sanitize + guardMotion → screen → Preview iframe
```

- `src/lib/generate.ts` — prompts, `chat()`, extraction. The complete generated
  source first exists at `guardMotion(extractCode(content))`, which appears in
  **five** places: `generateComponent`, `editComponent`, `fixComponent`,
  `polishComponent`, `auditFixComponent`. A post-generation check that only
  hooks the first one misses edits, repairs, polishes and accessibility
  corrections. This note said "three" for an hour after `polishComponent` was
  added — by the person who had just written the note — and said "four" until
  `auditFixComponent` arrived. Count them with grep before trusting the number.
- `src/lib/plan.ts` — the optional planner. Runs only when `usePlanner` is on
  **and** Muse did not run. Also decides the screen's *mode*.
- `src/components/Preview.tsx` — builds the sandboxed `srcDoc`. Invariant-dense;
  read I2, I3 and I5 before touching it.
- `src/components/ProjectView.tsx` — the orchestrator. Large. Every screen
  mutation follows the same conventions: an `AbortController`, a `codeAtStart`
  snapshot re-checked before writing back, and `previousCode` so "Revert" works.

There are three independent correction loops, and they are not interchangeable:

| | Trigger | Prompt | Budget |
|---|---|---|---|
| **Repair** | The iframe reports a render/compile error | `FIX_PROMPT` — "fix ONLY the error, do not restyle" | `MAX_FIX_ATTEMPTS = 2` |
| **Polish** | The user asks for it | `POLISH_PROMPT` — "fix these named findings, change nothing else" | `DEFAULT_MAX_ITERATIONS = 2` |
| **Audit fix** | The user asks for it, from the SEO/a11y panel | `AUDIT_FIX_PROMPT` — "fix the markup, the screen must look identical" | `DEFAULT_MAX_ITERATIONS = 2` |

They share the transport, `runPolishLoop` and the write-back conventions, and
nothing else. Do not merge them. Each one's instruction breaks the other two: a
slop finding *is* a styling problem, so a model told not to restyle hands the
screen back unchanged — while an accessibility pass that restyles has failed
even with every finding gone, because a semantics fix came back as a redesign.

`runPolishLoop` is generic over its report type for exactly this reason: the
four stop conditions are worth having once, and the checks that feed them are
not the same check.

## The quality pass

Checks a generated screen and optionally corrects it. **On demand only** —
right-click a screen → "Polish". Never automatic, so with Muse off the
generation path is byte-identical to what it was (invariant M1).

```
src/lib/quality.ts   checkQuality()  → POST /api/muse/quality, merged with lintSlop
src/lib/polish.ts    runPolishLoop() → check → correct → check, with 4 stop conditions
server/muse/quality/
  detect.js    deterministic rules, via the `impeccable` package
  critique.js  one model call for the rules a regex cannot settle
  catalog.js   those rules, as questions phrased so "true" means clean
  policy.js    what Mocky does with each rule — read this first
  audit.js     5 dimensions × 0–4, health score /20, findings tagged P0–P3
```

Detection runs **server-side** for two reasons: the detector reads `node:fs` at
import so it cannot be bundled for the browser at all, and a megabyte of rule
engine has no business in a bundle whose previews are the product.

Three things that will bite you:

1. **`policy.js` is not optional.** Some detector rules contradict Mocky's own
   generation prompt — `overused-font` fires on Inter, which Mocky's default
   DESIGN.md specifies, and `generate.ts` tells the model that a supplied art
   direction overrides every stylistic rule. Enforcing everything blindly makes
   the correction loop fight the generation prompt and lose. See Q2.
   It governs the **judged** rules too: an id set to `ignore` there is never
   even asked, which is where you go to keep a treatment the judge dislikes.
2. **Progress is measured on rule ids, never line numbers** (Q3). A rewrite that
   fixes nothing still shifts every line.
3. **The score reports its own confidence** (Q4). Source-only analysis cannot
   measure rendered contrast or geometry, and the report says so instead of
   awarding 4/4 for accessibility to a screen nobody checked.
4. **Report what was fixed, not only what is left.** A converged run and a run
   that found nothing both leave `residual` empty, so `PolishOutcome.fixed`
   carries the difference. Reporting only the residue once made a pass that had
   rewritten six things read as a pass that did nothing.

### Attribution

Deterministic detection is built on **[`impeccable`](https://github.com/pbakaus/impeccable)**
by Paul Bakaus, Apache-2.0 — an open-source catalogue of anti-patterns for
machine-written UI, with detectors for 59 of them. Mocky uses the npm package
(one engine, `detectText`) and the public rule catalogue. It does **not** use or
reimplement the project's agentic layer — no skills, no slash-commands, no Live
Mode — and contains none of that code.

The judged rules in `catalog.js` are Mocky's own questions, written for this
pipeline. The audit rubric follows the structure Impeccable documents publicly
(five dimensions, 0–4, P0–P3); the scoring and the confidence model are ours.

## Video export — the feature is called **Motion**

Every string a user reads says Motion; every identifier still says `video`. That
split is deliberate and documented in `docs/video-export.md`: renaming the keys,
the routes and the directories would change nothing anybody reads. Do not "finish"
the rename.

Turns a list of image ids into an .mp4. **The model never writes Remotion code**
— it writes one JSON object validated by `src/lib/video/timeline.ts`, and
hand-written compositions consume it. That is the founding rule, not a phase.

```
src/lib/video/timeline.ts   the zod schema (browser): a five-template union
src/lib/video/theme.ts      the project's direction → the theme a film carries
server/video/timeline.js    the same schema, mirrored for Node — see below
server/video/compose.js     the one model call: it PICKS a composition and fills
                            it in. It never picks the pictures
server/video/config.js      admin settings; the licence key never leaves the server
server/video/queue.js       in-memory queue + atomic JSON journal. No Redis, ever
server/video/worker.js      HTTP client for the render worker
server/video/store.js       the finished file, kept whole. NOT server/videos/
worker/video/               the Remotion worker: separate sub-project, separate image
```

Nine things, and the first one is not negotiable.

1. **Remotion must never enter Mocky's `package.json`, `Dockerfile`, or default
   compose file.** Its licence is free for individuals, non-profits and companies
   up to three employees, and it does not address redistribution inside a
   self-hosted product. Keeping it in `worker/video/` behind
   `profiles: ["video-export"]` is what makes that question *not exist* for
   everyone who never turns the feature on. `tests/video-worker-separation.test.js`
   is what enforces it — the four documents that explain it cannot fail a build.
2. **`server/video/timeline.js` mirrors the TypeScript schema by hand**, because
   `node server/index.js` cannot import a `.ts` file at the 22.12 floor. Same
   deliberate duplication as `server/images/zip.js`. `timeline.test.js` runs a
   corpus through both and requires identical answers, defaults included — edit
   one side alone and the suite fails. There is now a **second** such mirror:
   `worker/video/remotion/contrast.js` copies the WCAG half of
   `src/lib/audit/colors.ts` because a Remotion bundle cannot import TypeScript
   either, and `contrast.test.js` is its corpus.
3. **The worker URL is the third administrator-only bypass of the SSRF guard.**
   Written down in `invariants.md` with the other two. Guarded, the feature had
   no working configuration at all: the worker sits on an internal compose bridge
   and its only address is a private one.
4. **`.strict()` everywhere in the schema.** An unknown key is how a field
   nothing renders gets accepted in silence and the export is reported as a
   success. There is no audio, and a schema that strips unknown keys cannot say
   so.
5. **A finished render lands in `server/video/store.js`, never in the clip
   library.** `server/videos/` cuts *scroll sequences*: `ingest` runs ffmpeg to
   produce up to 150 stills, and everything downstream of its `list()` — the
   Media tab, `VideoPlayer.tsx`, `usage.js` — expects them. A film has none, so
   filing it there would pay for the cutting and then lie to every one of those
   callers. The export store is content-addressed and atomic like its neighbours,
   shares the same `diskBudget`, and refuses **before** writing: a full volume
   fails writes silently everywhere in this repository.

   The corollary, learned the hard way: **a separate store still has to be
   findable.** The hash says what a file contains and nothing about who wanted
   it, so a film carries `projects` — a list, for the reason `owners` is a set —
   plumbed from `POST /render` through the job to `store.put`, and
   `GET /api/video/exports` lists what an account owns. Media has a **third** tab
   for them; do not merge it into the clip tab, and never route a film through
   `VideoPlayer.tsx`.
6. **The schema is a catalogue: a union discriminated on `template`.** Five of
   them, each with its own scene kind and its own bounds. That is how variety
   arrives without the model ever describing its own rendering — a sixth look is
   a hand-written composition and a normal review. A document with **no**
   `template` is a slideshow, because saved drafts and the queue's journal are
   full of them; the test that proves it is the one to keep. The worker refuses
   a template it has no composition for, by name — and it has five, one per
   template, in `worker/video/remotion/`. Their shared arithmetic lives in
   `composition.js` with no React and no Remotion import, because that is the
   only part of a video a test can check; `cueFrames` and `frameBase` are there
   for the same reason as `planTimeline`. The container installs **one** font
   family, so a declared typeface is named first and Liberation Sans follows it.

   The same rule governs how things MOVE. One easing (`easeOutCubic` — linear was
   what made the first version read as generated), one cue rhythm, one kicker,
   one texture, all in `composition.js`: five compositions with five notions of
   "an element arrives" is four of them drifting. A kicker says `sceneLabel`, the
   film's own structure, and **not** a schema field — a surtitle a model writes
   about a film it cannot see is the guessed token `theme.ts` refuses.
7. **The model picks from that catalogue, and picking is not describing.** What
   comes back is one name out of a closed enum, so the variety costs nothing the
   founding rule was protecting. `compose.js` states the mapping from an
   intention to a name (words → `titles`, a phone → `vertical`, a screen →
   `overlay`, something being sold → `product`, otherwise `slideshow`), because a
   model shown five compositions takes the most elaborate one. Every bound on
   those cards is read off `TEMPLATE_LIMITS`/`TEXT_LIMITS` — a floor retyped in a
   prompt drifts from the validator, and the call is already spent when it does.
   The **selection** decides which are offered: four of the five need an
   `imageId`, so an empty one leaves `titles` alone — and a picture-bearing
   template proposed anyway is refused **by naming `titles`**, never with a bare
   no. That is why `/compose` accepts an empty selection at all.
8. **No text in a film is illegible, and arithmetic is what says so.** Two real
   exports shipped a dark green headline on a near-black frame: `theme.ts` emits
   only the tokens a direction *stated*, the rest were filled from a fallback,
   and an ink written for paper met a ground written for a cinema inside an mp4.
   So `resolveTheme` resolves background/ink/surface as a **pair** — a stated
   dark ink gets paper, not the dark default — and then every run of text is
   measured against the surface it is really painted on (`legibleOn`) and
   corrected. Derivation respects the design; measurement makes it safe. The
   floors are the audit's own 4.5/3, the repair tries the theme's own colours
   before black or white, and a run that cannot clear the bar degrades rather
   than failing the export (Q1). `composition.test.js` sweeps all five palettes
   across a dozen real themes.

   The list **ends at `INK_FLOOR`, pure black**, not at the `#101014` the
   compositions prefer. Black and white cross at 4.58:1, so an opaque surface
   always has an answer; a near-black moves that crossing to 4.36:1 and opens a
   band of mid-tone grounds where the search stops a tenth of a point short of an
   ink that was right there. Preferred first, reachable last.

   Decorations are in the sweep too, and they are the two ways this guarantee
   gets undone by accident. An accent run (`accentFirst`) is resolved with the
   veil **locked**: darkening a photograph so a kicker can keep its colour is a
   trade an ornament does not get to make. A background is a **`tint` on the
   surface**, not a layer over it — a glyph on a field of hairlines sits on one of
   two known colours, and the palette measures both, which is why the composition
   paints the texture by reading that same object back. And measuring it is only
   half: the texture is the one layer that cannot be raised, so `texturedGround`
   **drops it** when the bare ground carries every run and the tinted one does
   not. A decoration yields to a word; it never yields for nothing.
9. **The `theme` is attached by the server, never written by the model.** It is
   not in `VideoTimelineSchema` at all, so a model that invents one is refused
   like an `audio` key; `attachTheme` puts it on `RenderTimelineSchema`, on both
   `/compose` and `/render`, and always **after** the model's document has been
   validated. Nothing of it reaches the prompt. It carries only what the
   direction **declared** (`parseDesignSpec.stated`) — a guessed colour burnt
   into a film cannot be seen through — and nothing in it can become CSS: hex
   only, ONE font family name, an integer radius.

## Conventions

- **Comments explain why, not what.** The house style is unusually discursive:
  a comment names the bug that made the rule necessary. Match it. A comment that
  restates the code is worse than no comment.
- **Tests are co-located** (`foo.ts` + `foo.test.ts`), except the cross-cutting
  ones in `tests/`. `npm test` runs everything; `npx tsc --noEmit` typechecks.
- **No native dependencies.** The entire server store is JSON files written
  atomically. This decided real things — it is why SQLite was rejected for
  Muse's persistence. Puppeteer arrives as an *optional* dependency of
  `impeccable`; `.puppeteerrc.cjs` stops the Chrome download and the Docker
  runtime stage passes `--omit=optional`. Do **not** put `omit=optional` in an
  `.npmrc`: optional dependencies are how npm ships per-platform native
  binaries, so it also strips `@rolldown/binding-*` and breaks the build.
- **Nothing in `public/vendor/` is fetched from a CDN**, and every file there is
  pinned by SHA-256 in `public/vendor/VENDOR.md`. `npm run check:vendor`
  verifies it.
- **Degrade, never fail.** The pattern is everywhere: catch, add a soft notice,
  continue without that contribution. M3 for Muse, Q1 for quality.

## Before you finish

```bash
npx tsc --noEmit && npm test && npm run build
```
