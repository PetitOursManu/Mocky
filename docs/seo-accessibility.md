# SEO and accessibility

The quality pass next door asks whether a screen looks like machine-written slop.
This asks a different question, and a harder one to answer honestly: whether the
screen's **markup** is sound — whether a search engine can read it and whether a
person using a screen reader can use it.

It is a separate report, a separate score, and a separate correction loop, and
the rest of this page is mostly about why.

---

## Where it is

Open a project, then the **Audit** button in the toolbar. The panel opens on the
right with every screen in the project as a thumbnail. Pick one, press
**Evaluate**.

Nothing runs automatically. Nothing runs on generation. Opening the panel costs
one localStorage read.

**Leaving abandons the run.** Closing the panel, or selecting another screen —
from the thumbnails or from the canvas — aborts an evaluation in flight. A deep
pass is a model call taking seconds, and it had no `AbortController` at all: it
kept being paid for after the panel was shut, and the spinner it left behind was
drawn over the report of the screen the user had just asked to see. The panel
shows one screen's report, so a check running for a different one can only ever
hide the one that was wanted.

---

## The two halves

### Deterministic, in the browser

Every structural question is answered locally, from an AST, with no network call
at all: `src/lib/audit/inspect.ts` walks the screen once and hands
`src/lib/audit/rules.ts` a summary to test.

This is the opposite arrangement from the quality pass, which detects on the
server — and deliberately so. That one wraps `impeccable`, a Node module that
reads `node:fs` at import and cannot be bundled for a browser. These rules are
Mocky's own, and running them here means the evaluation is instant, free, and
works with the backend down. That is what makes it reasonable to offer as the
default and put the model behind a second button.

Rules are matched against an AST and never against source text (invariant I1).
`<img` matches inside a string, inside a commented-out block the model left
behind, and inside a code sample the screen itself renders. A report claiming
three images have no `alt` when those three images do not exist is worse than no
report: it sends someone hunting, and it discredits the findings that are real.

### Judged, on the server

`POST /api/muse/audit` asks a model the questions a pattern cannot settle: does
the alt text describe what the picture *shows*, does a heading describe the
section under it, would this link text still mean anything read out of context.
The catalogue is `server/muse/quality/audit-questions.js`.

It is behind the **Deep analysis** checkbox because it spends tokens. The screen
travels as data, in the `user` turn, under a header saying so (invariant Q5), and
a verdict naming a question that was never asked is dropped rather than shown.

If it cannot run — no model, a timeout, an unparseable answer — the deterministic
report is returned with a notice attached. Losing a complete, free report because
a network call failed would be absurd (invariant Q1).

---

## What the score does not mean

Each dimension scores out of 100 and every one of them reports
`confidence: 'partial'`. That is not modesty, it is arithmetic.

Source-only analysis knows the markup and nothing about the rendering. It cannot
measure:

- colour contrast as painted,
- whether focus is visible,
- tap-target size,
- tab order as it actually runs,
- reflow at any viewport.

Those are half of WCAG. So **nothing here claims a conformance level**, and the
panel prints the caveat beside the number rather than in a tooltip — a number
whose caveat nobody reads is a number that gets quoted without it.

Two of those bullets have since gained a partial answer, and the report is
careful to say how partial. Contrast is computed where an element paints **both**
its own text colour and its own background, and a tap target's height is deduced
from the classes that declare it. Neither is a measurement of a rendered page,
which is why the colour family reports medium confidence and the tap-target
family low, and why neither says anything at all about the elements it could not
read.

A score of 100 means "nothing wrong in what this can see". It does not mean
accessible.

Scoring counts **distinct rules**, never elements. Twenty images with no `alt` is
one thing to fix; scoring it twenty times would drown every other finding and
make the number meaningless. The panel still lists every offender.

---

## The breakdown by family

Under the two scores the panel lists eight families — headings, images, links and
controls, forms, colour, typography, tap targets, structure — each with its own
number. It is the same findings, cut a second way: `seo` and `a11y` answer *how
does this screen do*, and the families answer *where do I go and fix it*. The two
genuinely do not line up. An unnamed button and a missing `alt` are both
accessibility errors and have nothing to do with each other, while `img-alt` and
`img-alt-redundant` are one afternoon in one file.

The order is fixed in `RULE_FAMILIES` and deliberately not derived from the
report. A list sorted by score reshuffles itself on every re-run, so the row
someone was reading moves under their cursor between two clicks of **Evaluate**.

