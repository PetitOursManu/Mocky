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
src/lib/video/timeline.ts   the zod schema (browser): a six-template union, and
                            the block catalogue the sixth one is made of
src/lib/video/theme.ts      the project's direction → the theme a film carries
server/video/timeline.js    the same schema, mirrored for Node — see below
server/video/compose.js     the one model call: it COMPOSES a scene out of the
                            block catalogue. It never picks the pictures
server/video/config.js      admin settings; the licence key never leaves the server
server/video/queue.js       in-memory queue + atomic JSON journal. No Redis, ever
server/video/worker.js      HTTP client for the render worker
server/video/store.js       the finished file, kept whole. NOT server/videos/
worker/video/               the Remotion worker: separate sub-project, separate image
worker/video/remotion/blocks/   one component per block kind, plus the registry
```

Ten things, and the first one is not negotiable.

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

   And a **third**, in three copies rather than two: the render deadline, in
   `server/video/queue.js`, `worker/video/server.js` and
   `src/lib/video/timeline.ts`, held together by
   `tests/video-render-budget.test.js`. It is duration-scaled and not flat
   because rendering 1080p in a headless browser costs about four times real
   time — a flat 120 s refused every film over ~28 s, which the schema accepts
   and the panel queues. The worker's copy sits 10 s lower so it gives up first
   and its message names the machine.
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
6. **The schema is a catalogue: a union discriminated on `template`.** Six of
   them, each with its own scene kind and its own bounds. That is how variety
   arrives without the model ever describing its own rendering — a new look is
   a hand-written composition and a normal review. A document with **no**
   `template` is a slideshow, because saved drafts and the queue's journal are
   full of them; the test that proves it is the one to keep. The worker refuses
   a template it has no composition for, by name — and it has one per template,
   in `worker/video/remotion/`. Their shared arithmetic lives in
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

   **A film in which nothing moves must not be producible by accident**, and one
   was: `kenBurns` defaulted to `static`, an optional field is one a model omits,
   the compose prompt called `static` "the calm choice", and `overlay` had no
   movement field at all. So the defaults are moves (`DEFAULT_KEN_BURNS`,
   `DEFAULT_OVERLAY_MOVE`), `static` stays in the enum as something a document
   ASKS for, and the whole motion of all five templates is `sceneMotion` in
   `composition.js` — the `.jsx` files read it, which is what lets
   `tests/video-motion.test.js` prove by arithmetic that no scene's last frame
   equals its first on a document with nothing optional filled in. A term is
   reported only when the composition draws it: a `caption` progress on a scene
   with no caption is a number that moves while the frame does not. The kicker is
   the case that catches people — it exists only when the FILM has several scenes,
   so `planTimeline` puts `sceneLabel` on the entry and both the motion and the
   composition read that one value.

   `overlay` is the case worth understanding, because "no camera move here" was
   read as "nothing moves". The rule is about AMPLITUDE. A pan spends 4% of travel
   on a 12% overscale — an eighth of the interface cropped, a twentieth sliding
   past; `move` spends 1.2% on 3%, which stays inside the margin, so every pixel
   visible at rest is visible on every frame. That is why it has no `still`.
7. **The model composes from that catalogue, and naming is not describing.** What
   comes back is a name out of a closed enum — a ground, a block, an anchor — so
   the variety costs nothing the founding rule was protecting. `compose.js` no
   longer offers a menu of layouts: the ordinary call offers `composed` alone and
   the prompt is the manual for the blocks, three sentences per block of which the
   third says how it FAILS, because a model shown twenty-seven blocks uses
   twenty-seven of them. The five stay reachable by NAME, one card and no blocks,
   for a caller that has a form for one.
   Every bound in that prompt is READ from the schema — `signature()` walks the
   zod object and prints `≤70`, `display|title|subtitle = title` — and the same
   walk builds the decoder hint, so the two cannot disagree. A floor retyped in a
   prompt drifts from the validator and the call is already spent when it does,
   which is why the suite checks both directions: the printed bounds are
   `BLOCK_LIMITS`'s own, and no line of prose in the catalogue contains a digit.
   The **selection** decides what is offered: three blocks and one ground need a
   picture (how many is read off `min()`), so an empty one leaves twenty-one
   blocks — and a picture-bearing film proposed anyway is refused **by naming what
   is still possible**, never with a bare no. That is why `/compose` accepts an
   empty selection at all.
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
   validated. Nothing of it reaches the prompt. It carries only what somebody
   **declared** — a guessed colour burnt into a film cannot be seen through —
   and nothing in it can become CSS: hex only, ONE font family name, an integer
   radius.

   **And "declared" has two sources, in that order: the BRIEF, then the
   dossier.** The distinction the rule was always making is *the user stated it*
   versus *the model guessed it*, not brief versus direction — a brief that says
   "fond noir" is a statement by the same person the DESIGN.md came from, made
   more recently and about this film, so it wins **token by token**
   (`mergeFilmTheme`): asking for one colour must not cost the project's
   typefaces. `briefTheme.ts` turns the prose into the `- Label: #hex` grammar
   `designTokens.ts` was written for and hands it to `themeFromDesign`, so role
   resolution, the hex charset and `parseDesignSpec.stated` stay one
   implementation. Three things keep it a reading rather than a guess: a colour
   is taken only when the brief also says what it is FOR (a role word within
   three words, or the `X sur Y` idiom) — "en rouge et noir" yields **nothing**,
   because which of the two is the ground is exactly the unseeable guess; the
   named-colour table is closed and its hexes are chosen once in code, like
   `THEME_FALLBACK`'s; and the panel PRINTS which roles it understood, because a
   reading nobody is shown cannot be told apart from a request that was ignored.
   A brief's ground meeting a dossier's ink is safe rather than lucky — every run
   is still measured by rule 8 and degraded until it can be read.
