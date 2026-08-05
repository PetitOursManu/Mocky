# The quality pass

Mocky generates a screen and puts it on the canvas. The quality pass is the layer
that reads that screen back, says what is wrong with it, and — if you ask — fixes
what it found.

It exists because everything Mocky had before it acted **before** the screen did.
The generation prompt forbids placeholder text. The Muse dossier lists the
clichés to avoid for this project. Both are instructions, and an instruction is a
hope: nothing ever looked at the result and compared it to what had been asked
for.

---

## What it is, and how you reach it

Right-click a screen and pick **Polish (detect and correct)**. That is the only
way in. There is no automatic run, no setting that enables one, and no hook
anywhere on the generation path — `polishScreen` in
`src/components/ProjectView.tsx:1396` is the sole caller of `checkQuality` and
`runPolishLoop` in the whole front end.

That is deliberate, and it is [M1](architecture/invariants.md) again. M1 says
that with Muse off the payload sent to the provider is the pre-Muse payload; a
check that fired after every generation would put a second model call on a path
that is supposed to be untouched, for a feature nobody switched on. A quality run
is something you do to a screen, not something that happens to it.

The whole pass, in the order it runs:

```
screen source
  → checkQuality()        src/lib/quality.ts    lintSlop locally, then POST /api/muse/quality
      → detectQuality()   quality/detect.js     deterministic rules
      → critiqueScreen()  quality/critique.js   one model call for the rest
      → buildAudit()      quality/audit.js      score, priorities, confidence
  → runPolishLoop()       src/lib/polish.ts     check → correct → check
      → polishComponent() src/lib/generate.ts   POLISH_PROMPT
```

Everything after the first `checkQuality` is optional in the strongest sense: a
missing detector, an absent model, a provider that times out — each removes a
contribution, adds a notice, and the run still returns a report. That is
[Q1](architecture/invariants.md), and it matters more here than anywhere else in
Mocky, because the screen being checked has **already been generated** and is
already on the user's canvas. A failure to check a screen must never look like a
failure to make one.

---

## The two halves

Two engines answer two different kinds of question, and they merge into one list
before anything downstream sees them.

### Deterministic detection