Each row carries a confidence, and it describes the **method**, not the run:

| Families | Confidence | Why |
|---|---|---|
| headings, images, links, forms, structure | high | markup — an `alt`, a heading level, a `for`/`id` pair are in the source or they are not |
| colour | medium | only the elements that paint both of their own colours could be compared |
| typography, tap targets | low | `py-2` plus a line box is a statement about a box nobody rendered |

**A row can carry no number at all**, and that is the reason the section exists.
A family with nothing to examine reads *not applicable*; one whose subjects the
source does not describe well enough reads *not measured*. Neither reads 100. A
screen with no form and a screen whose forms are perfect produce the same empty
finding list, and only one of them has earned full marks — invariant Q4, applied
one level below the panel's own caveat. The two words are kept apart because they
are different facts about the screen: "there was nothing here to check", and
"there was, and the source does not say enough to decide".

Judged findings are filed as well. Their rule ids exist only in
`server/muse/quality/audit-questions.js`, so each question declares its own
family there and the browser drops any name it cannot place — the same discipline
as dropping a verdict that names a question nobody asked. Without it, a model
finding about headings would take points off SEO while the headings row still
read 100, and the breakdown would contradict the number directly above it.

---

## The exported document

A Mocky screen is one self-contained React component. It has no `<head>`, no
`<title>`, no URL and no routing — the generation prompt forbids all of it. So
the document-level half of SEO cannot be graded on a screen, because it does not
exist there. It exists in what the export writes, and it is checked separately
at the bottom of the panel, once for the project rather than repeated on every
screen.

Building that check found three real defects in `indexHtml`, all of them
invisible because nobody reads their own export's `<head>`:

| Was | Now |
|---|---|
| `<title>` was the **slugified package name** (`my-shop`) | the project's real name |
| `lang="en"` hardcoded, including on French projects | follows the interface language |
| no `<meta name="description">` at all | written when the project names a product |

`lang` was not a cosmetic default. It is what tells a screen reader which
language to pronounce, so every French export was being read aloud in English.

---

## Correcting

Each enforceable finding carries a **Fix** button, and there is a **Fix all**.
Both go through `runPolishLoop` — the same four stop conditions as the quality
pass, because "did this pass actually land" is worth solving once — with
`AUDIT_FIX_PROMPT` and the audit as its check.

The prompt is a third sibling of `FIX_PROMPT` and `POLISH_PROMPT`, and merging
any two of them breaks both. Each one's central instruction is wrong for the
others:

| | Says | Because |
|---|---|---|
| Repair | fix only the error, do not restyle | a crash is not a design problem |
| Polish | fix these findings, visual change expected | a slop finding **is** a styling problem |
| Audit fix | fix the markup, the screen must look identical | a semantics pass that redesigns has failed even with every finding gone |

**Fix is unavailable while the project is generating.** A correction is a screen
mutation, and every screen mutation in Mocky shares one `AbortController`, one
busy flag and one progress overlay — so a second one does not run beside the
first, it overwrites it. This was the one of the five that did not check, and
started during a regeneration it took the Stop button hostage: Stop cancelled the
correction, the regeneration became unstoppable, and the progress overlay moved
to whichever screen the audit panel was pointed at. The buttons are now disabled
while something else runs, and say why.

Advisory findings are never corrected automatically. Some rules legitimately
contradict a design: a landing page really can be one `<section>` with no `<nav>`,
and forcing landmarks into it would be markup added for the report's sake. Same
reasoning as `policy.js` in the quality pass (invariant Q2).

After a correction the screen's report is discarded rather than kept. It
describes source that no longer exists, and a stale score shown beside changed
code is worse than no score.

`Screen.quality` is **not** written by this. That field records the /20 design
audit, and putting an accessibility score in it would make two different
measurements share one number.

---

## Files

| Path | What |
|---|---|
| `src/lib/audit/inspect.ts` | AST walk → facts about the markup |
| `src/lib/audit/rules.ts` | the rule catalogue and the scoring |
| `src/lib/audit/index.ts` | `auditScreen`, `auditExport`, the deep pass client |
| `src/components/AuditPanel.tsx` | the panel, the thumbnail picker, the fix buttons |
| `server/muse/quality/audit-questions.js` | the judged questions |
| `server/muse/quality/audit-judge.js` | one model call, verdicts filtered |
| `src/i18n/parts/audit.ts` | every rule name and description, in both languages |