10. **The sixth template is not a sixth look: `composed` is a stack of BLOCKS.**
    A scene is a background plus one to eight typed layers, the model picks the
    blocks, their order, their zone and their parameters, and the variety becomes
    combinatorial instead of a choice among five. It does not reopen rule 1 and it
    is worth checking that it does not: every `kind` is a name out of a closed
    enum of twenty-seven, every one is a component in
    `worker/video/remotion/blocks/`, and every field is a bounded integer, a
    closed enum or a `line(n)` — no colour, no font, no CSS unit, no coordinate.

    Four things to know before touching it:

    - **`VIDEO_TEMPLATES` and `EDITABLE_TEMPLATES` are no longer the same list.**
      The schema, the worker, `PALETTES` and `MOTIONS` are keyed on the first
      (six); the panel's selector, `draft.ts`'s flat record and the compose
      catalogue on the second (five). `composed` has no row shape, deliberately —
      it is the entry whose whole purpose is that nobody chooses a layout.
    - **`anchor` is a zone and `enter` is a rank**, not a pixel and not a delay.
      Blocks sharing a zone stack; blocks sharing a rank arrive together; an
      absent rank means the position it was written in, because zero would make
      every silent document a pile (rule 6's lesson, again).
    - **The zone becomes a box in `composedLayout`, never in the `.jsx`** — the
      same reason the motion is there. A `padding: '6%'` draws a plausible frame
      and cannot be asked whether anything crossed it, and it was wrong twice: a
      CSS percentage resolves against the WIDTH on all four sides, and 6% is a
      broadcast margin on the one ratio that exists to be posted (9:16 keeps the
      feed's own bands, `VERTICAL_SAFE_*`). A row is split among the columns that
      are USED and a band among the rows that are, because `anchor` defaults to
      `center` and a fixed third of a 16:9 frame is five characters of display
      type on a line and 295 px of height for the whole scene.

      **And the margin includes the DRIFT.** The boxes tiled the safe area
      exactly while the whole stack translates by `±COMPOSED_BLOCK_DRIFT/2 × base`
      across a scene, so the top band crossed the safe top on the last frame of
      every one of them — 8.6 px, found by measuring the ink of a rendered corpus
      rather than by reading. `composedLayout` lays out in `composedFrame`, the
      safe area less `driftRoom(base)` on each of those two edges;
      `composedSafeArea` stays the PROMISE, so "the boxes are inside the frame"
      and "the frame plus the drift is inside the promise" are two sentences a
      test can say separately. Same trade `overlay` makes with its amplitude.

      **And the drift is not the whole movement.** The same defect one amplitude
      over, on a witness with no 3D block in it: `imageFrame` over `dateStamp` on
      9:16, and the stamp's ink under the safe bottom on every frame it was still
      arriving on — every entrance in this catalogue comes from BELOW, 26 px there
      against the drift's 9. `BLOCK_ENTER_TRAVEL` is the amplitude as a table,
      because five families measure an arrival against different things (a body
      line, the run's own size, the card's own box), and it is a MIRROR of
      constants under `blocks/` — `composition.js` cannot import a block, since
      `blocks/media.js` imports it — held row by row by `composition.test.js`. The
      room comes off the GRID and not off one band: taken out of the bottom band
      alone a 105 px band paid a quarter of itself, taken off the grid it is 2% of
      the frame. Only the last used band is measured (the only one ending on the
      frame's bottom) and only with no foot reserved; a `full` zone pays its own,
      off its own box. `funTitle` is deliberately absent: it travels UP and bought
      the room in its own appetite, which is the better fix and the block's.
    - **A block inhabits the box it is given, and that box is its OWN.** The rule
      is at the top of `composition.js`; six real exports are why. A block drew a
      fixed fraction of the FRAME — `base * 0.18` for an `equalizer` whether it
      was anchored `center` or `full` — so every scene was a small element
      floating in a large void, which is the "rudimentary" the user kept naming.
      Three pieces, and none of them is optional: `composedLayout` publishes one
      box per block (`zone.layers[i].box`), divided by `BLOCK_APPETITE` — the one
      weight table, in units of the body type size, because a title wants height
      and a rule wants almost none; `TYPE_ROLES` + `solveTypeUnit` are the one
      type scale, solved per STACK against its zone, which is what stops a
      `counter` from crushing the `heading` beside it (four fractions of `base`
      decided by four authors is what did); and `blockExtent` is what a block
      draws in a box, pure, so `composition.test.js` can prove that doubling a box
      doubles the drawing and that the content fills `BOX_FILL_FLOOR` of it.
      The only reads of the frame left are the three `CONSTANT_METRICS` — a
      hairline, a radius, the grid's gutters — each bounded at a quarter of its
      box, by ONE `constantMetric` in `composition.js`: it was three, written in
      parallel from one paragraph, and the three disagreed on the degenerate box
      with a test pinning one of the answers. `MEAN_GLYPH_EM` is not a new number:
      it is the constant `verticalCaptionSize` was calibrated on, now written down
      once and tested.

      **A role is a notion of the SCENE, and a field is part of the scene.** Per
      stack was the right denominator and the wrong scope: a `kicker` alone in its
      column was sized against a column nothing else was in and came out three
      times the `heading` beside it. `harmoniseUnits` bounds a stack by the scene's
      own order of roles — an INEQUALITY, never a shared unit, because a narrow
      column must still be allowed to compose smaller, and a scene-wide unit is the
      smallest zone's answer imposed on the frame. It compares a stack with other
      stacks only: inside one, "as large as its zone allows" is the guarantee the
      boxes were written to give. And the collapse that hands a lone block the
      whole safe area may only drop a track that is EMPTY, which a block anchored
      `full` is exactly what stops being true — so a field claims every band (and
      no column: a height sets a type size, a width sets a measure). A field alone
      on a scene still takes the frame.

      **Bounding the drawn SIZE was half of it**, and the next ten exports showed
      the other half. Two runs of one role were never compared, so a `logoType` in
      a corner came back at 140 px beside a 41 px `heading`; and an inferior role
      was allowed to be exactly as large as a superior one, so a surtitle matched
      its headline's cap height — `TYPE_ROLES`'s own sentence says why that is not
      the order but the collapse of it. There are two bounds now: the ORDER, on the
      drawn size, for a strictly superior role (a superior run held back by its own
      measure still draws what it draws), and the SCALE, on the UNIT, for a role at
      least as high. Two clauses hang off it — a **field's unit is the ceiling for
      everything laid on it**, because a `full` block belongs to no band and leaves
      a cell zone with nothing to be compared with; and the lowering stops at
      `BOLD_LARGE_PX`, because past that bar `palette.accent`'s 3:1 floor is not
      licensed and a cap that crosses it has taken away the ink's licence rather
      than made a scene quieter.

      **The bands are divided by appetite too**, which is `stackIn`'s rule one
      level up and what makes the above a tidy-up rather than a rescue: every zone
      then reads the same unit by construction. And the field tier of
      `BLOCK_APPETITE` is what a field is worth when it IS the scene — twenty-two
      units, not nine. The floors ("below what height does a chart stop being a
      chart") were being read as an exchange rate between a box and a type size, so
      a full-frame `barChart` declared a body line to be 130 px and set its own axis
      labels at 85.

      **A WORD IS NOT CUT IN HALF, and the size is what says so.** `textLines`
      packs characters, which is the only wrapping an estimate with no browser can
      predict, and for two passes `word-break: break-word` was read as the model
      that made it true. It is not: CSS puts an over-long word on a line of its OWN
      and breaks inside it only when it still does not fit. A rendered frame is
      what settled it — `NEUF SEIZIEMES` in display type came back `NEUF S` /
      `EIZIEME` / `S`, the one defect here a viewer reads as broken software rather
      than as a small heading. So the type is BOUNDED by its longest word
      (`wordCeiling`, folded into `shapeCeiling`, one bound for the whole
      catalogue), and the declaration stays as the last resort it always was —
      `blocks.test.js` still requires it of every kind with a wrapping run, and the
      panel family still asks the same bound about the width its padding leaves.

      **A band is bounded by what its stack can DRAW, and the rest of an empty
      frame is the DOCUMENT's.** An appetite is a want and `shapeCeiling` is where
      a run stops growing, and for one pass they were read as one number: a
      measure-bound stack asked for a band on its appetite and drew a fifth of it,
      and the four fifths came out of the blocks beside it. `waterFill` caps a
      band at what can be drawn in it and hands the surplus to the bands that can
      spend it. When none can — `extrudedType` with the word RELIEF alone on 9:16,
      7% of the frame's height — there is no arrangement of boxes that fills it: a
      line of type has an aspect ratio and a portrait safe area has another, and
      the only two things that would are cutting the word (`wordCeiling` refuses,
      and a rendered frame is why) or crossing the feed's own margin. What the
      layout owes there is that nobody is CHARGED for the air, which is the box
      being the block's own extent and the band being bounded.

      Three consequences, and none of them is optional. `runAdvanceEm` measures
      every run on its OWN glyphs: the flat sentence average is 0.52 against the
      0.73 capitals really set at, so a bound computed on it would have changed
      nothing — and `meanAdvanceEm`'s floor is what makes that a correction of the
      runs the average was wrong about rather than a new scale. There is a FLOOR,
      `WORD_FIT_FLOOR_PX` = `BOLD_LARGE_PX`, because a URL or a German compound is
      longer than a narrow cell at every legible size and the answer cannot be a
      unit tending to zero; under it the run is not bounded **at all** and the
      break is the decided lesser evil, which is `texturedGround`'s rule one level
      up — the type yields to a word and never yields for nothing. And
      `BOX_FILL_FLOOR` is restated rather than dropped: a bounded block fills its
      MEASURE exactly and gives back HEIGHT, so a `fills: 'both'` kind whose text
      is one long word leaves a box under three quarters full. That is honest, and
      it is checked on a degenerate corpus of its own rather than left as prose.

      **A SUBJECT takes the scene; a piece of FURNITURE takes its part.** "A lone
      block is the scene" is right about a picture, a chart and a headline and wrong
      about seven kinds — a `lowerThird` alone over a photograph came back as a
      full-frame card hiding three fifths of it. The test is not how much text a
      kind carries but where its SIZE comes from: a subject is dimensioned by what
      is around it, a piece of furniture by the FORMAT, and a lower third that fills
      the frame is not a bigger lower third but a card. `BLOCK_FURNITURE` names the
      seven and argues each; `furnitureCeiling` is the whole cost — the safe height
      over `SCENE_UNITS`, which is `BLOCK_APPETITE`'s own field tier and not a
      second density. Three things keep it small: it bounds the UNIT and never the
      box (so `stackIn` still hands the block a box it fills), it measures against
      the SAFE AREA and never the zone, and it applies to a stack that holds nothing
      else — lowering a unit for a `kicker` over a `heading` would set the headline
      at a surtitle's scale, and a mixed zone was already right because `stackIn`
      divides it by appetite. Two clauses, both the same sentence — a block sized by
      the format sets no scale for anything else: furniture anchored `full` is **not**
      a field, and a furniture stack is skipped by `harmoniseUnits`'s SCALE bound,
      or a `barChart` beside a `kicker` composes at 43 px instead of 56 and draws
      three quarters of a frame it has all of. The ORDER bound still applies to it,
      because an inversion is what an eye reads whatever made the band small.

      **And a field is not a uniform surface: it says where it sets type.** A
      `kicker` anchored `bottom-center` over a `barChart` anchored `full` landed
      exactly on the chart's row of labels — both at the right size, so the conflict
      was positional and no scale rule could see it. The field DECLARES
      (`FIELD_FOOT`) and the cell does not move, because moving it would relocate
      the one composition decision a document makes and because only the block knows
      where its own caption goes. The bands are then split over the safe area LESS
      that foot. Three things make it exact: the LAST block of the `full` stack is
      what is measured, the unit is the field's own from before `harmoniseUnits`
      (which only lowers), and the field is PINNED to the edge it declared — centred,
      a shrunken field would draw its caption above the band the cells were kept out
      of. The entry condition is `fills: 'both'` and `clock` is why it is written
      down: a dial floats in its box, so its label is not at the foot of it. A field
      with no text declares nothing and forbids nothing, which is the case the
      repair must not break, and `composition.test.js` checks the guarantee against
      `barChartLayout` and its two neighbours rather than against the reservation.
    - **Legibility runs through `composedPalette` and nothing else.** Three
      surfaces — the ground, a panel, the accent fill — and a block reads a run
      rather than choosing a colour. The ground is a RANGE: a gradient is sampled
      along its ramp (two ends clearing 3:1 does not prove an ink is outside the
      band between them), an animated texture is measured at its maximum and
      fades only downwards, and the tint yields whole when it is what makes a line
      illegible.

      **A block anchored `full` is a second ground**, and that sentence was
      missing until an export showed eighteen accent bars meeting an accent word
      at 1:1 in the middle of a frame. A scene that stacks anything on a `full`
      block (`stackedField`) resolves its own palette: the field enters the
      measurement as the colour it PAINTS — `FIELD_PAINTS` is that table, and it
      exists because "the accent" was true of five blocks out of six. The sixth
      is `solidScene`, painted at two brightnesses in an ink of its own, and a
      second export showed both halves of the omission: the solid was
      `palette.display.color`, the same ink as the heading standing on it, and the
      field it made never entered the measurement at all. So a solid is measured as
      the two ends of its Lambert segment (`solidShading`'s own proof, one layer
      out), its material is the ORNAMENT's run resolved on the BARE ground — the
      fixpoint argument the accent run already makes — and `fieldPaints` answers a
      SET, which is also the palette cache's key. Whatever the paint, the field is
      a tint sampled along its own density, and it cedes DENSITY
      down `FIELD_ALPHAS` — which starts at 1, so the common case pays nothing —
      before the texture is given up. Two consequences: the accent run stays
      measured on the BARE ground when the field READS that run — `globe`, the
      two flat charts and the rest of the accent family paint `palette.accent`
      itself, so republishing it in a fallback ink repaints the field in it and
      the surface measured stops being the surface painted. That is ONE case and
      the code had it as the general one: a `kicker` over a `gallery` measured
      1.03:1 at the pixel, over a `waveMesh` 1.36:1, against a floor of 3. The
      ornament a scene publishes is resolved a second time on the surface that
      WON — never inside the ladder, which would fade a photograph so a surtitle
      could keep its colour. And the density
      is an opacity on the ZONE, so the twenty-eighth block cannot forget it.
      `palette.groundTint` is what gets painted, `palette.ground.tint` is what got
      measured, and they differ by exactly the field.

      Three corollaries, and the third is the one to read first. **A floor is
      chosen by type ROLE, never by the run a surface happens to offer** — a
      `codeBlock`'s `plain` lines are the bulk of a panel and are running text, so
      the panel carries a FOURTH run, `panelText`, at 4.5 and full strength;
      before it, twenty lines of 21 px monospace shipped on `panelDisplay`'s 3:1.
      **A `ground` progress follows the PAINT and not the kind**: the three
      animated grounds move by moving a tint that yields, so `ComposedSceneVideo`
      passes `groundPainted(palette)` into `sceneMotion` instead of the motion
      guessing. And **the sentence that hid all of this is still in the tree, as
      history**: "it carries no text, so the only thing it can get wrong is
      spending contrast something else needed". Every block that is a surface now
      says why that is false of it.

      **A PHOTOGRAPH is the fourth paint, and it is BOUNDED rather than measured.**
      `gallery`, `carousel`, `imageFrame`, `photoStage` and `photoRing` anchored
      `full` are a field of pictures nobody in this process has opened, and the
      gap was named in `gallery.jsx` for two passes before an export made it
      urgent: a `heading` over a `photoStage` — the plainest scene there is —
      measured the panel's BODY and shipped white on pale wood at 1.68:1. So
      `picture` enters as the two ends any picture lies between, black and white,
      as two tint LAYERS at the field's density and never as an alpha on the
      ground (a stage paints a lit body BESIDE its photograph, so an alpha is a
      product where a union was wanted), with no `FIELD_RAMP` (one opacity, not a
      range) and with the veil LOCKED (a picture block is painted over the ground's
      veil, so raising it buys a run on the picture nothing). What cedes is the
      density, and the rung it lands on is measured: 0.4, which is MORE of the
      picture than the same theme keeps on an `image` ground.
    - **One block costs a dependency, and it was measured before it was taken.**
      `solidScene` needs `three`, `@react-three/fiber` and `@remotion/three` —
      MIT, no native binary, +32 MB on a 1.57 GB image, +4 s on an 83 s build,
      and +0.9 s of render per second of film against the 1.7 s/s the deadline
      leaves spare. In `worker/video/package.json` only, which is what keeps that
      a non-question for anyone who never builds the image. A wireframe was in
      the enum until it measured 2.7 s/s and 16× the bitrate; Skia was refused at
      +461 MB of prebuilt binaries for four platforms this container cannot run;
      a syntax highlighter was refused because its output is thirty unmeasured
      hex values and the palette offers four measured runs. `funTitle` and
      `codeBlock` are what those two became without a package. The numbers and
      the reasoning are in `docs/video-export.md`.
      Half of what `setPiece` means is now **bounded by the layout rather than by
      the prompt**: a solid's canvas is a share of its own BOX, so a scene naming
      eight of them draws what one frame draws, and
      `tests/video-composed-frame.test.js` proves it. "At most one in the whole
      film" is therefore about attention, and the card says the true cost — a set
      piece in a crowded stack does not get expensive, it gets small.
    - **Two ornaments only a rendered frame catches.** A full-measure rule follows
      the edge the DOCUMENT chose: `heading`, `kicker` and `textHighlight` reveal
      theirs with a `scaleX` whose origin is `--mocky-rule-origin`, the zone's own
      `textAlign` inherited (one table, and the three keywords coincide), because
      hard-coded `left` under a centred stack sat flush against a margin the type
      does not use — beside a `separator` the flex row had centred. `quote` keeps
      `left` and says why: its rule grows out of the quotation mark. And a `stack`
      shadow is drawn only when the accent is a different colour from the ink:
      a direction stating one green for `text` AND `accent` resolves both runs to
      white, and `MOTION` came back struck twice. `STACK_SEPARATION` is just past
      "the same colour" on purpose — the copy carries no glyph, so a 3:1 bar would
      delete the treatment on the themes that render it correctly.
    - **A GL canvas is sized for what a block DRAWS, not for the object it is a
      picture of.** Two exports came back with the globe's right half stopping on a
      straight vertical line — the defect a viewer reads as broken software — and
      the sphere was innocent. `GLOBE_RADIUS` is `SOLID_BOUND`, "the exact radius at
      which a ball touches the edge of its canvas and never crosses it", and the
      block hangs four things off that ball that are not on it: a connection bowed
      by `GLOBE_ARC_LIFT` (`1.16 R`, 64 px outside at full frame), a marker sphere
      centred ON the surface, a ripple ring in the tangent plane, and the dot
      SPRITES, which are pixels around their own point. Against 2% of rounding.
      `globeShell` is the closed-form bound and it reads the BLOCK, so a globe with
      no ornament pays nothing; `blockExtent`'s claim is untouched, since a globe
      still draws to the minor side of its box — what changed is which part of the
      drawing touches the edge. The other eight were measured the same way, by the
      ink of a rendered corpus, and none of them crosses.

      The COLLISION is a different question and `FIELD_FOOT` does not extend to it:
      a foot is at an edge and leaves one contiguous run, a `fills: 'minor'` subject
      is in the middle and leaves two disjoint ones — a stack cannot be laid out in a
      hole, and on 16:9 the reservation would leave the cells nothing at all. The
      repair still open is moving the SUBJECT, because `full` is the one anchor that
      names no position; its condition is written beside `FIELD_FOOT`.
    - **Nothing in `blocks/` imports `remotion`, writes a colour, or eases.** The
      frame arrives as `progress` and `life`; that is what lets `blocks.test.js`
      load the registry in Mocky's own suite and prove it matches the schema in
      both directions. `blocks/index.js` is a map and nothing else, so
      twenty-seven people can each own one file without touching the same line.
11. **A Motion KIND is a doorway into that catalogue, never a sixth template.**
    `server/video/kinds.js` — eight of them (`hero`, `background`, `banner`,
    `showcase`, `figure`, `globe`, `mark`, `story`), and each resolves to nothing
    but a subset of `BLOCK_KINDS`, a subset of `BACKGROUND_KINDS`, one
    `ASPECT_RATIOS` value and a window inside `TEMPLATE_LIMITS.composed`. What
    comes out is an ordinary `composed` document: the worker never learns a kind
    existed and a draft saved before this parses unchanged. It NARROWS and never
    argues — the blocks it does not offer are absent from the catalogue and from
    the decoder hint, which is `availableBlocks`'s own lesson a third time — and
    it may never add back what the selection or the 3D permission withheld.
    Three things to know. A narrowing can STARVE a kind without emptying it:
    `globe` with no 3D still has `map`, `heading` and `kicker`, so the question is
    asked of `signature` and the refusal names the door to knock on. `background`
    is the proof of the mechanism (no block that sets type, no `image` ground) and
    of the degradation (`soundWave` and `equalizer` keep it alive on an account
    without 3D). And the enum is **published on `/status`, not mirrored** — a
    sixth hand-kept mirror in a feature bitten by four is the one thing this could
    not afford, so the panel reads ids and bounds off the server and the prose a
    person reads is `muse.motionKind.<id>` in both dictionaries.

    The **direction** now reaches the model and the **theme** still does not.
    `directionBriefFrom` reads the same markdown `theme.ts` reads, for the WORDS:
    they travel in the USER turn as data (Q5) and decide what gets COMPOSED, while
    the colours keep travelling as `theme`, attached after validation, never in a
    prompt. Every hex triplet is dropped from the extract — the colours are
    already exact elsewhere, and repeating them only invites the one refusal that
    costs a whole paid call.

    **A film cannot enter the preview iframe, and that is a boundary rather than a
    gap.** The srcDoc's CSP has no `media-src`, so it falls back to
    `default-src 'none'` and a `<video>` is refused; and `GET /api/video/:hash` is
    session-guarded while the frame's origin is opaque, so a `SameSite=Lax` cookie
    is not sent and the route answers 403. Either alone is decisive. A scroll
    sequence works because it is JPEGs under `img-src *` from a deliberately
    unauthenticated route; a film is one private `.mp4` and there is no ffmpeg on
    the export path. So the film is attached to the SCREEN (`AttachedMedia`) and
    drawn on the canvas, and `muse.motionCost` says so before the box is ticked.
    Do not "fix" this by adding `media-src` or by opening the route.

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