`server/muse/quality/detect.js` wraps the [`impeccable`](https://github.com/pbakaus/impeccable)
package, which ships 59 deterministic rules for the visual tells of
machine-written UI. They are the questions a regex can settle: `tiny-text`,
`low-contrast`, `gradient-text`, `cramped-padding`, `overused-font`.

The import is dynamic and its failure is remembered in `importFailed`, so a
broken install produces one notice and is not retried on every call.

### Why `detectText`, and not the richer engines

The package ships more than one engine. Mocky uses exactly one, and the reason is
not performance.

`detectText` takes the source as a **string** and reports a **line** and a
snippet pointing into the generated JSX. That is what makes the correction half
of this feature possible at all: **a finding the model can locate is a finding it
can repair.** `findingsToPrompt` in `src/lib/quality.ts:234` renders each one as
a numbered `[rule] (line 42, near \`…\`) name: description`, and the model is
pointed at the problem rather than told to go looking for it.

The alternatives both fail that test:

- `detectHtml` reads from disk with `fs.readFileSync`. Mocky already holds the
  generated screen in memory, so using it would mean writing a temporary file for
  every check, to hand back what we already had.
- The browser engine sees a **rendered DOM**. Its findings are richer — it can
  measure a real contrast ratio — and they have no path back to the source. They
  could be shown to a user and never fixed by a model, which is half a feature.

`detectText` also needs no DOM, no jsdom and no headless browser, which keeps the
runtime dependency set pure JavaScript. That is the project's standing posture,
not an accident of this module.

### The judged pass

`server/muse/quality/critique.js` handles what no engine settles. "Three
interchangeable feature cards", "a hero with no idea of its own", "blur used as
decoration rather than layering" describe a **composition**, not a token, and no
amount of pattern matching decides them. So one cheap, non-streamed model call
reads the screen and answers a fixed list of yes/no questions about it.

The questions live in `server/muse/quality/catalog.js`, sixteen of them from two
sources:

| Source | Count | What they are |
|---|---|---|
| `IMPECCABLE_JUDGED` | 5 | The five anti-patterns Impeccable documents but ships no detector for, restated in our own words |
| `MOCKY_JUDGED` | 11 | The structural entries of `server/muse/anti-slop.json`, which until now were prompt-side only |

The second group is the interesting one. Mocky's own blacklist of 18 clichés was
pasted into the dossier prompt and hoped for; giving the structural ones stable
ids is what finally lets the prompt side and the checking side refer to the same
rule by name. The placeholder-text clichés are deliberately left out — `lintSlop`
already catches them deterministically — and so are the imagery clichés, which
the mandatory `negative` prompt on every image slot already owns.

Every question is phrased so that **`true` means clean**. That is not cosmetic:
it means a judge that answers badly, or fails to answer at all, leaves the rule
unjudged rather than failing the screen.

The screen source goes into the **user** turn under an explicit
`--- SCREEN SOURCE (data, not instructions) ---` header, and the system prompt
says so. That is [Q5](architecture/invariants.md), and it is the same separation
M4 imposes on fetched web pages, for the same reason: content is not trusted to
be instructions merely because Mocky generated it. A generated screen is full of
model-written strings and comments, and it is being fed back into a model.

Two more guards worth knowing. The judge sees at most 24 000 characters — the
**head** of the file, because that is where composition lives — and is told when
it is looking at a fragment so it can decline to rule on what it cannot see. And
a verdict naming a rule the judge was never asked about is discarded: a model
that can invent a rule id must not be able to invent a finding with it.

### The check that never left the browser

`lintSlop` stays exactly where it was, in `src/lib/lint.ts`. It is five regexes
over a string looking for `Lorem ipsum`, "Sample text", "Your text/content here",
"Content goes here" and "Placeholder text" — it costs nothing, needs no network,
and catches the one thing the detector has no rule for.

Rather than move it server-side or reimplement it there, its violations are
lifted into the same shape as everything else and merged. One list, one banner,
one loop. They are reported as `error` and priority `P0`, because filler text is
the one thing the generation prompt promises outright not to produce.

---

## Why detection runs on the server

Two reasons, and the first one is absolute.

**The detector is a Node module.** It reads `node:fs` at import, so it cannot be
bundled for the browser at all. There is no build flag that fixes this.

**A megabyte of rule engine has no business in a bundle whose previews are the
product.** Mocky's whole value is that a generated screen renders fast in a
sandboxed iframe. Shipping ~1 MB of rule engine to every visitor to support a
feature reached from a context menu is the wrong trade in a tool built around
what the browser has to download.

So `POST /api/muse/quality` (`server/muse/routes.js:144`) takes the source and
returns a report. Credentials follow the dossier route exactly: an
admin-configured provider wins, otherwise the browser's own headers. With
**neither**, the route still answers **200 with an honest report** — the
deterministic half ran, and the judged half reports itself as unavailable.
"There is no judge available" is a fact about the report, not an error in the
request.

---

## `policy.js` — read this one first

`server/muse/quality/policy.js` decides what Mocky *does* with each rule, and it
is the centre of gravity of the whole feature. The 59 deterministic rules were
written for hand-authored product code. Mocky's code is model-written,
Tailwind-only, and generated under a set of instructions of its own — and some of
those instructions contradict some of those rules.

Enforcing everything blindly means the correction loop spends its whole budget
undoing what the generation prompt just asked for, and **loses**, because the
prompt is applied again on the next generation. This is
[Q2](architecture/invariants.md).

### The two conflicts are real

Neither is hypothetical. Both are verified against the shipped code, and both are
why the layer exists.

**1. `overused-font` fires on Inter.** `src/lib/design.ts:291` ships

```
- Font: system-ui / Inter, sans-serif
```

as Mocky's own default `DESIGN.md`. Enforced as written, every screen generated
with the stock design system reports a violation of a choice **Mocky made for the
user**.

**2. `src/lib/generate.ts:50` settles the question of taste.** It tells the model,
verbatim:

> If an art direction is supplied below (a DESIGN SYSTEM or a DESIGN DOSSIER),
> its palette, radius and typography OVERRIDE every stylistic suggestion in these
> rules. Follow it exactly, even when it contradicts what you would otherwise
> choose.

That sentence closes the argument. When a project has an established direction,
whether a colour or a typeface is tasteful is not Mocky's call to make. The user
already made it, and a screen that honours a violet direction is correct, not
sloppy.

### Four dispositions

Hence four, rather than a boolean:

| Disposition | Effect |
|---|---|
| `enforce` | Fix it. The correction loop is allowed to spend an iteration on it |
| `advise` | Report it. The user sees it; the model is never asked to act on it |
| `ignore` | Drop it entirely. Only for rules that are actively wrong here |
| `direction` | Conditional — `enforce` when the project has no established art direction, `advise` when it has one |

`direction` is the disposition that encodes the sentence above, and
`hasDirection` is the **only** run-time context `dispositionFor()` takes.
Everything else is static. `polishScreen` derives it from `activeDirection()`:
the project has a direction, so the rules about palette and typography become
advice rather than corrections.

Two examples of `ignore`, because the reasons are instructive rather than
arbitrary. `broken-image` is dropped because image slots are filled from the
Muse image library by hash **after** generation (M6) — a `src` the detector
cannot resolve is expected, not broken. `script-error` is dropped because render
failures already have a better path: the iframe error boundary feeding
`fixComponent` (I5).

### Silence must not exempt a rule

`DEFAULT_DISPOSITION` is `'enforce'`. Anything the table does not mention is
applied.

That default is the deliberate direction to fail in. A new rule arriving in a
future version of the detector should take effect and be demoted only once
someone can say why — the alternative, an allowlist, means a rule set that
silently stops growing the day nobody remembers to update the table.

The same logic runs the other way for visibility: `applyPolicy()` returns the ids
it dropped alongside the findings it kept, and `runQuality` passes them up as
`ignored`. "Why did it not flag X" has an answer that does not require reading
`policy.js`.

### Every demotion states a reason

Each `RULE_POLICY` entry carries a `reason` string, and
`server/muse/quality/quality.test.js:99` walks the whole table requiring one of
more than twenty characters on every entry.

The reason is what makes the table reviewable. A disposition with no
justification is indistinguishable from a rule somebody found annoying once, and
a table of those is not a policy — it is a list of exemptions nobody can audit.

### Keeping a treatment the judge dislikes

The policy governs the **judged** rules too, and for a better reason than
symmetry: they are the most opinionated rules in the system. "Blur is decoration,
not layering" and "that radius is too large for that card" are taste calls, and a
project whose direction genuinely wants a glass treatment should be able to say
so without arguing with the correction loop on every pass.

Listing a judged rule as `ignore` means the question is **never even asked**,
which is the only disposition that also saves tokens. The commented example sits
at the bottom of `policy.js`:

```js
'glassmorphism-everywhere': { disposition: 'ignore', reason: 'This product\'s direction is built on frosted layers.' },
'extreme-card-radius': { disposition: 'advise', reason: 'Large radii are part of the brand; report, do not rewrite.' },
```

Unlisted — the shipped state — means `enforce`, so the catalogue works out of the
box.

---

The whole table, and the switch that moves it. Ticking the box re-runs
`dispositionFor` with `hasDirection: true` — the nine rules that judge taste in
colour or type move from *corrected* to *reported*, because with a direction in
force the model was told to obey it. The reason recorded against each rule is
printed under its name.

<div data-mocky-widget="rules"></div>

The table is generated from the `impeccable` registry, `catalog.js` and
`policy.js` by `npm run docs:data`, and `npm run check:docs-data` fails the
build when it drifts from them.

## The correction loop

`runPolishLoop` in `src/lib/polish.ts` is written as a pure function over two
injected calls, one that checks a screen and one that rewrites it, so the
interesting behaviour — does it converge, does it stop — can be tested without a
provider or a server.

The rewrite itself is `polishComponent` (`src/lib/generate.ts:784`), and it is a
**sibling** of `fixComponent`, not a variant of it. They share the transport, the
extraction tail and the caller's guard pattern, and they must not share a prompt:
`FIX_PROMPT` says "fix ONLY the error, do not restyle", which is exactly wrong
here. A slop finding *is* a styling problem, and a model told not to restyle
hands the screen back unchanged and burns an iteration.

Only enforceable findings are ever sent. Advisory ones are shown to the user and
never spent a pass on.

### Four stopping conditions

`DEFAULT_MAX_ITERATIONS` is 2, and the budget is only one of the four exits. The
other three exist because a loop that only counts is a loop that can spend its
whole budget making a screen worse.

| Stop | Meaning | What is kept |
|---|---|---|
| `clean` | Nothing enforceable is left. The good ending | The corrected screen |
| `no-progress` | The same set of rules is still failing, or the model handed back code it did not change | The corrected screen when it changed, the original when it did not |
| `regressed` | The pass introduced more problems than it solved | The screen from **before** that pass |
| `budget` | The cap was reached with findings still open | The best screen so far |

A fifth outcome, `error`, exists for a stage that threw. That is Q1 rather than a
stopping condition: the loop returns the last good code and the screen survives a
failed attempt to improve it. A check that throws is treated the same way — the
rewrite may well be fine, but keeping an *unverified* rewrite is worse than
keeping the checked original.

`no-progress` is the guard the render-error repair loop already used
(`onScreenError`, `src/components/ProjectView.tsx:693`): two attempts maximum, and
an early bail when the new error is byte-identical to the last one. The quality
loop is the same idea applied to a set of rules instead of one message.

### Why `regressed` keeps the previous screen

`regressed` is the condition that costs a model call and then refuses its result,
which looks wasteful and is not.

A model having a bad day hands back something worse than what it was given.
Without this check the loop dutifully persists it, and the user's screen — which
was fine enough to be on the canvas — is now worse because they asked for it to
be improved. So the loop keeps what it had, stops, and says so.

The corollary is stated in the type: `PolishOutcome.code` is *"the best code the
loop produced — never worse than what it was given"*.

### Progress is a set of rule ids

`findingsSignature()` is rule ids, deduplicated, sorted, joined. No line numbers.
No counts alone. `signature()` on the server side is the same function again.

This is [Q3](architecture/invariants.md), and the failure it prevents is specific:
**a rewrite that fixes nothing still shifts every line.** A loop comparing lines
reads that as progress, spends its entire budget on it, and hands back a screen no
better than the one it started with — having paid for two model calls to do it.

The prompt is written to match. A finding cites a line number only as a hint:

> A finding cites a line number only as a hint. Line numbers may have shifted;
> fix the problem the finding describes, wherever it actually is.

---

## What was fixed, not only what is left

`PolishOutcome.fixed` is the initial findings whose rule no longer appears in
`residual`. It exists because of a real bug, and the bug is worth stating plainly.

A converged run leaves `residual` empty. A run that found nothing to do also
leaves `residual` empty. The first version of this module reported both as
"clean, 20/20" — so a pass that had rewritten six things read exactly like a pass
that had done nothing, and a working feature looked broken.

`fixed` is derived at a **single exit point**: `done()` in `src/lib/polish.ts:115`
computes it on every path rather than being recomputed at each of the returns
below it. Nine `return` statements each doing their own set arithmetic is how one
of them ends up subtly different from the others.

`polishScreen` then says which of the three things happened, and names the rules:

| Situation | What the user is told |
|---|---|
| Findings still open | `polishResidual` — the names still open, plus the score |
| Findings resolved, none left | `polishFixed` — **"Fixed: …"**, by name, plus the score |
| Nothing was found in the first place | `polishClean` — "Nothing to address", plus the score |

---

## The audit

`server/muse/quality/audit.js` turns a pile of findings into something someone
can act on.

### Five dimensions, twenty points

Five dimensions, each scored 0 to 4, summing to a health score out of 20:
`accessibility`, `performance`, `theming`, `responsive`, `antiPatterns`. Each
rule id maps to one of them; anything unmapped lands in `antiPatterns`, which is
the right default because the detector's whole `slop` category is about the tells
of machine-written UI, and that is what the fifth dimension measures.

The score falls into a named band:

| Score | Band |
|---|---|
| 18–20 | `excellent` |
| 14–17 | `good` |
| 10–13 | `acceptable` |
| 6–9 | `poor` |
| 0–5 | `critical` |

### Priorities and penalties

Every finding is tagged P0 to P3, and each priority costs its dimension a fixed
amount:

| Priority | Assigned to | Penalty |
|---|---|---|
| `P0` | `severity: 'error'` | 2 |
| `P1` | The default — an enforced finding | 1 |
| `P2` | `disposition: 'advise'` | 0.5 |
| `P3` | `severity: 'advisory'` | 0.25 |

An advised finding still costs something, which is the point of `advise` rather
than `ignore`: Mocky has decided not to spend a model call on it, not that it is
fine.

### The confidence model

This is the one departure from the published rubric, and it is the important one.

Mocky runs the **source** engine only: it reads the generated JSX as text. That
engine is strong on theming and on the visual tells of machine-written UI,
because those live in class names it can see. It is weak on accessibility and
responsiveness, because contrast ratios, line lengths and overflow are properties
of a **rendered** page. They need computed styles and geometry, and no amount of
reading the source produces either.

So every dimension reports its own confidence:

| Dimension | Confidence | Why |
|---|---|---|
| `theming` | `high` | These rules live in the class names |
| `antiPatterns` | `high` | Same, and the judged rules add composition |
| `performance` | `medium` | The animation-cost rules are visible as CSS; the rest are not |
| `accessibility` | `low` | Contrast ratios are a property of a rendered page |
| `responsive` | `low` | Line lengths and overflow, likewise |

Without that field the report awards **4/4 for accessibility to a screen nobody
checked for accessibility**. A score whose basis is not stated is worse than no
score, so the basis is stated — and each level carries its own `confidenceNote`
into the report, so the caveat travels with the number instead of living on this
page. This is [Q4](architecture/invariants.md).

### Coverage

Alongside it, `coverage: { deterministic, judged }`.

A screen that is clean and a screen that was never looked at score identically —
twenty out of twenty, band `excellent` — and they mean opposite things. The two
flags are how a consumer tells them apart.

---

## What survives on the screen

`polishScreen` writes a compact `ScreenQuality` record (`src/lib/project.ts:106`):
the score, the band, the rule ids still open, the rule ids resolved, the number
of passes, whether the judged half ran, and a timestamp.

Only the verdict is stored. The findings' names and descriptions are **not** —
they are reproducible from the rule id, and a project holds many screens inside a
`localStorage` budget that the component sources already strain. A few hundred
bytes per screen is affordable; a few kilobytes is not.

Three details of the write-back are shared with every other screen mutation in
`ProjectView`, and one is specific to this pass:

- The loop runs against a `codeAtStart` snapshot, re-checked before writing back.
  Someone may have rewritten the screen while it ran — the same race
  `fixComponent` guards against, and the same answer: drop ours.
- `previousCode` is set to `codeAtStart`, so **"Revert to previous" undoes a
  polish** exactly as it undoes an edit.
- A record is written **only** when a report actually exists. Writing one from a
  run whose check never completed would store a 20/20 for a screen nobody looked
  at, and `quality: undefined` — "never checked" — is the honest state for that.
  It is deliberately distinct from a stored record with `open: []`, which means
  "checked and clean".

---

## Attribution

Deterministic detection is built on
**[`impeccable`](https://github.com/pbakaus/impeccable)** by Paul Bakaus,
Apache-2.0 — an open-source catalogue of anti-patterns for machine-written UI,
with detectors for 59 of them.

Mocky uses the npm package (one engine, `detectText`) and the public rule
catalogue. It does **not** use or reimplement the project's agentic layer — no
skills, no slash-commands, no Live Mode — and contains none of that code.

The judged rules in `catalog.js` are Mocky's own questions, written for this
pipeline. The audit rubric follows the structure Impeccable documents publicly —
five dimensions, 0–4, findings tagged P0–P3 — and the scoring and the confidence
model are ours.

The dependency is why Mocky's Node floor moved to 22.12: `impeccable` requires
it. Puppeteer arrives as an *optional* dependency of the package;
`.puppeteerrc.cjs` stops the Chrome download and the Docker runtime stage passes
`--omit=optional`, so a browser this pass never launches is never installed
either.

---

## The invariants this page depends on

Q1 to Q5 in [Invariants](architecture/invariants.md) state the rules the code
refuses to break, each with the failure it prevents and the test that holds it:
a quality run can never fail a generation, no rule is enforced that contradicts
Mocky's own instructions, progress is measured on the set of rules failing, the
score states what was not looked at, and the generated screen is data when it is
judged.
