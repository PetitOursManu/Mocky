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
| Checklist | Things to do or to have |
| Venn | Two or three sets and what they share |
| SWOT | Strengths, weaknesses, opportunities, threats |
| Before / after | A change from one state to another |
| Tree | A hierarchy that branches (an org chart, a breakdown) |
| Onion | Layers around a core |

## Illustrating a long text

:::why
An article or a report section holds several ideas, and one diagram cannot say
them all. Cutting it where the author already cut it — at the paragraphs — needs
no model, and each piece then gets the visual that suits it.
:::

**Illustrate** in the canvas toolbar (or **Illustrate a text** under *Also make*)
opens a panel. Paste the text or import a `.txt`, `.md` or `.docx` file: it is read
in your browser and nothing is sent. The text is cut into blocks:

- a paragraph is a block, and a heading (`# …` in Markdown, a Heading style in
  Word) names the blocks under it rather than being one;
- a list stays with the sentence that introduces it ("Three commitments:");
- a fragment of a few words joins the block before it.

Each block has **Make the visual**; **Illustrate all** makes the ones not made yet,
in order, at the size you chose. Every visual is an ordinary screen of the
project. A block already illustrated shows **Show**: the screen remembers the
words it was made from, so adding a paragraph above does not mix them up. The
text is kept with the project.

## Visuals in other screens

A report, a user guide, an article and the Instagram, LinkedIn and Facebook
posts can also draw a visual for the part of their content that is a process, a
comparison or a few key figures. Nothing to switch on: the generation is offered
the same families and decides. **Visual…** works on those screens too.

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

To change the words, edit the screen as usual: a sentence in the composer ("add a
step after testing", "make it a timeline") rewrites the content like any other
edit, or **Fill…** changes a value without a model.

## Figures

:::why
A visual looks like a fact. A plausible figure the text never gave — a chart of
a text that had no numbers — is worse there than in a paragraph.
:::

A visual shows only the figures your text gives. After the generation of a
**Visual** screen, every
figure in the visual is looked for in your text, under the forms a writer uses
for it (1 200 and 1,2 k, 12 % and 0.12). One that cannot be found is taken out of
the visual, its item kept, and a notice names it. Figures written in words
("twelve") are not recognised: write them in digits.

This check is not run on a report or a post that draws a visual, nor after an
edit: those pages are asked to invent realistic sample figures when you give
none, and emptying their charts would be the wrong answer.

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
A straight connector (a step's arrow, a timeline's axis, a tree's branches) is a
thin shape too; only curved connectors, arrow tips and the donut come out as
pictures.

## In another size

:::why
A visual measures the box it is given and lays itself out again, so the same
content at another size is not a new design: it needs no model.
:::

**Visual…** → **Make it in another size** puts a copy beside the visual, in the
size you pick (a square post, a portrait, A4…). The original does not change; the
copy is an ordinary screen, to switch, edit or export on its own.

## From an assistant

With Mocky connected to Claude, ChatGPT or another assistant ([Mocky in your
assistant](mcp.md)), `create_visual` makes a visual of a text in a new project,
and `add_screen` with the type `visual` adds one to an existing project.
`list_visual_families` tells the assistant what each family is for.

## Limits

- One visual per screen is the intended use; a screen may hold several, and the
  dialog lists them.
- The figures check reads the request you typed. A figure that came only from a
  picture or a PDF you attached is not in that text, and is taken out.
- A family draws at most a fixed number of items (ten on a timeline or a bar
  chart, eight in most others); the rest are not drawn.
