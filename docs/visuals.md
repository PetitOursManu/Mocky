---
description: Paste a text, get a diagram of it — steps, a cycle, a timeline, a comparison, key figures or a chart — in your project's look, editable and exportable.
badge: New
---

# Visuals

A **visual** is a text turned into one diagram that shows its structure at a
glance: the steps of a method, a cycle, the dates of a history, two options side
by side, a few key figures, a chart. You write or paste the text; Mocky picks
the shape and draws it in your project's colours and fonts.

## Making one

1. In the composer, choose the screen type **Visual** (in the documents).
2. Paste or write your text. Nothing else is needed: no instruction on how to
   draw it. You may still say "as a timeline" or "as a chart".
3. Pick a size: 16:9 slide (the default), a square, portrait or landscape post,
   or an A4 page.

The generation reads the text for its structure, chooses a family, and writes
the content once: a title, a subtitle, and one item per idea, with a short label
and a sentence of detail. Muse does not run for a visual, even when it is on: a
visual is drawn in the project's direction and needs no pictures, so the dossier
would be a call for nothing.

## The families

| Family | For |
|---|---|
| Steps | A process done in order |
| Cycle | A process that comes back to its start |
| Timeline | Dates or phases |
| Funnel | What narrows from stage to stage |
| Pyramid | A hierarchy, top first |
| Comparison | Two or three options, point by point |
| Pros and cons | Advantages and drawbacks |
| Matrix | A 2 × 2 grid and its two axes |
| Hub | One central idea and what surrounds it |
| Mind map | A topic, its branches and their points |
| Flowchart | Paths, choices, loops |
| Key figures | A few figures and what they measure |
| Bars | Quantities to compare |
| Donut | The shares of a whole |

## Changing the shape without a new generation

:::why
The content does not depend on the family: the same items can be drawn as steps
or as a cycle. So switching is writing one word in the screen's code, which costs
nothing and keeps every word you had.
:::

Right-click the screen → **Visual…**. The families proposed for this content come
first; the others follow. A family that cannot draw this content is greyed, with
the reason: a chart needs a figure on every item, a matrix exactly four items, a
comparison sub-points under each option. The same dialog switches the boxes
between **Tinted**, **Filled** and **Outline**. **Undo** takes any change back.

To change the words, edit the screen as usual (the composer, or **Fill…**).

## Figures

:::why
A visual looks like a fact. A plausible figure the text never gave — a chart of
a text that had no numbers — is worse there than in a paragraph.
:::

A visual shows only the figures your text gives. After the generation, every
figure in the visual is looked for in your text, under the forms a writer uses
for it (1 200 and 1,2 k, 12 % and 0.12). One that cannot be found is taken out of
the visual, its item kept, and a notice names it. Figures written in words
("twelve") are not recognised: write them in digits.

## How it is drawn

The model never draws the diagram. It names a family and writes the content;
Mocky's own layout computes the boxes, the connectors and the type sizes, the
same for every visual of a family:

- every box of a visual uses one label size, the largest at which all of them
  fit, and a detail is always smaller than its label;
- a word is never cut in half: the type gets smaller instead, and the details go
  before the labels when space runs out;
- every text is measured against the colour it sits on and kept readable, with
  your palette's colours tried first.

## Exporting

A visual is a document: it downloads as PNG, PDF, SVG or PowerPoint like any
other ([Downloading](documents.md#downloading)). Its boxes are drawn as page
elements, not as one picture, so **Everything as separate elements** in the
PowerPoint export gives each box back as a shape and each label as a text box.
The connectors and the donut come out as pictures.

## Limits

- One visual per screen is the intended use; a screen may hold several, and the
  dialog lists them.
- The figures check reads the request you typed. A figure that came only from a
  picture or a PDF you attached is not in that text, and is taken out.
- A family draws at most a fixed number of items (ten on a timeline or a bar
  chart, eight in most others); the rest are not drawn.
