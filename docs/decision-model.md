---
description: Audit every page of a project against one grid drawn from its goal. A decision model scores the pages; Muse writes what the scores mean.
badge: New
---

# Project audit and the decision model

The **Audit** panel has two tabs. **One screen** is the
[SEO and accessibility report](seo-accessibility.md). **The project** audits
every page of the project against one grid: what works, what is weak, what to fix
first, and what your changes moved since the last audit.

## Running an audit

1. Open **Audit** in the project toolbar, then the **The project** tab.
2. The first time, write the project's **goal** in one sentence ("fill the
   festival hall on 14 June, with the families of the neighbourhood") and the
   **expected elements**, one per line: a date, a place, a price, contact
   details, a legal mention. A campaign's facts are already included.
3. **Run the audit.** Muse writes the grid for this project, every page is
   examined against it, and Muse gathers the results.
4. After your changes, **Run it again with the same grid**. The report shows
   what moved since the previous audit, criterion by criterion. **New grid**
   starts over, and that run is not compared with older ones.

Each finding links to the pages it is about: a click shows the page on the
canvas. The project keeps its grid and its last eight audits.

## The grid

Six criteria. Their names stay the same from one project to the next, so that two
audits can be compared. Muse rewrites the question and its five levels in this
project's terms.

| Criterion | Asked of |
|---|---|
| Clarity of the offer and the messages | each page |
| Organisation of the information and the path | each page |
| Faithfulness to the brief and the brand | each page |
| Visual and editorial coherence | all the pages together |
| Repetitions, contradictions and gaps | all the pages together |
| Expected elements | all the pages together: which page shows each one |

A score goes from 0 (the worst level) to 4 (the best), and each level is a
sentence you can read in **The grid**, under the results.

## What the report contains

- **Observed problems**: what the scores show is weak, missing or
  inconsistent, with a priority (P1 first).
- **Priority improvements**: what to do about it. Observations and
  recommendations are kept as two separate lists.
- **Strengths**: what works.
- **Criteria**, **expected elements** and **by page**: the numbers behind the
  three lists.

## What a result does not say

- **The audit reads the pages' words and structure, not how they render.**
  Contrast, performance and broken links need dedicated tools. The **One
  screen** tab covers accessibility.
- **An element not found is not necessarily absent.** The report says "not
  found", never "missing".
- **A score does not guarantee that a page works.** No score predicts clicks or
  sales.
- **A doubt is shown next to the number.** When the model's confidence is low,
  the result says "uncertain". When nobody could measure the confidence, it says
  "confidence not measured".

## The decision model (administrators)

A decision model does not write. It answers short, typed questions: a yes or a
no, a score on a scale described in words, one option from a list. It answers
fast and cheaply, and it reports how confident it is. Mocky supports one today:
**Jev**, from [TypeSafe](https://docs.typesafe.ai). TypeSafe sells it, and so do
gateways that resell it under the same API:

| Provider | Key | Model filled in |
|---|---|---|
| TypeSafe | console.typesafe.ai | `jev-latest` |
| [OpenRouter](https://openrouter.ai/docs/guides/community/typesafe-sdk) | your OpenRouter key | `~typesafe/jev-latest` |
| [Vercel AI Gateway](https://vercel.com/docs/ai-gateway/sdks-and-apis/typesafe) | an AI Gateway key | `typesafe-ai/jev` |
| [Opper](https://opper.ai/typesafe/jev-1-14-0) | your Opper key (Jev is "premium" there: a card on file) | `typesafe/jev-1.14.0` |
| Another System One–compatible gateway | that gateway's key | to fill in, with its address |

Set it up in **Admin → Providers → Decision model**. Choose the provider, paste
its API key, save, then **Test**. Each provider keeps its own address, model and
key, so switching from one to another loses nothing. A key never leaves the
server and is never shown again.

When a decision model is set up, it answers every evaluation of the audit.
Muse's text model still writes the grid and the synthesis. When none is set up,
or when the decision model fails twice in a row, Muse's text model answers the
same questions. The audit works either way. The difference is the confidence: a
text model cannot measure its own, so the report says "confidence not measured".

| | With a decision model | Without one |
|---|---|---|
| Who scores the pages | the decision model | Muse's text model |
| Confidence | measured, shown when low | not measured |
| Who writes the grid and the synthesis | Muse's text model | Muse's text model |

Two passes that already judged yes/no questions use it too:

- **[Polish](quality.md)**: the rules a regex cannot settle (three
  interchangeable cards, a hero with no idea of its own…).
- **The deep pass of the [SEO and accessibility report](seo-accessibility.md)**:
  whether an alt text describes its picture, whether a heading describes its
  section.

The decision model decides which questions fail. Muse's text model then writes
one sentence for each failed question only, naming the element that shows the
problem. A screen that passes everything costs no text-model call. The report
says which model decided. If the decision model does not answer, the pass runs
as before, on the text model alone.

Who reaches it:

- **Accounts on the free plan do not**, and neither do accounts on their own
  key. The decision model is billed to the instance ([the free plan](free-plan.md)).
  Their text model answers instead.
- **Its calls are counted** in **Spending**, under the provider you chose. The
  price is the one the gateway reports when it reports one (OpenRouter,
  Vercel), otherwise the list price on the input tokens ($42 per billion at
  TypeSafe; output is free). A gateway typed by hand has no list price: its
  calls are counted without one.
- **Pictures are off.** TypeSafe still presents picture input as not ready for
  production, and the audit sends none.

## The composer's Auto mode

When the instance has a decision model, the composer shows two modes above its
options: **Manual** and **Auto**. Manual is the composer as it always was: you
set each option. In Auto, before each new screen, the decision model reads your
request and chooses the options it runs with:

- **Muse**, **Motion Ultra**, **Creative**, **Creations** and **Flows**;
- **Diagrams**, on a document that draws them only when asked (a flyer, a
  poster, a menu…): whether its information should be drawn as diagrams;
- **the hero's scroll video**, on a page: none, a free clip or a Motion film —
  and an AI clip only as a suggestion you confirm (see
  [Muse](muse/overview.md#scroll-driven-video));
- **New direction**, only when the project already has one;
- **the screen type**, when you have not chosen one: a flyer, a landing page, an
  Instagram post… — the composer's own list. It is taken from 50 %; under that
  the screen is made with no type, as in Manual. A type you chose is never
  asked about, and neither is one when screenshots of a site decide the shape.

Only the options the composer could switch on are asked: a document has no
Motion Ultra and no flow — and when the type is still open, everything either
shape could use is asked, and what the chosen shape cannot use is dropped. Each answer is a probability of "yes"; an option is
switched on from 50 %, or 60 % for those that cost several more calls (Motion
Ultra, Creations, Flows) or rewrite the direction. The composer shows each
decision and its probability, and a line under the screen says what was
switched on.

Three things stay yours:

- **The pictures.** In Auto they start on the free libraries, and you can
  choose **AI** (or none) without going back to Manual. A paid picture is never
  a guess.
- **The brand and the rules.** They are the project's, not a way of writing one
  screen.
- **Your Manual settings.** Auto decides for one generation and changes none of
  them: switching back to Manual finds them as you left them.

Auto concerns new screens. While screens are selected, the composer shows
Manual's options: an edit keeps its screen's own. If the decision model does not
answer, Muse's text model chooses instead and the line says so; if neither
answers, the screen is made with your Manual settings. Accounts on the free plan
or on their own key do not see Auto. The mode is remembered by the browser;
Manual is the default.

## From an assistant

An assistant connected through [MCP](mcp.md) calls `audit_project`. It uses the
same engine and the grid the project keeps, so its report compares with your
last audit. It changes nothing: the history stays the panel's.
